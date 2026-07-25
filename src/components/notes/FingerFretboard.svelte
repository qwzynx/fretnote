<script lang="ts">
  import type { Fingering, StringState } from "@/lib/music/fingering";
  import { cn } from "@/lib/utils";

  let {
    frets,
    fingering,
    stringNames,
    fretCount = 5,
    label,
    class: className = "",
  }: {
    /** Per-string state, low-E (index 0) -> high-e. */
    frets: readonly StringState[];
    fingering: Fingering;
    stringNames: readonly string[];
    /** How many frets the window shows. */
    fretCount?: number;
    /** Optional caption drawn above the board. */
    label?: string;
    class?: string;
  } = $props();

  const W = 152;
  /** Left gutter carries the fret numbers, clear of the dots on the low E. */
  const padL = 32;
  const padR = 12;
  const padTop = 34;
  const fretGap = 22;
  const gridW = W - padL - padR;
  const gridH = $derived(fretGap * fretCount);
  const H = $derived(padTop + gridH + 8);
  const stringGap = gridW / 5;

  const pressed = $derived(
    frets.filter((f): f is number => f !== null && f > 0)
  );

  /**
   * Which slice of the neck to draw. The window sits at the hand position, so
   * stepping through a phrase played in one position doesn't slide the board
   * around. Shapes that ring an open string are drawn from the nut instead —
   * an open-string marker only makes sense with the nut in view.
   */
  const baseFret = $derived.by(() => {
    if (pressed.length === 0) return 1;
    const maxFret = Math.max(...pressed);
    const position = fingering.position || Math.min(...pressed);
    const hasOpen = frets.some((f) => f === 0);
    if ((hasOpen || position <= 1) && maxFret <= fretCount) return 1;
    if (position + fretCount - 1 >= maxFret) return Math.max(1, position);
    return Math.max(1, maxFret - fretCount + 1);
  });

  const x = (s: number) => padL + s * stringGap;
  const y = (row: number) => padTop + row * fretGap;
  /** Centre of the fret slot for an absolute fret number. */
  const slot = (fret: number) => y(fret - baseFret) + fretGap / 2;
  const inWindow = (fret: number) =>
    fret >= baseFret && fret < baseFret + fretCount;
</script>

<div class={cn("inline-flex flex-col items-center gap-1", className)}>
  <svg
    viewBox="0 0 {W} {H}"
    class="w-full"
    role="img"
    aria-label={label ?? "Finger placement diagram"}
  >
    <!-- string names -->
    {#each stringNames as name, s}
      <text
        x={x(s)}
        y={10}
        text-anchor="middle"
        class={cn(
          "fretboard-string-label",
          frets[s] === null || frets[s] === -1
            ? "fill-muted-foreground/50"
            : "fill-foreground"
        )}
      >
        {name}
      </text>
    {/each}

    <!-- open / muted markers -->
    {#each frets as fret, s}
      {#if fret === -1}
        <text
          x={x(s)}
          y={padTop - 6}
          text-anchor="middle"
          class="fill-muted-foreground fretboard-mute">×</text
        >
      {:else if fret === 0}
        <circle
          cx={x(s)}
          cy={padTop - 9}
          r={3.5}
          class="fill-none stroke-foreground/70"
          stroke-width={1.2}
        />
      {/if}
    {/each}

    <!-- nut, or the fret the window starts on -->
    {#if baseFret === 1}
      <rect x={padL} y={padTop - 3} width={gridW} height={3} class="fill-foreground/70" />
    {/if}

    <!-- frets, numbered down the left edge -->
    {#each Array.from({ length: fretCount + 1 }) as _, row}
      <line
        x1={padL}
        y1={y(row)}
        x2={padL + gridW}
        y2={y(row)}
        class="stroke-border"
        stroke-width={1}
      />
    {/each}
    {#each Array.from({ length: fretCount }) as _, row}
      <text
        x={padL - 12}
        y={y(row) + fretGap / 2 + 2.5}
        text-anchor="end"
        class="fill-muted-foreground/70 fretboard-fret-number"
      >
        {baseFret + row}
      </text>
    {/each}

    <!-- strings -->
    {#each Array.from({ length: 6 }) as _, s}
      <line
        x1={x(s)}
        y1={padTop}
        x2={x(s)}
        y2={padTop + gridH}
        class="stroke-border"
        stroke-width={frets[s] === null ? 0.75 : 1.25}
      />
    {/each}

    <!-- barre: one finger laid flat, numbered once across the strings it covers -->
    {#if fingering.barre && inWindow(fingering.barre.fret)}
      {@const bar = fingering.barre}
      {@const cy = slot(bar.fret)}
      {@const bx = (x(bar.from) + x(bar.to)) / 2}
      <rect
        x={x(bar.from) - 5}
        y={cy - 5}
        width={x(bar.to) - x(bar.from) + 10}
        height={10}
        rx={5}
        class="fill-primary"
      />
      <circle cx={bx} cy={cy} r={8} class="fill-primary" />
      <text
        x={bx}
        y={cy + 3.5}
        text-anchor="middle"
        class="fill-primary-foreground fretboard-finger"
      >
        {bar.finger}
      </text>
    {/if}

    <!-- fingered notes -->
    {#each frets as fret, s}
      {@const finger = fingering.fingers[s]}
      {@const onBarre =
        !!fingering.barre &&
        fret === fingering.barre.fret &&
        s >= fingering.barre.from &&
        s <= fingering.barre.to}
      {#if fret !== null && fret > 0 && inWindow(fret) && !onBarre}
        <circle cx={x(s)} cy={slot(fret)} r={8} class="fill-primary" />
        <text
          x={x(s)}
          y={slot(fret) + 3.5}
          text-anchor="middle"
          class="fill-primary-foreground fretboard-finger"
        >
          {finger > 0 ? finger : ""}
        </text>
      {/if}
    {/each}

    {#if pressed.length === 0}
      <text
        x={padL + gridW / 2}
        y={padTop + gridH / 2}
        text-anchor="middle"
        class="fill-muted-foreground fretboard-empty"
      >
        no fingers needed
      </text>
    {/if}
  </svg>
</div>

<style>
  .fretboard-string-label {
    font-size: 9px;
    font-weight: 600;
  }
  .fretboard-fret-number {
    font-size: 8px;
    font-weight: 500;
  }
  .fretboard-mute {
    font-size: 11px;
  }
  .fretboard-finger {
    font-size: 11px;
    font-weight: 700;
  }
  .fretboard-empty {
    font-size: 8.5px;
  }
</style>
