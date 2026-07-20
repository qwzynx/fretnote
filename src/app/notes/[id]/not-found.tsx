import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NoteNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-7" />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-semibold">
        Note not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This note may have been removed, or the link is wrong.
      </p>
      <Button className="mt-6" render={<Link href="/" />}>
        Back to the feed
      </Button>
    </main>
  );
}
