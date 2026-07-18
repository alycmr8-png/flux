"use client";
import { useEffect, useRef, useState } from "react";

// The landing page's recurring character: a student with an afro who reacts
// to each section in Gen-Z. HeroQuote cycles panic quotes in the hero;
// DemoQuote pins one reaction beside a demo and pops in on scroll.

export function AfroFace({ size = 24 }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="7.6" r="6.4" fill="#241F1A" />
      <circle cx="5.9" cy="9.6" r="3.2" fill="#241F1A" />
      <circle cx="18.1" cy="9.6" r="3.2" fill="#241F1A" />
      <circle cx="12" cy="12" r="5" fill="#A9714B" />
      <circle cx="10.2" cy="11.4" r="0.7" fill="#241F1A" />
      <circle cx="13.8" cy="11.4" r="0.7" fill="#241F1A" />
      <path d="M10 14c1.2 1.1 2.8 1.1 4 0" stroke="#241F1A" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <path d="M3.8 22.5c0-3.9 3.4-6.2 8.2-6.2s8.2 2.3 8.2 6.2" fill="#4B5FE8" />
    </svg>
  );
}

export function DemoQuote({ quote, side = "right", top = 18 }: { quote: string; side?: "left" | "right"; top?: number }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setShow(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="hidden lg:flex absolute z-10 items-start gap-2 pointer-events-none"
      style={{ top, [side]: -30, flexDirection: side === "left" ? "row" : "row-reverse" } as React.CSSProperties}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
          transform: show
            ? `rotate(${side === "left" ? -6 : 6}deg) scale(1)`
            : `rotate(${side === "left" ? -6 : 6}deg) scale(0.6)`,
          opacity: show ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,6,0.12)" }}>
          <AfroFace size={28} />
        </span>
      </div>
      <div
        style={{
          position: "relative",
          marginTop: -14,
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.1)",
          borderRadius: 16,
          [side === "left" ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 4,
          padding: "9px 13px",
          maxWidth: 210,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "#191918",
          textAlign: "left",
          transformOrigin: side === "left" ? "bottom left" : "bottom right",
          transform: show ? "scale(1) translateY(0)" : "scale(0.7) translateY(8px)",
          opacity: show ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s",
        } as React.CSSProperties}
      >
        {quote}
      </div>
    </div>
  );
}

const QUOTES = [
  "I'm cooked 😭 my notes are everywhere",
  "week 9 and I know NOTHING",
  "the final is in 3 days… it's giving panic",
  "what did the prof even say in lecture 4 💀",
];

export function HeroQuote() {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // pop in shortly after load, then rotate quotes
    const first = setTimeout(() => setShow(true), 700);
    const cycle = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI(x => (x + 1) % QUOTES.length);
        setShow(true);
      }, 350);
    }, 4600);
    return () => { clearTimeout(first); clearInterval(cycle); };
  }, []);

  return (
    <div className="hidden lg:block absolute pointer-events-none" style={{ top: 70, left: -72, zIndex: 5 }}>
      <div
        style={{
          position: "relative",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 28px rgba(0,0,0,0.1)",
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          padding: "9px 13px",
          maxWidth: 200,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "#191918",
          textAlign: "left",
          transformOrigin: "bottom left",
          transform: show ? "scale(1) translateY(0)" : "scale(0.8) translateY(6px)",
          opacity: show ? 1 : 0,
          transition: "all 0.34s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {QUOTES[i]}
        {/* tail pointing down at the avatar */}
        <span
          style={{
            position: "absolute",
            left: 12,
            bottom: -5,
            width: 10,
            height: 10,
            background: "#FFFFFF",
            borderLeft: "1px solid rgba(0,0,0,0.08)",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            transform: "rotate(-45deg)",
          }}
        />
      </div>
    </div>
  );
}
