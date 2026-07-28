import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, Sparkles, Star } from "lucide-react";
import { HomeRankingSwitcher } from "@/components/home-ranking-switcher";
import { NovelStatusCover } from "@/components/novel-status-cover";
import { PublicLandingPage } from "@/components/public-landing";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { formatLaunchAge, groupLatestChapters } from "@/lib/latest-chapters";
import { prisma } from "@/lib/prisma";
import { getCachedHomeData } from "@/lib/public-data";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  const session = await getActiveServerSession();

  if (!session?.user?.id || session.user.isBlocked) {
    return <PublicLandingPage />;
  }

  const [{ novels, rankingByViews, rankingByRating, latestChapters }, ratedNovelIds] = await Promise.all([
    getCachedHomeData(),
    prisma.novelReaction.findMany({
      where: { userId: session.user.id, rating: { gte: 4 } },
      select: { novelId: true },
    }),
  ]);

  const ratedIds = new Set(ratedNovelIds.map((item) => item.novelId));
  const recommendations = ratedIds.size
    ? novels.filter((novel) => !ratedIds.has(novel.id)).sort((a, b) => b.ratingScore - a.ratingScore).slice(0, 6)
    : novels.slice(0, 6);
  const launchGroups = groupLatestChapters(latestChapters);

  return (
    <div className="px-4 py-5 md:px-8">
      <section className="mb-10 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#18b7bd_0%,#06272b_55%,#020b0d_100%)] p-6 md:p-10">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#021114]">Web novels em audio</p>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Ouca capitulos, acompanhe o texto e continue de onde parou.</h1>
        <p className="mt-4 max-w-2xl text-zinc-100">Streaming online, modo offline autenticado, historico, favoritos, comentarios e capitulos premium.</p>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="text-[#18b7bd]" size={22} />
          <h2 className="text-2xl font-bold">Lançamentos</h2>
        </div>
        {launchGroups.length ? (
          <div className="overflow-hidden rounded-lg border border-white/10">
            {launchGroups.map((group) => (
              <article
                key={group.novel.id}
                className="grid grid-cols-[76px_1fr] gap-3 border-b border-white/10 bg-[#06272b] p-3 last:border-b-0 sm:grid-cols-[96px_1fr] sm:gap-4 sm:p-4"
              >
                <Link href={`/novels/${group.novel.slug}`} className="self-start">
                  <NovelStatusCover
                    src={group.novel.coverUrl}
                    title={group.novel.title}
                    status={group.novel.status}
                    className="aspect-[3/4] w-full rounded-md shadow-lg"
                    sizes="(min-width: 640px) 96px, 76px"
                    showStatus={false}
                  />
                </Link>
                <div className="min-w-0">
                  <Link href={`/novels/${group.novel.slug}`} className="font-black hover:text-[#8ff7ff]">
                    {group.novel.title}
                  </Link>
                  <div className="mt-3 grid gap-2">
                    {group.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                      >
                        <Link
                          href={`/chapters/${chapter.id}`}
                          className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-zinc-200 hover:text-white"
                        >
                          <span className="rounded-full bg-black/35 px-3 py-1 font-bold text-[#baf9fc]">
                            Vol. {chapter.volume.position} · Cap. {getChapterPositionLabel(chapter.position, chapter.positionEnd)}
                          </span>
                          <span className="min-w-0 truncate text-zinc-300">{chapter.title}</span>
                          {chapter.premiumOnly ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-200">
                              <LockKeyhole size={12} />
                              Premium
                            </span>
                          ) : null}
                        </Link>
                        <span className="text-xs italic text-zinc-500">{formatLaunchAge(chapter.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-[#06272b] p-5 text-sm text-zinc-400">Nenhum capítulo publicado ainda.</p>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Star className="text-[#18b7bd]" size={22} />
          <h2 className="text-2xl font-bold">Recomendado para voce</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {recommendations.map((novel) => (
            <Link key={novel.id} href={`/novels/${novel.slug}`} className="rounded-md bg-[#06272b] p-3 transition hover:bg-[#08353a]">
              <NovelStatusCover
                src={novel.coverUrl}
                title={novel.title}
                status={novel.status}
                className="aspect-square w-full rounded-md"
                sizes="(min-width: 1280px) 16vw, (min-width: 768px) 33vw, 50vw"
              />
              <h3 className="mt-3 line-clamp-2 font-bold">{novel.title}</h3>
              <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{novel.author}</p>
              <p className="mt-1 text-sm font-bold text-yellow-200">{formatRating(novel.ratingScore, novel.ratingCount)}</p>
            </Link>
          ))}
        </div>
      </section>

      <HomeRankingSwitcher byViews={rankingByViews} byRating={rankingByRating} />
    </div>
  );
}

function formatRating(average: number, count: number) {
  return count ? `${average.toFixed(1)} estrelas (${count})` : "Sem notas";
}
