import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Fretnote — Chords & tabs for every song",
    template: "%s · Fretnote",
  },
  description:
    "Create, transpose and share guitar chords and tabs alongside lyrics. Your songbook, in the studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ ["--font-sans" as string]: "var(--font-geist-sans)" }}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
