"use client";
import { useEffect, useState } from "react";
import { Mic2, FileText, Youtube, PenLine, Sparkles, Play, Layers } from "lucide-react";

/**
 * The goal demo: a course memory fills up (lecture, slides, video, notes),
 * then the student asks a question, gets a cited answer, and a citation
 * click replays the professor at the exact moment. Loops forever.
 */

const CAPTURES = [
  { icon: Mic2,     tint: "#4B5FE8", title: "Week 1 — Cell Structure",      meta: "Recorded lecture · 48 min" },
  { icon: FileText, tint: "#F97316", title: "Week 2 — Membranes.pdf",       meta: "Slides · 24 pages" },
  { icon: Youtube,  tint: "#EF4444", title: "The Krebs Cycle, Explained",   meta: "YouTube · 14:32" },
  { icon: PenLine,  tint: "#10B981", title: "My notes — ATP & energy",      meta: "Note" },
];

const QUESTION = "What did the professor say about ATP synthesis?";
const ANSWER = "She called the mitochondrial membrane “where the magic happens” — ATP synthase spins like a turbine as protons flow through it [1], and your notes flag this as a likely exam question [2].";

// step: 0-3 captures appear · 4 memory badge · 5 question · 6 thinking · 7 answer · 8 play · 9 hold · 10 fade
const STEPS = [700, 700, 700, 700, 900, 1100, 900, 2600, 2800, 1600, 600];

export function CourseMemoryDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEPS[step]);
    return () => clearTimeout(t);
  }, [step]);

  const faded = step === STEPS.length - 1;
  const visibleCaptures = Math.min(step + 1, 4);
  const memoryReady = step >= 4;
  const showQuestion = step >= 5;
  const thinking = step === 6;
  const showAnswer = step >= 7;
  const playing = step >= 8;

  return (
    <div
      className="w-full rounded-3xl overflow-hidden"
      style={{
        maxWidth: 980,
        border: "1px solid rgba(15,17,21,0.1)",
        background: "#ffffff",
        boxShadow: "0 24px 70px rgba(75,95,232,0.12), 0 8px 24px rgba(0,0,0,0.06)",
        opacity: faded ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <div className="grid md:grid-cols-[1fr_1.25fr]">

        {/* ── Left: the course memory filling up ── */}
        <div className="p-6 md:p-7" style={{ background: "rgba(75,95,232,0.04)", borderRight: "1px solid rgba(15,17,21,0.07)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)" }}>
              <Layers size={13} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "#0f1115" }}>Biology 101</div>
              <div style={{ fontSize: 10, color: "rgba(15,17,21,0.45)" }}>Course memory</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {CAPTURES.map((c, i) => {
              const shown = i < visibleCaptures;
              const Icon = c.icon;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(15,17,21,0.08)",
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateY(0)" : "translateY(10px)",
                    transition: "opacity 0.45s ease, transform 0.45s ease",
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.tint}14` }}>
                    <Icon size={14} style={{ color: c.tint }} />
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f1115" }} className="truncate">{c.title}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(15,17,21,0.45)" }}>{c.meta}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full px-3.5 py-2"
            style={{
              background: memoryReady ? "rgba(75,95,232,0.1)" : "rgba(15,17,21,0.04)",
              border: `1px solid ${memoryReady ? "rgba(75,95,232,0.3)" : "rgba(15,17,21,0.08)"}`,
              transition: "all 0.4s ease",
            }}>
            <Sparkles size={12} style={{ color: memoryReady ? "#4B5FE8" : "rgba(15,17,21,0.35)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: memoryReady ? "#4B5FE8" : "rgba(15,17,21,0.45)" }}>
              {memoryReady ? "In memory: 4 sources · 118 chunks — ask anything" : "Building course memory…"}
            </span>
          </div>
        </div>

        {/* ── Right: ask with receipts ── */}
        <div className="p-6 md:p-7 flex flex-col" style={{ minHeight: 340 }}>
          <div className="flex items-center gap-1.5 mb-4">
            <Sparkles size={12} style={{ color: "#4B5FE8" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4B5FE8" }}>Ask your course</span>
          </div>

          <div className="flex-1 space-y-3">
            {/* question */}
            <div className="flex justify-end" style={{ opacity: showQuestion ? 1 : 0, transform: showQuestion ? "none" : "translateY(8px)", transition: "all 0.4s ease" }}>
              <div className="px-4 py-2.5 max-w-[85%]" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)", color: "white", borderRadius: "16px 16px 4px 16px", fontSize: 13.5, lineHeight: 1.5 }}>
                {QUESTION}
              </div>
            </div>

            {/* thinking */}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 flex items-center gap-1.5" style={{ background: "rgba(15,17,21,0.05)", borderRadius: "16px 16px 16px 4px" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(15,17,21,0.35)", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* answer + citations */}
            {showAnswer && (
              <>
                <div className="flex justify-start" style={{ animation: "cmFade 0.4s ease" }}>
                  <div className="px-4 py-3 max-w-[92%]" style={{ background: "rgba(15,17,21,0.045)", border: "1px solid rgba(15,17,21,0.07)", color: "rgba(15,17,21,0.85)", borderRadius: "16px 16px 16px 4px", fontSize: 13.5, lineHeight: 1.6 }}>
                    {ANSWER}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2" style={{ animation: "cmFade 0.4s ease" }}>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: playing ? "rgba(75,95,232,0.18)" : "rgba(75,95,232,0.08)",
                      color: "#4B5FE8", border: "1px solid rgba(75,95,232,0.3)", fontSize: 10.5, fontWeight: 600,
                      boxShadow: playing ? "0 0 0 4px rgba(75,95,232,0.12)" : "none",
                      transition: "all 0.35s ease",
                    }}>
                    <Play size={9} fill="currentColor" /> <b>[1]</b> Lecture: Week 1 · 32:10
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(75,95,232,0.08)", color: "#4B5FE8", border: "1px solid rgba(75,95,232,0.3)", fontSize: 10.5, fontWeight: 600 }}>
                    <PenLine size={9} /> <b>[2]</b> Your note: ATP & energy
                  </span>
                </div>
              </>
            )}
          </div>

          {/* the receipt: player jumps to the cited moment */}
          <div
            className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "linear-gradient(135deg, rgba(75,95,232,0.1), rgba(110,127,243,0.06))",
              border: "1px solid rgba(75,95,232,0.35)",
              opacity: playing ? 1 : 0,
              transform: playing ? "translateY(0)" : "translateY(10px)",
              transition: "all 0.45s ease",
            }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)" }}>
              <Play size={13} style={{ color: "white", marginLeft: 1 }} fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1115" }} className="truncate">Week 1 — Cell Structure</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(15,17,21,0.1)" }}>
                  <div className="h-1 rounded-full" style={{
                    background: "linear-gradient(90deg,#4B5FE8,#6E7FF3)",
                    width: playing ? "78%" : "62%",
                    transition: "width 4s linear",
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#4B5FE8", fontVariantNumeric: "tabular-nums" }}>32:10</span>
              </div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4B5FE8" }}>Playing the moment</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes cmFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
