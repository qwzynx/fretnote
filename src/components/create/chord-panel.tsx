"use client";

import { useState } from "react";
import { Plus, Search, Guitar, CornerDownLeft, RotateCcw } from "lucide-react";

import { detectChord } from "@/lib/music/chord-detect";
import { TUNINGS, DEFAULT_TUNING, type Tuning } from "@/lib/music/tunings";
import { getChordShape } from "@/lib/music/chords";
import { ChordDiagram } from "@/components/notes/chord-diagram";
import { FretboardInput, type Frets } from "./fretboard-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_FRETS: Frets = [-1, -1, -1, -1, -1, -1];

interface ChordPanelProps {
  /** Chords already on the note (used to disable duplicate adds). */
  chords: string[];
  onAddChord: (name: string) => void;
  /** When provided, an "Insert" button drops [chord] into the lyric editor. */
  onInsert?: (name: string) => void;
}

export function ChordPanel({ chords, onAddChord, onInsert }: ChordPanelProps) {
  const [mode, setMode] = useState<"search" | "detect">("search");
  const [query, setQuery] = useState("");
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING);
  const [frets, setFrets] = useState<Frets>(EMPTY_FRETS);

  const trimmed = query.trim();
  const searchResult = trimmed ? getChordShape(trimmed) : null;
  const detected = detectChord(frets, tuning);

  const active = mode === "search" ? (searchResult ? trimmed : null) : detected;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
          <ModeButton active={mode === "search"} onClick={() => setMode("search")} icon={<Search className="size-3.5" />} label="Search" />
          <ModeButton active={mode === "detect"} onClick={() => setMode("detect")} icon={<Guitar className="size-3.5" />} label="Detect from frets" />
        </div>
        {mode === "detect" && (
          <Select value={tuning.id} onValueChange={(v) => setTuning(TUNINGS.find((t) => t.id === v) ?? DEFAULT_TUNING)}>
            <SelectTrigger size="sm" className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TUNINGS.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Input side */}
        <div className="space-y-3">
          {mode === "search" ? (
            <div className="space-y-1.5">
              <Input
                placeholder="Type a chord — Am7, Cadd9, F#m…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-56"
                autoFocus
              />
              {trimmed && !searchResult && (
                <p className="text-xs text-destructive">No shape found for &ldquo;{trimmed}&rdquo;.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <FretboardInput frets={frets} onChange={setFrets} stringNames={tuning.names} />
              <button
                type="button"
                onClick={() => setFrets(EMPTY_FRETS)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Clear fretboard
              </button>
            </div>
          )}
        </div>

        {/* Result side */}
        <div className="flex min-w-[7rem] flex-col items-center gap-2">
          {active ? (
            <>
              <ChordDiagram name={active} className="w-24" />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddChord(active)}
                  disabled={chords.includes(active)}
                >
                  <Plus />
                  {chords.includes(active) ? "Added" : "Add chord"}
                </Button>
                {onInsert && (
                  <Button size="sm" onClick={() => onInsert(active)}>
                    <CornerDownLeft />
                    Insert
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="max-w-[8rem] pt-6 text-center text-xs text-muted-foreground">
              {mode === "search"
                ? "Type a chord name to preview it."
                : "Tap frets to detect the chord you're holding."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
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
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
