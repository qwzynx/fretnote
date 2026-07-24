<script lang="ts">
  import { X } from "@lucide/svelte";

  let {
    tags,
    onChange,
  }: {
    tags: string[];
    onChange: (tags: string[]) => void;
  } = $props();

  let input = $state("");

  function commit() {
    const val = input
      .trim()
      .toLowerCase()
      .replace(/,+$/, "")
      .trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    input = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }
</script>

<div
  class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50 dark:bg-input/30"
>
  {#each tags as tag}
    <span
      class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/25"
    >
      #{tag}
      <button
        type="button"
        onclick={() => remove(tag)}
        aria-label="Remove tag {tag}"
        class="rounded-full opacity-60 hover:opacity-100 focus:outline-none"
      >
        <X class="size-2.5" />
      </button>
    </span>
  {/each}
  <input
    type="text"
    bind:value={input}
    onkeydown={handleKeydown}
    onblur={commit}
    placeholder={tags.length === 0 ? "Add tags…" : ""}
    class="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
  />
</div>
<p class="text-xs text-muted-foreground">Press Enter or comma to add a tag.</p>
