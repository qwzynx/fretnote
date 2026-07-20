"use client";

import { useRef } from "react";
import { Plus, Trash2, Eraser } from "lucide-react";

import type { TabColumn } from "@/lib/types";
import { TUNINGS, DEFAULT_TUNING, type Tuning } from "@/lib/music/tunings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Display rows: high-e (string index 5) on top, low-E (index 0) at the bottom.
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0] as const;

function sanitize(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "" ) return "";
  if (v === "x") return "x";
  // keep leading digits only, clamp to two chars
  const digits = v.replace(/[^0-9]/g, "").slice(0, 2);
  return digits;
}

interface TabEditorProps {
  columns: TabColumn[];
  onChange: (cols: TabColumn[]) => void;
  tuning: Tuning;
  onTuningChange: (t: Tuning) => void;
}

export function TabEditor({ columns, onChange, tuning, onTuningChange }: TabEditorProps) {
  // refs[rowIdx][colIdx] — rowIdx follows DISPLAY_ORDER.
  const refs = useRef<(HTMLInputElement | null)[][]>([]);

  function setCell(colIdx: number, strIdx: number, value: string) {
    const next = columns.map((col, ci) =>
      ci === colIdx
        ? (col.map((v, si) => (si === strIdx ? value : v)) as TabColumn)
        : col
    );
    onChange(next);
  }

  function focusCell(rowIdx: number, colIdx: number) {
    refs.current[rowIdx]?.[colIdx]?.focus();
    refs.current[rowIdx]?.[colIdx]?.select();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) {
    const lastCol = columns.length - 1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (colIdx < lastCol) focusCell(rowIdx, colIdx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (colIdx > 0) focusCell(rowIdx, colIdx - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < 5) focusCell(rowIdx + 1, colIdx);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (colIdx === lastCol) {
        addColumn();
        // focus the new cell after render
        requestAnimationFrame(() => focusCell(rowIdx, colIdx + 1));
      } else {
        focusCell(rowIdx, colIdx + 1);
      }
    }
  }

  function addColumn() {
    onChange([...columns, ["", "", "", "", "", ""]]);
  }

  function removeLastColumn() {
    if (columns.length > 1) onChange(columns.slice(0, -1));
  }

  function clearAll() {
    onChange(columns.map(() => ["", "", "", "", "", ""] as TabColumn));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Tuning</span>
        <Select value={tuning.id} onValueChange={(v) => onTuningChange(TUNINGS.find((t) => t.id === v) ?? DEFAULT_TUNING)}>
          <SelectTrigger size="sm" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TUNINGS.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-1.5">
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus />
            Column
          </Button>
          <Button variant="outline" size="sm" onClick={removeLastColumn} disabled={columns.length <= 1}>
            <Trash2 />
            Remove
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            <Eraser />
            Clear
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card/60 p-4">
        <div className="inline-flex flex-col gap-1 font-mono text-sm">
          {DISPLAY_ORDER.map((strIdx, rowIdx) => (
            <div key={strIdx} className="flex items-center">
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                {tuning.names[strIdx]}
              </span>
              <span className="text-muted-foreground/60">|</span>
              {columns.map((col, ci) => (
                <div key={ci} className="flex items-center">
                  <span className="text-muted-foreground/30 select-none">–</span>
                  <input
                    ref={(el) => {
                      (refs.current[rowIdx] ??= [])[ci] = el;
                    }}
                    value={col[strIdx]}
                    onChange={(e) => setCell(ci, strIdx, sanitize(e.target.value))}
                    onKeyDown={(e) => handleKeyDown(e, rowIdx, ci)}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    placeholder="–"
                    className="h-7 w-6 rounded bg-transparent text-center text-foreground caret-primary outline-none placeholder:text-muted-foreground/30 focus:bg-primary/15 focus:text-primary"
                  />
                </div>
              ))}
              <span className="text-muted-foreground/30 select-none">–</span>
              <span className="text-muted-foreground/60">|</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a cell and type a fret number. Use <kbd className="rounded border border-border px-1">x</kbd> for a
        muted note, arrow keys to move, and <kbd className="rounded border border-border px-1">Enter</kbd> to add a
        column.
      </p>
    </div>
  );
}
