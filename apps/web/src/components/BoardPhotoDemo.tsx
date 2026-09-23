"use client";
import { useEffect, useState } from "react";
import { Camera, Check, Loader2, Mic2, Sparkles } from "lucide-react";
import { FormulaText } from "@/components/MathText";
import { useTr } from "@/lib/useTr";

/**
 * The board photo, attached to the recording.
 *
 * This is the step nothing else on the page shows: the professor fills the board,
 * the student photographs it, and Ucorns reads the handwriting into the *same*
 * lecture as real notation — so the summary and quiz cover what was written but
 * never said out loud.
 *
 * The board is deliberately crowded, the way a real one is by the end of an hour;
 * the panel beside it is deliberately tidy. That contrast is the product.
 */

const LECTURE = "Lecture 4 — The Cardiac Cycle";
const CLASS_COLOR = "#4B5FE8";
const MARKER = "#1B2A6B";
const MARKER_RED = "#B3261E";

type Line = { text: string; size?: number; tilt?: number; red?: boolean; rule?: boolean };

// Left of the board: the numbers. The abbreviations are translated too — a French
// course writes DC = FC × VES, not CO = HR × SV.
const BOARD_LEFT: Line[] = [
  { text: "Cardiac output", size: 23, tilt: -1.1, rule: true },
  { text: "CO = HR × SV", size: 27, tilt: 0.5 },
  { text: "SV = EDV − ESV", size: 21, tilt: -0.4 },
  { text: "EF = SV/EDV × 100", size: 21, tilt: 0.7 },
  { text: "MAP = DBP + ⅓(SBP−DBP)", size: 20, tilt: -0.6 },
  { text: "normal ≈ 5 L/min", size: 19, tilt: 0.9, red: true },
];

// Right of the board: the sequence, in the shorthand a lecturer actually uses.
const BOARD_RIGHT: Line[] = [
  { text: "Cycle — 5 phases", size: 22, tilt: 0.8, rule: true },
  { text: "1. atrial systole", size: 18, tilt: -0.3 },
  { text: "2. isovol. contraction", size: 18, tilt: 0.4 },
  { text: "3. ventric. ejection", size: 18, tilt: -0.5 },
  { text: "4. isovol. relaxation", size: 18, tilt: 0.3 },
  { text: "5. filling", size: 18, tilt: -0.2 },
  { text: "↑ preload → ↑ SV", size: 19, tilt: 1.1 },
  { text: "S1 = AV valves shut", size: 17, tilt: -0.6 },
  { text: "S2 = SL valves shut", size: 17, tilt: 0.5 },
  { text: "know this!!", size: 22, tilt: 1.6, red: true },
];

// What Ucorns gets back out of it — the same board, organised.
type ReadItem = { kind: "heading" | "math" | "list" | "note"; value: string; items?: string[] };
const READ: ReadItem[] = [
  { kind: "heading", value: "Cardiac output" },
  { kind: "math", value: "\\text{CO} = \\text{HR} \\times \\text{SV}" },
  { kind: "math", value: "\\text{SV} = \\text{EDV} - \\text{ESV}" },
  { kind: "math", value: "\\text{MAP} = \\text{DBP} + \\tfrac{1}{3}(\\text{SBP} - \\text{DBP})" },
  {
    kind: "list",
    value: "The five phases",
    items: [
      "Atrial systole",
      "Isovolumetric contraction",
      "Ventricular ejection",
      "Isovolumetric relaxation",
      "Ventricular filling",
    ],
  },
  { kind: "note", value: "Normal resting output is about 5 L/min." },
];

/** step 0 attach · 1 photo on the lecture · 2 reading · 3 read back · 4 folded in */
const TIMELINE = [1100, 1200, 1900, 2600, 3000];

/** A lecturer's ECG scrawl — instantly readable as a cardiac board. */
function EcgScrawl() {
  return (
    <svg viewBox="0 0 220 44" width="100%" height={40} fill="none" aria-hidden="true" style={{ marginTop: 4, maxWidth: "100%" }}>
      <path
        d="M2 30 L28 30 L34 26 L40 34 L46 30 L64 30 L70 8 L76 40 L82 30 L104 30 L112 22 L120 30 L146 30 L152 26 L158 34 L164 30 L182 30 L188 8 L194 40 L200 30 L218 30"
        stroke={MARKER}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BoardPhotoDemo() {
  const tr = useTr();
  // Opens on the photo already attached, so the first frame someone scrolls to
  // (or screenshots) shows the board rather than an empty placeholder.
  const [step, setStep] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setStep(s => (s + 1) % TIMELINE.length), TIMELINE[step]);
    return () => clearTimeout(t);
  }, [step]);

  const attached = step >= 1;
  const reading = step === 2;
  const read = step >= 3;
  const folded = step >= 4;

  const renderLine = (line: Line) => (
    <span
      key={line.text}
      style={{
        fontFamily: "'Caveat', 'Segoe Script', cursive",
        fontSize: line.size ?? 20,
        fontWeight: 600,
        color: line.red ? MARKER_RED : MARKER,
        lineHeight: 1.16,
        transform: `rotate(${line.tilt ?? 0}deg)`,
        transformOrigin: "left center",
        borderBottom: line.rule ? `2px solid ${line.red ? MARKER_RED : MARKER}` : undefined,
        alignSelf: "flex-start",
        paddingBottom: line.rule ? 2 : undefined,
      }}
    >
      {tr(line.text)}
    </span>
  );

  return (
    <div className="w-full" style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes bpPop   { from { opacity: 0; transform: scale(0.94) translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes bpIn    { from { opacity: 0; transform: translateY(6px) }            to { opacity: 1; transform: none } }
        @keyframes bpScan  { from { transform: translateY(-110%) }                      to { transform: translateY(560%) } }
        @keyframes bpPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
        @media (prefers-reduced-motion: reduce) { .bp-anim { animation: none !important; } }
      `}</style>

      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.09)", boxShadow: "0 24px 60px rgba(15,23,60,0.10)" }}
      >
        {/* The lecture this photo belongs to */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${CLASS_COLOR}14` }}>
            <Mic2 size={15} style={{ color: CLASS_COLOR }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 13.5, fontWeight: 600, color: "#0f1115" }}>{tr(LECTURE)}</div>
            <div style={{ fontSize: 11.5, color: "rgba(15,17,21,0.55)" }}>{tr("Recorded lecture · 48 min")}</div>
          </div>
          <span
            className={attached ? "" : "bp-anim"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 999,
              background: attached ? "rgba(22,163,74,0.1)" : `${CLASS_COLOR}14`,
              color: attached ? "#15803D" : CLASS_COLOR,
              animation: attached ? undefined : "bpPulse 1.1s ease-in-out infinite",
            }}
          >
            {attached ? <Check size={12} /> : <Camera size={12} />}
            {attached ? tr("1 photo attached") : tr("Add photo")}
          </span>
        </div>

        <div className="grid md:grid-cols-2">
          {/* ── The photograph ── */}
          <div className="p-5" style={{ borderRight: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(15,17,21,0.45)", marginBottom: 10 }}>
              {tr("Photo of the board")}
            </div>

            {attached ? (
              <div
                className="bp-anim relative overflow-hidden"
                style={{
                  borderRadius: 14,
                  background: "linear-gradient(168deg, #FBFBF7 0%, #EDEEE8 100%)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                  padding: "18px 16px",
                  minHeight: 330,
                  transform: "rotate(-0.7deg)",
                  animation: "bpPop 0.4s ease both",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(103deg, transparent 36%, rgba(255,255,255,0.5) 52%, transparent 64%)" }}
                />

                {/* Two clusters, the way a board actually fills up */}
                <div className="relative flex flex-wrap" style={{ gap: "14px 18px" }}>
                  <div className="flex flex-col" style={{ gap: 7, flex: "1 1 170px", minWidth: 0 }}>
                    {BOARD_LEFT.map(renderLine)}
                    <EcgScrawl />
                  </div>
                  <div className="flex flex-col" style={{ gap: 5, flex: "1 1 150px", minWidth: 0 }}>
                    {BOARD_RIGHT.map(renderLine)}
                  </div>
                </div>

                {reading && (
                  <span
                    aria-hidden="true"
                    className="bp-anim absolute left-0 right-0"
                    style={{
                      top: 0, height: 52,
                      background: `linear-gradient(180deg, transparent, ${CLASS_COLOR}2E, transparent)`,
                      animation: "bpScan 1.7s ease-in-out",
                    }}
                  />
                )}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-2"
                style={{ borderRadius: 14, minHeight: 330, border: "1.5px dashed rgba(0,0,0,0.16)", background: "rgba(0,0,0,0.015)" }}
              >
                <Camera size={20} style={{ color: "rgba(15,17,21,0.3)" }} />
                <span style={{ fontSize: 12.5, color: "rgba(15,17,21,0.45)" }}>{tr("Add a photo of the board or slides")}</span>
              </div>
            )}
          </div>

          {/* ── What Ucorns read out of it ── */}
          <div className="p-5">
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(15,17,21,0.45)", marginBottom: 10 }}>
              {tr("What Ucorns read")}
            </div>

            <div style={{ minHeight: 330 }}>
              {reading && (
                <div className="flex items-center gap-2" style={{ fontSize: 13, color: "rgba(15,17,21,0.6)" }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: CLASS_COLOR }} />
                  {tr("Ucorns is reading this photo…")}
                </div>
              )}

              {read && (
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {READ.map((item, i) => (
                    <div key={item.value} className="bp-anim" style={{ animation: `bpIn 0.4s ease ${i * 0.1}s both` }}>
                      {item.kind === "heading" && (
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f1115" }}>{tr(item.value)}</div>
                      )}

                      {item.kind === "math" && (
                        <FormulaText
                          text={item.value}
                          style={{
                            fontSize: 15,
                            color: "#0f1115",
                            background: "rgba(0,0,0,0.025)",
                            border: "1px solid rgba(0,0,0,0.06)",
                            borderRadius: 9,
                            padding: "8px 11px",
                            overflowX: "auto",
                          }}
                        />
                      )}

                      {item.kind === "list" && (
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(15,17,21,0.75)", marginBottom: 5 }}>
                            {tr(item.value)}
                          </div>
                          <ol className="flex flex-col" style={{ gap: 2, margin: 0, paddingLeft: 17 }}>
                            {item.items!.map(li => (
                              <li key={li} style={{ fontSize: 12.5, color: "rgba(15,17,21,0.62)", lineHeight: 1.5, listStyle: "decimal" }}>
                                {tr(li)}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {item.kind === "note" && (
                        <div className="flex items-start gap-2" style={{ fontSize: 12.5, color: "rgba(15,17,21,0.62)", lineHeight: 1.5 }}>
                          <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: CLASS_COLOR }} />
                          {tr(item.value)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!reading && !read && (
                <div style={{ fontSize: 13, color: "rgba(15,17,21,0.4)" }}>
                  {tr("Attach a photo and the formulas on it are read into this lecture.")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Folded into the lecture — the point of the whole thing */}
        <div
          className="px-5 py-3.5 flex items-center gap-2.5 flex-wrap"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: folded ? `${CLASS_COLOR}08` : "transparent", minHeight: 52 }}
        >
          {folded && (
            <>
              <span
                className="bp-anim inline-flex items-center gap-1.5"
                style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999,
                  background: `${CLASS_COLOR}14`, color: CLASS_COLOR, border: `1px solid ${CLASS_COLOR}2B`,
                  animation: "bpIn 0.4s ease both",
                }}
              >
                <Camera size={11} /> {tr("Photo")} · {tr("Lecture 4")}
              </span>
              <span className="bp-anim" style={{ fontSize: 12.5, color: "rgba(15,17,21,0.66)", animation: "bpIn 0.4s ease 0.1s both" }}>
                {tr("Now part of this lecture — the summary, the quiz and Ask all use it.")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BoardPhotoDemo;
