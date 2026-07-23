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

<div class={cn("flex items-center px-4 py-2.5", className)} {...rest}>
  {@render children?.()}
</div>
