//! Detect a chord name from fretted notes. Ported from `src/lib/music/chord-detect.ts`.
//!
//! Used by the (not-yet-ported) visual fretboard input in the note editor; kept
//! and unit-tested now so the port is complete.
#![allow(dead_code)]

use super::tunings::Tuning;
use std::collections::HashSet;

const NOTE_NAMES: [&str; 12] = [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
];

/// Chord qualities, ordered so that, on a tie, earlier (simpler) qualities win.
const QUALITIES: &[(&str, &[i32])] = &[
    ("", &[0, 4, 7]),
    ("m", &[0, 3, 7]),
    ("7", &[0, 4, 7, 10]),
    ("maj7", &[0, 4, 7, 11]),
    ("m7", &[0, 3, 7, 10]),
    ("sus2", &[0, 2, 7]),
    ("sus4", &[0, 5, 7]),
    ("dim", &[0, 3, 6]),
    ("aug", &[0, 4, 8]),
    ("add9", &[0, 2, 4, 7]),
    ("6", &[0, 4, 7, 9]),
    ("m6", &[0, 3, 7, 9]),
    ("9", &[0, 2, 4, 7, 10]),
    ("5", &[0, 7]),
];

/// Given 6 fret values (-1=muted, 0=open, n=fret) and a tuning, return the
/// best-matching chord name or `None` if fewer than 3 distinct pitches sound.
pub fn detect_chord(frets: [i32; 6], tuning: &Tuning) -> Option<String> {
    let mut played: HashSet<i32> = HashSet::new();
    let mut lowest_midi = i32::MAX;
    let mut bass_pc: i32 = -1;

    for s in 0..6 {
        if frets[s] < 0 {
            continue;
        }
        let midi = tuning.midi[s] + frets[s];
        played.insert(midi.rem_euclid(12));
        if midi < lowest_midi {
            lowest_midi = midi;
            bass_pc = midi.rem_euclid(12);
        }
    }

    // Two notes can only ever be a power chord; require a real triad+.
    if played.len() < 3 {
        if played.len() == 2 {
            for root in 0..12 {
                if played.contains(&root)
                    && played.contains(&((root + 7) % 12))
                    && played.len() == 2
                {
                    let idx = if root == bass_pc { root } else { bass_pc };
                    return Some(format!("{}5", NOTE_NAMES[idx as usize]));
                }
            }
        }
        return None;
    }

    let mut best_name: Option<String> = None;
    let mut best_score = i32::MIN;

    for root in 0..12 {
        for (quality, intervals) in QUALITIES {
            let formula_set: HashSet<i32> = intervals.iter().map(|i| (root + i) % 12).collect();

            // Guitarists routinely drop the perfect 5th, so treat it as optional
            // for any chord that has a 3rd (power chords keep the 5th mandatory).
            let has_third = intervals.contains(&3) || intervals.contains(&4);
            let required: Vec<i32> = intervals
                .iter()
                .filter(|&&i| !(has_third && i == 7))
                .map(|i| (root + i) % 12)
                .collect();

            // Every required chord tone must actually be played.
            if !required.iter().all(|n| played.contains(n)) {
                continue;
            }

            // Notes the player sounds that the chord doesn't name are "extra".
            let extra = played.iter().filter(|pc| !formula_set.contains(pc)).count() as i32;

            // Higher is better: reward coverage, punish extras and complexity,
            // strongly prefer the root to be the bass note.
            let score = -extra * 20 - formula_set.len() as i32 + if root == bass_pc { 10 } else { 0 };

            if score > best_score {
                best_score = score;
                best_name = Some(format!("{}{}", NOTE_NAMES[root as usize], quality));
            }
        }
    }

    best_name
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::music::tunings::default_tuning;

    #[test]
    fn detects_open_c_major() {
        // C major open shape: x32010
        assert_eq!(
            detect_chord([-1, 3, 2, 0, 1, 0], default_tuning()),
            Some("C".to_string())
        );
    }

    #[test]
    fn detects_e_minor() {
        // Em open shape: 022000
        assert_eq!(
            detect_chord([0, 2, 2, 0, 0, 0], default_tuning()),
            Some("Em".to_string())
        );
    }

    #[test]
    fn detects_power_chord() {
        // E5: 022xxx (E + B)
        assert_eq!(
            detect_chord([0, 2, -1, -1, -1, -1], default_tuning()),
            Some("E5".to_string())
        );
    }

    #[test]
    fn returns_none_for_single_note() {
        assert_eq!(detect_chord([0, -1, -1, -1, -1, -1], default_tuning()), None);
    }
}
