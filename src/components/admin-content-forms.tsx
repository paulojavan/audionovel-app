"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getNextChapterPosition } from "@/lib/admin-chapter-sequence";
import { getChapterPartsForDisplay } from "@/lib/chapter-grouping";
import { getDurationFromRange, getGroupedChapterDuration, getGroupedChapterPositionEnd } from "@/lib/chapter-time";

type VolumeOption = {
  id: string;
  title: string;
  position: number;
  nextChapterPosition?: number;
  chapters?: Array<{ position: number; positionEnd: number | null }>;
};

type TagOption = {
  id: string;
  name: string;
  slug: string;
};

type NovelOption = {
  id: string;
  title: string;
};

type MediaType = "AUDIO" | "YOUTUBE";

type ChapterEditData = {
  id: string;
  title: string;
  position: number;
  positionEnd: number | null;
  contentType: string;
  durationSec: number;
  audioUrl: string | null;
  youtubeUrl: string | null;
  startSec: number;
  chapterPartsJson: string;
  transcriptJson: string;
  premiumOnly: boolean;
  published: boolean;
  volumeId: string;
};

type NovelEditData = {
  id: string;
  title: string;
  author: string;
  synopsis: string;
  coverUrl: string;
  status: string;
  continuationId: string | null;
  tagIds: string[];
};

const defaultTranscript = JSON.stringify(
  [
    { start: 0, end: 8, text: "Primeira frase narrada do capitulo." },
    { start: 8, end: 16, text: "Segunda frase sincronizada com o audio." },
  ],
  null,
  2,
);

async function postJson(endpoint: string, payload: Record<string, unknown>) {
  return requestJson("POST", endpoint, payload);
}

async function patchJson(endpoint: string, payload: Record<string, unknown>) {
  return requestJson("PATCH", endpoint, payload);
}

async function requestJson(method: string, endpoint: string, payload: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Nao foi possivel salvar.");
}

function cleanYouTubeUrl(url: string) {
  const ampIndex = url.indexOf("&");
  return ampIndex === -1 ? url : url.substring(0, ampIndex);
}

function getString(data: FormData, key: string) {
  return String(data.get(key) ?? "");
}

function getNumber(data: FormData, key: string) {
  return Number(data.get(key) ?? 0);
}

function sharedChapterPayload(data: FormData, prefix = "") {
  const contentType = getString(data, `${prefix}contentType`) as MediaType;
  return {
    volumeId: getString(data, `${prefix}volumeId`),
    contentType,
    premiumOnly: data.get(`${prefix}premiumOnly`) === "on",
    published: data.get(`${prefix}published`) === "on",
  };
}

export function AdminChapterEditForm({
  chapter,
  volumes,
  backHref,
}: {
  chapter: ChapterEditData;
  volumes: VolumeOption[];
  backHref: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [contentType, setContentType] = useState<MediaType>(chapter.contentType === "YOUTUBE" ? "YOUTUBE" : "AUDIO");
  const [pending, startTransition] = useTransition();
  const chapterParts = getChapterPartsForDisplay(chapter);
  const isGroupedChapter = Boolean(chapter.positionEnd && chapter.positionEnd > chapter.position);
  const isEditingGroupedAudio = isGroupedChapter && contentType === "AUDIO";

  return (
    <form
      className="grid max-w-3xl gap-3 rounded-lg bg-[#06272b] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const nextChapterParts = isEditingGroupedAudio ? getChapterPartsFromForm(data, chapterParts.length) : [];
        const firstPart = nextChapterParts[0];
        const groupedTitle = nextChapterParts.map((part) => part.title).join(", ");
        const groupedDuration = getGroupedChapterDuration(nextChapterParts.map((part) => ({ startSec: part.startSec, durationSec: getDurationFromRange(part.startSec, part.endSec) })));
        startTransition(async () => {
          try {
            await patchJson(`/api/admin/chapters/${chapter.id}`, {
              ...sharedChapterPayload(data),
              title: isEditingGroupedAudio ? groupedTitle : getString(data, "title"),
              position: isEditingGroupedAudio && firstPart ? firstPart.position : getNumber(data, "position"),
              positionEnd: isEditingGroupedAudio ? getGroupedChapterPositionEnd(nextChapterParts.map((part) => part.position)) : null,
              durationSec: contentType === "YOUTUBE" ? 0 : isEditingGroupedAudio ? groupedDuration : getNumber(data, "durationSec"),
              audioUrl: getString(data, "audioUrl"),
              youtubeUrl: cleanYouTubeUrl(getString(data, "youtubeUrl")),
              startSec: contentType === "YOUTUBE" ? 0 : isEditingGroupedAudio && firstPart ? firstPart.startSec : getNumber(data, "startSec"),
              chapterParts: isEditingGroupedAudio ? nextChapterParts : [],
              transcriptJson: getString(data, "transcriptJson"),
            });
            setMessage("Capitulo atualizado com sucesso.");
            router.push(backHref);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
          }
        });
      }}
    >
      <h2 className="text-2xl font-black">Editar capitulo</h2>
      <ChapterSharedFields volumes={volumes} contentType={contentType} setContentType={setContentType} defaultVolumeId={chapter.volumeId} />
      {isEditingGroupedAudio ? (
        <ChapterBatchTable chapterParts={chapterParts} contentType={contentType} />
      ) : (
        <>
          <input name="title" defaultValue={chapter.title} placeholder="Titulo do capitulo" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
          <div className={`grid gap-2 ${contentType === "YOUTUBE" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
            <label className="grid gap-1 text-sm text-zinc-300">
              Numero do capitulo
              <input name="position" type="number" min="0" step="any" defaultValue={chapter.position} className="rounded-md border border-white/10 bg-black px-3 py-2" required />
            </label>
            {contentType === "AUDIO" ? (
              <>
                <label className="grid gap-1 text-sm text-zinc-300">
                  Inicio no audio (segundos)
                  <input name="startSec" type="number" min="0" defaultValue={chapter.startSec} className="rounded-md border border-white/10 bg-black px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm text-zinc-300">
                  Duracao (segundos)
                  <input name="durationSec" type="number" min="0" defaultValue={chapter.durationSec} className="rounded-md border border-white/10 bg-black px-3 py-2" />
                </label>
              </>
            ) : null}
          </div>
        </>
      )}
      {contentType === "YOUTUBE" ? (
        <input name="youtubeUrl" defaultValue={chapter.youtubeUrl ?? ""} placeholder="Link do YouTube" className="rounded-md border border-white/10 bg-black px-3 py-2" required onBlur={(e) => { e.target.value = cleanYouTubeUrl(e.target.value); }} />
      ) : (
        <>
          <input name="audioUrl" defaultValue={chapter.audioUrl ?? ""} placeholder="URL privada/proxy do audio" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
          <textarea
            name="transcriptJson"
            defaultValue={JSON.stringify(JSON.parse(chapter.transcriptJson || "[]"), null, 2)}
            className="min-h-48 rounded-md border border-white/10 bg-black px-3 py-2 font-mono text-xs"
          />
        </>
      )}
      <PublishFields defaultPremium={chapter.premiumOnly} defaultPublished={chapter.published} />
      <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
        Salvar alteracoes
      </button>
      {message ? <p className="rounded-md bg-white/10 p-3 text-sm text-zinc-200">{message}</p> : null}
    </form>
  );
}

export function AdminNovelForm({
  tags,
  novels,
}: {
  tags: TagOption[];
  novels: NovelOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [availableTags, setAvailableTags] = useState(tags);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  }

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => ({}))) as TagOption & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel cadastrar a tag.");
        return;
      }

      setAvailableTags((current) => (current.some((tag) => tag.id === payload.id) ? current : [...current, payload].sort((a, b) => a.name.localeCompare(b.name))));
      setSelectedTagIds((current) => (current.includes(payload.id) ? current : [...current, payload.id]));
      setNewTagName("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid max-w-3xl gap-3 rounded-lg bg-[#06272b] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          try {
            await postJson("/api/admin/novels", {
              title: data.get("title"),
              author: data.get("author"),
              synopsis: data.get("synopsis"),
              coverUrl: data.get("coverUrl"),
              status: data.get("status"),
              continuationId: getString(data, "continuationId") || null,
              tagIds: selectedTagIds,
            });
            setMessage("Novel cadastrada com sucesso.");
            form.reset();
            setSelectedTagIds([]);
            router.push("/admin/conteudo");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
          }
        });
      }}
    >
      <h2 className="text-2xl font-black">Cadastrar novel</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="title" placeholder="Titulo" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
        <input name="author" placeholder="Autor" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
      </div>
      <input name="coverUrl" placeholder="URL da capa" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
      <select name="status" className="rounded-md border border-white/10 bg-black px-3 py-2" defaultValue="ONGOING">
        <option value="ONGOING">Em andamento</option>
        <option value="COMPLETED">Concluida</option>
        <option value="PAUSED">Pausada</option>
      </select>
      <label className="grid gap-1 text-sm text-zinc-300">
        Continuação
        <select name="continuationId" className="rounded-md border border-white/10 bg-black px-3 py-2" defaultValue="">
          <option value="">Sem continuação</option>
          {novels.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>
      <section className="grid gap-3 rounded-md border border-white/10 bg-black/40 p-3">
        <div>
          <p className="text-sm font-bold text-zinc-300">Tags</p>
          <p className="mt-1 text-xs text-zinc-500">Clique nas tags para adicionar ou remover da novel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.length ? (
            availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${selected ? "bg-[#18b7bd] text-[#021114]" : "bg-white/10 text-zinc-200 hover:bg-white/20"}`}
                >
                  {tag.name}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma tag cadastrada ainda.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Nova tag"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black px-3 py-2"
          />
          <button type="button" onClick={createTag} disabled={pending || newTagName.trim().length < 2} className="rounded-full bg-[#18b7bd] px-4 py-2 font-black text-[#021114] hover:bg-[#22d3dc] disabled:opacity-60">
            Cadastrar nova tag
          </button>
        </div>
      </section>
      <textarea name="synopsis" placeholder="Sinopse" className="min-h-32 rounded-md border border-white/10 bg-black px-3 py-2" required />
      <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
        Salvar novel
      </button>
      {message ? <p className="rounded-md bg-white/10 p-3 text-sm text-zinc-200">{message}</p> : null}
    </form>
  );
}

export function AdminNovelEditForm({
  novel,
  tags,
  novels,
  backHref,
}: {
  novel: NovelEditData;
  tags: TagOption[];
  novels: NovelOption[];
  backHref: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [availableTags, setAvailableTags] = useState(tags);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(novel.tagIds);
  const [newTagName, setNewTagName] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  }

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => ({}))) as TagOption & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel cadastrar a tag.");
        return;
      }

      setAvailableTags((current) => (current.some((tag) => tag.id === payload.id) ? current : [...current, payload].sort((a, b) => a.name.localeCompare(b.name))));
      setSelectedTagIds((current) => (current.includes(payload.id) ? current : [...current, payload.id]));
      setNewTagName("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid max-w-3xl gap-3 rounded-lg bg-[#06272b] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await patchJson(`/api/admin/novels/${novel.id}`, {
              title: data.get("title"),
              author: data.get("author"),
              synopsis: data.get("synopsis"),
              coverUrl: data.get("coverUrl"),
              status: data.get("status"),
              continuationId: getString(data, "continuationId") || null,
              tagIds: selectedTagIds,
            });
            setMessage("Novel atualizada com sucesso.");
            router.push(backHref);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
          }
        });
      }}
    >
      <h2 className="text-2xl font-black">Editar novel</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="title" defaultValue={novel.title} placeholder="Titulo" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
        <input name="author" defaultValue={novel.author} placeholder="Autor" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
      </div>
      <input name="coverUrl" defaultValue={novel.coverUrl} placeholder="URL da capa" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
      <select name="status" className="rounded-md border border-white/10 bg-black px-3 py-2" defaultValue={novel.status}>
        <option value="ONGOING">Em andamento</option>
        <option value="COMPLETED">Concluida</option>
        <option value="PAUSED">Pausada</option>
      </select>
      <label className="grid gap-1 text-sm text-zinc-300">
        Continuação
        <select
          name="continuationId"
          className="rounded-md border border-white/10 bg-black px-3 py-2"
          defaultValue={novel.continuationId ?? ""}
        >
          <option value="">Sem continuação</option>
          {novels.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </label>
      <section className="grid gap-3 rounded-md border border-white/10 bg-black/40 p-3">
        <div>
          <p className="text-sm font-bold text-zinc-300">Tags</p>
          <p className="mt-1 text-xs text-zinc-500">Clique nas tags para adicionar ou remover da novel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.length ? (
            availableTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${selected ? "bg-[#18b7bd] text-[#021114]" : "bg-white/10 text-zinc-200 hover:bg-white/20"}`}
                >
                  {tag.name}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma tag cadastrada ainda.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Nova tag"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black px-3 py-2"
          />
          <button type="button" onClick={createTag} disabled={pending || newTagName.trim().length < 2} className="rounded-full bg-[#18b7bd] px-4 py-2 font-black text-[#021114] hover:bg-[#22d3dc] disabled:opacity-60">
            Cadastrar nova tag
          </button>
        </div>
      </section>
      <textarea name="synopsis" defaultValue={novel.synopsis} placeholder="Sinopse" className="min-h-32 rounded-md border border-white/10 bg-black px-3 py-2" required />
      <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
        Salvar alteracoes
      </button>
      {message ? <p className="rounded-md bg-white/10 p-3 text-sm text-zinc-200">{message}</p> : null}
    </form>
  );
}

export function AdminNovelPanelForms({
  novelId,
  volumes,
}: {
  novelId: string;
  volumes: VolumeOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [activeForm, setActiveForm] = useState<"volume" | "chapter" | null>(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState(volumes[0]?.id ?? "");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [chapterCount, setChapterCount] = useState(3);
  const [contentType, setContentType] = useState<MediaType>("AUDIO");
  const [pending, startTransition] = useTransition();
  const selectedVolume = volumes.find((volume) => volume.id === selectedVolumeId);
  const nextChapterPosition = selectedVolume?.nextChapterPosition ?? getNextChapterPosition(selectedVolume?.chapters ?? []);

  useEffect(() => {
    function openChapterForm(event: Event) {
      const detail = (event as CustomEvent<{ volumeId?: string }>).detail;
      if (!detail?.volumeId) return;
      setSelectedVolumeId(detail.volumeId);
      setActiveForm("chapter");
      setMessage("");
    }

    window.addEventListener("admin-open-chapter-form", openChapterForm);
    return () => window.removeEventListener("admin-open-chapter-form", openChapterForm);
  }, []);

  return (
    <div id="novo-conteudo" className="grid gap-4">
      <div className="rounded-lg bg-[#06272b] p-4">
        <h2 className="text-2xl font-black">Cadastro por volume</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveForm("volume");
              setMessage("");
            }}
            className={`rounded-full px-4 py-2 text-sm font-black ${activeForm === "volume" ? "bg-[#18b7bd] text-[#021114]" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            Cadastrar volume
          </button>
          {volumes.map((volume) => (
            <button
              key={volume.id}
              type="button"
              onClick={() => {
                setSelectedVolumeId(volume.id);
                setActiveForm("chapter");
                setMessage("");
              }}
              className={`rounded-full px-4 py-2 text-sm font-black ${
                activeForm === "chapter" && selectedVolumeId === volume.id ? "bg-[#18b7bd] text-[#021114]" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Cadastrar capitulo no Volume {volume.position}
            </button>
          ))}
        </div>
      </div>

      {activeForm === "volume" ? (
        <form
          id="novo-volume"
          className="grid content-start gap-3 rounded-lg bg-[#06272b] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            startTransition(async () => {
              try {
                await postJson("/api/admin/volumes", {
                  novelId,
                  title: data.get("title"),
                  position: Number(data.get("position")),
                });
                setMessage("Volume cadastrado com sucesso.");
                form.reset();
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
              }
            });
          }}
        >
          <h2 className="text-2xl font-black">Cadastrar volume</h2>
          <input name="title" placeholder="Volume 1: Nome" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
          <input name="position" type="number" min="1" defaultValue={volumes.length + 1} className="rounded-md border border-white/10 bg-black px-3 py-2" required />
          <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
            Salvar volume
          </button>
        </form>
      ) : null}

      {activeForm === "chapter" ? (
        <form
        key={selectedVolumeId}
        id="novo-capitulo"
        className="grid gap-3 rounded-lg bg-[#06272b] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const count = mode === "single" ? 1 : chapterCount;
          const shared = sharedChapterPayload(data);
          const sharedAudioUrl = getString(data, "sharedAudioUrl");
          const transcriptJson = getString(data, "transcriptJson");
          const batchParts = mode === "batch" ? getChapterPartsFromForm(data, count) : [];

          startTransition(async () => {
            try {
              await postJson("/api/admin/chapters", {
                chapters: Array.from({ length: count }, (_, index) => ({
                  ...shared,
                  title: getString(data, `chapter.${index}.title`),
                  position: getNumber(data, `chapter.${index}.position`),
                  startSec: contentType === "YOUTUBE" ? 0 : getNumber(data, `chapter.${index}.startSec`),
                  durationSec:
                    contentType === "YOUTUBE"
                      ? 0
                      : mode === "batch"
                        ? getDurationFromRange(getNumber(data, `chapter.${index}.startSec`), getNumber(data, `chapter.${index}.endSec`))
                        : getNumber(data, `chapter.${index}.durationSec`),
                  audioUrl: contentType === "AUDIO" ? sharedAudioUrl : "",
                  youtubeUrl: contentType === "YOUTUBE" ? cleanYouTubeUrl(getString(data, `chapter.${index}.youtubeUrl`)) : "",
                  chapterParts: mode === "batch" && contentType === "AUDIO" ? batchParts : [],
                  transcriptJson,
                })),
              });
              setMessage(mode === "single" ? "Capitulo cadastrado com sucesso." : "Capitulos cadastrados com sucesso.");
              form.reset();
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
            }
          });
        }}
        >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Cadastrar capitulos</h2>
          <div className="flex rounded-full bg-black p-1 text-sm font-bold">
            <button type="button" onClick={() => setMode("single")} className={`rounded-full px-4 py-2 ${mode === "single" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300"}`}>
              Individual
            </button>
            <button type="button" onClick={() => setMode("batch")} className={`rounded-full px-4 py-2 ${mode === "batch" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300"}`}>
              Em bloco
            </button>
          </div>
        </div>
        <ChapterSharedFields volumes={volumes} contentType={contentType} setContentType={setContentType} defaultVolumeId={selectedVolumeId} />
        {mode === "batch" ? (
          <label className="grid gap-1 text-sm text-zinc-300">
            Quantidade de capitulos
            <input type="number" min="2" max="50" value={chapterCount} onChange={(event) => setChapterCount(Number(event.target.value))} className="rounded-md border border-white/10 bg-black px-3 py-2" />
          </label>
        ) : null}
        {volumes.length === 0 ? <p className="text-sm text-zinc-400">Cadastre um volume antes de adicionar capitulos.</p> : null}
        {contentType === "AUDIO" ? (
          <>
            <input name="sharedAudioUrl" placeholder="URL privada/proxy do audio compartilhado" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
            <textarea name="transcriptJson" defaultValue={defaultTranscript} className="min-h-32 rounded-md border border-white/10 bg-black px-3 py-2 font-mono text-xs" />
          </>
        ) : null}
        <div className="grid gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {mode === "batch" ? (
            <ChapterBatchTable chapterCount={chapterCount} contentType={contentType} startPosition={nextChapterPosition} />
          ) : (
            <ChapterBlockFields index={0} contentType={contentType} startPosition={nextChapterPosition} />
          )}
        </div>
        <PublishFields defaultPremium={false} defaultPublished />
        <button disabled={pending || volumes.length === 0} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
          Salvar capitulos
        </button>
        </form>
      ) : null}

      {message ? <p className="rounded-md bg-white/10 p-3 text-sm text-zinc-200">{message}</p> : null}
    </div>
  );
}

function ChapterSharedFields({
  volumes,
  contentType,
  setContentType,
  defaultVolumeId,
}: {
  volumes: VolumeOption[];
  contentType: MediaType;
  setContentType: (contentType: MediaType) => void;
  defaultVolumeId?: string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <select name="volumeId" defaultValue={defaultVolumeId} className="rounded-md border border-white/10 bg-black px-3 py-2" required disabled={volumes.length === 0}>
        {volumes.map((volume) => (
          <option key={volume.id} value={volume.id}>
            Volume {volume.position}: {volume.title}
          </option>
        ))}
      </select>
      <select name="contentType" value={contentType} onChange={(event) => setContentType(event.target.value as MediaType)} className="rounded-md border border-white/10 bg-black px-3 py-2">
        <option value="AUDIO">Audio hospedado</option>
        <option value="YOUTUBE">Video do YouTube</option>
      </select>
    </div>
  );
}

type ChapterPartFormData = {
  position: number;
  title: string;
  startSec: number;
  endSec: number;
};

function getChapterPartsFromForm(data: FormData, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    position: getNumber(data, `chapter.${index}.position`),
    title: getString(data, `chapter.${index}.title`),
    startSec: getNumber(data, `chapter.${index}.startSec`),
    endSec: getNumber(data, `chapter.${index}.endSec`),
  }));
}

function ChapterBatchTable({ chapterCount, chapterParts, contentType, startPosition = 1 }: { chapterCount?: number; chapterParts?: ChapterPartFormData[]; contentType: MediaType; startPosition?: number }) {
  const chapters = chapterParts ?? Array.from({ length: chapterCount ?? 1 }, (_, index) => ({
    position: startPosition + index,
    title: `Capitulo ${startPosition + index}`,
    startSec: index * 60,
    endSec: (index + 1) * 60,
  }));

  return (
    <div className="max-h-[430px] overflow-auto rounded-md bg-black/30 pb-2 pr-2 scrollbar-thin">
      <table className="min-w-[760px] table-fixed border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-black/80 text-left text-xs uppercase text-zinc-400">
          <tr>
            <th className="w-24 px-3 py-2">Numero</th>
            <th className="min-w-56 px-3 py-2">Titulo</th>
            {contentType === "AUDIO" ? (
              <>
                <th className="w-32 px-3 py-2">Inicio (s)</th>
                <th className="w-32 px-3 py-2">Fim (s)</th>
              </>
            ) : (
              <th className="min-w-64 px-3 py-2">YouTube</th>
            )}
          </tr>
        </thead>
        <tbody>
          {chapters.map((chapter, index) => (
            <tr key={index} className="border-t border-white/10">
              <td className="px-3 py-2 align-top">
                <input name={`chapter.${index}.position`} type="number" min="0" step="1" defaultValue={chapter.position} className="w-full rounded-md border border-white/10 bg-black px-3 py-2" required />
              </td>
              <td className="px-3 py-2 align-top">
                <input name={`chapter.${index}.title`} defaultValue={chapter.title} placeholder={`Capitulo ${index + 1}`} className="w-full rounded-md border border-white/10 bg-black px-3 py-2" required />
              </td>
              {contentType === "AUDIO" ? (
                <>
                  <td className="px-3 py-2 align-top">
                    <input name={`chapter.${index}.startSec`} type="number" min="0" defaultValue={chapter.startSec} className="w-full rounded-md border border-white/10 bg-black px-3 py-2" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input name={`chapter.${index}.endSec`} type="number" min="0" defaultValue={chapter.endSec} className="w-full rounded-md border border-white/10 bg-black px-3 py-2" />
                  </td>
                </>
              ) : (
                <td className="px-3 py-2 align-top">
                  <input name={`chapter.${index}.youtubeUrl`} placeholder="Link do YouTube" className="w-full rounded-md border border-white/10 bg-black px-3 py-2" required onBlur={(e) => { e.target.value = cleanYouTubeUrl(e.target.value); }} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChapterBlockFields({ index, contentType, startPosition = 1 }: { index: number; contentType: MediaType; startPosition?: number }) {
  const chapterPosition = startPosition + index;

  return (
    <fieldset className="min-w-[720px] grid gap-2 rounded-md bg-black/30 p-3">
      <legend className="px-1 text-sm font-bold text-zinc-300">Capitulo {chapterPosition}</legend>
      <input name={`chapter.${index}.title`} placeholder="Titulo" className="rounded-md border border-white/10 bg-black px-3 py-2" required />
      <div className={`grid gap-2 ${contentType === "YOUTUBE" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
        <label className="grid gap-1 text-sm text-zinc-300">
          Numero do capitulo
          <input name={`chapter.${index}.position`} type="number" min="0" step="any" defaultValue={chapterPosition} className="rounded-md border border-white/10 bg-black px-3 py-2" required />
        </label>
        {contentType === "AUDIO" ? (
          <>
            <label className="grid gap-1 text-sm text-zinc-300">
              Inicio no audio (segundos)
              <input name={`chapter.${index}.startSec`} type="number" min="0" defaultValue="0" className="rounded-md border border-white/10 bg-black px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              Duracao (segundos)
              <input name={`chapter.${index}.durationSec`} type="number" min="0" defaultValue="60" className="rounded-md border border-white/10 bg-black px-3 py-2" />
            </label>
          </>
        ) : null}
      </div>
      {contentType === "YOUTUBE" ? <input name={`chapter.${index}.youtubeUrl`} placeholder="Link do YouTube" className="rounded-md border border-white/10 bg-black px-3 py-2" required onBlur={(e) => { e.target.value = cleanYouTubeUrl(e.target.value); }} /> : null}
    </fieldset>
  );
}

function PublishFields({ defaultPremium, defaultPublished }: { defaultPremium: boolean; defaultPublished: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input name="premiumOnly" type="checkbox" defaultChecked={defaultPremium} className="accent-[#18b7bd]" /> Apenas premium
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input name="published" type="checkbox" defaultChecked={defaultPublished} className="accent-[#18b7bd]" /> Publicado
      </label>
    </div>
  );
}
