/**
 * Floor function integrals. Every one of these is graded numerically, which is worth knowing: the
 * integrand is discontinuous at every integer, so there's no antiderivative to differentiate — the
 * grader integrates the true piecewise-constant value directly instead. All indefinite instincts are
 * off the table here; the technique is entirely about splitting the domain and summing.
 */
import type { Problem } from "../types";

export const FloorFunction: Problem[] = [
  {
    id: "floor-plain-0to3",
    kind: "definite",
    integrand: "\\lfloor x\\rfloor",
    integrandExpr: "floor(x)",
    lower: "0",
    upper: "3",
    answer: "3",
    answerLatex: "3",
    domain: [0, 3],
    difficulty: 2,
    techniques: ["floor-function"],
    hints: [
      "Split at the two integers inside the interval: [0,1),\\,[1,2),\\,[2,3].",
      "On each piece \\lfloor x\\rfloor is just a constant.",
    ],
    steps: [
      "\\lfloor x\\rfloor = 0 on [0,1), = 1 on [1,2), = 2 on [2,3].",
      "\\int_0^3\\lfloor x\\rfloor\\,dx = 0\\cdot 1 + 1\\cdot 1 + 2\\cdot 1 = 3.",
    ],
  },
  {
    id: "floor-plain-0to2half",
    kind: "definite",
    integrand: "\\lfloor x\\rfloor",
    integrandExpr: "floor(x)",
    lower: "0",
    upper: "2.5",
    answer: "2",
    answerLatex: "2",
    domain: [0, 2.5],
    difficulty: 2,
    techniques: ["floor-function"],
    hints: [
      "The last piece is only half a unit wide — [2, 2.5] — so its contribution is 2\\times 0.5, not 2\\times 1.",
    ],
    steps: [
      "\\int_0^1 0\\,dx + \\int_1^2 1\\,dx + \\int_2^{2.5} 2\\,dx = 0 + 1 + 1 = 2.",
    ],
  },
  {
    id: "floor-fracpart-0to4",
    kind: "definite",
    integrand: "x-\\lfloor x\\rfloor",
    integrandExpr: "x-floor(x)",
    lower: "0",
    upper: "4",
    answer: "2",
    answerLatex: "2",
    domain: [0, 4],
    difficulty: 3,
    techniques: ["floor-function"],
    hints: [
      "On each [k,k+1), x-\\lfloor x\\rfloor is just x-k — the same little ramp from 0 up to 1, shifted.",
      "\\int_0^1 u\\,du = \\frac{1}{2} for every one of those pieces, so you don't need to redo the algebra four times.",
    ],
    steps: [
      "On [k,k+1), substituting u=x-k gives \\int_0^1 u\\,du = \\frac{1}{2}, independent of k.",
      "There are four full unit intervals in [0,4].",
      "Total: 4\\times\\frac{1}{2} = 2.",
    ],
  },
  {
    id: "floor-x-times-floor-0to3",
    kind: "definite",
    integrand: "x\\lfloor x\\rfloor",
    integrandExpr: "x*floor(x)",
    lower: "0",
    upper: "3",
    answer: "6.5",
    answerLatex: "\\frac{13}{2}",
    domain: [0, 3],
    difficulty: 3,
    techniques: ["floor-function"],
    hints: [
      "On [k,k+1), x\\lfloor x\\rfloor = kx — a plain linear integrand, once you've fixed the piece.",
      "\\int_k^{k+1} kx\\,dx = k\\left(k+\\tfrac{1}{2}\\right).",
    ],
    steps: [
      "[0,1): \\int_0^1 0\\cdot x\\,dx = 0.",
      "[1,2): \\int_1^2 1\\cdot x\\,dx = \\frac{3}{2}.",
      "[2,3): \\int_2^3 2\\cdot x\\,dx = 2\\cdot\\frac{5}{2} = 5.",
      "Total: 0+\\frac{3}{2}+5 = \\frac{13}{2}.",
    ],
  },
  {
    id: "floor-squared-0to3",
    kind: "definite",
    integrand: "\\lfloor x\\rfloor^2",
    integrandExpr: "floor(x)^2",
    lower: "0",
    upper: "3",
    answer: "5",
    answerLatex: "5",
    domain: [0, 3],
    difficulty: 4,
    techniques: ["floor-function"],
    hints: [
      "Same split as always — the square just changes the constant on each piece to k^2 instead of k.",
      "0^2, 1^2, 2^2 on the three unit intervals.",
    ],
    steps: [
      "\\int_0^3\\lfloor x\\rfloor^2\\,dx = 0^2\\cdot 1 + 1^2\\cdot 1 + 2^2\\cdot 1.",
      "= 0+1+4 = 5.",
    ],
  },
];
