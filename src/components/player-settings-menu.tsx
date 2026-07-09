"use client";

import { Settings } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AUDIO_SPEED_OPTIONS, type AudioPlayerSettings } from "@/hooks/use-audio-player-settings";

type PlayerSettingsMenuProps = AudioPlayerSettings & {
  onPlaybackRateChange: (rate: number) => void;
  onPauseAtChapterEndChange: (value: boolean) => void;
  onAutoPlayNextChapterChange: (value: boolean) => void;
  showPauseBetweenChapters?: boolean;
  autoPlayNextChapterDisabled?: boolean;
  placement?: "bottom" | "top";
};

const MENU_GAP = 8;
const MENU_MARGIN = 8;
const MENU_MAX_WIDTH = 320;

export function PlayerSettingsMenu({
  playbackRate,
  pauseAtChapterEnd,
  autoPlayNextChapter,
  onPlaybackRateChange,
  onPauseAtChapterEndChange,
  onAutoPlayNextChapterChange,
  showPauseBetweenChapters = false,
  autoPlayNextChapterDisabled = false,
  placement = "bottom",
}: PlayerSettingsMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<CSSProperties | null>(null);

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const width = Math.max(0, Math.min(MENU_MAX_WIDTH, window.innerWidth - MENU_MARGIN * 2));
    const left = Math.min(
      Math.max(MENU_MARGIN, rect.right - width),
      Math.max(MENU_MARGIN, window.innerWidth - width - MENU_MARGIN),
    );
    const verticalPosition =
      placement === "top"
        ? { bottom: `${Math.max(MENU_MARGIN, window.innerHeight - rect.top + MENU_GAP)}px` }
        : { top: `${Math.min(window.innerHeight - MENU_MARGIN, rect.bottom + MENU_GAP)}px` };

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
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  function toggleMenu() {
    if (!open) updatePanelPosition();
    setOpen((value) => !value);
  }

  const menuPanel = open && panelPosition && typeof document !== "undefined"
    ? createPortal(
        <div
          className="z-[80] grid gap-4 rounded-md border border-white/10 bg-[#031316] p-4 text-left shadow-2xl shadow-black/40"
          style={panelPosition}
        >
          <label className="grid gap-2 text-sm font-bold text-zinc-200">
            <span>Velocidade</span>
            <select
              value={playbackRate}
              onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
              className="min-h-11 rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
            >
              {AUDIO_SPEED_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </label>

          {showPauseBetweenChapters ? (
            <PlayerSettingsSwitch
              label="Pausar entre capitulos"
              checked={pauseAtChapterEnd}
              onChange={onPauseAtChapterEndChange}
            />
          ) : null}

          <PlayerSettingsSwitch
            label="Reproduzir proximo capitulo automaticamente"
            checked={autoPlayNextChapter}
            onChange={onAutoPlayNextChapterChange}
            disabled={autoPlayNextChapterDisabled}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Configuracoes do player"
        aria-expanded={open}
      >
        <Settings size={20} />
      </button>
      {menuPanel}
    </div>
  );
}

function PlayerSettingsSwitch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-left text-sm font-bold text-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span>{label}</span>
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${checked ? "justify-end bg-[#18b7bd]" : "justify-start bg-white/15"}`}>
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}
