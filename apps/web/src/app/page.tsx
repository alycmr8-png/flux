export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";

import { GoogleBanner } from "@/components/GoogleBanner";
import { CapabilityTicker } from "@/components/CapabilityTicker";
import { DemoQuote } from "@/components/HeroQuote";
import { ProductDemo } from "@/components/ProductDemo";
import { RecordingDemo } from "@/components/RecordingDemo";
import { BoardPhotoDemo } from "@/components/BoardPhotoDemo";
import { CourseMemoryDemo } from "@/components/CourseMemoryDemo";
import { Navbar } from "@/components/Navbar";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { Hero3DLogo } from "@/components/Hero3DLogo";
import { PricingSection } from "@/components/PricingSection";
import { ScrollReveal } from "@/components/ScrollReveal";
import { FaqSection } from "@/components/FaqSection";
import { getLang } from "@/lib/lang";
import { makeTranslator } from "@sano/i18n/ui";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  const lang = await getLang();
  // A server component cannot use the hook — the translator itself is a plain function.
  const tr = makeTranslator(lang);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#ffffff", position: "relative", overflow: "hidden" }}>

      <Navbar />

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-6 md:px-16 pt-36 md:pt-44 pb-16" style={{ position: "relative", zIndex: 1 }}>

        {/* hero background — soft blue glow + fading dot grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            pointerEvents: "none",
            background:
              "radial-gradient(58% 48% at 50% 0%, rgba(75,95,232,0.12) 0%, rgba(75,95,232,0.05) 45%, transparent 72%)," +
              "radial-gradient(34% 30% at 88% 18%, rgba(159,123,250,0.08) 0%, transparent 70%)," +
              "radial-gradient(40% 34% at 8% 62%, rgba(110,127,243,0.06) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            pointerEvents: "none",
            backgroundImage: "radial-gradient(rgba(15,17,21,0.08) 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 55%, transparent 88%)",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 55%, transparent 88%)",
          }}
        />

        {/* 3D animated Flux logo */}
        <div className="w-full mb-6" style={{ position: "relative" }}>
          <Hero3DLogo />
        </div>

        {/* hero content — open, no box */}
        <div className="flex flex-col items-center text-center w-full" style={{ position: "relative", maxWidth: 900 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-9" style={{ background: "rgba(75,95,232,0.08)", border: "1px solid rgba(75,95,232,0.25)" }}>
            <Layers size={12} style={{ color: "#4B5FE8" }} />
            <span className="text-[10px] md:text-xs uppercase tracking-[0.12em] md:tracking-[0.2em] font-semibold" style={{ color: "#4B5FE8" }}>
              {tr("Built for university students")}
            </span>
          </div>
          <h1 className="mb-6 leading-[1.05]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(30px, 6.4vw, 64px)", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.03em" }}>
            {tr("Record the lecture.")}{" "}
            <br />
            <span
              style={{
                backgroundImage: "linear-gradient(110deg, #4B5FE8 0%, #6E7FF3 55%, #9F7BFA 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {tr("Get the flashcards, quiz")}{" "}
              <br className="hidden md:inline" />
              {tr("and summary.")}
            </span>
          </h1>
          <p className="text-base md:text-lg mb-7 leading-relaxed max-w-xl" style={{ color: "rgba(15,17,21,0.6)" }}>
            {tr("Flux turns your recordings, PDFs, slides and YouTube links into study material — then answers anything about your course, cited to the lecture and the minute.")}
          </p>
          <div className="mb-9 px-2 w-full flex justify-center">
            <RotatingPrompts />
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-5">
            <Link
              href="/sign-up"
              className="font-semibold px-10 py-4 rounded-full text-base transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(135deg, #4B5FE8 0%, #6E7FF3 100%)",
                color: "white",
                boxShadow: "0 10px 30px rgba(75,95,232,0.35)",
              }}
            >
              {tr("Get started free →")}
            </Link>
            <Link
              href="/sign-in"
              className="font-medium px-10 py-4 rounded-full text-base transition-all hover:border-[rgba(75,95,232,0.4)]"
              style={{ border: "1.5px solid rgba(15,17,21,0.15)", color: "#0f1115", background: "white" }}
            >
              {tr("Sign in")}
            </Link>
          </div>
          <span className="text-sm" style={{ color: "rgba(15,17,21,0.4)" }}>{tr("Free to start · No credit card needed")}</span>
        </div>
      </div>

      {/* Demo */}
      <div className="relative py-14 md:py-20">
        <ScrollReveal className="relative z-10 flex justify-center px-4 md:px-12 pb-12" delay={100}>
          <div className="relative">
            <ProductDemo />
          </div>
        </ScrollReveal>
      </div>

      {/* How it works */}
      <ScrollReveal id="how-it-works" className="px-6 md:px-16 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>{tr("How it works")}</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4.5vw, 44px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {tr("One recording.")}<br />{tr("Everything you need.")}
            </h2>
            <p className="text-base md:text-lg mt-5 max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(0,0,0,0.55)" }}>
              {tr("Imagine you're taking Calculus. You hit record and the words appear on screen as they're said. The professor fills the board, so you photograph it — Flux reads the formulas straight off the photo. When the lecture ends, one tap turns all of it into study material.")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "01", title: tr("Record, and read along"), text: tr("Words appear on screen as they're spoken. Photograph the whiteboard and Flux reads it into the same transcript — including the formulas.") },
              { n: "02", title: tr("Six things from one tap"), text: tr("Summary, full transcript, key points, flashcards, a practice quiz, and a chat that knows this lecture. Generated once, yours forever.") },
              { n: "03", title: tr("Ask your whole course"), text: tr("Every lecture and note becomes one memory per class. Ask anything and the answer cites the lecture and the minute it was said.") },
            ].map(step => (
              <div key={step.n} className="rounded-2xl p-7" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 13, color: "#6E7FF3", letterSpacing: "0.1em", marginBottom: 14 }}>{step.n}</div>
                <div className="text-lg font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0f1115", letterSpacing: "-0.01em" }}>{step.title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.5)" }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Capture step — recording demo */}
      <ScrollReveal className="flex flex-col items-center px-4 md:px-12 pb-20 gap-8" delay={150}>
        <div className="text-center max-w-2xl">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>{tr("Step 1 — Capture")}</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 5vw, 52px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
            {tr("Watch it write itself.")}<br />{tr("While the lecture happens.")}
          </h2>
          <p style={{ fontSize: 18, color: "rgba(0,0,0,0.5)", lineHeight: 1.65 }}>
            {tr("The transcript builds live as your professor talks, so you can follow along instead of scribbling. Photograph the board and those formulas join the same notes — written properly as ∫₀¹ x² dx, not \u201cthe integral from zero to one of x squared\u201d.")}
          </p>
        </div>
        <div className="relative">
          <RecordingDemo />
        </div>
      </ScrollReveal>

      {/* Board photos attached to the recording */}
      <ScrollReveal className="flex flex-col items-center px-4 md:px-12 pb-20 gap-8" delay={150}>
        <div className="text-center max-w-2xl">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>{tr("Step 2 — The board")}</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 5vw, 52px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
            {tr("It reads the board.")}<br />{tr("Formulas and all.")}
          </h2>
          <p style={{ fontSize: 18, color: "rgba(0,0,0,0.5)", lineHeight: 1.65 }}>
            {tr("Photograph what the professor wrote and Flux attaches it to the same lecture, reading the handwriting into real notation — so the summary and the quiz cover what went on the board but was never said out loud.")}
          </p>
        </div>
        <div className="relative w-full flex justify-center">
          <BoardPhotoDemo />
        </div>
      </ScrollReveal>

      {/* The goal — course memory + cited answers */}
      <div style={{ background: "linear-gradient(180deg, rgba(75,95,232,0.05) 0%, rgba(75,95,232,0.01) 100%)" }}>
      <ScrollReveal className="flex flex-col items-center px-4 md:px-12 py-16 md:py-24 gap-10">
        <div className="text-center max-w-2xl">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>{tr("Step 3 — Ask")}</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 5vw, 52px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
            {tr("Six ways to study it.")}<br />
            <span style={{ backgroundImage: "linear-gradient(110deg, #4B5FE8 0%, #6E7FF3 55%, #9F7BFA 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {tr("From one recording.")}
            </span>
          </h2>
          <p style={{ fontSize: 18, color: "rgba(0,0,0,0.5)", lineHeight: 1.65 }}>
            {tr("Summary, transcript, key points, flashcards, a practice quiz, and a chat that answers from this lecture alone. Ask across the whole class and every answer is cited to the lecture and the minute — one click from replaying what was actually said.")}
          </p>
        </div>
        <div className="relative">
          <DemoQuote quote={'it said "Lecture 7 · 32:10" like a receipt 💀'} side="right" top={24} />
          <CourseMemoryDemo />
        </div>
      </ScrollReveal>
      </div>

      {/* Tagline */}
      <ScrollReveal className="text-center py-10 px-6">
        <p className="text-sm uppercase tracking-[0.22em] font-semibold mb-3" style={{ color: "rgba(0,0,0,0.8)" }}>
          {tr("Built for how you actually take notes")}
        </p>
        <p className="text-2xl md:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>
          {tr("Every lecture. Every formula. Every class.")}
        </p>
      </ScrollReveal>

      {/* Capability ticker */}
      <ScrollReveal>
        <CapabilityTicker />
      </ScrollReveal>

      {/* Pricing */}
      <div id="pricing">
        <ScrollReveal>
          <PricingSection />
        </ScrollReveal>
      </div>

      {/* FAQ */}
      <ScrollReveal>
        <FaqSection />
      </ScrollReveal>

      {/* CTA footer */}
      <ScrollReveal className="py-24 text-center px-6">
        <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.03em" }}>
          {tr("Walk out of class")} <span style={{ color: "#6E7FF3" }}>{tr("already revised.")}</span>
        </h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>
          {tr("Record it once. Keep the transcript, the summary, the flashcards and the quiz — and ask your course anything, all semester long.")}
        </p>
        <Link href="/sign-up" className="font-semibold px-10 py-3.5 rounded-full text-sm transition-all hover:opacity-90" style={{ background: "#4B5FE8", color: "white" }}>
          {tr("Get started free")}
        </Link>
      </ScrollReveal>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.08)", position: "relative", zIndex: 1 }}>
        <div className="max-w-6xl mx-auto px-6 md:px-16 py-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#4B5FE8" }}>
                <Layers size={21} style={{ color: "#FFFFFF" }} />
              </div>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#0f1115", letterSpacing: "-0.6px" }}>
                Fl<span style={{ color: "#6E7FF3" }}>u</span>x
              </span>
            </div>
            <p className="text-[19px] max-w-[360px] text-center md:text-left" style={{ color: "rgba(0,0,0,0.65)", lineHeight: 1.5, fontWeight: 500 }}>
              {tr("Your lecture, already written down.")}
            </p>
          </div>
          <div className="flex gap-12">
            <div className="flex flex-col gap-3.5">
              <span className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(0,0,0,0.5)" }}>{tr("Product")}</span>
              <Link href="#how-it-works" className="text-[17px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.7)" }}>{tr("How it works")}</Link>
              <Link href="#pricing" className="text-[17px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.7)" }}>{tr("Pricing")}</Link>
              <Link href="#faq" className="text-[17px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.7)" }}>FAQ</Link>
            </div>
            <div className="flex flex-col gap-3.5">
              <span className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(0,0,0,0.5)" }}>{tr("Account")}</span>
              <Link href="/sign-up" className="text-[17px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.7)" }}>{tr("Get started")}</Link>
              <Link href="/sign-in" className="text-[17px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.7)" }}>{tr("Sign in")}</Link>
            </div>
          </div>
        </div>
        <div className="text-center pb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <Link href="/privacy" className="text-[14px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.6)" }}>{tr("Privacy Policy")}</Link>
            <Link href="/terms" className="text-[14px] hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.6)" }}>{tr("Terms of Service")}</Link>
          </div>
          <span className="text-[14px]" style={{ color: "rgba(0,0,0,0.45)" }}>© {new Date().getFullYear()} Flux. {tr("All rights reserved.")}</span>
        </div>
      </footer>

      <GoogleBanner />
    </main>
  );
}

