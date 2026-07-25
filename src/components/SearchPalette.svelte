<script lang="ts">
  import { onMount, tick } from "svelte";
  import { push } from "svelte-spa-router";
  import { Guitar, Music4, Search, X } from "@lucide/svelte";
  import { listNotes } from "@/lib/db";
  import type { Note } from "@/lib/types";
  import { searchOpenStore } from "@/lib/search-open.svelte";
  import { historyLayer } from "@/lib/overlay-history.svelte";
  import { dragDismiss } from "@/lib/actions/drag-dismiss";
  import { isPhone } from "@/lib/media.svelte";

  let allNotes = $state<Note[]>([]);
  let query = $state("");
  let activeIdx = $state(0);
  let inputEl: HTMLInputElement;
  let resultsEl: HTMLElement;

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

  const layer = historyLayer(() => searchOpenStore.open, close);

  function openNote(note: Note) {
    layer.dismiss(() => push(`/notes/${note.id}`));
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
  <!-- Full-height sheet on phones; floating palette from `sm` up. -->
  <div
    class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-start sm:pt-[15vh]"
    onclick={(e) => { if (e.target === e.currentTarget) close(); }}
    onkeydown={(e) => { if (e.key === "Escape") close(); }}
  >
    <div
      use:dragDismiss={{
        onDismiss: close,
        scroller: () => resultsEl,
        enabled: () => isPhone.current,
      }}
      class="flex w-full flex-col overflow-hidden border-border bg-card pt-[env(safe-area-inset-top,0px)] shadow-2xl sm:h-auto sm:max-w-xl sm:rounded-xl sm:border sm:pt-0"
    >
      <!-- Grab handle: phone only, mirrors the bottom-sheet affordance. -->
      <div class="flex justify-center pb-1 pt-2 sm:hidden">
        <div class="h-1 w-10 rounded-full bg-muted-foreground/30"></div>
      </div>

      <!-- Input -->
      <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Search class="size-4 shrink-0 text-muted-foreground" />
        <input
          bind:this={inputEl}
          bind:value={query}
          onkeydown={handleKeydown}
          type="search"
          placeholder="Search notes…"
          class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <button
          type="button"
          onclick={close}
          class="-mr-1.5 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:bg-muted sm:-mr-0 sm:size-6"
          aria-label="Close search"
        >
          <X class="size-5 sm:size-4" />
        </button>
      </div>

      <!-- Results -->
      <div
        bind:this={resultsEl}
        class="flex-1 overflow-y-auto overscroll-contain py-1 sm:max-h-80 sm:flex-none"
      >
        {#if results().length === 0}
          <p class="px-4 py-6 text-center text-sm text-muted-foreground">
            {query ? "No notes found." : "Start typing to search…"}
          </p>
        {:else}
          {#each results() as note, i (note.id)}
            <button
              type="button"
              onclick={() => openNote(note)}
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:py-2.5 {i === activeIdx
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

      <!-- Keyboard hints are noise on a touch device. -->
      <div class="hidden shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground sm:block">
        <span class="mr-3"><kbd class="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd> navigate</span>
        <span class="mr-3"><kbd class="rounded border border-border bg-muted px-1 font-mono">↵</kbd> open</span>
        <span><kbd class="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> close</span>
      </div>
    </div>
  </div>
{/if}
