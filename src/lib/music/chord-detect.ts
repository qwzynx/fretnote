import type { Tuning } from "./tunings";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

const QUALITIES: Record<string, number[]> = {
  "":     [0, 4, 7],
  "m":    [0, 3, 7],
  "7":    [0, 4, 7, 10],
  "maj7": [0, 4, 7, 11],
  "m7":   [0, 3, 7, 10],
  "sus2": [0, 2, 7],
  "sus4": [0, 5, 7],
  "dim":  [0, 3, 6],
  "aug":  [0, 4, 8],
  "add9": [0, 2, 4, 7],
  "5":    [0, 7],
};

/**
 * Given 6 fret values (-1=muted, 0=open, n=fret) and a tuning, return the
 * best-matching chord name or null if fewer than 2 strings are sounding.
 */
export function detectChord(
  frets: [number, number, number, number, number, number],
  tuning: Tuning
): string | null {
  const played = new Set<number>();
  let lowestMidi = Infinity;
  let lowestPitchClass = 0;

  for (let s = 0; s < 6; s++) {
    if (frets[s] < 0) continue;
    const midi = tuning.midi[s] + frets[s];
    const pc = midi % 12;
    played.add(pc);
    if (midi < lowestMidi) {
      lowestMidi = midi;
      lowestPitchClass = pc;
    }
  }

  if (played.size < 2) return null;

  let bestName: string | null = null;
  let bestScore = -1;

  for (let root = 0; root < 12; root++) {
    for (const [quality, intervals] of Object.entries(QUALITIES)) {
      const formula = new Set(intervals.map((i) => (root + i) % 12));

      // All formula notes must be present in played set.
      const covered = [...formula].filter((n) => played.has(n)).length;
      if (covered < formula.size) continue;

      // Primary score: prefer larger (more specific) formulas.
      // Secondary: bonus if root is the lowest-sounding note.
      const score = formula.size * 10 + (root === lowestPitchClass ? 5 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestName = NOTE_NAMES[root] + quality;
      }
    }
  }

  return bestName;
}
