"use client";

import { cn } from "@/lib/utils";

export type Frets = [number, number, number, number, number, number];

// Strings shown left (low-E, index 0) → right (high-e, index 5),
// matching a chord diagram viewed face-on.
const STRING_ORDER = [0, 1, 2, 3, 4, 5] as const;

interface FretboardInputProps {
  frets: Frets;
  onChange: (frets: Frets) => void;
  /** String labels low-E (0) -> high-e (5). */
  stringNames: readonly string[];
  /** Number of fret rows to show. */
  fretCount?: number;
}

/**
 * Interactive chord-diagram input. Strings run top-to-bottom; frets run
 * left-to-right. Layout mirrors the chord diagram SVG used on note cards.
 *
 * - Click a cell to press that fret on that string (or depress it).
 * - Click the ○ / ✕ marker above the nut to toggle open / muted.
 */
export function FretboardInput({
  frets,
  onChange,
  stringNames,
  fretCount = 5,
}: FretboardInputProps) {
  function setString(strIdx: number, value: number) {
    const next = [...frets] as Frets;
    next[strIdx] = value;
    onChange(next);
  }

  const fretRows = Array.from({ length: fretCount }, (_, i) => i + 1);

  // Width of each string column in px (mirrors the SVG cell size).
  const col = "w-9";
  // Height of each fret row.
  const row = "h-9";

  return (
    <div className="inline-flex flex-col items-center gap-0 select-none">
      {/* ── String labels ─────────────────────────────────────────── */}
      <div className="flex">
        {STRING_ORDER.map((s) => (
          <div key={s} className={cn(col, "text-center text-[11px] font-semibold text-muted-foreground pb-1")}>
            {stringNames[s]}
          </div>
        ))}
      </div>

      {/* ── Open / muted markers ──────────────────────────────────── */}
      <div className="flex pb-1">
        {STRING_ORDER.map((s) => {
          const val = frets[s];
          const isMuted = val === -1;
          const isOpen = val === 0;
          return (
            <div key={s} className={cn(col, "flex justify-center")}>
              <button
                type="button"
                onClick={() => setString(s, isMuted ? 0 : -1)}
                title={isMuted ? "Muted — click to open" : isOpen ? "Open — click to mute" : "Click to mute"}
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
                  isMuted
                    ? "border-muted-foreground/60 text-muted-foreground"
                    : isOpen
                    ? "border-foreground/60 text-foreground"
                    : "border-border text-muted-foreground/30 hover:border-muted-foreground/50"
                )}
              >
                {isMuted ? "✕" : "○"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Nut ───────────────────────────────────────────────────── */}
      <div className="flex w-full">
        {STRING_ORDER.map((s) => (
          <div
            key={s}
            className={cn(
              col,
              "h-2 border-t-[3px] border-foreground/70",
              s === 0 && "rounded-tl-sm",
              s === 5 && "rounded-tr-sm"
            )}
          />
        ))}
      </div>

      {/* ── Fret grid ─────────────────────────────────────────────── */}
      <div className="relative rounded-b-sm border-x border-b border-border">
        {/* Vertical string lines (absolute, behind the cells) */}
        <div className="pointer-events-none absolute inset-0 flex">
          {STRING_ORDER.map((s) => (
            <div key={s} className={cn(col, "flex justify-center")}>
              <div className="w-px h-full bg-border" />
            </div>
          ))}
        </div>

        {fretRows.map((f, fi) => (
          <div key={f} className={cn("relative flex", fi < fretRows.length - 1 && "border-b border-border")}>
            {STRING_ORDER.map((s) => {
              const val = frets[s];
              const active = val === f;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setString(s, active ? 0 : f)}
                  aria-label={`String ${stringNames[s]}, fret ${f}${active ? " (active, click to clear)" : ""}`}
                  className={cn(
                    col,
                    row,
                    "relative z-10 flex items-center justify-center transition-colors hover:bg-primary/5"
                  )}
                >
                  {active && (
                    <span className="size-6 rounded-full bg-primary shadow-sm ring-2 ring-primary/30" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
