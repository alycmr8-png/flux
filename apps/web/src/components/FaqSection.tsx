"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  { q: "What is Flux?", a: "Flux helps you take notes faster. Record a lecture and Flux transcribes it, then turns it into clean, organized notes automatically — so you can ask questions and get answers cited back to the exact moment your professor said it." },
  { q: "How does the recording feature work?", a: "You record your lecture directly in the browser. Flux transcribes the audio, generates a summary and key points, and turns it into ready-to-study notes — all within minutes." },
  { q: "Is there a free trial?", a: "Yes — you get a 7-day free trial on all plans. No credit card required to start." },
  { q: "How much does Flux cost?", a: "Flux is $9.99/month — or less on longer plans: $6.99/month billed every 6 months, or $5.99/month billed yearly. Every plan includes everything. Cancel anytime." },
  { q: "Does Flux work for any subject?", a: "Yes. Flux works for any subject — biology, law, history, engineering, business, and more. The AI adapts to the content of your lecture." },
  { q: "Is my data private?", a: "Your recordings and notes are processed securely and never shared with other users. You can delete your data at any time from your account." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 md:px-16 py-20 md:py-28 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#6E7FF3" }}>FAQ</div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(36px, 6vw, 56px)", color: "#0f1115", letterSpacing: "-0.03em" }}>
          Frequently asked questions
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
              <span style={{ fontSize: 18, fontWeight: 600, color: "#0f1115" }}>{item.q}</span>
              <ChevronDown size={16} style={{ color: "rgba(0,0,0,0.4)", flexShrink: 0, transform: open === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            {open === i && (
              <div className="px-6 pb-5" style={{ fontSize: 16, color: "rgba(0,0,0,0.6)", lineHeight: 1.75 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
