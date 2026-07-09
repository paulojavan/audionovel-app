"use client";

import { useCallback, useState } from "react";

export const AUDIO_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export type AudioPlayerSettings = {
  playbackRate: number;
  pauseAtChapterEnd: boolean;
  autoPlayNextChapter: boolean;
};

export const DEFAULT_AUDIO_PLAYER_SETTINGS: AudioPlayerSettings = {
  playbackRate: 1,
  pauseAtChapterEnd: false,
  autoPlayNextChapter: false,
};

const STORAGE_KEY = "audio-novel-player-settings-v1";

function normalizePlaybackRate(value: unknown) {
  const numericValue = Number(value);
  return AUDIO_SPEED_OPTIONS.some((rate) => rate === numericValue) ? numericValue : DEFAULT_AUDIO_PLAYER_SETTINGS.playbackRate;
}

function normalizeSettings(value: Partial<AudioPlayerSettings> | null | undefined): AudioPlayerSettings {
  return {
    playbackRate: normalizePlaybackRate(value?.playbackRate),
    pauseAtChapterEnd: value?.pauseAtChapterEnd === true,
    autoPlayNextChapter: value?.autoPlayNextChapter === true,
  };
}

function readAudioPlayerSettings() {
  if (typeof window === "undefined") return DEFAULT_AUDIO_PLAYER_SETTINGS;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return normalizeSettings(stored ? JSON.parse(stored) as Partial<AudioPlayerSettings> : null);
  } catch {
    return DEFAULT_AUDIO_PLAYER_SETTINGS;
  }
}

function writeAudioPlayerSettings(settings: AudioPlayerSettings) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Prefer keeping playback usable when browser storage is unavailable.
  }
}

export function useAudioPlayerSettings() {
  const [settings, setSettings] = useState<AudioPlayerSettings>(readAudioPlayerSettings);

  const updateSettings = useCallback((patch: Partial<AudioPlayerSettings>) => {
    setSettings((current) => {
      const nextSettings = normalizeSettings({ ...current, ...patch });
      writeAudioPlayerSettings(nextSettings);
      return nextSettings;
    });
  }, []);

  return { settings, updateSettings };
}
