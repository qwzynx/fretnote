import { getDb } from "@/lib/db-driver";
import type {
  Difficulty,
  Note,
  NoteSummary,
  NoteType,
  TabBlock,
} from "@/lib/types";

// ── Read ──────────────────────────────────────────────────────────────────────

/** Every column a card draws — everything except the two body blobs. */
const SUMMARY_COLUMNS = `id, slug, type, title, artist, key, capo, difficulty,
  tags, created_at, updated_at, tuning, chords, strumming_pattern, bpm, is_favorite`;

/**
 * The feed's list query. Reads only what a card renders: pulling `chord_sheet`
 * and `tab_blocks` too meant every keystroke-filtered list carried the full
 * text of every song, and `rowToNote` parsed four JSON columns per row to
 * throw most of it away.
 */
export async function listNoteSummaries(): Promise<NoteSummary[]> {
  const db = await getDb();
  const rows = await db.select<SummaryRow[]>(
    `SELECT ${SUMMARY_COLUMNS} FROM notes ORDER BY created_at DESC`
  );
  return rows.map(rowToSummary);
}

/** Full notes including bodies. Only export and backup need this. */
export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.select<Row[]>(
    "SELECT * FROM notes ORDER BY created_at DESC"
  );
  return rows.map(rowToNote);
}

export async function getNote(idOrSlug: string): Promise<Note | null> {
  const db = await getDb();
  // Two indexed equality lookups rather than `WHERE id = $1 OR slug = $1`.
  // SQLite won't use the primary key or the unique index across an OR
  // spanning two columns, so the single-query form scanned the whole table —
  // reading every song's lyrics — on every note open and every edit load.
  const byId = await db.select<Row[]>(
    "SELECT * FROM notes WHERE id = $1 LIMIT 1",
    [idOrSlug]
  );
  if (byId.length) return rowToNote(byId[0]);

  const bySlug = await db.select<Row[]>(
    "SELECT * FROM notes WHERE slug = $1 LIMIT 1",
    [idOrSlug]
  );
  if (bySlug.length) return rowToNote(bySlug[0]);

  return null;
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
  tuning: string;
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
       (id, slug, type, title, artist, key, capo, difficulty, tags, created_at, updated_at, tuning, chord_sheet, tab_blocks, chords, strumming_pattern, bpm)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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
      now,
      input.tuning,
      input.chordSheet ?? null,
      input.tabBlocks?.length ? JSON.stringify(input.tabBlocks) : null,
      JSON.stringify(input.chords),
      input.strummingPattern?.length ? JSON.stringify(input.strummingPattern) : null,
      input.bpm ?? null,
    ]
  );

  return { id, slug, createdAt: now, updatedAt: now, ...input };
}

/** Resolves false when no row matched, so callers can surface "not found". */
export async function updateNote(id: string, input: NoteInput): Promise<boolean> {
  const db = await getDb();
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM notes WHERE id = $1 LIMIT 1",
    [id]
  );
  if (!existing.length) return false;

  await db.execute(
    `UPDATE notes SET
       type=$1, title=$2, artist=$3, key=$4, capo=$5, difficulty=$6,
       tags=$7, chord_sheet=$8, tab_blocks=$9, chords=$10, strumming_pattern=$11,
       bpm=$12, tuning=$13, updated_at=$14
     WHERE id=$15`,
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
      input.tuning,
      new Date().toISOString(),
      id,
    ]
  );
  return true;
}

/**
 * Inserts a note as-is (preserving its id/slug/createdAt/isFavorite), or
 * overwrites the existing row with the same id. Used by library import,
 * where notes arrive with identity already assigned by the exporting device.
 */
export async function upsertNote(note: Note): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO notes
       (id, slug, type, title, artist, key, capo, difficulty, tags, created_at, updated_at, tuning, chord_sheet, tab_blocks, chords, strumming_pattern, bpm, is_favorite)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug,
       type=excluded.type,
       title=excluded.title,
       artist=excluded.artist,
       key=excluded.key,
       capo=excluded.capo,
       difficulty=excluded.difficulty,
       tags=excluded.tags,
       created_at=excluded.created_at,
       updated_at=excluded.updated_at,
       tuning=excluded.tuning,
       chord_sheet=excluded.chord_sheet,
       tab_blocks=excluded.tab_blocks,
       chords=excluded.chords,
       strumming_pattern=excluded.strumming_pattern,
       bpm=excluded.bpm,
       is_favorite=excluded.is_favorite`,
    [
      note.id,
      note.slug,
      note.type,
      note.title,
      note.artist,
      note.key,
      note.capo,
      note.difficulty,
      JSON.stringify(note.tags),
      note.createdAt,
      note.updatedAt ?? note.createdAt,
      note.tuning,
      note.chordSheet ?? null,
      note.tabBlocks?.length ? JSON.stringify(note.tabBlocks) : null,
      JSON.stringify(note.chords),
      note.strummingPattern?.length ? JSON.stringify(note.strummingPattern) : null,
      note.bpm ?? null,
      note.isFavorite ? 1 : 0,
    ]
  );
}

export async function toggleFavorite(id: string, value: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET is_favorite = $1 WHERE id = $2", [
    value ? 1 : 0,
    id,
  ]);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  // setlist_items declares ON DELETE CASCADE, but that only fires when
  // `PRAGMA foreign_keys` is on for the connection running the delete — and
  // the Tauri plugin pools connections, so it may not be. Removing the
  // memberships explicitly is what actually keeps setlist counts honest.
  await db.execute("DELETE FROM setlist_items WHERE note_id = $1", [id]);
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SummaryRow {
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
  updated_at: string | null;
  tuning: string | null;
  chords: string;
  strumming_pattern: string | null;
  bpm: number | null;
  is_favorite: number;
}

export interface Row extends SummaryRow {
  chord_sheet: string | null;
  tab_blocks: string | null;
}

/** `JSON.parse` that degrades to a fallback instead of taking the page down. */
function parseJsonColumn<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToSummary(r: SummaryRow): NoteSummary {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type as NoteType,
    title: r.title,
    artist: r.artist,
    key: r.key,
    capo: r.capo,
    difficulty: r.difficulty as Difficulty,
    tags: parseJsonColumn<string[]>(r.tags, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
    tuning: r.tuning ?? "standard",
    chords: parseJsonColumn<string[]>(r.chords, []),
    strummingPattern: parseJsonColumn<string[] | undefined>(
      r.strumming_pattern,
      undefined
    ),
    bpm: r.bpm ?? undefined,
    isFavorite: r.is_favorite === 1,
  };
}

export function rowToNote(r: Row): Note {
  return {
    ...rowToSummary(r),
    chordSheet: r.chord_sheet ?? undefined,
    tabBlocks: parseJsonColumn<TabBlock[] | undefined>(r.tab_blocks, undefined),
  };
}

function makeSlug(title: string, artist: string): string {
  const base = `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
