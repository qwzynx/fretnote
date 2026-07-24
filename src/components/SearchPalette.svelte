<script lang="ts">
  import { onMount, tick } from "svelte";
  import { push } from "svelte-spa-router";
  import { Guitar, Music4, Search, X } from "@lucide/svelte";
  import { listNotes } from "@/lib/db";
  import type { Note } from "@/lib/types";
  import { searchOpenStore } from "@/lib/search-open.svelte";

  let allNotes = $state<Note[]>([]);
  let query = $state("");
  let activeIdx = $state(0);
  let inputEl: HTMLInputElement;

  const results = $derived(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNotes.slice(0, 8);
    return allNotes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.artist.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          n.chords.some((c) => c.toLowerCase().includes(q))
      )
      .slice(0, 8);
  });

  $effect(() => {
    if (searchOpenStore.open) {
      if (!allNotes.length) listNotes().then((ns) => (allNotes = ns));
      tick().then(() => inputEl?.focus());
      query = "";
      activeIdx = 0;
    }
  });

  function close() {
    searchOpenStore.hide();
  }

  function openNote(note: Note) {
    push(`/notes/${note.id}`);
    close();
  }

  function handleKeydown(e: KeyboardEvent) {
    const list = results();
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, list.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    } else if (e.key === "Enter" && list[activeIdx]) {
      openNote(list[activeIdx]);
    }
  }

  $effect(() => {
    // Reset active index when results change
    activeIdx = 0;
    results();
  });
</script>

{#if searchOpenStore.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
    onclick={(e) => { if (e.target === e.currentTarget) close(); }}
    onkeydown={(e) => { if (e.key === "Escape") close(); }}
  >
    <div class="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <!-- Input -->
      <div class="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search class="size-4 shrink-0 text-muted-foreground" />
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={handleKeydown}
          placeholder="Search notes…"
          class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onclick={close}
          class="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Close search"
        >
          <X class="size-4" />
        </button>
      </div>

      <!-- Results -->
      <div class="max-h-80 overflow-y-auto py-1">
        {#if results().length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">
            {query ? "No notes found." : "Start typing to search…"}
          </p>
        {:else}
          {#each results() as note, i (note.id)}
            <button
              type="button"
              onclick={() => openNote(note)}
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors {i === activeIdx
                ? 'bg-muted'
                : 'hover:bg-muted/50'}"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
              >
                {#if note.type === "tab"}
                  <Guitar class="size-3.5" />
                {:else}
                  <Music4 class="size-3.5" />
                {/if}
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{note.title}</p>
                <p class="truncate text-xs text-muted-foreground">{note.artist}</p>
              </div>
              <span class="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {note.key}
              </span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span class="mr-3"><kbd class="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd> navigate</span>
        <span class="mr-3"><kbd class="rounded border border-border bg-muted px-1 font-mono">↵</kbd> open</span>
        <span><kbd class="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> close</span>
      </div>
    </div>
  </div>
{/if}
