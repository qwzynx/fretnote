<script lang="ts">
  import { fingerShape } from "@/lib/music/fingering";
  import { UNSET_FRET } from "@/lib/music/chord-detect";
  import { cn } from "@/lib/utils";

  export type Frets = [number, number, number, number, number, number];

  const STRING_ORDER = [0, 1, 2, 3, 4, 5] as const;

  let {
    frets,
    onChange,
    stringNames,
    fretCount = 5,
    allowUnset = false,
  }: {
    frets: Frets;
    onChange: (frets: Frets) => void;
    stringNames: readonly string[];
    fretCount?: number;
    /**
     * When true, a string starts "not decided" instead of muted, and the
     * open/muted marker cycles through that third state. Only meaningful for
     * callers (like the chord finder) that hand UNSET_FRET strings on to
     * `detectChord`, which guesses them open or muted itself — a hand shape
     * that gets saved verbatim (e.g. the tab fingering picker) should stay
     * off this so every string always resolves to a concrete state.
     */
    allowUnset?: boolean;
  } = $props();

  function setString(strIdx: number, value: number) {
    const next = [...frets] as Frets;
    next[strIdx] = value;
    onChange(next);
  }

  const fingering = $derived(fingerShape(frets));
  const fretRows = $derived(Array.from({ length: fretCount }, (_, i) => i + 1));
  // Roomier cells on phones — this grid is tapped, not clicked.
  const col = "w-10 sm:w-9";
  const row = "h-11 sm:h-9";
</script>

<div class="inline-flex select-none flex-col items-center gap-0">
  <!-- String labels -->
  <div class="flex">
    {#each STRING_ORDER as s}
      <div
        class={cn(
          col,
          "pb-1 text-center text-3xs font-semibold text-muted-foreground"
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
      {@const isUnset = allowUnset && val === UNSET_FRET}
      {@const isMuted = val === -1}
      {@const isOpen = val === 0}
      <div class={cn(col, "flex justify-center")}>
        <button
          type="button"
          onclick={() =>
            setString(
              s,
              isUnset ? 0 : isOpen ? -1 : isMuted && allowUnset ? UNSET_FRET : -1
            )}
          title={isUnset
            ? "Not set — guessed open or muted; click to force open"
            : isMuted
              ? allowUnset
                ? "Muted — click to leave unset"
                : "Muted — click to open"
              : isOpen
                ? "Open — click to mute"
                : "Click to mute"}
          class={cn(
            "flex size-7 items-center justify-center rounded-full border text-3xs font-bold transition-colors sm:size-5",
            isUnset
              ? "border-dashed border-muted-foreground/40 text-muted-foreground/40"
              : isMuted
                ? "border-muted-foreground/60 text-muted-foreground"
                : isOpen
                  ? "border-foreground/60 text-foreground"
                  : "border-border text-muted-foreground/30 hover:border-muted-foreground/50"
          )}
        >
          {isUnset ? "" : isMuted ? "✕" : "○"}
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
            onclick={() => setString(s, active ? (allowUnset ? UNSET_FRET : 0) : f)}
            aria-label={`String ${stringNames[s]}, fret ${f}${active ? " (active, click to clear)" : ""}`}
            class={cn(
              col,
              row,
              "relative z-10 flex items-center justify-center transition-colors hover:bg-primary/5"
            )}
          >
            {#if active}
              <span
                class="flex size-6 items-center justify-center rounded-full bg-primary font-mono text-3xs font-bold text-primary-foreground shadow-sm ring-2 ring-primary/30"
              >
                {fingering.fingers[s] || ""}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>
