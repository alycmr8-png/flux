"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useApiSWRFetcher } from "@/lib/apiFetch";
import { Mic, FileText, BookOpen, Calendar, ChevronRight, Plus, Clock, Layers } from "lucide-react";
import { startOfDay, format, differenceInCalendarDays } from "date-fns";

const TYPE_COLOR: Record<string, string> = {
  exam:       "#ef4444",
  assignment: "#f97316",
  deadline:   "#eab308",
  quiz:       "#a855f7",
  class:      "#3b82f6",
  other:      "#6b7280",
};

const TYPE_LABEL: Record<string, string> = {
  exam: "Exam", assignment: "Assignment", deadline: "Deadline",
  quiz: "Quiz", class: "Class", other: "Other",
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACTIONS = [
  { icon: Mic,      label: "Record",    href: "/dashboard/record",    color: "#3b82f6" },
  { icon: FileText, label: "Summaries", href: "/dashboard/summaries", color: "#22c55e" },
  { icon: BookOpen, label: "Quizzes",   href: "/dashboard/quizzes",   color: "#a855f7" },
  { icon: Calendar, label: "Calendar",  href: "/dashboard/calendar",  color: "#f97316" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHome() {
  const fetcher = useApiSWRFetcher();
  const { data: progressData, isLoading } = useSWR(`${BASE}/api/progress`, fetcher);
  const { data: sheetsData } = useSWR(`${BASE}/api/cheatsheets`, fetcher);
  // Stable date range — must not be computed inline or the SWR key changes every render
  const [eventsFrom] = useState(() => startOfDay(new Date()).toISOString());
  const [eventsTo] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

  const { data: eventsData, isLoading: eventsLoading } = useSWR(
    `${BASE}/api/events?from=${eventsFrom}&to=${eventsTo}`,
    fetcher
  );

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const p = progressData?.data;
  const notes = sheetsData?.data?.slice(0, 3) ?? [];

  const today = startOfDay(new Date());

  const allUpcoming: any[] = (eventsData?.data ?? [])
    .filter((e: any) => startOfDay(new Date(e.date)) >= today)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const filtered = activeFilter === "all"
    ? allUpcoming
    : allUpcoming.filter((e: any) => e.type === activeFilter);

  const displayedEvents = filtered.slice(0, 8);

  const eventTypes = ["all", ...Array.from(new Set(allUpcoming.map((e: any) => e.type as string)))];

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    const diff = differenceInCalendarDays(d, today);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff <= 7) return `In ${diff} days`;
    return format(d, "MMM d");
  }

  function urgencyStyle(dateStr: string) {
    const diff = differenceInCalendarDays(new Date(dateStr), today);
    if (diff === 0) return { glow: "rgba(239,68,68,0.15)", pulse: true };
    if (diff <= 2) return { glow: "rgba(249,115,22,0.1)", pulse: false };
    return { glow: "transparent", pulse: false };
  }

  return (
    <div className="flex gap-8 h-full">

      {/* LEFT — main content */}
      <div className="flex-1 min-w-0 py-9 pl-10 pr-0">

        {/* Header */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 6 }}>Overview</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "white", marginBottom: 28 }}>
          {greeting()}.
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Lectures recorded", value: isLoading ? "..." : (p?.lectureCount ?? "0") },
            { label: "Avg quiz score",    value: isLoading ? "..." : (p?.avgScore ? `${p.avgScore}%` : "—") },
            { label: "Day streak",        value: isLoading ? "..." : (p?.streak ?? "0") },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 border transition-all duration-200 cursor-default"
              style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.2)" }}
            >
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 700, color: "#60a5fa", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Coming up */}
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>Coming up</p>
        <div className="flex flex-col gap-2 mb-8">
          {eventsLoading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl px-4 py-3 border animate-pulse" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", height: 58 }} />
            ))
          ) : allUpcoming.length === 0 ? (
            <Link href="/dashboard/calendar"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all hover:border-white/20 hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", borderStyle: "dashed" }}>
              <Plus size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No upcoming events — add one in Calendar</span>
            </Link>
          ) : (
            <>
              {allUpcoming.slice(0, 3).map((e: any) => {
                const diff = differenceInCalendarDays(new Date(e.date), today);
                const color = TYPE_COLOR[e.type] ?? "#6b7280";
                const cdLabel = diff === 0 ? "Today!" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
                const cdColor = diff === 0 ? "#ef4444" : diff <= 1 ? "#f97316" : diff <= 3 ? "#eab308" : "rgba(255,255,255,0.35)";
                return (
                  <Link key={e.id} href="/dashboard/calendar"
                    className="flex items-center gap-4 rounded-2xl px-4 py-3 border transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                    style={{ background: diff === 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)", borderColor: diff === 0 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)", borderLeft: `3px solid ${color}` }}
                  >
                    <div style={{ minWidth: 38, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: "white" }}>{format(new Date(e.date), "d")}</div>
                      <div style={{ fontSize: 9, textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{format(new Date(e.date), "MMM")}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "white" }}>{e.title}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {TYPE_LABEL[e.type]}{e.course?.code ? ` · ${e.course.code}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full" style={{ background: `${cdColor}18` }}>
                      <Clock size={9} style={{ color: cdColor }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: cdColor }}>{cdLabel}</span>
                    </div>
                  </Link>
                );
              })}
              {allUpcoming.length > 3 && (
                <Link href="/dashboard/calendar" className="text-xs text-center py-1 transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.3)" }}>
                  +{allUpcoming.length - 3} more events →
                </Link>
              )}
            </>
          )}
        </div>

        {/* My classes */}
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>My classes</p>
        <div className="space-y-2 mb-8">
          {isLoading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl px-5 py-4 border animate-pulse" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)", height: 64 }} />
            ))
          ) : (p?.lecturesByClass ?? []).length === 0 ? (
            <Link href="/dashboard/record"
              className="flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all hover:border-white/20 hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", borderStyle: "dashed" }}>
              <Plus size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Add your first class</span>
            </Link>
          ) : (
            (p.lecturesByClass as any[]).map((cls: any) => {
              const retention = (p.courseRetention as any[])?.find((r: any) => r.name === cls.name);
              const count = cls.lectures.length;
              const lastLecture = cls.lectures[0];
              const lastDate = lastLecture?.recordedAt
                ? differenceInCalendarDays(today, new Date(lastLecture.recordedAt)) === 0
                  ? "today"
                  : `${differenceInCalendarDays(today, new Date(lastLecture.recordedAt))}d ago`
                : null;
              const totalSecs: number = cls.lectures.reduce((acc: number, l: any) => acc + (l.durationSeconds ?? 0), 0);
              const hours = Math.floor(totalSecs / 3600);
              const mins = Math.floor((totalSecs % 3600) / 60);
              const studyTime = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m` : null;

              return (
                <Link key={cls.id} href="/dashboard/record"
                  className="flex items-center gap-4 rounded-2xl px-5 py-4 border transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Layers size={15} style={{ color: "rgba(255,255,255,0.45)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "white" }}>{cls.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {count} lecture{count !== 1 ? "s" : ""}
                      </span>
                      {studyTime && (
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>· {studyTime} recorded</span>
                      )}
                      {lastDate && (
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>· Last activity {lastDate}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {retention ? (
                      <div className="text-right">
                        <div className="text-sm font-semibold" style={{ color: retention.avg >= 70 ? "#22c55e" : retention.avg >= 50 ? "#f97316" : "#ef4444" }}>
                          {retention.avg}%
                        </div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>quiz avg</div>
                      </div>
                    ) : count === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>empty</span>
                    ) : null}
                    <ChevronRight size={13} style={{ color: "rgba(255,255,255,0.2)" }} />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Quick actions */}
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>Quick actions</p>
        <div className="grid grid-cols-4 gap-3 mb-8">
          {ACTIONS.map(({ icon: Icon, label, href, color }) => (
            <Link
              key={label}
              href={href}
              className="rounded-2xl p-4 flex flex-col items-center gap-2 border transition-all duration-200 hover:scale-105 hover:border-white/20"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
            </Link>
          ))}
        </div>

        {/* Saved notes */}
        {notes.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3b82f6" }}>Saved notes</p>
            <div className="space-y-2">
              {notes.map((cs: any) => (
                <Link
                  key={cs.id}
                  href="/dashboard/summaries"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-200 hover:border-white/20 hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <FileText size={14} style={{ color: "rgba(255,255,255,0.4)" }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: "white" }}>{cs.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{cs.driveUrl ? "Drive synced" : "Local"}</div>
                  </div>
                  <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.2)" }} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* RIGHT — upcoming events panel */}
      <div
        className="w-80 shrink-0 flex flex-col py-9 pr-8"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between mb-5 pl-6">
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Upcoming</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "white" }}>
              {allUpcoming.length === 0 ? "No events" : `${allUpcoming.length} event${allUpcoming.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <Link
            href="/dashboard/calendar"
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-white/15"
            style={{ background: "rgba(255,255,255,0.08)" }}
            title="Add event"
          >
            <Plus size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
          </Link>
        </div>

        {/* Type filter tabs */}
        {eventTypes.length > 1 && (
          <div className="flex gap-1 mb-5 pl-6 flex-wrap">
            {eventTypes.map(type => (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all duration-150"
                style={{
                  background: activeFilter === type
                    ? (type === "all" ? "rgba(255,255,255,0.9)" : TYPE_COLOR[type])
                    : "rgba(255,255,255,0.07)",
                  color: activeFilter === type ? "#111110" : "rgba(255,255,255,0.4)",
                }}
              >
                {type === "all" ? "All" : TYPE_LABEL[type] ?? type}
              </button>
            ))}
          </div>
        )}

        {/* Event list */}
        <div className="flex-1 overflow-y-auto pl-6 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
          {displayedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={28} style={{ color: "rgba(255,255,255,0.12)", marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                {activeFilter === "all" ? "No upcoming events" : `No ${TYPE_LABEL[activeFilter]?.toLowerCase()} events`}
              </div>
              <Link
                href="/dashboard/calendar"
                className="text-xs mt-1 transition-colors hover:text-white"
                style={{ color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}
              >
                Add one
              </Link>
            </div>
          ) : (
            displayedEvents.map((e: any) => {
              const color = TYPE_COLOR[e.type] ?? "#6b7280";
              const { glow, pulse } = urgencyStyle(e.date);
              const isExpanded = expandedEvent === e.id;
              const diff = differenceInCalendarDays(new Date(e.date), today);

              return (
                <button
                  key={e.id}
                  onClick={() => setExpandedEvent(isExpanded ? null : e.id)}
                  className="text-left rounded-xl px-4 py-3 border transition-all duration-200 hover:border-white/20 w-full"
                  style={{
                    background: glow !== "transparent" ? glow : "rgba(255,255,255,0.05)",
                    borderColor: isExpanded ? `${color}60` : "rgba(255,255,255,0.08)",
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {pulse && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, animation: "pulse 1.5s infinite" }} />
                        )}
                        <div className="text-sm font-medium truncate" style={{ color: "white" }}>{e.title}</div>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {e.course?.code ? `${e.course.code} · ` : ""}{TYPE_LABEL[e.type] ?? e.type}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold" style={{ color }}>{dayLabel(e.date)}</div>
                      {diff > 1 && (
                        <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{format(new Date(e.date), "EEE")}</div>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <Clock size={10} />
                        {format(new Date(e.date), "EEEE, MMMM d, yyyy")}
                      </div>
                      {e.description && (
                        <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{e.description}</div>
                      )}
                      <Link
                        href="/dashboard/calendar"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mt-2 transition-colors hover:text-white"
                        style={{ color: `${color}cc` }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        Open in calendar <ChevronRight size={10} />
                      </Link>
                    </div>
                  )}
                </button>
              );
            })
          )}

          {filtered.length > 8 && (
            <Link
              href="/dashboard/calendar"
              className="flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.35)", border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              +{filtered.length - 8} more <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {/* Today's date footer */}
        <div className="pl-6 pt-5 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            {format(new Date(), "EEEE, MMMM d")}
          </div>
        </div>
      </div>

    </div>
  );
}
