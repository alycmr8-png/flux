"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home, Layers, FileText, Calendar, BarChart2, CreditCard, Archive,
  Mic, Mic2, BookOpen, BookMarked, FileUp, PenLine, GraduationCap,
  Square, Plus,
} from "lucide-react";

const STEPS = [
  { view: "classes", tab: "record",    phase: "idle",      dur: 1000 },
  { view: "class",   tab: "record",    phase: "idle",      dur: 700  },
  { view: "class",   tab: "record",    phase: "recording", dur: 1400 },
  { view: "class",   tab: "record",    phase: "done",      dur: 700  },
  { view: "class",   tab: "quizzes",   phase: "done",      dur: 1200 },
  { view: "class",   tab: "studybook", phase: "done",      dur: 1200 },
] as const;

const NAV = [
  { key: "home",      icon: Home,       label: "Home"      },
  { key: "record",    icon: Layers,     label: "Workspace" },
  { key: "summaries", icon: FileText,   label: "Summaries" },
  { key: "calendar",  icon: Calendar,   label: "Calendar"  },
  { key: "progress",  icon: BarChart2,  label: "Progress"  },
  { key: "archive",   icon: Archive,    label: "Archive"   },
  { key: "billing",   icon: CreditCard, label: "Billing"   },
];

const CLASS_TABS = [
  { key: "record",    label: "Record",     icon: Mic2          },
  { key: "files",     label: "Files",      icon: FileUp        },
  { key: "quizzes",   label: "Quizzes",    icon: BookOpen      },
  { key: "studybook", label: "Study Book", icon: BookMarked    },
  { key: "note",      label: "Take Note",  icon: PenLine       },
  { key: "syllabus",  label: "Syllabus",   icon: GraduationCap },
];

const COURSES = [
  { name: "Psychology 301", code: "PSY301" },
  { name: "Econ 202",       code: "ECO202" },
  { name: "Biology 101",    code: "BIO101" },
  { name: "History 201",    code: "HIS201" },
];

const RECORDINGS = [
  "Week 4 - Social Psychology",
  "Week 3 - Memory and Cognition",
  "Week 2 - Behavioral Theory",
];

const STUDY_BOOKS = [
  { title: "Midterm Complete Study Guide", chapters: 6, terms: 24, color: "#8fa389" },
  { title: "Week 3 - Memory and Cognition", chapters: 4, terms: 16, color: "#b0a08a" },
  { title: "Final Exam Master Book",        chapters: 8, terms: 36, color: "#a08ab0" },
];

function Sidebar() {
  return (
    <div className="w-44 shrink-0 flex flex-col py-5" style={{ background: "rgba(255,255,255,0.04)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "normal", fontSize: 18, fontWeight: 800, color: "white" }}>Flux</div>
        <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Study Assistant</div>
      </div>
      <div className="flex-1 px-2 pt-1 flex flex-col gap-0.5">
        <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", padding: "6px 8px 4px" }}>Menu</div>
        {NAV.map(({ key, icon: Icon, label }) => {
          const active = key === "record";
          return (
            <div key={key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: active ? "rgba(37,99,235,0.18)" : "transparent", color: active ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
              <Icon size={12} />
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassesView({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex-1 p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", fontSize: 22, color: "white", fontWeight: 400 }}>Workspace</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Your classes, lectures, and quizzes</div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "#2563eb", color: "white", fontSize: 11 }}>
          <Plus size={11} /> New Class
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COURSES.map((c, i) => (
          <div
            key={i}
            ref={i === 0 ? cardRef : undefined}
            className="rounded-xl p-5"
            style={{
              background: i === 0 ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${i === 0 ? "#2563eb" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.1)" }}>
              <Layers size={13} style={{ color: "rgba(255,255,255,0.5)" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "white", marginBottom: 2 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{c.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassView({ tab, phase, recordTabRef, quizTabRef, sbTabRef, micBtnRef }: {
  tab: string;
  phase: string;
  recordTabRef: React.RefObject<HTMLDivElement | null>;
  quizTabRef:   React.RefObject<HTMLDivElement | null>;
  sbTabRef:     React.RefObject<HTMLDivElement | null>;
  micBtnRef:    React.RefObject<HTMLDivElement | null>;
}) {
  const isRecording = phase === "recording";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-0 flex items-center gap-2 flex-wrap">
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 10, width: "100%" }}>Workspace</div>
        {COURSES.map((c, i) => (
          <div
            key={i}
            className="px-3 py-1 rounded-full text-xs"
            style={i === 0
              ? { background: "#2563eb", color: "white", border: "1px solid #2563eb", fontSize: 10 }
              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 10 }}
          >
            {c.name}
          </div>
        ))}
      </div>

      <div className="px-6 pt-4 pb-0">
        <div className="flex gap-0.5 rounded-xl p-1 w-fit" style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}>
          {CLASS_TABS.map(({ key, label, icon: Icon }) => {
            const ref = key === "record" ? recordTabRef : key === "quizzes" ? quizTabRef : key === "studybook" ? sbTabRef : undefined;
            return (
              <div
                key={key}
                ref={ref}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: tab === key ? "#2563eb" : "transparent", color: tab === key ? "white" : "rgba(255,255,255,0.4)", fontSize: 10 }}
              >
                <Icon size={10} />
                {label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        {tab === "record" && (
          <div className="flex gap-6">
            <div className="rounded-2xl p-6 text-center shrink-0 flex flex-col items-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", width: 180 }}>
              <div className="text-3xl mb-4 tabular-nums" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>
                {isRecording ? "00:42" : "00:00"}
              </div>
              <div
                ref={micBtnRef}
                className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                style={{ background: isRecording ? "#ef4444" : "rgba(255,255,255,0.15)" }}
              >
                {isRecording ? <Square size={14} color="white" /> : <Mic size={15} color="white" />}
              </div>
              {isRecording ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Recording</span>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Tap to record</div>
              )}
            </div>

            <div className="flex-1">
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Previous Recordings</div>
              {RECORDINGS.map((title, i) => (
                <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Mic2 size={11} style={{ color: "rgba(255,255,255,0.5)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 11, color: "white", marginBottom: 1 }}>{title}</div>
                    <div style={{ fontSize: 9, color: "#60a5fa" }}>AI ready</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full shrink-0" style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", fontSize: 9 }}>Open</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "quizzes" && (
          <div style={{ maxWidth: 460 }}>
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Question 1 of 5</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "white", marginBottom: 14, lineHeight: 1.5 }}>What is cognitive dissonance?</div>
              {[
                "Mental conflict from contradictory beliefs",
                "Long-term memory storage process",
                "Selective attention bias",
                "Unconscious repetition of behaviors",
              ].map((opt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2"
                  style={{
                    border: `1px solid ${i === 0 ? "#2563eb" : "rgba(255,255,255,0.07)"}`,
                    background: i === 0 ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: i === 0 ? "#3b82f6" : "rgba(255,255,255,0.2)" }} />
                  <span style={{ fontSize: 11, color: i === 0 ? "white" : "rgba(255,255,255,0.45)" }}>{opt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "studybook" && (
          <div className="space-y-2.5" style={{ maxWidth: 460 }}>
            {STUDY_BOOKS.map((book, i) => (
              <div key={i} className="flex overflow-hidden rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-2.5 shrink-0" style={{ background: book.color }} />
                <div className="px-4 py-3.5 flex-1 flex items-center justify-between gap-4">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "white", marginBottom: 2 }}>{book.title}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{book.chapters} chapters · {book.terms} key terms</div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 16 }}>›</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Cursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: x,
        top: y,
        transition: "left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1)",
        transform: `scale(${clicking ? 0.82 : 1})`,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 2L16 10.5L10.5 11.5L8 17L4 2Z" fill="white" stroke="#111110" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ProductDemo() {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  const bodyRef      = useRef<HTMLDivElement>(null);
  const classCardRef = useRef<HTMLDivElement>(null);
  const recordTabRef = useRef<HTMLDivElement>(null);
  const micBtnRef    = useRef<HTMLDivElement>(null);
  const quizTabRef   = useRef<HTMLDivElement>(null);
  const sbTabRef     = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  function getPos(el: HTMLElement | null): { x: number; y: number } {
    if (!el || !bodyRef.current) return { x: 0, y: 0 };
    const body = bodyRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left - body.left + rect.width / 2 - 10,
      y: rect.top  - body.top  + rect.height / 2 - 4,
    };
  }

  useEffect(() => {
    const refs = [classCardRef, recordTabRef, micBtnRef, quizTabRef, quizTabRef, sbTabRef];
    setCursorPos(getPos(refs[stepIdx]?.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    const t = setTimeout(() => setStepIdx(i => (i + 1) % STEPS.length), step.dur);
    return () => clearTimeout(t);
  }, [stepIdx, step.dur]);

  const LABELS: Record<string, string> = {
    "classes-record-idle":    "Browse your classes",
    "class-record-idle":      "Open a class",
    "class-record-recording": "Recording live lecture...",
    "class-record-done":      "Lecture recorded",
    "class-quizzes-done":     "AI quiz from your lecture",
    "class-studybook-done":   "Auto-generated study book",
  };
  const label = LABELS[`${step.view}-${step.tab}-${step.phase}`] ?? "";

  return (
    <div className="select-none w-full" style={{ maxWidth: 900 }}>
      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#111110", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="mx-auto text-sm" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux</div>
        </div>

        <div ref={bodyRef} className="flex relative" style={{ height: 420 }}>
          <Sidebar />
          {step.view === "classes" ? (
            <ClassesView cardRef={classCardRef} />
          ) : (
            <ClassView
              tab={step.tab}
              phase={step.phase}
              recordTabRef={recordTabRef}
              quizTabRef={quizTabRef}
              sbTabRef={sbTabRef}
              micBtnRef={micBtnRef}
            />
          )}
          <Cursor x={cursorPos.x} y={cursorPos.y} clicking={step.phase === "recording"} />
        </div>
      </div>

      <div className="mt-5 text-center">
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{ width: stepIdx === i ? 20 : 6, height: 6, background: stepIdx === i ? "#2563eb" : "rgba(255,255,255,0.15)" }}
          />
        ))}
      </div>
    </div>
  );
}
