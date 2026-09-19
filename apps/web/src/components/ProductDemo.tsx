"use client";
import { useState, useEffect, useRef } from "react";
import {
  Home, Layers, Calendar, CreditCard, Archive, HelpCircle,
  FileText, BookOpen, ListChecks, Sparkles, Plus, Mic2,
} from "lucide-react";
import { useTr } from "@/lib/useTr";

// Hero demo: one processed lecture, seen through the six tabs the app really
// produces — Summary · Transcript · Key Points · Quizzes · Flashcards · Ask.

const ACCENT = "#6E7FF3";
// Each class has a colour the student picks; this one's is the brand blue.
const CLASS_COLOR = "#4B5FE8";

const STEPS = [
  { view: "classes", tab: "summary",    phase: "idle",     dur: 2200 },
  { view: "lecture", tab: "summary",    phase: "idle",     dur: 4400 },
  { view: "lecture", tab: "points",     phase: "idle",     dur: 3800 },
  { view: "lecture", tab: "quiz",       phase: "idle",     dur: 3800 },
  { view: "lecture", tab: "cards",      phase: "idle",     dur: 3200 },
  { view: "lecture", tab: "ask",        phase: "thinking", dur: 1400 },
  { view: "lecture", tab: "ask",        phase: "answer",   dur: 4400 },
] as const;

const CAPTIONS: Record<string, { icon: any; title: string; desc: string; flagship?: boolean }> = {
  "classes-summary-idle": {
    icon: Layers, title: "Every class, in its own colour",
    desc: "You pick a colour per class and Flux uses it everywhere — tabs, formulas, quiz answers.",
  },
  "lecture-summary-idle": {
    icon: Sparkles, title: "One tap. Six ways to study it.", flagship: true,
    desc: "Process Lecture turns the recording into a summary, transcript, key points, quizzes, flashcards and a chat — formulas written properly.",
  },
  "lecture-points-idle": {
    icon: ListChecks, title: "Key points, colour-coded",
    desc: "Definitions, formulas, examples and the things your professor flagged, separated at a glance.",
  },
  "lecture-quiz-idle": {
    icon: BookOpen, title: "Eight questions from your lecture",
    desc: "Multiple choice drawn from what was actually said. The right answer lights up in your class colour.",
  },
  "lecture-cards-idle": {
    icon: Layers, title: "Flashcards you didn't have to make",
    desc: "Click to flip. Pulled from the lecture itself, so they test what was taught.",
  },
  "lecture-ask-thinking": {
    icon: Sparkles, title: "Ask this lecture anything", flagship: true,
    desc: "A chat scoped to this one recording — the transcript and every board photo you took.",
  },
  "lecture-ask-answer": {
    icon: Sparkles, title: "Ask this lecture anything", flagship: true,
    desc: "A chat scoped to this one recording — the transcript and every board photo you took.",
  },
};

const NAV = [
  { key: "home",   icon: Home,       label: "Home"      },
  { key: "record", icon: Layers,     label: "Workspace" },
  { key: "cal",    icon: Calendar,   label: "Calendar"  },
  { key: "arch",   icon: Archive,    label: "Archive"   },
  { key: "bill",   icon: CreditCard, label: "Billing"   },
  { key: "help",   icon: HelpCircle, label: "Help"      },
];

const RESULT_TABS = [
  { key: "summary",    label: "Summary",    icon: FileText   },
  { key: "transcript", label: "Transcript", icon: BookOpen   },
  { key: "points",     label: "Key Points", icon: ListChecks },
  { key: "quiz",       label: "Quizzes",    icon: HelpCircle },
  { key: "cards",      label: "Flashcards", icon: Layers     },
  { key: "ask",        label: "Ask",        icon: Sparkles   },
] as const;

const COURSES = [
  { name: "Calculus II",  tint: CLASS_COLOR, meta: "12 lectures" },
  { name: "Biology 101",  tint: "#16A34A",   meta: "9 lectures"  },
  { name: "Econ 202",     tint: "#9333EA",   meta: "7 lectures"  },
  { name: "History 201",  tint: "#EA580C",   meta: "5 lectures"  },
];

const LECTURE_TITLE = "Lecture 7 — Definite Integrals";

const SUMMARY_BULLETS = [
  "A definite integral is the signed area under f(x) between two bounds.",
  "The Fundamental Theorem turns that area into an antiderivative evaluated at the bounds.",
];
const SUMMARY_FORMULAS = ["∫₀¹ x² dx = 1/3", "∑ᵢ₌₁ⁿ i = n(n+1)/2"];
const KEY_TERM = { term: "Antiderivative", def: "a function whose derivative is the integrand" };
const EXAM_TIP = "He said twice that the bounds matter more than the algebra.";

// Category colours, exactly as the app marks them.
const POINTS = [
  { cat: "Definition", color: "#4B5FE8", text: "The definite integral measures signed area, so area below the axis counts as negative." },
  { cat: "Formula",    color: "#9333EA", text: "∫₀¹ x² dx = 1/3" },
  { cat: "Important",  color: "#DC2626", text: "The Fundamental Theorem is the point of the whole chapter." },
  { cat: "Example",    color: "#16A34A", text: "Area under x² from 0 to 1, worked line by line on the board." },
  { cat: "Warning",    color: "#EA580C", text: "Swapping the bounds flips the sign of the integral." },
];

const QUIZ_Q = "What does the Fundamental Theorem of Calculus let you do?";
const QUIZ_OPTIONS = [
  "Differentiate the product of two functions",
  "Evaluate a definite integral from an antiderivative at the bounds",
  "Find the limit of an infinite sequence",
  "Convert any sum into a derivative",
];
const QUIZ_CORRECT = 1;

const CARDS = [
  { front: "What does ∫₀¹ x² dx evaluate to?", back: "1/3", flipped: false },
  { front: "Define a definite integral.", back: "The signed area under f(x) between a and b.", flipped: true },
];

const ASK_Q = "What formulas were covered?";
const ASK_A = "Two. The worked example gave ∫₀¹ x² dx = 1/3, and the sum you photographed off the board was ∑ᵢ₌₁ⁿ i = n(n+1)/2. He also set up θ ∈ [0, π] for Thursday.";

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar() {
  const tr = useTr();
  return (
    <div className="w-36 shrink-0 hidden sm:flex flex-col py-5" style={{ background: "rgba(0,0,0,0.02)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="px-4 pb-4 mb-2" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "#0f1115" }}>Flux</div>
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21,0.45)", marginTop: 1 }}>{tr("Study Assistant")}</div>
      </div>
      <div className="flex-1 px-2 pt-1 flex flex-col gap-0.5">
        <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(15,17,21,0.4)", padding: "6px 8px 4px" }}>Menu</div>
        {NAV.map(({ key, icon: Icon, label }) => {
          const active = key === "record";
          return (
            <div key={key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              style={{ background: active ? "rgba(75,95,232,0.12)" : "transparent", color: active ? CLASS_COLOR : "rgba(15,17,21,0.55)" }}>
              <Icon size={11} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tr(label)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Classes view ─────────────────────────────────────────────────────────────
function ClassesView({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  const tr = useTr();
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-5">
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, color: "#0f1115", fontWeight: 700 }}>{tr("Workspace")}</div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ background: CLASS_COLOR, color: "white", fontSize: 11 }}>
          <Plus size={11} />{tr("New Class")}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COURSES.map((c, i) => (
          <div key={c.name} ref={i === 0 ? cardRef : undefined} className="rounded-xl p-4"
            style={{ background: i === 0 ? `${c.tint}14` : "#FFFFFF", border: `1px solid ${i === 0 ? c.tint : "rgba(0,0,0,0.08)"}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5" style={{ background: `${c.tint}1F` }}>
              <Layers size={12} style={{ color: c.tint }} />
            </div>
            <div className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.tint }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f1115" }}>{tr(c.name)}</span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(15,17,21,0.55)" }}>{tr(c.meta)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Processed lecture, seen through its six tabs ──────────────────────────────
function LectureView({ tab, phase, refs }: {
  tab: string; phase: string;
  refs: Record<string, React.RefObject<HTMLDivElement | null>>;
}) {
  const tr = useTr();
  const label = { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(15,17,21,0.55)", marginBottom: 5 };
  const body = { fontSize: 11.5, lineHeight: 1.6, color: "rgba(15,17,21,0.75)" };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Lecture title */}
      <div className="flex items-center gap-2 px-5 pt-4">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CLASS_COLOR }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f1115" }}>{tr(LECTURE_TITLE)}</span>
        <span className="flex items-center gap-1 ml-auto" style={{ fontSize: 9.5, color: "rgba(15,17,21,0.55)" }}>
          <Mic2 size={10} /> 48 min · 2 board photos
        </span>
      </div>

      {/* The six result tabs */}
      <div className="px-5 pt-3">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          {RESULT_TABS.map(({ key, label: tabLabel, icon: Icon }) => {
            const active = tab === key;
            return (
              <div key={key} ref={refs[key]} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all"
                style={{
                  background: active ? CLASS_COLOR : "transparent",
                  color: active ? "white" : "rgba(15,17,21,0.55)",
                  fontSize: 9.5,
                  fontWeight: active ? 600 : 500,
                  whiteSpace: "nowrap",
                }}>
                <Icon size={10} />{tr(tabLabel)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-5 py-3 overflow-hidden">

        {/* SUMMARY */}
        {tab === "summary" && (
          <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", animation: "pdIn 0.35s ease both" }}>
            <div style={label}>What we covered</div>
            <ul className="space-y-1 mb-3">
              {SUMMARY_BULLETS.map(b => (
                <li key={b} className="flex gap-2" style={body}>
                  <span style={{ color: "rgba(15,17,21,0.35)" }}>•</span><span>{tr(b)}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl p-3 mb-3" style={{ background: `${CLASS_COLOR}0F`, border: `1px solid ${CLASS_COLOR}26` }}>
              <div style={label}>{tr("Formulas")}</div>
              {SUMMARY_FORMULAS.map(f => (
                <div key={f} style={{ fontSize: 14, lineHeight: 1.7, color: "#0f1115" }}>{f}</div>
              ))}
            </div>

            <div className="mb-3">
              <div style={label}>{tr("Key Terms")}</div>
              <div style={body}>
                <span style={{ fontWeight: 600, color: "#0f1115" }}>{tr(KEY_TERM.term)}</span> — {tr(KEY_TERM.def)}
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: `${CLASS_COLOR}0F`, border: `1px solid ${CLASS_COLOR}26` }}>
              <div style={label}>{tr("Exam Tips")}</div>
              <div className="flex gap-2" style={body}>
                <span style={{ color: "rgba(15,17,21,0.35)" }}>•</span><span>{tr(EXAM_TIP)}</span>
              </div>
            </div>
          </div>
        )}

        {/* KEY POINTS */}
        {tab === "points" && (
          <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", animation: "pdIn 0.35s ease both" }}>
            {POINTS.map((p, i) => (
              <div key={p.cat} className="flex gap-3 items-start mb-2.5 last:mb-0" style={{ animation: `pdIn 0.35s ease ${i * 0.06}s both` }}>
                <span className="shrink-0 text-center px-2 py-1 rounded-full"
                  style={{ fontSize: 9, fontWeight: 700, color: p.color, background: `${p.color}1A`, minWidth: 64 }}>
                  {tr(p.cat)}
                </span>
                <span style={body}>{tr(p.text)}</span>
              </div>
            ))}
          </div>
        )}

        {/* QUIZZES */}
        {tab === "quiz" && (
          <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", animation: "pdIn 0.35s ease both" }}>
            <div className="flex items-center justify-between mb-2.5">
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f1115" }}>1. {tr(QUIZ_Q)}</span>
              <span className="shrink-0 ml-3" style={{ fontSize: 9.5, color: "rgba(15,17,21,0.55)" }}>1 of 8</span>
            </div>
            <div className="space-y-1.5">
              {QUIZ_OPTIONS.map((opt, i) => {
                const right = i === QUIZ_CORRECT;
                return (
                  <div key={opt} className="rounded-xl px-3 py-2"
                    style={{
                      fontSize: 11,
                      border: `${right ? 2 : 1}px solid ${right ? CLASS_COLOR : "rgba(0,0,0,0.1)"}`,
                      background: right ? `${CLASS_COLOR}1A` : "transparent",
                      color: right ? CLASS_COLOR : "rgba(15,17,21,0.85)",
                      fontWeight: right ? 600 : 400,
                    }}>
                    {tr(opt)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FLASHCARDS */}
        {tab === "cards" && (
          <div className="grid grid-cols-2 gap-3" style={{ animation: "pdIn 0.35s ease both" }}>
            {CARDS.map((c, i) => (
              <div key={c.front} className="rounded-2xl p-4 flex flex-col"
                style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", minHeight: 132 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(15,17,21,0.35)", marginBottom: 6 }}>{i + 1} / 14</div>
                <div style={c.flipped ? body : { fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: "#0f1115" }}>
                  {tr(c.flipped ? c.back : c.front)}
                </div>
                <div className="mt-auto pt-3" style={{ fontSize: 10, color: "rgba(15,17,21,0.35)" }}>
                  {c.flipped ? tr("Click to hide") : tr("Click to reveal")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ASK THIS LECTURE */}
        {tab === "ask" && (
          <div className="flex flex-col gap-2.5" style={{ animation: "pdIn 0.35s ease both" }}>
            <div className="flex justify-end">
              <div className="px-3.5 py-2.5 max-w-[85%]"
                style={{ background: CLASS_COLOR, color: "white", borderRadius: "18px 18px 4px 18px", fontSize: 12, lineHeight: 1.5, fontWeight: 500 }}>
                {tr(ASK_Q)}
              </div>
            </div>

            {phase === "thinking" ? (
              <div className="flex justify-start">
                <div className="px-4 py-3 flex items-center gap-1.5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "18px 18px 18px 4px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgba(15,17,21,0.4)", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="px-3.5 py-3 max-w-[92%]"
                  style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(15,17,21,0.85)", borderRadius: "18px 18px 18px 4px", fontSize: 12, lineHeight: 1.7 }}>
                  {tr(ASK_A)}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, color: "rgba(15,17,21,0.55)" }}>
              Answers come from this recording — its transcript and its board photos.
            </div>

            <div className="flex gap-2 mt-auto">
              <div className="flex-1 px-3.5 py-2.5 rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: 11, color: "rgba(15,17,21,0.4)" }}>{tr("Ask about this lecture…")}</div>
              <div className="px-4 py-2.5 rounded-xl font-semibold" style={{ background: CLASS_COLOR, color: "white", fontSize: 11 }}>{tr("Send")}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Cursor ───────────────────────────────────────────────────────────────────
function Cursor({ x, y }: { x: number; y: number }) {
  return (
    <div className="pointer-events-none absolute z-50"
      style={{ left: x, top: y, transition: "left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 2L16 10.5L10.5 11.5L8 17L4 2Z" fill="#0f1115" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
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
  const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    summary:    useRef<HTMLDivElement>(null),
    transcript: useRef<HTMLDivElement>(null),
    points:     useRef<HTMLDivElement>(null),
    quiz:       useRef<HTMLDivElement>(null),
    cards:      useRef<HTMLDivElement>(null),
    ask:        useRef<HTMLDivElement>(null),
  };

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  function getPos(el: HTMLElement | null) {
    if (!el || !bodyRef.current) return { x: 0, y: 0 };
    const body = bodyRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { x: rect.left - body.left + rect.width / 2 - 10, y: rect.top - body.top + rect.height / 2 - 4 };
  }

  const stepKey = `${step.view}-${step.tab}-${step.phase}`;

  useEffect(() => {
    const target = step.view === "classes" ? classCardRef : refs[step.tab];
    setCursorPos(getPos(target?.current ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  useEffect(() => {
    const t = setTimeout(() => setStepIdx(i => (i + 1) % STEPS.length), step.dur);
    return () => clearTimeout(t);
  }, [stepIdx, step.dur]);

  const tr = useTr();
  const cap = CAPTIONS[stepKey];
  const CapIcon = cap?.icon ?? Sparkles;

  return (
    <div className="select-none w-full" style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes demoProgress { from { width: 0% } to { width: 100% } }
        @keyframes pdIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>

      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.025)" }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(0,0,0,0.12)" }} />
          <div className="mx-auto text-sm" style={{ color: "rgba(15,17,21,0.45)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Flux — Study Assistant</div>
        </div>

        <div ref={bodyRef} className="flex relative" style={{ height: 440 }}>
          <Sidebar />
          {step.view === "classes"
            ? <ClassesView cardRef={classCardRef} />
            : <LectureView tab={step.tab} phase={step.phase} refs={refs} />
          }
          <Cursor x={cursorPos.x} y={cursorPos.y} />
        </div>
      </div>

      {/* Caption */}
      <div className="mt-5">
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(0,0,0,0.1)" }}>
          <div key={stepIdx} style={{ height: "100%", background: ACCENT, borderRadius: 999, animation: `demoProgress ${step.dur}ms linear forwards` }} />
        </div>

        <div className="flex items-start gap-3.5 mt-4 px-1 max-w-xl mx-auto" style={{ minHeight: 70 }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cap?.flagship ? "rgba(75,95,232,0.12)" : "rgba(0,0,0,0.04)", border: cap?.flagship ? "1px solid rgba(75,95,232,0.35)" : "1px solid rgba(0,0,0,0.08)" }}>
            <CapIcon size={18} style={{ color: cap?.flagship ? CLASS_COLOR : "rgba(15,17,21,0.7)" }} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#0f1115", letterSpacing: "-0.01em" }}>
                {cap?.title ? tr(cap.title) : null}
              </span>
              {cap?.flagship && (
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: CLASS_COLOR, background: "rgba(75,95,232,0.12)", border: "1px solid rgba(75,95,232,0.3)" }}>
                  ★ Core feature
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(15,17,21,0.6)", marginTop: 4 }}>
              {cap?.desc ? tr(cap.desc) : null}
            </p>
          </div>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {STEPS.map((_, i) => (
          <button key={i} onClick={() => setStepIdx(i)} aria-label={`Step ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{ width: stepIdx === i ? 22 : 7, height: 7, background: stepIdx === i ? ACCENT : "rgba(0,0,0,0.18)" }} />
        ))}
      </div>
    </div>
  );
}
