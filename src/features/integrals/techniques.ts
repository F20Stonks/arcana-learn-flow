/**
 * The training curriculum.
 *
 * Students rarely fail an integral because they can't execute a substitution. They fail because
 * they don't know which of eight things to reach for. So every technique here leads with
 * `whenToUse` — the recognition cue — and only then gives the recipe.
 */
import type { Technique, TechniqueId } from "./types";

export const TECHNIQUES: Technique[] = [
  {
    id: "power",
    name: "Standard forms",
    tagline: "The dozen antiderivatives you must know cold.",
    whenToUse:
      "The integrand already is a standard form, or becomes one after you expand a bracket, split a fraction, or cancel. Always spend five seconds looking for this before anything clever.",
    recipe: [
      "Expand products and split sums — \\int is linear, so break it up.",
      "Divide out: \\frac{x^4+2x^2+1}{x} is three power terms, not a quotient.",
      "Apply \\int x^n\\,dx = \\frac{x^{n+1}}{n+1} for n \\neq -1, and \\int \\frac{dx}{x} = \\ln|x| for n = -1.",
      "Recognise the six reflex forms: e^x,\\ \\sin,\\ \\cos,\\ \\sec^2,\\ \\frac{1}{1+x^2},\\ \\frac{1}{\\sqrt{1-x^2}}.",
    ],
    example: {
      integrand: "\\frac{(x^2+1)^2}{x}",
      work: [
        "Expand the numerator: (x^2+1)^2 = x^4 + 2x^2 + 1.",
        "Divide each term by x: x^3 + 2x + \\frac{1}{x}.",
        "Integrate termwise.",
      ],
      result: "\\frac{x^4}{4} + x^2 + \\ln|x| + C",
    },
    pitfalls: [
      "n = -1 is the exception — \\frac{x^0}{0} is not a thing.",
      "\\int \\frac{dx}{x} is \\ln|x|, with the bars. Dropping them loses half the domain.",
    ],
  },
  {
    id: "u-sub",
    name: "Substitution",
    tagline: "Undo the chain rule: spot an inside function and its derivative.",
    whenToUse:
      "You can see some inner function u = g(x) whose derivative g'(x) is also sitting in the integrand, up to a constant. Composite functions — anything raised to a power, inside a root, inside e^{\\,\\cdot}, inside \\ln, inside a trig function — are the tell.",
    recipe: [
      "Name the inside function u = g(x).",
      "Differentiate: du = g'(x)\\,dx.",
      "Rewrite the whole integrand in u. If any x survives, the substitution was wrong.",
      "Integrate in u, then put g(x) back.",
    ],
    example: {
      integrand: "\\frac{x}{x^2+1}",
      work: [
        "Inside function: u = x^2+1, so du = 2x\\,dx, giving x\\,dx = \\tfrac{1}{2}\\,du.",
        "The integral becomes \\tfrac{1}{2}\\int \\frac{du}{u}.",
        "That is \\tfrac{1}{2}\\ln|u|.",
      ],
      result: "\\tfrac{1}{2}\\ln(x^2+1) + C",
    },
    pitfalls: [
      "Constants are free, variables are not: you may pull \\tfrac{1}{2} out, never an x.",
      "For a definite integral, change the limits too — or convert back before substituting them.",
    ],
  },
  {
    id: "parts",
    name: "Integration by parts",
    tagline: "For products where one factor gets simpler when differentiated.",
    whenToUse:
      "A product of two unlike things: polynomial × exponential, polynomial × trig, or a lone \\ln x / \\arctan x / \\arcsin x (take dv = dx). Substitution fails because the second factor isn't the first one's derivative.",
    recipe: [
      "\\int u\\,dv = uv - \\int v\\,du.",
      "Pick u by LIATE — Log, Inverse trig, Algebraic, Trig, Exponential — first match wins.",
      "Differentiate u, integrate dv, assemble.",
      "If the new integral is worse, you chose u backwards. If it's the same integral, you're in a loop — solve for it algebraically.",
    ],
    example: {
      integrand: "x e^{x}",
      work: [
        "LIATE picks the algebraic factor: u = x, dv = e^x dx.",
        "So du = dx and v = e^x.",
        "uv - \\int v\\,du = x e^x - \\int e^x\\,dx.",
      ],
      result: "(x-1)e^{x} + C",
    },
    pitfalls: [
      "\\int \\ln x\\,dx is a parts problem: u = \\ln x, dv = dx.",
      "The loop case (\\int e^x \\sin x\\,dx) is not a dead end — apply parts twice, then move the copy of I to the left.",
    ],
  },
  {
    id: "trig-identity",
    name: "Trig identities",
    tagline: "Rewrite powers and products until a substitution appears.",
    whenToUse:
      "Powers of sine and cosine, powers of tan and sec, or products like \\sin 3x \\cos 5x. Nothing substitutes yet — you have to reshape the integrand first.",
    recipe: [
      "Odd power of \\sin or \\cos: peel off one factor for du and convert the rest with \\sin^2 + \\cos^2 = 1.",
      "All powers even: drop the degree with \\sin^2\\theta = \\tfrac{1-\\cos 2\\theta}{2} and \\cos^2\\theta = \\tfrac{1+\\cos 2\\theta}{2}.",
      "Tan/sec: use \\tan^2 = \\sec^2 - 1, and remember \\tfrac{d}{dx}\\sec x = \\sec x \\tan x.",
      "Different frequencies: product-to-sum, \\sin A \\cos B = \\tfrac{1}{2}[\\sin(A+B) + \\sin(A-B)].",
    ],
    example: {
      integrand: "\\cos^3 x",
      work: [
        "The power is odd — peel one cosine off: \\cos^2 x \\cdot \\cos x.",
        "Convert the even part: (1 - \\sin^2 x)\\cos x.",
        "Now u = \\sin x, du = \\cos x\\,dx, leaving \\int (1-u^2)\\,du.",
      ],
      result: "\\sin x - \\tfrac{\\sin^3 x}{3} + C",
    },
    pitfalls: [
      "Halving the degree doubles the angle — \\int \\sin^2 x\\,dx = \\tfrac{x}{2} - \\tfrac{\\sin 2x}{4}, and that 4 catches everyone.",
      "\\int \\sec x\\,dx is a memorised trick (multiply by \\tfrac{\\sec x + \\tan x}{\\sec x + \\tan x}), not something you'll derive under time pressure.",
    ],
  },
  {
    id: "trig-sub",
    name: "Trigonometric substitution",
    tagline: "Kill a root over a quadratic by making the Pythagorean identity do the work.",
    whenToUse:
      "You see \\sqrt{a^2-x^2}, \\sqrt{a^2+x^2} or \\sqrt{x^2-a^2} — or those same quadratics raised to a half-integer power — and no inner derivative is available for a plain substitution.",
    recipe: [
      "\\sqrt{a^2-x^2}: put x = a\\sin\\theta, so the root becomes a\\cos\\theta.",
      "\\sqrt{a^2+x^2}: put x = a\\tan\\theta, so the root becomes a\\sec\\theta.",
      "\\sqrt{x^2-a^2}: put x = a\\sec\\theta, so the root becomes a\\tan\\theta.",
      "Integrate in \\theta, then draw the right triangle to convert every \\theta back into x.",
    ],
    example: {
      integrand: "\\sqrt{1-x^2}",
      work: [
        "x = \\sin\\theta gives dx = \\cos\\theta\\,d\\theta and \\sqrt{1-x^2} = \\cos\\theta.",
        "The integral becomes \\int \\cos^2\\theta\\,d\\theta = \\tfrac{\\theta}{2} + \\tfrac{\\sin 2\\theta}{4}.",
        "Back-substitute with \\theta = \\arcsin x and \\sin 2\\theta = 2x\\sqrt{1-x^2}.",
      ],
      result: "\\tfrac{1}{2}\\left(x\\sqrt{1-x^2} + \\arcsin x\\right) + C",
    },
    pitfalls: [
      "Always convert back to x. An answer in \\theta is an unfinished answer.",
      "Check first whether a plain u-substitution works — \\int \\tfrac{x\\,dx}{\\sqrt{1-x^2}} needs no triangle at all.",
    ],
  },
  {
    id: "partial-fractions",
    name: "Partial fractions",
    tagline: "Split one hard rational function into several easy ones.",
    whenToUse:
      "A ratio of polynomials whose denominator factors, and whose numerator is not (a multiple of) the denominator's derivative.",
    recipe: [
      "If \\deg(\\text{top}) \\geq \\deg(\\text{bottom}), divide first.",
      "Factor the denominator completely.",
      "Write one term per factor: \\tfrac{A}{x-a}, plus \\tfrac{B}{(x-a)^2} for repeated roots, and \\tfrac{Bx+C}{x^2+bx+c} for irreducible quadratics.",
      "Clear denominators and solve for the constants — substituting the roots is fastest.",
      "Integrate each piece: linear factors give logs, irreducible quadratics give a log plus an arctan.",
    ],
    example: {
      integrand: "\\frac{1}{x(x+1)}",
      work: [
        "\\tfrac{1}{x(x+1)} = \\tfrac{A}{x} + \\tfrac{B}{x+1} means A(x+1) + Bx = 1.",
        "x = 0 gives A = 1; x = -1 gives B = -1.",
        "So the integral is \\int \\tfrac{dx}{x} - \\int \\tfrac{dx}{x+1}.",
      ],
      result: "\\ln\\left|\\frac{x}{x+1}\\right| + C",
    },
    pitfalls: [
      "Skipping the division step when the top has the higher degree — you'll get constants that don't solve.",
      "A repeated factor (x-a)^2 needs both \\tfrac{A}{x-a} and \\tfrac{B}{(x-a)^2}.",
    ],
  },
  {
    id: "complete-square",
    name: "Completing the square",
    tagline: "Turn any quadratic into u^2 \\pm a^2 and reduce to a known form.",
    whenToUse:
      "A quadratic in the denominator (or under a root) that does not factor nicely — x^2+2x+5, x^2+4x+13. The result is almost always an arctan, a log, or an arcsin.",
    recipe: [
      "Write x^2 + bx + c as \\left(x + \\tfrac{b}{2}\\right)^2 + \\left(c - \\tfrac{b^2}{4}\\right).",
      "Substitute u = x + \\tfrac{b}{2}, so du = dx.",
      "If the numerator has an x, split it first: write it as \\lambda \\cdot (\\text{derivative of the quadratic}) + \\mu.",
      "The \\lambda part is a log by substitution; the \\mu part is the arctan or arcsin standard form.",
    ],
    example: {
      integrand: "\\frac{1}{x^2+2x+5}",
      work: [
        "x^2+2x+5 = (x+1)^2 + 4.",
        "With u = x+1 this is \\int \\tfrac{du}{u^2+2^2}.",
        "Standard form: \\tfrac{1}{a}\\arctan\\tfrac{u}{a} with a = 2.",
      ],
      result: "\\tfrac{1}{2}\\arctan\\!\\left(\\frac{x+1}{2}\\right) + C",
    },
    pitfalls: [
      "Forgetting the \\tfrac{1}{a} out front of the arctan.",
      "A numerator containing x is not optional extra work — split it before you complete the square.",
    ],
  },
  {
    id: "symmetry",
    name: "Symmetry and definite tricks",
    tagline: "Sometimes the fastest antiderivative is no antiderivative.",
    whenToUse:
      "A definite integral over a symmetric interval, or over [0, \\tfrac{\\pi}{2}] / [0, \\pi] where the integrand rearranges into itself. Reach for this when the antiderivative looks impossible — that's usually the hint.",
    recipe: [
      "Odd integrand on [-a, a]: the answer is 0, no work required.",
      "Even integrand on [-a, a]: use 2\\int_0^a.",
      "King's rule: \\int_0^a f(x)\\,dx = \\int_0^a f(a-x)\\,dx. Add the two and watch the integrand collapse.",
      "On [0, \\pi], \\sin(\\pi - x) = \\sin x while \\cos(\\pi-x) = -\\cos x — that asymmetry is what the trick exploits.",
    ],
    example: {
      integrand: "\\frac{\\sin x}{\\sin x + \\cos x} \\text{ on } [0, \\tfrac{\\pi}{2}]",
      work: [
        "Call the integral I. King's rule with a = \\tfrac{\\pi}{2} swaps \\sin and \\cos.",
        "So I = \\int_0^{\\pi/2} \\tfrac{\\cos x}{\\cos x + \\sin x}\\,dx as well.",
        "Adding: 2I = \\int_0^{\\pi/2} 1\\,dx = \\tfrac{\\pi}{2}.",
      ],
      result: "\\frac{\\pi}{4}",
    },
    pitfalls: [
      "Odd/even only helps when the interval is symmetric about 0.",
      "After king's rule you must add the two forms — the rewritten integral alone is no easier.",
    ],
  },
  {
    id: "feynman",
    name: "Feynman's trick",
    tagline: "Turn a fixed integral into a family, and differentiate the family instead of integrating it.",
    whenToUse:
      "The integral has a hidden parameter — an exponent, a coefficient, a scale factor — and no direct technique makes progress once you've tried the obvious substitutions. Introduce that parameter explicitly, name the result I(a), and differentiate I with respect to a rather than working in x at all.",
    recipe: [
      "Rewrite the integral as I(a) for a parameter a chosen so the original problem is I at one specific value, and I is trivial (often 0) at another.",
      "Differentiate under the integral sign: I'(a) = \\int \\frac{\\partial}{\\partial a}(\\text{integrand})\\,dx. This is legal whenever the integrand and its a-derivative stay well-behaved as a varies — assume so unless the problem says otherwise.",
      "The a-derivative is almost always an easier integral in x than the original was.",
      "Integrate I'(a) back with respect to a to recover I(a) up to a constant, then pin the constant using the trivial value of I.",
      "Substitute the value of a that recovers the integral you actually wanted.",
    ],
    example: {
      integrand: "\\frac{x^2-1}{\\ln x} \\text{ on } [0,1]",
      work: [
        "Generalize: let I(a) = \\int_0^1 \\frac{x^a - 1}{\\ln x}\\,dx, so the target is I(2).",
        "Differentiate under the integral sign: I'(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a+1} — differentiating x^a brings down a factor of \\ln x, which cancels the \\ln x in the denominator.",
        "Integrate back in a: I(a) = \\ln(a+1) + C.",
        "I(0) = 0 outright, since the integrand vanishes identically when a = 0 — so C = 0.",
      ],
      result: "I(2) = \\ln 3",
    },
    pitfalls: [
      "Differentiating under the integral sign needs the integrand to stay well-behaved as a varies — this isn't the tool for an integrand with a singularity that moves with a.",
      "Pin the constant of integration using a value of a where the integral is obviously trivial, not by guessing.",
      "The parameter has to actually recover the original problem at some specific value — check that before differentiating anything.",
    ],
  },
];

export const TECHNIQUE_BY_ID: Record<TechniqueId, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, Technique>;

export function techniqueName(id: TechniqueId): string {
  return TECHNIQUE_BY_ID[id]?.name ?? id;
}
