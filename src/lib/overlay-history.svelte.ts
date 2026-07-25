/**
 * Backs every dismissible overlay (sheet, dialog, popover) with a real
 * history entry, so the Android back button and drag-to-dismiss gestures
 * unwind overlays before they ever reach route navigation or exit the app.
 */

interface Layer {
  close: () => void;
  /** Set once this layer has been consumed by a real popstate (back button/gesture), so the component's own effect cleanup doesn't try to unwind history a second time. */
  popped: boolean;
}

let layers: Layer[] = [];
let suppressed = 0;
const pendingAfterPop: Array<() => void> = [];

function handlePopState() {
  if (suppressed > 0) {
    suppressed -= 1;
    pendingAfterPop.shift()?.();
    return;
  }
  const layer = layers.pop();
  if (layer) {
    layer.popped = true;
    layer.close();
  }
}

/** Call once, near app start. Returns a cleanup function. */
export function initOverlayHistory(): () => void {
  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}

export function overlayDepth(): number {
  return layers.length;
}

/** Closes the topmost open layer, if any. Returns whether one was open. */
export function closeTopLayer(): boolean {
  const layer = layers[layers.length - 1];
  if (!layer) return false;
  layer.close();
  return true;
}

function pushLayer(close: () => void): Layer {
  const layer: Layer = { close, popped: false };
  layers.push(layer);
  // Same-hash entry: doesn't fire `hashchange`, so svelte-spa-router never sees it.
  history.pushState({ fretnoteLayer: true }, "");
  return layer;
}

function releaseLayer(layer: Layer, then?: () => void) {
  if (layer.popped) {
    then?.();
    return;
  }
  const idx = layers.indexOf(layer);
  if (idx !== -1) layers.splice(idx, 1);
  layer.popped = true;
  suppressed += 1;
  if (then) pendingAfterPop.push(then);
  history.back();
}

/** Closes every open layer at once (e.g. an editor "Cancel" leaving the page). */
export function closeAllLayers(then?: () => void) {
  const toClose = layers.splice(0, layers.length);
  if (toClose.length === 0) {
    then?.();
    return;
  }
  // Browsers coalesce a multi-step history.go(-N) into a single popstate,
  // not N separate ones, so only one suppression/callback is queued here.
  suppressed += 1;
  if (then) pendingAfterPop.push(then);
  for (let i = toClose.length - 1; i >= 0; i--) {
    toClose[i].popped = true;
    toClose[i].close();
  }
  history.go(-toClose.length);
}

/**
 * Wires a component's open/close state to the history stack.
 *
 * `isOpen`/`close` are read reactively: whenever `isOpen()` becomes true a
 * history entry is pushed, and whenever it becomes false (by any means —
 * an X button, outside click, the back button, or a drag gesture) that
 * entry is unwound.
 */
export function historyLayer(isOpen: () => boolean, close: () => void) {
  let layer: Layer | null = null;

  $effect(() => {
    if (isOpen()) {
      layer = pushLayer(close);
      return () => {
        if (layer) releaseLayer(layer);
        layer = null;
      };
    }
  });

  /**
   * Closes the layer and runs `then` only after the history entry has
   * actually unwound — needed whenever closing is paired with another
   * navigation (opening a different layer, pushing a route), since a
   * pushed/replaced history entry racing an in-flight `history.back()`
   * corrupts the stack.
   */
  function dismiss(then?: () => void) {
    if (!layer) {
      close();
      then?.();
      return;
    }
    const l = layer;
    layer = null;
    close();
    releaseLayer(l, then);
  }

  return { dismiss };
}
