import type { Tuning } from "./tunings";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

// Ordered so that, on a tie, earlier (simpler) qualities win.
const QUALITIES: [string, number[]][] = [
  ["", [0, 4, 7]],
  ["m", [0, 3, 7]],
  ["7", [0, 4, 7, 10]],
  ["maj7", [0, 4, 7, 11]],
  ["m7", [0, 3, 7, 10]],
  ["sus2", [0, 2, 7]],
  ["sus4", [0, 5, 7]],
  ["dim", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["add9", [0, 2, 4, 7]],
  ["6", [0, 4, 7, 9]],
  ["m6", [0, 3, 7, 9]],
  ["9", [0, 2, 4, 7, 10]],
  ["5", [0, 7]],
];

export interface ChordMatch {
  name: string;
  /** Pitch class of the chord root. */
  root: number;
}

/**
 * Given 6 fret values (-1=muted, 0=open, n=fret) and a tuning, return the
 * best-matching chord name or null if fewer than 3 distinct pitches sound.
 *
 * Scoring: every note the player sounds should be explained by the chord
 * (extra notes are penalised heavily), and every note the chord names should
 * be present. Among candidates that fit, the simplest formula wins, with a
 * bonus when the chord root is also the lowest-sounding (bass) note.
 */
export function detectChord(
  frets: [number, number, number, number, number, number],
  tuning: Tuning
): string | null {
  const played = new Set<number>();
  let lowestMidi = Infinity;
  let bassPc = -1;

  for (let s = 0; s < 6; s++) {
    if (frets[s] < 0) continue;
    const midi = tuning.midi[s] + frets[s];
    played.add(midi % 12);
    if (midi < lowestMidi) {
      lowestMidi = midi;
      bassPc = midi % 12;
    }
  }

  // Two notes can only ever be a power chord; require a real triad+.
  if (played.size < 3) {
    if (played.size === 2) {
      // Handle explicit power chords (root + fifth).
      for (let root = 0; root < 12; root++) {
        if (played.has(root) && played.has((root + 7) % 12) && played.size === 2) {
          return NOTE_NAMES[root === bassPc ? root : bassPc] + "5";
        }
      }
    }
    return null;
  }

  let bestName: string | null = null;
  let bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    for (const [quality, intervals] of QUALITIES) {
      const formula = intervals.map((i) => (root + i) % 12);
      const formulaSet = new Set(formula);

      // Guitarists routinely drop the perfect 5th, so treat it as optional for
      // any chord that has a 3rd (power chords keep the 5th mandatory).
      const hasThird = intervals.includes(3) || intervals.includes(4);
      const required = intervals
        .filter((i) => !(hasThird && i === 7))
        .map((i) => (root + i) % 12);

      // Every required chord tone must actually be played.
      const allPresent = required.every((n) => played.has(n));
      if (!allPresent) continue;

      // Notes the player sounds that the chord doesn't name are "extra".
      let extra = 0;
      for (const pc of played) if (!formulaSet.has(pc)) extra++;

      // Higher is better: reward coverage, punish extras and complexity,
      // strongly prefer the root to be the bass note.
      const score =
        -extra * 20 - formulaSet.size + (root === bassPc ? 10 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestName = NOTE_NAMES[root] + quality;
      }
    }
  }

  return bestName;
}
