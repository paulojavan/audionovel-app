import { NextResponse } from "next/server";
import { chapterBatchSchema, chapterSchema, getYouTubeVideoId, normalizeTranscript } from "@/lib/admin-chapter-validation";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json();
  const batch = chapterBatchSchema.safeParse(body);
  const single = chapterSchema.safeParse(body);
  const chapters = batch.success ? batch.data.chapters : single.success ? [single.data] : null;
  if (!chapters) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  try {
    const created = await prisma.$transaction(
      chapters.map((chapter) => {
        const youtubeVideoId = chapter.contentType === "YOUTUBE" && chapter.youtubeUrl ? getYouTubeVideoId(chapter.youtubeUrl) : null;
        if (chapter.contentType === "YOUTUBE" && !youtubeVideoId) throw new Error("youtube");
        if (chapter.contentType === "AUDIO" && !chapter.audioUrl) throw new Error("audio");

        return prisma.chapter.create({
          data: {
            volumeId: chapter.volumeId,
            title: chapter.title,
            position: chapter.position,
            contentType: chapter.contentType,
            durationSec: chapter.durationSec,
            audioUrl: chapter.contentType === "AUDIO" ? chapter.audioUrl : null,
            youtubeUrl: chapter.contentType === "YOUTUBE" ? chapter.youtubeUrl : null,
            youtubeVideoId,
            coverUrl: chapter.coverUrl || null,
            startSec: chapter.startSec,
            transcriptJson: chapter.contentType === "AUDIO" ? JSON.stringify(normalizeTranscript(chapter.transcriptJson, chapter.title, chapter.durationSec)) : "[]",
            premiumOnly: chapter.premiumOnly,
            published: chapter.published,
          },
        });
      }),
    );

    return NextResponse.json(batch.success ? created : created[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Capitulo duplicado, volume inexistente ou dados invalidos." }, { status: 409 });
  }
}
