/**
 * Top-level "section" routes a phone can page between by swiping. Order
 * must match the left-to-right order of `ITEMS`/`TRAILING` in
 * `src/components/layout/BottomNav.svelte`.
 */
export const SECTION_ORDER = ["/", "/setlists", "/settings"] as const;

/** Index into `SECTION_ORDER`, or -1 if `path` isn't a section root (e.g. `/setlists/:id`, `/notes/:id`). */
export function sectionIndex(path: string): number {
  return SECTION_ORDER.indexOf(path as (typeof SECTION_ORDER)[number]);
}
