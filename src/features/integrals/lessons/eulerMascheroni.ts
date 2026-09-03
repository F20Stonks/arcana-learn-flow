import type { Technique, WorkedExample } from "../types";

const EULER_MASCHERONI_EXAMPLES: WorkedExample[] = [
  {
    integrand: "e^{-x}\\ln x \\text{ on } [0,\\infty)",
    work: [
      "This is \\Gamma'(1) in disguise. \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx, and differentiating under the integral sign with respect to the PARAMETER s — the log-power-integrals move, aimed at a Gamma-type integral instead of \\int_0^1x^a\\,dx — brings down exactly one factor of \\ln x, since \\frac{\\partial}{\\partial s}x^{s-1}=x^{s-1}\\ln x. So \\Gamma'(s)=\\int_0^\\infty x^{s-1}\\ln x\\,e^{-x}\\,dx, and setting s=1 gives \\Gamma'(1)=\\int_0^\\infty e^{-x}\\ln x\\,dx exactly — the target integral, relabelled.",
      "\\Gamma'(1) is pinned down by Gauss's limit formula for \\Gamma, derived in the intuition above: logarithmically differentiating \\Gamma(s)=\\lim_{n\\to\\infty}\\frac{n^s\\,n!}{s(s+1)\\cdots(s+n)} and setting s=1 gives \\psi(1)=\\frac{\\Gamma'(1)}{\\Gamma(1)}=\\lim_{n\\to\\infty}\\left(\\ln n-H_{n+1}\\right)=-\\gamma, the SAME limit as the harmonic-sum picture, just reached by differentiating \\Gamma's own defining limit instead of comparing rectangles to an integral directly.",
      "Since \\Gamma(1)=\\int_0^\\infty e^{-x}\\,dx=1 (the Gamma-function lesson's base case), \\Gamma'(1)=\\Gamma(1)\\psi(1)=1\\cdot(-\\gamma)=-\\gamma. So \\int_0^\\infty e^{-x}\\ln x\\,dx=-\\gamma.",
    ],
    result: "-\\gamma",
    integrandExpr: "exp(-x)*log(x)",
    resultExpr: "-0.5772156649015329",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\ln\\!\\left(\\ln\\frac1x\\right) \\text{ on } [0,1]",
    work: [
      "Substitute x=e^{-u}: as x runs from 0 to 1, u runs from \\infty down to 0, and dx=-e^{-u}\\,du. Also \\ln\\frac1x=\\ln(e^u)=u, so the integrand \\ln\\!\\left(\\ln\\frac1x\\right) becomes the plain \\ln u.",
      "\\int_0^1\\ln\\!\\left(\\ln\\frac1x\\right)dx=\\int_{u=\\infty}^{0}\\ln u\\,(-e^{-u})\\,du=\\int_0^\\infty e^{-u}\\ln u\\,du — flipping the limits of integration absorbs the leftover minus sign from dx.",
      "That's exactly Example 1's integral with u in place of x: \\int_0^\\infty e^{-u}\\ln u\\,du=-\\gamma. The substitution x=e^{-u} didn't produce a NEW fact — it just relabelled the same one.",
    ],
    result: "-\\gamma",
    integrandExpr: "log(-log(x))",
    resultExpr: "-0.5772156649015329",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "\\left(\\frac1{1-e^{-x}}-\\frac1x\\right)e^{-x} \\text{ on } [0,\\infty)",
    work: [
      "Two Laplace-type representations turn both halves of the DEFINING limit into integrals over the same variable x. First, \\frac1k=\\int_0^\\infty e^{-kx}\\,dx (the Gamma-function lesson's base case, run at rate k), so summing the finite geometric series \\sum_{k=1}^ne^{-kx}=\\frac{e^{-x}(1-e^{-nx})}{1-e^{-x}} gives H_n=\\int_0^\\infty\\frac{e^{-x}\\left(1-e^{-nx}\\right)}{1-e^{-x}}\\,dx.",
      "Second, Frullani's integral: K(a)=\\int_0^\\infty\\frac{e^{-x}-e^{-ax}}x\\,dx has K(1)=0 and K'(a)=\\int_0^\\infty e^{-ax}\\,dx=\\frac1a (the x in the denominator cancels the x the parameter-differentiation brings down, the log-power-integrals move again), so K(a)=\\ln a. Setting a=n: \\ln n=\\int_0^\\infty\\frac{e^{-x}-e^{-nx}}x\\,dx.",
      "Subtract the two: H_n-\\ln n=\\int_0^\\infty\\left[\\frac{e^{-x}(1-e^{-nx})}{1-e^{-x}}-\\frac{e^{-x}-e^{-nx}}x\\right]dx. For every fixed x>0, e^{-nx}\\to0 as n\\to\\infty, so the bracket tends pointwise to \\frac{e^{-x}}{1-e^{-x}}-\\frac{e^{-x}}x=\\left(\\frac1{1-e^{-x}}-\\frac1x\\right)e^{-x}. Taking the limit inside the integral turns the DEFINING limit itself into this single integral: \\gamma=\\lim_{n\\to\\infty}(H_n-\\ln n)=\\int_0^\\infty\\left(\\frac1{1-e^{-x}}-\\frac1x\\right)e^{-x}\\,dx.",
    ],
    result: "\\gamma",
    integrandExpr: "(1/(1-exp(-x)) - 1/x)*exp(-x)",
    resultExpr: "0.5772156649015329",
    domain: [0, Infinity],
    kind: "definite",
  },
];

export const EulerMascheroni: Technique = {
  id: "euler-mascheroni",
  name: "The Euler-Mascheroni constant",
  tagline:
    "\\gamma=\\lim_{n\\to\\infty}\\left(H_n-\\ln n\\right)\\approx0.5772156649015329 — the one genuinely new constant, besides \\pi and e, that appears whenever a logarithm meets the Gamma function.",
  prerequisites: ["The Gamma function", "Log-power integrals"],
  whenToUse:
    "You differentiate a \\Gamma-type integral \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx with respect to the parameter s and land at s=1 — bringing down a lone \\ln x factor exactly where \\Gamma takes its simplest value, 1 — or you meet \\ln\\!\\left(\\ln\\frac1x\\right) inside an integral over (0,1), or a bare harmonic sum H_n sits right next to \\ln n. Any of these is \\gamma trying to appear: it's the one genuinely NEW numerical constant this syllabus asks you to recognise on sight, alongside \\pi and e.",
  intuition:
    "Two things diverge here, and their difference doesn't. Picture \\frac1x on [1,n] and its left-endpoint rectangle approximation with unit width: heights \\frac11,\\frac12,\\ldots,\\frac1{n-1} over the n-1 unit intervals covering [1,n], summing to H_{n-1}. Because \\frac1x is DECREASING, every rectangle sits entirely above the curve on its own interval, so this rectangle sum overshoots the true area \\int_1^n\\frac{dx}x=\\ln n on every single interval. Look at just one sliver, [k,k+1]: the rectangle contributes \\frac1k, the true area there is \\int_k^{k+1}\\frac{dx}x=\\ln\\!\\left(1+\\frac1k\\right), so the overshoot on that one sliver is a_k=\\frac1k-\\ln\\!\\left(1+\\frac1k\\right). Expanding \\ln(1+t)=t-\\frac{t^2}2+O(t^3) at t=\\frac1k gives a_k=\\frac1k-\\left(\\frac1k-\\frac1{2k^2}+O\\!\\left(\\frac1{k^3}\\right)\\right)=\\frac1{2k^2}+O\\!\\left(\\frac1{k^3}\\right): each individual sliver shrinks like \\frac1{k^2}, and \\sum\\frac1{k^2} converges (compare it to \\int_1^\\infty\\frac{dx}{x^2}=1). So the TOTAL overshoot \\sum_{k=1}^\\infty a_k is a genuinely convergent sum of shrinking slivers, even though H_{n-1} and \\ln n individually run off to infinity. That sum IS \\gamma: \\sum_{k=1}^\\infty a_k=\\lim_{n\\to\\infty}(H_{n-1}-\\ln n)=\\lim_{n\\to\\infty}(H_n-\\ln n) (H_n and H_{n-1} differ by \\frac1n\\to0, so the limit doesn't care which one you use) — the little sliver of area any left-endpoint approximation of a decreasing curve is doomed to leave overhanging the true area, added up all the way out to infinity.\n\nThis is also exactly why \\gamma appears inside \\Gamma-integrals whenever a \\ln x factor gets brought down at the base case s=1. Extend Beta function integrals' own identity \\int_0^1t^{s-1}(1-t)^n\\,dt=\\frac{n!}{s(s+1)\\cdots(s+n)} (that lesson's recipe already notes it holds for general s, not just integer exponents) by substituting t=\\frac xn, so dt=\\frac{dx}n and t\\in[0,1] becomes x\\in[0,n]: the left side becomes n^{-s}\\int_0^nx^{s-1}\\left(1-\\frac xn\\right)^n\\,dx, so \\int_0^nx^{s-1}\\left(1-\\frac xn\\right)^n\\,dx=\\frac{n^s\\,n!}{s(s+1)\\cdots(s+n)}. As n\\to\\infty, \\left(1-\\frac xn\\right)^n\\to e^{-x} (the same limit behind e=\\lim(1+\\frac1n)^n) and the domain stretches to (0,\\infty), turning this into Gauss's limit formula for the Gamma function itself: \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx=\\lim_{n\\to\\infty}\\frac{n^s\\,n!}{s(s+1)\\cdots(s+n)}. Take logs and differentiate with respect to the parameter s — the log-power-integrals move, applied to a whole product instead of a single power: \\psi(s):=\\frac{d}{ds}\\ln\\Gamma(s)=\\lim_{n\\to\\infty}\\left(\\ln n-\\sum_{k=0}^n\\frac1{s+k}\\right). Set s=1: the sum \\sum_{k=0}^n\\frac1{1+k}=\\sum_{j=1}^{n+1}\\frac1j=H_{n+1}, so \\psi(1)=\\lim_{n\\to\\infty}(\\ln n-H_{n+1})=-\\lim_{n\\to\\infty}(H_{n+1}-\\ln n)=-\\gamma — the exact same limit as the rectangle picture above, reached this time by differentiating \\Gamma's own defining limit instead of comparing rectangles to an integral directly. Since \\Gamma(1)=1, \\Gamma'(1)=\\Gamma(1)\\psi(1)=-\\gamma: differentiate \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx under the integral sign and evaluate at s=1, and \\gamma is what falls out. Beta function integrals' own digamma trick uses \\psi(n)=-\\gamma+H_{n-1} for a positive integer n; at n=1 (where H_0 is the empty sum, 0) that formula reads \\psi(1)=-\\gamma — this constant walking back out of a place you've already used it, not a new fact to learn.",
  recipe: [
    "Ground the constant first: \\gamma=\\lim_{n\\to\\infty}(H_n-\\ln n)\\approx0.5772156649015329, the total overshoot of the harmonic sum's rectangles above \\ln n — a single fixed number, not a function of anything (see the intuition above for why the limit exists at all).",
    "Recognise it inside a \\Gamma-integral: differentiate \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx with respect to the PARAMETER s (the log-power-integrals move) and set s=1 — this is precisely \\int_0^\\infty e^{-x}\\ln x\\,dx=\\Gamma'(1)=-\\gamma.",
    "x=e^{-u} turns any \\int_0^1(\\cdots)\\ln\\!\\left(\\ln\\frac1x\\right)dx-shaped integral on (0,1) into a \\Gamma-type integral in u over (0,\\infty) — try this substitution first whenever \\ln(\\ln(1/x)) shows up.",
    "\\gamma also sits inside \\psi(n)=-\\gamma+H_{n-1} — Beta function integrals' own digamma formula — at every positive integer n; recognising \\psi(1)=-\\gamma (the n=1 case, where H_0=0) is the same fact walking back out, not a new one to re-derive.",
    "Never estimate \\gamma numerically by truncating the DEFINING sum H_n-\\ln n — it converges only like \\frac1{2n}. Reach for an integral or series representation (the worked examples above) whenever a decimal value is actually needed.",
  ],
  example: EULER_MASCHERONI_EXAMPLES[0],
  examples: EULER_MASCHERONI_EXAMPLES,
  pitfalls: [
    "It is NOT known whether \\gamma is irrational — this is a genuinely open problem, unlike \\pi and e. (Most mathematicians expect it's even transcendental, but neither irrationality nor rationality has ever been proven.) Don't state otherwise as if it were settled.",
    "\\gamma (lower-case, a single fixed NUMBER \\approx0.5772) and \\Gamma (upper-case, a FUNCTION) share a name and a root, and this lesson's own headline fact \\Gamma'(1)=-\\gamma puts both in one formula — easy to blur. \\Gamma(1)=1 is a function value; \\gamma\\approx0.5772 is a completely different object that happens to equal \\Gamma'(1), not \\Gamma(1) itself.",
    "The defining limit converges only like \\frac1{2n} (see the selfExplain below) — truncating H_n-\\ln n at any humanly-computable n gives at best a few correct decimal digits. Never estimate \\gamma numerically this way; use one of the integral representations above instead.",
    "Different representations carry different signs for the SAME constant: \\Gamma'(1)=-\\gamma (Examples 1 and 2) but \\int_0^\\infty\\left(\\frac1{1-e^{-x}}-\\frac1x\\right)e^{-x}\\,dx=+\\gamma (Example 3) — copy the sign from whichever formula is actually in front of you, don't assume it's always negative.",
  ],
  checkYourself: {
    prompt: "\\int_0^\\infty e^{-x}\\ln(2x)\\,dx",
    answer: "\\ln2-\\gamma",
    hint: "Split \\ln(2x)=\\ln2+\\ln x. The second half is Example 1's integral, -\\gamma; the first half is \\ln2 times the Gamma-function lesson's base case, \\int_0^\\infty e^{-x}\\,dx=1.",
  },
  completions: [
    {
      setup: [
        "\\int_0^\\infty xe^{-x}\\ln x\\,dx — differentiate \\Gamma(s)=\\int_0^\\infty x^{s-1}e^{-x}\\,dx with respect to s exactly as in Example 1, but evaluate at s=2 instead of s=1: \\Gamma'(s)=\\int_0^\\infty x^{s-1}\\ln x\\,e^{-x}\\,dx, so \\Gamma'(2)=\\int_0^\\infty xe^{-x}\\ln x\\,dx is the target.",
        "By definition \\psi(s)=\\frac{\\Gamma'(s)}{\\Gamma(s)}, so \\Gamma'(2)=\\Gamma(2)\\psi(2). Since \\Gamma(2)=1!=1 (the Gamma-function lesson's base case, one step up), the target is just \\psi(2).",
        "\\psi satisfies the recursion \\psi(s+1)=\\psi(s)+\\frac1s: log-differentiate \\Gamma(s+1)=s\\Gamma(s) with respect to s, \\frac{d}{ds}\\ln\\Gamma(s+1)=\\frac{d}{ds}\\big[\\ln s+\\ln\\Gamma(s)\\big], to get \\psi(s+1)=\\frac1s+\\psi(s). At s=1 this reads \\psi(2)=\\psi(1)+1.",
      ],
      blank: "Use Example 1's value of \\psi(1) to get \\psi(2), then the final answer.",
      answer:
        "\\psi(1)=-\\gamma (Example 1), so \\psi(2)=\\psi(1)+1=1-\\gamma. Hence \\int_0^\\infty xe^{-x}\\ln x\\,dx=1-\\gamma — Beta function integrals' own \\psi(n)=-\\gamma+H_{n-1} formula gives the same thing at n=2: -\\gamma+H_1=-\\gamma+1.",
      integrandExpr: "x*exp(-x)*log(x)",
      resultExpr: "1-0.5772156649015329",
      domain: [0, Infinity],
      kind: "definite",
    },
    {
      setup: [
        "\\int_0^\\infty e^{-2x}\\ln x\\,dx — substitute u=2x (x=\\frac u2,\\ dx=\\frac{du}2) to relate this back to Example 1's integral: \\int_0^\\infty e^{-2x}\\ln x\\,dx=\\int_0^\\infty e^{-u}\\ln\\!\\left(\\frac u2\\right)\\frac{du}2=\\frac12\\int_0^\\infty e^{-u}\\big(\\ln u-\\ln2\\big)\\,du.",
        "Split into two pieces: \\frac12\\int_0^\\infty e^{-u}\\ln u\\,du-\\frac{\\ln2}2\\int_0^\\infty e^{-u}\\,du. The second integral is the Gamma-function lesson's base case, \\int_0^\\infty e^{-u}\\,du=1.",
      ],
      blank: "The first piece is Example 1's integral with u in place of x. Substitute its value and finish.",
      answer:
        "\\frac12\\int_0^\\infty e^{-u}\\ln u\\,du-\\frac{\\ln2}2\\cdot1=\\frac12(-\\gamma)-\\frac{\\ln2}2=-\\frac{\\gamma+\\ln2}2. So \\int_0^\\infty e^{-2x}\\ln x\\,dx=-\\frac{\\gamma+\\ln2}2.",
      integrandExpr: "exp(-2*x)*log(x)",
      resultExpr: "-(0.5772156649015329+log(2))/2",
      domain: [0, Infinity],
      kind: "definite",
    },
  ],
  selfExplain: {
    prompt:
      "The definition \\gamma=\\lim_{n\\to\\infty}(H_n-\\ln n) looks like it should hand you a good numerical estimate for a large but modest n — say n=1000. Given that the intuition above shows the error H_n-\\ln n-\\gamma behaves like \\frac1{2n} for large n, how many correct decimal digits does n=1000 actually buy, and why does that make an integral representation like Example 1 a genuinely BETTER way to compute \\gamma numerically, not just a prettier one?",
    answer:
      "With error \\sim\\frac1{2n}, n=1000 gives error \\sim0.0005 — only about 3 correct decimal digits, despite averaging a thousand terms of the harmonic sum. Reaching 10 correct digits this way would need n on the order of 10^{10} terms — computationally absurd, because \\frac1{2n} decays only POLYNOMIALLY in n. Example 1's integral, by contrast, is an ordinary smooth function e^{-x}\\ln x weighted by a rapidly decaying exponential; a numerical quadrature scheme on it converges at a rate set by the integrand's smoothness, not by any \\frac1n-type tail, and reaches double-precision accuracy with only a few dozen sample points. This is why every real computation of \\gamma (it has been published to many millions of digits) uses an integral or series representation, never the defining limit truncated at some large n — the defining limit is the best way to SEE why \\gamma exists, and close to the worst way to actually compute it.",
  },
};
