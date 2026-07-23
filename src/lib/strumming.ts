export type StrokeType = "D" | "U" | "d" | "u" | "X" | "";

export const STROKE_CYCLE: StrokeType[] = ["D", "U", "d", "u", "X", ""];

export const STROKE_DISPLAY: Record<
  StrokeType,
  { symbol: string; label: string; className: string }
> = {
  D: { symbol: "↓", label: "Down", className: "text-primary" },
  U: { symbol: "↑", label: "Up", className: "text-primary" },
  d: { symbol: "↓", label: "Soft down", className: "text-primary/50" },
  u: { symbol: "↑", label: "Soft up", className: "text-primary/40" },
  X: { symbol: "✕", label: "Mute / chuck", className: "text-muted-foreground" },
  "": { symbol: "·", label: "Rest", className: "text-muted-foreground/30" },
};

export const LABELS_8 = ["1", "&", "2", "&", "3", "&", "4", "&"];
export const LABELS_16 = [
  "1", "e", "&", "a",
  "2", "e", "&", "a",
  "3", "e", "&", "a",
  "4", "e", "&", "a",
];

export function emptyPattern(): StrokeType[] {
  return Array(8).fill("") as StrokeType[];
}
