<script lang="ts">
  import CreateNoteForm from "@/components/create/CreateNoteForm.svelte";

  let { params }: { params?: { id?: string } } = $props();
  const editId = $derived(params?.id);
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8">
  <h1 class="mb-6 font-heading text-2xl font-semibold">
    {editId ? "Edit note" : "New note"}
  </h1>
  <CreateNoteForm {editId} />
</main>
