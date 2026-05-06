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

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#111110" }}>
      <Navbar />

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-6 md:px-16 pt-36 md:pt-48 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <Layers size={18} style={{ color: "white" }} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
            Flux — Study Assistant
          </span>
        </div>
        <h1 className="italic text-4xl md:text-6xl text-white mb-5 leading-tight" style={{ fontFamily: "’Playfair Display’, Georgia, serif", fontWeight: 400 }}>
          Your 24/7<br />AI study team.
        </h1>
        <p className="text-sm md:text-base mb-10 leading-relaxed max-w-sm md:max-w-none" style={{ color: "rgba(255,255,255,0.5)" }}>
          You record the lecture. You get flashcards, quizzes,
          practice tests, and more — built from exactly what you need to know.
        </p>
        <div className="flex gap-3 mb-4">
          <Link href="/sign-up" className="bg-white text-[#111110] font-medium px-7 py-2.5 rounded-full text-sm hover:bg-[#eee] transition-colors">
            Get started free
          </Link>
          <Link href="/sign-in" className="border font-medium px-7 py-2.5 rounded-full text-sm transition-colors" style={{ borderColor: "rgba(255,255,255,0.15)", color: "white" }}>
            Sign in
          </Link>
        </div>
        <Link href="/pricing" className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
          View pricing →
        </Link>
      </div>

      {/* Demo */}
      <div className="flex justify-center px-4 md:px-12 pb-12">
        <ProductDemo />
      </div>

      {/* Recording animation demo */}
      <div className="flex justify-center px-4 md:px-12 pb-20">
        <RecordingDemo />
      </div>

      {/* Tagline */}
      <div className="text-center pb-10">
        <p className="text-sm uppercase tracking-widest font-semibold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          Focus on the grade, not the busywork.
        </p>
        <p className="text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "white" }}>
          With Flux, straight A&apos;s.
        </p>
      </div>

      {/* University ticker */}
      <UniversityTicker />

      {/* Testimonials */}
      <div className="px-6 md:px-16 py-12 md:py-20 flex flex-col gap-12 md:gap-16">

        {/* Testimonial 1 — Usman */}
        <div className="flex flex-col md:flex-row items-center md:items-stretch gap-8 md:gap-12">
          <div className="relative w-[200px] h-[250px] md:w-[240px] md:h-[300px] shrink-0">
            <Image
              src="/usman.jpeg"
              alt="Usman Tariq"
              fill
              className="rounded-2xl object-cover"
              style={{ objectPosition: "center top" }}
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="text-5xl mb-4" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
            <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "white" }}>
              Flux literally saved my semester. I record every business lecture and get a full cheat sheet before I even leave the classroom.
            </p>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Usman Tariq</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Business Student · Queensborough Community College</div>
          </div>
        </div>

        {/* Testimonial 2 — Sira */}
        <div className="flex flex-col md:flex-row-reverse items-center md:items-stretch gap-8 md:gap-12">
          <div className="relative w-[200px] h-[250px] md:w-[240px] md:h-[340px] shrink-0">
            <Image
              src="/sira.png"
              alt="Sira Camara"
              fill
              className="rounded-2xl object-cover"
              style={{ objectPosition: "center 25%" }}
            />
          </div>
          <div className="flex flex-col justify-center md:ml-auto">
            <div className="text-5xl mb-4" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
            <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "white" }}>
              Between clinicals and coursework, I barely had time to review. Flux turns my lecture recordings into study guides overnight — I actually feel prepared walking into exams now.
            </p>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Sira Camara</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Nursing Student · LaGuardia Community College</div>
          </div>
        </div>

      </div>

      {/* Calendar feature showcase */}
      <CalendarShowcase />

      {/* Features showcase */}
      <FeaturesShowcase />

      {/* Pricing */}
      <PricingSection />

      {/* CTA footer */}
      <div className="py-20 text-center">
        <h2 className="text-3xl mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "white" }}>
          Ready to study smarter?
        </h2>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>Free to start. No credit card needed.</p>
        <Link href="/sign-up" className="bg-white text-[#111110] font-medium px-8 py-3 rounded-full text-sm hover:bg-[#eee] transition-colors">
          Get started free
        </Link>
      </div>

      <GoogleBanner />
    </main>
  );
}

