"use client";

const UNIVERSITIES = [
  // serif italic — classic/prestigious
  { name: "Harvard",       style: "serif-italic",   size: "2.6rem" },
  { name: "UC San Diego",  style: "mixed",          size: "2.4rem" },
  { name: "UC DAVIS",      style: "bold-caps",      size: "2.2rem" },
  { name: "UCSB",          style: "condensed-caps", size: "2.8rem" },
  { name: "Stanford",      style: "serif-italic",   size: "2.6rem" },
  { name: "UCLA",          style: "bold-caps",      size: "2.8rem" },
  { name: "MIT",           style: "condensed-caps", size: "3rem"   },
  { name: "NYU",           style: "bold-caps",      size: "3rem"   },
  { name: "Caltech",       style: "serif-italic",   size: "2.5rem" },
  { name: "UC Berkeley",   style: "mixed",          size: "2.3rem" },
  { name: "Columbia",      style: "serif-italic",   size: "2.5rem" },
  { name: "Cornell",       style: "bold-caps",      size: "2.4rem" },
  { name: "Georgetown",    style: "serif-italic",   size: "2.4rem" },
  { name: "Yale",          style: "condensed-caps", size: "3rem"   },
];

const ITEMS = [...UNIVERSITIES, ...UNIVERSITIES, ...UNIVERSITIES];

function UniLabel({ name, style, size }: { name: string; style: string; size: string }) {
  const base: React.CSSProperties = { fontSize: size, lineHeight: 1, whiteSpace: "nowrap", cursor: "default" };

  if (style === "serif-italic") return (
    <span style={{ ...base, fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", fontWeight: 500, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.5px" }}>
      {name}
    </span>
  );

  if (style === "bold-caps") return (
    <span style={{ ...base, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontWeight: 900, textTransform: "uppercase", color: "white", letterSpacing: "-1px" }}>
      {name}
    </span>
  );

  if (style === "condensed-caps") return (
    <span style={{ ...base, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.82)" }}>
      {name}
    </span>
  );

  // mixed: "UC" light + rest bold
  const parts = name.split(" ");
  const prefix = parts[0];
  const rest = parts.slice(1).join(" ");
  return (
    <span style={{ ...base, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: "white" }}>
      <span style={{ fontWeight: 300, letterSpacing: "0.05em" }}>{prefix} </span>
      <span style={{ fontWeight: 900, letterSpacing: "-0.5px" }}>{rest}</span>
    </span>
  );
}

export function UniversityTicker() {
  return (
    <div className="w-full py-14">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] mb-8" style={{ color: "rgba(255,255,255,0.3)" }}>
        Trusted by students at
      </p>

      <div className="relative overflow-hidden">
        {/* fade edges */}
        <div className="absolute inset-y-0 left-0 w-40 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #0a0a0a, transparent)" }} />
        <div className="absolute inset-y-0 right-0 w-40 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #0a0a0a, transparent)" }} />

        <div className="animate-marquee flex items-center">
          {ITEMS.map((u, i) => (
            <span key={i} className="inline-flex items-center shrink-0" style={{ gap: "3rem", paddingRight: "3rem" }}>
              <UniLabel {...u} />
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0, display: "inline-block" }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
