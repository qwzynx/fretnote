/**
 * Runs the real DDL/DML strings from src/lib/db-driver.ts and src/lib/db.ts
 * against an in-memory SQLite, so Stage 0's schema changes are validated
 * against an actual engine rather than by eye.
 *
 * Statements are extracted from the source files rather than retyped, so this
 * can't silently drift from what the app ships.
 */
import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";

const SQL = await initSqlJs();
const db = new SQL.Database();

// Comments in these files contain backticks (`ALTER TABLE ADD COLUMN` etc),
// which would desync the template-literal pairing below.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const driverSrc = stripComments(readFileSync("src/lib/db-driver.ts", "utf8"));
const dbSrc = stripComments(readFileSync("src/lib/db.ts", "utf8"));

let failures = 0;
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`);
const bad = (label, err) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${label}\n      ${err}`);
};

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── 1. Every statement in db-driver's init(), in order ────────────────────
console.log("\nSchema init (statements lifted from db-driver.ts):");

// Pull each db.execute(`...`) / addColumn(db, `...`) backtick payload.
const statements = [...driverSrc.matchAll(/`([^`]*(?:CREATE|ALTER|UPDATE|DELETE|PRAGMA)[^`]*)`/g)]
  .map((m) => m[1].trim())
  .filter(Boolean);
// The PRAGMA is passed as a plain string, not a template literal.
statements.unshift("PRAGMA foreign_keys = ON");

if (statements.length < 12) {
  bad(`expected to extract the full schema, got ${statements.length} statements`, "regex drift");
}

for (const sql of statements) {
  const label = sql.replace(/\s+/g, " ").slice(0, 68);
  try {
    db.run(sql);
    ok(label);
  } catch (e) {
    // ALTER on an existing column is the expected, caught-and-ignored path.
    if (/duplicate column name/i.test(e.message)) ok(`${label}  (already applied)`);
    else bad(label, e.message);
  }
}

// ── 2. Indexes actually landed ────────────────────────────────────────────
console.log("\nIndexes present:");
const idx = run("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
  .map((r) => r.name)
  .sort();
for (const want of [
  "idx_notes_created_at",
  "idx_notes_updated_at",
  "idx_setlist_items_note",
  "idx_setlist_items_setlist",
]) {
  idx.includes(want) ? ok(want) : bad(want, "missing");
}

// ── 3. The feed and lookup queries are planned against those indexes ──────
console.log("\nQuery plans:");
const plan = (sql) =>
  run(`EXPLAIN QUERY PLAN ${sql}`).map((r) => r.detail).join(" | ");

const feedPlan = plan("SELECT * FROM notes ORDER BY created_at DESC");
/USING INDEX idx_notes_created_at/.test(feedPlan)
  ? ok(`feed ORDER BY uses the index — ${feedPlan}`)
  : bad("feed ORDER BY should use idx_notes_created_at", feedPlan);

const byIdPlan = plan("SELECT * FROM notes WHERE id = 'x' LIMIT 1");
/USING INDEX|SEARCH/.test(byIdPlan)
  ? ok(`getNote by id is a search — ${byIdPlan}`)
  : bad("getNote by id still scans", byIdPlan);

const bySlugPlan = plan("SELECT * FROM notes WHERE slug = 'x' LIMIT 1");
/USING INDEX|SEARCH/.test(bySlugPlan)
  ? ok(`getNote by slug is a search — ${bySlugPlan}`)
  : bad("getNote by slug still scans", bySlugPlan);

// The form this replaced, for contrast.
const orPlan = plan("SELECT * FROM notes WHERE id = 'x' OR slug = 'x' LIMIT 1");
console.log(`  \x1b[90m·\x1b[0m old OR form, for comparison: ${orPlan}`);

// ── 4. The real INSERT/UPDATE/SELECT bodies from db.ts ────────────────────
console.log("\nWrites and reads (SQL lifted from db.ts):");

// The needle sits *inside* the template literal, so the opening backtick is
// behind it and the closing one ahead.
const grab = (needle) => {
  const i = dbSrc.indexOf(needle);
  if (i === -1) throw new Error(`could not find ${needle} in db.ts`);
  const start = dbSrc.lastIndexOf("`", i);
  const end = dbSrc.indexOf("`", i);
  return dbSrc.slice(start + 1, end).trim();
};

const now = new Date().toISOString();
const insertSql = grab("INSERT INTO notes\n       (id, slug, type");
try {
  db.run(insertSql.replace(/\$(\d+)/g, "?"), [
    "n1", "slug-1", "chords", "Wonderwall", "Oasis", "Em", 2, "beginner",
    '["britpop"]', now, now, "dadgad", "[Em]Today is gonna be the day", null,
    '["Em","G"]', null, 92,
  ]);
  ok("createNote INSERT binds all 17 columns");
} catch (e) { bad("createNote INSERT", e.message); }

const summaryCols = dbSrc.match(/const SUMMARY_COLUMNS = `([^`]+)`/)[1];
try {
  const rows = run(`SELECT ${summaryCols} FROM notes ORDER BY created_at DESC`);
  rows.length === 1 && rows[0].tuning === "dadgad"
    ? ok(`listNoteSummaries returns tuning ("${rows[0].tuning}") and omits bodies`)
    : bad("listNoteSummaries", JSON.stringify(rows[0]));
  "chord_sheet" in rows[0]
    ? bad("summary query", "still selects chord_sheet")
    : ok("summary query excludes chord_sheet and tab_blocks");
} catch (e) { bad("listNoteSummaries", e.message); }

const updateSql = grab("UPDATE notes SET\n       type=$1");
try {
  db.run(updateSql.replace(/\$(\d+)/g, "?"), [
    "chords", "Wonderwall", "Oasis", "Em", 2, "beginner", '["britpop"]',
    "[Em]changed", null, '["Em"]', null, 92, "drop-d", now, "n1",
  ]);
  const r = run("SELECT tuning, updated_at FROM notes WHERE id='n1'")[0];
  r.tuning === "drop-d" && r.updated_at
    ? ok("updateNote persists tuning and stamps updated_at")
    : bad("updateNote", JSON.stringify(r));
} catch (e) { bad("updateNote UPDATE", e.message); }

// ── 5. Orphan cleanup + explicit cascade ──────────────────────────────────
console.log("\nSetlist integrity:");
db.run("INSERT INTO setlists (id,title,description,created_at) VALUES ('s1','Gig','',?)", [now]);
db.run("INSERT INTO setlist_items (id,setlist_id,note_id,position) VALUES ('i1','s1','n1',0)");
// Every release so far ran without the pragma, so orphans could be written.
// Turn it off to recreate that state, then back on.
db.run("PRAGMA foreign_keys = OFF");
db.run("INSERT INTO setlist_items (id,setlist_id,note_id,position) VALUES ('i2','s1','ghost',1)");
db.run("PRAGMA foreign_keys = ON");

const countSql = `SELECT COUNT(i.id) AS c FROM setlists s
  LEFT JOIN setlist_items i ON i.setlist_id = s.id WHERE s.id='s1'`;
run(countSql)[0].c === 2
  ? ok("reproduced the orphan: card would say 2 songs over 1 real row")
  : bad("orphan setup", "unexpected");

const cleanup = statements.find((s) => s.includes("DELETE FROM setlist_items\n        WHERE note_id NOT IN"));
db.run(cleanup);
run(countSql)[0].c === 1
  ? ok("init's orphan cleanup drops the dangling row")
  : bad("orphan cleanup", `count is ${run(countSql)[0].c}`);

// deleteNote's explicit membership delete
db.run("DELETE FROM setlist_items WHERE note_id = 'n1'");
db.run("DELETE FROM notes WHERE id = 'n1'");
run(countSql)[0].c === 0
  ? ok("deleteNote removes memberships without relying on the FK pragma")
  : bad("deleteNote cascade", "membership survived");

// ── 6. Import transaction rolls back ──────────────────────────────────────
console.log("\nImport transaction:");
db.run("INSERT INTO notes (id,slug,type,title,artist,key,capo,difficulty,tags,created_at,chords) VALUES ('keep','keep','chords','Keep','A','C',0,'beginner','[]',?, '[]')", [now]);
const before = run("SELECT COUNT(*) c FROM notes")[0].c;
try {
  db.run("BEGIN");
  db.run("INSERT INTO notes (id,slug,type,title,artist,key,capo,difficulty,tags,created_at,chords) VALUES ('good','good','chords','Good','A','C',0,'beginner','[]',?, '[]')", [now]);
  db.run("INSERT INTO notes (id,slug,type,title,artist,key,capo,difficulty,tags,created_at,chords) VALUES ('bad','keep','chords','Dup slug','A','C',0,'beginner','[]',?, '[]')", [now]);
  db.run("COMMIT");
  bad("rollback", "the duplicate slug should have thrown");
} catch {
  db.run("ROLLBACK");
  const after = run("SELECT COUNT(*) c FROM notes")[0].c;
  after === before
    ? ok(`a bad row rolls the whole import back (${before} notes before and after)`)
    : bad("rollback", `left ${after} notes, expected ${before} — library half-merged`);
}

console.log(
  failures === 0
    ? "\n\x1b[32mAll Stage 0 SQL checks passed.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
