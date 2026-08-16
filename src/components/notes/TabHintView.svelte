<script lang="ts">
  import type { TabHint } from "@/lib/types";
  import { fingerShape } from "@/lib/music/fingering";
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
</script>

<div class={cn("w-[8.5rem] shrink-0 font-sans sm:w-[152px]", className)}>
  <FingerFretboard
    frets={hint.frets}
    fingering={fingering}
    {stringNames}
    label={hint.shape ? `${hint.shape} shape` : "Recommended hand shape for this tab"}
  />

  {#if hint.shape}
    <p class="mt-1 truncate text-center font-mono text-xs text-primary">{hint.shape}</p>
  {/if}

  {#if hint.note}
    <p class="mt-1 text-center text-3xs leading-relaxed text-muted-foreground">{hint.note}</p>
  {/if}
</div>
