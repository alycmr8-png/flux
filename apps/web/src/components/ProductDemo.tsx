"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home, Layers, Calendar, CreditCard, Archive, HelpCircle,
  Mic, Mic2, BookMarked, FileUp, PenLine, Youtube,
  Square, Plus, Zap, Sparkles,
} from "lucide-react";

// ── Steps: what the demo cycles through ────────────────────────────────────
const STEPS = [
  { view: "classes", tab: "record",    phase: "idle",      dur: 900  },
  { view: "class",   tab: "record",    phase: "recording", dur: 1200 },
  { view: "class",   tab: "record",    phase: "done",      dur: 800  },
  { view: "class",   tab: "video",     phase: "idle",      dur: 900  },
  { view: "class",   tab: "video",     phase: "keypoints", dur: 1300 },
  { view: "class",   tab: "ask",       phase: "question",  dur: 1100 },
  { view: "class",   tab: "ask",       phase: "answer",    dur: 2200 },
  { view: "class",   tab: "studybook", phase: "done",      dur: 1100 },
] as const;

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
  { cat: "Definition", text: "Cognitive dissonance is mental conflict from contradictory beliefs", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  { cat: "Important",  text: "The brain resolves dissonance by changing beliefs or adding new ones", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
  { cat: "Example",    text: "Pavlov's dogs — conditioned response through repeated stimulus pairing", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  { cat: "Warning",    text: "Correlation ≠ causation — a common error in psychology research", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
];

const ASK_QUESTION = "What did the professor say about cognitive dissonance?";
const ASK_ANSWER = "She defined it as the mental discomfort from holding contradictory beliefs [1], and stressed it will be on the midterm — people resolve it by changing one belief or adding new ones [1][2].";
const ASK_CITATIONS = [
  { n: 1, label: "Lecture: Week 4 — Social Psychology · 32:10" },
  { n: 2, label: "File: Week 4 slides" },
];

const STUDY_BOOKS = [
  { title: "Midterm Complete Study Guide", chapters: 6, terms: 24, color: "#3b82f6" },
  { title: "Week 3 — Memory and Cognition", chapters: 4, terms: 16, color: "#a78bfa" },
  { title: "Final Exam Master Book",        chapters: 8, terms: 36, color: "#10b981" },
];

const LABELS: Record<string, string> = {
  "classes-record-idle":      "Browse your classes",
  "class-record-recording":   "Recording your lecture live…",
  "class-record-done":        "Lecture transcribed & remembered",
  "class-video-idle":         "Paste any YouTube lecture link",
  "class-video-keypoints":    "AI extracts key points instantly",
  "class-ask-question":       "Ask your course anything…",
  "class-ask-answer":         "Answers from everything you captured — with sources",
  "class-studybook-done":     "Full study book — auto-generated",
};

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <div className="w-40 shrink-0 flex flex-col py-5" style={{ background: "rgba(255,255,255,0.04)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "white" }}>Flux</div>
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Study Assistant</div>
      </div>
      <div className="flex-1 px-2 pt-1 flex flex-col gap-0.5">
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "6px 8px 4px" }}>Menu</div>
        {NAV.map(({ key, icon: Icon, label }) => {
          const active = key === "record";
          return (
            <div key={key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: active ? "rgba(37,99,235,0.18)" : "transparent", color: active ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
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
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, color: "white", fontWeight: 700 }}>Workspace</div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: "#2563eb", color: "white", fontSize: 10 }}>
          <Plus size={10} /> New Class
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COURSES.map((c, i) => (
          <div key={i} ref={i === 0 ? cardRef : undefined} className="rounded-xl p-4"
            style={{ background: i === 0 ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "#2563eb" : "rgba(255,255,255,0.08)"}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Layers size={12} style={{ color: "rgba(255,255,255,0.5)" }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "white", marginBottom: 2 }}>{c.name}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{c.code}</div>
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
      {/* Class pills */}
      <div className="px-5 pt-4 pb-0 flex items-center gap-1.5 flex-wrap">
        <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", width: "100%", marginBottom: 6 }}>Workspace</div>
        {COURSES.map((c, i) => (
          <div key={i} className="px-2.5 py-0.5 rounded-full"
            style={i === 0 ? { background: "#2563eb", color: "white", fontSize: 9 } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 9 }}>
            {c.name}
          </div>
        ))}
      </div>

      {/* Feature tabs */}
      <div className="px-5 pt-3">
        <div className="flex gap-0.5 p-0.5 rounded-xl w-fit" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}>
          {CLASS_TABS.map(({ key, label, icon: Icon }) => (
            <div key={key} ref={refs[key]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
              style={{ background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "white" : "rgba(255,255,255,0.4)", fontSize: 9 }}>
              <Icon size={9} />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 overflow-hidden">

        {/* RECORD TAB */}
        {tab === "record" && (
          <div className="flex gap-5">
            <div className="rounded-xl p-5 text-center flex flex-col items-center shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", width: 160 }}>
              <div className="text-2xl mb-3 tabular-nums" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>{isRecording ? "00:42" : "00:00"}</div>
              <div ref={refs.mic} className="w-11 h-11 rounded-full flex items-center justify-center mb-2"
                style={{ background: isRecording ? "#ef4444" : "rgba(255,255,255,0.12)" }}>
                {isRecording ? <Square size={13} color="white" /> : <Mic size={14} color="white" />}
              </div>
              {isRecording
                ? <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Recording…</span></div>
                : <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Tap to record</div>}
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Recordings</div>
              {RECORDINGS.map((title, i) => (
                <div key={i} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}><Mic2 size={10} style={{ color: "rgba(255,255,255,0.5)" }} /></div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 10, color: "white" }}>{title}</div>
                    <div style={{ fontSize: 8, color: "#60a5fa" }}>Transcript · Summary · Key Points · Ask AI</div>
                  </div>
                  <div className="px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", fontSize: 8 }}>Open</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UPLOAD VIDEO TAB */}
        {tab === "video" && phase === "idle" && (
          <div style={{ maxWidth: 420 }}>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <Youtube size={11} style={{ color: "#3b82f6" }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>youtube.com/watch?v=dQw4w9WgXcQ</span>
              </div>
              <div className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "#2563eb", color: "white", fontSize: 10 }}>Load</div>
            </div>
            <div className="rounded-xl overflow-hidden mb-3" style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Youtube size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
            </div>
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}>
              {["Transcript","Summary","Key Points","Flashcards","Chatbot"].map(t => (
                <div key={t} className="flex-1 text-center py-1.5 rounded-md" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{t}</div>
              ))}
            </div>
          </div>
        )}

        {tab === "video" && phase === "keypoints" && (
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3b82f6", marginBottom: 8 }}>Key Points</div>
            <div className="space-y-2">
              {KEY_POINTS.map((kp, i) => (
                <div key={i} className="flex gap-2 items-start rounded-xl px-3 py-2.5" style={{ background: kp.bg }}>
                  <span className="text-[7px] font-bold uppercase tracking-widest shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ color: kp.color, background: `${kp.color}22` }}>{kp.cat}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{kp.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASK TAB — the hero feature */}
        {tab === "ask" && (
          <div className="flex flex-col gap-2.5" style={{ maxWidth: 440 }}>
            <div className="flex items-center gap-1.5">
              <Sparkles size={10} style={{ color: "#3b82f6" }} />
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "#3b82f6" }}>Ask your course</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>In memory: 12 lectures · 8 files · 5 notes</span>
            </div>

            {/* User question */}
            <div className="flex justify-end">
              <div className="px-3 py-2 max-w-[85%]" style={{ background: "#2563eb", color: "white", borderRadius: "14px 14px 3px 14px", fontSize: 10, lineHeight: 1.5 }}>
                {ASK_QUESTION}
              </div>
            </div>

            {phase === "question" ? (
              /* Thinking dots */
              <div className="flex justify-start">
                <div className="px-3 py-2.5 flex items-center gap-1" style={{ background: "rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 3px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.4)", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* AI answer */}
                <div className="flex justify-start">
                  <div className="px-3 py-2 max-w-[90%]" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", borderRadius: "14px 14px 14px 3px", fontSize: 10, lineHeight: 1.6 }}>
                    {ASK_ANSWER}
                  </div>
                </div>
                {/* Citation chips */}
                <div className="flex flex-wrap gap-1.5">
                  {ASK_CITATIONS.map(c => (
                    <span key={c.n} className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                      style={{ background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.25)", fontSize: 8 }}>
                      <span style={{ fontWeight: 700 }}>[{c.n}]</span> {c.label}
                    </span>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 mt-1">
              <div className="flex-1 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Ask anything about this course…</div>
              <div className="px-3 py-2 rounded-xl" style={{ background: "#2563eb", color: "white", fontSize: 9 }}>Send</div>
            </div>
          </div>
        )}

        {/* STUDY BOOK TAB */}
        {tab === "studybook" && (
          <div className="space-y-2" style={{ maxWidth: 420 }}>
            {STUDY_BOOKS.map((book, i) => (
              <div key={i} className="flex overflow-hidden rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-2 shrink-0" style={{ background: book.color }} />
                <div className="px-3 py-3 flex-1 flex items-center justify-between gap-3">
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: "white", marginBottom: 2 }}>{book.title}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{book.chapters} chapters · {book.terms} key terms</div>
                  </div>
                  <Zap size={11} style={{ color: book.color, flexShrink: 0 }} />
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
        <path d="M4 2L16 10.5L10.5 11.5L8 17L4 2Z" fill="white" stroke="#111110" strokeWidth="1.2" strokeLinejoin="round" />
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

  useEffect(() => {
    const key = `${step.view}-${step.tab}-${step.phase}`;
    setCursorPos(getPos(CURSOR_REFS[key]?.current ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    const t = setTimeout(() => setStepIdx(i => (i + 1) % STEPS.length), step.dur);
    return () => clearTimeout(t);
  }, [stepIdx, step.dur]);

  const label = LABELS[`${step.view}-${step.tab}-${step.phase}`] ?? "";

  return (
    <div className="select-none w-full" style={{ maxWidth: 900 }}>
      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="mx-auto text-sm" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux — Study Assistant</div>
        </div>

        <div ref={bodyRef} className="flex relative" style={{ height: 400 }}>
          <Sidebar />
          {step.view === "classes"
            ? <ClassesView cardRef={classCardRef} />
            : <ClassView tab={step.tab} phase={step.phase} refs={refs} />
          }
          <Cursor x={cursorPos.x} y={cursorPos.y} clicking={step.phase === "recording"} />
        </div>
      </div>

      {/* Step label + dots */}
      <div className="mt-4 text-center">
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        {STEPS.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-300"
            style={{ width: stepIdx === i ? 20 : 6, height: 6, background: stepIdx === i ? "#2563eb" : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>
    </div>
  );
}
