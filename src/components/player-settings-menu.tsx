"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { AUDIO_SPEED_OPTIONS, type AudioPlayerSettings } from "@/hooks/use-audio-player-settings";

type PlayerSettingsMenuProps = AudioPlayerSettings & {
  onPlaybackRateChange: (rate: number) => void;
  onPauseAtChapterEndChange: (value: boolean) => void;
  onAutoPlayNextChapterChange: (value: boolean) => void;
  showPauseBetweenChapters?: boolean;
  autoPlayNextChapterDisabled?: boolean;
  placement?: "bottom" | "top";
};

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
  const [open, setOpen] = useState(false);
  const panelPosition = placement === "top" ? "bottom-full mb-2" : "mt-2";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Configuracoes do player"
        aria-expanded={open}
      >
        <Settings size={20} />
      </button>
      {open ? (
        <div className={`absolute right-0 z-30 grid w-[min(86vw,320px)] gap-4 rounded-md border border-white/10 bg-[#031316] p-4 text-left shadow-2xl shadow-black/40 ${panelPosition}`}>
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
        </div>
      ) : null}
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
