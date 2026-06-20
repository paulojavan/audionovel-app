import { z } from "zod";
import { isDisposableEmail } from "./disposable-email";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(80, "Nome muito longo."),
    email: z.string().trim().email("Informe um e-mail valido.").max(160, "E-mail muito longo."),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Senha muito longa."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "A confirmacao de senha nao confere.",
    path: ["confirmPassword"],
  })
  .refine((data) => !isDisposableEmail(data.email), {
    message: "Emails temporarios nao sao permitidos.",
    path: ["email"],
  })
  .transform((data) => ({
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
  }));

export function parseRegisterPayload(payload: unknown) {
  const parsed = registerSchema.safeParse(payload);

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
