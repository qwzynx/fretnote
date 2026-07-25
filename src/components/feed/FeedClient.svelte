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
  <div class="rounded-xl border border-dashed border-border px-4 py-14 text-center sm:py-20">
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
          type="search"
          placeholder="Search songs, artists, tags…"
          class="h-11 pl-9 sm:h-10"
        />
      </div>

      <!-- Filters scroll sideways on phones instead of wrapping into rows. -->
      <div class="flex items-center gap-2">
        <div
          class="no-scrollbar -mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-none sm:gap-0 sm:rounded-lg sm:border sm:border-border sm:px-0 sm:p-0.5"
        >
          {#each FILTERS as f}
            <button
              type="button"
              onclick={() => (filter = f.value)}
              class={cn(
                "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-4 text-sm transition-colors sm:h-auto sm:rounded-md sm:border-transparent sm:px-3 sm:py-1.5",
                filter === f.value
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
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
          class="hidden h-10 sm:inline-flex"
        />
      </div>
    </div>

    <div class="mb-4 mt-3 flex items-center justify-between gap-3 sm:mt-4">
      <p class="text-sm text-muted-foreground">
        {results().length}
        {results().length === 1 ? "note" : "notes"}
      </p>
      <Select bind:value={sort} items={SORT_ITEMS} size="sm" class="sm:hidden" />
    </div>

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
      <div class="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {#each results() as note (note.id)}
          <NoteCard {note} {onToggleFavorite} />
        {/each}
      </div>
    {/if}
  </div>
{/if}
