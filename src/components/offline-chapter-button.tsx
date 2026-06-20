"use client";

import { Download, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { getEncryptedAudioUrl, saveOfflineItem } from "@/lib/audio-cache";
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
  const [pending, startTransition] = useTransition();

  if (contentType === "YOUTUBE") {
    return (
      <button
        type="button"
        disabled
        title="Capitulo do YouTube indisponivel offline"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs font-bold text-zinc-500"
      >
        <XCircle size={16} /> Indisponivel offline
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

  function prepareOffline() {
    startTransition(async () => {
      setMessage("");
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

      await getEncryptedAudioUrl(chapterId, payload.audioUrl, { mode: "offline" });
      await saveOfflineItem({
        ...metadata,
        id: chapterId,
        cacheKey: payload.cacheKey,
        expiresAt: payload.expiresAt,
      });
      setReady(true);
      setMessage("Offline salvo.");
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
      {message && !ready ? <span className="max-w-40 text-right text-[11px] text-red-200">{message}</span> : null}
    </div>
  );
}
