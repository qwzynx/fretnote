<script lang="ts">
  import CreateNoteForm from "@/components/create/CreateNoteForm.svelte";

  let { params }: { params?: { id?: string } } = $props();
  const editId = $derived(params?.id);
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8 lg:flex lg:h-full lg:flex-col lg:py-0">
  <h1 class="mb-6 font-heading text-2xl font-semibold lg:mb-4 lg:shrink-0 lg:pt-6">
    {editId ? "Edit note" : "New note"}
  </h1>
  <div class="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
    <CreateNoteForm {editId} />
  </div>
</main>
