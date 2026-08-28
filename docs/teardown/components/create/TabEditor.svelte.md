# `src/components/create/TabEditor.svelte`
**Role:** The column-based tab grid editor for one `TabBlock`. **253 lines.**

## `sanitize`
```ts
const v = raw.trim().toLowerCase();
if (v === "") return "";
if (v === "x") return "x";
return v.replace(/[^0-9]/g, "").slice(0, 2);
```
**Enforces the `TabColumn` cell grammar** from [`types.ts`](../../lib/types.ts.md) at the input boundary: empty, `"x"`, or 1–2 digits. `slice(0, 2)` caps at fret 99 and, more usefully, stops a cell growing wide enough to break the grid alignment. Everything non-numeric is stripped rather than rejected — typing `"x"` works, typing `"q"` silently yields `""`.

## Width measurement and chunking
`measureWidth` is **byte-for-byte the same action as [`TabView`](../notes/TabView.svelte.md)'s** — `getComputedStyle` padding subtraction, `ResizeObserver`, `disconnect` on destroy. Duplicated, not shared.

```ts
const COL_W = $derived(isPhone.current ? 40 : 32);   // "Must track the rendered cell width below"
const perRow = $derived(innerWidth > 0 ? Math.max(1, Math.floor((innerWidth - GUTTER_W) / COL_W)) : block.columns.length || 1);
```
**`COL_W` is a hand-maintained duplicate of the `w-8`/`sm:w-6` classes plus the dash** — the comment says so. Change the cell width in the template and the wrap calculation silently mis-measures. [`TabView`](../notes/TabView.svelte.md) has the same coupling via `CHAR_EM`.

**`isPhone.current` used for a *number*, not a class** — exactly the case [`media.svelte.ts`](../../lib/media.svelte.ts.md) exists for.

**`chunks` holds index arrays, not column arrays** — `Array.from({length: end-i}, (_, k) => i + k)`. The editor needs the *global* column index for `setCell` and for the ref grid, which a `slice` would lose.

## `attachRef` — a two-dimensional ref registry
```ts
function attachRef(node: HTMLInputElement, [row, col]: [number, number]) {
  (refs[row] ??= [])[col] = node;
  return {
    update([newRow, newCol]) {
      if (refs[row]?.[col] === node) refs[row][col] = null;
      row = newRow; col = newCol;
      (refs[row] ??= [])[col] = node;
    },
    destroy() { if (refs[row]?.[col] === node) refs[row][col] = null; },
  };
}
```
**A Svelte action used as a ref collector**, because `bind:this` can't build a 2-D array indexed by two loop variables.

**`(refs[row] ??= [])`** — logical-nullish-assignment creates the row array on first use.

**`if (refs[row]?.[col] === node)` before clearing** is the important guard: only clear the slot if *this* node still owns it. Without the identity check, a node being moved could null out the slot another node has already claimed — the classic ref-registry bug.

**`update` re-registers on reflow**, which happens whenever `perRow` changes and a column lands in a different row.

## `handleKeyDown` — spreadsheet navigation
Five branches, all with `preventDefault`: `ArrowLeft/Right` move along the column axis (bounded by `lastCol`), `ArrowUp/Down` move between strings (bounded by `rowIdx > 0` and `< 5` — hardcoded six strings), and **`Enter` advances right, appending a new column when at the end**:

```ts
if (colIdx === lastCol) { addColumn(); requestAnimationFrame(() => focusCell(rowIdx, colIdx + 1)); }
```
**`requestAnimationFrame` is required** — the new input doesn't exist until Svelte flushes, so focusing synchronously would target nothing. (`tick()` would be the more idiomatic wait; rAF works because it fires after the render.)

**`focusCell` does `focus()` then `select()`** — arriving in a cell selects its contents, so typing replaces rather than appends. Paired with `onfocus={e => e.target.select()}` for mouse entry.

**`inputmode="numeric"`** brings up the number keypad on phones without the spinner arrows a `type="number"` would add.

## Details
- **`DISPLAY_ORDER = [5,4,3,2,1,0]`** — the storage→display flip, here as a reversed constant (a *fourth* spelling: `TAB_STRING_LABELS`, `ROW_TO_STRING`, `5 - row`, and this).
- **`setCell` maps twice** to build a new columns array and a new column — fully immutable, so `onChange` always receives a fresh object.
- **`onInsert` is `disabled={!block.label.trim()}`** with a `title` explaining why — a `[tab: ]` reference needs a name.
- **`removeLastColumn` guards `> 1`**, and the button is also `disabled` — the same double enforcement as `StrummingEditor`.
- **`<TabFingeringPanel {block} {tuning} {onChange} />`** at the bottom — the fingering picker is nested inside the tab editor, sharing the same `onChange`.

**Related:** [`lib/types.ts`](../../lib/types.ts.md), [`components/notes/TabView.svelte`](../notes/TabView.svelte.md), [`TabFingeringPanel.svelte`](TabFingeringPanel.svelte.md)
