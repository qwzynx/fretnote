<script lang="ts">
  import { cn } from "@/lib/utils";

  export type Frets = [number, number, number, number, number, number];

  const STRING_ORDER = [0, 1, 2, 3, 4, 5] as const;

  let {
    frets,
    onChange,
    stringNames,
    fretCount = 5,
  }: {
    frets: Frets;
    onChange: (frets: Frets) => void;
    stringNames: readonly string[];
    fretCount?: number;
  } = $props();

  function setString(strIdx: number, value: number) {
    const next = [...frets] as Frets;
    next[strIdx] = value;
    onChange(next);
  }

  const fretRows = $derived(Array.from({ length: fretCount }, (_, i) => i + 1));
  const col = "w-9";
  const row = "h-9";
</script>

<div class="inline-flex select-none flex-col items-center gap-0">
  <!-- String labels -->
  <div class="flex">
    {#each STRING_ORDER as s}
      <div
        class={cn(
          col,
          "pb-1 text-center text-[11px] font-semibold text-muted-foreground"
        )}
      >
        {stringNames[s]}
      </div>
    {/each}
  </div>

  <!-- Open / muted markers -->
  <div class="flex pb-1">
    {#each STRING_ORDER as s}
      {@const val = frets[s]}
      {@const isMuted = val === -1}
      {@const isOpen = val === 0}
      <div class={cn(col, "flex justify-center")}>
        <button
          type="button"
          onclick={() => setString(s, isMuted ? 0 : -1)}
          title={isMuted
            ? "Muted — click to open"
            : isOpen
              ? "Open — click to mute"
              : "Click to mute"}
          class={cn(
            "flex size-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
            isMuted
              ? "border-muted-foreground/60 text-muted-foreground"
              : isOpen
                ? "border-foreground/60 text-foreground"
                : "border-border text-muted-foreground/30 hover:border-muted-foreground/50"
          )}
        >
          {isMuted ? "✕" : "○"}
        </button>
      </div>
    {/each}
  </div>

  <!-- Nut -->
  <div class="flex w-full">
    {#each STRING_ORDER as s}
      <div
        class={cn(
          col,
          "h-2 border-t-[3px] border-foreground/70",
          s === 0 && "rounded-tl-sm",
          s === 5 && "rounded-tr-sm"
        )}
      ></div>
    {/each}
  </div>

  <!-- Fret grid -->
  <div class="relative rounded-b-sm border-x border-b border-border">
    <!-- Vertical string lines -->
    <div class="pointer-events-none absolute inset-0 flex">
      {#each STRING_ORDER as s}
        <div class={cn(col, "flex justify-center")}>
          <div class="h-full w-px bg-border"></div>
        </div>
      {/each}
    </div>

    {#each fretRows as f, fi}
      <div
        class={cn(
          "relative flex",
          fi < fretRows.length - 1 && "border-b border-border"
        )}
      >
        {#each STRING_ORDER as s}
          {@const val = frets[s]}
          {@const active = val === f}
          <button
            type="button"
            onclick={() => setString(s, active ? 0 : f)}
            aria-label={`String ${stringNames[s]}, fret ${f}${active ? " (active, click to clear)" : ""}`}
            class={cn(
              col,
              row,
              "relative z-10 flex items-center justify-center transition-colors hover:bg-primary/5"
            )}
          >
            {#if active}
              <span
                class="size-6 rounded-full bg-primary shadow-sm ring-2 ring-primary/30"
              ></span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>
