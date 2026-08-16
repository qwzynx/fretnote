<script lang="ts">
  import type { Snippet } from "svelte";
  import { router } from "svelte-spa-router";
  import { goto } from "@/lib/nav-stack.svelte";
  import { isPhone } from "@/lib/media.svelte";
  import { overlayDepth } from "@/lib/overlay-history.svelte";
  import { swipeHorizontal } from "@/lib/actions/swipe-horizontal";
  import { SECTION_ORDER, sectionIndex } from "@/lib/sections";

  let { children }: { children: Snippet } = $props();

  let wrapperEl: HTMLElement;
  let prevLocation = router.location;

  function setTransform(transition: string, transform: string) {
    if (!wrapperEl) return;
    wrapperEl.style.transition = transition;
    wrapperEl.style.transform = transform;
  }

  // Animates the entry of whatever `<Router>` just mounted, whenever the
  // route changes between two section roots — whether that change came from
  // a gesture commit (below) or a plain tap on a nav link.
  $effect(() => {
    const loc = router.location;
    if (loc === prevLocation) {
      return;
    }
    const fromIdx = sectionIndex(prevLocation);
    const toIdx = sectionIndex(loc);
    prevLocation = loc;

    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const entryDir = toIdx > fromIdx ? 1 : -1;
    setTransform("none", `translateX(${entryDir * 100}%)`);
    requestAnimationFrame(() => {
      setTransform("transform 200ms ease-out", "translateX(0)");
    });
  });

  function handleDragMove(dx: number) {
    const idx = sectionIndex(router.location);
    if (idx === -1) return;
    const atStart = idx === 0 && dx > 0;
    const atEnd = idx === SECTION_ORDER.length - 1 && dx < 0;
    const damped = atStart || atEnd ? dx * 0.25 : dx;
    setTransform("none", `translateX(${damped}px)`);
  }

  function handleCommit(direction: "left" | "right") {
    const idx = sectionIndex(router.location);
    const nextIdx = direction === "left" ? idx + 1 : idx - 1;
    if (idx === -1 || nextIdx < 0 || nextIdx >= SECTION_ORDER.length) {
      handleCancel();
      return;
    }
    const exitDir = nextIdx > idx ? -1 : 1;
    setTransform("transform 150ms ease-in", `translateX(${exitDir * 100}%)`);
    setTimeout(() => goto(SECTION_ORDER[nextIdx]), 150);
  }

  function handleCancel() {
    setTransform("transform 200ms ease-out", "translateX(0)");
  }
</script>

<div
  bind:this={wrapperEl}
  use:swipeHorizontal={{
    directions: "both",
    enabled: () => isPhone.current && overlayDepth() === 0,
    onDragMove: handleDragMove,
    onCommit: handleCommit,
    onCancel: handleCancel,
  }}
>
  {@render children()}
</div>
