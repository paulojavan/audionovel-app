import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";
import { FavoriteNovelButton } from "@/components/favorite-novel-button";
import { NovelVolumeList } from "@/components/novel-volume-list";
import { StarRating } from "@/components/star-rating";
import { getPublicCommentStatusFilter } from "@/lib/comment-moderation";
import { getNovelStatusLabel } from "@/lib/novel-status";
import { COMMENT_THREAD_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";
import { getCachedPublicNovel } from "@/lib/public-data";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { hasPremiumAccess } from "@/lib/subscription";

export default async function NovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [novel, session] = await Promise.all([
    getCachedPublicNovel(slug),
    getActiveServerSession(),
  ]);

  if (!novel) notFound();

  const chapterIds = novel.volumes.flatMap((volume) => volume.chapters.map((chapter) => chapter.id));
  const [listenedProgress, currentRating, favorite, comments] = await Promise.all([
    session?.user?.id
      ? prisma.listeningProgress.findMany({
          where: { userId: session.user.id, chapterId: { in: chapterIds } },
          select: { chapterId: true, updatedAt: true },
        })
      : Promise.resolve([]),
    session?.user?.id
      ? prisma.novelReaction.findUnique({
          where: { userId_novelId: { userId: session.user.id, novelId: novel.id } },
          select: { rating: true },
        })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.favorite.findUnique({
          where: { userId_novelId: { userId: session.user.id, novelId: novel.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.comment.findMany({
      where: { novelId: novel.id, parentId: null, status: getPublicCommentStatusFilter() },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: COMMENT_THREAD_SELECT,
    }),
  ]);
  const listenedChapterIds = new Set(listenedProgress.map((item) => item.chapterId));
  const lastListenedChapterId = listenedProgress.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.chapterId ?? null;
  const isLoggedIn = Boolean(session?.user?.id && !session.user.isBlocked);
  const canUseOffline = hasPremiumAccess(session?.user);
  const statusLabel = getNovelStatusLabel(novel.status);

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-8 grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-lg shadow-2xl">
          <Image src={novel.coverUrl} alt="" fill sizes="(min-width: 768px) 220px, 260px" className="object-cover" />
          <span className="absolute right-3 top-3 rounded-full bg-[#18b7bd] px-3 py-1 text-xs font-black uppercase text-[#021114] shadow-lg shadow-black/30">
            {statusLabel}
          </span>
        </div>
        <div className="self-end">
          <p className="mb-2 text-sm font-bold uppercase text-zinc-400">Novel</p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">{novel.title}</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">{novel.synopsis}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400">Autor</span>
            <Link
              href={`/novels?author=${encodeURIComponent(novel.author)}`}
              className="rounded-full bg-[#18b7bd]/15 px-3 py-1 text-sm font-black text-[#8ff7ff] hover:bg-[#18b7bd]/25"
            >
              {novel.author}
            </Link>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-zinc-200">
              Status: {statusLabel}
            </span>
            <span className="text-sm text-zinc-500">- {novel.viewCount} visualizacoes</span>
          </div>
          {novel.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {novel.tags.map(({ tag }) => (
                <Link key={tag.id} href={`/novels?tag=${tag.slug}`} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-white/20">
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StarRating
              novelId={novel.id}
              average={novel.ratingScore}
              count={novel.ratingCount}
              userRating={currentRating?.rating}
              isLoggedIn={isLoggedIn}
            />
            <FavoriteNovelButton novelId={novel.id} initialFavorited={Boolean(favorite)} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </section>

      <NovelVolumeList
        accountScope={session?.user?.id ?? "anonymous"}
        novelTitle={novel.title}
        volumes={novel.volumes.map((volume) => ({
          id: volume.id,
          title: volume.title,
          position: volume.position,
          chapters: volume.chapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            position: chapter.position,
            positionEnd: chapter.positionEnd,
            contentType: chapter.contentType,
            durationSec: chapter.durationSec,
            audioRevision: chapter.audioRevision,
            startSec: chapter.startSec,
            chapterPartsJson: chapter.chapterPartsJson,
            viewCount: chapter.viewCount,
            premiumOnly: chapter.premiumOnly,
            createdAt: new Date(chapter.createdAt).toISOString(),
            listened: listenedChapterIds.has(chapter.id),
            lastListened: lastListenedChapterId === chapter.id,
          })),
        }))}
        canUseOffline={canUseOffline}
      />

      {novel.continuation ? (
        <aside className="mt-10 overflow-hidden rounded-xl border border-[#18b7bd]/40 bg-[linear-gradient(115deg,#07343a,#06272b_55%,#031316)]">
          <Link
            href={`/novels/${novel.continuation.slug}`}
            className="grid gap-4 p-4 transition hover:bg-white/5 sm:grid-cols-[96px_1fr_auto] sm:items-center"
          >
            <Image
              src={novel.continuation.coverUrl}
              alt={`Capa de ${novel.continuation.title}`}
              width={240}
              height={320}
              className="aspect-[3/4] w-24 rounded-md object-cover shadow-xl"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8ff7ff]">A jornada continua</p>
              <h2 className="mt-2 text-xl font-black">Terminou de ouvir? O próximo mundo já está chamando.</h2>
              <p className="mt-2 font-bold text-white">{novel.continuation.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{novel.continuation.synopsis}</p>
            </div>
            <span className="justify-self-start rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] sm:justify-self-end">
              Conhecer continuação
            </span>
          </Link>
        </aside>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">Comentarios da novel</h2>
        <CommentForm target="novel" targetId={novel.id} isLoggedIn={isLoggedIn} />
        <CommentThread
          target="novel"
          targetId={novel.id}
          isLoggedIn={isLoggedIn}
          currentUserId={session?.user?.id}
          comments={comments}
        />
      </section>
    </div>
  );
}
