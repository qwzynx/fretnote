<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { ArrowLeft, ChevronDown, Copy, Guitar, Heart, ListMusic, Music4, Pencil, Printer, Trash2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { getNote, deleteNote, toggleFavorite } from "@/lib/db";
  import { transposeKey } from "@/lib/music/transpose";
  import { noteToText } from "@/lib/export";
  import AddToSetlistDialog from "@/components/ui/AddToSetlistDialog.svelte";
  import { recordView } from "@/lib/recent";
  import type { Note } from "@/lib/types";
  import Badge from "@/components/ui/Badge.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import NoteReader from "@/components/notes/NoteReader.svelte";

  const DIFFICULTY_LABEL = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  } as const;

  let { params }: { params: { id: string } } = $props();

  let note = $state<Note | null | undefined>(undefined);
  let isFav = $state(false);
  let exportOpen = $state(false);
  let setlistDialogOpen = $state(false);

  onMount(async () => {
    if (!params.id) return;
    note = await getNote(params.id);
    isFav = note?.isFavorite ?? false;
    if (note) recordView(note.id);
  });

  async function handleToggleFavorite() {
    if (!note) return;
    const next = !isFav;
    isFav = next;
    await toggleFavorite(note.id, next);
  }

  async function handleCopyText() {
    if (!note) return;
    await navigator.clipboard.writeText(noteToText(note));
    toast.success("Copied to clipboard");
    exportOpen = false;
  }

  function handlePrint() {
    exportOpen = false;
    setTimeout(() => window.print(), 50);
  }

  async function handleDelete() {
    if (!note) return;
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    await deleteNote(note.id);
    push("/");
  }
</script>

{#if note === undefined}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <p class="text-sm text-muted-foreground">Loading…</p>
  </main>
{:else if note === null}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <p class="text-sm text-muted-foreground">Note not found.</p>
    <Button variant="ghost" size="sm" class="mt-4" href="#/">
      Back to notes
    </Button>
  </main>
{:else}
  <main class="mx-auto w-full max-w-3xl px-4 py-8">
    <div class="mb-4 flex items-center justify-between" data-print-hide>
      <Button
        variant="ghost"
        size="sm"
        class="-ml-2 text-muted-foreground"
        href="#/"
      >
        <ArrowLeft />
        Back to notes
      </Button>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onclick={handleToggleFavorite}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            class="size-4 {isFav
              ? 'fill-rose-500 text-rose-500'
              : 'text-muted-foreground'}"
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={() => (setlistDialogOpen = true)}
        >
          <ListMusic />
          Add to setlist
        </Button>

        <!-- Export dropdown -->
        <div class="relative">
          <Button
            variant="outline"
            size="sm"
            onclick={() => (exportOpen = !exportOpen)}
          >
            <Printer />
            Export
            <ChevronDown class="size-3" />
          </Button>
          {#if exportOpen}
            <div
              class="absolute top-full right-0 z-50 mt-1 min-w-36 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
            >
              <button
                type="button"
                onclick={handlePrint}
                class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Printer class="size-3.5" />
                Print / Save PDF
              </button>
              <button
                type="button"
                onclick={handleCopyText}
                class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <Copy class="size-3.5" />
                Copy as text
              </button>
            </div>
          {/if}
        </div>
        <Button variant="outline" size="sm" href={`#/notes/${note.id}/edit`}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:bg-destructive/10"
          onclick={handleDelete}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
    </div>

    <header class="mb-6">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" class="gap-1 border-primary/30 text-primary">
          {#if note.type === "tab"}
            <Guitar class="size-3" />
          {:else}
            <Music4 class="size-3" />
          {/if}
          {note.type === "tab" ? "Tab" : "Chords"}
        </Badge>
        <Badge variant="secondary" class="font-mono">Key {note.key}</Badge>
        {#if note.capo > 0}
          <Badge variant="secondary">Capo {note.capo}</Badge>
          <Badge variant="outline" class="text-muted-foreground">
            Sounds like {transposeKey(note.key, note.capo)}
          </Badge>
        {/if}
        <span class="text-xs text-muted-foreground">
          {DIFFICULTY_LABEL[note.difficulty]}
        </span>
      </div>

      <h1 class="font-heading text-3xl font-semibold tracking-tight">
        {note.title}
      </h1>
      <p class="mt-1 text-lg text-muted-foreground">{note.artist}</p>

      {#if note.tags.length > 0}
        <div class="mt-4 flex flex-wrap gap-1.5">
          {#each note.tags as t}
            <span
              class="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              #{t}
            </span>
          {/each}
        </div>
      {/if}
    </header>

    <Separator class="mb-2" />

    <NoteReader {note} />
  </main>

  {#if note}
    <AddToSetlistDialog
      noteId={note.id}
      open={setlistDialogOpen}
      onclose={() => (setlistDialogOpen = false)}
    />
  {/if}
{/if}
