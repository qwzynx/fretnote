
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Minus,
  Pause,
  Play,
  Plus,
  Type,
} from "lucide-react";

import type { Note } from "@/lib/types";
import { formatSemitones, transposeKey } from "@/lib/music/transpose";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ChordLyricsView } from "./chord-lyrics-view";
import { ChordDiagram } from "./chord-diagram";
import { TabView } from "./tab-view";

const MIN_FONT = 12;
const MAX_FONT = 26;

export function NoteReader({ note }: { note: Note }) {
  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(30);

  useAutoScroll(scrolling, speed);

  const clampFont = (v: number) =>
    setFontSize(Math.min(MAX_FONT, Math.max(MIN_FONT, v)));

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/80 bg-background/85 px-4 py-2.5 backdrop-blur">
        {note.type === "chords" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Transpose</span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setTranspose((t) => t - 1)}
              aria-label="Transpose down"
            >
              <Minus />
            </Button>
            <span className="min-w-14 text-center font-mono text-sm">
              {transposeKey(note.key, transpose)}{" "}
              <span className="text-muted-foreground">
                ({formatSemitones(transpose)})
              </span>
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setTranspose((t) => t + 1)}
              aria-label="Transpose up"
            >
              <Plus />
            </Button>
            {transpose !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTranspose(0)}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        )}

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1.5">
          <Type className="size-4 text-muted-foreground" />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => clampFont(fontSize - 1)}
            aria-label="Decrease font size"
          >
            <Minus />
          </Button>
          <span className="w-6 text-center font-mono text-sm">{fontSize}</span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => clampFont(fontSize + 1)}
            aria-label="Increase font size"
          >
            <Plus />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Button
            variant={scrolling ? "default" : "outline"}
            size="sm"
            onClick={() => setScrolling((s) => !s)}
          >
            {scrolling ? <Pause /> : <Play />}
            Auto-scroll
          </Button>
          <div className="flex w-28 items-center gap-2">
            <Slider
              value={speed}
              min={5}
              max={100}
              step={5}
              onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)}
              aria-label="Auto-scroll speed"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      {note.type === "chords" && note.chordSheet ? (
        <ChordLyricsView
          sheet={note.chordSheet}
          transpose={transpose}
          fontSize={fontSize}
          tabBlocks={note.tabBlocks}
        />
      ) : note.tabBlocks?.length ? (
        <div className="space-y-6">
          {note.tabBlocks.map((block) => (
            <div key={block.id}>
              {block.label && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {block.label}
                </p>
              )}
              <TabView tab={block.columns} fontSize={fontSize} />
            </div>
          ))}
        </div>
      ) : null}

      {/* Chords used */}
      {note.chords.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ChevronDown className="size-4" />
            Chords in this note
          </div>
          <div className="flex flex-wrap gap-4">
            {note.chords.map((c) => (
              <ChordDiagram
                key={c}
                name={transposeKey(c, note.type === "chords" ? transpose : 0)}
                className="w-20"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Smoothly scrolls the window while enabled; speed in px/sec. */
function useAutoScroll(enabled: boolean, speed: number) {
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const step = (ts: number) => {
      if (last.current) {
        const dt = (ts - last.current) / 1000;
        window.scrollBy(0, speed * dt);
        const atBottom =
          window.innerHeight + window.scrollY >=
          document.body.scrollHeight - 1;
        if (atBottom) {
          last.current = 0;
          raf.current = null;
          return;
        }
      }
      last.current = ts;
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [enabled, speed]);
}
