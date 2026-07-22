import { Link, useLocation } from "react-router-dom";
import { Guitar, Home, PlusCircle, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Notes", icon: Home },
  { href: "/create", label: "Create", icon: PlusCircle },
];

export function SiteHeader() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-heading">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Guitar className="size-4.5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Fret<span className="text-primary">note</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to={item.href} />}
                className={cn(
                  "text-muted-foreground",
                  active && "bg-muted text-foreground"
                )}
              >
                <item.icon />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/?focus=search" />}
            className="hidden text-muted-foreground md:inline-flex"
          >
            <Search />
            Search notes
          </Button>
          <Button size="sm" nativeButton={false} render={<Link to="/create" />}>
            <PlusCircle />
            New note
          </Button>
        </div>
      </div>
    </header>
  );
}
