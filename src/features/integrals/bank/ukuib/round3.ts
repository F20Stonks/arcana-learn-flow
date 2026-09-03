/**
 * The UK University Integration Bee, 2024/25, Round 3 — the only archive material with printed
 * worked solutions, so most of this file is faithful transcription + numeric confirmation rather
 * than from-scratch derivation. Covers four sittings from that round:
 *   - Chainlink (5 games of 8 problems each, `Chainlink_Game_1..5` + `Chainlink_Answers` +
 *     `Chainlink_Solutions`)
 *   - Dichotomy (3 segments of 7 paired (a)/(b) problems each, `Dichotomy_Segment_1..3` +
 *     `Dichotomy_answers` + `Dichotomy_Solutions`)
 *   - Tournament (4 battles x 3 fights x 3 problems, `Tournament_slides` + `Tournament_Solutions`)
 *   - Round 3 Tiebreaker (4 standalone problems, `Tiebreaker_1..4`, which duplicate the four
 *     per-battle tiebreakers embedded in `Tournament_Solutions`)
 * Every entry below was checked against `harness.local/verify.ts` before being written down; see
 * `harness.local/report-round3.md` for the full skip log (schema-mismatch limits, oscillation/
 * quadrature-resolution limits, overflow, and OCR-ambiguous problems that were not force-fit).
 */
import type { Problem } from "../../types";

export const UkuibRound3: Problem[] = [
  // ---------------------------------------------------------------------------------------------
  // Chainlink — Game 1
  // ---------------------------------------------------------------------------------------------
  {
    id: "ukuib24r3-chain1-p1",
    kind: "definite",
    integrand: "\\{x\\}^{\\lfloor x\\rfloor}",
    integrandExpr: "(x-floor(x))^floor(x)",
    lower: "1",
    upper: "4",
    answer: "13/12",
    answerLatex: "\\frac{13}{12}",
    domain: [1, 4],
    difficulty: 3,
    techniques: ["floor-function"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "On each unit interval (n,n+1), \\lfloor x\\rfloor=n is constant and \\{x\\}=x-n runs over (0,1) — substitute u=x-n on each piece.",
      "\\int_0^1 u^n\\,du = \\frac1{n+1}.",
    ],
    steps: [
      "\\int_1^4\\{x\\}^{\\lfloor x\\rfloor}\\,dx = \\sum_{n=1}^3\\int_n^{n+1}(x-n)^n\\,dx = \\sum_{n=1}^3\\int_0^1 u^n\\,du.",
      "= \\frac12+\\frac13+\\frac14 = \\frac{6+4+3}{12} = \\frac{13}{12}.",
    ],
  },
  {
    id: "ukuib24r3-chain1-p2",
    kind: "indefinite",
    integrand: "\\frac{\\sinh x+\\cosh x}{\\sinh(e^x)+\\cosh(e^x)}",
    integrandExpr: "(sinh(x)+cosh(x))/(sinh(exp(x))+cosh(exp(x)))",
    answer: "-exp(-exp(x))",
    answerLatex: "-e^{-e^x} + C",
    domain: [-1, 1],
    difficulty: 2,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "\\sinh t+\\cosh t = e^t for any t — this collapses both the numerator and the denominator.",
      "With that, the integrand is \\frac{e^x}{e^{e^x}} = e^x e^{-e^x}, a plain u=e^x substitution.",
    ],
    steps: [
      "\\sinh x+\\cosh x = e^x and \\sinh(e^x)+\\cosh(e^x) = e^{e^x}, so the integrand is e^x e^{-e^x}.",
      "Let u=e^x, du=e^x\\,dx: \\int e^{-u}\\,du = -e^{-u}+C = -e^{-e^x}+C.",
    ],
  },
  {
    id: "ukuib24r3-chain1-p3",
    kind: "indefinite",
    integrand: "\\frac{1+\\ln x}{\\sqrt{x^{-2x}-1}}",
    integrandExpr: "(1+log(x))/sqrt(x^(-2*x)-1)",
    answer: "asin(x^x)",
    answerLatex: "\\sin^{-1}(x^x) + C",
    domain: [0.3, 0.7],
    difficulty: 4,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "x^{-2x} = (x^x)^{-2} = 1/(x^x)^2 — write the whole denominator in terms of u=x^x.",
      "\\frac{d}{dx}x^x = x^x(1+\\ln x), exactly the numerator.",
    ],
    steps: [
      "Let u=x^x, so du = x^x(1+\\ln x)\\,dx and x^{-2x}-1 = 1/u^2-1 = (1-u^2)/u^2.",
      "The integrand becomes \\frac{du}{u\\sqrt{(1-u^2)/u^2}} = \\frac{du}{\\sqrt{1-u^2}}.",
      "\\int\\frac{du}{\\sqrt{1-u^2}} = \\sin^{-1}u+C = \\sin^{-1}(x^x)+C.",
    ],
  },
  {
    id: "ukuib24r3-chain1-p4",
    kind: "definite",
    integrand: "\\frac1{x\\sqrt x\\sqrt{x-1}}",
    integrandExpr: "1/(x*sqrt(x)*sqrt(x-1))",
    lower: "1",
    upper: "\\infty",
    answer: "2",
    answerLatex: "2",
    domain: [1, Infinity],
    difficulty: 3,
    techniques: ["trig-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "First let u=\\sqrt x to clear the outer square root: the integral becomes \\int_1^\\infty\\frac{2\\,du}{u^2\\sqrt{u^2-1}}.",
      "That shape is exactly what u=\\sec t is for.",
    ],
    steps: [
      "u=\\sqrt x turns the integral into \\int_1^\\infty\\frac{2\\,du}{u^2\\sqrt{u^2-1}}.",
      "u=\\sec t, du=\\sec t\\tan t\\,dt, \\sqrt{u^2-1}=\\tan t: the integrand becomes 2\\cos t\\,dt.",
      "\\int_0^{\\pi/2}2\\cos t\\,dt = 2.",
    ],
  },
  {
    id: "ukuib24r3-chain1-p5",
    kind: "definite",
    integrand: "\\frac{\\ln(1+x+x^2)}{x}",
    integrandExpr: "log(1+x+x^2)/x",
    lower: "0",
    upper: "1",
    answer: "pi^2/9",
    answerLatex: "\\frac{\\pi^2}9",
    domain: [0, 1],
    difficulty: 4,
    techniques: ["zeta-series"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "1+x+x^2 = \\frac{1-x^3}{1-x}, so \\ln(1+x+x^2) = \\ln(1-x^3)-\\ln(1-x).",
      "Expand each log as its power series -\\sum \\frac{x^{kn}}n and integrate term by term.",
    ],
    steps: [
      "\\int_0^1\\frac{\\ln(1-x^3)-\\ln(1-x)}{x}\\,dx = -\\sum_{n\\ge1}\\frac1n\\int_0^1\\left(x^{3n-1}-x^{n-1}\\right)dx.",
      "= -\\sum_{n\\ge1}\\frac1n\\left(\\frac1{3n}-\\frac1n\\right) = \\frac23\\sum_{n\\ge1}\\frac1{n^2} = \\frac23\\cdot\\frac{\\pi^2}6 = \\frac{\\pi^2}9.",
    ],
  },
  {
    id: "ukuib24r3-chain1-p7",
    kind: "definite",
    integrand: "\\frac{x}{\\sin(4x)}",
    integrandExpr: "x/sin(4*x)",
    lower: "\\tan^{-1}\\frac13",
    upper: "\\tan^{-1}\\frac12",
    answer: "(pi/16)*log(4/3)",
    answerLatex: "\\frac{\\pi}{16}\\ln\\frac43",
    domain: [0.32175055439664219, 0.46364760900080615],
    difficulty: 5,
    techniques: ["symmetry", "parts"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "\\tan^{-1}\\frac13+\\tan^{-1}\\frac12 = \\tan^{-1}(1) = \\frac\\pi4, so after y=4x the bounds are symmetric about \\pi/2.",
      "On that symmetric interval, King's rule (y\\to\\pi-y) turns \\frac{y}{\\sin y} into \\frac{\\pi-y}{\\sin y}, isolating a plain \\int\\csc y\\,dy.",
    ],
    steps: [
      "y=4x gives \\frac1{16}\\int_{4\\tan^{-1}(1/3)}^{4\\tan^{-1}(1/2)}\\frac{y}{\\sin y}\\,dy, with bounds symmetric about \\pi/2 since the two arctangents sum to \\pi/4.",
      "King's rule (y\\to\\pi-y) adds the integral to itself and cancels the y: 2\\times(\\text{integral}) = \\frac1{16}\\int\\pi\\csc y\\,dy over the same bounds.",
      "\\int\\csc y\\,dy = \\ln|\\csc y-\\cot y|; evaluating and simplifying with \\cos\\left(4\\tan^{-1}\\frac12\\right)=-\\frac7{25}$ gives \\frac\\pi{32}\\ln\\frac{16}9 = \\frac\\pi{16}\\ln\\frac43.",
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // Chainlink — Game 2
  // ---------------------------------------------------------------------------------------------
  {
    id: "ukuib24r3-chain2-p1",
    kind: "definite",
    integrand: "5\\left(x^6+x\\right)^4",
    integrandExpr: "5*(x^6+x)^4",
    lower: "-1",
    upper: "0",
    answer: "1/5",
    answerLatex: "\\frac15",
    domain: [-1, 0],
    difficulty: 2,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: ["5(x^6+x)^4 = 5x^4(x^5+1)^4, and \\frac{d}{dx}(x^5+1) = 5x^4."],
    steps: [
      "5(x^6+x)^4 = 5x^4(x^5+1)^4, and u=x^5+1 gives du=5x^4\\,dx.",
      "\\int_{-1}^0 5x^4(x^5+1)^4\\,dx = \\left[\\frac{(x^5+1)^5}5\\right]_{-1}^0 = \\frac15-0 = \\frac15.",
    ],
  },
  {
    id: "ukuib24r3-chain2-p2",
    kind: "indefinite",
    integrand: "e^{e^{e^x}}e^{e^x}e^{e^x}e^x",
    integrandExpr: "exp(exp(exp(x)))*exp(exp(x))*exp(exp(x))*exp(x)",
    answer: "exp(exp(exp(x)))*(exp(exp(x))-1)",
    answerLatex: "e^{e^{e^x}}\\left(e^{e^x}-1\\right) + C",
    domain: [-0.5, 0.3],
    difficulty: 4,
    techniques: ["parts", "u-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "Let u=e^{e^x}; then du = e^{e^x}e^x\\,dx, and e^{e^{e^x}} = e^u.",
      "The integral becomes \\int e^u\\cdot u\\,du — a plain by-parts.",
    ],
    steps: [
      "u=e^{e^x} gives du = e^{e^x}e^x\\,dx, and the integrand is e^u\\cdot u\\cdot du.",
      "\\int u e^u\\,du = ue^u-e^u+C.",
      "Back-substituting: e^{e^{e^x}}\\left(e^{e^x}-1\\right)+C.",
    ],
  },
  {
    id: "ukuib24r3-chain2-p4",
    kind: "definite",
    integrand: "\\ln\\left(1+e^{-x}\\right)\\cos x",
    integrandExpr: "log(1+exp(-x))*cos(x)",
    lower: "0",
    upper: "\\infty",
    answer: "0.5 - (pi/2)/sinh(pi)",
    answerLatex: "\\frac12-\\frac\\pi{2\\sinh\\pi}",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["zeta-series"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "Expand \\ln(1+e^{-x}) as its alternating series \\sum_{k\\ge1}\\frac{(-1)^{k-1}e^{-kx}}k.",
      "\\int_0^\\infty e^{-kx}\\cos x\\,dx = \\frac{k}{k^2+1} for each term.",
    ],
    steps: [
      "\\ln(1+e^{-x}) = \\sum_{k\\ge1}\\frac{(-1)^{k-1}}k e^{-kx}, so the integral is \\sum_{k\\ge1}\\frac{(-1)^{k-1}}k\\int_0^\\infty e^{-kx}\\cos x\\,dx.",
      "\\int_0^\\infty e^{-kx}\\cos x\\,dx = \\frac{k}{k^2+1}, so the sum is \\sum_{k\\ge1}\\frac{(-1)^{k-1}}{k^2+1}.",
      "This Dirichlet-type series sums to \\frac12-\\frac\\pi{2\\sinh\\pi} (a standard result from the \\coth/\\text{csch} partial-fraction expansion).",
    ],
  },
  {
    id: "ukuib24r3-chain2-p5",
    kind: "definite",
    integrand: "\\frac{\\sin x}{\\cos x+\\tan x}",
    integrandExpr: "sin(x)/(cos(x)+tan(x))",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "(2/sqrt(5))*atanh(1/sqrt(5))",
    answerLatex: "\\frac2{\\sqrt5}\\tanh^{-1}\\frac1{\\sqrt5}",
    domain: [0, 1.5707963267948966],
    difficulty: 4,
    techniques: ["partial-fractions", "u-sub"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "Multiply through by \\cos x: the integrand becomes \\frac{\\sin x\\cos x}{\\cos^2x+\\sin x} = \\frac{\\sin x\\cos x}{1-\\sin^2x+\\sin x}.",
      "u=\\sin x turns this into \\frac{u}{1+u-u^2}\\,du, a partial-fractions/completing-the-square rational integral.",
    ],
    steps: [
      "\\cos x+\\tan x = \\frac{\\cos^2x+\\sin x}{\\cos x}, so the integrand is \\frac{\\sin x\\cos x}{1-\\sin^2x+\\sin x}.",
      "u=\\sin x gives \\int_0^1\\frac{u}{1+u-u^2}\\,du.",
      "Completing the square in the denominator and integrating gives \\frac2{\\sqrt5}\\tanh^{-1}\\frac1{\\sqrt5}.",
    ],
  },
  {
    id: "ukuib24r3-chain2-p6",
    kind: "definite",
    integrand: "e^{-x^2-\\frac1{x^2}}",
    integrandExpr: "exp(-x^2-1/x^2)",
    lower: "0",
    upper: "\\infty",
    answer: "(sqrt(pi)/2)*exp(-2)",
    answerLatex: "\\frac{\\sqrt\\pi}2 e^{-2}",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["gaussian-hypersphere"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "The general form \\int_0^\\infty e^{-a^2x^2-b^2/x^2}dx (this is the a=b=1 case) is solved by u=\\frac bax, which turns it into a Gaussian in u shifted by a coupling term -2ab.",
      "Once it's \\int_0^\\infty e^{-u^2-1/u^2}du, it equals \\int_{-\\infty}^\\infty of half that by symmetry, and completing the square on x-1/x collapses the coupling to a constant factor e^{-2}.",
    ],
    steps: [
      "Substitute v=x-1/x (so dv=(1+1/x^2)dx) on the piece where it helps, and use that as x ranges over (0,\\infty), x+1/x has minimum 2 at x=1: x^2+1/x^2 = (x-1/x)^2+2.",
      "So the integrand is e^{-2}e^{-(x-1/x)^2}, and \\int_0^\\infty e^{-(x-1/x)^2}dx = \\frac12\\int_{-\\infty}^\\infty e^{-v^2}dv = \\frac{\\sqrt\\pi}2 (a classical Glasser's-master-theorem fact).",
      "So the value is \\frac{\\sqrt\\pi}2 e^{-2}.",
    ],
  },
  {
    id: "ukuib24r3-chain2-p7",
    kind: "definite",
    integrand: "\\frac{\\cos^3x\\sin x}{\\ln(\\sin x)}",
    integrandExpr: "cos(x)^3*sin(x)/log(sin(x))",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "-log(2)",
    answerLatex: "-\\ln2",
    domain: [0, 1.5707963267948966],
    difficulty: 5,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Chainlink" },
    hints: [
      "u=\\sin x turns this into \\int_0^1\\frac{(1-u^2)u}{\\ln u}\\,du, and y=u^2 turns that into \\int_0^1\\frac{1-y}{\\ln y}\\,dy.",
      "That last shape is exactly Feynman's trick with I(a)=\\int_0^1\\frac{1-y^a}{\\ln y}dy.",
    ],
    steps: [
      "u=\\sin x, then y=u^2: the integral becomes \\frac12\\int_0^1\\frac{1-y}{\\ln y}\\,dy.",
      "Let I(a)=\\int_0^1\\frac{1-y^a}{\\ln y}\\,dy. Then I'(a) = -\\int_0^1 y^a\\,dy = -\\frac1{a+1}, so I(a) = -\\ln(a+1) (using I(0)=0).",
      "The value wanted is I(1) = -\\ln2.",
    ],
  },
];
