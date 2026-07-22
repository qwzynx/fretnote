import Database from "@tauri-apps/plugin-sql";
import type { Difficulty, Note, NoteType, TabBlock } from "@/lib/types";

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await Database.load("sqlite:fretnote.db");
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id                TEXT PRIMARY KEY,
        slug              TEXT UNIQUE NOT NULL,
        type              TEXT NOT NULL,
        title             TEXT NOT NULL,
        artist            TEXT NOT NULL,
        key               TEXT NOT NULL,
        capo              INTEGER NOT NULL DEFAULT 0,
        difficulty        TEXT NOT NULL DEFAULT 'beginner',
        tags              TEXT NOT NULL DEFAULT '[]',
        created_at        TEXT NOT NULL,
        chord_sheet       TEXT,
        tab_blocks        TEXT,
        chords            TEXT NOT NULL DEFAULT '[]',
        strumming_pattern TEXT,
        bpm               INTEGER
      )
    `);
    await _db.execute(
      `ALTER TABLE notes ADD COLUMN strumming_pattern TEXT`
    ).catch(() => { /* column already exists */ });
    await _db.execute(
      `ALTER TABLE notes ADD COLUMN bpm INTEGER`
    ).catch(() => { /* column already exists */ });
  }
  return _db;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.select<Row[]>(
    "SELECT * FROM notes ORDER BY created_at DESC"
  );
  return rows.map(rowToNote);
}

export async function getNote(idOrSlug: string): Promise<Note | null> {
  const db = await getDb();
  const rows = await db.select<Row[]>(
    "SELECT * FROM notes WHERE id = $1 OR slug = $1 LIMIT 1",
    [idOrSlug]
  );
  if (!rows.length) return null;
  return rowToNote(rows[0]);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface NoteInput {
  type: NoteType;
  title: string;
  artist: string;
  key: string;
  capo: number;
  difficulty: Difficulty;
  tags: string[];
  chordSheet?: string;
  tabBlocks?: TabBlock[];
  chords: string[];
  strummingPattern?: string[];
  bpm?: number;
}

export async function createNote(input: NoteInput): Promise<Note> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const slug = makeSlug(input.title, input.artist);
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO notes
       (id, slug, type, title, artist, key, capo, difficulty, tags, created_at, chord_sheet, tab_blocks, chords, strumming_pattern, bpm)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      slug,
      input.type,
      input.title,
      input.artist,
      input.key,
      input.capo,
      input.difficulty,
      JSON.stringify(input.tags),
      now,
      input.chordSheet ?? null,
      input.tabBlocks?.length ? JSON.stringify(input.tabBlocks) : null,
      JSON.stringify(input.chords),
      input.strummingPattern?.length ? JSON.stringify(input.strummingPattern) : null,
      input.bpm ?? null,
    ]
  );

  return { id, slug, createdAt: now, ...input };
}

export async function updateNote(id: string, input: NoteInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE notes SET
       type=$1, title=$2, artist=$3, key=$4, capo=$5, difficulty=$6,
       tags=$7, chord_sheet=$8, tab_blocks=$9, chords=$10, strumming_pattern=$11, bpm=$12
     WHERE id=$13`,
    [
      input.type,
      input.title,
      input.artist,
      input.key,
      input.capo,
      input.difficulty,
      JSON.stringify(input.tags),
      input.chordSheet ?? null,
      input.tabBlocks?.length ? JSON.stringify(input.tabBlocks) : null,
      JSON.stringify(input.chords),
      input.strummingPattern?.length ? JSON.stringify(input.strummingPattern) : null,
      input.bpm ?? null,
      id,
    ]
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface Row {
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
}

function rowToNote(r: Row): Note {
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
  };
}

function makeSlug(title: string, artist: string): string {
  const base = `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
