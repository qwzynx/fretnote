import { transposeChord } from "./transpose";

export interface ChordShape {
  /**
   * Fret per string, ordered low-E (6th) -> high-e (1st).
   *  -1 = muted, 0 = open, n = fret pressed (absolute fret).
   */
  frets: [number, number, number, number, number, number];
  /** Lowest fret drawn in the diagram (for barre chords up the neck). */
  baseFret: number;
  /** Optional barre: fret + string span [from, to] in low->high index. */
  barre?: { fret: number; from: number; to: number };
}

// A compact library of common open and barre shapes.
const SHAPES: Record<string, ChordShape> = {
  C: { frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 },
  C7: { frets: [-1, 3, 2, 3, 1, 0], baseFret: 1 },
  Cadd9: { frets: [-1, 3, 2, 0, 3, 0], baseFret: 1 },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], baseFret: 3, barre: { fret: 3, from: 1, to: 5 } },
  D: { frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  Dmaj7: { frets: [-1, -1, 0, 2, 2, 2], baseFret: 1 },
  D7: { frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
  Dm7: { frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], baseFret: 1 },
  Dsus2: { frets: [-1, -1, 0, 2, 3, 0], baseFret: 1 },
  E: { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  Emaj7: { frets: [0, 2, 1, 1, 0, 0], baseFret: 1 },
  E7: { frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  Em: { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  Em7: { frets: [0, 2, 2, 0, 3, 0], baseFret: 1 },
  Esus4: { frets: [0, 2, 2, 2, 0, 0], baseFret: 1 },
  F: { frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  Fmaj7: { frets: [-1, -1, 3, 2, 1, 0], baseFret: 1 },
  "F#m": { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: { fret: 2, from: 0, to: 5 } },
  Fm: { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: { fret: 1, from: 0, to: 5 } },
  G: { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  Gmaj7: { frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
  G7: { frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  Gm: { frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: { fret: 3, from: 0, to: 5 } },
  "G/B": { frets: [-1, 2, 0, 0, 0, 3], baseFret: 1 },
  A: { frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  Amaj7: { frets: [-1, 0, 2, 1, 2, 0], baseFret: 1 },
  A7: { frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
  Am: { frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
  Asus2: { frets: [-1, 0, 2, 2, 0, 0], baseFret: 1 },
  Asus4: { frets: [-1, 0, 2, 2, 3, 0], baseFret: 1 },
  B: { frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  B7: { frets: [-1, 2, 1, 2, 0, 2], baseFret: 1 },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: { fret: 2, from: 1, to: 5 } },
  Bm7: { frets: [-1, 2, 0, 2, 0, 2], baseFret: 1 },
};

/**
 * Look up a chord diagram. If the exact name isn't known, we try to derive one
 * by transposing the nearest known shape of the same quality, so uncommon keys
 * still render something reasonable. Returns null if nothing fits.
 */
export function getChordShape(name: string): ChordShape | null {
  if (SHAPES[name]) return SHAPES[name];

  const match = name.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return null;
  const [, , quality] = match;

  // Find a known chord with the same quality, then transpose its shape.
  for (let semitones = 1; semitones <= 11; semitones++) {
    for (const knownName of Object.keys(SHAPES)) {
      const km = knownName.match(/^([A-G][#b]?)(.*)$/);
      if (!km || km[2] !== quality) continue;
      // Does transposing knownName by `semitones` produce our target?
      if (transposeChord(knownName, semitones) === name) {
        const base = SHAPES[knownName];
        return shiftShape(base, semitones);
      }
    }
  }
  return null;
}

function shiftShape(shape: ChordShape, semitones: number): ChordShape {
  const frets = shape.frets.map((f) =>
    f <= 0 ? f : f + semitones
  ) as ChordShape["frets"];
  const minPressed = Math.min(...frets.filter((f) => f > 0));
  return {
    frets,
    baseFret: minPressed > 3 ? minPressed : 1,
    barre: shape.barre
      ? { ...shape.barre, fret: shape.barre.fret + semitones }
      : undefined,
  };
}
