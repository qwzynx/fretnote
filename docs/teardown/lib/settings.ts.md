# `src/lib/settings.ts`

**Role:** App-wide user preferences — the defaults a new note is seeded with, plus reader defaults. Persisted to `localStorage`, *not* to SQLite.
**Size:** 35 lines. **Depends on:** `@/lib/types` (for `Difficulty`).

---

## The shape

```ts
export interface Settings {
  defaultKey: string;
  defaultCapo: number;
  defaultDifficulty: Difficulty;
  defaultTuning: string;
  defaultScrollSpeed: number;
  defaultFontSize: number;
}
```

Every field is prefixed `default*`, and that naming is load-bearing. These are **seed values**, not live settings. Changing `defaultKey` does not retune existing songs — it only changes what the create form pre-fills. Once a note is saved, its own `key`/`capo`/`tuning` columns own that data and this file is irrelevant to it.

The split is deliberate and worth internalising:

| Concern | Lives in | Why |
|---|---|---|
| A note's key, capo, tuning | SQLite `notes` row | Travels with the song; must survive export/import and sync between devices |
| The *default* key a new note starts at | localStorage | Per-device convenience; meaningless to export |
| Reader scroll speed / font size | localStorage | A property of *this screen*, not of the song |

`defaultTuning` is typed `string`, not a union, because tunings are data (`lib/music/tunings.ts`) and users may get custom ones. `defaultDifficulty` *is* a union (`Difficulty`) because that set is closed — three values, hardcoded in `types.ts`.

## The defaults

```ts
export const DEFAULT_SETTINGS: Settings = {
  defaultKey: "C",
  defaultCapo: 0,
  defaultDifficulty: "beginner",
  defaultTuning: "standard",
  defaultScrollSpeed: 30,
  defaultFontSize: 16,
};
```

Exported, not private, because two different consumers need it: `getSettings()` below, and `SettingsPage.svelte`, which needs it to render a "Reset to defaults" action. `"C"` and `"standard"` are the no-sharps-no-flats, no-surprises choices; `capo: 0` means none.

```ts
const STORAGE_KEY = "fretnote_settings";
```

Not exported — nothing outside this module should be touching the raw key. The `fretnote_` prefix namespaces it against anything else on the same origin (this matters for the browser build, where the app shares `localStorage` with whatever else is on that domain). The same convention appears in [`recent.ts`](recent.ts.md) (`fretnote_recent`).

---

## `getSettings()`

```ts
export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
```

Read it as three defence layers around one line of real work.

### `if (!raw) return { ...DEFAULT_SETTINGS }`

**The condition:** `getItem` returns `null` for a key that was never set. `!raw` also catches `""` — a key set to an empty string, which `JSON.parse` would throw on. One check covers both.

**Why spread instead of returning `DEFAULT_SETTINGS` directly:** This is the most important detail in the file. `DEFAULT_SETTINGS` is a module-level singleton. If it were returned by reference, any caller that mutated the result — `s.defaultCapo = 2` before a save, which is exactly what a settings form does — would silently corrupt the constant for the rest of the session. Every subsequent "reset to defaults" would then restore the *mutated* values. The spread hands out a fresh object each call, so callers can mutate freely.

The same `{ ...DEFAULT_SETTINGS }` appears three times in six lines for this reason. It is not redundant.

### `return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }`

**The merge order is the migration strategy.** Defaults go in first and stored values overwrite them. The consequence: when a future version adds a seventh field, every user's stored JSON is missing it — and the spread fills it in from `DEFAULT_SETTINGS` automatically. No version number, no migration function, no upgrade path to maintain.

The tradeoff, which you should be aware of: this merge is **shallow and untyped**. `JSON.parse` returns `any`, so TypeScript cannot verify that the stored object matches `Settings`. If localStorage contains `{"defaultCapo": "banana"}`, you get `"banana"` typed as `number`, and it flows into the app unchecked. There's no validation layer here. In practice the only writer is `saveSettings` below, so the data is trusted — but hand-edited localStorage or a schema change could produce this.

Also note: a *removed* field isn't cleaned up. Stored keys that are no longer in `Settings` survive the merge and ride along in the returned object forever.

### `catch { return { ...DEFAULT_SETTINGS } }`

**What can throw:**
1. `JSON.parse` on malformed JSON.
2. `localStorage.getItem` itself, in a browser with site data blocked, or in Safari private mode.

**Why a bare `catch` with no binding:** The error is genuinely not actionable. There's no repair to attempt and nowhere useful to report it — this runs on app startup before any toast system is mounted. The correct behaviour is to fall back to a working app with default settings, which is exactly what it does.

**Why not clear the corrupt key:** It doesn't. Corrupt data stays in localStorage and this function keeps swallowing it on every call. The next `saveSettings` overwrites it. Arguably a `localStorage.removeItem(STORAGE_KEY)` in the catch would be tidier; the current version prioritises never doing a write from a read path.

---

## `saveSettings(s)`

```ts
export function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
```

**Note the asymmetry: no `try`/`catch` here.** The read is defensive, the write is not. That's a deliberate choice, not an oversight — and it's a legitimate design question you should form your own opinion on.

The argument for it: a failed *read* has an obvious correct fallback (use defaults). A failed *write* does not. If the write throws — `QuotaExceededError`, or storage blocked — swallowing it would tell the user their settings saved when they didn't. Letting it propagate means the caller in `SettingsPage.svelte` can surface a real error.

The argument against: nothing in `SettingsPage.svelte` currently catches it, so in the blocked-storage case this throws an unhandled rejection into the console rather than showing anything to the user. Compare [`recent.ts`](recent.ts.md), which *does* wrap its write in `try {} catch {}` — because there, silently dropping a "recently viewed" entry genuinely doesn't matter.

**No partial updates:** The signature takes a whole `Settings`. There's no `updateSetting(key, value)`. Callers must `getSettings()`, mutate the copy, and `saveSettings()` it back — which is safe precisely because `getSettings` returns a fresh object.

---

## Control flow summary

| Line | Construct | Purpose |
|---|---|---|
| 24 | `try` | Guard against blocked storage and malformed JSON |
| 26 | `if (!raw)` | Distinguish "never saved" (and "saved empty") from "has data" |
| 27 | spread merge | Forward-compatible schema migration |
| 28 | `catch` | Unconditional fallback to a working state |

No loops anywhere. No async — `localStorage` is synchronous, which is why this can be called during component initialisation without any await ceremony. That synchronicity is the main reason settings live here rather than in SQLite.

---

## Related

- [`lib/types.ts`](types.ts.md) — `Difficulty`
- [`pages/SettingsPage.svelte`](../pages/SettingsPage.svelte.md) — the only writer
- [`lib/recent.ts`](recent.ts.md) — same localStorage pattern, different error-handling choice
- [`lib/music/tunings.ts`](music/tunings.ts.md) — what `defaultTuning` indexes into
