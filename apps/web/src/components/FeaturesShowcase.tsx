"use client";
import { useState } from "react";
import { Mic2, BookOpen, PenLine } from "lucide-react";

const TABS = [
  { key: "record",    label: "Record",       icon: Mic2       },
  { key: "quiz",      label: "Quizzes",      icon: BookOpen   },
  { key: "note",      label: "Take Note",    icon: PenLine    },
] as const;

function RecordPreview() {
  return (
    <div className="space-y-3">
      {/* Recording card — white like platform */}
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="text-xs text-[#888] self-start font-medium">Week 4 — Cognitive Biases</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 56, fontWeight: 400, color: "#111110", letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
          01:24
        </div>
        {/* Wave bars */}
        <div className="flex items-end gap-0.5 h-10">
          {[0.4,0.7,1,0.6,0.9,0.5,0.8,1,0.6,0.4,0.7,0.9,0.5,0.8,0.6,1,0.7,0.4,0.9,0.5].map((h, i) => (
            <div key={i} style={{ width: 3, height: 40 * h, borderRadius: 2, background: "#111110", opacity: 0.8 + h * 0.2 }} />
          ))}
        </div>
        <div className="flex gap-3 w-full">
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
            <span className="text-sm font-medium text-[#111110]">Pause</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: "#111110" }}>
            <span className="text-sm font-medium text-white">Stop</span>
          </div>
        </div>
      </div>

      {/* Previous recordings — white card like platform */}
      <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#6E7FF3", fontWeight: 600 }}>Previous recordings</div>
        {[
          { title: "Week 3 — Memory & Cognition",  dur: "48:12" },
          { title: "Week 2 — Behavioral Theory",   dur: "51:03" },
          { title: "Week 1 — Introduction",         dur: "39:47" },
        ].map(({ title, dur }, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <span className="text-sm text-[#111110]">{title}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#888" }}>{dur}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(75,95,232,0.1)", color: "#4B5FE8" }}>AI ready</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotePreview() {
  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: "#6E7FF3" }}>Take Note</div>
      <div className="text-base font-semibold text-[#111110] mb-4">Week 3 — Memory & Cognition</div>
      <div className="space-y-2 text-sm text-[#555] leading-relaxed">
        <p>Short-term memory holds roughly <strong className="text-[#111110]">7 ± 2 items</strong> at once (Miller's Law).</p>
        <p>Spaced repetition increases long-term retention by <strong className="text-[#111110]">up to 80%</strong> compared to massed practice.</p>
        <p>The <strong className="text-[#111110]">testing effect</strong>: actively retrieving information strengthens memory more than re-reading.</p>
      </div>
      <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)] flex gap-2">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(75,95,232,0.08)", color: "#4B5FE8" }}>PSYC 301</span>
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.04)", color: "#888" }}>Week 3</span>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(0);
  return (
    <div className="rounded-2xl p-6" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Question 2 of 8</div>
      <div className="text-sm font-medium leading-relaxed mb-5" style={{ color: "#0f1115" }}>
        Which memory system has the largest storage capacity?
      </div>
      <div className="space-y-2 mb-5">
        {["Sensory memory", "Short-term memory", "Long-term memory", "Working memory"].map((opt, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{
              border: `1px solid ${selected === i ? "#4B5FE8" : "rgba(0,0,0,0.1)"}`,
              background: selected === i ? "rgba(75,95,232,0.1)" : "rgba(0,0,0,0.04)",
              color: selected === i ? "#0f1115" : "rgba(0,0,0,0.6)",
            }}>
            <span className="w-3 h-3 rounded-full border shrink-0"
              style={{ borderColor: selected === i ? "#4B5FE8" : "rgba(0,0,0,0.3)", background: selected === i ? "#4B5FE8" : "transparent" }} />
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(0,0,0,0.35)" }}>Auto-generated from your lecture</span>
        <button className="text-xs font-medium px-4 py-2 rounded-full" style={{ background: "#4B5FE8", color: "white" }}>Next →</button>
      </div>
    </div>
  );
}

const PREVIEWS: Record<string, React.ReactNode> = {
  record:    <RecordPreview />,
  quiz:      <QuizPreview />,
  note:      <NotePreview />,
};

export function FeaturesShowcase() {
  const [active, setActive] = useState<string>("record");

  return (
    <section className="px-6 md:px-16 py-16 md:py-24" style={{ background: "#ffffff" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#6E7FF3" }}>What you get</div>
          <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>
            Everything to ace the semester.
          </h2>
          <p className="text-base md:text-lg mt-3 max-w-xl mx-auto" style={{ color: "rgba(0,0,0,0.5)" }}>
            One recording. Transcript, cheat sheet and quizzes — generated instantly.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-8 overflow-x-auto">
          <div className="flex gap-1 p-1 rounded-2xl shrink-0" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.15)" }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActive(key)}
                className="flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: active === key ? "#4B5FE8" : "transparent",
                  color: active === key ? "white" : "rgba(0,0,0,0.45)",
                }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="max-w-2xl mx-auto">
          {PREVIEWS[active]}
        </div>
      </div>
    </section>
  );
}
