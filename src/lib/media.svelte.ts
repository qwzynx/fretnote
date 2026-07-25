/** Reactive `matchMedia`, for the few places a layout can't be expressed in CSS alone. */
function mediaQuery(query: string) {
  let matches = $state(false);

  if (typeof window !== "undefined") {
    const mql = window.matchMedia(query);
    matches = mql.matches;
    mql.addEventListener("change", (e) => (matches = e.matches));
  }

  return {
    get current() {
      return matches;
    },
  };
}

/** Below Tailwind's `sm` breakpoint — phone portrait and small landscape. */
export const isPhone = mediaQuery("(max-width: 639px)");

/** Below Tailwind's `lg` breakpoint — where the editor drops to one column. */
export const isCompact = mediaQuery("(max-width: 1023px)");

/** True for finger-first input; drives hit-target sizing that CSS can't infer. */
export const isTouch = mediaQuery("(pointer: coarse)");
