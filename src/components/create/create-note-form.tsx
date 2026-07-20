"use client";

import { useMemo, useRef, useState } from "react";
import {
  Link2,
  Loader2,
  Music4,
  Guitar,
  Wand2,
  Type,
  Minus,
  Plus,
  Eye,
} from "lucide-react";

import type { TabColumn } from "@/lib/types";
import { getMockLyrics } from "@/lib/mock-data";
import { extractChords } from "@/lib/music/parse";
import { DEFAULT_TUNING, type Tuning } from "@/lib/music/tunings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChordLyricsView } from "@/components/notes/chord-lyrics-view";
import { ChordDiagram } from "@/components/notes/chord-diagram";
import { TabView } from "@/components/notes/tab-view";
import { TabEditor } from "./tab-editor";
import { ChordPanel } from "./chord-panel";
import {
  StrummingEditor,
  StrummingPreview,
  emptyPattern,
  type StrokeType,
} from "./strumming-editor";

const DEFAULT_TAB: TabColumn[] = Array.from({ length: 8 }, () => ["", "", "", "", "", ""] as TabColumn);

const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Am", "Em", "Bm", "Dm", "F#m", "Cm"];
const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const MIN_FONT = 13;
const MAX_FONT = 22;

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

export function CreateNoteForm() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [key, setKey] = useState("C");
  const [capo, setCapo] = useState(0);
  const [difficulty, setDifficulty] = useState<string>("beginner");

  const [chordSheet, setChordSheet] = useState("");
  const [tabCols, setTabCols] = useState<TabColumn[]>(DEFAULT_TAB);
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING);
  const [manualChords, setManualChords] = useState<string[]>([]);
  const [pattern, setPattern] = useState<StrokeType[]>(emptyPattern());

  const [finderOpen, setFinderOpen] = useState(false);

  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scraping, setScraping] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chords on the note = those written in the sheet plus any added by hand.
  const allChords = useMemo(
    () => dedupe([...extractChords(chordSheet), ...manualChords]),
    [chordSheet, manualChords]
  );

  function addChord(name: string) {
    if (!allChords.includes(name)) setManualChords((c) => dedupe([...c, name]));
  }

  /** Insert [chord] into the chord sheet at the cursor (or the end). */
  function insertChord(name: string) {
    const el = textareaRef.current;
    const token = `[${name}]`;
    if (!el) {
      setChordSheet((s) => s + token);
      return;
    }
    const start = el.selectionStart ?? chordSheet.length;
    const end = el.selectionEnd ?? start;
    const next = chordSheet.slice(0, start) + token + chordSheet.slice(end);
    setChordSheet(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleScrape() {
    setScraping(true);
    await new Promise((r) => setTimeout(r, 800));
    setChordSheet(getMockLyrics(artist, title));
    setScraping(false);
    setScrapeOpen(false);
    setScrapeUrl("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      {/* ══ Editors (left) ══════════════════════════════════════════ */}
      <div className="min-w-0 space-y-8">
        {/* ── Metadata ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="artist">Artist</Label>
              <Input id="artist" placeholder="Artist name" value={artist} onChange={(e) => setArtist(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Select value={key} onValueChange={(v) => v && setKey(v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capo">Capo</Label>
              <Input
                id="capo"
                type="number"
                min={0}
                max={12}
                value={capo}
                onChange={(e) => setCapo(Math.max(0, Math.min(12, Number(e.target.value))))}
                className="w-20"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => v && setDifficulty(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto">
              <Button variant="outline" onClick={() => setScrapeOpen((o) => !o)}>
                <Link2 />
                Scrape song
              </Button>
            </div>
          </div>

          {scrapeOpen && (
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <p className="text-sm font-medium">Fetch lyrics &amp; chords from a URL</p>
              <div className="flex gap-2">
                <Input placeholder="https://…" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} className="flex-1" />
                <Button onClick={handleScrape} disabled={scraping}>
                  {scraping ? <Loader2 className="animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Demo: fills in mock lyrics for &ldquo;{title || "your song"}&rdquo;.
              </p>
            </div>
          )}
        </section>

        <Separator />

        {/* ── Chords & Lyrics ───────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Music4 className="size-4" />}
            title="Chords & Lyrics"
            hint="Write chords in brackets over your lyrics."
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="chordsheet">Editor</Label>
              <Button
                variant={finderOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFinderOpen((o) => !o)}
                aria-expanded={finderOpen}
              >
                <Wand2 />
                Chord finder
              </Button>
            </div>

            <textarea
              id="chordsheet"
              ref={textareaRef}
              value={chordSheet}
              onChange={(e) => setChordSheet(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder={"[Verse]\n[G]Here is a [D]line with [Em]chords\n[C]Another line below"}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
            />
            <p className="text-xs text-muted-foreground">
              Put chords in brackets right before the syllable, e.g.{" "}
              <code className="rounded bg-muted px-1 py-0.5">[Am]</code>. A line like{" "}
              <code className="rounded bg-muted px-1 py-0.5">[Verse 1]</code> becomes a section header.
            </p>

            {finderOpen && (
              <ChordPanel chords={allChords} onAddChord={addChord} onInsert={insertChord} />
            )}
          </div>
        </section>

        <Separator />

        {/* ── Tab ───────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Guitar className="size-4" />}
            title="Tab"
            hint="Add fret-by-fret lines for riffs and intros."
          />

          <div className="space-y-1.5">
            <Label>Editor</Label>
            <TabEditor columns={tabCols} onChange={setTabCols} tuning={tuning} onTuningChange={setTuning} />
          </div>
        </section>

        <Separator />

        {/* ── Strumming ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Strumming pattern</h2>
            <p className="text-xs text-muted-foreground">Build the strum — add bars for longer patterns.</p>
          </div>
          <StrummingEditor pattern={pattern} onChange={setPattern} />
        </section>

        <Separator />

        <div className="flex justify-end gap-3">
          <Button variant="outline">Save draft</Button>
          <Button>Publish note</Button>
        </div>
      </div>

      {/* ══ Preview (right) ═════════════════════════════════════════ */}
      <NotePreview
        title={title}
        artist={artist}
        songKey={key}
        capo={capo}
        difficulty={difficulty}
        pattern={pattern}
        chords={allChords}
        sheet={chordSheet}
        tabCols={tabCols}
      />
    </div>
  );
}

/** Heading row shown above each content section. */
function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h2 className="font-heading text-base font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** Small uppercase label separating blocks inside the preview sheet. */
function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * A single "sheet of paper" that mirrors how the finished note reads once
 * published, showing everything in reading order:
 *   1. title & artist
 *   2. key · capo · difficulty
 *   3. strumming pattern
 *   4. every chord shape used in the song
 *   5. the chords-over-lyrics body and the tab
 * Font size is adjustable so long lines and tabs can be checked.
 */
function NotePreview({
  title,
  artist,
  songKey,
  capo,
  difficulty,
  pattern,
  chords,
  sheet,
  tabCols,
}: {
  title: string;
  artist: string;
  songKey: string;
  capo: number;
  difficulty: string;
  pattern: StrokeType[];
  chords: string[];
  sheet: string;
  tabCols: TabColumn[];
}) {
  const [fontSize, setFontSize] = useState(16);
  const clamp = (v: number) => setFontSize(Math.min(MAX_FONT, Math.max(MIN_FONT, v)));

  const hasPattern = pattern.some((s) => s !== "");
  const hasSheet = sheet.trim().length > 0;
  const hasTab = tabCols.some((col) => col.some((v) => v !== ""));
  const hasBody = hasPattern || chords.length > 0 || hasSheet || hasTab;

  return (
    <div className="lg:sticky lg:top-20">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            Preview
          </div>
          <div className="flex items-center gap-1">
            <Type className="size-3.5 text-muted-foreground" />
            <Button variant="ghost" size="icon-xs" onClick={() => clamp(fontSize - 1)} aria-label="Smaller text">
              <Minus />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => clamp(fontSize + 1)} aria-label="Larger text">
              <Plus />
            </Button>
          </div>
        </div>

        {/* Body — the note as it will read */}
        <div className="max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto p-5">
          {/* 1. Title & artist  ·  2. key / capo / difficulty */}
          <header>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {title || <span className="text-muted-foreground">Untitled note</span>}
            </h2>
            <p className="mt-0.5 text-base text-muted-foreground">
              {artist || "Unknown artist"}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">Key {songKey}</Badge>
              {capo > 0 ? (
                <Badge variant="secondary">Capo {capo}</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">No capo</span>
              )}
              <span className="text-xs text-muted-foreground">
                {DIFFICULTY_LABEL[difficulty]}
              </span>
            </div>
          </header>

          {/* 3. Strumming pattern */}
          {hasPattern && (
            <section>
              <PreviewLabel>Strumming</PreviewLabel>
              <StrummingPreview pattern={pattern} />
            </section>
          )}

          {/* 4. Every chord used in the song */}
          {chords.length > 0 && (
            <section>
              <PreviewLabel>
                Chords in this song ({chords.length})
              </PreviewLabel>
              <div className="flex flex-wrap gap-3">
                {chords.map((c) => (
                  <ChordDiagram key={c} name={c} className="w-16" />
                ))}
              </div>
            </section>
          )}

          {/* 5a. Chords over lyrics */}
          {hasSheet && (
            <section>
              <PreviewLabel>Chords &amp; lyrics</PreviewLabel>
              <div className="overflow-x-auto">
                <ChordLyricsView sheet={sheet} fontSize={fontSize} />
              </div>
            </section>
          )}

          {/* 5b. Tab */}
          {hasTab && (
            <section>
              <PreviewLabel>Tab</PreviewLabel>
              <TabView tab={tabCols} fontSize={fontSize} />
            </section>
          )}

          {!hasBody && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center">
              <Music4 className="size-6 text-muted-foreground/40" />
              <p className="max-w-[18rem] text-sm text-muted-foreground">
                Add a strumming pattern, chords, lyrics or a tab on the left and
                it will all appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
