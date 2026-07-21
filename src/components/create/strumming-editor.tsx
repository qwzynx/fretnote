
import { useState } from "react";
import { RotateCcw, Plus, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StrokeType = "D" | "U" | "d" | "u" | "X" | "";

const STROKE_CYCLE: StrokeType[] = ["D", "U", "d", "u", "X", ""];

const STROKE_DISPLAY: Record<StrokeType, { symbol: string; label: string; className: string }> = {
  D: { symbol: "↓", label: "Down", className: "text-primary" },
  U: { symbol: "↑", label: "Up", className: "text-primary" },
  d: { symbol: "↓", label: "Soft down", className: "text-primary/50" },
  u: { symbol: "↑", label: "Soft up", className: "text-primary/40" },
  X: { symbol: "✕", label: "Mute / chuck", className: "text-muted-foreground" },
  "": { symbol: "·", label: "Rest", className: "text-muted-foreground/30" },
};

const LABELS_8 = ["1", "&", "2", "&", "3", "&", "4", "&"];
const LABELS_16 = ["1", "e", "&", "a", "2", "e", "&", "a", "3", "e", "&", "a", "4", "e", "&", "a"];

export function emptyPattern(): StrokeType[] {
  return Array(8).fill("") as StrokeType[];
}

interface StrummingEditorProps {
  pattern: StrokeType[];
  onChange: (pattern: StrokeType[]) => void;
}

export function StrummingEditor({ pattern, onChange }: StrummingEditorProps) {
  // Slots per bar: 8 = eighth notes, 16 = sixteenth notes.
  const [subdivision, setSubdivision] = useState<8 | 16>(8);
  const labels = subdivision === 8 ? LABELS_8 : LABELS_16;

  function cycleStroke(idx: number) {
    const cur = pattern[idx];
    const next = [...pattern] as StrokeType[];
    next[idx] = STROKE_CYCLE[(STROKE_CYCLE.indexOf(cur) + 1) % STROKE_CYCLE.length];
    onChange(next);
  }

  function addBar() {
    onChange([...pattern, ...(Array(subdivision).fill("") as StrokeType[])]);
  }

  function removeBar() {
    if (pattern.length > subdivision) onChange(pattern.slice(0, -subdivision));
  }

  function reset() {
    onChange(Array(subdivision).fill("") as StrokeType[]);
  }

  const isDownbeat = (i: number) => i % (subdivision === 8 ? 2 : 4) === 0;
  const bars = Math.ceil(pattern.length / subdivision);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <DensityButton active={subdivision === 8} onClick={() => setSubdivision(8)} label="8ths" />
          <DensityButton active={subdivision === 16} onClick={() => setSubdivision(16)} label="16ths" />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{bars} bar{bars !== 1 ? "s" : ""}</span>
          <Button variant="outline" size="sm" onClick={removeBar} disabled={pattern.length <= subdivision}>
            <Minus />
            Bar
          </Button>
          <Button variant="outline" size="sm" onClick={addBar}>
            <Plus />
            Bar
          </Button>
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a box to cycle: ↓ down · ↑ up · faint ↓↑ soft · ✕ mute · · rest
      </p>

      {/* Grid, wrapped by bar */}
      <div className="flex flex-wrap gap-x-4 gap-y-3 rounded-xl border border-border bg-card/60 p-4">
        {Array.from({ length: bars }, (_, bar) => {
          const start = bar * subdivision;
          const slots = pattern.slice(start, start + subdivision);
          return (
            <div key={bar} className="flex flex-col gap-1">
              {/* beat labels */}
              <div className="flex gap-1">
                {slots.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex h-4 w-8 items-center justify-center text-[10px]",
                      isDownbeat(start + i) ? "font-bold text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {labels[(start + i) % subdivision]}
                  </div>
                ))}
              </div>
              {/* stroke buttons */}
              <div className="flex gap-1">
                {slots.map((stroke, i) => {
                  const info = STROKE_DISPLAY[stroke];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => cycleStroke(start + i)}
                      title={info.label}
                      className={cn(
                        "flex h-11 w-8 items-center justify-center rounded-md border text-xl font-bold transition-colors",
                        isDownbeat(start + i) ? "border-border" : "border-border/40 bg-muted/20",
                        stroke !== "" && "border-primary/40 bg-primary/5",
                        info.className
                      )}
                    >
                      {info.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DensityButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

/** Compact read-only view of a strumming pattern for the summary. */
export function StrummingPreview({ pattern }: { pattern: StrokeType[] }) {
  if (!pattern.some((s) => s !== "")) return null;
  return (
    <div className="flex flex-wrap gap-0.5 font-mono text-lg leading-none">
      {pattern.map((s, i) => (
        <span key={i} className={cn("w-5 text-center", STROKE_DISPLAY[s].className)}>
          {STROKE_DISPLAY[s].symbol}
        </span>
      ))}
    </div>
  );
}
