"use client";
import { useState } from "react";
import useSWR from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";
import { format } from "date-fns";
import { Pencil, Check, X, ChevronDown, ChevronRight } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 group" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex-1 min-w-0 mr-3">
        {editing ? (
          <input
            autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-lg px-2 py-1 text-sm outline-none border"
            style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
          />
        ) : (
          <div className="text-sm truncate" style={{ color: "white" }}>{lecture.title}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.35)" }}>{lecture.status}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{format(new Date(lecture.recordedAt), "MMM d, yyyy")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} disabled={saving} className="p-1.5 transition-colors" style={{ color: "white" }}><Check size={13} /></button>
            <button onClick={() => { setEditing(false); setVal(lecture.title); }} className="p-1.5 transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}><X size={13} /></button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-all" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function ClassSection({ cls, onRename }: { cls: any; onRename: (id: string, title: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden mb-3 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)" }} /> : <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.4)" }} />}
          <span className="text-sm font-medium" style={{ color: "white" }}>{cls.name}</span>
          <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>{cls.lectures.length}</span>
        </div>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{cls.code}</span>
      </button>
      {open && (
        <div className="px-5 pb-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {cls.lectures.length === 0
            ? <p className="text-xs py-3" style={{ color: "rgba(255,255,255,0.35)" }}>No recordings yet.</p>
            : cls.lectures.map((l: any) => <LectureRow key={l.id} lecture={l} onRename={onRename} />)
          }
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading, mutate } = useSWR(`${BASE}/api/progress`, fetcher);
  const p = data?.data;

  async function handleRename(id: string, title: string) {
    await apiFetch(`/api/lectures/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    await mutate();
  }

  return (
    <div className="p-8 max-w-2xl">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Analytics</div>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 30, fontWeight: 400, color: "white", marginBottom: 28 }}>Progress</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Lectures recorded", value: p?.lectureCount ?? "—" },
          { label: "Avg quiz score",    value: p?.avgScore ? `${p.avgScore}%` : "—" },
          { label: "Day streak",        value: p?.streak ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="font-serif text-4xl mb-1" style={{ color: "white" }}>{isLoading ? "—" : s.value}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>Recordings by class</p>
      {isLoading && <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>}
      {!isLoading && !p?.lecturesByClass?.length && (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No classes yet. Create one in the Workspace.</p>
      )}
      {p?.lecturesByClass?.map((cls: any) => (
        <ClassSection key={cls.id} cls={cls} onRename={handleRename} />
      ))}

      {p?.courseRetention?.length > 0 && (
        <div className="rounded-2xl p-6 mt-6 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.3)" }}>Retention by course</p>
          <div className="space-y-4">
            {p.courseRetention.map((c: any) => (
              <div key={c.code}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{c.code} — {c.name}</span>
                  <span className="text-xs" style={{ color: "white" }}>{c.avg}%</span>
                </div>
                <div className="h-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-0.5 rounded" style={{ width: `${c.avg}%`, background: "rgba(255,255,255,0.5)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
