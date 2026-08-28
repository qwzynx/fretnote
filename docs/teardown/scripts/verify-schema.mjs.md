# `scripts/verify-schema.mjs`
**Role:** Runs the app's real SQL against an in-memory SQLite to prove the schema works. **~250 lines.**

> *"Runs the real DDL/DML strings from `src/lib/db-driver.ts` and `src/lib/db.ts` against an in-memory SQLite… **Statements are extracted from the source files rather than retyped, so this can't silently drift from what the app ships.**"*

## The core idea
**It reads the TypeScript source as text and regex-extracts the SQL:**
```js
const statements = [...driverSrc.matchAll(/`([^`]*(?:CREATE|ALTER|UPDATE|DELETE|PRAGMA)[^`]*)`/g)]
  .map(m => m[1].trim()).filter(Boolean);
statements.unshift("PRAGMA foreign_keys = ON");
```
**A test that reads its subject's source rather than importing it.** Importing `db-driver.ts` would drag in the Tauri branch and the whole module graph; retyping the SQL would let the test pass while the app is broken. Extraction gets the real strings with no runtime.

**`sql.js` is the engine** — the same WASM SQLite the browser build uses, so the DDL is validated against a genuine query planner.

## The two guards that make the regex safe
```js
// Comments in these files contain backticks (`ALTER TABLE ADD COLUMN` etc),
// which would desync the template-literal pairing below.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
```
**A real hazard, correctly anticipated.** [`db-driver.ts`](../lib/db-driver.ts.md)'s comment *"`ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`"* contains backticks — leaving it in would pair the wrong delimiters and extract garbage. Block comments first, then line comments.

```js
if (statements.length < 12) bad(`expected to extract the full schema, got ${statements.length}`, "regex drift");
```
**A canary against its own extraction breaking.** If someone reformats the SQL and the regex stops matching, the script would otherwise report "0 failures" over 0 statements — a green test proving nothing. **A test that verifies it actually tested something.**

```js
statements.unshift("PRAGMA foreign_keys = ON");
// The PRAGMA is passed as a plain string, not a template literal.
```
The one statement the backtick regex can't see, added manually and labelled.

## What it exercises
Running the extracted statements in order verifies: the `CREATE TABLE`s parse, the five `ALTER TABLE ADD COLUMN` migrations apply, the `updated_at` backfill runs, the four indexes create, and the orphan-purge `DELETE` is valid SQL — **the entire `init()` sequence from [`db-driver.ts`](../lib/db-driver.ts.md), in order, against a real engine.**

Later sections bind the CRUD statements from [`db.ts`](../lib/db.ts.md), which catches placeholder-count mismatches — exactly the off-by-one hazard in `updateNote`'s 15-element parameter array.

**ANSI colour output (`\x1b[32m✓`) and a `failures` counter** — a hand-rolled test harness, no framework.

**Related:** [`lib/db-driver.ts`](../lib/db-driver.ts.md), [`lib/db.ts`](../lib/db.ts.md), [`check-nav.mjs`](check-nav.mjs.md)
