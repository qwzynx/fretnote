# `src/components/notes/TabView.svelte`
**Role:** Renders a tab block as a monospace stave, wrapped to fit the container. **98 lines.**

## `ROW_TO_STRING`
```ts
const ROW_TO_STRING = [5, 4, 3, 2, 1, 0];
```
**The storage→display reversal**, this time as an explicit lookup table rather than `5 - i` arithmetic. Row 0 (top) draws string index 5 (high e). Same fact as `TAB_STRING_LABELS` in [`types.ts`](../../lib/types.ts.md), expressed a third way.

## Width measurement — a Svelte action
```ts
function measureWidth(node: HTMLElement) {
  const measure = () => {
    const s = getComputedStyle(node);
    const padX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
    innerWidth = node.clientWidth - padX;
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(node);
  return { destroy: () => ro.disconnect() };
}
```
**`ResizeObserver`, not a window resize listener** — the container can change width without the window resizing (a sidebar opening, a flex sibling growing, the section carousel settling). This is the only correct way to observe an element's own size.

**`clientWidth` minus computed padding** gives the true content box. `clientWidth` already excludes borders and scrollbar but *includes* padding, so the subtraction is required.

**`ro.disconnect()` on destroy** — a `ResizeObserver` holds a reference to the node and would leak per card.

**`measure()` is called immediately** as well as on observation, so the first render has a value.

## The wrap calculation
```ts
const CHAR_EM = 0.62;
const cellWidth = $derived(Math.max(1, ...tab.flatMap(col => col.map(v => v.length))));

const perRow = $derived.by(() => {
  const charPx = fontSize * CHAR_EM;
  const usableChars = innerWidth > 0 ? Math.floor(innerWidth / charPx) - 3 : 0;
  return usableChars > 0 ? Math.max(1, Math.floor(usableChars / (cellWidth + 1))) : tab.length || 1;
});
```
**`CHAR_EM = 0.62`** — the advance width of JetBrains Mono as a fraction of the font size. **A hardcoded font metric**: change the mono font in [`globals.css`](../../app/globals.css.md) and this silently mis-measures. The alternative (measuring a test glyph) is what `export.ts` does with `getTextWidth("0")`; here it's a constant.

**`cellWidth`** — the widest cell across the whole block, so a `"12"` somewhere makes every column 2 wide and the stave stays aligned. **This is the fix for the alignment flaw the PDF exporter still has.** `Math.max(1, ...)` guards an empty block (`Math.max()` of nothing is `-Infinity`).

**`- 3`** reserves the label and the two bar lines (`e|` … `|`).

**`cellWidth + 1`** — each column is one separator dash plus the cell.

**`Math.max(1, …)`** — never zero columns per row, which would make the chunk loop infinite.

**The `innerWidth > 0` fallback** puts everything on one row before the first measurement, so the initial render isn't a single column.

## `chunks`
```ts
for (let i = 0; i < tab.length; i += pr) result.push(tab.slice(i, i + pr));
if (result.length === 0) result.push([]);
```
A stepped slice loop, same shape as `chunkFixed` in [`export.ts`](../../lib/export.ts.md). **The empty push** guarantees at least one stave renders for an empty block, so the user sees an empty stave rather than nothing.

## `labelWidth` and `buildStave`
```ts
// Alternate tunings bring two-character labels ("Eb", "G#") alongside
// one-character ones, so every label is padded to the widest before the
// bar line — otherwise the stave rows start at different columns.
const labelWidth = $derived(Math.max(...stringNames.map(n => n.length)));
```
**A real bug from alternate tunings.** In standard tuning every label is 1 char, so the problem is invisible. In half-step-down (`Eb Ab Db Gb Bb eb`) the labels are 2 chars, and mixed-width tunings like `open-e` (`E B E G# B e`) would stagger the bar lines. `padEnd(labelWidth)` fixes it.

```ts
const raw = col[stringIdx] === "" ? "-" : col[stringIdx];
line += "-" + raw.padEnd(cw, "-");
```
**Empty cell → `-`**, then padded with dashes to `cellWidth`. Note `padEnd` with a dash rather than a space, so the stave line is continuous.

**Built as strings and rendered in a `<pre>`** rather than as DOM elements — six strings joined by `\n`, one `<pre>` per chunk. Vastly cheaper than 6 × N spans, and `<pre>` preserves the spacing exactly.

## Template
- **`data-no-swipe-nav`** — the opt-out read by [`swipe-horizontal.ts`](../../lib/actions/swipe-horizontal.ts.md). A wide tab scrolls horizontally; without this the drag would page the section carousel instead. **This is the attribute's other main use site.**
- **`overflow-x-auto`** — a stave wider than the container still scrolls, even after wrapping.
- **The `<pre>` content is written with no whitespace around the expression** (`>{...}</pre>`) — any newline in the template would appear in the output.

**Related:** [`lib/types.ts`](../../lib/types.ts.md), [`lib/actions/swipe-horizontal.ts`](../../lib/actions/swipe-horizontal.ts.md), [`lib/export.ts`](../../lib/export.ts.md) (the same rendering, without the padding fixes)
