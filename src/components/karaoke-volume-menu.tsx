"use client";

import { Volume2, VolumeX } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const PANEL_GAP = 8;
const PANEL_MARGIN = 8;
const PANEL_WIDTH = 240;

export function KaraokeVolumeMenu({
  muted,
  volume,
  onVolume,
  placement = "top",
}: {
  muted: boolean;
  volume: number;
  onVolume: (volume: number) => void;
  placement?: "top" | "bottom";
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<CSSProperties | null>(null);
  const displayedVolume = muted ? 0 : volume;

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const width = Math.max(
      0,
      Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2),
    );
    const left = Math.min(
      Math.max(PANEL_MARGIN, rect.left + rect.width / 2 - width / 2),
      Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN),
    );
    const verticalPosition =
      placement === "top"
        ? { bottom: `${Math.max(PANEL_MARGIN, window.innerHeight - rect.top + PANEL_GAP)}px` }
        : { top: `${Math.min(window.innerHeight - PANEL_MARGIN, rect.bottom + PANEL_GAP)}px` };

    setPanelPosition({
      position: "fixed",
      left: `${left}px`,
      width: `${width}px`,
      ...verticalPosition,
    });
  }, [placement]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePanelPosition]);

  const panel = open && panelPosition && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className="z-[80] rounded-md border border-white/10 bg-[#031316] p-4 text-left shadow-2xl shadow-black/40"
          style={panelPosition}
        >
          <label className="grid gap-3 text-sm font-bold text-zinc-200">
            <span>Volume {Math.round(displayedVolume * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={displayedVolume}
              onChange={(event) => onVolume(Number(event.target.value))}
              className="w-full accent-[#18b7bd]"
              aria-label="Volume do karaoke"
            />
          </label>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) updatePanelPosition();
          setOpen((value) => !value);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Controle de volume do karaoke"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      {panel}
    </div>
  );
}
