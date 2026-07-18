"use client";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, Sparkles, Play, Target, Calendar } from "lucide-react";

// Looping Exam Mode demo for the landing page: one button → predicted topics,
// a cited practice question that answers itself, and a study plan. Mirrors the
// light "Paper" look of the real app and of CourseMemoryDemo.

const STEPS = [1400, 500, 2200, 1600, 1500, 1500, 2200, 1900, 1600, 600];
// 0 idle · 1 press · 2 building · 3 topics · 4 question · 5 answer · 6 receipt
// 7 plan · 8 hold · 9 fade

const TOPICS = [
  { name: "Cellular respiration", bar: 5, why: "Covered in 4 lectures — “this will be on the exam”" },
  { name: "Enzyme kinetics", bar: 4, why: "Professor spent 40+ minutes across two weeks" },
  { name: "Membrane transport", bar: 3, why: "Repeated in slides and the review video" },
];

const OPTIONS = [
  "A) It stores genetic information",
  "B) It produces ATP through oxidative phosphorylation",
  "C) It breaks down cellular waste",
  "D) It synthesizes membrane lipids",
];

const PLAN = [
  { day: "Day 1", focus: "Cellular respiration", item: "Replay Lecture 9 · rework the ATP diagram" },
  { day: "Day 2", focus: "Enzyme kinetics", item: "Km vs Vmax — practice questions" },
  { day: "Day 3", focus: "Self-test", item: "Full predicted exam, closed notes" },
];

export function ExamModeDemo() {
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEPS[step]);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [step]);

  const building = step === 2;
  const showPack = step >= 3 && step < 9;
  const showQuestion = step >= 4 && step < 9;
  const answered = step >= 5 && step < 9;
  const receipt = step >= 6 && step < 9;
  const showPlan = step >= 7 && step < 9;
  const fading = step === 9;

  return (
    <div
      className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-5 py-3" style={{ background: "rgba(0,0,0,0.025)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
        <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        <span className="mx-auto text-xs" style={{ color: "rgba(31,35,40,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux — Exam Mode</span>
      </div>

      <div className="p-5 md:p-7" style={{ minHeight: 420 }}>
        {/* Setup / building */}
        {!showPack && (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 380 }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)", boxShadow: "0 8px 24px rgba(75,95,232,0.35)" }}>
              <GraduationCap size={22} style={{ color: "white" }} />
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 19, color: "#191918", marginBottom: 6 }}>
              Biology 101
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 mb-6" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <Calendar size={11} style={{ color: "#DC2626" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>Exam in 6 days</span>
            </div>

            {!building ? (
              <div
                className="flex items-center gap-2 rounded-full px-7 py-3"
                style={{
                  background: "#4B5FE8",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: step === 1 ? "0 0 0 6px rgba(75,95,232,0.25)" : "0 6px 20px rgba(75,95,232,0.35)",
                  transform: step === 1 ? "scale(0.96)" : "scale(1)",
                  transition: "all 0.2s ease",
                }}
              >
                <Sparkles size={15} /> Predict my exam
              </div>
            ) : (
              <div className="w-full max-w-xs">
                <div className="rounded-full overflow-hidden mb-3" style={{ background: "rgba(0,0,0,0.06)", height: 6 }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg,#4B5FE8,#6E7FF3)", animation: "emdGrow 2.1s ease forwards" }} />
                </div>
                <div style={{ fontSize: 12, color: "rgba(31,35,40,0.55)" }}>
                  Reading 26 lectures · 14 files · your notes…
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: "rgba(31,35,40,0.4)", marginTop: 18 }}>
              Built from your entire course memory — nothing to select.
            </div>
          </div>
        )}

        {/* Exam pack */}
        {showPack && (
          <div className="flex flex-col gap-4">
            {/* Topics */}
            <div style={{ animation: "emdIn 0.45s ease both" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={12} style={{ color: "#4B5FE8" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#191918" }}>Likely exam topics</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {TOPICS.map((tp, i) => (
                  <div key={tp.name} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "#FBFBFA", border: "1px solid rgba(0,0,0,0.06)", animation: `emdIn 0.4s ease ${i * 0.12}s both` }}>
                    <span className="flex-1 truncate" style={{ fontSize: 12, fontWeight: 600, color: "#191918" }}>{tp.name}</span>
                    <span className="hidden sm:block truncate" style={{ fontSize: 10, color: "rgba(31,35,40,0.5)", maxWidth: 240 }}>{tp.why}</span>
                    <span className="flex gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} className="w-3 h-1 rounded-full" style={{ background: n <= tp.bar ? "#4B5FE8" : "rgba(0,0,0,0.08)" }} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Predicted question */}
            {showQuestion && (
              <div className="rounded-xl p-3.5" style={{ background: "#FBFBFA", border: "1px solid rgba(0,0,0,0.06)", animation: "emdIn 0.45s ease both" }}>
                <div className="flex items-start gap-2 mb-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "rgba(75,95,232,0.1)", color: "#4B5FE8", fontSize: 10, fontWeight: 700 }}>1</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#191918", lineHeight: 1.45 }}>
                    What is the primary role of the mitochondria in cellular respiration?
                  </span>
                </div>
                <div className="flex flex-col gap-1 mb-2">
                  {OPTIONS.map(opt => {
                    const isB = opt.startsWith("B");
                    const lit = answered && isB;
                    return (
                      <div key={opt} className="rounded-lg px-2.5 py-1.5" style={{
                        fontSize: 11,
                        color: lit ? "#166534" : "rgba(31,35,40,0.7)",
                        background: lit ? "rgba(22,163,74,0.1)" : "#FFFFFF",
                        border: `1px solid ${lit ? "rgba(22,163,74,0.45)" : "rgba(0,0,0,0.07)"}`,
                        fontWeight: lit ? 600 : 400,
                        transition: "all 0.35s ease",
                      }}>
                        {opt}
                      </div>
                    );
                  })}
                </div>
                {answered && (
                  <div className="flex items-center gap-1.5" style={{ animation: "emdIn 0.4s ease both" }}>
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{
                      fontSize: 10, fontWeight: 600, color: "#4B5FE8",
                      background: "rgba(75,95,232,0.07)", border: "1px solid rgba(75,95,232,0.3)",
                      boxShadow: receipt ? "0 0 0 4px rgba(75,95,232,0.15)" : "none",
                      transition: "box-shadow 0.35s ease",
                    }}>
                      <Play size={9} /> Lecture 9 · 41:22
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(31,35,40,0.5)" }}>
                      {receipt ? "Playing the moment your professor explained it" : "Every question carries its receipt"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Study plan */}
            {showPlan && (
              <div className="grid grid-cols-3 gap-2" style={{ animation: "emdIn 0.45s ease both" }}>
                {PLAN.map((d, i) => (
                  <div key={d.day} className="rounded-xl p-2.5" style={{ background: "#FBFBFA", border: "1px solid rgba(0,0,0,0.06)", animation: `emdIn 0.4s ease ${i * 0.12}s both` }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4B5FE8", marginBottom: 2 }}>{d.day}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#191918", marginBottom: 2 }}>{d.focus}</div>
                    <div className="hidden sm:block" style={{ fontSize: 9.5, color: "rgba(31,35,40,0.5)", lineHeight: 1.4 }}>{d.item}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes emdGrow { from { width: 0%; } to { width: 100%; } }
        @keyframes emdIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
