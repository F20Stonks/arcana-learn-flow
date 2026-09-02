/**
 * The general Leibniz rule — UK University Integration Bee syllabus §1.3.
 *
 * The sequel to Feynman's trick (`feynman`, syllabus §1.2): fixed-limit differentiation under the
 * integral sign is a single term, \int\frac{\partial f}{\partial t}\,dx. This lesson covers what
 * changes when the bounds themselves are functions of the same parameter — two extra terms, one
 * per moving edge, both of which fall straight out of a multivariable chain rule plus the
 * fundamental theorem of calculus (see `intuition` below). Assumes the reader has just done
 * Feynman's trick with constant limits; it is not re-taught here.
 */
import type { Completion, Technique, WorkedExample } from "../types";

const LEIBNIZ_EXAMPLES: WorkedExample[] = [
  {
    integrand: "e^{-x^2}\\text{ over the moving interval }[t,\\,t^2]",
    work: [
      "Write F(t)=\\int_t^{t^2}e^{-x^2}\\,dx and read off the three pieces the general rule needs: f(x,t)=e^{-x^2},\\ a(t)=t\\text{ with }a'(t)=1,\\ b(t)=t^2\\text{ with }b'(t)=2t.",
      "The integrand doesn't mention t at all, so the Feynman piece is zero before any real work: \\frac{\\partial f}{\\partial t}=\\frac{\\partial}{\\partial t}e^{-x^2}=0, so \\int_t^{t^2}\\frac{\\partial f}{\\partial t}\\,dx=0.",
      "That leaves only the two boundary terms. Upper limit: evaluate f AT x=b(t)=t^2, then multiply by b'(t)=2t: f\\big(b(t),t\\big)\\,b'(t)=e^{-(t^2)^2}\\cdot2t=2t\\,e^{-t^4}.",
      "Lower limit, with its built-in minus sign: evaluate f AT x=a(t)=t, multiply by a'(t)=1, and subtract: -f\\big(a(t),t\\big)\\,a'(t)=-e^{-t^2}\\cdot1=-e^{-t^2}.",
      "Add all three pieces — here that's really just the two edges, since the middle term contributed nothing: F'(t)=0+2t\\,e^{-t^4}-e^{-t^2}.",
      "Evaluate at t=1: F'(1)=2(1)e^{-1}-e^{-1}=2e^{-1}-e^{-1}=e^{-1}.",
    ],
    result: "F'(1)=\\frac1e",
  },
  {
    integrand: "x^t\\text{, integrated from }x=t\\text{ to }x=2t",
    work: [
      "F(t)=\\int_t^{2t}x^t\\,dx. This time f(x,t)=x^t genuinely depends on t, and BOTH limits move: a(t)=t\\ (a'=1),\\ b(t)=2t\\ (b'=2).",
      "Feynman piece: differentiate the integrand with x held fixed, \\frac{\\partial}{\\partial t}x^t=x^t\\ln x, giving the integral term \\int_t^{2t}x^t\\ln x\\,dx.",
      "Boundary terms: f\\big(b(t),t\\big)\\,b'(t)-f\\big(a(t),t\\big)\\,a'(t)=(2t)^t\\cdot2-t^t\\cdot1.",
      "F'(t)=\\int_t^{2t}x^t\\ln x\\,dx+2(2t)^t-t^t — three genuinely separate, genuinely nonzero contributions this time.",
      "At t=1 the leftover integral is an ordinary by-parts problem, exactly like the ones Standard forms already drilled: \\int_1^2x\\ln x\\,dx=\\left[\\frac{x^2}2\\ln x-\\frac{x^2}4\\right]_1^2=(2\\ln2-1)-\\left(-\\frac14\\right)=2\\ln2-\\frac34.",
      "Boundary terms at t=1: 2(2)^1-1^1=4-1=3.",
      "F'(1)=\\left(2\\ln2-\\frac34\\right)+3=2\\ln2+\\frac94.",
    ],
    result: "F'(1)=2\\ln2+\\frac94",
  },
];

const LEIBNIZ_COMPLETIONS: Completion[] = [
  {
    setup: [
      "F(t)=\\int_t^{t^3}\\frac xt\\,dx. Identify the moving pieces: f(x,t)=\\frac xt,\\ a(t)=t\\ (a'=1),\\ b(t)=t^3\\ (b'=3t^2).",
      "The Feynman piece first, since it's the part you already know how to handle: \\frac{\\partial f}{\\partial t}=-\\frac x{t^2}, so \\int_t^{t^3}\\left(-\\frac x{t^2}\\right)dx=-\\frac1{t^2}\\left[\\frac{x^2}2\\right]_t^{t^3}=-\\frac{t^6-t^2}{2t^2}=\\frac{1-t^4}2. At t=1 this piece is exactly 0.",
    ],
    blank: "The two boundary terms, with the correct sign on the lower one, and the total F'(1).",
    answer:
      "f\\big(b(t),t\\big)\\,b'(t)-f\\big(a(t),t\\big)\\,a'(t)=\\frac{t^3}t\\cdot3t^2-\\frac tt\\cdot1=3t^4-1. At t=1 that's 3-1=2, and adding the (zero) Feynman piece from the setup gives F'(1)=0+2=2.",
  },
  {
    setup: [
      "F(t)=\\int_t^4\\frac1{x^2}\\,dx. Here f(x,t)=\\frac1{x^2} doesn't involve t at all, and the UPPER limit is the fixed constant 4 — so b'(t)=0 and that boundary term is 0 before you evaluate anything. The Feynman piece is 0 too, since \\frac{\\partial f}{\\partial t}=0.",
      "Only the lower limit is actually doing anything here: a(t)=t,\\ a'(t)=1.",
    ],
    blank: "The one surviving term — sign included — and the value of F'(2).",
    answer:
      "-f\\big(a(t),t\\big)\\,a'(t)=-\\frac1{t^2}\\cdot1=-\\frac1{t^2}. At t=2, F'(2)=-\\frac14 — checkable directly too: F(t)=\\left[-\\frac1x\\right]_t^4=\\frac1t-\\frac14, so F'(t)=-\\frac1{t^2} matches exactly.",
  },
];

export const LeibnizRule: Technique = {
  id: "leibniz-rule",
  name: "The general Leibniz rule",
  tagline:
    "When the bounds depend on the parameter too, differentiating the integrand alone isn't enough — each moving edge adds its own term.",
  prerequisites: ["Feynman's trick", "The fundamental theorem of calculus"],
  whenToUse:
    "A parameter sits in the bounds themselves, not only inside the integrand — \\frac d{dt}\\int_{a(t)}^{b(t)}f(x,t)\\,dx, where a and/or b are genuine functions of t (t itself, t^2, \\sqrt t, ...). Feynman's trick alone — differentiating only the integrand — silently drops however much area each moving edge is sweeping up; reach for the general rule the moment EITHER bound is written in terms of the same letter you're differentiating with respect to.",
  intuition:
    "Treat F as a function of three independent things at once, F(a,b,t)=\\int_a^bf(x,t)\\,dx, letting a, b and t vary separately before tying a=a(t) and b=b(t) back together at the end. The quantity you actually want, \\frac d{dt}F\\big(a(t),b(t),t\\big), is then a plain multivariable chain rule: \\frac d{dt}F=\\frac{\\partial F}{\\partial a}\\,a'(t)+\\frac{\\partial F}{\\partial b}\\,b'(t)+\\frac{\\partial F}{\\partial t}. Three partials, three separate channels through which t can move F — and each one is something you already know how to compute. \\frac{\\partial F}{\\partial t} holds a and b fixed and differentiates only the integrand: that's exactly Feynman's trick, \\int_a^b\\frac{\\partial f}{\\partial t}\\,dx. \\frac{\\partial F}{\\partial b} holds a and t fixed and asks how fast the AREA grows as the upper limit slides — which is just the fundamental theorem of calculus, read as a statement about the upper limit: \\frac{\\partial}{\\partial b}\\int_a^bf(x,t)\\,dx=f(b,t). And \\frac{\\partial F}{\\partial a}, sliding the LOWER limit instead, is the same fact with a sign flip: \\int_a^b=-\\int_b^a, so nudging a up trims area off the front of the integral rather than adding it, giving \\frac{\\partial}{\\partial a}\\int_a^bf(x,t)\\,dx=-f(a,t). Multiply each partial by how fast its own boundary is actually moving — a'(t) or b'(t), the chain rule's job — and add all three, and the syllabus formula falls straight out: f\\big(b(t),t\\big)\\,b'(t) is genuinely just \\text{`the top edge is climbing at speed }b'\\text{, evaluated where it currently sits'}, and the minus sign on the a-term isn't a rule to memorise — it's the direction reversal already built into \\int_a^b.",
  recipe: [
    "Write F(t)=\\int_{a(t)}^{b(t)}f(x,t)\\,dx and read off a(t),\\ b(t),\\ f(x,t), and the two ordinary derivatives a'(t),\\ b'(t).",
    "Differentiate the integrand alone — the Feynman piece: \\int_{a(t)}^{b(t)}\\frac{\\partial f}{\\partial t}\\,dx, holding x fixed while you differentiate.",
    "Add one boundary term per moving limit: +f\\big(b(t),t\\big)\\,b'(t) for the upper limit, and -f\\big(a(t),t\\big)\\,a'(t) for the lower — plug the boundary VALUE into f, then multiply by how fast that boundary moves.",
    "Sum all three: F'(t)=\\int_{a(t)}^{b(t)}\\frac{\\partial f}{\\partial t}\\,dx+f\\big(b(t),t\\big)\\,b'(t)-f\\big(a(t),t\\big)\\,a'(t).",
    "Sanity check: if a and b are actually constant, both boundary terms vanish (a'=b'=0) and you're back to plain Feynman — a fast way to catch a wrong sign or a dropped term.",
  ],
  example: LEIBNIZ_EXAMPLES[0],
  examples: LEIBNIZ_EXAMPLES,
  pitfalls: [
    "Missing a boundary term is the single most common slip. Check EACH bound separately: if a(t) really is a constant its term is exactly 0 (since a'(t)=0), but if b(t) depends on t at all — even something as plain as b(t)=t — its term is not optional.",
    "The lower-limit term carries a minus sign built into the formula itself, -f\\big(a(t),t\\big)\\,a'(t) — it comes from \\int_a^b=-\\int_b^a, not from a convention to memorise. Dropping it, or flipping it to a plus, silently corrupts part of the answer.",
    "A boundary term is f evaluated AT the boundary, times how fast that boundary moves — f\\big(b(t),t\\big)\\,b'(t), full stop. It is not \\frac d{dt}\\big[f\\big(b(t),t\\big)\\big], which would also chain-rule through f's own dependence on x — that extra piece is already accounted for separately, across the WHOLE interval, by the \\int\\frac{\\partial f}{\\partial t}\\,dx term.",
    "Inside the integral you differentiate with \\frac{\\partial}{\\partial t} — partial, x held fixed, exactly like Feynman's trick. Reserve \\frac d{dt} for the object OUTSIDE the integral, the total derivative you're actually solving for.",
    "If a and b turn out to be constants after all, a'=b'=0 and both boundary terms vanish on their own — the formula collapses straight back to the plain Feynman rule you already know. Treat that as this rule's own special case, not a second formula to remember.",
  ],
  checkYourself: {
    prompt: "\\cos(tx)\\text{ on }[0,t],\\text{ differentiated at }t=\\sqrt\\pi",
    answer: "-2",
    hint: "The lower limit is the constant 0, so its term drops on its own — but the integrand still depends on t explicitly, so the Feynman piece \\int_0^t\\frac{\\partial}{\\partial t}\\cos(tx)\\,dx doesn't vanish the way it did in the first worked example. \\frac{\\partial}{\\partial t}\\cos(tx)=-x\\sin(tx); you'll need \\int x\\sin(tx)\\,dx by parts.",
  },
  completions: LEIBNIZ_COMPLETIONS,
  selfExplain: {
    prompt:
      "The first worked example integrates e^{-x^2}, which has no elementary antiderivative at all — there is no closed-form G(x) with G'(x)=e^{-x^2}. Why does the general Leibniz rule still work perfectly well here, when the naive plan of finding an antiderivative, plugging in the two moving bounds, and differentiating THAT can't even get started?",
    answer:
      "The naive plan needs a genuine function G(x,t) with \\frac{\\partial G}{\\partial x}=f(x,t), because it wants F(t)=G\\big(b(t),t\\big)-G\\big(a(t),t\\big) and then to differentiate that directly — for e^{-x^2}, no elementary G exists, so the plan is dead before it starts. The Leibniz formula never asks for G at all. Look at what it actually uses: f evaluated AT the two boundary points (just plugging numbers into e^{-x^2}, always doable), the two ordinary derivatives a'(t) and b'(t), and an antiderivative of \\frac{\\partial f}{\\partial t} — a different function from f itself, and in this example it is the zero function, trivially antidifferentiated. That is the real content of the chain-rule derivation above: F is built from \\frac{\\partial F}{\\partial a},\\ \\frac{\\partial F}{\\partial b} and \\frac{\\partial F}{\\partial t}, and only the LAST of those ever integrates in x — the first two are pure evaluation, courtesy of the fundamental theorem of calculus. The rule sidesteps needing an antiderivative of f in exactly the way Feynman's trick already did for a single hard integral, trading an integral you can't do for a couple of plain evaluations plus a (often easier) integral of something else entirely — which is why Gaussian integrals, and any integrand with no closed-form antiderivative, are completely normal territory here, not an edge case.",
  },
};

export default LeibnizRule;
