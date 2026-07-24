<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { toast } from "svelte-sonner";
  import {
    ArrowLeft,
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Guitar,
    ListMusic,
    Music4,
    Pencil,
    Trash2,
    X,
  } from "@lucide/svelte";
  import {
    getSetlistWithNotes,
    updateSetlist,
    deleteSetlist,
    removeFromSetlist,
    moveSetlistItem,
  } from "@/lib/setlists";
  import type { SetlistWithNotes, Note } from "@/lib/types";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import Badge from "@/components/ui/Badge.svelte";

  let { params }: { params: { id: string } } = $props();

  let setlist = $state<SetlistWithNotes | null | undefined>(undefined);
  let editingTitle = $state(false);
  let titleDraft = $state("");
  let currentIdx = $state(0);

  type NoteWithItemId = Note & { _itemId: string };

  onMount(async () => {
    setlist = await getSetlistWithNotes(params.id);
    titleDraft = setlist?.title ?? "";
  });

  async function saveTitle() {
    if (!setlist || !titleDraft.trim()) return;
    await updateSetlist(setlist.id, titleDraft.trim(), setlist.description);
    setlist = { ...setlist, title: titleDraft.trim() };
    editingTitle = false;
    toast.success("Title updated");
  }

  async function handleDelete() {
    if (!setlist) return;
    if (!confirm(`Delete setlist "${setlist.title}"?`)) return;
    await deleteSetlist(setlist.id);
    push("/setlists");
  }

  async function handleRemoveNote(itemId: string) {
    if (!setlist) return;
    await removeFromSetlist(itemId);
    const notes = (setlist.notes as NoteWithItemId[]).filter((n) => n._itemId !== itemId);
    setlist = { ...setlist, notes, noteCount: notes.length };
    if (currentIdx >= notes.length) currentIdx = Math.max(0, notes.length - 1);
  }

  async function handleMove(itemId: string, direction: "up" | "down") {
    if (!setlist) return;
    await moveSetlistItem(setlist.id, itemId, direction);
    setlist = await getSetlistWithNotes(setlist.id) ?? setlist;
  }
</script>

{#if setlist === undefined}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <p class="text-sm text-muted-foreground">Loading…</p>
  </main>
{:else if setlist === null}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <p class="text-sm text-muted-foreground">Setlist not found.</p>
    <Button variant="ghost" size="sm" class="mt-4" href="#/setlists">Back</Button>
  </main>
{:else}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" class="-ml-2 text-muted-foreground" href="#/setlists">
          <ArrowLeft />
          Setlists
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="text-destructive hover:bg-destructive/10"
        onclick={handleDelete}
      >
        <Trash2 />
        Delete setlist
      </Button>
    </div>

    <!-- Title -->
    <div class="mb-6">
      {#if editingTitle}
        <div class="flex items-center gap-2">
          <Input bind:value={titleDraft} class="font-heading text-xl font-semibold" />
          <Button size="sm" onclick={saveTitle}>Save</Button>
          <Button variant="ghost" size="sm" onclick={() => (editingTitle = false)}>Cancel</Button>
        </div>
      {:else}
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <ListMusic class="size-5 text-primary" />
            <h1 class="font-heading text-2xl font-semibold tracking-tight">{setlist.title}</h1>
          </div>
          <button
            type="button"
            onclick={() => (editingTitle = true)}
            class="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Edit title"
          >
            <Pencil class="size-3.5" />
          </button>
        </div>
        {#if setlist.description}
          <p class="mt-1 text-sm text-muted-foreground">{setlist.description}</p>
        {/if}
      {/if}
      <p class="mt-1 text-xs text-muted-foreground">
        {setlist.notes.length} {setlist.notes.length === 1 ? "song" : "songs"}
      </p>
    </div>

    <Separator class="mb-6" />

    {#if setlist.notes.length === 0}
      <div class="rounded-xl border border-dashed border-border py-16 text-center">
        <p class="text-sm text-muted-foreground">
          No songs yet. Add songs from their note page.
        </p>
      </div>
    {:else}
      <!-- Song list -->
      <div class="mb-8 space-y-2">
        {#each setlist.notes as note, i ((note as NoteWithItemId)._itemId)}
          {@const itemId = (note as NoteWithItemId)._itemId}
          <div
            class="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 {i === currentIdx
              ? 'ring-2 ring-primary'
              : ''}"
          >
            <span class="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
              {i + 1}
            </span>

            <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {#if note.type === "tab"}
                <Guitar class="size-3.5" />
              {:else}
                <Music4 class="size-3.5" />
              {/if}
            </span>

            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{note.title}</p>
              <p class="truncate text-xs text-muted-foreground">{note.artist}</p>
            </div>

            <Badge variant="secondary" class="shrink-0 font-mono">{note.key}</Badge>

            <div class="flex items-center gap-1">
              <button
                type="button"
                onclick={() => handleMove(itemId, "up")}
                disabled={i === 0}
                aria-label="Move up"
                class="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp class="size-3.5" />
              </button>
              <button
                type="button"
                onclick={() => handleMove(itemId, "down")}
                disabled={i === setlist.notes.length - 1}
                aria-label="Move down"
                class="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown class="size-3.5" />
              </button>
              <a
                href={`#/notes/${note.id}`}
                class="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
              >
                Open
              </a>
              <button
                type="button"
                onclick={() => handleRemoveNote(itemId)}
                aria-label="Remove from setlist"
                class="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X class="size-3.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Prev / Next navigator -->
      <div class="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIdx === 0}
          onclick={() => (currentIdx = Math.max(0, currentIdx - 1))}
        >
          <ChevronLeft />
          Previous
        </Button>
        <div class="text-center">
          <p class="text-sm font-medium">{setlist.notes[currentIdx]?.title ?? ""}</p>
          <p class="text-xs text-muted-foreground">
            {currentIdx + 1} / {setlist.notes.length}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIdx === setlist.notes.length - 1}
          onclick={() => (currentIdx = Math.min(setlist!.notes.length - 1, currentIdx + 1))}
        >
          Next
          <ChevronRight />
        </Button>
      </div>

      <div class="mt-3 text-center">
        <a
          href={`#/notes/${setlist.notes[currentIdx]?.id}`}
          class="text-sm font-medium text-primary hover:underline"
        >
          Open "{setlist.notes[currentIdx]?.title}"
        </a>
      </div>
    {/if}
  </main>
{/if}
