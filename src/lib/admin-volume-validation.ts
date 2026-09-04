import { z } from "zod";

export const volumePositionSchema = z.number().finite().min(0);

export const volumeCreateSchema = z.object({
  novelId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  position: volumePositionSchema,
});

export const volumeUpdateSchema = volumeCreateSchema.omit({ novelId: true });
