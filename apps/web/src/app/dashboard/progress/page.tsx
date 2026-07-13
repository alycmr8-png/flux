"use client";
import { useState } from "react";
import useSWR from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";
import { format } from "date-fns";
import { Pencil, Check, X, ChevronDown, ChevronRight, Flame, BookOpen, Mic2, TrendingUp } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Circular progress ring ────────────────────────────────────────────────────
function RingChart({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);
  const color = value >= 70 ? "#22c55e" : value >= 50 ? "#f97316" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{value}%</span>
      </div>
    </div>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────────────────────
function RetentionBar({ name, code, avg }: { name: string; code: string; avg: number }) {
  const color = avg >= 70 ? "#22c55e" : avg >= 50 ? "#f97316" : "#ef4444";
  const bg    = avg >= 70 ? "rgba(34,197,94,0.12)" : avg >= 50 ? "rgba(249,115,22,0.12)" : "rgba(239,68,68,0.12)";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: bg, color }}>{code}</span>
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{name}</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{avg}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
        <div className="h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${avg}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
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
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 group" style={{ borderColor: "rgba(255,255,255,0.09)" }}>
      <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.12)" }}>
          <Mic2 size={11} style={{ color: "rgba(255,255,255,0.52)" }} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input autoFocus value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              className="w-full rounded-lg px-2 py-1 text-sm outline-none border"
              style={{ background: "rgba(255,255,255,0.11)", borderColor: "rgba(255,255,255,0.18)", color: "white" }} />
          ) : (
            <div className="text-sm truncate" style={{ color: "white" }}>{lecture.title}</div>
          )}
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
            {format(new Date(lecture.recordedAt), "MMM d, yyyy")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} disabled={saving} className="p-1.5" style={{ color: "#22c55e" }}><Check size={13} /></button>
            <button onClick={() => { setEditing(false); setVal(lecture.title); }} className="p-1.5" style={{ color: "rgba(255,255,255,0.52)" }}><X size={13} /></button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-all" style={{ color: "rgba(255,255,255,0.42)" }}>
            <Pencil size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Class accordion ───────────────────────────────────────────────────────────
function ClassSection({ cls, onRename }: { cls: any; onRename: (id: string, title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const count = cls.lectures.length;

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.52)" }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.52)" }} />}
          <span className="text-sm font-medium" style={{ color: "white" }}>{cls.name}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(75,95,232,0.15)", color: "#93A0F8" }}>
            {count} {count === 1 ? "lecture" : "lectures"}
          </span>
        </div>
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.38)" }}>{cls.code}</span>
      </button>
      {open && (
        <div className="px-5 pb-3 border-t" style={{ borderColor: "rgba(255,255,255,0.09)" }}>
          {count === 0
            ? <p className="text-xs py-3" style={{ color: "rgba(255,255,255,0.42)" }}>No recordings yet.</p>
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
    <div style={{ color: "white", maxWidth: 780 }}>
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 6 }}>Analytics</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "white" }}>Progress</h1>
      </div>

      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

        {/* Lectures recorded */}
        <div className="rounded-2xl p-5 flex items-center gap-4 border" style={{ background: "rgba(75,95,232,0.1)", borderColor: "rgba(75,95,232,0.25)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(75,95,232,0.2)" }}>
            <Mic2 size={20} style={{ color: "#93A0F8" }} />
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "white", lineHeight: 1 }}>{isLoading ? "—" : lectures}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 3 }}>Lectures recorded</div>
          </div>
        </div>

        {/* Quiz average — ring chart */}
        <div className="rounded-2xl p-5 flex items-center gap-4 border" style={{
          background: avgScore >= 70 ? "rgba(34,197,94,0.08)" : avgScore >= 50 ? "rgba(249,115,22,0.08)" : "rgba(239,68,68,0.08)",
          borderColor: avgScore >= 70 ? "rgba(34,197,94,0.25)" : avgScore >= 50 ? "rgba(249,115,22,0.25)" : "rgba(239,68,68,0.25)",
        }}>
          {isLoading ? (
            <div className="w-24 h-24 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.14)" }} />
          ) : (
            <RingChart value={avgScore} />
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>Avg Quiz Score</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", marginTop: 3 }}>
              {avgScore >= 70 ? "Great work!" : avgScore >= 50 ? "Keep studying" : "Needs attention"}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={11} style={{ color: avgScore >= 70 ? "#22c55e" : "#f97316" }} />
              <span style={{ fontSize: 10, color: avgScore >= 70 ? "#22c55e" : "#f97316" }}>
                {avgScore >= 70 ? "Above average" : "Below average"}
              </span>
            </div>
          </div>
        </div>

        {/* Streak */}
        <div className="rounded-2xl p-5 flex items-center gap-4 border" style={{ background: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.25)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(249,115,22,0.15)" }}>
            🔥
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "white", lineHeight: 1 }}>{isLoading ? "—" : streak}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 3 }}>Day streak</div>
            {streak >= 3 && <div style={{ fontSize: 10, color: "#f97316", marginTop: 4 }}>🔥 On fire!</div>}
          </div>
        </div>
      </div>

      {/* ── Retention chart ── */}
      {retention.length > 0 && (
        <div className="rounded-2xl p-6 mb-6 border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen size={14} style={{ color: "#6E7FF3" }} />
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.52)" }}>
              Quiz retention by course
            </p>
          </div>
          <div className="space-y-5">
            {retention.map((c: any) => (
              <RetentionBar key={c.code} name={c.name} code={c.code} avg={c.avg} />
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 mt-6 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.11)" }}>
            {[{ label: "Strong (≥70%)", color: "#22c55e" }, { label: "Average (50–70%)", color: "#f97316" }, { label: "Needs work (<50%)", color: "#ef4444" }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.48)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recordings by class ── */}
      <div className="mb-2 flex items-center gap-2">
        <Mic2 size={13} style={{ color: "rgba(255,255,255,0.42)" }} />
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>
          Recordings by class
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl h-14 animate-pulse border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }} />
          ))}
        </div>
      )}

      {!isLoading && !p?.lecturesByClass?.length && (
        <div className="rounded-2xl p-8 text-center border" style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }}>
          <Mic2 size={28} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.48)" }}>No classes yet. Create one in the Workspace.</p>
        </div>
      )}

      <div className="space-y-2">
        {p?.lecturesByClass?.map((cls: any) => (
          <ClassSection key={cls.id} cls={cls} onRename={handleRename} />
        ))}
      </div>
    </div>
  );
}
