"use client";
import { useState } from "react";
import useSWR from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";
import { format } from "date-fns";
import { Pencil, Check, X, ChevronDown, ChevronRight, BookOpen, Mic2, TrendingUp } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// Class identity mirrors mobile: a solid circle in the class colour with the
// first letter in white — never white text on a pale tint.
const classInitial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase() || "?";

function ClassBadge({ name, color, size = 34 }: { name?: string; color?: string | null; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: color || BRAND }}>
      <span style={{ color: "#fff", fontSize: Math.round(size * 0.45), fontWeight: 800, lineHeight: 1 }}>{classInitial(name)}</span>
    </span>
  );
}

// ── Circular progress ring ────────────────────────────────────────────────────
function RingChart({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  const color = value >= 70 ? "#16A34A" : value >= 50 ? "#EA580C" : "#DC2626";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span style={{ fontSize: 23, fontWeight: 800, color: INK, lineHeight: 1 }}>{value}%</span>
      </div>
    </div>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────────────────────
function RetentionBar({ name, code, avg, tint }: { name: string; code: string; avg: number; tint: string }) {
  const color = avg >= 70 ? "#16A34A" : avg >= 50 ? "#EA580C" : "#DC2626";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ClassBadge name={name} color={tint} size={28} />
          <span className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{name}</span>
          <span className="shrink-0" style={{ fontSize: 14, fontWeight: 600, color: "rgba(15,17,21, 0.75)" }}>{code}</span>
        </div>
        <span className="tabular-nums shrink-0" style={{ fontSize: 16, fontWeight: 800, color }}>{avg}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
        <div className="h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${avg}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Lecture row ───────────────────────────────────────────────────────────────
function LectureRow({ lecture, onRename }: { lecture: any; onRename: (id: string, title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(lecture.title);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!val.trim() || val === lecture.title) { setEditing(false); return; }
    setSaving(true);
    await onRename(lecture.id, val.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 group" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
      <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.04)" }}>
          <Mic2 size={13} style={{ color: "rgba(15,17,21, 0.75)" }} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input autoFocus value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              className="w-full rounded-xl px-3 py-1.5 outline-none border"
              style={{ background: "#FFFFFF", borderColor: HAIRLINE, color: INK, fontSize: 16 }} />
          ) : (
            <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{lecture.title}</div>
          )}
          <div style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.75)", marginTop: 2 }}>
            {format(new Date(lecture.recordedAt), "MMM d, yyyy")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} disabled={saving} className="p-1.5" style={{ color: "#16A34A" }}><Check size={15} /></button>
            <button onClick={() => { setEditing(false); setVal(lecture.title); }} className="p-1.5" style={{ color: "rgba(15,17,21, 0.75)" }}><X size={15} /></button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "rgba(15,17,21, 0.75)" }}>
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Class accordion ───────────────────────────────────────────────────────────
function ClassSection({ cls, tint, onRename }: { cls: any; tint: string; onRename: (id: string, title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const count = cls.lectures.length;

  return (
    <div
      className="rounded-[20px] overflow-hidden"
      style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}`, borderLeft: `5px solid ${tint}` }}
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown size={16} style={{ color: "rgba(15,17,21, 0.75)" }} /> : <ChevronRight size={16} style={{ color: "rgba(15,17,21, 0.75)" }} />}
          <ClassBadge name={cls.name} color={tint} size={32} />
          <span className="truncate" style={{ fontSize: 16.5, fontWeight: 600, color: INK }}>{cls.name}</span>
          <span
            className="shrink-0 rounded-full px-2.5 py-1"
            style={{ fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(0,0,0,0.04)", color: "rgba(15,17,21, 0.8)" }}
          >
            {count} {count === 1 ? "lecture" : "lectures"}
          </span>
        </div>
        <span className="shrink-0 font-mono" style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.75)" }}>{cls.code}</span>
      </button>
      {open && (
        <div className="px-5 pb-3 border-t" style={{ borderColor: HAIRLINE }}>
          {count === 0
            ? <p className="py-4" style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.75)" }}>No recordings yet.</p>
            : cls.lectures.map((l: any) => <LectureRow key={l.id} lecture={l} onRename={onRename} />)
          }
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading, mutate } = useSWR(`${BASE}/api/progress`, fetcher);
  // /api/progress doesn't carry the class colour, so it's looked up from the
  // courses list — the same colour the Workspace and Home pages use.
  const { data: coursesData } = useSWR(`${BASE}/api/courses`, fetcher, { revalidateOnFocus: false });
  const courses: any[] = coursesData?.data ?? [];
  const colorById: Record<string, string> = {};
  const colorByCode: Record<string, string> = {};
  for (const c of courses) {
    const tint = (c.color as string) || BRAND;
    colorById[c.id] = tint;
    if (c.code) colorByCode[c.code] = tint;
  }

  const p = data?.data;

  async function handleRename(id: string, title: string) {
    await apiFetch(`/api/lectures/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    await mutate();
  }

  const avgScore   = p?.avgScore ?? 0;
  const streak     = p?.streak ?? 0;
  const lectures   = p?.lectureCount ?? 0;
  const retention: any[] = p?.courseRetention ?? [];

  return (
    <div style={{ color: INK, maxWidth: 860 }}>
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>Analytics</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK }}>Progress</h1>
      </div>

      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Lectures recorded */}
        <div className="rounded-[20px] p-5 flex items-center gap-4" style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND }}>
            <Mic2 size={22} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: INK, lineHeight: 1 }}>{isLoading ? "—" : lectures}</div>
            <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.78)", marginTop: 5 }}>Lectures recorded</div>
          </div>
        </div>

        {/* Quiz average — ring chart */}
        <div className="rounded-[20px] p-5 flex items-center gap-4" style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}>
          {isLoading ? (
            <div className="w-24 h-24 rounded-full animate-pulse" style={{ background: "rgba(0,0,0,0.05)" }} />
          ) : (
            <RingChart value={avgScore} />
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Avg Quiz Score</div>
            <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.78)", marginTop: 4 }}>
              {avgScore >= 70 ? "Great work!" : avgScore >= 50 ? "Keep studying" : "Needs attention"}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp size={13} style={{ color: avgScore >= 70 ? "#16A34A" : "#EA580C" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: avgScore >= 70 ? "#16A34A" : "#EA580C" }}>
                {avgScore >= 70 ? "Above average" : "Below average"}
              </span>
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="rounded-[20px] p-5 flex items-center gap-4" style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(234,88,12,0.12)" }}>
            🔥
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: INK, lineHeight: 1 }}>{isLoading ? "—" : streak}</div>
            <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.78)", marginTop: 5 }}>Day streak</div>
            {streak >= 3 && <div style={{ fontSize: 14, fontWeight: 600, color: "#EA580C", marginTop: 5 }}>🔥 On fire!</div>}
          </div>
        </div>
      </div>

      {/* ── Retention chart ── */}
      {retention.length > 0 && (
        <div className="rounded-[20px] p-6 mb-6" style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen size={15} style={{ color: BRAND }} />
            <p style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.78)" }}>
              Quiz retention by course
            </p>
          </div>
          <div className="flex flex-col gap-5">
            {retention.map((c: any) => (
              <RetentionBar key={c.code} name={c.name} code={c.code} avg={c.avg} tint={colorByCode[c.code] ?? BRAND} />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 mt-6 pt-4 border-t" style={{ borderColor: HAIRLINE }}>
            {[{ label: "Strong (≥70%)", color: "#16A34A" }, { label: "Average (50–70%)", color: "#EA580C" }, { label: "Needs work (<50%)", color: "#DC2626" }].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <span style={{ fontSize: 14, color: "rgba(15,17,21, 0.78)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recordings by class ── */}
      <div className="mb-3 flex items-center gap-2">
        <Mic2 size={15} style={{ color: BRAND }} />
        <p style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,17,21, 0.78)" }}>
          Recordings by class
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[20px] h-16 animate-pulse" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${HAIRLINE}` }} />
          ))}
        </div>
      )}

      {!isLoading && !p?.lecturesByClass?.length && (
        <div className="rounded-[20px] p-10 text-center" style={{ background: "#FFFFFF", border: `1px dashed ${HAIRLINE}` }}>
          <Mic2 size={30} className="mx-auto mb-3" style={{ color: "rgba(15,17,21, 0.55)" }} />
          <p style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)" }}>No classes yet. Create one in the Workspace.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {p?.lecturesByClass?.map((cls: any) => (
          <ClassSection key={cls.id} cls={cls} tint={colorById[cls.id] ?? BRAND} onRename={handleRename} />
        ))}
      </div>
    </div>
  );
}
