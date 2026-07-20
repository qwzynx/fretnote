const SHARP_SCALE = [
  "A",
  "A#",
  "B",
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
];

const FLAT_SCALE = [
  "A",
  "Bb",
  "B",
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
];

const NOTE_TO_INDEX: Record<string, number> = {
  A: 0,
  "A#": 1,
  Bb: 1,
  B: 2,
  Cb: 2,
  C: 3,
  "B#": 3,
  "C#": 4,
  Db: 4,
  D: 5,
  "D#": 6,
  Eb: 6,
  E: 7,
  Fb: 7,
  F: 8,
  "E#": 8,
  "F#": 9,
  Gb: 9,
  G: 10,
  "G#": 11,
  Ab: 11,
};

// Root note followed by the rest of the chord quality (m, 7, sus4, maj7, ...)
const CHORD_RE = /^([A-G][#b]?)(.*)$/;

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

function transposeNote(
  note: string,
  semitones: number,
  preferFlat: boolean
): string {
  const index = NOTE_TO_INDEX[note];
  if (index === undefined) return note;
  const scale = preferFlat ? FLAT_SCALE : SHARP_SCALE;
  return scale[mod12(index + semitones)];
}

/**
 * Transpose a single chord symbol by a number of semitones, preserving the
 * quality and any slash bass note. Returns the input unchanged if it does not
 * look like a chord.
 */
export function transposeChord(
  chord: string,
  semitones: number,
  preferFlat = false
): string {
  if (!chord || semitones === 0) return chord;

  const [main, bass] = chord.split("/");
  const match = main.match(CHORD_RE);
  if (!match) return chord;

  const [, root, quality] = match;
  let result = transposeNote(root, semitones, preferFlat) + quality;

  if (bass !== undefined) {
    const bassMatch = bass.match(CHORD_RE);
    if (bassMatch) {
      const [, bassRoot, bassQuality] = bassMatch;
      result +=
        "/" + transposeNote(bassRoot, semitones, preferFlat) + bassQuality;
    } else {
      result += "/" + bass;
    }
  }

  return result;
}

/** Transpose a musical key label (e.g. "Am", "C", "F#m"). */
export function transposeKey(key: string, semitones: number): string {
  return transposeChord(key, semitones);
}

/**
 * Transpose every inline [Chord] marker in a chord sheet by `semitones`.
 * Lyrics between markers are left untouched.
 */
export function transposeChordSheet(sheet: string, semitones: number): string {
  if (semitones === 0) return sheet;
  return sheet.replace(/\[([^\]]+)\]/g, (_, chord: string) => {
    return `[${transposeChord(chord.trim(), semitones)}]`;
  });
}

/** Format a signed semitone offset for display, e.g. +2 / -1 / 0. */
export function formatSemitones(semitones: number): string {
  if (semitones === 0) return "0";
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}
