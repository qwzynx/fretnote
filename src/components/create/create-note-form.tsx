"use client";

import { useState } from "react";
import { Link2, Loader2, Music4, Guitar, ChevronDown, ChevronUp } from "lucide-react";

import type { NoteType, TabColumn } from "@/lib/types";
import { getMockLyrics } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TabEditor } from "./tab-editor";
import { ChordPanel } from "./chord-panel";
import { StrummingEditor, emptyPattern, type StrokeType } from "./strumming-editor";
import { cn } from "@/lib/utils";

const DEFAULT_TAB: TabColumn[] = Array.from({ length: 8 }, () => ["", "", "", "", "", ""] as TabColumn);

const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export function CreateNoteForm() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [key, setKey] = useState("C");
  const [capo, setCapo] = useState(0);
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("beginner");
  const [type, setType] = useState<NoteType>("chords");
  const [chordSheet, setChordSheet] = useState("");
  const [tabCols, setTabCols] = useState<TabColumn[]>(DEFAULT_TAB);
  const [chords, setChords] = useState<string[]>([]);
  const [pattern, setPattern] = useState<StrokeType[]>(emptyPattern());

  // Scrape
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scraping, setScraping] = useState(false);

  // Section collapse state
  const [showChords, setShowChords] = useState(true);
  const [showStrumming, setShowStrumming] = useState(true);

  async function handleScrape() {
    setScraping(true);
    // Simulate network delay, then use mock lyrics.
    await new Promise((r) => setTimeout(r, 800));
    const lyrics = getMockLyrics(artist, title);
    setChordSheet(lyrics);
    setScraping(false);
    setScrapeOpen(false);
    setScrapeUrl("");
  }

  return (
    <div className="space-y-8">
      {/* ── Metadata ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Song title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="artist">Artist</Label>
            <Input
              id="artist"
              placeholder="Artist name"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="key">Key</Label>
            <select
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capo">Capo</Label>
            <Input
              id="capo"
              type="number"
              min={0}
              max={12}
              value={capo}
              onChange={(e) => setCapo(Number(e.target.value))}
              className="w-20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="difficulty">Difficulty</Label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Note type + Scrape ────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Type toggle */}
          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <TypeButton
              active={type === "chords"}
              onClick={() => setType("chords")}
              icon={<Music4 className="size-3.5" />}
              label="Chords"
            />
            <TypeButton
              active={type === "tab"}
              onClick={() => setType("tab")}
              icon={<Guitar className="size-3.5" />}
              label="Tab"
            />
          </div>

          {/* Scrape button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScrapeOpen((o) => !o)}
            >
              <Link2 />
              Scrape song
            </Button>
          </div>
        </div>

        {/* Scrape panel */}
        {scrapeOpen && (
          <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
            <p className="text-sm font-medium">Fetch lyrics / chords from a URL</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://…"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleScrape} disabled={scraping}>
                {scraping ? <Loader2 className="animate-spin" /> : "Fetch"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Demo: fills in mock lyrics for &ldquo;{title || "your song"}&rdquo;.
            </p>
          </div>
        )}

        {/* ── Chord sheet editor ─────────────────────────────────── */}
        {type === "chords" && (
          <div className="space-y-2">
            <Label htmlFor="chordsheet">Chord sheet</Label>
            <p className="text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1 py-0.5">[ChordName]</code> inline before the syllable,{" "}
              <code className="rounded bg-muted px-1 py-0.5">[Section]</code> on its own line.
            </p>
            <textarea
              id="chordsheet"
              value={chordSheet}
              onChange={(e) => setChordSheet(e.target.value)}
              rows={14}
              spellCheck={false}
              placeholder={`[Verse]\n[G]Here is a [D]line with [Em]chords\n[C]Another line below`}
              className={cn(
                "w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              )}
            />
          </div>
        )}

        {/* ── Tab editor ─────────────────────────────────────────── */}
        {type === "tab" && (
          <TabEditor columns={tabCols} onChange={setTabCols} />
        )}
      </section>

      <Separator />

      {/* ── Chords section ─────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Chords"
          description="Add the chords used in this note."
          open={showChords}
          onToggle={() => setShowChords((o) => !o)}
        />
        {showChords && (
          <ChordPanel chords={chords} onChordsChange={setChords} />
        )}
      </section>

      <Separator />

      {/* ── Strumming pattern ──────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Strumming Pattern"
          description="Click beats to set the strumming pattern (16 subdivisions)."
          open={showStrumming}
          onToggle={() => setShowStrumming((o) => !o)}
        />
        {showStrumming && (
          <StrummingEditor pattern={pattern} onChange={setPattern} />
        )}
      </section>

      <Separator />

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">Save draft</Button>
        <Button>Publish note</Button>
      </div>
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionHeader({
  title,
  description,
  open,
  onToggle,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between text-left"
    >
      <div>
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {open ? (
        <ChevronUp className="size-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}
