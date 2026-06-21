"use client";

import Link from "next/link";
import { ChevronDown, Lock, Play, PlaySquare } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { OfflineChapterButton } from "./offline-chapter-button";

type NovelVolume = {
  id: string;
  title: string;
  position: number;
  chapters: Array<{
    id: string;
    title: string;
    position: number;
    positionEnd: number | null;
    contentType: string;
    durationSec: number;
    viewCount: number;
    premiumOnly: boolean;
    createdAt: string;
    listened: boolean;
    lastListened: boolean;
  }>;
};

export function NovelVolumeList({ volumes, canUseOffline, novelTitle }: { volumes: NovelVolume[]; canUseOffline: boolean; novelTitle: string }) {
  const scrollContainers = useRef<Array<HTMLDivElement | null>>([]);
  const hasLastListenedChapter = useMemo(() => volumes.some((volume) => volume.chapters.some((chapter) => chapter.lastListened)), [volumes]);

  useEffect(() => {
    for (const container of scrollContainers.current) {
      if (!container) continue;
      const lastListenedElement = container.querySelector<HTMLElement>("[data-last-listened='true']");
      if (!lastListenedElement) continue;
      const centeredScrollTop = lastListenedElement.offsetTop - container.offsetTop - (container.clientHeight - lastListenedElement.clientHeight) / 2;
      container.scrollTop = Math.max(0, centeredScrollTop);
    }
  }, [volumes]);

  return (
    <div className="grid gap-3">
      {volumes.map((volume, index) => {
        const volumeHasLastListenedChapter = volume.chapters.some((chapter) => chapter.lastListened);
        const startsOpen = volumeHasLastListenedChapter || (!hasLastListenedChapter && index === 0);

        return (
        <details key={volume.id} open={startsOpen} className="overflow-hidden rounded-md bg-[#1b1b1b]">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-zinc-600 px-4 py-3 font-black text-white marker:hidden">
            <span>Volume {volume.position}: {volume.title}</span>
            <ChevronDown size={18} className="transition group-open:rotate-180" />
          </summary>
          <div
            ref={(element) => {
              scrollContainers.current[index * 2] = element;
            }}
            className="grid max-h-[420px] gap-2 overflow-y-auto p-3 pr-2 scrollbar-thin md:hidden"
          >
            {volume.chapters.length ? (
              volume.chapters.map((chapter) => (
                <article
                  key={chapter.id}
                  data-last-listened={chapter.lastListened ? "true" : undefined}
                  className={`rounded-md p-3 ${
                    chapter.lastListened ? "bg-[#18b7bd]/20 ring-2 ring-[#18b7bd]" : chapter.listened ? "bg-[#18b7bd]/12 ring-1 ring-[#18b7bd]/30" : "bg-[#020b0d]/70"
                  }`}
                >
                  <Link href={`/chapters/${chapter.id}`} className="flex min-h-11 items-start gap-2 font-black hover:text-[#18b7bd]">
                    {chapter.contentType === "YOUTUBE" ? <PlaySquare size={18} className="mt-0.5 shrink-0 text-red-400" /> : <Play size={18} className="mt-0.5 shrink-0 text-[#18b7bd]" />}
                    <span>
                      Vol. {volume.position} Cap. {getChapterPositionLabel(chapter.position, chapter.positionEnd)}
                      <span className="block text-base text-white">{chapter.title}</span>
                    </span>
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{chapter.contentType === "YOUTUBE" ? "YouTube" : `${Math.round(chapter.durationSec / 60)} min`}</span>
                    <span>{chapter.viewCount} plays</span>
                    <span>{formatDate(chapter.createdAt)}</span>
                    {chapter.lastListened ? <span className="font-black text-[#8ff7ff]">Ultimo ouvido</span> : null}
                    {chapter.listened ? <span className="font-bold text-[#b8fbff]">Ouvido</span> : null}
                    {chapter.premiumOnly ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[#18b7bd]">
                        <Lock size={12} /> Premium
                      </span>
                    ) : (
                      <span>Free</span>
                    )}
                  </div>
                  <div className="mt-3 flex justify-start">
                    <OfflineChapterButton
                      chapterId={chapter.id}
                      contentType={chapter.contentType}
                      canUseOffline={canUseOffline}
                      metadata={{
                        chapterId: chapter.id,
                        title: chapter.title,
                        novelTitle,
                        volumeTitle: volume.title,
                        chapterPosition: chapter.position,
                        chapterPositionLabel: getChapterPositionLabel(chapter.position, chapter.positionEnd),
                      }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className="px-1 py-3 text-zinc-400">Nenhum capitulo neste volume.</p>
            )}
          </div>
          <div
            ref={(element) => {
              scrollContainers.current[index * 2 + 1] = element;
            }}
            className="hidden max-h-[430px] overflow-auto pr-2 scrollbar-thin md:block"
          >
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#202020] text-white">
                <tr>
                  <th className="px-4 py-3 font-black">Vol/Cap</th>
                  <th className="px-4 py-3 font-black">Titulo do Capitulo</th>
                  <th className="px-4 py-3 font-black">Data de Lancamento</th>
                  <th className="px-4 py-3 text-right font-black">Offline</th>
                </tr>
              </thead>
              <tbody>
                {volume.chapters.length ? (
                  volume.chapters.map((chapter) => (
                    <tr
                      key={chapter.id}
                      data-last-listened={chapter.lastListened ? "true" : undefined}
                      className={`border-t border-black/30 ${chapter.lastListened ? "bg-[#18b7bd]/20 ring-1 ring-inset ring-[#18b7bd]" : chapter.listened ? "bg-[#18b7bd]/12" : "odd:bg-[#08353a] even:bg-[#0b3338]"}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-black">
                        <Link href={`/chapters/${chapter.id}`} className="flex items-center gap-2 hover:text-[#18b7bd]">
                          {chapter.contentType === "YOUTUBE" ? <PlaySquare size={16} className="text-red-400" /> : <Play size={16} className="text-[#18b7bd]" />}
                          Vol. {volume.position} Cap. {getChapterPositionLabel(chapter.position, chapter.positionEnd)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/chapters/${chapter.id}`} className="font-bold hover:text-[#18b7bd]">
                          {chapter.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-400">
                          <span>{chapter.contentType === "YOUTUBE" ? "YouTube" : `${Math.round(chapter.durationSec / 60)} min`}</span>
                          <span>{chapter.viewCount} plays</span>
                          {chapter.lastListened ? <span className="font-black text-[#8ff7ff]">Ultimo ouvido</span> : null}
                          {chapter.listened ? <span className="font-bold text-[#b8fbff]">Ouvido</span> : null}
                          {chapter.premiumOnly ? (
                            <span className="inline-flex items-center gap-1 font-bold text-[#18b7bd]">
                              <Lock size={12} /> Premium
                            </span>
                          ) : (
                            <span>Free</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold">{formatDate(chapter.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <OfflineChapterButton
                          chapterId={chapter.id}
                          contentType={chapter.contentType}
                          canUseOffline={canUseOffline}
                          metadata={{
                            chapterId: chapter.id,
                            title: chapter.title,
                            novelTitle,
                            volumeTitle: volume.title,
                            chapterPosition: chapter.position,
                            chapterPositionLabel: getChapterPositionLabel(chapter.position, chapter.positionEnd),
                          }}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-zinc-400">
                      Nenhum capitulo neste volume.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
