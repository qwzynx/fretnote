import type { TabColumn } from "@/lib/types";
import { TAB_STRING_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TabViewProps {
  tab: TabColumn[];
  fontSize?: number;
  className?: string;
}

// Display rows run high-e (top) -> low-E (bottom); map to column indices.
const ROW_TO_STRING = [5, 4, 3, 2, 1, 0];

/** Render a 6-string tab as monospace ASCII wrapped in a scrollable block. */
export function TabView({ tab, fontSize = 15, className }: TabViewProps) {
  const cellWidth = Math.max(
    1,
    ...tab.flatMap((col) => col.map((v) => v.length))
  );

  const rows = ROW_TO_STRING.map((stringIdx, rowIdx) => {
    const label = TAB_STRING_LABELS[rowIdx];
    let line = `${label}|`;
    for (const col of tab) {
      const raw = col[stringIdx] === "" ? "-" : col[stringIdx];
      line += "-" + raw.padEnd(cellWidth, "-");
    }
    line += "-|";
    return line;
  });

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card/60 p-4",
        className
      )}
    >
      <pre
        className="font-mono leading-6 text-foreground"
        style={{ fontSize }}
      >
        {rows.join("\n")}
      </pre>
    </div>
  );
}
