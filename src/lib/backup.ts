import { listNotes, getNote, upsertNote } from "@/lib/db";
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

  // Notes and setlists first, since setlist items reference them by id.
  for (const note of data.notes) await upsertNote(note);
  for (const setlist of data.setlists) await upsertSetlist(setlist);
  for (const item of data.setlistItems) await upsertSetlistItem(item);

  return { notes: data.notes.length, setlists: data.setlists.length };
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

  const existing = await getNote(data.note.id);
  if (existing) {
    const overwrite = confirm(
      `A note named "${existing.title}" already exists. Overwrite it with the imported version?`
    );
    if (!overwrite) return null;
  }

  await upsertNote(data.note);
  return data.note;
}
