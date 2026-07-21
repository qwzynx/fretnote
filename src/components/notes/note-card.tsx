import { Link } from "react-router-dom";
import { Guitar, Music4 } from "lucide-react";

import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const DIFFICULTY_LABEL: Record<Note["difficulty"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function NoteCard({ note }: { note: Note }) {
  return (
    <Card className="group/note gap-0 py-0 transition-colors hover:ring-primary/40">
      <Link to={`/notes/${note.id}`} className="outline-none">
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
        <span className="text-xs text-muted-foreground">
          {new Date(note.createdAt).toLocaleDateString()}
        </span>
        <span className="text-xs text-muted-foreground">
          {note.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
        </span>
      </CardFooter>
    </Card>
  );
}

export function NoteCardCompact({ note }: { note: Note }) {
  return (
    <Link
      to={`/notes/${note.id}`}
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
