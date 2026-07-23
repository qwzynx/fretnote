<script lang="ts">
  import { RotateCcw, Plus, Minus } from "@lucide/svelte";
  import {
    STROKE_CYCLE,
    STROKE_DISPLAY,
    LABELS_8,
    LABELS_16,
    type StrokeType,
  } from "@/lib/strumming";
  import Button from "@/components/ui/Button.svelte";
  import { cn } from "@/lib/utils";

  let {
    pattern,
    onChange,
  }: {
    pattern: StrokeType[];
    onChange: (pattern: StrokeType[]) => void;
  } = $props();

  let subdivision = $state<8 | 16>(8);
  const labels = $derived(subdivision === 8 ? LABELS_8 : LABELS_16);

  function cycleStroke(idx: number) {
    const cur = pattern[idx];
    const next = [...pattern] as StrokeType[];
    next[idx] = STROKE_CYCLE[(STROKE_CYCLE.indexOf(cur) + 1) % STROKE_CYCLE.length];
    onChange(next);
  }

  function addBar() {
    onChange([...pattern, ...(Array(subdivision).fill("") as StrokeType[])]);
  }

  function removeBar() {
    if (pattern.length > subdivision) onChange(pattern.slice(0, -subdivision));
  }

  function reset() {
    onChange(Array(subdivision).fill("") as StrokeType[]);
  }

  const isDownbeat = (i: number) => i % (subdivision === 8 ? 2 : 4) === 0;
  const bars = $derived(Math.ceil(pattern.length / subdivision));
</script>

<div class="space-y-3">
  <!-- Controls -->
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {#each [8, 16] as sub}
        <button
          type="button"
          onclick={() => (subdivision = sub as 8 | 16)}
          class={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            subdivision === sub
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {sub === 8 ? "8ths" : "16ths"}
        </button>
      {/each}
    </div>

    <div class="ml-auto flex items-center gap-1.5">
      <span class="text-xs text-muted-foreground"
        >{bars} bar{bars !== 1 ? "s" : ""}</span
      >
      <Button
        variant="outline"
        size="sm"
        onclick={removeBar}
        disabled={pattern.length <= subdivision}
      >
        <Minus />
        Bar
      </Button>
      <Button variant="outline" size="sm" onclick={addBar}>
        <Plus />
        Bar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onclick={reset}
        class="text-muted-foreground"
      >
        <RotateCcw />
        Reset
      </Button>
    </div>
  </div>

  <p class="text-xs text-muted-foreground">
    Click a box to cycle: ↓ down · ↑ up · faint ↓↑ soft · ✕ mute · · rest
  </p>

  <!-- Grid -->
  <div
    class="flex flex-wrap gap-x-4 gap-y-3 rounded-xl border border-border bg-card/60 p-4"
  >
    {#each Array.from({ length: bars }, (_, bar) => bar) as bar}
      {@const start = bar * subdivision}
      {@const slots = pattern.slice(start, start + subdivision)}
      <div class="flex flex-col gap-1">
        <!-- beat labels -->
        <div class="flex gap-1">
          {#each slots as _, i}
            <div
              class={cn(
                "flex h-4 w-8 items-center justify-center text-[10px]",
                isDownbeat(start + i)
                  ? "font-bold text-foreground"
                  : "text-muted-foreground/50"
              )}
            >
              {labels[(start + i) % subdivision]}
            </div>
          {/each}
        </div>
        <!-- stroke buttons -->
        <div class="flex gap-1">
          {#each slots as stroke, i}
            {@const info = STROKE_DISPLAY[stroke]}
            <button
              type="button"
              onclick={() => cycleStroke(start + i)}
              title={info.label}
              class={cn(
                "flex h-11 w-8 items-center justify-center rounded-md border text-xl font-bold transition-colors",
                isDownbeat(start + i)
                  ? "border-border"
                  : "border-border/40 bg-muted/20",
                stroke !== "" && "border-primary/40 bg-primary/5",
                info.className
              )}
            >
              {info.symbol}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
