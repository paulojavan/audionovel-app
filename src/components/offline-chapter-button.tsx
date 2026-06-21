"use client";

import { Download, PlaySquare, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useOfflineCryptoSupported } from "@/hooks/use-offline-crypto-supported";
import { getEncryptedAudioUrl, saveOfflineItem } from "@/lib/audio-cache";
import { OfflineCryptoUnavailableError, OFFLINE_CRYPTO_UNAVAILABLE_MESSAGE } from "@/lib/offline-crypto";
import type { OfflineItem } from "@/lib/offline-items";

type OfflineChapterButtonProps = {
  chapterId: string;
  contentType: string;
  canUseOffline: boolean;
  metadata: Omit<OfflineItem, "id" | "cacheKey" | "expiresAt">;
};

export function OfflineChapterButton({ chapterId, contentType, canUseOffline, metadata }: OfflineChapterButtonProps) {
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const offlineCryptoSupported = useOfflineCryptoSupported();

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
    startTransition(async () => {
      try {
        setMessage("");
        setDownloadProgress(null);
        const response = await fetch("/api/offline/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId }),
        });
        const payload = (await response.json().catch(() => ({}))) as { audioUrl?: string; cacheKey?: string; expiresAt?: string; error?: string };

        if (!response.ok || !payload.audioUrl || !payload.cacheKey || !payload.expiresAt) {
          setMessage(payload.error ?? "Nao foi possivel salvar offline.");
          return;
        }

        await getEncryptedAudioUrl(chapterId, payload.audioUrl, {
          mode: "offline",
          onProgress: (progress) => setDownloadProgress(progress.percent),
        });
        await saveOfflineItem({
          ...metadata,
          id: chapterId,
          cacheKey: payload.cacheKey,
          expiresAt: payload.expiresAt,
        });
        setReady(true);
        setDownloadProgress(100);
        setMessage("Offline salvo.");
      } catch (error) {
        setDownloadProgress(null);
        setMessage(error instanceof OfflineCryptoUnavailableError ? error.message : "Nao foi possivel salvar offline.");
      }
    });
  }

  return (
    <div className="grid justify-items-start gap-1 md:justify-items-end">
      <button
        type="button"
        onClick={prepareOffline}
        disabled={pending || ready}
        title={ready ? "Capitulo salvo offline" : "Ouvir offline"}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-red-500/90 px-3 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-60"
      >
        <Download size={16} /> {ready ? "Offline salvo" : "Ouvir offline"}
      </button>
      {pending ? (
        <div className="grid w-40 gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full bg-red-400 ${downloadProgress === null ? "w-1/2 animate-pulse" : ""}`} style={downloadProgress === null ? undefined : { width: `${downloadProgress}%` }} />
          </div>
          <span className="text-right text-[11px] text-zinc-300">{downloadProgress === null ? "Baixando..." : `${downloadProgress}%`}</span>
        </div>
      ) : null}
      {message && !ready ? <span className="max-w-40 text-right text-[11px] text-red-200">{message}</span> : null}
    </div>
  );
}
