/**
 * \int_0^{\pi/2}\sin^n x\,dx (the Wallis integrals) reduce exactly like the full-period sin^n
 * problems in recurrence.ts — same formula, half the interval. \cos^n over the same interval
 * gives identical values, by x\to\pi/2-x. The sin(x)^4/sin(x)^5 full-period problems in
 * recurrence.ts are tagged with this technique too, since they're the same reduction.
 */
import type { Problem } from "../types";

export const WallisProduct: Problem[] = [
  {
    id: "wallis-sin3",
    kind: "definite",
    integrand: "\\sin^3 x",
    integrandExpr: "sin(x)^3",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "2/3",
    answerLatex: "\\frac{2}{3}",
    domain: [0, Math.PI / 2],
    difficulty: 2,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: [
      "I_n=\\frac{n-1}{n}I_{n-2}, base case for odd n is I_1=\\int_0^{\\pi/2}\\sin x\\,dx=1.",
    ],
    steps: ["I_3=\\frac{2}{3}I_1=\\frac{2}{3}\\cdot1=\\frac{2}{3}."],
  },
  {
    id: "wallis-cos5",
    kind: "definite",
    integrand: "\\cos^5 x",
    integrandExpr: "cos(x)^5",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "8/15",
    answerLatex: "\\frac{8}{15}",
    domain: [0, Math.PI / 2],
    difficulty: 3,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: [
      "\\int_0^{\\pi/2}\\cos^nx\\,dx equals the same I_n as \\sin^nx — substitute x\\to\\frac{\\pi}{2}-x to see why.",
      "So this is I_5, same value as \\int_0^{\\pi/2}\\sin^5x\\,dx.",
    ],
    steps: [
      "I_1=1,\\ I_3=\\frac{2}{3}I_1=\\frac{2}{3},\\ I_5=\\frac{4}{5}I_3=\\frac{4}{5}\\cdot\\frac{2}{3}=\\frac{8}{15}.",
    ],
  },
  {
    id: "wallis-sin4-half",
    kind: "definite",
    integrand: "\\sin^4 x",
    integrandExpr: "sin(x)^4",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "3*pi/16",
    answerLatex: "\\frac{3\\pi}{16}",
    domain: [0, Math.PI / 2],
    difficulty: 3,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: [
      "Same recurrence as the full-period \\sin^4x problem, just over half the interval and so half the base case: I_0=\\frac{\\pi}{2} here (versus \\pi over [0,\\pi]).",
    ],
    steps: [
      "I_0=\\frac{\\pi}{2},\\ I_2=\\frac{1}{2}I_0=\\frac{\\pi}{4},\\ I_4=\\frac{3}{4}I_2=\\frac{3}{4}\\cdot\\frac{\\pi}{4}=\\frac{3\\pi}{16}.",
    ],
  },
  {
    id: "wallis-cos7",
    kind: "definite",
    integrand: "\\cos^7 x",
    integrandExpr: "cos(x)^7",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "16/35",
    answerLatex: "\\frac{16}{35}",
    domain: [0, Math.PI / 2],
    difficulty: 4,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: ["Same value as I_7=\\int_0^{\\pi/2}\\sin^7x\\,dx — unroll the odd-index reduction three steps from I_1."],
    steps: [
      "I_1=1,\\ I_3=\\frac{2}{3},\\ I_5=\\frac{4}{5}\\cdot\\frac{2}{3}=\\frac{8}{15},\\ I_7=\\frac{6}{7}\\cdot\\frac{8}{15}=\\frac{48}{105}=\\frac{16}{35}.",
    ],
  },
  {
    id: "wallis-sin6-half",
    kind: "definite",
    integrand: "\\sin^6 x",
    integrandExpr: "sin(x)^6",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "5*pi/32",
    answerLatex: "\\frac{5\\pi}{32}",
    domain: [0, Math.PI / 2],
    difficulty: 4,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: ["This is the technique's own worked example — unroll the even-index reduction three steps from I_0=\\frac{\\pi}{2}."],
    steps: [
      "I_2=\\frac{1}{2}\\cdot\\frac{\\pi}{2}=\\frac{\\pi}{4},\\ I_4=\\frac{3}{4}\\cdot\\frac{\\pi}{4}=\\frac{3\\pi}{16},\\ I_6=\\frac{5}{6}\\cdot\\frac{3\\pi}{16}=\\frac{15\\pi}{96}=\\frac{5\\pi}{32}.",
    ],
  },
  {
    id: "wallis-sin8-half",
    kind: "definite",
    integrand: "\\sin^8 x",
    integrandExpr: "sin(x)^8",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "35*pi/256",
    answerLatex: "\\frac{35\\pi}{256}",
    domain: [0, Math.PI / 2],
    difficulty: 5,
    techniques: ["wallis-product"],
    source: { name: "original" },
    hints: [
      "One more even step past I_6=\\frac{5\\pi}{32}: I_8=\\frac{7}{8}I_6.",
      "This is exactly the pattern the Wallis product itself is built from — each step contributes one more factor \\frac{2k}{2k-1}\\cdot\\frac{2k}{2k+1}.",
    ],
    steps: [
      "I_8=\\frac{7}{8}\\cdot\\frac{5\\pi}{32}=\\frac{35\\pi}{256}.",
    ],
  },
];
