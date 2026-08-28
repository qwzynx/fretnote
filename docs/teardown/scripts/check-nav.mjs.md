# `scripts/check-nav.mjs`
**Role:** Drives a real browser to test the reduced back stack. **~100 lines.**

> *"Exercises the reduced back stack in a real browser, driving the actual UI. This machinery (`src/lib/nav-stack.svelte.ts`) is **the most intricate code in the app and had no coverage at all**."*

## Why it must be a browser test
> *"Everything here goes through clicks and real navigations **on purpose**: importing the nav module from the test would instantiate a **second copy with its own private stack**, which reports confidently wrong results."*

**The sharpest testing insight in the repo.** [`nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md) holds `stack`, `markerCount`, and `suppressed` as module-level variables — private, singleton, and coupled to the *browser's own* `history` object. Import it into a test and you get a second instance whose state has no relationship to the real one. Assertions would pass against a fiction.

The only honest test is to drive the real app: click links, press back, read `location.hash`. **This is the general rule for module-singleton state coupled to a browser API** — you can only test it through the browser.

## Mechanics
```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome" });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

async function expect(label, want) {
  await page.waitForTimeout(400);
  const got = (await page.evaluate(() => location.hash)) || "#/";
  ...
}
```
**`playwright-core` with `channel: "chrome"`** — uses the installed Chrome rather than downloading a browser. Keeps `node_modules` small; requires Chrome on the machine.

**`page.on("pageerror")`** surfaces uncaught exceptions that would otherwise make an assertion fail for an invisible reason.

**`waitForTimeout(400)` before every assertion** — a fixed sleep rather than a condition wait. Necessary because `history.go()` is asynchronous (the very fact [`nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md)'s `setStack` comment is about) and there's no event to await for "the stack has settled." Fragile on a slow machine, but honest about what it's waiting for.

**`|| "#/"`** — an empty hash is the root.

**`location.hash` is the assertion target** — the one externally observable output of the whole nav system.

## What it covers
The first section is *"Deep links entered while the app is already open"* — driving `page.goto("#/create")` then `#/settings` and asserting the URL **stays put**. That's a direct regression test for the bug `handleNavPop`'s comment describes: *"opening `#/settings` from `#/create` landed you on the feed."* The `hashFor(wouldPopTo) === landed` check is what makes it pass.

**`clickNav(text)`** locates header links by visible text — testing through the UI as a user would.

**Related:** [`lib/nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md), [`lib/overlay-history.svelte.ts`](../lib/overlay-history.svelte.ts.md), [`shoot.mjs`](shoot.mjs.md)
