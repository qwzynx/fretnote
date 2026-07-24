<script lang="ts">
  import type { TabBlock } from "@/lib/types";
  import { parseChordSheet } from "@/lib/music/parse";
  import { transposeChordSheet } from "@/lib/music/transpose";
  import { cn } from "@/lib/utils";
  import Popover from "@/components/ui/Popover.svelte";
  import ChordDiagram from "./ChordDiagram.svelte";
  import TabView from "./TabView.svelte";

  let {
    sheet,
    transpose = 0,
    fontSize = 16,
    tabBlocks = [] as TabBlock[],
    class: className = "",
  }: {
    sheet: string;
    transpose?: number;
    fontSize?: number;
    tabBlocks?: TabBlock[];
    class?: string;
  } = $props();

  const lines = $derived(
    parseChordSheet(transposeChordSheet(sheet, transpose))
  );
</script>

<div class={cn("font-mono leading-relaxed", className)} style="font-size: {fontSize}px">
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
          <TabView tab={block.columns} {fontSize} />
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
      <div class="flex flex-wrap items-end">
        {#each line.segments as seg, j}
          <span class="inline-flex flex-col">
            <span
              class="h-5 font-semibold leading-5 text-primary"
              style="font-size: {fontSize * 0.82}px"
            >
              {#if seg.chord}
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
              {:else}
                {" "}
              {/if}
            </span>
            <span class="whitespace-pre">
              {seg.text === "" ? " " : seg.text}
            </span>
          </span>
        {/each}
      </div>
    {/if}
  {/each}
</div>
