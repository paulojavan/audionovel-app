import { z } from "zod";

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(80, "Nome muito longo."),
    password: z.string().max(128, "Senha muito longa.").optional().default(""),
    confirmPassword: z.string().optional().default(""),
  })
  .superRefine((data, context) => {
    if (!data.password) return;

    if (data.password.length < 8) {
      context.addIssue({
        code: "custom",
        message: "A senha precisa ter pelo menos 8 caracteres.",
        path: ["password"],
      });
      return;
    }

    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "A confirmacao de senha nao confere.",
        path: ["confirmPassword"],
      });
    }
  })
  .transform((data) => ({
    name: data.name,
    ...(data.password ? { password: data.password } : {}),
  }));

export function parseProfileUpdatePayload(payload: unknown) {
  const parsed = profileUpdateSchema.safeParse(payload);

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
