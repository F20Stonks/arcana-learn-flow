/**
 * UK University Integration Bee syllabus §1.5 — "Infinite series and their use in evaluating
 * integrals, swapping an integral and an infinite sum — issues of convergence won't be
 * considered."
 *
 * This is the GENERAL technique. Two specific instances are already taught elsewhere in the
 * curriculum and are deliberately not repeated here — see the intuition paragraph, which cites
 * both by name: "Zeta-series integrals" (expanding 1/(e^x∓1) as a geometric series in e^{-x}) and
 * "Log-power integrals" (∫₀¹xⁿlnᵏx dx, reached there by a differentiation trick that turns out to
 * be the same swap in disguise). This lesson teaches the recognition and execution in general —
 * which of four standard expansions to reach for, how to swap and integrate the general term, and
 * how to recognise the resulting numerical series — using its own worked examples throughout.
 */
import type { Completion, Technique, WorkedExample } from "../types";

const example0: WorkedExample = {
  integrand: "\\frac{-\\ln x}{1-x} \\text{ on } [0,1]",
  work: [
    "For 0<x<1, \\frac1{1-x}=\\sum_{n=0}^\\infty x^n — the geometric series, valid throughout the interior of the interval since |x|<1.",
    "Multiply by -\\ln x and swap \\int and \\Sigma: \\int_0^1\\frac{-\\ln x}{1-x}\\,dx=\\sum_{n=0}^\\infty\\int_0^1(-\\ln x)\\,x^n\\,dx.",
    "Integrate the general term by parts, spelling out even the obvious steps: u=-\\ln x,\\ dv=x^n\\,dx, so du=-\\frac1x\\,dx and v=\\frac{x^{n+1}}{n+1}, giving \\int_0^1(-\\ln x)x^n\\,dx=\\left[\\frac{-x^{n+1}\\ln x}{n+1}\\right]_0^1+\\frac1{n+1}\\int_0^1x^n\\,dx.",
    "Both boundary values vanish — \\ln1=0 at x=1, and x^{n+1}\\ln x\\to0 as x\\to0^+ since the power beats the log — leaving \\frac1{n+1}\\cdot\\frac1{n+1}=\\frac1{(n+1)^2} for every term.",
    "Sum over n: \\sum_{n=0}^\\infty\\frac1{(n+1)^2}=\\sum_{m=1}^\\infty\\frac1{m^2}=\\zeta(2)=\\frac{\\pi^2}6 — the same Basel value Zeta-series integrals uses, and this same x^n\\ln x integral is exactly the n,\\,k=1 case of Log-power integrals' own formula.",
  ],
  result: "\\frac{\\pi^2}6",
  integrandExpr: "-log(x)/(1-x)",
  resultExpr: "pi^2/6",
  domain: [0, 1],
  kind: "definite",
};

const example1: WorkedExample = {
  integrand: "\\ln x\\,\\ln(1-x) \\text{ on } [0,1]",
  work: [
    "Expand the LOGARITHM series this time: \\ln(1-x)=-\\sum_{n=1}^\\infty\\frac{x^n}n, so \\int_0^1\\ln x\\ln(1-x)\\,dx=-\\sum_{n=1}^\\infty\\frac1n\\int_0^1x^n\\ln x\\,dx.",
    "The inner integral is Example 1's own result, one index up: \\int_0^1x^n\\ln x\\,dx=-\\frac1{(n+1)^2}, so every term of the sum is \\frac1{n(n+1)^2}.",
    "Recognise the sum with partial fractions: \\frac1{n(n+1)^2}=\\frac1n-\\frac1{n+1}-\\frac1{(n+1)^2}, so \\sum_{n=1}^\\infty\\frac1{n(n+1)^2}=\\sum_{n=1}^\\infty\\left(\\frac1n-\\frac1{n+1}\\right)-\\sum_{n=1}^\\infty\\frac1{(n+1)^2}.",
    "The first sum telescopes to 1; the second is \\zeta(2)-1 (every term of \\zeta(2) except the n=1 term). So the total is 1-(\\zeta(2)-1)=2-\\zeta(2)=2-\\frac{\\pi^2}6.",
  ],
  result: "2-\\frac{\\pi^2}6",
  integrandExpr: "log(x)*log(1-x)",
  resultExpr: "2 - pi^2/6",
  domain: [0, 1],
  kind: "definite",
};

const example2: WorkedExample = {
  integrand: "x^x \\text{ on } [0,1]",
  work: [
    "x^x=e^{x\\ln x}=\\sum_{n=0}^\\infty\\frac{(x\\ln x)^n}{n!} — the exponential series, the third of the four expansions, applied to the whole exponent at once.",
    "Swap and integrate the general term: \\int_0^1x^x\\,dx=\\sum_{n=0}^\\infty\\frac1{n!}\\int_0^1x^n\\ln^nx\\,dx.",
    "That inner integral is exactly Log-power integrals' own formula, with the power and the log-power both set to the same n: \\int_0^1x^n\\ln^nx\\,dx=\\frac{(-1)^nn!}{(n+1)^{n+1}}.",
    "The n! cancels the \\frac1{n!} outright, leaving \\sum_{n=0}^\\infty\\frac{(-1)^n}{(n+1)^{n+1}}. Reindexing m=n+1 turns (-1)^n into (-1)^{m-1}=(-1)^{m+1}, giving \\sum_{m=1}^\\infty\\frac{(-1)^{m+1}}{m^m} — the sophomore's dream, no simpler closed form known.",
  ],
  result: "\\sum_{n=1}^\\infty\\frac{(-1)^{n+1}}{n^n}\\approx0.783430\\ldots",
  domain: [0, 1],
  kind: "definite",
};

const completion0: Completion = {
  setup: [
    "\\int_0^1\\frac{\\ln(1+x)}x\\,dx — expand the log series with u=x (not -x this time): \\ln(1+x)=\\sum_{n=1}^\\infty(-1)^{n+1}\\frac{x^n}n.",
    "Divide by x and swap: \\int_0^1\\frac{\\ln(1+x)}x\\,dx=\\sum_{n=1}^\\infty\\frac{(-1)^{n+1}}n\\int_0^1x^{n-1}\\,dx=\\sum_{n=1}^\\infty\\frac{(-1)^{n+1}}{n^2}.",
  ],
  blank:
    "Recognise \\sum_{n=1}^\\infty\\frac{(-1)^{n+1}}{n^2} — the same odd/even split that Zeta-series integrals uses to turn \\zeta(4) into \\eta(4) works here on \\zeta(2).",
  answer:
    "Splitting \\zeta(2)=\\sum\\frac1{k^2} into even- and odd-indexed terms, the even ones sum to \\frac14\\zeta(2), so this alternating sum (odd minus even) is \\eta(2)=\\left(1-\\frac12\\right)\\zeta(2)=\\frac12\\cdot\\frac{\\pi^2}6=\\frac{\\pi^2}{12}.",
  integrandExpr: "log(1+x)/x",
  resultExpr: "pi^2/12",
  domain: [0, 1],
  kind: "definite",
};

const completion1: Completion = {
  setup: [
    "\\int_0^1\\frac{\\ln(1-x^2)}x\\,dx — the expansion variable is u=x^2 here, not plain x: \\ln(1-x^2)=-\\sum_{n=1}^\\infty\\frac{(x^2)^n}n=-\\sum_{n=1}^\\infty\\frac{x^{2n}}n.",
    "Divide by x — this is exactly the pitfall about a rescaled expansion variable: the general term is \\frac{x^{2n-1}}n, not \\frac{x^{n-1}}n. Swapping gives \\int_0^1\\frac{\\ln(1-x^2)}x\\,dx=-\\sum_{n=1}^\\infty\\frac1n\\int_0^1x^{2n-1}\\,dx.",
  ],
  blank: "Integrate the general term x^{2n-1} over [0,1] and recognise the resulting sum.",
  answer:
    "\\int_0^1x^{2n-1}\\,dx=\\frac1{2n}, so the sum is -\\sum_{n=1}^\\infty\\frac1{2n^2}=-\\frac12\\zeta(2)=-\\frac{\\pi^2}{12} — exactly half of Example 1's constant, with the sign flipped by the leading minus already sitting in the log series.",
  integrandExpr: "log(1-x^2)/x",
  resultExpr: "-pi^2/12",
  domain: [0, 1],
  kind: "definite",
};

export const SeriesSwap: Technique = {
  id: "series-swap",
  name: "Swapping a sum and an integral",
  tagline:
    "No antiderivative for the whole integrand? Expand it as a power series, integrate the easy general term, then recognise the sum you're left with.",
  prerequisites: [
    "Standard forms",
    "The Maclaurin series for \\frac1{1-x}, e^x and \\ln(1+x) — knowing each on sight is most of the recognition step",
  ],
  whenToUse:
    "The integrand is built from \\frac1{1-u}, e^u, \\ln(1+u), or (1+u)^r for some expression u(x) — often BECAUSE nothing else works: x^x, \\frac{\\ln x}{1-x} and \\frac{\\ln(1+x)}x are the classic tells, integrands with no elementary antiderivative of their own that are nonetheless built entirely out of things you can expand. If you can picture replacing that one piece with \\sum_n(\\text{something})_n and integrating each numbered piece on its own, this is the technique.",
  intuition:
    "An integrand can fail to have an elementary antiderivative at all — not merely hard to find, genuinely absent, the same way \\int e^{-x^2}\\,dx and \\int x^x\\,dx both are — and still be perfectly integrable term by term, because it is secretly an infinite SUM of pieces that each integrate on sight. Four expansions are worth knowing without looking them up: \\frac1{1-u}=\\sum_{n=0}^\\infty u^n (geometric), e^u=\\sum_{n=0}^\\infty\\frac{u^n}{n!}, \\ln(1+u)=\\sum_{n=1}^\\infty(-1)^{n+1}\\frac{u^n}n, and the binomial series (1+u)^r=\\sum_{n=0}^\\infty\\binom{r}{n}u^n for any real r, not just an integer. Spot one of these hiding in the integrand, write out its n-th term explicitly, and \\int\\sum=\\sum\\int lets you integrate that term — usually a plain power of x, or a power of x times \\ln x — instead of the original expression. What is left afterward is a bookkeeping problem in n, not a calculus problem: reassemble the sum and recognise it, which is exactly the step that separates this technique from merely getting a sum and giving up. You have actually used this move twice already without the name attached to it: Zeta-series integrals expands \\frac1{e^x\\mp1} as a geometric series in e^{-x} before integrating term by term over (0,\\infty); Log-power integrals reaches \\int_0^1x^n\\ln^kx\\,dx by a different-looking route — differentiating \\int_0^1x^a\\,dx repeatedly in a — but that route is secretly the SAME swap, run through the exponential series: x^a=e^{a\\ln x}=\\sum_k\\frac{(a\\ln x)^k}{k!}, and matching powers of a on both sides of \\int_0^1x^a\\,dx=\\frac1{a+1} after expanding the left side this way is Feynman's trick and series-swap collapsing into the same computation.",
  recipe: [
    "Spot one of the four expansions inside the integrand — \\frac1{1-u}, e^u, \\ln(1+u), or (1+u)^r — for some sub-expression u(x), usually because nothing else touches the integrand directly.",
    "Write out the general (n-th) term explicitly, keeping anything already sitting outside the expansion — a power of x, a sign — attached to it.",
    "Swap \\int and \\Sigma, and integrate the general term on its own. This is now an ordinary integral in x for each fixed n, almost always \\int_0^1x^m\\,dx or \\int_0^1x^m\\ln x\\,dx.",
    "Reassemble the result as a sum in n. Get the index right after any shift (n\\to n\\pm1), and don't drop a factor introduced by u(x) itself when it isn't plain x — u=x^2 or u=-x rescales every single term.",
    "Recognise the resulting numerical series: a geometric sum, \\zeta(2)=\\frac{\\pi^2}6 or a value built from it, \\ln2, or — occasionally, and that's fine — the series itself, when no simpler closed form for that particular sum is known.",
  ],
  example: example0,
  examples: [example0, example1, example2],
  pitfalls: [
    "Swapping \\int and \\Sigma is only justified when the series converges (absolutely, and without blowing up) across the WHOLE interval, not just wherever you first checked it. This syllabus doesn't examine the justification, but a series that only converges strictly inside (0,1), needing separate care at an endpoint you're integrating through, can silently swap to the wrong number if you don't notice.",
    "Getting the index start wrong after integrating is the single most common slip: \\sum_{n=0}^\\infty and \\sum_{n=1}^\\infty differ by exactly one term, and a reindexing shift like n\\to n+1 (to tidy an exponent) has to carry the starting index along with it.",
    "If the expansion variable is x^2, -x or 2x rather than plain x, every term picks up an extra factor once you actually integrate it — \\int_0^1(x^2)^n\\,dx=\\frac1{2n+1}, not \\frac1{n+1} — so write the general term out in x explicitly before integrating; don't integrate the abstract u^n and forget to convert back.",
    "Not every resulting sum has a name. Landing on a genuinely unfamiliar series isn't a sign you made a mistake — it might just be the answer, exactly as in the flagship example below, or a sign to try expanding a different piece of the same integrand.",
  ],
  checkYourself: {
    prompt: "x\\ln(1-x) \\text{ on } [0,1]",
    answer: "-\\frac34",
    hint: "\\ln(1-x)=-\\sum_{n=1}^\\infty\\frac{x^n}n — multiply by x first: the general term becomes -\\frac1{n(n+2)}, which telescopes just like the partial fractions in Example 2.",
  },
  completions: [completion0, completion1],
  selfExplain: {
    prompt:
      "The pitfalls warn that swapping \\int and \\Sigma needs the series to actually converge, not just look right algebraically. Yet the flagship example ends on \\sum_{n=1}^\\infty\\frac{(-1)^{n+1}}{n^n} — an infinite sum with no \\pi, e or algebraic simplification available. Why does that still count as the technique succeeding, rather than as x^x being 'unintegrable'?",
    answer:
      "A closed-form ANTIDERIVATIVE for x^x genuinely doesn't exist among elementary functions — not a case of 'not yet found,' but provably absent, the same kind of fact behind e^{-x^2} and \\frac{\\sin x}x having none either. So there was never an F(x) to evaluate at the endpoints; the technique's actual target was always the NUMBER \\int_0^1x^x\\,dx equals, not a formula for it. The series does exactly that: every term is an explicit rational number, and \\frac1{n^n}\\to0 far faster than any \\frac1{n^p} does, so the sum converges quickly enough to compute to any precision you like. 'Closed form' is really shorthand for 'an expression you can evaluate exactly' — a rapidly convergent, exactly specified infinite series does that just as legitimately as \\frac{\\pi^2}6 does; it's simply a less familiar-looking kind of answer.",
  },
};
