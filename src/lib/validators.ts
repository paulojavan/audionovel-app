import { z } from "zod";

export const progressSchema = z.object({
  chapterId: z.string().min(1),
  positionSec: z.number().int().min(0),
  durationSec: z.number().int().min(0),
  completed: z.boolean().default(false),
});

export const reactionSchema = z.object({
  target: z.enum(["novel", "chapter"]),
  targetId: z.string().min(1),
  type: z.enum(["LIKE", "DISLIKE"]).optional(),
  rating: z.number().int().min(1).max(5).optional(),
}).refine((value) => {
  if (value.target === "novel") return typeof value.rating === "number";
  return Boolean(value.type);
}, {
  message: "Informe uma nota para novels ou uma reacao para capitulos.",
});

export const commentSchema = z.object({
  novelId: z.string().optional(),
  chapterId: z.string().optional(),
  parentId: z.string().optional(),
  body: z.string().trim().min(2).max(1200),
}).refine((value) => Boolean(value.novelId) !== Boolean(value.chapterId), {
  message: "Informe novelId ou chapterId.",
});

export const commentEditSchema = z.object({
  body: z.string().trim().min(2).max(1200),
});
