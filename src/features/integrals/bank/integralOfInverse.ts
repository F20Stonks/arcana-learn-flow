/**
 * Integral of inverse: \int_a^b f + \int_{f(a)}^{f(b)} f^{-1} = bf(b) - af(a), for f injective on
 * [a,b]. Every problem here is definite — the identity hands you a number, not an antiderivative of
 * f^{-1} — and the "integrand" shown to the student is f^{-1} itself, the thing they'd struggle to
 * integrate directly.
 *
 * The Lambert W problem needs lambertw(x) to actually evaluate for the bank's self-check quadrature
 * to run — see mathInstance.ts, which extends mathjs with it since the library doesn't ship one.
 */
import type { Problem } from "../types";

const BEE_INVERSE = "UK University Integration Bee guide, §1.5 (Integral of Inverse)";
const DERIVED_FROM_BEE_INVERSE = `Derived using the Integral of Inverse identity from the ${BEE_INVERSE}`;

export const IntegralOfInverse: Problem[] = [
  {
    id: "inverse-cube-root",
    kind: "definite",
    integrand: "\\sqrt[3]{x}",
    integrandExpr: "cbrt(x)",
    lower: "0",
    upper: "8",
    answer: "12",
    answerLatex: "12",
    domain: [0, 8],
    difficulty: 2,
    techniques: ["integral-of-inverse"],
    source: DERIVED_FROM_BEE_INVERSE,
    hints: [
      "You could integrate \\sqrt[3]{x} directly — but as a first look at the identity, notice it's the inverse of f(x)=x^3, and use \\int_a^b f + \\int_{f(a)}^{f(b)} f^{-1} = bf(b)-af(a) with a=0,\\ b=2 instead.",
      "f(0)=0 and f(2)=8, which is exactly where this integral's bounds come from.",
    ],
    steps: [
      "f(x)=x^3 is injective and increasing on [0,2], with f(0)=0,\\ f(2)=8.",
      "\\int_0^2 x^3\\,dx = 4.",
      "The identity: 4 + \\int_0^8 \\sqrt[3]{x}\\,dx = 2\\cdot 8 - 0 = 16.",
      "So \\int_0^8\\sqrt[3]{x}\\,dx = 16-4 = 12 — matching the direct computation \\left[\\tfrac{3}{4}x^{4/3}\\right]_0^8 = 12.",
    ],
  },
  {
    id: "inverse-log-one-plus-x",
    kind: "definite",
    integrand: "\\ln(1+x)",
    integrandExpr: "log(1+x)",
    lower: "0",
    upper: "1",
    answer: "2*log(2) - 1",
    answerLatex: "2\\ln 2 - 1",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["integral-of-inverse"],
    source: DERIVED_FROM_BEE_INVERSE,
    hints: [
      "\\ln(1+x) is the inverse of f(x)=e^x-1. Apply the identity with a=0,\\ b=\\ln 2, so that f(b)=1 — exactly this integral's upper bound.",
      "The companion integral \\int_0^{\\ln 2}(e^x-1)\\,dx is elementary.",
    ],
    steps: [
      "f(x)=e^x-1 is injective and increasing, with f(0)=0 and f(\\ln 2) = 2-1 = 1.",
      "\\int_0^{\\ln 2}(e^x-1)\\,dx = \\left[e^x-x\\right]_0^{\\ln 2} = (2-\\ln 2) - 1 = 1-\\ln 2.",
      "The identity with a=0,\\ b=\\ln 2: (1-\\ln 2) + \\int_0^1\\ln(1+x)\\,dx = \\ln 2\\cdot 1 - 0 = \\ln 2.",
      "So \\int_0^1\\ln(1+x)\\,dx = \\ln 2 - (1-\\ln 2) = 2\\ln 2 - 1.",
    ],
  },
  {
    id: "inverse-quadratic-formula",
    kind: "definite",
    integrand: "\\frac{\\sqrt{1+4x}-1}{2}",
    integrandExpr: "(sqrt(1+4*x)-1)/2",
    lower: "0",
    upper: "2",
    answer: "7/6",
    answerLatex: "\\frac{7}{6}",
    domain: [0, 2],
    difficulty: 4,
    techniques: ["integral-of-inverse"],
    source: DERIVED_FROM_BEE_INVERSE,
    hints: [
      "This integrand is the quadratic formula in disguise — it's f^{-1} for f(x)=x^2+x, since solving y=x^2+x for x (taking the positive root) gives x=\\frac{\\sqrt{1+4y}-1}{2}.",
      "f(0)=0 and f(1)=2, which is exactly where this integral's bounds come from.",
    ],
    steps: [
      "f(x)=x^2+x is injective and increasing for x\\geq 0, with f(0)=0,\\ f(1)=2.",
      "\\int_0^1(x^2+x)\\,dx = \\frac{1}{3}+\\frac{1}{2} = \\frac{5}{6}.",
      "The identity with a=0,\\ b=1: \\frac{5}{6} + \\int_0^2 f^{-1}(x)\\,dx = 1\\cdot 2 - 0 = 2.",
      "So \\int_0^2\\frac{\\sqrt{1+4x}-1}{2}\\,dx = 2-\\frac{5}{6} = \\frac{7}{6}.",
    ],
  },
  {
    id: "inverse-log-base-two",
    kind: "definite",
    integrand: "\\log_2 x",
    integrandExpr: "log2(x)",
    lower: "2",
    upper: "8",
    answer: "22 - 6/log(2)",
    answerLatex: "22 - \\frac{6}{\\ln 2}",
    domain: [2, 8],
    difficulty: 4,
    techniques: ["integral-of-inverse"],
    source: DERIVED_FROM_BEE_INVERSE,
    hints: [
      "\\log_2 x is the inverse of f(x)=2^x. This time try a and b away from 0 — a=1,\\ b=3 gives f(1)=2 and f(3)=8, exactly this integral's bounds.",
      "The identity works for any injective f on any interval, not just intervals starting at the origin — af(a) doesn't vanish here.",
    ],
    steps: [
      "f(x)=2^x is injective and increasing, with f(1)=2 and f(3)=8.",
      "\\int_1^3 2^x\\,dx = \\left[\\frac{2^x}{\\ln 2}\\right]_1^3 = \\frac{8-2}{\\ln 2} = \\frac{6}{\\ln 2}.",
      "The identity with a=1,\\ b=3: \\frac{6}{\\ln 2} + \\int_2^8\\log_2 x\\,dx = 3\\cdot 8 - 1\\cdot 2 = 22.",
      "So \\int_2^8\\log_2 x\\,dx = 22 - \\frac{6}{\\ln 2}.",
    ],
  },
  {
    id: "inverse-lambert-w",
    kind: "definite",
    integrand: "W(x)",
    integrandExpr: "lambertw(x)",
    lower: "0",
    upper: "e",
    answer: "e-1",
    answerLatex: "e - 1",
    domain: [0, Math.E],
    difficulty: 5,
    techniques: ["integral-of-inverse"],
    source: `${BEE_INVERSE} — the Lambert W worked example`,
    hints: [
      "W(x), the Lambert W function, is defined as the inverse of f(x)=xe^x — there's no elementary formula for it, so integrating it directly is a dead end.",
      "But f itself integrates easily by parts. Apply the identity with a=0,\\ b=1, since f(1)=e is exactly this integral's upper bound.",
    ],
    steps: [
      "f(x)=xe^x is injective and increasing on [0,1] (check: f'(x)=(x+1)e^x>0 there), with f(0)=0 and f(1)=e.",
      "\\int_0^1 xe^x\\,dx = \\left[xe^x-e^x\\right]_0^1 = (e-e)-(0-1) = 1, by parts.",
      "The identity with a=0,\\ b=1: 1 + \\int_0^e W(x)\\,dx = 1\\cdot e - 0\\cdot e^0 = e.",
      "So \\int_0^e W(x)\\,dx = e - 1.",
    ],
  },
];
