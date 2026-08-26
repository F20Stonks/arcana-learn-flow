/**
 * Reduction (recurrence) formulas: integrate by parts once in general n, get the same family back
 * at a lower power, and walk the recurrence down to a base case. Three flavors here, all from the
 * UK University Integration Bee guide's "Recurrence relations" section (\S1.3) and its SPLASH 2011
 * counterpart — trig powers (parts, drops by 2), x^n e^{\pm x} (parts, drops by 1), and x^n/(1+x)
 * (pure algebra: add I_n and I_{n-1}, no parts at all).
 *
 * Both sources' own worked example for x^ne^{-x} takes it to \int_0^\infty x^ne^{-x}dx = n!, and the
 * guide's own \sin^n x example is improper-adjacent only in spirit (it's really on [0,\pi], not
 * infinite) — but the n! result specifically is Gamma-function territory, which is deliberately out
 * of scope until the quadrature self-check handles infinite domains. So every problem here either
 * stays on a finite antiderivative (the x^ne^{\pm x} family) or mirrors the guide's own finite [0,\pi]
 * \sin^n x computation.
 */
import type { Problem } from "../types";

const BEE_RECURRENCE = "UK University Integration Bee guide, §1.3 (Recurrence relations)";
const BEE_RECURRENCE_ADAPTED =
  "UK University Integration Bee guide, §1.3 (Recurrence relations) — reduction formula for ∫xⁿe⁻ˣdx, kept to a finite antiderivative rather than the improper n! result";
const SPLASH_SOURCE =
  "SPLASH 2011 advanced integration lecture (§2, exercise 4) — the xⁿeˣ reduction formula, mirrored for positive exponent";

export const Reduction: Problem[] = [
  {
    id: "reduction-x-over-one-plus-x-2",
    kind: "definite",
    integrand: "\\frac{x^2}{1+x}",
    integrandExpr: "x^2/(1+x)",
    lower: "0",
    upper: "1",
    answer: "log(2) - 1/2",
    answerLatex: "\\ln 2 - \\frac{1}{2}",
    domain: [0, 1],
    difficulty: 2,
    techniques: ["reduction"],
    source: BEE_RECURRENCE,
    hints: [
      "No parts needed here — the recurrence is pure algebra. Adding I_n = \\int_0^1\\frac{x^n}{1+x}dx and I_{n-1} gives \\int_0^1 x^{n-1}\\,dx = \\frac{1}{n}.",
      "So I_n = \\frac{1}{n} - I_{n-1}. You need I_1 = \\int_0^1\\frac{x}{1+x}dx = 1-\\ln 2 as the base case one step down.",
    ],
    steps: [
      "I_n + I_{n-1} = \\int_0^1\\frac{x^n+x^{n-1}}{1+x}dx = \\int_0^1 x^{n-1}(\\text{since }x^n+x^{n-1}=x^{n-1}(1+x))\\,dx = \\frac{1}{n}.",
      "I_1 = \\int_0^1\\frac{x}{1+x}dx = \\int_0^1\\left(1-\\frac{1}{1+x}\\right)dx = 1-\\ln 2 (the \"add 1, take away 1\" trick).",
      "I_2 = \\frac{1}{2} - I_1 = \\frac{1}{2} - (1-\\ln 2) = \\ln 2 - \\frac{1}{2}.",
    ],
  },
  {
    id: "reduction-x-over-one-plus-x-3",
    kind: "definite",
    integrand: "\\frac{x^3}{1+x}",
    integrandExpr: "x^3/(1+x)",
    lower: "0",
    upper: "1",
    answer: "5/6 - log(2)",
    answerLatex: "\\frac{5}{6} - \\ln 2",
    domain: [0, 1],
    difficulty: 3,
    techniques: ["reduction"],
    source: BEE_RECURRENCE,
    hints: [
      "One more link in the same chain as I_2 = \\int_0^1\\frac{x^2}{1+x}dx: I_3 = \\frac{1}{3} - I_2.",
      "You already have I_2 = \\ln 2 - \\frac{1}{2} from that problem.",
    ],
    steps: [
      "The same algebra gives I_3 + I_2 = \\int_0^1 x^2\\,dx = \\frac{1}{3}.",
      "I_2 = \\ln 2 - \\frac{1}{2} (the n=2 case).",
      "I_3 = \\frac{1}{3} - I_2 = \\frac{1}{3} - \\ln 2 + \\frac{1}{2} = \\frac{5}{6} - \\ln 2.",
    ],
  },
  {
    id: "reduction-sin3",
    kind: "indefinite",
    integrand: "\\sin^3 x",
    integrandExpr: "sin(x)^3",
    answer: "-cos(x) + cos(x)^3/3",
    answerLatex: "-\\cos x + \\frac{\\cos^3 x}{3} + C",
    domain: [0.2, 2.8],
    difficulty: 2,
    techniques: ["reduction"],
    source: `Derived using the \\sin^n x reduction formula from the ${BEE_RECURRENCE}`,
    hints: [
      "You could peel off one \\sin x and substitute u=\\cos x directly, but this is also just one link of the general recurrence I_n = -\\frac{\\sin^{n-1}x\\cos x}{n} + \\frac{n-1}{n}I_{n-2}, with n=3.",
      "The base case one step down is I_1 = \\int\\sin x\\,dx = -\\cos x.",
    ],
    steps: [
      "With n=3: I_3 = -\\frac{\\sin^2x\\cos x}{3} + \\frac{2}{3}I_1.",
      "I_1 = -\\cos x, and \\sin^2x = 1-\\cos^2x turns the first term into -\\frac{\\cos x}{3} + \\frac{\\cos^3x}{3}.",
      "Together: I_3 = -\\frac{\\cos x}{3} + \\frac{\\cos^3x}{3} - \\frac{2\\cos x}{3} = -\\cos x + \\frac{\\cos^3x}{3} + C.",
    ],
  },
  {
    id: "reduction-sin5",
    kind: "indefinite",
    integrand: "\\sin^5 x",
    integrandExpr: "sin(x)^5",
    answer: "-sin(x)^4*cos(x)/5 - 4*cos(x)/5 + 4*cos(x)^3/15",
    answerLatex: "-\\frac{\\sin^4 x\\cos x}{5} - \\frac{4\\cos x}{5} + \\frac{4\\cos^3 x}{15} + C",
    domain: [0.2, 2.8],
    difficulty: 4,
    techniques: ["reduction"],
    source: `Derived using the \\sin^n x reduction formula from the ${BEE_RECURRENCE}`,
    hints: [
      "n=5 is odd, so you could peel a factor and substitute u=\\cos x instead — but the same reduction formula works for odd n too.",
      "The base case one step down is I_3 = \\int\\sin^3x\\,dx = -\\cos x + \\frac{\\cos^3x}{3}.",
    ],
    steps: [
      "I_5 = -\\frac{\\sin^4x\\cos x}{5} + \\frac{4}{5}I_3.",
      "I_3 = -\\cos x + \\frac{\\cos^3x}{3} (either from the same reduction formula at n=3, or by peeling one factor directly).",
      "\\frac{4}{5}I_3 = -\\frac{4\\cos x}{5} + \\frac{4\\cos^3x}{15}.",
      "So I_5 = -\\frac{\\sin^4x\\cos x}{5} - \\frac{4\\cos x}{5} + \\frac{4\\cos^3x}{15} + C.",
    ],
  },
  {
    id: "reduction-sin6",
    kind: "indefinite",
    integrand: "\\sin^6 x",
    integrandExpr: "sin(x)^6",
    answer: "-sin(x)^5*cos(x)/6 - 5*sin(x)^3*cos(x)/24 + 5*x/16 - 5*sin(x)*cos(x)/16",
    answerLatex:
      "-\\frac{\\sin^5 x\\cos x}{6} - \\frac{5\\sin^3 x\\cos x}{24} + \\frac{5x}{16} - \\frac{5\\sin x\\cos x}{16} + C",
    domain: [0.2, 2.8],
    difficulty: 5,
    techniques: ["reduction"],
    source: `Derived using the \\sin^n x reduction formula from the ${BEE_RECURRENCE}`,
    hints: [
      "This is two steps of the recurrence: n=6 needs I_4, and you already have I_4 from a lower-difficulty problem in this same technique.",
      "Substitute the whole I_4 expression in for I_4 and simplify the fractions — nothing new to derive, just bookkeeping.",
    ],
    steps: [
      "I_6 = -\\frac{\\sin^5x\\cos x}{6} + \\frac{5}{6}I_4.",
      "I_4 = -\\frac{\\sin^3x\\cos x}{4} + \\frac{3x}{8} - \\frac{3\\sin x\\cos x}{8} (the n=4 case).",
      "\\frac{5}{6}I_4 = -\\frac{5\\sin^3x\\cos x}{24} + \\frac{5x}{16} - \\frac{5\\sin x\\cos x}{16}.",
      "So I_6 = -\\frac{\\sin^5x\\cos x}{6} - \\frac{5\\sin^3x\\cos x}{24} + \\frac{5x}{16} - \\frac{5\\sin x\\cos x}{16} + C.",
    ],
  },
  {
    id: "reduction-wallis-sin4",
    kind: "definite",
    integrand: "\\sin^4 x",
    integrandExpr: "sin(x)^4",
    lower: "0",
    upper: "\\pi",
    answer: "3*pi/8",
    answerLatex: "\\frac{3\\pi}{8}",
    domain: [0, Math.PI],
    difficulty: 3,
    techniques: ["reduction"],
    source: `${BEE_RECURRENCE} — the \\int_0^\\pi\\sin^nx\\,dx worked example`,
    hints: [
      "You don't need the antiderivative at all on this interval — the boundary term \\cos(x)\\sin^{n-1}(x) in the reduction formula is 0 at both x=0 and x=\\pi, for every n.",
      "So the recurrence reduces to a pure number: I_n = \\frac{n-1}{n}I_{n-2}, with base cases I_0=\\pi and I_1=2.",
    ],
    steps: [
      "On [0,\\pi], the boundary term of the reduction formula vanishes at both ends for every n, so I_n = \\frac{n-1}{n}I_{n-2} with I_0=\\pi, I_1=2.",
      "I_2 = \\frac{1}{2}I_0 = \\frac{\\pi}{2}.",
      "I_4 = \\frac{3}{4}I_2 = \\frac{3}{4}\\cdot\\frac{\\pi}{2} = \\frac{3\\pi}{8}.",
    ],
  },
  {
    id: "reduction-wallis-sin5",
    kind: "definite",
    integrand: "\\sin^5 x",
    integrandExpr: "sin(x)^5",
    lower: "0",
    upper: "\\pi",
    answer: "16/15",
    answerLatex: "\\frac{16}{15}",
    domain: [0, Math.PI],
    difficulty: 4,
    techniques: ["reduction"],
    source: `${BEE_RECURRENCE} — the \\int_0^\\pi\\sin^nx\\,dx worked example`,
    hints: [
      "Same collapsing boundary term as the even case — the recurrence I_n = \\frac{n-1}{n}I_{n-2} holds regardless of parity.",
      "The odd chain bottoms out at I_1 = \\int_0^\\pi\\sin x\\,dx = 2, not at I_0.",
    ],
    steps: [
      "I_n = \\frac{n-1}{n}I_{n-2} still applies; for odd n the chain ends at I_1 = 2.",
      "I_3 = \\frac{2}{3}I_1 = \\frac{2}{3}\\cdot 2 = \\frac{4}{3}.",
      "I_5 = \\frac{4}{5}I_3 = \\frac{4}{5}\\cdot\\frac{4}{3} = \\frac{16}{15}.",
    ],
  },
  {
    id: "reduction-wallis-sin6",
    kind: "definite",
    integrand: "\\sin^6 x",
    integrandExpr: "sin(x)^6",
    lower: "0",
    upper: "\\pi",
    answer: "5*pi/16",
    answerLatex: "\\frac{5\\pi}{16}",
    domain: [0, Math.PI],
    difficulty: 5,
    techniques: ["reduction"],
    source: `${BEE_RECURRENCE} — the \\int_0^\\pi\\sin^nx\\,dx worked example`,
    hints: [
      "Three links of the same even chain: I_0 \\to I_2 \\to I_4 \\to I_6.",
      "Each step multiplies by \\frac{n-1}{n} — you did the first two links in the n=4 version of this problem.",
    ],
    steps: [
      "I_0 = \\pi, I_2 = \\frac{1}{2}I_0 = \\frac{\\pi}{2}, I_4 = \\frac{3}{4}I_2 = \\frac{3\\pi}{8}.",
      "I_6 = \\frac{5}{6}I_4 = \\frac{5}{6}\\cdot\\frac{3\\pi}{8}.",
      "= \\frac{15\\pi}{48} = \\frac{5\\pi}{16}.",
    ],
  },
  {
    id: "reduction-x3-exp",
    kind: "indefinite",
    integrand: "x^3 e^{x}",
    integrandExpr: "x^3*e^x",
    answer: "(x^3-3*x^2+6*x-6)*e^x",
    answerLatex: "(x^3-3x^2+6x-6)e^{x} + C",
    domain: [-1, 2],
    difficulty: 4,
    techniques: ["reduction"],
    source: SPLASH_SOURCE,
    hints: [
      "Three rounds of parts by hand is tedious — instead use the recurrence J_n = x^ne^x - nJ_{n-1} once, in general n.",
      "You already know J_1 = (x-1)e^x and J_2 = (x^2-2x+2)e^x from ordinary parts practice — J_3 is one more link.",
    ],
    steps: [
      "Parts with u=x^n, dv=e^x\\,dx gives J_n = x^ne^x - nJ_{n-1}.",
      "J_2 = (x^2-2x+2)e^x, so J_3 = x^3e^x - 3J_2 = x^3e^x - 3(x^2-2x+2)e^x.",
      "= (x^3-3x^2+6x-6)e^x + C.",
    ],
  },
  {
    id: "reduction-x3-exp-negative",
    kind: "indefinite",
    integrand: "x^3 e^{-x}",
    integrandExpr: "x^3*e^(-x)",
    answer: "-(x^3+3*x^2+6*x+6)*e^(-x)",
    answerLatex: "-(x^3+3x^2+6x+6)e^{-x} + C",
    domain: [-1, 2],
    difficulty: 4,
    techniques: ["reduction"],
    source: BEE_RECURRENCE_ADAPTED,
    hints: [
      "Same recurrence as x^ne^x, but every integration of e^{-x} flips a sign: J_n = -x^ne^{-x} + nJ_{n-1}.",
      "J_2 = -(x^2+2x+2)e^{-x} is the standard-parts result one step down.",
    ],
    steps: [
      "Parts with u=x^n, dv=e^{-x}dx, v=-e^{-x} gives J_n = -x^ne^{-x} + nJ_{n-1}.",
      "J_2 = -(x^2+2x+2)e^{-x}, so J_3 = -x^3e^{-x} + 3J_2 = -x^3e^{-x} - 3(x^2+2x+2)e^{-x}.",
      "= -(x^3+3x^2+6x+6)e^{-x} + C.",
    ],
  },
  {
    id: "reduction-x4-exp-negative",
    kind: "indefinite",
    integrand: "x^4 e^{-x}",
    integrandExpr: "x^4*e^(-x)",
    answer: "-(x^4+4*x^3+12*x^2+24*x+24)*e^(-x)",
    answerLatex: "-(x^4+4x^3+12x^2+24x+24)e^{-x} + C",
    domain: [-1, 2],
    difficulty: 5,
    techniques: ["reduction"],
    source: BEE_RECURRENCE_ADAPTED,
    hints: [
      "One more link in the same chain: J_4 = -x^4e^{-x} + 4J_3, and you already built J_3 in the previous problem.",
      "The guide's own version of this recurrence runs all the way to \\int_0^\\infty x^ne^{-x}dx = n! — that limit is improper and stays out of scope here.",
    ],
    steps: [
      "J_4 = -x^4e^{-x} + 4J_3.",
      "J_3 = -(x^3+3x^2+6x+6)e^{-x}, so 4J_3 = -4(x^3+3x^2+6x+6)e^{-x}.",
      "Together: -x^4e^{-x} - 4(x^3+3x^2+6x+6)e^{-x} = -(x^4+4x^3+12x^2+24x+24)e^{-x} + C.",
    ],
  },
  {
    id: "reduction-x3-exp-negative-definite",
    kind: "definite",
    integrand: "x^3 e^{-x}",
    integrandExpr: "x^3*e^(-x)",
    lower: "0",
    upper: "2",
    answer: "6 - 38*e^(-2)",
    answerLatex: "6 - 38e^{-2}",
    domain: [0, 2],
    difficulty: 4,
    techniques: ["reduction"],
    source: BEE_RECURRENCE_ADAPTED,
    hints: [
      "Build the antiderivative with the reduction formula first, exactly as in the indefinite version of this problem, then just evaluate it at the two ends.",
      "At x=0 every term except the constant 6 in -(x^3+3x^2+6x+6)e^{-x} vanishes.",
    ],
    steps: [
      "The antiderivative is J_3(x) = -(x^3+3x^2+6x+6)e^{-x} (built by reduction, as in the indefinite version).",
      "J_3(2) = -(8+12+12+6)e^{-2} = -38e^{-2}.",
      "J_3(0) = -(0+0+0+6) = -6.",
      "So the value is J_3(2) - J_3(0) = -38e^{-2} - (-6) = 6 - 38e^{-2}.",
    ],
  },
];
