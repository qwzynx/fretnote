import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeedPage } from "@/pages/FeedPage";
import { CreatePage } from "@/pages/CreatePage";
import { NotePage } from "@/pages/NotePage";

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
          <SiteHeader />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<FeedPage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/notes/:id" element={<NotePage />} />
              <Route path="/notes/:id/edit" element={<CreatePage />} />
            </Routes>
          </div>
          <SiteFooter />
          <Toaster />
        </div>
      </TooltipProvider>
    </BrowserRouter>
  );
}
