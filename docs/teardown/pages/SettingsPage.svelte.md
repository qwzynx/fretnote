# `src/pages/SettingsPage.svelte`

**Role:** The settings route (`/settings`). Edits the localStorage preferences and hosts library import/export.
**Size:** 219 lines. **Route:** `/settings`

---

## The three option lists

```ts
const KEYS = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B", "Am","Em","Bm","Dm","F#m","Cm"];
const KEY_ITEMS = KEYS.map((k) => ({ value: k, label: k }));

const DIFFICULTY_ITEMS = [
  { value: "beginner", label: "Beginner" }, …
];

const TUNING_ITEMS = TUNINGS.map((t) => ({ value: t.id, label: t.label }));
```

All three are **module-level constants**, computed once at import rather than per render.

**`KEYS`** — twelve majors then six common minors. The twelve match `NOTE_NAMES` in [`chord-detect.ts`](../lib/music/chord-detect.ts.md) exactly, including the mixed sharp/flat spelling (`C#` but `Eb`, `Ab`, `Bb`). **A fourth independent copy of the chromatic scale** in the codebase — after `SHARP_SCALE`/`FLAT_SCALE` in [`transpose.ts`](../lib/music/transpose.ts.md) and `NOTE_NAMES`. Nothing keeps them in sync.

The minor list is a curated subset, not all twelve — the six keys guitarists actually play in. A pragmatic choice that keeps the dropdown short at the cost of not offering, say, `Gm`.

**`KEY_ITEMS = KEYS.map(k => ({ value: k, label: k }))`** — `value` and `label` identical, because a key name needs no translation. The mapping exists purely to satisfy `Select`'s item shape.

**`TUNING_ITEMS` derives from `TUNINGS`** rather than duplicating it — so adding a tuning to [`tunings.ts`](../lib/music/tunings.ts.md) automatically appears here. `t.id` as the stored value, `t.label` as the display text, which is precisely the id/label split that file's type establishes. **This is the right pattern; `KEYS` and `DIFFICULTY_ITEMS` are the ones that duplicate.**

**`DIFFICULTY_ITEMS` is hand-written** with capitalised labels, duplicating both the `Difficulty` union from [`types.ts`](../lib/types.ts.md) and `NotePage`'s `DIFFICULTY_LABEL` map. Three copies of the same three values. Note it's untyped, so a typo'd `value` would silently produce an invalid `Difficulty`.

---

## State and the load

```ts
let s = $state<Settings>({ ...DEFAULT_SETTINGS });

onMount(() => {
  s = getSettings();
});
```

**`{ ...DEFAULT_SETTINGS }` — a fresh copy, not the constant itself.** Essential: `s` is bound with `bind:value` on five controls, so it *will* be mutated. Assigning the shared constant directly would let typing in this form permanently corrupt `DEFAULT_SETTINGS` for the session — and "Reset to defaults" would then restore the mutated values. [`settings.ts`](../lib/settings.ts.md) spreads for the same reason in three places.

**Why initialise from defaults and *then* load in `onMount`** rather than calling `getSettings()` in the initialiser: `getSettings` touches `localStorage`, which can throw in a blocked-storage context. Deferring to `onMount` keeps component construction pure. (`getSettings` catches internally anyway, so this is belt-and-braces.)

**`s = getSettings()` reassigns** rather than mutating field-by-field — one assignment, one reactive update.

**Naming:** `s` is terse for a component-level variable. It reads acceptably at the `bind:value={s.defaultKey}` call sites, which is presumably the justification.

---

## Save and reset

```ts
function handleSave() {
  saveSettings(s);
  toast.success("Settings saved");
}

function handleReset() {
  s = { ...DEFAULT_SETTINGS };
  saveSettings(s);
  toast.success("Settings reset to defaults");
}
```

**Explicit save, not auto-save.** Every control edits `s` in memory; nothing is persisted until the button is pressed. That means navigating away discards changes silently — no "unsaved changes" warning. A deliberate simplification, though the *only* signal that a save is needed is the button's presence.

**`handleReset` spreads again**, for the same aliasing reason, and **saves immediately** — so reset is the one action that doesn't need a follow-up press. Slightly inconsistent with `handleSave`, but it's the behaviour a user expects from a reset.

**Neither is `async` and neither has a try/catch.** [`saveSettings`](../lib/settings.ts.md) deliberately does *not* wrap its `setItem`, so a `QuotaExceededError` or blocked storage throws — and nothing here catches it. The result is an unhandled error in the console and a **success toast that never fires**, so the user sees nothing at all rather than a failure. That's the gap that file's asymmetric error policy leaves open, visible here at the call site.

---

## The two library operations

```ts
async function handleExportLibrary() {
  exporting = true;
  try {
    const saved = await exportLibrary();
    if (saved) toast.success("Library exported");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Export failed");
  } finally {
    exporting = false;
  }
}
```

The same shape as `FeedPage`'s import handler: a busy flag, `if (result)` to stay silent on cancellation, `e instanceof Error ? e.message : fallback` because [`backup.ts`](../lib/backup.ts.md) throws user-facing messages, and `finally` so the flag clears on every path.

```ts
async function handleImportLibrary() {
  if (!confirm(
    "Import a library file? Any local note or setlist that shares an ID with one in the file will be overwritten. Nothing else is deleted."
  )) return;
  …
}
```

**The confirmation text is the most carefully written sentence on the page**, and it exactly matches `importLibrary`'s documented merge semantics:

> *"anything whose id already exists locally is overwritten with the imported version, anything new is added, and nothing missing from the file is deleted."*

Both halves matter. "Will be overwritten" warns about the destructive part; **"Nothing else is deleted" reassures about the part users actually fear** — that importing a backup will wipe songs they've added since. A user who can't be sure would simply never press the button.

**The confirm comes *before* `importing = true`**, so cancelling doesn't flash a loading state.

**`confirm()` again** — the third native dialog, alongside `NotePage`'s delete and `importNote`'s overwrite. Consistently used for exactly the destructive-or-surprising actions.

```ts
toast.success(`Imported ${result.notes} note${result.notes === 1 ? "" : "s"} and ${result.setlists} setlist${result.setlists === 1 ? "" : "s"}`);
```

**Two inline pluralisations.** Dense, and the fourth hand-rolled plural in the codebase (`FeedPage` has two, `SetlistsPage` one). A tiny `plural(n, word)` helper would pay for itself.

`result.setlistItems` isn't reported, matching what [`backup.ts`](../lib/backup.ts.md) returns.

---

## The template

### Three sections separated by `<Separator />`

`New note defaults` → `Reader defaults` → `Backup & sync` → the save/reset row. The grouping mirrors [`settings.ts`](../lib/settings.ts.md)'s `Settings` interface: four `default*` seed fields, two reader fields — plus a third section that isn't settings at all.

**The subtitle states the boundary explicitly:** *"Defaults applied when creating new notes or opening the reader."* This is the settings-vs-data distinction from `types.ts`'s `tuning` comment, surfaced to the user. Changing "Default tuning" does not retune existing songs, and this sentence is the only place that's said.

### The hand-written number input

```svelte
<input id="default-capo" type="number" min={0} max={12} bind:value={s.defaultCapo}
  class="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors [appearance:textfield] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-8 sm:text-sm dark:bg-input/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
```

**The only raw `<input>` on the page** — every other control is a component. Presumably because [`Input.svelte`](../components/ui/Input.svelte.md) doesn't forward `type`/`min`/`max`. The cost is a 400-character class string duplicating that component's styling, which will drift.

**`[appearance:textfield]` plus the two `::-webkit-*-spin-button` rules** — removes the number input's stepper arrows in Firefox and WebKit respectively. Two engines, two mechanisms, same as the scrollbar handling in [`globals.css`](../app/globals.css.md).

**`h-10 … sm:h-8` and `text-base … sm:text-sm`** — larger on phones for touch. Note `text-base` (16px) specifically: **iOS Safari zooms the page when focusing an input smaller than 16px.** Sizing up on mobile isn't only ergonomics, it prevents an unwanted zoom.

**`min={0} max={12}` are advisory only.** `<input type="number">` doesn't clamp typed values, and nothing validates before `saveSettings`. A capo of 99 or -5 would be stored and flow into `transposeKey`. [`backup.ts`](../lib/backup.ts.md)'s `normalizeNote` guards imported capos but nothing guards this one.

### The sliders

```svelte
<div class="flex items-center justify-between">
  <Label>Default font size</Label>
  <span class="font-mono text-sm tabular-nums">{s.defaultFontSize}px</span>
</div>
<Slider bind:value={s.defaultFontSize} min={12} max={26} step={1} aria-label="Default font size" />
<p class="text-xs text-muted-foreground">Starting font size when opening a note (12 – 26 px).</p>
```

**`tabular-nums`** — fixed-width digits, so the number doesn't shift the layout as it changes from `9` to `10` while dragging. The correct detail for a live-updating numeric readout, and easy to omit.

**`aria-label` on the slider** because the `<Label>` isn't associated with it (no `for`/`id` pair) — the visible label is decorative from an accessibility standpoint, so the control carries its own name.

**The range is stated twice** — in the helper text and in the `min`/`max` props. They agree here; nothing enforces that they continue to.

**`step={5}` on scroll speed vs `step={1}` on font size** — a sensible granularity difference: 1px of font matters, 1 px/s of scroll doesn't.

### Labels without `for`

```svelte
<Label>Default key</Label>
<Select bind:value={s.defaultKey} items={KEY_ITEMS} class="w-full" />
```

**Four of the six labels have no `for` attribute**, while the capo input's does (`for="default-capo"`). So those labels aren't programmatically associated with their controls — clicking them doesn't focus, and a screen reader announces an unlabelled combobox. The sliders compensate with `aria-label`; the three `Select`s don't, unless `Select.svelte` supplies its own.

**A genuine accessibility gap**, and the inconsistency (one label does it correctly) suggests oversight rather than intent.

### Button states

```svelte
<Button disabled={exporting} onclick={handleExportLibrary}>
  {exporting ? "Exporting…" : "Export library"}
</Button>
```

**`disabled` *and* a label change** — belt and braces against a double-click firing two file dialogs. Note this uses a text swap rather than `Button`'s own `loading` prop, which `FeedPage` uses (`loading={importing}`). Two idioms for the same thing across two pages.

**`w-full sm:w-auto` and `flex-col gap-3 sm:flex-row`** — the recurring responsive button pattern: full-width stacked on phones, inline auto-width on desktop. Used four times on this page.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `{ ...DEFAULT_SETTINGS }` ×2 | init, reset | The object is `bind:`-mutated — a shared reference would corrupt the constant |
| `getSettings()` in `onMount` | load | Keep localStorage access out of construction |
| `TUNINGS.map(...)` | `TUNING_ITEMS` | Derived, so it can't drift — unlike `KEYS` |
| `handleReset` saves immediately | reset | Reset shouldn't need a second press |
| `confirm(...)` before `importing = true` | import | Cancelling mustn't flash a loading state |
| "Nothing else is deleted" | import copy | Answers the fear the action actually provokes |
| `if (saved)` / `if (result)` | both | Cancellation is silent |
| `e instanceof Error ? e.message : …` | both | `backup.ts` throws user-facing messages |
| `finally { flag = false }` | both | Flag clears on cancel and error alike |
| `[appearance:textfield]` + `::-webkit-*` | capo input | Two engines, two ways to hide spinners |
| `text-base` on mobile | capo input | Below 16px, iOS Safari zooms on focus |
| `tabular-nums` | slider readouts | Digits don't shift the layout while dragging |
| `disabled` + label swap | library buttons | Prevent a double-fired file dialog |

---

## Known rough edges

1. **`saveSettings` can throw and nothing catches it** — a blocked-storage failure shows no toast at all.
2. **Four `<Label>`s have no `for`**, so three `Select`s are unlabelled for assistive tech.
3. **`min`/`max` on the capo input are advisory** — nothing validates before saving.
4. **`KEYS` is a fourth copy** of the chromatic scale; `DIFFICULTY_ITEMS` a third copy of the difficulty list.
5. **The capo input duplicates `Input.svelte`'s styling** as a literal class string.
6. **No unsaved-changes warning** — navigating away discards silently.

---

## Related

- [`lib/settings.ts`](../lib/settings.ts.md) — `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, and the error-policy gap
- [`lib/backup.ts`](../lib/backup.ts.md) — `exportLibrary` / `importLibrary` and the merge semantics the confirm text describes
- [`lib/music/tunings.ts`](../lib/music/tunings.ts.md) — the source `TUNING_ITEMS` derives from
- [`components/ui/Select.svelte`](../components/ui/Select.svelte.md), [`Slider.svelte`](../components/ui/Slider.svelte.md)
