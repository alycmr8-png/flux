"use client";
import useSWR from "swr";
import { FileText, ExternalLink } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SummariesPage() {
  const { data, isLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/cheatsheets`,
    fetcher
  );

  return (
    <div className="p-8">
      <h1 className="font-serif italic text-3xl mb-1">Cheat Sheets</h1>
      <p className="text-[#555] text-sm mb-8">AI-generated summaries from your lectures</p>

      {isLoading && <p className="text-[#444] text-sm">Loading…</p>}

      {!isLoading && !data?.data?.length && (
        <p className="text-[#444] text-sm">No cheat sheets yet. Record a lecture to get started.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.data?.map((cs: any) => (
          <div key={cs.id} className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-medium text-sm">{cs.title}</div>
                <div className="text-[#444] text-xs mt-0.5">{cs.lecture?.course?.code}</div>
              </div>
              {cs.driveUrl && (
                <a href={cs.driveUrl} target="_blank" rel="noopener" className="text-[#555] hover:text-white transition-colors">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <div className="space-y-2">
              {cs.content?.sections?.slice(0, 2).map((s: any, i: number) => (
                <div key={i}>
                  <div className="text-xs font-medium text-[#888] mb-1">{s.heading}</div>
                  {s.bullets?.slice(0, 2).map((b: string, j: number) => (
                    <div key={j} className="flex gap-2 text-xs text-[#555]">
                      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[#333]" />
                      {b}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
