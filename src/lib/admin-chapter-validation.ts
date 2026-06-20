import { z } from "zod";
import { isSafePublicHttpsUrl } from "./url-security";

const cueSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1),
});

const optionalSafeMediaUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isSafePublicHttpsUrl(value), "Use uma URL HTTPS publica permitida.")
  .optional()
  .or(z.literal(""));

export const chapterSchema = z.object({
  volumeId: z.string().min(1),
  title: z.string().trim().min(2).max(180),
  position: z.number().int().min(1),
  contentType: z.enum(["AUDIO", "YOUTUBE"]).default("AUDIO"),
  durationSec: z.number().int().min(0).default(0),
  audioUrl: optionalSafeMediaUrl,
  youtubeUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: optionalSafeMediaUrl,
  startSec: z.number().int().min(0).default(0),
  transcriptJson: z.string().optional().default("[]"),
  premiumOnly: z.boolean(),
  published: z.boolean(),
});

export const chapterBatchSchema = z.object({
  chapters: z.array(chapterSchema).min(1).max(50),
});

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
