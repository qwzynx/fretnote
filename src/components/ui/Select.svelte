<script lang="ts">
  import { cn } from "@/lib/utils";
  import { ChevronDown } from "@lucide/svelte";

  interface SelectItem {
    value: string;
    label: string;
  }

  let {
    value = $bindable(""),
    items = [] as SelectItem[],
    placeholder = "",
    size = "default" as "default" | "sm",
    class: className = "",
    onValueChange = undefined as ((v: string) => void) | undefined,
    ...rest
  }: {
    value?: string;
    items?: SelectItem[];
    placeholder?: string;
    size?: "default" | "sm";
    class?: string;
    onValueChange?: (v: string) => void;
    [key: string]: unknown;
  } = $props();

  function handleChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    value = v;
    onValueChange?.(v);
  }
</script>

<div class="relative inline-flex items-center">
  <select
    {value}
    onchange={handleChange}
    class={cn(
      "appearance-none rounded-lg border border-input bg-transparent pr-8 pl-3 text-base outline-none transition-colors focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:pr-7 sm:pl-2.5 sm:text-sm dark:bg-input/30 dark:hover:bg-input/50",
      size === "sm" ? "h-9 sm:h-7 sm:text-2xs" : "h-10 sm:h-8",
      className
    )}
    {...rest}
  >
    {#if placeholder}
      <option value="" disabled>{placeholder}</option>
    {/if}
    {#each items as item}
      <option value={item.value}>{item.label}</option>
    {/each}
  </select>
  <ChevronDown
    class="pointer-events-none absolute right-2 size-4 text-muted-foreground sm:right-1.5"
  />
</div>
