<script lang="ts">
  import { onMount } from "svelte";
  import { Clock, DatabaseZap, PlusCircle, Sparkles, Upload } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { listNoteSummaries } from "@/lib/db";
  import { importNote } from "@/lib/backup";
  import type { NoteSummary } from "@/lib/types";
  import { getRecentIds } from "@/lib/recent";
  import { goto } from "@/lib/nav-stack.svelte";
  import { cardActions } from "@/lib/card-actions.svelte";
  import Button from "@/components/ui/Button.svelte";
  import FeedClient from "@/components/feed/FeedClient.svelte";
  import NoteCard from "@/components/notes/NoteCard.svelte";
  import NoteCardSkeleton from "@/components/feed/NoteCardSkeleton.svelte";
  import EmptyState from "@/components/ui/EmptyState.svelte";

  let notes = $state<NoteSummary[]>([]);
  let loadError = $state<string | null>(null);
  let loading = $state(true);
  let feedQuery = $state("");
  let importing = $state(false);

  async function reload() {
    loading = true;
    try {
      notes = await listNoteSummaries();
      loadError = null;
    } catch (err) {
      console.error(err);
      loadError = "Your library couldn't be opened.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    cardActions.openId = null;
    reload();
  });

  async function handleImportNote() {
    importing = true;
    try {
      const imported = await importNote();
      if (imported) {
        toast.success(`Imported "${imported.title}"`);
        goto(`/notes/${imported.id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      importing = false;
    }
  }


  function handleToggleFavorite(id: string, value: boolean) {
    notes = notes.map((n) => (n.id === id ? { ...n, isFavorite: value } : n));
  }

  function handleDeleteNote(id: string) {
    notes = notes.filter((n) => n.id !== id);
  }

  const favoriteCount = $derived(notes.filter((n) => n.isFavorite).length);

  const recentNotes = $derived.by(() => {
    // One index pass instead of a `notes.find` per recent id, which made this
    // O(recent x notes) — and it was recomputed on every read because the
    // memo was wrapping the arrow function rather than its result.
    const byId = new Map(notes.map((n) => [n.id, n]));
    return getRecentIds()
      .map((id) => byId.get(id))
      .filter((n): n is NoteSummary => !!n);
  });
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">
  <!-- The full pitch is for someone who has nothing yet. Once there are songs
       in the library it collapses to a title row, so returning users aren't
       scrolling past a screen of brochure copy to reach their own music. -->
  {#if !loading && !loadError && notes.length === 0}
    <section
      class="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-raised sm:mb-10 sm:p-10"
    >
      <div class="max-w-2xl">
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/25"
        >
          <Sparkles class="size-3.5" />
          Your personal songbook
        </span>
        <h1 class="mt-3 text-2xl leading-tight sm:mt-4 sm:text-5xl">
          Chords &amp; tabs for every song you love.
        </h1>
        <p class="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-lg">
          Write a note, line the chords up with the lyrics, transpose to your
          voice — all saved locally on your device.
        </p>
        <div class="mt-5 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
          <Button
            size="lg"
            href="#/create"
            onclick={(e: MouseEvent) => goto("/create", e)}
            class="flex-1 sm:flex-none"
          >
            <PlusCircle />
            Create a note
          </Button>
          <Button
            size="lg"
            variant="outline"
            loading={importing}
            onclick={handleImportNote}
            class="flex-1 sm:flex-none"
          >
            <Upload />
            Import note
          </Button>
        </div>
      </div>
    </section>
  {:else}
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl">Your songbook</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {#if loading}
            Opening your library…
          {:else}
            {notes.length}
            {notes.length === 1 ? "song" : "songs"}{favoriteCount > 0
              ? ` · ${favoriteCount} favourite${favoriteCount === 1 ? "" : "s"}`
              : ""}
          {/if}
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" loading={importing} onclick={handleImportNote}>
          <Upload />
          <span class="hidden sm:inline">Import note</span>
        </Button>
        <Button href="#/create" onclick={(e: MouseEvent) => goto("/create", e)}>
          <PlusCircle />
          New note
        </Button>
      </div>
    </div>
  {/if}

  <!-- Recently viewed -->
  {#if !loading && recentNotes.length > 0 && !feedQuery}
    <section class="mb-6 sm:mb-8">
      <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock class="size-3.5" />
        Recently viewed
      </h2>
      <!-- Full-bleed carousel on phones so cards can peek past the edge. -->
      <div
        data-no-swipe-nav
        class="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-1"
      >
        {#each recentNotes as note (note.id)}
          <div class="w-[15rem] shrink-0 snap-start sm:w-52">
            <NoteCard {note} onToggleFavorite={handleToggleFavorite} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section id="feed" class="scroll-mt-4">
    {#if loading}
      <span class="sr-only" role="status">Loading your notes…</span>
      <NoteCardSkeleton />
    {:else if loadError}
      <EmptyState
        tone="error"
        icon={DatabaseZap}
        title={loadError}
        description="Your songs are still on disk — this is a problem reading them, not a missing library."
      >
        {#snippet action()}
          <Button variant="outline" onclick={reload}>Try again</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <FeedClient
        {notes}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteNote}
        bind:query={feedQuery}
      />
    {/if}
  </section>
</main>
