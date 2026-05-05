const DEMO = {
  lecture: "Calculus II - Integration Techniques",
  course: "MATH 201",
  duration: "1h 14min recorded",
  sections: [
    {
      heading: "Integration by Parts",
      bullets: [
        "Used when the integrand is a product of two functions",
        "Choose u as the function that simplifies when differentiated (LIATE rule)",
        "May need to apply the formula repeatedly for complex integrals",
        "Cyclic integrals: when IBP loops back, move the integral to one side and solve",
      ],
    },
    {
      heading: "Trigonometric Substitution",
      bullets: [
        "Use x = a sin θ when integrand contains √(a²− x²)",
        "Use x = a tan θ when integrand contains √(a²+ x²)",
        "Use x = a sec θ when integrand contains √(x²− a²)",
        "Always convert back to x using the original substitution triangle",
      ],
    },
    {
      heading: "Partial Fractions",
      bullets: [
        "Apply when integrating a rational function with factorable denominator",
        "Degree of numerator must be less than denominator - perform long division first if not",
        "Distinct linear factors: A/(x−a) + B/(x−b)",
        "Repeated factors: A/(x−a) + B/(x−a)²",
      ],
    },
  ],
  formulas: [
    "∫u dv = uv − ∫v du",
    "∫sin²x dx = x/2 − sin(2x)/4 + C",
    "∫tan²x dx = tan x − x + C",
  ],
  examTips: [
    "If you see a product of ln(x) or arctan(x) with a polynomial - always try IBP first",
    "Partial fractions is almost always tested - practice factoring denominators quickly",
    "After trig sub, draw the reference triangle to convert back without errors",
  ],
};

export function DemoCheatSheet() {
  return (
    <div className="w-full max-w-2xl">
      {/* Label */}
      <p className="text-xs text-[#444] uppercase tracking-[0.2em] mb-4 text-center">
        Example output — generated in 90 seconds
      </p>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#1a1a1a] flex items-start justify-between">
          <div>
            <div className="text-xs text-[#444] mb-1">{DEMO.course} · {DEMO.duration}</div>
            <div className="text-white font-medium text-base">{DEMO.lecture}</div>
          </div>
          <span className="bg-white text-black text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ml-4 mt-1">
            Ready
          </span>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Sections */}
          {DEMO.sections.map((s) => (
            <div key={s.heading}>
              <div className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-2">
                {s.heading}
              </div>
              <ul className="space-y-1.5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#888] leading-snug">
                    <span className="w-1 h-1 rounded-full bg-[#333] shrink-0 mt-1.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Formulas */}
          <div>
            <div className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-2">
              Formulas
            </div>
            <div className="space-y-2">
              {DEMO.formulas.map((f, i) => (
                <div key={i} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-2.5 font-mono text-sm text-white">
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Exam tips */}
          <div>
            <div className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-2">
              Exam tips
            </div>
            <div className="space-y-2">
              {DEMO.examTips.map((t, i) => (
                <div key={i} className="flex items-start gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3">
                  <span className="text-white text-xs mt-0.5">✦</span>
                  <span className="text-sm text-[#888] leading-snug">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
