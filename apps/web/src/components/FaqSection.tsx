"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  { q: "What is Flux?", a: "Flux is an AI study assistant that turns your lecture recordings, YouTube videos, and documents into cheat sheets, quizzes, flashcards, and key points — automatically." },
  { q: "How does the recording feature work?", a: "You record your lecture directly in the browser. Flux transcribes the audio using AI, then generates a summary, cheat sheet, and quiz from the transcript — all within minutes." },
  { q: "Can I upload YouTube videos?", a: "Yes. Paste any YouTube link and Flux fetches the transcript, then generates a summary, key points, flashcards, quiz, and an AI chatbot you can ask questions about the video." },
  { q: "What file types can I upload?", a: "Flux supports PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt), Excel (.xlsx, .xls), OpenDocument files (.odt, .odp, .ods), images, and plain text files." },
  { q: "Is there a free trial?", a: "Yes — you get a 7-day free trial on all plans. No credit card required to start." },
  { q: "How much does Flux cost?", a: "The Student plan is $8/month (or $60/year). The Pro plan is $15/month and includes priority processing, analytics, and Google Drive sync. Cancel anytime." },
  { q: "Does Flux work for any subject?", a: "Yes. Flux works for any subject — biology, law, history, engineering, business, and more. The AI adapts to the content of your lecture or document." },
  { q: "Is my data private?", a: "Your recordings and documents are processed securely and never shared with other users. You can delete your data at any time from your account." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="px-6 md:px-16 py-20 md:py-28 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#3b82f6" }}>FAQ</div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 5vw, 42px)", color: "white", letterSpacing: "-0.02em" }}>
          Frequently asked questions
        </h2>
      </div>

      <div className="space-y-2">
        {FAQS.map((item, i) => (
          <div key={i} className="rounded-2xl overflow-hidden transition-all"
            style={{ background: open === i ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${open === i ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.08)"}` }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
            >
              <span style={{ fontSize: 15, fontWeight: 500, color: "white" }}>{item.q}</span>
              <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, transform: open === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            {open === i && (
              <div className="px-6 pb-5" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
