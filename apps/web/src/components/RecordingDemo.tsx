"use client";
import { useState, useEffect, useRef } from "react";
import {
  Mic, Mic2, Square, Pause, Play, FileUp, BookOpen, BookMarked,
  PenLine, Youtube, CheckCircle, Loader2, Sparkles, Home,
  Layers, Calendar, Archive, CreditCard, HelpCircle,
} from "lucide-react";

const TITLE = "Cognitive Psychology — Week 4";
type Phase = "idle" | "typing" | "recording" | "paused" | "processing" | "done" | "hold";

const NAV = [
  { icon: Home,       label: "Home"      },
  { icon: Layers,     label: "Workspace" },
  { icon: Calendar,   label: "Calendar"  },
  { icon: Archive,    label: "Archive"   },
  { icon: CreditCard, label: "Billing"   },
  { icon: HelpCircle, label: "Help"      },
];

const TABS = [
  { icon: Mic2,      label: "Record"         },
  { icon: FileUp,    label: "Upload Files"   },
  { icon: BookOpen,  label: "Quizzes"        },
  { icon: Youtube,   label: "Upload Video"   },
  { icon: BookMarked,label: "Review"         },
  { icon: PenLine,   label: "Take Note"      },
];

const WAVE_HEIGHTS = Array.from({ length: 20 }, () => 0.35 + Math.random() * 0.65);
const WAVE_DURATIONS = Array.from({ length: 20 }, () => 0.4 + Math.random() * 0.7);

const RESULT_CARDS = [
  { label: "Transcript",  color: "#3b82f6", desc: "Full text ready"         },
  { label: "Summary",     color: "#a855f7", desc: "Key concepts extracted"  },
  { label: "Key Points",  color: "#f97316", desc: "15 points identified"    },
  { label: "Quiz",        color: "#22c55e", desc: "8 questions generated"   },
];

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function RecordingDemo() {
  const [phase, setPhase]   = useState<Phase>("idle");
  const [typed, setTyped]   = useState("");
  const [seconds, setSeconds] = useState(0);
  const [visibleCards, setVisible] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Main phase sequencer
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    if (phase === "idle") {
      schedule(() => setPhase("typing"), 900);
    }
    if (phase === "recording") {
      schedule(() => setPhase("processing"), 5800);
    }
    if (phase === "processing") {
      schedule(() => { setPhase("done"); setVisible(0); }, 3000);
    }
    if (phase === "done") {
      schedule(() => setPhase("hold"), 4500);
    }
    if (phase === "hold") {
      schedule(() => { setPhase("idle"); setTyped(""); setSeconds(0); setVisible(0); }, 1200);
    }
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Typing animation
  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length < TITLE.length) {
      const t = setTimeout(() => setTyped(TITLE.slice(0, typed.length + 1)), 55);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase("recording"), 600);
      return () => clearTimeout(t);
    }
  }, [phase, typed]);

  // Timer
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Result cards stagger
  useEffect(() => {
    if (phase !== "done") return;
    if (visibleCards >= RESULT_CARDS.length) return;
    const t = setTimeout(() => setVisible(v => v + 1), visibleCards === 0 ? 300 : 400);
    return () => clearTimeout(t);
  }, [phase, visibleCards]);

  return (
    <div className="w-full select-none" style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes rdBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes rdPulse  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes rdWave   { 0%,100%{transform:scaleY(0.25)} 50%{transform:scaleY(1)} }
        @keyframes rdFade   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rdRing   { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.4);opacity:0} }
        @keyframes rdSpin   { to{transform:rotate(360deg)} }
      `}</style>

      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          <span className="mx-auto text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux — Workspace</span>
        </div>

        <div className="flex" style={{ height: 420 }}>

          {/* Sidebar */}
          <div className="hidden sm:flex w-44 shrink-0 flex-col py-5" style={{ background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 17, color: "white" }}>Flux</div>
              <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Study Assistant</div>
            </div>
            <div className="flex-1 px-2">
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "6px 8px 4px" }}>Menu</div>
              {NAV.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: label === "Workspace" ? "rgba(37,99,235,0.18)" : "transparent", color: label === "Workspace" ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
                  <Icon size={11} />
                  <span style={{ fontSize: 10, fontWeight: label === "Workspace" ? 600 : 400 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Class pills + workspace label */}
            <div className="px-5 pt-4 pb-0">
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 8 }}>Workspace</div>
              <div className="flex gap-1.5 flex-wrap">
                {["Cognitive Psych", "Biology 101", "Econ 202"].map((c, i) => (
                  <div key={c} className="px-3 py-1 rounded-full" style={{
                    fontSize: 10, fontWeight: i === 0 ? 700 : 400,
                    background: i === 0 ? "#2563eb" : "rgba(255,255,255,0.06)",
                    color: i === 0 ? "white" : "rgba(255,255,255,0.45)",
                    border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>{c}</div>
                ))}
              </div>
            </div>

            {/* Feature tabs */}
            <div className="px-5 pt-3 pb-0">
              <div className="flex gap-0.5 p-0.5 rounded-xl w-fit" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}>
                {TABS.map(({ icon: Icon, label }, i) => (
                  <div key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                    style={{ background: i === 0 ? "#2563eb" : "transparent", color: i === 0 ? "white" : "rgba(255,255,255,0.4)", fontSize: 9 }}>
                    <Icon size={9} />{label}
                  </div>
                ))}
              </div>
            </div>

            {/* Record tab content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">

              {/* Name step */}
              {(phase === "idle" || phase === "typing") && (
                <div className="w-full max-w-xs flex flex-col items-center gap-4" style={{ animation: "rdFade 0.3s ease" }}>
                  <div className="w-full">
                    <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Recording Name</div>
                    <div className="w-full rounded-xl px-4 py-2.5 flex items-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", fontSize: 12, color: typed ? "white" : "rgba(255,255,255,0.25)" }}>
                      {typed || "e.g. Lecture 3 — Cell Division"}
                      {phase === "typing" && <span style={{ display: "inline-block", width: 1.5, height: 13, background: "white", marginLeft: 2, animation: "rdBlink 0.9s infinite" }} />}
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <Mic size={20} style={{ color: "rgba(255,255,255,0.5)" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Tap to start recording</div>
                </div>
              )}

              {/* Recording step */}
              {phase === "recording" && (
                <div className="w-full max-w-xs flex flex-col items-center gap-3" style={{ animation: "rdFade 0.3s ease" }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 52, fontWeight: 300, color: "white", letterSpacing: -2, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {fmt(seconds)}
                  </div>
                  {/* Waveform */}
                  <div className="flex items-end gap-0.5 h-10">
                    {WAVE_HEIGHTS.map((h, i) => (
                      <div key={i} style={{
                        width: 3, height: 40, borderRadius: 2,
                        background: "rgba(255,255,255,0.7)",
                        transformOrigin: "center",
                        animation: `rdWave ${WAVE_DURATIONS[i]}s ease-in-out infinite`,
                        animationDelay: `${i * 0.04}s`,
                      }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#ef4444", animation: "rdPulse 1s infinite" }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Recording — {TITLE}</span>
                  </div>
                  <div className="flex gap-2 w-full mt-1">
                    <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                      <Pause size={12} /> Pause
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: "#111110", fontSize: 10, color: "white" }}>
                      <Square size={12} /> Stop
                    </div>
                  </div>
                </div>
              )}

              {/* Processing step */}
              {phase === "processing" && (
                <div className="flex flex-col items-center gap-4" style={{ animation: "rdFade 0.3s ease" }}>
                  <div className="relative flex items-center justify-center w-20 h-20">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border" style={{
                        width: 30 + i * 18, height: 30 + i * 18,
                        borderColor: "rgba(255,255,255,0.12)",
                        animation: `rdRing 2s ease-out ${i * 0.45}s infinite`,
                      }} />
                    ))}
                    <div className="relative z-10 w-5 h-5 rounded-full border-2" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "white", animation: "rdSpin 0.8s linear infinite" }} />
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: 14, fontWeight: 500, color: "white", marginBottom: 4 }}>Processing your audio…</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Transcribing · Summarising · Generating</div>
                  </div>
                </div>
              )}

              {/* Done step */}
              {(phase === "done" || phase === "hold") && (
                <div className="w-full" style={{ animation: "rdFade 0.4s ease" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={14} style={{ color: "#22c55e" }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Processing complete! Your recording is ready.</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {RESULT_CARDS.map((card, i) => (
                      <div key={card.label} className="rounded-xl p-3 flex flex-col gap-2"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          opacity: visibleCards > i ? 1 : 0,
                          transform: visibleCards > i ? "translateY(0)" : "translateY(10px)",
                          transition: "opacity 0.35s ease, transform 0.35s ease",
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20` }}>
                          <Sparkles size={12} style={{ color: card.color }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "white", marginBottom: 2 }}>{card.label}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{card.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {(["typing", "recording", "processing", "done"] as Phase[]).map(p => (
          <div key={p} className="rounded-full transition-all duration-500"
            style={{
              width: (phase === p || (phase === "hold" && p === "done")) ? 20 : 6,
              height: 6,
              background: (phase === p || (phase === "hold" && p === "done")) ? "#2563eb" : "rgba(255,255,255,0.15)",
            }} />
        ))}
      </div>
    </div>
  );
}
