<script lang="ts">
  import {
    ChevronDown,
    Gauge,
    Minus,
    Pause,
    Play,
    Plus,
    RotateCcw,
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
  import FingerLegend from "./FingerLegend.svelte";
  import TabView from "./TabView.svelte";
  import TabHintView from "./TabHintView.svelte";
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
  let rootEl: HTMLElement;

  /**
   * The app shell scrolls an inner element, not the window, so walk up to
   * whichever ancestor actually owns the overflow.
   */
  function scrollHost(): HTMLElement {
    let el: HTMLElement | null = rootEl?.parentElement ?? null;
    while (el) {
      const overflowY = getComputedStyle(el).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return document.scrollingElement as HTMLElement;
  }

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
    const host = scrollHost();
    // Sub-pixel remainder, so slow speeds still creep instead of stalling.
    let offset = 0;

    const step = (ts: number) => {
      if (lastTs) {
        offset += (_speed * (ts - lastTs)) / 1000;
        const whole = Math.trunc(offset);
        if (whole > 0) {
          host.scrollTop += whole;
          offset -= whole;
        }
        if (host.scrollTop + host.clientHeight >= host.scrollHeight - 1) {
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

<div bind:this={rootEl}>
  <!--
    Toolbar. `top-0` because the sticky context is the app's scroll container,
    which already starts below the header. Phones get a single compact row of
    icon controls; the speed slider only appears while scrolling is running.
  -->
  <div
    class="sticky top-0 z-20 -mx-4 mb-5 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur sm:mb-6 sm:py-2.5"
    data-print-hide
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
      {#if note.type === "chords"}
        <div class="flex items-center gap-1 sm:gap-1.5">
          <span class="hidden text-xs text-muted-foreground sm:inline">
            Transpose
          </span>
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
              size="icon-sm"
              onclick={() => (transpose = 0)}
              class="text-muted-foreground"
              aria-label="Reset transpose"
            >
              <RotateCcw />
            </Button>
          {/if}
        </div>

        <Separator orientation="vertical" class="hidden h-6 sm:block" />
      {/if}

      <div class="flex items-center gap-1 sm:gap-1.5">
        <Type class="size-4 shrink-0 text-muted-foreground" />
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

      <Separator orientation="vertical" class="hidden h-6 sm:block" />

      <div class="ml-auto flex items-center gap-2 sm:ml-0">
        <Button
          variant={scrolling ? "default" : "outline"}
          size="sm"
          onclick={() => (scrolling = !scrolling)}
          aria-label={scrolling ? "Pause auto-scroll" : "Start auto-scroll"}
        >
          {#if scrolling}
            <Pause />
          {:else}
            <Play />
          {/if}
          <span class="hidden sm:inline">Auto-scroll</span>
        </Button>
        <div class="hidden w-28 items-center gap-2 sm:flex">
          <Slider bind:value={speed} min={5} max={100} step={5} aria-label="Auto-scroll speed" />
        </div>
      </div>
    </div>

    <!-- Phone: speed control surfaces only while the page is moving. -->
    {#if scrolling}
      <div class="mt-2 flex items-center gap-3 sm:hidden">
        <Gauge class="size-4 shrink-0 text-muted-foreground" />
        <Slider bind:value={speed} min={5} max={100} step={5} aria-label="Auto-scroll speed" />
        <span class="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {speed} px/s
        </span>
      </div>
    {/if}
  </div>

  <!-- Chords used -->
  {#if note.chords.length > 0}
    <div class="mb-5 sm:mb-6">
      <div class="mb-2.5 flex items-center gap-2 text-sm font-medium text-muted-foreground sm:mb-3">
        <ChevronDown class="size-4" />
        Chords in this note
      </div>
      <!-- Swipeable strip on phones so the diagrams stay legible. -->
      <div
        class="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:gap-4 sm:px-0"
      >
        {#each note.chords as c}
          <ChordDiagram
            name={transposeKey(c, note.type === "chords" ? transpose : 0)}
            class="w-[4.5rem] shrink-0 sm:w-20"
          />
        {/each}
      </div>
      <FingerLegend class="mt-2.5" />
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
          {#if block.hint}
            <TabHintView hint={block.hint} class="mb-3" />
          {/if}
          <TabView tab={block.columns} {fontSize} />
        </div>
      {/each}
    </div>
  {/if}
</div>
