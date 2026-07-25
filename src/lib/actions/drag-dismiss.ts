interface DragDismissOptions {
  onDismiss: () => void;
  /** Downward drag distance, in px, past which releasing dismisses instead of springing back. */
  threshold?: number;
  /** The list/content that must be scrolled to the top before a drag can start. */
  scroller?: () => HTMLElement | null;
  enabled?: () => boolean;
}

/**
 * Svelte action: drag a sheet/dialog panel down to dismiss it.
 *
 * Uses touch events rather than Pointer Events — the Android WebView commits
 * a touch to native scrolling before a pointer handler gets a chance to
 * claim it, so touchmove + manual preventDefault is what actually works.
 */
export function dragDismiss(node: HTMLElement, options: DragDismissOptions) {
  let opts = options;
  let startX = 0;
  let startY = 0;
  let dy = 0;
  let dragging = false;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  function atScrollTop(): boolean {
    const scroller = opts.scroller?.();
    return !scroller || scroller.scrollTop <= 0;
  }

  function reset() {
    node.style.transition = "";
    node.style.transform = "";
  }

  function onTouchStart(e: TouchEvent) {
    if (opts.enabled && !opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    lastY = t.clientY;
    lastT = e.timeStamp;
    dy = 0;
    dragging = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (opts.enabled && !opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const curDy = t.clientY - startY;
    const curDx = t.clientX - startX;

    if (!dragging) {
      const isDownwardVerticalDrag =
        curDy > 8 && Math.abs(curDy) > Math.abs(curDx);
      if (!isDownwardVerticalDrag || !atScrollTop()) return;
      dragging = true;
      node.style.transition = "none";
    }

    e.preventDefault();
    dy = Math.max(0, curDy);
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (t.clientY - lastY) / dt;
    lastY = t.clientY;
    lastT = e.timeStamp;

    node.style.transform = `translateY(${dy}px)`;
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    const threshold = opts.threshold ?? 96;
    if (dy > threshold || velocity > 0.5) {
      node.style.transition = "transform 160ms ease-in";
      node.style.transform = "translateY(100%)";
      setTimeout(() => {
        reset();
        opts.onDismiss();
      }, 160);
    } else {
      node.style.transition = "transform 200ms ease-out";
      node.style.transform = "translateY(0px)";
    }
    dy = 0;
    velocity = 0;
  }

  node.addEventListener("touchstart", onTouchStart, { passive: true });
  node.addEventListener("touchmove", onTouchMove, { passive: false });
  node.addEventListener("touchend", onTouchEnd, { passive: true });
  node.addEventListener("touchcancel", onTouchEnd, { passive: true });

  return {
    update(next: DragDismissOptions) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
      reset();
    },
  };
}
