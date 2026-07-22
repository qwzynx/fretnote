//! Converts the Rust domain model (`model.rs`) into the flat structs the Slint
//! UI consumes. All reader-side derivations (parse, transpose, chord-shape
//! resolution, ASCII tab building) happen here so the `.slint` files stay purely
//! declarative.

use crate::model::{Note, TabBlock, TabColumn, TAB_STRING_LABELS};
use crate::music::chords::get_chord_shape;
use crate::music::parse::{parse_chord_sheet, ParsedLine};
use crate::music::transpose::{format_semitones, transpose_chord_sheet, transpose_key};
use crate::{
    ChordDiagramData, DiagramDot, LineUI, NoteDetail, NoteSummary, SegmentUI, StrumCell, TabBlockUI,
};
use slint::{ModelRc, VecModel};

fn model<T: Clone + 'static>(items: Vec<T>) -> ModelRc<T> {
    ModelRc::new(VecModel::from(items))
}

/// Display rows run high-e (top) -> low-E (bottom); map to column indices.
/// Matches `ROW_TO_STRING` in the old `tab-view.tsx`.
const ROW_TO_STRING: [usize; 6] = [5, 4, 3, 2, 1, 0];

/// 8th-note beat labels, repeated per bar (from `strumming-editor.tsx`).
const BEAT_LABELS_8: [&str; 8] = ["1", "&", "2", "&", "3", "&", "4", "&"];

pub fn to_summary(note: &Note) -> NoteSummary {
    NoteSummary {
        id: note.id.clone().into(),
        title: note.title.clone().into(),
        artist: note.artist.clone().into(),
        key: note.key.clone().into(),
        difficulty: note.difficulty.as_str().into(),
        type_label: type_label(note).into(),
        tags: note.tags.join(", ").into(),
        created: note.created_at.chars().take(10).collect::<String>().into(),
    }
}

fn type_label(note: &Note) -> &'static str {
    match note.note_type {
        crate::model::NoteType::Chords => "Chords",
        crate::model::NoteType::Tab => "Tab",
    }
}

/// Build the full reader detail for `note`, applying `steps` semitone transpose.
pub fn build_detail(note: &Note, steps: i32) -> NoteDetail {
    let is_chords = note.note_type == crate::model::NoteType::Chords;
    let display_key = if is_chords {
        transpose_key(&note.key, steps)
    } else {
        note.key.clone()
    };

    let empty: Vec<TabBlock> = Vec::new();
    let tab_blocks = note.tab_blocks.as_ref().unwrap_or(&empty);

    // Body lines (chord sheets only).
    let lines: Vec<LineUI> = if is_chords {
        if let Some(sheet) = &note.chord_sheet {
            let transposed = transpose_chord_sheet(sheet, steps);
            parse_chord_sheet(&transposed)
                .into_iter()
                .map(|l| line_to_ui(l, tab_blocks))
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Chord diagrams (transposed only for chord notes).
    let diagrams: Vec<ChordDiagramData> = note
        .chords
        .iter()
        .map(|c| {
            let name = if is_chords {
                transpose_key(c, steps)
            } else {
                c.clone()
            };
            diagram(&name)
        })
        .collect();

    // Standalone tab blocks (tab notes).
    let tab_block_ui: Vec<TabBlockUI> = tab_blocks
        .iter()
        .map(|b| TabBlockUI {
            label: b.label.clone().into(),
            text: build_tab_ascii(&b.columns).into(),
        })
        .collect();

    // Strumming cells.
    let strumming = strumming_cells(note);
    let has_strumming = !strumming.is_empty();

    let has_body = (is_chords && !lines.is_empty()) || (!is_chords && !tab_block_ui.is_empty());

    NoteDetail {
        id: note.id.clone().into(),
        title: note.title.clone().into(),
        artist: note.artist.clone().into(),
        key: display_key.into(),
        capo: note.capo as i32,
        has_capo: note.capo > 0,
        difficulty: note.difficulty.as_str().into(),
        is_chords,
        bpm: note.bpm.unwrap_or(0) as i32,
        has_bpm: note.bpm.is_some(),
        transpose_steps: steps,
        transpose_label: format_semitones(steps).into(),
        lines: model(lines),
        diagrams: model(diagrams.clone()),
        tab_blocks: model(tab_block_ui),
        strumming: model(strumming),
        has_strumming,
        has_diagrams: !note.chords.is_empty(),
        has_body,
    }
}

fn line_to_ui(line: ParsedLine, tab_blocks: &[TabBlock]) -> LineUI {
    match line {
        ParsedLine::Blank => LineUI {
            kind: "blank".into(),
            ..Default::default()
        },
        ParsedLine::Section { label } => LineUI {
            kind: "section".into(),
            label: label.into(),
            ..Default::default()
        },
        ParsedLine::TabRef { name } => {
            let found = tab_blocks
                .iter()
                .find(|b| b.label.trim().eq_ignore_ascii_case(name.trim()));
            match found {
                Some(b) => LineUI {
                    kind: "tabref".into(),
                    label: if b.label.is_empty() {
                        name.into()
                    } else {
                        b.label.clone().into()
                    },
                    tab_text: build_tab_ascii(&b.columns).into(),
                    tab_missing: false,
                    ..Default::default()
                },
                None => LineUI {
                    kind: "tabref".into(),
                    label: name.into(),
                    tab_missing: true,
                    ..Default::default()
                },
            }
        }
        ParsedLine::Lyric { segments } => {
            let segs: Vec<SegmentUI> = segments
                .into_iter()
                .map(|s| SegmentUI {
                    chord: s.chord.clone().unwrap_or_default().into(),
                    text: s.text.into(),
                    has_chord: s.chord.is_some(),
                })
                .collect();
            LineUI {
                kind: "lyric".into(),
                segments: model(segs),
                ..Default::default()
            }
        }
    }
}

fn diagram(name: &str) -> ChordDiagramData {
    match get_chord_shape(name) {
        Some(shape) => {
            let base = shape.base_fret;
            let mut markers: Vec<DiagramDot> = Vec::new();
            for s in 0..6 {
                let fret = shape.frets[s];
                if fret == -1 {
                    markers.push(DiagramDot {
                        kind: "muted".into(),
                        string_idx: s as i32,
                        fret_offset: 0,
                    });
                } else if fret == 0 {
                    markers.push(DiagramDot {
                        kind: "open".into(),
                        string_idx: s as i32,
                        fret_offset: 0,
                    });
                } else {
                    // Skip a dot covered by a barre at the same fret.
                    if let Some(b) = &shape.barre {
                        if b.fret == fret {
                            continue;
                        }
                    }
                    markers.push(DiagramDot {
                        kind: "dot".into(),
                        string_idx: s as i32,
                        fret_offset: (fret - base) as i32,
                    });
                }
            }
            ChordDiagramData {
                name: name.into(),
                available: true,
                base_fret: base,
                show_nut: base == 1,
                markers: model(markers),
                has_barre: shape.barre.is_some(),
                barre_from: shape.barre.as_ref().map(|b| b.from).unwrap_or(0),
                barre_to: shape.barre.as_ref().map(|b| b.to).unwrap_or(0),
                barre_offset: shape.barre.as_ref().map(|b| b.fret - base).unwrap_or(0),
            }
        }
        None => ChordDiagramData {
            name: name.into(),
            available: false,
            base_fret: 1,
            show_nut: true,
            markers: model(Vec::new()),
            ..Default::default()
        },
    }
}

fn strumming_cells(note: &Note) -> Vec<StrumCell> {
    let pattern = match &note.strumming_pattern {
        Some(p) if p.iter().any(|s| s != "") => p,
        _ => return Vec::new(),
    };
    pattern
        .iter()
        .enumerate()
        .map(|(i, stroke)| {
            let (symbol, dim) = stroke_symbol(stroke);
            StrumCell {
                symbol: symbol.into(),
                label: BEAT_LABELS_8[i % 8].into(),
                strong: i % 2 == 0,
                dim,
            }
        })
        .collect()
}

/// (display symbol, is-dim) for a stroke, from `STROKE_DISPLAY` in the old editor.
fn stroke_symbol(stroke: &str) -> (&'static str, bool) {
    match stroke {
        "D" => ("↓", false),
        "U" => ("↑", false),
        "d" => ("↓", true),
        "u" => ("↑", true),
        "X" => ("✕", true),
        _ => ("·", true),
    }
}

/// Build a 6-line ASCII stave for one tab block. Ported from `buildStave` in
/// `tab-view.tsx` (single stave, no responsive wrapping).
fn build_tab_ascii(cols: &[TabColumn]) -> String {
    let cell_width = cols
        .iter()
        .flat_map(|c| c.iter())
        .map(|v| v.chars().count())
        .max()
        .unwrap_or(1)
        .max(1);

    let mut out = String::new();
    for (row_idx, &string_idx) in ROW_TO_STRING.iter().enumerate() {
        let label = TAB_STRING_LABELS[row_idx];
        let mut line = format!("{label}|");
        for col in cols {
            let raw = if col[string_idx].is_empty() {
                "-".to_string()
            } else {
                col[string_idx].clone()
            };
            line.push('-');
            line.push_str(&pad_end(&raw, cell_width, '-'));
        }
        line.push_str("-|");
        out.push_str(&line);
        if row_idx < 5 {
            out.push('\n');
        }
    }
    out
}

fn pad_end(s: &str, width: usize, fill: char) -> String {
    let len = s.chars().count();
    if len >= width {
        s.to_string()
    } else {
        let mut out = s.to_string();
        for _ in 0..(width - len) {
            out.push(fill);
        }
        out
    }
}

/// Case-insensitive substring search over the note's title/artist/key/tags.
pub fn matches_query(note: &Note, query: &str) -> bool {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return true;
    }
    let hay = format!(
        "{} {} {} {}",
        note.title,
        note.artist,
        note.key,
        note.tags.join(" ")
    )
    .to_lowercase();
    hay.contains(&q)
}
