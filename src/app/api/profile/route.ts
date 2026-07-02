import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { parseProfileUpdatePayload } from "@/lib/profile-validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const limited = await enforceRateLimit({ key: `profile:${auth.user.id}`, limit: 10, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const parsed = parseProfileUpdatePayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existingNameOwner = await prisma.user.findFirst({
    where: {
      name: parsed.data.name,
      id: { not: auth.user.id },
    },
    select: { id: true },
  });

  if (existingNameOwner) {
    return NextResponse.json({ error: "Este nome de usuario ja esta em uso." }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      name: parsed.data.name,
      ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return NextResponse.json({ user });
}
