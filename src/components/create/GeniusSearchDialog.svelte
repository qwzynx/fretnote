<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Loader2, Music4, Search, X } from "@lucide/svelte";
  import { searchGenius, getGeniusLyrics, type GeniusHit } from "@/lib/genius";
  import { getGeniusToken } from "@/lib/genius-settings";
  import Input from "@/components/ui/Input.svelte";
  import Button from "@/components/ui/Button.svelte";

  let {
    open,
    initialTitle,
    initialArtist,
    onclose,
    onselect,
  }: {
    open: boolean;
    initialTitle: string;
    initialArtist: string;
    onclose: () => void;
    onselect: (result: { title: string; artist: string; lyrics: string }) => void;
  } = $props();

  let query = $state("");
  let results = $state<GeniusHit[]>([]);
  let hasSearched = $state(false);
  let searching = $state(false);
  let importingUrl = $state<string | null>(null);
  let error = $state<string | null>(null);

  const hasToken = $derived(!!getGeniusToken());

  $effect(() => {
    if (open) {
      query = `${initialTitle} ${initialArtist}`.trim();
      results = [];
      hasSearched = false;
      error = null;
    }
  });

  async function runSearch() {
    if (!query.trim() || !hasToken) return;
    searching = true;
    error = null;
    try {
      results = await searchGenius(query.trim());
      hasSearched = true;
    } catch {
      error = "Search failed. Check your connection and try again.";
    } finally {
      searching = false;
    }
  }

  async function pick(hit: GeniusHit) {
    importingUrl = hit.url;
    try {
      const lyrics = await getGeniusLyrics(hit.url);
      onselect({ title: hit.title, artist: hit.artist, lyrics });
      onclose();
    } catch {
      error = "Couldn't load lyrics for that result.";
    } finally {
      importingUrl = null;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Search Genius"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
    onkeydown={handleKeydown}
  >
    <div class="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2 font-medium">
          <Search class="size-4 text-primary" />
          Search Genius
        </div>
        <button
          type="button"
          onclick={onclose}
          class="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X class="size-4" />
        </button>
      </div>

      {#if !hasToken}
        <div class="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Music4 class="size-6 text-muted-foreground/40" />
          <p class="max-w-[20rem] text-sm text-muted-foreground">
            Add a Genius API token in Settings to search for lyrics.
          </p>
          <Button
            variant="outline"
            size="sm"
            onclick={() => { onclose(); push("/settings"); }}
          >
            Open Settings
          </Button>
        </div>
      {:else}
        <div class="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Input
            placeholder="Song title and artist"
            bind:value={query}
            onkeydown={(e: KeyboardEvent) => e.key === "Enter" && runSearch()}
            class="flex-1"
          />
          <Button size="sm" disabled={!query.trim() || searching} onclick={runSearch}>
            {#if searching}
              <Loader2 class="animate-spin" />
            {:else}
              <Search />
            {/if}
            Search
          </Button>
        </div>

        <div class="max-h-80 overflow-y-auto py-1">
          {#if error}
            <p class="px-4 py-4 text-sm text-destructive">{error}</p>
          {:else if searching}
            <p class="px-4 py-4 text-sm text-muted-foreground">Searching…</p>
          {:else if hasSearched && results.length === 0}
            <p class="px-4 py-4 text-sm text-muted-foreground">No results.</p>
          {:else if !hasSearched}
            <p class="px-4 py-4 text-sm text-muted-foreground">
              Search Genius to see matching songs.
            </p>
          {:else}
            {#each results as hit (hit.id)}
              <button
                type="button"
                onclick={() => pick(hit)}
                disabled={!!importingUrl}
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted disabled:opacity-50"
              >
                {#if hit.thumbnailUrl}
                  <img
                    src={hit.thumbnailUrl}
                    alt=""
                    class="size-10 shrink-0 rounded object-cover"
                  />
                {:else}
                  <span class="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <Music4 class="size-4" />
                  </span>
                {/if}
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{hit.title}</span>
                  <span class="block truncate text-xs text-muted-foreground">{hit.artist}</span>
                </span>
                {#if importingUrl === hit.url}
                  <Loader2 class="size-4 shrink-0 animate-spin text-muted-foreground" />
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
