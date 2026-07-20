import { getChordShape } from "@/lib/music/chords";
import { cn } from "@/lib/utils";

interface ChordDiagramProps {
  name: string;
  className?: string;
  /** Number of fret rows to draw. */
  frets?: number;
}

/**
 * Renders a guitar chord diagram as an SVG. Strings are drawn low-E (left)
 * to high-e (right), matching a chart viewed as if the guitar faces you.
 */
export function ChordDiagram({
  name,
  className,
  frets = 5,
}: ChordDiagramProps) {
  const shape = getChordShape(name);

  const W = 100;
  const H = 132;
  const padX = 12;
  const padTop = 26;
  const gridW = W - padX * 2;
  const gridH = 78;
  const strings = 6;
  const stringGap = gridW / (strings - 1);
  const fretGap = gridH / frets;
  const baseFret = shape?.baseFret ?? 1;

  const x = (s: number) => padX + s * stringGap;
  const y = (f: number) => padTop + f * fretGap;

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[110px]"
        role="img"
        aria-label={`${name} chord diagram`}
      >
        {/* chord name */}
        <text
          x={W / 2}
          y={14}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          {name}
        </text>

        {/* nut (thick) when starting at fret 1, else base-fret label */}
        {baseFret === 1 ? (
          <rect
            x={padX}
            y={padTop - 2}
            width={gridW}
            height={3}
            className="fill-foreground/70"
          />
        ) : (
          <text
            x={padX - 4}
            y={padTop + fretGap / 2 + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {baseFret}fr
          </text>
        )}

        {/* fret lines */}
        {Array.from({ length: frets + 1 }).map((_, f) => (
          <line
            key={`f${f}`}
            x1={padX}
            y1={y(f)}
            x2={padX + gridW}
            y2={y(f)}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}

        {/* strings */}
        {Array.from({ length: strings }).map((_, s) => (
          <line
            key={`s${s}`}
            x1={x(s)}
            y1={padTop}
            x2={x(s)}
            y2={padTop + gridH}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}

        {shape ? (
          <>
            {/* barre */}
            {shape.barre && (
              <rect
                x={x(shape.barre.from) - 4}
                y={y(shape.barre.fret - baseFret) + fretGap / 2 - 4}
                width={x(shape.barre.to) - x(shape.barre.from) + 8}
                height={8}
                rx={4}
                className="fill-primary"
              />
            )}

            {/* open / muted markers + fretted dots */}
            {shape.frets.map((fret, s) => {
              if (fret === -1) {
                return (
                  <text
                    key={`m${s}`}
                    x={x(s)}
                    y={padTop - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 10 }}
                  >
                    ×
                  </text>
                );
              }
              if (fret === 0) {
                return (
                  <circle
                    key={`o${s}`}
                    cx={x(s)}
                    cy={padTop - 8}
                    r={3}
                    className="fill-none stroke-muted-foreground"
                    strokeWidth={1}
                  />
                );
              }
              // Skip a dot that is covered by the barre at the same fret.
              if (shape.barre && shape.barre.fret === fret) return null;
              return (
                <circle
                  key={`d${s}`}
                  cx={x(s)}
                  cy={y(fret - baseFret) + fretGap / 2}
                  r={5}
                  className="fill-primary"
                />
              );
            })}
          </>
        ) : (
          <text
            x={W / 2}
            y={padTop + gridH / 2}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 11 }}
          >
            shape n/a
          </text>
        )}
      </svg>
    </div>
  );
}
