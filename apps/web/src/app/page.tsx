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
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { Hero3DLogo } from "@/components/Hero3DLogo";
import { PricingSection } from "@/components/PricingSection";
import { ScrollReveal } from "@/components/ScrollReveal";
import { YoutubeFeatureDemo } from "@/components/YoutubeFeatureDemo";
import { FilesFeatureDemo } from "@/components/FilesFeatureDemo";
import { FaqSection } from "@/components/FaqSection";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

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
            <span className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: "#4B5FE8" }}>
              Flux — Built for university students
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl mb-6 leading-[1.05]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.03em" }}>
            The AI that went to<br />
            <span
              style={{
                backgroundImage: "linear-gradient(110deg, #4B5FE8 0%, #6E7FF3 55%, #9F7BFA 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              every one of your classes.
            </span>
          </h1>
          <p className="text-base md:text-lg mb-7 leading-relaxed max-w-xl" style={{ color: "rgba(15,17,21,0.6)" }}>
            Record lectures, paste videos, drop files, take notes. Flux remembers your whole semester — ask your course anything and get answers with sources.
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
              Get started free →
            </Link>
            <Link
              href="/sign-in"
              className="font-medium px-10 py-4 rounded-full text-base transition-all hover:border-[rgba(75,95,232,0.4)]"
              style={{ border: "1.5px solid rgba(15,17,21,0.15)", color: "#0f1115", background: "white" }}
            >
              Sign in
            </Link>
          </div>
          <span className="text-sm" style={{ color: "rgba(15,17,21,0.4)" }}>Free to start · No credit card needed</span>
        </div>
      </div>

      {/* Demo */}
      <div className="relative py-14 md:py-20">
        <ScrollReveal className="relative z-10 flex justify-center px-4 md:px-12 pb-12" delay={100}>
          <ProductDemo />
        </ScrollReveal>
      </div>

      {/* How it works */}
      <ScrollReveal className="px-6 md:px-16 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>How it works</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4.5vw, 44px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Not a note-taking app.<br />A course memory.
            </h2>
            <p className="text-base md:text-lg mt-5 max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(0,0,0,0.55)" }}>
              Imagine you&apos;re taking Calculus. All semester you record the lectures, drop the PDFs and
              homework solutions, save the videos your professor recommends, and take your own notes.
              Flux connects all of it into one knowledge base for that course.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "01", title: "Capture everything", text: "Record every lecture. Upload every PDF and homework solution. Save the YouTube videos your professor recommends. Write your notes. It all lands in the right course — no folders, no filing." },
              { n: "02", title: "Flux connects it all", text: "Everything you capture becomes one course memory. By midterms, Flux has heard every lecture and read every page you have." },
              { n: "03", title: "Ask your course", text: "“Explain the Chain Rule the way my professor did.” Answers come from your actual course materials — not generic AI knowledge — cited to the exact lecture minute or page." },
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

      {/* Recording animation demo */}
      <ScrollReveal className="flex flex-col items-center px-4 md:px-12 pb-20 gap-8" delay={150}>
        <div className="text-center max-w-2xl">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>What you get</div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 5vw, 52px)", color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
            From lecture to study-ready in minutes.
          </h2>
          <p style={{ fontSize: 18, color: "rgba(0,0,0,0.5)", lineHeight: 1.65 }}>
            One recording becomes a transcript, summary, key points, and a review session — automatically.
          </p>
        </div>
        <RecordingDemo />
      </ScrollReveal>

      {/* Tagline */}
      <ScrollReveal className="text-center py-10 px-6">
        <p className="text-sm uppercase tracking-[0.22em] font-semibold mb-3" style={{ color: "rgba(0,0,0,0.8)" }}>
          Trusted by students at
        </p>
        <p className="text-2xl md:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>
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
              <div className="text-5xl mb-4" style={{ color: "rgba(0,0,0,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.9)", lineHeight: 1.55 }}>
                By midterms, Flux basically knew my whole business course. The night before an exam I just ask it questions — and it answers from my own lectures, with the exact minute to rewatch.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.7)" }}>Usman Tariq</div>
              <div className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>Business Student · Queensborough Community College</div>
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
              <div className="text-5xl mb-4" style={{ color: "rgba(0,0,0,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.9)", lineHeight: 1.55 }}>
                Flux se souvient de tout mon semestre — chaque cours, chaque PDF, chaque vidéo. Avant un examen, je lui pose mes questions et il répond à partir de mes propres supports, avec les sources. C'est comme réviser avec quelqu'un qui a assisté à tous mes cours.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.7)" }}>Mohamed Camara</div>
              <div className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>Étudiant en Génie Civil · Université de Rennes, France</div>
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
              <div className="text-5xl mb-4" style={{ color: "rgba(0,0,0,0.2)", fontFamily: "Georgia, serif", lineHeight: 1 }}>"</div>
              <p className="text-lg md:text-xl leading-relaxed mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.9)", lineHeight: 1.55 }}>
                Between clinicals I don&apos;t have time to re-watch lectures. I just ask Flux and it pulls the answer from my recordings and slides — and shows me exactly where it came from. It&apos;s like a study partner who went to every class.
              </p>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.7)" }}>Sira Camara</div>
              <div className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>Nursing Student · LaGuardia Community College</div>
            </div>
          </div>
        </ScrollReveal>

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
          Ask your semester <span style={{ color: "#6E7FF3" }}>anything.</span>
        </h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>
          Every lecture, file, and note — remembered. Start capturing today and walk into finals with a full semester behind you.
        </p>
        <Link href="/sign-up" className="font-semibold px-10 py-3.5 rounded-full text-sm transition-all hover:opacity-90" style={{ background: "#4B5FE8", color: "white" }}>
          Get started free
        </Link>
      </ScrollReveal>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.08)", position: "relative", zIndex: 1 }}>
        <div className="max-w-6xl mx-auto px-6 md:px-16 py-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#4B5FE8" }}>
                <Layers size={13} style={{ color: "#0f1115" }} />
              </div>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#0f1115", letterSpacing: "-0.4px" }}>
                Fl<span style={{ color: "#6E7FF3" }}>u</span>x
              </span>
            </div>
            <p className="text-xs max-w-[240px] text-center md:text-left" style={{ color: "rgba(0,0,0,0.35)", lineHeight: 1.6 }}>
              The AI that went to every one of your classes.
            </p>
          </div>
          <div className="flex gap-12">
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(0,0,0,0.3)" }}>Product</span>
              <Link href="#features" className="text-xs hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.5)" }}>Features</Link>
              <Link href="#pricing" className="text-xs hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.5)" }}>Pricing</Link>
              <Link href="#faq" className="text-xs hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.5)" }}>FAQ</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(0,0,0,0.3)" }}>Account</span>
              <Link href="/sign-up" className="text-xs hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.5)" }}>Get started</Link>
              <Link href="/sign-in" className="text-xs hover:text-[#0f1115] transition-colors" style={{ color: "rgba(0,0,0,0.5)" }}>Sign in</Link>
            </div>
          </div>
        </div>
        <div className="text-center pb-8">
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.25)" }}>© {new Date().getFullYear()} Flux. All rights reserved.</span>
        </div>
      </footer>

      <GoogleBanner />
    </main>
  );
}

