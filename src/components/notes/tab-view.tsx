
import type { TabColumn } from "@/lib/types";
import { TAB_STRING_LABELS } from "@/lib/types";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/utils";

interface TabViewProps {
  tab: TabColumn[];
  fontSize?: number;
  className?: string;
}

// Display rows run high-e (top) -> low-E (bottom); map to column indices.
const ROW_TO_STRING = [5, 4, 3, 2, 1, 0];

// Monospace advance is ~0.6em; nudged up slightly so a full row leaves a hair
// of slack rather than triggering a horizontal scrollbar.
const CHAR_EM = 0.62;

/** Build the 6 stave lines (high-e first) for one slice of columns. */
function buildStave(cols: TabColumn[], cellWidth: number): string[] {
  return ROW_TO_STRING.map((stringIdx, rowIdx) => {
    const label = TAB_STRING_LABELS[rowIdx];
    let line = `${label}|`;
    for (const col of cols) {
      const raw = col[stringIdx] === "" ? "-" : col[stringIdx];
      line += "-" + raw.padEnd(cellWidth, "-");
    }
    line += "-|";
    return line;
  });
}

/**
 * Render a 6-string tab as monospace ASCII. When the columns are wider than
 * the container they wrap onto stacked staves, the way printed tab breaks a
 * long line across several rows instead of scrolling off the page.
 */
export function TabView({ tab, fontSize = 15, className }: TabViewProps) {
  const [boxRef, innerWidth] = useElementWidth<HTMLDivElement>();

  const cellWidth = Math.max(
    1,
    ...tab.flatMap((col) => col.map((v) => v.length))
  );

  // Columns that fit on one stave: total chars minus the "e|" head and "-|"
  // tail, divided by each column's width (a leading "-" plus the padded cell).
  const charPx = fontSize * CHAR_EM;
  const usableChars = innerWidth > 0 ? Math.floor(innerWidth / charPx) - 3 : 0;
  const perRow =
    usableChars > 0
      ? Math.max(1, Math.floor(usableChars / (cellWidth + 1)))
      : tab.length || 1;

  const chunks: TabColumn[][] = [];
  for (let i = 0; i < tab.length; i += perRow) {
    chunks.push(tab.slice(i, i + perRow));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card/60 p-4",
        className
      )}
    >
      <div className="flex flex-col gap-4">
        {chunks.map((chunk, i) => (
          <pre
            key={i}
            className="font-mono leading-6 text-foreground"
            style={{ fontSize }}
          >
            {buildStave(chunk, cellWidth).join("\n")}
          </pre>
        ))}
      </div>
    </div>
  );
}
