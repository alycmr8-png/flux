import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/I18nProvider";
import { FeedbackProvider } from "@/components/Feedback";
import { LangProvider } from "@/lib/useTr";
import { getLang } from "@/lib/lang";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flux",
  description: "The AI that went to every one of your classes. Capture lectures, videos, files and notes — then ask your course anything, with sources.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Keep pinch-zoom available for accessibility (no maximumScale lock)
  themeColor: "#243744",
  viewportFit: "cover", // draw under the notch / use safe-area insets
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved here so every page — server-rendered or not — paints in the
  // visitor's language from the very first byte of HTML.
  const lang = await getLang();
  return (
    <ClerkProvider>
      <html lang={lang}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700;1,800&family=Jost:wght@300;400;500;600&family=Caveat:wght@500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="antialiased"><LangProvider lang={lang}><I18nProvider><FeedbackProvider>{children}</FeedbackProvider></I18nProvider></LangProvider></body>
      </html>
    </ClerkProvider>
  );
}

