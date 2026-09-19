"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTr } from "@/lib/useTr";

// Kept in English here and translated where they are shown — a module constant
// is built before any component runs, so the hook is not available yet.
const PROMPTS = [
  "Turn today's lecture into study notes.",
  "Summarize the key points from Chapter 4.",
  "Generate a practice quiz from my notes.",
];

export function RotatingPrompts() {
  const tr = useTr();
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % PROMPTS.length);
        setVisible(true);
      }, 350);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full"
      style={{
        background: "rgba(75,95,232,0.06)",
        border: "1px solid rgba(75,95,232,0.18)",
        maxWidth: "100%",
      }}
    >
      <Sparkles size={14} style={{ color: "#4B5FE8", flexShrink: 0 }} />
      <span
        className="text-sm md:text-base"
        style={{
          color: "rgba(0,0,0,0.6)",
          fontStyle: "italic",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.35s ease",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        &ldquo;{tr(PROMPTS[idx])}&rdquo;
      </span>
    </div>
  );
}
