"use client";

import { ChevronDown, FastForward, Pause, Play, Rewind, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useOfflineCryptoSupported } from "@/hooks/use-offline-crypto-supported";
import { getEncryptedAudioUrl, getSavedOfflineItems, hasValidEncryptedAudio, saveOfflineItem } from "@/lib/audio-cache";
import { OfflineCryptoUnavailableError, OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE } from "@/lib/offline-crypto";
import { mergeOfflineItems, type OfflineItem } from "@/lib/offline-items";

export function OfflineListenPanel({ items }: { items: OfflineItem[] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeId, setActiveId] = useState("");
  const [audioSrc, setAudioSrc] = useState("");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [availableItems, setAvailableItems] = useState<OfflineItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const offlineCryptoSupported = useOfflineCryptoSupported();
  const checkedItems = availableItems ?? [];
  const checkingCache = offlineCryptoSupported && availableItems === null;
  const activeItem = checkedItems.find((item) => item.id === activeId);
  const groupedItems = groupByNovel(checkedItems);

  useEffect(() => {
    return () => {
      if (audioSrc.startsWith("blob:")) URL.revokeObjectURL(audioSrc);
    };
  }, [audioSrc]);

  useEffect(() => {
    let active = true;

    if (!offlineCryptoSupported) {
      return () => {
        active = false;
      };
    }

    getSavedOfflineItems()
      .then(async (localItems) => {
        const mergedItems = mergeOfflineItems(items, localItems);
        const validItems = await Promise.all(
          mergedItems.map(async (item) => {
            const valid = await hasValidEncryptedAudio(item.chapterId, "offline");
            return valid ? item : null;
          }),
        );
        return validItems.filter((item): item is OfflineItem => Boolean(item));
      })
      .then(async (validItems) => {
        await Promise.all(validItems.map((item) => saveOfflineItem(item)));
        return validItems;
      })
      .then((validItems) => {
        if (!active) return;
        setAvailableItems(validItems);
      })
      .catch((error) => {
        if (!active) return;
        setAvailableItems([]);
        setMessage(error instanceof OfflineCryptoUnavailableError ? error.message : "Nao foi possivel verificar os audios offline deste dispositivo.");
      });

    return () => {
      active = false;
    };
  }, [items, offlineCryptoSupported]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  function playItem(item: OfflineItem) {
    startTransition(async () => {
      setMessage("");
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      const source = `/api/chapters/${item.chapterId}/audio?offline=${encodeURIComponent(item.cacheKey)}`;

      try {
        if (!offlineCryptoSupported) throw new OfflineCryptoUnavailableError();
        const hasCache = await hasValidEncryptedAudio(item.chapterId, "offline");
        if (!hasCache) {
          setAvailableItems((current) => (current ?? []).filter((savedItem) => savedItem.id !== item.id));
          setMessage("Este audio offline expirou. Salve o capitulo novamente na pagina da novel.");
          return;
        }

        const url = await getEncryptedAudioUrl(item.chapterId, source, { mode: "offline" });
        if (audioSrc.startsWith("blob:")) URL.revokeObjectURL(audioSrc);
        setAudioSrc(url);
        setActiveId(item.id);
        requestAnimationFrame(() => {
          if (audioRef.current) {
            audioRef.current.volume = volume;
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.load();
            audioRef.current
              .play()
              .then(() => setPlaying(true))
              .catch(() => {
                setPlaying(false);
                setMessage("Audio carregado. Toque no botao de play para reproduzir neste dispositivo.");
              });
          }
        });
      } catch (error) {
        setMessage(error instanceof OfflineCryptoUnavailableError ? error.message : "Nao foi possivel abrir este audio offline. Tente salvar novamente na pagina da novel.");
      }
    });
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setMessage("Nao foi possivel iniciar o audio. Toque novamente no botao de play."));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(audio.duration || Number.POSITIVE_INFINITY, audio.currentTime + seconds));
    audio.currentTime = nextTime;
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg bg-[#06272b] p-4">
        <audio
          ref={audioRef}
          src={audioSrc || undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setDuration(nextDuration);
          }}
        />
        {activeItem ? (
          <div className="grid gap-4">
            <div>
              <p className="text-sm font-bold uppercase text-[#18b7bd]">Tocando offline</p>
              <h2 className="mt-1 text-xl font-black">{activeItem.title}</h2>
              <p className="text-sm text-zinc-400">{activeItem.novelTitle} - {activeItem.volumeTitle}</p>
            </div>
            <div className="grid gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-black/50">
                <div className="h-full bg-[#18b7bd]" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-zinc-400">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(duration, 0)}
                  step="1"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-[#18b7bd]"
                  aria-label="Progresso do audio"
                />
                <span>{duration ? formatTime(duration) : "--:--"}</span>
              </div>
            </div>
            <div className="grid grid-cols-[auto_auto_auto] items-center gap-3 sm:flex sm:flex-wrap">
              <button type="button" onClick={() => seekBy(-10)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Retroceder 10 segundos">
                <Rewind size={18} />
              </button>
              <button type="button" onClick={toggle} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#18b7bd] text-[#021114]" title={playing ? "Pausar" : "Reproduzir"}>
                {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              </button>
              <button type="button" onClick={() => seekBy(10)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Avancar 10 segundos">
                <FastForward size={18} />
              </button>
              <label className="col-span-3 flex min-w-0 items-center gap-2 text-xs font-bold text-zinc-300 sm:col-span-1 sm:min-w-36">
                <Volume2 size={16} />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="h-1 min-w-0 flex-1 accent-[#18b7bd] sm:w-24 sm:flex-none"
                  aria-label="Volume"
                />
              </label>
              <label className="col-span-3 flex items-center gap-2 text-xs font-bold text-zinc-300 sm:col-span-1">
                Velocidade
                <select
                  value={playbackRate}
                  onChange={(event) => setPlaybackRate(Number(event.target.value))}
                  className="min-h-11 rounded-full border border-white/10 bg-black px-3 py-2 text-sm font-black text-white outline-none focus:border-[#18b7bd]"
                  aria-label="Velocidade"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-zinc-400">Escolha um capitulo salvo para ouvir offline.</p>
        )}
        {message ? <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-200">{message}</p> : null}
      </div>

      <div className="grid gap-3">
        {!offlineCryptoSupported ? (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">{OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE}</p>
        ) : checkingCache ? (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">Verificando audios offline salvos neste dispositivo...</p>
        ) : groupedItems.length ? (
          groupedItems.map((group, index) => (
            <details key={group.novelTitle} open={index === 0 || group.items.some((item) => item.id === activeId)} className="overflow-hidden rounded-md bg-[#06272b]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[#08353a] px-4 py-3 marker:hidden">
                <div>
                  <h3 className="font-black">{group.novelTitle}</h3>
                  <p className="text-xs text-zinc-400">{group.items.length} capitulo{group.items.length === 1 ? "" : "s"} salvo{group.items.length === 1 ? "" : "s"}</p>
                </div>
                <ChevronDown size={18} />
              </summary>
              <div className="grid gap-2 p-3">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={pending}
                    onClick={() => playItem(item)}
                    className={`grid gap-1 rounded-md p-3 text-left hover:bg-[#08353a] disabled:opacity-60 ${
                      item.id === activeId ? "bg-[#18b7bd]/15 ring-1 ring-[#18b7bd]/40" : "bg-[#020b0d]/55"
                    }`}
                  >
                    <span className="font-black">{item.title}</span>
                    <span className="text-sm text-zinc-400">
                      {item.volumeTitle} - Capitulo {item.chapterPositionLabel ?? item.chapterPosition}
                    </span>
                    <span className="text-xs text-zinc-500">Disponivel ate {new Date(item.expiresAt).toLocaleDateString("pt-BR")}</span>
                  </button>
                ))}
              </div>
            </details>
          ))
        ) : (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhum capitulo offline salvo ainda.</p>
        )}
      </div>
    </div>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function groupByNovel(items: OfflineItem[]) {
  const groups = new Map<string, OfflineItem[]>();

  for (const item of items) {
    const group = groups.get(item.novelTitle) ?? [];
    group.push(item);
    groups.set(item.novelTitle, group);
  }

  return Array.from(groups.entries()).map(([novelTitle, groupItems]) => ({
    novelTitle,
    items: groupItems.sort((a, b) => a.volumeTitle.localeCompare(b.volumeTitle, "pt-BR") || a.chapterPosition - b.chapterPosition),
  }));
}
