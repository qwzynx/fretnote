<script lang="ts">
  import { FINGERS, FINGER_LABELS } from "@/lib/music/fingering";
  import { cn } from "@/lib/utils";

  let { class: className = "" }: { class?: string } = $props();
</script>

<p
  class={cn(
    "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-3xs text-muted-foreground",
    className
  )}
>
  {#each FINGERS as finger}
    <span class="flex items-center gap-1">
      <span
        class="flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[0.5rem] font-bold leading-none text-primary-foreground"
      >
        {finger}
      </span>
      {FINGER_LABELS[finger]}
    </span>
  {/each}
</p>
