# `src/lib/recent.ts`

**Role:** Tracks the last 10 notes the user opened, most-recent-first, in `localStorage`.
**Size:** 18 lines. **Depends on:** nothing.

---

## Constants

```ts
const KEY = "fretnote_recent";
const MAX = 10;
```

Both private. `fretnote_` namespaces the localStorage key (same convention as [`settings.ts`](settings.ts.md)). `MAX = 10` caps the list — this is a UI affordance (the search palette shows recents when the query is empty), so an unbounded list would be both useless and a slow-growing storage leak.

Storage holds **IDs only**, never note content. That's the right call: notes are mutable and live in SQLite, so caching titles here would go stale the moment a song is renamed. Consumers take these IDs and look up current data from the database.

---

## `recordView(noteId)`

```ts
export function recordView(noteId: string): void {
  const ids = getRecentIds().filter((id) => id !== noteId);
  ids.unshift(noteId);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {}
}
```

This is the classic **move-to-front (MRU) list** in three lines. Read it as: remove, prepend, truncate.

### `getRecentIds().filter((id) => id !== noteId)`

**The loop:** `filter` iterates the whole stored list (≤10 items) and keeps everything that isn't the note being recorded.

**Why remove before adding:** Without this, re-opening a note you viewed three days ago would put it at the front *and* leave the old entry deeper in the list. The list would fill with duplicates of your favourite songs and evict everything else. Filtering first guarantees each ID appears at most once.

Note this also handles the "not present" case for free — `filter` on a list without the ID just returns a copy. No `indexOf` check needed.

**It returns a new array**, so the array from `getRecentIds()` is never mutated. Not strictly necessary (that array is freshly parsed and unshared) but it keeps the function free of aliasing surprises.

### `ids.unshift(noteId)`

Prepends, in place, on the freshly-filtered array. `unshift` is O(n) because it reindexes every element — irrelevant at n ≤ 10, and it's what makes "most recent first" the natural read order, so consumers need no reversal.

### `ids.slice(0, MAX)`

**Truncates to the cap.** Applied at write time, not read time.

Doing it here rather than in `getRecentIds` means the stored data is *always* already valid, so the read path can be a straight parse with no post-processing. `slice` is safe when the array is shorter than `MAX` — it just returns everything.

Order matters: the eviction happens *after* the unshift, so the newest item is never the one dropped. The 11th-oldest falls off the end.

### `try { ... } catch {}` — the empty catch

**What can throw:** `QuotaExceededError`, or `setItem` in a browser with site data disabled (Safari private mode, hardened settings).

**Why swallowing it silently is correct here** — and this is the contrast to draw with `settings.ts`:

> In `settings.ts`, `saveSettings` has *no* try/catch, so a failed write propagates. Here, the write is wrapped and the error is dropped entirely.

That difference is deliberate, and it's about what the data is worth. A failed settings save is a broken promise to the user — they changed something and it didn't stick, and they need to know. A failed "recently viewed" write costs the user nothing they'd notice; the feature degrades to "no recents" and the app is otherwise fine. Interrupting a note-open with an error toast because a convenience cache couldn't write would be strictly worse than doing nothing.

**Where the try block starts is precise.** It wraps only `setItem` — the read and the array work sit outside it. Widening it wouldn't change behaviour today (`getRecentIds` has its own catch) but the narrow form documents exactly which operation is expected to fail.

---

## `getRecentIds()`

```ts
export function getRecentIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
```

### `localStorage.getItem(KEY) ?? "[]"`

**The `??` (nullish coalescing):** `getItem` returns `null` when the key was never written. `null ?? "[]"` yields `"[]"`, which parses to an empty array. This collapses the "first run" case into the normal path with no `if`.

**Why `??` and not `||`:** They behave identically here (`""` and `null` are the only falsy values `getItem` can return, and `""` would throw in `JSON.parse` either way — `||` would actually be marginally *safer*, catching the empty string too). `??` is the more precise statement of intent: "substitute only for null/undefined."

### `catch { return [] }`

Same reasoning as `settings.ts`: corrupt JSON or blocked storage both mean "we have no history," and an empty array is a completely valid answer to that. Callers never have to handle a failure mode.

### The unchecked type assertion

`JSON.parse` returns `any`, and the declared return type is `string[]`. **Nothing verifies that.** If localStorage held `{"a":1}`, this returns an object typed as `string[]` and consumers would break downstream. There's no `Array.isArray` guard.

In practice the only writer is `recordView`, which always writes a string array — so the data is trusted by construction. Worth noting as a soft spot, and as the same pattern you saw in `settings.ts`. This codebase consistently treats its own localStorage as trusted; contrast that with the `.fretnote` import path in `backup.ts`, which handles genuinely foreign data and validates properly.

---

## Function ordering

`recordView` is defined *above* `getRecentIds`, which it calls on its first line. That works because function declarations are hoisted. The ordering is by importance rather than dependency — the interesting function first. Common in this codebase; `db.ts` does the same (reads before the row-mapping helpers they call).

---

## Control flow summary

| Construct | Where | Purpose |
|---|---|---|
| `filter` loop | `recordView` | Deduplicate — remove any existing entry for this ID |
| `try/catch` (empty) | `recordView` write | Failure is genuinely ignorable |
| `??` | `getRecentIds` | Collapse "never written" into the normal path |
| `try/catch` (returns `[]`) | `getRecentIds` | Corrupt/blocked storage → "no history" |

No `if` statements and no explicit loops in the whole file. Everything branches through `??`, `filter`, and `catch`.

---

## Related

- [`components/SearchPalette.svelte`](../components/SearchPalette.svelte.md) — renders recents on an empty query
- [`pages/NotePage.svelte`](../pages/NotePage.svelte.md) — calls `recordView` when a note opens
- [`lib/settings.ts`](settings.ts.md) — same storage pattern, deliberately different error policy
- [`lib/db.ts`](db.ts.md) — where the IDs get resolved to real notes
