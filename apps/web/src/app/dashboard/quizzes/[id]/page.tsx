"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function QuizPage() {
  const { id } = useParams();
  const { data } = useSWR(`${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${id}`, fetcher);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const quiz = data?.data;
  if (!quiz) return <div className="p-8 text-[#444] text-sm">Loading…</div>;

  async function submit() {
    const answerArr = quiz.questions.map((_: any, i: number) => answers[i] ?? -1);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answerArr }),
    });
    const json = await res.json();
    setResult(json.data);
    setSubmitted(true);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-serif italic text-3xl mb-1">{quiz.title}</h1>
        <div className="text-[#555] text-sm">{quiz.questions.length} questions</div>
      </div>

      {submitted && result && (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5 mb-8 flex gap-8">
          <div><div className="font-serif text-4xl">{Math.round(result.score)}%</div><div className="text-[#444] text-xs mt-1">Score</div></div>
          <div><div className="font-serif text-4xl">{result.correct}</div><div className="text-[#444] text-xs mt-1">Correct</div></div>
          <div><div className="font-serif text-4xl">{result.total}</div><div className="text-[#444] text-xs mt-1">Total</div></div>
        </div>
      )}

      <div className="space-y-6">
        {quiz.questions.map((q: any, qi: number) => (
          <div key={q.id} className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
            <div className="text-xs text-[#444] mb-2">Question {qi + 1}</div>
            <div className="text-sm text-[#ddd] mb-4 leading-relaxed">{q.question}</div>
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
                      correct ? "border-white bg-[#1a1a1a] text-white" :
                      wrong ? "border-[#333] text-[#444] line-through" :
                      selected ? "border-white text-white" :
                      "border-[#1e1e1e] text-[#555] hover:border-[#333]"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${selected || correct ? "bg-white border-white" : "border-[#333]"}`} />
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3">
                <div className="text-xs font-medium text-white mb-1">Explanation</div>
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
          className="mt-8 bg-white text-black font-medium px-8 py-3 rounded-full text-sm hover:bg-[#e0e0e0] transition-colors"
        >
          Submit quiz
        </button>
      )}
    </div>
  );
}
