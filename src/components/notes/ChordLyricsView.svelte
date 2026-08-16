<script lang="ts">
  import type { TabBlock } from "@/lib/types";
  import { parseChordSheet } from "@/lib/music/parse";
  import { transposeChordSheet } from "@/lib/music/transpose";
  import { STROKE_DISPLAY } from "@/lib/strumming";
  import { cn } from "@/lib/utils";
  import Popover from "@/components/ui/Popover.svelte";
  import ChordDiagram from "./ChordDiagram.svelte";
  import TabView from "./TabView.svelte";
  import TabHintView from "./TabHintView.svelte";

  let {
    sheet,
    transpose = 0,
    fontSize = 16,
    tabBlocks = [] as TabBlock[],
    stringNames,
    detailed = false,
    class: className = "",
  }: {
    sheet: string;
    transpose?: number;
    fontSize?: number;
    tabBlocks?: TabBlock[];
    /** String labels for the finger-placement diagrams; defaults to the saved tuning. */
    stringNames?: readonly string[];
    /** Show full chord diagrams inline above the lyrics instead of just the chord name. */
    detailed?: boolean;
    class?: string;
  } = $props();

  const lines = $derived(
    parseChordSheet(transposeChordSheet(sheet, transpose))
  );
</script>

<div
  class={cn("max-w-full font-mono leading-relaxed sm:overflow-x-auto", className)}
  style="font-size: {fontSize}px"
>
  {#each lines as line, i}
    {#if line.kind === "blank"}
      <div style="height: {fontSize * 1.4}px"></div>
    {:else if line.kind === "section"}
      <div
        class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-primary first:mt-0"
      >
        {line.label}
      </div>
    {:else if line.kind === "tabref"}
      {@const block = tabBlocks.find(
        (b) => b.label.trim().toLowerCase() === line.name.toLowerCase()
      )}
      <div class="my-3">
        <div
          class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary"
        >
          {block?.label || line.name}
        </div>
        {#if block}
          {#if block.hint}
            <div class="flex flex-wrap items-start gap-3 sm:flex-nowrap">
              <TabHintView hint={block.hint} {stringNames} />
              <TabView tab={block.columns} {fontSize} class="min-w-0 flex-1" />
            </div>
          {:else}
            <TabView tab={block.columns} {fontSize} />
          {/if}
        {:else}
          <div
            class="rounded-lg border border-dashed border-border bg-card/40 px-3 py-2 text-sm text-muted-foreground"
            style="font-size: {fontSize * 0.85}px"
          >
            No tab named "{line.name}" yet.
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex flex-wrap items-end sm:flex-nowrap">
        {#each line.segments as seg, j}
          <span class="inline-flex max-w-full flex-col sm:max-w-none">
            <span
              class={cn(
                "font-semibold text-primary",
                detailed && seg.chord ? "mb-1 block" : "h-5 leading-5"
              )}
              style="font-size: {fontSize * 0.82}px"
            >
              {#if seg.chord}
                {#if detailed}
                  <ChordDiagram name={seg.chord} class="w-14" frets={4} showFingers={false} />
                {:else}
                  <Popover>
                    {#snippet trigger()}
                      <button
                        class="cursor-pointer rounded px-0.5 outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Show {seg.chord} chord diagram"
                        type="button"
                      >
                        {seg.chord}
                      </button>
                    {/snippet}
                    {#snippet content()}
                      <ChordDiagram name={seg.chord!} />
                    {/snippet}
                  </Popover>
                {/if}
              {:else if seg.strum}
                {@const info = STROKE_DISPLAY[seg.strum]}
                <span
                  class={cn("px-0.5 font-bold", info.className)}
                  title="Strum: {info.label}"
                >
                  {info.symbol}
                </span>
              {:else}
                {" "}
              {/if}
            </span>
            <span class="whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">
              {seg.text === "" ? " " : seg.text}
            </span>
          </span>
        {/each}
      </div>
    {/if}
  {/each}
</div>
