<script lang="ts">
  import { router } from "svelte-spa-router";
  import { Guitar, Home, PlusCircle, Search } from "@lucide/svelte";
  import Button from "@/components/ui/Button.svelte";
  import { cn } from "@/lib/utils";

  const NAV = [
    { href: "/", label: "Notes", icon: Home },
    { href: "/create", label: "Create", icon: PlusCircle },
  ];
</script>

<header class="sticky top-0 z-40 border-b border-border/80 bg-background">
  <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
    <a href="#/" class="flex items-center gap-2 font-heading">
      <span
        class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25"
      >
        <Guitar class="size-4.5" />
      </span>
      <span class="text-lg font-semibold tracking-tight">
        Fret<span class="text-primary">note</span>
      </span>
    </a>

    <nav class="ml-2 hidden items-center gap-1 sm:flex">
      {#each NAV as item}
        {@const active =
          item.href === "/"
            ? router.location === "/"
            : router.location.startsWith(item.href)}
        <a
          href={`#${item.href}`}
          class={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium transition-colors",
            active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <svelte:component this={item.icon} class="size-3.5" />
          {item.label}
        </a>
      {/each}
    </nav>

    <div class="ml-auto flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        href="#/"
        class="hidden text-muted-foreground md:inline-flex"
      >
        <Search />
        Search notes
      </Button>
      <Button size="sm" href="#/create">
        <PlusCircle />
        New note
      </Button>
    </div>
  </div>
</header>
