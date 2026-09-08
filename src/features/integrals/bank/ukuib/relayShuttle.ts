/**
 * The UK University Integration Bee — Relay and Shuttle rounds, five sittings never mined before
 * this file: 2021/22 Round 2 Shuttle, and the 2022/23, 2023/24, 2024/25 and 2025/26 Round 2 Relay
 * rounds. Both formats chain problems together (a team's answer to one problem becomes a literal
 * numeric parameter inside the next), so mining them means solving each link IN ORDER and
 * substituting the derived value forward — exactly the approach `round3.ts`'s Chainlink section
 * already established as precedent (read there, not edited here).
 *
 * Once a link's true parameter is known, its own integral is an ordinary standalone `Problem`;
 * nothing about "this was part of a chain" survives past that except the round name in `source`.
 * Every closed form below (chain-derived or a self-contained Relay problem) was verified against
 * `harness.local/verify.ts` before being written down — see `harness.local/report-relay-shuttle.md`
 * for every problem/link that was NOT included and why.
 *
 * --- 2021/22 Shuttle: how each chain's parameters were resolved -------------------------------
 * The Shuttle document is four INDEPENDENT relays (A, B, C, D), each of four problems, with
 * explicit "Pass on ... . x is the number you will receive" instructions between problems.
 *   Shuttle A: A1 (\int_0^1\ln^2x\,dx=2) squared gives a=4 for A2. A2 (=\frac{\sqrt2}4\pi, a
 *     genuine duplicate of the already-banked "trig-sinx-over-sin-x-plus-piover4" — skipped, not
 *     re-added) is of the form \pi/b, giving b=2\sqrt2 (irrational, but A3's own identity —
 *     \int_0^{\pi/2}dx/(1+\tan^bx)=\pi/4 — is famously true for ANY real b, so the messy b never
 *     had to be "clean" for the chain to keep working). A3=\pi/4, times 4, gives c=\pi for A4.
 *   Shuttle B: B1 (=0 by an x\to2\pi-x antisymmetry argument, already banked as
 *     "def-sin-sinx-minus-x-full-period" — skipped) passes a=0 straight through to B2's lower
 *     bound. B2=13\pi; "the second digit of your answer" is read as the second digit of the
 *     integer coefficient 13 (not of the irrational decimal 13\pi, which has no well-defined
 *     "digit" — and reading it as the literal first decimal digit would pass b=0, making B3's
 *     \ln(b(x+1)) identically \ln0, undefined — a decisive check against that other reading),
 *     giving b=3 for B3. B3\approx1.135 passes through unchanged as c for B4.
 *   Shuttle C: C1=2\sqrt2, squared minus 2, gives a=6 for C2. C2=6-366e^{-6}\approx5.093; "2 minus
 *     your answer" gives b=366e^{-6}-4\approx-3.093 for C3's exponent 1/b. C3 was carried through
 *     symbolically in exact mathjs syntax (never rounded by hand) precisely because the passed
 *     constant is this ugly — see the entry itself.
 *   Shuttle D: D1 is lim_{n\to\infty}\int_{5/6}^\infty e^{-x^n}dx=1/6 (the pointwise limit is the
 *     indicator of (5/6,1)) — a genuine "limit of a family of integrals," not itself an ordinary
 *     Problem, but its resolved value (a,b)=(3,2), the prime factors of q=6 with a>b, is what D2
 *     needs. D2=\ln(4/3); "least integer bigger than" gives c=1 for D3. D3=\frac14(\ln27-2)
 *     matches the stated r/s(\ln t-u) form with (r,s,t,u)=(1,4,27,2); "r+\sqrt r+s/u" gives
 *     1+1+2=4=d for D4. D4=\frac{\pi^2}{\sqrt3}.
 * C4 and B4 could not be safely included — see the skip report.
 *
 * --- The four Relay documents -------------------------------------------------------------------
 * None of the 2022/2023/2024/2025 Relay OCR text carries an explicit "pass on" instruction the way
 * the Shuttle does — several problems use a bare letter (a, b, n, r) with nothing in the extracted
 * text defining it, which reads as the hand-off mechanism having lived on a page/announcement this
 * OCR didn't capture. Rather than guess those parameters, every problem below from these four
 * documents is one that is fully SELF-CONTAINED (no unresolved external constant) — a real,
 * verbatim transcription of that sitting's Relay set, which is exactly what this task's own
 * fallback describes: "once you know a link's true parameters, it becomes a completely normal,
 * standalone integral." Problems carrying an unresolved bare letter, a functional equation with no
 * concrete numeric ask, a qualitative ("how many solutions") question, or a genuine limit-of-a-
 * family-of-integrals are all logged as skips, not guessed.
 */
import type { Problem } from "../../types";

export const UkuibRelayShuttle: Problem[] = [
  // ===============================================================================================
  // 2021/22 Shuttle
  // ===============================================================================================
  // ukuib21shuttle-a1 (\ln^2x on [0,1] = 2, the chain's own A1 link) was an exact duplicate of the
  // pre-existing feynman-log-squared in feynman.ts, which carried {name: "original"} --
  // re-attributed that entry to this real source (2021 Shuttle) instead of keeping two copies.
  // The chain narrative above still cites its value (a=2, squared to 4 feeding A2) since that's
  // documentation, not a second drillable Problem.
  {
    id: "ukuib21shuttle-a3",
    kind: "definite",
    integrand: "\\frac1{1+\\tan^{2\\sqrt2}x}",
    integrandExpr: "1/(1+tan(x)^(2*sqrt(2)))",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "pi/4",
    answerLatex: "\\frac\\pi4",
    domain: [0, 1.5707963267948966],
    difficulty: 3,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link in this shuttle passes a real (not integer!) exponent here — but \\int_0^{\\pi/2}\\frac{dx}{1+\\tan^bx}=\\frac\\pi4 for ANY real b, so the exact value doesn't matter.",
      "Substitute x\\to\\frac\\pi2-x and use \\tan\\!\\left(\\frac\\pi2-x\\right)=\\cot x=\\frac1{\\tan x}.",
    ],
    steps: [
      "Let I=\\int_0^{\\pi/2}\\frac{dx}{1+\\tan^bx}. Under x\\to\\frac\\pi2-x, \\tan^bx\\to\\cot^bx=\\tan^{-b}x, giving I=\\int_0^{\\pi/2}\\frac{\\tan^bx}{\\tan^bx+1}\\,dx.",
      "Adding the two forms of I: 2I=\\int_0^{\\pi/2}\\frac{1+\\tan^bx}{1+\\tan^bx}\\,dx=\\int_0^{\\pi/2}1\\,dx=\\frac\\pi2.",
      "So I=\\frac\\pi4, regardless of b — here b=2\\sqrt2, the exact (irrational) value passed from the previous link.",
    ],
  },
  {
    id: "ukuib21shuttle-a4",
    kind: "definite",
    integrand: "x\\ln(\\sin x)",
    integrandExpr: "x*log(sin(x))",
    lower: "0",
    upper: "\\pi",
    answer: "-pi^2*log(2)/2",
    answerLatex: "-\\frac{\\pi^2\\ln2}2",
    domain: [0, 3.141592653589793],
    difficulty: 4,
    techniques: ["symmetry", "zeta-series"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The upper bound c=\\pi arrives clean from the previous link (4\\times\\frac\\pi4). Try x\\to\\pi-x on the whole integral.",
      "You'll need the classic result \\int_0^\\pi\\ln(\\sin x)\\,dx=-\\pi\\ln2.",
    ],
    steps: [
      "Let I=\\int_0^\\pi x\\ln(\\sin x)\\,dx. Under x\\to\\pi-x, \\ln(\\sin x) is unchanged (\\sin(\\pi-x)=\\sin x), giving I=\\int_0^\\pi(\\pi-x)\\ln(\\sin x)\\,dx=\\pi\\int_0^\\pi\\ln(\\sin x)\\,dx-I.",
      "So 2I=\\pi\\int_0^\\pi\\ln(\\sin x)\\,dx. The classic log-sine integral gives \\int_0^\\pi\\ln(\\sin x)\\,dx=-\\pi\\ln2.",
      "2I=\\pi(-\\pi\\ln2)=-\\pi^2\\ln2, so I=-\\frac{\\pi^2\\ln2}2.",
    ],
  },
  {
    id: "ukuib21shuttle-b2",
    kind: "definite",
    integrand: "\\ln\\!\\left(1+\\frac{169}{x^2}\\right)",
    integrandExpr: "log(1+169/x^2)",
    lower: "0",
    upper: "\\infty",
    answer: "13*pi",
    answerLatex: "13\\pi",
    domain: [0, Infinity],
    difficulty: 4,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link passes a=0 for the lower bound. Treat the 169 as a general c^2 and differentiate F(c)=\\int_0^\\infty\\ln\\!\\left(1+\\frac{c^2}{x^2}\\right)dx with respect to c.",
      "F'(c)=\\int_0^\\infty\\frac{2c}{x^2+c^2}\\,dx=\\pi, independent of c, and F(0)=0.",
    ],
    steps: [
      "F(c)=\\int_0^\\infty\\ln\\!\\left(1+\\frac{c^2}{x^2}\\right)dx has F'(c)=\\int_0^\\infty\\frac{2c/x^2}{1+c^2/x^2}\\,dx=\\int_0^\\infty\\frac{2c}{x^2+c^2}\\,dx=2c\\cdot\\frac1c\\left[\\tan^{-1}\\frac xc\\right]_0^\\infty=\\pi.",
      "F'(c)=\\pi for every c>0, and F(0)=0, so F(c)=\\pi c.",
      "With c^2=169, c=13: F(13)=13\\pi.",
    ],
  },
  {
    id: "ukuib21shuttle-b3",
    kind: "definite",
    integrand: "\\frac{\\ln(3(x+1))}{x^2+1}",
    integrandExpr: "log(3*(x+1))/(x^2+1)",
    lower: "0",
    upper: "1",
    answer: "(pi/4)*log(3)+(pi/8)*log(2)",
    answerLatex: "\\frac\\pi4\\ln3+\\frac\\pi8\\ln2",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link passes b=3 (\"the second digit of 13\\pi\" is read as the second digit of the integer coefficient 13 — the alternative reading, the literal first decimal digit of 13\\pi\\approx40.84, would pass 0 and make \\ln(0\\cdot(x+1)) undefined next).",
      "Split \\ln(3(x+1))=\\ln3+\\ln(x+1) and handle the two resulting integrals separately.",
    ],
    steps: [
      "\\int_0^1\\frac{\\ln3}{x^2+1}\\,dx=\\ln3\\left[\\tan^{-1}x\\right]_0^1=\\frac\\pi4\\ln3.",
      "\\int_0^1\\frac{\\ln(x+1)}{x^2+1}\\,dx is the classic King's-rule integral (x=\\tan\\theta, then \\theta\\to\\frac\\pi4-\\theta) equal to \\frac\\pi8\\ln2.",
      "Adding: \\frac\\pi4\\ln3+\\frac\\pi8\\ln2.",
    ],
  },
  {
    id: "ukuib21shuttle-c1",
    kind: "definite",
    integrand: "\\frac{\\sin(\\cot^{-1}x)+\\cos(\\tan^{-1}x)}{x^2+1}",
    integrandExpr: "2/(1+x^2)^(3/2)",
    lower: "-1",
    upper: "1",
    answer: "2*sqrt(2)",
    answerLatex: "2\\sqrt2",
    domain: [-1, 1],
    difficulty: 3,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "Both \\sin(\\cot^{-1}x) and \\cos(\\tan^{-1}x) equal \\frac1{\\sqrt{1+x^2}} — draw the right triangle for each.",
      "So the whole numerator collapses to \\frac2{\\sqrt{1+x^2}}, leaving a standard \\int\\frac{dx}{(1+x^2)^{3/2}}.",
    ],
    steps: [
      "\\sin(\\cot^{-1}x)=\\cos(\\tan^{-1}x)=\\frac1{\\sqrt{1+x^2}} for every real x, so the integrand is \\frac{2}{(1+x^2)^{3/2}}.",
      "\\int\\frac{dx}{(1+x^2)^{3/2}}=\\frac x{\\sqrt{1+x^2}}+C (standard trig-sub result).",
      "\\left[\\frac{2x}{\\sqrt{1+x^2}}\\right]_{-1}^1=\\frac2{\\sqrt2}-\\left(\\frac{-2}{\\sqrt2}\\right)=2\\sqrt2.",
    ],
  },
  {
    id: "ukuib21shuttle-c2",
    kind: "definite",
    integrand: "x^3e^{-x}",
    integrandExpr: "x^3*exp(-x)",
    lower: "0",
    upper: "6",
    answer: "6-366*exp(-6)",
    answerLatex: "6-366e^{-6}",
    domain: [0, 6],
    difficulty: 2,
    techniques: ["gamma-function"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link passes a=6 (2\\sqrt2 squared, minus 2). This is an incomplete Gamma integral — integrate by parts three times, or use \\int_0^ax^3e^{-x}dx=3!-e^{-a}(a^3+3a^2+6a+6).",
    ],
    steps: [
      "\\int_0^ax^3e^{-x}\\,dx=\\left[-e^{-x}(x^3+3x^2+6x+6)\\right]_0^a=6-e^{-a}(a^3+3a^2+6a+6).",
      "At a=6: a^3+3a^2+6a+6=216+108+36+6=366.",
      "So the value is 6-366e^{-6}\\approx5.0928, which the next link uses as \"2 minus your answer.\"",
    ],
  },
  {
    id: "ukuib21shuttle-c3",
    kind: "definite",
    integrand: "\\frac{\\ln\\!\\left(x^{1/b}\\right)}{x^{1/b}(x+1)^2},\\quad b=366e^{-6}-4",
    integrandExpr: "log(x)/((366*exp(-6)-4)*x^(1/(366*exp(-6)-4))*(x+1)^2)",
    lower: "0",
    upper: "\\infty",
    answer: "-(1/(366*exp(-6)-4))*pi/sin(pi*(1/(366*exp(-6)-4)))+pi^2*(1/(366*exp(-6)-4))^2*cos(pi*(1/(366*exp(-6)-4)))/sin(pi*(1/(366*exp(-6)-4)))^2",
    answerLatex: "-\\frac\\pi{b\\sin(\\pi/b)}+\\frac{\\pi^2\\cos(\\pi/b)}{b^2\\sin^2(\\pi/b)}\\quad\\left(b=366e^{-6}-4\\approx-3.0928,\\text{ value}\\approx-0.4425\\right)",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["beta-integrals"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link passes an ugly, exact real number b=366e^{-6}-4\\approx-3.0928 as the exponent's reciprocal — keep it symbolic rather than rounding, since it's exact.",
      "Write \\ln\\!\\left(x^{1/b}\\right)=\\frac1b\\ln x, and differentiate the Beta-function integral M(s)=\\int_0^\\infty\\frac{x^{s-1}}{(1+x)^2}dx=(1-s)\\pi/\\sin(\\pi s) with respect to s.",
    ],
    steps: [
      "The integrand is \\frac1b\\cdot x^{-1/b}\\ln x/(1+x)^2 — set k=1/b, so this is k\\cdot\\frac{d}{ds}\\left[\\int_0^\\infty\\frac{x^{s-1}}{(1+x)^2}dx\\right]_{s=1-k}, since \\frac{d}{ds}x^{s-1}=x^{s-1}\\ln x.",
      "M(s)=\\frac{(1-s)\\pi}{\\sin(\\pi s)} (from \\Gamma(s)\\Gamma(2-s) and the reflection formula), so M'(s)=-\\frac\\pi{\\sin(\\pi s)}-\\frac{\\pi^2(1-s)\\cos(\\pi s)}{\\sin^2(\\pi s)}.",
      "At s=1-k this becomes -\\frac\\pi{\\sin(\\pi k)}+\\frac{\\pi^2k\\cos(\\pi k)}{\\sin^2(\\pi k)}; multiplying by k=1/b and substituting b=366e^{-6}-4 gives the stated (exact but ugly) closed form.",
    ],
  },
  {
    id: "ukuib21shuttle-d2",
    kind: "definite",
    integrand: "\\frac{x^3-x^2}{\\ln x}",
    integrandExpr: "(x^3-x^2)/log(x)",
    lower: "0",
    upper: "1",
    answer: "log(4/3)",
    answerLatex: "\\ln\\frac43",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The chain's opening link is itself a limit (\\lim_{n\\to\\infty}\\int_{5/6}^\\infty e^{-x^n}dx=\\frac16, since e^{-x^n}\\to\\mathbf1_{(0,1)}(x) pointwise), passing on the prime factors of q=6 with a>b: a=3,\\,b=2.",
      "\\int_0^1\\frac{x^p-x^q}{\\ln x}\\,dx=\\ln\\frac{p+1}{q+1} is a standard Feynman's-trick (differentiate under the integral) result.",
    ],
    steps: [
      "Let I(t)=\\int_0^1\\frac{x^t-x^2}{\\ln x}\\,dx, so I'(t)=\\int_0^1x^t\\,dx=\\frac1{t+1} and I(2)=0.",
      "I(3)=\\int_2^3\\frac{dt}{t+1}=\\ln4-\\ln3=\\ln\\frac43.",
      "So \\int_0^1\\frac{x^3-x^2}{\\ln x}\\,dx=\\ln\\frac43\\approx0.2877, and \"the least integer bigger than\" this is 1, passed on as the next link's parameter.",
    ],
  },
  {
    id: "ukuib21shuttle-d3",
    kind: "definite",
    integrand: "\\frac{1-x}{2x+1}",
    integrandExpr: "(1-x)/(2*x+1)",
    lower: "0",
    upper: "1",
    answer: "(1/4)*(log(27)-2)",
    answerLatex: "\\frac14\\left(\\ln27-2\\right)",
    domain: [0, 1],
    difficulty: 2,
    techniques: ["partial-fractions"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The previous link passes c=1, turning x^c+(x^c+1)^c into x+(x+1)=2x+1.",
      "Polynomial-divide: \\frac{1-x}{2x+1}=-\\frac12+\\frac{3/2}{2x+1}.",
    ],
    steps: [
      "\\frac{1-x}{2x+1}=-\\frac12+\\frac{3/2}{2x+1} (matching coefficients).",
      "\\int_0^1\\left[-\\frac12+\\frac{3/2}{2x+1}\\right]dx=\\left[-\\frac x2+\\frac34\\ln(2x+1)\\right]_0^1=-\\frac12+\\frac34\\ln3.",
      "Rewriting \\frac34\\ln3-\\frac12=\\frac14(3\\ln3-2)=\\frac14(\\ln27-2) matches the stated \\frac rs(\\ln t-u) form with (r,s,t,u)=(1,4,27,2); \"r+\\sqrt r+s/u\" then gives 1+1+2=4 for the final link.",
    ],
  },
  {
    id: "ukuib21shuttle-d4",
    kind: "definite",
    integrand: "\\frac{x}{4-\\cos^2x}",
    integrandExpr: "x/(4-cos(x)^2)",
    lower: "0",
    upper: "2\\pi",
    answer: "pi^2*sqrt(3)/3",
    answerLatex: "\\frac{\\pi^2}{\\sqrt3}",
    domain: [0, 6.283185307179586],
    difficulty: 4,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Shuttle" },
    hints: [
      "The final link passes d=4. Since the denominator depends only on \\cos x, use x\\to2\\pi-x to replace the x in the numerator by its average value \\pi.",
      "That reduces the problem to \\pi\\int_0^{2\\pi}\\frac{dx}{4-\\cos^2x}, a standard \\cos(2x) rewrite plus the classic \\int_0^{2\\pi}\\frac{dy}{a-\\cos y}=\\frac{2\\pi}{\\sqrt{a^2-1}} formula.",
    ],
    steps: [
      "For any g depending only on \\cos x, \\int_0^{2\\pi}x\\,g(\\cos x)\\,dx=\\pi\\int_0^{2\\pi}g(\\cos x)\\,dx (average the integrand with its x\\to2\\pi-x reflection).",
      "4-\\cos^2x=\\frac{7-\\cos2x}2, so \\int_0^{2\\pi}\\frac{dx}{4-\\cos^2x}=2\\int_0^{2\\pi}\\frac{dx}{7-\\cos2x}=\\int_0^{4\\pi}\\frac{dy}{7-\\cos y}=2\\int_0^{2\\pi}\\frac{dy}{7-\\cos y}.",
      "\\int_0^{2\\pi}\\frac{dy}{7-\\cos y}=\\frac{2\\pi}{\\sqrt{48}}=\\frac\\pi{2\\sqrt3}, so \\int_0^{2\\pi}\\frac{dx}{4-\\cos^2x}=\\frac\\pi{\\sqrt3}, and the answer is \\pi\\cdot\\frac\\pi{\\sqrt3}=\\frac{\\pi^2}{\\sqrt3}.",
    ],
  },

  // ===============================================================================================
  // 2022/23 Relay
  // ===============================================================================================
  {
    id: "ukuib22relay-q2",
    kind: "definite",
    integrand: "\\frac1{\\left(x+\\frac1x\\right)^2}",
    integrandExpr: "x^2/(x^2+1)^2",
    lower: "-\\infty",
    upper: "\\infty",
    answer: "pi/2",
    answerLatex: "\\frac\\pi2",
    domain: [-Infinity, Infinity],
    difficulty: 3,
    techniques: ["partial-fractions"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: [
      "\\frac1{(x+1/x)^2}=\\frac{x^2}{(x^2+1)^2} for every x\\ne0 (multiply through by x^2).",
      "Write \\frac{x^2}{(x^2+1)^2}=\\frac1{x^2+1}-\\frac1{(x^2+1)^2} and use \\int_{-\\infty}^\\infty\\frac{dx}{(x^2+1)^2}=\\frac\\pi2.",
    ],
    steps: [
      "\\frac{x^2}{(x^2+1)^2}=\\frac{(x^2+1)-1}{(x^2+1)^2}=\\frac1{x^2+1}-\\frac1{(x^2+1)^2}.",
      "\\int_{-\\infty}^\\infty\\frac{dx}{x^2+1}=\\pi and \\int_{-\\infty}^\\infty\\frac{dx}{(x^2+1)^2}=\\frac\\pi2 (standard reduction formula).",
      "\\pi-\\frac\\pi2=\\frac\\pi2.",
    ],
  },
  {
    id: "ukuib22relay-q3",
    kind: "definite",
    integrand: "x\\ln(\\sin x)",
    integrandExpr: "x*log(sin(x))",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "(7/16)*1.2020569031595942854 - (pi^2/8)*log(2)",
    answerLatex: "\\frac7{16}\\zeta(3)-\\frac{\\pi^2}8\\ln2",
    domain: [0, 1.5707963267948966],
    difficulty: 5,
    techniques: ["zeta-series"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: [
      "Expand \\ln(\\sin x)=-\\ln2-\\sum_{k\\ge1}\\frac{\\cos(2kx)}k on (0,\\pi) and integrate x\\cos(2kx) term by term against x on [0,\\pi/2].",
      "The odd-k terms sum to a multiple of \\zeta(3) via \\sum\\frac{(-1)^{k-1}}{k^3}=\\frac34\\zeta(3); the even-k terms telescope into the \\pi^2\\ln2 piece.",
    ],
    steps: [
      "\\int_0^{\\pi/2}x\\ln(\\sin x)\\,dx=-\\ln2\\int_0^{\\pi/2}x\\,dx-\\sum_{k\\ge1}\\frac1k\\int_0^{\\pi/2}x\\cos(2kx)\\,dx.",
      "\\int_0^{\\pi/2}x\\,dx=\\frac{\\pi^2}8, and \\int_0^{\\pi/2}x\\cos(2kx)\\,dx works out (by parts) to \\frac{(-1)^k-1}{4k^2} for k odd contributing the nonzero part.",
      "Summing the resulting series gives the classical value \\frac7{16}\\zeta(3)-\\frac{\\pi^2}8\\ln2\\approx-0.32924.",
    ],
  },
  {
    id: "ukuib22relay-q5",
    kind: "definite",
    integrand: "\\frac{x^{2023}-x^{23}}{\\ln x}",
    integrandExpr: "(x^2023-x^23)/log(x)",
    lower: "0",
    upper: "1",
    answer: "log(2024/24)",
    answerLatex: "\\ln\\frac{2024}{24}",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: ["This is the standard Feynman-parameter shape \\int_0^1\\frac{x^p-x^q}{\\ln x}\\,dx=\\ln\\frac{p+1}{q+1}."],
    steps: [
      "Let I(t)=\\int_0^1\\frac{x^t-x^{23}}{\\ln x}\\,dx, so I'(t)=\\int_0^1x^t\\,dx=\\frac1{t+1} and I(23)=0.",
      "I(2023)=\\int_{23}^{2023}\\frac{dt}{t+1}=\\ln2024-\\ln24=\\ln\\frac{2024}{24}.",
    ],
  },
  {
    id: "ukuib22relay-q6",
    kind: "definite",
    integrand: "\\frac{\\ln x}{x^2+3}",
    integrandExpr: "log(x)/(x^2+3)",
    lower: "1",
    upper: "3",
    answer: "pi*log(3)/(12*sqrt(3))",
    answerLatex: "\\frac\\pi{12\\sqrt3}\\ln3",
    domain: [1, 3],
    difficulty: 4,
    techniques: ["reciprocal-substitution"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: [
      "The bounds 1 and 3 are reciprocals of each other up to the factor 3 in the denominator: try x=3/t, which maps [1,3] to itself.",
      "That substitution turns \\ln x into \\ln3-\\ln t, handing you the same integral I back plus a plain \\int dt/(t^2+3).",
    ],
    steps: [
      "Let I=\\int_1^3\\frac{\\ln x}{x^2+3}\\,dx and substitute x=3/t (dx=-3/t^2\\,dt, bounds flip and the sign cancels): I=\\int_1^3\\frac{\\ln3-\\ln t}{t^2+3}\\,dt=\\ln3\\int_1^3\\frac{dt}{t^2+3}-I.",
      "So 2I=\\ln3\\int_1^3\\frac{dt}{t^2+3}. \\int_1^3\\frac{dt}{t^2+3}=\\frac1{\\sqrt3}\\left[\\tan^{-1}\\frac t{\\sqrt3}\\right]_1^3=\\frac1{\\sqrt3}\\left(\\frac\\pi3-\\frac\\pi6\\right)=\\frac\\pi{6\\sqrt3}.",
      "I=\\frac{\\ln3}2\\cdot\\frac\\pi{6\\sqrt3}=\\frac\\pi{12\\sqrt3}\\ln3.",
    ],
  },
  {
    id: "ukuib22relay-q8",
    kind: "definite",
    integrand: "\\frac{\\cos x}{1+e^{-1/x}}",
    integrandExpr: "cos(x)/(1+exp(-1/x))",
    lower: "-1",
    upper: "1",
    answer: "sin(1)",
    answerLatex: "\\sin1",
    domain: [-1, 1],
    difficulty: 4,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: [
      "Add f(x) to f(-x): \\cos x is even, and \\frac1{1+e^{-1/x}}+\\frac1{1+e^{1/x}}=1 identically.",
      "So f(x)+f(-x)=\\cos x for every x\\ne0.",
    ],
    steps: [
      "f(x)=\\frac{\\cos x}{1+e^{-1/x}}, f(-x)=\\frac{\\cos x}{1+e^{1/x}} (using \\cos(-x)=\\cos x).",
      "\\frac1{1+e^{-u}}+\\frac1{1+e^u}=1 for any u, so f(x)+f(-x)=\\cos x.",
      "\\int_{-1}^1f(x)\\,dx=\\frac12\\int_{-1}^1[f(x)+f(-x)]\\,dx=\\frac12\\int_{-1}^1\\cos x\\,dx=\\frac12\\cdot2\\sin1=\\sin1.",
    ],
  },
  {
    id: "ukuib22relay-q19",
    kind: "definite",
    integrand: "x^3e^{-x^2}",
    integrandExpr: "x^3*exp(-x^2)",
    lower: "-\\infty",
    upper: "\\infty",
    answer: "0",
    answerLatex: "0",
    domain: [-Infinity, Infinity],
    difficulty: 2,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Relay" },
    hints: ["x^3e^{-x^2} is an odd function (an odd power of x times an even one)."],
    steps: [
      "f(-x)=(-x)^3e^{-(-x)^2}=-x^3e^{-x^2}=-f(x), so f is odd.",
      "The integral of an odd function over a symmetric interval, here the whole real line, is 0.",
    ],
  },

  // ===============================================================================================
  // 2023/24 Relay
  // ===============================================================================================
  {
    id: "ukuib23relay-p3",
    kind: "definite",
    integrand: "\\ln(\\Gamma(2-x))",
    integrandExpr: "log(gamma(2-x))",
    lower: "0",
    upper: "2",
    answer: "log(2*pi)-1",
    answerLatex: "\\ln(2\\pi)-1",
    domain: [0, 2],
    difficulty: 4,
    techniques: ["gamma-function"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Relay" },
    hints: [
      "Split at x=1 and shift each half back to [0,1]; you'll need Raabe's integral \\int_0^1\\ln\\Gamma(t)\\,dt=\\frac12\\ln(2\\pi).",
      "On the second half use \\Gamma(1+t)=t\\Gamma(t).",
    ],
    steps: [
      "Substituting u=2-x turns \\int_0^2\\ln\\Gamma(2-x)\\,dx into \\int_0^2\\ln\\Gamma(u)\\,du, so it suffices to evaluate that.",
      "Split: \\int_0^2\\ln\\Gamma(u)\\,du=\\int_0^1\\ln\\Gamma(u)\\,du+\\int_0^1\\ln\\Gamma(1+t)\\,dt (shifting u=1+t on the second piece).",
      "\\int_0^1\\ln\\Gamma(1+t)\\,dt=\\int_0^1[\\ln t+\\ln\\Gamma(t)]\\,dt=-1+\\frac12\\ln(2\\pi) (using Raabe's integral again and \\int_0^1\\ln t\\,dt=-1).",
      "Total: \\frac12\\ln(2\\pi)+\\left(-1+\\frac12\\ln(2\\pi)\\right)=\\ln(2\\pi)-1.",
    ],
  },
  // ukuib23relay-p6 (\sin^2(5x)\sin^2(4x)/\sin^2x on [0,2\pi] = 4\pi) was an exact duplicate of
  // the pre-existing ukuib22cn-p1 in crossnumber.ts (2022 Crossnumber) -- left that earlier entry
  // untouched rather than duplicate it.
  {
    id: "ukuib23relay-p12",
    kind: "definite",
    integrand: "\\frac{\\ln(2x)\\ln(4x)\\ln(8x)}x",
    integrandExpr: "log(2*x)*log(4*x)*log(8*x)/x",
    lower: "\\frac18",
    upper: "\\frac14",
    answer: "log(2)^4/4",
    answerLatex: "\\frac{\\ln^42}4",
    domain: [0.125, 0.25],
    difficulty: 3,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Relay" },
    hints: [
      "Let t=\\ln x; then \\ln(2x)=t+\\ln2, \\ln(4x)=t+2\\ln2, \\ln(8x)=t+3\\ln2, and \\frac{dx}x=dt.",
      "Shift s=t+2\\ln2 to center the product: it becomes (s-\\ln2)(s)(s+\\ln2)=s^3-s\\ln^22.",
    ],
    steps: [
      "t=\\ln x turns the integral into \\int_{-3\\ln2}^{-2\\ln2}(t+\\ln2)(t+2\\ln2)(t+3\\ln2)\\,dt.",
      "Shifting s=t+2\\ln2 (bounds become -\\ln2 to 0) gives \\int_{-\\ln2}^0(s^3-s\\ln^22)\\,ds=\\left[\\frac{s^4}4-\\frac{s^2\\ln^22}2\\right]_{-\\ln2}^0.",
      "=0-\\left(\\frac{\\ln^42}4-\\frac{\\ln^42}2\\right)=\\frac{\\ln^42}4.",
    ],
  },
  {
    id: "ukuib23relay-p14",
    kind: "definite",
    integrand: "e^{x+e^x}",
    integrandExpr: "exp(x+exp(x))",
    lower: "0",
    upper: "1",
    answer: "exp(exp(1))-exp(1)",
    answerLatex: "e^e-e",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Relay" },
    hints: ["e^{x+e^x}=e^x\\cdot e^{e^x} — let u=e^x."],
    steps: [
      "Let u=e^x, du=e^x\\,dx: \\int e^xe^{e^x}\\,dx=\\int e^u\\,du=e^u+C=e^{e^x}+C.",
      "Evaluating from 0 to 1: e^{e^1}-e^{e^0}=e^e-e.",
    ],
  },
  {
    id: "ukuib23relay-p18",
    kind: "definite",
    integrand: "\\frac1{1+\\tan^{2024}x}",
    integrandExpr: "1/(1+tan(x)^2024)",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "pi/4",
    answerLatex: "\\frac\\pi4",
    domain: [0, 1.5707963267948966],
    difficulty: 3,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Relay" },
    hints: ["Same King's-rule identity as A3 in the 2021 Shuttle: \\int_0^{\\pi/2}\\frac{dx}{1+\\tan^bx}=\\frac\\pi4 for any real b."],
    steps: [
      "Under x\\to\\frac\\pi2-x, \\tan^{2024}x\\to\\cot^{2024}x=\\tan^{-2024}x, giving a second copy of the integral equal to \\int_0^{\\pi/2}\\frac{\\tan^{2024}x}{1+\\tan^{2024}x}\\,dx.",
      "Adding the two forms: 2I=\\int_0^{\\pi/2}1\\,dx=\\frac\\pi2, so I=\\frac\\pi4.",
    ],
  },
  {
    id: "ukuib23relay-p20",
    kind: "definite",
    integrand: "f(x),\\quad (f(x))^2=\\int_0^x\\frac{tf(t)}{1+t^2}\\,dt",
    integrandExpr: "log(1+x^2)/4",
    lower: "-1",
    upper: "1",
    answer: "log(2)/2 - 1 + pi/4",
    answerLatex: "\\frac{\\ln2}2-1+\\frac\\pi4",
    domain: [-1, 1],
    difficulty: 4,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Relay" },
    hints: [
      "Differentiate both sides of (f(x))^2=\\int_0^x\\frac{tf(t)}{1+t^2}\\,dt to get a first-order ODE for f, using f(0)=0.",
      "That ODE separates immediately once you cancel a factor of f(x).",
    ],
    steps: [
      "Differentiating: 2f(x)f'(x)=\\frac{xf(x)}{1+x^2}, so f'(x)=\\frac x{2(1+x^2)} (dividing by f(x), away from its zero).",
      "f(x)=\\frac14\\ln(1+x^2)+C, and f(0)=0 (from the original equation at x=0) forces C=0 — this is confirmed by substituting back: both sides equal \\frac1{16}\\ln^2(1+x^2).",
      "\\int_{-1}^1f(x)\\,dx=\\frac12\\int_0^1\\ln(1+x^2)\\,dx (f is even) =\\frac12\\left[x\\ln(1+x^2)-2x+2\\tan^{-1}x\\right]_0^1=\\frac12\\left(\\ln2-2+\\frac\\pi2\\right)=\\frac{\\ln2}2-1+\\frac\\pi4.",
    ],
  },

  // ===============================================================================================
  // 2024/25 Relay
  // ===============================================================================================
  {
    id: "ukuib24relay-p1",
    kind: "definite",
    integrand: "\\frac{x^2\\cos x}{1+e^x}",
    integrandExpr: "x^2*cos(x)/(1+exp(x))",
    lower: "-\\frac\\pi2",
    upper: "\\frac\\pi2",
    answer: "pi^2/4-2",
    answerLatex: "\\frac{\\pi^2}4-2",
    domain: [-1.5707963267948966, 1.5707963267948966],
    difficulty: 4,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Relay" },
    hints: [
      "x^2\\cos x is even; for any even g, \\int_{-a}^a\\frac{g(x)}{1+e^x}\\,dx=\\frac12\\int_{-a}^ag(x)\\,dx=\\int_0^ag(x)\\,dx.",
      "Then it's a plain \\int_0^{\\pi/2}x^2\\cos x\\,dx, by parts twice.",
    ],
    steps: [
      "f(x)+f(-x)=x^2\\cos x\\left[\\frac1{1+e^x}+\\frac1{1+e^{-x}}\\right]=x^2\\cos x, so \\int_{-\\pi/2}^{\\pi/2}f=\\int_0^{\\pi/2}x^2\\cos x\\,dx.",
      "\\int x^2\\cos x\\,dx=x^2\\sin x+2x\\cos x-2\\sin x+C.",
      "\\left[x^2\\sin x+2x\\cos x-2\\sin x\\right]_0^{\\pi/2}=\\left(\\frac{\\pi^2}4+0-2\\right)-0=\\frac{\\pi^2}4-2.",
    ],
  },
  {
    id: "ukuib24relay-p5",
    kind: "definite",
    integrand: "\\frac1{1+\\left(x+\\frac1x\\right)^2}",
    integrandExpr: "1/(1+(x+1/x)^2)",
    lower: "-\\infty",
    upper: "\\infty",
    answer: "pi/sqrt(5)",
    answerLatex: "\\frac\\pi{\\sqrt5}",
    domain: [-Infinity, Infinity],
    difficulty: 5,
    techniques: ["reciprocal-substitution"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Relay" },
    hints: [
      "Write 1=\\frac12\\left[\\left(1+\\frac1{x^2}\\right)+\\left(1-\\frac1{x^2}\\right)\\right] and split the integral into two pieces.",
      "One piece is \\frac12\\,d\\!\\left[\\tan^{-1}\\!\\left(x+\\frac1x\\right)\\right]; the other becomes a plain arctan after v=x-\\frac1x, using \\left(x+\\frac1x\\right)^2=\\left(x-\\frac1x\\right)^2+4.",
    ],
    steps: [
      "\\frac{dx}{1+(x+1/x)^2}=\\frac12\\cdot\\frac{(1-1/x^2)\\,dx}{1+(x+1/x)^2}+\\frac12\\cdot\\frac{(1+1/x^2)\\,dx}{1+(x+1/x)^2}.",
      "The first half integrates to \\frac12\\tan^{-1}\\!\\left(x+\\frac1x\\right); in the second, v=x-\\frac1x gives \\frac12\\int\\frac{dv}{v^2+5}=\\frac1{2\\sqrt5}\\tan^{-1}\\frac v{\\sqrt5}.",
      "On (0,\\infty), evaluating both antiderivatives from x=0^+ to x=\\infty and doubling for evenness gives \\pi\\left(\\frac1{2\\sqrt5}\\right)\\cdot2=\\frac\\pi{\\sqrt5} after the boundary terms combine.",
    ],
  },
  {
    id: "ukuib24relay-p11",
    kind: "definite",
    integrand: "\\tan^{-1}\\!\\left(\\dfrac{\\tan^{-1}\\!\\left(\\frac x{1-x}\\right)}{\\tan^{-1}\\!\\left(\\frac{1-x}x\\right)}\\right)",
    integrandExpr: "atan(atan(x/(1-x))/atan((1-x)/x))",
    lower: "0",
    upper: "1",
    answer: "pi/4",
    answerLatex: "\\frac\\pi4",
    domain: [0, 1],
    difficulty: 5,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Relay" },
    hints: [
      "\\frac x{1-x} and \\frac{1-x}x are reciprocals, so \\tan^{-1}\\!\\left(\\frac x{1-x}\\right)+\\tan^{-1}\\!\\left(\\frac{1-x}x\\right)=\\frac\\pi2.",
      "x\\to1-x swaps the numerator angle a and denominator angle b, turning f(x) into \\tan^{-1}(b/a); since a/b and b/a are reciprocals, f(x)+f(1-x) is again constant.",
    ],
    steps: [
      "Let a=\\tan^{-1}\\!\\left(\\frac x{1-x}\\right),\\,b=\\tan^{-1}\\!\\left(\\frac{1-x}x\\right); then a+b=\\frac\\pi2, so f(x)=\\tan^{-1}(a/b).",
      "Under x\\to1-x, a and b swap, so f(1-x)=\\tan^{-1}(b/a); since a/b>0, \\tan^{-1}(a/b)+\\tan^{-1}(b/a)=\\frac\\pi2, i.e. f(x)+f(1-x)=\\frac\\pi2.",
      "By King's rule, \\int_0^1f(x)\\,dx=\\frac12\\int_0^1[f(x)+f(1-x)]\\,dx=\\frac12\\cdot\\frac\\pi2=\\frac\\pi4.",
    ],
  },
  {
    id: "ukuib24relay-p15",
    kind: "definite",
    integrand: "\\frac{\\sin^2\\!\\left(\\frac{\\pi x}2\\right)}{\\sqrt{x-x^2}}",
    integrandExpr: "sin(pi*x/2)^2/sqrt(x-x^2)",
    lower: "0",
    upper: "1",
    answer: "pi/2",
    answerLatex: "\\frac\\pi2",
    domain: [0, 1],
    difficulty: 4,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Relay" },
    hints: [
      "\\sin^2\\!\\left(\\frac{\\pi x}2\\right)=\\frac{1-\\cos(\\pi x)}2, splitting the problem into \\int_0^1\\frac{dx}{\\sqrt{x-x^2}} minus a cosine piece.",
      "x=\\frac{1+\\cos\\varphi}2 turns the first integral into \\pi and the second into an integral of \\sin\\!\\left(\\frac\\pi2\\cos\\varphi\\right), which is antisymmetric about \\varphi=\\pi/2 and so vanishes.",
    ],
    steps: [
      "\\int_0^1\\dfrac{dx}{\\sqrt{x-x^2}}=\\pi (the classical Beta-function/arcsin result).",
      "With x=\\frac{1+\\cos\\varphi}2, \\cos(\\pi x)=\\cos\\!\\left(\\frac\\pi2+\\frac\\pi2\\cos\\varphi\\right)=-\\sin\\!\\left(\\frac\\pi2\\cos\\varphi\\right), and \\frac{dx}{\\sqrt{x-x^2}}=-d\\varphi.",
      "\\int_0^1\\dfrac{\\cos(\\pi x)}{\\sqrt{x-x^2}}\\,dx=-\\int_0^\\pi\\sin\\!\\left(\\tfrac\\pi2\\cos\\varphi\\right)d\\varphi=0 (the integrand is odd about \\varphi=\\pi/2), so the answer is \\frac12(\\pi-0)=\\frac\\pi2.",
    ],
  },

  // ===============================================================================================
  // 2025/26 Relay
  // ===============================================================================================
  {
    id: "ukuib25relay-p1",
    kind: "definite",
    integrand: "x^{44}\\ln x",
    integrandExpr: "x^44*log(x)",
    lower: "0",
    upper: "1",
    answer: "-1/2025",
    answerLatex: "-\\frac1{2025}",
    domain: [0, 1],
    difficulty: 1,
    techniques: ["log-power-integrals"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: ["\\int_0^1x^n\\ln x\\,dx=-\\frac1{(n+1)^2}."],
    steps: ["By parts (or the standard formula), \\int_0^1x^{44}\\ln x\\,dx=-\\frac1{45^2}=-\\frac1{2025}."],
  },
  {
    id: "ukuib25relay-p2",
    kind: "definite",
    integrand: "(1-x\\tan x)\\tan x",
    integrandExpr: "(1-x*tan(x))*tan(x)",
    lower: "0",
    upper: "\\frac\\pi4",
    answer: "log(2)-pi/4+pi^2/32",
    answerLatex: "\\ln2-\\frac\\pi4+\\frac{\\pi^2}{32}",
    domain: [0, 0.7853981633974483],
    difficulty: 3,
    techniques: ["parts"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "Expand into \\tan x-x\\tan^2x, then use \\tan^2x=\\sec^2x-1 on the second piece.",
      "\\int x\\sec^2x\\,dx is a plain by-parts (u=x,\\,dv=\\sec^2x\\,dx).",
    ],
    steps: [
      "(1-x\\tan x)\\tan x=\\tan x-x\\tan^2x=\\tan x-x\\sec^2x+x.",
      "\\int_0^{\\pi/4}\\tan x\\,dx=\\frac12\\ln2; \\int_0^{\\pi/4}x\\sec^2x\\,dx=\\left[x\\tan x\\right]_0^{\\pi/4}-\\int_0^{\\pi/4}\\tan x\\,dx=\\frac\\pi4-\\frac12\\ln2; \\int_0^{\\pi/4}x\\,dx=\\frac{\\pi^2}{32}.",
      "Total: \\frac12\\ln2-\\left(\\frac\\pi4-\\frac12\\ln2\\right)+\\frac{\\pi^2}{32}=\\ln2-\\frac\\pi4+\\frac{\\pi^2}{32}.",
    ],
  },
  {
    id: "ukuib25relay-p5",
    kind: "definite",
    integrand: "\\frac1{\\lfloor x+\\lfloor x\\rfloor\\rfloor^2}",
    integrandExpr: "1/floor(x+floor(x))^2",
    lower: "1",
    upper: "\\infty",
    answer: "pi^2/24",
    answerLatex: "\\frac{\\pi^2}{24}",
    domain: [1, Infinity],
    difficulty: 3,
    techniques: ["floor-function"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "For x\\in[n,n+1), \\lfloor x\\rfloor=n, so x+\\lfloor x\\rfloor\\in[2n,2n+1), meaning \\lfloor x+\\lfloor x\\rfloor\\rfloor=2n exactly — a constant on the whole interval.",
      "So the integral is \\sum_{n\\ge1}\\frac1{4n^2}.",
    ],
    steps: [
      "On [n,n+1), \\lfloor x+\\lfloor x\\rfloor\\rfloor=2n (constant), so \\int_n^{n+1}\\frac{dx}{\\lfloor x+\\lfloor x\\rfloor\\rfloor^2}=\\frac1{4n^2}.",
      "Summing over n=1,2,3,\\dots: \\sum_{n=1}^\\infty\\frac1{4n^2}=\\frac14\\cdot\\frac{\\pi^2}6=\\frac{\\pi^2}{24}.",
    ],
  },
  {
    id: "ukuib25relay-p6",
    kind: "indefinite",
    integrand: "\\frac{f^{-1}(x)}{1+f(x)},\\quad f(x)=x^\\varphi,\\ \\varphi=\\frac{1+\\sqrt5}2",
    integrandExpr: "x^(1/((1+sqrt(5))/2))/(1+x^((1+sqrt(5))/2))",
    answer: "(1/((1+sqrt(5))/2))*log(1+x^((1+sqrt(5))/2))",
    answerLatex: "\\frac1\\varphi\\ln\\!\\left(1+x^\\varphi\\right) + C",
    domain: [0.5, 3],
    difficulty: 2,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "f^{-1}(x)=x^{1/\\varphi}, and \\frac1\\varphi=\\varphi-1 (from \\varphi^2=\\varphi+1).",
      "Let u=x^\\varphi; then du=\\varphi x^{\\varphi-1}dx=\\varphi f^{-1}(x)\\,dx.",
    ],
    steps: [
      "f^{-1}(x)=x^{1/\\varphi}, so the integrand is \\frac{x^{\\varphi-1}}{1+x^\\varphi}.",
      "u=x^\\varphi, du=\\varphi x^{\\varphi-1}dx: \\int\\frac{x^{\\varphi-1}}{1+x^\\varphi}\\,dx=\\frac1\\varphi\\int\\frac{du}{1+u}=\\frac1\\varphi\\ln(1+u)+C.",
      "Back-substituting: \\frac1\\varphi\\ln\\!\\left(1+x^\\varphi\\right)+C.",
    ],
  },
  {
    id: "ukuib25relay-p8",
    kind: "definite",
    integrand: "\\sin^{\\tan x-2}x\\left[\\tan^2x\\ln(\\sin x)+\\sin^2x\\right]",
    integrandExpr: "sin(x)^(tan(x)-2)*(tan(x)^2*log(sin(x))+sin(x)^2)",
    lower: "\\frac\\pi4",
    upper: "\\frac\\pi2",
    answer: "1-sqrt(2)/2",
    answerLatex: "1-\\frac{\\sqrt2}2",
    domain: [0.7853981633974483, 1.5707963267948966],
    difficulty: 5,
    techniques: ["parts"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "Guess F(x)=\\sin(x)^{\\tan x} and differentiate it logarithmically: \\ln F=\\tan x\\ln(\\sin x).",
      "F'(x)=F(x)\\left[\\sec^2x\\ln(\\sin x)+1\\right]; multiplying out \\sin(x)^{\\tan x}\\cdot\\sec^2x=\\sin(x)^{\\tan x-2}\\tan^2x confirms F'(x) matches the integrand exactly.",
    ],
    steps: [
      "F(x)=\\sin(x)^{\\tan x} has \\ln F=\\tan x\\ln\\sin x, so F'/F=\\sec^2x\\ln\\sin x+\\tan x\\cdot\\cot x=\\sec^2x\\ln\\sin x+1.",
      "F'(x)=\\sin(x)^{\\tan x}\\left[\\sec^2x\\ln\\sin x+1\\right]=\\sin(x)^{\\tan x-2}\\left[\\tan^2x\\ln\\sin x+\\sin^2x\\right], exactly the given integrand.",
      "As x\\to\\frac\\pi2^-, \\sin(x)^{\\tan x}\\to1 (a 1^\\infty limit that resolves to 1); at x=\\frac\\pi4, F=\\left(\\frac{\\sqrt2}2\\right)^1. So the integral is F\\!\\left(\\frac\\pi2\\right)-F\\!\\left(\\frac\\pi4\\right)=1-\\frac{\\sqrt2}2.",
    ],
  },
  {
    id: "ukuib25relay-p9",
    kind: "definite",
    integrand: "\\frac{e^{W(x)}}{x^2}",
    integrandExpr: "exp(lambertw(x))/x^2",
    lower: "e",
    upper: "2e^2",
    answer: "1/2+log(2)",
    answerLatex: "\\frac12+\\ln2",
    domain: [2.718281828459045, 14.7781121978613],
    difficulty: 4,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "Since W(x)e^{W(x)}=x, we have e^{W(x)}=x/W(x), collapsing the integrand to \\frac1{xW(x)}.",
      "Substitute w=W(x), so x=we^w and dx=e^w(1+w)\\,dw; note W(e)=1 and W(2e^2)=2.",
    ],
    steps: [
      "\\frac{e^{W(x)}}{x^2}=\\frac{x/W(x)}{x^2}=\\frac1{xW(x)}.",
      "With w=W(x),\\,x=we^w,\\,dx=e^w(1+w)\\,dw: \\frac{dx}{xW(x)}=\\frac{e^w(1+w)\\,dw}{we^w\\cdot w}=\\left(\\frac1{w^2}+\\frac1w\\right)dw, integrating to -\\frac1w+\\ln w+C.",
      "At x=e, w=1 (since 1\\cdot e^1=e); at x=2e^2, w=2 (since 2e^2=2e^2). So the value is \\left(-\\frac12+\\ln2\\right)-(-1+0)=\\frac12+\\ln2.",
    ],
  },
  {
    id: "ukuib25relay-p10",
    kind: "definite",
    integrand: "\\frac{\\sin^{67}x}{2026-\\cos x}",
    integrandExpr: "sin(x)^67/(2026-cos(x))",
    lower: "0",
    upper: "2\\pi",
    answer: "0",
    answerLatex: "0",
    domain: [0, 6.283185307179586],
    difficulty: 3,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: ["Under x\\to2\\pi-x, \\cos x is unchanged but \\sin^{67}x (an ODD power) flips sign."],
    steps: [
      "f(2\\pi-x)=\\frac{\\sin^{67}(2\\pi-x)}{2026-\\cos(2\\pi-x)}=\\frac{(-\\sin x)^{67}}{2026-\\cos x}=-f(x), so f is antisymmetric about x=\\pi.",
      "The denominator never vanishes (2026-\\cos x\\ge2025), so the integral is well-defined, and pairing x with 2\\pi-x makes the whole thing cancel to 0.",
    ],
  },
  {
    id: "ukuib25relay-p12",
    kind: "definite",
    integrand: "\\frac{10-\\{x\\}}{\\lfloor x\\rfloor+\\lfloor10-x\\rfloor+10}",
    integrandExpr: "(10-(x-floor(x)))/(floor(x)+floor(10-x)+10)",
    lower: "3",
    upper: "7",
    answer: "2",
    answerLatex: "2",
    domain: [3, 7],
    difficulty: 3,
    techniques: ["floor-function"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "For x\\in(n,n+1) (n integer), \\lfloor x\\rfloor=n and \\lfloor10-x\\rfloor=9-n, so the denominator is the CONSTANT 19 on almost every point of that interval.",
      "With the denominator constant, each unit interval contributes the same amount — compute one and multiply by 4.",
    ],
    steps: [
      "For x\\in(n,n+1), \\lfloor x\\rfloor+\\lfloor10-x\\rfloor+10=n+(9-n)+10=19 (the single boundary point x=n where this fails has measure zero).",
      "With f=x-n\\in(0,1), the numerator is 10-f, so \\int_n^{n+1}\\frac{10-f}{19}\\,df=\\frac1{19}\\left[10f-\\frac{f^2}2\\right]_0^1=\\frac{9.5}{19}=\\frac12.",
      "Summing the four unit intervals from x=3 to x=7 gives 4\\times\\frac12=2.",
    ],
  },
  {
    id: "ukuib25relay-p21",
    kind: "definite",
    integrand: "e^{x-\\sinh^2x}",
    integrandExpr: "exp(x-sinh(x)^2)",
    lower: "-\\infty",
    upper: "\\infty",
    answer: "sqrt(pi)",
    answerLatex: "\\sqrt\\pi",
    domain: [-Infinity, Infinity],
    difficulty: 4,
    techniques: ["symmetry", "gaussian-hypersphere"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Relay" },
    hints: [
      "e^{-\\sinh^2x} is even; write e^x=\\cosh x+\\sinh x and note the \\sinh x piece is odd, hence contributes 0.",
      "That leaves \\int_{-\\infty}^\\infty\\cosh(x)e^{-\\sinh^2x}\\,dx — substitute u=\\sinh x.",
    ],
    steps: [
      "e^{x-\\sinh^2x}=(\\cosh x+\\sinh x)e^{-\\sinh^2x}; the \\sinh(x)e^{-\\sinh^2x} term is odd, so it integrates to 0 over the symmetric domain.",
      "\\int_{-\\infty}^\\infty\\cosh(x)e^{-\\sinh^2x}\\,dx: let u=\\sinh x,\\,du=\\cosh x\\,dx, and u ranges over all of \\mathbb R as x does.",
      "=\\int_{-\\infty}^\\infty e^{-u^2}\\,du=\\sqrt\\pi.",
    ],
  },
];
