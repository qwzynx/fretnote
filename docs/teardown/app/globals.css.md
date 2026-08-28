# `src/app/globals.css`

**Role:** The entire design system — fonts, palette, elevation, motion, type scale, custom utilities, and base element styles.
**Size:** 336 lines. **Imported by:** [`main.ts`](../main.ts.md), line 1.

Tailwind **v4**, which is configured in CSS rather than in a `tailwind.config.js`. There is no JS config file in this project; this file *is* the configuration.

---

## `@import "tailwindcss"`

One line replacing v3's `@tailwind base; @tailwind components; @tailwind utilities;`. It pulls in the reset, the utility engine, and the default theme, which the `@theme` blocks below then override.

---

## Fonts — self-hosted, and why

> *"These used to come from the Google Fonts CDN via an `@import` inside an inline `<style>`, which is the worst of every world for this app: it is render-blocking, it cannot be preloaded, and Fretnote is an offline-first desktop and Android app, so **with no network the typeface silently fell back to system-ui and the whole UI changed shape**. It also contradicted the app's own promise never to talk to a server."*

**Four counts against the CDN**, and the third is the one that matters: an offline-first app whose typography depends on a network request isn't offline-first. The fourth is a values argument — the README's privacy claim was literally false while the app fetched fonts from Google on every launch.

### The four `@font-face` blocks

Two families × two unicode subsets.

```css
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/fonts/inter-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, …;
}
```

**`font-weight: 300 700` — a *range*, not a value.** This declares a **variable font**: one file covering every weight from 300 to 700 continuously. So `font-medium` (500) and `font-semibold` (600) both resolve from the same download. The alternative — a separate file per weight — would be four or five requests for the same coverage.

**`font-display: swap`** — render immediately in the fallback face, then swap when the font loads. Avoids the "flash of invisible text." Since these are local files the window is tiny, but `swap` costs nothing.

**`unicode-range` is the subsetting mechanism**, and it's the reason there are two files per family. The browser parses the ranges and **only downloads a file if the page actually contains a character in its range**. A user writing English chord sheets downloads `inter-latin.woff2` and never fetches `inter-latin-ext.woff2`; someone with an accented artist name gets both.

The `latin` range is ASCII plus common punctuation and a few symbols (note `U+2191`/`U+2193` — the ↑/↓ arrows used by [`strumming.ts`](../lib/strumming.ts.md)'s `STROKE_DISPLAY`, deliberately in the base subset so the strum grid never triggers an extra download). The `latin-ext` range covers accented Latin, currency symbols, and phonetic characters.

**Two families, two roles:** Inter for UI text, JetBrains Mono for anything column-aligned — tabs, chord grids, fret numbers. Monospace isn't decorative there; the alignment depends on it, exactly as it does in the PDF exporter ([`export.ts`](../lib/export.ts.md)).

**JetBrains Mono's range is `400 500`** — narrower, because monospace text here is never bold-heavy.

---

## `@custom-variant dark (&:is(.dark *))`

Registers `dark:` as a variant that matches inside a `.dark` ancestor. Tailwind v4's replacement for v3's `darkMode: 'class'` config.

**Effectively unused**, since the app ships dark-only and `:root` already carries the dark palette. It's kept so a `dark:` utility written anywhere still compiles rather than being dropped.

---

## The palette

> *"Fretnote ships dark only. There is no light palette here because there was never a light *design*: the old `:root` block was untouched shadcn grey whose `--primary` was near-black rather than amber, so switching to it would have discarded the app's identity, not just its brightness."*

**An honest statement of scope.** The scaffold shipped with a light theme that was never designed — inheriting shadcn's defaults meant a light mode with a black accent instead of the app's amber. Rather than ship a broken alternative, it was removed.

```css
:root, .dark { … }
```

**Both selectors get the same values**, so the dark palette applies whether or not `.dark` is present. Nothing to toggle.

### OKLCH throughout

```css
--background: oklch(0.155 0.006 60);
```

Every colour is `oklch(L C H)` — **lightness** (0–1), **chroma** (saturation), **hue** (degrees). Not hex, not HSL.

**Why it matters here:** OKLCH is *perceptually uniform*. Two colours with the same `L` look equally bright to the eye, which HSL emphatically does not deliver (HSL yellow at 50% lightness looks far brighter than HSL blue at 50%). On a dark UI where surfaces must step up in even, believable increments, that uniformity is the difference between a palette that reads as layered and one that reads as arbitrary.

It also makes the values *legible*: you can read the four surface tokens and see the ramp.

### The four-step surface ramp

```css
--background: oklch(0.155 0.006 60);  /* app ground */
--surface-1:  oklch(0.192 0.007 60);  /* cards, sticky bars */
--surface-2:  oklch(0.232 0.008 62);  /* popovers, dialogs, dropdowns */
--surface-3:  oklch(0.275 0.009 62);  /* inset wells, hovered rows */
```

> *"Surfaces climb in four steps rather than the previous three, which is what lets a popover read as floating above a card instead of sitting flush against it."*

**Lightness steps: 0.155 → 0.192 → 0.232 → 0.275.** Roughly +0.04 each — even, by design, and only readable as even *because* of OKLCH.

**Chroma also climbs** (0.006 → 0.009) — higher surfaces are very slightly warmer. Physically motivated: light sources warm the surfaces nearest them. Subtle enough to be invisible as colour and present enough to be felt as depth.

**Hue drifts 60 → 62** across the ramp. A tiny warming, consistent with the same idea.

**Each token is annotated with its role**, which turns the ramp into an actual system: a component author picks the *level* (`popover`) rather than a colour, and the numbers stay in one place. The bug the comment describes — a popover flush against a card — is what happens when two components at different depths share a surface value.

### Semantic aliases

```css
--card: var(--surface-1);
--popover: var(--surface-2);
--secondary: var(--surface-3);
--muted: var(--surface-2);
```

**Two naming layers.** `--surface-N` is the *physical* ramp; `--card`/`--popover` are *semantic* names pointing into it. Components use the semantic names, so re-mapping a role (cards move to surface-2) is a one-line change here rather than a find-and-replace across forty files.

The same idea as `--foreground` / `--muted-foreground` / `--subtle-foreground` — three text levels, each defined by intent:

```css
--foreground:        oklch(0.965 0.006 80);
--muted-foreground:  oklch(0.715 0.018 70);
/* For text that must recede further than muted without vanishing. */
--subtle-foreground: oklch(0.58 0.014 68);
```

**`--subtle-foreground` exists because two levels weren't enough** — the comment names the exact need. Note chroma *rises* as lightness falls (0.006 → 0.018 → 0.014): dimmed text stays slightly warm rather than going flat grey, which keeps it feeling like part of the palette instead of disabled.

### The accent

```css
--primary: oklch(0.78 0.16 68);            /* amber */
--primary-foreground: oklch(0.2 0.02 60);  /* near-black, for text on amber */
```

Hue 68 is amber/gold. It's the app's identity — the thing the comment says a light theme would have destroyed. **`--primary-foreground` is dark**, because amber at L=0.78 is bright enough that white text on it would fail contrast.

### Status colours, and two bug fixes recorded in comments

```css
/* Status. `destructive-foreground` was used by the swipe-tray Delete
   button but never defined, so that label had no computed colour. */
--destructive: oklch(0.58 0.2 25);
--destructive-foreground: oklch(0.98 0.01 25);
```

**A real bug preserved.** A component referenced `--destructive-foreground`, the variable didn't exist, and `var()` with no fallback resolves to nothing — so the Delete label inherited whatever was above it. Silent, and exactly the failure mode CSS variables have.

```css
/* Favourites: previously hardcoded rose-500 in three files, while the
   swipe tray used a different amber that clashed with --primary. */
--favorite: oklch(0.7 0.19 15);
```

**The token exists because the value was duplicated and had drifted.** Three files hardcoded rose-500; a fourth used an amber that fought the primary accent. One token, one colour, one place to change it. This is the clearest example in the file of *why* a design system is a system.

Note each status colour has a matching `-foreground` for text drawn on it, and the hue is carried through (`--success` hue 155, `--success-foreground` hue 155) so the pairing stays harmonious.

### Borders and the scrim

```css
--border:        oklch(1 0 0 / 10%);
--border-strong: oklch(1 0 0 / 18%);
--input:         oklch(1 0 0 / 13%);
--scrim:         oklch(0.08 0.004 60 / 68%);
```

**`oklch(1 0 0 / 10%)` is white at 10% alpha** — a *translucent* border rather than a solid grey. On a dark UI that's the right choice: the border lightens whatever surface it sits on, so one token works over `--background`, `--surface-1`, and `--surface-2` alike. A solid grey would look wrong on at least two of the three.

```css
/* One scrim value, instead of four copies of bg-black/60. */
--scrim: oklch(0.08 0.004 60 / 68%);
```

Another de-duplication, and note it isn't pure black — it carries the palette's hue 60, so the dimmed backdrop stays warm rather than going neutral.

---

## Elevation

> *"On a dark ground a shadow alone barely reads, so each level pairs a cast shadow with a hairline top highlight. Levels map to intent, not to size: raised = sits on the page, overlay = floats over it, popover = detached."*

```css
--shadow-raised:  0 1px 2px oklch(0 0 0 / 30%),
                  0 1px 0 oklch(1 0 0 / 4%) inset;
--shadow-overlay: 0 4px 12px -2px oklch(0 0 0 / 45%),
                  0 2px 4px -2px oklch(0 0 0 / 35%),
                  0 1px 0 oklch(1 0 0 / 5%) inset;
--shadow-popover: 0 12px 32px -8px oklch(0 0 0 / 60%),
                  0 4px 8px -4px oklch(0 0 0 / 40%),
                  0 1px 0 oklch(1 0 0 / 6%) inset;
--shadow-sheet:   0 -8px 40px -8px oklch(0 0 0 / 65%),
                  0 1px 0 oklch(1 0 0 / 6%) inset;
```

**The `inset` highlight is the key technique**, and the comment explains it: a black shadow on a near-black background is nearly invisible. So each level also draws a **1px white inset line along the top edge** — simulating light catching the raised edge. That highlight is what actually communicates elevation here; the cast shadow mostly grounds it.

**The highlight strengthens with elevation** (4% → 5% → 6%), consistent with a higher surface catching more light.

**Two-shadow stacking** at higher levels — a large soft one for ambient occlusion plus a tight one for contact. The negative spread (`-2px`, `-8px`) pulls the blur inward so it doesn't halo.

**`--shadow-sheet` has a *negative* Y offset** (`0 -8px`) — it casts *upward*, because a bottom sheet slides up from the bottom edge and its shadow must fall on the content above it. The only upward shadow in the set, and it's correct.

**"Levels map to intent, not to size"** — the naming enforces it. A component author picks `shadow-popover` because the thing is detached, not because they want a 32px blur. Same discipline as the surface ramp.

---

## Motion

```css
/* Durations and easings were scattered magic numbers across five files.
   `--ease-settle` is the curve the phone section-swipe already used and
   is by some distance the nicest in the app; it is now the default for
   anything that comes to rest. */
--ease-settle: cubic-bezier(0.22, 1, 0.36, 1);
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:     cubic-bezier(0.4, 0, 1, 1);
--duration-instant: 90ms;
--duration-fast:    150ms;
--duration-normal:  220ms;
--duration-slow:    280ms;
```

**Another consolidation**, with an honest origin story: the best curve in the app was found in one component and promoted to the default rather than being designed from scratch.

**`ease-settle` and `ease-out` both end at a control point of `(x, 1)`** with a very high initial Y — they decelerate hard, arriving gently. That's the "settling into place" feel. **`ease-in`** is the mirror, accelerating away — used for departures, exactly as [`drag-dismiss.ts`](../lib/actions/drag-dismiss.ts.md) pairs `ease-in` for dismissal with `ease-out` for spring-back.

**Four durations on a rough ×1.5 ramp** (90/150/220/280), named by feel rather than by number.

**Note the gesture actions in `lib/actions/` still hardcode `160ms` and `200ms`** rather than using these tokens — they're set from JavaScript, where the CSS variables aren't in scope without a `getComputedStyle` read. A small unresolved seam.

---

## `@theme inline` — exposing tokens to Tailwind

```css
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  …
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-xl: calc(var(--radius) * 1.4);
  --text-3xs: 0.625rem;
}
```

**This block is what turns the variables above into utility classes.** Tailwind v4 generates utilities from specially-namespaced theme variables:

| Declared | Generates |
|---|---|
| `--color-primary` | `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, … |
| `--radius-xl` | `rounded-xl` |
| `--font-sans` | `font-sans` |
| `--text-3xs` | `text-3xs` |
| `--shadow-popover` | `shadow-popover` |
| `--ease-settle` | `ease-settle` |
| `--duration-fast` | `duration-fast` |

**The two-block structure is the point.** `:root` holds the *values*; `@theme inline` holds the *utility registrations* pointing at them. `inline` means Tailwind emits `var(--primary)` rather than baking the literal colour into every utility — so the variable stays live and could be overridden at runtime by a parent scope.

**The near-total duplication is unavoidable**, not sloppiness: Tailwind only generates utilities for names in its namespaces, while components also read the raw `var(--foo)` names directly. Both spellings have to exist.

### The radius scale

```css
--radius: 0.625rem;
--radius-sm:  calc(var(--radius) * 0.6);  /* 0.375rem — chips, kbd */
--radius-md:  calc(var(--radius) * 0.8);  /* 0.5rem   — icon buttons */
--radius-lg:  var(--radius);              /* 0.625rem — inputs, buttons */
--radius-xl:  calc(var(--radius) * 1.4);  /* 0.875rem — cards */
--radius-2xl: calc(var(--radius) * 1.8);  /* 1.125rem — sheets, hero */
```

**Every step derived from one base via `calc()`.** Change `--radius` and the whole scale rescales proportionally — the entire app gets rounder or squarer from one number. Hardcoding five values would let them drift.

**Each is annotated with what uses it**, again turning a scale into a system.

### The type-scale bug

```css
/* Type scale. `--text-2xs` used to be 0.8rem — *larger* than Tailwind's
   `text-xs` at 0.75rem — so the names lied about the order. The ramp below
   is monotonic: 3xs < 2xs < xs < sm. */
--text-3xs: 0.625rem;  /* 10px — kbd, fingering numerals */
--text-2xs: 0.6875rem; /* 11px — dense desktop chrome */
```

**A naming bug, and a genuinely nasty one.** `text-2xs` was *bigger* than `text-xs`, so a developer reaching for "smaller than xs" got something larger. The kind of thing you don't notice until you're debugging a layout that makes no sense.

Only two custom sizes are needed; `xs` and up come from Tailwind's defaults.

---

## `@theme` (non-inline) — computed spacing

```css
@theme {
  --spacing-safe-b: env(safe-area-inset-bottom, 0px);
  --spacing-safe-t: env(safe-area-inset-top, 0px);
  --spacing-navbar: calc(4.75rem + env(safe-area-inset-bottom, 0px));
  --spacing-fretboard: 9.5rem;
}
```

**A separate block without `inline`**, because these are self-contained values rather than pointers into `:root`.

**`env(safe-area-inset-*)`** — the device's own reported unsafe regions: the iPhone notch and home indicator, the Android gesture bar. The `, 0px` fallback means everything else gets zero.

**`--spacing-navbar`** is the token [`App.svelte`](../App.svelte.md)'s `pb-navbar` uses: the nav's own height *plus* the device inset, so content clears the nav on every device with one class.

```css
/* The fretboard diagram width, previously written as both `w-[152px]` and
   `w-[8.5rem]` across four files. */
--spacing-fretboard: 9.5rem;
```

**Another consolidation** — and note the two old values weren't even equal (152px vs 136px), so four files were drawing slightly different fretboards.

---

## `@utility` — three custom utilities

Tailwind v4's replacement for v3's `@layer components` plus a plugin.

```css
/* Toolbars and chip rows scroll sideways without an ugly scrollbar on phones. */
@utility no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}
```

**Three properties for three engines** — Firefox, legacy Edge, Chromium/WebKit. No single standard covers all of them, which is why this is a utility rather than a one-liner.

```css
/* One focus treatment for the whole app, so every control can opt in with a
   single class instead of respelling the ring. */
@utility focus-ring {
  outline: none;
  &:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}
```

**`:focus-visible`, not `:focus`** — the crucial distinction. `:focus` shows a ring on *mouse* clicks too, which designers then remove entirely, which breaks keyboard accessibility. `:focus-visible` is the browser's own heuristic for "focused via keyboard," so the ring appears for keyboard users and not for mouse users. Correct accessibility, and `outline: none` is safe *because* the `:focus-visible` rule restores it.

**`outline`, not `box-shadow`** — outlines don't affect layout and follow border-radius in modern browsers.

```css
/* Long lists pay layout and paint only for what's near the viewport. */
@utility content-auto {
  content-visibility: auto;
  contain-intrinsic-size: auto 12rem;
}
```

**A genuine performance primitive.** `content-visibility: auto` tells the browser to skip layout and paint for off-screen elements entirely — the CSS-native equivalent of list virtualisation, with no JavaScript.

**`contain-intrinsic-size` is mandatory alongside it.** Without a size hint the browser treats skipped elements as zero-height, so the scrollbar jumps wildly as content renders in. `auto 12rem` says "assume 12rem until measured, then remember the real value." Omitting it is the classic mistake with this property.

Paired with [`db.ts`](../lib/db.ts.md)'s `listNoteSummaries` optimisation, this is the other half of making a large library scroll well.

---

## `@layer base` — element defaults

```css
* { @apply border-border; }
```

Every element's border colour defaults to the token, so `border`/`border-t` need no colour class. Carried over from the shadcn convention.

```css
html {
  @apply font-sans;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

**`text-size-adjust: 100%`** disables mobile browsers' automatic text inflation, which otherwise resizes text on rotation and breaks carefully-sized layouts. Both prefixed and unprefixed.

```css
body {
  @apply bg-background text-foreground;
  /* No grey flash when a finger lands on a button. */
  -webkit-tap-highlight-color: transparent;
  /* Keep the shell from rubber-banding behind the fixed chrome. */
  overscroll-behavior-y: none;
  font-synthesis-weight: none;
}
```

**`-webkit-tap-highlight-color: transparent`** — removes Android's grey tap flash, which reads as a browser artifact rather than an app interaction.

**`overscroll-behavior-y: none`** — stops the whole page bouncing when a scroll hits its end. Paired with `overscroll-contain` on the scroll container in `App.svelte`. Together these are what make the app not feel like a web page.

**`font-synthesis-weight: none`** — forbids the browser from *faking* a bold by smearing the glyphs. Since Inter is a variable font with real weights 300–700, synthesis would only ever produce something worse. This matters most where a requested weight falls outside the range.

```css
h1, h2, h3, h4 {
  @apply font-semibold tracking-tight;
  text-wrap: balance;
}
```

> *"Headings inherit the body face; the app has no separate display type, so the old `--` was applied 15+ times for no visual effect."*

**`text-wrap: balance`** — the browser evens out line lengths in a wrapped heading rather than leaving one word orphaned on the last line. One property, a noticeable typographic improvement, and it's the right call to scope it to headings (it's expensive on long text and browsers cap it at a few lines anyway).

```css
button, a, select, [role="button"] { touch-action: manipulation; }
```

> *"Taps register immediately instead of waiting on a double-tap-zoom guess."*

**Removes the ~300ms tap delay.** Mobile browsers historically waited to see whether a tap was the first half of a double-tap-to-zoom. `touch-action: manipulation` disables double-tap zoom on these elements, so the click fires immediately. A large, easily-felt responsiveness win.

```css
@media (pointer: coarse) {
  input[type="range"] { height: 1.75rem; }
  input[type="range"]::-webkit-slider-thumb { transform: scale(1.35); }
}
```

**`pointer: coarse` is the CSS twin of [`media.svelte.ts`](../lib/media.svelte.ts.md)'s `isTouch`** — the same query, used here where CSS suffices. A fingertip needs a bigger target than a cursor. This is the "express it in CSS when you can" side of that module's stated rule.

### Scrollbars

```css
* { scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--foreground) 25%, transparent) transparent; }
::-webkit-scrollbar { width: 0.7rem; height: 0.7rem; }
::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklch, var(--foreground) 25%, transparent);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}
```

Two implementations again — the standard properties for Firefox, the pseudo-elements for Chromium/WebKit, with matching comments saying so.

**`color-mix(in oklch, var(--foreground) 25%, transparent)`** derives the scrollbar colour *from the palette* rather than hardcoding a grey, so it tracks any future change to `--foreground`. Mixing in OKLCH keeps the interpolation perceptually even.

**`border: 2px solid transparent` + `background-clip: padding-box`** — the standard trick for insetting a scrollbar thumb. The transparent border reserves space the background doesn't paint into, producing a thumb narrower than its track without a second element.

```css
@media (max-width: 639px) {
  * { scrollbar-width: none; }
  ::-webkit-scrollbar { display: none; }
}
```

> *"No scrollbars below the phone breakpoint — nothing to grab with a finger, and native apps don't show one."*

**639px is the same breakpoint as `isPhone`** in `media.svelte.ts` — the complement of Tailwind's `sm`. The two are kept in sync by hand; see that file's note on the coupling.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

> *"Honour the OS setting. Every swipe, sheet and auto-scroll in the app ran unconditionally before this. Auto-scroll is exempt in its own component: it is the feature, not decoration."*

**An accessibility fix, added late.** `prefers-reduced-motion` is set by users with vestibular disorders, for whom sliding and zooming interfaces can cause genuine nausea.

**`0.01ms`, not `0`** — deliberate and standard. A duration of exactly `0` can prevent `transitionend`/`animationend` from firing at all, and code that waits on those events would hang. An imperceptible non-zero duration keeps the events firing while removing the motion. [`drag-dismiss.ts`](../lib/actions/drag-dismiss.ts.md) uses a `setTimeout` rather than `transitionend`, so it's unaffected either way — but the principle is why this value is what it is.

**`!important` everywhere** — necessary to beat inline styles, which is exactly what the gesture actions set.

**The exemption note is the thoughtful part.** The reader's auto-scroll is the feature the user asked for; disabling it would break the app rather than calm it. That distinction — decoration versus function — is the right way to apply this media query, and it's handled in the component rather than by weakening the blanket rule here.

---

## What this file tells you about the codebase

Read the comments in sequence and it's a **changelog of design debt being paid down**:

| Comment | Debt repaid |
|---|---|
| Fonts | CDN dependency in an offline-first app |
| Palette | An undesigned light theme that would have discarded the identity |
| Surfaces | Three levels weren't enough to separate a popover from a card |
| `--destructive-foreground` | A variable used but never defined |
| `--favorite` | One colour hardcoded four different ways |
| `--scrim` | `bg-black/60` copied four times |
| Motion | Magic numbers across five files |
| `--text-2xs` | A scale whose names lied about the order |
| `--spacing-fretboard` | Two unequal values for one measurement |
| Headings | A font variable applied 15+ times with no effect |
| Reduced motion | Accessibility setting ignored app-wide |

Every one is the same shape: a value that was duplicated, drifted, or missing, replaced by a single named token. That's what "design system" means concretely, and this file is the best single argument for it in the repo.

---

## Related

- [`main.ts`](../main.ts.md) — imports this first, so it loads before any component CSS
- [`App.svelte`](../App.svelte.md) — `pb-navbar`, `h-dvh`, `overscroll-contain`
- [`lib/media.svelte.ts`](../lib/media.svelte.ts.md) — the JS twin of the breakpoints and `pointer: coarse`
- [`lib/strumming.ts`](../lib/strumming.ts.md) — `STROKE_DISPLAY` consumes `--primary` and `--muted-foreground`
- [`lib/actions/drag-dismiss.ts`](../lib/actions/drag-dismiss.ts.md) — hardcodes durations these tokens would supply
- [`config/postcss.config.mjs`](../config/postcss.config.mjs.md) — the build step that processes this
