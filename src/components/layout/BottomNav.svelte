<script lang="ts">
  import { router } from "svelte-spa-router";
  import { Home, ListMusic, Plus, Search, Settings } from "@lucide/svelte";
  import { cn } from "@/lib/utils";
  import { searchOpenStore } from "@/lib/search-open.svelte";

  const ITEMS = [
    { href: "/", label: "Notes", icon: Home },
    { href: "/setlists", label: "Setlists", icon: ListMusic },
  ] as const;

  const TRAILING = [
    { href: "/settings", label: "Settings", icon: Settings },
  ] as const;

  const isActive = (href: string) =>
    href === "/" ? router.location === "/" : router.location.startsWith(href);
</script>

<!--
  Floating pill: fixed above the content, clear of the home indicator, and
  hidden from `md` up where the header nav takes over.
-->
<nav
  aria-label="Primary"
  class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:hidden"
>
  <div
    class="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-border/70 bg-card/85 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl"
  >
    {#each ITEMS as item}
      {@const active = isActive(item.href)}
      <a
        href={`#${item.href}`}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        class={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground active:bg-muted"
        )}
      >
        <svelte:component this={item.icon} class="size-5" />
      </a>
    {/each}

    <a
      href="#/create"
      aria-label="New note"
      class="mx-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-95"
    >
      <Plus class="size-5" />
    </a>

    <button
      type="button"
      onclick={() => searchOpenStore.show()}
      aria-label="Search notes"
      class="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
    >
      <Search class="size-5" />
    </button>

    {#each TRAILING as item}
      {@const active = isActive(item.href)}
      <a
        href={`#${item.href}`}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        class={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground active:bg-muted"
        )}
      >
        <svelte:component this={item.icon} class="size-5" />
      </a>
    {/each}
  </div>
</nav>
