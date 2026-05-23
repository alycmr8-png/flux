"use client";
import { useState } from "react";
import { Youtube } from "lucide-react";

const FLASHCARDS = [
  { q: "What is psychology?",               a: "The scientific study of mind and behavior, examining thoughts, emotions, and actions." },
  { q: "Who opened the first psychology lab?", a: "Wilhelm Wundt, in Leipzig, Germany in 1879." },
  { q: "What is behaviorism?",              a: "A school of thought focused only on observable behavior, rejecting the study of the mind." },
  { q: "What is the cognitive revolution?", a: "A shift in the 1950s–70s back to studying mental processes like memory, perception, and reasoning." },
];

const VTABS = ["Summary", "Transcript", "Flashcards", "Quiz"];

export function YoutubeFeatureDemo() {
  const [vtab, setVtab] = useState("summary");
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  return (
    <section className="px-6 md:px-16 py-16 md:py-24">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            Upload any video
          </div>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", fontWeight: 400, color: "white" }}>
            Paste a YouTube link. Get everything.
          </h2>
          <p className="text-sm md:text-base mt-3 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Drop any lecture, tutorial, or documentary — Flux gives you a summary, transcript, flashcards, and a quiz instantly.
          </p>
        </div>

        {/* Demo */}
        <div className="max-w-2xl mx-auto space-y-4">

          {/* URL bar */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Youtube size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>youtube.com/watch?v=vo4pMVb0R6M</span>
            </div>
            <div className="px-5 py-3 rounded-xl text-sm font-medium shrink-0" style={{ background: "white", color: "#111110" }}>Load</div>
          </div>

          {/* YouTube embed */}
          <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <iframe
              src="https://www.youtube.com/embed/vo4pMVb0R6M"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.08)" }}>
            {VTABS.map(t => (
              <button key={t} onClick={() => setVtab(t.toLowerCase())}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{ background: vtab === t.toLowerCase() ? "white" : "transparent", color: vtab === t.toLowerCase() ? "#111110" : "rgba(255,255,255,0.45)" }}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 260 }}>

            {vtab === "summary" && (
              <div className="space-y-4">
                <div className="text-sm font-semibold" style={{ color: "white" }}>Intro to Psychology — Crash Course #1</div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Psychology is the scientific study of mind and behavior. This episode traces its roots from Wilhelm Wundt&apos;s first lab in 1879 to the modern cognitive revolution, covering the major schools of thought that shaped the field.
                </p>
                <div className="space-y-2">
                  {[
                    "Structuralism (Wundt) used introspection to break consciousness into basic elements",
                    "Functionalism (James) asked why the mind works the way it does — for survival",
                    "Behaviorism (Watson, Skinner) studied only observable behavior, not the inner mind",
                    "The cognitive revolution (1950s–70s) shifted focus back to memory and reasoning",
                  ].map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.25)" }} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vtab === "transcript" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Full Transcript</div>
                {[
                  ["00:00", "Psychology is one of those things that everybody thinks they know about. But it's actually a huge field with a complicated history."],
                  ["00:38", "Wilhelm Wundt opened the first experimental psychology lab in Leipzig in 1879, marking the birth of psychology as a science."],
                  ["01:12", "William James wrote the first psychology textbook and founded functionalism — asking what mental processes do, not what they are."],
                  ["02:05", "John Watson argued we should forget the mind entirely and only study behaviors we can observe and measure."],
                  ["03:30", "The cognitive revolution in the 1950s–70s brought the mind back into focus."],
                ].map(([t, line]) => (
                  <div key={t} className="flex gap-3 text-sm">
                    <span className="shrink-0 font-mono text-xs pt-0.5" style={{ color: "rgba(255,255,255,0.3)", minWidth: 36 }}>{t}</span>
                    <span style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{line}</span>
                  </div>
                ))}
              </div>
            )}

            {vtab === "flashcards" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Click a card to reveal the answer</div>
                <div className="grid grid-cols-2 gap-3">
                  {FLASHCARDS.map((fc, i) => (
                    <div key={i}
                      onClick={() => setFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                      className="cursor-pointer rounded-xl p-4 flex flex-col justify-center transition-all"
                      style={{
                        background: flipped.has(i) ? "white" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${flipped.has(i) ? "white" : "rgba(255,255,255,0.1)"}`,
                        minHeight: 90,
                      }}>
                      <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: flipped.has(i) ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)" }}>
                        {flipped.has(i) ? "Answer" : "Question"}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: flipped.has(i) ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.7)" }}>
                        {flipped.has(i) ? fc.a : fc.q}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vtab === "quiz" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Question 1 of 5</div>
                <div className="text-sm font-medium leading-relaxed" style={{ color: "white" }}>
                  Which school of thought argued that psychology should only study observable behavior?
                </div>
                <div className="space-y-2">
                  {["Structuralism", "Functionalism", "Behaviorism", "Psychoanalysis"].map((opt, i) => {
                    const picked = quizSelected === i;
                    return (
                      <button key={i} onClick={() => setQuizSelected(i)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                        style={{
                          border: `1px solid ${picked ? "white" : "rgba(255,255,255,0.1)"}`,
                          background: picked ? "white" : "rgba(255,255,255,0.05)",
                          color: picked ? "#111110" : "rgba(255,255,255,0.65)",
                        }}>
                        <span className="w-3.5 h-3.5 rounded-full border shrink-0"
                          style={{ borderColor: picked ? "#111110" : "rgba(255,255,255,0.3)", background: picked ? "#111110" : "transparent" }} />
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizSelected !== null && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{
                    background: quizSelected === 2 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                    color: quizSelected === 2 ? "#4ade80" : "#f87171",
                  }}>
                    {quizSelected === 2 ? "✓ Correct! Behaviorism (Watson, Skinner) rejected the study of the mind." : "✗ Not quite — Behaviorism is the answer."}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
