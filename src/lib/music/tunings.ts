export interface Tuning {
  id: string;
  label: string;
  /** Open string MIDI note numbers, low-E (index 0) to high-e (index 5). */
  midi: readonly [number, number, number, number, number, number];
  /** Display labels for each string, low-E (index 0) to high-e (index 5). */
  names: readonly [string, string, string, string, string, string];
}

export const TUNINGS: Tuning[] = [
  {
    id: "standard",
    label: "Standard (EADGBe)",
    midi: [40, 45, 50, 55, 59, 64],
    names: ["E", "A", "D", "G", "B", "e"],
  },
  {
    id: "drop-d",
    label: "Drop D (DADGBe)",
    midi: [38, 45, 50, 55, 59, 64],
    names: ["D", "A", "D", "G", "B", "e"],
  },
  {
    id: "half-down",
    label: "Half Step Down (Eb Ab Db Gb Bb eb)",
    midi: [39, 44, 49, 54, 58, 63],
    names: ["Eb", "Ab", "Db", "Gb", "Bb", "eb"],
  },
  {
    id: "full-down",
    label: "Full Step Down (DGCFAd)",
    midi: [38, 43, 48, 53, 57, 62],
    names: ["D", "G", "C", "F", "A", "d"],
  },
  {
    id: "open-g",
    label: "Open G (DGDGBd)",
    midi: [38, 43, 50, 55, 59, 62],
    names: ["D", "G", "D", "G", "B", "d"],
  },
  {
    id: "dadgad",
    label: "DADGAD",
    midi: [38, 45, 50, 55, 57, 62],
    names: ["D", "A", "D", "G", "A", "d"],
  },
  {
    id: "open-e",
    label: "Open E (EBE G#Be)",
    midi: [40, 47, 52, 56, 59, 64],
    names: ["E", "B", "E", "G#", "B", "e"],
  },
  {
    id: "open-d",
    label: "Open D (DAD F#Ad)",
    midi: [38, 45, 50, 53, 57, 62],
    names: ["D", "A", "D", "F#", "A", "d"],
  },
];

export const DEFAULT_TUNING = TUNINGS[0];
