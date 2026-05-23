"use client";
import { useState, useEffect } from "react";
import { Mic, Square, FileText, BookOpen, AlignLeft, CheckCircle } from "lucide-react";

const LECTURE_TITLE = "Cognitive Psychology - Week 4";

type Phase = "idle" | "typing" | "recording" | "processing" | "results" | "hold";

const CARDS = [
  { icon: FileText,  label: "Cheat Sheet", desc: "12 key concepts extracted",  color: "#3b82f6", delay: 0    },
  { icon: BookOpen,  label: "Quiz",        desc: "8 practice questions ready", color: "#a855f7", delay: 500  },
  { icon: AlignLeft, label: "Summary",     desc: "2-min read overview",        color: "#22c55e", delay: 1000 },
];

export function RecordingDemo() {
  const [phase, setPhase]          = useState<Phase>("idle");
  const [typed, setTyped]          = useState("");
  const [seconds, setSeconds]      = useState(0);
  const [progress, setProgress]    = useState(0);
  const [visibleCards, setVisible] = useState(0);

  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(() => setPhase("typing"), 800);
      return () => clearTimeout(t);
    }
    if (phase === "recording" && seconds >= 6) {
      const t = setTimeout(() => { setPhase("processing"); setSeconds(0); }, 400);
      return () => clearTimeout(t);
    }
    if (phase === "processing" && progress >= 100) {
      const t = setTimeout(() => { setPhase("results"); setProgress(0); }, 300);
      return () => clearTimeout(t);
    }
    if (phase === "results" && visibleCards >= 3) {
      const t = setTimeout(() => setPhase("hold"), 600);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => {
        setPhase("idle");
        setTyped("");
        setSeconds(0);
        setProgress(0);
        setVisible(0);
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [phase, seconds, progress, visibleCards]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length < LECTURE_TITLE.length) {
      const t = setTimeout(() => setTyped(LECTURE_TITLE.slice(0, typed.length + 1)), 65);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase("recording"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, typed]);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds(s => s + 1), 700);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "processing") return;
    const t = setInterval(() => setProgress(p => Math.min(p + 4, 100)), 70);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "results") return;
    if (visibleCards >= 3) return;
    const t = setTimeout(() => setVisible(v => v + 1), visibleCards === 0 ? 200 : 500);
    return () => clearTimeout(t);
  }, [phase, visibleCards]);

  const fmt = (s: number) => `00:0${Math.min(s, 9)}`;

  return (
    <div className="w-full select-none" style={{ maxWidth: 680 }}>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          <span className="mx-auto text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic" }}>
            Flux &mdash; Workspace
          </span>
        </div>

        <div className="p-8" style={{ minHeight: 340 }}>

          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Mic size={14} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: typed ? "white" : "rgba(255,255,255,0.25)" }}>
              {typed || "Lecture title..."}
            </span>
            {(phase === "typing" || phase === "idle") && (
              <span style={{ display: "inline-block", width: 2, height: 16, background: "white", marginLeft: 1, animation: "demoBlink 1s infinite" }} />
            )}
          </div>

          {phase === "recording" && (
            <div className="flex flex-col items-center py-6" style={{ animation: "demoFadeIn 0.3s ease" }}>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                style={{ background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.4)", animation: "demoPulseRing 1.5s infinite" }}
              >
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#ef4444" }}>
                  <Square size={18} color="white" />
                </div>
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 44, fontWeight: 300, color: "white", letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {fmt(seconds)}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full" style={{ background: "#ef4444", animation: "demoPulse 1s infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Recording &mdash; {typed}</span>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center py-8" style={{ animation: "demoFadeIn 0.3s ease" }}>
              <div
                className="w-12 h-12 rounded-full border-2 mb-5"
                style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "white", animation: "demoSpin 0.8s linear infinite" }}
              />
              <div style={{ fontSize: 15, color: "white", fontWeight: 500, marginBottom: 6 }}>Processing your lecture...</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>Transcribing &middot; Summarising &middot; Generating</div>
              <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{ width: `${progress}%`, background: "white" }}
                />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>{progress}%</div>
            </div>
          )}

          {(phase === "results" || phase === "hold") && (
            <div style={{ animation: "demoFadeIn 0.3s ease" }}>
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle size={14} style={{ color: "#22c55e" }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Lecture processed &mdash; your materials are ready</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {CARDS.map((card, i) => {
                  const Icon = card.icon;
                  const visible = visibleCards > i;
                  return (
                    <div
                      key={card.label}
                      className="rounded-2xl p-5 flex flex-col gap-3"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        opacity: visible ? 1 : 0,
                        transform: visible ? "translateY(0)" : "translateY(12px)",
                        transition: "opacity 0.4s ease, transform 0.4s ease",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: `${card.color}20` }}
                      >
                        <Icon size={15} style={{ color: card.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "white", marginBottom: 3 }}>{card.label}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{card.desc}</div>
                      </div>
                      <div
                        className="mt-auto text-xs font-medium px-3 py-1.5 rounded-lg text-center"
                        style={{ background: `${card.color}18`, color: card.color }}
                      >
                        Open &rarr;
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(phase === "idle" || phase === "typing") && typed.length === 0 && (
            <div className="flex flex-col items-center py-10" style={{ animation: "demoFadeIn 0.3s ease" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Mic size={24} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Ready to record your lecture</div>
            </div>
          )}

        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-5">
        {(["typing", "recording", "processing", "results"] as Phase[]).map(p => (
          <div
            key={p}
            className="rounded-full transition-all duration-500"
            style={{
              width:  phase === p || (phase === "hold" && p === "results") ? 24 : 6,
              height: 6,
              background: phase === p || (phase === "hold" && p === "results")
                ? "rgba(255,255,255,0.6)"
                : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes demoBlink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes demoPulse    { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes demoPulseRing{ 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.3)} 50%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
        @keyframes demoSpin     { to{transform:rotate(360deg)} }
        @keyframes demoFadeIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
