import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/I18nProvider";
import { FeedbackProvider } from "@/components/Feedback";
import { LangProvider } from "@/lib/useTr";
import { getLang } from "@/lib/lang";
import { SITE_URL } from "@/lib/site";
import "katex/dist/katex.min.css";
import "./globals.css";

const DESCRIPTION =
  "The AI that went to every one of your classes. Capture lectures, videos, files and notes — then ask your course anything, with sources.";

export const metadata: Metadata = {
  // metadataBase makes every canonical and OpenGraph URL absolute. Without it Next
  // emits relative ones, and a relative og:image does not render at all when
  // Instagram, iMessage or Slack fetches the link.
  metadataBase: new URL(SITE_URL),
  title: { default: "Ucorns", template: "%s — Ucorns" },
  description: DESCRIPTION,
  applicationName: "Ucorns",
  keywords: [
    "lecture recording", "lecture notes", "study app", "AI notes",
    "flashcards", "transcription", "university", "college",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Ucorns",
    title: "Ucorns — the AI that went to every one of your classes",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ucorns — the AI that went to every one of your classes",
    description: DESCRIPTION,
  },
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
  const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
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
        <body className="antialiased"><LangProvider lang={lang}><I18nProvider><FeedbackProvider>{children}</FeedbackProvider></I18nProvider></LangProvider>
          {/*
            Cloudflare Web Analytics: visitor counts and referrers, so a campaign can
            be told apart from nothing happening. Cookieless and storing no personal
            data, which is why it needs no consent banner — a cookie-based tracker
            would need one for French and other EU visitors, and a named processor in
            the Privacy Policy.

            Absent until NEXT_PUBLIC_CF_BEACON_TOKEN is set, so no build ships a
            script tag pointing at nothing.
          */}
          {beaconToken && (
            <script
              // type="module" is what Cloudflare's own snippet ships; the file is an
              // ES module, so loading it as a classic deferred script fails silently
              // and no data is ever recorded. Modules defer by default.
              type="module"
              src="https://static.cloudflareinsights.com/beacon.min.js"
              data-cf-beacon={JSON.stringify({ token: beaconToken })}
            />
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}

