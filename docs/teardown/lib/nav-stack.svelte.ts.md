# `src/lib/nav-stack.svelte.ts`

**Role:** Replaces the browser's literal history with a small *canonical* hierarchy, so the Android back button always goes somewhere sensible.
**Size:** 193 lines. **Depends on:** `./search-open.svelte`, `./overlay-history.svelte`.

**The hardest file in the codebase.** It manipulates `history` directly while `svelte-spa-router` is also listening, and three of its comments describe bugs that are genuinely hard to reason about. Read [`overlay-history.svelte.ts`](overlay-history.svelte.ts.md) first.

---

## The problem

The module doc states it:

> *"Reduces the real browser/hardware back stack to a small canonical hierarchy — Note → (Search | Section) → Home → exit — instead of the literal sequence of pages visited."*

Browsers record every navigation. So a user who wanders Feed → Note A → Feed → Note B → Feed → Settings has six entries, and backing out of Settings walks that whole trail in reverse — through notes they've finished with — before reaching Home.

Native apps don't behave that way. Back means "up one level in the hierarchy," not "undo my last action." So this module maintains its own **logical** stack and forces the real history to match it.

> *"Every internal nav link/redirect **must** go through `goto`/`openSearch`/`closeSearch`/`toggleSearch` so the real history entries this module owns never drift out of sync."*

**That's a hard project invariant.** A raw `<a href="#/settings">` or a direct `push()` from `svelte-spa-router` bypasses this module, and `markerCount` silently stops matching reality. When reading components, check that every navigation goes through `goto`.

---

## The model

```ts
type NavLevel =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: "section"; path: string }
  | { kind: "note"; id: string }
  | { kind: "note-edit"; id: string };

let stack: NavLevel[] = [{ kind: "home" }];
let markerCount = 0;
let suppressed = 0;
```

A discriminated union again — the third in the codebase after `ParsedLine` and the backup kinds.

**`stack` always has `home` at the bottom** and is at most three deep (`home → note → note-edit`). That bound is what makes back predictable.

**`markerCount`** — how many history entries this module has pushed *above* the entry it started on. Always `stack.length - 1` when consistent. Tracked separately because it describes the **browser's** state, while `stack` describes the **app's**; the whole file is about keeping them equal.

**`suppressed`** — the same idea as in `overlay-history`: a count of `popstate` events this module caused, which must not be read as user back-presses.

**Plain `let`, not `$state`.** Despite the `.svelte.ts` extension, nothing here is reactive. The extension is presumably vestigial or for consistency; reactivity is delegated to `searchOpenStore`. Worth noticing so you don't go looking for reactive reads.

---

## `classify(path)` and `hashFor(level)`

```ts
function classify(path: string): NavLevel {
  const editMatch = path.match(/^\/notes\/([^/]+)\/edit/);
  if (editMatch) return { kind: "note-edit", id: editMatch[1] };
  const noteMatch = path.match(/^\/notes\/([^/]+)/);
  if (noteMatch) return { kind: "note", id: noteMatch[1] };
  if (path === "/") return { kind: "home" };
  return { kind: "section", path };
}
```

**URL → level.** The order is a specification: **`/edit` is tested first**, because `/notes/abc/edit` also matches the note pattern. Most specific first — the same rule as `parseChordLine`'s tabref-before-section ordering.

**`[^/]+`** — a negated class that can't cross a `/`, so the id capture stops before `/edit`. The same non-greedy-by-construction trick used throughout [`parse.ts`](music/parse.ts.md).

**The final `return { kind: "section", path }` is a catch-all.** Anything unrecognised — `/create`, `/setlists`, `/settings`, `/anything` — becomes a section. So `/create` is treated as a peer of `/settings` in the hierarchy, even though [`sections.ts`](sections.ts.md) deliberately excludes it from the *swipeable* sections. Two different notions of "section" in the codebase; they don't have to agree, but it's a place to be careful.

**`search` is never produced by `classify`** — there's no `/search` route. It's a state, entered only via `openSearch()`.

```ts
function hashFor(level: NavLevel): string {
  if (level.kind === "note") return `/notes/${level.id}`;
  if (level.kind === "note-edit") return `/notes/${level.id}/edit`;
  if (level.kind === "section") return level.path;
  return "/";
}
```

**The inverse.** Note the final `return "/"` covers **both** `home` and `search` — search has no URL of its own, so it displays as the feed with an overlay on top. That's why `applyTop` sets `searchOpenStore.open` separately from the hash.

`classify(hashFor(level))` round-trips for every kind except `search`, which becomes `home`. That asymmetry is deliberate and shows up in `handleNavPop`.

---

## `applyTop()`

```ts
function applyTop() {
  const top = stack[stack.length - 1];
  searchOpenStore.open = top.kind === "search";
  history.replaceState(history.state, "", `#${hashFor(top)}`);
  window.dispatchEvent(new Event("hashchange"));
}
```

**Makes the world match `stack`'s top.** Two outputs: the search overlay flag, and the URL.

**`searchOpenStore.open = top.kind === "search"`** — an assignment, not an `if`. So it also *closes* search whenever the top isn't search. One line handles both directions.

**`history.replaceState`, not `pushState`** — the entry already exists (pushed by `setStack`); this only corrects its URL.

**`history.state` passed through** — preserves whatever marker was there (`{ fretnoteNav: true }`) rather than clobbering it with `null`.

**`window.dispatchEvent(new Event("hashchange"))`** — the manual router kick. `replaceState` does **not** fire `hashchange` even when the hash changes, so `svelte-spa-router` would never re-render. This synthetic event is what makes the route actually change.

### The comment that explains the whole approach

> *"Inlined, synchronous equivalent of `svelte-spa-router`'s `replace()` — that helper defers its actual `history.replaceState` behind `await tick()`, which would race with the synchronous `pushState`/`go()` calls below (both belong to the same logical stack transition and must land in history in this exact order)."*

**Why not just use the router's `replace()`:** it's async. In `setStack`, `pushState` runs and then `applyTop()` must correct that entry's hash. With an async `replace()`, the `replaceState` would land *after* other synchronous history calls, patching the wrong entry.

The entire history transition has to be one synchronous block. That's why this module reimplements a two-line helper instead of importing it.

---

## `setStack(newStack)` — the reconciler

```ts
function setStack(newStack: NavLevel[]) {
  const newMarkers = newStack.length - 1;
  const diff = newMarkers - markerCount;
  stack = newStack;
  if (diff > 0) {
    for (let i = 0; i < diff; i++) history.pushState({ fretnoteNav: true }, "");
    markerCount = newMarkers;
    applyTop();
  } else if (diff < 0) {
    suppressed += 1;
    markerCount = newMarkers;
    history.go(diff);
  } else {
    applyTop();
  }
}
```

**The heart of the module.** Given a desired logical stack, make the browser's history depth match. Three cases.

### `diff > 0` — going deeper

```ts
// Push first, fix up the hash on the freshly-created (now current) entry
// second — this leaves whatever entry we're leaving untouched.
for (let i = 0; i < diff; i++) history.pushState({ fretnoteNav: true }, "");
markerCount = newMarkers;
applyTop();
```

**A loop, because `diff` can be 2.** That happens in `goto` when opening an edit form directly from the feed — the stack jumps from `[home]` to `[home, note, note-edit]`, two levels at once. Each push creates one entry so a later back-press unwinds them one at a time.

**`pushState({ fretnoteNav: true }, "")` with no URL** — the same same-hash trick as `overlay-history`'s `pushLayer`. It creates an entry without firing `hashchange`, so the router doesn't react yet. `applyTop()` then sets the correct hash and fires the event once.

**The comment's ordering point:** push creates a new entry and makes it current; `applyTop`'s `replaceState` then edits *that* entry. Reversing it would rewrite the entry being left behind, corrupting it for anyone who later backs into it.

**`{ fretnoteNav: true }`** distinguishes these from `overlay-history`'s `{ fretnoteLayer: true }` when inspecting `history.state`.

### `diff < 0` — going shallower

```ts
// `history.go()` is asynchronous — the entry we're collapsing to isn't
// current yet, so fixing up its hash has to wait until that navigation
// actually lands (handleNavPop calls applyTop() once the resulting
// popstate arrives). Fixing it up now would patch the entry we're
// still leaving, corrupting it for anyone who later backs into it.
suppressed += 1;
markerCount = newMarkers;
history.go(diff);
```

**No `applyTop()` here** — that's the whole point of the comment. `history.go()` is asynchronous, so the target entry isn't current yet. Calling `applyTop()` now would `replaceState` on the entry being *left*, giving it the wrong hash. The fix-up is deferred to `handleNavPop`, which runs when the resulting `popstate` arrives.

**`suppressed += 1`, singular** — the same browser behaviour documented in `closeAllLayers`: `history.go(-N)` fires **one** `popstate`, not N.

**`history.go(diff)`** — `diff` is already negative, so it's passed directly rather than negated.

### `diff === 0` — same depth

```ts
// Same depth (e.g. swapping which note/section is shown in place).
applyTop();
```

Navigating from Note A to Note B, or Settings to Setlists. The history depth doesn't change; only the current entry's URL does. A `pushState` here would grow the stack with every sideways move — exactly the behaviour the module exists to prevent.

---

## `isNavClick(e)`

```ts
function isNavClick(e?: MouseEvent): boolean {
  if (!e) return true;
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  return true;
}
```

**Preserves native anchor behaviour for modified clicks.**

- **`!e` → `true`** — a programmatic `goto("/")` with no event is always a navigation.
- **`defaultPrevented`** — something upstream already handled it.
- **`button !== 0`** — only the primary button. Middle-click (button 1) must open a new tab.
- **Any modifier** — Ctrl/Cmd-click opens a new tab, Shift a new window, Alt downloads.

Returning `false` makes `goto` bail **without** calling `preventDefault()`, so the browser performs its default anchor action. Getting this wrong is a common SPA annoyance: Ctrl-clicking a link and getting an in-app navigation instead of a new tab.

**`e?.preventDefault()`** in `goto` runs only on the accepted path, and the optional chain handles the programmatic case.

---

## `goto(path, e?)` — the navigation rules

The four branches encode the hierarchy.

### Home

```ts
if (level.kind === "home") setStack([{ kind: "home" }]);
```

**Collapse to the root.** From anywhere, tapping Home resets to depth 1. If you were three deep, `diff` is `-2` and one `history.go(-2)` unwinds it.

### `note-edit` — three sub-cases

```ts
// Editing sits one level above viewing that same note, so Cancel /
// hardware-back from the edit form lands back on the note, not its
// grandparent (search/section/home).
if (top.kind === "note" && top.id === level.id) {
  setStack([...stack, level]);                       // push edit above this note
} else if (top.kind === "note-edit" && top.id === level.id) {
  setStack([...stack.slice(0, -1), level]);          // already editing — replace in place
} else {
  setStack([...stack, { kind: "note", id: level.id }, level]);  // synthesise the view level
}
```

**Case 1 — editing the note you're viewing.** Push one level. Back returns to the note.

**Case 2 — already editing this note.** Replace in place (`slice(0, -1)` drops the top). `diff` is `0`, so no history change. Guards against a re-entrant navigation to the same edit URL growing the stack.

**Case 3 — the interesting one.** Editing a note you weren't viewing (from a feed card's edit button, or a deep link to `#/notes/x/edit`). **A `note` level is synthesised** beneath the edit level even though the user never visited it.

That's the comment's point: back from the edit form should land on the *note*, not on the feed. Inserting a level the user never visited is what makes the hierarchy canonical rather than historical. `diff` is `+2`, so `setStack`'s loop pushes two entries.

**`top.id === level.id`** — both checks compare ids, so editing a *different* note from a note view falls to case 3 and correctly gets its own view level.

### `note` — three sub-cases

```ts
if (top.kind === "note-edit" && top.id === level.id) {
  // Returning to the view after saving/canceling an edit of this note —
  // drop the edit level, revealing the view level already beneath it.
  setStack(stack.slice(0, -1));
} else if (top.kind === "note") {
  setStack([...stack.slice(0, -1), level]);
} else {
  setStack([...stack, level]);
}
```

**Case 1 — the edit-form return path.** After save or cancel, the form navigates to `/notes/:id`. Rather than pushing a level, this **pops** the edit level, revealing the note view already beneath. `diff` is `-1` → one `history.go(-1)`.

Without this, saving would push a *third* level and back from the note would return you to the edit form you just left.

**Case 2 — note to note** (a "related song" link, or a setlist's next track). Replace in place, `diff === 0`. This is what stops a browsing session from stacking twenty note levels.

**Case 3 — entering a note from anywhere else.** Push one level.

### Everything else

```ts
} else {
  setStack([{ kind: "home" }, level]);
}
```

**Sections are always exactly one level above home**, never stacked. Feed → Settings → Setlists stays at depth 2 throughout, with each move a `diff === 0` in-place swap. So back from any section goes Home, never sideways through other sections.

The `[{ kind: "home" }, level]` literal **discards whatever was there** — including a `note` or `note-edit` level. Navigating to a section from a note collapses the note out of the stack entirely.

---

## `openSearch` / `closeSearch` / `toggleSearch`

```ts
export function openSearch()  { setStack([{ kind: "home" }, { kind: "search" }]); }
export function closeSearch() { setStack([{ kind: "home" }]); }
export function toggleSearch() {
  const top = stack[stack.length - 1];
  if (top.kind === "search") closeSearch();
  else openSearch();
}
```

**Search is modelled as a nav level, not an overlay layer** — even though it's visually an overlay. Consequences:

- Back closes search (it's `diff === -1`).
- **Opening search from a note discards the note level** — `openSearch` sets the stack to exactly `[home, search]`. Closing search returns to Home, not to the note.

That's a real behavioural choice worth testing in the app. It's consistent with search being a way to jump anywhere rather than a modal over your current place.

**`toggleSearch` reads the stack, not `searchOpenStore.open`** — the stack is the source of truth; the store is a derived output written by `applyTop`. Reading the derived value would risk acting on a stale flag mid-transition.

---

## `handleNavPop()` — interpreting a back press

```ts
function handleNavPop() {
  if (suppressed > 0) {
    suppressed -= 1;
    applyTop();
    return;
  }
  ...
}
```

**Priority 1 — our own `history.go()` landing.** The deferred `applyTop()` from `setStack`'s `diff < 0` branch: the target entry is now current, so its hash can safely be fixed up. This is the second half of that transaction.

### Priority 2 — a genuine back press

```ts
// Not every popstate is a back press. Browsers also fire it for any
// same-document history navigation: the forward button, a hash the user
// typed or pasted, a deep link followed while the app is already open.
// Treating those as "pop one level" rewrote the URL back to the level
// below and silently discarded where the user actually asked to go —
// opening #/settings from #/create landed you on the feed.
//
// The tell is whether the URL we've arrived at is the one a back press
// would have produced. If it isn't, the navigation came from outside this
// module and the URL, not the stack, is the source of truth.
const landed = currentHash();
const wouldPopTo = stack.length > 1 ? stack[stack.length - 2] : stack[0];

if (hashFor(wouldPopTo) === landed) {
  if (stack.length > 1) {
    stack = stack.slice(0, -1);
    markerCount -= 1;
  }
  applyTop();
  return;
}
```

**This comment is a complete bug report with a reproduction**, and the technique it describes is the cleverest thing in the file.

**The problem:** `popstate` doesn't mean "back." It fires for forward-button presses, for a hash typed in the address bar, and for a deep link followed while the app is running. Treating all of them as "pop one level" meant typing `#/settings` while on `#/create` rewrote the URL to `#/` and dropped you on the feed.

**The detection:** compute where a back press *would* have landed (`stack[length - 2]`), and compare its hash to where you actually are. Match ⇒ it was a back press. Mismatch ⇒ the navigation came from outside.

**Inference from observable state**, with no extra flags to keep in sync — and it's robust because it compares against the module's own model rather than trying to enumerate every event source.

**`stack.length > 1 ? stack[length - 2] : stack[0]`** — at depth 1 there's no level below, so it compares against home itself. Back at the root exits the app, and the browser handles that; this just avoids an out-of-bounds read.

**The inner `if (stack.length > 1)` guard** prevents popping the root off. `stack` must never be empty — `applyTop` would throw on `stack[-1]`.

**`markerCount -= 1`** stays in step with `stack.length - 1`.

### Priority 3 — adopt the URL

```ts
// Adopt the URL rather than fighting it. No applyTop() here: that would
// rewrite the very hash we're adopting.
seedFromCurrentHash();
searchOpenStore.open = false;
window.dispatchEvent(new Event("hashchange"));
```

**Rebuild the stack from wherever the browser ended up.**

**"No `applyTop()` here"** — and the reason is exact. `applyTop` does `replaceState` with `hashFor(top)`. Since the stack was just seeded *from* the current hash, that would be a no-op at best; but if `classify`/`hashFor` don't round-trip (search → home, or a path with a trailing slash), it would **overwrite the user's URL with a normalised version**, undoing the adoption. Skipping it is what "adopt rather than fight" means concretely.

**`searchOpenStore.open = false`** — done manually here, since `applyTop` (which normally handles it) isn't called. An externally-driven navigation always closes search.

**`dispatchEvent(new Event("hashchange"))`** — still needed to tell the router to render. `popstate` fired, but `svelte-spa-router` listens for `hashchange`.

---

## `seedFromCurrentHash()`

```ts
function seedFromCurrentHash() {
  const level = classify(currentHash());
  stack = level.kind === "home" ? [{ kind: "home" }] : [{ kind: "home" }, level];
  // Deliberately 0, not `stack.length - 1`: we own no pushed markers above
  // the entry we're sitting on. Claiming otherwise would make the next
  // navigation compute a negative diff and `history.go()` backwards out of
  // the app. Erring low only ever costs an extra marker push.
  markerCount = 0;
}
```

**Note the deliberate inconsistency:** `stack` can be depth 2 while `markerCount` is `0`. Everywhere else they're locked together — here they're intentionally not.

**Why**, per the comment: `markerCount` describes **history entries this module pushed**. On a cold start at `#/notes/abc`, the stack is *modelled* as `[home, note]` but the module pushed nothing — there's one browser entry, the one the app loaded into. Setting `markerCount = 1` would make the next navigation to home compute `diff = 0 - 1 = -1` and fire `history.go(-1)`, navigating **out of the app** to whatever preceded it.

**"Erring low only ever costs an extra marker push"** — the failure modes are asymmetric. Too low: one redundant `pushState`, a harmless extra back-press. Too high: `history.go()` leaves the app. So the safe direction is chosen deliberately.

This is a good example of a comment that saves you from "fixing" an apparent inconsistency into a bug.

**`stack.length` is capped at 2 here** — a deep link to `/notes/x/edit` seeds as `[home, note-edit]`, not `[home, note, note-edit]`. So back from a deep-linked edit form goes Home rather than to the note. A minor divergence from `goto`'s case-3 behaviour.

**`currentHash()`**:

```ts
function currentHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}
```

Strips the leading `#`, defaulting to `"/"` for an empty hash. `|| "/"` (not `??`) is correct — `""` is exactly what's being caught.

---

## `initNavStack()`

```ts
export function initNavStack(): () => void {
  seedFromCurrentHash();
  setPopstateFallback(handleNavPop);
  return () => setPopstateFallback(null);
}
```

**Registers as `overlay-history`'s fallback rather than adding its own listener** — the single-listener design explained in that file. Overlays get first refusal on every `popstate`; routing only sees what they don't claim.

**Seeds before registering**, so no event can arrive against an uninitialised stack.

**Returns its cleanup**, matching `initOverlayHistory`'s contract. Both are called from `App.svelte`'s `onMount`.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `/edit` regex tested first | `classify` | `/notes/x/edit` also matches the note pattern |
| `return "/"` for home **and** search | `hashFor` | Search has no URL — it's home plus an overlay |
| `replaceState` + manual `hashchange` | `applyTop` | `replaceState` doesn't fire it; the router needs it |
| inlined replace, not the router's | `applyTop` | The router's is async and would race the sync push/go |
| `for (i < diff)` pushes | `setStack` | `diff` can be 2 (feed → edit form) |
| **no** `applyTop()` on `diff < 0` | `setStack` | `go()` is async — patching now hits the wrong entry |
| `suppressed += 1`, not `+= n` | `setStack` | `go(-N)` fires one popstate |
| `diff === 0` → `applyTop` only | `setStack` | Sideways moves must not grow history |
| `!e → true`, modifiers → `false` | `isNavClick` | Preserve Ctrl/middle-click new-tab behaviour |
| synthesise a `note` level | `goto` case 3 | Back from edit lands on the note, not the feed |
| `stack.slice(0, -1)` | `goto` note case 1 | Save/cancel *pops* the edit level |
| `[home, level]` literal | `goto` else | Sections never stack |
| `hashFor(wouldPopTo) === landed` | `handleNavPop` | Distinguishes a back press from any other popstate |
| **no** `applyTop()` on adoption | `handleNavPop` | Would overwrite the URL being adopted |
| `markerCount = 0` | `seedFromCurrentHash` | Erring low costs a push; erring high exits the app |

---

## Suggested experiments

1. From `#/create`, type `#/settings` in the address bar. Then delete the `hashFor(wouldPopTo) === landed` check and try again — you'll land on the feed.
2. Set `markerCount = stack.length - 1` in `seedFromCurrentHash`, deep-link to a note, then tap Home. Watch the app navigate out of itself.
3. Add `applyTop()` to `setStack`'s `diff < 0` branch, then navigate deep and back — the entry you left gets the wrong hash.
4. Change `goto`'s section branch to `[...stack, level]` and tab between sections a few times, then hold back.

---

## Related

- [`lib/overlay-history.svelte.ts`](overlay-history.svelte.ts.md) — owns the single `popstate` listener this registers with
- [`lib/search-open.svelte.ts`](search-open.svelte.ts.md) — the flag `applyTop` writes
- [`lib/sections.ts`](sections.ts.md) — a *different*, narrower notion of "section"
- [`App.svelte`](../App.svelte.md) — calls `initNavStack()`; binds Ctrl+K to `toggleSearch`
- [`components/layout/SectionSwipe.svelte`](../components/layout/SectionSwipe.svelte.md) — swipe navigation, which must also route through `goto`
