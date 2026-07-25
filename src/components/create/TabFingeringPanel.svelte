<script lang="ts">
  import { Check, Guitar, Hand, Search, Sparkles, Trash2 } from "@lucide/svelte";
  import type { TabBlock } from "@/lib/types";
  import { getChordShape } from "@/lib/music/chords";
  import { detectChord } from "@/lib/music/chord-detect";
  import { fingerShape } from "@/lib/music/fingering";
  import {
    shapeCoverage,
    suggestTabShapes,
    tabDemand,
    tabPositions,
  } from "@/lib/music/tab-shapes";
  import type { Tuning } from "@/lib/music/tunings";
  import FingerFretboard from "@/components/notes/FingerFretboard.svelte";
  import FingerLegend from "@/components/notes/FingerLegend.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import FretboardInput, { type Frets } from "./FretboardInput.svelte";
  import { cn } from "@/lib/utils";

  const MODES = [
    { id: "suggest", label: "Suggested", Icon: Sparkles },
    { id: "search", label: "Chord", Icon: Search },
    { id: "frets", label: "Frets", Icon: Guitar },
  ] as const;

  type Mode = (typeof MODES)[number]["id"];

  let {
    block,
    tuning,
    onChange,
  }: {
    block: TabBlock;
    tuning: Tuning;
    onChange: (block: TabBlock) => void;
  } = $props();

  const EMPTY_FRETS: Frets = [-1, -1, -1, -1, -1, -1];

  let mode = $state<Mode>("suggest");
  let query = $state("");

  // Each of these follows whatever the tab already recommends until the author
  // chooses something else, so the panel stays in step with the block.
  let chosen = $state<{ frets: Frets; shape?: string } | null>(null);
  let tapped = $state<Frets | null>(null);
  let typedNote = $state<string | null>(null);

  const hintFrets = $derived(
    block.hint ? ([...block.hint.frets] as Frets) : null
  );
  const picked = $derived(
    chosen ??
      (hintFrets ? { frets: hintFrets, shape: block.hint?.shape } : null)
  );
  const manual = $derived(tapped ?? hintFrets ?? EMPTY_FRETS);
  const noteText = $derived(typedNote ?? block.hint?.note ?? "");

  const demand = $derived(tabDemand(block.columns));
  const suggestions = $derived(suggestTabShapes(block.columns));
  const positions = $derived(tabPositions(block.columns));

  const trimmed = $derived(query.trim());
  const searchShape = $derived(trimmed ? getChordShape(trimmed) : null);

  /** The grip currently on show, whichever way the author is choosing it. */
  const active = $derived.by(() => {
    if (mode === "search") {
      return searchShape
        ? { frets: [...searchShape.frets] as Frets, shape: trimmed }
        : null;
    }
    if (mode === "frets") {
      return manual.some((f) => f > 0)
        ? { frets: manual, shape: detectChord(manual, tuning) ?? undefined }
        : null;
    }
    return picked;
  });

  const fingering = $derived(active ? fingerShape(active.frets) : null);
  const coverage = $derived(
    active ? shapeCoverage(active.frets, demand) : null
  );

  const saved = $derived(
    !!block.hint &&
      !!active &&
      block.hint.frets.join() === active.frets.join() &&
      (block.hint.note ?? "") === noteText.trim()
  );

  function save() {
    if (!active) return;
    onChange({
      ...block,
      hint: {
        frets: [...active.frets] as Frets,
        shape: active.shape,
        note: noteText.trim() || undefined,
      },
    });
  }

  function clear() {
    chosen = null;
    tapped = null;
    typedNote = null;
    onChange({ ...block, hint: undefined });
  }

  function pick(frets: readonly number[], shape: string) {
    chosen = { frets: [...frets] as Frets, shape };
  }

  const columnRange = (from: number, to: number) =>
    from === to ? `column ${from + 1}` : `columns ${from + 1}–${to + 1}`;
</script>

<div class="w-full rounded-lg border border-border bg-muted/20 p-4">
  <!-- Header: what this is, and how you want to pick the shape -->
  <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
    <div class="min-w-0 flex-1 space-y-1 sm:min-w-[14rem]">
      <p class="flex items-center gap-2 text-sm font-medium">
        <Hand class="size-4 text-primary" />
        Finger placement
      </p>
      <p class="max-w-prose text-xs leading-relaxed text-muted-foreground">
        Pick the hand shape that covers this tab, so players know where to put
        their fingers instead of chasing every note.
      </p>
    </div>

    <div
      class="flex w-full gap-1 rounded-lg border border-border bg-background p-1 sm:w-auto sm:shrink-0"
    >
      {#each MODES as m}
        {@const Icon = m.Icon}
        <button
          type="button"
          onclick={() => (mode = m.id)}
          class={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3",
            mode === m.id
              ? "bg-muted text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon class="size-3.5" />
          {m.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Chooser -->
  <div class="mt-4">
    {#if mode === "suggest"}
      <div class="space-y-3">
        {#if suggestions.length === 0}
          <p class="text-xs leading-relaxed text-muted-foreground">
            {#if demand.notes.length === 0}
              Add fret numbers to the tab and the shapes that fit show up here.
            {:else}
              No single shape holds this tab — it moves along the neck. Use the
              positions below, or pick a grip yourself.
            {/if}
          </p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each suggestions as s}
              {@const isPicked = picked?.frets.join() === s.frets.join()}
              <button
                type="button"
                onclick={() => pick(s.frets, s.label)}
                title="{s.label} — holds {s.covered} of {s.total} notes"
                class={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors",
                  isPicked
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {s.label}
                <span
                  class={cn(
                    "font-sans text-3xs",
                    s.covered === s.total
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {s.covered === s.total ? "all" : `${s.covered}/${s.total}`}
                </span>
              </button>
            {/each}
          </div>
        {/if}

        {#if positions.length > 0}
          <p class="text-xs leading-relaxed text-muted-foreground">
            {#if positions.length === 1}
              Stays at fret {positions[0].position} throughout.
            {:else}
              Hand moves: {#each positions as p, i}{i > 0
                  ? " → "
                  : ""}fret {p.position} ({columnRange(
                  p.fromColumn,
                  p.toColumn
                )}){/each}
            {/if}
          </p>
        {/if}
      </div>
    {:else if mode === "search"}
      <div class="space-y-1.5">
        <Input
          placeholder="Chord shape — Em, Am7, F#m…"
          bind:value={query}
          class="h-9 w-full max-w-xs text-sm"
        />
        {#if trimmed && !searchShape}
          <p class="text-xs text-destructive">No shape found for "{trimmed}".</p>
        {/if}
      </div>
    {:else}
      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">
          Tap the frets the hand holds.
        </p>
        <div class="overflow-x-auto pb-1">
          <FretboardInput
            frets={manual}
            onChange={(f) => (tapped = f)}
            stringNames={tuning.names}
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Result -->
  {#if active && fingering && coverage}
    <div class="mt-4 space-y-4 border-t border-border/60 pt-4">
      <div class="flex flex-wrap items-start gap-x-5 gap-y-3">
        <FingerFretboard
          frets={active.frets}
          fingering={fingering}
          stringNames={tuning.names}
          label="Recommended hand shape"
          class="w-[8.5rem] shrink-0 sm:w-[152px]"
        />

        <div class="min-w-0 flex-1 space-y-3 sm:min-w-[12rem]">
          <div class="space-y-1">
            {#if active.shape}
              <p class="font-mono text-sm font-semibold text-foreground">
                {active.shape}
              </p>
            {/if}
            <p class="text-xs leading-relaxed text-muted-foreground">
              {#if coverage.total === 0}
                Nothing fretted in this tab yet.
              {:else if coverage.covered === coverage.total}
                Holds every note of this tab.
              {:else}
                Holds {coverage.covered} of {coverage.total} notes.
              {/if}
              {#if coverage.blocked > 0}
                Lift {coverage.blocked === 1 ? "a finger" : "fingers"} for the open
                {coverage.blocked === 1 ? "string" : "strings"}.
              {/if}
            </p>
          </div>

          <FingerLegend />

          <Input
            value={noteText}
            oninput={(e: Event) =>
              (typedNote = (e.target as HTMLInputElement).value)}
            placeholder="Tip for the player (optional)"
            class="h-9 w-full text-sm"
          />

          <div class="flex flex-wrap gap-2">
            <Button size="sm" onclick={save} disabled={saved}>
              {#if saved}
                <Check />
                On tab
              {:else}
                <Hand />
                Use for this tab
              {/if}
            </Button>
            {#if block.hint}
              <Button
                size="sm"
                variant="ghost"
                onclick={clear}
                class="text-muted-foreground"
              >
                <Trash2 />
                Remove
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <p
      class="mt-4 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground"
    >
      {mode === "search"
        ? "Type a chord name to see its grip."
        : mode === "frets"
          ? "Tap frets to build a grip."
          : "Pick a shape above to show it with the tab."}
    </p>
  {/if}
</div>
