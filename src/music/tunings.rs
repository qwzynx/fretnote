//! Guitar tunings. Ported from `src/lib/music/tunings.ts`.
//!
//! Consumed by chord detection in the (not-yet-ported) note editor.
#![allow(dead_code)]

#[derive(Debug, Clone)]
pub struct Tuning {
    pub id: &'static str,
    pub label: &'static str,
    /// Open string MIDI note numbers, low-E (index 0) to high-e (index 5).
    pub midi: [i32; 6],
    /// Display labels for each string, low-E (index 0) to high-e (index 5).
    pub names: [&'static str; 6],
}

pub const TUNINGS: &[Tuning] = &[
    Tuning {
        id: "standard",
        label: "Standard (EADGBe)",
        midi: [40, 45, 50, 55, 59, 64],
        names: ["E", "A", "D", "G", "B", "e"],
    },
    Tuning {
        id: "drop-d",
        label: "Drop D (DADGBe)",
        midi: [38, 45, 50, 55, 59, 64],
        names: ["D", "A", "D", "G", "B", "e"],
    },
    Tuning {
        id: "half-down",
        label: "Half Step Down (Eb Ab Db Gb Bb eb)",
        midi: [39, 44, 49, 54, 58, 63],
        names: ["Eb", "Ab", "Db", "Gb", "Bb", "eb"],
    },
    Tuning {
        id: "full-down",
        label: "Full Step Down (DGCFAd)",
        midi: [38, 43, 48, 53, 57, 62],
        names: ["D", "G", "C", "F", "A", "d"],
    },
    Tuning {
        id: "open-g",
        label: "Open G (DGDGBd)",
        midi: [38, 43, 50, 55, 59, 62],
        names: ["D", "G", "D", "G", "B", "d"],
    },
    Tuning {
        id: "dadgad",
        label: "DADGAD",
        midi: [38, 45, 50, 55, 57, 62],
        names: ["D", "A", "D", "G", "A", "d"],
    },
    Tuning {
        id: "open-e",
        label: "Open E (EBE G#Be)",
        midi: [40, 47, 52, 56, 59, 64],
        names: ["E", "B", "E", "G#", "B", "e"],
    },
    Tuning {
        id: "open-d",
        label: "Open D (DAD F#Ad)",
        midi: [38, 45, 50, 53, 57, 62],
        names: ["D", "A", "D", "F#", "A", "d"],
    },
];

/// The default tuning (standard EADGBe).
pub fn default_tuning() -> &'static Tuning {
    &TUNINGS[0]
}
