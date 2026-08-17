<script lang="ts">
  import { STROKE_DISPLAY, type StrokeType } from "@/lib/strumming";
  import Card from "@/components/ui/Card.svelte";
  import { cn } from "@/lib/utils";

  const STROKES: StrokeType[] = ["D", "U", "d", "u", "X"];

  let { onInsert }: { onInsert: (stroke: StrokeType) => void } = $props();
</script>

<Card class="bg-muted/20 p-3 sm:p-4">
  <p class="mb-2.5 text-xs text-muted-foreground">
    Drop a strum mark at the cursor, right before the syllable it hits.
  </p>
  <div class="flex flex-wrap gap-1.5">
    {#each STROKES as s}
      {@const info = STROKE_DISPLAY[s]}
      <button
        type="button"
        onclick={() => onInsert(s)}
        title="Insert {'{' + s + '}'} — {info.label}"
        class={cn(
          "flex h-10 w-12 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background transition-colors hover:border-primary/40 hover:bg-primary/5 sm:h-9 sm:w-11"
        )}
      >
        <span class={cn("text-lg font-bold leading-none", info.className)}>
          {info.symbol}
        </span>
        <span class="text-3xs text-muted-foreground">{s}</span>
      </button>
    {/each}
  </div>
</Card>
