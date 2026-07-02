import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { chapterBatchSchema, chapterSchema, cleanYouTubeUrl, getYouTubeVideoId, normalizeTranscript } from "@/lib/admin-chapter-validation";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getGroupedChapterSummary, normalizeChapterParts, parseChapterParts } from "@/lib/chapter-grouping";
import { prisma } from "@/lib/prisma";

type ChapterInput = z.infer<typeof chapterSchema>;
type PersistedChapterInput = ChapterInput & { positionEnd?: number | null };

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const batch = chapterBatchSchema.safeParse(body);
  const single = chapterSchema.safeParse(body);
  const chapters: PersistedChapterInput[] | null = batch.success ? [groupBatchChapters(batch.data.chapters)] : single.success ? [single.data] : null;
  if (!chapters) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  try {
    const created = await prisma.$transaction(
      chapters.map((chapter) => {
        const cleanedUrl = chapter.youtubeUrl ? cleanYouTubeUrl(chapter.youtubeUrl) : chapter.youtubeUrl;
        const youtubeVideoId = chapter.contentType === "YOUTUBE" && cleanedUrl ? getYouTubeVideoId(cleanedUrl) : null;
        if (chapter.contentType === "YOUTUBE" && !youtubeVideoId) throw new Error("youtube");
        if (chapter.contentType === "AUDIO" && !chapter.audioUrl) throw new Error("audio");

        return prisma.chapter.create({
          data: {
            volumeId: chapter.volumeId,
            title: chapter.title,
            position: chapter.position,
            positionEnd: chapter.positionEnd,
            contentType: chapter.contentType,
            durationSec: chapter.durationSec,
            audioUrl: chapter.contentType === "AUDIO" ? chapter.audioUrl : null,
            youtubeUrl: chapter.contentType === "YOUTUBE" ? cleanedUrl : null,
            youtubeVideoId,
            coverUrl: chapter.coverUrl || null,
            startSec: chapter.startSec,
            chapterPartsJson: JSON.stringify(normalizeChapterParts(chapter.chapterParts)),
            transcriptJson: chapter.contentType === "AUDIO" ? JSON.stringify(normalizeTranscript(chapter.transcriptJson, chapter.title, chapter.durationSec)) : "[]",
            premiumOnly: chapter.premiumOnly,
            published: chapter.published,
          },
        });
      }),
    );

    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(batch.success ? created : created[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Capitulo duplicado, volume inexistente ou dados invalidos." }, { status: 409 });
  }
}

function groupBatchChapters(chapters: ChapterInput[]) {
  const summary = getGroupedChapterSummary(chapters);

  return {
    ...chapters.find((chapter) => chapter.position === summary.position)!,
    ...summary,
    chapterParts: parseChapterParts(summary.chapterPartsJson),
  };
}
