import { listNotes, upsertNote } from "@/lib/db";
import {
  listSetlists,
  listAllSetlistItems,
  upsertSetlist,
  upsertSetlistItem,
  type SetlistItemInput,
} from "@/lib/setlists";
import type { Note, Setlist } from "@/lib/types";

const BACKUP_VERSION = 1;

interface LibraryBackup {
  version: number;
  exportedAt: string;
  notes: Note[];
  setlists: Setlist[];
  setlistItems: SetlistItemInput[];
}

function isLibraryBackup(value: unknown): value is LibraryBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === "number" &&
    Array.isArray(v.notes) &&
    Array.isArray(v.setlists) &&
    Array.isArray(v.setlistItems)
  );
}

function backupFilename(): string {
  return `fretnote-backup-${new Date().toISOString().slice(0, 10)}.fretnote`;
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
    exportedAt: new Date().toISOString(),
    notes,
    setlists,
    setlistItems,
  };

  const json = JSON.stringify(backup, null, 2);

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
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");

  const path = await open({
    multiple: false,
    filters: [{ name: "Fretnote Library", extensions: ["fretnote", "json"] }],
  });
  if (!path || Array.isArray(path)) return null;

  const json = await readTextFile(path);

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("This file isn't valid JSON.");
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
