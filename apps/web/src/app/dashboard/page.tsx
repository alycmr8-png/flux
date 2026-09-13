"use client";
import { useState, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useT } from "@/lib/useT";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";
import { FileText, Calendar, ChevronRight, Plus, Clock, Layers, Link2, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import { startOfDay, format, differenceInCalendarDays } from "date-fns";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

const TYPE_COLOR: Record<string, string> = {
  exam:       "#ef4444",
  assignment: "#f97316",
  deadline:   "#eab308",
  quiz:       "#a855f7",
  class:      "#4B5FE8",
  other:      "#6b7280",
};

const TYPE_LABEL: Record<string, string> = {
  exam: "Exam", assignment: "Assignment", deadline: "Deadline",
  quiz: "Quiz", class: "Class", other: "Other",
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Classes are identified by colour everywhere, exactly as on mobile: a solid
// circle in the class colour with the first letter in white. Never a pale tint
// behind white text — that combination is unreadable.
const classColor = (c: any) => (c?.color as string) || BRAND;
const classInitial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase() || "?";

function ClassBadge({ name, color, size = 40 }: { name?: string; color?: string | null; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: color || BRAND }}
    >
      <span style={{ color: "#fff", fontSize: Math.round(size * 0.45), fontWeight: 800, lineHeight: 1 }}>
        {classInitial(name)}
      </span>
    </span>
  );
}

// ── Canvas LMS ───────────────────────────────────────────────────────────────
// Students self-serve an access token from Canvas (no university approval
// needed) and Flux imports classes, syllabi, PDFs and deadlines automatically.
function CanvasCard() {
  const t = useT();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { mutate: globalMutate } = useSWRConfig();
  const { userId, isLoaded } = useAuth();
  const ready = isLoaded && !!userId;

  const { data, mutate } = useSWR(ready ? `${BASE}/api/canvas/status` : null, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latest: any) => (latest?.data?.syncing ? 4000 : 0),
  });
  const status = data?.data ?? null;

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // When a sync finishes, refresh classes + events so imports appear instantly
  const syncingNow = !!status?.syncing;
  const prevSyncing = useRef(false);
  useEffect(() => {
    if (prevSyncing.current && !syncingNow) {
      globalMutate(`${BASE}/api/courses`);
      globalMutate((key: any) => typeof key === "string" && key.startsWith(`${BASE}/api/events`), undefined, { revalidate: true });
    }
    prevSyncing.current = syncingNow;
  }, [syncingNow, globalMutate]);

  async function connect() {
    setBusy(true);
    setErr("");
    try {
      await apiFetch(`/api/canvas/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url, token }),
      });
      setOpen(false);
      setToken("");
      mutate();
    } catch {
      setErr(t.home.canvas.invalid);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    try { await apiFetch(`/api/canvas/sync`, { method: "POST" }); mutate(); } catch {}
  }

  async function disconnect() {
    try { await apiFetch(`/api/canvas`, { method: "DELETE" }); mutate(); } catch {}
  }

  const r = status?.lastResult as any;

  return (
    <div className="mb-9">
      <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 12 }}>{t.home.canvas.eyebrow}</p>
      <div className="rounded-[20px] border px-5 py-4" style={{ background: "#FFFFFF", borderColor: HAIRLINE }}>
        {!status?.connected ? (
          <>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: BRAND }}>
                <Link2 size={17} style={{ color: "#fff" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 15.5, fontWeight: 600, color: INK }}>{t.home.canvas.connect}</div>
                <div style={{ fontSize: 13.5, color: "rgba(15,17,21,0.6)", marginTop: 2 }}>{t.home.canvas.desc}</div>
              </div>
              <button onClick={() => setOpen(o => !o)}
                className="font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity shrink-0"
                style={{ background: BRAND, fontSize: 13.5 }}>
                {open ? t.home.canvas.close : t.home.canvas.connectCta}
              </button>
            </div>
            {open && (
              <div className="mt-4 pt-4 space-y-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <div>
                  <label className="block mb-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(15,17,21,0.65)" }}>{t.home.canvas.urlLabel}</label>
                  <input value={url} onChange={e => setUrl(e.target.value)} placeholder="yourschool.instructure.com"
                    className="w-full rounded-xl border px-3.5 py-2.5 outline-none placeholder-gray-400"
                    style={{ borderColor: HAIRLINE, background: "#FFFFFF", color: INK, fontSize: 14.5 }} />
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(15,17,21,0.65)" }}>{t.home.canvas.tokenLabel}</label>
                  <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="1030~…"
                    className="w-full rounded-xl border px-3.5 py-2.5 outline-none placeholder-gray-400"
                    style={{ borderColor: HAIRLINE, background: "#FFFFFF", color: INK, fontSize: 14.5 }} />
                  <p style={{ fontSize: 12.5, color: "rgba(15,17,21,0.55)", marginTop: 6 }}>{t.home.canvas.tokenHelp}</p>
                </div>
                {err && <p style={{ fontSize: 13.5, color: "#DC2626" }}>{err}</p>}
                <button onClick={connect} disabled={busy || !url.trim() || !token.trim()}
                  className="flex items-center gap-2 font-semibold px-5 py-2.5 rounded-full text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                  style={{ background: BRAND, fontSize: 13.5 }}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                  {busy ? t.home.canvas.connecting : t.home.canvas.submit}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: status.syncing ? "rgba(75,95,232,0.12)" : "rgba(22,163,74,0.12)" }}>
              {status.syncing ? <Loader2 size={17} className="animate-spin" style={{ color: BRAND }} /> : <CheckCircle size={17} style={{ color: "#16A34A" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 15.5, fontWeight: 600, color: INK }}>
                {status.syncing ? t.home.canvas.syncing : t.home.canvas.connected}
              </div>
              <div className="truncate" style={{ fontSize: 13.5, color: "rgba(15,17,21,0.6)", marginTop: 2 }}>
                {status.baseUrl?.replace("https://", "")}
                {!status.syncing && r ? ` · ${t.home.canvas.summary.replace("{a}", String((r.coursesCreated ?? 0) + (r.coursesMatched ?? 0))).replace("{b}", String((r.filesIndexed ?? 0) + (r.syllabiIndexed ?? 0))).replace("{c}", String(r.eventsCreated ?? 0))}` : ""}
              </div>
            </div>
            {!status.syncing && (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={syncNow}
                  className="flex items-center gap-1.5 font-semibold px-4 py-2 rounded-full border transition-colors hover:bg-[rgba(0,0,0,0.03)]"
                  style={{ borderColor: HAIRLINE, color: INK, fontSize: 13.5 }}>
                  <RefreshCw size={12} /> {t.home.canvas.syncNow}
                </button>
                <button onClick={disconnect} className="px-2 py-2 transition-colors hover:text-red-600" style={{ color: "rgba(15,17,21,0.55)", fontSize: 13 }}>
                  {t.home.canvas.disconnect}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function greetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 18) return "goodAfternoon";
  return "goodEvening";
}

export default function DashboardHome() {
  const { user } = useUser();
  const { userId, isLoaded: authLoaded } = useAuth();
  const firstName = user?.firstName ?? user?.username ?? "";
  const t = useT();
  const fetcher = useApiSWRFetcher();
  const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 60000 } as const;
  // Only fetch once Clerk has resolved the user id — otherwise the first
  // request goes out with an empty auth header, gets a 401, and SWR waits on
  // its error-retry timer (~5s) before recovering, making the page feel slow.
  const ready = authLoaded && !!userId;

  const { data: sheetsData } = useSWR(ready ? `${BASE}/api/cheatsheets` : null, fetcher, SWR_OPTS);
  const { data: coursesData, isLoading: coursesLoading } = useSWR(ready ? `${BASE}/api/courses` : null, fetcher, SWR_OPTS);
  const courses: any[] = coursesData?.data ?? [];
  // Events only carry { id, name, code } for their course, so the class colour
  // is looked up from the courses list we already have.
  const colorByCourseId: Record<string, string> = {};
  for (const c of courses) colorByCourseId[c.id] = classColor(c);

  // Stable date range — must not be computed inline or the SWR key changes every render
  const [eventsFrom] = useState(() => startOfDay(new Date()).toISOString());
  const [eventsTo] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

  const { data: eventsData, isLoading: eventsLoading } = useSWR(
    ready ? `${BASE}/api/events?from=${eventsFrom}&to=${eventsTo}` : null,
    fetcher,
    SWR_OPTS
  );

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

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
    if (diff === 0) return { glow: "rgba(239,68,68,0.07)", pulse: true };
    if (diff <= 2) return { glow: "rgba(249,115,22,0.06)", pulse: false };
    return { glow: "transparent", pulse: false };
  }

  const sectionLabel = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: BRAND, marginBottom: 12 };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">

      {/* LEFT — main content */}
      <div className="flex-1 min-w-0 py-6 px-0 md:py-9 md:pl-10 md:pr-0">

        {/* Header */}
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>{t.home.overview}</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK, marginBottom: 30 }}>
          {t.home[greetingKey()]}{firstName ? `, ${firstName}` : ""}.
        </h1>

        {/* Coming up */}
        <p style={sectionLabel}>{t.home.comingUp}</p>
        <div className="flex flex-col gap-2.5 mb-9">
          {!ready || eventsLoading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="rounded-[18px] px-4 py-3 border animate-pulse" style={{ background: "rgba(0,0,0,0.03)", borderColor: HAIRLINE, height: 66 }} />
            ))
          ) : allUpcoming.length === 0 ? (
            <Link href="/dashboard/calendar"
              className="flex items-center gap-3 rounded-[18px] px-5 py-4 border transition-colors hover:bg-[rgba(75,95,232,0.04)]"
              style={{ background: "#FFFFFF", borderColor: HAIRLINE, borderStyle: "dashed" }}>
              <Plus size={16} style={{ color: "rgba(15,17,21,0.55)" }} />
              <span style={{ fontSize: 14.5, color: "rgba(15,17,21,0.65)" }}>No upcoming events — add one in Calendar</span>
            </Link>
          ) : (
            <>
              {allUpcoming.slice(0, 3).map((e: any) => {
                const diff = differenceInCalendarDays(new Date(e.date), today);
                const color = TYPE_COLOR[e.type] ?? "#6b7280";
                const cdLabel = diff === 0 ? "Today!" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
                const cdColor = diff === 0 ? "#ef4444" : diff <= 1 ? "#f97316" : diff <= 3 ? "#ca8a04" : "rgba(15,17,21,0.6)";
                return (
                  <Link key={e.id} href="/dashboard/calendar"
                    className="flex items-center gap-4 rounded-[18px] px-5 py-4 border transition-colors hover:bg-[rgba(0,0,0,0.02)]"
                    style={{ background: "#FFFFFF", borderColor: HAIRLINE, borderLeft: `5px solid ${color}` }}
                  >
                    <div style={{ minWidth: 42, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: INK }}>{format(new Date(e.date), "d")}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "rgba(15,17,21,0.6)", marginTop: 2 }}>{format(new Date(e.date), "MMM")}</div>
                    </div>
                    {e.course && <ClassBadge name={e.course.name} color={colorByCourseId[e.course.id]} size={30} />}
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 15.5, fontWeight: 600, color: INK }}>{e.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(15,17,21,0.6)", marginTop: 3 }}>
                        {TYPE_LABEL[e.type]}{e.course?.code ? ` · ${e.course.code}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full" style={{ background: `${cdColor}14` }}>
                      <Clock size={11} style={{ color: cdColor }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: cdColor }}>{cdLabel}</span>
                    </div>
                  </Link>
                );
              })}
              {allUpcoming.length > 3 && (
                <Link href="/dashboard/calendar" className="text-center py-1.5 transition-colors hover:text-[#0f1115]" style={{ fontSize: 14, color: "rgba(15,17,21,0.6)" }}>
                  +{allUpcoming.length - 3} more events →
                </Link>
              )}
            </>
          )}
        </div>

        {/* My classes */}
        <p style={sectionLabel}>{t.home.myClasses}</p>
        <div className="flex flex-col gap-2.5 mb-9">
          {!ready || coursesLoading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="rounded-[18px] px-5 py-4 border animate-pulse" style={{ background: "rgba(0,0,0,0.03)", borderColor: HAIRLINE, height: 72 }} />
            ))
          ) : courses.length === 0 ? (
            <Link href="/dashboard/record"
              className="flex items-center gap-3 rounded-[18px] px-5 py-4 border transition-colors hover:bg-[rgba(75,95,232,0.04)]"
              style={{ background: "#FFFFFF", borderColor: HAIRLINE, borderStyle: "dashed" }}>
              <Plus size={16} style={{ color: "rgba(15,17,21,0.55)" }} />
              <span style={{ fontSize: 14.5, color: "rgba(15,17,21,0.65)" }}>Add your first class</span>
            </Link>
          ) : (
            courses.map((cls: any) => {
              const tint = classColor(cls);
              return (
                <Link key={cls.id} href="/dashboard/record"
                  className="flex items-center gap-3.5 rounded-[18px] px-5 py-4 border transition-colors hover:bg-[rgba(0,0,0,0.02)]"
                  style={{ background: "#FFFFFF", borderColor: HAIRLINE, borderLeft: `5px solid ${tint}` }}>
                  <ClassBadge name={cls.name} color={tint} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{cls.name}</div>
                    <div style={{ fontSize: 13.5, color: "rgba(15,17,21,0.6)", marginTop: 2 }}>{cls.code}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: "rgba(15,17,21,0.4)" }} />
                </Link>
              );
            })
          )}
        </div>

        <CanvasCard />

        {/* Saved notes */}
        {notes.length > 0 && (
          <>
            <p style={sectionLabel}>{t.home.savedNotes}</p>
            <div className="flex flex-col gap-2.5">
              {notes.map((cs: any) => {
                const course = cs.lecture?.course;
                return (
                  <Link
                    key={cs.id}
                    href="/dashboard/summaries"
                    className="flex items-center gap-3.5 rounded-[18px] px-5 py-4 border transition-colors hover:bg-[rgba(0,0,0,0.02)]"
                    style={{ background: "#FFFFFF", borderColor: HAIRLINE, ...(course ? { borderLeft: `5px solid ${classColor(course)}` } : {}) }}
                  >
                    {course
                      ? <ClassBadge name={course.name} color={classColor(course)} size={32} />
                      : <FileText size={16} style={{ color: "rgba(15,17,21,0.6)" }} className="shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: INK }}>{cs.title}</div>
                      <div style={{ fontSize: 13.5, color: "rgba(15,17,21,0.6)", marginTop: 2 }}>
                        {course?.code ? `${course.code} · ` : ""}{cs.driveUrl ? "Drive synced" : "Local"}
                      </div>
                    </div>
                    <ChevronRight size={15} style={{ color: "rgba(15,17,21,0.4)" }} />
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* RIGHT — upcoming events panel (hidden on mobile) */}
      <div
        className="hidden lg:flex w-80 shrink-0 flex-col py-9 pr-8"
        style={{ borderLeft: `1px solid ${HAIRLINE}` }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between mb-5 pl-6">
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(15,17,21,0.6)", marginBottom: 5 }}>Upcoming</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: INK }}>
              {allUpcoming.length === 0 ? "No events" : `${allUpcoming.length} event${allUpcoming.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <Link
            href="/dashboard/calendar"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
            title="Add event"
          >
            <Plus size={16} style={{ color: "#fff" }} />
          </Link>
        </div>

        {/* Type filter tabs */}
        {eventTypes.length > 1 && (
          <div className="flex gap-1.5 mb-5 pl-6 flex-wrap">
            {eventTypes.map(type => {
              const on = activeFilter === type;
              const tint = type === "all" ? INK : (TYPE_COLOR[type] ?? "#6b7280");
              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className="font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    fontSize: 11.5,
                    background: on ? tint : "rgba(0,0,0,0.04)",
                    color: on ? "#FFFFFF" : "rgba(15,17,21,0.65)",
                  }}
                >
                  {type === "all" ? "All" : TYPE_LABEL[type] ?? type}
                </button>
              );
            })}
          </div>
        )}

        {/* Event list */}
        <div className="flex-1 overflow-y-auto pl-6 flex flex-col gap-2.5" style={{ scrollbarWidth: "none" }}>
          {displayedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={30} style={{ color: "rgba(15,17,21,0.18)", marginBottom: 12 }} />
              <div style={{ fontSize: 14.5, color: "rgba(15,17,21,0.6)", marginBottom: 6 }}>
                {activeFilter === "all" ? "No upcoming events" : `No ${TYPE_LABEL[activeFilter]?.toLowerCase()} events`}
              </div>
              <Link
                href="/dashboard/calendar"
                className="transition-colors hover:opacity-80"
                style={{ fontSize: 13.5, color: BRAND, fontWeight: 600 }}
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
                  className="text-left rounded-[18px] px-4 py-3.5 border transition-colors w-full"
                  style={{
                    background: glow !== "transparent" ? glow : "#FFFFFF",
                    borderColor: isExpanded ? `${color}60` : HAIRLINE,
                    borderLeft: `5px solid ${color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    {e.course && <ClassBadge name={e.course.name} color={colorByCourseId[e.course.id]} size={26} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {pulse && (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, animation: "pulse 1.5s infinite" }} />
                        )}
                        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{e.title}</div>
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(15,17,21,0.6)" }}>
                        {e.course?.code ? `${e.course.code} · ` : ""}{TYPE_LABEL[e.type] ?? e.type}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{dayLabel(e.date)}</div>
                      {diff > 1 && (
                        <div style={{ fontSize: 12, color: "rgba(15,17,21,0.55)" }}>{format(new Date(e.date), "EEE")}</div>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      <div className="flex items-center gap-1.5 mb-1.5" style={{ fontSize: 13.5, color: "rgba(15,17,21,0.72)" }}>
                        <Clock size={12} />
                        {format(new Date(e.date), "EEEE, MMMM d, yyyy")}
                      </div>
                      {e.description && (
                        <div className="leading-relaxed" style={{ fontSize: 13.5, color: "rgba(15,17,21,0.65)" }}>{e.description}</div>
                      )}
                      <Link
                        href="/dashboard/calendar"
                        className="inline-flex items-center gap-1 font-bold uppercase tracking-wider mt-2.5 transition-opacity hover:opacity-80"
                        style={{ fontSize: 11.5, color }}
                        onClick={(ev: React.MouseEvent) => ev.stopPropagation()}
                      >
                        Open in calendar <ChevronRight size={11} />
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
              className="flex items-center justify-center gap-1 rounded-[18px] py-3 transition-colors hover:bg-[rgba(0,0,0,0.02)]"
              style={{ fontSize: 13.5, color: "rgba(15,17,21,0.65)", border: `1px dashed ${HAIRLINE}` }}
            >
              +{filtered.length - 8} more <ChevronRight size={13} />
            </Link>
          )}
        </div>

        {/* Today's date footer */}
        <div className="pl-6 pt-5 mt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <div style={{ fontSize: 13, color: "rgba(15,17,21,0.6)" }}>
            {format(new Date(), "EEEE, MMMM d")}
          </div>
        </div>
      </div>

    </div>
  );
}
