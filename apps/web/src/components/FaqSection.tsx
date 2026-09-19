"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTr } from "@/lib/useTr";

const FAQS = [
  { q: "What is Flux?", a: "Flux records your lectures and turns each one into study material. You see the transcript build live as your professor speaks, and when the lecture ends you get a summary, key points, flashcards, a practice quiz, and a chat that can answer questions about that lecture — plus one searchable memory per class." },
  { q: "Can I see the transcript while the lecture is happening?", a: "Yes. The words appear on screen as they're spoken, so you can follow along instead of writing everything down. Settled text is shown in black, and words still being revised appear in grey." },
  { q: "What about formulas and equations?", a: "Speech recognition hears \u201Cthe integral from zero to one of x squared\u201D. Flux writes \u222B\u2080\u00B9 x\u00B2 dx. Greek letters, superscripts, subscripts and chemical formulas (H\u2082SO\u2084) are all converted, so STEM notes are actually readable." },
  { q: "What if the professor writes on the board?", a: "Photograph it. Flux reads the photo — headings, diagrams and formulas — and folds what it finds into the same lecture, so the summary and quiz include what was written but never said out loud." },
  { q: "Is there a free trial?", a: "You can start free with no card: up to 5 lectures a month, 20 questions, and recordings up to 60 minutes. Every paid plan also starts with a 7-day free trial." },
  { q: "How much does Flux cost?", a: "Student is $9.99/month. Semester is $34.99 every 4 months ($8.75/month). Annual is $69.99/year — about $5.83/month, saving 42%. Every paid plan includes every feature, with up to 30 lectures and 300 questions a month. Cancel anytime." },
  { q: "How long can a recording be?", a: "Up to 3 hours per recording on paid plans, and 60 minutes on Free — enough for any lecture. When you reach the limit, Flux pauses and lets you process what you've recorded." },
  { q: "Does Flux work for any subject?", a: "Yes — biology, law, history, engineering, business and more. The scientific notation matters most in STEM, but the transcript, summary, flashcards and quizzes work for any lecture." },
  { q: "Which devices does it work on?", a: "iPhone, Android and the web, in English, French, Spanish, Portuguese and Arabic. Your classes, recordings and notes sync across all of them." },
  { q: "Is my data private?", a: "Your recordings and notes are processed securely and never shared with other users. You can delete your data at any time from your account." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const tr = useTr();

  return (
    <section id="faq" className="px-6 md:px-16 py-20 md:py-28 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#6E7FF3" }}>{tr("FAQ")}</div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(36px, 6vw, 56px)", color: "#0f1115", letterSpacing: "-0.03em" }}>
          {tr("Frequently asked questions")}
        </h2>
      </div>

      <div className="space-y-2">
        {FAQS.map((item, i) => (
          <div key={i} className="rounded-2xl overflow-hidden transition-all"
            style={{ background: open === i ? "rgba(75,95,232,0.08)" : "rgba(0,0,0,0.04)", border: `1px solid ${open === i ? "rgba(75,95,232,0.25)" : "rgba(0,0,0,0.08)"}` }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
            >
              <span style={{ fontSize: 18, fontWeight: 600, color: "#0f1115" }}>{tr(item.q)}</span>
              <ChevronDown size={16} style={{ color: "rgba(0,0,0,0.4)", flexShrink: 0, transform: open === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            {open === i && (
              <div className="px-6 pb-5" style={{ fontSize: 16, color: "rgba(0,0,0,0.6)", lineHeight: 1.75 }}>
                {tr(item.a)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
