
import { useRef } from "react";
import { Plus, Trash2, Eraser, X, CornerDownLeft } from "lucide-react";

import type { TabBlock, TabColumn } from "@/lib/types";
import type { Tuning } from "@/lib/music/tunings";
import { useElementWidth } from "@/hooks/use-element-width";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Display rows: high-e (string index 5) on top, low-E (index 0) at the bottom.
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0] as const;

// Pixel budget of the grid, at text-sm: a column is the "–" separator plus the
// w-6 input (~32px), and each stave reserves a gutter for the string label,
// the leading bar, and the trailing "–|".
const COL_W = 32;
const GUTTER_W = 48;

const emptyColumn = (): TabColumn => ["", "", "", "", "", ""];

function sanitize(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === "") return "";
  if (v === "x") return "x";
  // keep leading digits only, clamp to two chars
  const digits = v.replace(/[^0-9]/g, "").slice(0, 2);
  return digits;
}

interface TabEditorProps {
  block: TabBlock;
  onChange: (block: TabBlock) => void;
  onRemove: () => void;
  /** Drop a `[tab: Label]` reference into the song at the cursor. */
  onInsert: () => void;
  tuning: Tuning;
}

export function TabEditor({ block, onChange, onRemove, onInsert, tuning }: TabEditorProps) {
  const { columns } = block;
  // refs[rowIdx][colIdx] — rowIdx follows DISPLAY_ORDER, colIdx is the logical
  // (unwrapped) column index so arrow-key navigation ignores the visual wrap.
  const refs = useRef<(HTMLInputElement | null)[][]>([]);
  const [boxRef, innerWidth] = useElementWidth<HTMLDivElement>();

  const perRow =
    innerWidth > 0
      ? Math.max(1, Math.floor((innerWidth - GUTTER_W) / COL_W))
      : columns.length || 1;

  // Slices of logical column indices, one per stave.
  const chunks: number[][] = [];
  for (let i = 0; i < columns.length; i += perRow) {
    const end = Math.min(i + perRow, columns.length);
    chunks.push(Array.from({ length: end - i }, (_, k) => i + k));
  }

  function setColumns(next: TabColumn[]) {
    onChange({ ...block, columns: next });
  }

  function setCell(colIdx: number, strIdx: number, value: string) {
    setColumns(
      columns.map((col, ci) =>
        ci === colIdx
          ? (col.map((v, si) => (si === strIdx ? value : v)) as TabColumn)
          : col
      )
    );
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
    setColumns([...columns, emptyColumn()]);
  }

  function removeLastColumn() {
    if (columns.length > 1) setColumns(columns.slice(0, -1));
  }

  function clearAll() {
    setColumns(columns.map(() => emptyColumn()));
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
      {/* Header: label + insert + remove */}
      <div className="flex items-center gap-2">
        <Input
          value={block.label}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          placeholder="Section, e.g. Intro"
          className="h-8 max-w-56"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onInsert}
          disabled={!block.label.trim()}
          className="ml-auto"
          title={block.label.trim() ? undefined : "Name the tab first"}
        >
          <CornerDownLeft />
          Insert in song
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="text-muted-foreground"
          aria-label="Remove tab"
        >
          <X />
        </Button>
      </div>

      {/* Grid — wraps onto stacked staves when it runs out of width */}
      <div
        ref={boxRef}
        className="overflow-x-auto rounded-lg border border-border bg-card/60 p-4"
      >
        <div className="flex flex-col gap-4">
          {chunks.map((colIdxs, ci) => (
            <div key={ci} className="inline-flex flex-col gap-1 font-mono text-sm">
              {DISPLAY_ORDER.map((strIdx, rowIdx) => (
                <div key={strIdx} className="flex items-center">
                  <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {tuning.names[strIdx]}
                  </span>
                  <span className="text-muted-foreground/60">|</span>
                  {colIdxs.map((globalCi) => (
                    <div key={globalCi} className="flex items-center">
                      <span className="text-muted-foreground/30 select-none">–</span>
                      <input
                        ref={(el) => {
                          (refs.current[rowIdx] ??= [])[globalCi] = el;
                        }}
                        value={columns[globalCi][strIdx]}
                        onChange={(e) => setCell(globalCi, strIdx, sanitize(e.target.value))}
                        onKeyDown={(e) => handleKeyDown(e, rowIdx, globalCi)}
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
          ))}
        </div>
      </div>

      {/* Per-block actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus />
          Column
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={removeLastColumn}
          disabled={columns.length <= 1}
        >
          <Trash2 />
          Remove
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-muted-foreground"
        >
          <Eraser />
          Clear
        </Button>
      </div>
    </div>
  );
}
