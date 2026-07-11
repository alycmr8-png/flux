"use client";
import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

const TYPE_COLOR: Record<string, string> = {
  exam: "#ef4444",
  assignment: "#f97316",
  deadline: "#eab308",
  quiz: "#a855f7",
  class: "#6E7FF3",
};

const BASE_EVENTS: Record<number, { type: string; label: string; course: string }[]> = {
  7:  [{ type: "assignment", label: "Essay Draft Due",  course: "ENG 201"  }],
  12: [{ type: "quiz",       label: "Pop Quiz",         course: "PSYC 301" }],
  16: [{ type: "exam",       label: "Midterm Exam",     course: "PSYC 301" }],
  21: [{ type: "deadline",   label: "Lab Report",       course: "BIO 110"  }],
  28: [{ type: "exam",       label: "Final Exam",       course: "BIO 110"  }],
};

// Animation phases
// 0 â†’ select day 16 (Midterm)        2.5s
// 1 â†’ select day 28 (Final)          2.5s
// 2 â†’ select day 7  (Assignment)     2.5s
// 3 â†’ open add-event modal           1s
// 4 â†’ type title char by char        3s
// 5 â†’ close modal, dot appears       1s
// 6 â†’ select new event day 24        2.5s
// loop

const PHASES = [
  { kind: "select",  day: 16,  duration: 2500 },
  { kind: "select",  day: 28,  duration: 2500 },
  { kind: "select",  day: 7,   duration: 2500 },
  { kind: "modal",   day: 24,  duration: 800  },
  { kind: "typing",  day: 24,  duration: 3200 },
  { kind: "commit",  day: 24,  duration: 1000 },
  { kind: "select",  day: 24,  duration: 2500 },
];

const NEW_TITLE = "Study Group Session";
const NEW_EVENT = { type: "class", label: "Study Group Session", course: "PSYC 301" };

export function CalendarShowcase() {
  const [phase, setPhase] = useState(0);
  const [selectedDay, setSelectedDay] = useState(16);
  const [showModal, setShowModal] = useState(false);
  const [typedTitle, setTypedTitle] = useState("");
  const [extraEvents, setExtraEvents] = useState<Record<number, { type: string; label: string; course: string }[]>>({});

  const allEvents = { ...BASE_EVENTS, ...extraEvents };

  useEffect(() => {
    const p = PHASES[phase];
    const timer = setTimeout(() => {
      const next = (phase + 1) % PHASES.length;

      if (p.kind === "select") {
        setSelectedDay(p.day);
        setShowModal(false);
      } else if (p.kind === "modal") {
        setShowModal(true);
        setTypedTitle("");
        setSelectedDay(p.day);
      } else if (p.kind === "typing") {
        // typing handled by sub-effect below
      } else if (p.kind === "commit") {
        setShowModal(false);
        setExtraEvents(prev => ({
          ...prev,
          [PHASES[phase - 1]?.day ?? 24]: [NEW_EVENT],
        }));
      }

      setPhase(next);
    }, p.duration);

    return () => clearTimeout(timer);
  }, [phase]);

  // Typing animation during "typing" phase
  useEffect(() => {
    if (PHASES[phase]?.kind !== "typing") return;
    if (typedTitle.length >= NEW_TITLE.length) return;
    const t = setTimeout(() => {
      setTypedTitle(NEW_TITLE.slice(0, typedTitle.length + 1));
    }, 80);
    return () => clearTimeout(t);
  }, [phase, typedTitle]);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const startPad = 5; // May 2026 starts Thursday (index 4), Friday=5 for visual
  const selectedEvents = allEvents[selectedDay] ?? [];

  const upcoming = Object.entries(allEvents)
    .flatMap(([d, evts]) => evts.map(e => ({ ...e, day: Number(d) })))
    .sort((a, b) => a.day - b.day)
    .slice(0, 5);

  return (
    <section className="relative py-28 px-6 overflow-hidden" style={{ background: "#ffffff" }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(139,92,246,0.08) 0%, transparent 70%)",
      }} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="text-sm uppercase tracking-[0.2em] mb-4 font-semibold" style={{ color: "#6E7FF3" }}>
            Stay ahead
          </div>
          <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Never miss an exam<br />or deadline again.
          </h2>
          <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: "rgba(0,0,0,0.5)" }}>
            Schedule exams, assignments and deadlines.<br />Color-coded, always visible.
          </p>
        </div>

        {/* Calendar UI */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.12)" }}
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
            <span className="ml-4 text-xs" style={{ color: "rgba(0,0,0,0.3)" }}>Flux — Calendar</span>
          </div>

          <div className="flex" style={{ minHeight: 480 }}>
            {/* Calendar grid */}
            <div className="flex-1 p-8">
              <div className="flex items-center justify-between mb-6">
                <span style={{ fontSize: 18, fontWeight: 500, color: "#0f1115" }}>May 2026</span>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                  style={{ background: "#4B5FE8", color: "white" }}
                >
                  <Plus size={13} /> Add event
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-3">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, color: "rgba(0,0,0,0.25)", paddingBottom: 8 }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map(d => {
                  const evts = allEvents[d] ?? [];
                  const isSelected = selectedDay === d;
                  const isToday = d === 4;
                  const isNew = d === 24 && extraEvents[24];
                  return (
                    <div
                      key={d}
                      className="relative flex flex-col items-center py-2 rounded-xl"
                      style={{
                        background: isSelected
                          ? "rgba(75,95,232,0.12)"
                          : isToday
                          ? "rgba(0,0,0,0.05)"
                          : "transparent",
                        outline: isSelected ? "1px solid #4B5FE8" : isToday ? "1px solid rgba(0,0,0,0.15)" : "none",
                        transition: "background 0.3s",
                      }}
                    >
                      <span style={{
                        fontSize: 13,
                        fontWeight: isSelected || isToday ? 600 : 400,
                        color: isSelected ? "#4B5FE8" : isToday ? "#0f1115" : "rgba(0,0,0,0.6)",
                      }}>
                        {d}
                      </span>
                      {evts.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {evts.slice(0, 2).map((e, i) => (
                            <span
                              key={i}
                              style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: TYPE_COLOR[e.type] ?? "#6b7280",
                                display: "inline-block",
                                animation: isNew && i === 0 ? "popIn 0.4s ease" : "none",
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-6">
                {Object.entries(TYPE_COLOR).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.35)", textTransform: "capitalize" }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div
              className="w-72 flex flex-col gap-4 p-6"
              style={{ borderLeft: "1px solid rgba(0,0,0,0.07)" }}
            >
              {/* Selected day */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0f1115" }}>May {selectedDay}</span>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={{ background: "rgba(0,0,0,0.08)", color: "rgba(0,0,0,0.5)" }}
                  >
                    {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {selectedEvents.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(0,0,0,0.3)" }}>No events scheduled.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedEvents.map((e, i) => (
                      <div
                        key={i}
                        className="rounded-xl px-3 py-2.5"
                        style={{
                          borderLeft: `3px solid ${TYPE_COLOR[e.type] ?? "#6b7280"}`,
                          background: "rgba(0,0,0,0.04)",
                          animation: "fadeSlide 0.35s ease",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#0f1115" }}>{e.label}</div>
                        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 2, textTransform: "capitalize" }}>
                          {e.type} · {e.course}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming */}
              <div
                className="rounded-2xl p-4 flex-1"
                style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(0,0,0,0.28)", marginBottom: 12 }}>
                  Upcoming
                </p>
                <div className="flex flex-col gap-2.5">
                  {upcoming.map((e, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div style={{ textAlign: "right", minWidth: 28 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f1115", lineHeight: 1 }}>{e.day}</div>
                        <div style={{ fontSize: 9, color: "rgba(0,0,0,0.3)", textTransform: "uppercase" }}>May</div>
                      </div>
                      <div
                        className="flex-1 rounded-lg px-2.5 py-1.5"
                        style={{ borderLeft: `2px solid ${TYPE_COLOR[e.type] ?? "#6b7280"}`, background: "rgba(0,0,0,0.03)" }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(0,0,0,0.85)" }}>{e.label}</div>
                        <div style={{ fontSize: 10, color: "rgba(0,0,0,0.35)" }}>{e.course}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Add event modal overlay */}
          {showModal && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", animation: "fadeIn 0.25s ease" }}
            >
              <div
                className="w-80 rounded-2xl p-6"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.12)", animation: "scaleIn 0.25s ease" }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span style={{ fontSize: 15, fontWeight: 500, color: "#0f1115" }}>Add event</span>
                  <X size={15} style={{ color: "rgba(0,0,0,0.35)" }} />
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 6 }}>Title</div>
                    <div
                      className="w-full rounded-xl px-3 py-2.5 text-sm flex items-center"
                      style={{ background: "rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.15)", color: "#0f1115", minHeight: 40 }}
                    >
                      {typedTitle}
                      <span className="ml-0.5 inline-block w-px h-4 align-middle" style={{ background: "#4B5FE8", animation: "blink 1s infinite" }} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 6 }}>Type</div>
                      <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.15)", color: "rgba(110,127,243,1)" }}>Class</div>
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 6 }}>Date</div>
                      <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.15)", color: "rgba(0,0,0,0.7)" }}>May 24</div>
                    </div>
                  </div>
                  <div
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-center mt-1"
                    style={{ background: "#4B5FE8", color: "white" }}
                  >
                    Save event
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn  { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeSlide{ from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes popIn    { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.4) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes blink    { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </section>
  );
}

