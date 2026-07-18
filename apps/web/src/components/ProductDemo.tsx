"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home, Layers, Calendar, CreditCard, Archive, HelpCircle,
  Mic, Mic2, BookMarked, FileUp, PenLine, Youtube,
  Square, Plus, Zap, Sparkles, CheckCircle2,
} from "lucide-react";

// ── Steps: what the demo cycles through ────────────────────────────────────
// Durations are deliberately slow so the captions can actually be read.
const STEPS = [
  { view: "classes", tab: "record",    phase: "idle",      dur: 2000 },
  { view: "class",   tab: "record",    phase: "recording", dur: 2600 },
  { view: "class",   tab: "record",    phase: "done",      dur: 1800 },
  { view: "class",   tab: "video",     phase: "idle",      dur: 2000 },
  { view: "class",   tab: "video",     phase: "keypoints", dur: 3000 },
  { view: "class",   tab: "ask",       phase: "question",  dur: 2200 },
  { view: "class",   tab: "ask",       phase: "answer",    dur: 4800 }, // the hero — longest dwell
  { view: "class",   tab: "studybook", phase: "done",      dur: 2600 },
] as const;

// Big, readable captions for each step (what was previously tiny & missable).
const CAPTIONS: Record<string, { icon: any; title: string; desc: string; flagship?: boolean }> = {
  "classes-record-idle":    { icon: Layers,       title: "Your classes, organized for you", desc: "Every course in one place — Flux files everything automatically. No folders to manage." },
  "class-record-recording": { icon: Mic,          title: "Record lectures live",            desc: "Hit record in class. Flux transcribes every word as your professor speaks." },
  "class-record-done":      { icon: CheckCircle2, title: "Transcribed & remembered",        desc: "Seconds later it's a clean transcript, summary, and key points — saved to the course." },
  "class-video-idle":       { icon: Youtube,      title: "Add any YouTube lecture",         desc: "Paste a link and Flux pulls the full transcript into your course memory." },
  "class-video-keypoints":  { icon: Zap,          title: "Key points, extracted instantly", desc: "Definitions, examples, and exam-critical points — pulled out and labeled for you." },
  "class-ask-question":     { icon: Sparkles,     title: "Ask your course anything",         desc: "One chat box per class, on top of everything you've captured all semester.", flagship: true },
  "class-ask-answer":       { icon: Sparkles,     title: "Answers — with real sources",      desc: "Every answer cites the exact lecture minute or file it came from. No guessing.", flagship: true },
  "class-studybook-done":   { icon: BookMarked,   title: "A full study book, auto-built",    desc: "Chapters, glossary, and practice — generated from your whole course memory." },
};

const ACCENT = "#6E7FF3";

const NAV = [
  { key: "home",   icon: Home,       label: "Home"      },
  { key: "record", icon: Layers,     label: "Workspace" },
  { key: "cal",    icon: Calendar,   label: "Calendar"  },
  { key: "arch",   icon: Archive,    label: "Archive"   },
  { key: "bill",   icon: CreditCard, label: "Billing"   },
  { key: "help",   icon: HelpCircle, label: "Help"      },
];

const CLASS_TABS = [
  { key: "ask",       label: "Ask",          icon: Sparkles  },
  { key: "record",    label: "Record",       icon: Mic2      },
  { key: "files",     label: "Upload Files", icon: FileUp    },
  { key: "video",     label: "Upload Video", icon: Youtube   },
  { key: "studybook", label: "Study Book",   icon: BookMarked },
  { key: "note",      label: "Take Note",    icon: PenLine   },
] as const;

const COURSES = [
  { name: "Psychology 301", code: "PSY301" },
  { name: "Biology 101",    code: "BIO101" },
  { name: "Econ 202",       code: "ECO202" },
  { name: "History 201",    code: "HIS201" },
];

const RECORDINGS = [
  "Week 4 — Social Psychology",
  "Week 3 — Memory & Cognition",
  "Week 2 — Behavioral Theory",
];

const KEY_POINTS = [
  { cat: "Definition", text: "Cognitive dissonance is mental conflict from contradictory beliefs", color: "#6E7FF3", bg: "rgba(110,127,243,0.12)" },
  { cat: "Important",  text: "The brain resolves dissonance by changing beliefs or adding new ones", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  { cat: "Example",    text: "Pavlov's dogs — conditioned response through repeated stimulus pairing", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
];

const ASK_QUESTION = "What did the professor say about cognitive dissonance?";
const ASK_ANSWER = "She defined it as the mental discomfort from holding contradictory beliefs [1], and stressed it will be on the midterm — people resolve it by changing one belief or adding new ones [1][2].";
const ASK_CITATIONS = [
  { n: 1, label: "Lecture: Week 4 · 32:10" },
  { n: 2, label: "File: Week 4 slides" },
];

const STUDY_BOOKS = [
  { title: "Midterm Complete Study Guide", chapters: 6, terms: 24, color: "#6E7FF3" },
  { title: "Week 3 — Memory and Cognition", chapters: 4, terms: 16, color: "#a78bfa" },
  { title: "Final Exam Master Book",        chapters: 8, terms: 36, color: "#10b981" },
];

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <div className="w-36 shrink-0 hidden sm:flex flex-col py-5" style={{ background: "rgba(0,0,0,0.025)", borderRight: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "#191918" }}>Flux</div>
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(31,35,40,0.5)", marginTop: 1 }}>Study Assistant</div>
      </div>
      <div className="flex-1 px-2 pt-1 flex flex-col gap-0.5">
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(31,35,40,0.42)", padding: "6px 8px 4px" }}>Menu</div>
        {NAV.map(({ key, icon: Icon, label }) => {
          const active = key === "record";
          return (
            <div key={key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: active ? "rgba(75,95,232,0.18)" : "transparent", color: active ? "#4B5FE8" : "rgba(31,35,40,0.6)" }}>
              <Icon size={11} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Classes view ─────────────────────────────────────────────────────────────
function ClassesView({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-5">
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, color: "#191918", fontWeight: 700 }}>Workspace</div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "#4B5FE8", color: "white", fontSize: 11 }}>
          <Plus size={11} /> New Class
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COURSES.map((c, i) => (
          <div key={i} ref={i === 0 ? cardRef : undefined} className="rounded-xl p-4"
            style={{ background: i === 0 ? "rgba(75,95,232,0.18)" : "rgba(0,0,0,0.03)", border: `1px solid ${i === 0 ? "#4B5FE8" : "rgba(0,0,0,0.05)"}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5" style={{ background: "rgba(0,0,0,0.06)" }}>
              <Layers size={12} style={{ color: "rgba(31,35,40,0.7)" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "white", marginBottom: 2 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: "rgba(31,35,40,0.6)" }}>{c.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Class workspace ──────────────────────────────────────────────────────────
function ClassView({ tab, phase, refs }: {
  tab: string; phase: string;
  refs: Record<string, React.RefObject<HTMLDivElement | null>>;
}) {
  const isRecording = phase === "recording";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Feature tabs */}
      <div className="px-5 pt-4">
        <div className="flex gap-0.5 p-1 rounded-xl w-fit max-w-full overflow-hidden" style={{ background: "rgba(75,95,232,0.12)", border: "1px solid rgba(75,95,232,0.2)" }}>
          {CLASS_TABS.map(({ key, label, icon: Icon }) => {
            const activeTab = tab === key;
            return (
              <div key={key} ref={refs[key]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeTab ? "#4B5FE8" : "transparent",
                  color: activeTab ? "white" : "rgba(31,35,40,0.62)",
                  fontSize: 10,
                  fontWeight: activeTab ? 600 : 500,
                  boxShadow: activeTab ? "0 2px 10px rgba(75,95,232,0.5)" : "none",
                }}>
                <Icon size={11} />{label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 overflow-hidden">

        {/* RECORD TAB */}
        {tab === "record" && (
          <div className="flex gap-5">
            <div className="rounded-xl p-5 text-center flex flex-col items-center shrink-0" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", width: 160 }}>
              <div className="text-2xl mb-3 tabular-nums" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>{isRecording ? "00:42" : "00:00"}</div>
              <div ref={refs.mic} className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                style={{ background: isRecording ? "#ef4444" : "rgba(0,0,0,0.06)", boxShadow: isRecording ? "0 0 0 6px rgba(239,68,68,0.18)" : "none" }}>
                {isRecording ? <Square size={14} color="white" /> : <Mic size={15} color="white" />}
              </div>
              {isRecording
                ? <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span style={{ fontSize: 10, color: "rgba(31,35,40,0.75)" }}>Recording…</span></div>
                : <div style={{ fontSize: 10, color: "rgba(31,35,40,0.62)" }}>Tap to record</div>}
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(31,35,40,0.55)", marginBottom: 10 }}>Recordings</div>
              {RECORDINGS.map((title, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.05)" }}><Mic2 size={11} style={{ color: "rgba(31,35,40,0.7)" }} /></div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 11, color: "white", fontWeight: 500 }}>{title}</div>
                    <div style={{ fontSize: 9, color: "#4B5FE8" }}>Transcript · Summary · Key Points · Ask AI</div>
                  </div>
                  <div className="px-2 py-0.5 rounded-full" style={{ background: "rgba(75,95,232,0.2)", color: "#4B5FE8", fontSize: 9 }}>Open</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UPLOAD VIDEO TAB */}
        {tab === "video" && phase === "idle" && (
          <div style={{ maxWidth: 440 }}>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.28)" }}>
                <Youtube size={13} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: 11, color: "rgba(31,35,40,0.68)" }}>youtube.com/watch?v=lecture</span>
              </div>
              <div className="px-4 py-2.5 rounded-xl font-semibold" style={{ background: "#4B5FE8", color: "white", fontSize: 11 }}>Load</div>
            </div>
            <div className="rounded-xl overflow-hidden mb-3" style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.9)" }}>
                <Youtube size={22} style={{ color: "white" }} />
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.18)" }}>
              {["Transcript","Summary","Key Points","Chatbot"].map(t => (
                <div key={t} className="flex-1 text-center py-1.5 rounded-md" style={{ fontSize: 9, color: "rgba(31,35,40,0.68)" }}>{t}</div>
              ))}
            </div>
          </div>
        )}

        {tab === "video" && phase === "keypoints" && (
          <div style={{ maxWidth: 460 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#4B5FE8", marginBottom: 10, fontWeight: 600 }}>Key Points</div>
            <div className="space-y-2.5">
              {KEY_POINTS.map((kp, i) => (
                <div key={i} className="flex gap-2.5 items-start rounded-xl px-3.5 py-3" style={{ background: kp.bg, border: `1px solid ${kp.color}33` }}>
                  <span className="text-[8px] font-bold uppercase tracking-widest shrink-0 mt-0.5 px-2 py-0.5 rounded" style={{ color: kp.color, background: `${kp.color}2e` }}>{kp.cat}</span>
                  <span style={{ fontSize: 12, color: "rgba(31,35,40,0.9)", lineHeight: 1.5 }}>{kp.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASK TAB — the hero feature */}
        {tab === "ask" && (
          <div className="flex flex-col gap-3 mx-auto" style={{ maxWidth: 480 }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(75,95,232,0.2)", border: "1px solid rgba(75,95,232,0.4)" }}>
                <Sparkles size={12} style={{ color: "#4B5FE8" }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: "#C7CEFB" }}>Ask your course</span>
              </div>
              <span style={{ fontSize: 10, color: "rgba(31,35,40,0.6)", marginLeft: "auto" }}>In memory: 12 lectures · 8 files · 5 notes</span>
            </div>

            {/* User question */}
            <div className="flex justify-end">
              <div className="px-3.5 py-2.5 max-w-[88%]" style={{ background: "#4B5FE8", color: "white", borderRadius: "16px 16px 4px 16px", fontSize: 12.5, lineHeight: 1.5, fontWeight: 500 }}>
                {ASK_QUESTION}
              </div>
            </div>

            {phase === "question" ? (
              /* Thinking dots */
              <div className="flex justify-start">
                <div className="px-4 py-3 flex items-center gap-1.5" style={{ background: "rgba(0,0,0,0.05)", borderRadius: "16px 16px 16px 4px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(31,35,40,0.68)", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* AI answer */}
                <div className="flex justify-start">
                  <div className="px-3.5 py-3 max-w-[92%]" style={{ background: "rgba(0,0,0,0.05)", color: "rgba(31,35,40,0.9)", borderRadius: "16px 16px 16px 4px", fontSize: 12.5, lineHeight: 1.65, border: "1px solid rgba(0,0,0,0.05)" }}>
                    {ASK_ANSWER}
                  </div>
                </div>
                {/* Citation chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(31,35,40,0.55)", fontWeight: 600 }}>Sources</span>
                  {ASK_CITATIONS.map(c => (
                    <span key={c.n} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(75,95,232,0.2)", color: "#C7CEFB", border: "1px solid rgba(75,95,232,0.4)", fontSize: 10, fontWeight: 500 }}>
                      <span style={{ fontWeight: 800 }}>[{c.n}]</span> {c.label}
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 mt-1">
              <div className="flex-1 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", fontSize: 11, color: "rgba(31,35,40,0.5)" }}>Ask anything about this course…</div>
              <div className="px-4 py-2.5 rounded-xl font-semibold" style={{ background: "#4B5FE8", color: "white", fontSize: 11 }}>Send</div>
            </div>
          </div>
        )}

        {/* STUDY BOOK TAB */}
        {tab === "studybook" && (
          <div className="space-y-2.5" style={{ maxWidth: 440 }}>
            {STUDY_BOOKS.map((book, i) => (
              <div key={i} className="flex overflow-hidden rounded-xl" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div className="w-2 shrink-0" style={{ background: book.color }} />
                <div className="px-3.5 py-3.5 flex-1 flex items-center justify-between gap-3">
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "white", marginBottom: 3 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: "rgba(31,35,40,0.6)" }}>{book.chapters} chapters · {book.terms} key terms</div>
                  </div>
                  <Zap size={13} style={{ color: book.color, flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cursor ───────────────────────────────────────────────────────────────────
function Cursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div className="pointer-events-none absolute z-50"
      style={{ left: x, top: y, transition: "left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1)", transform: `scale(${clicking ? 0.82 : 1})` }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 2L16 10.5L10.5 11.5L8 17L4 2Z" fill="white" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export function ProductDemo() {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  const bodyRef      = useRef<HTMLDivElement>(null);
  const classCardRef = useRef<HTMLDivElement>(null);
  const refs = {
    ask:       useRef<HTMLDivElement>(null),
    record:    useRef<HTMLDivElement>(null),
    files:     useRef<HTMLDivElement>(null),
    video:     useRef<HTMLDivElement>(null),
    studybook: useRef<HTMLDivElement>(null),
    note:      useRef<HTMLDivElement>(null),
    mic:       useRef<HTMLDivElement>(null),
  };

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  function getPos(el: HTMLElement | null) {
    if (!el || !bodyRef.current) return { x: 0, y: 0 };
    const body = bodyRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { x: rect.left - body.left + rect.width / 2 - 10, y: rect.top - body.top + rect.height / 2 - 4 };
  }

  const CURSOR_REFS: Record<string, React.RefObject<HTMLDivElement | null>> = {
    "classes-record-idle":      classCardRef,
    "class-record-recording":   refs.mic,
    "class-record-done":        refs.record,
    "class-video-idle":         refs.video,
    "class-video-keypoints":    refs.video,
    "class-ask-question":       refs.ask,
    "class-ask-answer":         refs.ask,
    "class-studybook-done":     refs.studybook,
  };

  const stepKey = `${step.view}-${step.tab}-${step.phase}`;

  useEffect(() => {
    setCursorPos(getPos(CURSOR_REFS[stepKey]?.current ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    const t = setTimeout(() => setStepIdx(i => (i + 1) % STEPS.length), step.dur);
    return () => clearTimeout(t);
  }, [stepIdx, step.dur]);

  const cap = CAPTIONS[stepKey];
  const CapIcon = cap?.icon ?? Sparkles;

  return (
    <div className="select-none w-full" style={{ maxWidth: 900 }}>
      <style>{`@keyframes demoProgress { from { width: 0% } to { width: 100% } }`}</style>

      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)" }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.025)" }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="mx-auto text-sm" style={{ color: "rgba(31,35,40,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux — Study Assistant</div>
        </div>

        <div ref={bodyRef} className="flex relative" style={{ height: 420 }}>
          <Sidebar />
          {step.view === "classes"
            ? <ClassesView cardRef={classCardRef} />
            : <ClassView tab={step.tab} phase={step.phase} refs={refs} />
          }
          <Cursor x={cursorPos.x} y={cursorPos.y} clicking={step.phase === "recording"} />
        </div>
      </div>

      {/* ── Prominent caption — big, high-contrast, can't be missed ── */}
      <div className="mt-5">
        {/* progress bar — fills over the step's duration so the pace is felt */}
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(0,0,0,0.1)" }}>
          <div key={stepIdx} style={{ height: "100%", background: ACCENT, borderRadius: 999, animation: `demoProgress ${step.dur}ms linear forwards` }} />
        </div>

        <div className="flex items-start gap-3.5 mt-4 px-1 max-w-xl mx-auto" style={{ minHeight: 70 }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cap?.flagship ? "rgba(75,95,232,0.12)" : "rgba(0,0,0,0.05)", border: cap?.flagship ? "1px solid rgba(75,95,232,0.35)" : "1px solid rgba(0,0,0,0.1)" }}>
            <CapIcon size={18} style={{ color: cap?.flagship ? "#4B5FE8" : "rgba(0,0,0,0.7)" }} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#0f1115", letterSpacing: "-0.01em" }}>
                {cap?.title}
              </span>
              {cap?.flagship && (
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4B5FE8", background: "rgba(75,95,232,0.12)", border: "1px solid rgba(75,95,232,0.3)" }}>
                  ★ Core feature
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(0,0,0,0.6)", marginTop: 4 }}>
              {cap?.desc}
            </p>
          </div>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {STEPS.map((_, i) => (
          <button key={i} onClick={() => setStepIdx(i)} aria-label={`Step ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{ width: stepIdx === i ? 22 : 7, height: 7, background: stepIdx === i ? ACCENT : "rgba(0,0,0,0.2)" }} />
        ))}
      </div>
    </div>
  );
}
