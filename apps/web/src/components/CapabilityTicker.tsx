"use client";
import { Mic, Play, Camera, FileEdit, Zap, PenLine, Calendar, Globe, Sparkles } from "lucide-react";

// Notion-style capability strip: playful icon tiles in a slow marquee.
// Every chip is a true statement about the product — no borrowed logos.

const CAPS = [
  { icon: Mic,           label: "Record any lecture",   color: "#4B5FE8", tint: "rgba(75,95,232,0.1)" },
  { icon: Play,          label: "Answers with receipts", color: "#6E7FF3", tint: "rgba(110,127,243,0.1)" },
  { icon: Camera,        label: "Photos of your notes",  color: "#DC2626", tint: "rgba(220,38,38,0.08)" },
  { icon: Zap,           label: "Live transcript", color: "#EF4444", tint: "rgba(239,68,68,0.08)" },
  { icon: FileEdit,      label: "Reads the whiteboard",      color: "#EA580C", tint: "rgba(234,88,12,0.09)" },
  { icon: PenLine,       label: "Flashcards & quizzes",     color: "#9333EA", tint: "rgba(147,51,234,0.09)" },
  { icon: Calendar,      label: "Deadlines synced",     color: "#0891B2", tint: "rgba(8,145,178,0.09)" },
  { icon: Globe,         label: "5 languages",   color: "#4B5FE8", tint: "rgba(75,95,232,0.1)" },
  { icon: Sparkles,      label: "Maths written properly", color: "#6E7FF3", tint: "rgba(110,127,243,0.1)" },
];

function Chip({ icon: Icon, label, color, tint }: (typeof CAPS)[number]) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-5 py-3 shrink-0"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint }}>
        <Icon size={18} style={{ color }} />
      </span>
      <span className="whitespace-nowrap" style={{ fontSize: 14, fontWeight: 600, color: "#191918" }}>{label}</span>
    </div>
  );
}

export function CapabilityTicker() {
  return (
    <div className="w-full py-10">
      <div className="relative overflow-hidden">
        {/* soft fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10" style={{ background: "linear-gradient(90deg, #ffffff, rgba(255,255,255,0))" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10" style={{ background: "linear-gradient(270deg, #ffffff, rgba(255,255,255,0))" }} />
        <div className="animate-marquee gap-4 pr-4">
          {[...CAPS, ...CAPS].map((c, i) => (
            <Chip key={i} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}
