<script lang="ts">
  import { PlusCircle, Search, SearchX, Music4 } from "@lucide/svelte";
  import type { NoteSummary, NoteType } from "@/lib/types";
  import Input from "@/components/ui/Input.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Select from "@/components/ui/Select.svelte";
  import NoteCard from "@/components/notes/NoteCard.svelte";
  import EmptyState from "@/components/ui/EmptyState.svelte";
  import { cn } from "@/lib/utils";
  import { goto } from "@/lib/nav-stack.svelte";

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
    onDelete,
    query = $bindable(""),
  }: {
    notes: NoteSummary[];
    onToggleFavorite?: (id: string, value: boolean) => void;
    onDelete?: (id: string) => void;
    query?: string;
  } = $props();

  let _query = $state(query);
  let filter = $state<Filter>("all");
  let sort = $state<Sort>("newest");

  function setQuery(next: string) {
    _query = next;
    // Writing the prop here rather than from an $effect: the effect version
    // re-rendered the parent page on every keystroke, which re-ran its own
    // derivations as a side effect of typing.
    query = next;
  }

  /**
   * `$derived.by` memoizes the result. The previous `$derived(() => …)` form
   * memoized the arrow function instead — its identity never changes, so
   * nothing was ever cached and each of the four `results()` reads below
   * re-filtered, re-copied and re-sorted the entire library. Every keystroke
   * did that work four times over.
   */
  const filtering = $derived(_query.trim() !== "" || filter !== "all");

  const results = $derived.by(() => {
    const q = _query.trim().toLowerCase();
    const list = notes.filter((n) => {
      // Favourites used to `return` here, which skipped the query entirely —
      // searching with the filter on showed every favourite regardless.
      if (filter === "favorites") {
        if (!n.isFavorite) return false;
      } else if (filter !== "all" && n.type !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.artist.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        // `includes`, to agree with the search palette — this was an exact
        // match here, so "Am" found nothing while the palette found "Am7".
        n.chords.some((c) => c.toLowerCase().includes(q))
      );
    });

    return list.sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "title") return a.title.localeCompare(b.title);
      return b.createdAt.localeCompare(a.createdAt);
    });
  });
</script>

{#if notes.length === 0}
  <EmptyState
    icon={Music4}
    title="No songs yet"
    description="Write out a chord sheet or tab and it'll live here, searchable and ready to play."
  >
    {#snippet action()}
      <Button href="#/create" onclick={(e: MouseEvent) => goto("/create", e)}>
        <PlusCircle />
        Create a note
      </Button>
    {/snippet}
  </EmptyState>
{:else}
  <div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={_query}
          oninput={(e: Event) =>
            setQuery((e.currentTarget as HTMLInputElement).value)}
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

    <!-- The page header already states the library total, so this only earns
         its space once a filter or query has narrowed things. -->
    <div class="mb-4 mt-3 flex min-h-9 items-center justify-between gap-3 sm:mt-4">
      <p class="text-sm text-muted-foreground" aria-live="polite">
        {#if filtering}
          {results.length} of {notes.length}
          {notes.length === 1 ? "song" : "songs"}
        {/if}
      </p>
      <Select bind:value={sort} items={SORT_ITEMS} size="sm" class="sm:hidden" />
    </div>

    {#if results.length === 0}
      <EmptyState
        icon={SearchX}
        size="compact"
        title="Nothing matches"
        description={_query
          ? `No song matches "${_query}" with the current filter.`
          : "No song matches the current filter."}
      >
        {#snippet action()}
          <Button
            variant="outline"
            onclick={() => {
              setQuery("");
              filter = "all";
            }}
          >
            Clear filters
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {#each results as note (note.id)}
          <NoteCard {note} {onToggleFavorite} {onDelete} swipeActions />
        {/each}
      </div>
    {/if}
  </div>
{/if}
