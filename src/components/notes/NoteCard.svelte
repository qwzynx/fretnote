<script lang="ts">
  import { untrack } from "svelte";
  import { Guitar, Heart, Music4, Trash2 } from "@lucide/svelte";
  import { toggleFavorite, deleteNote } from "@/lib/db";
  import type { NoteSummary } from "@/lib/types";
  import { goto } from "@/lib/nav-stack.svelte";
  import { swipeHorizontal } from "@/lib/actions/swipe-horizontal";
  import { cardActions } from "@/lib/card-actions.svelte";
  import Card from "@/components/ui/Card.svelte";
  import CardContent from "@/components/ui/CardContent.svelte";
  import CardFooter from "@/components/ui/CardFooter.svelte";
  import Badge from "@/components/ui/Badge.svelte";
  import { cn } from "@/lib/utils";

  const TRAY_WIDTH = 128;

  // Built once for the whole feed. Constructing an Intl formatter per card
  // per render is a surprisingly large share of a long list's render cost.
  const DATE_FMT = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  let {
    note,
    onToggleFavorite,
    onDelete,
    swipeActions = false,
  }: {
    note: NoteSummary;
    onToggleFavorite?: (id: string, value: boolean) => void;
    onDelete?: (id: string) => void;
    swipeActions?: boolean;
  } = $props();

  let isFav = $state(note.isFavorite ?? false);
  let dragX = $state(0);
  let dragging = $state(false);
  let wrapperEl = $state<HTMLElement | undefined>(undefined);

  // Another card was opened — spring this one closed. Reading and writing
  // dragX from one effect made it re-entrant on every card in the feed, so
  // the close is folded into setOpen's bookkeeping instead.
  $effect(() => {
    const openId = cardActions.openId;
    if (openId !== note.id) untrack(() => { if (dragX !== 0) dragX = 0; });
  });

  function handleDragStart() {
    dragging = true;
  }

  function setOpen(open: boolean) {
    dragging = false;
    dragX = open ? -TRAY_WIDTH : 0;
    if (open) {
      cardActions.openId = note.id;
    } else if (cardActions.openId === note.id) {
      cardActions.openId = null;
    }
  }

  async function handleFavorite(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFav;
    isFav = next;
    await toggleFavorite(note.id, next);
    onToggleFavorite?.(note.id, next);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    await deleteNote(note.id);
    setOpen(false);
    onDelete?.(note.id);
  }

  function handleDragMove(dx: number) {
    dragX =
      dragX === 0
        ? Math.max(-TRAY_WIDTH, Math.min(0, dx))
        : Math.max(-TRAY_WIDTH, Math.min(0, -TRAY_WIDTH + dx));
  }

  function handleCommit(direction: "left" | "right") {
    setOpen(direction === "left");
  }

  function handleCancel() {
    setOpen(dragX < -TRAY_WIDTH / 2);
  }

  function handleFrontClick(e: MouseEvent) {
    if (dragX !== 0) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (dragX !== 0 && wrapperEl && !wrapperEl.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  const DIFFICULTY_LABEL: Record<NoteSummary["difficulty"], string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };
</script>

{#snippet cardBody()}
  <Card class="group/note gap-0 py-0 hover:ring-primary/40">
    <a
      href={`#/notes/${note.id}`}
      onclick={(e) => goto(`/notes/${note.id}`, e)}
      class="focus-ring block rounded-t-xl"
    >
      <CardContent class="flex flex-col gap-2.5 px-4 py-3.5 sm:gap-3 sm:py-4">
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
            class="text-lg font-semibold leading-tight group-hover/note:text-primary"
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
      class="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2"
    >
      <span class="shrink-0 text-xs text-muted-foreground">
        {DATE_FMT.format(new Date(note.createdAt))}
      </span>
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate text-xs text-muted-foreground">
          {note.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
        </span>
        <button
          type="button"
          onclick={handleFavorite}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          class="-mr-1.5 flex size-8 items-center justify-center rounded-md transition-colors hover:text-favorite active:bg-muted sm:-mr-0 sm:size-6"
        >
          <Heart
            class="size-4 sm:size-3.5 {isFav
              ? 'fill-favorite text-favorite'
              : 'text-muted-foreground'}"
          />
        </button>
      </div>
    </CardFooter>
  </Card>
{/snippet}

<svelte:window onclick={handleOutsideClick} />

{#if swipeActions}
  <div bind:this={wrapperEl} class="relative overflow-hidden rounded-xl">
    <div class="absolute inset-y-0 right-0 flex w-32">
      <button
        type="button"
        onclick={handleFavorite}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        class="focus-ring flex flex-1 flex-col items-center justify-center gap-1 bg-favorite text-xs font-medium text-white"
      >
        <Heart class="size-5 {isFav ? 'fill-current' : ''}" />
        Favorite
      </button>
      <button
        type="button"
        onclick={handleDelete}
        aria-label="Delete note"
        class="focus-ring flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-xs font-medium text-destructive-foreground"
      >
        <Trash2 class="size-5" />
        Delete
      </button>
    </div>

    <div
      use:swipeHorizontal={{
        directions: "left",
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onCommit: handleCommit,
        onCancel: handleCancel,
      }}
      onclickcapture={handleFrontClick}
      style="transform: translateX({dragX}px); will-change: transform"
      class={cn(
        "relative z-10",
        // Only animate when settling. Leaving the transition on during the
        // drag restarted a 150ms interpolation on every touchmove, so the
        // card trailed the finger instead of tracking it.
        !dragging && "transition-transform duration-150"
      )}
    >
      {@render cardBody()}
    </div>
  </div>
{:else}
  {@render cardBody()}
{/if}
