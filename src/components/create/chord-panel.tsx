"use client";

import { useState, useCallback } from "react";
import { Plus, Search, Guitar, X } from "lucide-react";

import { detectChord } from "@/lib/music/chord-detect";
import { DEFAULT_TUNING } from "@/lib/music/tunings";
import { getChordShape } from "@/lib/music/chords";
import { ChordDiagram } from "@/components/notes/chord-diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Frets = [number, number, number, number, number, number];

// High-e on top, low-E at bottom for display in the guesser.
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0] as const;
const FRET_SLOTS = [-1, 0, 1, 2, 3, 4, 5, 6, 7] as const;

interface ChordPanelProps {
  chords: string[];
  onChordsChange: (chords: string[]) => void;
}

export function ChordPanel({ chords, onChordsChange }: ChordPanelProps) {
  const [mode, setMode] = useState<"search" | "guess">("search");
  const [query, setQuery] = useState("");
  const [guessFrets, setGuessFrets] = useState<Frets>([-1, -1, -1, -1, -1, -1]);

  const searchResult = query.trim() ? getChordShape(query.trim()) : null;
  const detectedChord = detectChord(guessFrets, DEFAULT_TUNING);

  function addChord(name: string) {
    if (!chords.includes(name)) onChordsChange([...chords, name]);
  }

  function removeChord(name: string) {
    onChordsChange(chords.filter((c) => c !== name));
  }

  const setGuessFret = useCallback((strIdx: number, fret: number) => {
    setGuessFrets((prev) => {
      const next = [...prev] as Frets;
      next[strIdx] = fret;
      return next;
    });
  }, []);

  function resetGuesser() {
    setGuessFrets([-1, -1, -1, -1, -1, -1]);
  }

  return (
    <div className="space-y-4">
      {/* Chord chip list */}
      {chords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chords.map((ch) => (
            <div
              key={ch}
              className="group relative inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {ch}
              <button
                onClick={() => removeChord(ch)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${ch}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setMode("search")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "search" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="size-3.5" />
          Search
        </button>
        <button
          onClick={() => setMode("guess")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "guess" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Guitar className="size-3.5" />
          Detect from frets
        </button>
      </div>

      {/* Search mode */}
      {mode === "search" && (
        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <Input
              placeholder="e.g. Am7, Bm, Cadd9…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-44"
            />
            {query.trim() && (
              <p className={cn("text-xs", searchResult ? "text-muted-foreground" : "text-destructive")}>
                {searchResult ? "Chord found" : "No shape found"}
              </p>
            )}
          </div>

          {query.trim() && searchResult && (
            <div className="flex flex-col items-center gap-2">
              <ChordDiagram name={query.trim()} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => { addChord(query.trim()); setQuery(""); }}
              >
                <Plus />
                Add to note
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Guess mode */}
      {mode === "guess" && (
        <div className="flex flex-wrap items-start gap-6">
          {/* Fretboard picker */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Click a fret on each string (standard tuning):</p>
            <div className="rounded-lg border border-border bg-card/60 p-3 space-y-0.5">
              {DISPLAY_ORDER.map((strIdx, rowIdx) => {
                const label = DEFAULT_TUNING.names[strIdx];
                const current = guessFrets[strIdx];
                return (
                  <div key={strIdx} className="flex items-center gap-1">
                    <span className="w-5 text-right text-xs font-mono text-muted-foreground">{label}</span>
                    <div className="flex gap-0.5">
                      {/* Mute button */}
                      <FretSlotButton
                        label="✕"
                        active={current === -1}
                        onClick={() => setGuessFret(strIdx, current === -1 ? -1 : -1)}
                        onToggle={() => setGuessFret(strIdx, current === -1 ? 0 : -1)}
                        title="Muted"
                      />
                      {/* Fret buttons 0-7 */}
                      {FRET_SLOTS.filter((f) => f >= 0).map((f) => (
                        <FretSlotButton
                          key={f}
                          label={f === 0 ? "0" : String(f)}
                          active={current === f}
                          onToggle={() => setGuessFret(strIdx, current === f ? -1 : f)}
                          title={f === 0 ? "Open" : `Fret ${f}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={resetGuesser} className="text-xs text-muted-foreground hover:text-foreground underline">
              Reset
            </button>
          </div>

          {/* Detection result */}
          <div className="flex flex-col items-center gap-2 min-w-[100px]">
            {detectedChord ? (
              <>
                <ChordDiagram name={detectedChord} />
                <p className="text-sm font-semibold text-primary">{detectedChord}</p>
                <Button size="sm" variant="outline" onClick={() => addChord(detectedChord)}>
                  <Plus />
                  Add to note
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-4">
                Select frets to detect a chord
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FretSlotButton({
  label,
  active,
  onToggle,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick ?? onToggle}
      title={title}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded text-xs font-mono transition-colors",
        "border border-border",
        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
