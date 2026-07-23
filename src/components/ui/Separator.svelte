<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    orientation = "horizontal" as "horizontal" | "vertical",
    class: className = "",
  }: {
    orientation?: "horizontal" | "vertical";
    class?: string;
  } = $props();
</script>

{#if orientation === "vertical"}
  <div
    class={cn("inline-block self-stretch w-px bg-border shrink-0", className)}
    role="separator"
    aria-orientation="vertical"
  ></div>
{:else}
  <div
    class={cn("h-px w-full bg-border shrink-0", className)}
    role="separator"
    aria-orientation="horizontal"
  ></div>
{/if}
