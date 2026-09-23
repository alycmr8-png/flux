"use client";
import { useState, useEffect } from "react";
import {
  Mic2, Sparkles, Pause, Camera, StopCircle, PenLine,
  Home, Layers, Calendar, Archive, CreditCard, HelpCircle,
} from "lucide-react";
import { useTr } from "@/lib/useTr";

// Live-recording demo: the transcript writes itself while the professor talks,
// board photos get folded in, and it ends on the one Process Lecture button.

const TITLE = "Lecture 7 — Definite Integrals";
const CLASS_COLOR = "#4B5FE8";

type Phase = "live" | "saved" | "press" | "hold";

const NAV = [
  { icon: Home,       label: "Home"      },
  { icon: Layers,     label: "Workspace" },
  { icon: Calendar,   label: "Calendar"  },
  { icon: Archive,    label: "Archive"   },
  { icon: CreditCard, label: "Billing"   },
  { icon: HelpCircle, label: "Help"      },
];

const TABS = [
  { icon: Sparkles,       label: "Ask"       },
  { icon: Mic2,           label: "Record"    },
  { icon: Camera,         label: "Add Photo" },
  { icon: PenLine,        label: "Take Note" },
];

// What the professor is saying — speech, already written as real notation.
const SCRIPT =
  "So the area under this curve between zero and one — we write that as ∫₀¹ x² dx. " +
  "Evaluate it with the Fundamental Theorem and you get exactly one third. " +
  "Same trick for the sum on the board, ∑ᵢ₌₁ⁿ i = n(n+1)/2, " +
  "and for Thursday's example keep θ ∈ [0, π].";

const WORDS = SCRIPT.split(" ");
const WORD_MS = 115;
// Words still being revised stay grey until the model settles them.
const PENDING = 4;

// Board photos the student snaps mid-lecture, and when they appear.
const PHOTOS = [
  { at: 14, line1: "∫₀¹ x² dx", line2: "= ⅓" },
  { at: 34, line1: "∑ᵢ₌₁ⁿ i", line2: "= n(n+1)/2" },
];

const START_SEC = 18 * 60 + 24;

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function RecordingDemo() {
  const tr = useTr();
  const [phase, setPhase] = useState<Phase>("live");
  const [spoken, setSpoken] = useState(0);
  const [seconds, setSeconds] = useState(START_SEC);

  // Words stream in while recording, then the lecture is saved.
  useEffect(() => {
    if (phase !== "live") return;
    if (spoken < WORDS.length) {
      const t = setTimeout(() => setSpoken(n => n + 1), WORD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("saved"), 1100);
    return () => clearTimeout(t);
  }, [phase, spoken]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Saved → the tap on Process Lecture → loop
  useEffect(() => {
    if (phase === "saved") {
      const t = setTimeout(() => setPhase("press"), 2900);
      return () => clearTimeout(t);
    }
    if (phase === "press") {
      const t = setTimeout(() => setPhase("hold"), 900);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => { setPhase("live"); setSpoken(0); setSeconds(START_SEC); }, 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const live = phase === "live";
  // Once the recording stops there is nothing left to revise — it all settles.
  const settled = live ? WORDS.slice(0, Math.max(0, spoken - PENDING)).join(" ") : SCRIPT;
  const pending = live ? WORDS.slice(Math.max(0, spoken - PENDING), spoken).join(" ") : "";
  const photos = PHOTOS.filter(p => !live || spoken >= p.at);

  return (
    <div className="w-full select-none" style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes rdPulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes rdFade  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rdPop   { from{opacity:0;transform:scale(0.86)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: "rgba(0,0,0,0.025)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          <span className="mx-auto text-xs" style={{ color: "rgba(15,17,21,0.45)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Ucorns — Workspace</span>
        </div>

        <div className="flex" style={{ height: 480 }}>

          {/* Sidebar */}
          <div className="hidden sm:flex w-44 shrink-0 flex-col py-5" style={{ background: "rgba(0,0,0,0.02)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 17, color: "#0f1115" }}>Ucorns</div>
              <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21,0.45)", marginTop: 1 }}>{tr("Study Assistant")}</div>
            </div>
            <div className="flex-1 px-2">
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(15,17,21,0.4)", padding: "6px 8px 4px" }}>Menu</div>
              {NAV.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: label === "Workspace" ? "rgba(75,95,232,0.12)" : "transparent", color: label === "Workspace" ? CLASS_COLOR : "rgba(15,17,21,0.55)" }}>
                  <Icon size={11} />
                  <span style={{ fontSize: 10, fontWeight: label === "Workspace" ? 600 : 400 }}>{tr(label)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Class pills */}
            <div className="px-5 pt-4">
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 8 }}>{tr("Workspace")}</div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { name: tr("Calculus II"),   tint: CLASS_COLOR },
                  { name: tr("Biology 101"),   tint: "#16A34A"   },
                  { name: tr("History 201"),   tint: "#EA580C"   },
                ].map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{
                    fontSize: 10, fontWeight: i === 0 ? 700 : 400,
                    background: i === 0 ? c.tint : "transparent",
                    color: i === 0 ? "white" : "rgba(15,17,21,0.7)",
                    border: i === 0 ? `1px solid ${c.tint}` : "1px solid rgba(0,0,0,0.08)",
                  }}>
                    {i !== 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.tint }} />}
                    {c.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Class tabs */}
            <div className="px-5 pt-3">
              <div className="flex gap-1.5 flex-wrap">
                {TABS.map(({ icon: Icon, label }, i) => (
                  <div key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
                    style={{
                      background: i === 1 ? CLASS_COLOR : "transparent",
                      color: i === 1 ? "white" : "rgba(15,17,21,0.7)",
                      border: i === 1 ? `1px solid ${CLASS_COLOR}` : "1px solid rgba(0,0,0,0.08)",
                      fontSize: 9.5, fontWeight: i === 1 ? 600 : 500,
                    }}>
                    <Icon size={9} />{tr(label)}
                  </div>
                ))}
              </div>
            </div>

            {/* Recorder */}
            <div className="flex-1 px-5 py-4 overflow-hidden">
              <div className="h-full flex flex-col rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>

                {/* Header: red dot + state + elapsed */}
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: live ? "#DC2626" : CLASS_COLOR, animation: live ? "rdPulse 1.4s ease-in-out infinite" : "none" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f1115" }}>
                    {live ? tr("Live transcript") : TITLE}
                  </span>
                  {live && (
                    <span className="hidden sm:block truncate" style={{ fontSize: 10.5, color: "rgba(15,17,21,0.55)" }}>· {tr(TITLE)}</span>
                  )}
                  <span className="ml-auto tabular-nums shrink-0"
                    style={{ fontSize: 15, fontWeight: 500, color: "#0f1115", letterSpacing: -0.4 }}>
                    {fmt(seconds)}
                  </span>
                </div>

                {/* Live transcript — the words fill the screen, no waveform */}
                <div className="flex-1 px-5 py-4 overflow-hidden">
                  <p style={{ fontSize: 14.5, lineHeight: 1.85, color: "#0f1115" }}>
                    {settled}
                    {pending && (
                      <span style={{ color: "rgba(15,17,21,0.4)" }}>{settled ? " " : ""}{pending}</span>
                    )}
                    {!settled && !pending && (
                      <span style={{ color: "rgba(15,17,21,0.4)" }}>{tr("Start speaking — words appear here as you go.")}</span>
                    )}
                  </p>
                </div>

                {/* Board photos folded into the same lecture */}
                {photos.length > 0 && (
                  <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    {photos.map(p => (
                      <div key={p.at} className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(160deg, #F6F7FB, #ECEEF6)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          animation: "rdPop 0.35s ease both",
                        }}>
                        <span style={{ fontSize: 11, color: "#0f1115", fontWeight: 600 }}>{p.line1}</span>
                        <span style={{ fontSize: 10, color: "rgba(15,17,21,0.6)" }}>{p.line2}</span>
                      </div>
                    ))}
                    <span style={{ fontSize: 10.5, color: "rgba(15,17,21,0.55)", lineHeight: 1.5 }}>
                      Board photos — read into this lecture,<br />formulas and all.
                    </span>
                  </div>
                )}

                {/* Controls */}
                <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  {live ? (
                    <div className="flex gap-2.5">
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
                        style={{ border: "1px solid rgba(0,0,0,0.12)", fontSize: 11, fontWeight: 500, color: "#0f1115" }}>
                        <Pause size={13} />{tr("Pause")}</div>
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
                        style={{ border: "1px solid rgba(0,0,0,0.12)", fontSize: 11, fontWeight: 500, color: "#0f1115" }}>
                        <Camera size={13} /> Photo{photos.length ? ` (${photos.length})` : ""}
                      </div>
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
                        style={{ background: "#DC2626", fontSize: 11, fontWeight: 500, color: "white" }}>
                        <StopCircle size={13} />{tr("Stop")}</div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl"
                      style={{
                        background: CLASS_COLOR, color: "white", fontSize: 13, fontWeight: 600,
                        boxShadow: phase === "press" ? `0 0 0 6px rgba(75,95,232,0.22)` : `0 6px 20px rgba(75,95,232,0.28)`,
                        transform: phase === "press" ? "scale(0.975)" : "scale(1)",
                        transition: "all 0.2s ease",
                        animation: "rdFade 0.35s ease both",
                      }}>
                      <Sparkles size={15} /> Process Lecture
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center mt-4" style={{ fontSize: 13.5, color: "rgba(15,17,21,0.55)" }}>
        {live
          ? tr("The words appear as they're said — grey while they settle, then final.")
          : tr("One button turns the lecture and its board photos into your study material.")}
      </p>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {(["live", "saved"] as Phase[]).map(p => {
          const on = p === "live" ? live : !live;
          return (
            <div key={p} className="rounded-full transition-all duration-500"
              style={{ width: on ? 20 : 6, height: 6, background: on ? CLASS_COLOR : "rgba(0,0,0,0.14)" }} />
          );
        })}
      </div>
    </div>
  );
}
