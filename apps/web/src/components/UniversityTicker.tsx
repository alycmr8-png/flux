"use client";
import { useState } from "react";

const UNIVERSITIES = [
  { name: "Harvard",     color: "#A51C30" },
  { name: "Stanford",    color: "#8C1515" },
  { name: "MIT",         color: "#A31F34" },
  { name: "NYU",         color: "#57068C" },
  { name: "Cornell",     color: "#B31B1B" },
  { name: "Columbia",    color: "#003087" },
  { name: "Yale",        color: "#00356B" },
  { name: "CUNY",        color: "#003366" },
  { name: "Stony Brook", color: "#CC0000" },
  { name: "UCLA",        color: "#2774AE" },
  { name: "UC Berkeley", color: "#003262" },
  { name: "Georgetown",  color: "#041E42" },
];

const ITEMS = [...UNIVERSITIES, ...UNIVERSITIES];

function UniName({ name, color }: { name: string; color: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="whitespace-nowrap cursor-default"
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontStyle: "italic",
        fontSize: "2.5rem",
        fontWeight: 400,
        color: hovered ? color : "rgba(255,255,255,0.45)",
        transition: "color 250ms ease",
        letterSpacing: "-0.5px",
      }}
    >
      {name}
    </span>
  );
}

export function UniversityTicker() {
  return (
    <div className="w-full">
      <div className="text-[9px] uppercase tracking-widest text-center mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
        Used by students at
      </div>
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-32 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, #2D0E05, transparent)" }}
        />
        <div
          className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, #2D0E05, transparent)" }}
        />
        <div className="animate-marquee">
          {ITEMS.map((uni, i) => (
            <span key={i} className="inline-flex items-center gap-10 px-10">
              <UniName name={uni.name} color={uni.color} />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "rgba(255,255,255,0.18)" }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
