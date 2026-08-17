/**
 * Exercises the reduced back stack in a real browser, driving the actual UI.
 * This machinery (src/lib/nav-stack.svelte.ts) is the most intricate code in
 * the app and had no coverage at all.
 *
 * Everything here goes through clicks and real navigations on purpose:
 * importing the nav module from the test would instantiate a *second* copy
 * with its own private stack, which reports confidently wrong results.
 *
 *   node scripts/check-nav.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const B = process.argv[2] ?? "http://localhost:5199";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

let fails = 0;
async function expect(label, want) {
  await page.waitForTimeout(400);
  const got = (await page.evaluate(() => location.hash)) || "#/";
  const ok = got === want;
  if (!ok) fails++;
  console.log(
    `  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(42)} ${ok ? "" : `want ${want}, got ${got}`}`
  );
}

/** Click a top nav link by its visible text. */
async function clickNav(text) {
  await page.locator(`header a:has-text("${text}")`).first().click();
}

console.log("\nDeep links entered while the app is already open:");
await page.goto(`${B}/#/create`, { waitUntil: "networkidle" });
await expect("start at #/create", "#/create");
await page.goto(`${B}/#/settings`, { waitUntil: "networkidle" });
await expect("hash-nav to #/settings stays put", "#/settings");
await page.goto(`${B}/#/setlists`, { waitUntil: "networkidle" });
await expect("hash-nav to #/setlists stays put", "#/setlists");
await page.goto(`${B}/#/create`, { waitUntil: "networkidle" });
await expect("hash-nav back to #/create stays put", "#/create");

console.log("\nCold deep links:");
for (const r of ["/settings", "/setlists", "/create"]) {
  const p2 = await browser.newPage();
  await p2.goto(`${B}/#${r}`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(400);
  const got = await p2.evaluate(() => location.hash);
  const ok = got === `#${r}`;
  if (!ok) fails++;
  console.log(
    `  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} cold load #${r}`.padEnd(50) +
      (ok ? "" : `got ${got}`)
  );
  await p2.close();
}

console.log("\nIn-app navigation, then browser back:");
await page.goto(B, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

await clickNav("Setlists");
await expect("click Setlists", "#/setlists");
await page.goBack();
await expect("back from Setlists returns home", "#/");

await clickNav("Create");
await expect("click Create", "#/create");
await page.goBack();
await expect("back from Create returns home", "#/");

await clickNav("Setlists");
await expect("click Setlists again", "#/setlists");
await clickNav("Create");
await expect("Setlists -> Create stays one level deep", "#/create");
await page.goBack();
await expect("back from Create still returns home", "#/");

await browser.close();
console.log(
  fails === 0
    ? "\n\x1b[32mNavigation checks passed.\x1b[0m\n"
    : `\n\x1b[31m${fails} navigation check(s) failed.\x1b[0m\n`
);
process.exit(fails ? 1 : 0);
