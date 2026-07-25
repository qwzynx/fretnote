<script lang="ts">
  import { Hand } from "@lucide/svelte";
  import type { TabHint } from "@/lib/types";
  import { fingerShape, fingeredNotes, FINGER_LABELS } from "@/lib/music/fingering";
  import { DEFAULT_TUNING, TUNINGS } from "@/lib/music/tunings";
  import { getSettings } from "@/lib/settings";
  import FingerFretboard from "./FingerFretboard.svelte";
  import { cn } from "@/lib/utils";

  const settingsTuning =
    TUNINGS.find((t) => t.id === getSettings().defaultTuning) ?? DEFAULT_TUNING;

  let {
    hint,
    stringNames = settingsTuning.names,
    class: className = "",
  }: {
    hint: TabHint;
    stringNames?: readonly string[];
    class?: string;
  } = $props();

  const fingering = $derived(fingerShape(hint.frets));
  // Read out in finger order — it's an instruction, not a chord chart.
  const notes = $derived(
    fingeredNotes(hint.frets, fingering).sort((a, b) => a.finger - b.finger)
  );

  /** "an Em", "a G" — chord names starting with A, E or F take "an". */
  const article = (name: string) => (/^[AEF]/.test(name) ? "an" : "a");
</script>

<div
  class={cn(
    "flex max-w-full flex-wrap items-start gap-x-6 gap-y-4 rounded-lg border border-border bg-card/40 p-3 font-sans sm:inline-flex sm:p-4",
    className
  )}
>
  <FingerFretboard
    frets={hint.frets}
    fingering={fingering}
    {stringNames}
    label="Recommended hand shape for this tab"
    class="w-[8.5rem] shrink-0 sm:w-[152px]"
  />

  <div class="min-w-0 flex-1 space-y-2.5 sm:min-w-[13rem]">
    <p class="flex items-center gap-2 text-sm font-medium text-foreground">
      <Hand class="size-4 shrink-0 text-primary" />
      {#if hint.shape}
        Hold {article(hint.shape)}
        <span class="font-mono text-primary">{hint.shape}</span> shape
      {:else}
        Hand position
      {/if}
    </p>

    {#if notes.length > 0}
      <ul class="flex min-w-0 flex-wrap gap-x-5 gap-y-1.5">
        {#each notes as note}
          <li class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.5625rem] font-bold leading-none text-primary-foreground"
            >
              {note.finger}
            </span>
            {FINGER_LABELS[note.finger]} on {stringNames[note.string]}, fret
            {note.fret}
          </li>
        {/each}
      </ul>
    {/if}

    {#if hint.note}
      <p class="text-xs leading-relaxed text-foreground/80">{hint.note}</p>
    {/if}
  </div>
</div>
