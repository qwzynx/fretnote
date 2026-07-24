<script lang="ts">
  import { X } from "@lucide/svelte";

  let {
    open,
    onclose,
  }: {
    open: boolean;
    onclose: () => void;
  } = $props();

  const GLOBAL = [
    { keys: ["Ctrl", "N"], desc: "New note" },
    { keys: ["Ctrl", "K"], desc: "Quick search" },
    { keys: ["?"], desc: "Show this help" },
    { keys: ["Esc"], desc: "Go back" },
  ];

  const READER = [
    { keys: ["Space"], desc: "Toggle auto-scroll" },
    { keys: ["["], desc: "Transpose down" },
    { keys: ["]"], desc: "Transpose up" },
    { keys: ["-"], desc: "Smaller text" },
    { keys: ["+"], desc: "Larger text" },
  ];

  const EDITOR = [
    { keys: ["Ctrl", "S"], desc: "Save note" },
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
    onkeydown={handleKeydown}
  >
    <div class="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-heading text-lg font-semibold">Keyboard shortcuts</h2>
        <button
          type="button"
          onclick={onclose}
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X class="size-4" />
        </button>
      </div>

      <div class="space-y-5 text-sm">
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Global</p>
          <ul class="space-y-1.5">
            {#each GLOBAL as s}
              <li class="flex items-center justify-between">
                <span class="text-muted-foreground">{s.desc}</span>
                <span class="flex gap-1">
                  {#each s.keys as k}
                    <kbd class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note reader</p>
          <ul class="space-y-1.5">
            {#each READER as s}
              <li class="flex items-center justify-between">
                <span class="text-muted-foreground">{s.desc}</span>
                <span class="flex gap-1">
                  {#each s.keys as k}
                    <kbd class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        </div>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note editor</p>
          <ul class="space-y-1.5">
            {#each EDITOR as s}
              <li class="flex items-center justify-between">
                <span class="text-muted-foreground">{s.desc}</span>
                <span class="flex gap-1">
                  {#each s.keys as k}
                    <kbd class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      </div>

      <p class="mt-5 text-xs text-muted-foreground">
        On Mac, use <kbd class="inline-flex items-center rounded border border-border bg-muted px-1 font-mono text-xs">⌘</kbd> instead of Ctrl.
      </p>
    </div>
  </div>
{/if}
