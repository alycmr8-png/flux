// Study notes mix prose with LaTeX: $…$ inline, $$…$$ display (\(…\) and \[…\]
// are accepted too, and \$ is a literal dollar). The web and mobile renderers
// share this parser so both apps split text the same way, and everything that
// cannot typeset (a Google Doc export, a fragment KaTeX rejects) falls back to
// readable symbols through latexToReadable — never to raw LaTeX.

export type MathSegment =
  | { type: "text"; value: string; bold?: boolean }
  | { type: "math"; tex: string; display: boolean; raw: string; bold?: boolean };

const isWhitespace = (c: string | undefined) => c !== undefined && /\s/.test(c);
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

/** Index of the closing delimiter `close` at or after `from`, skipping `\x` escape pairs. -1 if none. */
function findClosing(s: string, from: number, close: string): number {
  let j = from;
  while (j < s.length) {
    if (s.startsWith(close, j)) return j;
    j += s[j] === "\\" ? 2 : 1;
  }
  return -1;
}

/** Pass 1: split out display math ($$…$$ and \[…\]). Everything else stays raw text. */
function splitDisplay(s: string): MathSegment[] {
  const out: MathSegment[] = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) { out.push({ type: "text", value: buf }); buf = ""; } };

  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "[") {
      const end = findClosing(s, i + 2, "\\]");
      const tex = end === -1 ? "" : s.slice(i + 2, end);
      if (end !== -1 && tex.trim()) {
        flush();
        out.push({ type: "math", tex, display: true, raw: s.slice(i, end + 2) });
        i = end + 2;
        continue;
      }
      buf += "\\[";
      i += 2;
      continue;
    }
    if (c === "\\") {
      // Keep escape pairs (\$, \\, \( …) intact for pass 2.
      buf += s.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === "$" && s[i + 1] === "$") {
      const end = findClosing(s, i + 2, "$$");
      const tex = end === -1 ? "" : s.slice(i + 2, end);
      if (end !== -1 && tex.trim()) {
        flush();
        out.push({ type: "math", tex, display: true, raw: s.slice(i, end + 2) });
        i = end + 2;
        continue;
      }
      buf += "$$";
      i += 2;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return out;
}

/** Pass 2: within a text run, split out inline math ($…$ and \(…\)) and unescape \$. */
function splitInline(s: string): MathSegment[] {
  const out: MathSegment[] = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) { out.push({ type: "text", value: buf }); buf = ""; } };

  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "$") { buf += "$"; i += 2; continue; }
      if (n === "(") {
        const end = findClosing(s, i + 2, "\\)");
        const tex = end === -1 ? "" : s.slice(i + 2, end);
        if (end !== -1 && tex.trim()) {
          flush();
          out.push({ type: "math", tex, display: false, raw: s.slice(i, end + 2) });
          i = end + 2;
          continue;
        }
        buf += "\\(";
        i += 2;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }
    if (c === "$") {
      // A leftover "$$" (unclosed display) is just text.
      if (s[i + 1] === "$") { buf += "$$"; i += 2; continue; }
      const next = s[i + 1];
      if (next !== undefined && !isWhitespace(next)) {
        // The first unescaped "$" on the same line must be a valid closer,
        // otherwise this "$" is plain prose (e.g. "costs $5 and $10").
        let j = i + 1;
        let close = -1;
        while (j < s.length) {
          const cj = s[j];
          if (cj === "\n") break;
          if (cj === "\\") {
            if (s[j + 1] === "\n") break;
            j += 2;
            continue;
          }
          if (cj === "$") {
            if (!isWhitespace(s[j - 1]) && !isDigit(s[j + 1])) close = j;
            break;
          }
          j += 1;
        }
        if (close !== -1) {
          flush();
          out.push({ type: "math", tex: s.slice(i + 1, close), display: false, raw: s.slice(i, close + 1) });
          i = close + 1;
          continue;
        }
      }
      buf += "$";
      i += 1;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return out;
}

// No "$", "\(", "\[" or "**" means plain prose — skip the parser entirely.
const MAYBE_MARKUP = /\$|\\\(|\\\[|\*\*|^\s*(?:#{1,4}\s|[-*]\s)/m;

/**
 * Chat answers arrive with light markdown. Headings become bold lines, "- " and
 * "* " bullets become "• ", and **bold** spans (which may contain maths) are
 * marked on the segments rather than shown as asterisks.
 */
function applyProseMarkup(segments: MathSegment[]): MathSegment[] {
  const out: MathSegment[] = [];
  const markers = segments.reduce((n, seg) => n + (seg.type === "text" ? (seg.value.match(/\*\*/g)?.length ?? 0) : 0), 0);
  let usable = markers - (markers % 2); // an unmatched trailing ** is dropped, not honoured
  let bold = false;

  for (const seg of segments) {
    if (seg.type === "math") { out.push({ ...seg, bold }); continue; }
    let value = seg.value
      .replace(/^[ \t]*#{1,4}[ \t]+(.+)$/gm, "**$1**")
      .replace(/^([ \t]*)[-*][ \t]+/gm, "$1• ");
    // Headings add their own balanced pair of markers.
    usable += (value.match(/\*\*/g)?.length ?? 0) - (seg.value.match(/\*\*/g)?.length ?? 0);
    const parts = value.split("**");
    parts.forEach((part, k) => {
      if (k > 0) {
        if (usable > 0) { bold = !bold; usable--; }
      }
      if (part) out.push({ type: "text", value: part, bold });
    });
  }
  return out;
}

/** Parse mixed prose + LaTeX into text and math segments. */
export function parseMath(input: string): MathSegment[] {
  if (!input) return [];
  if (!MAYBE_MARKUP.test(input)) return [{ type: "text", value: input }];
  const segments: MathSegment[] = [];
  for (const seg of splitDisplay(input)) {
    if (seg.type === "math") segments.push(seg);
    else segments.push(...splitInline(seg.value));
  }
  // Merge adjacent text runs, and drop the single line break hugging a display
  // block so pre-wrap text doesn't get an extra blank line around it.
  const merged: MathSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (seg.type === "text" && prev?.type === "text") prev.value += seg.value;
    else merged.push(seg.type === "text" ? { ...seg } : seg);
  }
  for (let k = 0; k < merged.length; k++) {
    const seg = merged[k];
    if (seg.type !== "math" || !seg.display) continue;
    const before = merged[k - 1];
    const after = merged[k + 1];
    if (before?.type === "text") before.value = before.value.replace(/[ \t]*\r?\n[ \t]*$/, "");
    if (after?.type === "text") after.value = after.value.replace(/^[ \t]*\r?\n/, "");
  }
  return applyProseMarkup(merged.filter(seg => seg.type === "math" || seg.value !== ""));
}

/** True when the string contains any recognised math delimiter. */
export function hasMathDelimiters(s: string | null | undefined): boolean {
  if (!s || !/\$|\\\(|\\\[/.test(s)) return false;
  return parseMath(s).some(seg => seg.type === "math");
}

/** True when the string needs more than plain text: maths or bold/heading/bullet markup. */
export function hasRichText(s: string | null | undefined): boolean {
  if (!s || !MAYBE_MARKUP.test(s)) return false;
  const segments = parseMath(s);
  return segments.some(seg => seg.type === "math" || seg.bold) || segments.map(seg => (seg.type === "text" ? seg.value : "")).join("") !== s;
}

/** A delimiter-less string that still looks like LaTeX: a \command, ^ or _. */
export function isBareLatex(s: string | null | undefined): boolean {
  if (!s) return false;
  return !hasMathDelimiters(s) && /\\[a-zA-Z]+|[\^_]/.test(s);
}

/**
 * Segments for a Formulas-block item: a bare LaTeX expression (no delimiters)
 * becomes one display-math fragment; anything else parses normally, so plain
 * Unicode formulas stay text.
 */
export function formulaSegments(s: string | null | undefined): MathSegment[] {
  const str = s == null ? "" : String(s);
  return isBareLatex(str) ? [{ type: "math", tex: str.trim(), display: true, raw: str }] : parseMath(str);
}

// ─── LaTeX → readable Unicode ─────────────────────────────────────────────────

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆", circ: "∘", bullet: "•",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼", simeq: "≃",
  cong: "≅", propto: "∝", ll: "≪", gg: "≫",
  to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", implies: "⇒",
  Leftarrow: "⇐", Leftrightarrow: "⇔", iff: "⇔", mapsto: "↦", uparrow: "↑", downarrow: "↓",
  rightleftharpoons: "⇌", longrightarrow: "⟶",
  infty: "∞", partial: "∂", nabla: "∇", int: "∫", iint: "∬", iiint: "∭", oint: "∮", sum: "∑", prod: "∏",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cup: "∪", cap: "∩",
  emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", land: "∧", wedge: "∧",
  lor: "∨", vee: "∨", oplus: "⊕", otimes: "⊗", perp: "⊥", parallel: "∥", angle: "∠", triangle: "△",
  degree: "°", prime: "′", ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", therefore: "∴", because: "∵",
  hbar: "ℏ", ell: "ℓ", Re: "ℜ", Im: "ℑ", aleph: "ℵ", langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋",
  lceil: "⌈", rceil: "⌉", vert: "|", mid: "|", lvert: "|", rvert: "|", Vert: "‖", lVert: "‖", rVert: "‖",
  quad: "  ", qquad: "    ", ",": " ", ";": " ", ":": " ", "!": "", " ": " ",
  "%": "%", "{": "{", "}": "}", "$": "$", "&": "&", "#": "#", "_": "_", "|": "‖",
};

// Function names read as words: \sin x → "sin x".
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "ln", "log", "exp", "det", "dim", "ker", "gcd", "lcm", "max", "min", "sup", "inf", "arg", "deg", "Pr", "mod", "bmod",
]);

const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ" };

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", y: "ʸ",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", k: "ᵏ", m: "ᵐ", p: "ᵖ", t: "ᵗ", T: "ᵀ", "′": "′", "*": "*", "∗": "*",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ",
  k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const VULGAR: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗",
  "4/5": "⅘", "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};

const ACCENTS: Record<string, string> = {
  vec: "⃗", hat: "̂", widehat: "̂", bar: "̄", overline: "̅", dot: "̇",
  ddot: "̈", tilde: "̃", widetilde: "̃",
};

const FONT_WRAPPERS = new Set([
  "text", "textrm", "textit", "textbf", "mathrm", "mathit", "mathbf", "mathsf", "mathtt", "mathcal",
  "boldsymbol", "bm", "operatorname", "mbox", "underline", "displaystyle", "textstyle",
]);

/** A command's name at s[i] === "\\": letters, or a single symbol. */
function readCommand(s: string, i: number): [string, number] {
  const m = /^[a-zA-Z]+/.exec(s.slice(i + 1));
  if (m) return [m[0], i + 1 + m[0].length];
  return [s[i + 1] ?? "", i + 2];
}

/** One argument: a {group}, a \command, or a single character. Returns [source, next]. */
function readArg(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "\\") { j++; continue; }
      if (s[j] === "{") depth++;
      else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    return [s.slice(i + 1), s.length];
  }
  if (s[i] === "\\") {
    const [, next] = readCommand(s, i);
    return [s.slice(i, next), next];
  }
  return [s[i] ?? "", i + 1];
}

/** Wraps a compound expression in parentheses so "a+b/c" never reads ambiguously. */
// Letters and digits, including accented Latin and Greek. Spelled out rather than
// \p{L}: Expo Go compiles this on the device, where property escapes may not exist.
const WORD_CHARS = "A-Za-z0-9\\u00C0-\\u024F\\u0370-\\u03FF";
const PLAIN_UNIT = new RegExp(`^[${WORD_CHARS}.′²³⁰-⁹ⁿ₀-₉ₐ-ₜ√∞∂∇]+$`);
const APPLICATION = new RegExp(`^[${WORD_CHARS}′∂]+\\((?:[^()]|\\([^()]*\\))*\\)$`);
const ENDS_IN_TERM = new RegExp(`[${WORD_CHARS})]$`);

function unit(text: string): string {
  const t = text.trim();
  if (t.length <= 1) return t;
  if (PLAIN_UNIT.test(t)) return t;
  if (/^\(.*\)$/.test(t) && !/\).*\(/.test(t.slice(1, -1))) return t;
  // A function application reads as one unit: f(x), n(n+1), f′(xₙ), ∂f.
  if (APPLICATION.test(t)) return t;
  return `(${t})`;
}

function script(text: string, map: Record<string, string>, marker: "^" | "_"): string {
  const t = text.trim();
  const chars = [...t];
  if (chars.length && chars.every(ch => map[ch] !== undefined)) return chars.map(ch => map[ch]).join("");
  return chars.length === 1 ? `${marker}${t}` : `${marker}(${t})`;
}

function convert(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === "\\") {
      // Row separator in environments handled by the caller; here it is a line break.
      if (s[i + 1] === "\\") { out += "; "; i += 2; continue; }
      const [name, next] = readCommand(s, i);
      i = next;

      if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
        const [num, a] = readArg(s, i);
        const [den, b] = readArg(s, a);
        i = b;
        const n = convert(num).replace(/∂ +/g, "∂").trim();
        const d = convert(den).replace(/∂ +/g, "∂").trim();
        out += VULGAR[`${n}/${d}`] ?? `${unit(n)}/${unit(d)}`;
        continue;
      }
      if (name === "binom") {
        const [n, a] = readArg(s, i);
        const [k, b] = readArg(s, a);
        i = b;
        out += `C(${convert(n).trim()}, ${convert(k).trim()})`;
        continue;
      }
      if (name === "sqrt") {
        let root = "";
        if (s[i] === "[") {
          const end = s.indexOf("]", i);
          root = s.slice(i + 1, end);
          i = end + 1;
        }
        const [arg, next2] = readArg(s, i);
        i = next2;
        const sign = root === "3" ? "∛" : root === "4" ? "∜" : root ? `${script(root, SUPERSCRIPT, "^")}√` : "√";
        out += sign + unit(convert(arg));
        continue;
      }
      if (name === "ce" || name === "pu") {
        const [arg, next2] = readArg(s, i);
        i = next2;
        out += chemToReadable(arg);
        continue;
      }
      if (name === "mathbb") {
        const [arg, next2] = readArg(s, i);
        i = next2;
        out += BLACKBOARD[arg.trim()] ?? arg;
        continue;
      }
      if (ACCENTS[name]) {
        const [arg, next2] = readArg(s, i);
        i = next2;
        const inner = convert(arg).trim();
        out += [...inner].length === 1 ? inner + ACCENTS[name] : `${name}(${inner})`;
        continue;
      }
      if (FONT_WRAPPERS.has(name)) {
        if (name === "displaystyle" || name === "textstyle") continue;
        const [arg, next2] = readArg(s, i);
        i = next2;
        out += name.startsWith("text") || name === "mbox" ? arg : convert(arg);
        continue;
      }
      if (name === "left" || name === "right" || /^(big|Big|bigg|Bigg)[lr]?$/.test(name)) {
        if (s[i] === ".") i++;
        continue;
      }
      if (name === "begin") {
        const [env, afterEnv] = readArg(s, i);
        const endTag = `\\end{${env}}`;
        const end = s.indexOf(endTag, afterEnv);
        let body = end === -1 ? s.slice(afterEnv) : s.slice(afterEnv, end);
        i = end === -1 ? s.length : end + endTag.length;
        if (/^array$/.test(env)) body = body.replace(/^\s*\{[^}]*\}/, "");
        const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean);
        if (/matrix$/.test(env)) {
          const [open, close] = env === "vmatrix" ? ["|", "|"] : env === "bmatrix" ? ["[", "]"] : env === "Vmatrix" ? ["‖", "‖"] : ["(", ")"];
          out += open + rows.map(r => r.split("&").map(cell => convert(cell).trim()).join("  ")).join("; ") + close;
        } else if (env === "cases") {
          out += "{ " + rows.map(r => r.split("&").map(cell => convert(cell).trim()).filter(Boolean).join(", ")).join("; ") + " }";
        } else {
          // aligned, align, gathered, array: one line per row
          out += rows.map(r => convert(r.replace(/&/g, "")).trim()).join("\n");
        }
        continue;
      }
      if (name === "end") { readArg(s, i); continue; }
      if (FUNCTIONS.has(name)) {
        if (ENDS_IN_TERM.test(out)) out += " ";
        out += name === "bmod" ? " mod " : name;
        // "\sin\theta" has no space in the source but must not read "sinθ".
        if (/[a-zA-Z0-9\\]/.test(s[i] ?? "")) out += " ";
        continue;
      }
      if (name === "lim" || name === "limsup" || name === "liminf") {
        let j = i;
        while (s[j] === " ") j++;
        if (s[j] === "_") {
          const [sub, next2] = readArg(s, j + 1);
          i = next2;
          const inner = convert(sub).trim().replace(/\s*→\s*/g, "→");
          const mapped = script(inner, SUBSCRIPT, "_");
          out += mapped.startsWith("_") ? `lim(${inner}) ` : `lim${mapped} `;
        } else out += "lim ";
        continue;
      }
      if (name in SYMBOLS) { out += SYMBOLS[name]; continue; }
      out += name; // unknown command: its name is still more readable than a backslash
      continue;
    }

    if (c === "^" || c === "_") {
      const [arg, next] = readArg(s, i + 1);
      i = next;
      const inner = arg.startsWith("\\") && SYMBOLS[arg.slice(1)] === "′" ? "′" : convert(arg);
      out += script(inner, c === "^" ? SUPERSCRIPT : SUBSCRIPT, c);
      continue;
    }
    if (c === "{" || c === "}") { i++; continue; }
    if (c === "~") { out += " "; i++; continue; }
    if (c === "-") { out += "−"; i++; continue; }
    if (c === "'") { out += "′"; i++; continue; }
    out += c;
    i++;
  }
  return out;
}

/** mhchem source → readable Unicode: 2H2 + O2 -> 2H2O → 2H₂ + O₂ → 2H₂O. */
function chemToReadable(src: string): string {
  const sup = (t: string) => [...t].map(ch => SUPERSCRIPT[ch] ?? ch).join("");
  const sub = (t: string) => [...t].map(ch => SUBSCRIPT[ch] ?? ch).join("");
  return src
    .replace(/\^\{(\d+)\}_\{(\d+)\}([A-Z][a-z]?)/g, (_m, mass, num, el) => `${sup(mass)}${sub(num)}${el}`)
    .replace(/<=>|<->/g, "⇌")
    .replace(/->\[[^\]]*\]|->/g, "→")
    .replace(/<-/g, "←")
    .replace(/\s\^(?=\s|$)/g, " ↑")
    .replace(/\sv(?=\s|$)/g, " ↓")
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_m, charge) => sup(charge))
    // A charge written without ^ at the end of a species: H+, Na+, Fe3+, Cl-.
    .replace(/([A-Za-z)\]])(\d*[+-])(?=\s|$|[\])])/g, (_m, before, charge) => `${before}${sup(charge)}`)
    .replace(/([A-Za-z)\]])(\d+)/g, (_m, before, n) => `${before}${sub(n)}`)
    .replace(/\\Delta/g, "Δ")
    .trim();
}

/** LaTeX source → readable Unicode: \int_0^1 x^2\,dx → ∫₀¹ x² dx. */
export function latexToReadable(tex: string): string {
  return convert(tex)
    .replace(/∂ +/g, "∂")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;)])/g, "$1")
    .replace(/\( +/g, "(")
    .trim();
}

/** A whole note with $…$ maths → plain text with readable symbols (exports, previews). */
export function mathToPlainText(s: string | null | undefined): string {
  if (!s) return "";
  return parseMath(s)
    .map(seg => (seg.type === "text" ? seg.value : seg.display ? `\n${latexToReadable(seg.tex)}\n` : latexToReadable(seg.tex)))
    .join("")
    .replace(/\n{3,}/g, "\n\n");
}
