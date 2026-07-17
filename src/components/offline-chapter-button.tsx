"use client";

import { Download, PlaySquare, XCircle } from "lucide-react";
import { useState } from "react";
import { useOfflineCryptoSupported } from "@/hooks/use-offline-crypto-supported";
import { getEncryptedAudioUrl, hasValidEncryptedAudio, saveOfflineItem } from "@/lib/audio-cache";
import { enqueueOfflineDownload, type OfflineDownloadQueueStatus } from "@/lib/offline-download-queue";
import { OfflineCryptoUnavailableError, OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE } from "@/lib/offline-crypto";
import type { OfflineItem } from "@/lib/offline-items";
import { prepareOfflinePage } from "@/lib/pwa-offline";

type OfflineChapterButtonProps = {
  accountScope: string;
  chapterId: string;
  contentType: string;
  canUseOffline: boolean;
  initialSaved?: boolean;
  checkingInitialSaved?: boolean;
  onSaved?: (chapterId: string, audioRevision: number) => void;
  metadata: Omit<OfflineItem, "id" | "audioRevision" | "cacheKey" | "expiresAt"> & {
    audioRevision: number;
  };
};

type OfflinePreparePayload = {
  audioUrl: string;
  audioRevision: number;
  cacheKey: string;
  expiresAt: string;
};

export function OfflineChapterButton({ accountScope, chapterId, contentType, canUseOffline, initialSaved = false, checkingInitialSaved = false, onSaved, metadata }: OfflineChapterButtonProps) {
  const [message, setMessage] = useState("");
  const savedStateKey = `${accountScope}:${chapterId}:${metadata.audioRevision}`;
  const [readyState, setReadyState] = useState({ key: savedStateKey, saved: false });
  const [audioSavedState, setAudioSavedState] = useState({ key: savedStateKey, saved: false, audioRevision: metadata.audioRevision });
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [queueStatus, setQueueStatus] = useState<OfflineDownloadQueueStatus | null>(null);
  const offlineCryptoSupported = useOfflineCryptoSupported();
  const ready = initialSaved || (readyState.key === savedStateKey && readyState.saved);
  const audioSaved = audioSavedState.key === savedStateKey && audioSavedState.saved;

  function markReady(audioRevision: number) {
    setReadyState({ key: savedStateKey, saved: true });
    onSaved?.(chapterId, audioRevision);
  }

  function markAudioSaved(audioRevision: number) {
    setAudioSavedState({ key: savedStateKey, saved: true, audioRevision });
  }

  if (contentType === "YOUTUBE") {
    return (
      <button
        type="button"
        disabled
        title="Video do YouTube"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-85"
      >
        <PlaySquare size={16} /> Video do youtube
      </button>
    );
  }

  if (!canUseOffline) {
    return (
      <button
        type="button"
        disabled
        title="Offline disponivel apenas para usuarios premium"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-bold text-zinc-500"
      >
        <XCircle size={16} /> Premium offline
      </button>
    );
  }

  if (!offlineCryptoSupported) {
    return (
      <div className="grid justify-items-start gap-1 md:justify-items-end">
        <button
          type="button"
          disabled
          title={OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-bold text-zinc-500"
        >
          <XCircle size={16} /> Offline indisponivel
        </button>
        <span className="max-w-44 text-right text-[11px] text-red-200">{OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE}</span>
      </div>
    );
  }

  function prepareOffline() {
    if (pending || ready) return;

    const prepareSavedPage = async (audioRevision: number) => {
      await prepareOfflinePage(accountScope);
      markReady(audioRevision);
      setDownloadProgress(100);
      setMessage("Offline salvo.");
    };
    const showShellPreparationError = () => {
      setMessage("Audio salvo, mas a pagina offline ainda nao ficou pronta. Toque novamente para tentar.");
    };
    const prepareOfflineMetadata = async (): Promise<OfflinePreparePayload | null> => {
      const response = await fetch("/api/offline/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { audioUrl?: string; audioRevision?: number; cacheKey?: string; expiresAt?: string; error?: string };

      if (!response.ok || !payload.audioUrl || !Number.isInteger(payload.audioRevision) || !payload.cacheKey || !payload.expiresAt) {
        setMessage(payload.error ?? "Nao foi possivel salvar offline.");
        return null;
      }

      return {
        audioUrl: payload.audioUrl,
        audioRevision: payload.audioRevision as number,
        cacheKey: payload.cacheKey,
        expiresAt: payload.expiresAt,
      };
    };
    const savePreparedOfflineMetadata = async (payload: OfflinePreparePayload) => {
      await saveOfflineItem(accountScope, {
        ...metadata,
        id: chapterId,
        audioRevision: payload.audioRevision,
        cacheKey: payload.cacheKey,
        expiresAt: payload.expiresAt,
      });
      markAudioSaved(payload.audioRevision);
      setDownloadProgress(100);
    };

    if (audioSaved) {
      setPending(true);
      setMessage("");
      setDownloadProgress(null);
      void prepareSavedPage(audioSavedState.audioRevision)
        .catch(showShellPreparationError)
        .finally(() => setPending(false));
      return;
    }

    setPending(true);
    setQueueStatus(null);
    setMessage("");
    setDownloadProgress(null);

    void hasValidEncryptedAudio(
      accountScope,
      chapterId,
      "offline",
      metadata.audioRevision,
    )
      .then(async (hasOfflineAudio) => {
        if (hasOfflineAudio) {
          const payload = await prepareOfflineMetadata();
          if (!payload) return;

          await savePreparedOfflineMetadata(payload);
          try {
            await prepareSavedPage(payload.audioRevision);
          } catch {
            showShellPreparationError();
          }
          return;
        }

        await enqueueOfflineDownload(async () => {
          const payload = await prepareOfflineMetadata();
          if (!payload) return;

          await getEncryptedAudioUrl(chapterId, payload.audioUrl, {
            accountScope,
            mode: "offline",
            audioRevision: payload.audioRevision,
            expiresAt: payload.expiresAt,
            onProgress: (progress) => setDownloadProgress(progress.percent),
          });
          await savePreparedOfflineMetadata(payload);

          try {
            await prepareSavedPage(payload.audioRevision);
          } catch {
            showShellPreparationError();
          }
        }, setQueueStatus);
      })
      .catch((error) => {
        setDownloadProgress(null);
        setMessage(error instanceof OfflineCryptoUnavailableError ? error.message : "Nao foi possivel salvar offline.");
      })
      .finally(() => {
        setQueueStatus(null);
        setPending(false);
      });
  }

  const queued = pending && queueStatus?.state === "queued";
  const busyLabel = queued
    ? `Na fila (${queueStatus.position})`
    : audioSaved
      ? "Preparando..."
      : "Baixando...";
  const buttonLabel = checkingInitialSaved ? "Verificando..." : ready ? "Salvo" : pending ? busyLabel : audioSaved ? "Preparar offline" : "Ouvir offline";

  return (
    <div className="grid justify-items-start gap-1 md:justify-items-end">
      <button
        type="button"
        onClick={prepareOffline}
        disabled={pending || ready || checkingInitialSaved}
        title={checkingInitialSaved ? "Verificando capitulos salvos" : ready ? "Capitulo salvo offline" : audioSaved ? "Preparar pagina offline" : "Ouvir offline"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-xs font-black disabled:cursor-not-allowed ${
          ready || checkingInitialSaved
            ? "bg-white/10 text-zinc-300"
            : "bg-red-500/90 text-white hover:bg-red-500 disabled:opacity-60"
        }`}
      >
        <Download size={16} /> {buttonLabel}
      </button>
      {pending ? (
        <div className="grid w-40 gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full bg-red-400 ${downloadProgress === null ? "w-1/2 animate-pulse" : ""}`} style={downloadProgress === null ? undefined : { width: `${downloadProgress}%` }} />
          </div>
          <span className="text-right text-[11px] text-zinc-300">
            {queued ? `Aguardando download ${queueStatus.position}` : audioSaved ? "Preparando..." : downloadProgress === null ? "Baixando..." : `${downloadProgress}%`}
          </span>
        </div>
      ) : null}
      {message && !ready ? <span className="max-w-40 text-right text-[11px] text-red-200">{message}</span> : null}
    </div>
  );
}
