"use client";
import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { apiBase } from "@/lib/apiBase";
import { useTr } from "@/lib/useTr";

const BASE = apiBase();

type CalView = "day" | "week" | "month";
const VIEWS: CalView[] = ["day", "week", "month"];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_H = 56;             // row height in the week grid (desktop)
const FIRST_VISIBLE_HOUR = 7;  // the grid opens on the morning, not midnight
const GUTTER = 68;             // width of the time gutter

const EVENT_TYPES = ["exam", "assignment", "deadline", "quiz", "class", "other"] as const;
const TYPE_COLOR: Record<string, string> = {
  exam: "#EF4444", assignment: "#F97316", deadline: "#EAB308",
  quiz: "#A855F7", class: "#3B82F6", other: "#6B7280",
};
const REVIEW_COLOR = "#4B5FE8";

type Item = {
  kind: "session" | "event";
  id: string;
  at: Date;
  title: string;
  sub: string;
  course?: string;
};

/** "7 AM" — the week-grid gutter reads better spelled out on a wide screen. */
function gutterHour(h: number) {
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${h < 12 ? "AM" : "PM"}`;
}
/** "9am" / "2pm" — compact form used in the scheduling form and its save button. */
function shortHour(h: number) {
  return h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
}
function itemColor(it: Item) {
  return it.kind === "event" ? TYPE_COLOR[it.sub] ?? "#6B7280" : REVIEW_COLOR;
}

export default function CalendarPage() {
  const tr = useTr();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();

  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("exam");
  const [newHour, setNewHour] = useState(9);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const weekScrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch exactly the span on screen so each view stays cheap.
  const range =
    view === "day"  ? { from: startOfDay(anchor),   to: endOfDay(anchor) } :
    view === "week" ? { from: startOfWeek(anchor),  to: endOfWeek(anchor) } :
                      { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const { data: sessionsData } = useSWR(
    `${BASE}/api/calendar/sessions?from=${fromISO}&to=${toISO}`,
    fetcher
  );
  const sessions: any[] = sessionsData?.data ?? [];

  const { data: eventsData, mutate: mutateEvents } = useSWR(
    `${BASE}/api/events?from=${fromISO}&to=${toISO}`,
    fetcher
  );
  const events: any[] = eventsData?.data ?? [];

  // Reviews Ucorns schedules and events the student adds share the day list.
  const allItems: Item[] = useMemo(() => [
    ...sessions.map((ev: any) => ({
      kind: "session" as const,
      id: ev.id,
      at: new Date(ev.scheduledAt),
      title: ev.lecture?.title ?? "Study session",
      sub: ev.type ?? "review",
      course: ev.lecture?.course?.name,
    })),
    ...events.map((ev: any) => ({
      kind: "event" as const,
      id: ev.id,
      at: new Date(ev.date),
      title: ev.title,
      sub: ev.type,
      course: ev.course?.name,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()), [sessions, events]);

  const itemsOn = (d: Date) => allItems.filter((it) => isSameDay(it.at, d));

  const monthDays = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const weekDays = eachDayOfInterval({ start: startOfWeek(anchor), end: endOfWeek(anchor) });

  // One pass per week instead of one per cell (7 × 24 lookups otherwise).
  const weekBuckets = useMemo(() => weekDays.map((day) => {
    const byHour: Record<number, Item[]> = {};
    for (const it of allItems) {
      if (!isSameDay(it.at, day)) continue;
      (byHour[it.at.getHours()] ??= []).push(it);
    }
    return byHour;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allItems, anchor, view]);

  // The grid opens scrolled to the morning whenever the week view appears.
  useEffect(() => {
    if (view === "week" && weekScrollRef.current) {
      weekScrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_H;
    }
  }, [view]);

  function step(dir: 1 | -1) {
    if (view === "day")  return setAnchor(dir > 0 ? addDays(anchor, 1)  : subDays(anchor, 1));
    if (view === "week") return setAnchor(dir > 0 ? addWeeks(anchor, 1) : subWeeks(anchor, 1));
    setAnchor(dir > 0 ? addMonths(anchor, 1) : subMonths(anchor, 1));
  }

  // Day and week focus one date; month lists whatever day you click.
  const listDate = view === "day" ? anchor : selected;
  const listItems = itemsOn(listDate);

  const headerLabel =
    view === "day"  ? format(anchor, "EEEE d MMMM") :
    view === "week" ? `${format(startOfWeek(anchor), "d MMM")} – ${format(endOfWeek(anchor), "d MMM")}` :
                      format(anchor, "MMMM yyyy");

  function openForm() {
    setFormError("");
    setAdding(true);
  }

  // Clicking an empty slot in the week grid starts an event at that day and hour.
  function openSlot(day: Date, hour: number) {
    setSelected(day);
    setNewHour(hour);
    openForm();
  }

  async function addEvent() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const when = new Date(listDate);
      when.setHours(newHour, 0, 0, 0);
      await apiFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), date: when.toISOString(), type: newType }),
      });
      await mutateEvents();
      setNewTitle("");
      setAdding(false);
    } catch (e: any) {
      setFormError(e?.message ?? "Couldn't schedule that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? It will be removed from your schedule.`)) return;
    try {
      await apiFetch(`/api/events/${id}`, { method: "DELETE" });
      await mutateEvents();
    } catch (e: any) {
      setNotice(e?.message ?? "Couldn't delete that event.");
    }
  }

  const goToday = () => { const now = new Date(); setAnchor(now); setSelected(now); };

  return (
    <div style={{ color: "#0f1115", maxWidth: 1180 }}>
      <style>{`
        .cal-slot { transition: background 120ms ease; }
        .cal-slot:hover { background: rgba(75,95,232,0.07) !important; }
        .cal-del { opacity: 0; transition: opacity 120ms ease; }
        .cal-row:hover .cal-del, .cal-del:focus-visible { opacity: 1; }
        .cal-nav:hover { background: rgba(0,0,0,0.04); }
        .cal-daycell:hover .cal-pill-plain { background: rgba(0,0,0,0.04) !important; }
      `}</style>

      {/* Header */}
      <div className="mb-6">
        {/* Same header system as Home: a brand eyebrow naming the section, then
            the sentence as the heading — Plus Jakarta Sans 800, not serif italic. */}
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#4B5FE8", marginBottom: 8 }}>
            {tr("Schedule")}
          </div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: "#0f1115", margin: 0 }}>
            {tr("Reviews Ucorns plans for you, plus everything you add yourself.")}
          </h1>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl mb-4" style={{ fontSize: 14, color: "#B91C1C", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "9px 14px" }}>
          {notice}
        </div>
      )}

      {/* Day / Week / Month */}
      <div
        className="flex gap-1.5 mb-5"
        style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 24, padding: 5, maxWidth: 420 }}
      >
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => { setView(v); if (v !== "month") setSelected(anchor); }}
            className="flex-1 transition-colors"
            style={{
              padding: "10px 0", borderRadius: 19, fontSize: 16, fontWeight: 600,
              background: view === v ? "#4B5FE8" : "transparent",
              color: view === v ? "#fff" : "rgba(15,17,21,0.55)",
            }}
          >
            {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
          </button>
        ))}
      </div>

      {/* Calendar card */}
      <div
        style={{
          background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 20,
          padding: 20, marginBottom: 26, boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => step(-1)} className="cal-nav rounded-lg" style={{ padding: 7, color: "rgba(15,17,21, 0.73)" }} aria-label={tr("Previous")}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 17, fontWeight: 700 }}>{headerLabel}</span>
            {view !== "day" && !isSameDay(anchor, new Date()) && (
              <button onClick={goToday} className="rounded-full" style={{ border: "1px solid rgba(0,0,0,0.12)", padding: "5px 12px", fontSize: 14, fontWeight: 600 }}>{tr("Today")}</button>
            )}
          </div>
          <button onClick={() => step(1)} className="cal-nav rounded-lg" style={{ padding: 7, color: "rgba(15,17,21, 0.73)" }} aria-label={tr("Next")}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* ── MONTH ── */}
        {view === "month" && (
          <div>
            <div className="grid grid-cols-7">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "rgba(15,17,21, 0.65)", padding: "6px 0" }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startOfMonth(anchor).getDay() }).map((_, i) => <div key={`pad${i}`} />)}
              {monthDays.map((day) => {
                const isSel = isSameDay(day, selected);
                const today = isToday(day);
                const count = itemsOn(day).length;
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelected(day)}
                    className="cal-daycell flex flex-col items-center justify-start"
                    style={{ padding: "8px 0", minHeight: 86 }}
                  >
                    <div
                      className={today || isSel ? "" : "cal-pill-plain"}
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: today ? "#4B5FE8" : "transparent",
                        border: isSel && !today ? "2px solid #4B5FE8" : "2px solid transparent",
                        transition: "background 120ms ease",
                      }}
                    >
                      <span style={{
                        fontSize: 17,
                        fontWeight: today || isSel ? 700 : 400,
                        color: today ? "#fff" : isSel ? "#4B5FE8" : "rgba(15,17,21,0.75)",
                      }}>
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" style={{ height: 12, marginTop: 5 }}>
                      {count > 0 && Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#4B5FE8", display: "block" }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── WEEK ── */}
        {view === "week" && (
          <div>
            {/* Day header row */}
            <div
              className="grid"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))`, borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: 10 }}
            >
              <div />
              {weekDays.map((day) => {
                const today = isToday(day);
                const isSel = isSameDay(day, selected);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelected(day)}
                    className="flex flex-col items-center gap-1"
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(15,17,21, 0.65)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {format(day, "EEE")}
                    </span>
                    <span
                      style={{
                        width: 34, height: 34, borderRadius: 17,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: today ? "#4B5FE8" : "transparent",
                        border: isSel && !today ? "2px solid #4B5FE8" : "2px solid transparent",
                        fontSize: 17, fontWeight: 700,
                        color: today ? "#fff" : isSel ? "#4B5FE8" : "#0f1115",
                      }}
                    >
                      {format(day, "d")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hour grid */}
            <div ref={weekScrollRef} style={{ maxHeight: 560, overflowY: "auto", marginTop: 2 }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="grid"
                  style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))`, height: HOUR_H, borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <div style={{ textAlign: "right", paddingRight: 10, fontSize: 13, fontWeight: 600, color: "rgba(15,17,21, 0.65)", marginTop: -7 }}>
                    {gutterHour(h)}
                  </div>
                  {weekDays.map((day, di) => {
                    const slotItems = weekBuckets[di]?.[h] ?? [];
                    const today = isToday(day);
                    return (
                      <div
                        key={day.toISOString() + h}
                        onClick={() => openSlot(day, h)}
                        className="cal-slot flex flex-col gap-0.5 overflow-hidden"
                        style={{
                          borderLeft: "1px solid rgba(0,0,0,0.05)",
                          background: today ? "rgba(75,95,232,0.04)" : "transparent",
                          padding: "3px 4px",
                          cursor: "pointer",
                        }}
                      >
                        {slotItems.map((it) => (
                          <div
                            key={`${it.kind}-${it.id}`}
                            title={`${format(it.at, "h:mma").toLowerCase()} · ${it.title}`}
                            className="truncate"
                            style={{
                              background: itemColor(it), color: "#fff",
                              borderRadius: 6, padding: "3px 7px",
                              fontSize: 13.5, fontWeight: 600, lineHeight: "15px",
                            }}
                          >
                            {it.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13.5, color: "rgba(15,17,21, 0.65)", textAlign: "center", marginTop: 12 }}>{tr("Click any slot to schedule something")}</p>
          </div>
        )}

        {/* ── DAY ── */}
        {view === "day" && (
          <div className="flex items-center" style={{ gap: 24, padding: "10px 4px" }}>
            <span style={{ fontSize: 76, fontWeight: 200, letterSpacing: -3, lineHeight: 1 }}>{format(anchor, "d")}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{format(anchor, "EEEE")}</div>
              <div style={{ fontSize: 16, color: "rgba(15,17,21, 0.73)", marginTop: 3 }}>
                {listItems.length
                  ? `${listItems.length} session${listItems.length === 1 ? "" : "s"}`
                  : "Nothing scheduled"}
              </div>
            </div>
            {!isToday(anchor) && (
              <button
                onClick={goToday}
                className="rounded-full"
                style={{ marginLeft: "auto", border: "1px solid rgba(0,0,0,0.12)", padding: "8px 16px", fontSize: 14.5, fontWeight: 600 }}
              >{tr("Today")}</button>
            )}
          </div>
        )}
      </div>

      {/* Day list */}
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,17,21, 0.7)" }}>
          {isToday(listDate) ? tr("Today") : format(listDate, "EEEE")} · {format(listDate, "d MMM")}
        </span>
        <button
          onClick={() => (adding ? setAdding(false) : openForm())}
          className="flex items-center gap-1.5 rounded-full transition-colors"
          style={{
            background: adding ? "rgba(15,17,21,0.08)" : "#4B5FE8",
            color: adding ? "#0f1115" : "#fff",
            padding: "9px 16px", fontSize: 15, fontWeight: 600,
          }}
        >
          {adding ? <X size={16} /> : <Plus size={16} />}
          {adding ? tr("Cancel") : tr("Schedule")}
        </button>
      </div>

      {/* Scheduling form */}
      {adding && (
        <div
          className="mb-5"
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 20, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{format(listDate, "EEEE d MMM")}</div>

          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addEvent(); }}
            placeholder={tr("Exam, assignment, reading…")}
            className="w-full outline-none"
            style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "12px 14px", fontSize: 16, color: "#0f1115", maxWidth: 520 }}
          />

          <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className="rounded-full capitalize transition-colors"
                style={{
                  border: `1px solid ${newType === t ? TYPE_COLOR[t] : "rgba(0,0,0,0.12)"}`,
                  background: newType === t ? TYPE_COLOR[t] : "transparent",
                  color: newType === t ? "#fff" : "rgba(15,17,21,0.65)",
                  padding: "7px 14px", fontSize: 14, fontWeight: 600,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(15,17,21, 0.68)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "18px 0 9px" }}>{tr("Time")}</div>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setNewHour(h)}
                className="rounded-full transition-colors"
                style={{
                  border: `1px solid ${newHour === h ? "#4B5FE8" : "rgba(0,0,0,0.12)"}`,
                  background: newHour === h ? "#4B5FE8" : "transparent",
                  color: newHour === h ? "#fff" : "rgba(15,17,21,0.65)",
                  padding: "7px 13px", fontSize: 14, fontWeight: 600, minWidth: 62,
                }}
              >
                {shortHour(h)}
              </button>
            ))}
          </div>

          {formError && (
            <div className="rounded-xl" style={{ marginTop: 14, fontSize: 14, color: "#B91C1C", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "9px 14px", maxWidth: 520 }}>
              {formError}
            </div>
          )}

          <button
            onClick={addEvent}
            disabled={!newTitle.trim() || saving}
            className="rounded-xl"
            style={{
              marginTop: 18, background: "#4B5FE8", color: "#fff",
              padding: "13px 28px", fontSize: 16, fontWeight: 600,
              opacity: !newTitle.trim() || saving ? 0.4 : 1,
              cursor: !newTitle.trim() || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? tr("Scheduling…")
              : !newTitle.trim()
              ? "Name it first"
              : `Add to ${format(listDate, "d MMM")} · ${shortHour(newHour)}`}
          </button>
        </div>
      )}

      {listItems.length === 0 ? (
        <p style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.7)", lineHeight: 1.5 }}>{tr("Nothing on this day — click Schedule to add an exam, assignment or deadline.")}</p>
      ) : (
        <div className="flex flex-col gap-2.5" style={{ maxWidth: 760 }}>
          {listItems.map((it) => (
            <div key={`${it.kind}-${it.id}`} className="cal-row flex items-stretch gap-3">
              <span style={{ width: 66, textAlign: "right", paddingTop: 15, fontSize: 14, fontWeight: 600, color: "rgba(15,17,21, 0.7)", flexShrink: 0 }}>
                {format(it.at, "h:mma").toLowerCase()}
              </span>
              <span style={{ width: 3, borderRadius: 2, background: itemColor(it), flexShrink: 0 }} />
              <div
                className="flex items-start justify-between flex-1 min-w-0"
                style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 14 }}
              >
                <div className="min-w-0">
                  <div style={{ fontSize: 16, fontWeight: 600, lineHeight: "20px" }}>{it.title}</div>
                  <div className="capitalize" style={{ fontSize: 14, color: "rgba(15,17,21, 0.73)", marginTop: 3 }}>
                    {it.kind === "session" ? "review" : it.sub}{it.course ? ` · ${it.course}` : ""}
                  </div>
                </div>
                {it.kind === "event" && (
                  <button
                    onClick={() => removeEvent(it.id, it.title)}
                    className="cal-del"
                    style={{ color: "rgba(15,17,21, 0.68)", padding: 2, marginLeft: 12, flexShrink: 0 }}
                    aria-label={`Delete ${it.title}`}
                    title={tr("Delete")}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
