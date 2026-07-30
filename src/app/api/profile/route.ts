import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { parseProfileUpdatePayload } from "@/lib/profile-validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createRandomSessionId } from "@/lib/device-session";

class IncorrectCurrentPasswordError extends Error {}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const limited = await enforceRateLimit({ key: `profile:${auth.user.id}`, limit: 10, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const parsed = parseProfileUpdatePayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : null;
  const now = new Date();

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (passwordHash) {
        const rows = await tx.$queryRaw<Array<{ passwordHash: string }>>`
          SELECT "passwordHash" FROM "User" WHERE "id" = ${auth.user.id} FOR UPDATE
        `;
        const currentUser = rows[0];
        const validCurrentPassword =
          currentUser &&
          parsed.data.currentPassword &&
          (await verifyPassword(parsed.data.currentPassword, currentUser.passwordHash));
        if (!validCurrentPassword) throw new IncorrectCurrentPasswordError();
      }

      const updatedUser = await tx.user.update({
        where: { id: auth.user.id },
        data: {
          name: parsed.data.name,
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (passwordHash) {
        await tx.userSession.updateMany({
          where: {
            userId: auth.user.id,
            revokedAt: null,
            ...(auth.session.user.sessionId ? { id: { not: auth.session.user.sessionId } } : {}),
          },
          data: { revokedAt: now },
        });
        await tx.securityEvent.create({
          data: {
            id: createRandomSessionId(),
            userId: auth.user.id,
            type: "PASSWORD_CHANGED",
            severity: "MEDIUM",
            message: "Senha alterada pelo perfil; outras sessoes foram encerradas.",
            metadata: "{}",
            createdAt: now,
          },
        });
      }

      return updatedUser;
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof IncorrectCurrentPasswordError) {
      return NextResponse.json({ error: "A senha atual esta incorreta." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Este nome de usuario ja esta em uso." }, { status: 409 });
    }
    throw error;
  }
}
