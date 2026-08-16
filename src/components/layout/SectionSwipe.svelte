<script lang="ts">
  import type { Snippet } from "svelte";
  import { router } from "svelte-spa-router";
  import { goto } from "@/lib/nav-stack.svelte";
  import { isPhone } from "@/lib/media.svelte";
  import { overlayDepth } from "@/lib/overlay-history.svelte";
  import { swipeHorizontal } from "@/lib/actions/swipe-horizontal";
  import { SECTION_ORDER, sectionIndex } from "@/lib/sections";
  import FeedPage from "@/pages/FeedPage.svelte";
  import SetlistsPage from "@/pages/SetlistsPage.svelte";
  import SettingsPage from "@/pages/SettingsPage.svelte";

  /**
   * On phone, the three bottom-nav sections are mounted side by side in a
   * single track (rather than routed one-at-a-time) so a drag can show the
   * neighboring page sliding in in real time, like a native paged tab view,
   * instead of the old slide-out/slide-in-after-navigation two-step. Any
   * other route (a note, the editor, a setlist) falls through to `children`
   * (the Router's normal single-page render) unchanged.
   */
  const SECTION_COMPONENTS = [FeedPage, SetlistsPage, SettingsPage];
  const SETTLE_TRANSITION = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";

  let { children }: { children: Snippet } = $props();

  let trackEl: HTMLElement;
  let dragging = $state(false);

  const idx = $derived(sectionIndex(router.location));
  const onSection = $derived(idx !== -1);
  const showCarousel = $derived(isPhone.current && onSection);

  function place(atIdx: number, dragPx: number) {
    if (!trackEl) return;
    trackEl.style.transform = `translateX(calc(${-atIdx * 100}% + ${dragPx}px))`;
  }

  // Keeps the resting position in sync with the route whenever we're not
  // mid-drag — covers both a swipe commit's own goto() below and a plain
  // tap on a bottom-nav link.
  $effect(() => {
    const i = idx;
    if (i === -1 || dragging || !trackEl) return;
    trackEl.style.transition = SETTLE_TRANSITION;
    place(i, 0);
  });

  function handleDragStart() {
    dragging = true;
    if (trackEl) trackEl.style.transition = "none";
  }

  function handleDragMove(dx: number) {
    if (idx === -1) return;
    const atStart = idx === 0 && dx > 0;
    const atEnd = idx === SECTION_ORDER.length - 1 && dx < 0;
    place(idx, atStart || atEnd ? dx * 0.35 : dx);
  }

  function settle(atIdx: number) {
    dragging = false;
    if (trackEl) {
      trackEl.style.transition = SETTLE_TRANSITION;
      place(atIdx, 0);
    }
  }

  function handleCommit(direction: "left" | "right") {
    if (idx === -1) {
      settle(0);
      return;
    }
    const nextIdx = direction === "left" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= SECTION_ORDER.length) {
      settle(idx);
      return;
    }
    // The track is already mid-flight toward `nextIdx`; goto() just
    // reconciles the route/hash underneath it, so the motion never stalls
    // to swap DOM the way a route-triggered re-mount would.
    settle(nextIdx);
    goto(SECTION_ORDER[nextIdx]);
  }

  function handleCancel() {
    settle(idx === -1 ? 0 : idx);
  }
</script>

{#if showCarousel}
  <div class="h-full w-full overflow-hidden">
    <div
      bind:this={trackEl}
      use:swipeHorizontal={{
        directions: "both",
        enabled: () => isPhone.current && overlayDepth() === 0,
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onCommit: handleCommit,
        onCancel: handleCancel,
      }}
      class="flex h-full w-full"
      style="transform: translateX({-idx * 100}%)"
    >
      {#each SECTION_COMPONENTS as Section, i (i)}
        <div
          class="h-full w-full shrink-0 overflow-y-auto overscroll-contain pb-navbar"
          aria-hidden={i !== idx}
          inert={i !== idx}
        >
          <Section />
        </div>
      {/each}
    </div>
  </div>
{:else}
  {@render children()}
{/if}
