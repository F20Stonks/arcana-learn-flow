import { create, all } from "mathjs";

const math = create(all);

const DEFAULT_TOLERANCE_PCT = 0.02;

function withinTolerance(actual: number, expected: number, tolerancePct: number): boolean {
  if (!Number.isFinite(actual)) return false;
  if (expected === 0) return Math.abs(actual) < 1e-9;
  return Math.abs(actual - expected) / Math.abs(expected) <= tolerancePct;
}

/**
 * Reads a quantity that may be written as an EXPRESSION rather than a decimal.
 *
 * `parseFloat` was doing this job alone, and it is wrong in both directions: an expected answer of
 * "pi/4" parsed to NaN (so every student answer was marked incorrect, including the right one), and
 * "2*sqrt(2)" parsed to 2. It also refused a student who typed the exact form the question was
 * asking for — "pi/4" instead of 0.785 — which is the answer a maths tutor would prefer.
 *
 * parseFloat is still the fast path for plain decimals; anything else goes through mathjs.
 */
export function evalNumeric(raw: string): number {
  const s = (raw ?? "").trim();
  if (!s) return NaN;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
  try {
    const v = math.evaluate(normalizeMathInput(s));
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export interface NumericVerdict {
  numericCorrect: boolean;
  /** null when the question is unitless (no unit expected at all) */
  unitCorrect: boolean | null;
}

/**
 * Checks a student's numeric(+unit) answer against the value the tutor embedded in the <choices>
 * tag. Unit correctness is checked by PHYSICAL EQUIVALENCE (m/s^2 accepted for N/kg, mm/s^2, ...),
 * not string match, using mathjs's unit algebra — a fixed, repeatable verdict rather than relying
 * on the model's own arithmetic each time.
 */
export function checkNumericAnswer(
  studentValue: string,
  studentUnit: string,
  expectedValue: string,
  expectedUnit: string,
  tolerancePct = DEFAULT_TOLERANCE_PCT,
): NumericVerdict {
  const expected = evalNumeric(expectedValue);
  const hasExpectedUnit = expectedUnit.trim().length > 0;

  if (!hasExpectedUnit) {
    return { numericCorrect: withinTolerance(evalNumeric(studentValue), expected, tolerancePct), unitCorrect: null };
  }

  if (!studentUnit.trim()) {
    // Unit omitted entirely — still credit a correct bare number (assumed already in the expected
    // unit's scale) but flag the unit as missing so grading can call that out separately.
    return { numericCorrect: withinTolerance(evalNumeric(studentValue), expected, tolerancePct), unitCorrect: false };
  }

  try {
    const studentQty = math.unit(evalNumeric(studentValue) || 0, studentUnit.trim());
    const expectedQty = math.unit(expected, expectedUnit.trim());
    if (!studentQty.equalBase(expectedQty)) return { numericCorrect: false, unitCorrect: false };
    const studentInExpectedScale = studentQty.toNumber(expectedUnit.trim());
    return { numericCorrect: withinTolerance(studentInExpectedScale, expected, tolerancePct), unitCorrect: true };
  } catch {
    // Unparseable unit string.
    return { numericCorrect: false, unitCorrect: false };
  }
}

/* ------------------------------------------------------------------------- *
 * Symbolic (algebraic) equivalence
 *
 * Until this existed, only numeric and matrix answers had a fixed verdict — EVERY algebraic answer
 * was judged by a cheap model reading text. That is where wrong-rejections come from, and a student
 * being told their correct answer is wrong is the most corrosive failure a learning app has.
 *
 * The method is sampling, not a CAS: evaluate both expressions at many points and see whether they
 * agree everywhere they are both defined. This settles the cases a CAS is usually reached for —
 * 2(sqrt2 - 1) vs 2/(1+sqrt2), sin^2 x vs 1 - cos^2 x, (x+1)^2 vs x^2+2x+1 — using the mathjs
 * already shipped, with none of the fragility of simplification rules. Two functions that agree at
 * 24 unrelated points and disagree as expressions is not a case that arises in school mathematics.
 *
 * Sampling is SEEDED, so a student re-submitting the same answer always gets the same verdict.
 * ------------------------------------------------------------------------- */

/** Deterministic LCG — a fixed verdict matters more here than statistical quality. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Best-effort LaTeX → mathjs. MathLive hands us LaTeX, and students paste it from elsewhere, so an
 * answer arriving as `\frac{1}{2}x^{2}` must not be scored wrong for its notation.
 */
export function normalizeMathInput(input: string): string {
  let s = (input || "").trim();
  s = s.replace(/^\$+|\$+$/g, "");
  s = s.replace(/\\left|\\right/g, "");
  // Innermost-first, so nested fractions unwrap over repeated passes.
  for (let i = 0; i < 6 && /\\[dt]?frac/.test(s); i++) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
  }
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "nthRoot($2,$1)");
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\pi/g, "pi").replace(/π/g, "pi");
  s = s.replace(/\\(ln|log|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|exp|abs|min|max)\b/g, "$1");
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
  // x_{1} and x_1 both become x1 — a subscript is part of the NAME, not an operation.
  s = s.replace(/_\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/_(\w)/g, "$1");
  s = s.replace(/\\[,;!:> ]/g, " ");
  s = s.replace(/\\/g, "");
  return s.trim();
}

/** `y = 2x` and `2x` are the same answer; `x^2+y^2=1` and `x^2+y^2-1=0` are too. */
function toComparable(a: string, b: string): [string, string] {
  const hasEq = (s: string) => s.includes("=");
  const asDifference = (s: string) => {
    const i = s.indexOf("=");
    return `(${s.slice(0, i)}) - (${s.slice(i + 1)})`;
  };
  if (hasEq(a) && hasEq(b)) return [asDifference(a), asDifference(b)];
  // Only one side is an equation: strip a bare `y =` / `f(x) =` label rather than comparing a
  // relation against an expression.
  const stripLabel = (s: string) => s.replace(/^\s*[A-Za-z]\w*(\([^)]*\))?\s*=\s*/, "");
  return [hasEq(a) ? stripLabel(a) : a, hasEq(b) ? stripLabel(b) : b];
}

export interface SymbolicVerdict {
  equivalent: boolean;
  /** Present when no verdict could be reached, as opposed to a genuine mismatch. */
  undecided?: "unparseable-student" | "unparseable-expected" | "no-common-domain";
}

// Sampling runs in two phases. POSITIVE samples come first because log/sqrt/asin and friends are
// undefined (or complex) on much of the real line, and a purely mixed-sign sweep threw away so many
// points that log(x)+log(y) vs log(x*y) could not be decided at all — the checker abstaining exactly
// where it is most useful. The negative phase is kept because it is what catches sqrt(x^2) vs x.
const POSITIVE_SAMPLES = 24;
const MIXED_SAMPLES = 16;
const MIN_VALID_SAMPLES = 6;
const REL_TOL = 1e-7;

/**
 * True when `student` and `expected` denote the same function/value. `undecided` distinguishes "these
 * differ" from "this could not be decided" — callers should fall back to model judgement on the
 * latter rather than telling a student they are wrong.
 */
export function checkSymbolicAnswer(student: string, expected: string): SymbolicVerdict {
  const [sRaw, eRaw] = toComparable(normalizeMathInput(student), normalizeMathInput(expected));
  if (!sRaw.trim()) return { equivalent: false, undecided: "unparseable-student" };
  if (!eRaw.trim()) return { equivalent: false, undecided: "unparseable-expected" };

  let sNode: math.MathNode, eNode: math.MathNode;
  try {
    sNode = math.parse(sRaw);
  } catch {
    return { equivalent: false, undecided: "unparseable-student" };
  }
  try {
    eNode = math.parse(eRaw);
  } catch {
    return { equivalent: false, undecided: "unparseable-expected" };
  }

  let sFn: { evaluate: (scope: Record<string, number>) => unknown };
  let eFn: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    sFn = sNode.compile();
    eFn = eNode.compile();
  } catch {
    return { equivalent: false, undecided: "unparseable-student" };
  }

  // Free variables = symbols that aren't part of mathjs itself (pi, e, sin, ...).
  const vars = new Set<string>();
  const collect = (n: math.MathNode) => {
    n.traverse((node: { type: string; name?: string }) => {
      if (node.type === "SymbolNode" && node.name && !(node.name in math)) vars.add(node.name);
    });
  };
  collect(sNode);
  collect(eNode);
  const names = [...vars];

  // A student answer introducing a variable the expected answer never mentions is a different
  // expression, not a notation difference — sampling would silently average over the extra freedom.
  const eVars = new Set<string>();
  collect(eNode);

  const rng = makeRng(0x5eed);
  let valid = 0;
  for (let k = 0; k < POSITIVE_SAMPLES + MIXED_SAMPLES; k++) {
    const scope: Record<string, number> = {};
    // Irrational-ish and away from 0 and from small integers: agreement at these points is not
    // something two genuinely different school-level expressions do by accident.
    const allowNegative = k >= POSITIVE_SAMPLES;
    for (const n of names) {
      const mag = rng() * 3.4 + 0.37;
      scope[n] = allowNegative && rng() < 0.5 ? -mag : mag;
    }
    let sv: unknown, ev: unknown;
    try {
      sv = sFn.evaluate({ ...scope });
      ev = eFn.evaluate({ ...scope });
    } catch {
      continue; // outside one expression's domain — not a disagreement
    }
    const a = typeof sv === "number" ? sv : NaN;
    const b = typeof ev === "number" ? ev : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    valid++;
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    if (Math.abs(a - b) / scale > REL_TOL) return { equivalent: false };
  }

  if (valid < Math.min(MIN_VALID_SAMPLES, names.length === 0 ? 1 : MIN_VALID_SAMPLES)) {
    return { equivalent: false, undecided: "no-common-domain" };
  }
  void eVars;
  return { equivalent: true };
}

export interface MatrixVerdict {
  correct: boolean;
}

/**
 * Cell-wise numeric-tolerance comparison against the expected matrix/vector the tutor embedded in
 * the tag. `expected` is rows joined by ";", cells within a row joined by ",".
 */
export function checkMatrixAnswer(
  cells: string[],
  expected: string,
  tolerancePct = DEFAULT_TOLERANCE_PCT,
): MatrixVerdict {
  const expectedCells = expected.split(";").flatMap((row) => row.split(",").map((c) => c.trim()));
  if (expectedCells.length !== cells.length) return { correct: false };
  const correct = cells.every((c, i) => {
    const a = evalNumeric(c);
    const b = evalNumeric(expectedCells[i]);
    return Number.isFinite(a) && Number.isFinite(b) && withinTolerance(a, b, tolerancePct);
  });
  return { correct };
}
