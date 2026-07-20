"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Guitar, Home, PlusCircle, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/create", label: "Create", icon: PlusCircle },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-heading">
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
                render={<Link href={item.href} />}
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
            render={<Link href="/?focus=search" />}
            className="hidden text-muted-foreground md:inline-flex"
          >
            <Search />
            Search notes
          </Button>
          <Button size="sm" render={<Link href="/create" />}>
            <PlusCircle />
            New note
          </Button>
        </div>
      </div>
    </header>
  );
}
