"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrokeType = "D" | "U" | "d" | "u" | "X" | "";

const STROKE_CYCLE: StrokeType[] = ["D", "U", "d", "u", "X", ""];

const STROKE_DISPLAY: Record<StrokeType, { symbol: string; label: string; color: string }> = {
  D: { symbol: "↓", label: "Down", color: "text-primary" },
  U: { symbol: "↑", label: "Up", color: "text-primary/70" },
  d: { symbol: "↓", label: "Soft down", color: "text-primary/50" },
  u: { symbol: "↑", label: "Soft up", color: "text-primary/40" },
  X: { symbol: "✕", label: "Mute", color: "text-muted-foreground" },
  "": { symbol: "·", label: "Rest", color: "text-muted-foreground/30" },
};

// Beat labels for 16 16th-note subdivisions.
const BEAT_LABELS = ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"];
// Highlight the quarter-note beats.
const IS_BEAT = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];

interface StrummingEditorProps {
  pattern: StrokeType[];
  onChange: (pattern: StrokeType[]) => void;
}

export function StrummingEditor({ pattern, onChange }: StrummingEditorProps) {
  function cycleStroke(idx: number) {
    const current = pattern[idx];
    const nextIdx = (STROKE_CYCLE.indexOf(current) + 1) % STROKE_CYCLE.length;
    const next = [...pattern] as StrokeType[];
    next[idx] = STROKE_CYCLE[nextIdx];
    onChange(next);
  }

  function reset() {
    onChange(Array(16).fill("") as StrokeType[]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Click to cycle: ↓ down · ↑ up · ↓ soft · ↑ soft · ✕ mute · · rest
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Reset
        </button>
      </div>

      {/* Pattern grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* Beat labels */}
          <div className="flex gap-1">
            {BEAT_LABELS.map((lbl, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-5 w-8 items-center justify-center text-[10px]",
                  IS_BEAT[i] ? "font-bold text-foreground" : "text-muted-foreground/50"
                )}
              >
                {lbl}
              </div>
            ))}
          </div>

          {/* Stroke buttons */}
          <div className="flex gap-1">
            {pattern.map((stroke, i) => {
              const info = STROKE_DISPLAY[stroke];
              return (
                <button
                  key={i}
                  onClick={() => cycleStroke(i)}
                  title={info.label}
                  className={cn(
                    "flex h-10 w-8 items-center justify-center rounded-md border text-lg font-bold transition-colors",
                    IS_BEAT[i] ? "border-border/80" : "border-border/40 bg-muted/20",
                    stroke !== "" && "border-primary/40 bg-primary/5",
                    info.color
                  )}
                >
                  {info.symbol}
                </button>
              );
            })}
          </div>

          {/* Bar separator indicator */}
          <div className="flex gap-1">
            {BEAT_LABELS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-8 rounded-full",
                  IS_BEAT[i] ? "bg-border/60" : "bg-transparent"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Text preview */}
      {pattern.some((s) => s !== "") && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 font-mono text-sm tracking-widest text-foreground">
          {pattern.map((s, i) => (
            <span key={i}>
              {s === "" ? (IS_BEAT[i] ? "-" : ".") : s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function emptyPattern(): StrokeType[] {
  return Array(16).fill("") as StrokeType[];
}
