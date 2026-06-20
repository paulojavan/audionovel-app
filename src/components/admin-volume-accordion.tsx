"use client";

import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { getChapterPositionLabel } from "@/lib/chapter-time";
import { AdminDeleteButton } from "./admin-delete-button";

type AdminVolume = {
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
    premiumOnly: boolean;
    createdAt: string;
  }>;
};

export function AdminVolumeAccordion({ volumes }: { volumes: AdminVolume[] }) {
  const router = useRouter();
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function openChapterForm(volumeId: string) {
    window.dispatchEvent(new CustomEvent("admin-open-chapter-form", { detail: { volumeId } }));
    document.getElementById("novo-conteudo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitVolumeEdit(event: FormEvent<HTMLFormElement>, volumeId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/admin/volumes/${volumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title") ?? ""),
          position: Number(data.get("position") ?? 0),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel atualizar o volume.");
        return;
      }

      setEditingVolumeId(null);
      setMessage("Volume atualizado com sucesso.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {volumes.length ? (
        volumes.map((volume) => (
          <details key={volume.id} open className="overflow-hidden rounded-md bg-[#1b1b1b]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-zinc-600 px-4 py-3 font-black text-white">
              <span>Volume {volume.position}: {volume.title}</span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    setEditingVolumeId((current) => (current === volume.id ? null : volume.id));
                    setMessage("");
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white hover:bg-white/20"
                >
                  <Pencil size={14} />
                  Editar volume
                </button>
                <AdminDeleteButton
                  endpoint={`/api/admin/volumes/${volume.id}`}
                  label="Excluir volume"
                  confirmMessage={`Excluir definitivamente o Volume ${volume.position}: ${volume.title}? Todos os capitulos deste volume tambem serao removidos.`}
                />
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
            {editingVolumeId === volume.id ? (
              <form onSubmit={(event) => submitVolumeEdit(event, volume.id)} className="grid gap-3 border-b border-black/30 bg-[#06272b] p-4 md:grid-cols-[minmax(160px,1fr)_120px_auto_auto] md:items-end">
                <label className="grid gap-1 text-sm text-zinc-300">
                  Nome do volume
                  <input name="title" defaultValue={volume.title} className="rounded-md border border-white/10 bg-black px-3 py-2 text-white" required />
                </label>
                <label className="grid gap-1 text-sm text-zinc-300">
                  Numero
                  <input name="position" type="number" min="1" defaultValue={volume.position} className="rounded-md border border-white/10 bg-black px-3 py-2 text-white" required />
                </label>
                <button disabled={pending} className="rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] disabled:opacity-60">
                  Salvar volume
                </button>
                <button type="button" onClick={() => setEditingVolumeId(null)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
                  Cancelar
                </button>
                {message ? <p className="md:col-span-4 rounded-md bg-white/10 p-3 text-sm text-zinc-200">{message}</p> : null}
              </form>
            ) : null}
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
                        <td className="whitespace-nowrap px-4 py-3 font-black">Vol. {volume.position} Cap. {getChapterPositionLabel(chapter.position, chapter.positionEnd)}</td>
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
                          <div className="flex flex-wrap justify-end gap-2">
                          <Link href={`/admin/conteudo/capitulos/${chapter.id}/editar`} className="rounded-full bg-[#18b7bd] px-3 py-2 text-xs font-black text-[#021114] hover:bg-[#22d3dc]">
                            Editar capitulo
                          </Link>
                          <AdminDeleteButton
                            endpoint={`/api/admin/chapters/${chapter.id}`}
                            label="Excluir capitulo"
                            confirmMessage={`Excluir definitivamente o capitulo "${chapter.title}"?`}
                          />
                          </div>
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
