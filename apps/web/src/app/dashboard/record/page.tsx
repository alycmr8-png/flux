"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import {
  Mic, Loader2, Plus, Pause, Play, StopCircle,
  Calendar, X, Mic2, FileText, ArrowLeft, Layers, Check,
  PenLine, Trash2, RotateCcw, Sparkles, ImagePlus, ChevronRight,
  AlertTriangle, ListChecks, HelpCircle, BookOpen, Camera, Send, Square,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { useToast, useConfirm } from "@/components/Feedback";
import { useAuth } from "@clerk/nextjs";
import { useT } from "@/lib/useT";
import useSWR from "swr";
import { format } from "date-fns";
import { TiptapNoteEditor } from "@/components/TiptapNoteEditor";
import { MathText, FormulaText } from "@/components/MathText";
import { recSafeClear } from "@/lib/recSafe";
import { useRecorder, MAX_LECTURE_PHOTOS } from "@/lib/recorder";
import { ensureFiniteDuration } from "@/lib/audioDuration";
import { toMathNotation, mathToPlainText } from "@sano/shared";
import { apiBase } from "@/lib/apiBase";
import { useTr } from "@/lib/useTr";

// Grid previews are clamped to two lines, so maths is shown as readable symbols there.
const latexToReadablePreview = (text: string) => mathToPlainText(text).replace(/\s+/g, " ").trim();


const BASE = apiBase();

/** The palette a class picks its colour from — shared with the mobile app. */
const CLASS_COLORS = [
  "#4B5FE8", "#6E7FF3", "#3B82F6", "#0891B2", "#0D9488", "#16A34A",
  "#65A30D", "#D97706", "#EA580C", "#DC2626", "#E11D48", "#DB2777",
  "#9333EA", "#7C3AED", "#0F766E", "#475569", "#1F2937", "#B45309",
];

const BRAND = "#4B5FE8";
const tint = (c: any) => c?.color || BRAND;

const CATEGORY_COLOR: Record<string, string> = {
  Definition: "#4B5FE8",
  Important: "#DC2626",
  Formula: "#9333EA",
  Example: "#16A34A",
  Warning: "#EA580C",
};

/** The three-dot indicator a chat shows while the other side is composing. */
function TypingDots({ color = BRAND, size = 7 }: { color?: string; size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 5, paddingBlock: 3 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            background: color,
            display: "inline-block",
            animation: `typingDot 960ms ease-in-out ${i * 160}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Keyframes used across the workspace — mounted once per screen that needs them. */
const WORKSPACE_KEYFRAMES = `
  @keyframes typingDot {
    0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-4px); }
  }
  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.82); }
  }
  @keyframes ringPulse {
    0% { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(2.4); opacity: 0; }
  }
`;

// ─── Lecture results (Summary · Transcript · Key Points · Quizzes · Flashcards · Ask) ──
type ResultTab = "summary" | "transcript" | "points" | "quiz" | "cards" | "ask";

const RESULT_TABS: { key: ResultTab; label: string; icon: any }[] = [
  { key: "summary",    label: "Summary",    icon: FileText   },
  { key: "transcript", label: "Transcript", icon: BookOpen   },
  { key: "points",     label: "Key Points", icon: ListChecks },
  { key: "quiz",       label: "Quizzes",    icon: HelpCircle },
  { key: "cards",      label: "Flashcards", icon: Layers     },
  { key: "ask",        label: "Ask",        icon: Sparkles   },
];

function LectureResults({
  lectureId, title, sheet, color = BRAND, initialTranscript = "", onRecordAnother,
}: {
  lectureId: string;
  title: string;
  sheet: any | null;
  color?: string;
  initialTranscript?: string;
  onRecordAnother: () => void;
}) {
  const tr = useTr();
  const apiFetch = useApiFetch();
  const toast = useToast();
  const [view, setView] = useState<ResultTab>("summary");

  const [transcript, setTranscript] = useState<string | null>(initialTranscript ? initialTranscript : null);
  const [points, setPoints] = useState<any[] | null>(null);
  const [cards, setCards] = useState<any[] | null>(null);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [quiz, setQuiz] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<ResultTab | null>(null);

  // Every tab fetches at most once — reopening it shows what was already loaded.
  async function load(target: ResultTab) {
    setView(target);
    if (loading) return;
    try {
      if (target === "transcript" && transcript === null) {
        setLoading("transcript");
        const r = await apiFetch(`/api/lectures/${lectureId}`);
        setTranscript(r.data?.transcript ?? "");
      }
      if (target === "points" && !points) {
        setLoading("points");
        const r = await apiFetch("/api/studybook/key-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureId }),
        });
        setPoints(r.data?.points ?? []);
      }
      if (target === "cards" && !cards) {
        setLoading("cards");
        const r = await apiFetch("/api/studybook/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureId }),
        });
        setCards(r.data?.cards ?? []);
      }
      if (target === "quiz" && !quiz) {
        setLoading("quiz");
        // Processing already made a quiz for this lecture — reuse it rather than
        // paying to generate another one every time this tab is opened.
        const existing = await apiFetch(`/api/quizzes?lectureId=${lectureId}`);
        const first = (existing.data ?? [])[0];
        const id = first?.id ?? (await apiFetch("/api/quizzes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureId }),
        })).data?.id;
        const full = await apiFetch(`/api/quizzes/${id}`);
        setQuiz(full.data ?? null);
      }
    } catch (e: any) {
      toast(e?.message ?? tr("Couldn't generate that — try again in a moment."), "error");
    } finally {
      setLoading(null);
    }
  }

  const chatAbortRef = useRef<AbortController | null>(null);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading === "ask") return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading("ask");
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const r = await apiFetch("/api/studybook/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, messages: next }),
        signal: controller.signal,
      });
      setMessages([...next, { role: "assistant", content: r.data?.reply ?? "" }]);
    } catch (e: any) {
      // A stop is the student's choice, not a failure — leave the question and move on.
      if (e?.name !== "AbortError") {
        setMessages([...next, { role: "assistant", content: e?.message ?? tr("Something went wrong — try again.") }]);
      }
    } finally {
      chatAbortRef.current = null;
      setLoading(null);
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    const ordered = (quiz.questions ?? []).map((_: any, i: number) => answers[i] ?? -1);
    try {
      const r = await apiFetch(`/api/quizzes/${quiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: ordered }),
      });
      setScore({ correct: r.data?.correct ?? 0, total: r.data?.total ?? quiz.questions.length });
    } catch {
      const correct = (quiz.questions ?? []).filter((q: any, i: number) => q.correctIndex === answers[i]).length;
      setScore({ correct, total: quiz.questions?.length ?? 0 });
    }
  }

  const content = sheet?.content ?? {};
  const card = "rounded-2xl border p-6";
  const cardStyle = { background: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" };
  const label = "text-[13.5px] font-bold uppercase tracking-widest mb-2";
  const body = "text-[16px] leading-[1.75]";
  const bodyStyle = { color: "rgba(15,17,21, 0.82)" };

  return (
    <div>
      <style>{WORKSPACE_KEYFRAMES}</style>

      {/* Title */}
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
        <h2 className="text-lg font-semibold" style={{ color: "#0f1115" }}>{title}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap p-1.5 rounded-2xl mb-5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
        {RESULT_TABS.map(({ key, label: tabLabel, icon: Icon }) => (
          <button
            key={key}
            onClick={() => load(key)}
            className="flex items-center gap-2 whitespace-nowrap transition-all"
            style={{
              padding: "9px 16px",
              borderRadius: 999,
              fontSize: 16,
              fontWeight: view === key ? 600 : 500,
              background: view === key ? color : "transparent",
              color: view === key ? "#fff" : "rgba(15,17,21,0.55)",
            }}
          >
            <Icon size={14} />
            {tr(tabLabel)}
          </button>
        ))}
      </div>

      {loading === view && (
        <div className="flex items-center justify-center gap-2.5 py-12">
          <Loader2 size={16} className="animate-spin" style={{ color }} />
          <span className="text-[16px]" style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Generating…")}</span>
        </div>
      )}

      {/* ── Summary ── */}
      {view === "summary" && (
        <div className={card} style={cardStyle}>
          {(content.sections ?? []).map((sec: any, i: number) => (
            <div key={i} className="mb-6 last:mb-0">
              <MathText as="div" className={label} style={{ color: "rgba(15,17,21, 0.73)" }} text={sec.heading} />
              <ul className="space-y-1.5">
                {(sec.bullets ?? []).map((b: string, j: number) => (
                  <li key={j} className={`flex gap-2.5 ${body}`} style={bodyStyle}>
                    <span style={{ color: "rgba(15,17,21, 0.62)" }}>•</span>
                    <MathText className="min-w-0" text={b} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {(content.formulas ?? []).length > 0 && (
            <div className="rounded-xl p-4 mt-5" style={{ background: `${color}0F`, border: `1px solid ${color}26` }}>
              <div className={label} style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Formulas")}</div>
              {content.formulas.map((f: string, i: number) => (
                <FormulaText key={i} as="div" className="text-[17.5px] leading-7" style={{ color: "#0f1115" }} text={f} />
              ))}
            </div>
          )}

          {(content.keyTerms ?? []).length > 0 && (
            <div className="mt-5">
              <div className={label} style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Key Terms")}</div>
              <div className="space-y-1.5">
                {content.keyTerms.map((kt: any, i: number) => (
                  <div key={i} className={body} style={bodyStyle}>
                    <MathText className="font-semibold" style={{ color: "#0f1115" }} text={kt.term} />
                    {kt.definition ? <>{" — "}<MathText text={kt.definition} /></> : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(content.examTips ?? []).length > 0 && (
            <div className="rounded-xl p-4 mt-5" style={{ background: `${color}0F`, border: `1px solid ${color}26` }}>
              <div className={label} style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Exam Tips")}</div>
              <ul className="space-y-1.5">
                {content.examTips.map((tp: string, i: number) => (
                  <li key={i} className={`flex gap-2.5 ${body}`} style={bodyStyle}>
                    <span style={{ color: "rgba(15,17,21, 0.62)" }}>•</span>
                    <MathText className="min-w-0" text={tp} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!(content.sections ?? []).length && (
            <div className={body} style={bodyStyle}>{tr("No summary was generated for this lecture.")}</div>
          )}
        </div>
      )}

      {/* ── Transcript ── */}
      {view === "transcript" && transcript !== null && (
        <div className={card} style={cardStyle}>
          {transcript.trim()
            ? <MathText as="p" className="text-[17.5px] leading-[1.85] whitespace-pre-wrap" style={{ color: "rgba(15,17,21, 0.88)" }} text={transcript} />
            : <p className={body} style={bodyStyle}>{tr("No transcript available for this lecture.")}</p>}
        </div>
      )}

      {/* ── Key points ── */}
      {view === "points" && points && (
        <div className={card} style={cardStyle}>
          {points.map((p: any, i: number) => {
            const c = CATEGORY_COLOR[p.category] ?? BRAND;
            return (
              <div key={i} className="flex gap-3 items-start mb-3 last:mb-0">
                <span className="text-[13.5px] font-bold shrink-0 px-2.5 py-1 rounded-full text-center"
                  style={{ color: c, background: `${c}1A`, minWidth: 84 }}>
                  {tr(p.category)}
                </span>
                <MathText className={`${body} min-w-0`} style={bodyStyle} text={p.point} />
              </div>
            );
          })}
          {!points.length && <p className={body} style={bodyStyle}>{tr("No key points found.")}</p>}
        </div>
      )}

      {/* ── Quizzes ── */}
      {view === "quiz" && quiz && (
        <div className="space-y-3">
          {(quiz.questions ?? []).map((q: any, i: number) => (
            <div key={q.id ?? i} className={card} style={cardStyle}>
              <div className="text-[17.5px] font-semibold mb-3" style={{ color: "#0f1115" }}>{i + 1}. <MathText text={q.question} /></div>
              <div className="space-y-2">
                {(q.options ?? []).map((opt: string, oi: number) => {
                  const picked = answers[i] === oi;
                  const revealed = !!score;
                  const isRight = q.correctIndex === oi;
                  // A correct answer is marked in the class colour; a wrong pick
                  // stays red so the two never read the same.
                  const borderColor = revealed && isRight ? color
                    : revealed && picked && !isRight ? "#DC2626"
                    : picked ? color : "rgba(0,0,0,0.1)";
                  const background = revealed && isRight ? `${color}1A`
                    : revealed && picked && !isRight ? "rgba(220,38,38,0.06)"
                    : picked ? `${color}0F` : "transparent";
                  return (
                    <button
                      key={oi}
                      disabled={!!score}
                      onClick={() => setAnswers(a => ({ ...a, [i]: oi }))}
                      className="w-full text-left rounded-xl px-4 py-3 text-[16px] transition-colors disabled:cursor-default"
                      style={{ border: `${revealed && isRight ? 2 : 1}px solid ${borderColor}`, background, color: revealed && isRight ? color : "rgba(15,17,21,0.85)", fontWeight: revealed && isRight ? 600 : 400 }}
                    >
                      <MathText text={opt} />
                    </button>
                  );
                })}
              </div>
              {score && q.explanation && (
                <MathText as="p" className="text-[16px] mt-3 leading-relaxed" style={{ color: "rgba(15,17,21, 0.75)" }} text={q.explanation} />
              )}
            </div>
          ))}

          {score ? (
            <div className={`${card} text-center`} style={cardStyle}>
              <div className="text-4xl font-extrabold mb-1" style={{ color }}>{score.correct} / {score.total}</div>
              <div className={body} style={bodyStyle}>
                {Math.round((score.correct / Math.max(score.total, 1)) * 100)}% correct
              </div>
            </div>
          ) : (
            <button onClick={submitQuiz}
              className="w-full rounded-2xl py-4 text-[17.5px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: color }}>{tr("Check answers")}</button>
          )}
        </div>
      )}

      {/* ── Flashcards ── */}
      {view === "cards" && cards && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c: any, i: number) => (
            <button
              key={i}
              onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
              className={`${card} text-left min-w-0 transition-colors hover:border-[rgba(0,0,0,0.18)]`}
              style={{ ...cardStyle, minHeight: 150, ...(flipped[i] ? { borderColor: color, background: `${color}12` } : {}) }}
            >
              <div className="text-[14.5px] font-semibold mb-2" style={{ color: "rgba(15,17,21, 0.62)" }}>{i + 1} / {cards.length}</div>
              <MathText as="div" className="text-[17.5px] font-semibold leading-relaxed"
                style={{ color: flipped[i] ? color : "#0f1115" }}
                text={flipped[i] ? c.back : c.front} />
              <div className="text-[14.5px] mt-3" style={{ color: "rgba(15,17,21, 0.62)" }}>
                {flipped[i] ? tr("Click to hide") : tr("Click to reveal")}
              </div>
            </button>
          ))}
          {!cards.length && (
            <div className={card} style={cardStyle}><p className={body} style={bodyStyle}>{tr("No flashcards were generated.")}</p></div>
          )}
        </div>
      )}

      {/* ── Ask this lecture ── */}
      {view === "ask" && (
        <div>
          {messages.length === 0 && (
            <div className={`${card} mb-3`} style={cardStyle}>
              <div className="text-[17.5px] font-semibold" style={{ color: "#0f1115" }}>{tr("Ask anything about this lecture")}</div>
              <p className={`${body} mt-1`} style={bodyStyle}>{tr("Answers come from this recording's transcript.")}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {[tr("Explain the main idea simply"), tr("What formulas were covered?"), tr("What might be on the exam?")].map(p => (
                  <button key={p} onClick={() => send(p)}
                    className="text-[15.5px] px-4 py-2.5 rounded-full transition-colors"
                    style={{ color, background: `${color}0F`, border: `1px solid ${color}26` }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 mb-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <MathText className="text-[16.5px] max-w-[82%] leading-[1.65] px-5 py-3.5 whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? color : "#FFFFFF",
                    border: m.role === "user" ? "none" : "1px solid rgba(0,0,0,0.08)",
                    color: m.role === "user" ? "#fff" : "rgba(15,17,21,0.85)",
                    borderRadius: m.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                  }}
                  text={m.content} />
              </div>
            ))}
            {loading === "ask" && (
              <div className="flex justify-start">
                <span className="px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "20px 20px 20px 6px" }}>
                  <TypingDots color={color} />
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 items-center">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder={tr("Ask about this lecture…")}
              className="flex-1 rounded-2xl px-5 py-3.5 text-[16.5px] outline-none"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }} />
            {loading === "ask" ? (
              <button onClick={() => chatAbortRef.current?.abort()} aria-label={tr("Stop")}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: "#0f1115" }}>
                <Square size={15} fill="currentColor" />
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} aria-label="Send"
                className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                style={{ background: color }}>
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center mt-6">
        <button onClick={onRecordAnother}
          className="text-[16px] px-5 py-2.5 rounded-full transition-colors hover:bg-black/[0.03]"
          style={{ color: "rgba(15,17,21, 0.73)", border: "1px solid rgba(0,0,0,0.12)" }}>{tr("Back to recordings")}</button>
      </div>
    </div>
  );
}

// ─── Create Class Mini-Page ───────────────────────────────────────────────────
function CreateClassPage({ onBack, onCreate }: { onBack: () => void; onCreate: (c: any) => void }) {
  const tr = useTr();
  const apiFetch = useApiFetch();
  const toast = useToast();
  const t = useT();
  const [name, setName] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0]);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      // The API still requires a code; it is never shown anywhere in the app.
      const code = name.trim().slice(0, 6).toUpperCase().replace(/\s/g, "") || "CLASS";
      const res = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code, color }),
      });
      const course = res.data;

      toast(`${course.name} is ready`, "success");
      onCreate(course);
    } catch (e: any) {
      toast(e?.message ?? tr("Couldn't create the class. Check that you're online and try again."), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-800 hover:text-gray-900 transition-colors text-[16px] mb-8">
        <ArrowLeft size={14} /> {t.common.back}
      </button>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 40, letterSpacing: "-0.5px", color: "#0f1115", margin: "0 0 4px" }}>{t.newClass.title}</h1>
      <p className="text-gray-800 text-[16px] mb-8">{t.newClass.subtitle}</p>

      <div className="space-y-4">
        {/* Class name */}
        <div>
          <label className="text-[13.5px] text-gray-800 uppercase tracking-widest block mb-1.5">{t.newClass.classNameLabel}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder={t.newClass.classNamePlaceholder}
            className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-[16px] text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Colour — every pill, card and results screen for this class picks it up */}
        <div>
          <label className="text-[13.5px] text-gray-800 uppercase tracking-widest block mb-2">{tr("Colour")}</label>
          <div className="flex flex-wrap gap-2">
            {CLASS_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Use colour ${c}`}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none" }}
              >
                {color === c && <Check size={15} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={create}
          disabled={loading || !name.trim()}
          className="w-full rounded-xl py-3 text-[16px] font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: color }}
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> {t.common.creating}</> : t.newClass.create}
        </button>
      </div>
    </div>
  );
}

// ─── Class list (home) ────────────────────────────────────────────────────────
function ClassList({ onSelect, onCreate }: { onSelect: (c: any) => void; onCreate: () => void }) {
  const tr = useTr();
  const t = useT();
  const { userId } = useAuth();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading, mutate } = useSWR(userId ? `${BASE}/api/courses` : null, fetcher, { revalidateOnFocus: false });
  const courses: any[] = data?.data ?? [];
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteCourse(id: string) {
    setDeleting(true);
    try {
      await apiFetch(`/api/courses/${id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="w-full">
      {/* Same header system as Home: a brand eyebrow naming the section, then the
          sentence as the heading — Plus Jakarta Sans 800, not the serif italic. */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#4B5FE8", marginBottom: 8 }}>
            {t.workspace.title}
          </div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: "#0f1115", margin: 0 }}>
            {t.workspace.subtitle}
          </h1>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 shrink-0 text-[15px] font-semibold px-4 py-2.5 rounded-full transition-opacity hover:opacity-90"
          style={{ background: "#4B5FE8", color: "#fff" }}
        >
          <Plus size={15} /> {t.workspace.newClass}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-7 animate-pulse">
              <div className="h-4 bg-[#1e1e1e] rounded w-2/3 mb-3" />
              <div className="h-3 bg-[rgba(99,102,241,0.12)] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="border border-dashed border-[rgba(0,0,0,0.08)] rounded-2xl p-16 text-center">
          <Layers size={36} className="mx-auto mb-4 text-[#222]" />
          <p className="text-gray-800 text-[16px] font-medium mb-1">{tr("No classes yet")}</p>
          <p className="text-gray-800 text-[15px] mb-4">{tr("Create your first class to start recording lectures")}</p>
          <button onClick={onCreate} className="text-[15px] text-[#6b6b69] border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full hover:border-[#ddd] transition-colors">{tr("Create a class")}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="relative group/card">
              {confirmDeleteId === c.id ? (
                <div className="bg-[#FFFFFF] border border-red-200 rounded-2xl p-7 flex flex-col gap-3">
                  <p className="text-[16px] font-medium text-gray-900">Delete &ldquo;{c.name}&rdquo;?</p>
                  <p className="text-[15px] text-gray-800 leading-relaxed">
                    This permanently deletes the class and everything in it — recordings, transcripts, summaries and notes. This cannot be undone.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setConfirmDeleteId(null)} disabled={deleting}
                      className="flex-1 text-[15px] py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-gray-800 hover:text-gray-900 transition-colors">{tr("Cancel")}</button>
                    <button onClick={() => deleteCourse(c.id)} disabled={deleting}
                      className="flex-1 text-[15px] py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(c)}
                    className="w-full bg-[#FFFFFF] rounded-2xl p-7 text-left transition-all"
                    style={{ border: "1px solid rgba(0,0,0,0.08)", borderLeft: `5px solid ${tint(c)}` }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white font-semibold"
                      style={{ background: tint(c) }}>
                      {(c.name ?? "?").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="text-gray-900 font-medium text-[17px]">{c.name}</div>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-50"
                    title={tr("Delete class")}
                  >
                    <Trash2 size={13} className="text-[#bbb] hover:text-red-500 transition-colors" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Class workspace ──────────────────────────────────────────────────────────
function ClassWorkspace({ course, allCourses, onSelect, onBack }: {
  course: any; allCourses: any[]; onSelect: (c: any) => void; onBack: () => void;
}) {
  const tr = useTr();
  const t = useT();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();
  const [tab, setTab] = useState<"record" | "photo" | "note" | "ask">("record");
  // Every accent in this workspace comes from the class's own colour.
  const color = tint(course);

  // Track which tabs have been visited so we only fetch data on demand
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(["record"]));
  function switchTab(next: typeof tab) {
    setVisitedTabs(prev => new Set([...prev, next]));
    setTab(next);
  }



  // Lectures always fetch — needed for Record tab (primary tab)
  const { data: lecturesData, mutate: mutateLectures } = useSWR(
    `${BASE}/api/lectures?courseId=${course.id}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const lectures: any[] = lecturesData?.data ?? [];
  // A handful of lectures may still carry a youtube.com/youtu.be audioUrl from
  // before video import was removed — keep them out of the Record tab's list.
  const isYoutubeUrl = (u?: string | null) => !!u && /youtube\.com|youtu\.be/.test(u);
  const ytIdFromUrl = (u?: string | null) =>
    u?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/)?.[1] ?? null;
  const audioLectures: any[] = lectures.filter((l: any) => l.audioUrl && !isYoutubeUrl(l.audioUrl));

  // ── Photos ─────────────────────────────────────────────────────────────────
  // Whiteboards, slides, handwritten pages. Ucorns reads each one (maths typeset)
  // and files it into this class's memory, so Ask can answer from it.
  const { data: photosData, mutate: mutatePhotos } = useSWR(
    visitedTabs.has("photo") ? `${BASE}/api/photos?courseId=${course.id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      // Poll only while a photo is still being read.
      refreshInterval: (latest: any) => ((latest?.data ?? []).some((p: any) => p.status === "reading") ? 2500 : 0),
    }
  );
  const photos: any[] = photosData?.data ?? [];
  const [photoUploading, setPhotoUploading] = useState(false);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const openPhoto = photos.find((p: any) => p.id === openPhotoId) ?? null;
  const MAX_PHOTOS_PER_UPLOAD = 10;

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS_PER_UPLOAD);
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("courseId", course.id);
      list.forEach(f => fd.append("photos", f));
      const res = await apiFetch("/api/photos", { method: "POST", body: fd });
      await mutatePhotos({ data: [...(res.data ?? []), ...photos] }, { revalidate: false });
      if (files.length > MAX_PHOTOS_PER_UPLOAD) toast(`Added the first ${MAX_PHOTOS_PER_UPLOAD} photos — add the rest in another batch.`, "error");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast(
        e?.name === "QuotaError" ? msg
          : msg.includes("API 415") ? tr("Photos must be JPEG, PNG, WebP or GIF.")
          : tr("Couldn't add those photos — try again."),
        "error"
      );
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function deletePhoto(id: string) {
    const ok = await confirm({
      title: tr("Delete this photo?"),
      message: tr("The photo and what Ucorns read from it are removed, and Ask will stop using it."),
      confirmLabel: tr("Delete"),
      danger: true,
    });
    if (!ok) return;
    setOpenPhotoId(null);
    await mutatePhotos({ data: photos.filter((p: any) => p.id !== id) }, { revalidate: false });
    try {
      await apiFetch(`/api/photos/${id}`, { method: "DELETE" });
    } catch {
      toast(tr("Couldn't delete that photo — try again."), "error");
      mutatePhotos();
    }
  }

  async function retryPhoto(id: string) {
    await mutatePhotos({ data: photos.map((p: any) => (p.id === id ? { ...p, status: "reading" } : p)) }, { revalidate: false });
    try {
      await apiFetch(`/api/photos/${id}/retry`, { method: "POST" });
    } finally {
      mutatePhotos();
    }
  }

  // ── record ──
  // The recorder itself lives in the dashboard layout (lib/recorder), so a lecture
  // keeps recording while the student uses the rest of the platform. This page
  // shows and drives it for this class.
  const rec = useRecorder();
  const isThisClass = rec.course?.id === course.id;
  const busyElsewhere = !!rec.course && !isThisClass && (rec.phase === "recording" || (rec.phase === "saved" && !rec.uploaded));
  const live = rec.live;
  const maxRecSeconds = rec.maxRecSeconds;
  const micError = rec.micError;
  const { recTitle, setRecTitle } = rec;
  const recording = isThisClass && rec.phase === "recording";
  const paused = recording && rec.paused;
  const seconds = isThisClass ? rec.seconds : 0;
  const images = isThisClass || rec.phase === "idle" ? rec.images : [];
  const savedBlob = isThisClass ? rec.savedBlob : null;
  const savedAudioUrl = isThisClass ? rec.savedAudioUrl : null;
  const recovered = rec.recovered;
  const stopPrompt = isThisClass && rec.stopPrompt;
  const stopAtLimit = rec.stopAtLimit;
  const { addImages, removeImage, requestStop, chooseResume } = rec;
  const pauseRecording = rec.pause;
  const resumeRecording = rec.resume;
  const uploading = isThisClass && rec.uploading;
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Processing runs in the recorder too, so it survives leaving this page.
  const thisJob = rec.job?.course.id === course.id ? rec.job : null;
  const processingView = !!thisJob || uploading;
  const recStep: "name" | "recording" | "saved" | "processing" = processingView
    ? "processing"
    : isThisClass && rec.phase === "recording" ? "recording"
    : isThisClass && rec.phase === "saved" && !rec.uploaded ? "saved"
    : "name";
  const [openLectureId, setOpenLectureId] = useState<string | null>(null);
  const [openLectureData, setOpenLectureData] = useState<
    { title: string; recordedAt: string | null; transcript: string; sheet: any | null; audioUrl: string | null } | null
  >(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);
  // Keeps the screen on while an opened recording plays back.
  const wakeLockRef = useRef<any>(null);
  const liveScrollRef = useRef<HTMLDivElement | null>(null);

  // The floating recording bar hides while this class's Record tab is on screen.
  useEffect(() => {
    rec.setViewing(tab === "record" ? course.id : null);
    return () => rec.setViewing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, course.id]);

  const processingStatus = thisJob?.status ?? "processing";
  const thisFailure = rec.finished && rec.finished.course.id === course.id && rec.finished.status === "error" ? rec.finished : null;
  const processingError = thisFailure?.kind === "recording" ? thisFailure.error ?? "" : "";

  // Keep the newest words in view as the live transcript grows.
  useEffect(() => {
    const el = liveScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live.text, live.partial]);

  // A lecture from this class finished processing: refresh the list, and if its
  // Record tab is open, go straight into what was just generated.
  useEffect(() => {
    const done = rec.finished;
    if (!done || done.course.id !== course.id) return;
    mutateLectures();
    if (tab !== "record") return;
    if (done.status === "ready") {
      rec.clearFinished();
      openLectureById(done.lectureId);
    } else if (done.kind === "photos") {
      rec.clearFinished();
      toast(done.error || tr("Couldn't reprocess with those photos — try again."), "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.finished, tab]);

  // "Open" from the floating recorder, or from a banner, lands here.
  useEffect(() => {
    const request = rec.openRequest;
    if (!request || request.courseId !== course.id) return;
    rec.consumeOpenRequest();
    switchTab("record");
    mutateLectures();
    if (request.lectureId) openLectureById(request.lectureId);
    else closeOpenLecture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.openRequest, course.id]);

  function lectureTitle() {
    return rec.lectureTitle(course);
  }

  function startRecording() {
    if (busyElsewhere) return;
    rec.start({ id: course.id, name: course.name, color: course.color ?? color });
  }

  async function chooseProcess() {
    if (audioElemRef.current) { audioElemRef.current.pause(); setPlaying(false); }
    await rec.processTake();
  }

  function chooseDelete() {
    if (!window.confirm(tr("Delete this recording? It can't be recovered."))) return;
    rec.discard();
    resetRecorder();
  }

  function playAudio() {
    if (!savedAudioUrl) return;
    if (!audioElemRef.current) {
      audioElemRef.current = new Audio(savedAudioUrl);
      audioElemRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioElemRef.current.pause();
      setPlaying(false);
    } else {
      audioElemRef.current.play();
      setPlaying(true);
    }
  }

  function resetRecorder() {
    // Only this class's session — never a lecture recording in another class.
    if (isThisClass && rec.phase !== "recording") rec.reset();
    setPlaying(false);
    if (audioElemRef.current) { audioElemRef.current.pause(); audioElemRef.current = null; }
    if (thisFailure) rec.clearFinished();
    setOpenLectureId(null);
    setOpenLectureData(null);
  }

  async function openLecture(lecture: any) {
    setOpenLectureId(lecture.id);
    setOpenLectureData(null);
    const transcript = lecture.transcript ?? "";

    // Just-recorded lectures already have a local blob URL; otherwise stream
    // via a signed URL so playback starts instantly and seeking works.
    let audioUrl: string | null = rec.audioUrlFor(lecture.id);
    if (!audioUrl) {
      try {
        const r = await apiFetch(`/api/lectures/${lecture.id}/audio-url`);
        if (r?.data?.url) audioUrl = `${BASE}${r.data.url}`;
      } catch { /* audio unavailable */ }
    }

    const base = {
      title: lecture.title ?? tr("Recording"),
      recordedAt: lecture.recordedAt ?? null,
      transcript,
      audioUrl,
    };
    try {
      const sheetRes = await apiFetch(`/api/cheatsheets?lectureId=${lecture.id}`);
      const shts = (sheetRes.data ?? []).filter((cs: any) => !cs.title?.startsWith("Study Book:"));
      setOpenLectureData({ ...base, sheet: shts[0] ?? null });
    } catch {
      setOpenLectureData({ ...base, sheet: null });
    }
  }

  // Used right after processing finishes, when the list hasn't been re-read yet.
  async function openLectureById(id: string) {
    try {
      const r = await apiFetch(`/api/lectures/${id}`);
      if (r?.data) { await openLecture(r.data); return; }
    } catch { /* fall through to whatever the list knows */ }
    const fromList = lectures.find((l: any) => l.id === id);
    if (fromList) await openLecture(fromList);
  }

  function closeOpenLecture() {
    setOpenLectureId(null);
    setOpenLectureData(null);
  }

  // ── Attach photos to a finished recording → reprocess it ──
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const attachTargetRef = useRef<any>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const photoCount = (l: any) => (Array.isArray(l?.imageUrls) ? l.imageUrls.length : 0);

  function startAttach(l: any) {
    if (recStep === "saved" || recStep === "processing") {
      toast(tr("Finish or discard the current recording first."), "error");
      return;
    }
    if (photoCount(l) >= MAX_LECTURE_PHOTOS) {
      toast(`This recording already has ${MAX_LECTURE_PHOTOS} photos.`, "error");
      return;
    }
    attachTargetRef.current = l;
    attachInputRef.current?.click();
  }

  async function attachPhotos(files: FileList | null) {
    const l = attachTargetRef.current;
    if (!files?.length || !l) return;
    const room = MAX_LECTURE_PHOTOS - photoCount(l);
    const list = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) return;
    setAttachingId(l.id);
    try {
      const fd = new FormData();
      list.forEach(f => fd.append("images", f));
      await apiFetch(`/api/lectures/${l.id}/photos`, { method: "POST", body: fd });
      if (files.length > room) toast(`Only ${room} more photo${room === 1 ? "" : "s"} fit on this recording — attached the first ${room}.`, "error");
      // Watch it rebuild on the processing screen (or from the floating bar anywhere
      // else), then land on the refreshed material.
      closeOpenLecture();
      rec.trackJob({ lectureId: l.id, course: { id: course.id, name: course.name, color: course.color ?? color }, title: l.title, kind: "photos" });
      mutateLectures();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const serverError = /"error":"([^"]+)"/.exec(msg)?.[1];
      toast(e?.name === "QuotaError" ? msg : serverError ?? tr("Couldn't attach those photos — try again."), "error");
    } finally {
      setAttachingId(null);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── notes (database) ──
  type NoteEntry = { id: string; name: string; text: string; updatedAt: string };
  const { data: notesData, mutate: mutateNotes } = useSWR(
    visitedTabs.has("note") ? `${BASE}/api/notes?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const notes: NoteEntry[] = notesData?.data ?? [];
  const [noteView, setNoteView] = useState<"list" | "create" | "edit">("list");
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function createNote() {
    if (!newNoteName.trim()) return;
    const res = await apiFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, name: newNoteName.trim() }),
    });
    const entry = res.data;
    await mutateNotes();
    setActiveNote(entry);
    setNewNoteName("");
    setNoteView("edit");
  }

  function handleNoteChange(val: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, text: val, updatedAt: new Date().toISOString() };
    setActiveNote(updated);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(async () => {
      await apiFetch(`/api/notes/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: val }),
      });
      mutateNotes();
      setNoteSavedAt(new Date());
    }, 800);
  }

  async function saveNoteNow() {
    if (!activeNote) return;
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    await apiFetch(`/api/notes/${activeNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: activeNote.text }),
    });
    mutateNotes();
    setNoteSavedAt(new Date());
    setNoteView("list");
  }

  async function deleteNote(id: string) {
    try {
      await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      mutateNotes();
      if (activeNote?.id === id) { setActiveNote(null); setNoteView("list"); }
      toast(tr("Note deleted"), "success");
    } catch (e: any) {
      toast(e?.message ?? tr("Couldn't delete the note — try again."), "error");
    }
  }

  // ── archive ──
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const { data: archivedData, mutate: mutateArchived } = useSWR(
    visitedTabs.has("record") && openLectureId === null ? `${BASE}/api/lectures?courseId=${course.id}&archived=true` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const archivedLectures: any[] = archivedData?.data ?? [];

  async function archiveLecture(id: string) {
    await apiFetch(`/api/lectures/${id}/archive`, { method: "PATCH" });
    setConfirmArchiveId(null);
    mutateLectures();
    mutateArchived();
  }

  async function restoreLecture(id: string) {
    await apiFetch(`/api/lectures/${id}/restore`, { method: "PATCH" });
    mutateLectures();
    mutateArchived();
  }

  async function permanentlyDelete(id: string) {
    await apiFetch(`/api/lectures/${id}`, { method: "DELETE" });
    mutateArchived();
  }

  // ── ask your course (RAG chat over everything captured) ──
  const { data: askStatusData, mutate: mutateAskStatus } = useSWR(
    visitedTabs.has("ask") ? `${BASE}/api/ask/status?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const askStatus = askStatusData?.data;
  const [askMessages, setAskMessages] = useState<{ role: "user" | "assistant"; content: string; citations?: any[] }[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askIndexing, setAskIndexing] = useState(false);
  const askAutoIndexed = useRef(false);

  async function rebuildAskMemory() {
    setAskIndexing(true);
    try {
      await apiFetch("/api/ask/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      await mutateAskStatus();
    } catch { /* non-fatal */ }
    setAskIndexing(false);
  }

  // First visit with content but no memory yet — build it automatically
  useEffect(() => {
    if (!askStatusData || askAutoIndexed.current) return;
    if ((askStatusData.data?.chunkCount ?? 0) > 0) return;
    if (!lectures.length && !notes.length) return;
    askAutoIndexed.current = true;
    rebuildAskMemory();
  }, [askStatusData]); // eslint-disable-line react-hooks/exhaustive-deps

  const askAbortRef = useRef<AbortController | null>(null);

  async function sendAsk(text?: string) {
    const q = (text ?? askInput).trim();
    if (!q || askLoading) return;
    const history = [...askMessages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content: q }];
    setAskMessages(prev => [...prev, { role: "user", content: q }]);
    setAskInput("");
    setAskLoading(true);
    const controller = new AbortController();
    askAbortRef.current = controller;
    try {
      const res = await apiFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, messages: history }),
        signal: controller.signal,
      });
      setAskMessages(prev => [...prev, { role: "assistant", content: res.data.reply, citations: res.data.citations ?? [] }]);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setAskMessages(prev => [...prev, { role: "assistant", content: e?.message ?? tr("Something went wrong — try again.") }]);
      }
    } finally {
      askAbortRef.current = null;
      setAskLoading(false);
    }
  }

  // ── clickable citations: jump straight to the cited moment ──
  const [askPlayer, setAskPlayer] = useState<{ title: string; url: string; startSec: number } | null>(null);
  const [askCiteLoading, setAskCiteLoading] = useState<number | null>(null);
  const askAudioRef = useRef<HTMLAudioElement | null>(null);

  function citationClickable(c: any) {
    return ["lecture", "video", "file", "note", "photo"].includes(c.sourceType);
  }

  async function openCitation(c: any) {
    const startSec = Math.max(0, Math.floor(c.startSec ?? 0));

    // YouTube source → open the video at the cited timestamp
    if (c.sourceType === "video") {
      const lec = lectures.find((l: any) => l.id === c.sourceId);
      const vid = ytIdFromUrl(lec?.audioUrl);
      if (vid) { window.open(`https://www.youtube.com/watch?v=${vid}&t=${startSec}s`, "_blank"); return; }
      toast(tr("Couldn't locate this video."), "error");
      return;
    }

    // Attached slides (or another indexed file source) → open the underlying
    // recording's detail view, where its cheat sheet/transcript live.
    if (c.sourceType === "file") {
      setAskCiteLoading(c.n);
      try {
        // Slides are indexed as "<lectureId>_slides", pointing back at the lecture.
        const targetId = String(c.sourceId).replace(/_slides$/, "");
        const lec = lectures.find((l: any) => l.id === targetId);
        if (!lec) { toast(tr("Couldn't find this file's saved content."), "error"); return; }
        switchTab("record");
        await openLecture(lec);
      } finally {
        setAskCiteLoading(null);
      }
      return;
    }

    // Photo → open it large, beside what Ucorns read from it
    if (c.sourceType === "photo") {
      switchTab("photo");
      setOpenPhotoId(c.sourceId);
      return;
    }

    // Note → open it in the note editor
    if (c.sourceType === "note") {
      setAskCiteLoading(c.n);
      try {
        let note = notes.find((n: any) => n.id === c.sourceId);
        if (!note) {
          const r = await apiFetch(`/api/notes?courseId=${course.id}`);
          note = (r.data ?? []).find((n: any) => n.id === c.sourceId);
        }
        if (!note) { toast(tr("Couldn't find this note."), "error"); return; }
        switchTab("note");
        setActiveNote(note);
        setNoteView("edit");
      } finally {
        setAskCiteLoading(null);
      }
      return;
    }

    // Recorded lecture → inline player seeked to the cited second
    if (c.sourceType === "lecture") {
      setAskCiteLoading(c.n);
      try {
        // Signed URL lets the browser stream + seek (range requests) instead
        // of downloading the whole lecture before playback starts.
        // Recordings processed before photos were folded in cite them as "<id>_photos".
        const r = await apiFetch(`/api/lectures/${String(c.sourceId).replace(/_photos$/, "")}/audio-url`);
        if (!r?.data?.url) throw new Error("API 404");
        setAskPlayer({ title: c.sourceTitle ?? c.label, url: `${BASE}${r.data.url}`, startSec });
      } catch (e: any) {
        // A 404 means the recording's file is gone, not that the request failed —
        // say which, so it doesn't read as a bug the student can retry away.
        toast(
          String(e?.message ?? "").includes("404")
            ? tr("This recording's audio file is no longer on the server.")
            : tr("Couldn't load the audio — check your connection and try again."),
          "error",
        );
      } finally {
        setAskCiteLoading(null);
      }
    }
  }

  // When the player opens, seek to the cited moment and start playing
  useEffect(() => {
    if (!askPlayer) return;
    const el = askAudioRef.current;
    if (!el) return;
    const seekAndPlay = async () => {
      await ensureFiniteDuration(el);
      el.currentTime = askPlayer.startSec;
      el.play().catch(() => { /* autoplay blocked — user presses play, position is set */ });
    };
    if (el.readyState >= 1) seekAndPlay();
    else el.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    return () => el.removeEventListener("loadedmetadata", seekAndPlay);
  }, [askPlayer]);

  // Recording is what a student comes to a class for; Ask is where they end up after.
  const TABS = [
    { key: "record",    label: t.workspace.tabs.record,    icon: Mic2     },
    { key: "photo",     label: t.workspace.tabs.photo,     icon: Camera   },
    { key: "note",      label: t.workspace.tabs.note,      icon: PenLine  },
    { key: "ask",       label: t.workspace.tabs.ask,       icon: Sparkles },
  ] as const;

  return (
    <div className="w-full min-h-full flex justify-center">
    <div className="w-full max-w-7xl px-3 py-5 md:px-8 md:py-8">
      <style>{WORKSPACE_KEYFRAMES}</style>
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>{tr("Workspace")}</div>
        {/* Class pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {allCourses.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="whitespace-nowrap transition-all flex items-center gap-2"
              style={c.id === course.id
                ? { padding: "8px 16px", borderRadius: 999, fontSize: 16, fontWeight: 600, background: tint(c), color: "white", border: `1px solid ${tint(c)}`, boxShadow: `0 4px 16px ${tint(c)}59` }
                : { padding: "8px 16px", borderRadius: 999, fontSize: 16, fontWeight: 500, background: "transparent", color: "rgba(15,17,21, 0.82)", border: "1px solid rgba(0,0,0,0.08)" }
              }
            >
              {c.id !== course.id && <span className="w-2 h-2 rounded-full" style={{ background: tint(c) }} />}
              {c.name}
            </button>
          ))}
          <button
            onClick={onBack}
            className="whitespace-nowrap transition-all"
            style={{ padding: "8px 15px", borderRadius: 999, fontSize: 16, fontWeight: 500, background: "transparent", color: "rgba(31,35,40, 0.78)", border: "1px solid rgba(0,0,0,0.07)" }}
          >
            ← All classes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className="flex items-center gap-2 whitespace-nowrap transition-all"
            style={{
              padding: "8px 15px",
              borderRadius: 999,
              fontSize: 16,
              fontWeight: tab === key ? 600 : 500,
              background: tab === key ? color : "transparent",
              color: tab === key ? "white" : "rgba(15,17,21,0.75)",
              border: tab === key ? `1px solid ${color}` : "1px solid rgba(0,0,0,0.08)",
              boxShadow: tab === key ? `0 4px 16px ${color}59` : "none",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── ASK YOUR COURSE ── */}
      {tab === "ask" && (
        <div className="flex flex-col overflow-hidden"
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 24, height: "calc(100dvh - 280px)", minHeight: 540 }}>

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(75,95,232,0.18)" }}>
              <Sparkles size={16} style={{ color: "#4B5FE8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-semibold text-gray-900">{t.workspace.ask.title}</div>
              <div className="text-[14.5px]" style={{ color: "rgba(31,35,40, 0.75)" }}>
                {askIndexing
                  ? t.workspace.ask.building
                  : askStatus
                    ? `${t.workspace.ask.memoryLine}: ${askStatus.sources?.length ?? 0} ${(askStatus.sources?.length ?? 0) === 1 ? "source" : "sources"}`
                    : t.workspace.ask.subtitle}
              </div>
            </div>
            <button onClick={rebuildAskMemory} disabled={askIndexing}
              className="flex items-center gap-1.5 text-[14.5px] px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{ color: "rgba(31,35,40, 0.8)", border: "1px solid rgba(0,0,0,0.08)" }}>
              {askIndexing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              {t.workspace.ask.refresh}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Loader2 size={22} className="animate-spin" style={{ color: "#4B5FE8" }} />
                <div className="text-[16px]" style={{ color: "rgba(31,35,40, 0.85)" }}>{t.workspace.ask.building}</div>
                <div className="text-[15px]" style={{ color: "rgba(31,35,40, 0.73)" }}>{t.workspace.ask.buildingHint}</div>
              </div>
            )}
            {!askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                {(askStatus?.chunkCount ?? 0) === 0 ? (
                  <div className="text-[16px] max-w-sm" style={{ color: "rgba(31,35,40, 0.78)" }}>{t.workspace.ask.empty}</div>
                ) : (
                  <>
                    <div className="text-[16px]" style={{ color: "rgba(31,35,40, 0.78)" }}>{t.workspace.ask.subtitle}</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {t.workspace.ask.quickPrompts.map(p => (
                        <button key={p} onClick={() => sendAsk(p)}
                          className="text-[15.5px] px-4 py-2.5 rounded-full transition-colors hover:bg-black/[0.04]"
                          style={{ color: "rgba(31,35,40, 0.85)", border: "1px solid rgba(0,0,0,0.08)" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {askMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <MathText className="text-[16.5px] max-w-[82%] leading-[1.65] px-5 py-3.5 whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? "#4B5FE8" : "rgba(0,0,0,0.05)",
                    color: m.role === "user" ? "white" : "rgba(31,35,40,0.85)",
                    borderRadius: m.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                  }}
                  text={m.content} />
                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5 max-w-[82%]">
                    {m.citations!.map((c: any) => {
                      const playable = citationClickable(c);
                      return (
                        <button key={c.n}
                          title={
                            c.sourceType === "lecture" || c.sourceType === "video"
                              ? `Jump to this moment — ${c.snippet ?? ""}`
                              : `Open source — ${c.snippet ?? ""}`
                          }
                          onClick={() => playable && openCitation(c)}
                          disabled={!playable}
                          className="inline-flex items-center gap-1.5 text-[14px] px-3 py-1.5 rounded-full transition-all"
                          style={{
                            background: "rgba(75,95,232,0.12)",
                            color: "#4B5FE8",
                            border: "1px solid rgba(75,95,232,0.25)",
                            cursor: playable ? "pointer" : "default",
                          }}
                          onMouseEnter={e => { if (playable) (e.currentTarget as HTMLElement).style.background = "rgba(75,95,232,0.28)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(75,95,232,0.12)"; }}
                        >
                          {askCiteLoading === c.n
                            ? <Loader2 size={9} className="animate-spin" />
                            : c.sourceType === "file"
                            ? <FileText size={9} />
                            : c.sourceType === "photo"
                            ? <Camera size={9} />
                            : c.sourceType === "note"
                            ? <PenLine size={9} />
                            : <Play size={9} fill="currentColor" />}
                          <span className="font-bold">[{c.n}]</span> {c.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {askLoading && (
              <div className="flex justify-start">
                <span className="px-4 py-3" style={{ background: "rgba(0,0,0,0.05)", borderRadius: "20px 20px 20px 6px" }}>
                  <TypingDots color={color} />
                </span>
              </div>
            )}
          </div>

          {/* Citation playback bar — jumps to the cited moment */}
          {askPlayer && (
            <div className="flex items-center gap-3 mx-4 mb-2 px-3 py-2 rounded-xl shrink-0"
              style={{ background: "rgba(75,95,232,0.14)", border: "1px solid rgba(75,95,232,0.35)" }}>
              <Play size={13} style={{ color: "#4B5FE8", flexShrink: 0 }} fill="currentColor" />
              <div className="min-w-0" style={{ maxWidth: 180 }}>
                <div className="text-[14.5px] font-semibold truncate" style={{ color: "#1F2328" }}>{askPlayer.title}</div>
                <div className="text-[13px]" style={{ color: "#4B5FE8" }}>
                  from {Math.floor(askPlayer.startSec / 60)}:{String(askPlayer.startSec % 60).padStart(2, "0")}
                </div>
              </div>
              <audio ref={askAudioRef} src={askPlayer.url} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
              <button onClick={() => setAskPlayer(null)} aria-label={tr("Close player")}
                className="p-1 rounded-lg transition-colors hover:bg-black/[0.05]" style={{ color: "rgba(31,35,40, 0.75)" }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2.5 items-center px-5 pb-5 pt-4 shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <input value={askInput} onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAsk()}
              placeholder={t.workspace.ask.placeholder}
              className="flex-1 rounded-2xl px-5 py-3.5 text-[16.5px] outline-none"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", color: "#1F2328" }} />
            {askLoading ? (
              <button onClick={() => askAbortRef.current?.abort()} aria-label={tr("Stop")}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: "#0f1115" }}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button onClick={() => sendAsk()} disabled={!askInput.trim()} aria-label="Send"
                className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                style={{ background: color }}>
                <Send size={17} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── RECORD ── */}
      {tab === "record" && (
        <div className="space-y-4">
          {/* One hidden picker serves every "add board photo" affordance */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { addImages(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={attachInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={e => attachPhotos(e.target.files)}
          />

          {/* ── Open recording → everything generated for it ── */}
          {openLectureId ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <button onClick={closeOpenLecture} className="flex items-center gap-2 text-[16px] transition-colors"
                  style={{ color: "rgba(15,17,21, 0.73)" }}>
                  <ArrowLeft size={14} />{tr("Back to recordings")}</button>
                {(() => {
                  const l = lectures.find((x: any) => x.id === openLectureId);
                  if (!l) return null;
                  const count = photoCount(l);
                  return (
                    <button
                      onClick={() => startAttach(l)}
                      disabled={attachingId === l.id || count >= MAX_LECTURE_PHOTOS}
                      className="flex items-center gap-2 text-[15.5px] font-semibold px-4 py-2 rounded-full transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                      style={{ color: "#0f1115", border: `1px solid ${color}55` }}
                      title={tr("Attach photos — processed with the audio as one lecture")}
                    >
                      {attachingId === l.id ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} style={{ color }} />}
                      Attach photos · {count}/{MAX_LECTURE_PHOTOS}
                    </button>
                  );
                })()}
              </div>
              {openLectureData === null ? (
                <div className="flex items-center gap-3 text-[16px] py-8" style={{ color: "rgba(15,17,21, 0.73)" }}>
                  <Loader2 size={16} className="animate-spin" />{tr("Loading…")}</div>
              ) : (
                <>
                  {/* Audio stays above the tabs so it survives switching between them */}
                  {openLectureData.audioUrl ? (
                    <div className="rounded-2xl px-5 py-3 mb-5 sticky top-0 z-10"
                      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                      <audio
                        ref={openAudioRef}
                        src={openLectureData.audioUrl}
                        controls
                        className="w-full"
                        onLoadedMetadata={(e) => { ensureFiniteDuration(e.currentTarget); }}
                        onPlay={async () => {
                          try {
                            if ("wakeLock" in navigator && !wakeLockRef.current) {
                              wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
                            }
                          } catch {}
                        }}
                        onPause={() => { wakeLockRef.current?.release?.().catch?.(() => {}); wakeLockRef.current = null; }}
                        onEnded={() => { wakeLockRef.current?.release?.().catch?.(() => {}); wakeLockRef.current = null; }}
                      />
                      {openLectureData.recordedAt && (
                        <div className="text-[14.5px] mt-1" style={{ color: "rgba(15,17,21, 0.68)" }}>
                          Recorded {format(new Date(openLectureData.recordedAt), "MMMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <LectureResults
                    key={openLectureId}
                    lectureId={openLectureId}
                    title={openLectureData.title}
                    sheet={openLectureData.sheet}
                    color={color}
                    initialTranscript={openLectureData.transcript}
                    onRecordAnother={resetRecorder}
                  />
                </>
              )}
            </div>
          ) : (
            <>
              {/* ── Interrupted-recording recovery ── */}
              {recovered && recStep === "name" && (
                <div className="rounded-2xl p-4 mb-4 border flex flex-wrap items-center gap-3" style={{ background: "rgba(217,119,6,0.07)", borderColor: "rgba(217,119,6,0.3)" }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[16px] font-semibold" style={{ color: "#92400E" }}>{tr("Recording recovered")}</div>
                    <div className="text-[15px] mt-0.5" style={{ color: "rgba(15,17,21, 0.75)" }}>
                      &ldquo;{recovered.meta.title}&rdquo; · {recovered.meta.courseName} · {(recovered.blob.size / 1048576).toFixed(1)} MB — interrupted before it was saved.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        rec.restoreRecovered();
                        if (recovered.meta.courseId !== course.id) rec.requestOpen(recovered.meta.courseId);
                      }}
                      className="text-[15px] font-semibold px-4 py-2 rounded-full text-white"
                      style={{ background: "#D97706" }}>{tr("Restore")}</button>
                    <button
                      onClick={() => rec.discardRecovered()}
                      className="text-[15px] px-3 py-2 transition-colors hover:text-red-600"
                      style={{ color: "rgba(15,17,21, 0.7)" }}>{tr("Discard")}</button>
                  </div>
                </div>
              )}

              {/* ── A lecture is already recording in another class ── */}
              {recStep === "name" && busyElsewhere && rec.course && (
                <div className="rounded-2xl p-4 mb-4 border flex flex-wrap items-center gap-3" style={{ background: `${rec.course.color || "#4B5FE8"}10`, borderColor: `${rec.course.color || "#4B5FE8"}40` }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[16px] font-semibold" style={{ color: "#0f1115" }}>
                      {rec.phase === "recording" ? `Recording in ${rec.course.name}` : `Unprocessed recording in ${rec.course.name}`}
                    </div>
                    <div className="text-[15px] mt-0.5" style={{ color: "rgba(15,17,21, 0.75)" }}>{tr("One recording at a time — finish or delete that one before starting here.")}</div>
                  </div>
                  <button
                    onClick={() => rec.requestOpen(rec.course!.id)}
                    className="text-[15px] font-semibold px-4 py-2 rounded-full text-white"
                    style={{ background: rec.course.color || "#4B5FE8" }}
                  >{tr("Open it")}</button>
                </div>
              )}

              {/* ── Step: name ── */}
              {recStep === "name" && (
                <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="w-full max-w-xl space-y-2">
                    <label className="text-[13.5px] uppercase tracking-widest block" style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Lecture title (optional)")}</label>
                    <input
                      autoFocus
                      value={recTitle}
                      onChange={e => setRecTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && startRecording()}
                      placeholder={lectureTitle()}
                      className="w-full rounded-xl px-4 py-3 text-[16px] outline-none"
                      style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }}
                    />
                    <p className="text-[15px]" style={{ color: "rgba(15,17,21, 0.68)" }}>
                      Leave it blank and we&rsquo;ll name it &ldquo;{lectureTitle()}&rdquo;.
                    </p>
                  </div>
                  <button
                    onClick={startRecording}
                    disabled={busyElsewhere}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                    style={{ background: color, boxShadow: `0 8px 24px ${color}59` }}
                    aria-label={tr("Start recording")}
                  >
                    <Mic size={24} />
                  </button>
                  <p className="text-[15px]" style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Click to start recording")}</p>
                  {micError && (
                    <p
                      className="text-[15px] text-center max-w-md rounded-xl px-4 py-3"
                      style={{ color: "#B91C1C", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}
                    >
                      {micError}
                    </p>
                  )}
                </div>
              )}

              {/* ── Step: recording ──
                  No waveform here: while a lecture runs the transcript is the
                  screen, so the words get all the room. */}
              {recStep === "recording" && (
                <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center gap-2.5 px-6 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: live.connected && !paused ? "#DC2626" : "rgba(15,17,21,0.25)",
                        animation: live.connected && !paused ? "livePulse 1.4s ease-in-out infinite" : "none",
                      }}
                    />
                    <span className="text-[16px] font-semibold" style={{ color: "#0f1115" }}>
                      {paused ? tr("Paused") : live.connected ? tr("Live transcript") : tr("Connecting…")}
                    </span>
                    <span className="text-[15px] truncate hidden sm:block" style={{ color: "rgba(15,17,21, 0.68)" }}>
                      · {lectureTitle()}
                    </span>
                    <span className="ml-auto text-xl font-medium shrink-0"
                      style={{ color: "#0f1115", fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
                      {fmt(seconds)}
                    </span>
                  </div>

                  <div ref={liveScrollRef} className="overflow-y-auto px-8 py-6" style={{ height: "min(52vh, 520px)" }}>
                    {live.fullText ? (
                      <p className="text-[19px] leading-[1.9] whitespace-pre-wrap" style={{ color: "#0f1115" }}>
                        {/* Settled sentences arrive typeset, in the same style as the notes. */}
                        <MathText text={live.text} />
                        {live.partial && (
                          <span style={{ color: "rgba(15,17,21, 0.65)" }}>
                            {live.text ? " " : ""}{toMathNotation(live.partial)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[17.5px]" style={{ color: "rgba(15,17,21, 0.65)" }}>{tr("Start speaking — words appear here as you go.")}</p>
                    )}
                  </div>

                  {images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto px-6 pb-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>
                      {images.map((img, i) => (
                        <div key={img.url} className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={`Board photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.08)" }} />
                          <button
                            onClick={() => removeImage(i)}
                            aria-label={tr("Remove photo")}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ background: "rgba(15,17,21,0.75)" }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <button
                      onClick={paused ? resumeRecording : pauseRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors hover:bg-black/[0.03]"
                      style={{ border: "1px solid rgba(0,0,0,0.12)" }}
                    >
                      {paused ? <Play size={16} style={{ color: "#0f1115" }} /> : <Pause size={16} style={{ color: "#0f1115" }} />}
                      <span className="text-[16px] font-medium" style={{ color: "#0f1115" }}>{paused ? tr("Resume") : tr("Pause")}</span>
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={images.length >= MAX_LECTURE_PHOTOS}
                      title={images.length >= MAX_LECTURE_PHOTOS ? `Up to ${MAX_LECTURE_PHOTOS} photos per lecture` : tr("Add a photo of the board or slides")}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                      style={{ border: "1px solid rgba(0,0,0,0.12)" }}
                    >
                      <Camera size={16} style={{ color: "#0f1115" }} />
                      <span className="text-[16px] font-medium" style={{ color: "#0f1115" }}>
                        Photo{images.length ? ` (${images.length})` : ""}
                      </span>
                    </button>
                    <button
                      onClick={() => requestStop()}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ background: "#DC2626" }}
                    >
                      <StopCircle size={16} />
                      <span className="text-[16px] font-medium">{tr("Stop")}</span>
                    </button>
                  </div>
                </div>
              )}

              {stopPrompt && recStep === "recording" && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center px-4"
                  style={{ background: "rgba(15,17,21,0.45)" }}
                  onClick={chooseResume}
                  onKeyDown={e => e.key === "Escape" && chooseResume()}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stop-title"
                    className="w-full max-w-md rounded-2xl p-6"
                    style={{ background: "#FFFFFF", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div id="stop-title" className="text-[20px] font-bold" style={{ color: "#0f1115" }}>
                      {stopAtLimit ? tr("Recording limit reached") : tr("Recording paused")}
                    </div>
                    <p className="text-[16px] mt-1.5 mb-5" style={{ color: "rgba(15,17,21, 0.75)" }}>
                      {stopAtLimit
                        ? `This recording hit the ${maxRecSeconds >= 3600 ? `${maxRecSeconds / 3600}-hour` : `${Math.round(maxRecSeconds / 60)}-minute`} limit on your plan. Process it now, or delete it.`
                        : `${fmt(seconds)} recorded${images.length ? ` · ${images.length} photo${images.length === 1 ? "" : "s"}` : ""}. What would you like to do?`}
                    </p>
                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={chooseProcess}
                        autoFocus
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-[17px] font-semibold transition-opacity hover:opacity-90"
                        style={{ background: color }}
                      >
                        <Sparkles size={17} />{tr("Process lecture")}</button>
                      {!stopAtLimit && <button
                        onClick={chooseResume}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[17px] font-semibold transition-colors hover:bg-black/[0.03]"
                        style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#0f1115" }}
                      >
                        <Mic2 size={17} />{tr("Resume recording")}</button>}
                      <button
                        onClick={chooseDelete}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[17px] font-semibold transition-colors hover:bg-red-50"
                        style={{ color: "#DC2626" }}
                      >
                        <Trash2 size={17} />{tr("Delete recording")}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: saved ── */}
              {recStep === "saved" && (
                <div className="rounded-2xl p-6 space-y-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[17.5px] font-semibold" style={{ color: "#0f1115" }}>{lectureTitle()}</span>
                    <span className="ml-auto text-[15px]" style={{ color: "rgba(15,17,21, 0.73)" }}>{fmt(seconds)}</span>
                  </div>

                  <input
                    value={recTitle}
                    onChange={e => setRecTitle(e.target.value)}
                    placeholder={tr("Rename this lecture (optional)")}
                    className="w-full rounded-xl px-4 py-3 text-[16px] outline-none"
                    style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }}
                  />

                  <button
                    onClick={playAudio}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-black/[0.02]"
                    style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    {playing ? <Pause size={15} style={{ color }} /> : <Play size={15} style={{ color }} />}
                    <span className="text-[16px]" style={{ color: "#0f1115" }}>{playing ? tr("Pause") : tr("Listen to recording")}</span>
                  </button>

                  {/* Board photos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13.5px] uppercase tracking-widest" style={{ color: "rgba(15,17,21, 0.73)" }}>
                        Board photos {images.length ? `(${images.length}/${MAX_LECTURE_PHOTOS})` : ""}
                      </span>
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={images.length >= MAX_LECTURE_PHOTOS}
                        className="flex items-center gap-1.5 text-[15px] px-3 py-1.5 rounded-full transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                        style={{ color: "rgba(15,17,21, 0.82)", border: "1px solid rgba(0,0,0,0.1)" }}>
                        <ImagePlus size={12} />{tr("Add photos")}</button>
                    </div>
                    {images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                          <div key={img.url} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={`Board photo ${i + 1}`} className="w-24 h-24 object-cover rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.08)" }} />
                            <button
                              onClick={() => removeImage(i)}
                              aria-label={tr("Remove photo")}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                              style={{ background: "rgba(15,17,21,0.75)" }}>
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[15px]" style={{ color: "rgba(15,17,21, 0.68)" }}>{tr("Photos of the whiteboard or slides are read alongside the audio.")}</p>
                    )}
                  </div>

                  {processingError && (
                    <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>
                      {processingError}
                    </div>
                  )}

                  <button
                    onClick={chooseProcess}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: color, boxShadow: `0 6px 20px ${color}40` }}
                  >
                    {uploading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                    <span className="text-[17px] font-semibold">{uploading ? tr("Sending it over…") : tr("Make my study material")}</span>
                  </button>

                  <button onClick={resetRecorder} className="w-full text-[15px] transition-colors hover:text-red-600" style={{ color: "rgba(15,17,21, 0.65)" }}>{tr("Discard recording")}</button>
                </div>
              )}

              {/* ── Step: processing ── */}
              {recStep === "processing" && (
                <div className="rounded-2xl p-8 md:p-11 flex flex-col items-center gap-6" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="relative flex items-center justify-center w-28 h-28">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full" style={{
                        width: 40 + i * 22,
                        height: 40 + i * 22,
                        border: `1px solid ${color}59`,
                        animation: `ringPulse 2s ease-out ${i * 0.45}s infinite`,
                      }} />
                    ))}
                    <Loader2 size={22} className="animate-spin relative z-10" style={{ color }} />
                  </div>
                  <div className="text-center space-y-2.5 max-w-lg">
                    <div className="text-[23px] font-bold" style={{ color: "#0f1115" }}>
                      {processingStatus === "transcribing" ? tr("Writing down every word")
                        : processingStatus === "generating" ? tr("Building your study material")
                        : tr("Getting your recording ready")}
                    </div>
                    <p className="text-[17.5px] leading-relaxed" style={{ color: "rgba(15,17,21, 0.86)" }}>
                      {processingStatus === "transcribing"
                        ? "Transcribing the audio, then proofreading it for misheard terms, names and formulas — and reading in your slides and any photos you took in class."
                        : processingStatus === "generating"
                        ? "Four things at once, from the whole lecture. It's also being filed into your course memory, so you can ask about it weeks from now."
                        : tr("Compressing the audio so it moves fast.")}
                    </p>
                  </div>

                  {/* What actually comes out the other end */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {[
                      { Icon: FileText,   label: tr("Cheat sheet"),   note: tr("the whole lecture, condensed") },
                      { Icon: ListChecks, label: tr("Key points"),    note: tr("what actually mattered") },
                      { Icon: Layers,     label: tr("Flashcards"),    note: tr("ready to drill") },
                      { Icon: HelpCircle, label: tr("Practice quiz"), note: tr("every answer timestamped") },
                    ].map(({ Icon, label, note }) => {
                      const building = processingStatus === "generating";
                      const done = processingStatus === "ready";
                      const lit = building || done;
                      return (
                        <div key={label} className="rounded-xl p-4 flex items-start gap-3 transition-all duration-500" style={{
                          background: lit ? `${color}0d` : "rgba(0,0,0,0.02)",
                          border: `1px solid ${lit ? `${color}33` : "rgba(0,0,0,0.06)"}`,
                        }}>
                          <span className="mt-0.5 shrink-0">
                            {done ? <Check size={18} style={{ color }} />
                              : building ? <Loader2 size={18} className="animate-spin" style={{ color }} />
                              : <Icon size={18} style={{ color: "rgba(15,17,21, 0.7)" }} />}
                          </span>
                          <div className="min-w-0 text-left">
                            <div className="text-[17.5px] font-semibold leading-tight" style={{ color: lit ? "#0f1115" : "rgba(15,17,21,0.72)" }}>{tr(label)}</div>
                            <div className="text-[15px] leading-snug mt-1" style={{ color: lit ? "rgba(15,17,21,0.8)" : "rgba(15,17,21,0.62)" }}>{tr(note)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Where in the pipeline this lecture is */}
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    {(["processing", "transcribing", "generating", "ready"] as const).map((s, i) => {
                      const idx = ["processing", "transcribing", "generating", "ready"].indexOf(processingStatus);
                      const done = i < idx;
                      const active = i === idx;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: done || active ? color : "rgba(0,0,0,0.22)" }} />
                          <span className={`text-[17px] ${active ? "font-semibold" : "font-medium"}`} style={{ color: i <= idx ? "#0f1115" : "rgba(15,17,21,0.6)" }}>
                            {s === "processing" ? tr("Upload") : s === "transcribing" ? tr("Transcribe") : s === "generating" ? tr("Generate") : tr("Ready")}
                          </span>
                          {i < 3 && <span className="w-6 h-px" style={{ background: "rgba(0,0,0,0.2)" }} />}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[16px] text-center" style={{ color: "rgba(15,17,21, 0.82)" }}>{tr("This runs on our servers — you can leave this page and come back.")}</p>
                </div>
              )}

              {/* ── Recordings list ── */}
              {audioLectures.length > 0 && recStep !== "recording" && (
                <div className="mt-2">
                  <p className="text-[15px] uppercase tracking-widest mb-3" style={{ color: "rgba(15,17,21, 0.73)" }}>{tr("Recordings")}</p>
                  <div className="space-y-2">
                    {audioLectures.map(l => {
                      const ready = l.status === "ready";
                      return (
                        <div key={l.id} className="rounded-xl px-4 py-3 transition-all"
                          style={{
                            background: "#FFFFFF",
                            border: `1px solid ${confirmArchiveId === l.id ? "rgba(220,38,38,0.25)" : "rgba(0,0,0,0.08)"}`,
                          }}>
                          {confirmArchiveId === l.id ? (
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[15px] flex-1" style={{ color: "rgba(15,17,21, 0.78)" }}>{tr("Delete")}<span className="font-medium" style={{ color: "#0f1115" }}>&ldquo;{l.title}&rdquo;</span>?
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setConfirmArchiveId(null)} className="text-[15px] px-3 py-1.5 rounded-lg" style={{ color: "rgba(15,17,21, 0.75)" }}>{tr("Cancel")}</button>
                                <button onClick={() => archiveLecture(l.id)} className="text-[15px] px-3 py-1.5 rounded-lg text-white" style={{ background: "#DC2626" }}>{tr("Delete")}</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => ready && openLecture(l)}
                                disabled={!ready}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                              >
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: `${color}1A` }}>
                                  <Mic2 size={12} style={{ color }} />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-[16px] truncate" style={{ color: "#0f1115" }}>{l.title}</span>
                                  <span className="block text-[15px] mt-0.5" style={{ color: "rgba(15,17,21, 0.7)" }}>
                                    {ready
                                      ? `${format(new Date(l.recordedAt), "MMM d, yyyy")} · Click to open`
                                      : l.status === "error" ? tr("Processing failed") : tr("Still processing…")}
                                  </span>
                                </span>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {ready ? (
                                  <ChevronRight size={16} style={{ color: "rgba(15,17,21, 0.62)" }} />
                                ) : l.status === "error" ? (
                                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full" style={{ color: "#DC2626", background: "rgba(220,38,38,0.08)" }}>{tr("Failed")}</span>
                                ) : (
                                  <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ color: "rgba(15,17,21, 0.73)", background: "rgba(0,0,0,0.06)" }}>
                                    <Loader2 size={8} className="animate-spin" />{tr("Processing")}</span>
                                )}
                                {ready && (
                                  <button
                                    onClick={() => startAttach(l)}
                                    disabled={attachingId === l.id || photoCount(l) >= MAX_LECTURE_PHOTOS}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[13.5px] font-semibold transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                                    style={{ color: "rgba(15,17,21, 0.75)" }}
                                    title={photoCount(l) >= MAX_LECTURE_PHOTOS ? `${MAX_LECTURE_PHOTOS} photos attached` : tr("Attach photos — processed with the audio as one lecture")}
                                  >
                                    {attachingId === l.id ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={15} />}
                                    {photoCount(l)}/{MAX_LECTURE_PHOTOS}
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmArchiveId(l.id)}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                                  style={{ color: "rgba(15,17,21, 0.57)" }}
                                  title={tr("Delete recording")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Archived recordings ── */}
              {archivedLectures.length > 0 && recStep !== "recording" && (
                <div className="mt-6">
                  <p className="text-[15px] uppercase tracking-widest mb-3" style={{ color: "rgba(15,17,21, 0.65)" }}>{tr("Archived")}</p>
                  <div className="space-y-2">
                    {archivedLectures.map(l => (
                      <div key={l.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[16px] truncate" style={{ color: "rgba(15,17,21, 0.75)" }}>{l.title}</div>
                          <div className="text-[15px] mt-0.5" style={{ color: "rgba(15,17,21, 0.65)" }}>
                            {format(new Date(l.recordedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <button onClick={() => restoreLecture(l.id)}
                          className="text-[15px] px-3 py-1.5 rounded-full transition-colors hover:bg-black/[0.03]"
                          style={{ color: "rgba(15,17,21, 0.8)", border: "1px solid rgba(0,0,0,0.1)" }}>{tr("Restore")}</button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Permanently delete "${l.title}"?`,
                              message: tr("The recording, its transcript and everything generated from it are removed for good."),
                              confirmLabel: tr("Delete forever"),
                              danger: true,
                            });
                            if (ok) permanentlyDelete(l.id);
                          }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: "rgba(15,17,21, 0.57)" }}
                          title={tr("Delete permanently")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ADD PHOTO ── */}
      {tab === "photo" && (
        <div className="space-y-5">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={e => uploadPhotos(e.target.files)}
          />

          <div className="rounded-3xl border p-7 md:p-9 flex flex-col md:flex-row md:items-center gap-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="flex-1 min-w-0">
              <h2 className="text-[24px] font-bold mb-1.5" style={{ color: "#0f1115", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Add photos to {course.name}
              </h2>
              <p className="text-[17px] leading-relaxed" style={{ color: "rgba(15,17,21,0.82)" }}>
                The whiteboard, a slide, your handwritten notes, a page of the textbook. Ucorns reads each photo — formulas included — so Ask can answer from it.
              </p>
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="shrink-0 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-white text-[17px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: color, boxShadow: `0 6px 20px ${color}40` }}
            >
              {photoUploading ? <Loader2 size={19} className="animate-spin" /> : <ImagePlus size={19} />}
              {photoUploading ? tr("Adding…") : tr("Take or add photos")}
            </button>
          </div>

          {photos.length === 0 && !photoUploading ? (
            <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
              <Camera size={30} className="mx-auto mb-3" style={{ color: "rgba(15,17,21,0.5)" }} />
              <p className="text-[17px]" style={{ color: "rgba(15,17,21,0.75)" }}>{tr("No photos in this class yet.")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setOpenPhotoId(p.id)}
                  className="text-left rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
                  style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}
                >
                  <div className="relative" style={{ aspectRatio: "4 / 3", background: "rgba(0,0,0,0.04)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${BASE}${p.imageUrl}`} alt={tr("Class photo")} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    {p.status === "reading" && (
                      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white" style={{ background: "rgba(15,17,21,0.72)" }}>
                        <Loader2 size={12} className="animate-spin" />{tr("Reading…")}</span>
                    )}
                    {p.status === "error" && (
                      <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white" style={{ background: "#DC2626" }}>
                        <AlertTriangle size={12} />{tr("Couldn't read")}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[15px] leading-snug line-clamp-2" style={{ color: p.text ? "rgba(15,17,21,0.85)" : "rgba(15,17,21,0.6)" }}>
                      {p.status === "reading" ? tr("Ucorns is reading this photo…")
                        : p.status === "error" ? tr("Tap to try again.")
                        : p.text ? latexToReadablePreview(p.text) : tr("Nothing readable in this photo.")}
                    </p>
                    <p className="text-[13.5px] mt-1.5" style={{ color: "rgba(15,17,21,0.6)" }}>
                      {format(new Date(p.createdAt), "d MMM, h:mm a")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {openPhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
              style={{ background: "rgba(15,17,21,0.6)" }}
              onClick={() => setOpenPhotoId(null)}
            >
              <div
                className="w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col md:flex-row"
                style={{ background: "#FFFFFF" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="md:flex-[3] min-h-0 flex items-center justify-center" style={{ background: "#0f1115" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${BASE}${openPhoto.imageUrl}`} alt={tr("Class photo")} className="max-h-[45vh] md:max-h-[90vh] w-full object-contain" />
                </div>
                <div className="md:flex-[2] min-h-0 flex flex-col">
                  <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    <span className="text-[17px] font-semibold" style={{ color: "#0f1115" }}>{tr("What Ucorns read")}</span>
                    <span className="text-[14px]" style={{ color: "rgba(15,17,21,0.6)" }}>· {format(new Date(openPhoto.createdAt), "d MMM, h:mm a")}</span>
                    <button onClick={() => setOpenPhotoId(null)} className="ml-auto p-1.5 rounded-lg hover:bg-black/5" aria-label={tr("Close")}>
                      <X size={18} style={{ color: "#0f1115" }} />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                    {openPhoto.status === "reading" ? (
                      <p className="flex items-center gap-2 text-[16px]" style={{ color: "rgba(15,17,21,0.75)" }}>
                        <Loader2 size={16} className="animate-spin" />{tr("Reading this photo…")}</p>
                    ) : openPhoto.status === "error" ? (
                      <div className="space-y-3">
                        <p className="text-[16px]" style={{ color: "rgba(15,17,21,0.8)" }}>{tr("Ucorns couldn't read this photo.")}</p>
                        <button onClick={() => retryPhoto(openPhoto.id)} className="flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold text-white" style={{ background: color }}>
                          <RotateCcw size={15} />{tr("Try again")}</button>
                      </div>
                    ) : openPhoto.text ? (
                      <MathText as="div" className="text-[16.5px] leading-[1.8] whitespace-pre-wrap" style={{ color: "#0f1115" }} text={openPhoto.text} />
                    ) : (
                      <p className="text-[16px]" style={{ color: "rgba(15,17,21,0.75)" }}>{tr("Nothing readable in this photo.")}</p>
                    )}
                  </div>
                  <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    <button onClick={() => deletePhoto(openPhoto.id)} className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] font-medium transition-colors hover:bg-red-50" style={{ color: "#DC2626" }}>
                      <Trash2 size={15} />{tr("Delete photo")}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAKE NOTE ── */}
      {tab === "note" && noteView === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[16px] font-semibold text-gray-900 uppercase tracking-widest">{tr("Your Notes")}</p>
            <button
              onClick={() => { setNewNoteName(""); setNoteView("create"); }}
              className="flex items-center gap-1.5 text-[16px] bg-[#FFFFFF] text-gray-900 px-4 py-2 rounded-full font-semibold border border-[rgba(0,0,0,0.12)] hover:bg-[#F1F0EE] transition-colors"
            >
              <Plus size={11} />{tr("New Note")}</button>
          </div>

          {notes.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-10 text-center">
              <PenLine size={28} className="mx-auto mb-3 text-[#222]" />
              <p className="text-[20px] font-semibold text-gray-900 mb-1">{tr("No notes yet")}</p>
              <p className="text-[17px] text-gray-800 mb-4">Create your first note for {course.name}</p>
              <button
                onClick={() => { setNewNoteName(""); setNoteView("create"); }}
                className="text-[16px] font-semibold border border-[rgba(0,0,0,0.14)] px-5 py-2.5 rounded-full text-gray-900 hover:border-[#ddd] transition-colors"
              >{tr("Create a note")}</button>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="group bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[rgba(0,0,0,0.1)] transition-colors">
                  <button className="flex-1 text-left" onClick={() => { setActiveNote(n); setNoteSavedAt(null); setNoteView("edit"); }}>
                    <div className="text-[18px] font-semibold text-gray-900">{n.name}</div>
                    <div className="text-[15px] text-gray-800 mt-0.5">
                      {format(new Date(n.updatedAt), "MMM d, yyyy · h:mm a")}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-800 hover:text-red-600 transition-all ml-3"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "note" && noteView === "create" && (
        <div className="max-w-sm">
          <button onClick={() => setNoteView("list")} className="flex items-center gap-2 text-gray-800 hover:text-gray-900 transition-colors text-[17px] mb-6">
            <ArrowLeft size={14} />{tr("Back")}</button>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.4px", color: "#0f1115", margin: "0 0 4px" }}>{tr("New Note")}</h2>
          <p className="text-gray-800 text-[18px] mb-6">{tr("Give your note a name to get started.")}</p>
          <div className="space-y-4">
            <div>
              <label className="text-[15px] font-semibold text-gray-900 uppercase tracking-widest block mb-2">{tr("Note name")}</label>
              <input
                autoFocus
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNote()}
                placeholder={tr("e.g. Chapter 3 — Derivatives, Lecture 5…")}
                className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3.5 text-[18px] text-gray-900 placeholder-gray-500 outline-none"
              />
            </div>
            <button
              onClick={createNote}
              disabled={!newNoteName.trim()}
              className="w-full bg-[#FFFFFF] text-gray-900 rounded-xl py-3.5 text-[17px] font-semibold border border-[rgba(0,0,0,0.14)] disabled:opacity-40 hover:bg-[#F1F0EE] transition-colors"
            >{tr("Create Note")}</button>
          </div>
        </div>
      )}

      {tab === "note" && noteView === "edit" && activeNote && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setNoteView("list")} className="text-gray-800 hover:text-gray-900 transition-colors" aria-label={tr("Back to notes")}>
              <ArrowLeft size={20} />
            </button>
            <div className="text-[22px] font-bold" style={{ color: "#0f1115" }}>{activeNote.name}</div>
            <div className="ml-auto flex items-center gap-3">
              {noteSavedAt && (
                <span className="text-[15px] text-gray-800">
                  Saved {noteSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={saveNoteNow}
                className="px-4 py-2 rounded-lg text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: color }}
              >{tr("Save")}</button>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete "${activeNote.name}"?`,
                  message: tr("This note will be permanently removed and dropped from your course memory. This can't be undone."),
                  confirmLabel: tr("Delete note"),
                  danger: true,
                });
                if (ok) deleteNote(activeNote.id);
              }}
              className="text-gray-800 hover:text-red-600 transition-colors"
              aria-label={tr("Delete note")}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <TiptapNoteEditor
            content={activeNote.text}
            onChange={val => handleNoteChange(val)}
            complete={async (before, signal) => {
              const r = await apiFetch("/api/notes/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId: course.id, noteId: activeNote.id, before }),
                signal,
              });
              return r?.data?.completion ?? "";
            }}
            color={color}
          />
        </div>
      )}

    </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type View = "list" | "create" | "class";

function WorkspacePageInner() {
  const fetcher = useApiSWRFetcher();
  const { userId } = useAuth();

  const { data: coursesData } = useSWR(userId ? `${BASE}/api/courses` : null, fetcher, { revalidateOnFocus: false });
  const allCourses: any[] = coursesData?.data ?? [];

  const [view, setView] = useState<View>("list");
  const [activeCourse, setActiveCourse] = useState<any | null>(null);

  // The floating recorder's "Open" (or a banner) asks for a class; its workspace
  // then handles the request (Record tab, and the lecture if one was named).
  const rec = useRecorder();
  useEffect(() => {
    const request = rec.openRequest;
    if (!request) return;
    const match = allCourses.find((c: any) => c.id === request.courseId);
    if (match && activeCourse?.id !== match.id) setActiveCourse(match);
    if (match && view !== "class") setView("class");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.openRequest, allCourses]);

  if (view === "create") {
    return (
      <div className="p-8 max-w-2xl">
        <CreateClassPage
          onBack={() => setView("list")}
          onCreate={c => { setActiveCourse(c); setView("class"); }}
        />
      </div>
    );
  }

  if (view === "class" && activeCourse) {
    return (
      <ClassWorkspace
        key={activeCourse.id}
        course={activeCourse}
        allCourses={allCourses}
        onSelect={c => setActiveCourse(c)}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-5xl px-6 py-8">
        <ClassList
          onSelect={c => { setActiveCourse(c); setView("class"); }}
          onCreate={() => setView("create")}
        />
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspacePageInner />
    </Suspense>
  );
}
