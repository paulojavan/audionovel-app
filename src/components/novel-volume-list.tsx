"use client";

import Link from "next/link";
import { ChevronDown, Lock, Play, PlaySquare } from "lucide-react";
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
  }>;
};

export function NovelVolumeList({ volumes, canUseOffline, novelTitle }: { volumes: NovelVolume[]; canUseOffline: boolean; novelTitle: string }) {
  return (
    <div className="grid gap-3">
      {volumes.map((volume, index) => (
        <details key={volume.id} open={index === 0} className="overflow-hidden rounded-md bg-[#1b1b1b]">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-zinc-600 px-4 py-3 font-black text-white marker:hidden">
            <span>Volume {volume.position}</span>
            <ChevronDown size={18} className="transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-2 p-3 md:hidden">
            {volume.chapters.length ? (
              volume.chapters.map((chapter) => (
                <article key={chapter.id} className={`rounded-md p-3 ${chapter.listened ? "bg-[#18b7bd]/12 ring-1 ring-[#18b7bd]/30" : "bg-[#020b0d]/70"}`}>
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
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#202020] text-white">
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
                    <tr key={chapter.id} className={`border-t border-black/30 ${chapter.listened ? "bg-[#18b7bd]/12" : "odd:bg-[#08353a] even:bg-[#0b3338]"}`}>
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
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
