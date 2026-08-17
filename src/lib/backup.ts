import { listNotes, getNote, upsertNote } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import {
  listSetlists,
  listAllSetlistItems,
  upsertSetlist,
  upsertSetlistItem,
  type SetlistItemInput,
} from "@/lib/setlists";
import { sanitizeFilename } from "@/lib/export";
import type { Note, Setlist } from "@/lib/types";

const BACKUP_VERSION = 1;

interface LibraryBackup {
  version: number;
  // Older library files (from before per-note export existed) don't carry
  // this field — isLibraryBackup() falls back to shape-sniffing for those.
  kind?: "library";
  exportedAt: string;
  notes: Note[];
  setlists: Setlist[];
  setlistItems: SetlistItemInput[];
}

interface NoteBackup {
  version: number;
  kind: "note";
  exportedAt: string;
  note: Note;
}

function isLibraryBackup(value: unknown): value is LibraryBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== undefined && v.kind !== "library") return false;
  return (
    typeof v.version === "number" &&
    Array.isArray(v.notes) &&
    Array.isArray(v.setlists) &&
    Array.isArray(v.setlistItems)
  );
}

/**
 * Coerces one note from a backup file into a shape the DB layer can bind.
 * Files written by older versions predate `tuning` and `updatedAt`, and a
 * hand-edited file can carry a null where an array belongs — previously
 * either produced a raw SQLite error partway through the import.
 */
function normalizeNote(value: unknown, index: number): Note {
  if (!value || typeof value !== "object") {
    throw new Error(`Note ${index + 1} in this file isn't valid.`);
  }
  const n = value as Record<string, unknown>;
  if (typeof n.id !== "string" || !n.id) {
    throw new Error(`Note ${index + 1} in this file is missing an id.`);
  }
  if (typeof n.title !== "string") {
    throw new Error(`Note ${index + 1} in this file is missing a title.`);
  }

  const str = (v: unknown, fallback: string) =>
    typeof v === "string" ? v : fallback;
  const strArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const createdAt = str(n.createdAt, new Date().toISOString());

  return {
    id: n.id,
    // Slug is UNIQUE NOT NULL; a file missing one would abort the insert.
    slug: str(n.slug, "") || `${n.id}`,
    type: n.type === "tab" ? "tab" : "chords",
    title: n.title,
    artist: str(n.artist, ""),
    key: str(n.key, "C"),
    capo: typeof n.capo === "number" && Number.isFinite(n.capo) ? n.capo : 0,
    difficulty:
      n.difficulty === "intermediate" || n.difficulty === "advanced"
        ? n.difficulty
        : "beginner",
    tags: strArray(n.tags),
    createdAt,
    updatedAt: str(n.updatedAt, createdAt),
    tuning: str(n.tuning, "standard"),
    chordSheet: typeof n.chordSheet === "string" ? n.chordSheet : undefined,
    tabBlocks: Array.isArray(n.tabBlocks)
      ? (n.tabBlocks as Note["tabBlocks"])
      : undefined,
    chords: strArray(n.chords),
    strummingPattern: Array.isArray(n.strummingPattern)
      ? strArray(n.strummingPattern)
      : undefined,
    bpm:
      typeof n.bpm === "number" && Number.isFinite(n.bpm) && n.bpm > 0
        ? n.bpm
        : undefined,
    isFavorite: !!n.isFavorite,
  };
}

function isNoteBackup(value: unknown): value is NoteBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "note" && typeof v.version === "number" && !!v.note && typeof v.note === "object";
}

function backupFilename(): string {
  return `fretnote-backup-${new Date().toISOString().slice(0, 10)}.fretnote`;
}

/** Browser stand-in for the native open dialog: a hidden file input.
 *  The `cancel` event only fires on Chromium 113+; on other browsers
 *  dismissing the picker without choosing a file just leaves this pending. */
function pickFileBrowser(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".fretnote,.json";
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);

    const cleanup = () => document.body.removeChild(input);
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    });
    input.addEventListener("change", () => {
      cleanup();
      resolve(input.files?.[0] ?? null);
    });
    input.click();
  });
}

/** Browser stand-in for the native save dialog: triggers a normal download. */
function saveTextFileBrowser(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function readTransferFile(
  dialogName: string
): Promise<{ path: string; json: string } | null> {
  if (!("__TAURI_INTERNALS__" in window)) {
    const file = await pickFileBrowser();
    if (!file) return null;
    return { path: file.name, json: await file.text() };
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");

  const path = await open({
    multiple: false,
    filters: [{ name: dialogName, extensions: ["fretnote", "json"] }],
  });
  if (!path || Array.isArray(path)) return null;

  return { path, json: await readTextFile(path) };
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
}

/**
 * Writes every note, setlist, and setlist membership into a single JSON
 * file, so the whole library can be carried between devices (e.g. phone ->
 * desktop) and re-imported there via importLibrary().
 *
 * Returns false if the user cancelled the save dialog.
 */
export async function exportLibrary(): Promise<boolean> {
  const [notes, setlists, setlistItems] = await Promise.all([
    listNotes(),
    listSetlists(),
    listAllSetlistItems(),
  ]);

  const backup: LibraryBackup = {
    version: BACKUP_VERSION,
    kind: "library",
    exportedAt: new Date().toISOString(),
    notes,
    setlists,
    setlistItems,
  };

  const json = JSON.stringify(backup, null, 2);

  if (!("__TAURI_INTERNALS__" in window)) {
    saveTextFileBrowser(backupFilename(), json);
    return true;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    defaultPath: backupFilename(),
    filters: [{ name: "Fretnote Library", extensions: ["fretnote", "json"] }],
  });
  if (!path) return false; // user cancelled the dialog
  await writeTextFile(path, json);
  return true;
}

/**
 * Reads a library backup file and upserts every note/setlist/item by id:
 * anything whose id already exists locally is overwritten with the
 * imported version, anything new is added, and nothing missing from the
 * file is deleted. This lets two devices converge without wiping
 * local-only notes.
 *
 * Returns null if the user cancelled the open dialog.
 */
export async function importLibrary(): Promise<{ notes: number; setlists: number } | null> {
  const picked = await readTransferFile("Fretnote Library");
  if (!picked) return null;

  const data = parseJson(picked.json);
  if (isNoteBackup(data)) {
    throw new Error('This is a single-note file, not a library backup. Use "Import note" instead.');
  }
  if (!isLibraryBackup(data)) {
    throw new Error("This file isn't a valid Fretnote library backup.");
  }

  // Validate the whole file before writing a single row. Previously each
  // note was bound straight to SQLite, so a bad entry halfway down threw a
  // raw driver error with the earlier rows already committed and no way to
  // tell what had been applied.
  const notes = data.notes.map(normalizeNote);

  const db = await getDb();
  await db.execute("BEGIN");
  try {
    // Notes and setlists first, since setlist items reference them by id.
    for (const note of notes) await upsertNote(note);
    for (const setlist of data.setlists) await upsertSetlist(setlist);
    for (const item of data.setlistItems) await upsertSetlistItem(item);
    await db.execute("COMMIT");
  } catch (err) {
    await db.execute("ROLLBACK").catch(() => {});
    throw err;
  }

  return { notes: notes.length, setlists: data.setlists.length };
}

/**
 * Writes a single note to its own JSON file — a lightweight way to share or
 * carry over one song without exporting the whole library.
 *
 * Returns false if the user cancelled the save dialog.
 */
export async function exportNote(note: Note): Promise<boolean> {
  const backup: NoteBackup = {
    version: BACKUP_VERSION,
    kind: "note",
    exportedAt: new Date().toISOString(),
    note,
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `${sanitizeFilename(note.title)}.fretnote`;

  if (!("__TAURI_INTERNALS__" in window)) {
    saveTextFileBrowser(filename, json);
    return true;
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    defaultPath: filename,
    filters: [{ name: "Fretnote Note", extensions: ["fretnote", "json"] }],
  });
  if (!path) return false; // user cancelled the dialog
  await writeTextFile(path, json);
  return true;
}

/**
 * Reads a single-note file and adds it to the library, or overwrites the
 * local note with the same id after confirmation.
 *
 * Returns the imported note, or null if the user cancelled the open dialog
 * or declined to overwrite an existing note.
 */
export async function importNote(): Promise<Note | null> {
  const picked = await readTransferFile("Fretnote Note");
  if (!picked) return null;

  const data = parseJson(picked.json);
  if (isLibraryBackup(data)) {
    throw new Error('This is a whole-library backup, not a single note. Use "Import library" in Settings instead.');
  }
  if (!isNoteBackup(data)) {
    throw new Error("This file isn't a valid Fretnote note.");
  }

  const note = normalizeNote(data.note, 0);
  const existing = await getNote(note.id);
  if (existing) {
    const overwrite = confirm(
      `A note named "${existing.title}" already exists. Overwrite it with the imported version?`
    );
    if (!overwrite) return null;
  }

  await upsertNote(note);
  return note;
}
