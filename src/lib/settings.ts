import type { Difficulty } from "@/lib/types";

export interface Settings {
  defaultKey: string;
  defaultCapo: number;
  defaultDifficulty: Difficulty;
  defaultTuning: string;
  defaultScrollSpeed: number;
  defaultFontSize: number;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultKey: "C",
  defaultCapo: 0,
  defaultDifficulty: "beginner",
  defaultTuning: "standard",
  defaultScrollSpeed: 30,
  defaultFontSize: 16,
};

const STORAGE_KEY = "fretnote_settings";

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
