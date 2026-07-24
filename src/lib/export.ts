import type { Note } from "@/lib/types";

export function noteToText(note: Note): string {
  const lines: string[] = [];

  lines.push(note.title);
  lines.push(note.artist);
  lines.push(
    `Key: ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${shiftKey(note.key, note.capo)})` : ""}`
  );
  if (note.difficulty) lines.push(`Difficulty: ${note.difficulty}`);
  if (note.tags.length > 0) lines.push(`Tags: ${note.tags.join(", ")}`);
  if (note.bpm) lines.push(`BPM: ${note.bpm}`);

  lines.push("");

  if (note.chordSheet) {
    lines.push(note.chordSheet);
  }

  if (note.tabBlocks?.length) {
    for (const block of note.tabBlocks) {
      if (block.label) lines.push(`\n── ${block.label} ──`);
      const strings = ["e", "B", "G", "D", "A", "E"];
      for (let s = 0; s < 6; s++) {
        const row = strings[s] + "|" + block.columns.map((col) => col[s] || "-").join("-") + "|";
        lines.push(row);
      }
    }
  }

  return lines.join("\n");
}

// Minimal semitone shift without importing the full transpose module
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function shiftKey(key: string, semitones: number): string {
  const idx = NOTES.indexOf(key);
  if (idx === -1) return key;
  return NOTES[(idx + semitones + 12) % 12];
}
