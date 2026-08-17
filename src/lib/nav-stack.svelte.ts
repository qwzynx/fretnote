/**
 * Reduces the real browser/hardware back stack to a small canonical
 * hierarchy — Note -> (Search | Section) -> Home -> exit — instead of the
 * literal sequence of pages visited. Every internal nav link/redirect must
 * go through `goto`/`openSearch`/`closeSearch`/`toggleSearch` so the real
 * history entries this module owns never drift out of sync with what a
 * hardware back press should do.
 */

import { searchOpenStore } from "@/lib/search-open.svelte";
import { setPopstateFallback } from "@/lib/overlay-history.svelte";

type NavLevel =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: "section"; path: string }
  | { kind: "note"; id: string }
  | { kind: "note-edit"; id: string };

let stack: NavLevel[] = [{ kind: "home" }];
let markerCount = 0;
let suppressed = 0;

function classify(path: string): NavLevel {
  const editMatch = path.match(/^\/notes\/([^/]+)\/edit/);
  if (editMatch) return { kind: "note-edit", id: editMatch[1] };
  const noteMatch = path.match(/^\/notes\/([^/]+)/);
  if (noteMatch) return { kind: "note", id: noteMatch[1] };
  if (path === "/") return { kind: "home" };
  return { kind: "section", path };
}

function hashFor(level: NavLevel): string {
  if (level.kind === "note") return `/notes/${level.id}`;
  if (level.kind === "note-edit") return `/notes/${level.id}/edit`;
  if (level.kind === "section") return level.path;
  return "/";
}

function applyTop() {
  const top = stack[stack.length - 1];
  searchOpenStore.open = top.kind === "search";
  // Inlined, synchronous equivalent of svelte-spa-router's `replace()` — that
  // helper defers its actual `history.replaceState` behind `await tick()`,
  // which would race with the synchronous `pushState`/`go()` calls below
  // (both belong to the same logical stack transition and must land in
  // history in this exact order).
  history.replaceState(history.state, "", `#${hashFor(top)}`);
  window.dispatchEvent(new Event("hashchange"));
}

function setStack(newStack: NavLevel[]) {
  const newMarkers = newStack.length - 1;
  const diff = newMarkers - markerCount;
  stack = newStack;
  if (diff > 0) {
    // Push first, fix up the hash on the freshly-created (now current) entry
    // second — this leaves whatever entry we're leaving untouched.
    for (let i = 0; i < diff; i++) history.pushState({ fretnoteNav: true }, "");
    markerCount = newMarkers;
    applyTop();
  } else if (diff < 0) {
    // `history.go()` is asynchronous — the entry we're collapsing to isn't
    // current yet, so fixing up its hash has to wait until that navigation
    // actually lands (handleNavPop calls applyTop() once the resulting
    // popstate arrives). Fixing it up now would patch the entry we're
    // still leaving, corrupting it for anyone who later backs into it.
    suppressed += 1;
    markerCount = newMarkers;
    history.go(diff);
  } else {
    // Same depth (e.g. swapping which note/section is shown in place).
    applyTop();
  }
}

function isNavClick(e?: MouseEvent): boolean {
  if (!e) return true;
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  return true;
}

/** Navigate to `path`, reconciling the reduced back stack. Pass the click
 * event when called from an `onclick` so modifier-clicks/middle-clicks are
 * left to the browser's native anchor behavior. */
export function goto(path: string, e?: MouseEvent) {
  if (!isNavClick(e)) return;
  e?.preventDefault();

  const level = classify(path);
  const top = stack[stack.length - 1];

  if (level.kind === "home") {
    setStack([{ kind: "home" }]);
  } else if (level.kind === "note-edit") {
    // Editing sits one level above viewing that same note, so Cancel /
    // hardware-back from the edit form lands back on the note, not its
    // grandparent (search/section/home).
    if (top.kind === "note" && top.id === level.id) {
      setStack([...stack, level]);
    } else if (top.kind === "note-edit" && top.id === level.id) {
      setStack([...stack.slice(0, -1), level]);
    } else {
      setStack([...stack, { kind: "note", id: level.id }, level]);
    }
  } else if (level.kind === "note") {
    if (top.kind === "note-edit" && top.id === level.id) {
      // Returning to the view after saving/canceling an edit of this note —
      // drop the edit level, revealing the view level already beneath it.
      setStack(stack.slice(0, -1));
    } else if (top.kind === "note") {
      setStack([...stack.slice(0, -1), level]);
    } else {
      setStack([...stack, level]);
    }
  } else {
    setStack([{ kind: "home" }, level]);
  }
}

export function openSearch() {
  setStack([{ kind: "home" }, { kind: "search" }]);
}

export function closeSearch() {
  setStack([{ kind: "home" }]);
}

export function toggleSearch() {
  const top = stack[stack.length - 1];
  if (top.kind === "search") closeSearch();
  else openSearch();
}

function currentHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function handleNavPop() {
  if (suppressed > 0) {
    suppressed -= 1;
    // The programmatic collapse in `setStack` has now actually landed on
    // its target entry — fix up its hash/overlay state.
    applyTop();
    return;
  }

  // Not every popstate is a back press. Browsers also fire it for any
  // same-document history navigation: the forward button, a hash the user
  // typed or pasted, a deep link followed while the app is already open.
  // Treating those as "pop one level" rewrote the URL back to the level
  // below and silently discarded where the user actually asked to go —
  // opening #/settings from #/create landed you on the feed.
  //
  // The tell is whether the URL we've arrived at is the one a back press
  // would have produced. If it isn't, the navigation came from outside this
  // module and the URL, not the stack, is the source of truth.
  const landed = currentHash();
  const wouldPopTo = stack.length > 1 ? stack[stack.length - 2] : stack[0];

  if (hashFor(wouldPopTo) === landed) {
    if (stack.length > 1) {
      stack = stack.slice(0, -1);
      markerCount -= 1;
    }
    applyTop();
    return;
  }

  // Adopt the URL rather than fighting it. No applyTop() here: that would
  // rewrite the very hash we're adopting.
  seedFromCurrentHash();
  searchOpenStore.open = false;
  window.dispatchEvent(new Event("hashchange"));
}

function seedFromCurrentHash() {
  const level = classify(currentHash());
  stack = level.kind === "home" ? [{ kind: "home" }] : [{ kind: "home" }, level];
  // Deliberately 0, not `stack.length - 1`: we own no pushed markers above
  // the entry we're sitting on. Claiming otherwise would make the next
  // navigation compute a negative diff and `history.go()` backwards out of
  // the app. Erring low only ever costs an extra marker push.
  markerCount = 0;
}

/** Call once, near app start. Returns a cleanup function. */
export function initNavStack(): () => void {
  seedFromCurrentHash();
  setPopstateFallback(handleNavPop);
  return () => setPopstateFallback(null);
}
