
import { useState } from "react";
import { Plus, Search, Guitar, CornerDownLeft, RotateCcw, Check } from "lucide-react";

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

// A handful of common shapes for one-tap insertion.
const QUICK_CHORDS = ["G", "C", "D", "Em", "Am", "E", "A", "F", "Dm", "G7"];

interface ChordPanelProps {
  /** Chords already on the note (used to mark duplicates). */
  chords: string[];
  onAddChord: (name: string) => void;
  /** When provided, an "Insert" action drops [chord] into the lyric editor. */
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
  const alreadyAdded = active ? chords.includes(active) : false;

  /** Drop the chord straight into the lyrics, or fall back to adding it. */
  function place(name: string) {
    if (onInsert) onInsert(name);
    else onAddChord(name);
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20">
      {/* Header: title + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Search className="size-3.5 text-primary" />
            Chord finder
          </p>
          <p className="text-xs text-muted-foreground">
            {onInsert
              ? "Find a shape, then drop it into your lyrics at the cursor."
              : "Look up a shape and add it to the note."}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
          <ModeButton active={mode === "search"} onClick={() => setMode("search")} icon={<Search className="size-3.5" />} label="Search" />
          <ModeButton active={mode === "detect"} onClick={() => setMode("detect")} icon={<Guitar className="size-3.5" />} label="From frets" />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-4">
        {/* Input side */}
        <div className="min-w-[14rem] flex-1 space-y-3">
          {mode === "search" ? (
            <>
              <div className="space-y-1.5">
                <Input
                  placeholder="Type a chord — Am7, Cadd9, F#m…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full"
                />
                {trimmed && !searchResult && (
                  <p className="text-xs text-destructive">No shape found for &ldquo;{trimmed}&rdquo;.</p>
                )}
              </div>

              {/* Quick picks — one tap to place a common chord. */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Common chords</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHORDS.map((name) => {
                    const added = chords.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => place(name)}
                        title={onInsert ? `Insert [${name}]` : `Add ${name}`}
                        className={cn(
                          "rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors",
                          added
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Tap frets to name the shape</span>
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
              </div>
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
        <div className="flex min-w-[8rem] flex-col items-center gap-2.5">
          {active ? (
            <>
              <ChordDiagram name={active} className="w-24" />
              <div className="flex w-full flex-col gap-1.5">
                {onInsert && (
                  <Button size="sm" onClick={() => onInsert(active)}>
                    <CornerDownLeft />
                    Insert in lyrics
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddChord(active)}
                  disabled={alreadyAdded}
                >
                  {alreadyAdded ? <Check /> : <Plus />}
                  {alreadyAdded ? "On note" : "Add to note"}
                </Button>
              </div>
            </>
          ) : (
            <p className="max-w-[9rem] pt-6 text-center text-xs text-muted-foreground">
              {mode === "search"
                ? "Type a chord name to preview its shape."
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
