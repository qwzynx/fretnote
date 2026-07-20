import type { Metadata } from "next";
import { PlusCircle } from "lucide-react";

import { CreateNoteForm } from "@/components/create/create-note-form";

export const metadata: Metadata = {
  title: "Create Note",
  description: "Write a new chord chart or tab.",
};

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
          <PlusCircle className="size-5" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Create a note</h1>
          <p className="text-sm text-muted-foreground">
            Write chords over lyrics or build a tab, then share with the community.
          </p>
        </div>
      </div>

      <CreateNoteForm />
    </main>
  );
}
