import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { chapterSchema, cleanYouTubeUrl, getYouTubeVideoId, normalizeTranscript } from "@/lib/admin-chapter-validation";
import { requireUser } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { normalizeChapterParts } from "@/lib/chapter-grouping";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = chapterSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  try {
    const cleanedUrl = parsed.data.youtubeUrl ? cleanYouTubeUrl(parsed.data.youtubeUrl) : parsed.data.youtubeUrl;
    const youtubeVideoId = parsed.data.contentType === "YOUTUBE" && cleanedUrl ? getYouTubeVideoId(cleanedUrl) : null;
    if (parsed.data.contentType === "YOUTUBE" && !youtubeVideoId) throw new Error("youtube");
    if (parsed.data.contentType === "AUDIO" && !parsed.data.audioUrl) throw new Error("audio");

    const chapter = await prisma.chapter.update({
      where: { id },
      data: {
        volumeId: parsed.data.volumeId,
        title: parsed.data.title,
        position: parsed.data.position,
        positionEnd: parsed.data.positionEnd ?? null,
        contentType: parsed.data.contentType,
        durationSec: parsed.data.durationSec,
        audioUrl: parsed.data.contentType === "AUDIO" ? parsed.data.audioUrl : null,
        youtubeUrl: parsed.data.contentType === "YOUTUBE" ? cleanedUrl : null,
        youtubeVideoId,
        coverUrl: parsed.data.coverUrl || null,
        startSec: parsed.data.startSec,
        chapterPartsJson: JSON.stringify(normalizeChapterParts(parsed.data.chapterParts)),
        transcriptJson: parsed.data.contentType === "AUDIO" ? JSON.stringify(normalizeTranscript(parsed.data.transcriptJson, parsed.data.title, parsed.data.durationSec)) : "[]",
        premiumOnly: parsed.data.premiumOnly,
        published: parsed.data.published,
      },
    });

    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json(chapter);
  } catch {
    return NextResponse.json({ error: "Capitulo duplicado, inexistente ou dados invalidos." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;

  try {
    await prisma.chapter.delete({ where: { id } });
    revalidateTag(CACHE_TAGS.content, "max");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir o capitulo." }, { status: 404 });
  }
}
