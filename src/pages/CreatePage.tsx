import { useParams } from "react-router-dom";
import { CreateNoteForm } from "@/components/create/create-note-form";

export function CreatePage() {
  const { id } = useParams();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">
        {id ? "Edit note" : "New note"}
      </h1>
      <CreateNoteForm editId={id} />
    </main>
  );
}
