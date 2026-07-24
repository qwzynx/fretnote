<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import Router from "svelte-spa-router";
  import SiteHeader from "@/components/layout/SiteHeader.svelte";
  import SiteFooter from "@/components/layout/SiteFooter.svelte";
  import { Toaster } from "svelte-sonner";
  import FeedPage from "@/pages/FeedPage.svelte";
  import CreatePage from "@/pages/CreatePage.svelte";
  import NotePage from "@/pages/NotePage.svelte";
  import SettingsPage from "@/pages/SettingsPage.svelte";
  import SetlistsPage from "@/pages/SetlistsPage.svelte";
  import SetlistPage from "@/pages/SetlistPage.svelte";
  import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp.svelte";
  import SearchPalette from "@/components/SearchPalette.svelte";
  import { searchOpenStore } from "@/lib/search-open.svelte";

  const routes = {
    "/": FeedPage,
    "/create": CreatePage,
    "/notes/:id/edit": CreatePage,
    "/notes/:id": NotePage,
    "/settings": SettingsPage,
    "/setlists": SetlistsPage,
    "/setlists/:id": SetlistPage,
  };

  let shortcutsOpen = $state(false);

  function isTyping(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement;
    return el.matches("input, textarea, select, [contenteditable]");
  }

  function handleGlobalKey(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === "n") {
      e.preventDefault();
      push("/create");
      return;
    }

    if (ctrl && e.key === "k") {
      e.preventDefault();
      searchOpenStore.toggle();
      return;
    }

    if (isTyping(e)) return;

    if (e.key === "?") {
      shortcutsOpen = true;
      return;
    }

    if (e.key === "Escape") {
      window.history.back();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  });
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
  <SiteHeader />
  <div class="min-h-0 flex-1 overflow-y-auto">
    <Router {routes} />
  </div>
  <SiteFooter />
  <Toaster theme="dark" richColors />
  <SearchPalette />
  <KeyboardShortcutsHelp open={shortcutsOpen} onclose={() => (shortcutsOpen = false)} />
</div>
