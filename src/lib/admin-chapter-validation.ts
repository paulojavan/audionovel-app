import { z } from "zod";
import { isSafeImageHttpsUrl, isSafeMediaHttpsUrl } from "./url-security";

const cueSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1),
});

const chapterPositionSchema = z.number().finite().min(0);

const chapterPartSchema = z.object({
  position: chapterPositionSchema,
  title: z.string().trim().min(1),
  startSec: z.number().int().min(0),
  endSec: z.number().int().min(0),
});

const optionalSafeAudioUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isSafeMediaHttpsUrl(value), "Use uma URL de audio HTTPS permitida.")
  .optional()
  .or(z.literal(""));

const optionalSafeImageUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isSafeImageHttpsUrl(value), "Use uma URL de imagem HTTPS permitida.")
  .optional()
  .or(z.literal(""));

export const chapterSchema = z.object({
  volumeId: z.string().min(1),
  title: z.string().trim().min(2).max(2000),
  position: chapterPositionSchema,
  contentType: z.enum(["AUDIO", "YOUTUBE"]).default("AUDIO"),
  durationSec: z.number().int().min(0).default(0),
  audioUrl: optionalSafeAudioUrl,
  youtubeUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: optionalSafeImageUrl,
  positionEnd: chapterPositionSchema.nullable().optional(),
  startSec: z.number().int().min(0).default(0),
  chapterParts: z.array(chapterPartSchema).optional().default([]),
  transcriptJson: z.string().optional().default("[]"),
  premiumOnly: z.boolean(),
  published: z.boolean(),
});

export const chapterBatchSchema = z.object({
  chapters: z.array(chapterSchema).min(1).max(50),
});

export function cleanYouTubeUrl(url: string) {
  const ampIndex = url.indexOf("&");
  return ampIndex === -1 ? url : url.substring(0, ampIndex);
}

export function getYouTubeVideoId(url: string) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "youtu.be") return parsed.pathname.replace("/", "");
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    return parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  }

  return "";
}

export function normalizeTranscript(transcriptJson: string, fallbackTitle: string, fallbackDuration: number) {
  const transcript = JSON.parse(transcriptJson || "[]") as unknown;
  const validTranscript = z.array(cueSchema).safeParse(transcript);
  if (validTranscript.success && validTranscript.data.length > 0) return validTranscript.data;
  const end = Math.max(Math.max(fallbackDuration, 1), 1);
  return [{ start: 0, end, text: fallbackTitle }];
}
