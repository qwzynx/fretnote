<script lang="ts">
  import { onMount } from "svelte";
  import { ListMusic, Music2, Plus, Trash2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { listSetlists, createSetlist, deleteSetlist } from "@/lib/setlists";
  import type { Setlist } from "@/lib/types";
  import Button from "@/components/ui/Button.svelte";
  import Input from "@/components/ui/Input.svelte";
  import Label from "@/components/ui/Label.svelte";
  import Separator from "@/components/ui/Separator.svelte";
  import Card from "@/components/ui/Card.svelte";
  import CardContent from "@/components/ui/CardContent.svelte";
  import CardFooter from "@/components/ui/CardFooter.svelte";

  let setlists = $state<Setlist[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let newTitle = $state("");
  let newDesc = $state("");
  let saving = $state(false);

  onMount(async () => {
    try {
      setlists = await listSetlists();
    } finally {
      loading = false;
    }
  });

  async function handleCreate() {
    if (!newTitle.trim()) return;
    saving = true;
    try {
      const s = await createSetlist(newTitle.trim(), newDesc.trim());
      setlists = [s, ...setlists];
      newTitle = "";
      newDesc = "";
      creating = false;
      toast.success("Setlist created");
    } catch {
      toast.error("Failed to create setlist");
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete setlist "${title}"?`)) return;
    await deleteSetlist(id);
    setlists = setlists.filter((s) => s.id !== id);
    toast.success("Setlist deleted");
  }
</script>

<main class="mx-auto w-full max-w-4xl px-4 py-8">
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span
        class="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25"
      >
        <ListMusic class="size-5" />
      </span>
      <div>
        <h1 class="font-heading text-2xl font-semibold tracking-tight">Setlists</h1>
        <p class="text-sm text-muted-foreground">
          Group notes into ordered playlists for performances.
        </p>
      </div>
    </div>
    <Button onclick={() => (creating = !creating)}>
      <Plus />
      New setlist
    </Button>
  </div>

  {#if creating}
    <div class="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 class="mb-4 font-heading text-base font-semibold">New setlist</h2>
      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label for="sl-title">Title</Label>
          <Input id="sl-title" placeholder="e.g. Friday Night Gig" bind:value={newTitle} />
        </div>
        <div class="space-y-1.5">
          <Label for="sl-desc">Description (optional)</Label>
          <Input id="sl-desc" placeholder="e.g. Acoustic set" bind:value={newDesc} />
        </div>
        <div class="flex gap-2">
          <Button disabled={saving || !newTitle.trim()} onclick={handleCreate}>
            {saving ? "Creating…" : "Create setlist"}
          </Button>
          <Button variant="outline" onclick={() => (creating = false)}>Cancel</Button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="text-sm text-muted-foreground">Loading…</p>
  {:else if setlists.length === 0}
    <div class="rounded-xl border border-dashed border-border py-20 text-center">
      <Music2 class="mx-auto mb-3 size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">No setlists yet.</p>
      <Button size="sm" class="mt-4" onclick={() => (creating = true)}>
        <Plus />
        Create your first setlist
      </Button>
    </div>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each setlists as s (s.id)}
        <Card class="group/sl gap-0 py-0 hover:ring-primary/40">
          <a href={`#/setlists/${s.id}`} class="outline-none">
            <CardContent class="flex flex-col gap-2 px-4 py-4">
              <div class="flex items-start justify-between gap-2">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListMusic class="size-4" />
                </span>
                <span class="text-xs text-muted-foreground">
                  {s.noteCount ?? 0} {(s.noteCount ?? 0) === 1 ? "song" : "songs"}
                </span>
              </div>
              <div>
                <h3 class="font-heading text-base font-semibold leading-tight group-hover/sl:text-primary">
                  {s.title}
                </h3>
                {#if s.description}
                  <p class="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
                {/if}
              </div>
            </CardContent>
          </a>
          <CardFooter class="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5">
            <span class="text-xs text-muted-foreground">
              {new Date(s.createdAt).toLocaleDateString()}
            </span>
            <button
              type="button"
              onclick={() => handleDelete(s.id, s.title)}
              class="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Delete setlist"
            >
              <Trash2 class="size-3.5" />
            </button>
          </CardFooter>
        </Card>
      {/each}
    </div>
  {/if}
</main>
