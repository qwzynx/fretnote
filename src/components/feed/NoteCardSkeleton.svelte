<script lang="ts">
  import Skeleton from "@/components/ui/Skeleton.svelte";

  let { count = 6 }: { count?: number } = $props();
</script>

<!-- Mirrors NoteCard's structure and the feed's grid, so the real cards drop
     straight into the space these were holding. -->
<div class="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
  {#each Array.from({ length: count }, (_, i) => i) as i (i)}
    <div class="overflow-hidden rounded-xl border border-border bg-card">
      <div class="flex flex-col gap-2.5 px-4 py-3.5 sm:gap-3 sm:py-4">
        <div class="flex items-center justify-between">
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-3 w-16" />
        </div>
        <div class="space-y-1.5">
          <Skeleton class="h-5 w-3/5" />
          <Skeleton class="h-3.5 w-2/5" />
        </div>
        <div class="flex gap-1.5">
          <Skeleton class="h-5 w-9 rounded-sm" />
          <Skeleton class="h-5 w-7 rounded-sm" />
          <Skeleton class="h-5 w-8 rounded-sm" />
        </div>
        <Skeleton class="h-3.5 w-1/2" />
      </div>
      <div class="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
        <Skeleton class="h-3 w-20" />
        <Skeleton class="size-4 rounded-full" />
      </div>
    </div>
  {/each}
</div>
