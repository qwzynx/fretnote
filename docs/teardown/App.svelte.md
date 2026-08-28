# `src/App.svelte`

**Role:** The root component. Route table, global chrome (header/nav/footer), global keyboard shortcuts, and the two history subsystems' initialisation.
**Size:** 96 lines. **Mounted by:** [`main.ts`](main.ts.md).

---

## The route table

```ts
const routes = {
  "/": FeedPage,
  "/create": CreatePage,
  "/notes/:id/edit": CreatePage,
  "/notes/:id": NotePage,
  "/settings": SettingsPage,
  "/setlists": SetlistsPage,
  "/setlists/:id": SetlistPage,
};
```

Seven routes, six components — **`/create` and `/notes/:id/edit` both render `CreatePage`.** That's the create/edit duality: the same form, with `params.id` deciding whether it loads an existing note. See [`CreatePage.svelte`](pages/CreatePage.svelte.md).

**`svelte-spa-router`** matches in object-key order, and **`/notes/:id/edit` is listed before `/notes/:id`**. That ordering is load-bearing: `:id` is a single-segment wildcard, so a naive matcher could take `/notes/abc/edit` for the note route with `id = "abc"`. Most-specific-first, the same rule as `classify()` in [`nav-stack.svelte.ts`](lib/nav-stack.svelte.ts.md) and the phase ordering in [`parse.ts`](lib/music/parse.ts.md).

**Hash-based routing** (`#/notes/abc`) rather than the History API — necessary for a `file://`-served Tauri webview, where path-based routing has no server to rewrite URLs. It's also what makes the same-hash `pushState` trick in [`overlay-history.svelte.ts`](lib/overlay-history.svelte.ts.md) work.

**No 404 route.** An unmatched hash renders nothing inside `<Router>` — the chrome stays but the content area is blank. `nav-stack`'s `classify()` would treat it as a `section`.

---

## `shortcutsOpen`

```ts
let shortcutsOpen = $state(false);
```

**The one piece of local component state in the whole file.** Everything else is delegated to module stores — `searchOpenStore` for the palette, `nav-stack` for routing. The shortcuts sheet is purely local because nothing else needs to open it.

---

## `isTyping(e)`

```ts
function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  return el.matches("input, textarea, select, [contenteditable]");
}
```

**The guard that stops single-key shortcuts from firing while the user types.** Without it, typing "?" into the lyrics field would open the shortcuts sheet, and every text input would be sabotaged by any single-letter binding.

**`Element.matches(selector)`** tests the element against a CSS selector — a compact way to express "is this a text-entry control" without four `tagName` comparisons.

**`[contenteditable]`** — an attribute selector, so it matches `contenteditable="true"` *and* the bare `contenteditable`. It matches `contenteditable="false"` too, which is technically wrong but unreachable here.

**The cast `as HTMLElement`** — `e.target` is typed `EventTarget | null`. Unchecked, and would throw if the target were a non-element (`document`, `window`). In practice keyboard events on a page always target an element.

**Note it doesn't check `disabled` or `readonly` inputs** — typing is blocked there anyway, but a shortcut still won't fire on a focused readonly field. Harmless.

---

## `handleGlobalKey(e)` — the shortcut dispatcher

The **order of checks is the design**, and it splits into two tiers.

### Tier 1 — modifier shortcuts, which work everywhere

```ts
const ctrl = e.ctrlKey || e.metaKey;

if (ctrl && e.key === "n") { e.preventDefault(); goto("/create"); return; }
if (ctrl && e.key === "k") { e.preventDefault(); toggleSearch(); return; }
```

**`e.ctrlKey || e.metaKey`** — one variable covering Ctrl on Windows/Linux and ⌘ on macOS. The standard cross-platform normalisation, and it means the app doesn't need to detect the OS.

**These are checked *before* `isTyping`**, deliberately. Ctrl+K should open search even from inside the lyrics textarea — a modifier combination is unambiguous and can't be confused with typing. That's why the `isTyping` guard sits between the tiers rather than at the top.

**`e.preventDefault()`** — Ctrl+N is "new window" in most browsers and Ctrl+K is "focus address bar" or "search"; both must be suppressed. Note this has no effect in some browsers where the shortcut is reserved at the chrome level, which is a known limitation of web keybindings.

**`goto("/create")` with no event argument** — `isNavClick(undefined)` returns `true`, so a programmatic navigation always proceeds. See [`nav-stack.svelte.ts`](lib/nav-stack.svelte.ts.md).

**Each branch `return`s** rather than using `else if`. Flatter, and it makes the "handled, stop here" intent explicit.

### The gate

```ts
if (isTyping(e)) return;
```

**Everything below this line is a bare-key shortcut** and must not fire while typing. Placing the gate here rather than at the top of the function is what gives the two tiers different behaviour.

### Tier 2 — bare keys

```ts
if (e.key === "?") { shortcutsOpen = true; return; }

if (e.key === "Escape") {
  // Close the topmost sheet/dialog/popover if one is open; otherwise
  // fall through to normal browser back navigation.
  if (!closeTopLayer()) window.history.back();
}
```

**`"?"` opens the shortcuts sheet** — the near-universal convention. Note `e.key` reports the *produced character*, so this correctly requires Shift+/ on a US layout without the code having to know about layouts.

**It only ever sets `true`**, never toggles. Pressing `?` twice does nothing the second time; the sheet is closed by its own control or by Escape.

### The Escape branch — the interesting one

```ts
if (!closeTopLayer()) window.history.back();
```

**This is why [`closeTopLayer()`](lib/overlay-history.svelte.ts.md) returns a boolean.** One call answers "is an overlay open?" and performs the close, and the boolean decides whether Escape is consumed:

- **An overlay was open** → it closed, Escape is done.
- **Nothing was open** → Escape means "go back," matching the Android hardware button's behaviour.

Making Escape and hardware-back behave identically is the point — the whole [`nav-stack`](lib/nav-stack.svelte.ts.md)/[`overlay-history`](lib/overlay-history.svelte.ts.md) system exists to give "back" a single coherent meaning, and this line routes the desktop key into it.

**`window.history.back()`, not a `nav-stack` function** — deliberate. It fires a real `popstate`, which flows into `overlay-history`'s single listener and then to `nav-stack`'s `handleNavPop` fallback. Calling a nav-stack function directly would bypass that pipeline and desynchronise `markerCount`. Escape is routed through the *same* channel as a hardware back press, which is exactly what makes them equivalent.

**No `return` on this branch** — it's the last statement, so it doesn't matter, but it breaks the pattern of the ones above.

**Note `shortcutsOpen` is not managed by `historyLayer`** — so pressing Escape with the shortcuts sheet open calls `closeTopLayer()`, which returns `false` (no registered layer), and navigates back instead of closing the sheet. Worth verifying in the running app; `KeyboardShortcutsHelp` may handle Escape itself.

---

## `onMount` — wiring the subsystems

```ts
onMount(() => {
  window.addEventListener("keydown", handleGlobalKey);
  const cleanupOverlayHistory = initOverlayHistory();
  const cleanupNavStack = initNavStack();
  return () => {
    window.removeEventListener("keydown", handleGlobalKey);
    cleanupOverlayHistory();
    cleanupNavStack();
  };
});
```

**Three setups, three teardowns, symmetric.** The returned function is Svelte's unmount cleanup.

**The order matters on the way in:** `initOverlayHistory()` installs the single `popstate` listener and *creates the fallback slot*; `initNavStack()` then registers into it via `setPopstateFallback`. Reversing them would register a fallback on a module whose listener doesn't exist yet — which happens to still work (the slot is just a variable), but the current order matches the dependency direction.

**Both init functions return their own cleanup**, so this component doesn't need to know how either unwinds. A clean contract, and the reason both files end with `return () => ...`.

**`window`, not the root div** — global shortcuts must fire regardless of focus, including when focus is on `document.body`.

**No `capture: true`** — the listener is in the bubble phase, so a component that calls `stopPropagation()` on a keydown can suppress global shortcuts locally. Probably intentional; it lets a modal own the keyboard.

---

## The template

```svelte
<div class="flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
  <SiteHeader />
  <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-navbar md:pb-0">
    <SectionSwipe>
      <Router {routes} />
    </SectionSwipe>
    <SiteFooter />
  </div>
  <BottomNav />
  <Toaster theme="dark" richColors position={isPhone.current ? "top-center" : "bottom-right"} />
  <SearchPalette />
  <KeyboardShortcutsHelp open={shortcutsOpen} onclose={() => (shortcutsOpen = false)} />
</div>
```

### The app-shell layout

**`h-dvh`** — dynamic viewport height. On mobile, `100vh` is the height *without* the browser's collapsible chrome, so a `100vh` layout is taller than the visible area and the bottom nav sits below the fold. `dvh` tracks the actual visible height as the URL bar shows and hides. Using `dvh` rather than `vh` is one of the small things that makes this feel like an app rather than a page.

**`flex flex-col` + `overflow-hidden`** on the root — the shell never scrolls. Header and bottom nav are fixed by the flex layout; only the middle scrolls.

**`min-h-0 flex-1`** on the scroll container — **`min-h-0` is essential and non-obvious.** A flex item's default `min-height: auto` refuses to shrink below its content's size, so the container would grow to fit the content and push the bottom nav off-screen instead of scrolling. `min-h-0` allows the shrink that makes `overflow-y-auto` actually engage. This is the single most common flexbox-scrolling bug, and it's handled correctly here.

**`overscroll-contain`** — stops a scroll that reaches the end of this container from chaining to the page behind it (which is what produces the rubber-band-the-whole-app effect on iOS). Paired with `overscroll-behavior-y: none` on `body` in [`globals.css`](app/globals.css.md).

**`overflow-x-hidden`** — prevents horizontal scroll from a wide child (a tab block, a chip row). Those get their own `overflow-x-auto` containers instead.

```svelte
<!-- Padded on phones so content can always scroll clear of the floating nav. -->
class="… pb-navbar md:pb-0"
```

**`pb-navbar`** is a custom spacing token from `globals.css`: `calc(4.75rem + env(safe-area-inset-bottom, 0px))`. The bottom nav floats over the content, so without this padding the last card would sit permanently underneath it. **`md:pb-0`** removes it on desktop, where the bottom nav isn't rendered.

The `env(safe-area-inset-bottom)` term handles the iPhone home indicator and Android gesture bar — the padding grows on devices that need it and is `0px` elsewhere.

### Component placement

**`<SiteFooter />` is *inside* the scrolling container**, while `<SiteHeader />` and `<BottomNav />` are outside. So the footer scrolls away with the content and the other two are pinned. A deliberate three-way split.

**`<SectionSwipe>` wraps `<Router>`** — the swipe carousel must contain the routed content in order to translate it during a gesture. See [`SectionSwipe.svelte`](components/layout/SectionSwipe.svelte.md).

**The last three components are siblings of the layout**, not inside the scroll container — they're overlays that must position against the viewport, not against scrolled content.

**`<SearchPalette />` takes no props.** It reads `searchOpenStore` directly, which is exactly why that store exists — see [`search-open.svelte.ts`](lib/search-open.svelte.ts.md).

**`<KeyboardShortcutsHelp>` does take props** (`open` / `onclose`), because its state is local to this component. The contrast between the two is a clean illustration of when to reach for a store: `SearchPalette` is opened from three places, `KeyboardShortcutsHelp` from one.

**`onclose={() => (shortcutsOpen = false)}`** — a callback prop, Svelte 5's replacement for `createEventDispatcher`. The parens around the assignment make it an expression body.

### The `Toaster`

```svelte
<Toaster theme="dark" richColors position={isPhone.current ? "top-center" : "bottom-right"} />
```

**`isPhone.current` is the reason [`media.svelte.ts`](lib/media.svelte.ts.md) exists.** `position` is a *prop*, not a class — CSS media queries can't set it. This is precisely the "layout that can't be expressed in CSS alone" case that file's comment describes.

**`.current`, not `isPhone`** — the bare store object is always truthy. The footgun that file warns about.

**`top-center` on phones** because the bottom is occupied by the floating nav; `bottom-right` on desktop, the conventional position.

**`theme="dark"` is hardcoded** — consistent with `globals.css`'s comment that *"Fretnote ships dark only."*

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `/notes/:id/edit` before `/notes/:id` | routes | Most-specific-first; `:id` would otherwise swallow it |
| `ctrl = e.ctrlKey \|\| e.metaKey` | `handleGlobalKey` | One check for Ctrl and ⌘ |
| modifier keys **before** `isTyping` | `handleGlobalKey` | Ctrl+K must work inside a textarea |
| `if (isTyping(e)) return` | `handleGlobalKey` | The gate splitting the two shortcut tiers |
| `el.matches("input, textarea, …")` | `isTyping` | One selector instead of four tag comparisons |
| `if (!closeTopLayer()) history.back()` | Escape | The boolean return decides whether Escape is consumed |
| `window.history.back()`, not a nav call | Escape | Routes through the same popstate pipeline as hardware back |
| `return` from each init | `onMount` | Symmetric setup/teardown; each module owns its own unwind |
| `h-dvh` | root | Mobile browser chrome makes `100vh` too tall |
| `min-h-0 flex-1` | scroll container | Without `min-h-0` a flex item won't shrink and won't scroll |
| `pb-navbar md:pb-0` | scroll container | Clear the floating nav on phones, plus safe-area inset |
| `isPhone.current ? … : …` | `Toaster` | A prop, which CSS cannot set |

---

## Related

- [`main.ts`](main.ts.md) — mounts this
- [`lib/nav-stack.svelte.ts`](lib/nav-stack.svelte.ts.md) — `goto`, `toggleSearch`, `initNavStack`
- [`lib/overlay-history.svelte.ts`](lib/overlay-history.svelte.ts.md) — `initOverlayHistory`, `closeTopLayer`
- [`lib/media.svelte.ts`](lib/media.svelte.ts.md) — `isPhone`
- [`app/globals.css`](app/globals.css.md) — `pb-navbar`, the dark palette, `overscroll-behavior`
- [`components/layout/SectionSwipe.svelte`](components/layout/SectionSwipe.svelte.md) — wraps the router
