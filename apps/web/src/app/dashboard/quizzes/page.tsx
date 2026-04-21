"use client";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function QuizzesPage() {
  const { data, isLoading } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes`,
    fetcher
  );

  return (
    <div className="p-8">
      <h1 className="font-serif italic text-3xl mb-1">Practice Quizzes</h1>
      <p className="text-[#555] text-sm mb-8">Generated from your own lecture notes</p>

      {isLoading && <p className="text-[#444] text-sm">Loading…</p>}

      {!isLoading && !data?.data?.length && (
        <p className="text-[#444] text-sm">No quizzes yet. Record a lecture to get started.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.data?.map((quiz: any) => (
          <Link
            key={quiz.id}
            href={`/dashboard/quizzes/${quiz.id}`}
            className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5 hover:border-[#333] transition-colors block"
          >
            <div className="font-medium text-sm mb-1">{quiz.title}</div>
            <div className="text-[#444] text-xs mb-4">{quiz.lecture?.course?.code}</div>
            <div className="flex items-center gap-4 text-xs text-[#555]">
              <span>{quiz._count?.questions} questions</span>
              <span>{quiz._count?.attempts} attempts</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
