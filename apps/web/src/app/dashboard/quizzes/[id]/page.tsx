"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useApiSWRFetcher, useApiFetch } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function QuizPage() {
  const { id } = useParams();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, error, isLoading } = useSWR(`${BASE}/api/quizzes/${id}`, fetcher);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const quiz = data?.data;

  if (isLoading || (!quiz && !error && !data)) {
    return <div className="p-8 text-[#444] text-sm">Loading…</div>;
  }
  if (error || !quiz) {
    return (
      <div className="p-8 max-w-2xl">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 6 }}>Quizzes</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#111110", marginBottom: 16 }}>Quiz not found</h1>
        <p className="text-[#555] text-sm mb-6">This quiz could not be loaded. It may have been deleted or you don't have access.</p>
        <a href="/dashboard/quizzes" className="text-sm text-[#111110] underline underline-offset-2">← Back to quizzes</a>
      </div>
    );
  }

  async function submit() {
    const answerArr = quiz.questions.map((_: any, i: number) => answers[i] ?? -1);
    const json = await apiFetch(`/api/quizzes/${id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answerArr }),
    });
    setResult(json.data);
    setSubmitted(true);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(0,0,0,0.38)", marginBottom: 6 }}>Quiz</div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 30, color: "#111110", marginBottom: 4 }}>{quiz.title}</h1>
        <div className="text-[#555] text-sm">{quiz.questions.length} questions</div>
      </div>

      {submitted && result && (
        <div className="bg-[#f4f4f4] border border-[#e5e5e5] rounded-2xl p-5 mb-8 flex gap-8">
          <div><div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, color: "#111110" }}>{Math.round(result.score)}%</div><div className="text-[#444] text-xs mt-1">Score</div></div>
          <div><div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, color: "#111110" }}>{result.correct}</div><div className="text-[#444] text-xs mt-1">Correct</div></div>
          <div><div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, color: "#111110" }}>{result.total}</div><div className="text-[#444] text-xs mt-1">Total</div></div>
        </div>
      )}

      <div className="space-y-6">
        {quiz.questions.map((q: any, qi: number) => (
          <div key={q.id} className="bg-[#f4f4f4] border border-[#e5e5e5] rounded-2xl p-5">
            <div className="text-xs text-[#444] mb-2">Question {qi + 1}</div>
            <div className="text-sm text-[#222] mb-4 leading-relaxed">{q.question}</div>
            <div className="space-y-2">
              {(q.options as string[]).map((opt, oi) => {
                const selected = answers[qi] === oi;
                const correct = submitted && oi === q.correctIndex;
                const wrong = submitted && selected && oi !== q.correctIndex;
                return (
                  <button
                    key={oi}
                    onClick={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      correct ? "border-black bg-[#e8e8e8] text-black" :
                      wrong ? "border-[#ccc] text-[#999] line-through" :
                      selected ? "border-black text-black" :
                      "border-[#e5e5e5] text-[#555] hover:border-[#ccc]"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${selected || correct ? "bg-black border-black" : "border-[#ccc]"}`} />
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-4 bg-[#fafafa] border border-[#e8e8e8] rounded-xl p-3">
                <div className="text-xs font-medium text-black mb-1">Explanation</div>
                <div className="text-xs text-[#666] leading-relaxed">{q.explanation}</div>
                {q.timestampSeconds && (
                  <div className="text-xs text-[#444] mt-1">
                    From lecture at {Math.floor(q.timestampSeconds / 60)}:{String(q.timestampSeconds % 60).padStart(2, "0")}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!submitted && (
        <button
          onClick={submit}
          className="mt-8 bg-black text-white font-medium px-8 py-3 rounded-full text-sm hover:bg-[#222] transition-colors"
        >
          Submit quiz
        </button>
      )}
    </div>
  );
}
