"use client";
import { useState } from "react";
import {
  FileUp, Loader2, ClipboardList,
  Calendar, Clock, ChevronDown, AlertTriangle, Star,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import useSWR from "swr";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// Class identity mirrors mobile: solid circle in the class colour, white letter.
const classColor = (c: any) => (c?.color as string) || BRAND;
const classInitial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase() || "?";

function ClassBadge({ name, color, size = 32 }: { name?: string; color?: string | null; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: color || BRAND }}>
      <span style={{ color: "#fff", fontSize: Math.round(size * 0.45), fontWeight: 800, lineHeight: 1 }}>{classInitial(name)}</span>
    </span>
  );
}

const TYPE_COLOR: Record<string, string> = {
  Exam:       "#DC2626",
  Quiz:       "#EA580C",
  Project:    "#9333EA",
  Assignment: "#4B5FE8",
  Reading:    "#16A34A",
  Other:      "#6b7280",
};

const cardStyle = { background: "#FFFFFF", border: `1px solid ${HAIRLINE}` };

// ─── Semester Progress Bar ────────────────────────────────────────────────────
function SemesterProgress({ start, end }: { start: string; end: string }) {
  const s = new Date(start), e = new Date(end), now = new Date();
  const pct = Math.min(100, Math.max(0, ((now.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100));
  const daysLeft = Math.max(0, Math.ceil((e.getTime() - now.getTime()) / 86400000));
  const totalWeeks = Math.ceil((e.getTime() - s.getTime()) / (7 * 86400000));
  const currentWeek = Math.min(totalWeeks, Math.ceil((now.getTime() - s.getTime()) / (7 * 86400000)));

  return (
    <div className="rounded-[20px] p-5 mb-5" style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.75)", marginBottom: 4 }}>Semester Progress</div>
          <div style={{ fontSize: 16.5, fontWeight: 600, color: INK }}>Week {currentWeek} of {totalWeeks}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1 }}>{Math.round(pct)}%</div>
          <div style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.75)", marginTop: 4 }}>{daysLeft} days left</div>
        </div>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct > 75 ? "#DC2626" : pct > 50 ? "#EA580C" : BRAND }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <span style={{ fontSize: 14, color: "rgba(15,17,21, 0.75)" }}>{new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        <span style={{ fontSize: 14, color: "rgba(15,17,21, 0.75)" }}>{new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
    <div className="rounded-[20px] overflow-hidden mb-5" style={cardStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-[rgba(0,0,0,0.02)]"
      >
        <div className="flex items-center gap-2.5">
          <Star size={15} style={{ color: BRAND }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.78)" }}>Grade Calculator</span>
          {projected !== null && (
            <span className="rounded-full px-2.5 py-1" style={{ fontSize: 14, fontWeight: 600, background: "rgba(0,0,0,0.04)", color: "rgba(15,17,21, 0.8)" }}>
              {projected.toFixed(1)}% · {letterGrade(projected)}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "rgba(15,17,21, 0.75)" }} />
      </button>

      {open && (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: HAIRLINE }}>
          <div className="flex flex-col gap-3 mb-4">
            {weights.map(w => (
              <div key={w.category} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{w.category}</div>
                  <div style={{ fontSize: 14, color: "rgba(15,17,21, 0.75)", marginTop: 2 }}>{w.weight}% of grade</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0} max={100}
                    value={grades[w.category] ?? ""}
                    onChange={e => setGrades(g => ({ ...g, [w.category]: e.target.value }))}
                    placeholder="—"
                    className="w-16 text-center rounded-xl px-2 py-1.5 outline-none border"
                    style={{ borderColor: HAIRLINE, background: "#FFFFFF", color: INK, fontSize: 16 }}
                  />
                  <span style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.75)" }}>%</span>
                </div>
                {/* Weight bar */}
                <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${w.weight}%`, background: BRAND }} />
                </div>
              </div>
            ))}
          </div>

          {projected !== null && (
            <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: HAIRLINE }}>
              <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.78)" }}>
                Based on {filled} of {weights.length} categories ({totalWeight}% of grade)
              </div>
              <div className="text-right">
                <div style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 }}>{projected.toFixed(1)}%</div>
                <div style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.78)", marginTop: 4 }}>{letterGrade(projected)}</div>
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
    if (days <= 3) return "#DC2626";
    if (days <= 7) return "#EA580C";
    return "rgba(15,17,21,0.6)";
  };

  return (
    <div className="rounded-[20px] overflow-hidden mb-5" style={cardStyle}>
      <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: HAIRLINE }}>
        <div className="flex items-center gap-2.5">
          <ClipboardList size={15} style={{ color: BRAND }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.78)" }}>
            Deadlines at a Glance
          </span>
          <span className="rounded-full px-2.5 py-1" style={{ fontSize: 13.5, fontWeight: 600, background: "rgba(0,0,0,0.04)", color: "rgba(15,17,21, 0.8)" }}>{upcoming.length} upcoming</span>
        </div>
        {past.length > 0 && (
          <span style={{ fontSize: 14, color: "rgba(15,17,21, 0.75)" }}>{past.length} past</span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div className="px-5 py-10 text-center" style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)" }}>No upcoming deadlines.</div>
      ) : (
        <div>
          {displayed.map((item, i) => {
            const days = daysUntil(item.date);
            const tint = TYPE_COLOR[item.type] ?? TYPE_COLOR.Other;
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-t first:border-t-0" style={{ borderColor: HAIRLINE }}>
                {/* Importance dot */}
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tint }} />

                {/* Date */}
                <div className="w-16 shrink-0 text-center">
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: urgencyColor(days), marginTop: 2 }}>
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{item.title}</div>
                  {item.description && (
                    <div className="truncate" style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.76)", marginTop: 3 }}>{item.description}</div>
                  )}
                  {item.raw_date_text && (
                    <div className="italic" style={{ fontSize: 14, color: "rgba(15,17,21, 0.73)", marginTop: 3 }}>&quot;{item.raw_date_text}&quot;</div>
                  )}
                </div>

                {/* Type badge */}
                <div
                  className="shrink-0 rounded-full px-3 py-1.5"
                  style={{ fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", background: tint, color: "#FFFFFF" }}
                >
                  {item.type}
                </div>

                {/* Importance */}
                {item.importance_score >= 7 && (
                  <AlertTriangle size={14} className="shrink-0" style={{ color: "#EA580C" }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {upcoming.length > 8 && (
        <div className="px-5 py-3.5 border-t" style={{ borderColor: HAIRLINE }}>
          <button onClick={() => setShowAll(s => !s)} className="transition-opacity hover:opacity-80" style={{ fontSize: 15.5, fontWeight: 600, color: BRAND }}>
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
    <div className="rounded-[20px] overflow-hidden mb-5" style={cardStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-[rgba(0,0,0,0.02)]"
      >
        <div className="flex items-center gap-2.5">
          <Calendar size={15} style={{ color: BRAND }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.78)" }}>
            Semester Timeline
          </span>
        </div>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "rgba(15,17,21, 0.75)" }} />
      </button>

      {open && (
        <div className="border-t px-5 pb-5 pt-4 overflow-x-auto" style={{ borderColor: HAIRLINE }}>
          <div className="min-w-[620px]">
            {/* Week header */}
            <div className="flex mb-3">
              <div className="w-36 shrink-0" />
              <div className="flex-1 flex">
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 text-center py-1 rounded-md"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      background: i + 1 === currentWeek ? BRAND : "transparent",
                      color: i + 1 === currentWeek ? "#FFFFFF" : "rgba(15,17,21,0.6)",
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            {topics.slice(0, 16).map((t, i) => (
              <div key={i} className="flex items-center mb-1.5">
                <div className="w-36 shrink-0 truncate pr-3" style={{ fontSize: 14, color: "rgba(15,17,21, 0.79)" }}>{t.title}</div>
                <div className="flex-1 flex">
                  {Array.from({ length: totalWeeks }, (_, wi) => (
                    <div
                      key={wi}
                      className="flex-1 h-5 rounded-md mx-px"
                      style={{ background: wi + 1 === t.week ? BRAND : "rgba(0,0,0,0.06)" }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Current week indicator */}
            <div className="flex mt-3">
              <div className="w-36 shrink-0" style={{ fontSize: 14, fontWeight: 700, color: INK }}>Today →</div>
              <div className="flex-1 flex">
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <div key={i} className="flex-1 h-1" style={{ background: i + 1 <= currentWeek ? BRAND : "rgba(0,0,0,0.06)" }} />
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

  const selectedCourse = courses.find((c: any) => c.id === courseId) ?? null;

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
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>
        Syllabus
      </div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK, marginBottom: 8 }}>
        Syllabus Parser
      </h1>
      <p className="mb-8" style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)", maxWidth: 620 }}>
        Upload your syllabus — AI extracts every deadline, resolves &quot;Week X&quot; into real dates, and builds your dashboard.
      </p>

      {!result ? (
        <div className="flex flex-col gap-5" style={{ maxWidth: 560 }}>
          {courses.length > 0 && (
            <div>
              <label className="block mb-2.5" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.75)" }}>
                Class <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "rgba(15,17,21, 0.73)" }}>— optional</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {courses.map((c: any) => {
                  const tint = classColor(c);
                  const on = courseId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCourseId(on ? "" : c.id)}
                      className="flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 transition-colors"
                      style={{
                        background: "#FFFFFF",
                        border: on ? `2px solid ${tint}` : `1px solid ${HAIRLINE}`,
                        paddingLeft: on ? 5 : 6,
                      }}
                    >
                      <ClassBadge name={c.name} color={tint} size={28} />
                      <span style={{ fontSize: 16, fontWeight: on ? 700 : 500, color: INK }}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block mb-2.5" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.75)" }}>
              Semester start date <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "rgba(15,17,21, 0.73)" }}>— helps resolve &quot;Week X&quot; dates</span>
            </label>
            <input
              type="date"
              value={semesterStart}
              onChange={e => setSemesterStart(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 outline-none"
              style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, color: INK, fontSize: 16 }}
            />
          </div>

          <label
            className="flex flex-col items-center gap-4 border-2 border-dashed rounded-[20px] p-14 cursor-pointer transition-colors"
            style={{ borderColor: file ? BRAND : HAIRLINE, color: file ? BRAND : "rgba(15,17,21,0.6)", background: "#FFFFFF" }}
          >
            <FileUp size={30} />
            <div className="text-center">
              <div style={{ fontSize: 16.5, fontWeight: 600 }}>{file ? file.name : "Click to upload your syllabus"}</div>
              {!file && <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.75)", marginTop: 6 }}>PDF files only</div>}
            </div>
            <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {error && <p style={{ fontSize: 15.5, color: "#DC2626" }}>{error}</p>}

          <button
            onClick={parse}
            disabled={!file || loading}
            className="w-full rounded-2xl py-3.5 disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: selectedCourse ? classColor(selectedCourse) : BRAND, color: "#FFFFFF", fontSize: 17, fontWeight: 700 }}
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Analysing syllabus…</>
              : "Build My Syllabus Dashboard"}
          </button>
        </div>
      ) : (
        <div>
          {/* Meta header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <ClassBadge
                name={selectedCourse?.name ?? meta?.courseName}
                color={selectedCourse ? classColor(selectedCourse) : BRAND}
                size={40}
              />
              <div className="min-w-0">
                <h2 className="truncate" style={{ fontSize: 20, fontWeight: 700, color: INK }}>{meta?.courseName ?? "Your Course"}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {meta?.professor && (
                    <span style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.78)" }}>Prof. {meta.professor}</span>
                  )}
                  {meta?.officeHours && (
                    <span className="flex items-center gap-1.5" style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.78)" }}>
                      <Clock size={12} /> {meta.officeHours}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setResult(null); setFile(null); setError(""); }}
              className="transition-opacity hover:opacity-80"
              style={{ fontSize: 15.5, fontWeight: 600, color: BRAND }}
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
            <div className="rounded-[20px] px-5 py-4 flex items-center gap-3" style={cardStyle}>
              <Clock size={15} className="shrink-0" style={{ color: BRAND }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.75)", marginBottom: 4 }}>Office Hours</div>
                <div style={{ fontSize: 16, color: INK }}>{meta.officeHours}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
