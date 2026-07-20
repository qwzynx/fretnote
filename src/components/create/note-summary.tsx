"use client";

import { Guitar, Music4, ListMusic } from "lucide-react";

import type { TabColumn } from "@/lib/types";
import { ChordDiagram } from "@/components/notes/chord-diagram";
import { TabView } from "@/components/notes/tab-view";
import { StrummingPreview, type StrokeType } from "./strumming-editor";

interface NoteSummaryProps {
  chords: string[];
  tab: TabColumn[] | null;
  pattern: StrokeType[];
}

/**
 * The "at a glance" header for a note: the chord shapes, the tab, and the
 * strumming pattern gathered into one place above the editor.
 */
export function NoteSummary({ chords, tab, pattern }: NoteSummaryProps) {
  const hasTab = !!tab && tab.some((col) => col.some((v) => v !== ""));
  const hasStrum = pattern.some((s) => s !== "");
  const hasAny = chords.length > 0 || hasTab || hasStrum;

  if (!hasAny) return null;

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-primary/5 p-5 space-y-5">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-primary">
        <ListMusic className="size-4" />
        Summary
      </h2>

      {chords.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Music4 className="size-3.5" />
            Chords ({chords.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {chords.map((c) => (
              <ChordDiagram key={c} name={c} className="w-16" />
            ))}
          </div>
        </div>
      )}

      {hasTab && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Guitar className="size-3.5" />
            Tab
          </p>
          <TabView tab={tab!} fontSize={13} />
        </div>
      )}

      {hasStrum && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Strumming</p>
          <StrummingPreview pattern={pattern} />
        </div>
      )}
    </section>
  );
}
