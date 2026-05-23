"use client";
import { useState } from "react";
import {
  FileUp, Loader2, GraduationCap, ClipboardList, BookOpen,
  Calendar, Clock, ChevronDown, AlertTriangle, Star,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import useSWR from "swr";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TYPE_COLOR: Record<string, string> = {
  Exam:       "bg-red-50 text-red-600 border-red-100",
  Quiz:       "bg-orange-50 text-orange-600 border-orange-100",
  Project:    "bg-purple-50 text-purple-600 border-purple-100",
  Assignment: "bg-blue-50 text-blue-600 border-blue-100",
  Reading:    "bg-green-50 text-green-600 border-green-100",
  Other:      "bg-gray-50 text-gray-500 border-gray-100",
};

const TYPE_DOT: Record<string, string> = {
  Exam: "bg-red-500", Quiz: "bg-orange-400", Project: "bg-purple-500",
  Assignment: "bg-blue-500", Reading: "bg-green-500", Other: "bg-gray-400",
};

// ─── Semester Progress Bar ────────────────────────────────────────────────────
function SemesterProgress({ start, end }: { start: string; end: string }) {
  const s = new Date(start), e = new Date(end), now = new Date();
  const pct = Math.min(100, Math.max(0, ((now.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100));
  const daysLeft = Math.max(0, Math.ceil((e.getTime() - now.getTime()) / 86400000));
  const totalWeeks = Math.ceil((e.getTime() - s.getTime()) / (7 * 86400000));
  const currentWeek = Math.min(totalWeeks, Math.ceil((now.getTime() - s.getTime()) / (7 * 86400000)));

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Semester Progress</div>
          <div className="text-sm font-medium text-[#111110]">Week {currentWeek} of {totalWeeks}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-serif text-[#111110]">{Math.round(pct)}%</div>
          <div className="text-[10px] text-[#555]">{daysLeft} days left</div>
        </div>
      </div>
      <div className="h-2 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct > 75 ? "#ef4444" : pct > 50 ? "#f97316" : "#111110" }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-[#555]">{new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <span className="text-[10px] text-[#555]">{new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

// ─── Grade Calculator ─────────────────────────────────────────────────────────
function GradeCalculator({ weights }: { weights: { category: string; weight: number }[] }) {
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(true);

  const weighted = weights.reduce((acc, w) => {
    const g = parseFloat(grades[w.category] ?? "");
    if (!isNaN(g)) acc += (g * w.weight) / 100;
    return acc;
  }, 0);

  const filled = weights.filter(w => grades[w.category] !== undefined && grades[w.category] !== "").length;
  const totalWeight = weights.filter(w => grades[w.category] !== undefined && grades[w.category] !== "")
    .reduce((a, w) => a + w.weight, 0);

  const projected = totalWeight > 0 ? (weighted / totalWeight) * 100 : null;

  const letterGrade = (score: number) => {
    if (score >= 93) return "A";
    if (score >= 90) return "A−";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B−";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C−";
    if (score >= 60) return "D";
    return "F";
  };

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={13} className="text-[#555]" />
          <span className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Grade Calculator</span>
          {projected !== null && (
            <span className="text-[10px] bg-[rgba(0,0,0,0.06)] rounded-full px-2 py-0.5 text-[#555]">
              {projected.toFixed(1)}% · {letterGrade(projected)}
            </span>
          )}
        </div>
        <ChevronDown size={13} className={`text-[#555] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[rgba(0,0,0,0.06)] px-5 pb-5 pt-4">
          <div className="space-y-2 mb-4">
            {weights.map(w => (
              <div key={w.category} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#111110] truncate">{w.category}</div>
                  <div className="text-[10px] text-[#555]">{w.weight}% of grade</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0} max={100}
                    value={grades[w.category] ?? ""}
                    onChange={e => setGrades(g => ({ ...g, [w.category]: e.target.value }))}
                    placeholder="—"
                    className="w-16 text-center text-sm border border-[rgba(0,0,0,0.08)] rounded-lg px-2 py-1.5 outline-none focus:border-[rgba(0,0,0,0.2)] text-[#111110] bg-white"
                  />
                  <span className="text-xs text-[#555]">%</span>
                </div>
                {/* Weight bar */}
                <div className="w-16 h-1.5 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                  <div className="h-1.5 bg-[#111110] rounded-full" style={{ width: `${w.weight}%` }} />
                </div>
              </div>
            ))}
          </div>

          {projected !== null && (
            <div className="border-t border-[rgba(0,0,0,0.06)] pt-3 flex items-center justify-between">
              <div className="text-xs text-[#555]">
                Based on {filled} of {weights.length} categories ({totalWeight}% of grade)
              </div>
              <div className="text-right">
                <div className="text-xl font-serif text-[#111110]">{projected.toFixed(1)}%</div>
                <div className="text-xs text-[#555]">{letterGrade(projected)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Deadlines List ───────────────────────────────────────────────────────────
function DeadlinesList({ schedule }: { schedule: any[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [showAll, setShowAll] = useState(false);

  const upcoming = schedule.filter(s => s.date && new Date(s.date) >= today);
  const past = schedule.filter(s => !s.date || new Date(s.date) < today);
  const displayed = showAll ? upcoming : upcoming.slice(0, 8);

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  };

  const urgencyColor = (days: number) => {
    if (days <= 3) return "text-red-500";
    if (days <= 7) return "text-orange-500";
    return "text-[#555]";
  };

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={13} className="text-[#555]" />
          <span className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">
            Deadlines at a Glance
          </span>
          <span className="text-[9px] bg-[rgba(0,0,0,0.06)] rounded-full px-2 py-0.5 text-[#555]">{upcoming.length} upcoming</span>
        </div>
        {past.length > 0 && (
          <span className="text-[10px] text-[#555]">{past.length} past</span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[#555]">No upcoming deadlines.</div>
      ) : (
        <div className="divide-y divide-[rgba(0,0,0,0.05)]">
          {displayed.map((item, i) => {
            const days = daysUntil(item.date);
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                {/* Importance dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[item.type] ?? "bg-gray-400"}`} />

                {/* Date */}
                <div className="w-16 shrink-0 text-center">
                  <div className="text-xs font-medium text-[#111110]">
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className={`text-[10px] ${urgencyColor(days)}`}>
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#111110] truncate font-medium">{item.title}</div>
                  {item.description && (
                    <div className="text-[10px] text-[#555] truncate mt-0.5">{item.description}</div>
                  )}
                  {item.raw_date_text && (
                    <div className="text-[10px] text-[#aaa] mt-0.5 italic">"{item.raw_date_text}"</div>
                  )}
                </div>

                {/* Type badge */}
                <div className={`text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${TYPE_COLOR[item.type] ?? TYPE_COLOR.Other}`}>
                  {item.type}
                </div>

                {/* Importance */}
                {item.importance_score >= 7 && (
                  <AlertTriangle size={12} className="text-orange-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {upcoming.length > 8 && (
        <div className="px-5 py-3 border-t border-[rgba(0,0,0,0.06)]">
          <button onClick={() => setShowAll(s => !s)} className="text-xs text-[#555] hover:text-[#111110] transition-colors">
            {showAll ? "Show less" : `Show all ${upcoming.length} deadlines`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Weekly Topics Gantt ──────────────────────────────────────────────────────
function WeeklyGantt({ topics, semesterStart, totalWeeks }: { topics: any[]; semesterStart: string; totalWeeks: number }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const start = new Date(semesterStart);
  const currentWeek = Math.ceil((today.getTime() - start.getTime()) / (7 * 86400000));

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-[#555]" />
          <span className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">
            Semester Timeline
          </span>
        </div>
        <ChevronDown size={13} className={`text-[#555] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[rgba(0,0,0,0.06)] px-5 pb-5 pt-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Week header */}
            <div className="flex mb-3">
              <div className="w-32 shrink-0" />
              <div className="flex-1 flex">
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 text-center text-[9px] py-1 rounded-sm ${i + 1 === currentWeek ? "bg-[#111110] text-white" : "text-[#555]"}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            {topics.slice(0, 16).map((t, i) => (
              <div key={i} className="flex items-center mb-1.5">
                <div className="w-32 shrink-0 text-[10px] text-[#555] truncate pr-3">{t.title}</div>
                <div className="flex-1 flex">
                  {Array.from({ length: totalWeeks }, (_, wi) => (
                    <div
                      key={wi}
                      className={`flex-1 h-5 rounded-sm mx-px ${wi + 1 === t.week ? "bg-[#111110]" : wi + 1 < (t.week ?? 0) ? "bg-[rgba(0,0,0,0.04)]" : "bg-[rgba(0,0,0,0.04)]"}`}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Current week indicator */}
            <div className="flex mt-3">
              <div className="w-32 shrink-0 text-[10px] text-[#111110] font-medium">Today →</div>
              <div className="flex-1 flex">
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <div key={i} className={`flex-1 h-0.5 ${i + 1 <= currentWeek ? "bg-[#111110]" : "bg-[rgba(0,0,0,0.06)]"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SyllabusPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data: coursesData } = useSWR(`${BASE}/api/courses`, fetcher);
  const courses: any[] = coursesData?.data ?? [];

  const [file, setFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function parse() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("syllabus", file);
      const course = courses.find((c: any) => c.id === courseId);
      fd.append("courseName", course?.name ?? file.name.replace(/\.[^.]+$/, ""));
      if (semesterStart) fd.append("semesterStartDate", semesterStart);
      const res = await apiFetch("/api/syllabus/parse", { method: "POST", body: fd });
      setResult(res.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to parse syllabus");
    } finally {
      setLoading(false);
    }
  }

  const meta = result?.metadata;
  const schedule: any[] = result?.schedule ?? [];
  const weights: any[] = result?.gradeWeights ?? [];
  const topics: any[] = result?.topics ?? [];
  const effectiveStart = semesterStart || meta?.semesterStart;
  const effectiveEnd = meta?.semesterEnd;
  const totalWeeks = meta?.totalWeeks ?? topics.length ?? 15;

  return (
    <div className="p-8 max-w-4xl">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
        Syllabus
      </div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "white", marginBottom: 6 }}>
        Syllabus Parser
      </h1>
      <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        Upload your syllabus — AI extracts every deadline, resolves "Week X" into real dates, and builds your dashboard.
      </p>

      {!result ? (
        <div className="space-y-4 max-w-lg">
          {courses.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-widest block mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                Course (optional)
              </label>
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none appearance-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
              >
                <option value="">Select a course…</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest block mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              Semester start date <span className="normal-case" style={{ color: "rgba(255,255,255,0.25)" }}>— helps resolve "Week X" dates</span>
            </label>
            <input
              type="date"
              value={semesterStart}
              onChange={e => setSemesterStart(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
            />
          </div>

          <label
            className="flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl p-14 cursor-pointer transition-colors"
            style={{ borderColor: file ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)", color: file ? "white" : "rgba(255,255,255,0.35)" }}
          >
            <FileUp size={28} />
            <div className="text-center">
              <div className="text-sm font-medium">{file ? file.name : "Click to upload your syllabus"}</div>
              {!file && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>PDF files only</div>}
            </div>
            <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={parse}
            disabled={!file || loading}
            className="w-full rounded-2xl py-3 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            style={{ background: "rgba(255,255,255,0.12)", color: "white" }}
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Analysing syllabus…</>
              : "Build My Syllabus Dashboard"}
          </button>
        </div>
      ) : (
        <div>
          {/* Meta header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-white">{meta?.courseName ?? "Your Course"}</h2>
              <div className="flex items-center gap-3 mt-1">
                {meta?.professor && (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Prof. {meta.professor}</span>
                )}
                {meta?.officeHours && (
                  <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <Clock size={10} /> {meta.officeHours}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setResult(null); setFile(null); setError(""); }}
              className="text-xs transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← Upload another
            </button>
          </div>

          {/* Semester Progress */}
          {effectiveStart && effectiveEnd && (
            <SemesterProgress start={effectiveStart} end={effectiveEnd} />
          )}

          {/* Grade Calculator */}
          {weights.length > 0 && <GradeCalculator weights={weights} />}

          {/* Deadlines */}
          {schedule.length > 0 && <DeadlinesList schedule={schedule} />}

          {/* Gantt timeline */}
          {topics.length > 0 && effectiveStart && (
            <WeeklyGantt topics={topics} semesterStart={effectiveStart} totalWeeks={totalWeeks} />
          )}

          {/* Office hours fallback */}
          {meta?.officeHours && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl px-5 py-4 flex items-center gap-3">
              <Clock size={13} className="text-[#555] shrink-0" />
              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-widest mb-0.5">Office Hours</div>
                <div className="text-sm text-[#111110]">{meta.officeHours}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
