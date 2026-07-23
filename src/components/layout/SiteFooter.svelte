<script lang="ts">
  import { Guitar } from "@lucide/svelte";
</script>

<footer class="border-t border-border/80 bg-background">
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Guitar class="size-4 text-primary" />
      <span>
        <span class="font-medium text-foreground">Fretnote</span> — chords &amp;
        tabs for every song.
      </span>
    </div>
    <nav
      class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
    >
      <a href="#/" class="hover:text-foreground">Notes</a>
      <a href="#/create" class="hover:text-foreground">Create</a>
    </nav>
  </div>
</footer>
