import type { Technique, WorkedExample } from "../types";

const NAMED_SERIES_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{\\ln x}{x-1} \\text{ on } [0,1]",
    work: [
      "Rewrite \\frac1{x-1}=-\\frac1{1-x}=-\\sum_{k=0}^\\infty x^k, a plain geometric series that converges for 0\\leq x<1. So \\frac{\\ln x}{x-1}=-\\ln x\\sum_{k=0}^\\infty x^k.",
      "Swap the sum and the integral (justified exactly as in zeta-series — every term has the same sign and the series converges absolutely) and integrate term by term: \\int_0^1\\frac{\\ln x}{x-1}\\,dx=-\\sum_{k=0}^\\infty\\int_0^1x^k\\ln x\\,dx.",
      "Each term is a standard by-parts integral: with u=\\ln x,\\ dv=x^k\\,dx,\\ v=\\frac{x^{k+1}}{k+1}, \\int_0^1x^k\\ln x\\,dx=\\left[\\frac{x^{k+1}}{k+1}\\ln x\\right]_0^1-\\int_0^1\\frac{x^k}{k+1}\\,dx=0-\\frac1{(k+1)^2}. The boundary term is 0 at both ends: \\ln1=0 at x=1, and x^{k+1}\\ln x\\to0 as x\\to0^+.",
      "So \\int_0^1\\frac{\\ln x}{x-1}\\,dx=-\\sum_{k=0}^\\infty\\left(-\\frac1{(k+1)^2}\\right)=\\sum_{k=0}^\\infty\\frac1{(k+1)^2}=\\sum_{m=1}^\\infty\\frac1{m^2}=\\zeta(2).",
    ],
    result: "\\frac{\\pi^2}6",
    integrandExpr: "log(x)/(x-1)",
    resultExpr: "pi^2/6",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "\\frac{\\arctan x}x \\text{ on } [0,1]",
    work: [
      "\\frac1{1+x^2}=\\sum_{n=0}^\\infty(-1)^nx^{2n} — the same geometric series as the \\zeta(2) example above, alternating this time. Integrating term by term from 0 gives \\arctan x=\\sum_{n=0}^\\infty(-1)^n\\frac{x^{2n+1}}{2n+1}, so \\frac{\\arctan x}x=\\sum_{n=0}^\\infty(-1)^n\\frac{x^{2n}}{2n+1}.",
      "Integrate again, term by term, on [0,1]: \\int_0^1\\frac{\\arctan x}x\\,dx=\\sum_{n=0}^\\infty\\frac{(-1)^n}{2n+1}\\int_0^1x^{2n}\\,dx=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n+1)^2}.",
      "That sum is, by definition, \\beta(2) — the even member of the same family that gave \\zeta(2) above, just over odd denominators and alternating. Unlike \\zeta(2), it does not telescope down to a multiple of \\pi^2; no closed form in \\pi is known at all. It gets its own name and symbol instead: Catalan's constant, G=0.9159655941\\ldots",
    ],
    result: "G",
    integrandExpr: "atan(x)/x",
    resultExpr: "0.915965594177219015",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "-\\frac{\\ln x\\arctan x}x \\text{ on } [0,1]",
    work: [
      "Reuse the series from the G example above: \\frac{\\arctan x}x=\\sum_{n=0}^\\infty(-1)^n\\frac{x^{2n}}{2n+1}. Multiply by -\\ln x and integrate term by term.",
      "Each term needs \\int_0^1-x^{2n}\\ln x\\,dx, which is exactly the by-parts result from the \\zeta(2) example with k=2n: \\int_0^1-x^{2n}\\ln x\\,dx=\\frac1{(2n+1)^2}.",
      "So \\int_0^1-\\frac{\\ln x\\arctan x}x\\,dx=\\sum_{n=0}^\\infty\\frac{(-1)^n}{2n+1}\\cdot\\frac1{(2n+1)^2}=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n+1)^3}=\\beta(3).",
      "This one DOES have a closed form — \\beta(3)=\\frac{\\pi^3}{32}, the odd-indexed counterpart to \\zeta(2). Why \\zeta and \\beta 'take turns' having closed forms at even vs. odd index is worth reading in the pitfalls below.",
    ],
    result: "\\frac{\\pi^3}{32}",
    integrandExpr: "-log(x)*atan(x)/x",
    resultExpr: "pi^3/32",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "\\text{The cotangent and cosecant partial fractions, evaluated at } z=i",
    work: [
      "\\pi\\cot(\\pi z)=\\sum_{n=-\\infty}^\\infty\\frac1{z+n} and \\pi\\csc(\\pi z)=\\sum_{n=-\\infty}^\\infty\\frac{(-1)^n}{z+n} — see the intuition above for where these come from. Set z=i in both.",
      "By definition of the hyperbolic functions, \\cos(i\\pi)=\\cosh\\pi and \\sin(i\\pi)=i\\sinh\\pi, so \\cot(i\\pi)=\\frac{\\cosh\\pi}{i\\sinh\\pi}=-i\\coth\\pi and \\csc(i\\pi)=\\frac1{i\\sinh\\pi}=-i\\operatorname{csch}\\pi.",
      "On the right-hand side, rationalise each term: \\frac1{i+n}=\\frac{n-i}{n^2+1}. Summed over ALL integers n, the real part \\frac n{n^2+1} is odd in n and cancels between n and -n completely, leaving a purely imaginary sum — -i\\sum_{n=-\\infty}^\\infty\\frac1{n^2+1} for the \\cot case, and -i\\sum_{n=-\\infty}^\\infty\\frac{(-1)^n}{n^2+1} for the \\csc case (the extra (-1)^n doesn't change which part is odd).",
      "Cancel the shared factor of -i from both sides of each identity: \\pi\\coth\\pi=\\sum_{n=-\\infty}^\\infty\\frac1{n^2+1} and \\pi\\operatorname{csch}\\pi=\\sum_{n=-\\infty}^\\infty\\frac{(-1)^n}{n^2+1}.",
    ],
    result: "\\pi\\coth\\pi \\text{ and } \\pi\\operatorname{csch}\\pi",
  },
];

export const NamedSeries: Technique = {
  id: "named-series",
  name: "The named series",
  tagline:
    "Five sums that show up so often in finals they deserve recognising on sight: \\zeta(2), Catalan's constant, and the two-sided sums hiding \\coth\\pi and \\operatorname{csch}\\pi.",
  prerequisites: ["Zeta-series integrals"],
  whenToUse:
    "The integral has already collapsed into an infinite sum — either \\sum\\frac1{n^2}-shaped, or \\sum\\frac{(-1)^n}{(2n+1)^k}-shaped, or a TWO-SIDED sum \\sum_{n=-\\infty}^\\infty running over something like \\frac1{n^2+1}. At that point the calculus is finished; what's left is recognising which of a small handful of named constants the sum actually is, the same way you'd recognise \\sqrt2 or \\ln2 without re-deriving them.",
  intuition:
    "Three of these five are single-sided sums that fall out of the SAME machinery as zeta-series integrals — expand a rational function as a geometric series and integrate term by term — just run over ODD denominators instead of every integer, and alternating in sign. Defining \\beta(s)=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n+1)^s} the same way \\zeta(s)=\\sum_{n=1}^\\infty\\frac1{n^s} is defined, the top row of this lesson is just \\zeta(2)=\\frac{\\pi^2}6, \\beta(2)=G, and \\beta(3)=\\frac{\\pi^3}{32} — three values from two closely related families, not three unrelated facts to separately memorise. The two two-sided sums come from somewhere completely different: the partial-fraction expansions of \\cot and \\csc. Every pole of \\cot(\\pi z) sits at an integer n, with residue 1 there, and stacking up ALL of those poles reproduces the whole function: \\pi\\cot(\\pi z)=\\sum_{n=-\\infty}^\\infty\\frac1{z+n} (read as the symmetric limit that pairs n with -n as the sum grows — exactly how the two-sided sums in this lesson are meant to be read too). \\csc has the same structure with alternating residues: \\pi\\csc(\\pi z)=\\sum_{n=-\\infty}^\\infty\\frac{(-1)^n}{z+n}. Evaluate both at z=i — not a pole of either function, since every pole sits at a REAL integer and i isn't one, just a convenient place to plug in. On the left, \\cos(iy)=\\cosh y and \\sin(iy)=i\\sinh y by definition of the hyperbolic functions, so \\cot(i\\pi)=\\frac{\\cosh\\pi}{i\\sinh\\pi}=-i\\coth\\pi, and likewise \\csc(i\\pi)=-i\\operatorname{csch}\\pi. On the right, rationalise each term, \\frac1{i+n}=\\frac{n-i}{n^2+1}: summed over all n the real part \\frac n{n^2+1} is odd and cancels in pairs, leaving a purely imaginary sum, -i\\sum\\frac1{n^2+1} (or -i\\sum\\frac{(-1)^n}{n^2+1} for the \\csc version). Matching the two sides and cancelling the shared -i turns \\pi\\cot(i\\pi)=-i\\pi\\coth\\pi into \\pi\\coth\\pi=\\sum_{n=-\\infty}^\\infty\\frac1{n^2+1}, and the \\csc identity into \\pi\\operatorname{csch}\\pi=\\sum_{n=-\\infty}^\\infty\\frac{(-1)^n}{n^2+1} — the same trick, run twice.",
  recipe: [
    "For a single-sided sum, check whether it's \\sum\\frac1{n^s}-shaped (this is \\zeta(s)) or \\sum\\frac{(-1)^n}{(2n+1)^s}-shaped (this is \\beta(s), the Dirichlet beta function) — the same termwise-integration machinery as zeta-series, just run over odd denominators and alternating.",
    "Only three combinations on the syllabus have a known closed form: \\zeta(2)=\\frac{\\pi^2}6, \\beta(2)=G (no closed form — memorise the numeral), and \\beta(3)=\\frac{\\pi^3}{32}.",
    "For a TWO-SIDED sum \\sum_{n=-\\infty}^\\infty (every integer, not just n\\geq1), look specifically for \\frac1{n^2+1} or \\frac{(-1)^n}{n^2+1} — these are the cotangent and cosecant partial-fraction expansions, \\pi\\cot(\\pi z)=\\sum\\frac1{z+n} and \\pi\\csc(\\pi z)=\\sum\\frac{(-1)^n}{z+n}, evaluated at z=i.",
    "Read the value straight off: \\pi\\coth\\pi for the plain sum, \\pi\\operatorname{csch}\\pi for the alternating one — no further computation once the shape is recognised.",
    "For \\frac1{n^2+a^2} at a general a (not just a=1), the same evaluation at z=ia gives \\frac{\\pi}a\\coth(\\pi a) — the a=1 case in this lesson is just the landmark instance.",
  ],
  example: NAMED_SERIES_EXAMPLES[0],
  examples: NAMED_SERIES_EXAMPLES,
  pitfalls: [
    "The two-sided sums run over EVERY integer, n=-\\infty to \\infty, not just n\\geq1. The safe way to compute one by hand is (n=0\\text{ term})+2\\times(n\\geq1\\text{ tail}); the classic slip is remembering to double the tail but forgetting the lone n=0 term, which is worth exactly 1 in both sums here (\\frac1{0^2+1}=1 and \\frac{(-1)^0}{0^2+1}=1) — an answer that's off by exactly 1 almost always means this.",
    "\\sum_{n=0}^\\infty\\frac{(-1)^n}{2n+1}=\\frac\\pi4 (Leibniz's series, \\beta(1)) is a genuinely different, much easier series than the squared and cubed ones on this page — same odd-denominator shape, different power, completely different-looking answer. Check the exponent before reaching for G or \\frac{\\pi^3}{32}.",
    "It feels backwards, but it's real: for \\zeta, the EVEN values (\\zeta(2),\\ \\zeta(4),\\ldots) have closed forms in \\pi and the odd ones (\\zeta(3),\\ldots) don't; for \\beta it's the opposite — the ODD values (\\beta(1)=\\frac\\pi4,\\ \\beta(3)=\\frac{\\pi^3}{32}) have closed forms and the EVEN ones (\\beta(2)=G,\\ \\beta(4),\\ldots) don't. Catalan's constant earns its own name and symbol precisely because well over a century of trying hasn't found one.",
    "z=i is not a pole of \\cot or \\csc — every pole of \\pi\\cot(\\pi z) sits at a real integer, and i isn't one — so evaluating the partial-fraction identity there is completely legitimate. Don't confuse 'z=i is special' with 'z=i is a singularity'; it's simply the value that turns the n^2 on the right into the hyperbolic \\coth/\\operatorname{csch} on the left.",
  ],
  checkYourself: {
    prompt: "\\sum_{n=-\\infty}^{\\infty}\\frac1{n^2+4}",
    answer: "\\frac\\pi2\\coth(2\\pi)",
    hint: "Same z=i derivation, just scaled: \\sum\\frac1{n^2+a^2}=\\frac\\pi a\\coth(\\pi a), evaluated at a=2 instead of a=1 — i.e. plug z=2i into the cotangent partial fraction instead of z=i.",
  },
  completions: [
    {
      setup: [
        "\\int_0^1\\frac{\\ln x}{1+x}\\,dx — same machinery as the \\zeta(2) example above, but \\frac1{1+x} is an ALTERNATING geometric series: \\frac1{1+x}=\\sum_{k=0}^\\infty(-1)^kx^k for 0\\leq x<1.",
        "Multiplying by \\ln x and integrating term by term, using \\int_0^1x^k\\ln x\\,dx=-\\frac1{(k+1)^2} (derived by parts in the \\zeta(2) example), turns the integral into -\\sum_{k=0}^\\infty(-1)^k\\left(-\\frac1{(k+1)^2}\\right)=-\\sum_{k=0}^\\infty\\frac{(-1)^k}{(k+1)^2}=-\\sum_{m=1}^\\infty\\frac{(-1)^{m-1}}{m^2}.",
      ],
      blank: "That last sum is the alternating zeta series \\eta(2)=\\sum_{m=1}^\\infty\\frac{(-1)^{m-1}}{m^2}, known to equal \\frac12\\zeta(2). Finish it off.",
      answer: "\\eta(2)=\\frac12\\zeta(2)=\\frac12\\cdot\\frac{\\pi^2}6=\\frac{\\pi^2}{12}, so \\int_0^1\\frac{\\ln x}{1+x}\\,dx=-\\eta(2)=-\\frac{\\pi^2}{12}.",
      integrandExpr: "log(x)/(1+x)",
      resultExpr: "-pi^2/12",
      domain: [0, 1],
      kind: "definite",
    },
    {
      setup: [
        "\\int_0^1\\frac{\\arctan x}x\\,dx=G was reached above by a double series expansion. Reach it a second way: integrate by parts instead, with u=\\arctan x,\\ dv=\\frac{dx}x, so v=\\ln x and du=\\frac{dx}{1+x^2}.",
        "This gives \\int_0^1\\frac{\\arctan x}x\\,dx=\\Big[\\arctan(x)\\ln x\\Big]_0^1-\\int_0^1\\frac{\\ln x}{1+x^2}\\,dx. The boundary term vanishes at both ends: at x=1,\\ \\ln1=0; as x\\to0^+,\\ \\arctan x\\sim x, and x\\ln x\\to0.",
      ],
      blank: "With the boundary term gone, what does the remaining integral equal — and why should it come out to exactly G again rather than something new?",
      answer: "\\int_0^1\\frac{\\ln x}{1+x^2}\\,dx=-\\int_0^1\\frac{\\arctan x}x\\,dx=-G. It HAS to land on the same constant, because integrating by parts is just an algebraic rearrangement of the same integral, not a new computation — \\frac1{1+x^2} is the derivative of \\arctan x that drove the series expansion in the first place, so this is the same Taylor series in different packaging.",
      integrandExpr: "log(x)/(1+x^2)",
      resultExpr: "-0.915965594177219015",
      domain: [0, 1],
      kind: "definite",
    },
  ],
  selfExplain: {
    prompt:
      "Euler's derivation of \\zeta(2)=\\frac{\\pi^2}6 compares the power series of \\frac{\\sin x}x to its product formula over its zeros, which sit at every nonzero integer multiple of \\pi. \\cos x has zeros at every ODD multiple of \\frac\\pi2 instead, and the same product-comparison trick applied to \\cos x really does give a closed form for \\sum_{n=0}^\\infty\\frac1{(2n+1)^2} — it's \\frac{\\pi^2}8, a genuine cousin of this lesson's odd-denominator sums. So why doesn't the analogous trick reach \\beta(2)=G, which sums that exact same \\frac1{(2n+1)^2}?",
    answer:
      "The difference is the alternating sign. \\sum_{n=0}^\\infty\\frac1{(2n+1)^2}=\\frac{\\pi^2}8 has no sign attached, and is comparable via \\cos x's zeros the same way \\sin x's zeros give \\zeta(2) — but \\beta(2)=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n+1)^2} has (-1)^n built in. Comparing a power series to a product over its zeros only ever reads off sums of PLAIN reciprocal powers, all the same sign — that is exactly what a real function's zero set naturally hands you, and there is no slot in that method for injecting an alternating sign. So it isn't that \\beta(2) has been checked against this method and found not to simplify — the method simply has nowhere to put the (-1)^n, and can't reach a sum shaped like \\beta(2) at all. (Catalan's constant does have other representations — via the digamma function at quarter-integers, for instance — but none of them produces a closed form in \\pi either; they just give different ways of computing the same non-closed-form number.)",
  },
};
