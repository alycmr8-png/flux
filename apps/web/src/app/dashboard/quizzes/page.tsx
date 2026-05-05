"use client";
import useSWR from "swr";
import Link from "next/link";
import { useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function QuizzesPage() {
  const fetcher = useApiSWRFetcher();
  const { data, isLoading } = useSWR(`${BASE}/api/quizzes`, fetcher);
  const quizzes = data?.data ?? [];

  return (
    <div className="p-8 max-w-2xl">
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Quizzes</div>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 30, fontWeight: 400, color: "white", marginBottom: 28 }}>All Quizzes</h1>

      {isLoading && <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>}
      {!isLoading && !quizzes.length && (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No quizzes yet. Use the Workspace to generate one.</p>
      )}

      <div className="space-y-3">
        {quizzes.map((quiz: any) => (
          <Link
            key={quiz.id}
            href={`/dashboard/quizzes/${quiz.id}`}
            className="rounded-2xl p-5 border block transition-all hover:border-white/20"
            style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium text-sm mb-1" style={{ color: "white" }}>{quiz.title}</div>
                {quiz.lecture?.course?.code && (
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{quiz.lecture.course.code} · {quiz.lecture?.course?.name}</div>
                )}
              </div>
              <span className="text-lg" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] rounded-full px-2.5 py-1" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                {quiz._count?.questions ?? 0} questions
              </span>
              {quiz._count?.attempts > 0 && (
                <span className="text-[10px] rounded-full px-2.5 py-1" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                  {quiz._count.attempts} attempts
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
