# `src/lib/lyrics.ts`

**Role:** Fetches song lyrics from public APIs, picking the best match by fuzzy string similarity.
**Size:** 79 lines. **Depends on:** nothing but `fetch`.

**The only file in the codebase that talks to a network.** Everything else is local-first — this is the single exception, and it's optional (a convenience when authoring, never required to use the app).

---

## `normalize(s)`

```ts
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
```

A four-step cleanup so titles that differ only cosmetically compare equal.

1. **`.toLowerCase()`** — case-insensitive matching. Must come first: the next regex only whitelists lowercase `a-z`, so uppercase letters would otherwise be stripped as punctuation. Reordering these two lines would delete every capital.
2. **`.replace(/[^a-z0-9\s]/g, "")`** — drop everything that isn't a letter, digit, or whitespace. Kills apostrophes, commas, parentheses, hyphens. `"Don't Look Back (Live)"` → `"dont look back live"`.
3. **`.replace(/\s+/g, " ")`** — collapse runs of whitespace to one space. Needed because step 2 can leave gaps where punctuation was, and because the APIs return inconsistent spacing.
4. **`.trim()`** — strip the ends.

**Non-ASCII is destroyed.** `"Björk"` → `"bj rk"` (the `ö` is removed, leaving the surrounding letters). Same limitation as `makeSlug` in [`db.ts`](db.ts.md), and it will degrade matching for non-English artists. A Unicode-aware `\p{L}` class would fix it.

---

## `bigrams(s)`

```ts
function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
```

**Every adjacent pair of characters**, as a set.

```
"hello" → {"he", "el", "ll", "lo"}
```

**`i < s.length - 1`** — stops one short of the end, because `slice(i, i+2)` at the last index would return a single character. Off-by-one here would inject a spurious 1-char "bigram".

**A `Set`, so duplicates collapse.** `"aaa"` yields `{"aa"}`, not `["aa", "aa"]`. That makes the similarity below a *set* comparison rather than a multiset one — repeated character pairs don't inflate the score.

**A string of length ≤ 1 yields an empty set**, which the caller must handle (it does, via the `!na || !nb` guard).

**Why bigrams:** they capture local character order without being brittle. `"beatles"` and `"the beatles"` share most of their bigrams; a plain equality test or a word-set comparison would miss more.

---

## `similarity(a, b)`

```ts
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let overlap = 0;
  for (const g of ba) if (bb.has(g)) overlap++;
  return (2 * overlap) / (ba.size + bb.size);
}
```

**This is the Sørensen–Dice coefficient** over character bigrams — a standard fuzzy-string metric.

**`if (!na || !nb) return 0`** — an empty string after normalisation (missing field, or a title that was pure punctuation). Also prevents a division by zero below, since two empty strings would give `0/0 = NaN`.

**`if (na === nb) return 1`** — an exact-match fast path. It also handles a genuine edge case: single-character strings have no bigrams, so `ba.size + bb.size` would be `0` and the formula would produce `NaN`. Without this line, `similarity("a", "a")` breaks.

**The overlap loop** counts bigrams present in both sets. `for...of` over a `Set` with a `has` lookup on the other — O(n) with O(1) membership tests.

**`(2 * overlap) / (ba.size + bb.size)`** — the Dice formula. The `2 *` is what normalises the result to `[0, 1]`: each shared bigram is counted once in each set, so the denominator double-counts the overlap, and the numerator must match.

- Identical strings → all bigrams shared → `2n / 2n = 1`
- No shared bigrams → `0`

**Why Dice rather than Levenshtein distance:** Dice is O(n) with set operations versus O(n·m) for edit distance, it needs no distance-to-similarity conversion, and it's more forgiving of word reordering — `"Beatles, The"` vs `"The Beatles"` scores well under Dice and poorly under edit distance.

---

## `pickBest(data, artist, title)`

```ts
function pickBest(data, artist, title): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  let best = data[0];
  let bestScore = -1;
  for (const item of data) {
    const titleScore = similarity(item.trackName ?? "", title);
    const artistScore = similarity(item.artistName ?? "", artist);
    const score = titleScore * 0.6 + artistScore * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best?.plainLyrics ?? null;
}
```

**`!Array.isArray(data)`** — a genuine runtime type check on foreign data. Unlike the codebase's trusted-localStorage reads, this is a network response that could be anything: an error object, a string, `null`. The guard is warranted.

**`let best = data[0]` with `bestScore = -1`** — seeded with the first item so there's always a result. `-1` guarantees the first loop iteration wins its comparison (scores are `≥ 0`). Note the seeding is belt-and-braces: since every score is `> -1`, `best` is always reassigned on the first iteration anyway.

### The weighting

```ts
const score = titleScore * 0.6 + artistScore * 0.4;
```

**Title weighted 1.5× the artist.** The reasoning: an API search already filtered roughly by artist, so the title is the discriminating field among the returned candidates. Artist still matters — it separates covers from originals — but it's the tiebreaker, not the primary key.

The weights sum to 1.0, so the score stays in `[0, 1]` and is comparable across calls.

**`item.trackName ?? ""`** — the API may omit fields. `similarity` returns `0` for an empty string, so a missing field contributes nothing rather than throwing.

**`if (score > bestScore)` — strict `>`.** On a tie the **earlier** result wins, and since these APIs return results roughly by relevance, that preserves the server's own ranking as the tiebreaker. Same first-wins-on-tie discipline as `QUALITIES` in [`chord-detect.ts`](music/chord-detect.ts.md).

**`best?.plainLyrics ?? null`** — optional chaining plus nullish coalescing. Returns `null` if the best match has no lyrics field, which is a real case: lrclib returns instrumental tracks with `plainLyrics: null`.

**No minimum score threshold.** Even a terrible match (score 0.1) is returned if it's the best available. That's a deliberate choice — the user sees the fetched lyrics in the editor and can reject them — but it means a typo'd search can silently return the wrong song's lyrics.

---

## `fetchLyrics(artist, title)`

Three providers tried in order, each in its own `try`/`catch`.

```ts
const headers = { "User-Agent": "Fretnote/1.0 (https://github.com/fretnote)" };
```

A custom `User-Agent` identifying the client — lrclib's API guidelines request one. Note the URL is a placeholder that doesn't match the real repo (`qwzynx/fretnote`); harmless, but inaccurate.

### The cascade

```ts
// 1. lrclib — artist + title
try {
  const res = await fetch(`https://lrclib.net/api/search?artist_name=…&track_name=…`, { headers });
  if (res.ok) {
    const lyrics = pickBest(await res.json(), artist, title);
    if (lyrics) return lyrics;
  }
} catch { /* fall through */ }

// 2. lrclib — title only (catches artist typos)
// 3. lyrics.ovh fallback
```

**Each attempt has two exit conditions**, and both must pass to return:
- **`if (res.ok)`** — HTTP 2xx. A 404 or 500 falls through *without* throwing, since `fetch` only rejects on network failure, not on error status. Forgetting `res.ok` is one of the most common `fetch` mistakes; it's handled correctly here.
- **`if (lyrics)`** — a non-empty result. An HTTP 200 with an empty array still falls through.

**`catch { /* fall through */ }`** — empty catches, deliberately. A network failure or a JSON parse error on provider 1 shouldn't prevent trying provider 2. The comment on the last one says *"all sources failed"*, marking it as the end of the chain.

**The tradeoff:** all diagnostic information is discarded. If lyrics never load, there's nothing in the console to say whether it was DNS, CORS, a 429 rate-limit, or malformed JSON. A `console.warn` in each catch would cost nothing and help a lot.

### Why three attempts

**1 → 2 (lrclib with artist, then without).** The comment says *"catches artist typos."* If the user typed "Oasis" as "Oassis", the artist-filtered search returns nothing while the title-only search still finds "Wonderwall" — and `pickBest` then re-scores by *both* fields, so the fuzzy match recovers the right result. **The narrower query runs first** so that when the artist is correct, its precision is used; the broader query is the recovery path. Ordering matters.

**2 → 3 (lrclib → lyrics.ovh).** A different provider entirely, with a different catalogue and a different response shape:

```ts
if (data.lyrics) return data.lyrics as string;
```

lyrics.ovh returns `{ lyrics: "..." }` directly — a single result, no array, no scoring. So `pickBest` isn't used and there's no fuzzy matching; the artist and title go straight into the **URL path** rather than a query string, so this provider only works on an exact match.

**No `headers` on the third call** — an inconsistency, presumably because lyrics.ovh doesn't ask for one.

**`return null`** at the end — every source failed. The caller shows "couldn't find lyrics."

---

## Observations

**No caching.** Every request hits the network, even for the same song twice. Contrast the three memoisation layers in [`chords.ts`](music/chords.ts.md). Defensible — this is user-initiated and infrequent — but a repeated fetch of the same title is pure waste.

**No timeout and no `AbortSignal`.** A hung provider stalls the whole cascade indefinitely; there's no way for the UI to cancel. `AbortSignal.timeout(5000)` in the `fetch` options would bound it.

**No rate limiting.** Both APIs are free public services; hammering them is impolite and risks a 429 (which, being a non-`ok` status, silently falls through to the next provider).

**No `Note` involvement.** This module knows nothing about the app's types — it takes two strings and returns a string. That isolation is why it's the easiest file here to test: `fetchLyrics("Oasis", "Wonderwall")` in a REPL.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `.toLowerCase()` **before** the `[^a-z0-9\s]` strip | `normalize` | Reversed, it would delete every capital letter |
| `for (i < s.length - 1)` | `bigrams` | Stop one short — `slice(i, i+2)` needs two chars |
| `if (!na \|\| !nb) return 0` | `similarity` | Empty input; also prevents `0/0 = NaN` |
| `if (na === nb) return 1` | `similarity` | Fast path *and* the 1-char no-bigrams edge case |
| `2 * overlap / (sizeA + sizeB)` | `similarity` | Dice coefficient; the `2×` normalises to [0,1] |
| `if (!Array.isArray(data))` | `pickBest` | Real validation — this is foreign data |
| `titleScore*0.6 + artistScore*0.4` | `pickBest` | Title discriminates; artist breaks ties |
| `if (score > bestScore)` strict | `pickBest` | Ties keep the API's own ranking |
| `if (res.ok)` ×3 | `fetchLyrics` | `fetch` does **not** reject on 4xx/5xx |
| `if (lyrics)` ×3 | `fetchLyrics` | HTTP 200 with no usable result still falls through |
| `catch {}` ×3 | `fetchLyrics` | One provider failing must not stop the cascade |

---

## Related

- [`components/create/CreateNoteForm.svelte`](../components/create/CreateNoteForm.svelte.md) — the "fetch lyrics" button
- [`lib/db.ts`](db.ts.md) — `makeSlug` shares the ASCII-only normalisation limitation
- [`lib/music/chord-detect.ts`](music/chord-detect.ts.md) — the other scored-search in the codebase
