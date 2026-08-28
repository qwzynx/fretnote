# `eslint.config.mjs`
**Role:** ESLint flat config. **The four rule overrides are a commentary on the codebase's own idioms.**

## Structure
```js
export default ts.config(
  { ignores: [...] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  { languageOptions, rules },
  { files: ["**/*.svelte", "**/*.svelte.ts"], languageOptions: { parser: svelteParser } }
);
```
**Flat config** (ESLint 9) — an array of config objects merged in order, each later one overriding earlier. `ts.config()` is typescript-eslint's typed helper.

**`ignores` includes `scripts/**`** — so the three `.mjs` checks are unlinted, matching [`tsconfig.json`](tsconfig.json.md)'s exclusion. Also `public/**` and both `target/` directories.

## The four rule overrides

```js
// Deliberate no-ops are common here: `.catch(() => {})` on ALTER TABLE
// for a column that already exists, and swallowed localStorage errors.
"no-empty": ["error", { allowEmptyCatch: true }],
```
**Directly describes [`db-driver.ts`](../lib/db-driver.ts.md)'s `addColumn` and [`recent.ts`](../lib/recent.ts.md)'s write.** Note it only allows empty *catch* blocks — an empty `if` or `for` is still an error. Precisely scoped rather than disabling the rule.

```js
"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
```
**The `^_` convention** — which is why [`transpose.ts`](../lib/music/transpose.ts.md)'s replacer takes `(_, chord)` and the SVG loops use `as _, i`. Downgraded to `warn` so an in-progress edit doesn't fail the lint.

```js
// Worth knowing about — a key lets Svelte reuse DOM nodes instead of
// rebuilding the list — but most of the hits here iterate module-level
// constant arrays where it changes nothing. Warn, and key the ones
// that iterate real data.
"svelte/require-each-key": "warn",
```
**A deliberate, reasoned downgrade.** Keys matter for reordering data (`{#each results as note (note.id)}`) and are noise for static constants (`{#each FILTERS as f}`). Rather than disable or blanket-comply, it warns and the authors keyed the ones that matter. **The rationale is exactly right**, and it's why you'll see both keyed and unkeyed loops in the same file.

```js
// `{" "}` in a chord-over-lyrics line is deliberate whitespace, not a
// redundant expression — the alignment depends on it.
"svelte/no-useless-mustaches": "off",
```
**Points at one line in [`ChordLyricsView`](../components/notes/ChordLyricsView.svelte.md)** where `{" "}` renders a space that keeps a chordless segment from collapsing to zero width. The linter can't tell deliberate whitespace from a stray expression.

```js
// State here is replaced immutably (`membership = new Map(membership)`)
// rather than mutated in place, which is already reactive.
"svelte/prefer-svelte-reactivity": "off",
```
**Points at [`AddToSetlistDialog`](../components/ui/AddToSetlistDialog.svelte.md).** The rule wants `SvelteMap` from `svelte/reactivity`; the codebase instead reassigns a fresh `Map`, which is the immutable style used consistently everywhere (`notes = notes.map(...)`, `setlists = [s, ...setlists]`). Both work; the rule is off because the codebase made a coherent choice.

## The parser block
```js
// `.svelte.ts` modules carry runes too, so they need the Svelte parser
// rather than the plain TS one.
files: ["**/*.svelte", "**/*.svelte.ts"],
languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
```
**Easy to miss and it matters.** The five `.svelte.ts` store modules ([`media`](../lib/media.svelte.ts.md), [`nav-stack`](../lib/nav-stack.svelte.ts.md), [`overlay-history`](../lib/overlay-history.svelte.ts.md), [`search-open`](../lib/search-open.svelte.ts.md), [`card-actions`](../lib/card-actions.svelte.ts.md)) contain `$state` and `$effect`, which the plain TS parser reads as undefined identifiers. Nested parsers: Svelte outer, TypeScript inner.

**Related:** [`tsconfig.json`](tsconfig.json.md), [`lib/db-driver.ts`](../lib/db-driver.ts.md), [`lib/media.svelte.ts`](../lib/media.svelte.ts.md)
