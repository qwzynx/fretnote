//! Chord-sheet parsing. Ported from `src/lib/music/parse.ts`.
//!
//! The original used three regexes; here they are replaced with small
//! hand-written scanners so we avoid a regex dependency:
//!   SECTION_RE  = /^\s*\[([^\]]+)\]\s*$/
//!   TABREF_RE   = /^\s*\[\s*tab:\s*([^\]]+?)\s*\]\s*$/i
//!   INLINE_RE   = /\[([^\]]+)\]/g

#[derive(Debug, Clone, PartialEq)]
pub struct ChordSegment {
    /// Chord shown above this segment, or `None` for plain lyric text.
    pub chord: Option<String>,
    /// Lyric text that sits under the chord (may be empty).
    pub text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ParsedLine {
    Lyric { segments: Vec<ChordSegment> },
    Section { label: String },
    TabRef { name: String },
    Blank,
}

/// Non-chord labels that appear in bracket notation as structural/literary markers.
const NON_CHORD_LABELS: &[&str] = &[
    "verse",
    "chorus",
    "refrain",
    "pre-chorus",
    "pre chorus",
    "bridge",
    "intro",
    "outro",
    "hook",
    "post-chorus",
    "post chorus",
    "rhyme schemes",
    "repetition",
    "metaphors",
    "similes",
    "vocalizations",
    "ad-libs",
    "storytelling",
    "imagery",
];

/// Base words for the numbered-variant check, e.g. "Verse 1", "Chorus2".
/// Mirrors /^(verse|chorus|refrain|pre-?chorus|bridge|intro|outro|hook|post-?chorus)\s*\d*$/i
const SECTION_WORDS: &[&str] = &[
    "verse",
    "chorus",
    "refrain",
    "prechorus",
    "pre-chorus",
    "bridge",
    "intro",
    "outro",
    "hook",
    "postchorus",
    "post-chorus",
];

pub fn is_non_chord_label(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    if NON_CHORD_LABELS.contains(&lower.as_str()) {
        return true;
    }
    // Numbered variants like "Verse 1", "Chorus 2".
    SECTION_WORDS.iter().any(|word| {
        if let Some(rest) = lower.strip_prefix(word) {
            is_optional_ws_then_digits(rest)
        } else {
            false
        }
    })
}

/// True when `rest` matches `\s*\d*$`: zero+ whitespace followed by zero+ digits.
fn is_optional_ws_then_digits(rest: &str) -> bool {
    let after_ws = rest.trim_start();
    after_ws.chars().all(|c| c.is_ascii_digit())
}

/// The inner text of a whole-line single bracket, i.e. the `([^\]]+)` capture of
/// SECTION_RE, or `None` if the trimmed line isn't exactly `[...]` with non-empty,
/// `]`-free contents.
fn whole_line_bracket(line: &str) -> Option<&str> {
    let trimmed = line.trim();
    let inner = trimmed.strip_prefix('[')?.strip_suffix(']')?;
    if inner.is_empty() || inner.contains(']') {
        return None;
    }
    Some(inner)
}

/// If `inner` matches `\s*tab:\s*([^\]]+?)\s*` (case-insensitive), return the name.
fn as_tab_ref(inner: &str) -> Option<String> {
    let trimmed = inner.trim_start();
    // Case-insensitive "tab:" prefix.
    if trimmed.len() < 4 || !trimmed[..4].eq_ignore_ascii_case("tab:") {
        return None;
    }
    let name = trimmed[4..].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

/// Iterate the `[...]` spans of `s` with regex-global semantics: for each, yield
/// `(open_index, after_close_index, inner)` where inner is non-empty and `]`-free.
fn bracket_matches(s: &str) -> Vec<(usize, usize, &str)> {
    let bytes = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'[' {
            if let Some(rel) = s[i + 1..].find(']') {
                if rel > 0 {
                    let inner = &s[i + 1..i + 1 + rel];
                    let after = i + 1 + rel + 1;
                    out.push((i, after, inner));
                    i = after;
                    continue;
                }
            }
        }
        i += 1;
    }
    out
}

/// Parse one line of a chord sheet written with inline `[Chord]` markers.
pub fn parse_chord_line(line: &str) -> ParsedLine {
    if line.trim().is_empty() {
        return ParsedLine::Blank;
    }

    if let Some(inner) = whole_line_bracket(line) {
        if let Some(name) = as_tab_ref(inner) {
            return ParsedLine::TabRef { name };
        }
        // Treat as a section header when the label has whitespace OR is a known
        // structural term.
        if inner.chars().any(char::is_whitespace) || is_non_chord_label(inner) {
            return ParsedLine::Section {
                label: inner.trim().to_string(),
            };
        }
    }

    let matches = bracket_matches(line);
    if matches.is_empty() {
        return ParsedLine::Lyric {
            segments: vec![ChordSegment {
                chord: None,
                text: line.to_string(),
            }],
        };
    }

    let mut segments: Vec<ChordSegment> = Vec::new();
    let mut last_index = 0usize;
    let mut leading = String::new();

    for (start, after, inner) in &matches {
        let before = &line[last_index..*start];
        if segments.is_empty() && !before.is_empty() {
            leading = before.to_string();
        } else if !before.is_empty() {
            if let Some(seg) = segments.last_mut() {
                seg.text.push_str(before);
            }
        }
        segments.push(ChordSegment {
            chord: Some(inner.trim().to_string()),
            text: String::new(),
        });
        last_index = *after;
    }

    let trailing = &line[last_index..];
    if !trailing.is_empty() {
        if let Some(seg) = segments.last_mut() {
            seg.text.push_str(trailing);
        }
    }

    let mut result: Vec<ChordSegment> = Vec::new();
    if !leading.is_empty() {
        result.push(ChordSegment {
            chord: None,
            text: leading,
        });
    }
    result.extend(segments);
    ParsedLine::Lyric { segments: result }
}

pub fn parse_chord_sheet(sheet: &str) -> Vec<ParsedLine> {
    sheet
        .replace("\r\n", "\n")
        .split('\n')
        .map(parse_chord_line)
        .collect()
}

/// Collect the unique chord names used across a chord sheet, in order.
/// (Used by the note editor to auto-populate a note's chord list — ported ahead.)
#[allow(dead_code)]
pub fn extract_chords(sheet: &str) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for (_, _, inner) in bracket_matches(sheet) {
        let chord = inner.trim();
        // Skip section headers, tab references, and non-chord labels.
        if chord.chars().any(char::is_whitespace)
            || chord.len() >= 4 && chord[..4].eq_ignore_ascii_case("tab:")
            || is_non_chord_label(chord)
        {
            continue;
        }
        if seen.insert(chord.to_string()) {
            out.push(chord.to_string());
        }
    }
    out
}

/// Names referenced by `[tab: Name]` lines, in document order (may repeat).
#[allow(dead_code)]
pub fn extract_tab_refs(sheet: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in sheet.replace("\r\n", "\n").split('\n') {
        if let Some(inner) = whole_line_bracket(line) {
            if let Some(name) = as_tab_ref(inner) {
                out.push(name);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_and_section_lines() {
        assert_eq!(parse_chord_line("   "), ParsedLine::Blank);
        assert_eq!(
            parse_chord_line("[Verse 1]"),
            ParsedLine::Section {
                label: "Verse 1".to_string()
            }
        );
        assert_eq!(
            parse_chord_line("[Chorus]"),
            ParsedLine::Section {
                label: "Chorus".to_string()
            }
        );
    }

    #[test]
    fn single_chord_bracket_is_not_a_section() {
        // "[Am]" alone is a chord over empty lyric, not a section header.
        match parse_chord_line("[Am]") {
            ParsedLine::Lyric { segments } => {
                assert_eq!(segments.len(), 1);
                assert_eq!(segments[0].chord.as_deref(), Some("Am"));
            }
            other => panic!("expected lyric, got {other:?}"),
        }
    }

    #[test]
    fn tab_ref_line() {
        assert_eq!(
            parse_chord_line("[tab: Intro]"),
            ParsedLine::TabRef {
                name: "Intro".to_string()
            }
        );
        assert_eq!(
            parse_chord_line("[TAB:Solo]"),
            ParsedLine::TabRef {
                name: "Solo".to_string()
            }
        );
    }

    #[test]
    fn inline_chords_over_lyrics() {
        let parsed = parse_chord_line("On a dark [Em]desert [C]highway");
        match parsed {
            ParsedLine::Lyric { segments } => {
                assert_eq!(segments.len(), 3);
                assert_eq!(segments[0].chord, None);
                assert_eq!(segments[0].text, "On a dark ");
                assert_eq!(segments[1].chord.as_deref(), Some("Em"));
                assert_eq!(segments[1].text, "desert ");
                assert_eq!(segments[2].chord.as_deref(), Some("C"));
                assert_eq!(segments[2].text, "highway");
            }
            other => panic!("expected lyric, got {other:?}"),
        }
    }

    #[test]
    fn extract_chords_skips_labels_and_tabrefs() {
        let sheet = "[Verse 1]\nOn a [Em]dark [C]highway\n[tab: Intro]\n[Em]again";
        assert_eq!(extract_chords(sheet), vec!["Em", "C"]);
    }

    #[test]
    fn extract_tab_refs_in_order() {
        let sheet = "[tab: Intro]\n[Em]lyric\n[tab: Solo]";
        assert_eq!(extract_tab_refs(sheet), vec!["Intro", "Solo"]);
    }

    #[test]
    fn numbered_section_labels() {
        assert!(is_non_chord_label("Verse 2"));
        assert!(is_non_chord_label("Chorus"));
        assert!(is_non_chord_label("Pre-Chorus"));
        assert!(!is_non_chord_label("Am"));
        assert!(!is_non_chord_label("C#m7"));
    }
}
