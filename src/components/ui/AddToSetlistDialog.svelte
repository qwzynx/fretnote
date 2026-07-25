<script lang="ts">
  import { onMount } from "svelte";
  import { Check, ListMusic, Plus, X } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { listSetlists, createSetlist, addNoteToSetlist, removeFromSetlist, getSetlistsForNote } from "@/lib/setlists";
  import type { Setlist } from "@/lib/types";

  let {
    noteId,
    open,
    onclose,
  }: {
    noteId: string;
    open: boolean;
    onclose: () => void;
  } = $props();

  let setlists = $state<Setlist[]>([]);
  let membership = $state<Map<string, string>>(new Map()); // setlistId → itemId
  let loading = $state(false);
  let newTitle = $state("");
  let addingNew = $state(false);

  async function load() {
    loading = true;
    try {
      const [sls, mems] = await Promise.all([
        listSetlists(),
        getSetlistsForNote(noteId),
      ]);
      setlists = sls;
      membership = new Map(mems.map((m) => [m.setlistId, m.itemId]));
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (open) load();
  });

  async function toggle(setlistId: string) {
    const itemId = membership.get(setlistId);
    if (itemId) {
      await removeFromSetlist(itemId);
      const next = new Map(membership);
      next.delete(setlistId);
      membership = next;
      toast.success("Removed from setlist");
    } else {
      await addNoteToSetlist(setlistId, noteId);
      const mem = await getSetlistsForNote(noteId);
      membership = new Map(mem.map((m) => [m.setlistId, m.itemId]));
      toast.success("Added to setlist");
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const s = await createSetlist(newTitle.trim());
    setlists = [s, ...setlists];
    await addNoteToSetlist(s.id, noteId);
    const mem = await getSetlistsForNote(noteId);
    membership = new Map(mem.map((m) => [m.setlistId, m.itemId]));
    newTitle = "";
    addingNew = false;
    toast.success(`Added to "${s.title}"`);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Add to setlist"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
    onkeydown={handleKeydown}
  >
    <!-- Bottom sheet on phones, centred dialog on larger screens. -->
    <div
      class="w-full overflow-hidden rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)] shadow-2xl sm:max-w-sm sm:rounded-xl sm:border sm:pb-0"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2 font-medium">
          <ListMusic class="size-4 text-primary" />
          Add to setlist
        </div>
        <button
          type="button"
          onclick={onclose}
          class="-mr-1.5 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:bg-muted sm:-mr-0 sm:size-6"
          aria-label="Close"
        >
          <X class="size-5 sm:size-4" />
        </button>
      </div>

      <div class="max-h-[45vh] overflow-y-auto overscroll-contain py-1 sm:max-h-64">
        {#if loading}
          <p class="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
        {:else if setlists.length === 0}
          <p class="px-4 py-4 text-sm text-muted-foreground">No setlists yet.</p>
        {:else}
          {#each setlists as s (s.id)}
            {@const inList = membership.has(s.id)}
            <button
              type="button"
              onclick={() => toggle(s.id)}
              class="flex w-full items-center gap-3 px-4 py-3.5 text-left text-base hover:bg-muted active:bg-muted sm:py-2.5 sm:text-sm"
            >
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded border {inList
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border'}"
              >
                {#if inList}
                  <Check class="size-3" />
                {/if}
              </span>
              <span class="flex-1 truncate">{s.title}</span>
              <span class="text-xs text-muted-foreground">{s.noteCount ?? 0}</span>
            </button>
          {/each}
        {/if}
      </div>

      <div class="border-t border-border p-3">
        {#if addingNew}
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newTitle}
              placeholder="Setlist name…"
              onkeydown={(e) => e.key === "Enter" && handleCreate()}
              class="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 sm:h-8 sm:text-sm"
            />
            <button
              type="button"
              onclick={handleCreate}
              disabled={!newTitle.trim()}
              class="h-10 shrink-0 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50 sm:h-8"
            >
              Create
            </button>
            <button
              type="button"
              onclick={() => (addingNew = false)}
              class="h-10 shrink-0 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground sm:h-8"
            >
              Cancel
            </button>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => (addingNew = true)}
            class="flex h-10 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground sm:h-auto"
          >
            <Plus class="size-4" />
            New setlist
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
