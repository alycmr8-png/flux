"use client";
import useSWR from "swr";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, addMonths, subMonths, startOfDay,
  differenceInCalendarDays, startOfWeek, addDays, addWeeks, subWeeks,
} from "date-fns";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Plus, Trash2, Pencil, AlertCircle, Clock } from "lucide-react";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const EVENT_TYPES = [
  { value: "study",      label: "Study Session", color: "#10b981" },
  { value: "class",      label: "Class",         color: "#3b82f6" },
  { value: "exam",       label: "Exam",          color: "#ef4444" },
  { value: "assignment", label: "Assignment",    color: "#f97316" },
  { value: "deadline",   label: "Deadline",      color: "#eab308" },
  { value: "quiz",       label: "Quiz",          color: "#a855f7" },
  { value: "other",      label: "Other",         color: "#6b7280" },
];

const URGENT_TYPES = new Set(["exam", "assignment", "deadline", "quiz"]);
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm

function eventColor(type: string) {
  return EVENT_TYPES.find(t => t.value === type)?.color ?? "#6b7280";
}
function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(startOfDay(new Date(dateStr)), startOfDay(new Date()));
}
function countdownLabel(days: number): string {
  if (days === 0) return "Today!";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `in ${days} days`;
  return `in ${days}d`;
}
function countdownColor(days: number, type: string): string {
  if (!URGENT_TYPES.has(type)) return "rgba(255,255,255,0.3)";
  if (days === 0) return "#ef4444";
  if (days <= 1) return "#f97316";
  if (days <= 3) return "#eab308";
  return "rgba(255,255,255,0.3)";
}
function formatHour(h: number) {
  if (h === 12) return "12 pm";
  return h > 12 ? `${h - 12} pm` : `${h} am`;
}

const todayStart = startOfDay(new Date());

export default function CalendarPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();

  const [view, setView] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("study");
  const [date, setDate] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [courseId, setCourseId] = useState("");
  const [description, setDescription] = useState("");

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekEnd = addDays(weekStart, 6);

  // Fetch enough events to cover both month and week views
  const fetchFrom = view === "week" ? weekStart.toISOString() : monthStart.toISOString();
  const fetchTo   = view === "week" ? weekEnd.toISOString()   : monthEnd.toISOString();

  const { data: eventsData, mutate } = useSWR(
    `${BASE}/api/events?from=${fetchFrom}&to=${fetchTo}`,
    fetcher
  );
  const allEvents: any[] = eventsData?.data ?? [];
  const events = allEvents.filter(e => startOfDay(new Date(e.date)) >= todayStart);

  const { data: coursesData } = useSWR(`${BASE}/api/courses`, fetcher);
  const courses: any[] = coursesData?.data ?? [];

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = monthStart.getDay();
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dayEvents = (day: Date) => events.filter(e => isSameDay(new Date(e.date), day));
  const selectedEvents = selectedDay ? dayEvents(selectedDay) : [];
  const eventsAtHour = (day: Date, hour: number) =>
    events.filter(e => {
      const d = new Date(e.date);
      return isSameDay(d, day) && d.getHours() === hour;
    });

  const upcoming = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextUrgent = upcoming.find(e => URGENT_TYPES.has(e.type));
  const nextUrgentDays = nextUrgent ? daysUntil(nextUrgent.date) : null;
  const showAlert = nextUrgent !== null && nextUrgentDays !== null && nextUrgentDays <= 7;
  const alertDayEvents = nextUrgent && nextUrgentDays !== null
    ? upcoming.filter(e => URGENT_TYPES.has(e.type) && daysUntil(e.date) === nextUrgentDays)
    : [];
  const urgentDays = new Set(
    events.filter(e => URGENT_TYPES.has(e.type) && daysUntil(e.date) <= 3)
      .map(e => format(new Date(e.date), "yyyy-MM-dd"))
  );

  function openAdd(day: Date, hour?: number) {
    setEditingEvent(null);
    setDate(format(day, "yyyy-MM-dd"));
    setEventTime(hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "09:00");
    setTitle(""); setType("study"); setCourseId(""); setDescription(""); setSaveError("");
    setShowModal(true);
  }

  function openEdit(ev: any) {
    setEditingEvent(ev);
    setTitle(ev.title); setType(ev.type);
    const d = new Date(ev.date);
    setDate(format(d, "yyyy-MM-dd"));
    setEventTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setCourseId(ev.courseId ?? ""); setDescription(ev.description ?? ""); setSaveError("");
    setShowModal(true);
  }

  async function saveEvent() {
    if (!title.trim() || !date) return;
    setSaving(true); setSaveError("");
    try {
      const dateWithTime = new Date(`${date}T${eventTime}:00`).toISOString();
      if (editingEvent) {
        await apiFetch(`/api/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), date: dateWithTime, type, courseId: courseId || null, description: description.trim() || null }),
        });
      } else {
        await apiFetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), date: dateWithTime, type, courseId: courseId || undefined, description: description.trim() || undefined }),
        });
      }
      mutate();
      setShowModal(false);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    await apiFetch(`/api/events/${id}`, { method: "DELETE" });
    mutate();
  }

  const isPastDay = (day: Date) => startOfDay(day) < todayStart;

  return (
    <div style={{ color: "white" }}>
      <style>{`
        @keyframes urgentPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        .urgent-pulse { animation: urgentPulse 1.8s ease-in-out infinite; }
        .hour-cell:hover { background: rgba(255,255,255,0.04); }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28 }}>Calendar</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>Plan your week and track deadlines</p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {(["month", "week"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
              style={{ background: view === v ? "rgba(255,255,255,0.15)" : "transparent", color: view === v ? "white" : "rgba(255,255,255,0.4)" }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Alert banner */}
      {showAlert && nextUrgent && nextUrgentDays !== null && (
        <div className="mb-5 rounded-2xl px-4 py-3" style={{
          background: nextUrgentDays === 0 ? "rgba(239,68,68,0.15)" : nextUrgentDays <= 1 ? "rgba(249,115,22,0.15)" : "rgba(234,179,8,0.12)",
          border: `1px solid ${nextUrgentDays === 0 ? "rgba(239,68,68,0.3)" : nextUrgentDays <= 1 ? "rgba(249,115,22,0.3)" : "rgba(234,179,8,0.25)"}`,
        }}>
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={15} style={{ color: nextUrgentDays === 0 ? "#ef4444" : nextUrgentDays <= 1 ? "#f97316" : "#eab308", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {alertDayEvents.length === 1
                ? nextUrgentDays === 0 ? "1 event today" : nextUrgentDays === 1 ? "1 event tomorrow" : `1 event in ${nextUrgentDays} days`
                : nextUrgentDays === 0 ? `${alertDayEvents.length} events today` : nextUrgentDays === 1 ? `${alertDayEvents.length} events tomorrow` : `${alertDayEvents.length} events in ${nextUrgentDays} days`}
            </span>
          </div>
          <div className="flex flex-col gap-1 pl-6">
            {alertDayEvents.map(e => (
              <div key={e.id} className="flex items-center gap-2">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: eventColor(e.type), display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{e.title}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>· {EVENT_TYPES.find(t => t.value === e.type)?.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {view === "month" && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setMonth(subMonths(month, 1))} className="p-1.5" style={{ color: "rgba(255,255,255,0.5)" }}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{format(month, "MMMM yyyy")}</span>
                <button onClick={() => setMonth(addMonths(month, 1))} className="p-1.5" style={{ color: "rgba(255,255,255,0.5)" }}><ChevronRight size={16} /></button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)", paddingBottom: 6 }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map(day => {
                  const de = dayEvents(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const today = isToday(day);
                  const past = isPastDay(day);
                  const isUrgent = urgentDays.has(format(day, "yyyy-MM-dd"));
                  return (
                    <button key={day.toISOString()} onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all${isUrgent ? " urgent-pulse" : ""}`}
                      style={{ background: isSelected ? "rgba(255,255,255,0.15)" : today ? "rgba(255,255,255,0.1)" : "transparent", outline: today ? "1px solid rgba(255,255,255,0.3)" : "none", opacity: past ? 0.4 : 1 }}>
                      <span style={{ fontSize: 12, fontWeight: today ? 600 : 400, color: today ? "white" : "rgba(255,255,255,0.7)" }}>{format(day, "d")}</span>
                      {de.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                          {de.slice(0, 3).map((e, i) => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: eventColor(e.type), display: "inline-block" }} />)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {EVENT_TYPES.map(t => (
                <div key={t.value} className="flex items-center gap-1.5">
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:w-72 flex flex-col gap-4">
            {selectedDay && (
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{format(selectedDay, "EEEE, MMM d")}</span>
                  {!isPastDay(selectedDay) && (
                    <button onClick={() => openAdd(selectedDay)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "white", color: "black" }}>
                      <Plus size={11} /> Add
                    </button>
                  )}
                </div>
                {selectedEvents.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{isPastDay(selectedDay) ? "This day has passed." : "No events — click Add to schedule one."}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedEvents.map(e => <EventCard key={e.id} event={e} onEdit={() => openEdit(e)} onDelete={() => deleteEvent(e.id)} />)}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Upcoming</p>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No upcoming events.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.slice(0, 8).map(e => {
                    const d = daysUntil(e.date);
                    const cdColor = countdownColor(d, e.type);
                    const isUrgentEvent = URGENT_TYPES.has(e.type) && d <= 3;
                    return (
                      <div key={e.id} className="flex items-start gap-3">
                        <div style={{ textAlign: "right", minWidth: 36 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: "white" }}>{format(new Date(e.date), "d")}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{format(new Date(e.date), "MMM")}</div>
                        </div>
                        <div className="flex-1 rounded-xl px-3 py-2" style={{ background: isUrgentEvent ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)", borderLeft: `2px solid ${eventColor(e.type)}` }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{e.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{EVENT_TYPES.find(t => t.value === e.type)?.label}{e.course && ` · ${e.course.code}`}</span>
                            <span className="flex items-center gap-0.5" style={{ fontSize: 10, fontWeight: 600, color: cdColor }}><Clock size={9} style={{ flexShrink: 0 }} />{countdownLabel(d)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 mt-1">
                          <button onClick={() => openEdit(e)} className="opacity-30 hover:opacity-70 transition-opacity"><Pencil size={11} /></button>
                          <button onClick={() => deleteEvent(e.id)} className="opacity-30 hover:opacity-70 transition-opacity"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {view === "week" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {/* Week nav */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </span>
            <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}><ChevronRight size={16} /></button>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>
              {/* Day header row */}
              <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div /> {/* corner */}
                {weekDays.map(day => {
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()} className="py-2.5 text-center" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 10, color: today ? "#3b82f6" : "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{format(day, "EEE")}</div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, color: today ? "white" : "rgba(255,255,255,0.7)",
                        width: 32, height: 32, margin: "2px auto 0",
                        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: today ? "#2563eb" : "transparent",
                      }}>{format(day, "d")}</div>
                    </div>
                  );
                })}
              </div>

              {/* Hour rows */}
              <div style={{ maxHeight: 540, overflowY: "auto" }}>
                {HOURS.map(hour => (
                  <div key={hour} className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {/* Hour label */}
                    <div className="py-2 pr-3 text-right" style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", paddingTop: 6, lineHeight: 1 }}>
                      {formatHour(hour)}
                    </div>
                    {/* Day cells */}
                    {weekDays.map(day => {
                      const evs = eventsAtHour(day, hour);
                      const past = isPastDay(day);
                      return (
                        <div key={day.toISOString()}
                          onClick={() => !past && openAdd(day, hour)}
                          className="hour-cell relative"
                          style={{
                            borderLeft: "1px solid rgba(255,255,255,0.06)",
                            minHeight: 40,
                            cursor: past ? "default" : "pointer",
                            padding: evs.length ? "3px 4px" : "0",
                          }}>
                          {evs.map(e => (
                            <div key={e.id}
                              onClick={ev => { ev.stopPropagation(); openEdit(e); }}
                              className="rounded-md px-2 py-1 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ background: `${eventColor(e.type)}22`, borderLeft: `2px solid ${eventColor(e.type)}` }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: eventColor(e.type), lineHeight: 1.2 }}>{e.title}</div>
                              {e.course && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{e.course.code}</div>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Week hint */}
          <div className="px-5 py-3 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            Click any time slot to add a study session or event
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#1a1a18", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontSize: 16, fontWeight: 500 }}>{editingEvent ? "Edit event" : "Add event"}</span>
              <button onClick={() => setShowModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={16} /></button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label style={labelStyle}>Title *</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Study — Cell Biology" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TYPES.map(t => (
                    <button key={t.value} onClick={() => setType(t.value)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: type === t.value ? t.color : "rgba(255,255,255,0.07)",
                        color: type === t.value ? "white" : "rgba(255,255,255,0.5)",
                        border: `1px solid ${type === t.value ? t.color : "rgba(255,255,255,0.1)"}`,
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>Time</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
              </div>

              {courses.length > 0 && (
                <div>
                  <label style={labelStyle}>Course (optional)</label>
                  <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle}>
                    <option value="" style={{ background: "#1a1a18" }}>None</option>
                    {courses.map((c: any) => <option key={c.id} value={c.id} style={{ background: "#1a1a18" }}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle}>Note (optional)</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Any extra details…" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              </div>

              {saveError && (
                <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "8px 12px" }}>
                  {saveError}
                </div>
              )}

              <button onClick={saveEvent} disabled={saving || !title.trim() || !date}
                className="w-full py-2.5 rounded-xl text-sm font-medium mt-1 transition-all"
                style={{ background: saving || !title.trim() || !date ? "rgba(255,255,255,0.15)" : "white", color: saving || !title.trim() || !date ? "rgba(255,255,255,0.4)" : "black", cursor: saving || !title.trim() || !date ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : editingEvent ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
  display: "block", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

function EventCard({ event, onEdit, onDelete }: { event: any; onEdit: () => void; onDelete: () => void }) {
  const d = daysUntil(event.date);
  const cdColor = countdownColor(d, event.type);
  return (
    <div className="flex items-start justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${eventColor(event.type)}` }}>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{event.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {EVENT_TYPES.find(t => t.value === event.type)?.label}
            {event.course && ` · ${event.course.code}`}
          </span>
          <span className="flex items-center gap-0.5" style={{ fontSize: 10, fontWeight: 600, color: cdColor }}>
            <Clock size={9} style={{ flexShrink: 0 }} />{countdownLabel(d)}
          </span>
        </div>
        {event.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{event.description}</div>}
      </div>
      <div className="flex gap-3 ml-3 mt-0.5 shrink-0">
        <button onClick={onEdit} className="opacity-40 hover:opacity-80 transition-opacity"><Pencil size={12} /></button>
        <button onClick={onDelete} className="opacity-40 hover:opacity-80 transition-opacity"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}
