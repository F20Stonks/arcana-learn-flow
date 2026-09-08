/**
 * UK University Integration Bee — Round Two "Crossnumber" clues, 2021/22 through 2025/26.
 *
 * Mined from:
 *   Crossnumber_2021_R2_UK_University_Integration_Bee_Round_Two.txt
 *   Crossnumber_R2_2022_UK_University_Integration_Bee.txt
 *   Crossnumber_2023_R2_UK_University_Integration_Bee.txt
 *   Crossnumber_Down_2024_R2_UK_University_Integration_Bee.txt +
 *     Crossnumber_Across_2024_R2_UK_University_Integration_Bee.txt
 *   UUIB_20252026_R2_CN_Clues_Down.txt + UUIB_20252026_R2_CN_Clues_Across.txt
 *
 * Each crossnumber clue is a self-contained integral whose numeric answer supplies grid digits.
 * The grid-fitting/digit-placement wrapper around every clue (references to other clues by
 * number, "a divisor of ...", coprime-integer searches, etc.) is deliberately ignored here —
 * only the underlying integral itself is mined, exactly as instructed. Most of every paper is
 * pure crossword machinery (digit trivia, cross-references to other clues, unspecified-function
 * algebra puzzles) with no integral content at all; the ~85 clues across five documents yielded
 * only the 8 below that are both a genuine, self-contained integral AND numerically verified.
 * Every skipped clue is logged, with reason, in harness.local/report-crossnumber.md.
 *
 * Every answer here was hand-derived, then checked against harness.local/verify.ts (same
 * normalize()/derivative()/quadrature() as problems.test.ts) before being written down — see
 * that report for the full derivation notes and the two genuine quadrature-resolution-limit
 * skips (both independently confirmed correct by other means, just unresolvable by the shared
 * n=4000 quadrature).
 */
import type { Problem } from "../../types";

export const UkuibCrossnumber: Problem[] = [
  {
    id: "ukuib22cn-p1",
    kind: "definite",
    integrand: "\\frac{\\sin^2(5x)\\sin^2(4x)}{\\sin^2 x}",
    integrandExpr: "sin(5*x)^2*sin(4*x)^2/sin(x)^2",
    lower: "0",
    upper: "2\\pi",
    answer: "4*pi",
    answerLatex: "4\\pi",
    domain: [0, 2 * Math.PI],
    difficulty: 5,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Crossnumber" },
    hints: [
      "\\frac{\\sin(nx)}{\\sin x} is a finite sum of cosines (the real Dirichlet kernel); for n=5 this gives \\frac{\\sin5x}{\\sin x}=1+2\\cos2x+2\\cos4x — check it at x=\\frac\\pi2, both sides equal 1.",
      "Square that, reduce every power and product to a sum of single cosines via \\cos^2\\theta=\\frac{1+\\cos2\\theta}2 and product-to-sum, then multiply by \\sin^24x=\\frac{1-\\cos8x}2. Only the x-independent term survives \\int_0^{2\\pi}.",
    ],
    steps: [
      "\\frac{\\sin5x}{\\sin x}=1+2\\cos2x+2\\cos4x.",
      "Squaring and reducing powers/products gives \\left(\\frac{\\sin5x}{\\sin x}\\right)^2=5+8\\cos2x+6\\cos4x+4\\cos6x+2\\cos8x.",
      "Multiplying by \\sin^24x=\\frac{1-\\cos8x}2 and expanding every product-to-sum term, every \\cos(kx) with k\\ne0 integrates to 0 over a full period; the only surviving constant is \\frac12(5-1)=2.",
      "So \\int_0^{2\\pi}=2\\pi\\times2=4\\pi.",
    ],
  },
  {
    id: "ukuib22cn-p2",
    kind: "definite",
    integrand: "\\frac1x-\\frac{\\sin(2x)}{1-\\cos(2x)}",
    integrandExpr: "1/x - cot(x)",
    lower: "0",
    upper: "\\frac{\\pi}{4}",
    answer: "log(pi/(2*sqrt(2)))",
    answerLatex: "\\ln\\!\\left(\\frac{\\pi}{2\\sqrt2}\\right)",
    domain: [0, Math.PI / 4],
    difficulty: 3,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Crossnumber" },
    hints: [
      "\\frac{\\sin2x}{1-\\cos2x}=\\frac{2\\sin x\\cos x}{2\\sin^2x}=\\cot x — the messy fraction is just \\cot x in disguise.",
      "\\frac1x-\\cot x is exactly \\frac{d}{dx}\\ln\\!\\left(\\frac x{\\sin x}\\right), and \\frac x{\\sin x}\\to1 as x\\to0, so the antiderivative is finite at the left endpoint.",
    ],
    steps: [
      "\\frac{\\sin2x}{1-\\cos2x}=\\cot x, so the integrand is \\frac1x-\\cot x.",
      "\\frac{d}{dx}\\ln\\!\\left(\\frac x{\\sin x}\\right)=\\frac1x-\\cot x, and \\lim_{x\\to0}\\ln\\frac x{\\sin x}=\\ln1=0.",
      "So the integral is \\left[\\ln\\frac x{\\sin x}\\right]_0^{\\pi/4}=\\ln\\!\\left(\\frac{\\pi/4}{\\sin(\\pi/4)}\\right)=\\ln\\!\\left(\\frac{\\pi}{2\\sqrt2}\\right).",
    ],
  },
  {
    id: "ukuib23cn-p1",
    kind: "definite",
    integrand:
      "\\frac1x\\ln\\!\\left(\\frac{20e^{1337x}+24e^{420x}}{20e^{1337x}+24e^{69x}}\\right)",
    integrandExpr: "(1/x)*(log(20+24*exp(-917*x)) - log(20+24*exp(-1268*x)))",
    lower: "0",
    upper: "\\infty",
    answer: "log(11/5)*log(1268/917)",
    answerLatex: "\\ln\\!\\left(\\frac{11}5\\right)\\ln\\!\\left(\\frac{1268}{917}\\right)",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Crossnumber" },
    hints: [
      "Factor e^{1337x} out of both logs: \\ln(20e^{1337x}+24e^{420x})=1337x+\\ln(20+24e^{-917x}), and likewise for the other term — the 1337x cancels in the difference (1337-420=917, 1337-69=1268).",
      "What remains is a genuine Frullani integral \\int_0^\\infty\\frac{F(ax)-F(bx)}{x}\\,dx=(F(0)-F(\\infty))\\ln\\frac ba with F(u)=\\ln(20+24e^{-u}), a=917, b=1268.",
    ],
    steps: [
      "Writing both logs with 1337x factored out leaves \\frac1x\\big[\\ln(20+24e^{-917x})-\\ln(20+24e^{-1268x})\\big].",
      "This is Frullani's integral with F(u)=\\ln(20+24e^{-u}), a=917, b=1268: the value is (F(0)-F(\\infty))\\ln\\frac ba.",
      "F(0)=\\ln44, F(\\infty)=\\ln20, so F(0)-F(\\infty)=\\ln\\frac{44}{20}=\\ln\\frac{11}5, giving \\ln\\frac{11}5\\cdot\\ln\\frac{1268}{917}.",
    ],
  },
  {
    id: "ukuib23cn-p2",
    kind: "definite",
    integrand: "\\ln(x^2)\\ln(1-x^2)",
    integrandExpr: "log(x^2)*log(1-x^2)",
    lower: "-1",
    upper: "1",
    answer: "16 - pi^2 - log(256)",
    answerLatex: "16-\\pi^2-\\ln256",
    domain: [-1, 1],
    difficulty: 4,
    techniques: ["beta-integrals"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Crossnumber" },
    hints: [
      "The integrand is even, so \\int_{-1}^1=2\\int_0^1, and \\ln(x^2)=2\\ln x on (0,1).",
      "Split \\ln(1-x^2)=\\ln(1-x)+\\ln(1+x) and use the two standard dilogarithm evaluations \\int_0^1\\ln x\\ln(1-x)\\,dx=2-\\frac{\\pi^2}6 and \\int_0^1\\ln x\\ln(1+x)\\,dx=2-2\\ln2-\\frac{\\pi^2}{12}.",
    ],
    steps: [
      "\\int_{-1}^1\\ln(x^2)\\ln(1-x^2)\\,dx=4\\int_0^1\\ln x\\,[\\ln(1-x)+\\ln(1+x)]\\,dx.",
      "\\int_0^1\\ln x\\ln(1-x)\\,dx=2-\\frac{\\pi^2}6 and \\int_0^1\\ln x\\ln(1+x)\\,dx=2-2\\ln2-\\frac{\\pi^2}{12}.",
      "Adding: \\int_0^1\\ln x\\ln(1-x^2)\\,dx=4-2\\ln2-\\frac{\\pi^2}4, so the original integral is 4\\left(4-2\\ln2-\\frac{\\pi^2}4\\right)=16-8\\ln2-\\pi^2=16-\\pi^2-\\ln256.",
    ],
  },
  {
    id: "ukuib23cn-p3",
    kind: "definite",
    integrand: "\\frac{(1-x)^{25}\\,x}{25!}",
    integrandExpr: "((1-x)^25*x)/gamma(26)",
    lower: "0",
    upper: "1",
    answer: "1/gamma(28)",
    answerLatex: "\\frac1{27!}",
    domain: [0, 1],
    difficulty: 5,
    techniques: ["beta-integrals"],
    source: { name: "UK University Integration Bee", year: 2023, round: "Crossnumber" },
    hints: [
      "The source clue is 26 nested integrals of f(z)=z — one for every letter a through z, with the outermost bound fixed at 1. Cauchy's formula turns an n-fold repeated integral of f from 0 to X into a single integral: \\frac1{(n-1)!}\\int_0^X(X-t)^{n-1}f(t)\\,dt.",
      "With n=26, f(t)=t, X=1, that single integral is exactly a Beta-function integral.",
    ],
    steps: [
      "By Cauchy's formula for repeated integration, the 26-fold nested integral of f(t)=t from 0 to 1 equals \\frac1{25!}\\int_0^1(1-t)^{25}t\\,dt.",
      "\\int_0^1(1-t)^{25}t\\,dt=B(2,26)=\\frac{1!\\,25!}{27!}, a standard Beta-function value.",
      "So the whole nested integral is \\frac1{25!}\\cdot\\frac{25!}{27!}=\\frac1{27!}.",
    ],
  },
  {
    id: "ukuib24cn-p1",
    kind: "definite",
    integrand: "\\frac{25x+5}{x^2-6x+10}",
    integrandExpr: "(25*x+5)/(x^2-6*x+10)",
    lower: "2",
    upper: "3",
    answer: "20*pi - 25*log(2)/2",
    answerLatex: "20\\pi-\\frac{25}2\\ln2",
    domain: [2, 3],
    difficulty: 3,
    techniques: ["complete-square"],
    source: { name: "UK University Integration Bee", year: 2024, round: "Crossnumber" },
    hints: [
      "x^2-6x+10=(x-3)^2+1 — complete the square and substitute u=x-3, so u runs from -1 to 0.",
      "Split the numerator 25u+80 into a piece proportional to \\frac{2u}{u^2+1} (a log) and a constant piece over u^2+1 (an arctan).",
    ],
    steps: [
      "With u=x-3, the integral becomes \\int_{-1}^0\\frac{25u+80}{u^2+1}\\,du.",
      "\\int_{-1}^0\\frac u{u^2+1}\\,du=-\\frac12\\ln2 and \\int_{-1}^0\\frac{du}{u^2+1}=\\frac\\pi4.",
      "So the integral is 25\\left(-\\frac12\\ln2\\right)+80\\cdot\\frac\\pi4=20\\pi-\\frac{25}2\\ln2.",
    ],
  },
  {
    id: "ukuib2526cn-p1",
    kind: "definite",
    integrand: "\\sqrt{2x-2\\sqrt{x^2-1}}+\\sqrt{x-1}",
    integrandExpr: "sqrt(2*x-2*sqrt(x^2-1)) + sqrt(x-1)",
    lower: "15",
    upper: "80",
    answer: "1330/3",
    answerLatex: "\\frac{1330}3",
    domain: [15, 80],
    difficulty: 4,
    techniques: ["power"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Crossnumber" },
    hints: [
      "2x-2\\sqrt{x^2-1}=(\\sqrt{x+1}-\\sqrt{x-1})^2, since (x+1)+(x-1)-2\\sqrt{(x+1)(x-1)}=2x-2\\sqrt{x^2-1}.",
      "So \\sqrt{2x-2\\sqrt{x^2-1}}=\\sqrt{x+1}-\\sqrt{x-1} for x\\ge1, and adding back \\sqrt{x-1} leaves just \\sqrt{x+1}.",
    ],
    steps: [
      "\\sqrt{2x-2\\sqrt{x^2-1}}=\\sqrt{x+1}-\\sqrt{x-1}, so the whole integrand collapses to \\sqrt{x+1}.",
      "\\int\\sqrt{x+1}\\,dx=\\frac23(x+1)^{3/2}.",
      "\\left[\\frac23(x+1)^{3/2}\\right]_{15}^{80}=\\frac23\\left(81^{3/2}-16^{3/2}\\right)=\\frac23(729-64)=\\frac{1330}3.",
    ],
  },
  {
    id: "ukuib2526cn-p2",
    kind: "definite",
    integrand: "\\frac{\\ln\\!\\left(x^8-x^7+x^5-x^4+x^3-x+1\\right)}x",
    integrandExpr: "log(x^8-x^7+x^5-x^4+x^3-x+1)/x",
    lower: "0",
    upper: "1",
    answer: "-4*pi^2/45",
    answerLatex: "-\\frac{4\\pi^2}{45}",
    domain: [0, 1],
    difficulty: 4,
    techniques: ["log-power-integrals"],
    source: { name: "UK University Integration Bee", year: 2025, round: "Crossnumber" },
    hints: [
      "x^8-x^7+x^5-x^4+x^3-x+1 is exactly the 15th cyclotomic polynomial \\Phi_{15}(x); using x^{15}-1=\\prod_{d\\mid15}\\Phi_d(x) it factors as \\Phi_{15}(x)=\\frac{(1-x)(1-x^{15})}{(1-x^3)(1-x^5)} on (0,1).",
      "Each piece is a standard log-power integral: \\int_0^1\\frac{\\ln(1-x^n)}x\\,dx=-\\frac{\\pi^2}{6n}.",
    ],
    steps: [
      "\\Phi_{15}(x)=\\dfrac{(1-x)(1-x^{15})}{(1-x^3)(1-x^5)}, so \\ln\\Phi_{15}(x)=\\ln(1-x)+\\ln(1-x^{15})-\\ln(1-x^3)-\\ln(1-x^5).",
      "\\int_0^1\\frac{\\ln(1-x^n)}x\\,dx=-\\frac{\\pi^2}{6n}, giving the four terms -\\frac{\\pi^2}6,\\,-\\frac{\\pi^2}{90},\\,+\\frac{\\pi^2}{18},\\,+\\frac{\\pi^2}{30} for n=1,15,3,5.",
      "Summing over a common denominator of 90: (-15-1+5+3)\\frac{\\pi^2}{90}=-\\frac{8\\pi^2}{90}=-\\frac{4\\pi^2}{45}.",
    ],
  },
];
