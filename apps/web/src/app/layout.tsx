import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/components/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flux",
  description: "Record lectures. AI generates your cheat sheets and quizzes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700;1,800&family=Jost:wght@300;400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="text-black antialiased" style={{ background: "#a8b9a3" }}><I18nProvider>{children}</I18nProvider></body>
      </html>
    </ClerkProvider>
  );
}

