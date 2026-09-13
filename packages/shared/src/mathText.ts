// Speech-to-text gives spoken maths ("x squared", "alpha", "integral of").
// These rules turn the common cases into real notation so the live transcript
// reads like the lecture looked. Rules are deliberately conservative — anything
// ambiguous in ordinary prose ("times", "over") is left alone, and the polished
// pass happens server-side once the recording is processed.

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν",
  xi: "ξ", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
};
const GREEK_CAPS: Record<string, string> = {
  Delta: "Δ", Sigma: "Σ", Omega: "Ω", Theta: "Θ", Lambda: "Λ", Phi: "Φ", Pi: "Π", Gamma: "Γ",
};

const SUP: Record<string, string> = { "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "0": "⁰", "1": "¹" };
const SUP_LETTER: Record<string, string> = { n: "\u207F", i: "\u2071", x: "\u02E3", a: "\u1D43", b: "\u1D47", c: "\u1D9C", k: "\u1D4F", m: "\u1D50", p: "\u1D56", t: "\u1D57" };
const SUB: Record<string, string> = { "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "0": "₀", "1": "₁" };

const NUM_WORD: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
};

// Renders a bound ("zero", "1", "n") as sub/superscript characters, falling back
// to the plain word when there is no character for it.
function toScript(word: string, map: Record<string, string>): string {
  const digits = NUM_WORD[word.toLowerCase()] ?? (/^\d+$/.test(word) ? word : null);
  if (digits) return digits.split("").map(d => map[d] ?? d).join("");
  if (word.toLowerCase() === "n") return map === SUB ? "\u2099" : "\u207F";
  const bound = /^([a-z])\s*(?:=|equals)\s*(\w+)$/i.exec(word);
  if (bound) {
    const v = bound[1].toLowerCase();
    const varSub = v === "i" ? "\u1D62" : v === "j" ? "\u2C7C" : v === "k" ? "\u2096" : v === "n" ? "\u2099" : v;
    return varSub + "\u208C" + toScript(bound[2], SUB);
  }
  return word;
}

// A token is "maths-like" if it is a lone variable, a number, or already carries
// notation. Operator words are only converted between two such tokens, so
// ordinary prose ("plus we covered chapter three") is left alone.
const MATH_SYM = "\u00B2\u00B3\u2070-\u209F\u0391-\u03C9\u221A\u221E\u222B\u2211\u220F\u2202\u2207";
function isMathToken(tok: string): boolean {
  if (!tok) return false;
  // check the raw token first — stripping would eat the ")" in "f(x)"
  if (/^[a-zA-Z]\([a-zA-Z0-9]+\)$/.test(tok)) return true;
  const t = tok.replace(/^[(\[]+|[)\],.;:!?]+$/g, "");
  if (!t) return false;
  if (new RegExp(`[${MATH_SYM}]`).test(t)) return true;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return true;      // 3, 2.5
  if (/^[a-zA-Z]$/.test(t)) return true;              // x, y, n
  if (/^[a-zA-Z][\u2070-\u209F\u00B2\u00B3]+$/.test(t)) return true; // x², aₙ
  if (/^[a-zA-Z]\([a-zA-Z0-9]+\)$/.test(t)) return true;               // f(x)
  if (NUM_WORD[t.toLowerCase()]) return true;         // "two"
  return false;
}

const OPERATORS: Record<string, string> = {
  equals: "=", plus: "+", minus: "\u2212", times: "\u00D7", over: "/",
};

// "y equals two x plus three" -> "y = 2x + 3"
function convertOperators(text: string): string {
  const tokens = text.split(/(\s+)/); // keep the whitespace so spacing survives
  const words = tokens.filter((_, i) => i % 2 === 0);

  for (let i = 1; i < words.length - 1; i++) {
    const op = OPERATORS[words[i].toLowerCase()];
    if (!op) continue;
    if (isMathToken(words[i - 1]) && isMathToken(words[i + 1])) {
      words[i] = op;
      // a number word sitting next to maths is a numeral: "two x" -> "2 x"
      for (const j of [i - 1, i + 1]) {
        const n = NUM_WORD[words[j].toLowerCase()];
        if (n) words[j] = n;
      }
    }
  }

  let out = "";
  for (let i = 0, w = 0; i < tokens.length; i++) out += i % 2 === 0 ? words[w++] : tokens[i];
  return out;
}

export function toMathNotation(input: string): string {
  if (!input) return input;
  let t = input;

  // powers: "x squared" / "e to the power of 3"
  t = t.replace(/\b([A-Za-z0-9])\s+squared\b/g, "$1²");
  t = t.replace(/\b([A-Za-z0-9])\s+cubed\b/g, "$1³");
  t = t.replace(/\b([A-Za-z0-9])\s+to the (?:power of\s+)?(\d)\b/g, (_m, b, p) => b + (SUP[p] ?? "^" + p));

  // chemistry: "H two O" -> H₂O, "C O two" -> CO₂
  t = t.replace(/\b([A-Z][a-z]?)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*([A-Z][a-z]?)?/g,
    (_m, el, n, tail) => el + (SUB[NUM_WORD[n.toLowerCase()]] ?? "") + (tail ?? ""));

  // join elements trailing a subscripted one: "H₂S O₄" -> H₂SO₄
  for (let i = 0; i < 3; i++) t = t.replace(/([A-Z][a-z]?[\u2080-\u2089]+[A-Z]?[a-z]?)\s+([A-Z][a-z]?[\u2080-\u2089]+)/g, "$1$2");

  // named operators
  const phrases: [RegExp, string][] = [
    [/\bsquare root of\s+/gi, "√"],
    // ranged forms: "the integral from zero to one of x² dx" -> ∫₀¹ x² dx
    [/\b(?:the )?integral from (\w+) to (\w+) of\s+/gi, "∫[$1,$2] "],
    [/\b(?:the )?sum(?:mation)? from ([\w\s]+?) to (\w+) of\s+/gi, "∑[$1,$2] "],
    [/\bthe integral of\s+/gi, "∫"],
    [/\bintegral of\s+/gi, "∫"],
    [/\b(?:the )?sum(?:mation)? of\s+/gi, "∑"],
    [/\bpartial derivative of\s+/gi, "∂"],
    [/\binfinity\b/gi, "∞"],
    [/\bplus or minus\b/gi, "±"],
    [/\bless than or equal to\b/gi, "≤"],
    [/\bgreater than or equal to\b/gi, "≥"],
    [/\bnot equal to\b/gi, "≠"],
    [/\bapproximately equal to\b/gi, "≈"],
    [/\bproportional to\b/gi, "∝"],
    [/\bis an element of\b/gi, "∈"],
    [/\bfor all\b/gi, "∀"],
    [/\bthere exists\b/gi, "∃"],
    [/\bdegrees celsius\b/gi, "°C"],
    [/\bdegrees fahrenheit\b/gi, "°F"],
  ];
  for (const [re, sym] of phrases) t = t.replace(re, sym);

  // "delta X" / "sigma X" bind to the variable that follows: ΔE, not δ E
  t = t.replace(/\bdelta\s+([A-Z])\b/g, "Δ$1");
  t = t.replace(/\bsigma\s+([A-Z])\b/g, "Σ$1");

  // Greek letters — only when standing alone as a word
  for (const [word, sym] of Object.entries(GREEK_CAPS)) {
    t = t.replace(new RegExp(`\\b(?:capital |big )${word}\\b`, "gi"), sym);
  }
  for (const [word, sym] of Object.entries(GREEK)) {
    // "Theta" at the start of a sentence is still θ — the capital letter is only
    // meant when the speaker says "capital theta", handled above.
    t = t.replace(new RegExp(`\\b${word}\\b`, "gi"), sym);
  }
  // "pi" is a word that also appears in ordinary speech far less than these, keep it last
  t = t.replace(/\bpi\b/g, "π");

  // differentials: "d x" -> dx (only next to an integral, to avoid mangling prose)
  if (t.includes("∫")) t = t.replace(/\bd\s+([a-z])\b/g, "d$1");

  // bounds captured above become sub/superscripts: ∫[zero,one] -> ∫₀¹
  t = t.replace(/([∫∑])\[([^,\]]+),([^\]]+)\]\s*/g, (_m, sym, lo, hi) =>
    sym + toScript(lo.trim(), SUB) + toScript(hi.trim(), SUP));

  // "x to the n" / "x to the power of n" with a variable exponent
  t = t.replace(/\b([A-Za-z0-9])\s+to the (?:power of\s+)?([a-z])\b/g,
    (_m, b, e) => b + (SUP_LETTER[e] ?? "^" + e));

  // "f of x" -> f(x), but only for single-letter function and argument
  t = t.replace(/\b([a-z])\s+of\s+([a-z])\b/g, "$1($2)");

  t = convertOperators(t);

  // a coefficient binds to its variable: "2 x" -> 2x
  t = t.replace(/\b(\d+)\s+([a-zA-Z])(?![a-zA-Z])/g, "$1$2");

  // a fraction reads as one unit: "4 / 3" -> 4/3
  t = t.replace(/([0-9a-zA-Z²³⁰-₟])\s+\/\s+([0-9a-zA-Z])/g, "$1/$2");

  // tidy the spacing the substitutions leave behind
  t = t.replace(/([√∫∑∂])\s+/g, "$1");
  t = t.replace(/\s{2,}/g, " ");

  return t;
}
