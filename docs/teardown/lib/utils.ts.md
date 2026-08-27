# `src/lib/utils.ts`

**Role:** One helper — `cn()` — for merging Tailwind class strings. Imported by nearly every component in `components/ui/`.
**Size:** 6 lines. **Depends on:** `clsx`, `tailwind-merge`.

---

## Full source, annotated

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### The signature

```ts
export function cn(...inputs: ClassValue[])
```

**`...inputs` (rest parameter):** Collects every argument into an array, so `cn` can be called with any number of arguments: `cn("p-4")`, `cn(base, variant, className)`, `cn("p-4", isActive && "bg-primary", props.class)`.

**`ClassValue`:** clsx's own union type. It accepts a string, a number, `null`, `undefined`, `false`, an array of any of those (recursively), or an object whose keys are class names and values are booleans. That breadth is the point — it means callers never have to guard before passing:

```svelte
<!-- all of these are legal ClassValues -->
cn("btn", disabled && "opacity-50", { "ring-2": focused }, extraClasses)
```

If `disabled` is `false`, `false && "opacity-50"` evaluates to `false` — a valid `ClassValue` that clsx silently drops. That's why you see the `&&` idiom instead of ternaries with empty strings throughout the components.

**No explicit return type:** Inferred as `string`. Fine here because the body is a single expression from a typed library.

### The body — two nested calls, and the order is the whole point

```ts
return twMerge(clsx(inputs))
```

**Step 1 — `clsx(inputs)`: flatten and filter.**
clsx walks the (possibly nested) structure and produces one space-separated string, discarding every falsy value and expanding object keys whose values are truthy.

```
clsx(["btn", false, { "ring-2": true, "ring-0": false }, ["p-4", null]])
  → "btn ring-2 p-4"
```

Note `clsx(inputs)` passes the *array* as a single argument, not spread as `clsx(...inputs)`. clsx handles arrays recursively, so both forms produce identical output. Passing the array avoids re-spreading and is marginally cheaper.

**Step 2 — `twMerge(...)`: resolve Tailwind conflicts.**
This is the part clsx cannot do. clsx knows nothing about CSS; if you hand it `"p-2 p-4"` it returns `"p-2 p-4"` unchanged. Both classes then land in the DOM, and which one wins is decided by their order *in the generated stylesheet*, not in the attribute — which is effectively arbitrary from the component author's point of view.

`twMerge` understands Tailwind's class taxonomy. It groups classes by the property they control and keeps only the last of each group:

```
twMerge("p-2 p-4")            → "p-4"
twMerge("px-2 p-4")           → "p-4"        (p-4 supersedes px-2)
twMerge("text-sm text-red-500") → "text-sm text-red-500"  (size and colour don't conflict)
```

**Why this exact order matters:** `twMerge` takes strings. It can't interpret `{ "ring-2": focused }` or skip a `false`. So the conditional logic *must* be resolved to a flat string first. Reversing the calls — `clsx(twMerge(inputs))` — would pass an array to a function expecting strings and produce garbage.

---

## Why this function exists at all

The pattern it enables is component-level overridability. Every UI primitive in `components/ui/` does some version of:

```svelte
<button class={cn(baseStyles, variantStyles, className)}>
```

`className` is whatever the *caller* passed. Because it's last, `twMerge` lets it beat the component's own defaults on any conflicting property, while leaving non-conflicting defaults intact. Without `twMerge`, a caller passing `class="p-8"` to a button whose base is `p-4` would get an unpredictable result depending on stylesheet order. With it, the caller reliably wins.

This is the same `cn` used by shadcn/ui, which is where the convention comes from — this project's `components/ui/` follows that house style.

---

## Style note

This file has no semicolons and no trailing newline convention matching the rest of the codebase (`db.ts` etc. use semicolons). That's a tell: it was copied verbatim from the shadcn/ui scaffold rather than hand-written. Harmless — the ESLint config doesn't enforce semicolons — but worth recognising as a "vendored" file when you're forming a mental model of the codebase's own style.

---

## Control flow

No conditionals, no loops. The branching all happens *inside* clsx (which loops over the input structure) and inside twMerge (which parses each class and looks up its conflict group).

---

## Related

- [`components/ui/Button.svelte`](../components/ui/Button.svelte.md) — the heaviest user of `cn`, combined with `class-variance-authority`
- [`app/globals.css`](../app/globals.css.md) — defines the design tokens the merged classes resolve to
