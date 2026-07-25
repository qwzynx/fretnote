import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { SqlDriver } from "@/lib/db-driver";

const DB_FILENAME = "fretnote.db";

class WebSqlDriver implements SqlDriver {
  private flushPromise: Promise<void> | null = null;

  private constructor(
    private readonly db: SqlJsDatabase,
    private readonly fileHandle: FileSystemFileHandle
  ) {}

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

  async execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
    this.db.run(query, bindValues as never[]);
    await this.scheduleFlush();
    return undefined;
  }

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

  // Persisting is a full re-export of the (small) in-memory database to
  // OPFS on every write. Collapsing same-tick calls into one flush keeps
  // back-to-back writes (e.g. a library import upserting many rows) from
  // serializing the whole database once per row.
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
}

export function createWebSqlDriver(): Promise<SqlDriver> {
  return WebSqlDriver.create();
}
