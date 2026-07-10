"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerSettingsMenu } from "@/components/player-settings-menu";
import { useAudioPlayerSettings } from "@/hooks/use-audio-player-settings";
import { getEncryptedAudioUrl } from "@/lib/audio-cache";
import { isPlaybackComplete, mergeCompletion, shouldSaveCheckpoint } from "@/lib/audio-progress";
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

const PLAYBACK_CONNECTION_ERROR =
  "Nao foi possivel iniciar o audio neste dispositivo. Verifique a conexao e toque em play novamente.";
const NEXT_CHAPTER_AUTOPLAY_KEY = "audio-novel-next-chapter-autoplay-v1";

export function AudioPlayer({
  chapterId,
  src,
  initialPosition,
  initialCompleted = false,
  duration,
  startOffset = 0,
  transcript,
  chapterTitle,
  novelTitle,
  coverUrl,
  chapterParts = [],
  accountScope,
  nextChapterHref = null,
}: {
  chapterId: string;
  src: string;
  initialPosition: number;
  initialCompleted?: boolean;
  duration: number;
  startOffset?: number;
  transcript: Cue[];
  chapterTitle: string;
  novelTitle: string;
  coverUrl: string;
  chapterParts?: ChapterPlaybackPart[];
  accountScope: string;
  nextChapterHref?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingStartRef = useRef<number | null>(null);
  const transcriptCueRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const shouldScrollActiveCueRef = useRef(false);
  const lastCheckpointAtRef = useRef(0);
  const lastProgressPayloadRef = useRef("");
  const completionSentRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const playbackActiveRef = useRef(false);
  const desiredPlaybackRef = useRef(false);
  const downloadedAudioRef = useRef<{ source: string; objectUrl: string } | null>(null);
  const downloadPromiseRef = useRef<Promise<string> | null>(null);
  const [audioSource, setAudioSource] = useState<{ source: string; objectUrl: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const initialResumePosition = initialCompleted || isPlaybackComplete(initialPosition, duration) ? 0 : initialPosition;
  const [current, setCurrent] = useState(initialResumePosition);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [karaokeFontLevel, setKaraokeFontLevel] = useState(1);
  const [resolvedDuration, setResolvedDuration] = useState(duration);
  const [playbackError, setPlaybackError] = useState("");
  const [audioDownload, setAudioDownload] = useState<{ source: string; active: boolean; percent: number | null } | null>(null);
  const { settings, updateSettings } = useAudioPlayerSettings();
  const { playbackRate, pauseAtChapterEnd, autoPlayNextChapter, playMode } = settings;

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
  const activeAudioSource = audioSource?.source === src ? audioSource.objectUrl : "";
  const downloadingAudio = audioDownload?.source === src && audioDownload.active;
  const downloadPercent = audioDownload?.source === src ? audioDownload.percent : null;
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

  useEffect(() => {
    downloadPromiseRef.current = null;
    const downloadedAudio = downloadedAudioRef.current;
    if (downloadedAudio) URL.revokeObjectURL(downloadedAudio.objectUrl);
    downloadedAudioRef.current = null;
    playbackActiveRef.current = false;
    desiredPlaybackRef.current = false;

    return () => {
      downloadPromiseRef.current = null;
      const activeDownload = downloadedAudioRef.current;
      if (activeDownload) URL.revokeObjectURL(activeDownload.objectUrl);
      downloadedAudioRef.current = null;
    };
  }, [src]);

  const saveProgress = useCallback(async ({
    completed = false,
    force = false,
    keepalive = false,
  }: {
    completed?: boolean;
    force?: boolean;
    keepalive?: boolean;
  } = {}) => {
    const audio = audioRef.current;
    if (!audio) return;

    const positionSec = Math.floor(Math.max(0, audio.currentTime - startOffset));
    const durationSec = Math.floor(
      resolvedDuration || Math.max(0, audio.duration - startOffset) || duration,
    );
    const finalCompleted = mergeCompletion(
      completionSentRef.current,
      completed || isPlaybackComplete(positionSec, durationSec),
    );
    const payload = JSON.stringify({ chapterId, positionSec, durationSec, completed: finalCompleted });
    if (!force && payload === lastProgressPayloadRef.current) return;

    lastProgressPayloadRef.current = payload;
    lastCheckpointAtRef.current = Date.now();
    completionSentRef.current = finalCompleted;

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive,
      });
      if (!response.ok) throw new Error("Nao foi possivel salvar o progresso.");
    } catch {
      if (lastProgressPayloadRef.current === payload) lastProgressPayloadRef.current = "";
      if (finalCompleted) completionSentRef.current = false;
    }
  }, [chapterId, duration, resolvedDuration, startOffset]);

  const getDownloadedAudioUrl = useCallback(async () => {
    const downloadedAudio = downloadedAudioRef.current;
    if (downloadedAudio?.source === src) return downloadedAudio.objectUrl;
    if (downloadPromiseRef.current) return downloadPromiseRef.current;

    setAudioDownload({ source: src, active: true, percent: 0 });
    setPlaybackError("");

    const downloadPromise = getEncryptedAudioUrl(chapterId, src, {
      accountScope,
      mode: "temporary",
      onProgress({ percent }) {
        setAudioDownload({ source: src, active: true, percent });
      },
    })
      .then((objectUrl) => {
        const currentDownload = downloadedAudioRef.current;
        if (currentDownload) URL.revokeObjectURL(currentDownload.objectUrl);
        downloadedAudioRef.current = { source: src, objectUrl };
        setAudioSource({ source: src, objectUrl });
        setAudioDownload({ source: src, active: false, percent: 100 });
        return objectUrl;
      })
      .catch((error) => {
        setAudioDownload({ source: src, active: false, percent: null });
        setPlaybackError("Nao foi possivel baixar o audio. Verifique a conexao e toque em play novamente.");
        throw error;
      })
      .finally(() => {
        downloadPromiseRef.current = null;
        setAudioDownload((current) => current?.source === src ? { ...current, active: false } : current);
      });

    downloadPromiseRef.current = downloadPromise;
    return downloadPromise;
  }, [accountScope, chapterId, src]);

  const waitForMetadata = useCallback((audio: HTMLAudioElement) => {
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("error", onError);
      };
      const onLoadedMetadata = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Nao foi possivel carregar os metadados do audio."));
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });
  }, []);

  const playDownloadedAudio = useCallback(async (position?: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const objectUrl = await getDownloadedAudioUrl();
      if (!audioRef.current) return;
      const activeAudio = audioRef.current;
      if (activeAudio.src !== objectUrl) {
        activeAudio.src = objectUrl;
        activeAudio.load();
      }
      await waitForMetadata(activeAudio);
      const currentRelativePosition = Math.max(0, activeAudio.currentTime - startOffset);
      const shouldReplayFromBeginning = activeAudio.ended || isPlaybackComplete(currentRelativePosition, progressDuration);
      const nextPosition =
        position ??
        (shouldReplayFromBeginning
          ? startOffset
          : activeAudio.currentTime < startOffset || (activeAudio.currentTime === 0 && (initialResumePosition > 0 || startOffset > 0))
            ? startOffset + initialResumePosition
            : activeAudio.currentTime);
      activeAudio.currentTime = nextPosition;
      setKaraokeMode(playMode === "karaoke");
      setPlaybackError("");
      activeAudio.playbackRate = playbackRate;
      activeAudio.volume = volume;
      activeAudio.muted = muted;
      desiredPlaybackRef.current = true;
      await activeAudio.play();
      setPlaying(true);
    } catch {
      desiredPlaybackRef.current = false;
      playbackActiveRef.current = false;
      setPlaying(false);
      setKaraokeMode(false);
      setPlaybackError((currentError) => currentError || PLAYBACK_CONNECTION_ERROR);
    }
  }, [getDownloadedAudioUrl, initialResumePosition, muted, playbackRate, playMode, progressDuration, startOffset, volume, waitForMetadata]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio || downloadingAudio) return;

    if (audio.paused) {
      void playDownloadedAudio();
    } else {
      desiredPlaybackRef.current = false;
      audio.pause();
      setPlaying(false);
      void saveProgress({ force: true });
    }
  }

  function decreaseKaraokeFont() {
    setKaraokeFontLevel((level) => Math.max(0, level - 1));
  }

  function increaseKaraokeFont() {
    setKaraokeFontLevel((level) => Math.min(5, level + 1));
  }

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextRelativeTime = Math.min(Math.max(Math.max(0, audio.currentTime - startOffset) + seconds, 0), progressDuration);
    audio.currentTime = startOffset + nextRelativeTime;
    setCurrent(nextRelativeTime);
  }, [progressDuration, startOffset]);

  const seekToAbsoluteTime = useCallback((startSec: number, autoplay = false) => {
    const audio = audioRef.current;
    const nextRelativeTime = Math.max(0, startSec - startOffset);
    pendingStartRef.current = startSec;
    shouldScrollActiveCueRef.current = true;
    if (audio) audio.currentTime = startSec;
    setCurrent(nextRelativeTime);

    if (!autoplay) return;
    void playDownloadedAudio(startSec);
  }, [playDownloadedAudio, startOffset]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let shouldAutoPlay = false;
    try {
      const storedTarget = window.sessionStorage.getItem(NEXT_CHAPTER_AUTOPLAY_KEY);
      if (storedTarget) {
        const targetUrl = new URL(storedTarget, window.location.href);
        const isTargetChapter = targetUrl.pathname === window.location.pathname;
        if (isTargetChapter) window.sessionStorage.removeItem(NEXT_CHAPTER_AUTOPLAY_KEY);
        shouldAutoPlay = isTargetChapter && autoPlayNextChapter;
      }
    } catch {
      try {
        window.sessionStorage.removeItem(NEXT_CHAPTER_AUTOPLAY_KEY);
      } catch {
        // Mantem a reproducao manual disponivel quando sessionStorage esta indisponivel.
      }
    }

    if (!shouldAutoPlay) return;

    const autoplayTimer = window.setTimeout(() => {
      void playDownloadedAudio();
    }, 0);

    return () => window.clearTimeout(autoplayTimer);
  }, [autoPlayNextChapter, chapterId, playDownloadedAudio]);

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
    updateSettings({ playbackRate: nextRate });
    if (audio) audio.playbackRate = nextRate;
  }

  function pauseIfNeededAtGroupedChapterEnd(audio: HTMLAudioElement) {
    if (!pauseAtChapterEnd || groupedChapterParts.length === 0) return;

    const absoluteCurrent = audio.currentTime;
    const activePart = groupedChapterParts.find((part) => absoluteCurrent >= part.startSec && absoluteCurrent < part.endSec);
    if (!activePart) return;
    if (activePart.endSec >= startOffset + progressDuration) return;
    if (absoluteCurrent < activePart.endSec - 0.25) return;

    desiredPlaybackRef.current = false;
    audio.pause();
    audio.currentTime = activePart.endSec;
    setPlaying(false);
    setKaraokeMode(false);
    setCurrent(Math.max(0, activePart.endSec - startOffset));
    void saveProgress({ force: true });
  }

  useEffect(() => {
    function saveBeforePageSuspends() {
      if (!playbackStartedRef.current) return;
      void saveProgress({ force: true, keepalive: true });
    }

    function saveOnVisibilityChange() {
      if (!playbackStartedRef.current) return;
      void saveProgress({ force: true, keepalive: document.visibilityState === "hidden" });
    }

    window.addEventListener("pagehide", saveBeforePageSuspends);
    document.addEventListener("visibilitychange", saveOnVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", saveBeforePageSuspends);
      document.removeEventListener("visibilitychange", saveOnVisibilityChange);
    };
  }, [saveProgress]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    if (typeof MediaMetadata !== "undefined") {
      mediaSession.metadata = new MediaMetadata({
        title: chapterTitle,
        artist: novelTitle,
        album: "Audio Novel BR",
        artwork: coverUrl ? [{ src: coverUrl }] : [],
      });
    }

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => {
        void playDownloadedAudio();
      }],
      ["pause", () => {
        desiredPlaybackRef.current = false;
        audioRef.current?.pause();
      }],
      ["seekbackward", (details) => seekBy(-(details.seekOffset ?? 10))],
      ["seekforward", (details) => seekBy(details.seekOffset ?? 10)],
    ];

    for (const [action, handler] of handlers) {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Alguns navegadores expõem Media Session sem oferecer todas as ações.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // Ignora ações não suportadas durante a limpeza.
        }
      }
      mediaSession.metadata = null;
    };
  }, [chapterTitle, coverUrl, novelTitle, playDownloadedAudio, seekBy]);

  return (
    <>
      <div id="chapter-player" className="grid gap-5 rounded-lg bg-[#06272b] p-4">
        <audio
          ref={audioRef}
          src={activeAudioSource || undefined}
          onLoadedMetadata={(event) => {
            const audioDuration = Math.max(0, event.currentTarget.duration - startOffset);
            setResolvedDuration(duration || audioDuration);
            if (pendingStartRef.current !== null) event.currentTarget.currentTime = pendingStartRef.current;
            else if (initialResumePosition > 0 || startOffset > 0) event.currentTarget.currentTime = startOffset + initialResumePosition;
            event.currentTarget.volume = volume;
            event.currentTarget.muted = muted;
            event.currentTarget.playbackRate = playbackRate;
            setPlaybackError("");
          }}
          onTimeUpdate={(event) => {
            const relativePosition = Math.max(0, event.currentTarget.currentTime - startOffset);
            const logicalDuration =
              resolvedDuration || duration || Math.max(0, event.currentTarget.duration - startOffset);
            setCurrent(relativePosition);
            pauseIfNeededAtGroupedChapterEnd(event.currentTarget);
            if (isPlaybackComplete(relativePosition, logicalDuration)) {
              if (!completionSentRef.current) {
                void saveProgress({ completed: true, force: true, keepalive: true });
              }
            } else if (shouldSaveCheckpoint(lastCheckpointAtRef.current, Date.now())) {
              void saveProgress();
            }
          }}
          onPlay={() => {
            playbackStartedRef.current = true;
            playbackActiveRef.current = true;
            desiredPlaybackRef.current = true;
            setPlaying(true);
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          }}
          onPause={() => {
            playbackActiveRef.current = false;
            setPlaying(false);
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
          }}
          onEnded={() => {
            desiredPlaybackRef.current = false;
            playbackActiveRef.current = false;
            setPlaying(false);
            setKaraokeMode(false);
            setCurrent(progressDuration);
            const progressSave = saveProgress({ completed: true, force: true, keepalive: true });
            if (autoPlayNextChapter && nextChapterHref) {
              try {
                window.sessionStorage.setItem(NEXT_CHAPTER_AUTOPLAY_KEY, nextChapterHref);
              } catch {
                // A navegacao continua mesmo se o navegador bloquear sessionStorage.
              }
              void progressSave.finally(() => {
                window.location.href = nextChapterHref;
              });
            }
          }}
          onError={(event) => {
            void event.currentTarget;
            desiredPlaybackRef.current = false;
            playbackActiveRef.current = false;
            setPlaying(false);
            setKaraokeMode(false);
            setPlaybackError(PLAYBACK_CONNECTION_ERROR);
          }}
        />

        {downloadingAudio ? (
          <div role="status" className="grid gap-2 rounded-md bg-black/30 p-3">
            <div className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>Baixando audio</span>
              <span>{downloadPercent === null ? "..." : `${downloadPercent}%`}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#18b7bd] transition-[width]" style={{ width: `${downloadPercent ?? 8}%` }} />
            </div>
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
              onClick={() => updateSettings({ playMode: "karaoke" })}
              disabled={playing && playMode === "page"}
              aria-disabled={playing && playMode === "page"}
              title={playing && playMode === "page" ? "Pause o audio antes de ativar o Karaoke." : undefined}
              className={`min-h-11 rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40 ${playMode === "karaoke" ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10"}`}
            >
              Karaoke
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ playMode: "page" })}
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
            disabled={downloadingAudio}
            aria-label={playing ? "Pausar capítulo" : "Reproduzir capítulo"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#18b7bd] text-[#021114] shadow-lg shadow-[#18b7bd]/20 disabled:cursor-wait disabled:opacity-70"
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
          <PlayerSettingsMenu
            playbackRate={playbackRate}
            pauseAtChapterEnd={pauseAtChapterEnd}
            autoPlayNextChapter={autoPlayNextChapter}
            onPlaybackRateChange={updatePlaybackRate}
            onPauseAtChapterEndChange={(value) => updateSettings({ pauseAtChapterEnd: value })}
            onAutoPlayNextChapterChange={(value) => updateSettings({ autoPlayNextChapter: value })}
            showPauseBetweenChapters={groupedChapterParts.length > 0}
            autoPlayNextChapterDisabled={!nextChapterHref}
          />
          <div className="w-full min-w-0 sm:flex-1">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#18b7bd]" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Ouvido até {formatTime(current)} de {formatTime(progressDuration)}
            </p>
          </div>
        </div>
        {playbackError ? <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-200">{playbackError}</p> : null}

        {playing && playMode === "page" ? (
          <div className="grid gap-3 rounded-md bg-black/30 p-3">
            <p className="text-sm font-bold text-zinc-200">Controle de volume</p>
            <KaraokeVolumeControl muted={muted} volume={volume} onMute={toggleMuted} onVolume={updateVolume} />
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
                  disabled={downloadingAudio}
                  aria-label={playing ? "Pausar capítulo" : "Reproduzir capítulo"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black disabled:cursor-wait disabled:opacity-70"
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
                <PlayerSettingsMenu
                  playbackRate={playbackRate}
                  pauseAtChapterEnd={pauseAtChapterEnd}
                  autoPlayNextChapter={autoPlayNextChapter}
                  onPlaybackRateChange={updatePlaybackRate}
                  onPauseAtChapterEndChange={(value) => updateSettings({ pauseAtChapterEnd: value })}
                  onAutoPlayNextChapterChange={(value) => updateSettings({ autoPlayNextChapter: value })}
                  showPauseBetweenChapters={groupedChapterParts.length > 0}
                  autoPlayNextChapterDisabled={!nextChapterHref}
                  placement="top"
                />
              </div>
              <div className="hidden grid-cols-[auto_84px_auto] items-center gap-2 lg:grid">
                <KaraokeFontControls onDecrease={decreaseKaraokeFont} onIncrease={increaseKaraokeFont} />
                <KaraokeVolumeControl muted={muted} volume={volume} onMute={toggleMuted} onVolume={updateVolume} compact />
                <PlayerSettingsMenu
                  playbackRate={playbackRate}
                  pauseAtChapterEnd={pauseAtChapterEnd}
                  autoPlayNextChapter={autoPlayNextChapter}
                  onPlaybackRateChange={updatePlaybackRate}
                  onPauseAtChapterEndChange={(value) => updateSettings({ pauseAtChapterEnd: value })}
                  onAutoPlayNextChapterChange={(value) => updateSettings({ autoPlayNextChapter: value })}
                  showPauseBetweenChapters={groupedChapterParts.length > 0}
                  autoPlayNextChapterDisabled={!nextChapterHref}
                  placement="top"
                />
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

function formatTime(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
