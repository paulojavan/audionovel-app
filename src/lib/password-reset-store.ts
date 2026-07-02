import { hashPassword } from "./password";
import {
  deliverPasswordResetLinkSafely,
  getPasswordResetDeliveryConfig,
} from "./password-reset-delivery";
import { createPlainResetToken, getPasswordResetExpiry, hashResetToken } from "./password-reset-token";
import { prisma } from "./prisma";
import { createRandomSessionId } from "./device-session";

const RESET_REQUEST_OK_MESSAGE = "Se existir uma conta com este e-mail, enviaremos um link de recuperacao.";
const RESET_CONFIRM_OK_MESSAGE = "Senha redefinida com sucesso. Entre novamente com sua nova senha.";
const RESET_EMAIL_NOT_CONFIGURED_MESSAGE =
  "Envio de recuperacao de senha nao configurado no servidor. Avise o administrador.";

export async function createPasswordResetRequest(email: string, origin: string) {
  const deliveryConfig = getPasswordResetDeliveryConfig();
  if (deliveryConfig.mode === "unconfigured") {
    return { message: RESET_REQUEST_OK_MESSAGE, resetUrl: null, deliveryError: RESET_EMAIL_NOT_CONFIGURED_MESSAGE };
  }

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
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.create({
      data: {
        id: createRandomSessionId(),
        userId: user.id,
        tokenHash,
        expiresAt,
        createdAt: now,
      },
    }),
  ]);

  await deliverPasswordResetLinkSafely({
    email: user.email,
    resetUrl: resetUrl.toString(),
    config: deliveryConfig,
  });

  return {
    message: RESET_REQUEST_OK_MESSAGE,
    resetUrl: process.env.NODE_ENV === "production" ? null : resetUrl.toString(),
    deliveryError: null,
  };
}

export async function confirmPasswordReset(token: string, password: string) {
  const now = new Date();
  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true, userId: true },
  });

  if (!resetToken) {
    return { success: false as const, error: "Link de recuperacao invalido ou expirado." };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      const updatedToken = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (updatedToken.count !== 1) {
        throw new Error("RESET_TOKEN_ALREADY_USED");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.userSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.securityEvent.create({
        data: {
          id: createRandomSessionId(),
          userId: resetToken.userId,
          type: "PASSWORD_RESET",
          severity: "MEDIUM",
          message: "Senha redefinida por link de recuperacao.",
          metadata: "{}",
          createdAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_ALREADY_USED") {
      return { success: false as const, error: "Link de recuperacao invalido ou expirado." };
    }
    throw error;
  }

  return { success: true as const, message: RESET_CONFIRM_OK_MESSAGE };
}
