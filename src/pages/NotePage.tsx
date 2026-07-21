import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Guitar, Music4, Pencil, Trash2 } from "lucide-react";

import { getNote, deleteNote } from "@/lib/db";
import type { Note } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NoteReader } from "@/components/notes/note-reader";

const DIFFICULTY_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getNote(id).then(setNote);
  }, [id]);

  async function handleDelete() {
    if (!note) return;
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    await deleteNote(note.id);
    navigate("/");
  }

  if (note === undefined) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (note === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Note not found.</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          render={<Link to="/" />}
        >
          Back to notes
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          render={<Link to="/" />}
        >
          <ArrowLeft />
          Back to notes
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link to={`/notes/${note.id}/edit`} />}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
            {note.type === "tab" ? (
              <Guitar className="size-3" />
            ) : (
              <Music4 className="size-3" />
            )}
            {note.type === "tab" ? "Tab" : "Chords"}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Key {note.key}
          </Badge>
          {note.capo > 0 && (
            <Badge variant="secondary">Capo {note.capo}</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {DIFFICULTY_LABEL[note.difficulty]}
          </span>
        </div>

        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {note.title}
        </h1>
        <p className="mt-1 text-lg text-muted-foreground">{note.artist}</p>

        {note.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {note.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </header>

      <Separator className="mb-2" />

      <NoteReader note={note} />
    </main>
  );
}
