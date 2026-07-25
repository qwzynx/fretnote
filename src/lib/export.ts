import type { Note, TabBlock } from "@/lib/types";
import { TAB_STRING_LABELS } from "@/lib/types";
import { parseChordSheet } from "@/lib/music/parse";
import { transposeKey } from "@/lib/music/transpose";

function noteHeaderLines(note: Note): string[] {
  const lines: string[] = [];
  lines.push(note.title);
  lines.push(note.artist);
  lines.push(
    `Key: ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${transposeKey(note.key, note.capo)})` : ""}`
  );
  if (note.difficulty) lines.push(`Difficulty: ${note.difficulty}`);
  if (note.tags.length > 0) lines.push(`Tags: ${note.tags.join(", ")}`);
  if (note.bpm) lines.push(`BPM: ${note.bpm}`);
  return lines;
}

function noteBodyLines(note: Note): string[] {
  const lines: string[] = [];

  if (note.chordSheet) {
    lines.push(note.chordSheet);
  }

  if (note.tabBlocks?.length) {
    for (const block of note.tabBlocks) {
      if (block.label) lines.push(`\n── ${block.label} ──`);
      // Columns are stored low-E first, but a tab reads high-e on the top line.
      TAB_STRING_LABELS.forEach((label, row) => {
        const string = 5 - row;
        const frets = block.columns.map((col) => col[string] || "-").join("-");
        lines.push(`${label}|${frets}|`);
      });
      if (block.hint) {
        const shape = block.hint.shape ? `${block.hint.shape} shape` : "hand shape";
        const grip = block.hint.frets
          .map((f, s) => `${TAB_STRING_LABELS[5 - s]}${f < 0 ? "x" : f}`)
          .join(" ");
        lines.push(`Fingering: hold a ${shape} — ${grip}`);
        if (block.hint.note) lines.push(`  ${block.hint.note}`);
      }
    }
  }

  return lines;
}

export function noteToText(note: Note): string {
  return [...noteHeaderLines(note), "", ...noteBodyLines(note)].join("\n");
}

/**
 * Copies text to the clipboard across every environment the app runs in:
 * the Tauri desktop webview, a modern browser tab (phones included), and
 * older/insecure contexts where the async Clipboard API is unavailable.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path below (e.g. insecure context).
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("Copy failed");
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "note";
}

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase();
}

/** Splits a string into fixed-width slices at the same offsets every time,
 *  so a chord line and its lyric line stay column-aligned once wrapped. */
function chunkFixed(s: string, size: number): string[] {
  if (s.length <= size) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

/**
 * Renders a note straight to a PDF file client-side (no browser print
 * dialog involved), so it works the same on desktop and on phones — where
 * window.print() is unreliable or a no-op on many mobile browsers.
 *
 * Laid out for black-and-white printing on letter paper: chords are set in
 * bold instead of relying on color, section labels and dividers use plain
 * black/gray strokes, and tabs render as plain monospace staves.
 */
export async function exportNoteAsPdf(note: Note): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 10.5;
  const lineHeight = 13;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const resetBodyFont = () => {
    doc.setFont("courier", "normal");
    doc.setFontSize(bodySize);
  };

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(note.title, maxWidth) as string[];
  for (const titleLine of titleLines) {
    doc.text(titleLine, margin, y);
    y += 22;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  for (const artistLine of doc.splitTextToSize(note.artist, maxWidth) as string[]) {
    doc.text(artistLine, margin, y);
    y += 15;
  }
  y += 2;

  const meta: string[] = [];
  meta.push(
    `Key ${note.key}${note.capo > 0 ? ` (Capo ${note.capo}, sounds like ${transposeKey(note.key, note.capo)})` : ""}`
  );
  if (note.difficulty) meta.push(note.difficulty[0].toUpperCase() + note.difficulty.slice(1));
  if (note.bpm) meta.push(`${note.bpm} BPM`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const metaLine of doc.splitTextToSize(meta.join("     "), maxWidth) as string[]) {
    doc.text(metaLine, margin, y);
    y += 13;
  }

  if (note.tags.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(90);
    for (const tagLine of doc.splitTextToSize(
      note.tags.map((t) => `#${t}`).join("  "),
      maxWidth
    ) as string[]) {
      doc.text(tagLine, margin, y);
      y += 12;
    }
    doc.setTextColor(0);
  }

  y += 6;
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // ── Body ────────────────────────────────────────────────────────────
  resetBodyFont();
  const charWidth = doc.getTextWidth("0");
  const maxChars = Math.max(20, Math.floor(maxWidth / charWidth));

  const tabByLabel = new Map(
    (note.tabBlocks ?? [])
      .filter((b) => b.label)
      .map((b) => [normalizeLabel(b.label as string), b] as const)
  );

  const drawTabBlock = (block: TabBlock) => {
    ensureSpace(lineHeight * 2);
    if (block.label) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(block.label, margin, y);
      y += lineHeight + 2;
      resetBodyFont();
    }
    TAB_STRING_LABELS.forEach((label, row) => {
      const string = 5 - row;
      const frets = block.columns.map((col) => col[string] || "-").join("-");
      ensureSpace(lineHeight);
      doc.text(`${label}|${frets}|`, margin, y);
      y += lineHeight;
    });
    if (block.hint) {
      const shape = block.hint.shape ? `${block.hint.shape} shape` : "hand shape";
      const grip = block.hint.frets
        .map((f, s) => `${TAB_STRING_LABELS[5 - s]}${f < 0 ? "x" : f}`)
        .join(" ");
      ensureSpace(lineHeight);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(`Fingering: hold a ${shape} — ${grip}`, margin, y);
      y += lineHeight;
      if (block.hint.note) {
        ensureSpace(lineHeight);
        doc.text(block.hint.note, margin, y);
        y += lineHeight;
      }
      resetBodyFont();
    }
    y += 10;
  };

  if (note.type === "tab") {
    for (const block of note.tabBlocks ?? []) drawTabBlock(block);
  } else if (note.chordSheet) {
    for (const line of parseChordSheet(note.chordSheet)) {
      if (line.kind === "blank") {
        y += lineHeight * 0.6;
        continue;
      }

      if (line.kind === "section") {
        ensureSpace(lineHeight * 2);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.text(line.label.toUpperCase(), margin, y);
        y += lineHeight + 4;
        resetBodyFont();
        continue;
      }

      if (line.kind === "tabref") {
        const block = tabByLabel.get(normalizeLabel(line.name));
        if (block) drawTabBlock(block);
        continue;
      }

      // Lyric line: stack a bold chord row above the lyric row, aligned by
      // character column — the classic plain-text chord-chart format.
      let chordLine = "";
      let lyricLine = "";
      for (const seg of line.segments) {
        if (seg.chord) {
          chordLine = chordLine.padEnd(lyricLine.length, " ") + seg.chord;
        }
        lyricLine += seg.text;
      }
      const hasChords = chordLine.trim().length > 0;

      const chordChunks = chunkFixed(chordLine, maxChars);
      const lyricChunks = chunkFixed(lyricLine || " ", maxChars);
      const rows = Math.max(chordChunks.length, lyricChunks.length);
      for (let i = 0; i < rows; i++) {
        const chordRow = chordChunks[i] ?? "";
        if (hasChords && chordRow.trim()) {
          ensureSpace(lineHeight);
          doc.setFont("courier", "bold");
          doc.text(chordRow, margin, y);
          doc.setFont("courier", "normal");
          y += lineHeight;
        }
        ensureSpace(lineHeight);
        doc.text(lyricChunks[i] ?? "", margin, y);
        y += lineHeight;
      }
    }
  }

  // ── Footer (page numbers, only worth it once the chart runs long) ──
  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1) {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text(`${note.title}   ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 30, {
        align: "right",
      });
      doc.setTextColor(0);
    }
  }

  const filename = `${sanitizeFilename(note.title)}.pdf`;

  if ("__TAURI_INTERNALS__" in window) {
    // The browser download machinery jsPDF's doc.save() relies on (a hidden
    // <a download> click on a blob: URL) doesn't reliably trigger a save on
    // Tauri's Linux webview (WebKitGTK), so drive a native save dialog + the
    // fs plugin directly instead. This works identically on every desktop
    // platform Tauri targets.
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return; // user cancelled the dialog
    await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
    return;
  }

  doc.save(filename);
}
