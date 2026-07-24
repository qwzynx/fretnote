<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { toast } from "svelte-sonner";
  import { Music4, Guitar, Wand2, Plus } from "@lucide/svelte";

  import type { TabBlock, TabColumn } from "@/lib/types";
  import { createNote, updateNote, getNote } from "@/lib/db";
  import { extractChords } from "@/lib/music/parse";
  import { TUNINGS, DEFAULT_TUNING } from "@/lib/music/tunings";
  import { emptyPattern, type StrokeType } from "@/lib/strumming";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Label from "@/components/ui/Label.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import Select from "@/components/ui/Select.svelte";
  import ChordPanel from "./ChordPanel.svelte";
  import TabEditor from "./TabEditor.svelte";
  import StrummingEditor from "./StrummingEditor.svelte";
  import NotePreview from "./NotePreview.svelte";

  const KEYS = [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
    "Am", "Em", "Bm", "Dm", "F#m", "Cm",
  ];
  const KEY_ITEMS = KEYS.map((k) => ({ value: k, label: k }));

  const DIFFICULTY_ITEMS = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
  ];

  const TUNING_ITEMS = TUNINGS.map((t) => ({ value: t.id, label: t.label }));

  const emptyTabColumns = (): TabColumn[] =>
    Array.from({ length: 8 }, () => ["", "", "", "", "", ""] as TabColumn);

  let tabSeq = 0;
  function newTabBlock(label = ""): TabBlock {
    tabSeq += 1;
    return { id: `tab-${tabSeq}`, label, columns: emptyTabColumns() };
  }

  const tabBlockFilled = (b: TabBlock) =>
    b.columns.some((col) => col.some((v) => v !== ""));

  function dedupe(list: string[]): string[] {
    return [...new Set(list)];
  }

  let { editId }: { editId?: string } = $props();

  let saving = $state(false);
  let title = $state("");
  let artist = $state("");
  let key = $state("C");
  let capo = $state(0);
  let difficulty = $state("beginner");
  let chordSheet = $state("");
  let tabBlocks = $state<TabBlock[]>([newTabBlock("Intro")]);
  let tuningId = $state(DEFAULT_TUNING.id);
  let manualChords = $state<string[]>([]);
  let pattern = $state<StrokeType[]>(emptyPattern());
  let bpm = $state<number | undefined>(undefined);
  let finderOpen = $state(false);

  let textareaEl: HTMLTextAreaElement;

  const tuning = $derived(TUNINGS.find((t) => t.id === tuningId) ?? DEFAULT_TUNING);

  const allChords = $derived(
    dedupe([...extractChords(chordSheet), ...manualChords])
  );

  // Deferred preview values — updated one rAF after the live values change
  let previewSheet = $state("");
  let previewChords = $state<string[]>([]);
  let previewTabBlocks = $state<TabBlock[]>([]);
  let previewPattern = $state<StrokeType[]>(emptyPattern());

  $effect(() => {
    const s = chordSheet;
    const c = allChords;
    const t = tabBlocks;
    const p = pattern;
    const raf = requestAnimationFrame(() => {
      previewSheet = s;
      previewChords = c;
      previewTabBlocks = t;
      previewPattern = p;
    });
    return () => cancelAnimationFrame(raf);
  });

  onMount(async () => {
    if (!editId) return;
    const note = await getNote(editId);
    if (!note) return;
    title = note.title;
    artist = note.artist;
    key = note.key;
    capo = note.capo;
    difficulty = note.difficulty;
    chordSheet = note.chordSheet ?? "";
    if (note.tabBlocks?.length) tabBlocks = note.tabBlocks;
    manualChords = note.chords;
    if (note.strummingPattern?.length)
      pattern = note.strummingPattern as StrokeType[];
    if (note.bpm) bpm = note.bpm;
  });

  function addChord(name: string) {
    if (!allChords.includes(name))
      manualChords = dedupe([...manualChords, name]);
  }

  function updateTabBlock(next: TabBlock) {
    tabBlocks = tabBlocks.map((b) => (b.id === next.id ? next : b));
  }

  function addTabBlock() {
    tabBlocks = [...tabBlocks, newTabBlock()];
  }

  function removeTabBlock(id: string) {
    tabBlocks = tabBlocks.filter((b) => b.id !== id);
  }

  function insertAtCursor(text: string) {
    if (!textareaEl) {
      chordSheet = chordSheet + text;
      return;
    }
    const start = textareaEl.selectionStart ?? chordSheet.length;
    const end = textareaEl.selectionEnd ?? start;
    const next = chordSheet.slice(0, start) + text + chordSheet.slice(end);
    chordSheet = next;
    requestAnimationFrame(() => {
      textareaEl.focus();
      const pos = start + text.length;
      textareaEl.setSelectionRange(pos, pos);
    });
  }

  function insertChord(name: string) {
    insertAtCursor(`[${name}]`);
  }

  function insertTabRef(label: string) {
    const start = textareaEl?.selectionStart ?? chordSheet.length;
    const before = chordSheet.slice(0, start);
    const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    insertAtCursor(`${lead}[tab: ${label}]\n`);
  }

  async function save() {
    saving = true;
    try {
      const filledTabs = tabBlocks.filter(tabBlockFilled);
      const hasSheet = chordSheet.trim().length > 0;
      const input = {
        type: (hasSheet ? "chords" : "tab") as "chords" | "tab",
        title: title.trim(),
        artist: artist.trim(),
        key,
        capo,
        difficulty: difficulty as "beginner" | "intermediate" | "advanced",
        tags: [],
        chordSheet: hasSheet ? chordSheet : undefined,
        tabBlocks: filledTabs.length ? filledTabs : undefined,
        chords: allChords,
        strummingPattern: pattern.some((s) => s !== "") ? pattern : undefined,
        bpm,
      };
      if (editId) {
        await updateNote(editId, input);
        toast.success("Note updated");
        push(`/notes/${editId}`);
      } else {
        const note = await createNote(input);
        toast.success("Note saved");
        push(`/notes/${note.id}`);
      }
    } catch (err) {
      toast.error("Failed to save note");
      console.error(err);
    } finally {
      saving = false;
    }
  }
</script>

<div class="grid gap-8 lg:h-full lg:grid-cols-2 lg:gap-0">
  <!-- ══ Editors (left) ══════════════════════════════════════════ -->
  <div class="min-w-0 space-y-8 lg:overflow-y-auto lg:pb-8 lg:pr-8">
    <!-- Metadata -->
    <section class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label for="title">Title</Label>
          <Input id="title" placeholder="Song title" bind:value={title} />
        </div>
        <div class="space-y-1.5">
          <Label for="artist">Artist</Label>
          <Input id="artist" placeholder="Artist name" bind:value={artist} />
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-1.5">
          <Label>Key</Label>
          <Select bind:value={key} items={KEY_ITEMS} class="w-24" />
        </div>

        <div class="space-y-1.5">
          <Label for="capo">Capo</Label>
          <input
            id="capo"
            type="number"
            min={0}
            max={12}
            value={capo}
            oninput={(e) =>
              (capo = Math.max(
                0,
                Math.min(12, Number((e.target as HTMLInputElement).value))
              ))}
            class="flex h-8 w-20 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <div class="space-y-1.5">
          <Label>Difficulty</Label>
          <Select bind:value={difficulty} items={DIFFICULTY_ITEMS} class="w-40" />
        </div>
      </div>
    </section>

    <Separator />

    <!-- Chords & Lyrics -->
    <section class="space-y-4">
      <div class="flex items-center gap-2.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Music4 class="size-4" />
        </span>
        <div>
          <h2 class="font-heading text-base font-semibold leading-tight">Song</h2>
          <p class="text-xs text-muted-foreground">
            Chords, lyrics and tabs in one place, in playing order.
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <Label for="chordsheet">Editor</Label>
          <Button
            variant={finderOpen ? "secondary" : "outline"}
            size="sm"
            onclick={() => (finderOpen = !finderOpen)}
            aria-expanded={finderOpen}
          >
            <Wand2 />
            Chord finder
          </Button>
        </div>

        <textarea
          id="chordsheet"
          bind:this={textareaEl}
          bind:value={chordSheet}
          rows={16}
          spellcheck={false}
          placeholder={"[Verse]\n[G]Here is a [D]line with [Em]chords\n[C]Another line below"}
          class="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
        ></textarea>

        <p class="text-xs text-muted-foreground">
          Put chords in brackets right before the syllable, e.g.
          <code class="rounded bg-muted px-1 py-0.5">[Am]</code>. A line like
          <code class="rounded bg-muted px-1 py-0.5">[Verse 1]</code> becomes a
          section header, and
          <code class="rounded bg-muted px-1 py-0.5">[tab: Intro]</code> drops
          in the tab of that name.
        </p>

        {#if finderOpen}
          <ChordPanel
            chords={allChords}
            onAddChord={addChord}
            onInsert={insertChord}
          />
        {/if}
      </div>
    </section>

    <Separator />

    <!-- Tabs -->
    <section class="space-y-4">
      <div class="flex items-center gap-2.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Guitar class="size-4" />
        </span>
        <div>
          <h2 class="font-heading text-base font-semibold leading-tight">Tabs</h2>
          <p class="text-xs text-muted-foreground">
            Define named tabs, then drop each into the song above with "Insert in
            song".
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">Tuning</span>
        <Select bind:value={tuningId} items={TUNING_ITEMS} size="sm" class="w-auto" />
      </div>

      <div class="space-y-4">
        {#each tabBlocks as block (block.id)}
          <TabEditor
            {block}
            {tuning}
            onChange={updateTabBlock}
            onRemove={() => removeTabBlock(block.id)}
            onInsert={() => insertTabRef(block.label.trim())}
          />
        {/each}
      </div>

      <Button variant="outline" size="sm" onclick={addTabBlock}>
        <Plus />
        Add tab
      </Button>
    </section>

    <Separator />

    <!-- Strumming -->
    <section class="space-y-3">
      <div>
        <h2 class="font-heading text-base font-semibold">Strumming pattern</h2>
        <p class="text-xs text-muted-foreground">
          Build the strum — add bars for longer patterns.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Label for="bpm">BPM</Label>
        <input
          id="bpm"
          type="number"
          placeholder="—"
          value={bpm ?? ""}
          oninput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            bpm = v === "" ? undefined : Number(v);
          }}
          class="flex h-8 w-24 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <StrummingEditor {pattern} onChange={(p) => (pattern = p)} />
    </section>

    <Separator />

    <div class="flex justify-end gap-3">
      <Button variant="outline" onclick={() => window.history.back()}>
        Cancel
      </Button>
      <Button
        disabled={saving || !title.trim() || !artist.trim()}
        onclick={save}
      >
        {saving ? "Saving…" : editId ? "Update note" : "Save note"}
      </Button>
    </div>
  </div>

  <!-- ══ Preview (right) ═════════════════════════════════════════ -->
  <div class="lg:overflow-y-auto lg:border-l lg:border-border lg:pl-8">
    <NotePreview
      {title}
      {artist}
      songKey={key}
      {capo}
      {difficulty}
      pattern={previewPattern}
      {bpm}
      chords={previewChords}
      sheet={previewSheet}
      tabBlocks={previewTabBlocks}
    />
  </div>
</div>
