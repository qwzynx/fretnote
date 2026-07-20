import Link from "next/link";
import { Bookmark, Heart, Music4, Guitar } from "lucide-react";

import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DIFFICULTY_LABEL: Record<Note["difficulty"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function NoteCard({ note }: { note: Note }) {
  return (
    <Card className="group/note gap-0 py-0 transition-colors hover:ring-primary/40">
      <Link href={`/notes/${note.id}`} className="outline-none">
        <CardContent className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 text-primary"
            >
              {note.type === "tab" ? (
                <Guitar className="size-3" />
              ) : (
                <Music4 className="size-3" />
              )}
              {note.type === "tab" ? "Tab" : "Chords"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {DIFFICULTY_LABEL[note.difficulty]}
            </span>
          </div>

          <div>
            <h3 className="font-heading text-lg leading-tight font-semibold group-hover/note:text-primary">
              {note.title}
            </h3>
            <p className="text-sm text-muted-foreground">{note.artist}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {note.chords.slice(0, 5).map((c) => (
              <span
                key={c}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80"
              >
                {c}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Key {note.key}</span>
            <span>·</span>
            <span>{note.capo > 0 ? `Capo ${note.capo}` : "No capo"}</span>
          </div>
        </CardContent>
      </Link>

      <CardFooter className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-background"
            style={{ backgroundColor: note.author.avatarColor }}
          >
            {initials(note.author.name)}
          </span>
          <span className="text-xs text-muted-foreground">
            @{note.author.handle}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3.5" />
            {note.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark className="size-3.5" />
            {note.saves}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

export function NoteCardCompact({ note }: { note: Note }) {
  return (
    <Link
      href={`/notes/${note.id}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{note.title}</p>
        <p className="truncate text-xs text-muted-foreground">{note.artist}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 font-mono">
        {note.key}
      </Badge>
    </Link>
  );
}
