import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Sparkles } from "lucide-react";

import { listNotes } from "@/lib/db";
import type { Note } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FeedClient } from "@/components/feed/feed-client";

export function FeedPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listNotes()
      .then(setNotes)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="mb-10 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-8 sm:p-10">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/25">
            <Sparkles className="size-3.5" />
            Your personal songbook
          </span>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Chords &amp; tabs for every song you love.
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Write a note, line the chords up with the lyrics, transpose to your
            voice — all saved locally on your device.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" render={<Link to="/create" />}>
              <PlusCircle />
              Create a note
            </Button>
            <Button size="lg" variant="outline" render={<a href="#feed" />}>
              Browse your notes
            </Button>
          </div>
        </div>
      </section>

      <section id="feed" className="scroll-mt-20">
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Your notes
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <FeedClient
            notes={notes}
            onDelete={(id) => setNotes((n) => n.filter((x) => x.id !== id))}
          />
        )}
      </section>
    </main>
  );
}
