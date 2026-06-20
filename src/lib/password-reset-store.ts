import { hashPassword } from "./password";
import { createPlainResetToken, getPasswordResetExpiry, hashResetToken } from "./password-reset-token";
import { prisma } from "./prisma";
import { createRandomSessionId } from "./device-session";

const RESET_REQUEST_OK_MESSAGE = "Se existir uma conta com este e-mail, enviaremos um link de recuperacao.";
const RESET_CONFIRM_OK_MESSAGE = "Senha redefinida com sucesso. Entre novamente com sua nova senha.";

type PasswordResetUser = {
  id: string;
  email: string;
  isBlocked: boolean;
};

type PasswordResetTokenRow = {
  id: string;
  userId: string;
};

export async function ensurePasswordResetTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "usedAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_usedAt_expiresAt_idx" ON "PasswordResetToken"("userId", "usedAt", "expiresAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt")`);
}

export async function createPasswordResetRequest(email: string, origin: string) {
  await ensurePasswordResetTable();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isBlocked: true },
  });

  if (!user || user.isBlocked) {
    return { message: RESET_REQUEST_OK_MESSAGE, resetUrl: null };
  }

  const token = createPlainResetToken();
  const tokenHash = hashResetToken(token);
  const now = new Date();
  const expiresAt = getPasswordResetExpiry(now);
  const resetUrl = new URL("/redefinir-senha", origin);
  resetUrl.searchParams.set("token", token);

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "usedAt" = ${now}
      WHERE "userId" = ${user.id} AND "usedAt" IS NULL
    `,
    prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "usedAt", "expiresAt", "createdAt")
      VALUES (${createRandomSessionId()}, ${user.id}, ${tokenHash}, NULL, ${expiresAt}, ${now})
    `,
  ]);

  await deliverPasswordResetLink(user, resetUrl.toString());

  return {
    message: RESET_REQUEST_OK_MESSAGE,
    resetUrl: process.env.NODE_ENV === "production" ? null : resetUrl.toString(),
  };
}

export async function confirmPasswordReset(token: string, password: string) {
  await ensurePasswordResetTable();

  const now = new Date();
  const tokenHash = hashResetToken(token);
  const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>`
    SELECT "id", "userId"
    FROM "PasswordResetToken"
    WHERE "tokenHash" = ${tokenHash} AND "usedAt" IS NULL AND "expiresAt" > ${now}
    LIMIT 1
  `;
  const resetToken = rows[0];

  if (!resetToken) {
    return { success: false as const, error: "Link de recuperacao invalido ou expirado." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      const updatedTokenCount = await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = ${now}
        WHERE "id" = ${resetToken.id} AND "usedAt" IS NULL AND "expiresAt" > ${now}
      `;

      if (Number(updatedTokenCount) !== 1) {
        throw new Error("RESET_TOKEN_ALREADY_USED");
      }

      await tx.$executeRaw`
        UPDATE "User"
        SET "passwordHash" = ${passwordHash}, "updatedAt" = ${now}
        WHERE "id" = ${resetToken.userId}
      `;
      await tx.$executeRaw`
        UPDATE "UserSession"
        SET "revokedAt" = ${now}
        WHERE "userId" = ${resetToken.userId} AND "revokedAt" IS NULL
      `;
      await tx.$executeRaw`
        INSERT INTO "SecurityEvent" ("id", "userId", "type", "severity", "message", "metadata", "readAt", "createdAt")
        VALUES (${createRandomSessionId()}, ${resetToken.userId}, 'PASSWORD_RESET', 'MEDIUM', 'Senha redefinida por link de recuperacao.', '{}', NULL, ${now})
      `;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_ALREADY_USED") {
      return { success: false as const, error: "Link de recuperacao invalido ou expirado." };
    }
    throw error;
  }

  return { success: true as const, message: RESET_CONFIRM_OK_MESSAGE };
}

async function deliverPasswordResetLink(user: PasswordResetUser, resetUrl: string) {
  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL;

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: user.email,
        subject: "Recuperacao de senha - Audio Novel BR",
        resetUrl,
      }),
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[password-reset] Link para ${user.email}: ${resetUrl}`);
  }
}
