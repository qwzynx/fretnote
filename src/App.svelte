<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import Router from "svelte-spa-router";
  import SiteHeader from "@/components/layout/SiteHeader.svelte";
  import SiteFooter from "@/components/layout/SiteFooter.svelte";
  import BottomNav from "@/components/layout/BottomNav.svelte";
  import { isPhone } from "@/lib/media.svelte";
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
  import { initOverlayHistory, closeTopLayer } from "@/lib/overlay-history.svelte";

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
      // Close the topmost sheet/dialog/popover if one is open; otherwise
      // fall through to normal browser back navigation.
      if (!closeTopLayer()) window.history.back();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKey);
    const cleanupOverlayHistory = initOverlayHistory();
    return () => {
      window.removeEventListener("keydown", handleGlobalKey);
      cleanupOverlayHistory();
    };
  });
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
  <SiteHeader />
  <!-- Padded on phones so content can always scroll clear of the floating nav. -->
  <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-navbar md:pb-0">
    <Router {routes} />
    <SiteFooter />
  </div>
  <BottomNav />
  <Toaster
    theme="dark"
    richColors
    position={isPhone.current ? "top-center" : "bottom-right"}
  />
  <SearchPalette />
  <KeyboardShortcutsHelp open={shortcutsOpen} onclose={() => (shortcutsOpen = false)} />
</div>
