<script lang="ts">
  import { Guitar, Music4 } from "@lucide/svelte";
  import type { Note } from "@/lib/types";
  import Card from "@/components/ui/Card.svelte";
  import CardContent from "@/components/ui/CardContent.svelte";
  import CardFooter from "@/components/ui/CardFooter.svelte";
  import Badge from "@/components/ui/Badge.svelte";

  let { note }: { note: Note } = $props();

  const DIFFICULTY_LABEL: Record<Note["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
</script>

<Card class="group/note gap-0 py-0 hover:ring-primary/40">
  <a href={`#/notes/${note.id}`} class="outline-none">
    <CardContent class="flex flex-col gap-3 px-4 py-4">
      <div class="flex items-center justify-between">
        <Badge variant="outline" class="gap-1 border-primary/30 text-primary">
          {#if note.type === "tab"}
            <Guitar class="size-3" />
          {:else}
            <Music4 class="size-3" />
          {/if}
          {note.type === "tab" ? "Tab" : "Chords"}
        </Badge>
        <span class="text-xs text-muted-foreground">
          {DIFFICULTY_LABEL[note.difficulty]}
        </span>
      </div>

      <div>
        <h3
          class="font-heading text-lg font-semibold leading-tight group-hover/note:text-primary"
        >
          {note.title}
        </h3>
        <p class="text-sm text-muted-foreground">{note.artist}</p>
      </div>

      <div class="flex flex-wrap gap-1.5">
        {#each note.chords.slice(0, 5) as c}
          <span
            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80"
          >
            {c}
          </span>
        {/each}
      </div>

      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Key {note.key}</span>
        <span>·</span>
        <span>{note.capo > 0 ? `Capo ${note.capo}` : "No capo"}</span>
      </div>
    </CardContent>
  </a>

  <CardFooter
    class="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5"
  >
    <span class="text-xs text-muted-foreground">
      {new Date(note.createdAt).toLocaleDateString()}
    </span>
    <span class="text-xs text-muted-foreground">
      {note.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
    </span>
  </CardFooter>
</Card>
