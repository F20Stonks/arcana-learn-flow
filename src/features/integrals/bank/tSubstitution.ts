/**
 * The Weierstrass (t) substitution: t = \tan(x/2) turns any rational function of \sin x, \cos x
 * into a rational function of t. Distinct from trig-sub (bank/trigSubstitution.ts), which kills a
 * root over a quadratic — this is for rational trig expressions with no root in sight.
 */
import type { Problem } from "../types";

const BEE_TSUB = "UK University Integration Bee guide, §1.6 (The T-Substitution)";
const DERIVED_FROM_BEE_TSUB = `Derived using the Weierstrass (t) substitution from the ${BEE_TSUB}`;

export const TSubstitution: Problem[] = [
  {
    id: "tsub-definite-one-plus-sin",
    kind: "definite",
    integrand: "\\frac{1}{1+\\sin x}",
    integrandExpr: "1/(1+sin(x))",
    lower: "0",
    upper: "\\frac{\\pi}{2}",
    answer: "1",
    answerLatex: "1",
    domain: [0, Math.PI / 2],
    difficulty: 2,
    techniques: ["t-sub"],
    source: DERIVED_FROM_BEE_TSUB,
    hints: [
      "t=\\tan(x/2) turns \\sin x into \\frac{2t}{1+t^2} and dx into \\frac{2\\,dt}{1+t^2} — substitute both and 1+\\sin x becomes a perfect square over 1+t^2.",
      "Convert the bounds too: x=0 gives t=0, and x=\\frac{\\pi}{2} gives t=\\tan\\frac{\\pi}{4}=1.",
    ],
    steps: [
      "1+\\sin x = 1+\\frac{2t}{1+t^2} = \\frac{(1+t)^2}{1+t^2}, so the integrand times dx becomes \\frac{2}{(1+t)^2}\\,dt.",
      "The bounds become t=0 to t=1.",
      "\\int_0^1\\frac{2\\,dt}{(1+t)^2} = \\left[\\frac{-2}{1+t}\\right]_0^1 = -1-(-2) = 1.",
    ],
  },
  {
    id: "tsub-a-plus-cos",
    kind: "indefinite",
    integrand: "\\frac{1}{2+\\cos x}",
    integrandExpr: "1/(2+cos(x))",
    answer: "(2/sqrt(3))*atan(tan(x/2)/sqrt(3))",
    answerLatex: "\\frac{2}{\\sqrt{3}}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt{3}}\\right) + C",
    domain: [-2, 2],
    difficulty: 3,
    techniques: ["t-sub"],
    source: `${BEE_TSUB} — the dx/(a+cos x) worked example, with a=2`,
    hints: [
      "This is the guide's own \\frac{1}{a+\\cos x} example, with a=2. Substitute t=\\tan(x/2), so \\cos x=\\frac{1-t^2}{1+t^2} and dx=\\frac{2\\,dt}{1+t^2}.",
      "The denominator 2+\\cos x simplifies to \\frac{3+t^2}{1+t^2} — the (1+t^2) cancels against dx's, leaving a plain arctan integral in t.",
    ],
    steps: [
      "2+\\cos x = \\frac{2(1+t^2)+(1-t^2)}{1+t^2} = \\frac{3+t^2}{1+t^2}.",
      "So the integral becomes \\int\\frac{2\\,dt}{3+t^2} = \\frac{2}{\\sqrt3}\\arctan\\frac{t}{\\sqrt3}.",
      "Converting back with t=\\tan(x/2): \\frac{2}{\\sqrt3}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) + C.",
    ],
  },
  {
    id: "tsub-linear-combo",
    kind: "indefinite",
    integrand: "\\frac{1}{5+3\\cos x}",
    integrandExpr: "1/(5+3*cos(x))",
    answer: "(1/2)*atan(tan(x/2)/2)",
    answerLatex: "\\frac{1}{2}\\arctan\\!\\left(\\frac{\\tan(x/2)}{2}\\right) + C",
    domain: [-2, 2],
    difficulty: 4,
    techniques: ["t-sub"],
    source: DERIVED_FROM_BEE_TSUB,
    hints: [
      "Same idea as \\frac{1}{a+\\cos x}, but now \\cos x carries a coefficient. The algebra is the same shape, just with more bookkeeping.",
      "5+3\\cos x = \\frac{5(1+t^2)+3(1-t^2)}{1+t^2} = \\frac{8+2t^2}{1+t^2} = \\frac{2(4+t^2)}{1+t^2}.",
    ],
    steps: [
      "5+3\\cos x = \\frac{2(4+t^2)}{1+t^2}, so the (1+t^2) factors cancel against dx's and leave \\int\\frac{dt}{4+t^2}.",
      "\\int\\frac{dt}{4+t^2} = \\frac{1}{2}\\arctan\\frac{t}{2}.",
      "So the answer is \\frac{1}{2}\\arctan\\!\\left(\\frac{\\tan(x/2)}{2}\\right) + C.",
    ],
  },
  {
    id: "tsub-sin-plus-cos-plus-one",
    kind: "indefinite",
    integrand: "\\frac{1}{\\sin x+\\cos x+1}",
    integrandExpr: "1/(sin(x)+cos(x)+1)",
    answer: "log(abs(tan(x/2)+1))",
    answerLatex: "\\ln\\left|\\tan(x/2)+1\\right| + C",
    domain: [0.2, 1.4],
    difficulty: 4,
    techniques: ["t-sub"],
    source: DERIVED_FROM_BEE_TSUB,
    hints: [
      "With both \\sin x and \\cos x in play and no obvious identity to reach for, this is a t-sub problem: \\sin x = \\frac{2t}{1+t^2}, \\cos x = \\frac{1-t^2}{1+t^2}.",
      "Add the three pieces of the denominator over the common (1+t^2) and watch it factor.",
    ],
    steps: [
      "\\sin x+\\cos x+1 = \\frac{2t+(1-t^2)+(1+t^2)}{1+t^2} = \\frac{2t+2}{1+t^2} = \\frac{2(t+1)}{1+t^2}.",
      "Multiplying by dx=\\frac{2\\,dt}{1+t^2}, the (1+t^2) and one factor of 2 cancel, leaving \\int\\frac{dt}{t+1}.",
      "That's \\ln|t+1|, so the answer is \\ln\\left|\\tan(x/2)+1\\right| + C.",
    ],
  },
  {
    id: "tsub-perfect-square",
    kind: "indefinite",
    integrand: "\\frac{1}{3\\sin x-4\\cos x+5}",
    integrandExpr: "1/(3*sin(x)-4*cos(x)+5)",
    answer: "-2/(3*(3*tan(x/2)+1))",
    answerLatex: "-\\frac{2}{3\\left(3\\tan(x/2)+1\\right)} + C",
    domain: [0.2, 1.5],
    difficulty: 5,
    techniques: ["t-sub"],
    source: DERIVED_FROM_BEE_TSUB,
    hints: [
      "The coefficients 3, 4, 5 are not an accident — with a\\sin x+b\\cos x+c where c=\\sqrt{a^2+b^2}, the t-sub denominator collapses to a perfect square.",
      "Write out 3\\sin x-4\\cos x+5 in terms of t and simplify the numerator before doing anything else.",
    ],
    steps: [
      "3\\sin x-4\\cos x+5 = \\frac{6t-4(1-t^2)+5(1+t^2)}{1+t^2} = \\frac{9t^2+6t+1}{1+t^2} = \\frac{(3t+1)^2}{1+t^2}.",
      "Multiplying by dx=\\frac{2\\,dt}{1+t^2}, the integral becomes \\int\\frac{2\\,dt}{(3t+1)^2}.",
      "= -\\frac{2}{3(3t+1)} + C, so the answer is -\\frac{2}{3\\left(3\\tan(x/2)+1\\right)} + C.",
    ],
  },
];
