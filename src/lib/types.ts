export type NoteType = "chords" | "tab";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Author {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
}

/**
 * A single column of a 6-string tab. Strings are ordered high-e -> low-E
 * to match how tabs are conventionally written (top line = high e).
 * A value is a fret number as a string, "" for an untouched string.
 */
export type TabColumn = [string, string, string, string, string, string];

/**
 * A labeled tab fragment. A song rarely tabs out end to end — instead it has
 * pieces (an intro riff, a solo, a turnaround) that start and stop wherever
 * they occur. A note can carry several of these; the label says where the
 * fragment belongs, e.g. "Intro" or "Solo".
 */
export interface TabBlock {
  id: string;
  label: string;
  columns: TabColumn[];
}

export interface Note {
  id: string;
  slug: string;
  type: NoteType;
  title: string;
  artist: string;
  author: Author;
  key: string;
  capo: number;
  difficulty: Difficulty;
  tags: string[];
  likes: number;
  saves: number;
  createdAt: string; // ISO date
  /**
   * Chord-over-lyrics body using inline bracket notation, e.g.
   * "[Am]Today is [C]gonna be the [D]day". Present for type === "chords".
   */
  chordSheet?: string;
  /**
   * Tab body as columns of 6 strings. Present for type === "tab".
   */
  tab?: TabColumn[];
  /** Chord names referenced by the note, used to render diagrams. */
  chords: string[];
}

/** The 6 open guitar strings, low-E (6th) to high-e (1st). */
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const;

/** Tab display order: high-e on top down to low-E. */
export const TAB_STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
