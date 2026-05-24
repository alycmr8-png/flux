"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useApiFetch } from "@/lib/apiFetch";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What do I have coming up this week?",
  "Quiz me on my most recent lecture",
  "Summarize what I've learned in Psychology",
  "What are my most important upcoming deadlines?",
  "Explain the key terms from my last study book",
  "Help me make a study plan for my next exam",
];

export default function TutorPage() {
  const apiFetch = useApiFetch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await apiFetch("/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages.slice(-10) }),
      });
      setMessages([...next, { role: "assistant", content: res.data.reply }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto" style={{ minHeight: "calc(100vh - 80px)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.15)" }}>
              <Sparkles size={15} style={{ color: "#3b82f6" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
              Flux Tutor
            </h1>
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Ask anything about your lectures, notes, calendar, or quizzes.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <RotateCcw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Messages or starters */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <Sparkles size={28} style={{ color: "#3b82f6" }} />
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Your personal tutor with access to all your study materials.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {STARTERS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl text-sm transition-all hover:border-[rgba(37,99,235,0.4)]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-1" style={{ background: "rgba(37,99,235,0.15)" }}>
                  <Sparkles size={13} style={{ color: "#3b82f6" }} />
                </div>
              )}
              <div
                className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={m.role === "user"
                  ? { background: "#2563eb", color: "white", borderBottomRightRadius: 6 }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(37,99,235,0.15)", borderBottomLeftRadius: 6 }
                }
              >
                {m.role === "assistant"
                  ? <ReactMarkdown
                      components={{
                        strong: ({ children }) => <strong style={{ color: "white" }}>{children}</strong>,
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                        code: ({ children }) => <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(37,99,235,0.2)", color: "#60a5fa" }}>{children}</code>,
                      }}
                    >{m.content}</ReactMarkdown>
                  : m.content
                }
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-1" style={{ background: "rgba(37,99,235,0.15)" }}>
              <Sparkles size={13} style={{ color: "#3b82f6" }} />
            </div>
            <div className="px-4 py-3 rounded-2xl flex items-center gap-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(37,99,235,0.15)" }}>
              <Loader2 size={14} className="animate-spin" style={{ color: "#3b82f6" }} />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex gap-2 items-end rounded-2xl p-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask your tutor anything…"
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm px-2 py-1.5"
            style={{ color: "white", maxHeight: 120 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
            style={{ background: "#2563eb" }}
          >
            <Send size={15} style={{ color: "white" }} />
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
          Has access to your lectures, notes, calendar, and quizzes
        </p>
      </div>
    </div>
  );
}
