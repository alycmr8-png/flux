"use client";
import Link from "next/link";
import useSWR from "swr";
import { useApiSWRFetcher } from "@/lib/apiFetch";
import { Mic, FileText, BookOpen, Calendar, ChevronRight } from "lucide-react";
import { startOfDay, format, isSameDay, differenceInCalendarDays } from "date-fns";

const TYPE_COLOR: Record<string, string> = {
  exam: "#ef4444", assignment: "#f97316", deadline: "#eab308",
  quiz: "#a855f7", class: "#3b82f6", other: "#6b7280",
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const ACTIONS = [
  { icon: Mic,      label: "Record",    href: "/dashboard/record"    },
  { icon: FileText, label: "Summaries", href: "/dashboard/summaries" },
  { icon: BookOpen, label: "Quizzes",   href: "/dashboard/quizzes"   },
  { icon: Calendar, label: "Schedule",  href: "/dashboard/calendar"  },
];

export default function DashboardHome() {
  const fetcher = useApiSWRFetcher();
  const { data: progressData, isLoading } = useSWR(`${BASE}/api/progress`, fetcher);
  const { data: lecturesData } = useSWR(`${BASE}/api/lectures`, fetcher);
  const { data: sheetsData } = useSWR(`${BASE}/api/cheatsheets`, fetcher);

  const { data: eventsData } = useSWR(
    `${BASE}/api/events?from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}`,
    fetcher
  );

  const p = progressData?.data;
  const recent = lecturesData?.data?.[0];
  const notes = sheetsData?.data?.slice(0, 3) ?? [];

  const today = startOfDay(new Date());
  const upcomingEvents = (eventsData?.data ?? [])
    .filter((e: any) => startOfDay(new Date(e.date)) >= today)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    const diff = differenceInCalendarDays(d, today);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return format(d, "MMM d");
  }

  return (
    <div className="p-8 max-w-2xl">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Overview</div>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 30, fontWeight: 400, color: "white", marginBottom: 28 }}>Good morning.</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Lectures recorded", value: isLoading ? "—" : (p?.lectureCount ?? "—") },
          { label: "Avg quiz score",    value: isLoading ? "—" : (p?.avgScore ? `${p.avgScore}%` : "—") },
          { label: "Day streak",        value: isLoading ? "—" : (p?.streak ?? "—") },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 300, color: "white", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Latest lecture */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Latest lecture</p>
      {recent ? (
        <div className="rounded-2xl p-5 mb-8 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>{recent.status}</span>
          <div className="text-sm font-medium mb-1" style={{ color: "white" }}>{recent.title}</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{recent.course?.name}</div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-8 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No lectures yet. Go to Workspace to start.</div>
        </div>
      )}

      {/* Upcoming events */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Upcoming</p>
        <Link href="/dashboard/calendar" className="flex items-center gap-0.5 text-xs transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
          View all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex flex-col gap-2 mb-8">
        {upcomingEvents.length === 0 ? (
          <div className="rounded-xl px-4 py-3 border text-xs" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
            No upcoming events — <Link href="/dashboard/calendar" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>add one</Link>
          </div>
        ) : (
          upcomingEvents.map((e: any) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3 border"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", borderLeft: `3px solid ${TYPE_COLOR[e.type] ?? "#6b7280"}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "white" }}>{e.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {e.course?.code && `${e.course.code} · `}{e.type.charAt(0).toUpperCase() + e.type.slice(1)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold" style={{ color: TYPE_COLOR[e.type] ?? "rgba(255,255,255,0.5)" }}>{dayLabel(e.date)}</div>
                {differenceInCalendarDays(new Date(e.date), today) > 1 && (
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{format(new Date(e.date), "EEE")}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick actions */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Quick actions</p>
      <div className="grid grid-cols-4 gap-3 mb-8">
        {ACTIONS.map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl p-4 flex flex-col items-center gap-2 border transition-all hover:border-white/20"
            style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <Icon size={18} style={{ color: "rgba(255,255,255,0.5)" }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Saved notes */}
      {notes.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Saved notes</p>
          <div className="space-y-2">
            {notes.map((cs: any) => (
              <div key={cs.id} className="flex items-center gap-3 rounded-xl px-4 py-3 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
                <FileText size={14} style={{ color: "rgba(255,255,255,0.4)" }} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: "white" }}>{cs.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{cs.driveUrl ? "Drive synced" : "Local"}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
