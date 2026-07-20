"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import type { Note, NoteType } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteCard } from "@/components/notes/note-card";

type Filter = "all" | NoteType;
type Sort = "trending" | "newest" | "likes";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chords", label: "Chords" },
  { value: "tab", label: "Tabs" },
];

export function FeedClient({ notes }: { notes: Note[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("trending");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (filter !== "all" && n.type !== filter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.artist.toLowerCase().includes(q) ||
        n.author.name.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        n.chords.some((c) => c.toLowerCase() === q)
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "newest")
        return b.createdAt.localeCompare(a.createdAt);
      if (sort === "likes") return b.likes - a.likes;
      // trending: blend of likes + saves
      return b.likes + b.saves * 2 - (a.likes + a.saves * 2);
    });
    return list;
  }, [notes, query, filter, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, tags or a chord…"
            className="h-10 pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition-colors " +
                  (filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-10">
              <SlidersHorizontal className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="likes">Most liked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-4 mb-4 text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? "note" : "notes"}
      </p>

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No notes match your search.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
