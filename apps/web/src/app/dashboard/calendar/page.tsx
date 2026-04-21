"use client";
import useSWR from "swr";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CalendarPage() {
  const [month, setMonth] = useState(new Date());
  const { data } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/sessions?from=${startOfMonth(month).toISOString()}&to=${endOfMonth(month).toISOString()}`,
    fetcher
  );

  const sessions = data?.data ?? [];
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  function hasSessions(day: Date) {
    return sessions.some((s: any) => isSameDay(new Date(s.scheduledAt), day));
  }

  async function connectGoogle() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/calendar/auth-url`);
    const { data } = await res.json();
    window.location.href = data.url;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif italic text-3xl mb-1">Schedule</h1>
          <p className="text-[#555] text-sm">AI-scheduled review sessions</p>
        </div>
        <button
          onClick={connectGoogle}
          className="border border-[#333] text-sm px-5 py-2 rounded-full hover:border-white transition-colors"
        >
          Connect Google Calendar
        </button>
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="text-[#555] hover:text-white text-sm">←</button>
          <div className="text-sm font-medium">{format(month, "MMMM yyyy")}</div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="text-[#555] hover:text-white text-sm">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} className="text-[#333] text-xs py-1">{d}</div>
          ))}
          {Array.from({ length: startOfMonth(month).getDay() }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`text-xs py-2 rounded-full relative ${
                isToday(day) ? "bg-white text-black font-semibold" : "text-[#555]"
              }`}
            >
              {format(day, "d")}
              {hasSessions(day) && !isToday(day) && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs text-[#444] uppercase tracking-widest mb-4">Upcoming sessions</div>
        {!sessions.length && <p className="text-[#444] text-sm">No sessions scheduled. Process a lecture to auto-schedule reviews.</p>}
        {sessions.map((s: any) => (
          <div key={s.id} className="flex gap-4 items-start">
            <div className="text-[#333] text-xs w-10 pt-1 text-right shrink-0">
              {format(new Date(s.scheduledAt), "h'a'")}
            </div>
            <div className="w-px bg-[#222] self-stretch" />
            <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-3">
              <div className="text-sm font-medium text-[#ddd]">{s.lecture?.title}</div>
              <div className="text-xs text-[#444] mt-0.5 capitalize">{s.type} · {s.lecture?.course?.code}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
