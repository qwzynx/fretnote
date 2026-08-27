# `src/lib/media.svelte.ts`

**Role:** Reactive breakpoint detection. Exposes three booleans (`isPhone`, `isCompact`, `isTouch`) that update automatically when the viewport or input device changes.
**Size:** 25 lines. **Depends on:** nothing but the DOM and Svelte 5 runes.

---

## The `.svelte.ts` extension — read this first

The filename is not `media.ts`. The `.svelte.ts` suffix tells the Svelte compiler to process this file even though it isn't a component. Without it, `$state` would be an undefined function at runtime.

This is the Svelte 5 mechanism for **runes outside components**. Five files in this codebase use it — `media.svelte.ts`, `nav-stack.svelte.ts`, `overlay-history.svelte.ts`, `search-open.svelte.ts`, `card-actions.svelte.ts` — and in each case it means "this module owns reactive state that components subscribe to." When you see the extension, expect a store.

---

## `mediaQuery(query)` — the factory

```ts
function mediaQuery(query: string) {
  let matches = $state(false);

  if (typeof window !== "undefined") {
    const mql = window.matchMedia(query);
    matches = mql.matches;
    mql.addEventListener("change", (e) => (matches = e.matches));
  }

  return {
    get current() {
      return matches;
    },
  };
}
```

Not exported — it's a private factory, called three times below to produce the three exports.

### `let matches = $state(false)`

Declares reactive state. Any component that reads this value during render is automatically re-rendered when it changes. Initialised to `false` so there's a defined value before the query is evaluated.

**Why `false` and not "unknown":** A tri-state (`null` = not yet determined) would be more truthful, but every consumer would then need a third branch. `false` means "assume desktop/non-touch until proven otherwise," which is the safer default: the desktop layout degrades acceptably on a phone for the one frame before the query resolves, whereas the reverse (phone layout flashing on desktop) is more jarring.

### `if (typeof window !== "undefined")`

**What it guards:** Server-side rendering, where there is no `window` and `window.matchMedia` would throw a `ReferenceError` at module load.

**Why it's here in an app that has no server:** This is a Tauri desktop app and a client-only Vite SPA. There is no SSR. The guard is, strictly speaking, dead code today.

It's kept for two defensible reasons: (1) `typeof x !== "undefined"` is the standard idiom and costs one comparison at module init; (2) the repo has a `browser-port` branch and a `vercel.json`, so a web deployment exists — and if that ever moved to a prerendering setup, this file would break at build time without the guard.

**Note the shape:** it's an `if` with no `else`. When the guard fails, `matches` simply stays `false` and the returned object still works. No throw, no null return. Consumers can't tell the difference between "no window" and "query doesn't match" — which is correct, because in both cases the desktop layout is what you want.

### `const mql = window.matchMedia(query)`

Returns a `MediaQueryList` — a live object representing the query, with a `.matches` boolean and event-target semantics.

### `matches = mql.matches`

**Why this line exists separately:** `addEventListener` only fires on *change*. If the app starts on a phone, the query already matches and no change event is coming. Without this line, `isPhone.current` would be `false` until the user rotated the device. This seeds the correct initial value.

**Order matters:** seed first, then subscribe. Doing it the other way round leaves a window (however small) where a change could fire and then be overwritten by a stale read.

### `mql.addEventListener("change", (e) => (matches = e.matches))`

Subscribes. The handler is an arrow function whose body is a single assignment expression wrapped in parens — the parens are needed because `(e) => { matches = e.matches }` with braces would be a block, and without them `=>` followed by `{` is parsed as a block anyway. The paren form makes it an expression body. Purely stylistic; the return value is discarded.

The event fires on viewport resize crossing the threshold, device rotation, or (for `pointer: coarse`) a change of primary input device.

**The listener is never removed.** There is no `removeEventListener` and no cleanup return. This is intentional and safe *here* because these three `MediaQueryList` objects are created exactly once, at module load, and live for the entire lifetime of the app. There is nothing to leak — a leak would require repeated creation. Do not copy this pattern into a component, where it would leak per instance.

### The returned object

```ts
return {
  get current() {
    return matches;
  },
};
```

**Why a getter and not `return { current: matches }`:** This is the crux of the file. `{ current: matches }` would evaluate `matches` **once**, at factory-call time, and freeze that value into a plain property forever. The object would be a dead snapshot.

A getter defers the read. `isPhone.current` re-executes `return matches` at the moment of access — which means it happens *inside* whatever reactive context is reading it, so Svelte's dependency tracker sees the `$state` access and registers the subscription. That's what makes `{#if isPhone.current}` in a template actually re-render.

**Why not export the `$state` variable directly:** Svelte 5 runes can't cross module boundaries as bare bindings — exporting a reassignable `let` that's `$state` isn't allowed. Wrapping it in an object with a getter is the standard workaround. The same shape appears in Svelte's own docs.

**Why `.current` as the property name:** Matches the convention used by Svelte's official `MediaQuery` class and the `runed` library. Consumers read `isPhone.current`, never `isPhone` — a bare `isPhone` is always truthy (it's an object), which is a real footgun. Watch for it in templates.

---

## The three exports

```ts
export const isPhone   = mediaQuery("(max-width: 639px)");
export const isCompact = mediaQuery("(max-width: 1023px)");
export const isTouch   = mediaQuery("(pointer: coarse)");
```

Module-level `const`s, so the factory runs three times at import and the listeners are attached once, process-wide. Every component importing `isPhone` gets the *same* object — a shared singleton, not a per-component instance.

| Export | Query | Tailwind equivalent | Used for |
|---|---|---|---|
| `isPhone` | `max-width: 639px` | below `sm` | Toast position in `App.svelte`; phone-only swipe navigation |
| `isCompact` | `max-width: 1023px` | below `lg` | Editor collapsing from two columns to one |
| `isTouch` | `pointer: coarse` | *none* | Hit-target sizing |

The two width queries mirror Tailwind's `sm` (640px) and `lg` (1024px) breakpoints exactly — `max-width: 639px` is the complement of `min-width: 640px`. **This coupling is unenforced.** If someone customises Tailwind's breakpoints in `globals.css`, these numbers silently drift out of sync with the CSS. Worth knowing as a fragile seam.

### The comment that explains the whole file

> *"for the few places a layout can't be expressed in CSS alone"*

This is the design rule. Responsive layout in this app is CSS-first — Tailwind's `sm:` / `lg:` prefixes handle almost everything, with zero JavaScript. This module exists only for the cases where a *decision*, not a style, depends on the viewport:

- `App.svelte` passes `position={isPhone.current ? "top-center" : "bottom-right"}` to `<Toaster>` — a prop, not a class. CSS can't set a prop.
- Swipe-gesture handlers are attached only on phones — CSS can't conditionally bind an event listener.

`isTouch` has no CSS equivalent at all (`pointer: coarse` is queryable in CSS, but the *hit-target sizes* it drives are computed values). If you find yourself adding a fourth query to drive a plain class name, that's a signal it belongs in CSS instead.

---

## Control flow summary

| Construct | Count | Purpose |
|---|---|---|
| `if` | 1 | SSR/no-DOM guard |
| loops | 0 | — |
| getters | 1 per instance | Defers the read so reactivity is tracked |

---

## Related

- [`App.svelte`](../App.svelte.md) — `isPhone` drives toast placement
- [`components/layout/SectionSwipe.svelte`](../components/layout/SectionSwipe.svelte.md) — phone-only gesture nav
- [`lib/nav-stack.svelte.ts`](nav-stack.svelte.ts.md) — another `.svelte.ts` module store
- [`app/globals.css`](../app/globals.css.md) — where the Tailwind breakpoints these mirror are defined
