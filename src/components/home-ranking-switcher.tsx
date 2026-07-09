"use client";

import Link from "next/link";
import { Play, TrendingUp } from "lucide-react";
import { useState } from "react";
import { NovelStatusCover } from "@/components/novel-status-cover";

type RankingNovel = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string;
  status: string;
  viewCount: number;
  ratingScore: number;
  ratingCount: number;
};

export function HomeRankingSwitcher({
  byViews,
  byRating,
}: {
  byViews: RankingNovel[];
  byRating: RankingNovel[];
}) {
  const [mode, setMode] = useState<"views" | "rating">("views");
  const rankingList = mode === "rating" ? byRating : byViews;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-[#18b7bd]" size={22} />
          <h2 className="text-2xl font-bold">Ranking</h2>
        </div>
        <div className="rounded-full bg-[#06272b] p-1 text-sm font-bold">
          <button
            type="button"
            className={`rounded-full px-4 py-2 ${mode === "views" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"}`}
            onClick={() => setMode("views")}
          >
            Visualizacoes
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 ${mode === "rating" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"}`}
            onClick={() => setMode("rating")}
          >
            Melhor avaliados
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        {rankingList.map((novel, index) => (
          <Link key={novel.id} href={`/novels/${novel.slug}`} className="grid grid-cols-[40px_56px_1fr_auto] items-center gap-4 rounded-md px-3 py-2 hover:bg-white/10">
            <span className="text-lg font-black text-zinc-500">{index + 1}</span>
            <NovelStatusCover
              src={novel.coverUrl}
              title={novel.title}
              status={novel.status}
              className="h-14 w-14 rounded"
              sizes="56px"
              compact
            />
            <div>
              <h3 className="font-bold">{novel.title}</h3>
              <p className="text-sm text-zinc-400">
                {novel.viewCount} views - {formatRating(novel.ratingScore, novel.ratingCount)}
              </p>
            </div>
            <Play size={20} className="text-[#18b7bd]" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatRating(average: number, count: number) {
  return count ? `${average.toFixed(1)} estrelas (${count})` : "Sem notas";
}
