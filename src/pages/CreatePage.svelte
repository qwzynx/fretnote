<script lang="ts">
  import CreateNoteForm from "@/components/create/CreateNoteForm.svelte";

  let { params }: { params?: { id?: string } } = $props();
  const editId = $derived(params?.id);
</script>

<main class="w-full py-8 lg:flex lg:h-full lg:flex-col lg:py-0">
  <!-- Title stays centered to the max-w-6xl grid -->
  <div class="mx-auto w-full max-w-6xl px-4 lg:shrink-0">
    <h1 class="mb-6 font-heading text-2xl font-semibold lg:mb-4 lg:pt-6">
      {editId ? "Edit note" : "New note"}
    </h1>
  </div>
  <!-- Form area is full-width on lg+ so each column's scroll hitbox reaches the screen edge -->
  <div class="mx-auto w-full max-w-6xl px-4 lg:mx-0 lg:max-w-none lg:px-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
    <CreateNoteForm {editId} />
  </div>
</main>
