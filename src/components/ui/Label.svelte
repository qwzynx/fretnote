<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let {
    class: className = "",
    for: htmlFor = undefined as string | undefined,
    children,
    ...rest
  }: {
    class?: string;
    for?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<label
  for={htmlFor}
  class={cn(
    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    className
  )}
  {...rest}
>
  {@render children?.()}
</label>
