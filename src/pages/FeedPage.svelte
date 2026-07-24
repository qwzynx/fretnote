<script lang="ts">
  import { onMount } from "svelte";
  import { Clock, PlusCircle, Sparkles } from "@lucide/svelte";
  import { listNotes } from "@/lib/db";
  import type { Note } from "@/lib/types";
  import { getRecentIds } from "@/lib/recent";
  import Button from "@/components/ui/Button.svelte";
  import FeedClient from "@/components/feed/FeedClient.svelte";
  import NoteCard from "@/components/notes/NoteCard.svelte";

  let notes = $state<Note[]>([]);
  let loading = $state(true);
  let feedQuery = $state("");

  onMount(async () => {
    try {
      notes = await listNotes();
    } finally {
      loading = false;
    }
  });

  function scrollToFeed() {
    document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleToggleFavorite(id: string, value: boolean) {
    notes = notes.map((n) => (n.id === id ? { ...n, isFavorite: value } : n));
  }

  const recentNotes = $derived(() => {
    const ids = getRecentIds();
    return ids
      .map((id) => notes.find((n) => n.id === id))
      .filter((n): n is Note => !!n);
  });
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8">
  <!-- Hero -->
  <section
    class="mb-10 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-8 sm:p-10"
  >
    <div class="max-w-2xl">
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/25"
      >
        <Sparkles class="size-3.5" />
        Your personal songbook
      </span>
      <h1
        class="mt-4 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
      >
        Chords &amp; tabs for every song you love.
      </h1>
      <p class="mt-3 text-base text-muted-foreground sm:text-lg">
        Write a note, line the chords up with the lyrics, transpose to your
        voice — all saved locally on your device.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <Button size="lg" href="#/create">
          <PlusCircle />
          Create a note
        </Button>
        <Button size="lg" variant="outline" onclick={scrollToFeed}>
          Browse your notes
        </Button>
      </div>
    </div>
  </section>

  <!-- Recently viewed -->
  {#if !loading && recentNotes().length > 0 && !feedQuery}
    <section class="mb-8">
      <h2 class="mb-3 flex items-center gap-1.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock class="size-3.5" />
        Recently viewed
      </h2>
      <div class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {#each recentNotes() as note (note.id)}
          <div class="w-52 shrink-0">
            <NoteCard {note} onToggleFavorite={handleToggleFavorite} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section id="feed" class="scroll-mt-20">
    <h2 class="mb-4 font-heading text-xl font-semibold">Your notes</h2>
    {#if loading}
      <p class="text-sm text-muted-foreground">Loading…</p>
    {:else}
      <FeedClient {notes} onToggleFavorite={handleToggleFavorite} bind:query={feedQuery} />
    {/if}
  </section>
</main>
