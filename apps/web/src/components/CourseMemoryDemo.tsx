"use client";
import { useEffect, useState } from "react";
import { Mic2, Camera, PenLine, Sparkles, Play, Layers } from "lucide-react";
import { useTr } from "@/lib/useTr";

/**
 * The goal demo: a class fills up with lectures, board photos and the student's
 * own notes, then they ask a question, get an answer with citations naming the
 * lecture and the minute, and a citation click replays that moment. Loops.
 */

const CLASS_COLOR = "#4B5FE8";
const LECTURE = "Lecture 7 — Definite Integrals";

const CAPTURES = [
  { icon: Mic2,   tint: CLASS_COLOR, title: LECTURE,                   meta: "Recorded lecture · 48 min" },
  { icon: Camera, tint: "#9333EA",   title: "Board photos — Lecture 7", meta: "2 photos, read into the lecture" },
  { icon: PenLine, tint: "#16A34A",  title: "My notes — FTC practice",  meta: "Note" },
];

const QUESTION = "What did the professor say about the Fundamental Theorem?";
const ANSWER = "He called it the point of the whole chapter — differentiation and integration undo each other, so ∫₀¹ x² dx is just the antiderivative evaluated at the bounds [1]. Your own note flags that worked example as likely exam material [2].";

// step: 0-2 captures appear · 3 memory ready · 4 question · 5 thinking · 6 answer
// 7 citation clicked · 8 hold · 9 fade
const STEPS = [700, 700, 700, 900, 1100, 900, 2600, 2800, 1600, 600];

export function CourseMemoryDemo() {
  const tr = useTr();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEPS[step]);
    return () => clearTimeout(t);
  }, [step]);

  const faded = step === STEPS.length - 1;
  const visibleCaptures = Math.min(step + 1, CAPTURES.length);
  const memoryReady = step >= 3;
  const showQuestion = step >= 4;
  const thinking = step === 5;
  const showAnswer = step >= 6;
  const playing = step >= 7;

  return (
    <div
      className="w-full rounded-3xl overflow-hidden"
      style={{
        maxWidth: 980,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#ffffff",
        boxShadow: "0 24px 70px rgba(75,95,232,0.12), 0 8px 24px rgba(0,0,0,0.06)",
        opacity: faded ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <div className="grid md:grid-cols-[1fr_1.25fr]">

        {/* ── Left: everything this class has captured ── */}
        <div className="p-6 md:p-7" style={{ background: "rgba(75,95,232,0.04)", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: CLASS_COLOR }}>
              <Layers size={13} style={{ color: "white" }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: CLASS_COLOR }} />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "#0f1115" }}>{tr("Calculus II")}</span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(15,17,21,0.55)" }}>{tr("Course memory")}</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {CAPTURES.map((c, i) => {
              const shown = i < visibleCaptures;
              const Icon = c.icon;
              return (
                <div key={c.title} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(0,0,0,0.08)",
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateY(0)" : "translateY(10px)",
                    transition: "opacity 0.45s ease, transform 0.45s ease",
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.tint}14` }}>
                    <Icon size={14} style={{ color: c.tint }} />
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f1115" }} className="truncate">{tr(c.title)}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(15,17,21,0.55)" }}>{tr(c.meta)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full px-3.5 py-2"
            style={{
              background: memoryReady ? "rgba(75,95,232,0.1)" : "rgba(15,17,21,0.04)",
              border: `1px solid ${memoryReady ? "rgba(75,95,232,0.3)" : "rgba(0,0,0,0.08)"}`,
              transition: "all 0.4s ease",
            }}>
            <Sparkles size={12} style={{ color: memoryReady ? CLASS_COLOR : "rgba(15,17,21,0.4)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: memoryReady ? CLASS_COLOR : "rgba(15,17,21,0.55)" }}>
              {memoryReady ? tr("Every lecture, photo and note in this class") : tr("Building course memory…")}
            </span>
          </div>
        </div>

        {/* ── Right: ask, with receipts ── */}
        <div className="p-6 md:p-7 flex flex-col" style={{ minHeight: 340 }}>
          <div className="flex items-center gap-1.5 mb-4">
            <Sparkles size={12} style={{ color: CLASS_COLOR }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: CLASS_COLOR }}>{tr("Ask your course")}</span>
          </div>

          <div className="flex-1 space-y-3">
            {/* question */}
            <div className="flex justify-end" style={{ opacity: showQuestion ? 1 : 0, transform: showQuestion ? "none" : "translateY(8px)", transition: "all 0.4s ease" }}>
              <div className="px-4 py-2.5 max-w-[85%]" style={{ background: CLASS_COLOR, color: "white", borderRadius: "18px 18px 4px 18px", fontSize: 13.5, lineHeight: 1.5 }}>
                {tr(QUESTION)}
              </div>
            </div>

            {/* thinking */}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 flex items-center gap-1.5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "18px 18px 18px 4px" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(15,17,21,0.4)", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* answer + citations */}
            {showAnswer && (
              <>
                <div className="flex justify-start" style={{ animation: "cmFade 0.4s ease" }}>
                  <div className="px-4 py-3 max-w-[92%]" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(15,17,21,0.85)", borderRadius: "18px 18px 18px 4px", fontSize: 13.5, lineHeight: 1.6 }}>
                    {tr(ANSWER)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2" style={{ animation: "cmFade 0.4s ease" }}>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: playing ? "rgba(75,95,232,0.2)" : "rgba(75,95,232,0.1)",
                      color: CLASS_COLOR, border: "1px solid rgba(75,95,232,0.3)", fontSize: 10.5, fontWeight: 600,
                      boxShadow: playing ? "0 0 0 4px rgba(75,95,232,0.12)" : "none",
                      transition: "all 0.35s ease",
                    }}>
                    <Play size={9} fill="currentColor" /> <b>[1]</b> Lecture 7 · 32:10
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(75,95,232,0.1)", color: CLASS_COLOR, border: "1px solid rgba(75,95,232,0.3)", fontSize: 10.5, fontWeight: 600 }}>
                    <PenLine size={9} /> <b>[2]</b> Your note: FTC practice
                  </span>
                </div>
              </>
            )}
          </div>

          {/* the receipt: the player jumps to the cited moment */}
          <div
            className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: "rgba(75,95,232,0.08)",
              border: "1px solid rgba(75,95,232,0.35)",
              opacity: playing ? 1 : 0,
              transform: playing ? "translateY(0)" : "translateY(10px)",
              transition: "all 0.45s ease",
            }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: CLASS_COLOR }}>
              <Play size={13} style={{ color: "white", marginLeft: 1 }} fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1115" }} className="truncate">{tr(LECTURE)}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(15,17,21,0.1)" }}>
                  <div className="h-1 rounded-full" style={{
                    background: CLASS_COLOR,
                    width: playing ? "78%" : "62%",
                    transition: "width 4s linear",
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: CLASS_COLOR, fontVariantNumeric: "tabular-nums" }}>32:10</span>
              </div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: CLASS_COLOR }}>Playing the moment</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes cmFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
