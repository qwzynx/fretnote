<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    class: className = "",
    type = "text",
    value = $bindable(""),
    ...rest
  }: {
    class?: string;
    type?: string;
    value?: string | number;
    [key: string]: unknown;
  } = $props();
</script>

<input
  {type}
  bind:value
  class={cn(
    // `text-base` on phones — anything smaller makes iOS Safari zoom on focus.
    "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:text-sm dark:bg-input/30",
    className
  )}
  {...rest}
/>
