//! SQLite data layer via rusqlite. Ported from `src/lib/db.ts`.
//!
//! Reads and writes the *same* database file and schema the old Tauri app used,
//! so previously-saved notes load unchanged:
//!   `~/.config/com.fretnote.app/fretnote.db`
//! (this is where `tauri-plugin-sql` placed it on Linux — the app config dir
//! joined with the bundle identifier).

// The write path (create/update/delete + slug/JSON helpers) is exercised by the
// unit tests and will drive the not-yet-ported note editor; keep it available.
#![allow(dead_code)]

use crate::model::{Difficulty, Note, NoteInput, NoteType, TabBlock};
use rusqlite::{Connection, OptionalExtension, Row};
use std::path::PathBuf;

pub struct Db {
    conn: Connection,
}

/// Resolve the on-disk database path, matching the old `tauri-plugin-sql` layout.
pub fn db_path() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("com.fretnote.app");
    dir.push("fretnote.db");
    dir
}

impl Db {
    /// Open (creating the file/dir if needed) and run idempotent migrations.
    pub fn open() -> rusqlite::Result<Db> {
        let path = db_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(path)?;
        Self::migrate(&conn)?;
        Ok(Db { conn })
    }

    /// Open an in-memory database (used by tests).
    #[cfg(test)]
    pub fn open_in_memory() -> rusqlite::Result<Db> {
        let conn = Connection::open_in_memory()?;
        Self::migrate(&conn)?;
        Ok(Db { conn })
    }

    fn migrate(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute_batch(
            r#"
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
            );
            "#,
        )?;
        // Older databases may predate these columns; add them if missing.
        let _ = conn.execute("ALTER TABLE notes ADD COLUMN strumming_pattern TEXT", []);
        let _ = conn.execute("ALTER TABLE notes ADD COLUMN bpm INTEGER", []);
        Ok(())
    }

    // ── Read ────────────────────────────────────────────────────────────────

    pub fn list_notes(&self) -> rusqlite::Result<Vec<Note>> {
        let mut stmt = self
            .conn
            .prepare("SELECT * FROM notes ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |r| Ok(row_to_note(r)))?;
        rows.collect()
    }

    pub fn get_note(&self, id_or_slug: &str) -> rusqlite::Result<Option<Note>> {
        self.conn
            .query_row(
                "SELECT * FROM notes WHERE id = ?1 OR slug = ?1 LIMIT 1",
                [id_or_slug],
                |r| Ok(row_to_note(r)),
            )
            .optional()
    }

    // ── Write ───────────────────────────────────────────────────────────────

    pub fn create_note(&self, input: &NoteInput) -> rusqlite::Result<Note> {
        let id = uuid::Uuid::new_v4().to_string();
        let slug = make_slug(&input.title, &input.artist);
        let now = chrono::Utc::now()
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);

        self.conn.execute(
            r#"INSERT INTO notes
                 (id, slug, type, title, artist, key, capo, difficulty, tags, created_at,
                  chord_sheet, tab_blocks, chords, strumming_pattern, bpm)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)"#,
            rusqlite::params![
                id,
                slug,
                input.note_type.as_str(),
                input.title,
                input.artist,
                input.key,
                input.capo,
                input.difficulty.as_str(),
                serde_json::to_string(&input.tags).unwrap(),
                now,
                input.chord_sheet,
                tab_blocks_json(&input.tab_blocks),
                serde_json::to_string(&input.chords).unwrap(),
                strumming_json(&input.strumming_pattern),
                input.bpm,
            ],
        )?;

        Ok(Note {
            id,
            slug,
            note_type: input.note_type,
            title: input.title.clone(),
            artist: input.artist.clone(),
            key: input.key.clone(),
            capo: input.capo,
            difficulty: input.difficulty,
            tags: input.tags.clone(),
            created_at: now,
            chord_sheet: input.chord_sheet.clone(),
            tab_blocks: input.tab_blocks.clone(),
            chords: input.chords.clone(),
            strumming_pattern: input.strumming_pattern.clone(),
            bpm: input.bpm,
        })
    }

    pub fn update_note(&self, id: &str, input: &NoteInput) -> rusqlite::Result<()> {
        self.conn.execute(
            r#"UPDATE notes SET
                 type=?1, title=?2, artist=?3, key=?4, capo=?5, difficulty=?6,
                 tags=?7, chord_sheet=?8, tab_blocks=?9, chords=?10,
                 strumming_pattern=?11, bpm=?12
               WHERE id=?13"#,
            rusqlite::params![
                input.note_type.as_str(),
                input.title,
                input.artist,
                input.key,
                input.capo,
                input.difficulty.as_str(),
                serde_json::to_string(&input.tags).unwrap(),
                input.chord_sheet,
                tab_blocks_json(&input.tab_blocks),
                serde_json::to_string(&input.chords).unwrap(),
                strumming_json(&input.strumming_pattern),
                input.bpm,
                id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_note(&self, id: &str) -> rusqlite::Result<()> {
        self.conn
            .execute("DELETE FROM notes WHERE id = ?1", [id])?;
        Ok(())
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Serialize tab blocks the way `db.ts` did: `NULL` when empty, else JSON.
fn tab_blocks_json(blocks: &Option<Vec<TabBlock>>) -> Option<String> {
    match blocks {
        Some(b) if !b.is_empty() => Some(serde_json::to_string(b).unwrap()),
        _ => None,
    }
}

fn strumming_json(pattern: &Option<Vec<String>>) -> Option<String> {
    match pattern {
        Some(p) if !p.is_empty() => Some(serde_json::to_string(p).unwrap()),
        _ => None,
    }
}

fn row_to_note(r: &Row) -> Note {
    let tags: String = r.get_unwrap("tags");
    let chords: String = r.get_unwrap("chords");
    let tab_blocks: Option<String> = r.get_unwrap("tab_blocks");
    let strumming: Option<String> = r.get_unwrap("strumming_pattern");

    Note {
        id: r.get_unwrap("id"),
        slug: r.get_unwrap("slug"),
        note_type: NoteType::from_str_lenient(&r.get_unwrap::<_, String>("type")),
        title: r.get_unwrap("title"),
        artist: r.get_unwrap("artist"),
        key: r.get_unwrap("key"),
        capo: r.get_unwrap("capo"),
        difficulty: Difficulty::from_str_lenient(&r.get_unwrap::<_, String>("difficulty")),
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        created_at: r.get_unwrap("created_at"),
        chord_sheet: r.get_unwrap("chord_sheet"),
        tab_blocks: tab_blocks.and_then(|s| serde_json::from_str(&s).ok()),
        chords: serde_json::from_str(&chords).unwrap_or_default(),
        strumming_pattern: strumming.and_then(|s| serde_json::from_str(&s).ok()),
        bpm: r.get_unwrap("bpm"),
    }
}

/// Build a URL-ish slug from title + artist, plus a short random suffix.
fn make_slug(title: &str, artist: &str) -> String {
    let base: String = format!("{title}-{artist}")
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    // Collapse runs of '-' and trim leading/trailing ones.
    let mut collapsed = String::new();
    let mut prev_dash = false;
    for c in base.chars() {
        if c == '-' {
            if !prev_dash {
                collapsed.push('-');
            }
            prev_dash = true;
        } else {
            collapsed.push(c);
            prev_dash = false;
        }
    }
    let base = collapsed.trim_matches('-');
    let suffix: String = uuid::Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(5)
        .collect();
    format!("{base}-{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Difficulty, NoteInput, NoteType};

    fn sample_input() -> NoteInput {
        NoteInput {
            note_type: NoteType::Chords,
            title: "Hotel California".to_string(),
            artist: "Eagles".to_string(),
            key: "C".to_string(),
            capo: 7,
            difficulty: Difficulty::Beginner,
            tags: vec!["classic".to_string()],
            chord_sheet: Some("On a dark [Em]desert highway".to_string()),
            tab_blocks: None,
            chords: vec!["Em".to_string()],
            strumming_pattern: Some(vec!["D".into(), "".into(), "D".into()]),
            bpm: Some(172),
        }
    }

    #[test]
    fn round_trips_a_note() {
        let db = Db::open_in_memory().unwrap();
        let created = db.create_note(&sample_input()).unwrap();

        let fetched = db.get_note(&created.id).unwrap().unwrap();
        assert_eq!(fetched.title, "Hotel California");
        assert_eq!(fetched.capo, 7);
        assert_eq!(fetched.chords, vec!["Em"]);
        assert_eq!(fetched.bpm, Some(172));
        assert_eq!(
            fetched.strumming_pattern,
            Some(vec!["D".into(), "".into(), "D".into()])
        );

        // Also resolvable by slug.
        assert!(db.get_note(&created.slug).unwrap().is_some());
    }

    #[test]
    fn reads_legacy_shaped_row() {
        // Simulate a row written by the old TypeScript db.ts (JSON columns).
        let db = Db::open_in_memory().unwrap();
        db.conn
            .execute(
                r#"INSERT INTO notes (id, slug, type, title, artist, key, capo, difficulty,
                     tags, created_at, chord_sheet, tab_blocks, chords, strumming_pattern, bpm)
                   VALUES ('id1','hotel-california-eagles-8s8g0','chords','Hotel California',
                     'Eagles','C',7,'beginner','[]','2026-07-22T03:47:02.154Z',
                     'On a [Em]dark highway', NULL, '["Em"]', '["D","","D"]', 172)"#,
                [],
            )
            .unwrap();

        let n = db.get_note("hotel-california-eagles-8s8g0").unwrap().unwrap();
        assert_eq!(n.title, "Hotel California");
        assert_eq!(n.note_type, NoteType::Chords);
        assert_eq!(n.tags, Vec::<String>::new());
        assert_eq!(n.chords, vec!["Em"]);
        assert!(n.tab_blocks.is_none());
    }

    #[test]
    fn update_and_delete() {
        let db = Db::open_in_memory().unwrap();
        let created = db.create_note(&sample_input()).unwrap();

        let mut edited = sample_input();
        edited.title = "New Title".to_string();
        edited.capo = 0;
        db.update_note(&created.id, &edited).unwrap();

        let fetched = db.get_note(&created.id).unwrap().unwrap();
        assert_eq!(fetched.title, "New Title");
        assert_eq!(fetched.capo, 0);

        db.delete_note(&created.id).unwrap();
        assert!(db.get_note(&created.id).unwrap().is_none());
    }

    #[test]
    fn slug_is_kebab_case() {
        let s = make_slug("Hotel California", "Eagles");
        assert!(s.starts_with("hotel-california-eagles-"));
        assert!(!s.contains(' '));
    }
}
