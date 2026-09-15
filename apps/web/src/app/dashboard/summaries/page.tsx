"use client";
import useSWR from "swr";
import { useState } from "react";
import { ExternalLink, AlarmClock, Clock, BookOpen, School, CheckSquare, CalendarPlus, Loader2, Check } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApiSWRFetcher } from "@/lib/apiFetch";
import { MathText, FormulaText } from "@/components/MathText";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// Class identity mirrors mobile: solid circle in the class colour, white letter.
const classColor = (c: any) => (c?.color as string) || BRAND;
const classInitial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase() || "?";

function ClassBadge({ name, color, size = 34 }: { name?: string; color?: string | null; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: color || BRAND }}>
      <span style={{ color: "#fff", fontSize: Math.round(size * 0.45), fontWeight: 800, lineHeight: 1 }}>{classInitial(name)}</span>
    </span>
  );
}

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
    <div className="flex items-center gap-1.5" style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.78)" }}>
      <Check size={13} style={{ color: "#16A34A" }} /> Scheduled
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border transition-colors hover:bg-[rgba(0,0,0,0.03)]"
        style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(15,17,21, 0.81)", borderColor: HAIRLINE }}
      >
        <CalendarPlus size={12} /> Schedule
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 rounded-2xl p-4 w-60 border" style={{ background: "#FFFFFF", borderColor: HAIRLINE, boxShadow: "0 16px 48px rgba(15,17,21,0.14)" }}>
          <p className="mb-2.5" style={{ fontSize: 14.5, color: "rgba(15,17,21, 0.78)" }}>Optional: set your exam date</p>
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            className="w-full rounded-xl px-3 py-2 mb-2.5 outline-none border"
            style={{ background: "#FFFFFF", borderColor: HAIRLINE, color: INK, fontSize: 15.5 }}
          />
          {state === "error" && <p className="mb-2" style={{ fontSize: 14.5, color: "#DC2626" }}>Failed — is Google Calendar connected?</p>}
          <button
            onClick={schedule}
            disabled={state === "loading"}
            className="w-full py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: BRAND, color: "white", fontSize: 15.5, fontWeight: 600 }}
          >
            {state === "loading" ? <><Loader2 size={12} className="animate-spin" /> Scheduling…</> : "Schedule review sessions"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SummariesPage() {
  const fetcher = useApiSWRFetcher();
  const { data, isLoading } = useSWR(`${BASE}/api/cheatsheets`, fetcher);
  // Study Book was removed; its old rows have no renderer, so keep them out of the list.
  const sheets = (data?.data ?? []).filter((cs: any) => !cs.title?.startsWith("Study Book:"));

  const label = { fontSize: 13.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(15,17,21, 0.75)", marginBottom: 10 };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>Summaries</div>
      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK, marginBottom: 28 }}>Cheat Sheets</h1>

      {isLoading && <p style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)" }}>Loading…</p>}
      {!isLoading && !sheets.length && (
        <p style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)" }}>No cheat sheets yet. Record a lecture to get started.</p>
      )}

      <div className="flex flex-col gap-4">
        {sheets.map((cs: any) => {
          const course = cs.lecture?.course;
          const tint = classColor(course);
          return (
            <div
              key={cs.id}
              className="rounded-[20px] p-5 border"
              style={{ background: "#FFFFFF", borderColor: HAIRLINE, ...(course ? { borderLeft: `5px solid ${tint}` } : {}) }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {course && <ClassBadge name={course.name} color={tint} size={34} />}
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 17, fontWeight: 700, color: INK }}>{cs.title}</div>
                    {course?.code && (
                      <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.75)", marginTop: 2 }}>{course.code}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cs.lectureId && <ScheduleButton lectureId={cs.lectureId} />}
                  {cs.driveUrl && (
                    <a href={cs.driveUrl} target="_blank" rel="noopener"
                      className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border transition-colors hover:bg-[rgba(0,0,0,0.03)]"
                      style={{ fontSize: 14.5, fontWeight: 600, color: "rgba(15,17,21, 0.81)", borderColor: HAIRLINE }}>
                      <ExternalLink size={12} /> Drive
                    </a>
                  )}
                </div>
              </div>

              {cs.content?.actionItems?.length > 0 && (
                <div className="rounded-[16px] p-4 mb-4 border" style={{ background: "rgba(0,0,0,0.02)", borderColor: HAIRLINE }}>
                  <div className="flex items-center gap-2 mb-3">
                    <AlarmClock size={13} style={{ color: "rgba(15,17,21, 0.82)" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(15,17,21, 0.82)" }}>Action items</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cs.content.actionItems.map((item: any, i: number) => {
                      const Icon = item.type === "exam" ? School : item.type === "deadline" ? Clock : item.type === "reading" ? BookOpen : CheckSquare;
                      return (
                        <div key={i} className="flex items-start gap-2.5" style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.81)" }}>
                          <Icon size={13} className="shrink-0 mt-0.5" style={{ color: "rgba(15,17,21, 0.75)" }} />
                          <span className="min-w-0"><MathText text={item.text} />{item.dueDate ? <span style={{ color: "rgba(15,17,21, 0.75)" }}> — {item.dueDate}</span> : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {cs.content?.sections?.slice(0, 2).map((s: any, i: number) => (
                <div key={i} className="mb-4">
                  <MathText as="div" style={label} text={s.heading} />
                  <div className="flex flex-col gap-1.5">
                    {s.bullets?.slice(0, 3).map((b: string, j: number) => (
                      <div key={j} className="flex gap-2.5" style={{ fontSize: 16, color: "rgba(15,17,21, 0.82)" }}>
                        <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full" style={{ background: tint }} />
                        <MathText className="min-w-0" text={b} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {cs.content?.keyTerms?.length > 0 && (
                <div className="mb-4">
                  <div style={label}>Key Terms</div>
                  <div className="flex flex-col gap-1.5">
                    {cs.content.keyTerms.slice(0, 4).map((kt: any, i: number) => (
                      <div key={i} style={{ fontSize: 16 }}>
                        <MathText style={{ fontWeight: 700, color: INK }} text={kt.term} />
                        <span style={{ color: "rgba(15,17,21, 0.8)" }}> — <MathText text={kt.definition} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cs.content?.formulas?.length > 0 && (
                <div className="mb-4">
                  <div style={label}>Formulas</div>
                  <div className="flex flex-col gap-1.5">
                    {cs.content.formulas.map((f: string, i: number) => (
                      <FormulaText key={i} as="div" className="font-mono" style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.8)" }} text={f} />
                    ))}
                  </div>
                </div>
              )}

              {cs.content?.examTips?.[0] && (
                <div className="rounded-[16px] p-4 mt-2 border" style={{ background: "rgba(0,0,0,0.02)", borderColor: HAIRLINE }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(15,17,21, 0.81)", marginBottom: 6 }}>Exam tip</div>
                  <MathText as="div" className="leading-relaxed" style={{ fontSize: 16, color: "rgba(15,17,21, 0.81)" }} text={cs.content.examTips[0]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
