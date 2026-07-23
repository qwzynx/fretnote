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

<div class={cn("p-4", className)} {...rest}>
  {@render children?.()}
</div>
