"use client";

import { Gauge, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEncryptedAudioUrl } from "@/lib/audio-cache";
import {
  getActiveChapterPartIndex,
  getAdjacentChapterPart,
  type ChapterNavigationDirection,
  type ChapterPlaybackPart,
  type ChapterSeekDetail,
} from "@/lib/chapter-playback";

type Cue = {
  start: number;
  end: number;
  text: string;
};

export function AudioPlayer({
  chapterId,
  src,
  initialPosition,
  duration,
  startOffset = 0,
  transcript,
  chapterTitle,
  novelTitle,
  coverUrl,
  chapterParts = [],
}: {
  chapterId: string;
  src: string;
  initialPosition: number;
  duration: number;
  startOffset?: number;
  transcript: Cue[];
  chapterTitle: string;
  novelTitle: string;
  coverUrl: string;
  chapterParts?: ChapterPlaybackPart[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingStartRef = useRef<number | null>(null);
  const transcriptCueRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const shouldScrollActiveCueRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"karaoke" | "page">("karaoke");
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [current, setCurrent] = useState(initialPosition);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [karaokeFontLevel, setKaraokeFontLevel] = useState(1);
  const [audioSrc, setAudioSrc] = useState(src);
  const [resolvedDuration, setResolvedDuration] = useState(duration);
  const [playbackError, setPlaybackError] = useState("");
  const [pauseAtChapterEnd, setPauseAtChapterEnd] = useState(false);

  const activeIndex = useMemo(() => {
    if (!transcript.length) return -1;

    let index = 0;
    for (let i = 0; i < transcript.length; i += 1) {
      if (current >= transcript[i].start) index = i;
      else break;
    }

    return index;
  }, [current, transcript]);
  const activeCue = activeIndex >= 0 ? transcript[activeIndex] : transcript[0];
  const previousCue = activeIndex > 0 ? transcript[activeIndex - 1] : null;
  const nextCue = activeIndex >= 0 && activeIndex < transcript.length - 1 ? transcript[activeIndex + 1] : null;
  const progressDuration = resolvedDuration || duration || 1;
  const progressPercent = Math.min(100, Math.max(0, (current / progressDuration) * 100));
  const groupedChapterParts = chapterParts.length > 1 ? chapterParts : [];
  const absoluteCurrent = startOffset + current;
  const activeChapterPartIndex = getActiveChapterPartIndex(groupedChapterParts, absoluteCurrent);
  const hasPreviousChapterPart = activeChapterPartIndex > 0;
  const hasNextChapterPart = activeChapterPartIndex >= 0 && activeChapterPartIndex < groupedChapterParts.length - 1;
  const karaokeFont = [
    {
      active: "clamp(0.82rem, 1.55vw, 1.2rem)",
      nearby: "clamp(0.68rem, 1.05vw, 0.95rem)",
    },
    {
      active: "clamp(0.98rem, 1.9vw, 1.45rem)",
      nearby: "clamp(0.76rem, 1.25vw, 1.05rem)",
    },
    {
      active: "clamp(1.15rem, 2.35vw, 1.85rem)",
      nearby: "clamp(0.86rem, 1.55vw, 1.22rem)",
    },
    {
      active: "clamp(1.35rem, 2.8vw, 2.25rem)",
      nearby: "clamp(0.98rem, 1.85vw, 1.42rem)",
    },
    {
      active: "clamp(1.6rem, 3.4vw, 2.9rem)",
      nearby: "clamp(1.12rem, 2.2vw, 1.72rem)",
    },
    {
      active: "clamp(1.9rem, 4.2vw, 3.6rem)",
      nearby: "clamp(1.3rem, 2.7vw, 2.15rem)",
    },
  ][karaokeFontLevel];

  async function saveProgress(completed = false) {
    const audio = audioRef.current;
    if (!audio) return;

    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId,
        positionSec: Math.floor(Math.max(0, audio.currentTime - startOffset)),
        durationSec: Math.floor(resolvedDuration || audio.duration || duration),
        completed,
      }),
    });
  }

  useEffect(() => {
    let revokedUrl: string | null = null;
    let active = true;

    getEncryptedAudioUrl(chapterId, src)
      .then((cachedUrl) => {
        if (!active) {
          URL.revokeObjectURL(cachedUrl);
          return;
        }
        revokedUrl = cachedUrl;
        setAudioSrc(cachedUrl);
      })
      .catch(() => setAudioSrc(src));

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [chapterId, src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (audio.currentTime < startOffset || (audio.currentTime === 0 && (initialPosition > 0 || startOffset > 0))) {
        audio.currentTime = startOffset + initialPosition;
      }
      setKaraokeMode(playMode === "karaoke");
      setPlaybackError("");
      audio.playbackRate = playbackRate;
      audio.volume = volume;
      audio.muted = muted;
      audio
        .play()
        .then(() => {
          setPlaying(true);
          void saveProgress(false);
        })
        .catch(() => {
          setPlaying(false);
          setKaraokeMode(false);
          setPlaybackError("Nao foi possivel iniciar o audio neste dispositivo. Verifique a conexao e toque em play novamente.");
        });
    } else {
      audio.pause();
      setPlaying(false);
      void saveProgress(false);
    }
  }

  function decreaseKaraokeFont() {
    setKaraokeFontLevel((level) => Math.max(0, level - 1));
  }

  function increaseKaraokeFont() {
    setKaraokeFontLevel((level) => Math.min(5, level + 1));
  }

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextRelativeTime = Math.min(Math.max(Math.max(0, audio.currentTime - startOffset) + seconds, 0), progressDuration);
    audio.currentTime = startOffset + nextRelativeTime;
    setCurrent(nextRelativeTime);
  }

  const seekToAbsoluteTime = useCallback((startSec: number, autoplay = false) => {
    const audio = audioRef.current;
    const nextRelativeTime = Math.max(0, startSec - startOffset);
    pendingStartRef.current = startSec;
    shouldScrollActiveCueRef.current = true;
    if (audio) audio.currentTime = startSec;
    setCurrent(nextRelativeTime);

    if (!audio || !autoplay) return;

    setPlaybackError("");
    setKaraokeMode(playMode === "karaoke");
    audio.playbackRate = playbackRate;
    audio.volume = volume;
    audio.muted = muted;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        setKaraokeMode(false);
        setPlaybackError("Nao foi possivel iniciar o audio neste dispositivo. Verifique a conexao e toque em play novamente.");
      });
  }, [muted, playbackRate, playMode, startOffset, volume]);

  useEffect(() => {
    if (!shouldScrollActiveCueRef.current || activeIndex < 0) return;

    transcriptCueRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
    shouldScrollActiveCueRef.current = false;
  }, [activeIndex]);

  useEffect(() => {
    function seekFromChapterTitle(event: Event) {
      const { startSec, autoplay } = (event as CustomEvent<Partial<ChapterSeekDetail>>).detail ?? {};
      if (typeof startSec === "number") seekToAbsoluteTime(startSec, autoplay);
    }

    window.addEventListener("audio-novel-seek", seekFromChapterTitle);
    return () => window.removeEventListener("audio-novel-seek", seekFromChapterTitle);
  }, [seekToAbsoluteTime]);

  function navigateGroupedChapter(direction: ChapterNavigationDirection) {
    const audio = audioRef.current;
    const target = getAdjacentChapterPart(
      groupedChapterParts,
      audio?.currentTime ?? absoluteCurrent,
      direction,
    );
    if (target) seekToAbsoluteTime(target.startSec, true);
  }

  function updateVolume(nextVolume: number) {
    const normalized = Math.min(1, Math.max(0, nextVolume));
    const audio = audioRef.current;
    setVolume(normalized);
    setMuted(normalized === 0);
    if (audio) {
      audio.volume = normalized;
      audio.muted = normalized === 0;
    }
  }

  function toggleMuted() {
    const audio = audioRef.current;
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (audio) audio.muted = nextMuted;
  }

  function updatePlaybackRate(nextRate: number) {
    const audio = audioRef.current;
    setPlaybackRate(nextRate);
    if (audio) audio.playbackRate = nextRate;
  }

  function pauseIfNeededAtGroupedChapterEnd(audio: HTMLAudioElement) {
    if (!pauseAtChapterEnd || groupedChapterParts.length === 0) return;

    const absoluteCurrent = audio.currentTime;
    const activePart = groupedChapterParts.find((part) => absoluteCurrent >= part.startSec && absoluteCurrent < part.endSec);
    if (!activePart) return;
    if (activePart.endSec >= startOffset + progressDuration) return;
    if (absoluteCurrent < activePart.endSec - 0.25) return;

    audio.pause();
    audio.currentTime = activePart.endSec;
    setPlaying(false);
    setKaraokeMode(false);
    setCurrent(Math.max(0, activePart.endSec - startOffset));
    void saveProgress(false);
  }

  return (
    <>
      <div id="chapter-player" className="grid gap-5 rounded-lg bg-[#06272b] p-4">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const audioDuration = Math.max(0, event.currentTarget.duration - startOffset);
            setResolvedDuration(duration || audioDuration);
            if (pendingStartRef.current !== null) event.currentTarget.currentTime = pendingStartRef.current;
            else if (initialPosition > 0 || startOffset > 0) event.currentTarget.currentTime = startOffset + initialPosition;
            event.currentTarget.volume = volume;
            event.currentTarget.muted = muted;
            event.currentTarget.playbackRate = playbackRate;
            setPlaybackError("");
          }}
          onTimeUpdate={(event) => {
            setCurrent(Math.max(0, event.currentTarget.currentTime - startOffset));
            pauseIfNeededAtGroupedChapterEnd(event.currentTarget);
          }}
          onEnded={() => {
            setPlaying(false);
            setKaraokeMode(false);
            setCurrent(progressDuration);
            void saveProgress(true);
          }}
        />

        {groupedChapterParts.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-md bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">Pausar entre capitulos</p>
              <p className="text-xs text-zinc-400">Quando ligado, a reproducao pausa ao fim de cada capitulo dentro deste bloco.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pauseAtChapterEnd}
              onClick={() => setPauseAtChapterEnd((value) => !value)}
              className={`flex min-h-11 w-20 items-center rounded-full p-1 transition ${
                pauseAtChapterEnd ? "justify-end bg-[#18b7bd]" : "justify-start bg-white/15"
              }`}
            >
              <span className={`h-9 w-9 rounded-full bg-white shadow ${pauseAtChapterEnd ? "text-[#021114]" : "text-zinc-500"}`} />
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-md bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">Modo de reprodução</p>
            <p className="text-xs text-zinc-400">Escolha como o capítulo abre quando você apertar play.</p>
          </div>
          <div className="grid grid-cols-2 rounded-full bg-black p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setPlayMode("karaoke")}
              className={`min-h-11 rounded-full px-4 py-2 ${playMode === "karaoke" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"}`}
            >
              Karaoke
            </button>
            <button
              type="button"
              onClick={() => setPlayMode("page")}
              className={`min-h-11 rounded-full px-4 py-2 ${playMode === "page" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"}`}
            >
              Página
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {groupedChapterParts.length > 0 ? (
            <button
              type="button"
              onClick={() => navigateGroupedChapter("previous")}
              disabled={!hasPreviousChapterPart}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Capítulo agrupado anterior"
            >
              <SkipBack size={22} fill="currentColor" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
            aria-label="Retroceder 10 segundos"
          >
            -10s
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pausar capítulo" : "Reproduzir capítulo"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#18b7bd] text-[#021114] shadow-lg shadow-[#18b7bd]/20"
          >
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
            aria-label="Avançar 10 segundos"
          >
            +10s
          </button>
          {groupedChapterParts.length > 0 ? (
            <button
              type="button"
              onClick={() => navigateGroupedChapter("next")}
              disabled={!hasNextChapterPart}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Próximo capítulo agrupado"
            >
              <SkipForward size={22} fill="currentColor" />
            </button>
          ) : null}
          <div className="w-full min-w-0 sm:flex-1">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#18b7bd]" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Ouvido até {formatTime(current)} de {formatTime(progressDuration)}
            </p>
          </div>
        </div>
        {playbackError ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-200">{playbackError}</p> : null}

        {playing && playMode === "page" ? (
          <div className="grid gap-3 rounded-md bg-black/30 p-3">
            <p className="text-sm font-bold text-zinc-200">Controles de volume e velocidade</p>
            <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_220px]">
              <KaraokeVolumeControl muted={muted} volume={volume} onMute={toggleMuted} onVolume={updateVolume} />
              <KaraokeSpeedControl playbackRate={playbackRate} onPlaybackRate={updatePlaybackRate} />
            </div>
          </div>
        ) : null}

        <section>
          <h2 className="mb-3 text-xl font-bold">Texto do capítulo</h2>
          <div className="max-h-[520px] overflow-auto rounded-md bg-black/40 p-4 scrollbar-thin">
            {transcript.map((cue, index) => (
              <p
                key={`${cue.start}-${cue.text}`}
                ref={(element) => {
                  transcriptCueRefs.current[index] = element;
                }}
                className={`rounded px-3 py-2 leading-7 ${activeCue === cue ? "bg-[#18b7bd] font-bold text-[#021114]" : "text-zinc-300"}`}
              >
                {cue.text}
              </p>
            ))}
          </div>
        </section>
      </div>

      {karaokeMode ? (
        <div className="fixed inset-0 z-50 bg-black text-white">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: `url(${coverUrl})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" aria-hidden="true" />
          <main className="relative h-full overflow-hidden">
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase text-white/70">{novelTitle}</p>
                <h2 className="truncate text-lg font-black sm:text-2xl">{chapterTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setKaraokeMode(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 hover:bg-black/50"
                aria-label="Sair do karaoke"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pointer-events-none absolute inset-0 px-4 sm:px-8">
              {previousCue ? (
                <div className="absolute left-1/2 top-[28%] w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2">
                  <p className="text-center font-black leading-snug text-white/35" style={{ fontSize: karaokeFont.nearby }}>
                    {previousCue.text}
                  </p>
                </div>
              ) : null}
              <div className="absolute left-1/2 top-1/2 w-[min(94vw,1040px)] -translate-x-1/2 -translate-y-1/2">
                <p className="text-center font-black leading-snug text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]" style={{ fontSize: karaokeFont.active }}>
                  {activeCue?.text ?? "..."}
                </p>
              </div>
              {nextCue ? (
                <div className="absolute left-1/2 top-[72%] w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2">
                  <p className="text-center font-black leading-snug text-white/45" style={{ fontSize: karaokeFont.nearby }}>
                    {nextCue.text}
                  </p>
                </div>
              ) : null}
            </div>
          </main>

          <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#18181b]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 lg:grid lg:grid-cols-[180px_1fr_340px] lg:items-center">
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-bold">{chapterTitle}</p>
                <p className="truncate text-xs text-zinc-400">{novelTitle}</p>
              </div>
              <div className="grid min-w-0 gap-2">
                <div className="flex items-center justify-center gap-2">
                {groupedChapterParts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigateGroupedChapter("previous")}
                    disabled={!hasPreviousChapterPart}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Capítulo agrupado anterior"
                  >
                    <SkipBack size={20} fill="currentColor" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
                  aria-label="Retroceder 10 segundos"
                >
                  -10s
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pausar capítulo" : "Reproduzir capítulo"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black"
                >
                  {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                </button>
                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
                  aria-label="Avançar 10 segundos"
                >
                  +10s
                </button>
                {groupedChapterParts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigateGroupedChapter("next")}
                    disabled={!hasNextChapterPart}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Próximo capítulo agrupado"
                  >
                    <SkipForward size={20} fill="currentColor" />
                  </button>
                ) : null}
                </div>
                <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                <span className="text-right text-xs text-zinc-400">{formatTime(current)}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-white" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-xs text-zinc-400">{formatTime(progressDuration)}</span>
                </div>
              </div>
              <div className="grid grid-cols-[auto_minmax(64px,84px)_auto] items-center justify-center gap-2 sm:grid-cols-[auto_90px_auto] lg:hidden">
                <KaraokeFontControls onDecrease={decreaseKaraokeFont} onIncrease={increaseKaraokeFont} />
                <KaraokeVolumeControl muted={muted} volume={volume} onMute={toggleMuted} onVolume={updateVolume} compact />
                <KaraokeSpeedControl playbackRate={playbackRate} onPlaybackRate={updatePlaybackRate} compact />
              </div>
              <div className="hidden grid-cols-[auto_84px_auto] items-center gap-2 lg:grid">
                <KaraokeFontControls onDecrease={decreaseKaraokeFont} onIncrease={increaseKaraokeFont} />
                <KaraokeVolumeControl muted={muted} volume={volume} onMute={toggleMuted} onVolume={updateVolume} compact />
                <KaraokeSpeedControl playbackRate={playbackRate} onPlaybackRate={updatePlaybackRate} compact />
              </div>
            </div>
          </footer>
        </div>
      ) : null}
    </>
  );
}

function KaraokeVolumeControl({
  muted,
  volume,
  onMute,
  onVolume,
  compact = false,
}: {
  muted: boolean;
  volume: number;
  onMute: () => void;
  onVolume: (volume: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "rounded-md bg-black/30 p-3"}`}>
      <button
        type="button"
        onClick={onMute}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        aria-label={muted ? "Ativar volume" : "Silenciar"}
      >
        {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <label className={`grid min-w-0 gap-1 text-xs text-zinc-300 ${compact ? "w-16 sm:w-20" : "flex-1"}`}>
        <span>{compact ? "Volume" : `Volume ${muted ? 0 : Math.round(volume * 100)}%`}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          className="w-full accent-white"
        />
      </label>
    </div>
  );
}

function KaraokeFontControls({
  onDecrease,
  onIncrease,
}: {
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
        aria-label="Diminuir fonte do karaoke"
      >
        A-
      </button>
      <button
        type="button"
        onClick={onIncrease}
        className="min-h-11 rounded-full bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
        aria-label="Aumentar fonte do karaoke"
      >
        A+
      </button>
    </div>
  );
}

function KaraokeSpeedControl({
  playbackRate,
  onPlaybackRate,
  compact = false,
}: {
  playbackRate: number;
  onPlaybackRate: (rate: number) => void;
  compact?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 text-sm text-zinc-300 ${compact ? "" : "rounded-md bg-black/30 p-3"}`}>
      <Gauge size={18} className="text-white" />
      <span className="font-bold">{compact ? "Vel." : "Velocidade"}</span>
      <select
        value={playbackRate}
        onChange={(event) => onPlaybackRate(Number(event.target.value))}
        className="ml-auto min-h-11 rounded-md border border-white/10 bg-black px-3 py-2 text-white"
      >
        {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
          <option key={rate} value={rate}>
            {rate}x
          </option>
        ))}
      </select>
    </label>
  );
}

function formatTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
