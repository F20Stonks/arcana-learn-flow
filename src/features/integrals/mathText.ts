/**
 * Hints, lesson beats and worked solutions are written the way a person writes on a whiteboard:
 * LaTeX with English threaded through it ("Put x = 0: A = 1, so the integral is \\ln|x|"). KaTeX
 * needs to be told which is which, or every English word renders as a product of italic variables.
 *
 * `toMathMode` finds the prose and wraps it in \text{}. The rule is deliberately narrow so it can
 * be reasoned about: a prose word is a run of three or more letters not introduced by a backslash,
 * or one of the closed set of two-letter English words. Everything else — single letters, dx, du,
 * uv, digits, and every backslash command — stays math.
 */

/** The complete set of two-letter English words that appear in this feature's prose. */
const SHORT_WORDS = new Set([
  "an", "as", "at", "be", "by", "do", "go", "if", "in", "is", "it", "no", "of", "on", "or", "so",
  "to", "up", "us", "we",
]);

/** Separators a run of prose may swallow without breaking. Note: no hyphen — see `isHyphen`. */
const JOINERS = " ,.;:!?'’—–";
/** Only these may be absorbed leftwards, where a stray dash really would be a minus sign. */
const LEFT_JOINERS = " —–";

function isLetter(c: string): boolean {
  return c >= "a" && c <= "z" ? true : c >= "A" && c <= "Z";
}

/** A dash with a letter on both sides is a hyphen ("half-integer"); anywhere else it's a minus. */
function isHyphen(s: string, i: number): boolean {
  return s[i] === "-" && i > 0 && isLetter(s[i - 1]) && isLetter(s[i + 1] ?? "");
}

interface Word {
  start: number;
  end: number;
  prose: boolean;
}

/** Splits into letter-runs, marking each as prose or math. */
function words(s: string): Word[] {
  const out: Word[] = [];
  let i = 0;
  while (i < s.length) {
    if (!isLetter(s[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < s.length && isLetter(s[j])) j++;
    const text = s.slice(i, j);
    const isCommand = i > 0 && s[i - 1] === "\\";
    // The tail of a contraction or possessive — the "s" of "denominator's", the "t" of "don't" —
    // is a letter or two on its own, but it is never a variable.
    const afterApostrophe = i > 0 && (s[i - 1] === "'" || s[i - 1] === "’");
    const prose =
      !isCommand && (afterApostrophe || text.length >= 3 || SHORT_WORDS.has(text.toLowerCase()));
    out.push({ start: i, end: j, prose });
    i = j;
  }

  // "a" is the one letter that is usually a variable and sometimes an article. A lone "a" or "A"
  // separated from the next *prose* word by nothing but a space is the article ("a half-integer
  // power"); anything else — "a = 2", "a\sin\theta" — keeps it a variable.
  for (let k = 0; k < out.length - 1; k++) {
    const w = out[k];
    const next = out[k + 1];
    const text = s.slice(w.start, w.end);
    if (w.prose || (text !== "a" && text !== "A")) continue;
    if (w.start > 0 && (s[w.start - 1] === "^" || s[w.start - 1] === "_")) continue;
    if (!next.prose || !/^ +$/.test(s.slice(w.end, next.start))) continue;
    w.prose = true;
  }
  return out;
}

/** The spans of `\text{...}` and `\operatorname{...}` bodies, which are prose already. */
function protectedSpans(s: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /\\(?:text|operatorname|mathrm)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < s.length && depth > 0) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") depth--;
      i++;
    }
    spans.push([m.index, i]);
    re.lastIndex = i;
  }
  return spans;
}

export interface Segment {
  type: "text" | "math";
  value: string;
}

/**
 * Splits a mixed prose/LaTeX string into alternating prose and math runs. Rendering each run
 * separately is what lets a paragraph wrap: KaTeX output is an unbreakable inline box, so a whole
 * sentence rendered as one node overflows its container instead of breaking across lines.
 */
/** Unicode operators students' sources are full of, mapped to commands KaTeX actually knows. */
export function normalizeGlyphs(raw: string): string {
  return raw.replace(/×/g, "\\times ").replace(/÷/g, "\\div ").replace(/−/g, "-");
}

export function segments(raw: string): Segment[] {
  const s = normalizeGlyphs(raw);
  const guarded = protectedSpans(s);
  const inGuard = (i: number) => guarded.some(([a, b]) => i >= a && i < b);

  const ws = words(s).filter((w) => !inGuard(w.start));

  // Group adjacent prose words separated only by joiners into single runs.
  const runs: Array<[number, number]> = [];
  for (const w of ws) {
    if (!w.prose) continue;
    const last = runs[runs.length - 1];
    // Digits between two prose words belong to the prose ("note the 4, from integrating") — but a
    // run can never start on one, so "3A = 8" keeps its coefficient in math.
    if (
      last &&
      [...s.slice(last[1], w.start)].every(
        (c, k) => JOINERS.includes(c) || /[0-9]/.test(c) || isHyphen(s, last[1] + k),
      )
    ) {
      last[1] = w.end;
    } else {
      runs.push([w.start, w.end]);
    }
  }

  // Pull trailing punctuation in, and any leading space or dash, so the spacing survives math mode.
  for (const run of runs) {
    while (run[1] < s.length && JOINERS.includes(s[run[1]]) && s[run[1]] !== "—" && s[run[1]] !== "–") {
      run[1]++;
    }
    while (
      run[0] > 0 &&
      !inGuard(run[0] - 1) &&
      (LEFT_JOINERS.includes(s[run[0] - 1]) || isHyphen(s, run[0] - 1))
    ) {
      run[0]--;
    }
  }

  // A matched pair of brackets wrapping nothing but prose belongs to the prose. Without this,
  // "(a multiple of)" renders as three runs and the closing bracket can wrap onto its own line,
  // orphaned from the words it belongs to. Both brackets must be flush against the run, so a
  // bracket that is really opening a formula — "the derivative (2x+4)" — is left alone.
  for (const run of runs) {
    if (run[0] > 0 && s[run[0] - 1] === "(" && s[run[1]] === ")" && !inGuard(run[0] - 1)) {
      run[0]--;
      run[1]++;
    }
  }

  // Extending runs can leave two of them touching. Fold those together so the output is one
  // prose segment rather than several, which keeps the rendered text a single wrappable block.
  const merged: Array<[number, number]> = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && [...s.slice(last[1], run[0])].every((c) => JOINERS.includes(c))) last[1] = run[1];
    else merged.push(run);
  }

  if (merged.length === 0) return [{ type: "math", value: s }];

  const out: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start < cursor) continue;
    if (start > cursor) out.push({ type: "math", value: s.slice(cursor, start) });
    out.push({ type: "text", value: s.slice(start, end) });
    cursor = end;
  }
  if (cursor < s.length) out.push({ type: "math", value: s.slice(cursor) });
  return out;
}

/**
 * The whole string as one KaTeX-safe math expression. Fine for a short line; for a paragraph
 * prefer `segments`, since a single KaTeX node is one unbreakable box and will run off the edge
 * rather than wrap.
 */
export function toMathMode(raw: string): string {
  return segments(raw)
    .map((seg) =>
      seg.type === "text"
        ? `\\text{${seg.value.replace(/([{}\\])/g, "")}}`
        : guardDashes(seg.value),
    )
    .join("");
}

/**
 * A dash that ended up outside every \text{} block — one sitting between two formulas — is a
 * character KaTeX has no math-mode glyph for. Give it one.
 */
function guardDashes(s: string): string {
  if (!/[—–]/.test(s)) return s;
  const guarded = protectedSpans(s);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const inside = guarded.some(([a, b]) => i >= a && i < b);
    out += !inside && (s[i] === "—" || s[i] === "–") ? `\\text{${s[i]}}` : s[i];
  }
  return out;
}
