"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

type AdminVolume = {
  id: string;
  title: string;
  position: number;
  chapters: Array<{
    id: string;
    title: string;
    position: number;
    contentType: string;
    durationSec: number;
    premiumOnly: boolean;
    createdAt: string;
  }>;
};

export function AdminVolumeAccordion({ volumes }: { volumes: AdminVolume[] }) {
  function openChapterForm(volumeId: string) {
    window.dispatchEvent(new CustomEvent("admin-open-chapter-form", { detail: { volumeId } }));
    document.getElementById("novo-conteudo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-3">
      {volumes.length ? (
        volumes.map((volume) => (
          <details key={volume.id} open className="overflow-hidden rounded-md bg-[#1b1b1b]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-zinc-600 px-4 py-3 font-black text-white">
              <span>Volume {volume.position}: {volume.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    openChapterForm(volume.id);
                  }}
                  className="rounded-full bg-[#18b7bd] px-3 py-1 text-xs font-black text-[#021114]"
                >
                  Cadastrar capitulo
                </button>
                <ChevronDown size={18} />
              </div>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[#202020] text-white">
                  <tr>
                    <th className="px-4 py-3 font-black">Vol/Cap</th>
                    <th className="px-4 py-3 font-black">Titulo do Capitulo</th>
                    <th className="px-4 py-3 font-black">Tipo/Acesso</th>
                    <th className="px-4 py-3 font-black">Data</th>
                    <th className="px-4 py-3 text-right font-black">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {volume.chapters.length ? (
                    volume.chapters.map((chapter) => (
                      <tr key={chapter.id} className="border-t border-black/30 odd:bg-[#08353a] even:bg-[#0b3338]">
                        <td className="whitespace-nowrap px-4 py-3 font-black">Vol. {volume.position} Cap. {chapter.position}</td>
                        <td className="px-4 py-3">
                          <Link href={`/chapters/${chapter.id}`} className="font-bold hover:text-[#18b7bd]">
                            {chapter.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          <span className={chapter.contentType === "YOUTUBE" ? "font-bold text-red-400" : ""}>
                            {chapter.contentType === "YOUTUBE" ? "YouTube" : `${chapter.durationSec}s`}
                          </span>
                          <span className="mx-2 text-zinc-500">-</span>
                          <span className={chapter.premiumOnly ? "font-bold text-[#18b7bd]" : "text-zinc-400"}>
                            {chapter.premiumOnly ? "Premium" : "Free"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-300">{formatDate(chapter.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/conteudo/capitulos/${chapter.id}/editar`} className="rounded-full bg-[#18b7bd] px-3 py-2 text-xs font-black text-[#021114] hover:bg-[#22d3dc]">
                            Editar capitulo
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-zinc-400">
                        Nenhum capitulo neste volume.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        ))
      ) : (
        <div className="rounded-lg bg-[#06272b] p-6 text-zinc-400">Esta novel ainda nao tem volumes.</div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
