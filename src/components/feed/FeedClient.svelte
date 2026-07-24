<script lang="ts">
  import { PlusCircle, Search } from "@lucide/svelte";
  import type { Note, NoteType } from "@/lib/types";
  import Input from "@/components/ui/Input.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Select from "@/components/ui/Select.svelte";
  import NoteCard from "@/components/notes/NoteCard.svelte";
  import { cn } from "@/lib/utils";

  import { Heart } from "@lucide/svelte";

  type Filter = "all" | NoteType | "favorites";
  type Sort = "newest" | "oldest" | "title";

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "chords", label: "Chords" },
    { value: "tab", label: "Tabs" },
    { value: "favorites", label: "Favorites" },
  ];

  const SORT_ITEMS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "title", label: "A → Z" },
  ];

  let {
    notes,
    onToggleFavorite,
    query = $bindable(""),
  }: {
    notes: Note[];
    onToggleFavorite?: (id: string, value: boolean) => void;
    query?: string;
  } = $props();

  let _query = $state(query);
  $effect(() => { query = _query; });
  let filter = $state<Filter>("all");
  let sort = $state<Sort>("newest");

  const results = $derived(() => {
    const q = _query.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (filter === "favorites") return !!n.isFavorite;
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
  });
</script>

{#if notes.length === 0}
  <div class="rounded-xl border border-dashed border-border py-20 text-center">
    <p class="text-sm text-muted-foreground">No notes yet. Create your first one!</p>
    <Button size="sm" class="mt-4" href="#/create">
      <PlusCircle />
      Create a note
    </Button>
  </div>
{:else}
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          bind:value={_query}
          placeholder="Search songs, artists, tags or a chord…"
          class="h-10 pl-9"
        />
      </div>

      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-border p-0.5">
          {#each FILTERS as f}
            <button
              type="button"
              onclick={() => (filter = f.value)}
              class={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {#if f.value === "favorites"}
                <Heart class="size-3" />
              {/if}
              {f.label}
            </button>
          {/each}
        </div>

        <Select
          bind:value={sort}
          items={SORT_ITEMS}
          class="h-10"
        />
      </div>
    </div>

    <p class="mb-4 mt-4 text-sm text-muted-foreground">
      {results().length}
      {results().length === 1 ? "note" : "notes"}
    </p>

    {#if results().length === 0}
      <div class="rounded-xl border border-dashed border-border py-16 text-center">
        <p class="text-sm text-muted-foreground">No notes match your search.</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3"
          onclick={() => {
            _query = "";
            filter = "all";
          }}
        >
          Clear filters
        </Button>
      </div>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each results() as note (note.id)}
          <NoteCard {note} {onToggleFavorite} />
        {/each}
      </div>
    {/if}
  </div>
{/if}
