<script lang="ts">
  import { cn } from "@/lib/utils";
  import { STROKE_DISPLAY, type StrokeType } from "@/lib/strumming";

  let { pattern }: { pattern: StrokeType[] } = $props();

  const hasStrokes = $derived(pattern.some((s) => s !== ""));
</script>

{#if hasStrokes}
  <div class="flex flex-wrap gap-0.5 font-mono text-lg leading-none">
    {#each pattern as s}
      <span class={cn("w-5 text-center", STROKE_DISPLAY[s].className)}>
        {STROKE_DISPLAY[s].symbol}
      </span>
    {/each}
  </div>
{/if}
