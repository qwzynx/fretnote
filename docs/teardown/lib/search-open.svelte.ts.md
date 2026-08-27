# `src/lib/search-open.svelte.ts`

**Role:** A single shared boolean: is the `Ctrl+K` search palette open?
**Size:** 5 lines — the smallest module in the codebase.

---

## Full source, annotated

```ts
class SearchOpenStore {
  open = $state(false);
}

export const searchOpenStore = new SearchOpenStore();
```

### Why a class, when `media.svelte.ts` used a closure + getter?

Both are valid Svelte 5 store idioms, and this codebase uses each where it fits.

`media.svelte.ts` needed a **read-only** value derived from an external source (`matchMedia`). A getter with no setter enforces that: `isPhone.current = true` is a silent no-op or a TypeError. Consumers can only observe.

`searchOpenStore` needs to be **read-write** from anywhere. `App.svelte` opens it via `toggleSearch()`, `SiteHeader.svelte` opens it from a button, `SearchPalette.svelte` closes it on Escape or on selecting a result. A public class field is the least ceremonious way to get that: `searchOpenStore.open = true` just works.

The rune goes on the field, not in a constructor. `open = $state(false)` inside a class body is a Svelte 5 class-field declaration — the compiler transforms it into a reactive getter/setter pair on the instance. Every read is tracked, every write notifies.

### Why a store at all, instead of a prop?

Look at who needs to touch this state:

```
App.svelte           ← global Ctrl+K keybinding writes it
SiteHeader.svelte    ← search button writes it
SearchPalette.svelte ← reads it to show/hide; writes false to close
```

`SearchPalette` and `SiteHeader` are siblings rendered from `App.svelte`. Threading a boolean plus a setter callback down two branches of the tree ("prop drilling") to connect them is exactly the problem a module store solves. Because the state lives in a module, any component can `import { searchOpenStore }` and participate — no shared ancestor required.

### Why a singleton instance and not the class?

```ts
export const searchOpenStore = new SearchOpenStore();
```

The class is *not* exported — only one instance of it can ever exist outside this file. That's the point: there is exactly one search palette in the app, so there must be exactly one flag. Exporting the class would invite a second instance, which would silently do nothing (a second store nothing is listening to).

ES modules are evaluated once and cached, so every importer gets this same object.

### Why is `open` not just a field on `nav-stack.svelte.ts`?

`nav-stack.svelte.ts` exports a `toggleSearch()` function, so at first glance this flag looks like it belongs there. It's separate to avoid an import cycle: `nav-stack` handles history and section routing, and `SearchPalette` needs the flag — if the flag lived in `nav-stack`, `SearchPalette` would import `nav-stack`, which imports things that import `SearchPalette`'s siblings. Splitting the one boolean into its own leaf module breaks the cycle. This is why a 5-line file exists instead of one extra field elsewhere.

---

## Control flow

None. No functions, no conditionals, no loops. It is a typed, reactive, shared variable.

**A good exercise:** grep for `searchOpenStore` and read every hit. It's the smallest complete example of the cross-component state pattern in this codebase, so tracing all of its uses takes five minutes and teaches you the pattern you'll then recognise in `nav-stack.svelte.ts` and `overlay-history.svelte.ts`, which are much harder.

---

## Related

- [`components/SearchPalette.svelte`](../components/SearchPalette.svelte.md) — the consumer
- [`lib/nav-stack.svelte.ts`](nav-stack.svelte.ts.md) — exports `toggleSearch()`, which flips this
- [`App.svelte`](../App.svelte.md) — binds `Ctrl+K`
- [`lib/media.svelte.ts`](media.svelte.ts.md) — the other store idiom, and why they differ
