<script lang="ts">
  import { ChevronDown, ChevronLeft, ChevronRight, Hand } from "@lucide/svelte";
  import type { TabColumn } from "@/lib/types";
  import {
    FINGER_LABELS,
    fingeredNotes,
    tabSteps,
    type Finger,
    type StringState,
    type TabStep,
  } from "@/lib/music/fingering";
  import { DEFAULT_TUNING, TUNINGS } from "@/lib/music/tunings";
  import { getSettings } from "@/lib/settings";
  import Button from "@/components/ui/Button.svelte";
  import FingerFretboard from "./FingerFretboard.svelte";
  import FingerLegend from "./FingerLegend.svelte";
  import { cn } from "@/lib/utils";

  const settingsTuning =
    TUNINGS.find((t) => t.id === getSettings().defaultTuning) ?? DEFAULT_TUNING;

  let {
    columns,
    stringNames = settingsTuning.names,
    class: className = "",
  }: {
    columns: readonly TabColumn[];
    stringNames?: readonly string[];
    class?: string;
  } = $props();

  let open = $state(true);
  let requested = $state(0);

  const steps = $derived(tabSteps(columns));
  const index = $derived(Math.min(requested, Math.max(0, steps.length - 1)));
  const step = $derived<TabStep | undefined>(steps[index]);
  /**
   * One line per finger the player has to place. A barre is several strings
   * under one finger, so it collapses into a single line.
   */
  const placements = $derived.by<{ finger: Finger; where: string }[]>(() => {
    if (!step) return [];
    const bar = step.fingering.barre;
    const rows: { finger: Finger; where: string }[] = [];
    let barreShown = false;

    for (const note of fingeredNotes(step.frets, step.fingering)) {
      const barred =
        !!bar &&
        note.fret === bar.fret &&
        note.string >= bar.from &&
        note.string <= bar.to;

      if (barred && bar) {
        if (barreShown) continue;
        barreShown = true;
        rows.push({
          finger: note.finger,
          where: `flat across ${stringNames[bar.to]}–${stringNames[bar.from]} strings, fret ${bar.fret}`,
        });
        continue;
      }
      rows.push({
        finger: note.finger,
        where: `on ${stringNames[note.string]} string, fret ${note.fret}`,
      });
    }
    return rows;
  });
  const openStrings = $derived(
    step ? namesFor(step.frets, (f) => f === 0) : []
  );
  const mutedStrings = $derived(
    step ? namesFor(step.frets, (f) => f === -1) : []
  );

  /** String names, high-e first, for every string matching `test`. */
  function namesFor(
    frets: readonly StringState[],
    test: (fret: StringState) => boolean
  ): string[] {
    const out: string[] = [];
    for (let s = 5; s >= 0; s--) if (test(frets[s])) out.push(stringNames[s]);
    return out;
  }

  function go(delta: number) {
    if (steps.length === 0) return;
    requested = (index + delta + steps.length) % steps.length;
  }

  function ordinal(n: number): string {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return n + (["th", "st", "nd", "rd"][n % 10] ?? "th");
  }

  /** What the column asks for, written the way it reads in the tab. */
  function stepLabel(s: TabStep): string {
    const parts: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const fret = s.frets[i];
      if (fret === null) continue;
      parts.push(fret === -1 ? "x" : String(fret));
    }
    // A column of nothing but mutes is one gesture, not six.
    if (parts.length > 1 && parts.every((p) => p === "x")) return "x";
    return parts.join("/") || "–";
  }
</script>

<div class={cn("rounded-lg border border-border bg-card/40", className)}>
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex w-full items-center gap-2 px-3 py-2 text-left"
  >
    <Hand class="size-3.5 shrink-0 text-primary" />
    <span class="text-xs font-medium">Finger placement</span>
    <span class="text-3xs text-muted-foreground">
      {steps.length}
      {steps.length === 1 ? "step" : "steps"}
    </span>
    <ChevronDown
      class={cn(
        "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
        !open && "-rotate-90"
      )}
    />
  </button>

  {#if open}
    <div class="border-t border-border/60 p-3">
      {#if !step}
        <p class="text-xs text-muted-foreground">
          Nothing tabbed out yet — add fret numbers and the fingering shows up
          here.
        </p>
      {:else}
        <div class="flex flex-wrap items-start gap-x-5 gap-y-4">
          <FingerFretboard
            frets={step.frets}
            fingering={step.fingering}
            {stringNames}
            label="Finger placement for tab column {step.column + 1}"
            class="w-[150px] shrink-0"
          />

          <div class="min-w-[13rem] flex-1 space-y-2.5">
            <div class="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onclick={() => go(-1)}
                aria-label="Previous note"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onclick={() => go(1)}
                aria-label="Next note"
              >
                <ChevronRight />
              </Button>
              <span class="font-mono text-xs text-foreground">
                {index + 1}/{steps.length}
                <span class="text-muted-foreground"
                  >· column {step.column + 1}</span
                >
              </span>
            </div>

            {#if placements.length > 0}
              <ul class="space-y-1">
                {#each placements as row}
                  <li class="flex items-center gap-2 text-xs">
                    <span
                      class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.5rem] font-bold text-primary-foreground"
                    >
                      {row.finger}
                    </span>
                    <span class="text-foreground">
                      {FINGER_LABELS[row.finger]}
                    </span>
                    <span class="text-muted-foreground">{row.where}</span>
                  </li>
                {/each}
              </ul>
              <p class="text-3xs text-muted-foreground">
                Hand in {step.fingering.position === 1
                  ? "open position"
                  : `${ordinal(step.fingering.position)} position`} — index finger
                at fret {step.fingering.position}.
              </p>
            {:else}
              <p class="text-xs text-muted-foreground">
                No fretting hand needed here.
              </p>
            {/if}

            {#if openStrings.length > 0}
              <p class="text-3xs text-muted-foreground">
                Let ring open: <span class="font-mono text-foreground"
                  >{openStrings.join(" ")}</span
                >
              </p>
            {/if}
            {#if mutedStrings.length > 0}
              <p class="text-3xs text-muted-foreground">
                Mute: <span class="font-mono text-foreground"
                  >{mutedStrings.join(" ")}</span
                >
              </p>
            {/if}

            <div class="max-h-20 overflow-y-auto pr-1">
              <div class="flex flex-wrap gap-1">
                {#each steps as s, i}
                  <button
                    type="button"
                    onclick={() => (requested = i)}
                    title="Column {s.column + 1}"
                    class={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[0.625rem] leading-4 transition-colors",
                      i === index
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {stepLabel(s)}
                  </button>
                {/each}
              </div>
            </div>

            <FingerLegend />
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
