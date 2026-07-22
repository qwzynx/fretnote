//! Domain types. Ported from `src/lib/types.ts`.
//!
//! `serde` derives keep the JSON encoding of the `tags`, `tab_blocks`, `chords`
//! and `strumming_pattern` columns byte-compatible with what the old TypeScript
//! `db.ts` wrote, so existing rows load unchanged.

// Some helpers (write-path input, string constants, enum encoders) are consumed
// by the data layer / the not-yet-ported editor rather than the reader UI.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteType {
    Chords,
    Tab,
}

impl NoteType {
    pub fn as_str(&self) -> &'static str {
        match self {
            NoteType::Chords => "chords",
            NoteType::Tab => "tab",
        }
    }

    pub fn from_str_lenient(s: &str) -> NoteType {
        match s {
            "tab" => NoteType::Tab,
            _ => NoteType::Chords,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Beginner,
    Intermediate,
    Advanced,
}

impl Difficulty {
    pub fn as_str(&self) -> &'static str {
        match self {
            Difficulty::Beginner => "beginner",
            Difficulty::Intermediate => "intermediate",
            Difficulty::Advanced => "advanced",
        }
    }

    pub fn from_str_lenient(s: &str) -> Difficulty {
        match s {
            "intermediate" => Difficulty::Intermediate,
            "advanced" => Difficulty::Advanced,
            _ => Difficulty::Beginner,
        }
    }
}

/// A single column of a 6-string tab, strings ordered high-e -> low-E. Each
/// value is a fret number as a string, "" for an untouched string.
pub type TabColumn = [String; 6];

/// A labeled tab fragment (e.g. "Intro", "Solo").
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TabBlock {
    pub id: String,
    pub label: String,
    pub columns: Vec<TabColumn>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Note {
    pub id: String,
    pub slug: String,
    pub note_type: NoteType,
    pub title: String,
    pub artist: String,
    pub key: String,
    pub capo: i64,
    pub difficulty: Difficulty,
    pub tags: Vec<String>,
    /// ISO date string.
    pub created_at: String,
    /// Chord-over-lyrics body with inline bracket notation. Present for `Chords`.
    pub chord_sheet: Option<String>,
    /// Named tab fragments.
    pub tab_blocks: Option<Vec<TabBlock>>,
    /// Chord names referenced by the note, used to render diagrams.
    pub chords: Vec<String>,
    /// Strumming pattern: each entry is a StrokeType character or empty string.
    pub strumming_pattern: Option<Vec<String>>,
    /// Beats per minute, shown above the strumming pattern.
    pub bpm: Option<i64>,
}

/// Input for creating/updating a note (no id/slug/createdAt yet).
#[derive(Debug, Clone)]
pub struct NoteInput {
    pub note_type: NoteType,
    pub title: String,
    pub artist: String,
    pub key: String,
    pub capo: i64,
    pub difficulty: Difficulty,
    pub tags: Vec<String>,
    pub chord_sheet: Option<String>,
    pub tab_blocks: Option<Vec<TabBlock>>,
    pub chords: Vec<String>,
    pub strumming_pattern: Option<Vec<String>>,
    pub bpm: Option<i64>,
}

/// The 6 open guitar strings, low-E (6th) to high-e (1st).
pub const STRING_NAMES: [&str; 6] = ["E", "A", "D", "G", "B", "e"];

/// Tab display order: high-e on top down to low-E.
pub const TAB_STRING_LABELS: [&str; 6] = ["e", "B", "G", "D", "A", "E"];
