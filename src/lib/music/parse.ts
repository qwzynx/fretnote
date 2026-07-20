export interface ChordSegment {
  /** Chord shown above this segment, or null for plain lyric text. */
  chord: string | null;
  /** Lyric text that sits under the chord (may be empty). */
  text: string;
}

export type ParsedLine =
  | { kind: "lyric"; segments: ChordSegment[] }
  | { kind: "section"; label: string }
  | { kind: "blank" };

const SECTION_RE = /^\s*\[([^\]]+)\]\s*$/;
const INLINE_CHORD_RE = /\[([^\]]+)\]/g;

/**
 * Parse one line of a chord sheet written with inline [Chord] markers into
 * segments so chords can be rendered positioned above the syllable that
 * follows them. A line that is only a single [Label] (e.g. "[Verse 1]") is
 * treated as a section header rather than a chord.
 */
export function parseChordLine(line: string): ParsedLine {
  if (line.trim() === "") return { kind: "blank" };

  const section = line.match(SECTION_RE);
  // Treat as a section header only when the label isn't a plain chord-ish token.
  if (section && /\s/.test(section[1])) {
    return { kind: "section", label: section[1].trim() };
  }

  const segments: ChordSegment[] = [];
  let lastIndex = 0;
  let leading = "";
  let match: RegExpExecArray | null;

  INLINE_CHORD_RE.lastIndex = 0;
  while ((match = INLINE_CHORD_RE.exec(line)) !== null) {
    const before = line.slice(lastIndex, match.index);
    if (segments.length === 0 && before) {
      // Text before the first chord has no chord above it.
      leading = before;
    } else if (before) {
      segments[segments.length - 1].text += before;
    }
    segments.push({ chord: match[1].trim(), text: "" });
    lastIndex = match.index + match[0].length;
  }

  const trailing = line.slice(lastIndex);
  if (segments.length === 0) {
    return { kind: "lyric", segments: [{ chord: null, text: line }] };
  }
  if (trailing) segments[segments.length - 1].text += trailing;

  const result: ChordSegment[] = [];
  if (leading) result.push({ chord: null, text: leading });
  result.push(...segments);
  return { kind: "lyric", segments: result };
}

export function parseChordSheet(sheet: string): ParsedLine[] {
  return sheet.replace(/\r\n/g, "\n").split("\n").map(parseChordLine);
}

/** Collect the unique chord names used across a chord sheet, in order. */
export function extractChords(sheet: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  INLINE_CHORD_RE.lastIndex = 0;
  while ((match = INLINE_CHORD_RE.exec(sheet)) !== null) {
    const chord = match[1].trim();
    // Skip section headers like "Verse 1".
    if (/\s/.test(chord)) continue;
    if (!seen.has(chord)) {
      seen.add(chord);
      out.push(chord);
    }
  }
  return out;
}
