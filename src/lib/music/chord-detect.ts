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

/** A string whose state the player hasn't decided yet — guessed open or muted. */
export const UNSET_FRET = -2;

type Frets = [number, number, number, number, number, number];

interface Scored {
  name: string | null;
  score: number;
}

/**
 * Score one fully-resolved fretting (-1=muted, 0=open, n=fret; no UNSET_FRET
 * left) against every chord formula, the same way the module doc describes.
 */
function scoreFrets(frets: Frets, tuning: Tuning): Scored {
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
      // Handle explicit power chords (root + fifth). Ranked below any real
      // triad+ match so a guessable full chord always wins over settling for
      // the bare two notes.
      for (let root = 0; root < 12; root++) {
        if (played.has(root) && played.has((root + 7) % 12)) {
          return { name: NOTE_NAMES[root === bassPc ? root : bassPc] + "5", score: -10 };
        }
      }
    }
    return { name: null, score: -Infinity };
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

  return { name: bestName, score: bestScore };
}

/**
 * Given 6 fret values (-1=muted, 0=open, n=fret, UNSET_FRET=not decided yet)
 * and a tuning, return the best-matching chord name or null if nothing fits.
 *
 * Strings left at UNSET_FRET aren't assumed muted: every open/muted
 * combination for them is tried, and whichever combination produces the
 * best-scoring chord (see `scoreFrets`) wins — so fretting just the notes of
 * Em (022000, with the open strings left untouched) is enough to guess "Em"
 * without the player also having to mark every open string by hand. Ties
 * prefer guessing fewer strings open. A player who wants a specific string
 * muted can still say so explicitly, which removes it from the guessing.
 */
export function detectChord(frets: Frets, tuning: Tuning): string | null {
  // Nothing fretted yet — there's nothing to guess a chord from.
  if (!frets.some((f) => f > 0)) return null;

  const unsetIdx: number[] = [];
  frets.forEach((f, i) => {
    if (f === UNSET_FRET) unsetIdx.push(i);
  });

  if (unsetIdx.length === 0) {
    return scoreFrets(frets, tuning).name;
  }

  let bestName: string | null = null;
  let bestScore = -Infinity;
  let bestGuesses = Infinity;

  const combos = 1 << unsetIdx.length;
  for (let mask = 0; mask < combos; mask++) {
    const resolved = [...frets] as Frets;
    let guesses = 0;
    unsetIdx.forEach((idx, bit) => {
      const open = (mask & (1 << bit)) !== 0;
      resolved[idx] = open ? 0 : -1;
      if (open) guesses++;
    });

    const { name, score } = scoreFrets(resolved, tuning);
    if (name === null) continue;
    if (score > bestScore || (score === bestScore && guesses < bestGuesses)) {
      bestScore = score;
      bestGuesses = guesses;
      bestName = name;
    }
  }

  return bestName;
}
