import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { chapterBatchSchema, chapterSchema, cleanYouTubeUrl, getYouTubeVideoId, normalizeTranscript } from "@/lib/admin-chapter-validation";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getChapterPersistenceBounds, getGroupedChapterSummary, normalizeChapterParts, parseChapterParts } from "@/lib/chapter-grouping";
import { notifyFavoriteUsersAboutPublishedChapter } from "@/lib/favorite-chapter-notifications";
import { prisma } from "@/lib/prisma";

type ChapterInput = z.infer<typeof chapterSchema>;
type PersistedChapterInput = ChapterInput & { positionEnd?: number | null };

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const batch = chapterBatchSchema.safeParse(body);
  const single = chapterSchema.safeParse(body);
  const batchPayload = typeof body === "object" && body !== null && "chapters" in body;
  const chapters: PersistedChapterInput[] | null = batch.success ? [groupBatchChapters(batch.data.chapters)] : single.success ? [single.data] : null;
  if (!chapters) {
    const validationError = batchPayload ? batch.error : single.error;
    return NextResponse.json(
      { error: validationError?.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 },
    );
  }

  try {
    const publicationDate = new Date();
    const { created, notificationEvent } = await prisma.$transaction(async (tx) => {
      const created = [];
      let notificationEvent = false;

      for (const chapter of chapters) {
        const cleanedUrl = chapter.youtubeUrl ? cleanYouTubeUrl(chapter.youtubeUrl) : chapter.youtubeUrl;
        const youtubeVideoId = chapter.contentType === "YOUTUBE" && cleanedUrl ? getYouTubeVideoId(cleanedUrl) : null;
        if (chapter.contentType === "YOUTUBE" && !youtubeVideoId) throw new Error("youtube");
        if (chapter.contentType === "AUDIO" && !chapter.audioUrl) throw new Error("audio");
        const chapterParts = normalizeChapterParts(chapter.chapterParts);
        const bounds = getChapterPersistenceBounds(chapter.position, chapterParts);

        const createdChapter = await tx.chapter.create({
          data: {
            volumeId: chapter.volumeId,
            title: chapter.title,
            position: bounds.position,
            positionEnd: bounds.positionEnd,
            contentType: chapter.contentType,
            durationSec: chapter.durationSec,
            audioUrl: chapter.contentType === "AUDIO" ? chapter.audioUrl : null,
            youtubeUrl: chapter.contentType === "YOUTUBE" ? cleanedUrl : null,
            youtubeVideoId,
            coverUrl: chapter.coverUrl || null,
            startSec: chapter.startSec,
            chapterPartsJson: JSON.stringify(chapterParts),
            transcriptJson: chapter.contentType === "AUDIO" ? JSON.stringify(normalizeTranscript(chapter.transcriptJson, chapter.title, chapter.durationSec)) : "[]",
            premiumOnly: chapter.premiumOnly,
            published: chapter.published,
            publishedAt: chapter.published ? publicationDate : null,
          },
        });
        created.push(createdChapter);

        if (chapter.published) {
          await notifyFavoriteUsersAboutPublishedChapter(tx, {
            volumeId: chapter.volumeId,
            publishedAt: publicationDate,
          });
          notificationEvent = true;
        }
      }

      return { created, notificationEvent };
    });

    revalidateTag(CACHE_TAGS.content, "max");
    if (notificationEvent) revalidateTag(CACHE_TAGS.notifications, "max");
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
