import { z } from "zod";

export const subscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).optional().or(z.literal("")),
    amountCents: z.number().int().min(50).max(10000000),
    currency: z.enum(["brl"]).default("brl"),
    interval: z.enum(["month", "year"]).default("month"),
    active: z.boolean().default(true),
    allowCard: z.boolean().default(true),
    allowPix: z.boolean().default(false),
    stripePriceId: z.string().trim().max(120).optional().or(z.literal("")),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .refine((value) => value.allowCard || value.allowPix, {
    message: "Selecione ao menos um metodo de pagamento.",
  });
