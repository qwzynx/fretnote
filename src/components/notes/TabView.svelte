<script lang="ts">
  import type { TabColumn } from "@/lib/types";
  import { STRING_NAMES } from "@/lib/types";
  import { cn } from "@/lib/utils";

  /** Standard tuning, in the low-E-first order `stringNames` expects. */
  const TAB_STRING_LABELS_LOW_FIRST = STRING_NAMES;

  let {
    tab,
    fontSize = 15,
    stringNames = TAB_STRING_LABELS_LOW_FIRST,
    class: className = "",
  }: {
    tab: TabColumn[];
    fontSize?: number;
    /** Open-string labels, low-E (index 0) first, matching `Tuning.names`. */
    stringNames?: readonly string[];
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

  const perRow = $derived.by(() => {
    const charPx = fontSize * CHAR_EM;
    const usableChars = innerWidth > 0 ? Math.floor(innerWidth / charPx) - 3 : 0;
    return usableChars > 0
      ? Math.max(1, Math.floor(usableChars / (cellWidth + 1)))
      : tab.length || 1;
  });

  const chunks = $derived.by(() => {
    const pr = perRow;
    const result: TabColumn[][] = [];
    for (let i = 0; i < tab.length; i += pr) {
      result.push(tab.slice(i, i + pr));
    }
    if (result.length === 0) result.push([]);
    return result;
  });

  // Alternate tunings bring two-character labels ("Eb", "G#") alongside
  // one-character ones, so every label is padded to the widest before the
  // bar line — otherwise the stave rows start at different columns.
  const labelWidth = $derived(
    Math.max(...stringNames.map((n) => n.length))
  );

  function buildStave(cols: TabColumn[], cw: number, lw: number): string[] {
    return ROW_TO_STRING.map((stringIdx) => {
      const label = stringNames[stringIdx].padEnd(lw, " ");
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
  data-no-swipe-nav
  class={cn(
    "overflow-x-auto rounded-lg border border-border bg-card/60 p-3 sm:p-4",
    className
  )}
>
  <div class="flex flex-col gap-4">
    {#each chunks as chunk}
      <pre
        class="font-mono leading-6 text-foreground"
        style="font-size: {fontSize}px"
      >{buildStave(chunk, cellWidth, labelWidth).join("\n")}</pre>
    {/each}
  </div>
</div>
