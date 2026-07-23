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
      "appearance-none rounded-lg border border-input bg-transparent pr-7 pl-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
      size === "sm" ? "h-7 text-[0.8rem]" : "h-8",
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
    class="pointer-events-none absolute right-1.5 size-4 text-muted-foreground"
  />
</div>
