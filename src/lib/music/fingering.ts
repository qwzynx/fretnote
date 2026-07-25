import type { TabColumn } from "@/lib/types";
import type { ChordShape } from "./chords";

/** Left-hand finger: 1 = index, 2 = middle, 3 = ring, 4 = pinky. */
export type Finger = 1 | 2 | 3 | 4;

export const FINGER_LABELS: Record<Finger, string> = {
  1: "index",
  2: "middle",
  3: "ring",
  4: "pinky",
};

export const FINGERS: Finger[] = [1, 2, 3, 4];

/**
 * What one string does in a shape, ordered low-E (index 0) -> high-e, the same
 * indexing `ChordShape.frets`, `TabColumn` and `Tuning.names` use.
 * null = not played, -1 = muted, 0 = open, n = fretted at n.
 */
export type StringState = number | null;

export interface Fingering {
  /** Finger pressing each string, low-E first. 0 = no finger (open, muted, unplayed). */
  fingers: [number, number, number, number, number, number];
  /** Present when one finger covers several strings at the same fret. */
  barre?: { fret: number; from: number; to: number; finger: Finger };
  /** Fret the index finger sits at — the hand position. 0 when nothing is fretted. */
  position: number;
}

/** A fretted note, paired with the finger that presses it. */
export interface FingeredNote {
  /** String index, low-E first. */
  string: number;
  fret: number;
  finger: Finger;
}

const FRET_SPAN = 4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const emptyFingers = (): Fingering["fingers"] => [0, 0, 0, 0, 0, 0];

/**
 * Work out which finger presses which string.
 *
 * The hand can only reach four frets at once, so fingers follow the frets in
 * order: the lowest fret gets the lowest available finger and each note further
 * up the neck takes the next one. Two notes on the same fret still need two
 * fingers (a power chord's root and fifth are ring and pinky, not ring twice)
 * unless there are more notes than fingers, in which case the lowest fret is
 * barred.
 *
 * `anchor` is where the index finger already sits — pass it when the shape is
 * one moment inside a longer phrase, so a note on fret 7 played out of 5th
 * position gets the ring finger rather than the index.
 */
export function fingerShape(
  frets: readonly StringState[],
  opts: {
    barre?: { fret: number; from: number; to: number };
    anchor?: number;
  } = {}
): Fingering {
  const fingers = emptyFingers();
  const pressed: { string: number; fret: number }[] = [];

  frets.forEach((fret, string) => {
    if (fret !== null && fret > 0) pressed.push({ string, fret });
  });
  if (pressed.length === 0) return { fingers, position: 0 };

  const minFret = Math.min(...pressed.map((p) => p.fret));
  const maxFret = Math.max(...pressed.map((p) => p.fret));

  // Only trust the caller's position if the hand can actually reach this shape
  // from there; otherwise the hand has moved and this shape sets the position.
  const anchor =
    opts.anchor && opts.anchor <= minFret && maxFret - opts.anchor < FRET_SPAN
      ? opts.anchor
      : minFret;

  // A barre is either declared by the shape or forced on us by running out of
  // fingers, and covers every string it spans that sits on the barred fret.
  // Only the lowest fret of a shape can be barred — the finger underneath the
  // others is the one that lies flat.
  let barre = opts.barre?.fret === minFret ? opts.barre : undefined;
  if (!barre && pressed.length > FRET_SPAN) {
    const onMin = pressed.filter((p) => p.fret === minFret);
    if (onMin.length > 1) {
      barre = {
        fret: minFret,
        from: Math.min(...onMin.map((p) => p.string)),
        to: Math.max(...onMin.map((p) => p.string)),
      };
    }
  }

  const barred = (p: { string: number; fret: number }) =>
    !!barre && p.fret === barre.fret && p.string >= barre.from && p.string <= barre.to;

  const barredNotes = barre ? pressed.filter(barred) : [];
  const barreFinger = clamp(
    barre ? barre.fret - anchor + 1 : 1,
    1,
    FRET_SPAN
  ) as Finger;

  let lastFinger = 0;
  if (barredNotes.length > 0) {
    for (const p of barredNotes) fingers[p.string] = barreFinger;
    lastFinger = barreFinger;
  }

  // Low frets first, and low strings before high ones on a shared fret — that
  // is the order the fingers stack up in.
  const rest = pressed
    .filter((p) => !barredNotes.includes(p))
    .sort((a, b) => a.fret - b.fret || a.string - b.string);

  for (const p of rest) {
    const reach = clamp(p.fret - anchor + 1, 1, FRET_SPAN);
    const finger = clamp(Math.max(reach, lastFinger + 1), 1, FRET_SPAN);
    fingers[p.string] = finger;
    lastFinger = finger;
  }

  return {
    fingers,
    barre:
      barredNotes.length > 1 && barre
        ? {
            fret: barre.fret,
            from: Math.min(...barredNotes.map((p) => p.string)),
            to: Math.max(...barredNotes.map((p) => p.string)),
            finger: barreFinger,
          }
        : undefined,
    position: anchor,
  };
}

/** Fingering for a chord shape from the chord library. */
export function fingerChord(shape: ChordShape): Fingering {
  return fingerShape(shape.frets, { barre: shape.barre });
}

/** One tab column with the fingering needed to play it. */
export interface TabStep {
  /** Index of this column inside the block it came from. */
  column: number;
  /** Per-string state, low-E first. */
  frets: StringState[];
  fingering: Fingering;
}

/** Read one tab cell: "" untouched, "x" muted, digits a fret. */
export function parseTabCell(value: string): StringState {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (v === "x") return -1;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** True when the column asks the player to do something. */
export function columnIsPlayed(column: TabColumn): boolean {
  return column.some((cell) => parseTabCell(cell) !== null);
}

/**
 * Turn a tab block into the sequence of hand shapes needed to play it, one per
 * column that sounds.
 *
 * Fingering a run note by note would put the index finger on every note, so the
 * phrase is first cut into hand positions: consecutive notes stay in one
 * position for as long as the four fingers can cover all of them, and the
 * lowest fret of that stretch is where the index finger sits. A run of 5-7-8
 * then comes out as index-ring-pinky, and the position only shifts where the
 * hand really has to move.
 */
export function tabSteps(columns: readonly TabColumn[]): TabStep[] {
  const played = columns
    .map((column, index) => ({ column: index, frets: column.map(parseTabCell) }))
    .filter((step) => step.frets.some((f) => f !== null));

  const anchors = new Array<number>(played.length).fill(0);
  let start = 0;
  let low = Infinity;
  let high = -Infinity;

  const closePosition = (end: number) => {
    for (let k = start; k < end; k++) anchors[k] = Number.isFinite(low) ? low : 0;
  };

  for (let i = 0; i < played.length; i++) {
    const own = played[i].frets.filter((f): f is number => f !== null && f > 0);
    // Columns that only mute or ring open belong to whichever position they
    // fall inside; they never move the hand.
    if (own.length === 0) continue;

    const nextLow = Math.min(low, ...own);
    const nextHigh = Math.max(high, ...own);
    if (nextHigh - nextLow >= FRET_SPAN) {
      closePosition(i);
      start = i;
      low = Math.min(...own);
      high = Math.max(...own);
    } else {
      low = nextLow;
      high = nextHigh;
    }
  }
  closePosition(played.length);

  return played.map((step, i) => ({
    ...step,
    fingering: fingerShape(step.frets, { anchor: anchors[i] || undefined }),
  }));
}

/** The fretted notes of a shape, high-e string first to read like a tab. */
export function fingeredNotes(
  frets: readonly StringState[],
  fingering: Fingering
): FingeredNote[] {
  const notes: FingeredNote[] = [];
  for (let s = 5; s >= 0; s--) {
    const fret = frets[s];
    const finger = fingering.fingers[s];
    if (fret !== null && fret > 0 && finger > 0) {
      notes.push({ string: s, fret, finger: finger as Finger });
    }
  }
  return notes;
}
