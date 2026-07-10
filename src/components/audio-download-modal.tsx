"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function AudioDownloadModal({
  open,
  percent,
}: {
  open: boolean;
  percent: number | null;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const normalizedPercent = percent === null
    ? null
    : Math.min(100, Math.max(0, Math.round(percent)));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-download-title"
      aria-describedby="audio-download-description"
    >
      <div className="grid w-full max-w-xs justify-items-center gap-5 rounded-2xl border border-white/10 bg-[#031316] p-7 text-center shadow-2xl shadow-black/60">
        <div className="relative grid h-28 w-28 place-items-center" aria-hidden="true">
          <div className="absolute inset-0 animate-spin rounded-full border-[7px] border-white/15 border-t-[#18b7bd]" />
          <span className="relative text-xl font-black text-white">
            {percent === null ? "..." : `${normalizedPercent}%`}
          </span>
        </div>
        <div className="grid gap-2">
          <h2 id="audio-download-title" className="text-xl font-black text-white">
            Baixando audio
          </h2>
          <p id="audio-download-description" className="text-sm leading-6 text-zinc-400">
            Aguarde enquanto preparamos o capitulo para reproduzir sem interrupcoes.
          </p>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {normalizedPercent === null
              ? "Download em andamento"
              : `Download em ${normalizedPercent}%`}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
