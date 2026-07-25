<script lang="ts">
  import { getChordShape } from "@/lib/music/chords";
  import { fingerChord } from "@/lib/music/fingering";
  import { cn } from "@/lib/utils";

  let {
    name,
    class: className = "",
    frets: fretCount = 5,
    showFingers = true,
  }: {
    name: string;
    class?: string;
    frets?: number;
    /** Draw the finger number (1 index … 4 pinky) inside each dot. */
    showFingers?: boolean;
  } = $props();

  const shape = $derived(getChordShape(name));
  const fingering = $derived(shape ? fingerChord(shape) : null);
  const barre = $derived(fingering?.barre);

  const W = 100;
  const H = 132;
  /** Wider on the left so the "5fr" label has room next to the grid. */
  const padL = 20;
  const padR = 10;
  const padTop = 26;
  const gridW = W - padL - padR;
  const gridH = 78;
  const strings = 6;
  const stringGap = gridW / (strings - 1);
  const fretGap = $derived(gridH / fretCount);
  const baseFret = $derived(shape?.baseFret ?? 1);

  const x = (s: number) => padL + s * stringGap;
  const y = (f: number) => padTop + f * fretGap;
  const midX = padL + gridW / 2;
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
      x={midX}
      y={14}
      text-anchor="middle"
      class="fill-foreground chord-diagram-title"
    >
      {name}
    </text>

    <!-- nut or base-fret label -->
    {#if baseFret === 1}
      <rect
        x={padL}
        y={padTop - 2}
        width={gridW}
        height={3}
        class="fill-foreground/70"
      />
    {:else}
      <text
        x={padL - 5}
        y={padTop + fretGap / 2 + 3}
        text-anchor="end"
        class="fill-muted-foreground chord-diagram-basefret"
      >
        {baseFret}fr
      </text>
    {/if}

    <!-- fret lines -->
    {#each Array.from({ length: fretCount + 1 }) as _, f}
      <line
        x1={padL}
        y1={y(f)}
        x2={padL + gridW}
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
      <!-- barre: one finger laid flat, numbered at the string it anchors on -->
      {#if barre}
        {@const cy = y(barre.fret - baseFret) + fretGap / 2}
        <rect
          x={x(barre.from) - 4}
          y={cy - 4}
          width={x(barre.to) - x(barre.from) + 8}
          height={8}
          rx={4}
          class="fill-primary"
        />
        {#if showFingers}
          {@const bx = (x(barre.from) + x(barre.to)) / 2}
          <circle cx={bx} cy={cy} r={6} class="fill-primary" />
          <text
            x={bx}
            y={cy + 3}
            text-anchor="middle"
            class="fill-primary-foreground chord-diagram-finger"
          >
            {barre.finger}
          </text>
        {/if}
      {/if}

      <!-- open / muted markers + fretted dots -->
      {#each shape.frets as fret, s}
        {@const finger = fingering?.fingers[s] ?? 0}
        {#if fret === -1}
          <text
            x={x(s)}
            y={padTop - 6}
            text-anchor="middle"
            class="fill-muted-foreground chord-diagram-mute"
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
        {:else if !(barre && barre.fret === fret && s >= barre.from && s <= barre.to)}
          {@const cy = y(fret - baseFret) + fretGap / 2}
          <circle cx={x(s)} cy={cy} r={showFingers ? 6 : 5} class="fill-primary" />
          {#if showFingers && finger > 0}
            <text
              x={x(s)}
              y={cy + 3}
              text-anchor="middle"
              class="fill-primary-foreground chord-diagram-finger"
            >
              {finger}
            </text>
          {/if}
        {/if}
      {/each}
    {:else}
      <text
        x={midX}
        y={padTop + gridH / 2}
        text-anchor="middle"
        class="fill-muted-foreground chord-diagram-empty"
      >
        shape n/a
      </text>
    {/if}
  </svg>
</div>

<style>
  .chord-diagram-title {
    font-size: 15px;
    font-weight: 600;
  }
  .chord-diagram-basefret {
    font-size: 9px;
  }
  .chord-diagram-mute {
    font-size: 10px;
  }
  .chord-diagram-finger {
    font-size: 8.5px;
    font-weight: 700;
  }
  .chord-diagram-empty {
    font-size: 11px;
  }
</style>
