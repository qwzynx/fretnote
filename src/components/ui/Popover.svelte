<script lang="ts">
  import type { Snippet } from "svelte";

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

  function handleOutsideClick(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<span bind:this={containerEl} class="relative inline-block {className}">
  <span onclick={(e) => { e.stopPropagation(); open = !open; }} role="none">
    {@render trigger()}
  </span>
  {#if open}
    <div
      class="absolute bottom-full left-0 z-50 mb-1 min-w-max rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
      role="tooltip"
    >
      {@render content()}
    </div>
  {/if}
</span>
