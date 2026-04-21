"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProgressPage() {
  const { data, isLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/progress`,
    fetcher
  );

  const p = data?.data;

  return (
    <div className="p-8">
      <h1 className="font-serif italic text-3xl mb-1">Progress</h1>
      <p className="text-[#555] text-sm mb-8">This semester</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Lectures recorded", value: p?.lectureCount ?? "—" },
          { label: "Avg quiz score", value: p?.avgScore ? `${p.avgScore}%` : "—" },
          { label: "Day streak", value: p?.streak ?? "—" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
            <div className="font-serif text-4xl text-white mb-1">{isLoading ? "—" : s.value}</div>
            <div className="text-[#555] text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6">
        <div className="text-xs text-[#444] uppercase tracking-widest mb-5">Retention by course</div>
        {!p?.courseRetention?.length && (
          <p className="text-[#444] text-sm">Complete quizzes to see your retention scores.</p>
        )}
        <div className="space-y-4">
          {p?.courseRetention?.map((c: any) => (
            <div key={c.code}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-[#888]">{c.code} — {c.name}</span>
                <span className="text-xs text-white">{c.avg}%</span>
              </div>
              <div className="h-0.5 bg-[#1e1e1e] rounded">
                <div className="h-0.5 bg-white rounded" style={{ width: `${c.avg}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
