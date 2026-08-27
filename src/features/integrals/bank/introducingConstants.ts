/**
 * Introducing constants: split a numerator into (a multiple of the denominator) + (a remainder), so
 * one half integrates to nothing and the other lands in a form you already have. The trig example
 * deliberately reuses the exact a+b\cos x result from the t-sub bank — this technique is often the
 * second pass after another one has already done the hard work.
 */
import type { Problem } from "../types";

export const IntroducingConstants: Problem[] = [
  {
    id: "ic-xplus3-over-xplus1",
    kind: "indefinite",
    integrand: "\\frac{x+3}{x+1}",
    integrandExpr: "(x+3)/(x+1)",
    answer: "x+2*log(x+1)",
    answerLatex: "x + 2\\ln(x+1) + C",
    domain: [0, 3],
    difficulty: 2,
    techniques: ["introducing-constants"],
    source: { name: "original" },
    hints: [
      "The numerator is the denominator plus a constant: x+3 = (x+1)+2.",
      "That splits into \\int 1\\,dx + 2\\int\\frac{dx}{x+1}.",
    ],
    steps: [
      "\\frac{x+3}{x+1} = 1 + \\frac{2}{x+1}.",
      "\\int\\left(1+\\frac{2}{x+1}\\right)dx = x + 2\\ln(x+1) + C.",
    ],
  },
  {
    id: "ic-3x2plus1-over-x2plus1",
    kind: "indefinite",
    integrand: "\\frac{3x^2+1}{x^2+1}",
    integrandExpr: "(3*x^2+1)/(x^2+1)",
    answer: "3*x-2*atan(x)",
    answerLatex: "3x - 2\\arctan x + C",
    domain: [-1, 1],
    difficulty: 2,
    techniques: ["introducing-constants"],
    source: { name: "original" },
    hints: [
      "Write the numerator as \\lambda(x^2+1)+\\mu: 3x^2+1 = 3(x^2+1) - 2.",
      "The \\lambda piece integrates to a constant times x; the \\mu piece is a bare arctan form.",
    ],
    steps: [
      "\\frac{3x^2+1}{x^2+1} = 3 - \\frac{2}{x^2+1}.",
      "\\int\\left(3-\\frac{2}{x^2+1}\\right)dx = 3x - 2\\arctan x + C.",
    ],
  },
  {
    id: "ic-2x2plus3-over-x2plus4",
    kind: "indefinite",
    integrand: "\\frac{2x^2+3}{x^2+4}",
    integrandExpr: "(2*x^2+3)/(x^2+4)",
    answer: "2*x-(5/2)*atan(x/2)",
    answerLatex: "2x - \\frac{5}{2}\\arctan\\frac{x}{2} + C",
    domain: [-1, 1],
    difficulty: 3,
    techniques: ["introducing-constants"],
    source: { name: "original" },
    hints: [
      "2x^2+3 = 2(x^2+4) - 5 — same move as before, just with a scaled arctan form left over.",
      "\\int\\frac{dx}{x^2+4} = \\frac{1}{2}\\arctan\\frac{x}{2}, from the standard a^2+x^2 form.",
    ],
    steps: [
      "\\frac{2x^2+3}{x^2+4} = 2 - \\frac{5}{x^2+4}.",
      "\\int\\left(2-\\frac{5}{x^2+4}\\right)dx = 2x - 5\\cdot\\frac{1}{2}\\arctan\\frac{x}{2} + C.",
    ],
  },
  {
    id: "ic-quadratic-over-quadratic",
    kind: "indefinite",
    integrand: "\\frac{x^2+7x+8}{x^2+5x+3}",
    integrandExpr: "(x^2+7*x+8)/(x^2+5*x+3)",
    answer: "x+log(x^2+5*x+3)",
    answerLatex: "x + \\ln(x^2+5x+3) + C",
    domain: [1, 3],
    difficulty: 3,
    techniques: ["introducing-constants"],
    source: { name: "original" },
    hints: [
      "This time split against the DENOMINATOR'S DERIVATIVE, not the denominator itself: the leftover 2x+5 is exactly \\frac{d}{dx}(x^2+5x+3).",
      "x^2+7x+8 = (x^2+5x+3) + (2x+5).",
    ],
    steps: [
      "\\frac{x^2+7x+8}{x^2+5x+3} = 1 + \\frac{2x+5}{x^2+5x+3}.",
      "The second piece is a numerator-is-the-derivative log form: \\ln(x^2+5x+3).",
      "So the integral is x + \\ln(x^2+5x+3) + C.",
    ],
  },
  {
    id: "ic-trig-tsub",
    kind: "indefinite",
    integrand: "\\frac{5\\cos x+7}{2+\\cos x}",
    integrandExpr: "(5*cos(x)+7)/(2+cos(x))",
    answer: "5*x-2*sqrt(3)*atan(tan(x/2)/sqrt(3))",
    answerLatex: "5x - 2\\sqrt3\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) + C",
    domain: [-1, 1],
    difficulty: 5,
    techniques: ["introducing-constants", "t-sub"],
    source: { name: "original" },
    hints: [
      "Split off the denominator first, same as always: 5\\cos x+7 = 5(2+\\cos x) - 3.",
      "That leaves 5\\int dx - 3\\int\\frac{dx}{2+\\cos x} — and the second integral is a t-sub result you may already have.",
    ],
    steps: [
      "\\frac{5\\cos x+7}{2+\\cos x} = 5 - \\frac{3}{2+\\cos x}.",
      "\\int\\frac{dx}{2+\\cos x} = \\frac{2}{\\sqrt3}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) by the t-substitution.",
      "So the integral is 5x - 3\\cdot\\frac{2}{\\sqrt3}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) = 5x - 2\\sqrt3\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) + C.",
    ],
  },
  {
    id: "ic-one-plus-12x-over-one-plus-3x",
    kind: "indefinite",
    integrand: "\\frac{1+12x}{1+3x}",
    integrandExpr: "(1+12*x)/(1+3*x)",
    answer: "4*x-log(abs(1+3*x))",
    answerLatex: "4x-\\ln|1+3x| + C",
    domain: [0, 2],
    difficulty: 2,
    techniques: ["introducing-constants"],
    source: { name: "original" },
    hints: ["1+12x is exactly 4(1+3x) minus a constant remainder — find it before doing any division."],
    steps: [
      "1+12x = 4(1+3x)-3.",
      "\\int\\left(4-\\frac{3}{1+3x}\\right)dx = 4x-\\ln|1+3x| + C.",
    ],
  },
];
