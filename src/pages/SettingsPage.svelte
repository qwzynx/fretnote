<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { Settings2 } from "@lucide/svelte";
  import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/settings";
  import type { Settings } from "@/lib/settings";
  import { TUNINGS } from "@/lib/music/tunings";
  import Label from "@/components/ui/Label.svelte";
  import Select from "@/components/ui/Select.svelte";
  import Slider from "@/components/ui/Slider.svelte";
  import Button from "@/components/ui/Button.svelte";
  import Separator from "@/components/ui/Separator.svelte";

  const KEYS = [
    "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
    "Am", "Em", "Bm", "Dm", "F#m", "Cm",
  ];
  const KEY_ITEMS = KEYS.map((k) => ({ value: k, label: k }));

  const DIFFICULTY_ITEMS = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
  ];

  const TUNING_ITEMS = TUNINGS.map((t) => ({ value: t.id, label: t.label }));

  let s = $state<Settings>({ ...DEFAULT_SETTINGS });

  onMount(() => {
    s = getSettings();
  });

  function handleSave() {
    saveSettings(s);
    toast.success("Settings saved");
  }

  function handleReset() {
    s = { ...DEFAULT_SETTINGS };
    saveSettings(s);
    toast.success("Settings reset to defaults");
  }
</script>

<main class="mx-auto w-full max-w-2xl px-4 py-8">
  <div class="mb-8 flex items-center gap-3">
    <span
      class="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
    >
      <Settings2 class="size-5" />
    </span>
    <div>
      <h1 class="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="text-sm text-muted-foreground">
        Defaults applied when creating new notes or opening the reader.
      </p>
    </div>
  </div>

  <div class="space-y-8">
    <!-- New note defaults -->
    <section class="space-y-4">
      <h2 class="font-heading text-base font-semibold">New note defaults</h2>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="space-y-1.5">
          <Label>Default key</Label>
          <Select bind:value={s.defaultKey} items={KEY_ITEMS} class="w-full" />
        </div>

        <div class="space-y-1.5">
          <Label for="default-capo">Default capo</Label>
          <input
            id="default-capo"
            type="number"
            min={0}
            max={12}
            bind:value={s.defaultCapo}
            class="flex h-8 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        <div class="space-y-1.5">
          <Label>Default difficulty</Label>
          <Select
            bind:value={s.defaultDifficulty}
            items={DIFFICULTY_ITEMS}
            class="w-full"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Default tuning</Label>
        <Select bind:value={s.defaultTuning} items={TUNING_ITEMS} class="w-full max-w-xs" />
      </div>
    </section>

    <Separator />

    <!-- Reader defaults -->
    <section class="space-y-4">
      <h2 class="font-heading text-base font-semibold">Reader defaults</h2>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Default font size</Label>
          <span class="font-mono text-sm tabular-nums">{s.defaultFontSize}px</span>
        </div>
        <Slider
          bind:value={s.defaultFontSize}
          min={12}
          max={26}
          step={1}
          aria-label="Default font size"
        />
        <p class="text-xs text-muted-foreground">
          Starting font size when opening a note (12 – 26 px).
        </p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Default scroll speed</Label>
          <span class="font-mono text-sm tabular-nums">{s.defaultScrollSpeed} px/s</span>
        </div>
        <Slider
          bind:value={s.defaultScrollSpeed}
          min={5}
          max={100}
          step={5}
          aria-label="Default scroll speed"
        />
        <p class="text-xs text-muted-foreground">
          Auto-scroll speed when starting playback (5 – 100 px/s).
        </p>
      </div>
    </section>

    <Separator />

    <div class="flex gap-3">
      <Button onclick={handleSave}>Save settings</Button>
      <Button variant="outline" onclick={handleReset}>Reset to defaults</Button>
    </div>
  </div>
</main>
