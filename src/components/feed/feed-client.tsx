
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Search } from "lucide-react";

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
type Sort = "newest" | "oldest" | "title";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chords", label: "Chords" },
  { value: "tab", label: "Tabs" },
];

interface FeedClientProps {
  notes: Note[];
  onDelete?: (id: string) => void;
}

export function FeedClient({ notes, onDelete: _onDelete }: FeedClientProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (filter !== "all" && n.type !== filter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.artist.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        n.chords.some((c) => c.toLowerCase() === q)
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "title") return a.title.localeCompare(b.title);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [notes, query, filter, sort]);

  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-20 text-center">
        <p className="text-sm text-muted-foreground">
          No notes yet. Create your first one!
        </p>
        <Button size="sm" className="mt-4" render={<Link to="/create" />}>
          <PlusCircle />
          Create a note
        </Button>
      </div>
    );
  }

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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title">A → Z</SelectItem>
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
