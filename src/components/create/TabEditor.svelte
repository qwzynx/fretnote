<script lang="ts">
  import { Plus, Trash2, Eraser, X, CornerDownLeft } from "@lucide/svelte";
  import type { TabBlock, TabColumn } from "@/lib/types";
  import type { Tuning } from "@/lib/music/tunings";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";

  const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0] as const;
  const COL_W = 32;
  const GUTTER_W = 48;

  const emptyColumn = (): TabColumn => ["", "", "", "", "", ""];

  function sanitize(raw: string): string {
    const v = raw.trim().toLowerCase();
    if (v === "") return "";
    if (v === "x") return "x";
    return v.replace(/[^0-9]/g, "").slice(0, 2);
  }

  let {
    block,
    onChange,
    onRemove,
    onInsert,
    tuning,
  }: {
    block: TabBlock;
    onChange: (block: TabBlock) => void;
    onRemove: () => void;
    onInsert: () => void;
    tuning: Tuning;
  } = $props();

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

  const perRow = $derived(
    innerWidth > 0
      ? Math.max(1, Math.floor((innerWidth - GUTTER_W) / COL_W))
      : block.columns.length || 1
  );

  const chunks = $derived(() => {
    const result: number[][] = [];
    for (let i = 0; i < block.columns.length; i += perRow) {
      const end = Math.min(i + perRow, block.columns.length);
      result.push(Array.from({ length: end - i }, (_, k) => i + k));
    }
    return result;
  });

  // refs[rowIdx][colIdx]
  let refs: (HTMLInputElement | null)[][] = [];

  function setColumns(next: TabColumn[]) {
    onChange({ ...block, columns: next });
  }

  function setCell(colIdx: number, strIdx: number, value: string) {
    setColumns(
      block.columns.map((col, ci) =>
        ci === colIdx
          ? (col.map((v, si) => (si === strIdx ? value : v)) as TabColumn)
          : col
      )
    );
  }

  function focusCell(rowIdx: number, colIdx: number) {
    refs[rowIdx]?.[colIdx]?.focus();
    refs[rowIdx]?.[colIdx]?.select();
  }

  function handleKeyDown(
    e: KeyboardEvent,
    rowIdx: number,
    colIdx: number
  ) {
    const lastCol = block.columns.length - 1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (colIdx < lastCol) focusCell(rowIdx, colIdx + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (colIdx > 0) focusCell(rowIdx, colIdx - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) focusCell(rowIdx - 1, colIdx);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < 5) focusCell(rowIdx + 1, colIdx);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (colIdx === lastCol) {
        addColumn();
        requestAnimationFrame(() => focusCell(rowIdx, colIdx + 1));
      } else {
        focusCell(rowIdx, colIdx + 1);
      }
    }
  }

  function addColumn() {
    setColumns([...block.columns, emptyColumn()]);
  }

  function removeLastColumn() {
    if (block.columns.length > 1) setColumns(block.columns.slice(0, -1));
  }

  function clearAll() {
    setColumns(block.columns.map(() => emptyColumn()));
  }
</script>

<div class="space-y-3 rounded-xl border border-border bg-card/40 p-3">
  <!-- Header -->
  <div class="flex items-center gap-2">
    <Input
      value={block.label}
      oninput={(e) =>
        onChange({
          ...block,
          label: (e.target as HTMLInputElement).value,
        })}
      placeholder="Section, e.g. Intro"
      class="h-8 max-w-56"
    />
    <Button
      variant="outline"
      size="sm"
      onclick={onInsert}
      disabled={!block.label.trim()}
      class="ml-auto"
      title={block.label.trim() ? undefined : "Name the tab first"}
    >
      <CornerDownLeft />
      Insert in song
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      onclick={onRemove}
      class="text-muted-foreground"
      aria-label="Remove tab"
    >
      <X />
    </Button>
  </div>

  <!-- Grid -->
  <div
    use:measureWidth
    class="overflow-x-auto rounded-lg border border-border bg-card/60 p-4"
  >
    <div class="flex flex-col gap-4">
      {#each chunks() as colIdxs, ci}
        <div class="inline-flex flex-col gap-1 font-mono text-sm">
          {#each DISPLAY_ORDER as strIdx, rowIdx}
            <div class="flex items-center">
              <span
                class="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground"
              >
                {tuning.names[strIdx]}
              </span>
              <span class="text-muted-foreground/60">|</span>
              {#each colIdxs as globalCi}
                <div class="flex items-center">
                  <span class="select-none text-muted-foreground/30">–</span>
                  <input
                    bind:this={refs[rowIdx] ??= [], refs[rowIdx][globalCi]}
                    value={block.columns[globalCi][strIdx]}
                    oninput={(e) =>
                      setCell(
                        globalCi,
                        strIdx,
                        sanitize((e.target as HTMLInputElement).value)
                      )}
                    onkeydown={(e) => handleKeyDown(e, rowIdx, globalCi)}
                    onfocus={(e) => (e.target as HTMLInputElement).select()}
                    inputmode="numeric"
                    placeholder="–"
                    class="h-7 w-6 rounded bg-transparent text-center text-foreground caret-primary outline-none placeholder:text-muted-foreground/30 focus:bg-primary/15 focus:text-primary"
                  />
                </div>
              {/each}
              <span class="select-none text-muted-foreground/30">–</span>
              <span class="text-muted-foreground/60">|</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Per-block actions -->
  <div class="flex flex-wrap items-center gap-1.5">
    <Button variant="outline" size="sm" onclick={addColumn}>
      <Plus />
      Column
    </Button>
    <Button
      variant="outline"
      size="sm"
      onclick={removeLastColumn}
      disabled={block.columns.length <= 1}
    >
      <Trash2 />
      Remove
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onclick={clearAll}
      class="text-muted-foreground"
    >
      <Eraser />
      Clear
    </Button>
  </div>
</div>
