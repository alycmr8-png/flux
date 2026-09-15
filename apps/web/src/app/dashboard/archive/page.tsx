"use client";
import { useState } from "react";
import { Archive, Mic2, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import { format } from "date-fns";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const BRAND = "#4B5FE8";
const INK = "#0f1115";
const HAIRLINE = "rgba(0,0,0,0.08)";

// Same class identity as mobile: a solid circle in the class colour with the
// first letter in white. Solid, never a pale tint behind white text.
const classColor = (c: any) => (c?.color as string) || BRAND;
const classInitial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase() || "?";

function ClassBadge({ name, color, size = 36 }: { name?: string; color?: string | null; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: color || BRAND }}>
      <span style={{ color: "#fff", fontSize: Math.round(size * 0.45), fontWeight: 800, lineHeight: 1 }}>{classInitial(name)}</span>
    </span>
  );
}

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
    <div style={{ maxWidth: 760 }}>
      <div className="mb-8">
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND, marginBottom: 8 }}>
          Archive
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.5px", color: INK, marginBottom: 8 }}>
          Archived recordings
        </h1>
        <p style={{ fontSize: 16, color: "rgba(15,17,21, 0.78)" }}>
          Recordings you&apos;ve removed. Restore or permanently delete them.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[18px] animate-pulse" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${HAIRLINE}`, height: 72 }} />
          ))}
        </div>
      ) : lectures.length === 0 ? (
        <div className="rounded-[20px] p-16 text-center" style={{ background: "#FFFFFF", border: `1px solid ${HAIRLINE}` }}>
          <Archive size={34} className="mx-auto mb-4" style={{ color: "rgba(15,17,21, 0.57)" }} />
          <p style={{ fontSize: 16.5, fontWeight: 600, color: INK }}>Archive is empty</p>
          <p style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.75)", marginTop: 6 }}>Deleted recordings will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.values(byCourse).map(({ course, items }) => {
            const tint = classColor(course);
            return (
              <div key={course?.id ?? "unknown"}>
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <ClassBadge name={course?.name} color={tint} size={28} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{course?.name ?? "Unknown class"}</span>
                  {course?.code && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(15,17,21, 0.75)" }}>{course.code}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map(l => (
                    <div
                      key={l.id}
                      className="rounded-[18px] px-5 py-4 transition-colors"
                      style={{
                        background: "#FFFFFF",
                        border: `1px solid ${confirmDeleteId === l.id ? "rgba(239,68,68,0.35)" : HAIRLINE}`,
                        borderLeft: `5px solid ${confirmDeleteId === l.id ? "#ef4444" : tint}`,
                      }}
                    >
                      {confirmDeleteId === l.id ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="flex-1" style={{ fontSize: 15.5, color: "rgba(15,17,21, 0.8)" }}>
                            Permanently delete <span style={{ fontWeight: 700, color: INK }}>&quot;{l.title}&quot;</span>? This cannot be undone.
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-xl px-3.5 py-2"
                              style={{ fontSize: 15, fontWeight: 600, background: "rgba(0,0,0,0.05)", color: "rgba(15,17,21, 0.8)" }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => permanentlyDelete(l.id)}
                              className="rounded-xl px-3.5 py-2"
                              style={{ fontSize: 15, fontWeight: 700, background: "#ef4444", color: "white" }}
                            >
                              Delete forever
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.04)" }}>
                            <Mic2 size={15} style={{ color: "rgba(15,17,21, 0.73)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate" style={{ fontSize: 16, fontWeight: 600, color: INK }}>{l.title}</div>
                            <div style={{ fontSize: 15, color: "rgba(15,17,21, 0.75)", marginTop: 2 }}>
                              {format(new Date(l.recordedAt), "MMM d, yyyy")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => restore(l.id)}
                              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-colors hover:bg-[rgba(0,0,0,0.06)]"
                              style={{ fontSize: 15, fontWeight: 600, background: "rgba(0,0,0,0.04)", color: INK }}
                            >
                              <RotateCcw size={13} />
                              Restore
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(l.id)}
                              className="p-2 rounded-xl transition-colors hover:bg-red-50"
                              style={{ color: "rgba(15,17,21, 0.65)" }}
                              title="Permanently delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
