<script lang="ts">
  import {
    ChevronDown,
    Minus,
    Pause,
    Play,
    Plus,
    Type,
  } from "@lucide/svelte";
  import type { Note } from "@/lib/types";
  import { formatSemitones, transposeKey } from "@/lib/music/transpose";
  import type { StrokeType } from "@/lib/strumming";
  import { getSettings } from "@/lib/settings";
  import Button from "@/components/ui/Button.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import Slider from "@/components/ui/Slider.svelte";
  import ChordLyricsView from "./ChordLyricsView.svelte";
  import ChordDiagram from "./ChordDiagram.svelte";
  import TabView from "./TabView.svelte";
  import StrummingPreview from "@/components/create/StrummingPreview.svelte";
  import Metronome from "./Metronome.svelte";

  const MIN_FONT = 12;
  const MAX_FONT = 26;

  let { note }: { note: Note } = $props();

  const _s = getSettings();
  let transpose = $state(0);
  let fontSize = $state(_s.defaultFontSize);
  let scrolling = $state(false);
  let speed = $state(_s.defaultScrollSpeed);

  let rafId: number | null = null;
  let lastTs = 0;

  $effect(() => {
    if (!scrolling) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        lastTs = 0;
      }
      return;
    }

    const _speed = speed;

    const step = (ts: number) => {
      if (lastTs) {
        const dt = (ts - lastTs) / 1000;
        window.scrollBy(0, _speed * dt);
        const atBottom =
          window.innerHeight + window.scrollY >= document.body.scrollHeight - 1;
        if (atBottom) {
          scrolling = false;
          lastTs = 0;
          rafId = null;
          return;
        }
      }
      lastTs = ts;
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      lastTs = 0;
    };
  });

  function clampFont(v: number) {
    fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, v));
  }

  function handleKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).matches("input, textarea, select, [contenteditable]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === " ") {
      e.preventDefault();
      scrolling = !scrolling;
    } else if (e.key === "[" && note.type === "chords") {
      transpose -= 1;
    } else if (e.key === "]" && note.type === "chords") {
      transpose += 1;
    } else if (e.key === "+" || e.key === "=") {
      clampFont(fontSize + 1);
    } else if (e.key === "-") {
      clampFont(fontSize - 1);
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<div>
  <!-- Toolbar -->
  <div
    class="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/80 bg-background px-4 py-2.5"
  >
    {#if note.type === "chords"}
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-muted-foreground">Transpose</span>
        <Button
          variant="outline"
          size="icon-sm"
          onclick={() => (transpose -= 1)}
          aria-label="Transpose down"
        >
          <Minus />
        </Button>
        <span class="min-w-14 text-center font-mono text-sm">
          {transposeKey(note.key, transpose)}
          <span class="text-muted-foreground">({formatSemitones(transpose)})</span>
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onclick={() => (transpose += 1)}
          aria-label="Transpose up"
        >
          <Plus />
        </Button>
        {#if transpose !== 0}
          <Button
            variant="ghost"
            size="sm"
            onclick={() => (transpose = 0)}
            class="text-muted-foreground"
          >
            Reset
          </Button>
        {/if}
      </div>
    {/if}

    <Separator orientation="vertical" class="h-6" />

    <div class="flex items-center gap-1.5">
      <Type class="size-4 text-muted-foreground" />
      <Button
        variant="outline"
        size="icon-sm"
        onclick={() => clampFont(fontSize - 1)}
        aria-label="Decrease font size"
      >
        <Minus />
      </Button>
      <span class="w-6 text-center font-mono text-sm">{fontSize}</span>
      <Button
        variant="outline"
        size="icon-sm"
        onclick={() => clampFont(fontSize + 1)}
        aria-label="Increase font size"
      >
        <Plus />
      </Button>
    </div>

    <Separator orientation="vertical" class="h-6" />

    <div class="flex items-center gap-2">
      <Button
        variant={scrolling ? "default" : "outline"}
        size="sm"
        onclick={() => (scrolling = !scrolling)}
      >
        {#if scrolling}
          <Pause />
        {:else}
          <Play />
        {/if}
        Auto-scroll
      </Button>
      <div class="flex w-28 items-center gap-2">
        <Slider bind:value={speed} min={5} max={100} step={5} aria-label="Auto-scroll speed" />
      </div>
    </div>
  </div>

  <!-- Chords used -->
  {#if note.chords.length > 0}
    <div class="mb-6">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ChevronDown class="size-4" />
        Chords in this note
      </div>
      <div class="flex flex-wrap gap-4">
        {#each note.chords as c}
          <ChordDiagram
            name={transposeKey(c, note.type === "chords" ? transpose : 0)}
            class="w-20"
          />
        {/each}
      </div>
    </div>
  {/if}

  <!-- Strumming pattern -->
  {#if note.strummingPattern?.some((s) => s !== "")}
    <div class="mb-6">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Strumming
      </p>
      {#if note.bpm}
        <p class="mb-1.5 font-mono text-sm font-semibold text-foreground">
          {note.bpm} BPM
        </p>
      {/if}
      <StrummingPreview pattern={note.strummingPattern as StrokeType[]} />
    </div>
  {/if}

  <!-- Metronome -->
  {#if note.bpm}
    <div class="mb-6 rounded-lg border border-border bg-muted/20 p-4">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Metronome
      </p>
      <Metronome bpm={note.bpm} />
    </div>
  {/if}

  <!-- Body -->
  {#if note.type === "chords" && note.chordSheet}
    <ChordLyricsView
      sheet={note.chordSheet}
      {transpose}
      {fontSize}
      tabBlocks={note.tabBlocks}
    />
  {:else if note.tabBlocks?.length}
    <div class="space-y-6">
      {#each note.tabBlocks as block (block.id)}
        <div>
          {#if block.label}
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              {block.label}
            </p>
          {/if}
          <TabView tab={block.columns} {fontSize} />
        </div>
      {/each}
    </div>
  {/if}
</div>
