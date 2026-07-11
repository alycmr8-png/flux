"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const PROMPTS = [
  "Explain the Chain Rule the same way my professor did.",
  "Show me where integration by parts was mentioned.",
  "Generate a practice exam from everything we've covered.",
];

export function RotatingPrompts() {
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
        &ldquo;{PROMPTS[idx]}&rdquo;
      </span>
    </div>
  );
}
