//! Chord-diagram shapes. Ported from `src/lib/music/chords.ts`.

use super::transpose::{split_root, transpose_chord};

#[derive(Debug, Clone)]
pub struct Barre {
    pub fret: i32,
    /// String span in low->high index.
    pub from: i32,
    pub to: i32,
}

#[derive(Debug, Clone)]
pub struct ChordShape {
    /// Fret per string, ordered low-E (6th) -> high-e (1st).
    /// -1 = muted, 0 = open, n = fret pressed (absolute fret).
    pub frets: [i32; 6],
    /// Lowest fret drawn in the diagram (for barre chords up the neck).
    pub base_fret: i32,
    /// Optional barre.
    pub barre: Option<Barre>,
}

const fn shape(frets: [i32; 6], base_fret: i32) -> ChordShape {
    ChordShape {
        frets,
        base_fret,
        barre: None,
    }
}

const fn barred(frets: [i32; 6], base_fret: i32, fret: i32, from: i32, to: i32) -> ChordShape {
    ChordShape {
        frets,
        base_fret,
        barre: Some(Barre { fret, from, to }),
    }
}

/// A compact library of common open and barre shapes. Kept as an ordered slice
/// so the derive-by-transpose fallback iterates in a stable order (mirroring the
/// insertion order of the original object literal).
fn shapes() -> Vec<(&'static str, ChordShape)> {
    vec![
        ("C", shape([-1, 3, 2, 0, 1, 0], 1)),
        ("Cmaj7", shape([-1, 3, 2, 0, 0, 0], 1)),
        ("C7", shape([-1, 3, 2, 3, 1, 0], 1)),
        ("Cadd9", shape([-1, 3, 2, 0, 3, 0], 1)),
        ("Cm", barred([-1, 3, 5, 5, 4, 3], 3, 3, 1, 5)),
        ("D", shape([-1, -1, 0, 2, 3, 2], 1)),
        ("Dmaj7", shape([-1, -1, 0, 2, 2, 2], 1)),
        ("D7", shape([-1, -1, 0, 2, 1, 2], 1)),
        ("Dm", shape([-1, -1, 0, 2, 3, 1], 1)),
        ("Dm7", shape([-1, -1, 0, 2, 1, 1], 1)),
        ("Dsus4", shape([-1, -1, 0, 2, 3, 3], 1)),
        ("Dsus2", shape([-1, -1, 0, 2, 3, 0], 1)),
        ("E", shape([0, 2, 2, 1, 0, 0], 1)),
        ("Emaj7", shape([0, 2, 1, 1, 0, 0], 1)),
        ("E7", shape([0, 2, 0, 1, 0, 0], 1)),
        ("Em", shape([0, 2, 2, 0, 0, 0], 1)),
        ("Em7", shape([0, 2, 2, 0, 3, 0], 1)),
        ("Esus4", shape([0, 2, 2, 2, 0, 0], 1)),
        ("F", barred([1, 3, 3, 2, 1, 1], 1, 1, 0, 5)),
        ("Fmaj7", shape([-1, -1, 3, 2, 1, 0], 1)),
        ("F#m", barred([2, 4, 4, 2, 2, 2], 2, 2, 0, 5)),
        ("Fm", barred([1, 3, 3, 1, 1, 1], 1, 1, 0, 5)),
        ("G", shape([3, 2, 0, 0, 0, 3], 1)),
        ("Gmaj7", shape([3, 2, 0, 0, 0, 2], 1)),
        ("G7", shape([3, 2, 0, 0, 0, 1], 1)),
        ("Gm", barred([3, 5, 5, 3, 3, 3], 3, 3, 0, 5)),
        ("G/B", shape([-1, 2, 0, 0, 0, 3], 1)),
        ("A", shape([-1, 0, 2, 2, 2, 0], 1)),
        ("Amaj7", shape([-1, 0, 2, 1, 2, 0], 1)),
        ("A7", shape([-1, 0, 2, 0, 2, 0], 1)),
        ("Am", shape([-1, 0, 2, 2, 1, 0], 1)),
        ("Am7", shape([-1, 0, 2, 0, 1, 0], 1)),
        ("Asus2", shape([-1, 0, 2, 2, 0, 0], 1)),
        ("Asus4", shape([-1, 0, 2, 2, 3, 0], 1)),
        ("B", barred([-1, 2, 4, 4, 4, 2], 2, 2, 1, 5)),
        ("B7", shape([-1, 2, 1, 2, 0, 2], 1)),
        ("Bm", barred([-1, 2, 4, 4, 3, 2], 2, 2, 1, 5)),
        ("Bm7", shape([-1, 2, 0, 2, 0, 2], 1)),
    ]
}

/// Look up a chord diagram. If the exact name isn't known, we try to derive one
/// by transposing the nearest known shape of the same quality, so uncommon keys
/// still render something reasonable. Returns `None` if nothing fits.
pub fn get_chord_shape(name: &str) -> Option<ChordShape> {
    let library = shapes();

    if let Some((_, s)) = library.iter().find(|(n, _)| *n == name) {
        return Some(s.clone());
    }

    let (_, quality) = split_root(name)?;

    // Find a known chord with the same quality, then transpose its shape.
    for semitones in 1..=11 {
        for (known_name, base) in &library {
            let known_quality = match split_root(known_name) {
                Some((_, q)) => q,
                None => continue,
            };
            if known_quality != quality {
                continue;
            }
            if transpose_chord(known_name, semitones, false) == name {
                return Some(shift_shape(base, semitones));
            }
        }
    }
    None
}

fn shift_shape(shape: &ChordShape, semitones: i32) -> ChordShape {
    let frets: [i32; 6] = std::array::from_fn(|i| {
        let f = shape.frets[i];
        if f <= 0 {
            f
        } else {
            f + semitones
        }
    });
    let min_pressed = frets.iter().copied().filter(|&f| f > 0).min().unwrap_or(1);
    ChordShape {
        frets,
        base_fret: if min_pressed > 3 { min_pressed } else { 1 },
        barre: shape.barre.as_ref().map(|b| Barre {
            fret: b.fret + semitones,
            from: b.from,
            to: b.to,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_known_shape() {
        let c = get_chord_shape("C").unwrap();
        assert_eq!(c.frets, [-1, 3, 2, 0, 1, 0]);
        assert!(c.barre.is_none());
    }

    #[test]
    fn derives_unknown_shape_by_transposing_quality() {
        // C#m is not in the library; derive from Cm (or another minor) up a semitone.
        let c_sharp_m = get_chord_shape("C#m").expect("should derive C#m");
        // Same quality shape shifted; pressed frets should be raised by 1 vs Cm.
        assert!(c_sharp_m.frets.iter().any(|&f| f > 0));
    }

    #[test]
    fn returns_none_for_garbage() {
        assert!(get_chord_shape("N.C.").is_none());
    }
}
