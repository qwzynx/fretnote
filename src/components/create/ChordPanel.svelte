<script lang="ts">
  import {
    Plus,
    Search,
    Guitar,
    CornerDownLeft,
    RotateCcw,
    Check,
  } from "@lucide/svelte";
  import { detectChord } from "@/lib/music/chord-detect";
  import { TUNINGS, DEFAULT_TUNING } from "@/lib/music/tunings";
  import { getChordShape } from "@/lib/music/chords";
  import ChordDiagram from "@/components/notes/ChordDiagram.svelte";
  import FretboardInput, { type Frets } from "./FretboardInput.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Select from "@/components/ui/Select.svelte";
  import { cn } from "@/lib/utils";

  const EMPTY_FRETS: Frets = [-1, -1, -1, -1, -1, -1];
  const QUICK_CHORDS = ["G", "C", "D", "Em", "Am", "E", "A", "F", "Dm", "G7"];

  let {
    chords,
    onAddChord,
    onInsert,
  }: {
    chords: string[];
    onAddChord: (name: string) => void;
    onInsert?: (name: string) => void;
  } = $props();

  let mode = $state<"search" | "detect">("search");
  let query = $state("");
  let tuningId = $state(DEFAULT_TUNING.id);
  let frets = $state<Frets>([...EMPTY_FRETS] as Frets);

  const tuning = $derived(
    TUNINGS.find((t) => t.id === tuningId) ?? DEFAULT_TUNING
  );
  const trimmed = $derived(query.trim());
  const searchResult = $derived(trimmed ? getChordShape(trimmed) : null);
  const detected = $derived(detectChord(frets, tuning));

  const active = $derived(
    mode === "search" ? (searchResult ? trimmed : null) : detected
  );
  const alreadyAdded = $derived(active ? chords.includes(active) : false);

  const TUNING_ITEMS = TUNINGS.map((t) => ({ value: t.id, label: t.label }));

  function place(name: string) {
    if (onInsert) onInsert(name);
    else onAddChord(name);
  }
</script>

<div class="rounded-xl border border-border bg-muted/20">
  <!-- Header -->
  <div
    class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3"
  >
    <div>
      <p class="flex items-center gap-1.5 text-sm font-medium">
        <Search class="size-3.5 text-primary" />
        Chord finder
      </p>
      <p class="text-xs text-muted-foreground">
        {onInsert
          ? "Find a shape, then drop it into your lyrics at the cursor."
          : "Look up a shape and add it to the note."}
      </p>
    </div>
    <div class="flex gap-1 rounded-lg border border-border bg-background p-1">
      {#each [{ id: "search", label: "Search", Icon: Search }, { id: "detect", label: "From frets", Icon: Guitar }] as m}
        {@const Icon = m.Icon}
        <button
          type="button"
          onclick={() => (mode = m.id as "search" | "detect")}
          class={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === m.id
              ? "bg-muted text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon class="size-3.5" />
          {m.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="flex flex-wrap items-start gap-x-6 gap-y-4 p-4">
    <!-- Input side -->
    <div class="min-w-[14rem] flex-1 space-y-3">
      {#if mode === "search"}
        <div class="space-y-1.5">
          <Input
            placeholder="Type a chord — Am7, Cadd9, F#m…"
            bind:value={query}
            class="w-full"
          />
          {#if trimmed && !searchResult}
            <p class="text-xs text-destructive">
              No shape found for "{trimmed}".
            </p>
          {/if}
        </div>

        <div class="space-y-1.5">
          <p class="text-xs text-muted-foreground">Common chords</p>
          <div class="flex flex-wrap gap-1.5">
            {#each QUICK_CHORDS as name}
              {@const added = chords.includes(name)}
              <button
                type="button"
                onclick={() => place(name)}
                title={onInsert ? `Insert [${name}]` : `Add ${name}`}
                class={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors",
                  added
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                )}
              >
                {name}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-muted-foreground"
              >Tap frets to name the shape</span
            >
            <Select
              bind:value={tuningId}
              items={TUNING_ITEMS}
              size="sm"
              class="w-auto"
            />
          </div>
          <FretboardInput
            {frets}
            onChange={(f) => (frets = f)}
            stringNames={tuning.names}
          />
          <button
            type="button"
            onclick={() => (frets = [...EMPTY_FRETS] as Frets)}
            class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw class="size-3" />
            Clear fretboard
          </button>
        </div>
      {/if}
    </div>

    <!-- Result side -->
    <div class="flex min-w-[8rem] flex-col items-center gap-2.5">
      {#if active}
        <ChordDiagram name={active} class="w-24" />
        <div class="flex w-full flex-col gap-1.5">
          {#if onInsert}
            <Button size="sm" onclick={() => onInsert!(active)}>
              <CornerDownLeft />
              Insert in lyrics
            </Button>
          {/if}
          <Button
            size="sm"
            variant="outline"
            onclick={() => onAddChord(active)}
            disabled={alreadyAdded}
          >
            {#if alreadyAdded}
              <Check />
            {:else}
              <Plus />
            {/if}
            {alreadyAdded ? "On note" : "Add to note"}
          </Button>
        </div>
      {:else}
        <p class="max-w-[9rem] pt-6 text-center text-xs text-muted-foreground">
          {mode === "search"
            ? "Type a chord name to preview its shape."
            : "Tap frets to detect the chord you're holding."}
        </p>
      {/if}
    </div>
  </div>
</div>
