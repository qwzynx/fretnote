<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { ArrowLeft, ChevronDown, Copy, Guitar, Heart, ListMusic, MoreHorizontal, Music4, Pencil, Printer, Trash2, X } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
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
  /** Phone-only action sheet standing in for the desktop button row. */
  let actionsOpen = $state(false);

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
    exportOpen = false;
    actionsOpen = false;
    try {
      await writeText(noteToText(note));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  function handlePrint() {
    exportOpen = false;
    actionsOpen = false;
    setTimeout(() => window.print(), 50);
  }

  async function handleDelete() {
    if (!note) return;
    actionsOpen = false;
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
  <main class="mx-auto w-full max-w-3xl px-4 py-4 sm:py-8">
    <div class="mb-4 flex items-center justify-between gap-2" data-print-hide>
      <Button
        variant="ghost"
        size="sm"
        class="-ml-2 text-muted-foreground"
        href="#/"
        aria-label="Back to notes"
      >
        <ArrowLeft />
        <span class="hidden sm:inline">Back to notes</span>
        <span class="sm:hidden">Notes</span>
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

        <!-- Phones: one overflow button opening a bottom action sheet. -->
        <Button
          variant="outline"
          size="icon-sm"
          class="sm:hidden"
          onclick={() => (actionsOpen = true)}
          aria-label="More actions"
        >
          <MoreHorizontal class="size-4" />
        </Button>

        <div class="hidden items-center gap-2 sm:flex">
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
    </div>

    <header class="mb-5 sm:mb-6">
      <h1 class="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {note.title}
      </h1>
      <p class="mt-0.5 text-base text-muted-foreground sm:mt-1 sm:text-lg">
        {note.artist}
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
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

      {#if note.tags.length > 0}
        <div class="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
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

  <!-- ══ Phone action sheet ══════════════════════════════════════ -->
  {#if actionsOpen}
    {@const sheetItem =
      "flex w-full items-center gap-3 rounded-lg px-3 py-3.5 text-left text-base active:bg-muted"}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Note actions"
      data-print-hide
      class="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:hidden"
      onclick={(e) => { if (e.target === e.currentTarget) actionsOpen = false; }}
      onkeydown={(e) => { if (e.key === "Escape") actionsOpen = false; }}
    >
      <div
        class="w-full rounded-t-2xl border-t border-border bg-card p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <div class="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/30"></div>
        <div class="flex items-center justify-between px-3 py-2">
          <p class="truncate font-medium">{note.title}</p>
          <button
            type="button"
            onclick={() => (actionsOpen = false)}
            aria-label="Close"
            class="rounded-full p-1.5 text-muted-foreground active:bg-muted"
          >
            <X class="size-5" />
          </button>
        </div>

        <button
          type="button"
          class={sheetItem}
          onclick={() => {
            actionsOpen = false;
            setlistDialogOpen = true;
          }}
        >
          <ListMusic class="size-5 text-muted-foreground" />
          Add to setlist
        </button>
        <a
          href={`#/notes/${note.id}/edit`}
          class={sheetItem}
          onclick={() => (actionsOpen = false)}
        >
          <Pencil class="size-5 text-muted-foreground" />
          Edit note
        </a>
        <button type="button" class={sheetItem} onclick={handleCopyText}>
          <Copy class="size-5 text-muted-foreground" />
          Copy as text
        </button>
        <button type="button" class={sheetItem} onclick={handlePrint}>
          <Printer class="size-5 text-muted-foreground" />
          Print / Save PDF
        </button>
        <button
          type="button"
          class="{sheetItem} text-destructive"
          onclick={handleDelete}
        >
          <Trash2 class="size-5" />
          Delete note
        </button>
      </div>
    </div>
  {/if}

  {#if note}
    <AddToSetlistDialog
      noteId={note.id}
      open={setlistDialogOpen}
      onclose={() => (setlistDialogOpen = false)}
    />
  {/if}
{/if}
