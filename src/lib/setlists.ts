import Database from "@tauri-apps/plugin-sql";
import type { Setlist, SetlistWithNotes, Note, NoteType, Difficulty, TabBlock } from "@/lib/types";

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.load("sqlite:fretnote.db");
  }
  return _db;
}

interface SetlistRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  note_count: number;
}

interface NoteRow {
  id: string;
  slug: string;
  type: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  difficulty: string;
  tags: string;
  created_at: string;
  chord_sheet: string | null;
  tab_blocks: string | null;
  chords: string;
  strumming_pattern: string | null;
  bpm: number | null;
  is_favorite: number;
}

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type as NoteType,
    title: r.title,
    artist: r.artist,
    key: r.key,
    capo: r.capo,
    difficulty: r.difficulty as Difficulty,
    tags: JSON.parse(r.tags),
    createdAt: r.created_at,
    chordSheet: r.chord_sheet ?? undefined,
    tabBlocks: r.tab_blocks ? JSON.parse(r.tab_blocks) : undefined,
    chords: JSON.parse(r.chords),
    strummingPattern: r.strumming_pattern ? JSON.parse(r.strumming_pattern) : undefined,
    bpm: r.bpm ?? undefined,
    isFavorite: r.is_favorite === 1,
  };
}

export async function listSetlists(): Promise<Setlist[]> {
  const db = await getDb();
  const rows = await db.select<SetlistRow[]>(`
    SELECT s.*, COUNT(i.id) AS note_count
    FROM setlists s
    LEFT JOIN setlist_items i ON i.setlist_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    noteCount: r.note_count,
  }));
}

export async function createSetlist(title: string, description = ""): Promise<Setlist> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO setlists (id, title, description, created_at) VALUES ($1,$2,$3,$4)",
    [id, title, description, now]
  );
  return { id, title, description, createdAt: now, noteCount: 0 };
}

export async function updateSetlist(id: string, title: string, description: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE setlists SET title=$1, description=$2 WHERE id=$3", [title, description, id]);
}

export async function deleteSetlist(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM setlists WHERE id=$1", [id]);
}

export async function getSetlistWithNotes(id: string): Promise<SetlistWithNotes | null> {
  const db = await getDb();
  const setlistRows = await db.select<SetlistRow[]>(
    "SELECT *, 0 AS note_count FROM setlists WHERE id=$1",
    [id]
  );
  if (!setlistRows.length) return null;
  const s = setlistRows[0];

  const noteRows = await db.select<(NoteRow & { item_id: string; position: number })[]>(`
    SELECT n.*, i.id AS item_id, i.position
    FROM setlist_items i
    JOIN notes n ON n.id = i.note_id
    WHERE i.setlist_id = $1
    ORDER BY i.position ASC
  `, [id]);

  return {
    id: s.id,
    title: s.title,
    description: s.description,
    createdAt: s.created_at,
    noteCount: noteRows.length,
    notes: noteRows.map((r) => ({ ...rowToNote(r), _itemId: r.item_id } as Note & { _itemId: string })),
  };
}

export async function addNoteToSetlist(setlistId: string, noteId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM setlist_items WHERE setlist_id=$1 AND note_id=$2",
    [setlistId, noteId]
  );
  if (existing.length) return;
  const maxRows = await db.select<{ max_pos: number | null }[]>(
    "SELECT MAX(position) AS max_pos FROM setlist_items WHERE setlist_id=$1",
    [setlistId]
  );
  const pos = (maxRows[0]?.max_pos ?? -1) + 1;
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO setlist_items (id, setlist_id, note_id, position) VALUES ($1,$2,$3,$4)",
    [id, setlistId, noteId, pos]
  );
}

export async function removeFromSetlist(itemId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM setlist_items WHERE id=$1", [itemId]);
}

export async function moveSetlistItem(setlistId: string, itemId: string, direction: "up" | "down"): Promise<void> {
  const db = await getDb();
  const items = await db.select<{ id: string; position: number }[]>(
    "SELECT id, position FROM setlist_items WHERE setlist_id=$1 ORDER BY position ASC",
    [setlistId]
  );
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  const a = items[idx];
  const b = items[swapIdx];
  await db.execute("UPDATE setlist_items SET position=$1 WHERE id=$2", [b.position, a.id]);
  await db.execute("UPDATE setlist_items SET position=$1 WHERE id=$2", [a.position, b.id]);
}

export async function getSetlistsForNote(noteId: string): Promise<{ setlistId: string; title: string; itemId: string }[]> {
  const db = await getDb();
  const rows = await db.select<{ setlist_id: string; title: string; item_id: string }[]>(`
    SELECT i.setlist_id, s.title, i.id AS item_id
    FROM setlist_items i
    JOIN setlists s ON s.id = i.setlist_id
    WHERE i.note_id = $1
  `, [noteId]);
  return rows.map((r) => ({ setlistId: r.setlist_id, title: r.title, itemId: r.item_id }));
}
