"use client";
import { useState } from "react";
import { FileText } from "lucide-react";

const DEMO = {
  summary: "This chapter covers the fundamental principles of cellular biology, including the structure and function of prokaryotic and eukaryotic cells, membrane transport, and cellular respiration. Key emphasis is placed on how cells maintain homeostasis and convert energy through metabolic pathways.",
  sections: [
    {
      heading: "Cell Structure & Organization",
      bullets: [
        "Prokaryotic cells lack a membrane-bound nucleus; genetic material floats freely in the cytoplasm.",
        "Eukaryotic cells contain a nucleus, mitochondria, endoplasmic reticulum, and other organelles.",
        "The plasma membrane is a phospholipid bilayer that controls what enters and exits the cell.",
      ],
    },
    {
      heading: "Membrane Transport",
      bullets: [
        "Passive transport moves molecules down their concentration gradient — no energy required.",
        "Active transport moves molecules against their gradient using ATP as an energy source.",
        "Osmosis is the diffusion of water across a selectively permeable membrane.",
      ],
    },
    {
      heading: "Cellular Respiration",
      bullets: [
        "Glycolysis breaks glucose into two pyruvate molecules in the cytoplasm, producing 2 ATP.",
        "The Krebs cycle runs in the mitochondrial matrix, generating NADH and FADH₂.",
        "The electron transport chain produces ~32 ATP via oxidative phosphorylation.",
      ],
    },
  ],
  keyTerms: [
    { term: "Mitochondria",        definition: "The 'powerhouse' of the cell; site of aerobic cellular respiration and ATP production." },
    { term: "Phospholipid Bilayer", definition: "The double-layered membrane surrounding cells, with hydrophilic heads facing outward and hydrophobic tails inward." },
    { term: "ATP",                 definition: "Adenosine triphosphate — the primary energy currency of the cell." },
    { term: "Osmosis",             definition: "Movement of water molecules through a semipermeable membrane from high to low water concentration." },
  ],
  quiz: [
    { q: "Where does glycolysis occur in the cell?",       a: "In the cytoplasm — no organelle required." },
    { q: "What is the role of the mitochondria?",          a: "To produce ATP through cellular respiration (Krebs cycle + ETC)." },
    { q: "What drives active transport?",                  a: "ATP — it requires energy to move molecules against their concentration gradient." },
  ],
  tips: [
    "Know the 3 stages of cellular respiration and where each occurs (cytoplasm vs. mitochondria).",
    "Osmosis vs. diffusion — water vs. solutes. Students confuse these on exams constantly.",
    "ATP yield numbers: glycolysis = 2, Krebs = 2, ETC = ~32. You'll be asked this.",
    "Prokaryote vs. eukaryote differences are a classic multiple-choice target.",
  ],
};

const TABS = ["Summary", "Sections", "Key Terms", "Practice Q&A", "Exam Tips"] as const;
type Tab = typeof TABS[number];

export function FilesFeatureDemo() {
  const [tab, setTab] = useState<Tab>("Summary");
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  return (
    <section className="px-6 md:px-16 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#3b82f6" }}>
            Upload any document
          </div>
          <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
            Drop a PDF. <span style={{ color: "#3b82f6" }}>Understand everything.</span>
          </h2>
          <p className="text-base md:text-lg mt-3 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Upload any lecture slide, textbook chapter, or study guide — Flux breaks it down into summaries, key terms, practice questions, and exam tips.
          </p>
        </div>

        {/* Demo */}
        <div className="max-w-4xl mx-auto space-y-4">

          {/* File bar */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)" }}>
            <FileText size={14} style={{ color: "#3b82f6" }} className="shrink-0" />
            <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.55)" }}>Chapter_4_Cell_Biology.pdf</span>
            <span className="text-xs font-semibold shrink-0" style={{ color: "#60a5fa" }}>Analysed ✓</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => { setTab(t); setFlipped(new Set()); }}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: tab === t ? "#2563eb" : "transparent",
                  color: tab === t ? "white" : "rgba(255,255,255,0.45)",
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(37,99,235,0.15)", minHeight: 400 }}>

            {tab === "Summary" && (
              <div className="space-y-4">
                <div className="text-sm font-semibold" style={{ color: "white" }}>Chapter 4 — Cell Biology</div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{DEMO.summary}</p>
              </div>
            )}

            {tab === "Sections" && (
              <div className="space-y-5">
                {DEMO.sections.map((s, i) => (
                  <div key={i}>
                    <div className="text-xs font-bold mb-2" style={{ color: "white" }}>{s.heading}</div>
                    <div className="space-y-2">
                      {s.bullets.map((b, j) => (
                        <div key={j} className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                          <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#3b82f6" }} />
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "Key Terms" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#3b82f6" }}>Definitions</div>
                {DEMO.keyTerms.map((kt, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: "white" }}>{kt.term}</div>
                    <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{kt.definition}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "Practice Q&A" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#3b82f6" }}>Click a card to reveal the answer</div>
                <div className="space-y-2">
                  {DEMO.quiz.map((item, i) => (
                    <div key={i}
                      onClick={() => setFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                      className="cursor-pointer rounded-xl p-4 transition-all"
                      style={{
                        background: flipped.has(i) ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${flipped.has(i) ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                      }}>
                      <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: flipped.has(i) ? "#60a5fa" : "rgba(255,255,255,0.35)" }}>
                        {flipped.has(i) ? "Answer" : `Q${i + 1}`}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: flipped.has(i) ? "white" : "rgba(255,255,255,0.7)" }}>
                        {flipped.has(i) ? item.a : item.q}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "Exam Tips" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#3b82f6" }}>What to focus on</div>
                {DEMO.tips.map((tip, i) => (
                  <div key={i} className="flex gap-3 text-sm rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}>
                    <span className="font-bold shrink-0" style={{ color: "#3b82f6" }}>{i + 1}.</span>
                    {tip}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
