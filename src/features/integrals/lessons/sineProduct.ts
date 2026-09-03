/**
 * The sine product formula — UK University Integration Bee syllabus §2.9.
 *
 * \frac{\sin(\pi x)}{\pi x} = \prod_{n=1}^\infty\left(1-\frac{x^2}{n^2}\right).
 *
 * Zeta-series integrals reaches \sum 1/n^2=\pi^2/6 by expanding 1/(e^x-1) as a geometric series and
 * integrating termwise. Wallis integrals reaches \pi/2=\prod(2n/(2n-1))(2n/(2n+1)) by squeezing
 * \int_0^{\pi/2}\sin^nx\,dx between its neighbours. Neither explains WHERE \pi actually comes from —
 * both just cite Euler's product as the fact that makes the payoff work. This lesson is that fact:
 * \sin(\pi x) is guessed as a product over its own roots, and BOTH of those famous constants drop out
 * of the same one identity — the Basel sum from comparing Taylor coefficients, the Wallis product
 * from a single point-evaluation at x=\frac12. Deliberately does not re-derive either lesson's own
 * worked examples; it derives the shared ancestor they both cite.
 */
import type { Completion, Technique, WorkedExample } from "../types";

const SINE_PRODUCT_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\text{Comparing } x^2 \\text{ coefficients in the sine product: the Basel sum } \\sum\\tfrac1{n^2}",
    work: [
      "Expand the LEFT side as a Taylor series. \\sin(\\pi x)=\\pi x-\\dfrac{(\\pi x)^3}6+\\dfrac{(\\pi x)^5}{120}-\\cdots, so dividing every term by \\pi x: \\dfrac{\\sin(\\pi x)}{\\pi x}=1-\\dfrac{\\pi^2x^2}6+\\dfrac{\\pi^4x^4}{120}-\\cdots. The coefficient of x^2 is -\\dfrac{\\pi^2}6.",
      "Expand the RIGHT side to the same order. \\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right) multiplies out infinitely many two-term factors, but to first order in x^2 only ONE factor's own linear term can ever contribute — picking x^2/n^2 from factor n AND x^2/m^2 from a different factor m (n\\neq m) would carry x^4, not x^2. So the x^2 coefficient is just the sum of each factor's linear term, all at once: -\\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}.",
      "Both sides are the SAME function, so their power series must agree term by term. Equate the x^2 coefficients: -\\dfrac{\\pi^2}6=-\\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}.",
      "The minus sign cancels on both sides, leaving \\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}=\\dfrac{\\pi^2}6 — the Basel problem, the question that made Euler famous across Europe in 1735, settled in four lines once the product itself is granted.",
    ],
    result: "\\sum_{n=1}^\\infty\\frac1{n^2}=\\frac{\\pi^2}6",
  },
  {
    integrand: "\\text{The Wallis product, from setting } x=\\tfrac12 \\text{ in the sine product}",
    work: [
      "Set x=\\frac12 directly in \\dfrac{\\sin(\\pi x)}{\\pi x}=\\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right) — no expanding, no coefficients, just plug in a number. The left side becomes \\dfrac{\\sin(\\pi/2)}{\\pi/2}=\\dfrac1{\\pi/2}=\\dfrac2\\pi, since \\sin\\dfrac\\pi2=1 exactly.",
      "The right side becomes \\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac1{4n^2}\\right)=\\prod_{n=1}^\\infty\\frac{4n^2-1}{4n^2}=\\prod_{n=1}^\\infty\\frac{(2n-1)(2n+1)}{(2n)^2}, factoring each numerator as a difference of squares.",
      "Equate the two sides and invert: \\dfrac2\\pi=\\displaystyle\\prod_{n=1}^\\infty\\frac{(2n-1)(2n+1)}{(2n)^2}, so \\dfrac\\pi2=\\displaystyle\\prod_{n=1}^\\infty\\frac{(2n)^2}{(2n-1)(2n+1)}=\\prod_{n=1}^\\infty\\frac{2n}{2n-1}\\cdot\\frac{2n}{2n+1} — Wallis's own product, the exact same infinite product Wallis integrals reaches by a completely different route (a squeeze theorem on \\int_0^{\\pi/2}\\sin^nx\\,dx).",
      "Written out: \\dfrac\\pi2=\\dfrac21\\cdot\\dfrac23\\cdot\\dfrac43\\cdot\\dfrac45\\cdot\\dfrac65\\cdot\\dfrac67\\cdots — one substitution, x=\\dfrac12, is all it took.",
    ],
    result: "\\frac\\pi2=\\prod_{n=1}^\\infty\\frac{2n}{2n-1}\\cdot\\frac{2n}{2n+1}",
  },
  {
    integrand: "\\frac{-\\ln x}{1-x^2} \\text{ on } [0,1]",
    work: [
      "This is a genuine integral, not the product itself — but the number it produces is one the sine product already handed us. Expand \\dfrac1{1-x^2} as a geometric series: \\dfrac1{1-x^2}=\\displaystyle\\sum_{k=0}^\\infty x^{2k} for 0\\le x<1 — it only ever touches the EVEN powers of x.",
      "Integrate term by term (a separate, standard move — justified the same way it is anywhere a geometric series sits under an integral sign: every term is positive, so there's nothing to rearrange). By parts with u=-\\ln x,\\ dv=x^{2k}\\,dx,\\ v=\\dfrac{x^{2k+1}}{2k+1}: the boundary term vanishes at both ends (x^{2k+1}\\ln x\\to0 as x\\to0^+, and \\ln1=0), leaving \\displaystyle\\int_0^1x^{2k}(-\\ln x)\\,dx=\\dfrac1{2k+1}\\int_0^1x^{2k}\\,dx=\\dfrac1{(2k+1)^2}.",
      "Summing over k: \\displaystyle\\int_0^1\\frac{-\\ln x}{1-x^2}\\,dx=\\sum_{k=0}^\\infty\\frac1{(2k+1)^2}=\\frac1{1^2}+\\frac1{3^2}+\\frac1{5^2}+\\cdots — exactly the ODD-indexed half of \\sum\\frac1{n^2}.",
      "Split \\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}=\\frac{\\pi^2}6 (this lesson's own first result) into its even- and odd-indexed parts: the even ones, \\dfrac1{(2m)^2}, sum to \\dfrac14\\cdot\\dfrac{\\pi^2}6=\\dfrac{\\pi^2}{24}, so the odd ones sum to whatever's left: \\dfrac{\\pi^2}6-\\dfrac{\\pi^2}{24}=\\dfrac{4\\pi^2-\\pi^2}{24}=\\dfrac{3\\pi^2}{24}=\\dfrac{\\pi^2}8.",
    ],
    result: "\\frac{\\pi^2}8",
    integrandExpr: "-log(x)/(1-x^2)",
    resultExpr: "pi^2/8",
    domain: [0, 1],
    kind: "definite",
  },
];

const SINE_PRODUCT_COMPLETIONS: Completion[] = [
  {
    setup: [
      "Write the sine product at argument 2x instead of x: \\dfrac{\\sin(2\\pi x)}{2\\pi x}=\\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{4x^2}{n^2}\\right). Using the double-angle identity \\sin(2\\pi x)=2\\sin(\\pi x)\\cos(\\pi x) and dividing both sides by the ORIGINAL sine product at x, \\dfrac{\\sin(\\pi x)}{\\pi x}=\\displaystyle\\prod_{m=1}^\\infty\\left(1-\\frac{x^2}{m^2}\\right), gives \\cos(\\pi x)=\\dfrac{\\prod_{n=1}^\\infty\\left(1-\\frac{4x^2}{n^2}\\right)}{\\prod_{m=1}^\\infty\\left(1-\\frac{x^2}{m^2}\\right)}.",
      "Split the numerator's index n by parity. The EVEN terms, n=2k, give \\left(1-\\dfrac{4x^2}{(2k)^2}\\right)=\\left(1-\\dfrac{x^2}{k^2}\\right) — literally the same factors as the denominator, one for one.",
    ],
    blank: "Cancel the even-indexed half of the numerator against the whole denominator, and name what's left over.",
    answer:
      "The even half cancels the denominator exactly, leaving only the ODD-indexed factors: \\cos(\\pi x)=\\displaystyle\\prod_{k=1}^\\infty\\left(1-\\frac{4x^2}{(2k-1)^2}\\right) — the cosine product formula, built by exactly the same argument as \\sin's, just running over the odd integers instead of all of them.",
  },
  {
    setup: [
      "\\displaystyle\\int_0^1\\frac{x^2(-\\ln x)}{1-x^2}\\,dx — the same geometric series as the lesson's own worked example, shifted by two powers: \\dfrac{x^2}{1-x^2}=x^2\\displaystyle\\sum_{k=0}^\\infty x^{2k}=\\sum_{k=0}^\\infty x^{2k+2}, and termwise \\displaystyle\\int_0^1x^{2k+2}(-\\ln x)\\,dx=\\dfrac1{(2k+3)^2} (the same by-parts lemma, one index further along).",
      "So the integral is \\displaystyle\\sum_{k=0}^\\infty\\frac1{(2k+3)^2}=\\frac1{3^2}+\\frac1{5^2}+\\frac1{7^2}+\\cdots — the SAME odd-square sum as the lesson's own worked example, just missing its very first term.",
    ],
    blank: "Don't re-sum from scratch — relate this to the \\frac{\\pi^2}8 already found, above.",
    answer:
      "This is \\dfrac{\\pi^2}8 (the full odd-square sum) with the n=1 term, \\dfrac1{1^2}=1, removed: \\displaystyle\\sum_{k=0}^\\infty\\frac1{(2k+3)^2}=\\dfrac{\\pi^2}8-1.",
    integrandExpr: "x^2*(-log(x))/(1-x^2)",
    resultExpr: "pi^2/8 - 1",
    domain: [0, 1],
    kind: "definite",
  },
];

export const SineProduct: Technique = {
  id: "sine-product",
  name: "The sine product formula",
  tagline:
    "Guess \\sin(\\pi x) as an infinite product over its own roots, pairing \\pm n so it converges — Euler's guess, proved a century later by Weierstrass, and the direct route to \\sum\\frac1{n^2}=\\frac{\\pi^2}6.",
  prerequisites: ["The Taylor series of \\sin x", "Zeta-series integrals", "Wallis integrals"],
  whenToUse:
    "A problem states \\dfrac{\\sin(\\pi x)}{\\pi x}=\\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right) outright, or asks WHERE \\sum\\frac1{n^2}=\\frac{\\pi^2}6 or the Wallis product actually come from — not just their value, which Zeta-series integrals and Wallis integrals already hand you by completely different routes (a geometric series in e^{-x}, and a squeeze on \\int\\sin^nx), but why \\pi enters at all into what starts out as a bare statement about where \\sin(\\pi x) vanishes.",
  intuition:
    "A polynomial of degree n is completely pinned down, up to one overall constant, by its roots: p(x)=c(x-r_1)(x-r_2)\\cdots(x-r_n). \\sin(\\pi x) is not a polynomial, but its Taylor series \\sin(\\pi x)=\\pi x-\\dfrac{(\\pi x)^3}6+\\dfrac{(\\pi x)^5}{120}-\\cdots never terminates — it behaves, term by term, like a polynomial of infinite degree. Euler's leap in 1735 was to guess that the same root-factoring idea still applies to a function like this. \\sin(\\pi x) vanishes at exactly the integers, x=0,\\pm1,\\pm2,\\ldots, so the natural guess is a product running over those roots, with the root at x=0 already accounted for by the plain factor of x sitting out front (that's the \\pi x you're dividing by). Pairing the root at +n with the root at -n keeps everything real and keeps the product from blowing up: rescaling (x-n)(x+n) by -n^2 gives 1-\\dfrac{x^2}{n^2}, a factor that equals 1 at x=0, vanishes at x=\\pm n exactly where it should, and shrinks toward 1 fast enough as n\\to\\infty (like 1-O(1/n^2)) that multiplying infinitely many of them together genuinely converges to a finite number rather than to 0 or to nonsense. That's the whole guess: \\dfrac{\\sin(\\pi x)}{\\pi x}=\\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right). It matches the Taylor series term by term — you'll check the x^2 term yourself below — and it reproduces \\sin at every integer and half-integer you can check by hand. But matching finitely many terms is not a proof that an ENTIRE function is determined by its zeros with nothing left over: a general function with the same zeros could still differ from this product by a factor like e^{g(x)} that has no zeros of its own and never announces itself in any finite calculation. Euler had no way to rule that out, and he knew it — this was a spectacular, admitted guess, not a derivation. It took until 1876, over a century later, for Weierstrass to build the general theory of factoring functions by their zeros and confirm that for \\sin(\\pi x) specifically, no such extra factor is needed. Treat the formula the way this lesson does: a genuinely inspired guess that turned out to be exactly true — worth remembering as real history, not as an obvious algebraic identity you could have written down yourself.",
  recipe: [
    "Take the identity as given: \\dfrac{\\sin(\\pi x)}{\\pi x}=\\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right), valid for every real x. It isn't something to re-derive from scratch in competition — cite it the way \\Gamma\\!\\left(\\frac12\\right)=\\sqrt\\pi gets cited elsewhere, once you've seen where it comes from (above).",
    "To pull a NUMERICAL SERIES out of it (like \\sum\\frac1{n^2}), expand both sides as power series in x and compare the coefficient of the SAME power of x on each side — x^2 is the one that matters here, the lowest power beyond the constant term 1.",
    "On the left, \\sin(\\pi x)=\\pi x-\\dfrac{(\\pi x)^3}6+O(x^5), so \\dfrac{\\sin(\\pi x)}{\\pi x}=1-\\dfrac{\\pi^2x^2}6+O(x^4).",
    "On the right, expanding the product to first order in x^2 only ever picks out the linear term of ONE factor at a time — any cross term between two different factors (n\\neq m) contributes an x^4, not an x^2 — so to this order \\displaystyle\\prod_{n=1}^\\infty\\left(1-\\frac{x^2}{n^2}\\right)=1-x^2\\sum_{n=1}^\\infty\\frac1{n^2}+O(x^4).",
    "Equate the x^2 coefficients: -\\dfrac{\\pi^2}6=-\\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}, so \\displaystyle\\sum_{n=1}^\\infty\\frac1{n^2}=\\dfrac{\\pi^2}6 — the Basel problem, solved in three lines once you have the product.",
    "For the Wallis product, don't compare coefficients at all — plug in a SPECIFIC number instead. x=\\frac12 makes \\sin(\\pi x)=\\sin\\frac\\pi2=1 exactly, turning the identity into a numerical statement about the product itself rather than about its coefficients.",
  ],
  example: SINE_PRODUCT_EXAMPLES[0],
  examples: SINE_PRODUCT_EXAMPLES,
  pitfalls: [
    "The product runs over n\\geq1 only — the root at x=0 is already divided out by the \\pi x sitting in the denominator. There is no n=0 factor to add back in.",
    "Coefficient-matching only means something once BOTH sides are expanded to the SAME power of x. The classic slip is a dropped sign: the product's x^2 coefficient is -\\sum\\frac1{n^2} (one minus sign, from the -\\frac{x^2}{n^2} inside each factor), not +\\sum\\frac1{n^2} — get that wrong and \\frac{\\pi^2}6 comes out negative.",
    "\\left(1-\\frac{x^2}{n^2}\\right) is one indivisible factor per n — never split it back into \\left(1-\\frac xn\\right)\\left(1+\\frac xn\\right) and regroup pieces across different values of n. The pairing is exactly what makes the product well-behaved (each factor is 1-O(1/n^2), and \\sum\\frac1{n^2} converges, so the paired product is safe to rearrange freely); the raw, unpaired linear factors decay only like 1-O(1/n), and \\sum\\frac1n diverges, so multiplying those in some other grouping is not guaranteed to reach the same answer, or to converge at all.",
    "Two conventions for this formula both circulate — \\dfrac{\\sin(\\pi x)}{\\pi x}=\\prod\\left(1-\\frac{x^2}{n^2}\\right) (this lesson, roots at the integers) and \\dfrac{\\sin x}x=\\prod\\left(1-\\frac{x^2}{n^2\\pi^2}\\right) (the same formula, rescaled so the roots sit at integer multiples of \\pi). Mixing up which one a problem is using misplaces every \\pi in the final answer — check which variable is actually in play before touching the formula.",
  ],
  checkYourself: {
    prompt: "\\text{Extend the } x^2 \\text{ comparison to } x^4 \\text{ and find } \\sum_{n=1}^\\infty\\frac1{n^4}",
    answer: "\\frac{\\pi^4}{90}",
    hint:
      "The x^4 coefficient on the left is +\\dfrac{\\pi^4}{120} (the next term of \\sin(\\pi x)/(\\pi x)'s Taylor series). On the right, the x^4 coefficient is the sum over every PAIR n<m of \\dfrac1{n^2m^2} — which Newton's identity writes in terms of things you already have: \\displaystyle\\sum_{n<m}\\frac1{n^2m^2}=\\frac12\\left[\\left(\\sum\\frac1{n^2}\\right)^{\\!2}-\\sum\\frac1{n^4}\\right]. Set the two x^4 coefficients equal and solve for \\sum\\frac1{n^4}.",
  },
  completions: SINE_PRODUCT_COMPLETIONS,
  selfExplain: {
    prompt:
      "The lesson finds \\sum\\frac1{n^2}=\\frac{\\pi^2}6 by comparing TAYLOR COEFFICIENTS, but finds the Wallis product by plugging in a SPECIFIC VALUE, x=\\frac12. Both start from the exact same identity. Why doesn't plugging in a specific x also hand you \\sum\\frac1{n^2} directly — and why doesn't comparing coefficients hand you the Wallis product?",
    answer:
      "\\sum\\frac1{n^2} is a statement about the COEFFICIENTS themselves — an infinite family of numbers baked into the shape of the function near x=0. Plugging in any one specific x only ever gives ONE equation mixing all of those coefficients together, weighted by different powers of that x; there's no way to un-mix them back into a single coefficient without comparing power series term by term, which is exactly what taking x\\to0 with the SHAPE of the series (not a numeric value) does. The Wallis product runs the other way: it's a statement about the product's VALUE at one specific point, x=\\frac12, where \\sin(\\pi x) happens to equal the plain number 1 — there's no 'coefficient' to speak of, because \\frac12 isn't a small parameter being expanded, it's a fixed number being substituted into an already-infinite product. The two extraction methods pull genuinely different kinds of information out of the same identity — one needs the local SHAPE near x=0, the other needs a single GLOBAL value — and each target only yields to the one built for it.",
  },
};

export default SineProduct;
