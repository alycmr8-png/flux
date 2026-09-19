// Buttons in the formula writer, grouped by the kind of student using them.
// Each inserts LaTeX at the cursor; `select` is the placeholder left selected so
// the student can type straight over it. Chemistry uses mhchem (\ce{…}), which
// the KaTeX renderers load on web and mobile.

export type MathTemplate = { label: string; latex: string; select?: string; title: string };

export type FormulaSubject = {
  key: "math" | "chemistry" | "physics" | "nursing" | "statistics";
  label: string;
  /** Tells the handwriting reader what kind of notation to expect. */
  readerHint: string;
  structures: MathTemplate[];
  symbols: MathTemplate[];
};

const symbols = (pairs: [string, string][]): MathTemplate[] =>
  pairs.map(([label, latex]) => ({ label, latex: `${latex} `, title: latex }));

export const FORMULA_SUBJECTS: FormulaSubject[] = [
  {
    key: "math",
    label: "Math",
    readerHint: "general mathematics",
    structures: [
      { label: "a⁄b", latex: "\\frac{a}{b}", select: "a", title: "Fraction" },
      { label: "x²", latex: "x^{2}", select: "2", title: "Power" },
      { label: "xₙ", latex: "x_{n}", select: "n", title: "Subscript" },
      { label: "√x", latex: "\\sqrt{x}", select: "x", title: "Square root" },
      { label: "ⁿ√x", latex: "\\sqrt[n]{x}", select: "n", title: "nth root" },
      { label: "∫", latex: "\\int_{a}^{b} f(x)\\,dx", select: "f(x)", title: "Integral" },
      { label: "∑", latex: "\\sum_{i=1}^{n} a_i", select: "a_i", title: "Sum" },
      { label: "lim", latex: "\\lim_{x \\to 0} f(x)", select: "f(x)", title: "Limit" },
      { label: "d⁄dx", latex: "\\frac{d}{dx}", title: "Derivative" },
      { label: "∂⁄∂x", latex: "\\frac{\\partial f}{\\partial x}", select: "f", title: "Partial derivative" },
      { label: "(  )", latex: "\\left( x \\right)", select: "x", title: "Brackets that grow" },
      { label: "|x|", latex: "\\left| x \\right|", select: "x", title: "Absolute value" },
      { label: "[⋯]", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", select: "a", title: "Matrix" },
      { label: "=", latex: "\\begin{aligned} a &= b \\\\ &= c \\end{aligned}", select: "a", title: "Steps (aligned)" },
    ],
    symbols: symbols([
      ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["θ", "\\theta"], ["λ", "\\lambda"],
      ["π", "\\pi"], ["σ", "\\sigma"], ["φ", "\\phi"], ["ω", "\\omega"], ["Δ", "\\Delta"], ["∞", "\\infty"],
      ["±", "\\pm"], ["·", "\\cdot"], ["×", "\\times"], ["÷", "\\div"], ["≤", "\\leq"], ["≥", "\\geq"],
      ["≠", "\\neq"], ["≈", "\\approx"], ["→", "\\to"], ["⇒", "\\Rightarrow"], ["∈", "\\in"], ["°", "^{\\circ}"],
      ["sin", "\\sin"], ["cos", "\\cos"], ["tan", "\\tan"], ["ln", "\\ln"], ["log", "\\log"], ["e", "e^{x}"],
    ]),
  },
  {
    key: "chemistry",
    label: "Chemistry",
    readerHint: "chemistry — chemical formulas, ions, reactions and equilibria (write them with mhchem \\ce{…})",
    structures: [
      { label: "H₂O", latex: "\\ce{H2O}", select: "H2O", title: "Chemical formula (numbers become subscripts)" },
      { label: "SO₄²⁻", latex: "\\ce{SO4^2-}", select: "SO4^2-", title: "Ion with charge" },
      { label: "A → B", latex: "\\ce{A + B -> C}", select: "A + B -> C", title: "Reaction" },
      { label: "A ⇌ B", latex: "\\ce{A <=> B}", select: "A <=> B", title: "Equilibrium" },
      { label: "→ᐞ", latex: "\\ce{A ->[\\Delta] B}", select: "A", title: "Reaction with condition over the arrow" },
      { label: "(aq)", latex: "\\ce{NaCl(aq)}", select: "NaCl", title: "State: (s) (l) (g) (aq)" },
      { label: "¹⁴C", latex: "\\ce{^{14}_{6}C}", select: "C", title: "Isotope" },
      { label: "↑ gas", latex: "\\ce{CO2 ^}", select: "CO2", title: "Gas given off" },
      { label: "↓ ppt", latex: "\\ce{AgCl v}", select: "AgCl", title: "Precipitate" },
      { label: "1s²2s²", latex: "1s^{2}\\,2s^{2}\\,2p^{6}", title: "Electron configuration" },
      { label: "[H⁺]", latex: "[\\ce{H+}]", select: "H+", title: "Concentration" },
      { label: "pH", latex: "\\mathrm{pH} = -\\log[\\ce{H+}]", title: "pH" },
      { label: "PV=nRT", latex: "PV = nRT", title: "Ideal gas law" },
      { label: "M=n/V", latex: "M = \\frac{n}{V}", title: "Molarity" },
      { label: "ΔH", latex: "\\Delta H = -286\\,\\mathrm{kJ\\,mol^{-1}}", select: "-286", title: "Enthalpy change" },
      { label: "K", latex: "K_{c} = \\frac{[\\ce{C}]^{c}}{[\\ce{A}]^{a}[\\ce{B}]^{b}}", title: "Equilibrium constant" },
    ],
    symbols: symbols([
      ["→", "\\rightarrow"], ["⇌", "\\rightleftharpoons"], ["Δ", "\\Delta"], ["°C", "^{\\circ}\\mathrm{C}"],
      ["mol", "\\,\\mathrm{mol}"], ["g/mol", "\\,\\mathrm{g\\,mol^{-1}}"], ["M", "\\,\\mathrm{M}"], ["L", "\\,\\mathrm{L}"],
      ["kJ", "\\,\\mathrm{kJ}"], ["atm", "\\,\\mathrm{atm}"], ["K", "\\,\\mathrm{K}"], ["e⁻", "\\ce{e-}"],
      ["δ+", "\\delta^{+}"], ["δ−", "\\delta^{-}"], ["×10ⁿ", "\\times 10^{n}"], ["≈", "\\approx"],
    ]),
  },
  {
    key: "physics",
    label: "Physics",
    readerHint: "physics — quantities with units, vectors and scientific notation",
    structures: [
      { label: "v⃗", latex: "\\vec{v}", select: "v", title: "Vector" },
      { label: "×10ⁿ", latex: "3.0 \\times 10^{8}", select: "3.0", title: "Scientific notation" },
      { label: "unit", latex: "9.8\\,\\mathrm{m/s^{2}}", select: "9.8", title: "Value with unit" },
      { label: "a⁄b", latex: "\\frac{a}{b}", select: "a", title: "Fraction" },
      { label: "x²", latex: "x^{2}", select: "2", title: "Power" },
      { label: "xₙ", latex: "x_{n}", select: "n", title: "Subscript" },
      { label: "√x", latex: "\\sqrt{x}", select: "x", title: "Square root" },
      { label: "F=ma", latex: "F = ma", title: "Newton's second law" },
      { label: "½mv²", latex: "E_{k} = \\tfrac{1}{2}mv^{2}", title: "Kinetic energy" },
      { label: "d⁄dt", latex: "\\frac{dx}{dt}", title: "Rate of change" },
      { label: "|v⃗|", latex: "\\left| \\vec{v} \\right|", title: "Magnitude" },
      { label: "=", latex: "\\begin{aligned} a &= b \\\\ &= c \\end{aligned}", select: "a", title: "Steps (aligned)" },
    ],
    symbols: symbols([
      ["m", "\\,\\mathrm{m}"], ["s", "\\,\\mathrm{s}"], ["kg", "\\,\\mathrm{kg}"], ["N", "\\,\\mathrm{N}"],
      ["J", "\\,\\mathrm{J}"], ["W", "\\,\\mathrm{W}"], ["Pa", "\\,\\mathrm{Pa}"], ["Hz", "\\,\\mathrm{Hz}"],
      ["V", "\\,\\mathrm{V}"], ["Ω", "\\,\\Omega"], ["m/s", "\\,\\mathrm{m/s}"], ["m/s²", "\\,\\mathrm{m/s^{2}}"],
      ["Δ", "\\Delta"], ["θ", "\\theta"], ["λ", "\\lambda"], ["μ", "\\mu"], ["ω", "\\omega"], ["ρ", "\\rho"],
      ["∝", "\\propto"], ["≈", "\\approx"], ["°", "^{\\circ}"], ["·", "\\cdot"],
    ]),
  },
  {
    key: "nursing",
    label: "Nursing",
    readerHint: "nursing and pharmacology — dosage calculations, IV rates, units (mg, mcg, mL, gtt/min) and conversions",
    structures: [
      { label: "D/H×Q", latex: "\\frac{D}{H} \\times Q = \\text{dose}", title: "Dose: desired ÷ have × quantity" },
      { label: "mL/hr", latex: "\\frac{\\text{volume (mL)}}{\\text{time (hr)}} = \\text{mL/hr}", title: "IV infusion rate" },
      { label: "gtt/min", latex: "\\frac{\\text{volume (mL)} \\times \\text{drop factor (gtt/mL)}}{\\text{time (min)}} = \\text{gtt/min}", title: "Drip rate" },
      { label: "mg/kg", latex: "\\text{dose} = 5\\,\\mathrm{mg/kg} \\times 70\\,\\mathrm{kg}", select: "5", title: "Weight-based dose" },
      { label: "a⁄b", latex: "\\frac{a}{b}", select: "a", title: "Fraction" },
      { label: "kg⇄lb", latex: "1\\,\\mathrm{kg} = 2.2\\,\\mathrm{lb}", title: "Weight conversion" },
      { label: "°C⇄°F", latex: "^{\\circ}\\mathrm{F} = \\tfrac{9}{5}\\,^{\\circ}\\mathrm{C} + 32", title: "Temperature conversion" },
      { label: "BMI", latex: "\\mathrm{BMI} = \\frac{\\text{weight (kg)}}{\\text{height (m)}^{2}}", title: "Body mass index" },
      { label: "MAP", latex: "\\mathrm{MAP} = \\frac{\\mathrm{SBP} + 2\\,\\mathrm{DBP}}{3}", title: "Mean arterial pressure" },
      { label: "BP", latex: "120/80\\,\\mathrm{mmHg}", select: "120/80", title: "Blood pressure" },
      { label: "I&O", latex: "\\text{intake} - \\text{output} = \\text{balance (mL)}", title: "Fluid balance" },
      { label: "=", latex: "\\begin{aligned} a &= b \\\\ &= c \\end{aligned}", select: "a", title: "Steps (aligned)" },
    ],
    symbols: symbols([
      ["mg", "\\,\\mathrm{mg}"], ["mcg", "\\,\\mathrm{mcg}"], ["g", "\\,\\mathrm{g}"], ["kg", "\\,\\mathrm{kg}"],
      ["mL", "\\,\\mathrm{mL}"], ["L", "\\,\\mathrm{L}"], ["gtt", "\\,\\mathrm{gtt}"], ["units", "\\,\\text{units}"],
      ["mEq", "\\,\\mathrm{mEq}"], ["mmHg", "\\,\\mathrm{mmHg}"], ["bpm", "\\,\\mathrm{bpm}"], ["°C", "^{\\circ}\\mathrm{C}"],
      ["hr", "\\,\\mathrm{hr}"], ["min", "\\,\\mathrm{min}"], ["×", "\\times"], ["÷", "\\div"],
      ["↑", "\\uparrow"], ["↓", "\\downarrow"], ["≥", "\\geq"], ["≤", "\\leq"], ["≈", "\\approx"], ["Δ", "\\Delta"],
    ]),
  },
  {
    key: "statistics",
    label: "Statistics",
    readerHint: "statistics and probability",
    structures: [
      { label: "x̄", latex: "\\bar{x}", title: "Sample mean" },
      { label: "x̄ =", latex: "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i", title: "Mean formula" },
      { label: "s", latex: "s = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^{2}}{n-1}}", title: "Standard deviation" },
      { label: "z", latex: "z = \\frac{x - \\mu}{\\sigma}", title: "z-score" },
      { label: "p̂", latex: "\\hat{p}", title: "Sample proportion" },
      { label: "P(A|B)", latex: "P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}", title: "Conditional probability" },
      { label: "nCr", latex: "\\binom{n}{r}", select: "n", title: "Combinations" },
      { label: "CI", latex: "\\bar{x} \\pm z^{*}\\frac{\\sigma}{\\sqrt{n}}", title: "Confidence interval" },
      { label: "∑", latex: "\\sum_{i=1}^{n} x_i", title: "Sum" },
      { label: "a⁄b", latex: "\\frac{a}{b}", select: "a", title: "Fraction" },
      { label: "H₀", latex: "H_{0}: \\mu = \\mu_{0}", title: "Null hypothesis" },
    ],
    symbols: symbols([
      ["μ", "\\mu"], ["σ", "\\sigma"], ["σ²", "\\sigma^{2}"], ["ρ", "\\rho"], ["χ²", "\\chi^{2}"], ["α", "\\alpha"],
      ["β", "\\beta"], ["λ", "\\lambda"], ["∑", "\\sum"], ["±", "\\pm"], ["≤", "\\leq"], ["≥", "\\geq"],
      ["≠", "\\neq"], ["≈", "\\approx"], ["∩", "\\cap"], ["∪", "\\cup"], ["|", "\\mid"], ["∼", "\\sim"],
    ]),
  },
];

/** Kept for callers that only need the general math buttons. */
/**
 * One science set, in place of the per-subject chips.
 *
 * The writer no longer asks the student to pick a subject first — a nursing
 * student writing a dosage still wants a fraction, and a chemist still wants a
 * Greek letter. Everything is merged and de-duplicated by the LaTeX it inserts,
 * keeping the first wording for any repeat so the labels stay the familiar ones.
 */
function mergeTemplates(pick: (s: FormulaSubject) => MathTemplate[]): MathTemplate[] {
  const seen = new Set<string>();
  const out: MathTemplate[] = [];
  for (const subject of FORMULA_SUBJECTS) {
    for (const t of pick(subject)) {
      const key = t.latex.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

export const SCIENCE_STRUCTURES = mergeTemplates(s => s.structures);
export const SCIENCE_SYMBOLS = mergeTemplates(s => s.symbols);
/** What the handwriting reader is told to expect when no subject is chosen. */
export const SCIENCE_READER_HINT =
  "science — mathematics, chemistry (mhchem \\ce{…}), physics, statistics and clinical dosage notation";

export const MATH_STRUCTURES = FORMULA_SUBJECTS[0].structures;
export const MATH_SYMBOLS = FORMULA_SUBJECTS[0].symbols;

/** Inserts a template into `text` at [start, end); returns the new text and the range to select. */
export function insertMathTemplate(text: string, start: number, end: number, t: MathTemplate) {
  const next = text.slice(0, start) + t.latex + text.slice(end);
  const at = t.select ? t.latex.indexOf(t.select) : -1;
  const selStart = at >= 0 ? start + at : start + t.latex.length;
  const selEnd = at >= 0 ? selStart + (t.select?.length ?? 0) : selStart;
  return { text: next, selStart, selEnd };
}
