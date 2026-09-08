/**
 * Euler's reflection formula — UK University Integration Bee syllabus §2.2.
 *
 * Gamma(s)Gamma(1-s) = pi/sin(pi s). Assumes the reader already has Gamma(n)=(n-1)! (`gamma-function`)
 * and B(x,y)=Gamma(x)Gamma(y)/Gamma(x+y) (`beta-integrals`) — neither is re-taught here. What this
 * lesson adds is the identity that links both of those to trigonometry, and — far more usefully for
 * competition — the single integral every competitor should recognise on sight once they have it:
 * a bare power of x over 1+x (or 1+x^n), on (0,\infty), collapses straight to a closed form in pi.
 */
import type { Completion, Technique, WorkedExample } from "../types";

const EULER_REFLECTION_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac1{\\sqrt x\\,(1+x)}",
    work: [
      "This is the workhorse shape \\frac{x^{s-1}}{1+x} with s=\\frac12, integrated over (0,\\infty).",
      "Check convergence first: near x=0 the integrand behaves like x^{-1/2}, integrable since -\\frac12>-1; near x\\to\\infty it behaves like x^{-3/2}, integrable since -\\frac32<-1. So the integral is a genuine number.",
      "Substitute t=\\frac x{1+x}, so x=\\frac t{1-t} and dx=\\frac{dt}{(1-t)^2}. As x runs 0\\to\\infty, t runs 0\\to1 (x\\to\\infty gives t\\to1^-).",
      "Rewrite the other two pieces in t: 1+x=\\frac1{1-t}, and x^{-1/2}=\\left(\\frac t{1-t}\\right)^{-1/2}=t^{-1/2}(1-t)^{1/2}.",
      "Substitute everything at once: \\frac{x^{-1/2}}{1+x}\\,dx=t^{-1/2}(1-t)^{1/2}\\cdot(1-t)\\cdot\\frac{dt}{(1-t)^2}=t^{-1/2}(1-t)^{1/2+1-2}\\,dt=t^{-1/2}(1-t)^{-1/2}\\,dt.",
      "So the integral is \\int_0^1t^{-1/2}(1-t)^{-1/2}\\,dt=B\\!\\left(\\frac12,\\frac12\\right) — a Beta integral with both parameters \\frac12.",
      "B\\!\\left(\\frac12,\\frac12\\right)=\\frac{\\Gamma(1/2)\\Gamma(1/2)}{\\Gamma(1)}=\\Gamma\\!\\left(\\frac12\\right)^2, using B(x,y)=\\frac{\\Gamma(x)\\Gamma(y)}{\\Gamma(x+y)} and \\Gamma(1)=1.",
      "Now apply the reflection formula at s=\\frac12: \\Gamma\\!\\left(\\frac12\\right)\\Gamma\\!\\left(1-\\frac12\\right)=\\Gamma\\!\\left(\\frac12\\right)^2=\\frac\\pi{\\sin(\\pi/2)}=\\frac\\pi1=\\pi.",
    ],
    result: "\\pi",
    integrandExpr: "x^(-1/2)/(1+x)",
    resultExpr: "pi",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\frac1{1+x^3}",
    work: [
      "A bare 1 over 1+x^3 isn't the workhorse's 1+x denominator, but the same substitution generalises: set u=x^n (here n=3), so x=u^{1/n},\\ dx=\\frac1nu^{1/n-1}\\,du, and \\int_0^\\infty\\frac{x^{a-1}}{1+x^n}\\,dx becomes \\frac1n\\int_0^\\infty\\frac{u^{a/n-1}}{1+u}\\,du — the workhorse at s=\\frac{a}{n}, times the extra \\frac1n the substitution leaves out front.",
      "Here there's no power of x on top, so a=1, and n=3, giving s=\\frac{a}{n}=\\frac13: \\int_0^\\infty\\frac{dx}{1+x^3}=\\frac13\\int_0^\\infty\\frac{u^{-2/3}}{1+u}\\,du=\\frac13\\cdot\\frac\\pi{\\sin(\\pi/3)}.",
      "\\sin\\frac\\pi3=\\frac{\\sqrt3}2, so \\frac13\\cdot\\frac\\pi{\\sqrt3/2}=\\frac13\\cdot\\frac{2\\pi}{\\sqrt3}=\\frac{2\\pi}{3\\sqrt3}.",
    ],
    result: "\\frac{2\\pi}{3\\sqrt3}",
    integrandExpr: "1/(1+x^3)",
    resultExpr: "2*pi/(3*sqrt(3))",
    domain: [0, Infinity],
    kind: "definite",
  },
];

const EULER_REFLECTION_COMPLETIONS: Completion[] = [
  {
    setup: [
      "\\Gamma\\!\\left(\\frac52\\right)\\Gamma\\!\\left(-\\frac32\\right) is a direct instance of the reflection formula at s=\\frac52 (since 1-\\frac52=-\\frac32) — but s=\\frac52 is nowhere near (0,1). Indeed the integral this lesson's derivation is built on, \\int_0^\\infty x^{3/2}/(1+x)\\,dx, diverges outright: near x\\to\\infty the integrand behaves like x^{1/2}, which doesn't even tend to 0. There is no integral to fall back on here.",
      "Fall back on \\Gamma's own recurrence instead (prerequisite): \\Gamma(z+1)=z\\Gamma(z),\\ \\Gamma\\!\\left(\\frac12\\right)=\\sqrt\\pi. Unwinding downward from \\frac12: \\Gamma\\!\\left(-\\frac12\\right)=\\frac{\\Gamma(1/2)}{-1/2}=-2\\sqrt\\pi, then \\Gamma\\!\\left(-\\frac32\\right)=\\frac{\\Gamma(-1/2)}{-3/2}=\\frac43\\sqrt\\pi. Unwinding upward from \\frac12: \\Gamma\\!\\left(\\frac32\\right)=\\frac12\\Gamma\\!\\left(\\frac12\\right)=\\frac12\\sqrt\\pi, then \\Gamma\\!\\left(\\frac52\\right)=\\frac32\\Gamma\\!\\left(\\frac32\\right)=\\frac34\\sqrt\\pi.",
    ],
    blank:
      "Multiply the two Gamma values found by recurrence, then separately evaluate \\frac\\pi{\\sin(5\\pi/2)} using the periodicity of sine — do the two routes agree?",
    answer:
      "\\Gamma\\!\\left(\\frac52\\right)\\Gamma\\!\\left(-\\frac32\\right)=\\frac34\\sqrt\\pi\\cdot\\frac43\\sqrt\\pi=\\pi. And \\sin\\frac{5\\pi}2=\\sin\\!\\left(\\frac{5\\pi}2-2\\pi\\right)=\\sin\\frac\\pi2=1, so \\frac\\pi{\\sin(5\\pi/2)}=\\pi too. The two routes agree exactly — the reflection formula holds at s=\\frac52 even though the integral it was derived from doesn't converge there; the identity itself extends past the integral's own domain via \\Gamma's recurrence.",
  },
  {
    setup: [
      "\\int_0^\\infty\\frac{x^2}{1+x^5}\\,dx — the x^n generalisation with a=3 (from x^{a-1}=x^2) and n=5. Substitute u=x^n=x^5, so x=u^{1/5},\\ dx=\\frac15u^{1/5-1}\\,du=\\frac15u^{-4/5}\\,du.",
      "x^2=u^{2/5}, so the integrand becomes \\frac{u^{2/5}}{1+u}\\cdot\\frac15u^{-4/5}\\,du=\\frac15\\cdot\\frac{u^{2/5-4/5}}{1+u}\\,du=\\frac15\\cdot\\frac{u^{-2/5}}{1+u}\\,du.",
    ],
    blank:
      "Recognise the remaining integral as the workhorse at some value of s, apply the formula, and don't forget the \\frac15 sitting out front.",
    answer:
      "u^{-2/5}/(1+u)=u^{s-1}/(1+u) with s-1=-\\frac25, i.e. s=\\frac35 — the workhorse at s=\\frac35: \\int_0^\\infty\\frac{u^{-2/5}}{1+u}\\,du=\\frac\\pi{\\sin(3\\pi/5)}. Multiplying by the \\frac15 the substitution left out front: \\int_0^\\infty\\frac{x^2}{1+x^5}\\,dx=\\frac15\\cdot\\frac\\pi{\\sin(3\\pi/5)}=\\frac\\pi{5\\sin(3\\pi/5)}.",
    integrandExpr: "x^2/(1+x^5)",
    resultExpr: "pi/(5*sin(3*pi/5))",
    domain: [0, Infinity],
    kind: "definite",
  },
];

export const EulerReflection: Technique = {
  id: "euler-reflection",
  name: "Euler's reflection formula",
  tagline:
    "\\Gamma(s)\\Gamma(1-s)=\\frac\\pi{\\sin(\\pi s)} — turns a bare power of x over 1+x (or 1+x^n) on (0,\\infty) into a closed form in \\pi, with no integration by parts at all.",
  prerequisites: ["The Gamma function", "Beta function integrals"],
  whenToUse:
    "The integral runs over (0,\\infty), and the integrand is nothing but a single power of x divided by 1+x — or by 1+x^n for some other n — with no exponential, no trig function, no extra structure to exploit. That bareness IS the cue: if you're about to set up a partial-fraction decomposition of \\frac{x^{a-1}}{1+x^n}, stop and check whether this identity just hands you the answer instead.",
  intuition:
    "Start from the workhorse integral itself, I(s)=\\int_0^\\infty\\frac{x^{s-1}}{1+x}\\,dx, and check first that it even converges: near x=0 the integrand behaves like x^{s-1}, integrable exactly when s>0; near x\\to\\infty it behaves like x^{s-2}, integrable exactly when s<1. So I(s) is a genuine number precisely for 0<s<1 — the range this whole technique lives in. Substitute t=\\frac x{1+x}, i.e. x=\\frac t{1-t} and dx=\\frac{dt}{(1-t)^2}, with the bounds x:0\\to\\infty mapping to t:0\\to1. Then 1+x=\\frac1{1-t} and x^{s-1}=\\left(\\frac t{1-t}\\right)^{s-1}, so the whole integrand \\frac{x^{s-1}}{1+x}\\,dx becomes t^{s-1}(1-t)^{1-s}\\cdot(1-t)\\cdot\\frac{dt}{(1-t)^2}=t^{s-1}(1-t)^{-s}\\,dt — exactly the Beta-integral shape \\int_0^1t^{p-1}(1-t)^{q-1}\\,dt with p=s,\\ q=1-s. So I(s)=B(s,1-s). Using B(x,y)=\\frac{\\Gamma(x)\\Gamma(y)}{\\Gamma(x+y)} and \\Gamma(1)=1 — both already yours from Beta function integrals and The Gamma function — B(s,1-s)=\\frac{\\Gamma(s)\\Gamma(1-s)}{\\Gamma(1)}=\\Gamma(s)\\Gamma(1-s): one hard integral has turned into exactly the product this lesson's identity evaluates. That's the honest reason a \\pi and a \\sin show up in what looked like a purely algebraic integral — \\Gamma(s)\\Gamma(1-s) itself equals \\frac\\pi{\\sin(\\pi s)} (classically proved via the Weierstrass product for \\sin(\\pi s) over its zeros at every integer, or a keyhole contour around the branch point of x^{s-1}; neither is needed here — treat the identity as given, the way this lesson does), and the substitution above is exactly what lets a plain power-over-(1+x) integral inherit that \\sin from a totally different piece of mathematics. Once you've seen the derivation once, the workhorse — \\int_0^\\infty\\frac{x^{s-1}}{1+x}\\,dx=\\frac\\pi{\\sin(\\pi s)} — is the form worth recognising on sight: any bare power of x over a shifted-by-1 denominator, integrated over the whole positive axis, is this identity wearing a costume.",
  recipe: [
    "Know the identity itself: \\Gamma(s)\\Gamma(1-s)=\\frac\\pi{\\sin(\\pi s)}, valid for every non-integer s (\\Gamma has poles at 0,-1,-2,\\dots — exactly where \\sin(\\pi s)=0 too, so the two blow-ups are consistent with each other).",
    "The workhorse consequence, for 0<s<1: \\int_0^\\infty\\frac{x^{s-1}}{1+x}\\,dx=B(s,1-s)=\\Gamma(s)\\Gamma(1-s)=\\frac\\pi{\\sin(\\pi s)} — substitute t=\\frac x{1+x} to reach the Beta integral, then apply the reflection formula. See `intuition` for the full derivation.",
    "Recognise the shape \\frac{x^{a-1}}{1+x} on sight and quote this directly — don't re-derive it, and don't reach for partial fractions or by parts.",
    "For a 1+x^n denominator, substitute u=x^n first: \\int_0^\\infty\\frac{x^{a-1}}{1+x^n}\\,dx=\\frac1n\\int_0^\\infty\\frac{u^{a/n-1}}{1+u}\\,du=\\frac\\pi{n\\sin(\\pi a/n)} — the workhorse at s=\\frac{a}{n}, times the extra \\frac1n the substitution leaves out front.",
    "If s lands outside (0,1), the underlying integral no longer converges at all — fall back on \\Gamma's own recurrence \\Gamma(z+1)=z\\Gamma(z) to relate the out-of-range values to ones you can compute, and apply the identity directly rather than trying to push the integral there.",
  ],
  example: EULER_REFLECTION_EXAMPLES[0],
  examples: EULER_REFLECTION_EXAMPLES,
  pitfalls: [
    "The workhorse integral only converges for 0<s<1 — outside that range \\int_0^\\infty x^{s-1}/(1+x)\\,dx genuinely diverges (near x=0 you need s>0; near x\\to\\infty you need s<1). The ALGEBRAIC identity \\Gamma(s)\\Gamma(1-s)=\\pi/\\sin(\\pi s) still holds past that range — it's proved independently of this integral — but you reach it via \\Gamma's own recurrence, not by pushing the integral further than it converges.",
    "For a 1+x^n denominator, the extra \\frac1n from the u=x^n substitution is the single most common slip — the answer is \\frac\\pi{n\\sin(\\pi a/n)}, not \\frac\\pi{\\sin(\\pi a/n)}. Sanity-check against n=1 (so a=s): the extra factor is 1 and both formulas agree, exactly as they should.",
    "\\Gamma\\!\\left(\\frac12\\right)=\\sqrt\\pi isn't a separate fact worth memorising on its own — it's exactly this formula at s=\\frac12: \\Gamma\\!\\left(\\frac12\\right)^2=\\frac\\pi{\\sin(\\pi/2)}=\\pi, and \\Gamma\\!\\left(\\frac12\\right)>0 pins down the positive square root.",
    "\\sin(\\pi s) is zero at every integer s — exactly where \\Gamma(s) or \\Gamma(1-s) has a pole, so the product Gamma(s)\\Gamma(1-s) stays consistent rather than contradictory there. That doesn't make s= an integer a computation you can run — treat it as the boundary case it is, not a value to plug in.",
  ],
  checkYourself: {
    prompt: "\\frac1{1+x^4} \\text{ on } [0,\\infty)",
    answer: "\\frac\\pi{2\\sqrt2}",
    hint: "This is the a=1,\\ n=4 case of the generalisation, \\frac\\pi{n\\sin(\\pi a/n)} — n appears in BOTH places, the extra factor out front and inside the sine.",
  },
  completions: EULER_REFLECTION_COMPLETIONS,
  selfExplain: {
    prompt:
      "Reciprocal substitution pairs an integral over (0,\\infty) with its own twin under x\\to\\frac1x. Try that exact move directly on I(s)=\\int_0^\\infty\\frac{x^{s-1}}{1+x}\\,dx — substitute x=\\frac1u — instead of going through Beta and \\Gamma. Why doesn't this already hand you the closed form, the way it does for the reciprocal-substitution lesson's own examples?",
    answer:
      "Substituting x=\\frac1u does exactly what Reciprocal substitution promises: x^{s-1}=u^{1-s},\\ 1+x=\\frac{u+1}u, and dx=-\\frac{du}{u^2} with the bounds flipping back, so \\frac{x^{s-1}}{1+x}\\,dx becomes u^{1-s}\\cdot\\frac u{u+1}\\cdot\\frac{du}{u^2}=\\frac{u^{-s}}{1+u}\\,du=u^{(1-s)-1}/(1+u)\\,du. That means I(s)=I(1-s) — a genuine, correct symmetry, and in fact the SAME symmetry \\frac\\pi{\\sin(\\pi s)} already has, since \\sin(\\pi s)=\\sin\\big(\\pi-\\pi s\\big)=\\sin\\big(\\pi(1-s)\\big). But a symmetry isn't a value: knowing I(s)=I(1-s) tells you the two integrals match without ever pinning down what number either one equals. Reciprocal substitution pays off when the twin collapses to \\pm I (or to a second, independently solvable integral) — here it only relabels the same unknown. The Beta/\\Gamma route is the one that actually produces a NUMBER, because it routes I(s) through the reflection formula — an identity proved by completely different machinery (an infinite product, or a contour integral) that carries real numerical content the reciprocal substitution alone can never supply.",
  },
};

export default EulerReflection;
