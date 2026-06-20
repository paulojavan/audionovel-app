import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";
import { FavoriteNovelButton } from "@/components/favorite-novel-button";
import { NovelVolumeList } from "@/components/novel-volume-list";
import { StarRating } from "@/components/star-rating";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/subscription";

export default async function NovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const novel = await prisma.novel.findUnique({
    where: { slug },
    include: {
      volumes: {
        orderBy: { position: "asc" },
        include: { chapters: { orderBy: { position: "asc" } } },
      },
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      comments: {
        where: { parentId: null, status: { in: ["APPROVED", "REMOVED"] } },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          replies: {
            where: { status: { in: ["APPROVED", "REMOVED"] } },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!novel) notFound();

  const session = await getServerSession(authOptions);
  const chapterIds = novel.volumes.flatMap((volume) => volume.chapters.map((chapter) => chapter.id));
  const [listenedProgress, currentRating, favorite] = await Promise.all([
    session?.user?.id
      ? prisma.listeningProgress.findMany({
          where: { userId: session.user.id, chapterId: { in: chapterIds } },
          select: { chapterId: true },
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
  ]);
  const listenedChapterIds = new Set(listenedProgress.map((item) => item.chapterId));
  const isLoggedIn = Boolean(session?.user?.id && !session.user.isBlocked);
  const canUseOffline = hasPremiumAccess(session?.user);

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-8 grid gap-6 md:grid-cols-[220px_1fr]">
        <Image src={novel.coverUrl} alt="" width={520} height={520} className="aspect-square w-full max-w-[260px] rounded-lg object-cover shadow-2xl" />
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
            viewCount: chapter.viewCount,
            premiumOnly: chapter.premiumOnly,
            createdAt: chapter.createdAt.toISOString(),
            listened: listenedChapterIds.has(chapter.id),
          })),
        }))}
        canUseOffline={canUseOffline}
      />

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">Comentarios da novel</h2>
        <CommentForm target="novel" targetId={novel.id} isLoggedIn={isLoggedIn} />
        <CommentThread
          target="novel"
          targetId={novel.id}
          isLoggedIn={isLoggedIn}
          currentUserId={session?.user?.id}
          comments={novel.comments}
        />
      </section>
    </div>
  );
}
