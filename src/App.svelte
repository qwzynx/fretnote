<script lang="ts">
  import Router from "svelte-spa-router";
  import SiteHeader from "@/components/layout/SiteHeader.svelte";
  import SiteFooter from "@/components/layout/SiteFooter.svelte";
  import { Toaster } from "svelte-sonner";
  import FeedPage from "@/pages/FeedPage.svelte";
  import CreatePage from "@/pages/CreatePage.svelte";
  import NotePage from "@/pages/NotePage.svelte";

  const routes = {
    "/": FeedPage,
    "/create": CreatePage,
    "/notes/:id/edit": CreatePage,
    "/notes/:id": NotePage,
  };
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
  <SiteHeader />
  <div class="min-h-0 flex-1 overflow-y-auto">
    <Router {routes} />
  </div>
  <SiteFooter />
  <Toaster theme="dark" richColors />
</div>
