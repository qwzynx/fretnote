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

<main class="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
  <!-- Hero -->
  <section
    class="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-5 sm:mb-10 sm:p-10"
  >
    <div class="max-w-2xl">
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/25"
      >
        <Sparkles class="size-3.5" />
        Your personal songbook
      </span>
      <h1
        class="mt-3 font-heading text-2xl font-semibold leading-tight tracking-tight sm:mt-4 sm:text-5xl"
      >
        Chords &amp; tabs for every song you love.
      </h1>
      <p class="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-lg">
        Write a note, line the chords up with the lyrics, transpose to your
        voice — all saved locally on your device.
      </p>
      <div class="mt-5 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
        <Button size="lg" href="#/create" class="flex-1 sm:flex-none">
          <PlusCircle />
          Create a note
        </Button>
        <Button
          size="lg"
          variant="outline"
          onclick={scrollToFeed}
          class="flex-1 sm:flex-none"
        >
          Browse notes
        </Button>
      </div>
    </div>
  </section>

  <!-- Recently viewed -->
  {#if !loading && recentNotes().length > 0 && !feedQuery}
    <section class="mb-6 sm:mb-8">
      <h2 class="mb-3 flex items-center gap-1.5 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock class="size-3.5" />
        Recently viewed
      </h2>
      <!-- Full-bleed carousel on phones so cards can peek past the edge. -->
      <div
        class="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-1"
      >
        {#each recentNotes() as note (note.id)}
          <div class="w-[15rem] shrink-0 snap-start sm:w-52">
            <NoteCard {note} onToggleFavorite={handleToggleFavorite} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section id="feed" class="scroll-mt-4">
    <h2 class="mb-3 font-heading text-lg font-semibold sm:mb-4 sm:text-xl">
      Your notes
    </h2>
    {#if loading}
      <p class="text-sm text-muted-foreground">Loading…</p>
    {:else}
      <FeedClient {notes} onToggleFavorite={handleToggleFavorite} bind:query={feedQuery} />
    {/if}
  </section>
</main>
