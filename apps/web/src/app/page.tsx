export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { GoogleBanner } from "@/components/GoogleBanner";
import { UniversityTicker } from "@/components/UniversityTicker";
import { ProductDemo } from "@/components/ProductDemo";
import { FeaturesShowcase } from "@/components/FeaturesShowcase";
import { CalendarShowcase } from "@/components/CalendarShowcase";
import { RecordingDemo } from "@/components/RecordingDemo";
import { Navbar } from "@/components/Navbar";
import { PricingSection } from "@/components/PricingSection";
import { ScrollReveal } from "@/components/ScrollReveal";
import { YoutubeFeatureDemo } from "@/components/YoutubeFeatureDemo";
import { FilesFeatureDemo } from "@/components/FilesFeatureDemo";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#0a0a0a", position: "relative", overflow: "hidden" }}>

      {/* Background arcs */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large arc — top left sweeping to bottom right */}
        <path
          d="M -200,800 Q 400,-200 1600,400"
          fill="none" stroke="rgba(37,99,235,0.18)" strokeWidth="1.5"
        />
        {/* Second arc — crossing, top right to bottom left */}
        <path
          d="M 1600,100 Q 800,600 -100,300"
          fill="none" stroke="rgba(37,99,235,0.12)" strokeWidth="1"
        />
        {/* Third arc — bottom sweep */}
        <path
          d="M -100,1100 Q 700,200 1600,700"
          fill="none" stroke="rgba(96,165,250,0.08)" strokeWidth="1"
        />
        {/* Subtle glow blob — top right */}
        <radialGradient id="glowA" cx="75%" cy="15%" r="40%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#glowA)" />
        {/* Subtle glow blob — bottom left */}
        <radialGradient id="glowB" cx="20%" cy="85%" r="35%">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#glowB)" />
      </svg>

      <Navbar />

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-6 md:px-16 pt-36 md:pt-52 pb-16" style={{ position: "relative", zIndex: 1 }}>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)" }}>
          <Layers size={12} style={{ color: "#60a5fa" }} />
          <span className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: "#60a5fa" }}>
            Flux — AI Study Assistant
          </span>
        </div>
        <h1 className="text-5xl md:text-7xl mb-6 leading-[1.05]" style={{ fontFamily: "’Plus Jakarta Sans’, sans-serif", fontWeight: 800, color: "white", letterSpacing: "-0.03em" }}>
          Record the lecture.<br /><span style={{ color: "#3b82f6" }}>Get the A.</span>
        </h1>
        <p className="text-base md:text-lg mb-10 leading-relaxed max-w-xl" style={{ color: "rgba(255,255,255,0.65)" }}>
          Flux turns your lecture recordings into cheat sheets, quizzes, and study books — automatically.
        </p>
        <div className="flex gap-3 mb-5">
          <Link href="/sign-up" className="font-semibold px-10 py-4 rounded-full text-base transition-all hover:opacity-90" style={{ background: "#2563eb", color: "white" }}>
            Get started free
          </Link>
          <Link href="/sign-in" className="font-medium px-10 py-4 rounded-full text-base transition-all" style={{ border: "1.5px solid rgba(255,255,255,0.2)", color: "white", background: "rgba(255,255,255,0.07)" }}>
            Sign in
          </Link>
        </div>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Free to start · No credit card needed</span>
      </div>

      {/* Wave divider */}
      <div style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="rgba(0,0,0,0.06)" />
        </svg>
      </div>

      {/* Demo */}
      <ScrollReveal className="flex justify-center px-4 md:px-12 pb-12" delay={100}>
        <ProductDemo />
      </ScrollReveal>

      {/* Recording animation demo */}
      <ScrollReveal className="flex justify-center px-4 md:px-12 pb-20" delay={150}>
        <RecordingDemo />
      </ScrollReveal>

      {/* Wave divider */}
      <div style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
          <path d="M0,20 C480,80 960,0 1440,60 L1440,80 L0,80 Z" fill="rgba(0,0,0,0.05)" />
        </svg>
      </div>

      {/* Tagline */}
      <ScrollReveal className="text-center py-10 px-6">
        <p className="text-sm uppercase tracking-[0.22em] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.8)" }}>
          Trusted by students at
        </p>
        <p className="text-2xl md:text-3xl" style={{ fontFamily: "’Plus Jakarta Sans’, sans-serif", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
          universities across the country.
        </p>
      </ScrollReveal>

      {/* University ticker */}
      <ScrollReveal>
        <UniversityTicker />
      </ScrollReveal>

      {/* Testimonials */}
      <div className="px-6 md:px-16 py-12 md:py-20 flex flex-col gap-12 md:gap-16">

        {/* Testimonial 1 — Usman */}
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8 md:gap-12">
            <div className="relative w-[200px] h-[250px] md:w-[240px] md:h-[300px] shrink-0">
              <Image src="/usman.jpeg" alt="Usman Tariq" fill className="rounded-2xl object-cover" style={{ objectPosition: "center top" }} />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl mb-4" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "’Plus Jakarta Sans’, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>
                Flux literally saved my semester. I record every business lecture and get a full cheat sheet before I even leave the classroom.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Usman Tariq</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Business Student · Queensborough Community College</div>
            </div>
          </div>
        </ScrollReveal>

        {/* Testimonial 2 — Mohamed (centered) */}
        <ScrollReveal delay={100}>
          <div className="flex flex-col items-center text-center max-w-xl mx-auto gap-6">
            <div className="relative w-[260px] h-[320px] md:w-[300px] md:h-[370px] shrink-0">
              <Image src="/mohamed.jpeg" alt="Mohamed Camara" fill className="rounded-2xl object-cover" style={{ objectPosition: "center 30%" }} />
            </div>
            <div className="flex flex-col items-center">
              <div className="text-5xl mb-4" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>
                Flux me permet de rester au top de mes cours de génie civil. Je transforme mes enregistrements en fiches de révision en quelques secondes — c'est indispensable.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Mohamed Camara</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Étudiant en Génie Civil · Université de Rennes, France</div>
            </div>
          </div>
        </ScrollReveal>

        {/* Testimonial 3 — Sira */}
        <ScrollReveal delay={100}>
          <div className="flex flex-col md:flex-row-reverse items-center md:items-stretch gap-8 md:gap-12">
            <div className="relative w-[200px] h-[250px] md:w-[240px] md:h-[340px] shrink-0">
              <Image src="/sira.png" alt="Sira Camara" fill className="rounded-2xl object-cover" style={{ objectPosition: "center 25%" }} />
            </div>
            <div className="flex flex-col justify-center md:ml-auto">
              <div className="text-5xl mb-4" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "’Plus Jakarta Sans’, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>
                Between clinicals and coursework, I barely had time to review. Flux turns my lecture recordings into study guides overnight — I actually feel prepared walking into exams now.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Sira Camara</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Nursing Student · LaGuardia Community College</div>
            </div>
          </div>
        </ScrollReveal>

      </div>

      {/* Wave divider */}
      <div style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
          <path d="M0,60 C360,0 1080,80 1440,20 L1440,80 L0,80 Z" fill="rgba(0,0,0,0.06)" />
        </svg>
      </div>

      {/* YouTube feature demo */}
      <ScrollReveal>
        <YoutubeFeatureDemo />
      </ScrollReveal>

      {/* Files feature demo */}
      <ScrollReveal>
        <FilesFeatureDemo />
      </ScrollReveal>

      {/* Calendar feature showcase */}
      <ScrollReveal>
        <CalendarShowcase />
      </ScrollReveal>

      {/* Features showcase */}
      <ScrollReveal>
        <FeaturesShowcase />
      </ScrollReveal>

      {/* Wave divider */}
      <div style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
          <path d="M0,30 C600,80 900,0 1440,50 L1440,80 L0,80 Z" fill="rgba(0,0,0,0.05)" />
        </svg>
      </div>

      {/* Pricing */}
      <ScrollReveal>
        <PricingSection />
      </ScrollReveal>

      {/* CTA footer */}
      <ScrollReveal className="py-24 text-center px-6">
        <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: "’Plus Jakarta Sans’, sans-serif", fontWeight: 800, color: "white", letterSpacing: "-0.03em" }}>
          Start studying smarter.
        </h2>
        <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Join students who stopped wasting hours making their own notes.
        </p>
        <Link href="/sign-up" className="font-semibold px-10 py-3.5 rounded-full text-sm transition-all hover:opacity-90" style={{ background: "#2563eb", color: "white" }}>
          Get started free
        </Link>
      </ScrollReveal>

      <GoogleBanner />
    </main>
  );
}

