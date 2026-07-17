import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PlaySquare } from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { ChapterPartLinks } from "@/components/chapter-part-links";
import { ChapterViewTracker } from "@/components/chapter-view-tracker";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";
import { ReactionButtons } from "@/components/reaction-buttons";
import { canPlayChapter } from "@/lib/api";
import { getChapterAudioPath } from "@/lib/audio-revision";
import { getChapterPartsForDisplay } from "@/lib/chapter-grouping";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { getPublicCommentStatusFilter } from "@/lib/comment-moderation";
import { CHAPTER_PROGRESS_SELECT, COMMENT_THREAD_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/safe-auth-session";

type Cue = {
  start: number;
  end: number;
  text: string;
};

export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getActiveServerSession();
  const access = await canPlayChapter(id, session?.user?.id);

  if (access.status === 404) notFound();
  if (access.status === 401) redirect("/login");
  if (!access.allowed || !access.chapter) redirect("/assinaturas?premium=required");

  const isYouTubeChapter = access.chapter.contentType === "YOUTUBE";

  const [progress, comments, novelChapters] = await Promise.all([
    session?.user?.id
      ? prisma.listeningProgress.findUnique({
          where: { userId_chapterId: { userId: session.user.id, chapterId: id } },
          select: CHAPTER_PROGRESS_SELECT,
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { chapterId: id, parentId: null, status: getPublicCommentStatusFilter() },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: COMMENT_THREAD_SELECT,
    }),
    prisma.chapter.findMany({
      where: {
        published: true,
        volume: { novelId: access.chapter.volume.novelId },
      },
      select: {
        id: true,
        title: true,
        position: true,
        positionEnd: true,
        volume: { select: { position: true } },
      },
    }),
  ]);

  const orderedChapters = [...novelChapters].sort((a, b) => a.volume.position - b.volume.position || a.position - b.position);
  const currentChapterIndex = orderedChapters.findIndex((chapter) => chapter.id === id);
  const previousChapter = currentChapterIndex > 0 ? orderedChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < orderedChapters.length - 1 ? orderedChapters[currentChapterIndex + 1] : null;
  const transcript = JSON.parse(access.chapter.transcriptJson) as Cue[];
  const chapterCoverUrl = access.chapter.coverUrl ?? access.chapter.volume.novel.coverUrl;
  const durationLabel = isYouTubeChapter ? "YouTube" : `${Math.round(access.chapter.durationSec / 60)} min`;
  const chapterPositionLabel = getChapterPositionLabel(access.chapter.position, access.chapter.positionEnd);
  const chapterParts = getChapterPartsForDisplay(access.chapter);
  const canComment = Boolean(session?.user?.id && !session.user.isBlocked);

  return (
    <div className="px-4 py-6 md:px-8">
      <ChapterViewTracker chapterId={id} />
      <Link className="text-sm font-bold text-[#18b7bd]" href={`/novels/${access.chapter.volume.novel.slug}`}>
        Voltar para {access.chapter.volume.novel.title}
      </Link>
      <section className="my-6 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#18b7bd_0%,#06272b_48%)] p-5 md:p-8">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_170px] md:items-start">
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <div>
              <p className="text-sm font-bold uppercase text-black/70 md:text-zinc-300">{access.chapter.volume.novel.title}</p>
              <p className="mt-2 text-sm font-bold text-zinc-200">
                {access.chapter.volume.title} - Capitulo {chapterPositionLabel} - {durationLabel}
              </p>
              {isYouTubeChapter ? (
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">
                  <PlaySquare size={14} /> Capitulo em video
                </span>
              ) : null}
              {chapterParts.length > 1 ? (
                <ChapterPartLinks parts={chapterParts} />
              ) : (
                <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight md:text-5xl">{access.chapter.title}</h1>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ReactionButtons target="chapter" targetId={id} likes={access.chapter.likeCount} dislikes={access.chapter.dislikeCount} />
              <ChapterNavigationLink direction="previous" chapter={previousChapter} />
              <ChapterNavigationLink direction="next" chapter={nextChapter} />
              {session?.user?.role === "ADMIN" ? (
                <Link className="rounded-full border border-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/10" href={`/admin/conteudo/capitulos/${id}/editar`}>
                  Editar capitulo
                </Link>
              ) : null}
            </div>
          </div>

          <div className="relative aspect-square w-full max-w-[220px] overflow-hidden rounded-lg bg-black/30 shadow-2xl shadow-black/30 md:max-w-none">
            <Image
              src={chapterCoverUrl}
              alt={`Capa de ${access.chapter.volume.novel.title}`}
              fill
              sizes="(min-width: 768px) 170px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
      {isYouTubeChapter && access.chapter.youtubeVideoId ? (
        <YouTubeChapter videoId={access.chapter.youtubeVideoId} title={access.chapter.title} />
      ) : (
          <AudioPlayer
            chapterId={id}
            audioRevision={access.chapter.audioRevision}
            src={getChapterAudioPath(id, access.chapter.audioRevision)}
            initialPosition={progress?.positionSec ?? 0}
            initialCompleted={progress?.completed ?? false}
            duration={access.chapter.durationSec}
          startOffset={access.chapter.startSec}
          transcript={transcript}
          chapterTitle={access.chapter.title}
          novelTitle={access.chapter.volume.novel.title}
          coverUrl={chapterCoverUrl}
          chapterParts={chapterParts}
          accountScope={session?.user?.id ?? "anonymous"}
          nextChapterHref={nextChapter ? `/chapters/${nextChapter.id}` : null}
        />
      )}
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Comentarios do capitulo</h2>
        <CommentForm target="chapter" targetId={id} isLoggedIn={canComment} />
        <CommentThread target="chapter" targetId={id} isLoggedIn={canComment} currentUserId={session?.user?.id} comments={comments} />
      </section>
    </div>
  );
}

function ChapterNavigationLink({
  direction,
  chapter,
}: {
  direction: "previous" | "next";
  chapter: { id: string; title: string; position: number; positionEnd: number | null } | null;
}) {
  const label = direction === "previous" ? "Anterior" : "Proximo";

  if (!chapter) {
    return <span className="inline-flex min-h-11 items-center rounded-full bg-black/45 px-4 py-2 text-sm font-bold text-white/60 ring-1 ring-white/10">{label}</span>;
  }

  return (
    <Link className="inline-flex min-h-11 items-center rounded-full bg-[#021114] px-4 py-2 text-sm font-black text-white shadow-sm ring-1 ring-white/20 hover:bg-black" href={`/chapters/${chapter.id}`} title={chapter.title}>
      {label}
    </Link>
  );
}

function YouTubeChapter({ videoId, title }: { videoId: string; title: string }) {
  return (
    <section className="overflow-hidden rounded-lg bg-[#06272b]">
      <div className="aspect-video w-full bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </section>
  );
}
