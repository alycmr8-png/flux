"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import {
  Mic, Loader2, Plus, Pause, Play, StopCircle,
  Calendar, X, Mic2, FileText, ArrowLeft, Layers, Check,
  PenLine, Trash2, RotateCcw, Sparkles, ImagePlus, ChevronRight,
  GraduationCap, Target, AlertTriangle, ListChecks, HelpCircle, BookOpen, Camera,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { useToast, useConfirm } from "@/components/Feedback";
import { useAuth } from "@clerk/nextjs";
import { useT } from "@/lib/useT";
import useSWR from "swr";
import { format } from "date-fns";
import { TiptapNoteEditor } from "@/components/TiptapNoteEditor";
import { recSafeStart, recSafeAppend, recSafeClear, recSafeLoad, type RecMeta } from "@/lib/recSafe";
import { useLiveTranscription } from "@/lib/useLiveTranscription";
import { toMathNotation } from "@sano/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
      toast(e?.message ?? "Couldn't generate that — try again in a moment.", "error");
    } finally {
      setLoading(null);
    }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading === "ask") return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading("ask");
    try {
      const r = await apiFetch("/api/studybook/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, messages: next }),
      });
      setMessages([...next, { role: "assistant", content: r.data?.reply ?? "" }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: e?.message ?? "Something went wrong — try again." }]);
    } finally {
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
  const label = "text-[10px] font-bold uppercase tracking-widest mb-2";
  const body = "text-sm leading-[1.75]";
  const bodyStyle = { color: "rgba(15,17,21,0.75)" };

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
              fontSize: 13.5,
              fontWeight: view === key ? 600 : 500,
              background: view === key ? color : "transparent",
              color: view === key ? "#fff" : "rgba(15,17,21,0.55)",
            }}
          >
            <Icon size={14} />
            {tabLabel}
          </button>
        ))}
      </div>

      {loading === view && (
        <div className="flex items-center justify-center gap-2.5 py-12">
          <Loader2 size={16} className="animate-spin" style={{ color }} />
          <span className="text-sm" style={{ color: "rgba(15,17,21,0.55)" }}>Generating…</span>
        </div>
      )}

      {/* ── Summary ── */}
      {view === "summary" && (
        <div className={card} style={cardStyle}>
          {(content.sections ?? []).map((sec: any, i: number) => (
            <div key={i} className="mb-6 last:mb-0">
              <div className={label} style={{ color: "rgba(15,17,21,0.55)" }}>{sec.heading}</div>
              <ul className="space-y-1.5">
                {(sec.bullets ?? []).map((b: string, j: number) => (
                  <li key={j} className={`flex gap-2.5 ${body}`} style={bodyStyle}>
                    <span style={{ color: "rgba(15,17,21,0.35)" }}>•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {(content.formulas ?? []).length > 0 && (
            <div className="rounded-xl p-4 mt-5" style={{ background: `${color}0F`, border: `1px solid ${color}26` }}>
              <div className={label} style={{ color: "rgba(15,17,21,0.55)" }}>Formulas</div>
              {content.formulas.map((f: string, i: number) => (
                <div key={i} className="text-[15px] leading-7" style={{ color: "#0f1115" }}>{f}</div>
              ))}
            </div>
          )}

          {(content.keyTerms ?? []).length > 0 && (
            <div className="mt-5">
              <div className={label} style={{ color: "rgba(15,17,21,0.55)" }}>Key Terms</div>
              <div className="space-y-1.5">
                {content.keyTerms.map((kt: any, i: number) => (
                  <div key={i} className={body} style={bodyStyle}>
                    <span className="font-semibold" style={{ color: "#0f1115" }}>{kt.term}</span>
                    {kt.definition ? ` — ${kt.definition}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(content.examTips ?? []).length > 0 && (
            <div className="rounded-xl p-4 mt-5" style={{ background: `${color}0F`, border: `1px solid ${color}26` }}>
              <div className={label} style={{ color: "rgba(15,17,21,0.55)" }}>Exam Tips</div>
              <ul className="space-y-1.5">
                {content.examTips.map((tp: string, i: number) => (
                  <li key={i} className={`flex gap-2.5 ${body}`} style={bodyStyle}>
                    <span style={{ color: "rgba(15,17,21,0.35)" }}>•</span>
                    <span>{tp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!(content.sections ?? []).length && (
            <div className={body} style={bodyStyle}>No summary was generated for this lecture.</div>
          )}
        </div>
      )}

      {/* ── Transcript ── */}
      {view === "transcript" && transcript !== null && (
        <div className={card} style={cardStyle}>
          {transcript.trim()
            ? <p className="text-[15px] leading-[1.85] whitespace-pre-wrap" style={{ color: "rgba(15,17,21,0.85)" }}>{transcript}</p>
            : <p className={body} style={bodyStyle}>No transcript available for this lecture.</p>}
        </div>
      )}

      {/* ── Key points ── */}
      {view === "points" && points && (
        <div className={card} style={cardStyle}>
          {points.map((p: any, i: number) => {
            const c = CATEGORY_COLOR[p.category] ?? BRAND;
            return (
              <div key={i} className="flex gap-3 items-start mb-3 last:mb-0">
                <span className="text-[10px] font-bold shrink-0 px-2.5 py-1 rounded-full text-center"
                  style={{ color: c, background: `${c}1A`, minWidth: 84 }}>
                  {p.category}
                </span>
                <span className={body} style={bodyStyle}>{p.point}</span>
              </div>
            );
          })}
          {!points.length && <p className={body} style={bodyStyle}>No key points found.</p>}
        </div>
      )}

      {/* ── Quizzes ── */}
      {view === "quiz" && quiz && (
        <div className="space-y-3">
          {(quiz.questions ?? []).map((q: any, i: number) => (
            <div key={q.id ?? i} className={card} style={cardStyle}>
              <div className="text-[15px] font-semibold mb-3" style={{ color: "#0f1115" }}>{i + 1}. {q.question}</div>
              <div className="space-y-2">
                {(q.options ?? []).map((opt: string, oi: number) => {
                  const picked = answers[i] === oi;
                  const revealed = !!score;
                  const isRight = q.correctIndex === oi;
                  const borderColor = revealed && isRight ? "#16A34A"
                    : revealed && picked && !isRight ? "#DC2626"
                    : picked ? color : "rgba(0,0,0,0.1)";
                  const background = revealed && isRight ? "rgba(22,163,74,0.08)"
                    : revealed && picked && !isRight ? "rgba(220,38,38,0.06)"
                    : picked ? `${color}0F` : "transparent";
                  return (
                    <button
                      key={oi}
                      disabled={!!score}
                      onClick={() => setAnswers(a => ({ ...a, [i]: oi }))}
                      className="w-full text-left rounded-xl px-4 py-3 text-sm transition-colors disabled:cursor-default"
                      style={{ border: `1px solid ${borderColor}`, background, color: "rgba(15,17,21,0.85)" }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {score && q.explanation && (
                <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(15,17,21,0.6)" }}>{q.explanation}</p>
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
              className="w-full rounded-2xl py-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: color }}>
              Check answers
            </button>
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
              className={`${card} text-left transition-colors hover:border-[rgba(0,0,0,0.18)]`}
              style={{ ...cardStyle, minHeight: 150 }}
            >
              <div className="text-[11px] font-semibold mb-2" style={{ color: "rgba(15,17,21,0.35)" }}>{i + 1} / {cards.length}</div>
              <div className={flipped[i] ? body : "text-[15px] font-semibold leading-relaxed"}
                style={flipped[i] ? bodyStyle : { color: "#0f1115" }}>
                {flipped[i] ? c.back : c.front}
              </div>
              <div className="text-[11px] mt-3" style={{ color: "rgba(15,17,21,0.35)" }}>
                {flipped[i] ? "Click to hide" : "Click to reveal"}
              </div>
            </button>
          ))}
          {!cards.length && (
            <div className={card} style={cardStyle}><p className={body} style={bodyStyle}>No flashcards were generated.</p></div>
          )}
        </div>
      )}

      {/* ── Ask this lecture ── */}
      {view === "ask" && (
        <div>
          {messages.length === 0 && (
            <div className={`${card} mb-3`} style={cardStyle}>
              <div className="text-[15px] font-semibold" style={{ color: "#0f1115" }}>Ask anything about this lecture</div>
              <p className={`${body} mt-1`} style={bodyStyle}>Answers come from this recording&rsquo;s transcript.</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["Explain the main idea simply", "What formulas were covered?", "What might be on the exam?"].map(p => (
                  <button key={p} onClick={() => send(p)}
                    className="text-xs px-3.5 py-2 rounded-full transition-colors"
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
                <span className="text-sm max-w-[85%] leading-relaxed px-4 py-2.5 whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? color : "#FFFFFF",
                    border: m.role === "user" ? "none" : "1px solid rgba(0,0,0,0.08)",
                    color: m.role === "user" ? "#fff" : "rgba(15,17,21,0.85)",
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}>{m.content}</span>
              </div>
            ))}
            {loading === "ask" && (
              <div className="flex justify-start">
                <span className="px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "18px 18px 18px 4px" }}>
                  <TypingDots color={color} />
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask about this lecture…"
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }} />
            <button onClick={() => send()} disabled={!input.trim() || loading === "ask"}
              className="text-sm font-semibold px-5 rounded-xl text-white disabled:opacity-40"
              style={{ background: color }}>
              Send
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-center mt-6">
        <button onClick={onRecordAnother}
          className="text-sm px-5 py-2.5 rounded-full transition-colors hover:bg-black/[0.03]"
          style={{ color: "rgba(15,17,21,0.55)", border: "1px solid rgba(0,0,0,0.12)" }}>
          Back to recordings
        </button>
      </div>
    </div>
  );
}

// ─── Create Class Mini-Page ───────────────────────────────────────────────────
function CreateClassPage({ onBack, onCreate }: { onBack: () => void; onCreate: (c: any) => void }) {
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
      toast(e?.message ?? "Couldn't create the class. Check that you're online and try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-8">
        <ArrowLeft size={14} /> {t.common.back}
      </button>

      <h1 className="font-serif italic text-5xl mb-1">{t.newClass.title}</h1>
      <p className="text-gray-600 text-sm mb-8">{t.newClass.subtitle}</p>

      <div className="space-y-4">
        {/* Class name */}
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1.5">{t.newClass.classNameLabel}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder={t.newClass.classNamePlaceholder}
            className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Colour — every pill, card and results screen for this class picks it up */}
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-2">Colour</label>
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
          className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif italic text-3xl mb-1">{t.workspace.title}</h1>
          <p className="text-gray-600 text-sm">{t.workspace.subtitle}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-[#FFFFFF] text-gray-900 text-sm font-medium px-4 py-2 rounded-full hover:bg-[#F1F0EE] transition-colors"
        >
          <Plus size={14} /> {t.workspace.newClass}
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
          <p className="text-gray-600 text-sm font-medium mb-1">No classes yet</p>
          <p className="text-gray-600 text-xs mb-4">Create your first class to start recording lectures</p>
          <button onClick={onCreate} className="text-xs text-[#6b6b69] border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full hover:border-[#ddd] transition-colors">
            Create a class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="relative group/card">
              {confirmDeleteId === c.id ? (
                <div className="bg-[#FFFFFF] border border-red-200 rounded-2xl p-7 flex flex-col gap-3">
                  <p className="text-sm font-medium text-gray-900">Delete &ldquo;{c.name}&rdquo;?</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    This permanently deletes the class and everything in it — recordings, transcripts, summaries and notes. This cannot be undone.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setConfirmDeleteId(null)} disabled={deleting}
                      className="flex-1 text-xs py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-gray-600 hover:text-gray-900 transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => deleteCourse(c.id)} disabled={deleting}
                      className="flex-1 text-xs py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
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
                    <div className="text-gray-900 font-medium text-base">{c.name}</div>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-50"
                    title="Delete class"
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
  const t = useT();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId } = useAuth();
  const [tab, setTab] = useState<"record" | "exam" | "note" | "ask">("record");
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

  // ── Exam Mode ──────────────────────────────────────────────────────────────
  const { data: examPackData, mutate: mutateExamPack } = useSWR(
    visitedTabs.has("exam") ? `${BASE}/api/examprep?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const examContent: any = examPackData?.data?.content ?? null;
  const [examLoading, setExamLoading] = useState(false);
  const [examDateInput, setExamDateInput] = useState("");
  const [examChosen, setExamChosen] = useState<Record<number, string>>({});
  const [examRevealed, setExamRevealed] = useState<Set<number>>(new Set());
  const examDaysLeft = examContent?.examDate
    ? Math.max(0, Math.ceil((new Date(examContent.examDate).getTime() - Date.now()) / 86400000))
    : null;

  async function generateExam() {
    setExamLoading(true);
    setExamChosen({});
    setExamRevealed(new Set());
    try {
      const res = await apiFetch(`/api/examprep/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, examDate: examDateInput || undefined }),
      });
      mutateExamPack({ data: res.data }, false);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast(
        e?.name === "QuotaError" ? msg : msg.includes("empty_memory") ? t.workspace.exam.emptyMemory : t.workspace.exam.failed,
        "error"
      );
    } finally {
      setExamLoading(false);
    }
  }

  function renderExamCites(citations: any[]) {
    if (!citations?.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {citations.map((c: any, i: number) => {
          const clickable = citationClickable(c);
          const Icon = c.sourceType === "note" ? PenLine : c.sourceType === "file" ? FileText : Play;
          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && openCitation(c)}
              className="flex items-center gap-1 text-[10px] rounded-full border px-2 py-0.5 transition-colors disabled:opacity-60 hover:bg-[rgba(75,95,232,0.1)]"
              style={{ borderColor: "rgba(75,95,232,0.3)", color: "#4B5FE8", background: "rgba(75,95,232,0.05)" }}
            >
              {askCiteLoading === c.n ? <Loader2 size={9} className="animate-spin" /> : <Icon size={9} />}
              <span className="truncate max-w-[220px]">{c.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── record ──
  const live = useLiveTranscription();
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  // Board photos: whiteboard/slide snapshots uploaded alongside the audio.
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recStep, setRecStep] = useState<"name" | "recording" | "saved" | "processing">("name");
  const [recovered, setRecovered] = useState<{ meta: RecMeta; blob: Blob } | null>(null);
  useEffect(() => {
    // A protected copy left behind means the last recording was interrupted
    recSafeLoad().then(r => { if (r) setRecovered(r); }).catch(() => {});
  }, []);
  const [openLectureId, setOpenLectureId] = useState<string | null>(null);
  const [openLectureData, setOpenLectureData] = useState<
    { title: string; recordedAt: string | null; transcript: string; sheet: any | null; audioUrl: string | null } | null
  >(null);
  const localAudioUrlsRef = useRef<Map<string, string>>(new Map());
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const liveScrollRef = useRef<HTMLDivElement | null>(null);
  const autoTitleRef = useRef<string>("");

  // processing state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState("processing");
  const [processingError, setProcessingError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Keep the newest words in view as the live transcript grows.
  useEffect(() => {
    const el = liveScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live.text, live.partial]);

  useEffect(() => {
    if (!processingId) return;
    setProcessingError("");
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > 6 * 60 * 1000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setProcessingError("Processing timed out. Please try again.");
        setProcessingId(null);
        setRecStep("saved");
        return;
      }
      try {
        const res = await apiFetch(`/api/lectures/${processingId}/status`);
        const status = res.data?.status;
        setProcessingStatus(status);
        if (status === "ready" || status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status === "error") {
            const errorMessage = res.data?.errorMessage;
            setProcessingError(errorMessage || "Processing failed. Check your internet connection and try again.");
            setProcessingId(null);
            setRecStep("saved");
            return;
          }
          const finishedId = processingId;
          await mutateLectures();
          setProcessingId(null);
          setRecStep("name");
          setSeconds(0);
          setRecTitle("");
          autoTitleRef.current = "";
          setImages(prev => { prev.forEach(({ url }) => URL.revokeObjectURL(url)); return []; });
          // Drop straight into everything that was just generated.
          openLectureById(finishedId);
        }
      } catch (_) {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingId]);

  async function acquireWakeLock() {
    // Keep the screen awake during long recordings — a locked/sleeping screen
    // can silently suspend the recorder, killing a whole lecture.
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen");
    } catch { /* unsupported browser — recording still works, screen may sleep */ }
  }

  function releaseWakeLock() {
    try { wakeLockRef.current?.release?.(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }

  // Re-acquire the lock if the user tabs away and back mid-recording
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && mediaRef.current?.state === "recording") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // "Biology 101 — 13 Sep, 2:15pm" beats "Untitled Lecture" in the list later.
  function autoTitle() {
    const now = new Date();
    const day = now.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${course.name} — ${day}, ${time}`;
  }

  function lectureTitle() {
    // Pinned at the moment recording started, so the timestamp in the name is
    // when the lecture began rather than whenever this happens to re-render.
    return recTitle.trim() || autoTitleRef.current || autoTitle();
  }

  async function startRecording() {
    autoTitleRef.current = autoTitle();
    const stream = await navigator.mediaDevices.getUserMedia({
      // lecture halls: suppress room noise, level out a far-away professor
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];
    setRecovered(null);
    await recSafeStart({
      title: lectureTitle(),
      courseId: course.id,
      courseName: course.name,
      startedAt: Date.now(),
      mime: recorder.mimeType || "audio/webm",
    });
    recorder.ondataavailable = e => { chunksRef.current.push(e.data); recSafeAppend(e.data); };
    recorder.start(250);
    // The file upload is still the source of truth; this is the words on screen.
    live.start().catch(() => { /* recording still works without live text */ });
    setRecording(true);
    setRecStep("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    acquireWakeLock();
  }

  function pauseRecording() {
    if (!mediaRef.current || paused) return;
    mediaRef.current.pause();
    live.stop();
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resumeRecording() {
    if (!mediaRef.current || !paused) return;
    mediaRef.current.resume();
    live.start().catch(() => {});
    setPaused(false);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  async function stopRecording() {
    if (!mediaRef.current) return;
    releaseWakeLock();
    live.stop();
    mediaRef.current.stop();
    mediaRef.current.stream.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(false);
    setRecording(false);
    await new Promise<void>(res => { mediaRef.current!.onstop = () => res(); });
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    setSavedBlob(blob);
    setSavedAudioUrl(url);
    setRecStep("saved");
  }

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...picked].slice(0, 12));
  }

  function removeImage(i: number) {
    setImages(prev => {
      const target = prev[i];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, j) => j !== i);
    });
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

  async function processAudio() {
    if (!savedBlob) return;
    if (audioElemRef.current) { audioElemRef.current.pause(); setPlaying(false); }
    setUploading(true);
    setRecStep("processing");
    try {
      const fd = new FormData();
      fd.append("audio", savedBlob, "lecture.webm");
      fd.append("courseId", course.id);
      fd.append("title", lectureTitle());
      // Board photos ride along on the same upload — the API takes up to 12.
      images.forEach(({ file }) => fd.append("images", file));
      const res = await apiFetch("/api/lectures", { method: "POST", body: fd });
      const lectureId = res.data?.id ?? null;
      if (lectureId && savedAudioUrl) {
        localAudioUrlsRef.current.set(lectureId, savedAudioUrl);
      } else if (savedAudioUrl) {
        URL.revokeObjectURL(savedAudioUrl);
      }
      setProcessingId(lectureId);
      setProcessingStatus("processing");
      setSavedBlob(null);
      setSavedAudioUrl(null);
      recSafeClear();
    } catch (e: any) {
      toast(e?.message ?? "Upload failed — your recording is still here, give it another try.", "error");
      setRecStep("saved");
    } finally {
      setUploading(false);
    }
  }

  function resetRecorder() {
    setProcessingId(null);
    setProcessingStatus("processing");
    setSeconds(0);
    setRecTitle("");
    autoTitleRef.current = "";
    images.forEach(({ url }) => URL.revokeObjectURL(url));
    setImages([]);
    setPaused(false);
    setSavedBlob(null);
    if (savedAudioUrl) URL.revokeObjectURL(savedAudioUrl);
    setSavedAudioUrl(null);
    setPlaying(false);
    if (audioElemRef.current) { audioElemRef.current.pause(); audioElemRef.current = null; }
    setProcessingError("");
    setRecStep("name");
    setOpenLectureId(null);
    setOpenLectureData(null);
  }

  async function openLecture(lecture: any) {
    setOpenLectureId(lecture.id);
    setOpenLectureData(null);
    const transcript = lecture.transcript ?? "";

    // Just-recorded lectures already have a local blob URL; otherwise stream
    // via a signed URL so playback starts instantly and seeking works.
    let audioUrl: string | null = localAudioUrlsRef.current.get(lecture.id) ?? null;
    if (!audioUrl) {
      try {
        const r = await apiFetch(`/api/lectures/${lecture.id}/audio-url`);
        if (r?.data?.url) audioUrl = `${BASE}${r.data.url}`;
      } catch { /* audio unavailable */ }
    }

    const base = {
      title: lecture.title ?? "Recording",
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
      toast("Note deleted", "success");
    } catch (e: any) {
      toast(e?.message ?? "Couldn't delete the note — try again.", "error");
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

  async function sendAsk(text?: string) {
    const q = (text ?? askInput).trim();
    if (!q || askLoading) return;
    const history = [...askMessages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content: q }];
    setAskMessages(prev => [...prev, { role: "user", content: q }]);
    setAskInput("");
    setAskLoading(true);
    try {
      const res = await apiFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, messages: history }),
      });
      setAskMessages(prev => [...prev, { role: "assistant", content: res.data.reply, citations: res.data.citations ?? [] }]);
    } catch (e: any) {
      setAskMessages(prev => [...prev, { role: "assistant", content: e?.message ?? "Something went wrong — try again." }]);
    } finally {
      setAskLoading(false);
    }
  }

  // ── clickable citations: jump straight to the cited moment ──
  const [askPlayer, setAskPlayer] = useState<{ title: string; url: string; startSec: number } | null>(null);
  const [askCiteLoading, setAskCiteLoading] = useState<number | null>(null);
  const askAudioRef = useRef<HTMLAudioElement | null>(null);

  function citationClickable(c: any) {
    return ["lecture", "video", "file", "note"].includes(c.sourceType);
  }

  async function openCitation(c: any) {
    const startSec = Math.max(0, Math.floor(c.startSec ?? 0));

    // YouTube source → open the video at the cited timestamp
    if (c.sourceType === "video") {
      const lec = lectures.find((l: any) => l.id === c.sourceId);
      const vid = ytIdFromUrl(lec?.audioUrl);
      if (vid) { window.open(`https://www.youtube.com/watch?v=${vid}&t=${startSec}s`, "_blank"); return; }
      toast("Couldn't locate this video.", "error");
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
        if (!lec) { toast("Couldn't find this file's saved content.", "error"); return; }
        switchTab("record");
        await openLecture(lec);
      } finally {
        setAskCiteLoading(null);
      }
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
        if (!note) { toast("Couldn't find this note.", "error"); return; }
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
        const r = await apiFetch(`/api/lectures/${c.sourceId}/audio-url`);
        if (!r?.data?.url) throw new Error();
        setAskPlayer({ title: c.sourceTitle ?? c.label, url: `${BASE}${r.data.url}`, startSec });
      } catch {
        toast("Audio for this lecture isn't available.", "error");
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
    const seekAndPlay = () => {
      el.currentTime = askPlayer.startSec;
      el.play().catch(() => { /* autoplay blocked — user presses play, position is set */ });
    };
    if (el.readyState >= 1) seekAndPlay();
    else el.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    return () => el.removeEventListener("loadedmetadata", seekAndPlay);
  }, [askPlayer]);

  const TABS = [
    { key: "ask",       label: t.workspace.tabs.ask,       icon: Sparkles },
    { key: "record",    label: t.workspace.tabs.record,    icon: Mic2     },
    { key: "exam",      label: t.workspace.exam.tab,       icon: GraduationCap },
    { key: "note",      label: t.workspace.tabs.note,      icon: PenLine  },
  ] as const;

  return (
    <div className="w-full min-h-full flex justify-center">
    <div className="w-full max-w-7xl px-3 py-5 md:px-8 md:py-8">
      <style>{WORKSPACE_KEYFRAMES}</style>
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>
          Workspace
        </div>
        {/* Class pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {allCourses.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="whitespace-nowrap transition-all flex items-center gap-2"
              style={c.id === course.id
                ? { padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, background: tint(c), color: "white", border: `1px solid ${tint(c)}`, boxShadow: `0 4px 16px ${tint(c)}59` }
                : { padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 500, background: "transparent", color: "rgba(15,17,21,0.75)", border: "1px solid rgba(0,0,0,0.08)" }
              }
            >
              {c.id !== course.id && <span className="w-2 h-2 rounded-full" style={{ background: tint(c) }} />}
              {c.name}
            </button>
          ))}
          <button
            onClick={onBack}
            className="whitespace-nowrap transition-all"
            style={{ padding: "8px 15px", borderRadius: 999, fontSize: 13.5, fontWeight: 500, background: "transparent", color: "rgba(31,35,40,0.66)", border: "1px solid rgba(0,0,0,0.07)" }}
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
              fontSize: 13.5,
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
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 24, height: "calc(100dvh - 300px)", minHeight: 440 }}>

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(75,95,232,0.18)" }}>
              <Sparkles size={16} style={{ color: "#4B5FE8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{t.workspace.ask.title}</div>
              <div className="text-[11px]" style={{ color: "rgba(31,35,40,0.6)" }}>
                {askIndexing
                  ? t.workspace.ask.building
                  : askStatus
                    ? `${t.workspace.ask.memoryLine}: ${askStatus.sources?.length ?? 0} ${(askStatus.sources?.length ?? 0) === 1 ? "source" : "sources"} · ${askStatus.chunkCount ?? 0} chunks`
                    : t.workspace.ask.subtitle}
              </div>
            </div>
            <button onClick={rebuildAskMemory} disabled={askIndexing}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{ color: "rgba(31,35,40,0.7)", border: "1px solid rgba(0,0,0,0.08)" }}>
              {askIndexing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              {t.workspace.ask.refresh}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Loader2 size={22} className="animate-spin" style={{ color: "#4B5FE8" }} />
                <div className="text-sm" style={{ color: "rgba(31,35,40,0.8)" }}>{t.workspace.ask.building}</div>
                <div className="text-xs" style={{ color: "rgba(31,35,40,0.55)" }}>{t.workspace.ask.buildingHint}</div>
              </div>
            )}
            {!askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                {(askStatus?.chunkCount ?? 0) === 0 ? (
                  <div className="text-sm max-w-sm" style={{ color: "rgba(31,35,40,0.66)" }}>{t.workspace.ask.empty}</div>
                ) : (
                  <>
                    <div className="text-sm" style={{ color: "rgba(31,35,40,0.66)" }}>{t.workspace.ask.subtitle}</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {t.workspace.ask.quickPrompts.map(p => (
                        <button key={p} onClick={() => sendAsk(p)}
                          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-black/[0.04]"
                          style={{ color: "rgba(31,35,40,0.8)", border: "1px solid rgba(0,0,0,0.08)" }}>
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
                <span className="text-sm max-w-[85%] leading-relaxed px-4 py-2.5 whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? "#4B5FE8" : "rgba(0,0,0,0.05)",
                    color: m.role === "user" ? "white" : "rgba(31,35,40,0.85)",
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}>{m.content}</span>
                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
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
                          className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-all"
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
                <span className="px-4 py-3" style={{ background: "rgba(0,0,0,0.05)", borderRadius: "18px 18px 18px 4px" }}>
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
                <div className="text-[11px] font-semibold truncate" style={{ color: "#1F2328" }}>{askPlayer.title}</div>
                <div className="text-[9px]" style={{ color: "#4B5FE8" }}>
                  from {Math.floor(askPlayer.startSec / 60)}:{String(askPlayer.startSec % 60).padStart(2, "0")}
                </div>
              </div>
              <audio ref={askAudioRef} src={askPlayer.url} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
              <button onClick={() => setAskPlayer(null)} aria-label="Close player"
                className="p-1 rounded-lg transition-colors hover:bg-black/[0.05]" style={{ color: "rgba(31,35,40,0.6)" }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <input value={askInput} onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAsk()}
              placeholder={t.workspace.ask.placeholder}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", color: "#1F2328" }} />
            <button onClick={() => sendAsk()} disabled={!askInput.trim() || askLoading}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: "#4B5FE8", color: "white" }}>
              {t.workspace.ask.send}
            </button>
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

          {/* ── Open recording → everything generated for it ── */}
          {openLectureId ? (
            <div>
              <button onClick={closeOpenLecture} className="flex items-center gap-2 text-sm transition-colors mb-6"
                style={{ color: "rgba(15,17,21,0.55)" }}>
                <ArrowLeft size={14} /> Back to recordings
              </button>
              {openLectureData === null ? (
                <div className="flex items-center gap-3 text-sm py-8" style={{ color: "rgba(15,17,21,0.55)" }}>
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
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
                        <div className="text-[11px] mt-1" style={{ color: "rgba(15,17,21,0.45)" }}>
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
                    <div className="text-sm font-semibold" style={{ color: "#92400E" }}>Recording recovered</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(15,17,21,0.6)" }}>
                      &ldquo;{recovered.meta.title}&rdquo; · {recovered.meta.courseName} · {(recovered.blob.size / 1048576).toFixed(1)} MB — interrupted before it was saved.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSavedBlob(recovered.blob);
                        setSavedAudioUrl(URL.createObjectURL(recovered.blob));
                        setRecTitle(recovered.meta.title);
                        setRecStep("saved");
                        setRecovered(null);
                      }}
                      className="text-xs font-semibold px-4 py-2 rounded-full text-white"
                      style={{ background: "#D97706" }}>
                      Restore
                    </button>
                    <button
                      onClick={() => { recSafeClear(); setRecovered(null); }}
                      className="text-xs px-3 py-2 transition-colors hover:text-red-600"
                      style={{ color: "rgba(15,17,21,0.5)" }}>
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: name ── */}
              {recStep === "name" && (
                <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="w-full max-w-xl space-y-2">
                    <label className="text-[10px] uppercase tracking-widest block" style={{ color: "rgba(15,17,21,0.55)" }}>Lecture title (optional)</label>
                    <input
                      autoFocus
                      value={recTitle}
                      onChange={e => setRecTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && startRecording()}
                      placeholder={lectureTitle()}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }}
                    />
                    <p className="text-xs" style={{ color: "rgba(15,17,21,0.45)" }}>
                      Leave it blank and we&rsquo;ll name it &ldquo;{lectureTitle()}&rdquo;.
                    </p>
                  </div>
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105"
                    style={{ background: color, boxShadow: `0 8px 24px ${color}59` }}
                  >
                    <Mic size={24} />
                  </button>
                  <p className="text-xs" style={{ color: "rgba(15,17,21,0.55)" }}>Click to start recording</p>
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
                    <span className="text-sm font-semibold" style={{ color: "#0f1115" }}>
                      {paused ? "Paused" : live.connected ? "Live transcript" : "Connecting…"}
                    </span>
                    <span className="text-xs truncate hidden sm:block" style={{ color: "rgba(15,17,21,0.45)" }}>
                      · {lectureTitle()}
                    </span>
                    <span className="ml-auto text-xl font-medium shrink-0"
                      style={{ color: "#0f1115", fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
                      {fmt(seconds)}
                    </span>
                  </div>

                  <div ref={liveScrollRef} className="overflow-y-auto px-8 py-6" style={{ height: "min(52vh, 520px)" }}>
                    {live.fullText ? (
                      <p className="text-[17px] leading-[1.9] whitespace-pre-wrap" style={{ color: "#0f1115" }}>
                        {toMathNotation(live.text)}
                        {live.partial && (
                          <span style={{ color: "rgba(15,17,21,0.4)" }}>
                            {live.text ? " " : ""}{toMathNotation(live.partial)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[15px]" style={{ color: "rgba(15,17,21,0.4)" }}>
                        Start speaking — words appear here as you go.
                      </p>
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
                            aria-label="Remove photo"
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
                      <span className="text-sm font-medium" style={{ color: "#0f1115" }}>{paused ? "Resume" : "Pause"}</span>
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={images.length >= 12}
                      title={images.length >= 12 ? "Up to 12 photos per lecture" : "Add a photo of the board or slides"}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                      style={{ border: "1px solid rgba(0,0,0,0.12)" }}
                    >
                      <Camera size={16} style={{ color: "#0f1115" }} />
                      <span className="text-sm font-medium" style={{ color: "#0f1115" }}>
                        Photo{images.length ? ` (${images.length})` : ""}
                      </span>
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ background: "#DC2626" }}
                    >
                      <StopCircle size={16} />
                      <span className="text-sm font-medium">Stop</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: saved ── */}
              {recStep === "saved" && (
                <div className="rounded-2xl p-6 space-y-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[15px] font-semibold" style={{ color: "#0f1115" }}>{lectureTitle()}</span>
                    <span className="ml-auto text-xs" style={{ color: "rgba(15,17,21,0.55)" }}>{fmt(seconds)}</span>
                  </div>

                  <input
                    value={recTitle}
                    onChange={e => setRecTitle(e.target.value)}
                    placeholder="Rename this lecture (optional)"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)", color: "#0f1115" }}
                  />

                  <button
                    onClick={playAudio}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-black/[0.02]"
                    style={{ border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    {playing ? <Pause size={15} style={{ color }} /> : <Play size={15} style={{ color }} />}
                    <span className="text-sm" style={{ color: "#0f1115" }}>{playing ? "Pause" : "Listen to recording"}</span>
                  </button>

                  {/* Board photos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(15,17,21,0.55)" }}>
                        Board photos {images.length ? `(${images.length}/12)` : ""}
                      </span>
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={images.length >= 12}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-black/[0.03] disabled:opacity-40"
                        style={{ color: "rgba(15,17,21,0.75)", border: "1px solid rgba(0,0,0,0.1)" }}>
                        <ImagePlus size={12} /> Add photos
                      </button>
                    </div>
                    {images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                          <div key={img.url} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={`Board photo ${i + 1}`} className="w-24 h-24 object-cover rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.08)" }} />
                            <button
                              onClick={() => removeImage(i)}
                              aria-label="Remove photo"
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                              style={{ background: "rgba(15,17,21,0.75)" }}>
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "rgba(15,17,21,0.45)" }}>
                        Photos of the whiteboard or slides are read alongside the audio.
                      </p>
                    )}
                  </div>

                  {processingError && (
                    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}>
                      {processingError}
                    </div>
                  )}

                  <button
                    onClick={processAudio}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ background: color, boxShadow: `0 6px 20px ${color}40` }}
                  >
                    {uploading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                    <span className="text-base font-semibold">{uploading ? "Processing…" : "Process Lecture"}</span>
                  </button>

                  <button onClick={resetRecorder} className="w-full text-xs transition-colors hover:text-red-600" style={{ color: "rgba(15,17,21,0.4)" }}>
                    Discard recording
                  </button>
                </div>
              )}

              {/* ── Step: processing ── */}
              {recStep === "processing" && (
                <div className="rounded-2xl p-14 flex flex-col items-center gap-7" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}>
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
                  <div className="text-center space-y-1">
                    <div className="text-sm font-semibold" style={{ color: "#0f1115" }}>
                      {processingStatus === "transcribing" ? "Transcribing your lecture…"
                        : processingStatus === "generating" ? "Generating your summary…"
                        : "Uploading & analysing…"}
                    </div>
                  </div>
                  {/* Where in the pipeline this lecture is */}
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    {(["processing", "transcribing", "generating", "ready"] as const).map((s, i) => {
                      const idx = ["processing", "transcribing", "generating", "ready"].indexOf(processingStatus);
                      const done = i < idx;
                      const active = i === idx;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: done || active ? color : "rgba(0,0,0,0.14)" }} />
                          <span className="text-xs" style={{ color: i <= idx ? "rgba(15,17,21,0.75)" : "rgba(15,17,21,0.35)" }}>
                            {s === "processing" ? "Upload" : s === "transcribing" ? "Transcribe" : s === "generating" ? "Summarise" : "Done"}
                          </span>
                          {i < 3 && <span className="w-6 h-px" style={{ background: "rgba(0,0,0,0.1)" }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Recordings list ── */}
              {audioLectures.length > 0 && recStep !== "recording" && (
                <div className="mt-2">
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(15,17,21,0.55)" }}>Recordings</p>
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
                              <p className="text-xs flex-1" style={{ color: "rgba(15,17,21,0.65)" }}>
                                Delete <span className="font-medium" style={{ color: "#0f1115" }}>&ldquo;{l.title}&rdquo;</span>?
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setConfirmArchiveId(null)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "rgba(15,17,21,0.6)" }}>Cancel</button>
                                <button onClick={() => archiveLecture(l.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#DC2626" }}>Delete</button>
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
                                  <span className="block text-sm truncate" style={{ color: "#0f1115" }}>{l.title}</span>
                                  <span className="block text-xs mt-0.5" style={{ color: "rgba(15,17,21,0.5)" }}>
                                    {ready
                                      ? `${format(new Date(l.recordedAt), "MMM d, yyyy")} · Click to open`
                                      : l.status === "error" ? "Processing failed" : "Still processing…"}
                                  </span>
                                </span>
                              </button>
                              <div className="flex items-center gap-2 shrink-0">
                                {ready ? (
                                  <ChevronRight size={16} style={{ color: "rgba(15,17,21,0.35)" }} />
                                ) : l.status === "error" ? (
                                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ color: "#DC2626", background: "rgba(220,38,38,0.08)" }}>Failed</span>
                                ) : (
                                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ color: "rgba(15,17,21,0.55)", background: "rgba(0,0,0,0.06)" }}>
                                    <Loader2 size={8} className="animate-spin" /> Processing
                                  </span>
                                )}
                                <button
                                  onClick={() => setConfirmArchiveId(l.id)}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                                  style={{ color: "rgba(15,17,21,0.25)" }}
                                  title="Delete recording"
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
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(15,17,21,0.4)" }}>Archived</p>
                  <div className="space-y-2">
                    {archivedLectures.map(l => (
                      <div key={l.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: "rgba(15,17,21,0.6)" }}>{l.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(15,17,21,0.4)" }}>
                            {format(new Date(l.recordedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <button onClick={() => restoreLecture(l.id)}
                          className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-black/[0.03]"
                          style={{ color: "rgba(15,17,21,0.7)", border: "1px solid rgba(0,0,0,0.1)" }}>
                          Restore
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Permanently delete "${l.title}"?`,
                              message: "The recording, its transcript and everything generated from it are removed for good.",
                              confirmLabel: "Delete forever",
                              danger: true,
                            });
                            if (ok) permanentlyDelete(l.id);
                          }}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: "rgba(15,17,21,0.25)" }}
                          title="Delete permanently"
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

      {/* ── EXAM MODE ── */}
      {tab === "exam" && (
        <div className="space-y-4">
          {!examContent && !examLoading && (
            <div className="rounded-3xl border p-8 md:p-12 text-center" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)", boxShadow: "0 8px 24px rgba(75,95,232,0.35)" }}>
                <GraduationCap size={26} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.workspace.exam.title}</h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-7 leading-relaxed">{t.workspace.exam.tagline}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">{t.workspace.exam.dateLabel}</label>
                  <input type="date" value={examDateInput} onChange={e => setExamDateInput(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm text-gray-900 outline-none"
                    style={{ borderColor: "rgba(0,0,0,0.1)", background: "#FBFBFA" }} />
                </div>
                <button onClick={generateExam}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{ background: "#4B5FE8", boxShadow: "0 4px 16px rgba(75,95,232,0.35)" }}>
                  <Sparkles size={15} /> {t.workspace.exam.generate}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-5">{t.workspace.exam.note}</p>
            </div>
          )}

          {examLoading && (
            <div className="rounded-3xl border p-12 text-center" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
              <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: "#4B5FE8" }} />
              <div className="text-sm font-medium text-gray-900 mb-1">{t.workspace.exam.generating}</div>
              <p className="text-xs text-gray-500">{t.workspace.exam.generatingSub}</p>
            </div>
          )}

          {examContent && !examLoading && (
            <>
              {/* Status / countdown bar */}
              <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)" }}>
                  <GraduationCap size={17} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {examDaysLeft != null
                      ? (examDaysLeft > 0 ? t.workspace.exam.daysLeft.replace("{n}", String(examDaysLeft)) : t.workspace.exam.examToday)
                      : t.workspace.exam.title}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {t.workspace.exam.builtFrom.replace("{s}", String(examContent.sourceCount ?? 0)).replace("{c}", String(examContent.chunkCount ?? 0))}
                  </div>
                </div>
                <input type="date" value={examDateInput} onChange={e => setExamDateInput(e.target.value)}
                  className="rounded-xl border px-3 py-1.5 text-xs text-gray-900 outline-none" style={{ borderColor: "rgba(0,0,0,0.1)", background: "#FBFBFA" }} />
                <button onClick={generateExam}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border text-gray-700 hover:bg-[#F1F0EE] transition-colors"
                  style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                  <RotateCcw size={12} /> {t.workspace.exam.regenerate}
                </button>
              </div>

              {/* Likely topics */}
              {(examContent.topics ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Target size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.topics}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.topicsSub}</p>
                  <div className="space-y-3">
                    {examContent.topics.map((tp: any, i: number) => (
                      <div key={i} className="rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FBFBFA" }}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="text-sm font-semibold text-gray-900">{tp.name}</div>
                          <div className="flex gap-1 shrink-0">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className="w-4 h-1.5 rounded-full" style={{ background: n <= tp.importance ? "#4B5FE8" : "rgba(0,0,0,0.08)" }} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{tp.why}</p>
                        {renderExamCites(tp.citations)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Predicted questions */}
              {(examContent.questions ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.questions}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.questionsSub}</p>
                  <div className="space-y-3">
                    {examContent.questions.map((q: any, qi: number) => {
                      const chosen = examChosen[qi];
                      const answered = q.type === "mcq" ? chosen != null : examRevealed.has(qi);
                      return (
                        <div key={qi} className="rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FBFBFA" }}>
                          <div className="flex items-start gap-2.5 mb-3">
                            <span className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: "rgba(75,95,232,0.1)", color: "#4B5FE8" }}>{qi + 1}</span>
                            <p className="text-sm text-gray-900 font-medium leading-relaxed">{q.question}</p>
                          </div>
                          {q.type === "mcq" && q.options && (
                            <div className="space-y-1.5 mb-2">
                              {q.options.map((opt: string) => {
                                const letter = opt.match(/^[A-D]/)?.[0] ?? opt[0];
                                const isCorrect = letter === q.correctAnswer;
                                const isChosen = chosen === letter;
                                return (
                                  <button key={opt} disabled={answered}
                                    onClick={() => setExamChosen(p => ({ ...p, [qi]: letter }))}
                                    className="w-full text-left text-xs rounded-lg border px-3 py-2 transition-colors disabled:cursor-default"
                                    style={{
                                      borderColor: answered && isCorrect ? "rgba(22,163,74,0.5)" : answered && isChosen ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.08)",
                                      background: answered && isCorrect ? "rgba(22,163,74,0.08)" : answered && isChosen ? "rgba(220,38,38,0.07)" : "#FFFFFF",
                                      color: "#1F2328",
                                    }}>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {q.type === "short" && !answered && (
                            <button onClick={() => setExamRevealed(p => new Set([...p, qi]))}
                              className="text-xs font-semibold px-4 py-2 rounded-full border text-gray-700 hover:bg-[#F1F0EE] transition-colors mb-2"
                              style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                              {t.workspace.exam.reveal}
                            </button>
                          )}
                          {answered && (
                            <div className="rounded-lg p-3 mb-1" style={{ background: "rgba(75,95,232,0.06)", border: "1px solid rgba(75,95,232,0.2)" }}>
                              {q.type === "short" && <div className="text-xs text-gray-900 font-medium mb-1">{q.correctAnswer}</div>}
                              <p className="text-xs text-gray-600 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                          {renderExamCites(q.citations)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gaps in your notes */}
              {(examContent.gaps ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} style={{ color: "#D97706" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.gaps}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.gapsSub}</p>
                  <div className="space-y-3">
                    {examContent.gaps.map((g: any, i: number) => (
                      <div key={i} className="rounded-xl p-4 border" style={{ background: "rgba(217,119,6,0.06)", borderColor: "rgba(217,119,6,0.25)" }}>
                        <div className="text-sm font-semibold text-gray-900 mb-1">{g.topic}</div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-1.5">{g.evidence}</p>
                        <p className="text-xs font-medium" style={{ color: "#B45309" }}>→ {g.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Study plan */}
              {(examContent.plan ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.plan}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.planSub}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {examContent.plan.map((d: any, i: number) => (
                      <div key={i} className="rounded-xl border p-4" style={{ background: "#FBFBFA", borderColor: "rgba(0,0,0,0.06)" }}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#4B5FE8" }}>{d.label}</div>
                        <div className="text-sm font-semibold text-gray-900 mb-2">{d.focus}</div>
                        <div className="space-y-1">
                          {(d.items ?? []).map((it: string, j: number) => (
                            <div key={j} className="flex gap-2 text-xs text-gray-600">
                              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(0,0,0,0.3)" }} />
                              {it}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAKE NOTE ── */}
      {tab === "note" && noteView === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-600 uppercase tracking-widest">Your Notes</p>
            <button
              onClick={() => { setNewNoteName(""); setNoteView("create"); }}
              className="flex items-center gap-1.5 text-xs bg-[#FFFFFF] text-gray-900 px-3 py-1.5 rounded-full font-medium hover:bg-[#F1F0EE] transition-colors"
            >
              <Plus size={11} /> New Note
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-10 text-center">
              <PenLine size={28} className="mx-auto mb-3 text-[#222]" />
              <p className="text-sm text-gray-600 mb-1">No notes yet</p>
              <p className="text-xs text-gray-600 mb-4">Create your first note for {course.name}</p>
              <button
                onClick={() => { setNewNoteName(""); setNoteView("create"); }}
                className="text-xs border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full text-gray-900 hover:border-[#ddd] transition-colors"
              >
                Create a note
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="group bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[rgba(0,0,0,0.1)] transition-colors">
                  <button className="flex-1 text-left" onClick={() => { setActiveNote(n); setNoteSavedAt(null); setNoteView("edit"); }}>
                    <div className="text-sm text-gray-900">{n.name}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {format(new Date(n.updatedAt), "MMM d, yyyy · h:mm a")}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-600 transition-all ml-3"
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
          <button onClick={() => setNoteView("list")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-6">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-serif italic text-2xl mb-1">New Note</h2>
          <p className="text-gray-600 text-sm mb-6">Give your note a name to get started.</p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1.5">Note name</label>
              <input
                autoFocus
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNote()}
                placeholder="e.g. Chapter 3 — Derivatives, Lecture 5…"
                className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>
            <button
              onClick={createNote}
              disabled={!newNoteName.trim()}
              className="w-full bg-[#FFFFFF] text-gray-900 rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-[#F1F0EE] transition-colors"
            >
              Create Note
            </button>
          </div>
        </div>
      )}

      {tab === "note" && noteView === "edit" && activeNote && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setNoteView("list")} className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="text-sm font-medium text-gray-900">{activeNote.name}</div>
            <div className="ml-auto flex items-center gap-3">
              {noteSavedAt && (
                <span className="text-[10px] text-gray-600">
                  Saved {noteSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={saveNoteNow}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Save
              </button>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete "${activeNote.name}"?`,
                  message: "This note will be permanently removed and dropped from your course memory. This can't be undone.",
                  confirmLabel: "Delete note",
                  danger: true,
                });
                if (ok) deleteNote(activeNote.id);
              }}
              className="text-gray-600 hover:text-red-600 transition-colors"
              aria-label="Delete note"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <TiptapNoteEditor
            content={activeNote.text}
            onChange={val => handleNoteChange(val)}
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
