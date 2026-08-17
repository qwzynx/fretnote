/**
 * Drives the running dev server in a real browser, seeds a library through
 * the app's own data layer, and screenshots each surface at phone and
 * desktop widths. Used to check design work against what actually renders
 * rather than against the markup.
 *
 *   node scripts/shoot.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:5199";
const OUT = process.argv[3] ?? "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const SONGS = [
  ["Wonderwall", "Oasis", "Em", 2, "beginner", ["britpop", "acoustic"], 87],
  ["Black", "Pearl Jam", "E", 0, "intermediate", ["grunge"], 76],
  ["Hallelujah", "Jeff Buckley", "C", 5, "intermediate", ["ballad"], 60],
  ["Blackbird", "The Beatles", "G", 0, "advanced", ["fingerstyle"], 96],
  ["Creep", "Radiohead", "G", 0, "beginner", ["90s"], 92],
  ["Hotel California", "Eagles", "Bm", 7, "advanced", ["classic"], 74],
  ["Redemption Song", "Bob Marley", "G", 0, "beginner", ["reggae"], 108],
  ["Nothing Else Matters", "Metallica", "Em", 0, "advanced", ["metal"], 68],
  ["Zombie", "The Cranberries", "Em", 0, "beginner", ["90s"], 84],
];

const SHEET = `[Intro]
[Em]  [G]  [D]  [C]

[Verse 1]
Today is [Em]gonna be the day that they're [G]gonna throw it back to you
By [D]now you should've somehow rea[C]lised what you gotta do
I don't be[Em]lieve that any[G]body feels the [D]way I do about you [C]now

[Chorus]
And [C]all the roads we [D]have to walk are [Em]winding
And [C]all the lights that [D]lead us there are [Em]blinding`;

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});
const ctx = await browser.newContext({ colorScheme: "dark" });
const page = await ctx.newPage();

page.on("pageerror", (e) => console.log("  [page error]", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200));
});

await page.goto(BASE, { waitUntil: "networkidle" });

// Seed through the real db module so the schema path is exercised too.
const seeded = await page.evaluate(
  async ([songs, sheet]) => {
    const db = await import("/src/lib/db.ts");
    const existing = await db.listNoteSummaries();
    if (existing.length >= songs.length) return existing.length;
    for (const [title, artist, key, capo, difficulty, tags, bpm] of songs) {
      await db.createNote({
        type: "chords",
        title,
        artist,
        key,
        capo,
        difficulty,
        tags,
        tuning: title === "Blackbird" ? "drop-d" : "standard",
        chordSheet: sheet,
        chords: ["Em", "G", "D", "C", "Am"],
        strummingPattern: ["D", "", "D", "U", "", "U", "D", "U"],
        bpm,
      });
    }
    const all = await db.listNoteSummaries();
    await db.toggleFavorite(all[0].id, true);
    await db.toggleFavorite(all[2].id, true);
    return all.length;
  },
  [SONGS, SHEET]
);
console.log(`seeded library: ${seeded} notes`);

const noteId = await page.evaluate(async () => {
  const db = await import("/src/lib/db.ts");
  return (await db.listNoteSummaries())[0].id;
});

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "phone", width: 390, height: 844 },
];

const ROUTES = [
  ["feed", "/"],
  ["note", `/notes/${noteId}`],
  ["create", "/create"],
  ["setlists", "/setlists"],
  ["settings", "/settings"],
];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const [name, route] of ROUTES) {
    // Hash-only navigation is same-document, so a plain goto would leave the
    // already-mounted page in place showing pre-seed state. Reload each time.
    await page.goto(`${BASE}/#${route}`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    // Let fonts settle and the deferred preview land.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const file = `${OUT}/${vp.name}-${name}.png`;
    await page.screenshot({ path: file });
    console.log(`  ${file}`);
  }
}

await browser.close();
console.log("done");
