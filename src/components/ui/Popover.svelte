<script lang="ts">
  import type { Snippet } from "svelte";
  import { historyLayer } from "@/lib/overlay-history.svelte";

  let {
    trigger,
    content,
    class: className = "",
  }: {
    trigger: Snippet;
    content: Snippet;
    class?: string;
  } = $props();

  let open = $state(false);
  let containerEl: HTMLElement;
  let panelEl = $state<HTMLElement>();
  let ready = $state(false);
  let top = $state(0);
  let left = $state(0);

  historyLayer(() => open, () => (open = false));

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as Node;
    if (open && !containerEl?.contains(target) && !panelEl?.contains(target)) {
      open = false;
    }
  }

  function reposition() {
    if (!containerEl || !panelEl) return;
    const trig = containerEl.getBoundingClientRect();
    const panelW = panelEl.offsetWidth;
    const panelH = panelEl.offsetHeight;
    const margin = 8;

    let l = trig.left + trig.width / 2 - panelW / 2;
    l = Math.min(Math.max(l, margin), window.innerWidth - panelW - margin);

    // Prefer opening above the trigger; flip below when there isn't room
    // (e.g. the first lyric line, right under the sticky toolbar).
    let t = trig.top - panelH - 6;
    if (t < margin) t = trig.bottom + 6;

    left = l;
    top = t;
    ready = true;
  }

  $effect(() => {
    if (!open) {
      ready = false;
      return;
    }
    ready = false;
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    // Scroll events don't bubble, so the capture phase is what catches the
    // app's inner scroll container — the window itself never scrolls.
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  });

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<span bind:this={containerEl} class="relative inline-block {className}">
  <span onclick={(e) => { e.stopPropagation(); open = !open; }} role="none">
    {@render trigger()}
  </span>
  {#if open}
    <div
      use:portal
      bind:this={panelEl}
      class="fixed z-50 w-max max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
      style="top: {top}px; left: {left}px; opacity: {ready ? 1 : 0}; pointer-events: {ready ? 'auto' : 'none'}"
      role="tooltip"
    >
      {@render content()}
    </div>
  {/if}
</span>
