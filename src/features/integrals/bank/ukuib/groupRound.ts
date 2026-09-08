/**
 * UK University Integration Bee — Round Two "Group Round".
 *
 * Source documents span five years:
 *   Group_Round_2021_R2_UK_University_Integration_Bee_Round_Two.txt  (2021, 10 problems)
 *   Group_Round_R2_2022_UK_University_Integration_Bee_1.txt          (2022, 10 problems)
 *   Group_Round_2023_R2_UK_University_Integration_Bee.txt            (2023, ~9 problems)
 *   Group_Round_R2_2024_UK_University_Integration_Bee.txt            (2024, 10 problems)
 *   UUIB_20252026_R2_G_Problems.txt                                  (2025, 15 problems)
 * Only 2021 and 2022 are actually mined below (5+6 problems after dedup) — the mining agent
 * working this file was killed by a session rate limit before reaching 2023-2025, and no
 * harness.local/report-group-round.md was ever written. 2023 through 2025 (and their promised
 * "genuinely hard" content — infinite sums/floor functions, argmax definitions, iterated
 * integrals, implicit function definitions) remain unmined; a future session should redo this
 * file's remaining three years rather than assume they're covered.
 *
 * Unlike Round One, these are genuinely hard "Nothing gets dropped"-style problems. Every problem
 * below was hand-derived to a closed form and then verified against harness.local/verify.ts
 * (same normalize()/derivative()/quadrature() as problems.test.ts, including its infinite-domain
 * substitutions) before being written here.
 */
import type { Problem } from "../../types";

export const UkuibGroupRound: Problem[] = [
  // ---------- 2021/22 ----------
  {
    id: "ukuib21gr-p2",
    kind: "definite",
    integrand: "\\ln\\!\\left(\\frac{\\lfloor x\\rfloor^2-1}{\\lfloor x\\rfloor^2}\\right)",
    integrandExpr: "log((floor(x)^2-1)/floor(x)^2)",
    lower: "2",
    upper: "\\infty",
    answer: "-log(2)",
    answerLatex: "-\\ln2",
    domain: [2, Infinity],
    difficulty: 4,
    techniques: ["floor-function"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Group Round" },
    hints: [
      "On [n,n+1) the integrand is the constant \\ln\\!\\left(1-\\frac1{n^2}\\right) = \\ln\\frac{(n-1)(n+1)}{n^2} — the whole integral is a sum over n\\ge2.",
      "The partial product \\prod_{n=2}^N\\frac{(n-1)(n+1)}{n^2} telescopes in two separate factors.",
    ],
    steps: [
      "\\int_2^\\infty \\ln\\!\\left(1-\\tfrac1{\\lfloor x\\rfloor^2}\\right)dx = \\sum_{n=2}^\\infty \\ln\\frac{(n-1)(n+1)}{n^2}.",
      "\\prod_{n=2}^N\\frac{n-1}{n}=\\frac1N and \\prod_{n=2}^N\\frac{n+1}{n}=\\frac{N+1}{2}, so the partial product is \\frac{N+1}{2N}\\to\\frac12.",
      "The sum of logs is \\ln\\frac12=-\\ln2.",
    ],
  },
  {
    id: "ukuib21gr-p3",
    kind: "definite",
    integrand: "\\frac{1}{(2+\\cos x)^3}",
    integrandExpr: "1/(2+cos(x))^3",
    lower: "0",
    upper: "\\pi",
    answer: "pi*sqrt(3)/6",
    answerLatex: "\\frac{\\pi\\sqrt3}{6}",
    domain: [0, Math.PI],
    difficulty: 5,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Group Round" },
    hints: [
      "J(a)=\\int_0^\\pi\\frac{dx}{a+\\cos x}=\\frac{\\pi}{\\sqrt{a^2-1}} is standard — differentiate it twice in a to reach the cube.",
      "J''(a)=2\\int_0^\\pi\\frac{dx}{(a+\\cos x)^3}, evaluated at a=2.",
    ],
    steps: [
      "J(a)=\\pi(a^2-1)^{-1/2}, so J'(a)=-\\pi a(a^2-1)^{-3/2}=-2\\int_0^\\pi(a+\\cos x)^{-2}dx.",
      "J''(a)=\\pi(2a^2+1)(a^2-1)^{-5/2}=2\\int_0^\\pi(a+\\cos x)^{-3}dx.",
      "At a=2: a^2-1=3, so \\int_0^\\pi(2+\\cos x)^{-3}dx=\\frac{\\pi\\cdot9}{2\\cdot9\\sqrt3}=\\frac{\\pi}{2\\sqrt3}=\\frac{\\pi\\sqrt3}{6}.",
    ],
  },
  {
    id: "ukuib21gr-p4",
    kind: "definite",
    integrand: "\\ln(\\sin x)\\cos^3x",
    integrandExpr: "log(sin(x))*cos(x)^3",
    lower: "0",
    upper: "\\pi",
    answer: "0",
    answerLatex: "0",
    domain: [0, Math.PI],
    difficulty: 3,
    techniques: ["symmetry"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Group Round" },
    hints: [
      "Reflect x\\to\\pi-x: \\sin(\\pi-x)=\\sin x (even) but \\cos(\\pi-x)=-\\cos x (odd).",
      "The integrand is odd about x=\\pi/2, so the two halves of [0,\\pi] cancel exactly.",
    ],
    steps: [
      "Let f(x)=\\ln(\\sin x)\\cos^3x. Then f(\\pi-x)=\\ln(\\sin x)(-\\cos x)^3=-f(x).",
      "So \\int_0^\\pi f(x)\\,dx = \\int_0^{\\pi/2}f(x)\\,dx+\\int_{\\pi/2}^\\pi f(x)\\,dx = \\int_0^{\\pi/2}f(x)\\,dx-\\int_0^{\\pi/2}f(x)\\,dx=0.",
    ],
  },
  {
    id: "ukuib21gr-p5",
    kind: "indefinite",
    integrand: "\\frac{t^2+1}{t^4+1}",
    integrandExpr: "(x^2+1)/(x^4+1)",
    answer: "(1/sqrt(2))*atan((x^2-1)/(x*sqrt(2)))",
    answerLatex: "\\frac1{\\sqrt2}\\arctan\\!\\left(\\frac{x^2-1}{x\\sqrt2}\\right) + C",
    domain: [1, 3],
    difficulty: 4,
    techniques: ["reciprocal-substitution", "u-sub"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Group Round" },
    hints: [
      "Divide numerator and denominator by t^2: the integrand becomes \\frac{1+1/t^2}{t^2+1/t^2}.",
      "w=t-\\frac1t has dw=(1+\\frac1{t^2})dt and w^2+2=t^2+\\frac1{t^2}.",
    ],
    steps: [
      "Dividing by t^2 gives \\frac{1+1/t^2}{t^2+1/t^2}\\,dt.",
      "With w=t-\\frac1t, dw=(1+\\frac1{t^2})dt and t^2+\\frac1{t^2}=w^2+2, so the integral becomes \\int\\frac{dw}{w^2+2}.",
      "\\int\\frac{dw}{w^2+2}=\\frac1{\\sqrt2}\\arctan\\frac{w}{\\sqrt2}+C, and back-substituting w=\\frac{t^2-1}{t} gives the stated form.",
    ],
  },
  {
    id: "ukuib21gr-p7",
    kind: "definite",
    integrand: "\\frac{\\arctan x}{x^{\\ln x+1}}",
    integrandExpr: "atan(x)/x^(log(x)+1)",
    lower: "0",
    upper: "\\infty",
    answer: "pi*sqrt(pi)/4",
    answerLatex: "\\frac{\\pi^{3/2}}{4}",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["symmetry", "gaussian-hypersphere"],
    source: { name: "UK University Integration Bee", year: 2021, round: "Group Round" },
    hints: [
      "Substitute t=\\ln x: x^{\\ln x}=e^{t^2}, turning the whole integral into \\int_{-\\infty}^\\infty \\arctan(e^t)e^{-t^2}dt.",
      "\\arctan(e^t)+\\arctan(e^{-t})=\\frac\\pi2 — pair t with -t against the (even) Gaussian weight.",
    ],
    steps: [
      "With t=\\ln x, x^{\\ln x+1}=xe^{t^2}=e^te^{t^2}, and dx=e^tdt, so the integral becomes I=\\int_{-\\infty}^\\infty \\arctan(e^t)e^{-t^2}dt.",
      "Since e^{-t^2} is even, replacing t\\to-t gives I=\\int_{-\\infty}^\\infty\\arctan(e^{-t})e^{-t^2}dt too, so 2I=\\int_{-\\infty}^\\infty[\\arctan(e^t)+\\arctan(e^{-t})]e^{-t^2}dt.",
      "\\arctan(e^t)+\\arctan(e^{-t})=\\frac\\pi2 identically, so 2I=\\frac\\pi2\\int_{-\\infty}^\\infty e^{-t^2}dt=\\frac\\pi2\\sqrt\\pi, giving I=\\frac{\\pi^{3/2}}4.",
    ],
  },

  // ---------- 2022/23 ----------
  {
    id: "ukuib22gr-p1",
    kind: "definite",
    integrand: "\\frac1x-\\cot x",
    integrandExpr: "1/x - cos(x)/sin(x)",
    lower: "0",
    upper: "1",
    answer: "-log(sin(1))",
    answerLatex: "-\\ln(\\sin1)",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["u-sub"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "\\cot x is the derivative of \\ln(\\sin x); \\frac1x is the derivative of \\ln x.",
      "The whole integrand is -\\frac{d}{dx}\\ln\\!\\left(\\frac{\\sin x}{x}\\right).",
    ],
    steps: [
      "\\frac{d}{dx}\\ln\\!\\left(\\frac{x}{\\sin x}\\right) = \\frac1x-\\cot x.",
      "So \\int_0^1\\left(\\frac1x-\\cot x\\right)dx=\\left[\\ln\\frac{x}{\\sin x}\\right]_0^1.",
      "As x\\to0, \\frac{x}{\\sin x}\\to1 so the lower limit contributes 0; at x=1 it gives \\ln\\frac1{\\sin1}=-\\ln(\\sin1).",
    ],
  },
  // ukuib22gr-p2 (x^3/(1+x+x^2/2!+x^3/3!), indefinite) was an exact duplicate of the pre-existing
  // usub-x3-over-taylor-truncated-ex in substitution.ts, correctly sourced there to a different
  // real competition (MIT Integration Bee Qualifying Exam 2022) — left untouched.
  {
    id: "ukuib22gr-p3",
    kind: "definite",
    integrand: "(1-x)\\ln(1-x)/x",
    integrandExpr: "(1-x)*log(1-x)/x",
    lower: "0",
    upper: "1",
    answer: "1-pi^2/6",
    answerLatex: "1-\\frac{\\pi^2}6",
    domain: [0, 1],
    difficulty: 5,
    techniques: ["feynman"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "The original is the iterated integral \\int_0^1\\int_0^z\\frac{\\ln(1-u)}{u}\\,du\\,dz — swap the order of integration.",
      "For fixed u, z ranges from u to 1, so the double integral collapses to \\int_0^1(1-u)\\frac{\\ln(1-u)}{u}\\,du.",
    ],
    steps: [
      "Swapping the order of integration: \\int_0^1\\int_0^z\\frac{\\ln(1-u)}{u}du\\,dz = \\int_0^1\\frac{\\ln(1-u)}{u}(1-u)\\,du.",
      "Split into \\int_0^1\\frac{\\ln(1-u)}u du - \\int_0^1\\ln(1-u)\\,du.",
      "The first is -\\frac{\\pi^2}6 (the dilogarithm at 1); the second is -1. The difference is 1-\\frac{\\pi^2}6.",
    ],
  },
  {
    id: "ukuib22gr-p4",
    kind: "definite",
    integrand: "\\frac{1}{(\\cos x+\\sin x)^2}",
    integrandExpr: "1/(cos(x)+sin(x))^2",
    lower: "0",
    upper: "\\frac\\pi2",
    answer: "1",
    answerLatex: "1",
    domain: [0, Math.PI / 2],
    difficulty: 2,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "\\cos x+\\sin x=\\sqrt2\\sin\\!\\left(x+\\frac\\pi4\\right).",
      "The integrand becomes \\frac12\\csc^2\\!\\left(x+\\frac\\pi4\\right), whose antiderivative is elementary.",
    ],
    steps: [
      "(\\cos x+\\sin x)^2=2\\sin^2\\!\\left(x+\\frac\\pi4\\right), so the integrand is \\frac12\\csc^2\\!\\left(x+\\frac\\pi4\\right).",
      "\\int\\frac12\\csc^2\\!\\left(x+\\frac\\pi4\\right)dx=-\\frac12\\cot\\!\\left(x+\\frac\\pi4\\right)+C.",
      "Evaluating from 0 to \\frac\\pi2: -\\frac12\\left[\\cot\\tfrac{3\\pi}4-\\cot\\tfrac\\pi4\\right]=-\\frac12[-1-1]=1.",
    ],
  },
  {
    id: "ukuib22gr-p6",
    kind: "definite",
    integrand: "\\frac{1}{\\left(x+\\sqrt{1+x^2}\\right)^2}",
    integrandExpr: "1/(x+sqrt(1+x^2))^2",
    lower: "0",
    upper: "\\infty",
    answer: "2/3",
    answerLatex: "\\frac23",
    domain: [0, Infinity],
    difficulty: 4,
    techniques: ["trig-sub"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "x=\\sinh t makes x+\\sqrt{1+x^2}=e^t exactly.",
      "dx=\\cosh t\\,dt, so the integral becomes \\int_0^\\infty \\cosh(t)e^{-2t}\\,dt.",
    ],
    steps: [
      "With x=\\sinh t, \\sqrt{1+x^2}=\\cosh t and x+\\sqrt{1+x^2}=\\sinh t+\\cosh t=e^t.",
      "The integral becomes \\int_0^\\infty \\cosh(t)e^{-2t}dt=\\frac12\\int_0^\\infty(e^{-t}+e^{-3t})dt.",
      "=\\frac12\\left(1+\\frac13\\right)=\\frac23.",
    ],
  },
  {
    id: "ukuib22gr-p8",
    kind: "definite",
    integrand: "\\frac{\\sin(24x)}{\\sin x}",
    integrandExpr: "sin(24*x)/sin(x)",
    lower: "0",
    upper: "2\\pi",
    answer: "0",
    answerLatex: "0",
    domain: [0, 2 * Math.PI],
    difficulty: 4,
    techniques: ["trig-identity"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "\\frac{\\sin(2m\\theta)}{\\sin\\theta}=2\\sum_{j=1}^m\\cos((2j-1)\\theta) — a Dirichlet-kernel-style identity.",
      "Every term is a pure cosine with no constant piece, so it integrates to 0 over a full period.",
    ],
    steps: [
      "With 2m=24, \\frac{\\sin(24x)}{\\sin x}=2[\\cos x+\\cos3x+\\cdots+\\cos23x], a sum of 12 cosines.",
      "\\int_0^{2\\pi}\\cos(kx)\\,dx=0 for every nonzero integer k.",
      "So the whole sum integrates to 0.",
    ],
  },
  {
    id: "ukuib22gr-p9",
    kind: "definite",
    integrand: "\\frac{\\ln(1-x+x^2)}{(1+x^2)\\ln x}",
    integrandExpr: "log(1-x+x^2)/((1+x^2)*log(x))",
    lower: "0",
    upper: "\\infty",
    answer: "pi/2",
    answerLatex: "\\frac\\pi2",
    domain: [0, Infinity],
    difficulty: 5,
    techniques: ["reciprocal-substitution"],
    source: { name: "UK University Integration Bee", year: 2022, round: "Group Round" },
    hints: [
      "Substitute x=1/y. Both 1-x+x^2 and \\ln x transform in a way that relates the integral to minus itself, plus a leftover \\arctan-type piece.",
      "1-\\frac1y+\\frac1{y^2}=\\frac{y^2-y+1}{y^2}, the same polynomial shape as the original numerator.",
    ],
    steps: [
      "With x=1/y, dx=-dy/y^2, and 1+x^2=\\frac{1+y^2}{y^2}, \\ln x=-\\ln y, \\ln(1-x+x^2)=\\ln(y^2-y+1)-2\\ln y.",
      "The transformed integral works out to I=\\int_0^\\infty\\left[-f(y)+\\frac{2}{1+y^2}\\right]dy where f is the original integrand (renamed variable) — the ln(1-x+x^2) piece maps back onto itself.",
      "So 2I=2\\int_0^\\infty\\frac{dy}{1+y^2}=2\\cdot\\frac\\pi2=\\pi, giving I=\\frac\\pi2.",
    ],
  },
];
