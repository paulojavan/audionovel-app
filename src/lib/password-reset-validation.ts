import { z } from "zod";

const requestSchema = z
  .object({
    email: z.string().trim().email("Informe um e-mail valido.").max(160, "E-mail muito longo."),
  })
  .transform((data) => ({ email: data.email.toLowerCase() }));

const confirmSchema = z
  .object({
    token: z.string().trim().min(20, "Link de recuperacao invalido.").max(200, "Link de recuperacao invalido."),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Senha muito longa."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "A confirmacao de senha nao confere.",
    path: ["confirmPassword"],
  })
  .transform((data) => ({
    token: data.token,
    password: data.password,
  }));

export function parsePasswordResetRequestPayload(payload: unknown) {
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Dados invalidos.",
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}

export function parsePasswordResetConfirmPayload(payload: unknown) {
  const parsed = confirmSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Dados invalidos.",
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}
