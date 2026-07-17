import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { chapterSchema, cleanYouTubeUrl, getYouTubeVideoId, normalizeTranscript } from "@/lib/admin-chapter-validation";
import { requireAdmin } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getChapterPersistenceBounds, normalizeChapterParts } from "@/lib/chapter-grouping";
import { shouldIncrementAudioRevision } from "@/lib/audio-revision";
import { notifyFavoriteUsersAboutPublishedChapter } from "@/lib/favorite-chapter-notifications";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const parsed = chapterSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  try {
    const cleanedUrl = parsed.data.youtubeUrl ? cleanYouTubeUrl(parsed.data.youtubeUrl) : parsed.data.youtubeUrl;
    const youtubeVideoId = parsed.data.contentType === "YOUTUBE" && cleanedUrl ? getYouTubeVideoId(cleanedUrl) : null;
    if (parsed.data.contentType === "YOUTUBE" && !youtubeVideoId) throw new Error("youtube");
    if (parsed.data.contentType === "AUDIO" && !parsed.data.audioUrl) throw new Error("audio");
    const chapterParts = normalizeChapterParts(parsed.data.chapterParts);
    const bounds = getChapterPersistenceBounds(parsed.data.position, chapterParts);
    const publicationDate = new Date();

    const { chapter, notificationEvent } = await prisma.$transaction(async (tx) => {
      const currentMedia = await tx.chapter.findUnique({
        where: { id },
        select: { contentType: true, audioUrl: true },
      });
      if (!currentMedia) throw new Error("chapter");
      const nextAudioUrl = parsed.data.contentType === "AUDIO"
        ? parsed.data.audioUrl || null
        : null;
      const refreshAudioRevision = shouldIncrementAudioRevision(
        currentMedia,
        { contentType: parsed.data.contentType, audioUrl: nextAudioUrl },
        parsed.data.refreshAudioRevision,
      );
      const publicationClaim = parsed.data.published
        ? await tx.chapter.updateMany({
            where: { id, publishedAt: null },
            data: { publishedAt: publicationDate },
          })
        : { count: 0 };
      const notificationEvent = publicationClaim.count === 1;

      const chapter = await tx.chapter.update({
        where: { id },
        data: {
          volumeId: parsed.data.volumeId,
          title: parsed.data.title,
          position: bounds.position,
          positionEnd: bounds.positionEnd,
          contentType: parsed.data.contentType,
          durationSec: parsed.data.durationSec,
          audioUrl: nextAudioUrl,
          ...(refreshAudioRevision ? { audioRevision: { increment: 1 } } : {}),
          youtubeUrl: parsed.data.contentType === "YOUTUBE" ? cleanedUrl : null,
          youtubeVideoId,
          coverUrl: parsed.data.coverUrl || null,
          startSec: parsed.data.startSec,
          chapterPartsJson: JSON.stringify(chapterParts),
          transcriptJson: parsed.data.contentType === "AUDIO" ? JSON.stringify(normalizeTranscript(parsed.data.transcriptJson, parsed.data.title, parsed.data.durationSec)) : "[]",
          premiumOnly: parsed.data.premiumOnly,
          published: parsed.data.published,
        },
      });

      if (notificationEvent) {
        await notifyFavoriteUsersAboutPublishedChapter(tx, {
          volumeId: parsed.data.volumeId,
          publishedAt: publicationDate,
        });
      }

      return { chapter, notificationEvent };
    });

    revalidateTag(CACHE_TAGS.content, "max");
    if (notificationEvent) revalidateTag(CACHE_TAGS.notifications, "max");
    return NextResponse.json(chapter);
  } catch {
    return NextResponse.json({ error: "Capitulo duplicado, inexistente ou dados invalidos." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  try {
    await prisma.chapter.delete({ where: { id } });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir o capitulo." }, { status: 404 });
  }
}
