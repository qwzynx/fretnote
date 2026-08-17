<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "@/lib/nav-stack.svelte";
  import { Music4, Guitar, Wand2, AudioWaveform, Plus, FileText, Loader2 } from "@lucide/svelte";

  import type { NoteType, TabBlock, TabColumn } from "@/lib/types";
  import { createNote, updateNote, getNote } from "@/lib/db";
  import { fetchLyrics } from "@/lib/lyrics";
  import { extractChords } from "@/lib/music/parse";
  import { TUNINGS, DEFAULT_TUNING } from "@/lib/music/tunings";
  import { emptyPattern, type StrokeType } from "@/lib/strumming";
  import { getSettings } from "@/lib/settings";
  import { cn } from "@/lib/utils";
  import { isCompact } from "@/lib/media.svelte";
  import { closeAllLayers, historyLayer } from "@/lib/overlay-history.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Label from "@/components/ui/Label.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import Select from "@/components/ui/Select.svelte";
  import ChordPanel from "./ChordPanel.svelte";
  import StrumPanel from "./StrumPanel.svelte";
  import TabEditor from "./TabEditor.svelte";
  import StrummingEditor from "./StrummingEditor.svelte";
  import NotePreview from "./NotePreview.svelte";
  import TagInput from "./TagInput.svelte";

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

  const TYPE_ITEMS = [
    { value: "chords", label: "Chord sheet" },
    { value: "tab", label: "Tab" },
  ];

  const emptyTabColumns = (): TabColumn[] =>
    Array.from({ length: 8 }, () => ["", "", "", "", "", ""] as TabColumn);

  // Ids are minted globally unique rather than from a per-form counter. The
  // counter started at 0 on every mount, so editing a note whose blocks were
  // already saved as tab-1, tab-2… made the next "Add tab" collide with an
  // existing id — a duplicate key in the keyed {#each} below, and edits that
  // landed on two blocks at once.
  function newTabBlock(label = ""): TabBlock {
    return { id: crypto.randomUUID(), label, columns: emptyTabColumns() };
  }

  const tabBlockFilled = (b: TabBlock) =>
    b.columns.some((col) => col.some((v) => v !== ""));

  function dedupe(list: string[]): string[] {
    return [...new Set(list)];
  }

  let { editId }: { editId?: string } = $props();

  let saving = $state(false);
  let fetchingLyrics = $state(false);
  let title = $state("");
  let artist = $state("");
  let key = $state("C");
  let capo = $state(0);
  let difficulty = $state("beginner");
  let tags = $state<string[]>([]);
  let chordSheet = $state("");
  let tabBlocks = $state<TabBlock[]>([newTabBlock("Intro")]);
  let tuningId = $state(DEFAULT_TUNING.id);
  /**
   * Chosen, not inferred. This used to be derived from "are there lyrics?" at
   * save time, so clearing the lyrics field silently turned a chord sheet
   * into a tab note and took the reader's transpose controls with it.
   */
  let noteType = $state<NoteType>("chords");
  /** `true` once an edit target has been confirmed missing. */
  let notFound = $state(false);
  let manualChords = $state<string[]>([]);
  let pattern = $state<StrokeType[]>(emptyPattern());
  let bpm = $state<number | undefined>(undefined);
  let finderOpen = $state(false);
  let strumPickerOpen = $state(false);
  /** Below `lg` the two columns don't fit side by side, so they take turns. */
  let mobilePane = $state<"edit" | "preview">("edit");

  // Below `lg`, switching to Preview is a real history step so back returns
  // to Edit instead of leaving the page.
  historyLayer(
    () => isCompact.current && mobilePane === "preview",
    () => (mobilePane = "edit")
  );

  // Bound inside a branch now, so it can legitimately be unset.
  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);

  const tuning = $derived(TUNINGS.find((t) => t.id === tuningId) ?? DEFAULT_TUNING);

  const allChords = $derived(
    dedupe([...extractChords(chordSheet), ...manualChords])
  );

  // Deferred preview values — updated one rAF after the live values change
  let previewSheet = $state("");
  let previewChords = $state<string[]>([]);
  let previewTabBlocks = $state<TabBlock[]>([]);
  let previewPattern = $state<StrokeType[]>(emptyPattern());

  /**
   * Trailing debounce rather than one rAF per change. A frame-coalesced
   * update still re-parsed the whole document up to 60x a second while
   * typing — extractChords over the full sheet, a transpose + parse pass, a
   * complete preview DOM rebuild, and a chord-shape lookup per chord. At
   * this delay a burst of typing costs one pass instead of dozens, and the
   * preview still lands well inside the time it takes to look up at it.
   */
  const PREVIEW_DEBOUNCE_MS = 180;

  $effect(() => {
    const s = chordSheet;
    const c = allChords;
    const t = tabBlocks;
    const p = pattern;
    const timer = setTimeout(() => {
      previewSheet = s;
      previewChords = c;
      previewTabBlocks = t;
      previewPattern = p;
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  function handleFormKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  }

  onMount(async () => {
    if (!editId) {
      const s = getSettings();
      key = s.defaultKey;
      capo = s.defaultCapo;
      difficulty = s.defaultDifficulty;
      tuningId = s.defaultTuning;
      return;
    }
    let note;
    try {
      note = await getNote(editId);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't open that note.");
      notFound = true;
      return;
    }
    // Bailing quietly here left a blank form that, on save, updated zero rows
    // and still reported "Note updated" before navigating to a note that
    // doesn't exist.
    if (!note) {
      notFound = true;
      return;
    }
    title = note.title;
    artist = note.artist;
    key = note.key;
    capo = note.capo;
    difficulty = note.difficulty;
    noteType = note.type;
    tuningId = note.tuning || DEFAULT_TUNING.id;
    chordSheet = note.chordSheet ?? "";
    if (note.tabBlocks?.length) tabBlocks = note.tabBlocks;
    manualChords = note.chords;
    if (note.strummingPattern?.length)
      pattern = note.strummingPattern as StrokeType[];
    if (note.bpm) bpm = note.bpm;
    tags = note.tags ?? [];
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
      // The element can go away between scheduling and the frame firing.
      if (!textareaEl) return;
      textareaEl.focus();
      const pos = start + text.length;
      textareaEl.setSelectionRange(pos, pos);
    });
  }

  function insertChord(name: string) {
    insertAtCursor(`[${name}]`);
  }

  function insertStrum(stroke: StrokeType) {
    insertAtCursor(`{${stroke}}`);
  }

  function insertTabRef(label: string) {
    const start = textareaEl?.selectionStart ?? chordSheet.length;
    const before = chordSheet.slice(0, start);
    const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    insertAtCursor(`${lead}[tab: ${label}]\n`);
  }

  async function handleFetchLyrics() {
    fetchingLyrics = true;
    try {
      const lyrics = await fetchLyrics(artist.trim(), title.trim());
      if (!lyrics) {
        toast.error("Lyrics not found");
        return;
      }
      if (chordSheet.trim()) {
        toast("Replace chord sheet with fetched lyrics?", {
          action: { label: "Replace", onClick: () => { chordSheet = lyrics; } },
        });
      } else {
        chordSheet = lyrics;
      }
    } catch {
      toast.error("Failed to fetch lyrics");
    } finally {
      fetchingLyrics = false;
    }
  }

  async function save() {
    saving = true;
    try {
      const filledTabs = tabBlocks.filter(tabBlockFilled);
      const hasSheet = chordSheet.trim().length > 0;
      const input = {
        type: noteType,
        title: title.trim(),
        artist: artist.trim(),
        key,
        capo,
        difficulty: difficulty as "beginner" | "intermediate" | "advanced",
        tags,
        tuning: tuningId,
        chordSheet: hasSheet ? chordSheet : undefined,
        tabBlocks: filledTabs.length ? filledTabs : undefined,
        chords: allChords,
        strummingPattern: pattern.some((s) => s !== "") ? pattern : undefined,
        bpm: Number.isFinite(bpm) && (bpm as number) > 0 ? bpm : undefined,
      };
      if (editId) {
        const updated = await updateNote(editId, input);
        if (!updated) {
          notFound = true;
          toast.error("That note no longer exists.");
          return;
        }
        toast.success("Note updated");
        goto(`/notes/${editId}`);
      } else {
        const note = await createNote(input);
        toast.success("Note saved");
        goto(`/notes/${note.id}`);
      }
    } catch (err) {
      toast.error("Failed to save note");
      console.error(err);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window onkeydown={handleFormKey} />

{#if notFound}
  <div
    class="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-14 text-center"
  >
    <FileText class="size-8 text-muted-foreground/40" />
    <p class="font-medium">That note doesn't exist</p>
    <p class="text-sm text-muted-foreground">
      It may have been deleted, or the link may be wrong.
    </p>
    <div class="mt-1 flex gap-2">
      <Button variant="outline" onclick={() => goto("/")}>Back to notes</Button>
      <Button onclick={() => goto("/create")}>New note</Button>
    </div>
  </div>
{:else}

<!-- ══ Pane switch + save, pinned while the long form scrolls (below lg) ══ -->
<div
  class="sticky top-0 z-30 -mx-4 mb-5 flex items-center gap-2 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur lg:hidden"
>
  <div class="flex flex-1 rounded-lg border border-border p-0.5">
    {#each [{ id: "edit", label: "Edit" }, { id: "preview", label: "Preview" }] as pane}
      <button
        type="button"
        onclick={() => (mobilePane = pane.id as "edit" | "preview")}
        aria-pressed={mobilePane === pane.id}
        class={cn(
          "h-9 flex-1 rounded-md text-sm font-medium transition-colors",
          mobilePane === pane.id
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )}
      >
        {pane.label}
      </button>
    {/each}
  </div>
  <Button
    size="sm"
    class="h-10 px-4"
    disabled={saving || !title.trim() || !artist.trim()}
    onclick={save}
  >
    {saving ? "Saving…" : "Save"}
  </Button>
</div>

<div class="grid gap-8 lg:h-full lg:grid-cols-2 lg:gap-0">
  <!-- ══ Editors (left) ══════════════════════════════════════════ -->
  <div
    class={cn(
      "min-w-0 space-y-8 lg:overflow-y-auto lg:pb-8 lg:pl-[max(1rem,calc(50vw-35rem))] lg:pr-8 lg:block",
      mobilePane !== "edit" && "hidden"
    )}
  >
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
          <Label>Type</Label>
          <Select bind:value={noteType} items={TYPE_ITEMS} class="w-32" />
        </div>

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
            class="flex h-10 w-20 rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-8 sm:text-sm dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <div class="space-y-1.5">
          <Label>Difficulty</Label>
          <Select bind:value={difficulty} items={DIFFICULTY_ITEMS} class="w-40" />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Tags</Label>
        <TagInput {tags} onChange={(t) => (tags = t)} />
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
          <h2 class="text-base font-semibold leading-tight">Song</h2>
          <p class="text-xs text-muted-foreground">
            Chords, lyrics and tabs in one place, in playing order.
          </p>
        </div>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label for="chordsheet">Editor</Label>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="flex-1 sm:flex-none"
              disabled={!title.trim() || !artist.trim() || fetchingLyrics}
              onclick={handleFetchLyrics}
            >
              {#if fetchingLyrics}
                <Loader2 class="animate-spin" />
              {:else}
                <FileText />
              {/if}
              {fetchingLyrics ? "Fetching…" : "Fetch lyrics"}
            </Button>
            <Button
              variant={finderOpen ? "secondary" : "outline"}
              size="sm"
              class="flex-1 sm:flex-none"
              onclick={() => (finderOpen = !finderOpen)}
              aria-expanded={finderOpen}
            >
              <Wand2 />
              Chord finder
            </Button>
            <Button
              variant={strumPickerOpen ? "secondary" : "outline"}
              size="sm"
              class="flex-1 sm:flex-none"
              onclick={() => (strumPickerOpen = !strumPickerOpen)}
              aria-expanded={strumPickerOpen}
            >
              <AudioWaveform />
              Strum marks
            </Button>
          </div>
        </div>

        <textarea
          id="chordsheet"
          bind:this={textareaEl}
          bind:value={chordSheet}
          rows={16}
          spellcheck={false}
          autocapitalize="off"
          placeholder={"[Verse]\n[G]Here is a [D]line with [Em]chords\n{D}[C]Another line, strummed down on the first beat"}
          class="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-base leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 sm:text-sm dark:bg-input/30"
        ></textarea>

        <p class="text-xs text-muted-foreground">
          Put chords in brackets right before the syllable, e.g.
          <code class="rounded bg-muted px-1 py-0.5">[Am]</code>. Put a strum
          mark in braces the same way, e.g.
          <code class="rounded bg-muted px-1 py-0.5">{"{D}"}</code> for a down-
          strum or <code class="rounded bg-muted px-1 py-0.5">{"{U}"}</code>
          for up. A line like
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

        {#if strumPickerOpen}
          <StrumPanel onInsert={insertStrum} />
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
          <h2 class="text-base font-semibold leading-tight">Tabs</h2>
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
        <h2 class="text-base font-semibold">Strumming pattern</h2>
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
          class="flex h-10 w-24 rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-8 sm:text-sm dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <StrummingEditor {pattern} onChange={(p) => (pattern = p)} />
    </section>

    <Separator />

    <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        class="w-full sm:w-auto"
        onclick={() => closeAllLayers(() => window.history.back())}
      >
        Cancel
      </Button>
      <Button
        class="w-full sm:w-auto"
        disabled={saving || !title.trim() || !artist.trim()}
        onclick={save}
      >
        {saving ? "Saving…" : editId ? "Update note" : "Save note"}
      </Button>
    </div>
  </div>

  <!-- ══ Preview (right) ═════════════════════════════════════════ -->
  <div
    class={cn(
      "lg:block lg:overflow-y-auto lg:border-l lg:border-border lg:pl-8 lg:pr-[max(1rem,calc(50vw-35rem))]",
      mobilePane !== "preview" && "hidden"
    )}
  >
    <!-- Below `lg` the preview is only on screen when its pane is selected.
         Hiding it with a class still built and re-parsed the whole document
         on every keystroke for something the phone user could not see. -->
    {#if !isCompact.current || mobilePane === "preview"}
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
        stringNames={tuning.names}
      />
    {/if}
  </div>
</div>
{/if}
