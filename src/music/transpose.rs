//! Chord/key transposition. Ported from `src/lib/music/transpose.ts`.

const SHARP_SCALE: [&str; 12] = [
    "A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#",
];

const FLAT_SCALE: [&str; 12] = [
    "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab",
];

/// Map a note name to its pitch-class index (A = 0). Returns `None` for
/// anything that isn't a recognised note.
fn note_to_index(note: &str) -> Option<usize> {
    Some(match note {
        "A" => 0,
        "A#" | "Bb" => 1,
        "B" | "Cb" => 2,
        "C" | "B#" => 3,
        "C#" | "Db" => 4,
        "D" => 5,
        "D#" | "Eb" => 6,
        "E" | "Fb" => 7,
        "F" | "E#" => 8,
        "F#" | "Gb" => 9,
        "G" => 10,
        "G#" | "Ab" => 11,
        _ => return None,
    })
}

fn mod12(n: i32) -> usize {
    (((n % 12) + 12) % 12) as usize
}

/// Split a chord symbol into `(root, quality)`, e.g. `"F#m7"` -> `("F#", "m7")`.
/// Returns `None` when the string does not begin with a note name.
pub(crate) fn split_root(chord: &str) -> Option<(&str, &str)> {
    let bytes = chord.as_bytes();
    let first = *bytes.first()?;
    if !(b'A'..=b'G').contains(&first) {
        return None;
    }
    // Optional single accidental.
    let root_len = match bytes.get(1) {
        Some(b'#') | Some(b'b') => 2,
        _ => 1,
    };
    Some((&chord[..root_len], &chord[root_len..]))
}

fn transpose_note(note: &str, semitones: i32, prefer_flat: bool) -> String {
    match note_to_index(note) {
        Some(index) => {
            let scale = if prefer_flat { &FLAT_SCALE } else { &SHARP_SCALE };
            scale[mod12(index as i32 + semitones)].to_string()
        }
        None => note.to_string(),
    }
}

/// Transpose a single chord symbol by a number of semitones, preserving the
/// quality and any slash bass note. Returns the input unchanged if it does not
/// look like a chord.
pub fn transpose_chord(chord: &str, semitones: i32, prefer_flat: bool) -> String {
    if chord.is_empty() || semitones == 0 {
        return chord.to_string();
    }

    let (main, bass) = match chord.split_once('/') {
        Some((m, b)) => (m, Some(b)),
        None => (chord, None),
    };

    let (root, quality) = match split_root(main) {
        Some(parts) => parts,
        None => return chord.to_string(),
    };

    let mut result = transpose_note(root, semitones, prefer_flat) + quality;

    if let Some(bass) = bass {
        match split_root(bass) {
            Some((bass_root, bass_quality)) => {
                result.push('/');
                result.push_str(&transpose_note(bass_root, semitones, prefer_flat));
                result.push_str(bass_quality);
            }
            None => {
                result.push('/');
                result.push_str(bass);
            }
        }
    }

    result
}

/// Transpose a musical key label (e.g. "Am", "C", "F#m").
pub fn transpose_key(key: &str, semitones: i32) -> String {
    transpose_chord(key, semitones, false)
}

/// Transpose every inline `[Chord]` marker in a chord sheet by `semitones`.
/// Lyrics between markers are left untouched.
pub fn transpose_chord_sheet(sheet: &str, semitones: i32) -> String {
    if semitones == 0 {
        return sheet.to_string();
    }
    replace_brackets(sheet, |inner| {
        format!("[{}]", transpose_chord(inner.trim(), semitones, false))
    })
}

/// Replace each `[...]` span using `f` applied to the inner text. Shared bracket
/// scanner used in place of the JS `/\[([^\]]+)\]/g` regex.
pub(crate) fn replace_brackets(input: &str, mut f: impl FnMut(&str) -> String) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(open) = rest.find('[') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        match after.find(']') {
            Some(close) if close > 0 => {
                out.push_str(&f(&after[..close]));
                rest = &after[close + 1..];
            }
            _ => {
                // No matching (non-empty) close bracket; emit the rest verbatim.
                out.push_str(&rest[open..]);
                return out;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Format a signed semitone offset for display, e.g. +2 / -1 / 0.
pub fn format_semitones(semitones: i32) -> String {
    if semitones == 0 {
        "0".to_string()
    } else if semitones > 0 {
        format!("+{semitones}")
    } else {
        semitones.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transposes_simple_chords() {
        assert_eq!(transpose_chord("Am", 2, false), "Bm");
        assert_eq!(transpose_chord("C", 2, false), "D");
        assert_eq!(transpose_chord("G", 1, false), "G#");
        assert_eq!(transpose_chord("G", 1, true), "Ab");
    }

    #[test]
    fn preserves_quality_and_slash_bass() {
        assert_eq!(transpose_chord("F#m7", 1, false), "Gm7");
        assert_eq!(transpose_chord("C/E", 2, false), "D/F#");
        assert_eq!(transpose_chord("G/B", 5, false), "C/E");
    }

    #[test]
    fn identity_on_zero_or_non_chord() {
        assert_eq!(transpose_chord("Am", 0, false), "Am");
        assert_eq!(transpose_chord("N.C.", 3, false), "N.C.");
    }

    #[test]
    fn wraps_around_the_octave() {
        assert_eq!(transpose_chord("A", 12, false), "A");
        assert_eq!(transpose_chord("A", -1, false), "G#");
    }

    #[test]
    fn transposes_only_markers_in_sheet() {
        let sheet = "On a dark [Em]desert [C]highway";
        assert_eq!(
            transpose_chord_sheet(sheet, 2),
            "On a dark [F#m]desert [D]highway"
        );
        assert_eq!(transpose_chord_sheet(sheet, 0), sheet);
    }

    #[test]
    fn formats_semitones() {
        assert_eq!(format_semitones(0), "0");
        assert_eq!(format_semitones(2), "+2");
        assert_eq!(format_semitones(-1), "-1");
    }
}
