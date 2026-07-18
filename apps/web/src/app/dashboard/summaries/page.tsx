"use client";
import useSWR from "swr";
import { useState } from "react";
import { ExternalLink, AlarmClock, Clock, BookOpen, School, CheckSquare, CalendarPlus, Loader2, Check } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function ScheduleButton({ lectureId }: { lectureId: string }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [examDate, setExamDate] = useState("");
  const [open, setOpen] = useState(false);

  async function schedule() {
    const token = await getToken();
    if (!token) return;
    setState("loading");
    try {
      const res = await fetch(`${BASE}/api/calendar/schedule/${lectureId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ examDate: examDate || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("done");
      setOpen(false);
    } catch {
      setState("error");
    }
  }

  if (state === "done") return (
    <div className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(31,35,40,0.6)" }}>
      <Check size={10} className="text-green-600" /> Scheduled
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors"
        style={{ color: "rgba(31,35,40,0.7)", borderColor: "rgba(0,0,0,0.08)" }}
      >
        <CalendarPlus size={10} /> Schedule
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 rounded-xl p-3 w-52 border" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)", boxShadow: "0 16px 48px rgba(0,0,0,0.14)" }}>
          <p className="text-[10px] mb-2" style={{ color: "rgba(31,35,40,0.6)" }}>Optional: set your exam date</p>
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-xs mb-2 outline-none border"
            style={{ background: "rgba(0,0,0,0.05)", borderColor: "rgba(0,0,0,0.07)", color: "#1F2328" }}
          />
          {state === "error" && <p className="text-[10px] text-red-600 mb-2">Failed — is Google Calendar connected?</p>}
          <button
            onClick={schedule}
            disabled={state === "loading"}
            className="w-full text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            style={{ background: "#4B5FE8", color: "white" }}
          >
            {state === "loading" ? <><Loader2 size={10} className="animate-spin" /> Scheduling…</> : "Schedule review sessions"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SummariesPage() {
  const fetcher = useApiSWRFetcher();
  const { data, isLoading } = useSWR(`${BASE}/api/cheatsheets`, fetcher);
  const sheets = data?.data?.filter((cs: any) => !cs.title?.startsWith("Study Book:")) ?? [];

  return (
    <div className="p-8 max-w-2xl">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(31,35,40,0.5)", marginBottom: 6 }}>Summaries</div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#1F2328", marginBottom: 28 }}>Cheat Sheets</h1>

      {isLoading && <p className="text-sm" style={{ color: "rgba(31,35,40,0.6)" }}>Loading…</p>}
      {!isLoading && !sheets.length && (
        <p className="text-sm" style={{ color: "rgba(31,35,40,0.6)" }}>No cheat sheets yet. Record a lecture to get started.</p>
      )}

      <div className="space-y-4">
        {sheets.map((cs: any) => (
          <div key={cs.id} className="rounded-2xl p-5 border" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-medium text-sm" style={{ color: "#1F2328" }}>{cs.title}</div>
                {cs.lecture?.course?.code && (
                  <div className="text-xs mt-0.5" style={{ color: "rgba(31,35,40,0.55)" }}>{cs.lecture.course.code}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cs.lectureId && <ScheduleButton lectureId={cs.lectureId} />}
                {cs.driveUrl && (
                  <a href={cs.driveUrl} target="_blank" rel="noopener"
                    className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors"
                    style={{ color: "rgba(31,35,40,0.7)", borderColor: "rgba(0,0,0,0.08)" }}>
                    <ExternalLink size={10} /> Drive
                  </a>
                )}
              </div>
            </div>

            {cs.content?.actionItems?.length > 0 && (
              <div className="rounded-xl p-3 mb-4 border" style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.05)" }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <AlarmClock size={10} style={{ color: "rgba(31,35,40,0.8)" }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(31,35,40,0.8)" }}>Action items</span>
                </div>
                <div className="space-y-1.5">
                  {cs.content.actionItems.map((item: any, i: number) => {
                    const Icon = item.type === "exam" ? School : item.type === "deadline" ? Clock : item.type === "reading" ? BookOpen : CheckSquare;
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "rgba(31,35,40,0.66)" }}>
                        <Icon size={11} className="shrink-0 mt-0.5" style={{ color: "rgba(31,35,40,0.55)" }} />
                        <span>{item.text}{item.dueDate ? <span style={{ color: "rgba(31,35,40,0.55)" }}> — {item.dueDate}</span> : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cs.content?.sections?.slice(0, 2).map((s: any, i: number) => (
              <div key={i} className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(31,35,40,0.55)" }}>{s.heading}</div>
                <div className="space-y-1">
                  {s.bullets?.slice(0, 3).map((b: string, j: number) => (
                    <div key={j} className="flex gap-2 text-xs" style={{ color: "rgba(31,35,40,0.7)" }}>
                      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full" style={{ background: "rgba(31,35,40,0.3)" }} />
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {cs.content?.keyTerms?.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(31,35,40,0.55)" }}>Key Terms</div>
                <div className="space-y-1">
                  {cs.content.keyTerms.slice(0, 4).map((kt: any, i: number) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium" style={{ color: "#1F2328" }}>{kt.term}</span>
                      <span style={{ color: "rgba(31,35,40,0.66)" }}> — {kt.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cs.content?.formulas?.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(31,35,40,0.55)" }}>Formulas</div>
                <div className="space-y-1">
                  {cs.content.formulas.map((f: string, i: number) => (
                    <div key={i} className="text-xs font-mono" style={{ color: "rgba(31,35,40,0.6)" }}>{f}</div>
                  ))}
                </div>
              </div>
            )}

            {cs.content?.examTips?.[0] && (
              <div className="rounded-xl p-3 mt-2 border" style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.05)" }}>
                <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(31,35,40,0.7)" }}>Exam tip</div>
                <div className="text-xs leading-relaxed" style={{ color: "rgba(31,35,40,0.66)" }}>{cs.content.examTips[0]}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
