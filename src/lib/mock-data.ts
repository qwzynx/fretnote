import type { Author, Note, TabColumn } from "./types";

export const AUTHORS: Author[] = [
  { id: "u1", name: "Mara Vance", handle: "maravance", avatarColor: "#e0a458" },
  { id: "u2", name: "Theo Kwan", handle: "theok", avatarColor: "#5fb37a" },
  { id: "u3", name: "Iris Bloom", handle: "irisb", avatarColor: "#c96a6a" },
  { id: "u4", name: "Devon Ray", handle: "devray", avatarColor: "#7c8ad1" },
  { id: "u5", name: "Nadia Cole", handle: "nadiac", avatarColor: "#b07cd1" },
];

const tab = (rows: string): TabColumn[] => {
  // Build columns from 6 space-separated string-rows (e, B, G, D, A, E order),
  // which is how a person reads a tab. Convert to low->high columns.
  const lines = rows.trim().split("\n").map((l) => l.trim().split(/\s+/));
  const [e, B, G, D, A, E] = lines;
  const cols: TabColumn[] = [];
  for (let i = 0; i < e.length; i++) {
    cols.push([
      E[i] === "-" ? "" : E[i],
      A[i] === "-" ? "" : A[i],
      D[i] === "-" ? "" : D[i],
      G[i] === "-" ? "" : G[i],
      B[i] === "-" ? "" : B[i],
      e[i] === "-" ? "" : e[i],
    ]);
  }
  return cols;
};

export const MOCK_NOTES: Note[] = [
  {
    id: "n1",
    slug: "morning-static",
    type: "chords",
    title: "Morning Static",
    artist: "The Paper Kites (cover)",
    author: AUTHORS[0],
    key: "G",
    capo: 2,
    difficulty: "beginner",
    tags: ["acoustic", "indie", "fingerpicking"],
    likes: 342,
    saves: 128,
    createdAt: "2026-06-14",
    chords: ["G", "Cadd9", "Em7", "D"],
    chordSheet: `[Verse 1]
[G]Sunlight through the [Cadd9]window on the floor
[Em7]Coffee going [D]cold beside the [G]door
[G]Radio is [Cadd9]humming something low
[Em7]Half a song we [D]used to [G]know

[Chorus]
[Cadd9]Hold the morning [G]still for me
[Em7]Let the quiet [D]be
[Cadd9]Nothing here is [G]breaking yet
[Em7]Nothing to for[D]get`,
  },
  {
    id: "n2",
    slug: "riverbend-riff",
    type: "tab",
    title: "Riverbend Riff",
    artist: "Original",
    author: AUTHORS[1],
    key: "Em",
    capo: 0,
    difficulty: "intermediate",
    tags: ["riff", "electric", "blues"],
    likes: 211,
    saves: 96,
    createdAt: "2026-07-02",
    chords: ["Em", "G", "A"],
    tab: tab(`- - - - - - - - - - - -
- - - - - - - - - - - -
- - 0 2 - - - 2 0 - - -
2 0 - - 2 0 2 - - 2 0 -
- - - - - - - - - - - 2
0 - - - 0 - - - - - - -`),
  },
  {
    id: "n3",
    slug: "back-porch-lullaby",
    type: "chords",
    title: "Back Porch Lullaby",
    artist: "Original",
    author: AUTHORS[2],
    key: "C",
    capo: 0,
    difficulty: "beginner",
    tags: ["folk", "singalong", "3-chords"],
    likes: 508,
    saves: 240,
    createdAt: "2026-05-28",
    chords: ["C", "F", "G", "Am"],
    chordSheet: `[Verse]
[C]Down where the [F]cedar meets the [C]road
[Am]We told our [F]secrets to the [G]toads
[C]Fireflies were [F]blinking out a [C]code
[Am]Slow as the [G]river [C]goes

[Chorus]
[F]Hum a little [C]lower now
[F]Rest your weary [G]crown
[Am]Stars are coming [F]out to play
[C]Lay the day [G]down`,
  },
  {
    id: "n4",
    slug: "neon-parkway",
    type: "chords",
    title: "Neon Parkway",
    artist: "Original",
    author: AUTHORS[3],
    key: "Am",
    capo: 0,
    difficulty: "intermediate",
    tags: ["synthpop", "moody", "barre"],
    likes: 176,
    saves: 73,
    createdAt: "2026-07-11",
    chords: ["Am", "F", "C", "G"],
    chordSheet: `[Intro]
[Am] [F] [C] [G]

[Verse]
[Am]Headlights on the [F]parkway, running late
[C]Radio confess[G]ing to the rain
[Am]Every exit [F]looks the same tonight
[C]Chasing down a [G]colder kind of light

[Chorus]
[F]Drive until the [C]morning finds us [G]out
[F]Nothing left to [C]talk a[G]bout`,
  },
  {
    id: "n5",
    slug: "twelve-bar-warmup",
    type: "tab",
    title: "Twelve Bar Warm-Up",
    artist: "Exercise",
    author: AUTHORS[1],
    key: "A",
    capo: 0,
    difficulty: "beginner",
    tags: ["exercise", "blues", "practice"],
    likes: 89,
    saves: 154,
    createdAt: "2026-06-30",
    chords: ["A7", "D7", "E7"],
    tab: tab(`- - - - - - - -
- - - - - - - -
- - - - - - - -
2 4 2 4 2 4 2 4
0 0 0 0 0 0 0 0
- - - - - - - -`),
  },
  {
    id: "n6",
    slug: "harbor-lights",
    type: "chords",
    title: "Harbor Lights",
    artist: "Original",
    author: AUTHORS[4],
    key: "D",
    capo: 0,
    difficulty: "beginner",
    tags: ["acoustic", "ballad", "wedding"],
    likes: 421,
    saves: 210,
    createdAt: "2026-04-19",
    chords: ["D", "A", "Bm", "G"],
    chordSheet: `[Verse]
[D]Ships come [A]home when the [Bm]harbor's [G]bright
[D]All my [A]worry lets go [G]tonight
[D]You are [A]every har[Bm]bor [G]light
[G]Guiding [A]me in[D]side

[Bridge]
[Bm]If the tide is [G]high
[D]I will still be [A]here
[Bm]Counting every [G]lantern
[A]Drawing the horizon near`,
  },
  {
    id: "n7",
    slug: "attic-tape-hiss",
    type: "tab",
    title: "Attic Tape Hiss",
    artist: "Original",
    author: AUTHORS[0],
    key: "C",
    capo: 0,
    difficulty: "advanced",
    tags: ["fingerstyle", "instrumental"],
    likes: 133,
    saves: 88,
    createdAt: "2026-07-16",
    chords: ["C", "Am", "F", "G"],
    tab: tab(`0 - 1 - 0 - - 3 - - 0 -
1 - - 1 - 1 - - 0 - - 0
0 - 2 - 2 - 0 - 0 - - -
2 - - 2 - 3 - - - 0 - -
3 - - - 3 - - - 2 - - -
- - - - - - 3 - - - 3 -`),
  },
  {
    id: "n8",
    slug: "gold-in-the-gutter",
    type: "chords",
    title: "Gold in the Gutter",
    artist: "Original",
    author: AUTHORS[2],
    key: "E",
    capo: 0,
    difficulty: "intermediate",
    tags: ["rock", "anthemic", "strumming"],
    likes: 267,
    saves: 119,
    createdAt: "2026-06-05",
    chords: ["E", "A", "B7", "C#m"],
    chordSheet: `[Verse]
[E]Found a little [A]gold in the [E]gutter
[C#m]Kept it like a [B7]promise in my [E]hand
[E]Every busted [A]streetlight was a [E]color
[C#m]Every crack a [B7]place to make a [E]stand

[Chorus]
[A]We were never [E]quiet
[A]We were never [B7]tame
[C#m]Shouting down the [A]midnight
[E]Screaming out our [B7]names`,
  },
];

export function getNoteById(id: string): Note | undefined {
  return MOCK_NOTES.find((n) => n.id === id || n.slug === id);
}

/** Fake lyrics "scrape" for the editor demo. */
export function getMockLyrics(artist: string, title: string): string {
  const t = title.trim() || "Untitled";
  const a = artist.trim() || "Unknown Artist";
  return `${t}
by ${a}

[Verse 1]
The needle finds the groove again
A room remembers where we've been
The morning writes it all in chalk
And waits for us to talk

[Chorus]
So sing it like you mean it now
However loud, however low
The only song we ever learned
Is one we let go

[Verse 2]
A door, a light, a running clock
A pocketful of paper thoughts
We hum the parts we can't recall
And that's the best part after all`;
}
