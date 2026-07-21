import { Link } from "react-router-dom";
import { Guitar } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Guitar className="size-4 text-primary" />
          <span>
            <span className="font-medium text-foreground">Fretnote</span> —
            chords &amp; tabs for every song.
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Notes
          </Link>
          <Link to="/create" className="hover:text-foreground">
            Create
          </Link>
        </nav>
      </div>
    </footer>
  );
}
