/**
 * Grading answers.
 *
 * An antiderivative has no canonical form: `-cos(x)^2/2`, `sin(x)^2/2` and `-cos(2x)/4` are the
 * same answer, and a student who types any of them is right. So we never compare strings or
 * normal forms. We compare *functions*: evaluate the student's expression and the reference at a
 * spread of points inside the problem's domain, and accept when the difference between them is
 * constant — which is exactly the "+ C" freedom, and nothing more.
 *
 * The other half of the job is meeting students where they type. `\frac{1}{2}\ln|x|`, `(1/2) ln|x|`
 * and `0.5*log(abs(x))` all have to reach the evaluator as the same thing, so `normalize` accepts
 * pasted LaTeX, textbook shorthand (`sin^2 x`, `arctan`, `ln`), and mathjs syntax alike.
 */
import { parse, type EvalFunction } from "mathjs";
import type { Problem, Verdict } from "./types";

/** Names mathjs will treat as functions — everything else followed by "(" means multiplication. */
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot",
  "asin", "acos", "atan", "asec", "acsc", "acot", "atan2",
  "sinh", "cosh", "tanh", "sech", "csch", "coth",
  "asinh", "acosh", "atanh", "asech", "acsch", "acoth",
  "log", "log10", "log2", "exp", "sqrt", "cbrt", "nthRoot",
  "abs", "sign", "floor", "ceil", "round", "min", "max", "gamma", "erf",
]);

/** Textbook spellings → mathjs spellings, applied per identifier rather than by regex. */
const ALIASES: Record<string, string> = {
  arcsin: "asin", arccos: "acos", arctan: "atan",
  arcsec: "asec", arccsc: "acsc", arccot: "acot",
  arcsinh: "asinh", arccosh: "acosh", arctanh: "atanh",
  ln: "log", E: "e",
};

/**
 * Walks the string identifier by identifier, handing each to `f`. Regex word boundaries can't do
 * this job: `\b` treats a digit as a word character, so `2ln|x|` hides its `ln` from `\bln\b`,
 * and implicit multiplication puts digits against identifiers all the time.
 */
function mapIdentifiers(s: string, f: (name: string, followedBy: string) => string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (!/[a-zA-Z_]/.test(s[i])) {
      out += s[i++];
      continue;
    }
    let j = i;
    while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
    let k = j;
    while (s[k] === " ") k++;
    out += f(s.slice(i, j), s[k] ?? "") + s.slice(j, k);
    i = k;
  }
  return out;
}

/** Reads the balanced group starting at `open` (which must sit on the opening char). */
function readGroup(s: string, open: number, o: string, c: string): { body: string; end: number } | null {
  if (s[open] !== o) return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === o) depth++;
    else if (s[i] === c) {
      depth--;
      if (depth === 0) return { body: s.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** \frac{a}{b} → ((a)/(b)), innermost-safe because we recurse on the bodies. */
function expandFrac(s: string): string {
  const i = s.indexOf("\\frac");
  if (i === -1) return s;
  let j = i + 5;
  while (s[j] === " ") j++;
  const num = readGroup(s, j, "{", "}");
  if (!num) return s.slice(0, i) + s.slice(i + 5);
  let k = num.end + 1;
  while (s[k] === " ") k++;
  const den = readGroup(s, k, "{", "}");
  if (!den) return s.slice(0, i) + s.slice(i + 5);
  const rebuilt =
    s.slice(0, i) + `((${expandFrac(num.body)})/(${expandFrac(den.body)}))` + s.slice(den.end + 1);
  return expandFrac(rebuilt);
}

/** \sqrt{a} → sqrt(a), \sqrt[n]{a} → nthRoot(a,n). */
function expandSqrt(s: string): string {
  const i = s.indexOf("\\sqrt");
  if (i === -1) return s;
  let j = i + 5;
  let index: string | null = null;
  if (s[j] === "[") {
    const idx = readGroup(s, j, "[", "]");
    if (idx) {
      index = idx.body;
      j = idx.end + 1;
    }
  }
  while (s[j] === " ") j++;
  const body = readGroup(s, j, "{", "}");
  if (!body) return s.slice(0, i) + "sqrt" + s.slice(i + 5);
  const inner = expandSqrt(body.body);
  const rebuilt =
    s.slice(0, i) +
    (index ? `nthRoot(${inner},${index})` : `sqrt(${inner})`) +
    s.slice(body.end + 1);
  return expandSqrt(rebuilt);
}

/**
 * |u| → abs(u), pairing bars left to right. When a function name sits right against the opening
 * bar the bars are doing double duty as its brackets — `ln|x|` means `log(abs(x))`, not
 * `log · abs(x)` — so we pull the name inside.
 */
function expandBars(s: string): string {
  const first = s.indexOf("|");
  if (first === -1) return s;
  const second = s.indexOf("|", first + 1);
  if (second === -1) return s.replace(/\|/g, "");

  let head = s.slice(0, first);
  let inner = `abs(${expandBars(s.slice(first + 1, second))})`;
  const fn = /[a-zA-Z_][a-zA-Z0-9_]*$/.exec(head);
  if (fn && FUNCTIONS.has(fn[0])) {
    head = head.slice(0, fn.index);
    inner = `${fn[0]}(${inner})`;
  }
  return head + inner + expandBars(s.slice(second + 1));
}

/**
 * sin^2(x) → (sin(x))^2, and sin^-1(x) → asin(x). Both are things every student types and no
 * parser accepts.
 */
function expandFunctionPowers(s: string): string {
  const re = /(^|[^a-zA-Z_])(a?(?:sin|cos|tan|sec|csc|cot)h?|log)\s*\^\s*\(?\s*(-?\d+)\s*\)?\s*/;
  let out = s;
  for (let guard = 0; guard < 20; guard++) {
    const m = re.exec(out);
    if (!m) break;
    const [full, lead, fn, powRaw] = m;
    const at = m.index + lead.length;
    const rest = out.slice(m.index + full.length);
    // Grab the function's argument: a parenthesised group if there is one, else the bare token.
    let arg: string;
    let consumed: number;
    const group = readGroup(rest, 0, "(", ")");
    if (group) {
      arg = group.body;
      consumed = group.end + 1;
    } else {
      const bare = /^[a-zA-Z0-9_.]+/.exec(rest);
      if (!bare) break;
      arg = bare[0];
      consumed = bare[0].length;
    }
    const pow = Number(powRaw);
    const replacement =
      pow === -1 && fn !== "log" ? `${inverseName(fn)}(${arg})` : `((${fn}(${arg}))^(${pow}))`;
    out = out.slice(0, at) + replacement + rest.slice(consumed);
  }
  return out;
}

function inverseName(fn: string): string {
  if (fn.startsWith("a")) return fn.slice(1); // asin^-1 is nobody's notation, but be consistent
  return "a" + fn;
}

/** x(x+1) is multiplication, not a call — mathjs would try to invoke `x`. */
function fixImplicitCalls(s: string): string {
  return mapIdentifiers(s, (name, next) => (next === "(" && !FUNCTIONS.has(name) ? `${name}*` : name));
}

/**
 * Student syntax → mathjs syntax. Pure string work; never throws.
 */
export function normalize(raw: string): string {
  let s = raw.trim();
  if (!s) return "";

  // "+ C" is the whole point of an indefinite integral, and carries no information for grading.
  s = s.replace(/[+-]\s*(?:C|c|const|constant)\s*$/, "");
  s = s.replace(/^\s*(?:F\s*\(\s*x\s*\)|y)\s*=\s*/, ""); // "F(x) = ..." / "y = ..."

  // LaTeX scaffolding.
  s = s.replace(/\\left|\\right|\\!|\\,|\\;|\\:|\\ /g, " ");
  s = s.replace(/\\cdot|\\times/g, "*").replace(/\\div/g, "/");
  s = s.replace(/\\dfrac|\\tfrac/g, "\\frac");
  s = expandFrac(s);
  s = expandSqrt(s);
  s = s.replace(/\\operatorname\s*\{([^}]*)\}/g, "$1");
  s = s.replace(/\\([a-zA-Z]+)/g, "$1"); // \sin → sin, \pi → pi, \ln → ln
  // Brace groups are only ever grouping by this point.
  s = s.replace(/\{/g, "(").replace(/\}/g, ")");

  // Aliases first: everything downstream (function powers, bars-as-brackets) recognises functions
  // by their mathjs names.
  s = mapIdentifiers(s, (name) => ALIASES[name] ?? name);
  s = expandFunctionPowers(s);
  s = expandBars(s);

  s = fixImplicitCalls(s);
  s = s.replace(/\)\s*\(/g, ")*(");
  return s.trim();
}

interface Compiled {
  fn: EvalFunction;
  /** Free symbols other than the ones we bind — a definite answer must have none. */
  symbols: string[];
}

function compile(expr: string): Compiled | null {
  try {
    const node = parse(expr);
    const symbols = new Set<string>();
    node.traverse((n) => {
      if (n.type === "SymbolNode") {
        const name = (n as unknown as { name: string }).name;
        if (!FUNCTIONS.has(name) && !["pi", "e", "tau", "Infinity"].includes(name)) symbols.add(name);
      }
    });
    return { fn: node.compile(), symbols: [...symbols] };
  } catch {
    return null;
  }
}

function evalAt(c: Compiled, x?: number): number | null {
  try {
    const v = c.fn.evaluate(x === undefined ? {} : { x });
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic, irregular sample points strictly inside the domain. Golden-ratio spacing so we
 * never line up with a period of the integrand and never sit exactly on a half-integer pole.
 */
function samplePoints([a, b]: [number, number], n = 11): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.04 + 0.92 * ((i * 0.6180339887498949 + 0.137) % 1);
    pts.push(a + (b - a) * t);
  }
  return pts.sort((p, q) => p - q);
}

/** Least-squares fit of u ≈ k·r + c; returns null when r is too flat to fit against. */
function fitLinear(r: number[], u: number[]): { k: number; residual: number } | null {
  const n = r.length;
  const mr = r.reduce((s, v) => s + v, 0) / n;
  const mu = u.reduce((s, v) => s + v, 0) / n;
  let srr = 0;
  let sru = 0;
  for (let i = 0; i < n; i++) {
    srr += (r[i] - mr) ** 2;
    sru += (r[i] - mr) * (u[i] - mu);
  }
  if (srr < 1e-12) return null;
  const k = sru / srr;
  const c = mu - k * mr;
  let residual = 0;
  for (let i = 0; i < n; i++) residual = Math.max(residual, Math.abs(u[i] - (k * r[i] + c)));
  return { k, residual };
}

const MIN_USABLE_POINTS = 5;

/** Two antiderivatives agree when their difference is constant across the domain. */
export function checkIndefinite(userRaw: string, referenceRaw: string, domain: [number, number]): Verdict {
  const normalized = normalize(userRaw);
  if (!normalized) return { status: "unparseable", reason: "Nothing to grade yet." };

  const user = compile(normalized);
  if (!user) return { status: "unparseable", reason: "Couldn't read that expression — check the brackets." };
  const stray = user.symbols.filter((s) => s !== "x");
  if (stray.length) {
    return {
      status: "unparseable",
      reason: `Unknown symbol ${stray[0]} — write the answer in terms of x (the "+ C" is assumed).`,
    };
  }

  const reference = compile(normalize(referenceRaw));
  if (!reference) return { status: "unparseable", reason: "Grader error: bad reference answer." };

  const r: number[] = [];
  const u: number[] = [];
  for (const x of samplePoints(domain)) {
    const rv = evalAt(reference, x);
    const uv = evalAt(user, x);
    if (rv === null || uv === null) continue;
    r.push(rv);
    u.push(uv);
  }
  if (r.length < MIN_USABLE_POINTS) {
    return { status: "incorrect", reason: "That expression isn't defined over the region we grade on." };
  }

  const scale = 1 + Math.max(...r.map(Math.abs), ...u.map(Math.abs));
  const diffs = u.map((v, i) => v - r[i]);
  const spread = Math.max(...diffs) - Math.min(...diffs);
  if (spread <= 1e-6 * scale) return { status: "correct" };

  const fit = fitLinear(r, u);
  if (fit && fit.residual <= 1e-6 * scale && Math.abs(fit.k) > 1e-9 && Math.abs(fit.k - 1) > 1e-6) {
    return { status: "off-by-constant-factor", factor: fit.k };
  }
  return { status: "incorrect" };
}

/** A definite integral is a number: grade it as one. */
export function checkDefinite(userRaw: string, referenceRaw: string): Verdict {
  const normalized = normalize(userRaw);
  if (!normalized) return { status: "unparseable", reason: "Nothing to grade yet." };

  const user = compile(normalized);
  if (!user) return { status: "unparseable", reason: "Couldn't read that expression — check the brackets." };
  if (user.symbols.length) {
    return {
      status: "unparseable",
      reason: `This one is definite — the answer is a number, but you still have ${user.symbols[0]} in it.`,
    };
  }

  const reference = compile(normalize(referenceRaw));
  const expected = reference && evalAt(reference);
  if (expected === null || expected === undefined) {
    return { status: "unparseable", reason: "Grader error: bad reference answer." };
  }
  const got = evalAt(user);
  if (got === null) return { status: "unparseable", reason: "That doesn't evaluate to a real number." };

  if (Math.abs(got - expected) <= 1e-7 * (1 + Math.abs(expected))) return { status: "correct" };
  if (Math.abs(expected) > 1e-9) {
    const k = got / expected;
    if (Math.abs(k - 1) > 1e-6 && Math.abs(k) > 1e-9) return { status: "off-by-constant-factor", factor: k };
  }
  return { status: "incorrect" };
}

export function gradeAnswer(problem: Problem, input: string): Verdict {
  return problem.kind === "definite"
    ? checkDefinite(input, problem.answer)
    : checkIndefinite(input, problem.answer, problem.domain);
}

/** Live LaTeX preview of whatever the student has typed so far. Falls back to the raw text. */
export function previewLatex(raw: string): string | null {
  const normalized = normalize(raw);
  if (!normalized) return null;
  try {
    return parse(normalized).toTex({ parenthesis: "auto", implicit: "hide" });
  } catch {
    return null;
  }
}

/** "1/2", "2", "-1/3" — for telling a student exactly which constant they dropped. */
export function describeFactor(k: number): string {
  for (let d = 1; d <= 12; d++) {
    const n = k * d;
    if (Math.abs(n - Math.round(n)) < 1e-6) {
      const num = Math.round(n);
      if (d === 1) return `${num}`;
      return `${num}/${d}`;
    }
  }
  return k.toFixed(3);
}
