# `src/components/create/TagInput.svelte`
**Role:** A tag chip editor. **67 lines.**

## `commit()`
```ts
const val = input.trim().toLowerCase().replace(/,+$/, "").trim();
if (val && !tags.includes(val)) onChange([...tags, val]);
input = "";
```
**Four-step normalisation.** `toLowerCase()` makes tags case-insensitive, so `Rock` and `rock` can't both exist. **`.replace(/,+$/, "")` then `.trim()` again** — because typing `,` fires `commit` via `handleKeydown`, but a *pasted* `"rock,"` reaches here with the comma still attached. `+$` strips a run of trailing commas; the second `trim()` removes any space the comma was hiding.

**`!tags.includes(val)`** deduplicates. **`input = ""` runs unconditionally**, so a duplicate or empty entry still clears the field — no stuck text.

## `handleKeydown`
```ts
if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
else if (e.key === "Backspace" && input === "" && tags.length > 0) onChange(tags.slice(0, -1));
```
**Two committing keys.** `preventDefault` on Enter stops a form submit; on `,` it stops the comma being typed into the field.

**The Backspace branch is the well-known chip-input convention:** backspace on an *empty* field deletes the last chip. **`input === ""` is the essential guard** — without it, backspace would delete a tag while the user is mid-word.

**`onblur={commit}`** — clicking away commits a half-typed tag rather than losing it.

## Design
**A callback prop (`onChange`), not `$bindable`** — so the parent owns the array and this component is fully controlled. Consistent with the other `create/` panels.

**`focus-within:border-ring focus-within:ring-2`** on the *wrapper* — the real `<input>` has `outline-none`, so the focus ring is drawn around the whole chip box. `focus-within` is what makes a composite control look like one field.

**`min-w-24 flex-1`** on the input — it shares the flex row with the chips, shrinking as they accumulate but never below 6rem.

**`placeholder={tags.length === 0 ? "Add tags…" : ""}`** — the hint disappears once there's context.

**`aria-label="Remove tag {tag}"`** names each remove button specifically — better than [`SetlistsPage`](../../pages/SetlistsPage.svelte.md)'s generic labels.

**Related:** [`CreateNoteForm.svelte`](CreateNoteForm.svelte.md), [`lib/types.ts`](../../lib/types.ts.md)
