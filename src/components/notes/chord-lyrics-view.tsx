"use client";

import { useMemo } from "react";

import { parseChordSheet } from "@/lib/music/parse";
import { transposeChordSheet } from "@/lib/music/transpose";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChordDiagram } from "./chord-diagram";

interface ChordLyricsViewProps {
  sheet: string;
  /** Semitone transposition applied to every chord. */
  transpose?: number;
  /** Base font size in px for the lyric text. */
  fontSize?: number;
  className?: string;
}

export function ChordLyricsView({
  sheet,
  transpose = 0,
  fontSize = 16,
  className,
}: ChordLyricsViewProps) {
  const lines = useMemo(
    () => parseChordSheet(transposeChordSheet(sheet, transpose)),
    [sheet, transpose]
  );

  return (
    <div
      className={cn("font-mono leading-relaxed", className)}
      style={{ fontSize }}
    >
      {lines.map((line, i) => {
        if (line.kind === "blank") {
          return <div key={i} style={{ height: fontSize * 1.4 }} />;
        }
        if (line.kind === "section") {
          return (
            <div
              key={i}
              className="mt-4 mb-1 text-xs font-semibold tracking-wide text-primary uppercase first:mt-0"
            >
              {line.label}
            </div>
          );
        }
        return (
          <div key={i} className="flex flex-wrap items-end">
            {line.segments.map((seg, j) => (
              <span key={j} className="inline-flex flex-col">
                <span
                  className="h-5 leading-5 font-semibold text-primary"
                  style={{ fontSize: fontSize * 0.82 }}
                >
                  {seg.chord ? <ChordChip name={seg.chord} /> : " "}
                </span>
                <span className="whitespace-pre">
                  {seg.text === "" ? " " : seg.text}
                </span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ChordChip({ name }: { name: string }) {
  return (
    <Popover>
      <PopoverTrigger
        className="cursor-pointer rounded px-0.5 outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Show ${name} chord diagram`}
      >
        {name}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <ChordDiagram name={name} />
      </PopoverContent>
    </Popover>
  );
}
