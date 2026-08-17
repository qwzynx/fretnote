<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { cn } from "@/lib/utils";

  let {
    icon,
    title,
    description = "",
    tone = "empty",
    size = "default",
    class: className = "",
    action,
  }: {
    /** A lucide component, e.g. `Music2`. */
    icon?: Component;
    title: string;
    description?: string;
    /** `error` swaps the dashed border to the destructive hue. */
    tone?: "empty" | "error";
    size?: "default" | "compact";
    class?: string;
    /** Buttons for the way out of this state. */
    action?: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<!-- One treatment for every "there's nothing here" moment. These were seven
     hand-rolled boxes across three incompatible designs, with padding ranging
     from py-4 to py-20 and only some of them offering a way forward. -->
<div
  role={tone === "error" ? "alert" : undefined}
  class={cn(
    "flex flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center",
    tone === "error" ? "border-destructive/40" : "border-border",
    size === "compact" ? "gap-2 py-10" : "gap-3 py-14 sm:py-20",
    className
  )}
>
  {#if Icon}
    <Icon
      class={cn(
        "size-8",
        tone === "error" ? "text-destructive/70" : "text-muted-foreground/40"
      )}
    />
  {/if}
  <p class="font-medium">{title}</p>
  {#if description}
    <p class="max-w-sm text-sm text-balance text-muted-foreground">
      {description}
    </p>
  {/if}
  {#if action}
    <div class="mt-1 flex flex-wrap justify-center gap-2">
      {@render action()}
    </div>
  {/if}
</div>
