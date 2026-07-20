"use client";

import { useMemo } from "react";

import type { TabBlock } from "@/lib/types";
import { parseChordSheet } from "@/lib/music/parse";
import { transposeChordSheet } from "@/lib/music/transpose";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChordDiagram } from "./chord-diagram";
import { TabView } from "./tab-view";

interface ChordLyricsViewProps {
  sheet: string;
  /** Semitone transposition applied to every chord. */
  transpose?: number;
  /** Base font size in px for the lyric text. */
  fontSize?: number;
  /** Named tab blocks; a `[tab: Name]` line renders the matching one inline. */
  tabBlocks?: TabBlock[];
  className?: string;
}

export function ChordLyricsView({
  sheet,
  transpose = 0,
  fontSize = 16,
  tabBlocks = [],
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
        if (line.kind === "tabref") {
          const block = tabBlocks.find(
            (b) => b.label.trim().toLowerCase() === line.name.toLowerCase()
          );
          return (
            <div key={i} className="my-3">
              <div className="mb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
                {block?.label || line.name}
              </div>
              {block ? (
                <TabView tab={block.columns} fontSize={fontSize} />
              ) : (
                <div
                  className="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-sm text-muted-foreground"
                  style={{ fontSize: fontSize * 0.85 }}
                >
                  No tab named &ldquo;{line.name}&rdquo; yet.
                </div>
              )}
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
