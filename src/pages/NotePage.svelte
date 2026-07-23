<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { ArrowLeft, Guitar, Music4, Pencil, Trash2 } from "@lucide/svelte";
  import { getNote, deleteNote } from "@/lib/db";
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

  onMount(async () => {
    if (!params.id) return;
    note = await getNote(params.id);
  });

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
    <div class="mb-4 flex items-center justify-between">
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
{/if}
