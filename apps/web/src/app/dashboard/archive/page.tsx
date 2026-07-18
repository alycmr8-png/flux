"use client";
import { useState } from "react";
import { Archive, Mic2, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { format } from "date-fns";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function ArchivePage() {
  const { userId } = useAuth();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();

  const { data, mutate, isLoading } = useSWR(
    userId ? `${BASE}/api/lectures?archived=true` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const lectures: any[] = data?.data ?? [];

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function restore(id: string) {
    await apiFetch(`/api/lectures/${id}/restore`, { method: "PATCH" });
    mutate();
  }

  async function permanentlyDelete(id: string) {
    await apiFetch(`/api/lectures/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    mutate();
  }

  // Group by course
  const byCourse = lectures.reduce<Record<string, { course: any; items: any[] }>>((acc, l) => {
    const key = l.courseId;
    if (!acc[key]) acc[key] = { course: l.course, items: [] };
    acc[key].items.push(l);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif italic text-3xl mb-1">Archive</h1>
        <p className="text-sm text-gray-600">Recordings you've removed. Restore or permanently delete them.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : lectures.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-16 text-center">
          <Archive size={32} className="mx-auto mb-4" style={{ color: "#A8A29E" }} />
          <p className="text-sm text-gray-600 font-medium">Archive is empty</p>
          <p className="text-xs text-gray-500 mt-1">Deleted recordings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(byCourse).map(({ course, items }) => (
            <div key={course?.id ?? "unknown"}>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 px-1">
                {course?.name ?? "Unknown class"}
              </div>
              <div className="space-y-2">
                {items.map(l => (
                  <div
                    key={l.id}
                    className="bg-[#FFFFFF] border rounded-xl px-4 py-3 transition-all"
                    style={{ borderColor: confirmDeleteId === l.id ? "rgba(239,68,68,0.3)" : "rgba(0,0,0,0.08)" }}
                  >
                    {confirmDeleteId === l.id ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-600 flex-1">
                          Permanently delete <span className="font-medium text-gray-900">"{l.title}"</span>? This cannot be undone.
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-3 py-1.5 rounded-lg"
                            style={{ background: "rgba(0,0,0,0.05)", color: "#6B7280" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => permanentlyDelete(l.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: "#ef4444", color: "white" }}
                          >
                            Delete forever
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.04)" }}>
                          <Mic2 size={12} style={{ color: "#bbb" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: "#6B7280" }}>{l.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: "#bbb" }}>
                            {format(new Date(l.recordedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => restore(l.id)}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[#F1F0EE]"
                            style={{ background: "rgba(0,0,0,0.05)", color: "#1F2328" }}
                          >
                            <RotateCcw size={11} />
                            Restore
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(l.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: "rgba(0,0,0,0.25)" }}
                            title="Permanently delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
