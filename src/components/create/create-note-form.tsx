"use client";

import { useMemo, useRef, useState } from "react";
import { Link2, Loader2, Music4, Guitar } from "lucide-react";

import type { TabColumn } from "@/lib/types";
import { getMockLyrics } from "@/lib/mock-data";
import { extractChords } from "@/lib/music/parse";
import { DEFAULT_TUNING, type Tuning } from "@/lib/music/tunings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChordLyricsView } from "@/components/notes/chord-lyrics-view";
import { NoteSummary } from "./note-summary";
import { TabEditor } from "./tab-editor";
import { ChordPanel } from "./chord-panel";
import { StrummingEditor, emptyPattern, type StrokeType } from "./strumming-editor";

const DEFAULT_TAB: TabColumn[] = Array.from({ length: 8 }, () => ["", "", "", "", "", ""] as TabColumn);

const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Am", "Em", "Bm", "Dm", "F#m", "Cm"];
const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

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

  const [editorTab, setEditorTab] = useState("lyrics");

  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scraping, setScraping] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chords for the summary = those written in the sheet plus any added by hand.
  const allChords = useMemo(
    () => dedupe([...extractChords(chordSheet), ...manualChords]),
    [chordSheet, manualChords]
  );

  const hasTabContent = tabCols.some((col) => col.some((v) => v !== ""));

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
    setEditorTab("lyrics");
  }

  return (
    <div className="space-y-8">
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

      {/* ── Summary (chords + tab + strumming at a glance) ─────────── */}
      <NoteSummary chords={allChords} tab={hasTabContent ? tabCols : null} pattern={pattern} />

      <Separator />

      {/* ── Editor: Lyrics & Chords / Tab ─────────────────────────── */}
      <section className="space-y-4">
        <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as string)}>
          <TabsList>
            <TabsTrigger value="lyrics">
              <Music4 />
              Lyrics &amp; Chords
            </TabsTrigger>
            <TabsTrigger value="tab">
              <Guitar />
              Tab
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lyrics" className="pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Editable source */}
              <div className="space-y-1.5">
                <Label htmlFor="chordsheet">Editor</Label>
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
              </div>

              {/* Live preview: chords sitting above each lyric line */}
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <div className="min-h-[16rem] rounded-lg border border-border bg-card/60 p-4">
                  {chordSheet.trim() ? (
                    <ChordLyricsView sheet={chordSheet} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your chords will appear above the lyrics here as you type.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tab" className="pt-4">
            <TabEditor columns={tabCols} onChange={setTabCols} tuning={tuning} onTuningChange={setTuning} />
          </TabsContent>
        </Tabs>

        {/* Combined chord tools — search a chord or detect it from frets, then
            add it to the note or drop it straight into the lyrics. */}
        <div className="space-y-2">
          <Label>Chord finder</Label>
          <ChordPanel
            chords={allChords}
            onAddChord={addChord}
            onInsert={editorTab === "lyrics" ? insertChord : undefined}
          />
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
  );
}
