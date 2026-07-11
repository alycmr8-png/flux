"use client";
import { useState } from "react";
import { Youtube } from "lucide-react";

const FLASHCARDS = [
  { q: "What is psychology?",                a: "The scientific study of mind and behavior, examining thoughts, emotions, and actions." },
  { q: "Who opened the first psychology lab?", a: "Wilhelm Wundt, in Leipzig, Germany in 1879." },
  { q: "What is behaviorism?",               a: "A school of thought focused only on observable behavior, rejecting the study of the mind." },
  { q: "What is the cognitive revolution?",  a: "A shift in the 1950s–70s back to studying mental processes like memory, perception, and reasoning." },
];

const KEY_POINTS = [
  { category: "Definition",  point: "Psychology is the scientific study of mind and behavior — it examines thoughts, feelings, and actions." },
  { category: "Important",   point: "Wilhelm Wundt opened the first psychology lab in 1879, marking the birth of psychology as a science." },
  { category: "Definition",  point: "Behaviorism (Watson, Skinner) studies only observable behavior — the inner mind is irrelevant." },
  { category: "Important",   point: "The cognitive revolution of the 1950s–70s shifted focus back to memory, perception, and reasoning." },
  { category: "Example",     point: "Pavlov's dogs salivating at a bell sound is a classic example of classical conditioning." },
  { category: "Warning",     point: "Correlation ≠ causation — a common mistake in interpreting psychology studies." },
  { category: "Formula",     point: "Behavior = Person × Environment (Lewin's equation for understanding human action)." },
];

const CATEGORY_COLORS: Record<string, { text: string; bg: string; pill: string }> = {
  Definition: { text: "#6E7FF3", bg: "rgba(110,127,243,0.08)",  pill: "rgba(110,127,243,0.18)"  },
  Important:  { text: "#f97316", bg: "rgba(249,115,22,0.08)",  pill: "rgba(249,115,22,0.18)"  },
  Formula:    { text: "#a78bfa", bg: "rgba(167,139,250,0.08)", pill: "rgba(167,139,250,0.18)" },
  Example:    { text: "#22c55e", bg: "rgba(34,197,94,0.08)",   pill: "rgba(34,197,94,0.18)"   },
  Warning:    { text: "#ef4444", bg: "rgba(239,68,68,0.08)",   pill: "rgba(239,68,68,0.18)"   },
};

const CHAT_MESSAGES = [
  { role: "user",      text: "What's the difference between structuralism and functionalism?" },
  { role: "assistant", text: "Structuralism (Wundt) asked what the mind is made of — breaking consciousness into basic elements through introspection. Functionalism (James) asked what the mind does and why — focusing on the purpose of mental processes from an evolutionary angle. Structuralism focused on structure; functionalism on adaptive function." },
  { role: "user",      text: "Which one is more relevant today?" },
  { role: "assistant", text: "Functionalism. Modern cognitive psychology, neuroscience, and evolutionary psychology all ask 'what does this process do?' rather than 'what is it made of?' Structuralism largely died out by the early 20th century." },
];

const VTABS = ["Summary", "Transcript", "Key Points", "Flashcards", "Quiz", "Chatbot"];

export function YoutubeFeatureDemo() {
  const [vtab, setVtab] = useState("summary");
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  return (
    <section className="px-6 md:px-16 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#6E7FF3" }}>
            Upload any video
          </div>
          <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>
            Paste a YouTube link. <span style={{ color: "#6E7FF3" }}>Get everything.</span>
          </h2>
          <p className="text-base md:text-lg mt-3 max-w-xl mx-auto" style={{ color: "rgba(0,0,0,0.55)" }}>
            Transcript, summary, key points, flashcards, quiz, and an AI chatbot — all from one link.
          </p>
        </div>

        {/* Demo — dark product panel on the white page */}
        <div className="max-w-4xl mx-auto space-y-4 rounded-2xl p-5 md:p-6" style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 20px 50px rgba(0,0,0,0.18)" }}>

          {/* URL bar */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(75,95,232,0.08)", border: "1px solid rgba(75,95,232,0.25)" }}>
              <Youtube size={14} style={{ color: "#6E7FF3" }} />
              <span className="text-sm" style={{ color: "rgba(0,0,0,0.4)" }}>youtube.com/watch?v=vo4pMVb0R6M</span>
            </div>
            <div className="px-5 py-3 rounded-xl text-sm font-semibold shrink-0 cursor-pointer" style={{ background: "#4B5FE8", color: "white" }}>Load</div>
          </div>

          {/* YouTube embed */}
          <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", border: "1px solid rgba(75,95,232,0.2)" }}>
            <iframe
              src="https://www.youtube.com/embed/vo4pMVb0R6M"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.15)" }}>
            {VTABS.map(t => (
              <button key={t} onClick={() => setVtab(t.toLowerCase().replace(" ", "-"))}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: vtab === t.toLowerCase().replace(" ", "-") ? "#4B5FE8" : "transparent",
                  color: vtab === t.toLowerCase().replace(" ", "-") ? "white" : "rgba(0,0,0,0.45)",
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(75,95,232,0.15)", minHeight: 260 }}>

            {vtab === "summary" && (
              <div className="space-y-4">
                <div className="text-sm font-semibold" style={{ color: "#0f1115" }}>Intro to Psychology — Crash Course #1</div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.65)" }}>
                  Psychology is the scientific study of mind and behavior. This episode traces its roots from Wilhelm Wundt&apos;s first lab in 1879 to the modern cognitive revolution, covering the major schools of thought that shaped the field.
                </p>
                <div className="space-y-2">
                  {[
                    "Structuralism (Wundt) used introspection to break consciousness into basic elements",
                    "Functionalism (James) asked why the mind works the way it does — for survival",
                    "Behaviorism (Watson, Skinner) studied only observable behavior, not the inner mind",
                    "The cognitive revolution (1950s–70s) shifted focus back to memory and reasoning",
                  ].map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(0,0,0,0.65)" }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6E7FF3" }} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vtab === "transcript" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#6E7FF3" }}>Full Transcript</div>
                {[
                  ["00:00", "Psychology is one of those things that everybody thinks they know about. But it's actually a huge field with a complicated history."],
                  ["00:38", "Wilhelm Wundt opened the first experimental psychology lab in Leipzig in 1879, marking the birth of psychology as a science."],
                  ["01:12", "William James wrote the first psychology textbook and founded functionalism — asking what mental processes do, not what they are."],
                  ["02:05", "John Watson argued we should forget the mind entirely and only study behaviors we can observe and measure."],
                  ["03:30", "The cognitive revolution in the 1950s–70s brought the mind back into focus."],
                ].map(([t, line]) => (
                  <div key={t} className="flex gap-3 text-sm">
                    <span className="shrink-0 font-mono text-xs pt-0.5" style={{ color: "#4B5FE8", minWidth: 36 }}>{t}</span>
                    <span style={{ color: "rgba(0,0,0,0.65)", lineHeight: 1.6 }}>{line}</span>
                  </div>
                ))}
              </div>
            )}

            {vtab === "key-points" && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#6E7FF3" }}>Key Points</div>
                {KEY_POINTS.map((kp, i) => {
                  const c = CATEGORY_COLORS[kp.category] ?? { text: "#94a3b8", bg: "rgba(148,163,184,0.08)", pill: "rgba(148,163,184,0.18)" };
                  return (
                    <div key={i} className="flex gap-3 items-start rounded-xl px-4 py-3" style={{ background: c.bg }}>
                      <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 shrink-0 px-1.5 py-0.5 rounded" style={{ color: c.text, background: c.pill }}>
                        {kp.category}
                      </span>
                      <span className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.8)" }}>{kp.point}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {vtab === "flashcards" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#6E7FF3" }}>Click a card to reveal the answer</div>
                <div className="grid grid-cols-2 gap-3">
                  {FLASHCARDS.map((fc, i) => (
                    <div key={i}
                      onClick={() => setFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                      className="cursor-pointer rounded-xl p-4 flex flex-col justify-center transition-all"
                      style={{
                        background: flipped.has(i) ? "rgba(75,95,232,0.15)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${flipped.has(i) ? "#6E7FF3" : "rgba(0,0,0,0.1)"}`,
                        minHeight: 90,
                      }}>
                      <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: flipped.has(i) ? "#4B5FE8" : "rgba(0,0,0,0.35)" }}>
                        {flipped.has(i) ? "Answer" : "Question"}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: flipped.has(i) ? "#0f1115" : "rgba(0,0,0,0.7)" }}>
                        {flipped.has(i) ? fc.a : fc.q}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vtab === "quiz" && (
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6E7FF3" }}>Question 1 of 5</div>
                <div className="text-sm font-medium leading-relaxed" style={{ color: "#0f1115" }}>
                  Which school of thought argued that psychology should only study observable behavior?
                </div>
                <div className="space-y-2">
                  {["Structuralism", "Functionalism", "Behaviorism", "Psychoanalysis"].map((opt, i) => {
                    const picked = quizSelected === i;
                    return (
                      <button key={i} onClick={() => setQuizSelected(i)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                        style={{
                          border: `1px solid ${picked ? "#4B5FE8" : "rgba(0,0,0,0.1)"}`,
                          background: picked ? "rgba(75,95,232,0.15)" : "rgba(0,0,0,0.04)",
                          color: picked ? "#0f1115" : "rgba(0,0,0,0.65)",
                        }}>
                        <span className="w-3.5 h-3.5 rounded-full border shrink-0"
                          style={{ borderColor: picked ? "#6E7FF3" : "rgba(0,0,0,0.3)", background: picked ? "#4B5FE8" : "transparent" }} />
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

            {vtab === "chatbot" && (
              <div className="flex flex-col gap-3">
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#6E7FF3" }}>Ask anything about this video</div>
                <div className="space-y-3 flex-1">
                  {CHAT_MESSAGES.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                        style={{
                          background: m.role === "user" ? "#4B5FE8" : "rgba(0,0,0,0.07)",
                          color: m.role === "user" ? "white" : "rgba(0,0,0,0.8)",
                          borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Fake input */}
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.1)", color: "rgba(0,0,0,0.25)" }}>
                    Ask a question about this lecture…
                  </div>
                  <div className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#4B5FE8", color: "white" }}>Send</div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
