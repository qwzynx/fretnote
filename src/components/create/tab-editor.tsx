"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";

import type { TabColumn } from "@/lib/types";
import type { Tuning } from "@/lib/music/tunings";
import { TUNINGS, DEFAULT_TUNING } from "@/lib/music/tunings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Tab display order: high-e (index 5) on top, low-E (index 0) at bottom.
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0] as const;

const FRET_OPTIONS = ["X", "0", ...Array.from({ length: 22 }, (_, i) => String(i + 1))];

interface FretPickerProps {
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function FretPicker({ value, onSelect, onClose }: FretPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-52 rounded-lg border border-border bg-popover p-2 shadow-lg"
    >
      <div className="grid grid-cols-6 gap-1">
        {FRET_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => { onSelect(opt === "X" ? "-1" : opt); onClose(); }}
            className={cn(
              "flex h-7 w-full items-center justify-center rounded text-xs font-mono transition-colors hover:bg-primary/20",
              value === (opt === "X" ? "-1" : opt) && "bg-primary text-primary-foreground"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-1 w-full rounded py-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        cancel
      </button>
    </div>
  );
}

interface TabEditorProps {
  columns: TabColumn[];
  onChange: (cols: TabColumn[]) => void;
}

export function TabEditor({ columns, onChange }: TabEditorProps) {
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING);
  const [activePicker, setActivePicker] = useState<{ col: number; str: number } | null>(null);

  function setCell(colIdx: number, strIdx: number, value: string) {
    const next = columns.map((col, ci) =>
      ci === colIdx
        ? (col.map((v, si) => (si === strIdx ? (value === "-1" || value === "" ? "" : value) : v)) as TabColumn)
        : col
    );
    onChange(next);
  }

  function addColumn() {
    onChange([...columns, ["", "", "", "", "", ""]]);
  }

  function removeLastColumn() {
    if (columns.length > 1) onChange(columns.slice(0, -1));
  }

  function clearColumn(ci: number) {
    const next = columns.map((col, i) => (i === ci ? (["", "", "", "", "", ""] as TabColumn) : col));
    onChange(next);
  }

  const displayFret = (raw: string) => (raw === "" ? "-" : raw === "-1" ? "×" : raw);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Tuning:</span>
        <select
          value={tuning.id}
          onChange={(e) => setTuning(TUNINGS.find((t) => t.id === e.target.value) ?? DEFAULT_TUNING)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus />
            Add column
          </Button>
          <Button variant="outline" size="sm" onClick={removeLastColumn} disabled={columns.length <= 1}>
            <Trash2 />
            Remove
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card/60 p-4">
        <div className="inline-flex flex-col gap-0 font-mono text-sm select-none">
          {DISPLAY_ORDER.map((strIdx, rowIdx) => {
            const label = tuning.names[strIdx];
            return (
              <div key={strIdx} className="flex items-center gap-0">
                {/* String label */}
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                  {label}
                </span>
                <span className="text-muted-foreground">|</span>

                {/* Cells */}
                {columns.map((col, ci) => {
                  const raw = col[strIdx];
                  const isActive = activePicker?.col === ci && activePicker?.str === strIdx;

                  return (
                    <div key={ci} className="relative">
                      <button
                        onClick={() =>
                          setActivePicker(isActive ? null : { col: ci, str: strIdx })
                        }
                        className={cn(
                          "min-w-[2.2rem] px-1 py-0.5 text-center transition-colors",
                          "hover:bg-primary/15 hover:text-primary",
                          isActive && "bg-primary/20 text-primary",
                          raw === "-1" && "text-muted-foreground/50",
                          raw !== "" && raw !== "-1" && "text-foreground font-semibold",
                          raw === "" && "text-muted-foreground/30"
                        )}
                      >
                        {displayFret(raw)}
                      </button>

                      {isActive && (
                        <FretPicker
                          value={raw === "" ? "" : raw}
                          onSelect={(v) => setCell(ci, strIdx, v)}
                          onClose={() => setActivePicker(null)}
                        />
                      )}
                    </div>
                  );
                })}

                <span className="text-muted-foreground">|</span>
              </div>
            );
          })}

          {/* Column numbers / clear buttons row */}
          <div className="mt-1 flex items-center gap-0">
            <span className="w-6 shrink-0" />
            <span className="invisible">|</span>
            {columns.map((_, ci) => (
              <button
                key={ci}
                onClick={() => clearColumn(ci)}
                title={`Clear column ${ci + 1}`}
                className="min-w-[2.2rem] px-1 py-0.5 text-center"
              >
                <X className="mx-auto size-2.5 text-muted-foreground/30 hover:text-destructive" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click any cell to set a fret. X = muted string. Click the × below a column to clear it.
      </p>
    </div>
  );
}
