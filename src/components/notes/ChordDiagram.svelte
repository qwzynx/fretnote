<script lang="ts">
  import { getChordShape } from "@/lib/music/chords";
  import { cn } from "@/lib/utils";

  let {
    name,
    class: className = "",
    frets: fretCount = 5,
  }: {
    name: string;
    class?: string;
    frets?: number;
  } = $props();

  const shape = $derived(getChordShape(name));

  const W = 100;
  const H = 132;
  const padX = 12;
  const padTop = 26;
  const gridW = W - padX * 2;
  const gridH = 78;
  const strings = 6;
  const stringGap = gridW / (strings - 1);
  const fretGap = $derived(gridH / fretCount);
  const baseFret = $derived(shape?.baseFret ?? 1);

  const x = (s: number) => padX + s * stringGap;
  const y = (f: number) => padTop + f * fretGap;
</script>

<div class={cn("inline-flex flex-col items-center gap-1", className)}>
  <svg
    viewBox="0 0 {W} {H}"
    class="w-full max-w-[110px]"
    role="img"
    aria-label="{name} chord diagram"
  >
    <!-- chord name -->
    <text
      x={W / 2}
      y={14}
      text-anchor="middle"
      class="fill-foreground"
      style="font-size: 15px; font-weight: 600"
    >
      {name}
    </text>

    <!-- nut or base-fret label -->
    {#if baseFret === 1}
      <rect
        x={padX}
        y={padTop - 2}
        width={gridW}
        height={3}
        class="fill-foreground/70"
      />
    {:else}
      <text
        x={padX - 4}
        y={padTop + fretGap / 2 + 3}
        text-anchor="end"
        class="fill-muted-foreground"
        style="font-size: 9px"
      >
        {baseFret}fr
      </text>
    {/if}

    <!-- fret lines -->
    {#each Array.from({ length: fretCount + 1 }) as _, f}
      <line
        x1={padX}
        y1={y(f)}
        x2={padX + gridW}
        y2={y(f)}
        class="stroke-border"
        stroke-width={1}
      />
    {/each}

    <!-- strings -->
    {#each Array.from({ length: strings }) as _, s}
      <line
        x1={x(s)}
        y1={padTop}
        x2={x(s)}
        y2={padTop + gridH}
        class="stroke-border"
        stroke-width={1}
      />
    {/each}

    {#if shape}
      <!-- barre -->
      {#if shape.barre}
        <rect
          x={x(shape.barre.from) - 4}
          y={y(shape.barre.fret - baseFret) + fretGap / 2 - 4}
          width={x(shape.barre.to) - x(shape.barre.from) + 8}
          height={8}
          rx={4}
          class="fill-primary"
        />
      {/if}

      <!-- open / muted markers + fretted dots -->
      {#each shape.frets as fret, s}
        {#if fret === -1}
          <text
            x={x(s)}
            y={padTop - 6}
            text-anchor="middle"
            class="fill-muted-foreground"
            style="font-size: 10px"
          >
            ×
          </text>
        {:else if fret === 0}
          <circle
            cx={x(s)}
            cy={padTop - 8}
            r={3}
            class="fill-none stroke-muted-foreground"
            stroke-width={1}
          />
        {:else if !(shape.barre && shape.barre.fret === fret)}
          <circle
            cx={x(s)}
            cy={y(fret - baseFret) + fretGap / 2}
            r={5}
            class="fill-primary"
          />
        {/if}
      {/each}
    {:else}
      <text
        x={W / 2}
        y={padTop + gridH / 2}
        text-anchor="middle"
        class="fill-muted-foreground"
        style="font-size: 11px"
      >
        shape n/a
      </text>
    {/if}
  </svg>
</div>
