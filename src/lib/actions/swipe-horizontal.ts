export interface SwipeHorizontalOptions {
  enabled?: () => boolean;
  /** Touch must start within this many px of the node's left edge. Omit for no edge gate. */
  edgeGate?: number;
  directions?: "left" | "right" | "both";
  onDragStart?: () => void;
  /** Called on every qualifying touchmove with the raw horizontal delta (px) and current velocity (px/ms). */
  onDragMove?: (dx: number, velocity: number) => void;
  /** Called on release if a commit threshold was crossed. */
  onCommit?: (direction: "left" | "right", velocity: number) => void;
  /** Called on release if no threshold was crossed. */
  onCancel?: () => void;
  distanceThreshold?: number;
  velocityThreshold?: number;
}

/**
 * Svelte action: detects an intentional horizontal drag and reports its
 * progress via callbacks, leaving the caller in charge of applying any
 * visual transform. Modeled on `drag-dismiss.ts` — touch events rather than
 * Pointer Events, since Android WebView commits a touch to native scrolling
 * before a pointer handler gets a chance to claim it.
 */
export function swipeHorizontal(node: HTMLElement, options: SwipeHorizontalOptions) {
  let opts = options;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let armed = false;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;

  function withinEdgeGate(x: number): boolean {
    if (opts.edgeGate == null) return true;
    const rect = node.getBoundingClientRect();
    return x - rect.left <= opts.edgeGate;
  }

  function directionOf(dx: number): "left" | "right" {
    return dx < 0 ? "left" : "right";
  }

  function directionAllowed(dir: "left" | "right"): boolean {
    const allowed = opts.directions ?? "both";
    return allowed === "both" || allowed === dir;
  }

  function onTouchStart(e: TouchEvent) {
    if (opts.enabled && !opts.enabled()) return;
    if (e.touches.length !== 1) return;
    if ((e.target as HTMLElement).closest("[data-no-swipe-nav]")) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    lastX = t.clientX;
    lastT = e.timeStamp;
    velocity = 0;
    dragging = false;
    armed = withinEdgeGate(startX);
  }

  function onTouchMove(e: TouchEvent) {
    if (!armed) return;
    if (opts.enabled && !opts.enabled()) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const curDx = t.clientX - startX;
    const curDy = t.clientY - startY;

    if (!dragging) {
      const isHorizontalDrag = Math.abs(curDx) > 8 && Math.abs(curDx) > Math.abs(curDy);
      if (!isHorizontalDrag || !directionAllowed(directionOf(curDx))) return;
      dragging = true;
      opts.onDragStart?.();
    }

    e.preventDefault();
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (t.clientX - lastX) / dt;
    lastX = t.clientX;
    lastT = e.timeStamp;

    opts.onDragMove?.(curDx, velocity);
  }

  function onTouchEnd(e: TouchEvent) {
    armed = false;
    if (!dragging) return;
    dragging = false;
    const dx = lastX - startX;
    const distanceThreshold = opts.distanceThreshold ?? 80;
    const velocityThreshold = opts.velocityThreshold ?? 0.5;
    const dir = directionOf(dx);

    if (
      directionAllowed(dir) &&
      (Math.abs(dx) > distanceThreshold || Math.abs(velocity) > velocityThreshold)
    ) {
      opts.onCommit?.(dir, velocity);
    } else {
      opts.onCancel?.();
    }
    velocity = 0;
  }

  node.addEventListener("touchstart", onTouchStart, { passive: true });
  node.addEventListener("touchmove", onTouchMove, { passive: false });
  node.addEventListener("touchend", onTouchEnd, { passive: true });
  node.addEventListener("touchcancel", onTouchEnd, { passive: true });

  return {
    update(next: SwipeHorizontalOptions) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    },
  };
}
