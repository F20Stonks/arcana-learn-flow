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
  {
    id: "t-sub",
    name: "The t-substitution",
    tagline: "Weierstrass's universal move: turn any rational function of sin and cos into a rational function of t.",
    whenToUse:
      "A rational function of \\sin x, \\cos x and \\tan x that no identity or standard substitution cracks — especially denominators like a + b\\cos x or a + b\\sin x. It always works, so treat it as the fallback once nothing faster presents itself, not the first move.",
    recipe: [
      "Set t = \\tan\\frac{x}{2}.",
      "Substitute \\sin x = \\frac{2t}{1+t^2},\\ \\cos x = \\frac{1-t^2}{1+t^2},\\ dx = \\frac{2}{1+t^2}\\,dt.",
      "Every trig function cancels away, leaving a rational function of t — integrate that with standard forms or partial fractions.",
      "Back-substitute t = \\tan\\frac{x}{2} (or convert the bounds directly, for a definite integral).",
    ],
    example: {
      integrand: "\\frac{1}{2+\\cos x}",
      work: [
        "With t = \\tan\\frac{x}{2}: 2+\\cos x = \\frac{2(1+t^2) + (1-t^2)}{1+t^2} = \\frac{3+t^2}{1+t^2}.",
        "The integral becomes \\int \\frac{2}{3+t^2}\\,dt, a plain arctan form.",
        "That integrates to \\frac{2}{\\sqrt3}\\arctan\\frac{t}{\\sqrt3}.",
      ],
      result: "\\frac{2}{\\sqrt3}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) + C",
    },
    pitfalls: [
      "t = \\tan\\frac{x}{2} is undefined at x = \\pi — never substitute across that point in one piece; split the integral there if it's inside the domain.",
      "The universal method rarely gives the prettiest route. If a quicker identity or plain substitution is staring at you, use it instead — save this for when nothing else moves.",
      "Don't forget the \\frac{2}{1+t^2} from dx — it's easy to substitute \\sin x and \\cos x and lose the differential.",
    ],
  },
  {
    id: "recurrence",
    name: "Recurrence relations",
    tagline: "Relate a hard integral to an easier one indexed one step down, then unwind.",
    whenToUse:
      "The integral is naturally indexed by an integer n — a power like \\sin^n x, or a family like \\frac{x^n}{1+x} — and integration by parts, or a small algebraic trick, relates I_n to I_{n-1} or I_{n-2}. Reach for this whenever a problem hands you a family rather than a single integral.",
    recipe: [
      "Name the family I_n. Try peeling one factor off with integration by parts, or adding/subtracting a related power algebraically, to relate I_n to a lower index.",
      "Solve the recurrence down to a base case you can compute directly — usually I_0 or I_1.",
      "Unwind the recurrence for the specific n you actually need.",
      "Watch the parity: many recurrences behave differently for even and odd n, so pin down which branch you're on before unwinding.",
    ],
    example: {
      integrand: "\\frac{x^2}{1+x} \\text{ on } [0,1]",
      work: [
        "Let I_n = \\int_0^1 \\frac{x^n}{1+x}\\,dx. Adding I_n and I_{n-1}: I_n + I_{n-1} = \\int_0^1 x^{n-1}\\,dx = \\frac{1}{n}.",
        "So I_n = \\frac{1}{n} - I_{n-1}, and the base case is I_0 = \\int_0^1 \\frac{dx}{1+x} = \\ln 2.",
        "I_1 = 1 - \\ln 2, so I_2 = \\frac{1}{2} - I_1 = \\ln 2 - \\frac{1}{2}.",
      ],
      result: "\\ln 2 - \\frac{1}{2}",
    },
    pitfalls: [
      "Unwinding by hand for a large n is exactly as much work as the original problem — look for whether the recurrence collapses into a product or telescopes before grinding through every step.",
      "A recurrence relating I_n to I_{n-2} needs BOTH I_0 and I_1 as base cases, one for each parity.",
      "Getting the algebra sign wrong in I_n + I_{n-1} = \\dots vs I_n - I_{n-1} = \\dots silently flips every answer downstream — verify the very first step against a value you can compute directly (n=1 or n=2) before trusting the pattern.",
    ],
  },
  {
    id: "inverse-integral",
    name: "Integral of an inverse function",
    tagline: "Swap a hard integral for the easy area of its inverse, using the rectangle they share.",
    whenToUse:
      "You need \\int f(x)\\,dx for an f whose own antiderivative is annoying (\\arcsin, \\arctan, \\ln), but whose INVERSE — \\sin, \\tan, e^x — is trivial to integrate. The picture is a rectangle split by the curve y=f(x): the area under f and the area under f^{-1} (read off the y-axis) fill it between them.",
    recipe: [
      "Identify f and confirm it's injective (monotonic) on the interval — that's what gives it an inverse at all.",
      "Use \\int_a^b f(x)\\,dx + \\int_{f(a)}^{f(b)} f^{-1}(x)\\,dx = b\\,f(b) - a\\,f(a).",
      "Pick whichever of the two integrals is the easy one — usually the inverse function, since it's the one you actually know how to integrate — and compute it directly.",
      "Solve for the integral you actually wanted.",
    ],
    example: {
      integrand: "\\arcsin x \\text{ on } [0,1]",
      work: [
        "f(x) = \\sin x is the easy direction, with f^{-1} = \\arcsin. Here a=0, b=\\frac{\\pi}{2} (so that f(b)=1).",
        "\\int_0^{\\pi/2}\\sin x\\,dx + \\int_0^1 \\arcsin x\\,dx = \\frac{\\pi}{2}\\cdot 1 - 0\\cdot 0 = \\frac{\\pi}{2}.",
        "The first integral is 1 (elementary), so \\int_0^1\\arcsin x\\,dx = \\frac{\\pi}{2} - 1.",
      ],
      result: "\\frac{\\pi}{2} - 1",
    },
    pitfalls: [
      "The identity needs f INJECTIVE on the interval you're using — check that before reaching for it, or the 'inverse' isn't well defined.",
      "Matching the bounds is the whole trick: b must satisfy f(b) equal to the upper limit you actually want on the inverse integral, not just some convenient value.",
      "This is a shortcut around integration by parts, not a different answer — if you're unsure the identity applies, by parts on \\arcsin/\\arctan/\\ln always works too and is worth checking against.",
    ],
  },
  {
    id: "floor-function",
    name: "Floor function integrals",
    tagline: "The floor has no antiderivative — split the domain at every integer, where it's constant, instead.",
    whenToUse:
      "\\lfloor x\\rfloor, or the fractional part x - \\lfloor x\\rfloor, sits inside the integrand and the bounds span more than one integer. There is no calculus move that touches \\lfloor x\\rfloor directly — the only route in is chopping the interval into pieces where it's constant.",
    recipe: [
      "List every integer strictly inside the interval of integration — those are exactly where \\lfloor x\\rfloor jumps.",
      "Split \\int_a^b into a sum of integrals over [k,k+1] (with partial pieces at the two ends), replacing \\lfloor x\\rfloor by the fixed integer k on each piece.",
      "Integrate each ordinary piece — \\lfloor x\\rfloor is now just a constant — and sum the results.",
      "Look for the sum to collapse: it's often a short arithmetic series, or telescopes outright.",
    ],
    example: {
      integrand: "\\lfloor x\\rfloor \\text{ on } [0,3]",
      work: [
        "Split at the integers: [0,1),\\ [1,2),\\ [2,3], where \\lfloor x\\rfloor is 0, 1, 2 respectively.",
        "\\int_0^3\\lfloor x\\rfloor\\,dx = 0\\cdot 1 + 1\\cdot 1 + 2\\cdot 1.",
        "Sum the constant pieces.",
      ],
      result: "3",
    },
    pitfalls: [
      "The split points are the INTEGERS inside the interval, not the endpoints — double-check you haven't miscounted by one at either end.",
      "For x - \\lfloor x\\rfloor (the sawtooth), each piece [k,k+1) is just \\int_0^1 u\\,du = \\frac{1}{2} after shifting — every full unit interval contributes exactly \\frac{1}{2}, which is worth recognising on sight.",
      "\\lfloor x\\rfloor is discontinuous at every integer, so don't try to differentiate through one — this technique is fundamentally about summing, not about finding an antiderivative.",
    ],
  },
  {
    id: "beta-integrals",
    name: "Beta function integrals",
    tagline: "\\int_0^1 x^m(1-x)^n\\,dx is always a clean rational number — recognise the shape and skip the algebra.",
    whenToUse:
      "The integrand is a power of x times a power of (1-x) (or of u and a-u, after rescaling to [0,1]). Expanding (1-x)^n by hand and integrating term by term always works, but for anything beyond n=2 it's slower than just knowing the closed form.",
    recipe: [
      "Get the integral into the form \\int_0^1 x^m(1-x)^n\\,dx. An interval [a,b] rescales to [0,1] with u=\\frac{x-a}{b-a}.",
      "Use \\int_0^1 x^m(1-x)^n\\,dx = \\frac{m!\\,n!}{(m+n+1)!} — provable by repeated integration by parts, peeling one factor of (1-x) off at a time.",
      "Use the symmetry \\int_0^1 x^m(1-x)^n\\,dx = \\int_0^1 x^n(1-x)^m\\,dx (swap via u=1-x) as a free sanity check on the formula.",
      "For non-integer exponents the same pattern holds with factorials replaced by the Gamma function — the integer case is the one this bank drills.",
    ],
    example: {
      integrand: "x^2(1-x)^3 \\text{ on } [0,1]",
      work: [
        "Match to the pattern with m=2, n=3.",
        "\\frac{m!\\,n!}{(m+n+1)!} = \\frac{2!\\cdot 3!}{6!} = \\frac{2\\cdot 6}{720}.",
        "Simplify the fraction.",
      ],
      result: "\\frac{1}{60}",
    },
    pitfalls: [
      "The formula needs the interval to be [0,1] with the two factors exactly x and 1-x — rescale first if it isn't, don't try to patch the formula.",
      "m and n must be nonnegative integers for the factorial form; a fractional power needs the Gamma function instead.",
      "Don't forget the +1 in the denominator's (m+n+1)! — it's the single most common slip with this identity.",
    ],
  },
  {
    id: "introducing-constants",
    name: "Introducing constants",
    tagline: "Split the numerator by adding and subtracting a constant, so one half is trivial and the other is a form you already know.",
    whenToUse:
      "A rational (or rational-in-trig) integrand whose numerator is 'almost' a multiple of the denominator, or almost the denominator's derivative, plus some leftover constant. Especially useful for isolating a piece you've already solved elsewhere — this is a great second pass once a first technique gets you most of the way.",
    recipe: [
      "Write the numerator as \\lambda\\cdot(\\text{denominator, or its derivative}) + \\mu, solving for \\lambda and \\mu by matching coefficients.",
      "Split into \\lambda\\int 1\\,dx (or \\lambda\\int\\frac{D'}{D}\\,dx) plus \\mu\\int\\frac{dx}{D(x)}.",
      "The first piece is now trivial. For the second, reuse whatever standard form or previously-solved result applies to D(x) — don't re-derive it from scratch.",
      "The multiplicative version of the same idea — multiply and divide by a well-chosen constant — can reveal a hidden derivative; it's rarer, but worth trying when nothing else moves.",
    ],
    example: {
      integrand: "\\frac{x^2+7x+8}{x^2+5x+3}",
      work: [
        "The numerator is the denominator plus a remainder: x^2+7x+8 = (x^2+5x+3) + (2x+5).",
        "Split: \\int 1\\,dx + \\int\\frac{2x+5}{x^2+5x+3}\\,dx.",
        "The second piece is exactly \\ln|x^2+5x+3|, since 2x+5 is the denominator's own derivative.",
      ],
      result: "x + \\ln(x^2+5x+3) + C",
    },
    pitfalls: [
      "Match coefficients carefully — get \\lambda or \\mu wrong and every downstream integral is off by a constant that's easy to miss.",
      "The 'remainder' after subtracting off \\lambda\\cdot D(x) must genuinely be a constant, or (for the derivative version) the rest must genuinely be D'(x); if it isn't, the split hasn't actually simplified anything.",
      "This is a setup move, not a finishing one — you still have to know how to integrate \\frac{1}{D(x)} once you've isolated it.",
    ],
  },
  {
    id: "log-power-integrals",
    name: "Log-power integrals",
    tagline: "\\int_0^1 x^n\\ln^k x\\,dx is a closed-form rational number for every n,k \\geq 0 — a generating-function trick reads it off in one line.",
    whenToUse:
      "The integrand is x to a nonnegative integer power times a nonnegative integer power of \\ln x, over [0,1]. Repeated integration by parts always works, peeling one power of \\ln x off each time, but for k \\geq 2 it's a lot of bookkeeping for something with a one-line closed form.",
    recipe: [
      "Introduce a parameter: J(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a+1}, valid for any a > -1 — this is the trivial integral hiding underneath.",
      "Differentiate J with respect to a. Since \\frac{\\partial}{\\partial a}x^a = x^a\\ln x, each derivative brings down one more factor of \\ln x inside the integral: J^{(k)}(a) = \\int_0^1 x^a\\ln^k x\\,dx.",
      "Differentiate the closed form the same number of times: \\frac{d^k}{da^k}\\frac{1}{a+1} = \\frac{(-1)^k k!}{(a+1)^{k+1}}.",
      "Set a = n (the integer power actually in the problem): \\int_0^1 x^n\\ln^k x\\,dx = \\frac{(-1)^k k!}{(n+1)^{k+1}}.",
    ],
    example: {
      integrand: "x^2\\ln x \\text{ on } [0,1]",
      work: [
        "Match to the pattern with n=2, k=1.",
        "J(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a+1}, so J'(a) = \\int_0^1 x^a\\ln x\\,dx = -\\frac{1}{(a+1)^2}.",
        "Set a=2: J'(2) = -\\frac{1}{9}.",
      ],
      result: "-\\frac{1}{9}",
    },
    pitfalls: [
      "The sign alternates with k — \\ln x is negative on (0,1), so odd k gives a negative answer and even k gives a positive one. Sanity-check the sign before trusting the arithmetic.",
      "The exponent on the denominator is k+1, not k — it's easy to drop the extra +1 that comes from differentiating \\frac{1}{a+1} itself once more than you differentiated a^{\\text{power}}.",
      "This is the same differentiate-under-the-integral-sign move as the Feynman technique, just packaged as a formula worth recognising on sight instead of re-deriving from scratch every time.",
    ],
  },
  {
    id: "reciprocal-substitution",
    name: "Reciprocal substitution",
    tagline: "u=\\frac{1}{x} pairs an integral over (0,\\infty) with a twin of itself — average the two and the hard part cancels.",
    whenToUse:
      "The integral runs over (0,\\infty), and the integrand involves \\ln x or an odd power of x in a way that looks antisymmetric under x \\to \\frac{1}{x}. If substituting u=\\frac{1}{x} turns the integral into something you can add to (or subtract from) the original to kill the ugly part, this is the move.",
    recipe: [
      "Substitute u = \\frac{1}{x}, so x = \\frac{1}{u} and dx = -\\frac{du}{u^2}. The bounds (0,\\infty) map to (\\infty,0), and flipping them back cancels the minus sign.",
      "Rewrite every x in the integrand in terms of u, including \\ln x = -\\ln u if a logarithm is present.",
      "Compare the transformed integral to the original. If it's the negative of the original, the integral is 0 outright. If it's a different but related integral, add the two expressions together — the awkward piece is often designed to cancel or double.",
      "Solve the resulting (usually much simpler) equation for the original integral I.",
    ],
    example: {
      integrand: "\\frac{1}{x(1+x^2)(1+x^3)} \\text{ style pairing, worked for } \\int_0^\\infty \\frac{\\arctan x}{x(1+\\ln^2 x)}\\,dx",
      work: [
        "Let I = \\int_0^\\infty \\frac{\\arctan x}{x(1+\\ln^2 x)}\\,dx. Substitute x=\\frac{1}{t}: \\arctan\\frac{1}{t} = \\frac{\\pi}{2}-\\arctan t, and \\ln^2 x = \\ln^2 t since \\ln\\frac{1}{t}=-\\ln t.",
        "The measure works out to \\frac{dx}{x} = -\\frac{dt}{t}, so I = \\int_0^\\infty \\frac{\\frac{\\pi}{2}-\\arctan t}{t(1+\\ln^2 t)}\\,dt = \\frac{\\pi}{2}J - I, where J=\\int_0^\\infty \\frac{dt}{t(1+\\ln^2 t)}.",
        "J collapses under w=\\ln t to \\int_{-\\infty}^\\infty\\frac{dw}{1+w^2}=\\pi. So 2I=\\frac{\\pi}{2}\\cdot\\pi, giving I=\\frac{\\pi^2}{4}.",
      ],
      result: "\\frac{\\pi^2}{4}",
    },
    pitfalls: [
      "Get the bounds and the sign right: (0,\\infty)\\to(\\infty,0) under x=\\frac{1}{t}, and flipping the limits back is exactly what cancels the minus sign in dx=-\\frac{dt}{t^2} — track this once, carefully, rather than by feel.",
      "\\ln\\frac{1}{t}=-\\ln t, so an even power of \\ln x survives the substitution unchanged while an odd power flips sign — that's usually the whole point of trying this move.",
      "The technique only pays off when the twin integral is genuinely related to the original (equal, opposite, or a known simpler one). If substituting just produces an unrelated mess, this isn't the right tool.",
    ],
  },
];

export const TECHNIQUE_BY_ID: Record<TechniqueId, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, Technique>;

export function techniqueName(id: TechniqueId): string {
  return TECHNIQUE_BY_ID[id]?.name ?? id;
}
