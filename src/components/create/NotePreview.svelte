<script lang="ts">
  import { Eye, Minus, Plus, Type, Music4 } from "@lucide/svelte";
  import type { TabBlock } from "@/lib/types";
  import type { StrokeType } from "@/lib/strumming";
  import { extractTabRefs } from "@/lib/music/parse";
  import Button from "@/components/ui/Button.svelte";
  import Badge from "@/components/ui/Badge.svelte";
  import ChordLyricsView from "@/components/notes/ChordLyricsView.svelte";
  import ChordDiagram from "@/components/notes/ChordDiagram.svelte";
  import TabView from "@/components/notes/TabView.svelte";
  import StrummingPreview from "./StrummingPreview.svelte";

  const MIN_FONT = 13;
  const MAX_FONT = 22;

  const DIFFICULTY_LABEL: Record<string, string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  const tabBlockFilled = (b: TabBlock) =>
    b.columns.some((col) => col.some((v) => v !== ""));

  let {
    title,
    artist,
    songKey,
    capo,
    difficulty,
    pattern,
    bpm,
    chords,
    sheet,
    tabBlocks,
  }: {
    title: string;
    artist: string;
    songKey: string;
    capo: number;
    difficulty: string;
    pattern: StrokeType[];
    bpm?: number;
    chords: string[];
    sheet: string;
    tabBlocks: TabBlock[];
  } = $props();

  let fontSize = $state(16);

  function clamp(v: number) {
    fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, v));
  }

  const hasPattern = $derived(pattern.some((s) => s !== ""));
  const hasSheet = $derived(sheet.trim().length > 0);
  const filledTabs = $derived(tabBlocks.filter(tabBlockFilled));
  const hasTab = $derived(filledTabs.length > 0);
  const hasBody = $derived(
    hasPattern || chords.length > 0 || hasSheet || hasTab
  );

  const referenced = $derived(
    new Set(extractTabRefs(sheet).map((n) => n.toLowerCase()))
  );
  const unplacedTabs = $derived(
    filledTabs.filter(
      (b) => !referenced.has(b.label.trim().toLowerCase())
    )
  );
</script>

<div
  class="flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm"
>
  <!-- Toolbar -->
  <div
    class="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2"
  >
      <div class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Eye class="size-3.5" />
        Preview
      </div>
      <div class="flex items-center gap-1">
        <Type class="size-3.5 text-muted-foreground" />
        <Button
          variant="ghost"
          size="icon-xs"
          onclick={() => clamp(fontSize - 1)}
          aria-label="Smaller text"
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onclick={() => clamp(fontSize + 1)}
          aria-label="Larger text"
        >
          <Plus />
        </Button>
      </div>
    </div>

    <!-- Body -->
    <div class="space-y-6 p-5">
      <!-- Title & metadata -->
      <header>
        <h2 class="font-heading text-2xl font-semibold tracking-tight">
          {#if title}
            {title}
          {:else}
            <span class="text-muted-foreground">Untitled note</span>
          {/if}
        </h2>
        <p class="mt-0.5 text-base text-muted-foreground">
          {artist || "Unknown artist"}
        </p>
        <div class="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" class="font-mono">Key {songKey}</Badge>
          {#if capo > 0}
            <Badge variant="secondary">Capo {capo}</Badge>
          {:else}
            <span class="text-xs text-muted-foreground">No capo</span>
          {/if}
          <span class="text-xs text-muted-foreground">
            {DIFFICULTY_LABEL[difficulty]}
          </span>
        </div>
      </header>

      <!-- Strumming -->
      {#if hasPattern}
        <section>
          <p
            class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Strumming
          </p>
          {#if bpm}
            <p class="mb-1.5 font-mono text-sm font-semibold text-foreground">
              {bpm} BPM
            </p>
          {/if}
          <StrummingPreview {pattern} />
        </section>
      {/if}

      <!-- Chord diagrams -->
      {#if chords.length > 0}
        <section>
          <p
            class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Chords in this song ({chords.length})
          </p>
          <div class="flex flex-wrap gap-3">
            {#each chords as c}
              <ChordDiagram name={c} class="w-16" />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Song sheet -->
      {#if hasSheet}
        <section>
          <p
            class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Song
          </p>
          <div class="overflow-x-auto">
            <ChordLyricsView {sheet} {fontSize} {tabBlocks} />
          </div>
        </section>
      {/if}

      <!-- Unplaced tabs -->
      {#if unplacedTabs.length > 0}
        <section>
          <p
            class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Tabs not placed yet
          </p>
          <div class="space-y-4">
            {#each unplacedTabs as block (block.id)}
              <div>
                {#if block.label.trim()}
                  <p class="mb-1.5 text-sm font-medium text-foreground">
                    {block.label}
                  </p>
                {/if}
                <TabView tab={block.columns} {fontSize} />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if !hasBody}
        <div
          class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center"
        >
          <Music4 class="size-6 text-muted-foreground/40" />
          <p class="max-w-[18rem] text-sm text-muted-foreground">
            Add a strumming pattern, chords, lyrics or a tab on the left and it
            will all appear here.
          </p>
        </div>
      {/if}
    </div>
  </div>
