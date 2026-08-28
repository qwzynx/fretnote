# `src/pages/CreatePage.svelte`

**Role:** Route wrapper for both `/create` and `/notes/:id/edit`. Provides the page title and layout; the actual form is `CreateNoteForm`.
**Size:** 19 lines — the smallest page. **Routes:** `/create`, `/notes/:id/edit`

---

## Full script

```ts
import CreateNoteForm from "@/components/create/CreateNoteForm.svelte";

let { params }: { params?: { id?: string } } = $props();
const editId = $derived(params?.id);
```

## `$props()` and the router contract

```ts
let { params }: { params?: { id?: string } } = $props();
```

**`$props()` is Svelte 5's replacement for `export let`.** Destructuring pulls out the props this component accepts — here, just `params`.

**`params` is injected by `svelte-spa-router`.** When a route pattern contains `:name` segments, the router passes their values as a `params` object. `/notes/abc/edit` matches `/notes/:id/edit`, so `params` is `{ id: "abc" }`.

**Both `params?` and `id?` are optional**, and that's the whole design. On the `/create` route the pattern has no `:id`, so the router passes no `params` at all — hence `params?`. The nested `id?` is defensive; the router wouldn't produce a `params` object without it.

**This is where the create/edit duality lives.** [`App.svelte`](../App.svelte.md) maps two routes to this one component:

```ts
"/create":          CreatePage,
"/notes/:id/edit":  CreatePage,
```

The *only* difference between them is whether `params.id` is present. That single optional value propagates through `editId` into `CreateNoteForm`, which decides whether to load an existing note or start blank.

**Why one component instead of two:** the create and edit forms would be identical — same fields, same validation, same preview, same save path. The only divergence is "load a note first" and "INSERT vs UPDATE," both of which are one conditional inside the form. Two components would duplicate 628 lines to avoid two `if`s.

## `editId`

```ts
const editId = $derived(params?.id);
```

**`$derived`, not a plain `const`.** `params` is a prop, and props change when the route changes. A plain `const editId = params?.id` would capture the value at component initialisation and never update — so navigating from `/create` to `/notes/x/edit` *without unmounting* would leave `editId` stale.

Whether that can actually happen depends on whether `svelte-spa-router` reuses the component instance across two routes that resolve to the same component. It does, which makes this `$derived` load-bearing rather than merely cautious.

**`params?.id`** — optional chaining, so `undefined` flows through cleanly for the create route.

**The type is `string | undefined`**, and `undefined` is the "new note" signal. Not `null`, not `""` — the absence of the property *is* the state. `CreateNoteForm` then branches on truthiness.

---

## The template

```svelte
<main class="w-full py-4 sm:py-8 lg:flex lg:h-full lg:flex-col lg:py-0">
  <!-- Title stays centered to the max-w-6xl grid -->
  <div class="mx-auto w-full max-w-6xl px-4 lg:shrink-0">
    <h1 class="mb-4 text-xl font-semibold sm:mb-6 sm:text-2xl lg:mb-4 lg:pt-6">
      {editId ? "Edit note" : "New note"}
    </h1>
  </div>
  <!-- Form area is full-width on lg+ so each column's scroll hitbox reaches the screen edge -->
  <div class="mx-auto w-full max-w-6xl px-4 lg:mx-0 lg:max-w-none lg:px-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
    <CreateNoteForm {editId} />
  </div>
</main>
```

### `{editId ? "Edit note" : "New note"}`

**The only visible difference this component makes.** Truthiness rather than `!== undefined` — an empty-string id would read as "New note," which is the safer degradation.

### The two layout modes

The class lists encode a **layout that changes shape entirely at `lg`**, and reading them side by side is the clearest way to see it:

| | below `lg` (phone/tablet) | `lg`+ (desktop) |
|---|---|---|
| `<main>` | normal block flow, vertical padding | `flex flex-col h-full`, no padding |
| Title | centred in a `max-w-6xl` column | `shrink-0` — fixed header row |
| Form area | centred, `max-w-6xl`, padded | `max-w-none`, full width, `flex-1 min-h-0 overflow-hidden` |

**Below `lg`:** the page scrolls as one document inside `App.svelte`'s scroll container. Standard, simple.

**At `lg`:** the page becomes a **fixed-height flex column** — a non-scrolling title row plus a form area that fills the rest. The form then manages its own internal scrolling, which is what allows the two-column editor (editor on the left, live preview on the right) to scroll *independently*.

### `lg:min-h-0 lg:flex-1 lg:overflow-hidden`

**The same flexbox trio as [`App.svelte`](../App.svelte.md)'s scroll container, and `min-h-0` is again the non-obvious part.** A flex item defaults to `min-height: auto`, which refuses to shrink below its content — so without `min-h-0` the form area would grow to fit the whole form and push past the viewport instead of constraining and scrolling. Second appearance of this pattern in the codebase; recognising it is worth doing once.

### `lg:mx-0 lg:max-w-none lg:px-0`

> *"Form area is full-width on lg+ so each column's scroll hitbox reaches the screen edge"*

**A real interaction concern, not aesthetics.** If the form stayed inside `max-w-6xl` with `px-4`, the scrollable columns would end short of the screen edge, and the gap would be dead space — a mouse wheel or trackpad scroll there would scroll the *page* rather than the column under the cursor. Extending to the edges means the scroll target is wherever the pointer is.

Note the title deliberately keeps `max-w-6xl` while the form drops it, so the heading stays aligned to the app's grid while the content beneath it goes full-bleed. Two different constraints on two rows of the same page — which is exactly why they're separate `<div>`s rather than one wrapper.

### `<CreateNoteForm {editId} />`

Shorthand for `editId={editId}`. The entire payload of this component: one optional string.

---

## Control flow summary

| Construct | Location | Purpose |
|---|---|---|
| `params?: { id?: string }` | props | `/create` supplies no `params` at all |
| `$derived`, not `const` | `editId` | The router reuses the instance across both routes |
| `editId ? … : …` | title | The only visible create/edit difference |
| `lg:` prefix on ~8 classes | template | The layout changes shape, not just spacing |
| `lg:min-h-0 lg:flex-1` | form area | Without `min-h-0` a flex item won't shrink or scroll |
| `lg:max-w-none lg:px-0` | form area | Column scroll hitboxes must reach the screen edge |

No conditionals in the script, no loops, no async, no lifecycle. This is a **pure routing and layout shim** — 19 lines whose entire job is to turn a route parameter into a prop and give the form a box to live in. All the complexity is one level down.

---

## Related

- [`components/create/CreateNoteForm.svelte`](../components/create/CreateNoteForm.svelte.md) — the 628-line form this wraps
- [`App.svelte`](../App.svelte.md) — the two routes that both resolve here, and the outer scroll container
- [`lib/nav-stack.svelte.ts`](../lib/nav-stack.svelte.ts.md) — treats `note-edit` as a level above `note`, so back lands on the note
