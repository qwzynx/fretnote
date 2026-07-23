<script lang="ts">
  import type { TabColumn } from "@/lib/types";
  import { TAB_STRING_LABELS } from "@/lib/types";
  import { cn } from "@/lib/utils";

  let {
    tab,
    fontSize = 15,
    class: className = "",
  }: {
    tab: TabColumn[];
    fontSize?: number;
    class?: string;
  } = $props();

  const ROW_TO_STRING = [5, 4, 3, 2, 1, 0];
  const CHAR_EM = 0.62;

  let innerWidth = $state(0);

  function measureWidth(node: HTMLElement) {
    const measure = () => {
      const s = getComputedStyle(node);
      const padX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
      innerWidth = node.clientWidth - padX;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return { destroy: () => ro.disconnect() };
  }

  const cellWidth = $derived(
    Math.max(1, ...tab.flatMap((col) => col.map((v) => v.length)))
  );

  const perRow = $derived(() => {
    const charPx = fontSize * CHAR_EM;
    const usableChars = innerWidth > 0 ? Math.floor(innerWidth / charPx) - 3 : 0;
    return usableChars > 0
      ? Math.max(1, Math.floor(usableChars / (cellWidth + 1)))
      : tab.length || 1;
  });

  const chunks = $derived(() => {
    const pr = perRow();
    const result: TabColumn[][] = [];
    for (let i = 0; i < tab.length; i += pr) {
      result.push(tab.slice(i, i + pr));
    }
    if (result.length === 0) result.push([]);
    return result;
  });

  function buildStave(cols: TabColumn[], cw: number): string[] {
    return ROW_TO_STRING.map((stringIdx, rowIdx) => {
      const label = TAB_STRING_LABELS[rowIdx];
      let line = `${label}|`;
      for (const col of cols) {
        const raw = col[stringIdx] === "" ? "-" : col[stringIdx];
        line += "-" + raw.padEnd(cw, "-");
      }
      line += "-|";
      return line;
    });
  }
</script>

<div
  use:measureWidth
  class={cn(
    "overflow-x-auto rounded-lg border border-border bg-card/60 p-4",
    className
  )}
>
  <div class="flex flex-col gap-4">
    {#each chunks() as chunk, i}
      <pre
        class="font-mono leading-6 text-foreground"
        style="font-size: {fontSize}px"
      >{buildStave(chunk, cellWidth).join("\n")}</pre>
    {/each}
  </div>
</div>
