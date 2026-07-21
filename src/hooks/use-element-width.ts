
import { useEffect, useRef, useState } from "react";

/**
 * Tracks an element's *content-box* width in px (padding excluded), updating
 * whenever the element resizes. Returns `[ref, width]`; width is 0 until the
 * first measurement lands after mount.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const s = getComputedStyle(el);
      const padX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
      setWidth(el.clientWidth - padX);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
