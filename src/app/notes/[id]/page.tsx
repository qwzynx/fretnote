import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, Guitar, Heart, Music4, Share2 } from "lucide-react";

import { getNoteById } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NoteReader } from "@/components/notes/note-reader";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const note = getNoteById(id);
  if (!note) return { title: "Note not found" };
  return {
    title: `${note.title} — ${note.artist}`,
    description: `${note.type === "tab" ? "Tab" : "Chords"} for ${note.title} by ${note.artist}, key of ${note.key}.`,
  };
}

const DIFFICULTY_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export default async function NotePage({ params }: PageProps) {
  const { id } = await params;
  const note = getNoteById(id);
  if (!note) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/" />}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ArrowLeft />
        Back to feed
      </Button>

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

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-background"
              style={{ backgroundColor: note.author.avatarColor }}
            >
              {note.author.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div className="text-sm">
              <p className="font-medium leading-none">{note.author.name}</p>
              <p className="text-xs text-muted-foreground">
                @{note.author.handle}
              </p>
            </div>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Heart />
              {note.likes}
            </Button>
            <Button variant="outline" size="sm">
              <Bookmark />
              Save
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Share">
              <Share2 />
            </Button>
          </div>
        </div>

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
