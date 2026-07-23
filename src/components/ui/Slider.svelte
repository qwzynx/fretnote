<script lang="ts">
  import { cn } from "@/lib/utils";

  let {
    value = $bindable(50),
    min = 0,
    max = 100,
    step = 1,
    class: className = "",
    "aria-label": ariaLabel = undefined as string | undefined,
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    class?: string;
    "aria-label"?: string;
  } = $props();
</script>

<input
  type="range"
  bind:value
  {min}
  {max}
  {step}
  aria-label={ariaLabel}
  class={cn(
    "w-full cursor-pointer accent-primary focus-visible:outline-none",
    className
  )}
/>
