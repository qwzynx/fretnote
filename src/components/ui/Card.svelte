<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let {
    class: className = "",
    children,
    ...rest
  }: {
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<div
  class={cn(
    "rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:ring-1 hover:ring-border",
    className
  )}
  {...rest}
>
  {@render children?.()}
</div>
