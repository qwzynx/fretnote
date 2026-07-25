import type { Note } from "@/lib/types";
import { TAB_STRING_LABELS } from "@/lib/types";

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
      // Columns are stored low-E first, but a tab reads high-e on the top line.
      TAB_STRING_LABELS.forEach((label, row) => {
        const string = 5 - row;
        const frets = block.columns.map((col) => col[string] || "-").join("-");
        lines.push(`${label}|${frets}|`);
      });
      if (block.hint) {
        const shape = block.hint.shape ? `${block.hint.shape} shape` : "hand shape";
        const grip = block.hint.frets
          .map((f, s) => `${TAB_STRING_LABELS[5 - s]}${f < 0 ? "x" : f}`)
          .join(" ");
        lines.push(`Fingering: hold a ${shape} — ${grip}`);
        if (block.hint.note) lines.push(`  ${block.hint.note}`);
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
