# `src/lib/db-driver.web.ts`

**Role:** The browser backend — SQLite compiled to WebAssembly (sql.js), held in memory, persisted to OPFS after every write.
**Size:** 63 lines. **Depends on:** `sql.js`, the `sql-wasm.wasm` binary, `./db-driver` (type only).

**Loaded only in the browser.** On desktop, `createDriver()` takes the Tauri branch and this module — plus its ~1.5 MB WASM payload — is never fetched. See [`db-driver.ts`](db-driver.ts.md) for how that split works.

---

## Imports

```ts
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { SqlDriver } from "@/lib/db-driver";
```

**`initSqlJs`** — sql.js's async initialiser. It fetches and instantiates the WebAssembly module and resolves to an `SQL` namespace containing the `Database` class. It's async because WASM instantiation is.

**`type Database as SqlJsDatabase`** — imported as a *type only* and renamed. The rename avoids collision with `FileSystemFileHandle`-era naming and, more usefully, makes it unmistakable at each use site which `Database` is meant (this file also deals with the Tauri plugin's `Database` conceptually). `import type` guarantees the binding is erased at compile time and contributes nothing to the bundle.

**`sql.js/dist/sql-wasm.wasm?url`** — Vite's `?url` suffix. It tells the bundler: don't try to parse this as JavaScript; copy it to the output directory, hash it, and give me back the final URL as a string. Without `?url`, Vite would attempt to process a binary as a module and fail.

**Why this matters:** the WASM file must be served as a separate asset at a known URL, because `initSqlJs` fetches it at runtime. Letting Vite own that URL means it stays correct under a hashed-filename production build and under any `base` path — which is what makes the Vercel deploy work without hand-managed static paths.

**`import type { SqlDriver }`** — the contract this class implements, imported type-only so there's no runtime import back into `db-driver.ts`. That's what keeps the two modules from forming a runtime circular dependency: `db-driver.ts` dynamically imports this file, and this file only refers to `db-driver.ts`'s *types*.

```ts
const DB_FILENAME = "fretnote.db";
```

Matches the desktop filename in `Database.load("sqlite:fretnote.db")`. Same name, entirely different storage: an OS app-data file on desktop, an OPFS entry on web.

---

## `class WebSqlDriver implements SqlDriver`

The explicit `implements` clause (which the Tauri plugin's class does *not* have — it satisfies the interface structurally) makes the compiler verify the two methods match. Worth it here because this class is hand-written and the interface is the only thing keeping the two backends interchangeable.

### Fields and the private constructor

```ts
private flushPromise: Promise<void> | null = null;

private constructor(
  private readonly db: SqlJsDatabase,
  private readonly fileHandle: FileSystemFileHandle
) {}
```

**`private constructor`** — the class cannot be instantiated with `new WebSqlDriver(...)` from outside. The only way in is the static `create()` below.

**Why:** construction requires `await` — the WASM must initialise and the OPFS file must be read before a usable instance exists. Constructors can't be async. The standard workaround is a private constructor plus a static async factory, which makes it *impossible* to hold a half-initialised object. This is the same "make invalid states unrepresentable" instinct as the `SqlDriver` interface returning `unknown`.

**Parameter properties** (`private readonly db: ...` in the parameter list) are TypeScript shorthand: declare the field, assign it from the argument, in one place. The body is empty because that's all the constructor does.

**`readonly`** — neither the database nor the file handle is ever reassigned after construction. Enforced by the compiler.

---

## `static async create()`

```ts
static async create(): Promise<WebSqlDriver> {
  const [SQL, root] = await Promise.all([
    initSqlJs({ locateFile: () => sqlWasmUrl }),
    navigator.storage.getDirectory(),
  ]);
  const fileHandle = await root.getFileHandle(DB_FILENAME, { create: true });
  const bytes = new Uint8Array(await (await fileHandle.getFile()).arrayBuffer());
  const db = bytes.length ? new SQL.Database(bytes) : new SQL.Database();
  return new WebSqlDriver(db, fileHandle);
}
```

### `Promise.all([...])` — the parallelism

Two independent async operations, started together:

1. **`initSqlJs({ locateFile: () => sqlWasmUrl })`** — fetch and instantiate the WASM.
2. **`navigator.storage.getDirectory()`** — get the OPFS root directory handle.

Neither depends on the other, and #1 is a network fetch of over a megabyte. Running them sequentially would add the OPFS latency on top of the download for no reason. `Promise.all` with array destructuring is the idiomatic form; the tuple destructuring `[SQL, root]` keeps the types precise.

**`locateFile`** is sql.js's hook for "where is the .wasm file?" Its default guesses a path relative to the script, which is wrong under a bundler that hashes filenames. Returning Vite's `sqlWasmUrl` hands it the correct, build-time-resolved URL. This one line is the entire integration between sql.js and Vite, and it's the thing most likely to break if the build config changes.

**OPFS** — the Origin Private File System. A real filesystem, private to the origin, backed by the browser's storage. Chosen over IndexedDB because SQLite wants to read and write a byte range of a file, and OPFS gives you file semantics directly. Not shared with the user's downloads folder; not visible in a file manager.

### `root.getFileHandle(DB_FILENAME, { create: true })`

Gets a handle to `fretnote.db`. **`{ create: true }`** means "create it if absent" — so first run and every subsequent run take the same path, with no existence check. The same idempotence instinct as `CREATE TABLE IF NOT EXISTS`.

A brand-new file is zero bytes, which the next line handles.

### `new Uint8Array(await (await fileHandle.getFile()).arrayBuffer())`

Two nested awaits, read inside out:

1. `fileHandle.getFile()` → a `File` object (a snapshot of the contents).
2. `.arrayBuffer()` → the raw bytes as an `ArrayBuffer`.
3. `new Uint8Array(...)` → a typed view, which is what sql.js wants.

**The whole database is read into memory here.** That's the fundamental design of this driver: sql.js has no incremental file I/O in this configuration, so the database is an in-memory structure that gets serialised wholesale on write. Fine for a personal songbook of a few hundred notes (tens to hundreds of KB); it would not scale to a large database, and that's a deliberate accepted limit.

### `bytes.length ? new SQL.Database(bytes) : new SQL.Database()`

**The one conditional in the file, and it's the first-run branch.**

- **`bytes.length > 0`** — an existing database. `new SQL.Database(bytes)` deserialises the SQLite file format from those bytes, restoring every table and row.
- **`bytes.length === 0`** — a file that was just created by `{ create: true }`. `new SQL.Database()` with no argument creates an *empty* database.

**Why the branch is required:** passing a zero-length `Uint8Array` to sql.js is not "an empty database" — it's a malformed SQLite file, and it throws. The two cases genuinely need different constructor calls.

The empty database returned on first run is then populated by `init()` in `db-driver.ts`, which runs its `CREATE TABLE IF NOT EXISTS` statements immediately after. Neither file knows about the other's role; the split is clean.

---

## `execute()`

```ts
async execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
  this.db.run(query, bindValues as never[]);
  await this.scheduleFlush();
  return undefined;
}
```

**`bindValues: unknown[] = []`** — a default parameter, so `execute(sql)` works without a second argument. The interface declares it optional (`bindValues?`); the implementation supplies the default. Cleaner than checking for `undefined` inside.

**`this.db.run(...)`** — sql.js's fire-and-forget statement execution. **Synchronous**, because it's all in-memory WASM with no I/O. The `async` on the method is for the flush, not the query.

**`bindValues as never[]`** — a cast to satisfy sql.js's parameter type (`SqlValue[]`, a union of the types SQLite accepts). `unknown[]` isn't assignable to it. `never[]` is assignable to *any* array type, so it's the minimum-friction escape hatch.

This is a genuine soft spot: it silences the type system entirely. Passing a value SQLite can't bind — an object, a `Date` — compiles fine and fails at runtime. It's accepted because the callers are all in `db.ts`, where the values are hand-written primitives and JSON strings. Worth knowing it's there.

**`await this.scheduleFlush()`** — persist to OPFS. Awaited, so `execute` doesn't resolve until the write has actually landed. That matters: callers in `db.ts` treat a resolved `execute` as "saved," and a UI that navigates away on save would otherwise race the flush.

**`return undefined`** — explicit. The interface says `Promise<unknown>`; the Tauri plugin returns `{ rowsAffected, lastInsertId }`, which sql.js has no cheap equivalent for. Returning `undefined` *deliberately* rather than omitting the return documents the divergence. This is the concrete reason `db.ts` never reads `execute`'s result and `updateNote` runs a separate existence `SELECT` — see [`db.ts`](db.ts.md).

---

## `select<T>()`

```ts
async select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
  const stmt = this.db.prepare(query);
  try {
    stmt.bind(bindValues as never[]);
    const rows: unknown[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows as T;
  } finally {
    stmt.free();
  }
}
```

### `try` / `finally` with **no catch**

This is the notable structural choice. There's no `catch` — errors propagate to the caller untouched, which is correct (a failed query is a real error `db.ts` or the UI should see). The `finally` exists solely for cleanup.

**Why cleanup is mandatory:** `prepare()` allocates a statement object *inside the WebAssembly heap*. JavaScript's garbage collector cannot see or reclaim WASM memory. If `stmt.free()` is skipped, that memory leaks for the lifetime of the page. A query that throws — a typo, a missing column — would leak on every retry.

`finally` guarantees `free()` runs whether the block returns normally or throws. This is the WASM equivalent of RAII, and forgetting it is the classic sql.js bug.

### `while (stmt.step())` — the row loop

**The only loop in the file.** sql.js exposes a cursor API rather than returning an array:

- `stmt.step()` advances to the next row and returns `true`, or returns `false` when exhausted.
- `stmt.getAsObject()` materialises the *current* row as `{ column: value }`.

The `while` condition does double duty: advance and test. The body pushes the materialised row.

**`getAsObject()` and not `get()`:** `get()` returns an array of values positionally. `getAsObject()` returns column-name-keyed objects — which is exactly the shape `db.ts`'s `Row` / `SummaryRow` interfaces describe, and what the Tauri plugin returns. **This one method call is what makes the two backends return identical data.** Using `get()` here would make every mapping function in `db.ts` backend-specific.

**`return rows as T`** — the caller declared the shape via the type parameter (`db.select<Row[]>(...)`), and nothing validates it. Same unchecked trust boundary as the Tauri path, and consistent with it.

Note `return` sits *inside* the `try`. That's fine and intentional: `finally` still runs before the value is handed back.

---

## `scheduleFlush()` — the write-coalescing optimisation

```ts
private scheduleFlush(): Promise<void> {
  if (!this.flushPromise) {
    this.flushPromise = Promise.resolve().then(async () => {
      this.flushPromise = null;
      const writable = await this.fileHandle.createWritable();
      await writable.write(new Uint8Array(this.db.export()));
      await writable.close();
    });
  }
  return this.flushPromise;
}
```

> *"Persisting is a full re-export of the (small) in-memory database to OPFS on every write. Collapsing same-tick calls into one flush keeps back-to-back writes (e.g. a library import upserting many rows) from serializing the whole database once per row."*

### The problem

`this.db.export()` serialises the **entire database** to a byte array. There is no partial write. So a naive `execute` → flush pairing means importing 200 notes performs 200 full serialisations and 200 full OPFS writes — quadratic-ish behaviour that makes import unusably slow.

### The solution: same-tick coalescing

**`if (!this.flushPromise)`** — if a flush is already scheduled but hasn't run, don't schedule another. Just hand back the existing promise. Every caller in the batch awaits the *same* flush.

**`Promise.resolve().then(...)`** — schedules the callback as a **microtask**: it runs after the current synchronous execution completes, but before the browser yields to rendering or timers. So every `execute()` issued in the same synchronous burst — a `for` loop of `upsertNote` calls, say — registers, sees a pending `flushPromise`, and shares it. One serialisation, one write, for the whole batch.

**Why microtask and not `setTimeout(0)`:** a macrotask would let rendering and other events interleave before the data is durable, widening the window where a reload loses writes. A microtask flushes at the earliest possible moment that still allows batching.

### `this.flushPromise = null` **first, inside the callback**

The ordering here is the subtle part, and it's easy to get wrong.

Clearing the field *at the top* of the callback — before any `await` — means that any `execute()` arriving **while this flush is in progress** sees `null` and schedules a *new* flush. That's correct: those writes happened after `export()` was called, so the in-flight write won't contain them. They need their own flush.

If the field were cleared at the *end* instead, a write landing mid-flush would attach to the flush that already snapshotted the database without it — and would be silently lost until some later write happened to trigger another flush. A data-loss bug of exactly the kind the promise-caching comment in `db-driver.ts` warns about, in a different guise.

### The write itself

```ts
const writable = await this.fileHandle.createWritable();
await writable.write(new Uint8Array(this.db.export()));
await writable.close();
```

The OPFS write protocol: open a writable stream, write, close. **`close()` is what commits** — `createWritable()` writes to a swap file, and closing atomically replaces the target. Skipping `close()` means nothing is persisted at all. Awaiting all three is why `execute`'s await of this promise genuinely means "durable."

`this.db.export()` returns a `Uint8Array` already; wrapping it in `new Uint8Array(...)` is defensive normalisation against sql.js's typings.

### The gap this leaves

Two writes in *different* ticks produce two full flushes. That's unavoidable without a debounce, and a debounce would trade durability for throughput. The current design optimises the case that actually hurt (bulk import) and accepts the cost on the case that doesn't (a user saving one note).

---

## `createWebSqlDriver()`

```ts
export function createWebSqlDriver(): Promise<SqlDriver> {
  return WebSqlDriver.create();
}
```

The module's only export. A thin wrapper whose job is to **narrow the return type** from `Promise<WebSqlDriver>` to `Promise<SqlDriver>`.

That widening-to-the-interface is the point: `db-driver.ts` receives something typed only as `SqlDriver`, so it cannot accidentally reach for `scheduleFlush` or any other web-specific member. The class itself stays unexported, so nothing outside this file can name its type.

Note it isn't `async` — it returns the promise directly rather than `await`ing and re-wrapping. Functionally identical, one less microtask.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `Promise.all` | `create` | Fetch WASM and open OPFS in parallel |
| `bytes.length ? ... : ...` | `create` | Existing database vs. first run — a 0-byte buffer would throw |
| `try` / `finally` (no catch) | `select` | Free WASM-heap memory the JS GC can't reclaim |
| `while (stmt.step())` | `select` | Cursor iteration — the only loop in the file |
| `if (!this.flushPromise)` | `scheduleFlush` | Coalesce same-tick writes into one serialisation |
| `flushPromise = null` at callback top | `scheduleFlush` | Ensures writes during a flush get their own flush |

---

## How this compares to the desktop path

| | Tauri (desktop) | sql.js (web) |
|---|---|---|
| SQLite | Native, via Rust | WebAssembly |
| Storage | Real file in app-data dir | OPFS, whole-file rewrite |
| Connections | Pooled | Exactly one |
| `PRAGMA foreign_keys` | Unreliable (pooling) | **Holds** |
| `execute` return | `{ rowsAffected, lastInsertId }` | `undefined` |
| Write cost | Incremental, native | Full serialisation per flush |

The "exactly one connection" row is why `db-driver.ts`'s pragma comment says it *does* hold here. The `execute` return row is why `db.ts` never reads it.

---

## Related

- [`lib/db-driver.ts`](db-driver.ts.md) — the platform branch that lazily imports this, and the schema it applies
- [`lib/db.ts`](db.ts.md) — every caller of `execute`/`select`
- [`config/vite.config.ts`](../config/vite.config.ts.md) — the build that resolves `?url` and emits the WASM asset
