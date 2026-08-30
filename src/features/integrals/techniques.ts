/**
 * The training curriculum.
 *
 * Students rarely fail an integral because they can't execute a substitution. They fail because
 * they don't know which of eight things to reach for. So every technique here leads with
 * `whenToUse` — the recognition cue — and only then gives the recipe.
 */
import type { Technique, TechniqueId, WorkedExample } from "./types";

// ── graduated worked examples ─────────────────────────────────────────────────────────────────
//
// One const array per technique rebuilt for the A-level-bridge / definite-core pass (see
// UK_BEE_BURST.md WS-2): the first example spells out every algebraic step, including the ones
// that feel obvious; later ones compress as the reader gains footing. Declared here, above
// TECHNIQUES, so each technique's `example` (legacy singular) and `examples` (plural) can both
// point at the same array — `example: xExamples[0]` — rather than risking the two ever drifting
// apart. Every entry with `integrandExpr` set is checked by lessonExamples.test.ts, the same way
// problems.test.ts checks the graded bank.

const POWER_EXAMPLES: WorkedExample[] = [
  {
    integrand: "2x^3 - 5\\sqrt{x} + \\frac{3}{x^2}",
    work: [
      "Integration is linear, so split the sum into three separate integrals: \\int 2x^3\\,dx - \\int 5\\sqrt x\\,dx + \\int\\frac3{x^2}\\,dx.",
      "Rewrite every term as a power of x first: 2x^3 stays as it is, 5\\sqrt x = 5x^{1/2}, and \\frac3{x^2}=3x^{-2}.",
      "Apply \\int x^n\\,dx=\\frac{x^{n+1}}{n+1} to each: 2x^3\\to 2\\cdot\\frac{x^4}4=\\frac{x^4}2;\\quad 5x^{1/2}\\to 5\\cdot\\frac{x^{3/2}}{3/2}=\\frac{10}3x^{3/2};\\quad 3x^{-2}\\to 3\\cdot\\frac{x^{-1}}{-1}=-3x^{-1}.",
      "Put the signs back and combine the three pieces into one answer.",
    ],
    result: "\\frac{x^4}2 - \\frac{10}3x^{3/2} - \\frac3x + C",
    integrandExpr: "2*x^3 - 5*sqrt(x) + 3/x^2",
    resultExpr: "x^4/2 - (10/3)*x^(3/2) - 3/x",
    domain: [0.5, 3],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{(x^2+1)^2}{x}",
    work: [
      "Expand the numerator: (x^2+1)^2 = x^4 + 2x^2 + 1.",
      "Divide each term by x: x^3 + 2x + \\frac{1}{x}.",
      "Integrate termwise.",
    ],
    result: "\\frac{x^4}{4} + x^2 + \\ln|x| + C",
    integrandExpr: "(x^2+1)^2/x",
    resultExpr: "x^4/4 + x^2 + ln(x)",
    domain: [0.5, 3],
    kind: "indefinite",
  },
];

const U_SUB_EXAMPLES: WorkedExample[] = [
  {
    integrand: "2x\\cos(x^2)",
    work: [
      "Inside function: u = x^2 — and its derivative, 2x, is sitting right there in the integrand as a factor.",
      "Differentiate: du = 2x\\,dx. That means the \\text{'}2x\\,dx\\text{'} half of the integrand IS du — nothing left over.",
      "Rewrite entirely in u: \\int\\cos(x^2)\\cdot(2x\\,dx) = \\int\\cos u\\,du. Every x is gone.",
      "Integrate in u, then put x^2 back in for u.",
    ],
    result: "\\sin(x^2) + C",
    integrandExpr: "2*x*cos(x^2)",
    resultExpr: "sin(x^2)",
    domain: [0.2, 1.5],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{x}{x^2+1}",
    work: [
      "Inside function: u = x^2+1, so du = 2x\\,dx, giving x\\,dx = \\tfrac{1}{2}\\,du.",
      "The integral becomes \\tfrac{1}{2}\\int \\frac{du}{u}.",
      "That is \\tfrac{1}{2}\\ln|u|.",
    ],
    result: "\\tfrac{1}{2}\\ln(x^2+1) + C",
    integrandExpr: "x/(x^2+1)",
    resultExpr: "(1/2)*ln(x^2+1)",
    domain: [-2, 2],
    kind: "indefinite",
  },
];

const PARTS_EXAMPLES: WorkedExample[] = [
  {
    integrand: "x e^{x}",
    work: [
      "LIATE ranks the algebraic factor (x) above the exponential (e^x), so u = x,\\ dv = e^x\\,dx — and it's the right call because x gets SIMPLER when differentiated while e^x integrates to something no worse.",
      "Differentiate u and integrate dv separately: du = 1\\,dx, and v=\\int e^x\\,dx = e^x.",
      "Assemble with the formula \\int u\\,dv = uv - \\int v\\,du: xe^x - \\int e^x\\,dx.",
      "The new integral is a standard form — finish it and combine with the uv term.",
    ],
    result: "(x-1)e^{x} + C",
    integrandExpr: "x*e^x",
    resultExpr: "(x-1)*e^x",
    domain: [-1, 1],
    kind: "indefinite",
  },
  {
    integrand: "\\ln x",
    work: [
      "One lone function, no visible product — but LIATE still applies: u=\\ln x,\\ dv=dx (the \\text{'}second factor\\text{'} is just the invisible dx).",
      "du = \\frac{dx}x,\\quad v=x.",
      "uv-\\int v\\,du = x\\ln x - \\int x\\cdot\\frac1x\\,dx = x\\ln x - \\int 1\\,dx.",
    ],
    result: "x\\ln x - x + C",
    integrandExpr: "ln(x)",
    resultExpr: "x*ln(x) - x",
    domain: [0.5, 3],
    kind: "indefinite",
  },
];

const TRIG_IDENTITY_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\sin^3 x",
    work: [
      "The power is odd — peel one sine off: \\sin^2x\\cdot\\sin x.",
      "Convert the even part with \\sin^2x=1-\\cos^2x: (1-\\cos^2x)\\sin x.",
      "Now u=\\cos x,\\ du=-\\sin x\\,dx, so \\sin x\\,dx=-du, leaving \\int(1-u^2)(-du)=\\int(u^2-1)\\,du.",
      "Integrate in u, then substitute \\cos x back in for u.",
    ],
    result: "\\frac{\\cos^3x}3 - \\cos x + C",
    integrandExpr: "sin(x)^3",
    resultExpr: "cos(x)^3/3 - cos(x)",
    domain: [0.3, 2.8],
    kind: "indefinite",
  },
  {
    integrand: "\\cos^3 x",
    work: [
      "The power is odd — peel one cosine off: \\cos^2 x \\cdot \\cos x.",
      "Convert the even part: (1 - \\sin^2 x)\\cos x.",
      "Now u = \\sin x, du = \\cos x\\,dx, leaving \\int (1-u^2)\\,du.",
    ],
    result: "\\sin x - \\tfrac{\\sin^3 x}{3} + C",
    integrandExpr: "cos(x)^3",
    resultExpr: "sin(x) - sin(x)^3/3",
    domain: [0.3, 2.5],
    kind: "indefinite",
  },
];

const TRIG_SUB_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\sqrt{4-x^2}",
    work: [
      "Matches \\sqrt{a^2-x^2} with a=2: put x=2\\sin\\theta, so dx=2\\cos\\theta\\,d\\theta.",
      "Then 4-x^2=4-4\\sin^2\\theta=4(1-\\sin^2\\theta)=4\\cos^2\\theta, so \\sqrt{4-x^2}=2\\cos\\theta.",
      "Substitute both pieces: (2\\cos\\theta)(2\\cos\\theta\\,d\\theta)=4\\cos^2\\theta\\,d\\theta.",
      "Halve the degree (trig identities): 4\\int\\cos^2\\theta\\,d\\theta=4\\left(\\frac\\theta2+\\frac{\\sin2\\theta}4\\right)=2\\theta+\\sin2\\theta.",
      "Draw the triangle to convert back: \\theta=\\arcsin\\frac x2, and \\sin2\\theta=2\\sin\\theta\\cos\\theta=2\\cdot\\frac x2\\cdot\\frac{\\sqrt{4-x^2}}2=\\frac{x\\sqrt{4-x^2}}2.",
    ],
    result: "2\\arcsin\\!\\left(\\frac x2\\right) + \\frac{x\\sqrt{4-x^2}}2 + C",
    integrandExpr: "sqrt(4-x^2)",
    resultExpr: "2*asin(x/2) + x*sqrt(4-x^2)/2",
    domain: [-1.5, 1.5],
    kind: "indefinite",
  },
  {
    integrand: "\\frac1{\\sqrt{x^2-9}}",
    work: [
      "Matches \\sqrt{x^2-a^2} with a=3: put x=3\\sec\\theta, so dx=3\\sec\\theta\\tan\\theta\\,d\\theta and \\sqrt{x^2-9}=3\\tan\\theta.",
      "The integral becomes \\int\\frac{3\\sec\\theta\\tan\\theta}{3\\tan\\theta}\\,d\\theta=\\int\\sec\\theta\\,d\\theta=\\ln|\\sec\\theta+\\tan\\theta|.",
      "Back-substitute \\sec\\theta=\\frac x3,\\ \\tan\\theta=\\frac{\\sqrt{x^2-9}}3 — the resulting \\ln3 folds into the constant of integration.",
    ],
    result: "\\ln\\!\\left(x+\\sqrt{x^2-9}\\right) + C",
    integrandExpr: "1/sqrt(x^2-9)",
    resultExpr: "ln(x+sqrt(x^2-9))",
    domain: [3.5, 6],
    kind: "indefinite",
  },
];

const PARTIAL_FRACTIONS_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{1}{x(x+1)}",
    work: [
      "Set up the decomposition: \\frac1{x(x+1)}=\\frac Ax+\\frac B{x+1}.",
      "Clear denominators by multiplying both sides by x(x+1): 1 = A(x+1) + Bx.",
      "Plug in the roots one at a time: x=0 gives A=1; x=-1 gives -B=1, so B=-1.",
      "Rewrite with the constants in: \\frac1x-\\frac1{x+1}, then integrate each piece.",
    ],
    result: "\\ln\\left|\\frac{x}{x+1}\\right| + C",
    integrandExpr: "1/(x*(x+1))",
    resultExpr: "ln(x/(x+1))",
    domain: [0.5, 3],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{2x+3}{(x+1)^2}",
    work: [
      "A repeated factor needs BOTH terms: \\frac{2x+3}{(x+1)^2}=\\frac A{x+1}+\\frac B{(x+1)^2}, i.e. 2x+3=A(x+1)+B.",
      "x=-1 gives B=1; matching the coefficient of x gives A=2.",
      "So the integrand is \\frac2{x+1}+\\frac1{(x+1)^2} — integrate each piece (the second is a plain power of (x+1)).",
    ],
    result: "2\\ln|x+1| - \\frac1{x+1} + C",
    integrandExpr: "(2*x+3)/(x+1)^2",
    resultExpr: "2*ln(x+1) - 1/(x+1)",
    domain: [0, 3],
    kind: "indefinite",
  },
];

const COMPLETE_SQUARE_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{1}{x^2+2x+5}",
    work: [
      "Complete the square: x^2+2x+5=(x^2+2x+1)+4=(x+1)^2+4 — add and subtract \\left(\\frac b2\\right)^2=1 so the first three terms become a perfect square.",
      "Substitute u=x+1, so du=dx: the integral is \\int\\frac{du}{u^2+2^2}.",
      "Standard form: \\frac1a\\arctan\\frac ua with a=2.",
      "Substitute u=x+1 back in.",
    ],
    result: "\\tfrac{1}{2}\\arctan\\!\\left(\\frac{x+1}{2}\\right) + C",
    integrandExpr: "1/(x^2+2*x+5)",
    resultExpr: "(1/2)*atan((x+1)/2)",
    domain: [-2, 2],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{2x+3}{x^2+4x+13}",
    work: [
      "The numerator has an x in it — split it against the denominator's own derivative, 2x+4: 2x+3=(2x+4)-1.",
      "Split the integral: \\int\\frac{2x+4}{x^2+4x+13}\\,dx - \\int\\frac{1}{x^2+4x+13}\\,dx.",
      "The first piece is a plain log by substitution (u=x^2+4x+13): \\ln(x^2+4x+13).",
      "Complete the square on the second: x^2+4x+13=(x+2)^2+9, giving \\tfrac13\\arctan\\frac{x+2}3.",
    ],
    result: "\\ln(x^2+4x+13) - \\tfrac13\\arctan\\!\\left(\\frac{x+2}3\\right) + C",
    integrandExpr: "(2*x+3)/(x^2+4*x+13)",
    resultExpr: "ln(x^2+4*x+13) - (1/3)*atan((x+2)/3)",
    domain: [-4, 2],
    kind: "indefinite",
  },
];

const SYMMETRY_EXAMPLES: WorkedExample[] = [
  {
    integrand: "x^3\\sin(x^2) \\text{ on } [-2,2]",
    work: [
      "Check parity: f(-x)=(-x)^3\\sin((-x)^2)=-x^3\\sin(x^2)=-f(x) — the integrand is odd.",
      "The interval [-2,2] is symmetric about 0. An odd function's graph on [-2,0] is the exact upside-down mirror of its graph on [0,2], so the signed areas cancel completely — no antiderivative needed at all.",
    ],
    result: "0",
    integrandExpr: "x^3*sin(x^2)",
    resultExpr: "0",
    domain: [-2, 2],
    kind: "definite",
  },
  {
    integrand: "\\frac{\\sin x}{\\sin x + \\cos x} \\text{ on } [0, \\tfrac{\\pi}{2}]",
    work: [
      "Call the integral I. King's rule with a = \\tfrac{\\pi}{2} swaps \\sin and \\cos.",
      "So I = \\int_0^{\\pi/2} \\tfrac{\\cos x}{\\cos x + \\sin x}\\,dx as well.",
      "Adding: 2I = \\int_0^{\\pi/2} 1\\,dx = \\tfrac{\\pi}{2}.",
    ],
    result: "\\frac{\\pi}{4}",
    integrandExpr: "sin(x)/(sin(x)+cos(x))",
    resultExpr: "pi/4",
    domain: [0, Math.PI / 2],
    kind: "definite",
  },
];

const T_SUB_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{1}{2+\\cos x}",
    work: [
      "Substitute \\cos x=\\frac{1-t^2}{1+t^2}: 2+\\cos x=\\frac{2(1+t^2)+(1-t^2)}{1+t^2}=\\frac{3+t^2}{1+t^2}.",
      "So \\frac1{2+\\cos x}=\\frac{1+t^2}{3+t^2}, and multiplying by dx=\\frac2{1+t^2}\\,dt cancels the (1+t^2) exactly, leaving \\frac2{3+t^2}\\,dt — nothing of the original 1+t^2 survives.",
      "The integral is \\int\\frac2{3+t^2}\\,dt, a plain arctan standard form with a=\\sqrt3.",
      "That integrates to \\frac2{\\sqrt3}\\arctan\\frac t{\\sqrt3}, then back-substitute t=\\tan\\frac x2.",
    ],
    result: "\\frac{2}{\\sqrt3}\\arctan\\!\\left(\\frac{\\tan(x/2)}{\\sqrt3}\\right) + C",
    integrandExpr: "1/(2+cos(x))",
    resultExpr: "(2/sqrt(3))*atan(tan(x/2)/sqrt(3))",
    domain: [-2, 2],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{1}{1+\\cos x} \\text{ on } [0,\\tfrac\\pi2]",
    work: [
      "With t=\\tan\\frac x2: 1+\\cos x=1+\\frac{1-t^2}{1+t^2}=\\frac2{1+t^2}, so \\frac1{1+\\cos x}=\\frac{1+t^2}2.",
      "Multiplying by dx=\\frac2{1+t^2}\\,dt cancels completely: \\frac{1+t^2}2\\cdot\\frac2{1+t^2}=1 — the integrand becomes exactly dt.",
      "Convert the bounds instead of substituting back: x=0\\Rightarrow t=0, and x=\\tfrac\\pi2\\Rightarrow t=\\tan\\tfrac\\pi4=1.",
    ],
    result: "\\int_0^1 dt = 1",
    integrandExpr: "1/(1+cos(x))",
    resultExpr: "1",
    domain: [0, Math.PI / 2],
    kind: "definite",
  },
];

const FEYNMAN_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{e^{-x}-e^{-2x}}{x} \\text{ on } [0,\\infty)",
    work: [
      "Generalize: let I(a)=\\int_0^\\infty\\frac{e^{-x}-e^{-ax}}x\\,dx, so the target is I(2).",
      "Differentiate under the integral sign: the e^{-x} term is constant in a and vanishes, and \\frac{\\partial}{\\partial a}(-e^{-ax})=xe^{-ax} — the awkward \\frac1x cancels exactly, giving I'(a)=\\int_0^\\infty e^{-ax}\\,dx=\\frac1a.",
      "Integrate back in a: I(a)=\\ln a + C.",
      "Pin the constant: at a=1 the integrand is identically \\frac{e^{-x}-e^{-x}}x=0, so I(1)=0=\\ln1+C, giving C=0.",
    ],
    result: "I(2) = \\ln 2",
    integrandExpr: "(exp(-x)-exp(-2*x))/x",
    resultExpr: "ln(2)",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\frac{x^2-1}{\\ln x} \\text{ on } [0,1]",
    work: [
      "Generalize: let I(a) = \\int_0^1 \\frac{x^a - 1}{\\ln x}\\,dx, so the target is I(2).",
      "Differentiate under the integral sign: I'(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a+1} — differentiating x^a brings down a factor of \\ln x, which cancels the \\ln x in the denominator.",
      "Integrate back in a: I(a) = \\ln(a+1) + C.",
      "I(0) = 0 outright, since the integrand vanishes identically when a = 0 — so C = 0.",
    ],
    result: "I(2) = \\ln 3",
    integrandExpr: "(x^2-1)/ln(x)",
    resultExpr: "ln(3)",
    domain: [0, 1],
    kind: "definite",
  },
];

const BETA_EXAMPLES: WorkedExample[] = [
  {
    integrand: "x(1-x)^2 \\text{ on } [0,1]",
    work: [
      "Match to x^m(1-x)^n with m=1,\\ n=2. Expand the bracket first, the honest way: (1-x)^2=1-2x+x^2.",
      "Multiply through by x: x(1-2x+x^2)=x-2x^2+x^3.",
      "Integrate termwise and evaluate at the two ends: \\left[\\frac{x^2}2-\\frac{2x^3}3+\\frac{x^4}4\\right]_0^1=\\frac12-\\frac23+\\frac14.",
      "Common denominator 12: \\frac6{12}-\\frac8{12}+\\frac3{12}=\\frac1{12}.",
      "Check against the shortcut: \\frac{m!\\,n!}{(m+n+1)!}=\\frac{1!\\cdot2!}{4!}=\\frac2{24}=\\frac1{12} — the same number two different ways, which is exactly why the formula is safe to trust from here on.",
    ],
    result: "\\frac1{12}",
    integrandExpr: "x*(1-x)^2",
    resultExpr: "1/12",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "(x-2)^2(5-x)^3 \\text{ on } [2,5]",
    work: [
      "Not on [0,1] yet — rescale with u=\\frac{x-2}{5-2}=\\frac{x-2}3, so x=2+3u,\\ dx=3\\,du, and the bounds x=2,5 become u=0,1.",
      "Then x-2=3u and 5-x=5-(2+3u)=3-3u=3(1-u), so the integrand becomes (3u)^2\\big(3(1-u)\\big)^3\\cdot3\\,du=9\\cdot27\\cdot3\\,u^2(1-u)^3\\,du=729\\,u^2(1-u)^3\\,du.",
      "The rescaled integral is a plain Beta shape with m=2,\\ n=3: \\int_0^1u^2(1-u)^3\\,du=\\frac{2!\\,3!}{6!}=\\frac{12}{720}=\\frac1{60}.",
      "Multiply back by the 729 the rescaling produced: 729\\cdot\\frac1{60}=\\frac{729}{60}.",
    ],
    result: "\\frac{243}{20}",
    integrandExpr: "(x-2)^2*(5-x)^3",
    resultExpr: "243/20",
    domain: [2, 5],
    kind: "definite",
  },
];

const GAMMA_EXAMPLES: WorkedExample[] = [
  {
    integrand: "x^3e^{-x} \\text{ on } [0,\\infty)",
    work: [
      "Integrate by parts with u=x^3,\\ dv=e^{-x}\\,dx: du=3x^2\\,dx,\\ v=-e^{-x}.",
      "\\int_0^\\infty x^3e^{-x}\\,dx=\\left[-x^3e^{-x}\\right]_0^\\infty+3\\int_0^\\infty x^2e^{-x}\\,dx. The boundary term is 0 at both ends: x^3=0 at x=0, and e^{-x}\\to0 faster than x^3\\to\\infty at the other end.",
      "So writing I_n=\\int_0^\\infty x^ne^{-x}\\,dx, this says I_3=3I_2 — and the exact same by-parts argument gives I_2=2I_1 and I_1=1\\cdot I_0.",
      "Base case: I_0=\\int_0^\\infty e^{-x}\\,dx=\\left[-e^{-x}\\right]_0^\\infty=0-(-1)=1.",
      "Unwind: I_1=1\\cdot1=1,\\quad I_2=2\\cdot1=2,\\quad I_3=3\\cdot2=6 — exactly 3!.",
    ],
    result: "6",
    integrandExpr: "x^3*exp(-x)",
    resultExpr: "6",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "x^33^{-x} \\text{ on } [0,\\infty)",
    work: [
      "Rewrite the base so the decay is a plain e^{-ax}: 3^{-x}=e^{-x\\ln3}, so this is \\int_0^\\infty x^3e^{-x\\ln3}\\,dx.",
      "That's the a=\\ln3 case of \\int_0^\\infty x^ne^{-ax}\\,dx=\\frac{n!}{a^{n+1}}, with n=3.",
      "\\frac{3!}{(\\ln3)^4}=\\frac6{(\\ln3)^4}.",
    ],
    result: "\\frac6{(\\ln3)^4}",
    integrandExpr: "x^3*3^(-x)",
    resultExpr: "6/log(3)^4",
    domain: [0, Infinity],
    kind: "definite",
  },
];

const ZETA_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac x{e^x-1} \\text{ on } [0,\\infty)",
    work: [
      "For x>0, e^{-x}\\in(0,1), so \\frac1{e^x-1}=\\frac{e^{-x}}{1-e^{-x}}=e^{-x}\\sum_{j=0}^\\infty\\left(e^{-x}\\right)^j=\\sum_{j=0}^\\infty e^{-(j+1)x}. Relabelling k=j+1 gives \\frac1{e^x-1}=\\sum_{k=1}^\\infty e^{-kx}.",
      "Multiply by x and integrate term by term: \\int_0^\\infty\\frac{x}{e^x-1}\\,dx=\\sum_{k=1}^\\infty\\int_0^\\infty xe^{-kx}\\,dx.",
      "Each term is the n=1 Gamma-function integral, scaled: \\int_0^\\infty xe^{-kx}\\,dx=\\frac{1!}{k^2}=\\frac1{k^2}.",
      "The sum is \\sum_{k=1}^\\infty\\frac1{k^2}=\\zeta(2)=\\frac{\\pi^2}6 — the same constant Euler found by comparing \\frac{\\sin x}x's power series to its factorisation over its roots \\pm k\\pi; cited here rather than re-derived, exactly as \\Gamma\\!\\left(\\frac12\\right)=\\sqrt\\pi gets cited (not re-derived) wherever it's needed later.",
    ],
    result: "\\frac{\\pi^2}6",
    integrandExpr: "x/(exp(x)-1)",
    resultExpr: "pi^2/6",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\frac x{e^x+1} \\text{ on } [0,\\infty)",
    work: [
      "Same expansion with an alternating sign: \\frac1{e^x+1}=e^{-x}\\sum_{j=0}^\\infty(-1)^je^{-jx}=\\sum_{k=1}^\\infty(-1)^{k-1}e^{-kx}.",
      "Term by term: \\int_0^\\infty\\frac x{e^x+1}\\,dx=\\sum_{k=1}^\\infty(-1)^{k-1}\\frac1{k^2} — the alternating twin of \\zeta(2), written \\eta(2).",
      "Split \\zeta(2) into its even- and odd-indexed terms: the even ones, \\frac1{(2j)^2}, sum to \\frac14\\zeta(2), so the odd ones sum to the remaining \\frac34\\zeta(2). \\eta(2) is odd minus even: \\frac34\\zeta(2)-\\frac14\\zeta(2)=\\frac12\\zeta(2)=\\frac{\\pi^2}{12}.",
    ],
    result: "\\frac{\\pi^2}{12}",
    integrandExpr: "x/(exp(x)+1)",
    resultExpr: "pi^2/12",
    domain: [0, Infinity],
    kind: "definite",
  },
];

const WALLIS_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\sin^5x \\text{ on } \\left[0,\\frac\\pi2\\right]",
    work: [
      "Write \\sin^5x=\\sin^4x\\cdot\\sin x and integrate by parts with u=\\sin^4x,\\ dv=\\sin x\\,dx: du=4\\sin^3x\\cos x\\,dx,\\ v=-\\cos x.",
      "I_5=\\left[-\\sin^4x\\cos x\\right]_0^{\\pi/2}+4\\int_0^{\\pi/2}\\sin^3x\\cos^2x\\,dx. The boundary term is 0 at both ends: \\cos x=0 at \\frac\\pi2, and \\sin^4x=0 at 0.",
      "Replace \\cos^2x=1-\\sin^2x: I_5=4\\int_0^{\\pi/2}\\sin^3x(1-\\sin^2x)\\,dx=4(I_3-I_5).",
      "Solve for I_5: I_5+4I_5=4I_3\\Rightarrow I_5=\\frac45I_3 — the same shape as every I_n=\\frac{n-1}nI_{n-2}.",
      "Base case I_1=\\int_0^{\\pi/2}\\sin x\\,dx=1, so I_3=\\frac23I_1=\\frac23, and I_5=\\frac45\\cdot\\frac23=\\frac8{15}.",
    ],
    result: "\\frac8{15}",
    integrandExpr: "sin(x)^5",
    resultExpr: "8/15",
    domain: [0, Math.PI / 2],
    kind: "definite",
  },
  {
    integrand: "\\sin^6x \\text{ on } \\left[0,\\frac\\pi2\\right]",
    work: [
      "Same reduction, an even index this time — base case is I_0=\\frac\\pi2 instead of I_1=1.",
      "I_2=\\frac12\\cdot\\frac\\pi2=\\frac\\pi4.\\quad I_4=\\frac34\\cdot\\frac\\pi4=\\frac{3\\pi}{16}.",
      "I_6=\\frac56\\cdot\\frac{3\\pi}{16}=\\frac{15\\pi}{96}.",
    ],
    result: "\\frac{5\\pi}{32}",
    integrandExpr: "sin(x)^6",
    resultExpr: "5*pi/32",
    domain: [0, Math.PI / 2],
    kind: "definite",
  },
];

const RECIPROCAL_SUB_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{\\ln x}{1+x^2} \\text{ on } [0,\\infty)",
    work: [
      "Let I=\\int_0^\\infty\\frac{\\ln x}{1+x^2}\\,dx. Substitute x=\\frac1t: dx=-\\frac{dt}{t^2}, and the bounds (0,\\infty) flip to (\\infty,0) — flipping them back to (0,\\infty) is exactly what cancels that minus sign.",
      "1+x^2=1+\\frac1{t^2}=\\frac{t^2+1}{t^2}, so \\frac{dx}{1+x^2}=\\frac{dt/t^2}{(t^2+1)/t^2}=\\frac{dt}{1+t^2} — the awkward t^2 cancels completely, leaving the SAME measure as the original.",
      "And \\ln x=\\ln\\frac1t=-\\ln t. So I=\\int_0^\\infty\\frac{-\\ln t}{1+t^2}\\,dt=-I (relabelling t as x, this is just -1 times the original integral).",
      "2I=0, so I=0 — no antiderivative was ever needed.",
    ],
    result: "0",
    integrandExpr: "log(x)/(1+x^2)",
    resultExpr: "0",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\frac1{(1+x^2)(1+x^3)} \\text{ on } [0,\\infty)",
    work: [
      "Let I=\\int_0^\\infty\\frac{dx}{(1+x^2)(1+x^3)}. Substitute x=\\frac1t as before: (1+x^2) becomes \\frac{t^2+1}{t^2}, (1+x^3) becomes \\frac{t^3+1}{t^3}, and dx=-\\frac{dt}{t^2} (the bound-flip cancels the sign, as always) — so \\frac{dx}{(1+x^2)(1+x^3)} becomes \\frac{t^3\\,dt}{(1+t^2)(1+t^3)}, the t^2 from dx cancelling one of the two powers of t^2 sitting in the denominator's (1+x^2) factor.",
      "So I=\\int_0^\\infty\\frac{t^3\\,dt}{(1+t^2)(1+t^3)} — the SAME denominator as the original, just an extra t^3 upstairs. Relabelling t as x: I=\\int_0^\\infty\\frac{x^3\\,dx}{(1+x^2)(1+x^3)}.",
      "Add this to the original expression for I: 2I=\\int_0^\\infty\\frac{1+x^3}{(1+x^2)(1+x^3)}\\,dx=\\int_0^\\infty\\frac{dx}{1+x^2}=\\Big[\\arctan x\\Big]_0^\\infty=\\frac\\pi2.",
      "So I=\\frac\\pi4 — and nothing about '3' was actually used, only that (1+x^3) canceled against itself; the same argument works with x^a in place of x^3 for any a>0.",
    ],
    result: "\\frac\\pi4",
    integrandExpr: "1/((1+x^2)*(1+x^3))",
    resultExpr: "pi/4",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\frac{\\arctan x}{x(1+\\ln^2x)} \\text{ on } [0,\\infty)",
    work: [
      "Let I=\\int_0^\\infty\\frac{\\arctan x}{x(1+\\ln^2x)}\\,dx. Substitute x=\\frac1t: dx=-\\frac{dt}{t^2}, and the (0,\\infty)\\to(\\infty,0) bound-flip cancels that minus sign as usual. Since \\ln x=\\ln\\frac1t=-\\ln t, the \\ln^2x=\\ln^2t term is unchanged, so x(1+\\ln^2x)=\\frac1t(1+\\ln^2t), and \\frac{dx}{x(1+\\ln^2x)}=\\frac{-dt/t^2}{(1+\\ln^2t)/t}=-\\frac{dt}{t(1+\\ln^2t)} — the SAME measure as the original, up to that sign the bound-flip already cancels.",
      "Only the numerator actually changes: \\arctan x becomes \\arctan\\frac1t. For any y>0, \\arctan y+\\arctan\\frac1y=\\frac\\pi2 (complementary angles in a right triangle with legs y and 1), so \\arctan\\frac1t=\\frac\\pi2-\\arctan t.",
      "Assemble: I=\\int_0^\\infty\\frac{\\frac\\pi2-\\arctan t}{t(1+\\ln^2t)}\\,dt=\\frac\\pi2J-I, where J=\\int_0^\\infty\\frac{dt}{t(1+\\ln^2t)} and the second piece is exactly I again (same integrand, t relabelled as x).",
      "J itself collapses under w=\\ln t (so dw=\\frac{dt}t): J=\\int_{-\\infty}^\\infty\\frac{dw}{1+w^2}=\\Big[\\arctan w\\Big]_{-\\infty}^\\infty=\\pi.",
      "So I=\\frac\\pi2\\cdot\\pi-I=\\frac{\\pi^2}2-I, giving 2I=\\frac{\\pi^2}2, hence I=\\frac{\\pi^2}4.",
    ],
    result: "\\frac{\\pi^2}4",
  },
];

const RECURRENCE_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{x^2}{1+x} \\text{ on } [0,1]",
    work: [
      "Let I_n=\\int_0^1\\frac{x^n}{1+x}\\,dx. Add I_n and I_{n-1}: I_n+I_{n-1}=\\int_0^1\\frac{x^n+x^{n-1}}{1+x}\\,dx.",
      "Factor the numerator: x^n+x^{n-1}=x^{n-1}(x+1), and that (x+1) cancels the (1+x) in the denominator exactly, leaving \\int_0^1x^{n-1}\\,dx=\\frac1n.",
      "So I_n=\\frac1n-I_{n-1}. Base case: I_0=\\int_0^1\\frac{dx}{1+x}=\\Big[\\ln(1+x)\\Big]_0^1=\\ln2.",
      "Unwind: I_1=1-\\ln2, \\quad I_2=\\frac12-I_1=\\frac12-(1-\\ln2)=\\ln2-\\frac12.",
    ],
    result: "\\ln2-\\frac12",
    integrandExpr: "x^2/(1+x)",
    resultExpr: "log(2) - 1/2",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "x^2e^x \\text{ on } [0,1]",
    work: [
      "A different mechanism this time — by parts, not algebra. u=x^n,\\ dv=e^x\\,dx: I_n=\\left[x^ne^x\\right]_0^1-n\\int_0^1x^{n-1}e^x\\,dx=e-nI_{n-1} (the boundary term is e at x=1, and 0 at x=0).",
      "Base case: I_0=\\int_0^1e^x\\,dx=e-1.",
      "Unwind: I_1=e-1\\cdot(e-1)=1,\\quad I_2=e-2\\cdot1=e-2.",
    ],
    result: "e-2",
    integrandExpr: "x^2*exp(x)",
    resultExpr: "e - 2",
    domain: [0, 1],
    kind: "definite",
  },
];

const INTRODUCING_CONSTANTS_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\frac{x^2+7x+8}{x^2+5x+3}",
    work: [
      "The numerator is the denominator plus a remainder — subtract to find it: (x^2+7x+8)-(x^2+5x+3)=2x+5, so x^2+7x+8=(x^2+5x+3)+(2x+5).",
      "Split the integral along that split: \\int\\frac{x^2+7x+8}{x^2+5x+3}\\,dx=\\int1\\,dx+\\int\\frac{2x+5}{x^2+5x+3}\\,dx.",
      "The first piece is just x. The second happens to have exactly the denominator's own derivative on top — D'(x)=2x+5 — so it's a plain log by substitution: \\ln|x^2+5x+3|.",
      "Add the two pieces together.",
    ],
    result: "x+\\ln(x^2+5x+3)+C",
    integrandExpr: "(x^2+7*x+8)/(x^2+5*x+3)",
    resultExpr: "x + log(x^2+5*x+3)",
    domain: [0, 3],
    kind: "indefinite",
  },
  {
    integrand: "\\frac{3x+1}{x^2+2x+10}",
    work: [
      "This time the remainder isn't a clean match, so match coefficients directly: write 3x+1=\\lambda D'(x)+\\mu with D'(x)=2x+2, i.e. \\lambda(2x+2)+\\mu=2\\lambda x+(2\\lambda+\\mu).",
      "Match the x-coefficient: 2\\lambda=3\\Rightarrow\\lambda=\\frac32. Match the constant: 2\\lambda+\\mu=1\\Rightarrow\\mu=1-3=-2 — and indeed \\frac32(2x+2)-2=3x+3-2=3x+1, confirming the split.",
      "Split: \\frac32\\int\\frac{2x+2}{x^2+2x+10}\\,dx-2\\int\\frac{dx}{x^2+2x+10}.",
      "The first piece is \\frac32\\ln(x^2+2x+10). The second needs Completing the square first: x^2+2x+10=(x+1)^2+9, giving -2\\cdot\\frac13\\arctan\\frac{x+1}3=-\\frac23\\arctan\\frac{x+1}3 — reusing the standard form rather than re-deriving it.",
    ],
    result: "\\frac32\\ln(x^2+2x+10)-\\frac23\\arctan\\!\\left(\\frac{x+1}3\\right)+C",
    integrandExpr: "(3*x+1)/(x^2+2*x+10)",
    resultExpr: "(3/2)*log(x^2+2*x+10) - (2/3)*atan((x+1)/3)",
    domain: [-2, 3],
    kind: "indefinite",
  },
];

const FLOOR_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\lfloor x\\rfloor \\text{ on } [0,3]",
    work: [
      "\\lfloor x\\rfloor jumps at every integer, so split there: it equals 0 on [0,1), 1 on [1,2), and 2 on [2,3].",
      "On each piece \\lfloor x\\rfloor is just a constant, so each piece integrates to that constant times its width: \\int_0^3\\lfloor x\\rfloor\\,dx=0\\times1+1\\times1+2\\times1.",
      "Sum the three pieces: 0+1+2.",
    ],
    result: "3",
    integrandExpr: "floor(x)",
    resultExpr: "3",
    domain: [0, 3],
    kind: "definite",
  },
  {
    integrand: "\\lfloor x\\rfloor \\text{ on } [0,5]",
    work: [
      "Same split, five pieces this time: \\lfloor x\\rfloor equals 0,1,2,3,4 on [0,1),[1,2),[2,3),[3,4),[4,5] respectively.",
      "Every piece has width 1, so the integral is just the SUM 0+1+2+3+4 — an arithmetic series, exactly the collapse the recipe's last bullet points at.",
      "The sum of five consecutive integers starting at 0 is \\frac{(0+4)\\times5}2=10.",
    ],
    result: "10",
    integrandExpr: "floor(x)",
    resultExpr: "10",
    domain: [0, 5],
    kind: "definite",
  },
];

const INVERSE_INTEGRAL_EXAMPLES: WorkedExample[] = [
  {
    integrand: "\\arctan x \\text{ on } [0,1]",
    work: [
      "Treat \\arctan as f^{-1}, so f=\\tan is the easy direction. Match the bounds: we need f(a)=0 and f(b)=1, the values \\arctan actually runs over here — \\tan0=0 gives a=0, and \\tan\\frac\\pi4=1 gives b=\\frac\\pi4.",
      "The identity says \\int_0^{\\pi/4}\\tan x\\,dx+\\int_0^1\\arctan x\\,dx=b\\,f(b)-a\\,f(a)=\\frac\\pi4\\cdot1-0\\cdot0=\\frac\\pi4.",
      "Compute the easy piece: \\int_0^{\\pi/4}\\tan x\\,dx=\\Big[-\\ln|\\cos x|\\Big]_0^{\\pi/4}=-\\ln\\frac{\\sqrt2}2+\\ln1=-\\ln\\frac1{\\sqrt2}=\\frac12\\ln2.",
      "Solve for the target: \\int_0^1\\arctan x\\,dx=\\frac\\pi4-\\frac12\\ln2.",
    ],
    result: "\\frac\\pi4-\\frac12\\ln2",
    integrandExpr: "atan(x)",
    resultExpr: "pi/4 - (1/2)*log(2)",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "\\arcsin x \\text{ on } [0,1]",
    work: [
      "f(x)=\\sin x is the easy direction here, with f^{-1}=\\arcsin. Take a=0,\\ b=\\frac\\pi2 (so that f(b)=1).",
      "\\int_0^{\\pi/2}\\sin x\\,dx+\\int_0^1\\arcsin x\\,dx=\\frac\\pi2\\cdot1-0\\cdot0=\\frac\\pi2.",
      "The first integral is 1 (elementary), so \\int_0^1\\arcsin x\\,dx=\\frac\\pi2-1.",
    ],
    result: "\\frac\\pi2-1",
    integrandExpr: "asin(x)",
    resultExpr: "pi/2 - 1",
    domain: [0, 1],
    kind: "definite",
  },
];

const LOG_POWER_EXAMPLES: WorkedExample[] = [
  {
    integrand: "x^2\\ln x \\text{ on } [0,1]",
    work: [
      "Match the pattern with n=2,\\ k=1.",
      "J(a)=\\int_0^1x^a\\,dx=\\frac1{a+1} for a>-1 (a plain power rule) — the trivial integral hiding underneath.",
      "Differentiate both sides with respect to a: on the left, differentiating x^a=e^{a\\ln x} with respect to a brings down exactly one factor of \\ln x (chain rule on the exponent), so the left side becomes J'(a)=\\int_0^1x^a\\ln x\\,dx. On the right, \\frac{d}{da}(a+1)^{-1}=-(a+1)^{-2}.",
      "Set a=2 to match n=2: J'(2)=-\\frac1{3^2}=-\\frac19.",
    ],
    result: "-\\frac19",
    integrandExpr: "x^2*log(x)",
    resultExpr: "-1/9",
    domain: [0, 1],
    kind: "definite",
  },
  {
    integrand: "x\\ln^2x \\text{ on } [0,1]",
    work: [
      "Match the pattern with n=1,\\ k=2 and apply the closed form directly: \\int_0^1x\\ln^2x\\,dx=\\frac{(-1)^2\\,2!}{(1+1)^3}.",
      "\\frac28.",
    ],
    result: "\\frac14",
    integrandExpr: "x*log(x)^2",
    resultExpr: "1/4",
    domain: [0, 1],
    kind: "definite",
  },
];

const GAUSSIAN_EXAMPLES: WorkedExample[] = [
  {
    integrand: "e^{-x^2} \\text{ on } [0,\\infty)",
    work: [
      "Let I=\\int_{-\\infty}^\\infty e^{-x^2}\\,dx (the whole real line, so squaring works cleanly). I equals \\int_{-\\infty}^\\infty e^{-y^2}\\,dy under any other dummy-variable name too, so I^2=\\left(\\int e^{-x^2}dx\\right)\\left(\\int e^{-y^2}dy\\right)=\\iint_{\\mathbb R^2}e^{-(x^2+y^2)}\\,dx\\,dy.",
      "Switch to polar coordinates: x^2+y^2=r^2. A small polar patch between r,r+dr and \\theta,\\theta+d\\theta is, to first order, a rectangle with sides dr (radial) and r\\,d\\theta (tangential — arc length is radius times angle), so its area is r\\,dr\\,d\\theta, giving dx\\,dy=r\\,dr\\,d\\theta with r from 0 to \\infty and \\theta from 0 to 2\\pi.",
      "I^2=\\int_0^{2\\pi}\\int_0^\\infty e^{-r^2}\\,r\\,dr\\,d\\theta. The \\theta-integral is just 2\\pi. For the r-integral, u=r^2,\\ du=2r\\,dr, so \\int_0^\\infty e^{-r^2}r\\,dr=\\frac12\\int_0^\\infty e^{-u}\\,du=\\frac12 — the EXTRA r the area element supplied is exactly what makes this integral elementary.",
      "So I^2=2\\pi\\cdot\\frac12=\\pi, giving I=\\sqrt\\pi (positive, since e^{-x^2}>0 everywhere).",
      "e^{-x^2} is even, so the two halves of I contribute equally: \\int_0^\\infty e^{-x^2}\\,dx=\\frac I2=\\frac{\\sqrt\\pi}2.",
    ],
    result: "\\frac{\\sqrt\\pi}2",
    integrandExpr: "exp(-x^2)",
    resultExpr: "sqrt(pi)/2",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "x^2e^{-x^2} \\text{ on } [0,\\infty)",
    work: [
      "By parts with u=x,\\ dv=xe^{-x^2}\\,dx: du=dx,\\ v=-\\frac12e^{-x^2} (v is itself a plain substitution, w=x^2 inside).",
      "\\int_0^\\infty x^2e^{-x^2}\\,dx=\\left[-\\frac x2e^{-x^2}\\right]_0^\\infty+\\frac12\\int_0^\\infty e^{-x^2}\\,dx. The boundary term is 0 at both ends — 0 outright at x=0, and e^{-x^2} beats any polynomial as x\\to\\infty.",
      "The remaining integral is exactly the base result derived above: \\frac12\\cdot\\frac{\\sqrt\\pi}2.",
    ],
    result: "\\frac{\\sqrt\\pi}4",
    integrandExpr: "x^2*exp(-x^2)",
    resultExpr: "sqrt(pi)/4",
    domain: [0, Infinity],
    kind: "definite",
  },
  {
    integrand: "\\text{The hypersphere formula, checked at } d=3",
    work: [
      "\\omega_{d-1}=\\frac{2\\pi^{d/2}}{\\Gamma(d/2)}. At d=3: \\omega_2=\\frac{2\\pi^{3/2}}{\\Gamma(3/2)}.",
      "\\Gamma\\left(\\frac{3}{2}\\right)=\\frac{1}{2}\\Gamma\\left(\\frac{1}{2}\\right)=\\frac{\\sqrt\\pi}{2}, using \\Gamma(1/2)=\\sqrt\\pi — which is exactly I=\\sqrt\\pi from the first worked example, in Gamma-function notation.",
      "\\omega_2 = \\frac{2\\pi^{3/2}}{\\sqrt\\pi/2} = 4\\pi, and the surface area of a radius-r sphere is \\omega_2r^2=4\\pi r^2 — the familiar formula.",
    ],
    result: "4\\pi r^2",
  },
];

export const TECHNIQUES: Technique[] = [
  {
    id: "power",
    name: "Standard forms",
    tagline: "The dozen antiderivatives you must know cold.",
    prerequisites: [
      "Differentiating x^n, e^x, \\sin x, \\cos x and \\ln x by rule — you're about to reverse each one",
    ],
    whenToUse:
      "The integrand already is a standard form, or becomes one after you expand a bracket, split a fraction, or cancel. Always spend five seconds looking for this before anything clever.",
    intuition:
      "Every antiderivative here is a memorised derivative read backwards. The power rule turns x^{n+1} into (n+1)x^n when you differentiate, so reversing it just means dividing by that same (n+1) — except when n=-1, where 'divide by n+1' would mean dividing by zero. That gap is exactly why \\ln x exists as a separate standard form: its derivative is \\frac1x, precisely the one power the ordinary rule can't reach.",
    recipe: [
      "Expand products and split sums — \\int is linear, so break it up.",
      "Divide out: \\frac{x^4+2x^2+1}{x} is three power terms, not a quotient.",
      "Apply \\int x^n\\,dx = \\frac{x^{n+1}}{n+1} for n \\neq -1, and \\int \\frac{dx}{x} = \\ln|x| for n = -1.",
      "Recognise the six reflex forms: e^x,\\ \\sin,\\ \\cos,\\ \\sec^2,\\ \\frac{1}{1+x^2},\\ \\frac{1}{\\sqrt{1-x^2}}.",
    ],
    example: POWER_EXAMPLES[0],
    examples: POWER_EXAMPLES,
    pitfalls: [
      "n = -1 is the exception — \\frac{x^0}{0} is not a thing.",
      "\\int \\frac{dx}{x} is \\ln|x|, with the bars. Dropping them loses half the domain.",
    ],
    checkYourself: {
      prompt: "5x^4 - \\frac{2}{\\sqrt{x}}",
      answer: "x^5 - 4\\sqrt{x} + C",
      hint: "Rewrite \\frac{2}{\\sqrt x} as 2x^{-1/2} before integrating.",
    },
    completions: [
      {
        setup: [
          "\\int\\left(6x^2+\\frac1x-\\frac3{x^4}\\right)dx — split the sum and rewrite every term as a power of x first: 6x^2 stays; \\frac1x is the exception to the power rule; -\\frac3{x^4}=-3x^{-4}.",
          "Apply the power rule to the two ordinary terms: \\int6x^2\\,dx=2x^3, and \\int-3x^{-4}\\,dx=-3\\cdot\\frac{x^{-3}}{-3}=x^{-3}.",
        ],
        blank: "What does the remaining \\frac1x term integrate to, and why can't the ordinary power rule reach it?",
        answer: "\\ln|x| — the power rule \\frac{x^{n+1}}{n+1} would need n+1=0 there, i.e. dividing by zero, so \\frac1x is the one power with its own standard form. Full answer: 2x^3+\\ln|x|+x^{-3}+C.",
        integrandExpr: "6*x^2 + 1/x - 3/x^4",
        resultExpr: "2*x^3 + log(x) + x^(-3)",
        domain: [1, 3],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int\\left(\\sec^2x-\\frac3{1+x^2}\\right)dx — split into two standard forms: \\int\\sec^2x\\,dx-3\\int\\frac{dx}{1+x^2}.",
          "The first is one of the six reflex forms: \\int\\sec^2x\\,dx=\\tan x.",
        ],
        blank: "The second piece, and the combined answer.",
        answer: "\\int\\frac{dx}{1+x^2}=\\arctan x, so the second piece is -3\\arctan x. Full answer: \\tan x-3\\arctan x+C.",
        integrandExpr: "1/cos(x)^2 - 3/(1+x^2)",
        resultExpr: "tan(x) - 3*atan(x)",
        domain: [-1, 1],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "\\frac1{\\sqrt{1-x^2}} integrates to \\arcsin x by the standard-forms list, but \\sqrt{1-x^2} itself (no reciprocal) is not on that list at all. Why does moving the same expression from a denominator to a bare factor change everything, and what would you actually reach for on \\int\\sqrt{1-x^2}\\,dx?",
      answer: "The standard-forms list is just memorised derivatives read backwards — \\frac1{\\sqrt{1-x^2}} is on it because that IS \\frac d{dx}\\arcsin x, verbatim, with nothing to derive. \\sqrt{1-x^2} is a perfectly good elementary function to integrate, but it isn't ANY memorised function's derivative, so no amount of pattern-matching against the list finds it — you have to derive a fresh antiderivative, which is exactly what trigonometric substitution does (x=\\sin\\theta turns the root into \\cos\\theta via the Pythagorean identity, and \\int\\cos^2\\theta\\,d\\theta is a new integral, not a lookup). Two integrands that look like near-twins can need completely different amounts of work.",
    },
  },
  {
    id: "u-sub",
    name: "Substitution",
    tagline: "Undo the chain rule: spot an inside function and its derivative.",
    prerequisites: ["Standard forms", "The chain rule"],
    whenToUse:
      "You can see some inner function u = g(x) whose derivative g'(x) is also sitting in the integrand, up to a constant. Composite functions — anything raised to a power, inside a root, inside e^{\\,\\cdot}, inside \\ln, inside a trig function — are the tell.",
    intuition:
      "Substitution is the chain rule in reverse. If F is an antiderivative of f, the chain rule says \\frac{d}{dx}F(g(x))=F'(g(x))g'(x)=f(g(x))g'(x) — so any integrand shaped like 'f(g(x)) times g'(x)' is secretly \\frac{d}{dx}F(g(x)) in disguise, and naming u=g(x) just gives that hidden inside function a label so the pattern becomes visible.",
    recipe: [
      "Name the inside function u = g(x).",
      "Differentiate: du = g'(x)\\,dx.",
      "Rewrite the whole integrand in u. If any x survives, the substitution was wrong.",
      "Integrate in u, then put g(x) back.",
    ],
    example: U_SUB_EXAMPLES[0],
    examples: U_SUB_EXAMPLES,
    pitfalls: [
      "Constants are free, variables are not: you may pull \\tfrac{1}{2} out, never an x.",
      "For a definite integral, change the limits too — or convert back before substituting them.",
    ],
    checkYourself: {
      prompt: "3x^2e^{x^3}",
      answer: "e^{x^3} + C",
      hint: "The derivative of the exponent, x^3, is sitting right there as a factor — that's the tell.",
    },
    completions: [
      {
        setup: [
          "\\int_0^2 x\\sqrt{x^2+1}\\,dx — inside function u=x^2+1, so du=2x\\,dx, giving x\\,dx=\\tfrac12\\,du.",
          "Convert the bounds along with the substitution rather than converting back at the end: x=0\\Rightarrow u=1, and x=2\\Rightarrow u=5.",
          "The integral becomes \\tfrac12\\int_1^5\\sqrt u\\,du=\\tfrac12\\left[\\tfrac23u^{3/2}\\right]_1^5=\\tfrac13\\left[u^{3/2}\\right]_1^5.",
        ],
        blank: "Evaluate at the two converted bounds and finish — do you still need to substitute x^2+1 back in anywhere?",
        answer: "\\tfrac13\\left(5^{3/2}-1^{3/2}\\right)=\\tfrac13\\left(5\\sqrt5-1\\right). No — the bounds were already converted to u, so evaluating directly in u gives the final number; substituting back would mean re-converting to x-bounds you've already used, undoing useful work rather than finishing it.",
        integrandExpr: "x*sqrt(x^2+1)",
        resultExpr: "(1/3)*(5*sqrt(5)-1)",
        domain: [0, 2],
        kind: "definite",
      },
      {
        setup: [
          "\\int4x(x^2-3)^5\\,dx — inside function u=x^2-3, so du=2x\\,dx.",
          "The integrand has 4x, not 2x — but that's just a constant multiple away: 4x\\,dx=2\\cdot(2x\\,dx)=2\\,du.",
        ],
        blank: "Rewrite fully in u, integrate, and substitute back.",
        answer: "2\\int u^5\\,du=2\\cdot\\frac{u^6}6+C=\\frac{u^6}3+C=\\frac{(x^2-3)^6}3+C.",
        integrandExpr: "4*x*(x^2-3)^5",
        resultExpr: "(x^2-3)^6/3",
        domain: [-1, 1],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "For an indefinite integral you always substitute u back for x at the end — but for a definite integral with converted bounds, you don't, and substituting back anyway (using the ORIGINAL x-bounds on a u-shaped antiderivative) is a common way to get a garbage number. Why does converting the bounds change what \\text{'finishing'} the problem means?",
      answer: "\\int_a^bf(g(x))g'(x)\\,dx and \\int_{g(a)}^{g(b)}f(u)\\,du are literally the same number — the substitution didn't just change the integrand, it changed which variable the two boundary numbers belong to. An indefinite integral has no boundary numbers attached, only x itself, so the antiderivative MUST be handed back in x to mean anything as a function of x. But once you've converted the bounds to u-values, evaluating the u-antiderivative at those u-bounds already gives the correct signed area — converting back to x afterward and reusing the ORIGINAL x-bounds on a function that's secretly still in u terms double-processes the substitution and answers a different question entirely.",
    },
  },
  {
    id: "parts",
    name: "Integration by parts",
    tagline: "For products where one factor gets simpler when differentiated.",
    prerequisites: ["Substitution", "The product rule"],
    whenToUse:
      "A product of two unlike things: polynomial × exponential, polynomial × trig, or a lone \\ln x / \\arctan x / \\arcsin x (take dv = dx). Substitution fails because the second factor isn't the first one's derivative.",
    intuition:
      "Integration by parts is the product rule read backwards, the same way substitution is the chain rule read backwards. The product rule gives \\frac{d}{dx}[uv]=u'v+uv', so integrating both sides gives uv=\\int u'v\\,dx+\\int uv'\\,dx — rearranged, \\int uv'\\,dx=uv-\\int u'v\\,dx, which IS the by-parts formula, just written with dv=v'dx and du=u'dx.",
    recipe: [
      "\\int u\\,dv = uv - \\int v\\,du.",
      "Pick u by LIATE — Log, Inverse trig, Algebraic, Trig, Exponential — first match wins.",
      "Differentiate u, integrate dv, assemble.",
      "If the new integral is worse, you chose u backwards. If it's the same integral, you're in a loop — solve for it algebraically.",
    ],
    example: PARTS_EXAMPLES[0],
    examples: PARTS_EXAMPLES,
    pitfalls: [
      "\\int \\ln x\\,dx is a parts problem: u = \\ln x, dv = dx.",
      "The loop case (\\int e^x \\sin x\\,dx) is not a dead end — apply parts twice, then move the copy of I to the left.",
      "It's -\\int v\\,du, not +\\int v\\,du — dropping that minus sign is the single most common slip.",
    ],
    checkYourself: {
      prompt: "x\\sin x",
      answer: "\\sin x - x\\cos x + C",
      hint: "u = x (it gets simpler when differentiated), dv = \\sin x\\,dx.",
    },
    completions: [
      {
        setup: [
          "\\int\\arctan x\\,dx — no visible product, but LIATE still applies: u=\\arctan x,\\ dv=dx (the dx itself is the second factor).",
          "du=\\frac{dx}{1+x^2},\\quad v=x.",
          "Assemble: uv-\\int v\\,du=x\\arctan x-\\int\\frac x{1+x^2}\\,dx.",
        ],
        blank: "Finish the remaining integral (it's a plain u-substitution) and combine.",
        answer: "\\int\\frac x{1+x^2}\\,dx=\\tfrac12\\ln(1+x^2) (substitute w=1+x^2), so the full answer is x\\arctan x-\\tfrac12\\ln(1+x^2)+C.",
        integrandExpr: "atan(x)",
        resultExpr: "x*atan(x) - (1/2)*log(1+x^2)",
        domain: [-1, 1],
        kind: "indefinite",
      },
      {
        setup: [
          "I=\\int e^x\\sin x\\,dx — first pass: u=\\sin x,\\ dv=e^x\\,dx, so du=\\cos x\\,dx,\\ v=e^x. I=e^x\\sin x-\\int e^x\\cos x\\,dx.",
          "The new integral is the same shape — apply parts again, same choice of which factor is u: u=\\cos x,\\ dv=e^x\\,dx, so du=-\\sin x\\,dx,\\ v=e^x. \\int e^x\\cos x\\,dx=e^x\\cos x+\\int e^x\\sin x\\,dx=e^x\\cos x+I.",
          "Substitute that back into the first line: I=e^x\\sin x-\\left(e^x\\cos x+I\\right)=e^x\\sin x-e^x\\cos x-I.",
        ],
        blank: "This is one equation in I, not a dead end — solve for it.",
        answer: "2I=e^x\\sin x-e^x\\cos x, so I=\\frac{e^x(\\sin x-\\cos x)}2+C (the +C only appears once you've actually solved for the indefinite integral, since each application of parts only fixed things up to a constant).",
        integrandExpr: "exp(x)*sin(x)",
        resultExpr: "(exp(x)*(sin(x)-cos(x)))/2",
        domain: [-1, 1],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "LIATE ranks logs and inverse trig functions ABOVE plain algebraic terms like x^2 for u — but \\frac d{dx}\\ln x=\\frac1x doesn't look obviously simpler than \\ln x itself the way \\frac d{dx}x^2=2x is simpler than x^2. Why do logs and inverse trig still go first?",
      answer: "\\text{'Simpler when differentiated'} is the right heuristic for choosing between two algebraic-type factors (x^2 vs x), but \\ln x and \\arctan x have no elementary antiderivative of their own to fall back on as dv — if you tried dv=\\ln x\\,dx, you'd need v=\\int\\ln x\\,dx first, which is a harder problem than the one you started with. Putting them as u sidesteps this: their derivative (\\frac1x or \\frac1{1+x^2}) is an ordinary rational function, easy to integrate against whatever v turns out to be. LIATE isn't really ranking how much simpler the derivative looks in isolation — it's ranking which factor is safe to differentiate against which factor you actually know how to integrate, and logs and inverse trig fail the second test completely.",
    },
  },
  {
    id: "trig-identity",
    name: "Trig identities",
    tagline: "Rewrite powers and products until a substitution appears.",
    prerequisites: ["Substitution", "\\sin^2x+\\cos^2x=1 and the double-angle formulas"],
    whenToUse:
      "Powers of sine and cosine, powers of tan and sec, or products like \\sin 3x \\cos 5x. Nothing substitutes yet — you have to reshape the integrand first.",
    intuition:
      "None of these integrands are standard forms as written, and no inner-derivative pattern jumps out for a plain substitution either — the identities exist specifically to manufacture one. Peeling one factor off an odd power leaves an even power, which \\sin^2+\\cos^2=1 converts into the OTHER function — revealing a du sitting right there. Halving the degree of an even power does the analogous job for \\sin^2\\theta and \\cos^2\\theta themselves, trading one hard integral for two easy ones in a doubled angle.",
    recipe: [
      "Odd power of \\sin or \\cos: peel off one factor for du and convert the rest with \\sin^2 + \\cos^2 = 1.",
      "All powers even: drop the degree with \\sin^2\\theta = \\tfrac{1-\\cos 2\\theta}{2} and \\cos^2\\theta = \\tfrac{1+\\cos 2\\theta}{2}.",
      "Tan/sec: use \\tan^2 = \\sec^2 - 1, and remember \\tfrac{d}{dx}\\sec x = \\sec x \\tan x.",
      "Different frequencies: product-to-sum, \\sin A \\cos B = \\tfrac{1}{2}[\\sin(A+B) + \\sin(A-B)].",
    ],
    example: TRIG_IDENTITY_EXAMPLES[0],
    examples: TRIG_IDENTITY_EXAMPLES,
    pitfalls: [
      "Halving the degree doubles the angle — \\int \\sin^2 x\\,dx = \\tfrac{x}{2} - \\tfrac{\\sin 2x}{4}, and that 4 catches everyone.",
      "\\int \\sec x\\,dx is a memorised trick (multiply by \\tfrac{\\sec x + \\tan x}{\\sec x + \\tan x}), not something you'll derive under time pressure.",
    ],
    checkYourself: {
      prompt: "\\sin^2x",
      answer: "\\frac x2 - \\frac{\\sin2x}4 + C",
      hint: "Halve the degree with \\sin^2x=\\frac{1-\\cos2x}2 first — this one won't substitute directly.",
    },
    completions: [
      {
        setup: [
          "\\int\\sin^4x\\cos^3x\\,dx — the cos power is odd: peel one off, \\sin^4x\\cos^2x\\cdot\\cos x.",
          "Convert the even part with \\cos^2x=1-\\sin^2x: \\sin^4x(1-\\sin^2x)\\cos x=(\\sin^4x-\\sin^6x)\\cos x.",
          "Now u=\\sin x,\\ du=\\cos x\\,dx, leaving \\int(u^4-u^6)\\,du.",
        ],
        blank: "Integrate in u and substitute back.",
        answer: "\\frac{u^5}5-\\frac{u^7}7+C=\\frac{\\sin^5x}5-\\frac{\\sin^7x}7+C.",
        integrandExpr: "sin(x)^4*cos(x)^3",
        resultExpr: "sin(x)^5/5 - sin(x)^7/7",
        domain: [0.3, 2.5],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int\\sin^2x\\cos^2x\\,dx — both powers are even AND there's a product: combine first using \\sin x\\cos x=\\tfrac12\\sin2x, so \\sin^2x\\cos^2x=(\\sin x\\cos x)^2=\\tfrac14\\sin^22x.",
          "That's a new even power, of \\sin2x this time — halve ITS degree the same way: \\sin^22x=\\tfrac{1-\\cos4x}2, so the integrand becomes \\tfrac18(1-\\cos4x).",
        ],
        blank: "Integrate termwise, watching for the doubled-angle factor in the second term.",
        answer: "\\tfrac18\\left(x-\\tfrac{\\sin4x}4\\right)+C=\\tfrac x8-\\tfrac{\\sin4x}{32}+C.",
        integrandExpr: "sin(x)^2*cos(x)^2",
        resultExpr: "x/8 - sin(4*x)/32",
        domain: [0.3, 2.5],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "\\sin^3x is handled by peeling off one factor and using \\sin^2x=1-\\cos^2x; \\sin^4x is handled by halving the degree with the double-angle identity instead. Why does the SAME-looking problem (an integer power of \\sin x) split into two completely different techniques depending on parity, and what goes wrong if you try to peel a factor off \\sin^4x the same way?",
      answer: "Peeling one factor off an odd power always leaves an EVEN power behind (\\sin^3x=\\sin^2x\\cdot\\sin x, and 3-1=2 is even) — and \\sin^2x=1-\\cos^2x turns that even power into a plain polynomial in \\cos x, with the lone leftover \\sin x acting as exactly du for u=\\cos x. Try peeling a factor off the even power \\sin^4x the same way and you get \\sin^3x\\cdot\\sin x — but 4-1=3 is odd, so the identity has no even power left to convert; \\sin^3x itself still contains a stray, unconvertible \\sin x. The peel-and-convert move only closes up when peeling ONE factor leaves an EVEN remainder, which is exactly the odd-power case; an even total power has no such split, so it needs the double-angle identity instead, which works on any power by attacking the angle rather than by peeling a factor.",
    },
  },
  {
    id: "trig-sub",
    name: "Trigonometric substitution",
    tagline: "Kill a root over a quadratic by making the Pythagorean identity do the work.",
    prerequisites: ["Trig identities", "The Pythagorean identity in its three forms: 1-\\sin^2=\\cos^2,\\ 1+\\tan^2=\\sec^2,\\ \\sec^2-1=\\tan^2"],
    whenToUse:
      "You see \\sqrt{a^2-x^2}, \\sqrt{a^2+x^2} or \\sqrt{x^2-a^2} — or those same quadratics raised to a half-integer power — and no inner derivative is available for a plain substitution.",
    intuition:
      "A plain u-substitution needs the derivative of the inside function sitting in the integrand already; \\sqrt{a^2-x^2} offers no such thing on its own. Trig substitution manufactures one indirectly: setting x=a\\sin\\theta doesn't just reshape the root, it also supplies dx=a\\cos\\theta\\,d\\theta for free, and the Pythagorean identity is exactly what turns a^2-a^2\\sin^2\\theta into the perfect square (a\\cos\\theta)^2 — the root disappears entirely rather than merely simplifying.",
    recipe: [
      "\\sqrt{a^2-x^2}: put x = a\\sin\\theta, so the root becomes a\\cos\\theta.",
      "\\sqrt{a^2+x^2}: put x = a\\tan\\theta, so the root becomes a\\sec\\theta.",
      "\\sqrt{x^2-a^2}: put x = a\\sec\\theta, so the root becomes a\\tan\\theta.",
      "Integrate in \\theta, then draw the right triangle to convert every \\theta back into x.",
    ],
    example: TRIG_SUB_EXAMPLES[0],
    examples: TRIG_SUB_EXAMPLES,
    pitfalls: [
      "Always convert back to x. An answer in \\theta is an unfinished answer.",
      "Check first whether a plain u-substitution works — \\int \\tfrac{x\\,dx}{\\sqrt{1-x^2}} needs no triangle at all.",
    ],
    checkYourself: {
      prompt: "\\frac1{(x^2+4)^{3/2}}",
      answer: "\\frac{x}{4\\sqrt{x^2+4}} + C",
      hint: "x=2\\tan\\theta turns x^2+4 into 4\\sec^2\\theta, and the power \\tfrac32 collapses into a plain \\cos\\theta integral.",
    },
    completions: [
      {
        setup: [
          "\\int\\frac{\\sqrt{x^2-16}}x\\,dx — matches \\sqrt{x^2-a^2} with a=4: put x=4\\sec\\theta, so dx=4\\sec\\theta\\tan\\theta\\,d\\theta and \\sqrt{x^2-16}=4\\tan\\theta.",
          "Substitute everything: \\frac{4\\tan\\theta}{4\\sec\\theta}\\cdot4\\sec\\theta\\tan\\theta\\,d\\theta=4\\tan^2\\theta\\,d\\theta.",
          "Convert with \\tan^2\\theta=\\sec^2\\theta-1: 4\\int(\\sec^2\\theta-1)\\,d\\theta=4\\tan\\theta-4\\theta.",
        ],
        blank: "Draw the triangle (adjacent 4, opposite \\sqrt{x^2-16}, hypotenuse x) and convert both \\tan\\theta and \\theta back to x.",
        answer: "\\tan\\theta=\\frac{\\sqrt{x^2-16}}4, and \\theta=\\arccos\\frac4x (from \\cos\\theta=\\text{adjacent}/\\text{hypotenuse}), so the full answer is \\sqrt{x^2-16}-4\\arccos\\!\\left(\\frac4x\\right)+C.",
        integrandExpr: "sqrt(x^2-16)/x",
        resultExpr: "sqrt(x^2-16) - 4*acos(4/x)",
        domain: [5, 8],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int\\frac x{\\sqrt{9-x^2}}\\,dx — before reaching for x=3\\sin\\theta, check whether the numerator is already (a multiple of) the derivative of what's under the root. Here \\frac d{dx}(9-x^2)=-2x, and the numerator is x — off by only a constant.",
          "That means a plain substitution beats trig substitution here: u=9-x^2,\\ du=-2x\\,dx, so x\\,dx=-\\tfrac12du.",
        ],
        blank: "Finish with the plain substitution — no triangle needed.",
        answer: "-\\tfrac12\\int\\frac{du}{\\sqrt u}=-\\tfrac12\\cdot2\\sqrt u+C=-\\sqrt u+C=-\\sqrt{9-x^2}+C.",
        integrandExpr: "x/sqrt(9-x^2)",
        resultExpr: "-sqrt(9-x^2)",
        domain: [-2, 2],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "\\sqrt{a^2-x^2} calls for x=a\\sin\\theta, \\sqrt{a^2+x^2} calls for x=a\\tan\\theta, and \\sqrt{x^2-a^2} calls for x=a\\sec\\theta. Why those three specific functions, and not (say) x=a\\cos\\theta for the first one, which has the same range?",
      answer: "Each substitution exists to turn a^2\\pm x^2 into a PERFECT SQUARE via a Pythagorean identity, and each of the three identities (1-\\sin^2=\\cos^2,\\ 1+\\tan^2=\\sec^2,\\ \\sec^2-1=\\tan^2) matches exactly one sign pattern. x=a\\sin\\theta works because a^2-a^2\\sin^2\\theta=a^2\\cos^2\\theta lines up the minus sign in a^2-x^2 with the minus sign in 1-\\sin^2\\theta — and x=a\\cos\\theta would work by the identical algebra (\\sin and \\cos satisfy the same identity with the roles swapped); sine is simply the convention, chosen so \\theta increases with x over the usual range rather than running backwards. \\tan and \\sec are less interchangeable: theirs is the one standard trig identity that comes in a PLUS form (1+\\tan^2=\\sec^2), which is what a^2+x^2 needs, and the same identity rearranged (\\sec^2-1=\\tan^2) is what x^2-a^2 needs — \\sin and \\cos have no version of their identity with a plus sign at all, which is exactly why they only ever appear in the a^2-x^2 case.",
    },
  },
  {
    id: "partial-fractions",
    name: "Partial fractions",
    tagline: "Split one hard rational function into several easy ones.",
    prerequisites: ["Standard forms", "Polynomial long division"],
    whenToUse:
      "A ratio of polynomials whose denominator factors, and whose numerator is not (a multiple of) the denominator's derivative.",
    intuition:
      "A single fraction like \\frac1{x(x+1)} has no standard antiderivative, but \\frac1x and \\frac1{x+1} each do — partial fractions is the algebra that finds simple fractions which happen to add up to the complicated one you started with, so integrating termwise becomes possible. It works because the same algebra runs in reverse: \\frac A{x-a}+\\frac B{x-b} always recombines into one fraction over the common denominator (x-a)(x-b), so any proper fraction over a product of factors can be decomposed the same way.",
    recipe: [
      "If \\deg(\\text{top}) \\geq \\deg(\\text{bottom}), divide first.",
      "Factor the denominator completely.",
      "Write one term per factor: \\tfrac{A}{x-a}, plus \\tfrac{B}{(x-a)^2} for repeated roots, and \\tfrac{Bx+C}{x^2+bx+c} for irreducible quadratics.",
      "Clear denominators and solve for the constants — substituting the roots is fastest.",
      "Integrate each piece: linear factors give logs, irreducible quadratics give a log plus an arctan.",
    ],
    example: PARTIAL_FRACTIONS_EXAMPLES[0],
    examples: PARTIAL_FRACTIONS_EXAMPLES,
    pitfalls: [
      "Skipping the division step when the top has the higher degree — you'll get constants that don't solve.",
      "A repeated factor (x-a)^2 needs both \\tfrac{A}{x-a} and \\tfrac{B}{(x-a)^2}.",
    ],
    checkYourself: {
      prompt: "\\frac1{x^2-4}",
      answer: "\\frac14\\ln\\left|\\frac{x-2}{x+2}\\right| + C",
      hint: "Factor the denominator first: x^2-4=(x-2)(x+2).",
    },
    completions: [
      {
        setup: [
          "\\int\\frac{3x+5}{(x+2)^2}\\,dx — a repeated factor needs both terms: \\frac{3x+5}{(x+2)^2}=\\frac A{x+2}+\\frac B{(x+2)^2}, i.e. 3x+5=A(x+2)+B.",
          "x=-2 gives B=-1; matching the x-coefficient gives A=3.",
          "So the integrand splits into \\frac3{x+2}-\\frac1{(x+2)^2}.",
        ],
        blank: "Integrate each piece.",
        answer: "3\\ln|x+2|+\\frac1{x+2}+C (the second piece is a plain power of (x+2): \\int-(x+2)^{-2}\\,dx=(x+2)^{-1}).",
        integrandExpr: "(3*x+5)/(x+2)^2",
        resultExpr: "3*log(x+2) + 1/(x+2)",
        domain: [-1, 3],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int\\frac4{x(x^2+4)}\\,dx — set up with a linear top over the irreducible quadratic: \\frac4{x(x^2+4)}=\\frac Ax+\\frac{Bx+C}{x^2+4}, i.e. 4=A(x^2+4)+(Bx+C)x.",
          "Match coefficients: the x^2 term gives A+B=0; the x term gives C=0; the constant gives 4A=4\\Rightarrow A=1, so B=-1.",
          "The integrand splits into \\frac1x-\\frac x{x^2+4} — a plain log, and a log-shaped piece (the numerator is exactly half the denominator's derivative).",
        ],
        blank: "Integrate both pieces — and notice there's no arctan here, even though an irreducible quadratic usually produces one. Why not, this time?",
        answer: "\\ln|x|-\\tfrac12\\ln(x^2+4)+C. The arctan piece needs a genuine leftover CONSTANT numerator after splitting off the \\frac{Bx}{x^2+4} log part — here C=0 exactly, so there's nothing left to produce an arctan; the quadratic's own numerator was entirely derivative-shaped, with no constant remainder.",
        integrandExpr: "4/(x*(x^2+4))",
        resultExpr: "log(x) - (1/2)*log(x^2+4)",
        domain: [0.5, 3],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "The recipe insists on polynomial long division first whenever the numerator's degree is at least the denominator's. What actually goes wrong with the method — not just \\text{'you get the wrong answer'} but why — if you skip that step and set up \\frac A{x-a}+\\frac B{x-b}+\\cdots directly against a top-heavy fraction?",
      answer: "\\frac A{x-a}+\\frac B{x-b}+\\cdots is a sum of terms that each vanish as x\\to\\infty (every one behaves like a constant over x for large x), so ANY such sum recombines into a fraction whose numerator has strictly SMALLER degree than its denominator — that's a structural property of the partial-fraction form itself, not a choice you make while solving. A top-heavy fraction (numerator degree \\geq denominator degree) does not go to zero as x\\to\\infty — it grows like a polynomial — so no combination of A,B,\\ldots can ever reproduce it; the system of equations you'd write down to solve for the constants is either inconsistent or (worse) silently produces numbers that don't actually recombine to the fraction you started with. Dividing first peels off the polynomial part explicitly, leaving a genuinely proper fraction that the partial-fraction form can represent.",
    },
  },
  {
    id: "complete-square",
    name: "Completing the square",
    tagline: "Turn any quadratic into u^2 \\pm a^2 and reduce to a known form.",
    prerequisites: ["Standard forms (specifically \\frac1{1+x^2}\\to\\arctan x and \\frac1{\\sqrt{1-x^2}}\\to\\arcsin x)", "Partial fractions"],
    whenToUse:
      "A quadratic in the denominator (or under a root) that does not factor nicely — x^2+2x+5, x^2+4x+13. The result is almost always an arctan, a log, or an arcsin.",
    intuition:
      "\\frac1{1+x^2} integrates to \\arctan x by a memorised standard form, but \\frac1{x^2+2x+5} doesn't look anything like that — until you notice x^2+2x+5 is just (x+1)^2+4 in disguise. Completing the square rewrites ANY quadratic as (\\text{something})^2 plus or minus a constant, which is exactly the shape the arctan/arcsin standard forms need; the substitution u=x+\\tfrac b2 then makes 'something' the new variable, and the standard form applies directly.",
    recipe: [
      "Write x^2 + bx + c as \\left(x + \\tfrac{b}{2}\\right)^2 + \\left(c - \\tfrac{b^2}{4}\\right).",
      "Substitute u = x + \\tfrac{b}{2}, so du = dx.",
      "If the numerator has an x, split it first: write it as \\lambda \\cdot (\\text{derivative of the quadratic}) + \\mu.",
      "The \\lambda part is a log by substitution; the \\mu part is the arctan or arcsin standard form.",
    ],
    example: COMPLETE_SQUARE_EXAMPLES[0],
    examples: COMPLETE_SQUARE_EXAMPLES,
    pitfalls: [
      "Forgetting the \\tfrac{1}{a} out front of the arctan.",
      "A numerator containing x is not optional extra work — split it before you complete the square.",
    ],
    checkYourself: {
      prompt: "\\frac1{\\sqrt{3-2x-x^2}}",
      answer: "\\arcsin\\!\\left(\\frac{x+1}2\\right) + C",
      hint: "Complete the square on 3-2x-x^2 — factor out the minus sign on the x^2 term first.",
    },
    completions: [
      {
        setup: [
          "\\int\\frac1{\\sqrt{-x^2+4x}}\\,dx — the x^2 coefficient is negative, so factor that out first: -x^2+4x=-(x^2-4x).",
          "Complete the square inside the brackets: x^2-4x=(x-2)^2-4, so -x^2+4x=-\\left[(x-2)^2-4\\right]=4-(x-2)^2.",
          "Substitute u=x-2,\\ du=dx: the integral is \\int\\frac{du}{\\sqrt{4-u^2}} — a plain arcsin standard form with a=2.",
        ],
        blank: "Finish with the arcsin standard form and substitute back.",
        answer: "\\arcsin\\frac u2+C=\\arcsin\\!\\left(\\frac{x-2}2\\right)+C.",
        integrandExpr: "1/sqrt(-x^2+4*x)",
        resultExpr: "asin((x-2)/2)",
        domain: [1, 3],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int\\frac{x-2}{x^2+2x+2}\\,dx — split the numerator against the denominator's derivative, D'(x)=2x+2: write x-2=\\lambda(2x+2)+\\mu.",
          "Match the x-coefficient: 2\\lambda=1\\Rightarrow\\lambda=\\tfrac12. Match the constant: 2\\lambda+\\mu=-2\\Rightarrow\\mu=-3 (check: \\tfrac12(2x+2)-3=x+1-3=x-2, correct).",
          "Split: \\tfrac12\\int\\frac{2x+2}{x^2+2x+2}\\,dx-3\\int\\frac{dx}{x^2+2x+2}. The first piece is \\tfrac12\\ln(x^2+2x+2).",
        ],
        blank: "Complete the square on the second piece's denominator and finish.",
        answer: "x^2+2x+2=(x+1)^2+1, so \\int\\frac{dx}{x^2+2x+2}=\\arctan(x+1), giving -3\\arctan(x+1). Full answer: \\tfrac12\\ln(x^2+2x+2)-3\\arctan(x+1)+C.",
        integrandExpr: "(x-2)/(x^2+2*x+2)",
        resultExpr: "(1/2)*log(x^2+2*x+2) - 3*atan(x+1)",
        domain: [-2, 2],
        kind: "indefinite",
      },
    ],
    selfExplain: {
      prompt: "For a monic quadratic x^2+bx+c, completing the square always gives \\left(x+\\tfrac b2\\right)^2+\\left(c-\\tfrac{b^2}4\\right). Why does the SIGN of that leftover constant, c-\\tfrac{b^2}4, decide whether you finish with \\arctan (as in the lesson's worked examples) or with a factored log (which is really Partial fractions territory) — and what does that sign actually measure about the original quadratic?",
      answer: "c-\\tfrac{b^2}4 is just -\\tfrac14 times the discriminant b^2-4c, so its sign is the discriminant's sign flipped. When the leftover is POSITIVE (discriminant negative), the quadratic has no real roots — it never factors over the reals, which is exactly why Partial fractions has no linear pieces to split it into, and completing the square lands on u^2+a^2, the \\arctan shape. When the leftover is NEGATIVE (discriminant positive), the quadratic DOES have two real roots, and completing the square lands on u^2-a^2 instead — which factors immediately as (u-a)(u+a), exactly Partial fractions' territory (\\frac1{u^2-a^2} splits into two linear fractions and integrates to a log). The two techniques aren't really separate tools for unrelated situations — they're the same complete-the-square-and-see-what's-left move, branching on the one number (the discriminant) that already tells you whether the denominator factors over the reals at all.",
    },
  },
  {
    id: "symmetry",
    name: "Symmetry and definite tricks",
    tagline: "Sometimes the fastest antiderivative is no antiderivative.",
    prerequisites: ["Definite integrals as signed area", "\\sin(\\pi-x)=\\sin x and \\cos(\\pi-x)=-\\cos x"],
    whenToUse:
      "A definite integral over a symmetric interval, or over [0, \\tfrac{\\pi}{2}] / [0, \\pi] where the integrand rearranges into itself. Reach for this when the antiderivative looks impossible — that's usually the hint.",
    intuition:
      "Definite integrals carry information indefinite ones don't: a value at specific bounds, not a whole family of antiderivatives. King's rule exploits exactly that extra information — it says \\int_0^af(x)\\,dx and \\int_0^af(a-x)\\,dx are the SAME number (relabelling which end of the interval you call 'start' can't change the area under the curve), even when f(x) and f(a-x) look nothing alike as functions. Adding the two rewritten integrals together can make an intractable integrand collapse into something trivial, purely from that relabelling — no antiderivative required at all.",
    recipe: [
      "Odd integrand on [-a, a]: the answer is 0, no work required.",
      "Even integrand on [-a, a]: use 2\\int_0^a.",
      "King's rule: \\int_0^a f(x)\\,dx = \\int_0^a f(a-x)\\,dx. Add the two and watch the integrand collapse.",
      "On [0, \\pi], \\sin(\\pi - x) = \\sin x while \\cos(\\pi-x) = -\\cos x — that asymmetry is what the trick exploits.",
    ],
    example: SYMMETRY_EXAMPLES[0],
    examples: SYMMETRY_EXAMPLES,
    pitfalls: [
      "Odd/even only helps when the interval is symmetric about 0.",
      "After king's rule you must add the two forms — the rewritten integral alone is no easier.",
    ],
    checkYourself: {
      prompt: "\\frac{x\\sin x}{1+\\cos^2x} \\text{ on } [0,\\pi]",
      answer: "\\frac{\\pi^2}{4}",
      hint: "Apply king's rule with a=\\pi (using \\sin(\\pi-x)=\\sin x and \\cos(\\pi-x)=-\\cos x), add the two versions of the integral, then finish the leftover \\pi\\int f(x)\\,dx with u=\\cos x.",
    },
    completions: [
      {
        setup: [
          "\\int_{-3}^3\\frac{x^5}{x^4+1}\\,dx — check parity: f(-x)=\\frac{(-x)^5}{(-x)^4+1}=\\frac{-x^5}{x^4+1}=-f(x) — the integrand is odd (an odd power on top, an even one on the bottom, and odd/even is odd).",
          "The interval [-3,3] is symmetric about 0.",
        ],
        blank: "What's the value of the integral, and why is no antiderivative needed at all?",
        answer: "0. An odd function's graph on [-3,0] is the exact upside-down mirror of its graph on [0,3] — f(-x)=-f(x) means the value at -x is minus the value at x, for every x — so the signed area exactly cancels, however complicated \\frac{x^5}{x^4+1}\\text{'s actual antiderivative would be to find.}",
        integrandExpr: "x^5/(x^4+1)",
        resultExpr: "0",
        domain: [-3, 3],
        kind: "definite",
      },
      {
        setup: [
          "I=\\int_0^{\\pi/2}\\frac{\\sin^3x}{\\sin^3x+\\cos^3x}\\,dx. King's rule with a=\\tfrac\\pi2 swaps \\sin and \\cos (since \\sin\\left(\\tfrac\\pi2-x\\right)=\\cos x and \\cos\\left(\\tfrac\\pi2-x\\right)=\\sin x).",
          "So I=\\int_0^{\\pi/2}\\frac{\\cos^3x}{\\cos^3x+\\sin^3x}\\,dx as well — same value, denominator unchanged (just reordered), only the numerator swapped.",
        ],
        blank: "Add the two expressions for I and finish.",
        answer: "2I=\\int_0^{\\pi/2}\\frac{\\sin^3x+\\cos^3x}{\\sin^3x+\\cos^3x}\\,dx=\\int_0^{\\pi/2}1\\,dx=\\frac\\pi2, so I=\\frac\\pi4 — exactly the same answer as the n=1 case in the lesson's own worked example, and by the identical argument this works for ANY power n, not just 1 or 3.",
        integrandExpr: "sin(x)^3/(sin(x)^3+cos(x)^3)",
        resultExpr: "pi/4",
        domain: [0, Math.PI / 2],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "King's rule gives you a second, equally valid expression for the SAME integral I — but by itself, that second expression is usually no easier to evaluate than the first (in the completion above, \\frac{\\cos^3x}{\\cos^3x+\\sin^3x} is no more tractable alone than \\frac{\\sin^3x}{\\sin^3x+\\cos^3x} was). Why does ADDING the two expressions together unlock the problem when neither one alone does?",
      answer: "The two expressions are equally hard as STANDALONE integrals because they're structurally the same shape — swapping \\sin and \\cos doesn't make a cubic-in-trig quotient any easier to antidifferentiate on its own. But I is a single NUMBER, and King's rule says two different-looking integrand expressions both equal that same number — so I+I=2I can be computed either by literally doubling one hard integral, or, more usefully, by adding the two INTEGRANDS first and integrating the SUM. That sum has the same denominator on both terms, so it collapses algebraically (the numerator becomes \\sin^3x+\\cos^3x, identical to the denominator) — a cancellation that only exists once the two pieces are combined under one integral sign, before integrating either. Neither original expression contains that cancellation on its own; it only appears in their sum.",
    },
  },
  {
    id: "feynman",
    name: "Feynman's trick",
    tagline: "Turn a fixed integral into a family, and differentiate the family instead of integrating it.",
    prerequisites: ["Standard forms", "Partial derivatives, informally — differentiating with everything except one letter held fixed"],
    whenToUse:
      "The integral has a hidden parameter — an exponent, a coefficient, a scale factor — and no direct technique makes progress once you've tried the obvious substitutions. Introduce that parameter explicitly, name the result I(a), and differentiate I with respect to a rather than working in x at all.",
    intuition:
      "Some integrals have no x-based technique that makes progress at all — but many of them are secretly one specific value of a whole FAMILY of integrals I(a), and the family can be easier to differentiate (in a) than the single integral is to attack (in x). Differentiating under the integral sign — swapping \\int and \\frac d{da}, legitimate whenever nothing blows up as a varies — turns I'(a) into a brand-new integral in x that is usually far simpler than I(a) itself, because differentiating with respect to the PARAMETER often cancels the very feature (a \\ln x in a denominator, a troublesome \\frac1x) that made the original integral hard.",
    recipe: [
      "Rewrite the integral as I(a) for a parameter a chosen so the original problem is I at one specific value, and I is trivial (often 0) at another.",
      "Differentiate under the integral sign: I'(a) = \\int \\frac{\\partial}{\\partial a}(\\text{integrand})\\,dx. This is legal whenever the integrand and its a-derivative stay well-behaved as a varies — assume so unless the problem says otherwise.",
      "The a-derivative is almost always an easier integral in x than the original was.",
      "Integrate I'(a) back with respect to a to recover I(a) up to a constant, then pin the constant using the trivial value of I.",
      "Substitute the value of a that recovers the integral you actually wanted.",
    ],
    example: FEYNMAN_EXAMPLES[0],
    examples: FEYNMAN_EXAMPLES,
    pitfalls: [
      "Differentiating under the integral sign needs the integrand to stay well-behaved as a varies — this isn't the tool for an integrand with a singularity that moves with a.",
      "Pin the constant of integration using a value of a where the integral is obviously trivial, not by guessing.",
      "The parameter has to actually recover the original problem at some specific value — check that before differentiating anything.",
    ],
    checkYourself: {
      prompt: "\\frac{x-1}{\\ln x} \\text{ on } [0,1]",
      answer: "\\ln 2",
      hint: "Same family as the worked example: I(a)=\\int_0^1\\frac{x^a-1}{\\ln x}\\,dx. Which value of a matches this integrand?",
    },
    completions: [
      {
        setup: [
          "Generalize: let I(a)=\\int_0^\\infty\\frac{\\sin(ax)}xe^{-x}\\,dx, so the target is I(1).",
          "Differentiate under the integral sign: \\frac{\\partial}{\\partial a}\\sin(ax)=x\\cos(ax), and that x cancels the \\frac1x exactly, giving I'(a)=\\int_0^\\infty\\cos(ax)e^{-x}\\,dx.",
          "This is a standard Laplace-type integral: writing \\cos(ax)=\\operatorname{Re}(e^{iax}), I'(a)=\\operatorname{Re}\\int_0^\\infty e^{-(1-ia)x}\\,dx=\\operatorname{Re}\\frac1{1-ia}=\\operatorname{Re}\\frac{1+ia}{1+a^2}=\\frac1{1+a^2}.",
        ],
        blank: "Integrate I'(a) back in a, pin the constant, and evaluate at a=1.",
        answer: "I(a)=\\arctan a+C. At a=0 the integrand is identically 0 (\\sin0=0), so I(0)=0=\\arctan0+C, giving C=0. So I(a)=\\arctan a, and I(1)=\\arctan1=\\frac\\pi4.",
        integrandExpr: "sin(x)*exp(-x)/x",
        resultExpr: "pi/4",
        domain: [0, Infinity],
        kind: "definite",
      },
      {
        setup: [
          "Generalize: let I(a)=\\int_0^\\infty\\frac{e^{-x^2}-e^{-ax^2}}x\\,dx, so the target is I(4).",
          "Differentiate under the integral sign: the e^{-x^2} term is constant in a and vanishes, and \\frac{\\partial}{\\partial a}\\left(-e^{-ax^2}\\right)=x^2e^{-ax^2} — the awkward \\frac1x cancels exactly (one factor of x is left over, not zero), giving I'(a)=\\int_0^\\infty xe^{-ax^2}\\,dx.",
          "That's an easy substitution (u=ax^2): I'(a)=\\frac1{2a}.",
        ],
        blank: "Integrate back in a, then pin the constant — notice a=0 does NOT make this integral trivial here (e^{-0\\cdot x^2}=1, not 0), so find the value of a that DOES.",
        answer: "I(a)=\\tfrac12\\ln a+C. At a=1, the two exponentials in the original integrand are identical, so the numerator is 0 everywhere and I(1)=0 — giving \\tfrac12\\ln1+C=0, so C=0. Hence I(a)=\\tfrac12\\ln a, and I(4)=\\tfrac12\\ln4=\\ln2.",
        integrandExpr: "(exp(-x^2)-exp(-4*x^2))/x",
        resultExpr: "log(2)",
        domain: [0, Infinity],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "Differentiating under the integral sign swaps \\frac d{da} and \\int — two operations that don't obviously commute in general. What could actually go wrong if you did this carelessly, and what property of the two worked examples' integrands makes the swap safe?",
      answer: "\\frac d{da}\\int f(x,a)\\,dx and \\int\\frac{\\partial f}{\\partial a}\\,dx can differ when the integrand's behaviour changes too violently as a varies near the value you care about — e.g. if a singularity of f in x moves as a changes, or the integral's own convergence depends delicately on a (finite for one a but divergent for a nearby one is an instant warning sign). In both worked examples here, the integrand and its a-derivative stay bounded and well-behaved on an open interval of a around the value used — \\frac{e^{-x}-e^{-ax}}x has no singularity in x for any a near 2 (the apparent \\frac1x singularity at x=0 is removable, since the numerator also \\to0 there), and the same holds for \\frac{x^a-1}{\\ln x} near a=2. That good behaviour is what licenses swapping the two operations — a fact usually justified rigorously via the dominated convergence theorem, well beyond what's needed by name here — and the technique becomes unsafe exactly when a problem's own parameter range crosses a singularity or a boundary of convergence, which is precisely the first pitfall's warning.",
    },
  },
  {
    id: "t-sub",
    name: "The t-substitution",
    tagline: "Weierstrass's universal move: turn any rational function of sin and cos into a rational function of t.",
    prerequisites: ["Trig identities", "Partial fractions — the payoff is almost always a rational function of t"],
    whenToUse:
      "A rational function of \\sin x, \\cos x and \\tan x that no identity or standard substitution cracks — especially denominators like a + b\\cos x or a + b\\sin x. It always works, so treat it as the fallback once nothing faster presents itself, not the first move.",
    intuition:
      "Every point on the unit circle can be written using the half-angle: with t=\\tan\\frac x2, the double-angle formulas \\sin x=2\\sin\\frac x2\\cos\\frac x2 and \\cos x=\\cos^2\\frac x2-\\sin^2\\frac x2 can both be divided through by \\cos^2\\frac x2+\\sin^2\\frac x2=1 without changing anything, turning them into pure functions of t: \\sin x=\\frac{2\\tan(x/2)}{1+\\tan^2(x/2)}=\\frac{2t}{1+t^2}, and \\cos x=\\frac{1-\\tan^2(x/2)}{1+\\tan^2(x/2)}=\\frac{1-t^2}{1+t^2}. Differentiating t=\\tan\\frac x2 gives dt=\\frac12\\sec^2\\frac x2\\,dx=\\frac12(1+t^2)\\,dx, so dx=\\frac2{1+t^2}\\,dt — every trig function AND the differential itself become rational in t, which is why this one substitution handles literally any rational function of \\sin x and \\cos x.",
    recipe: [
      "Set t = \\tan\\frac{x}{2}.",
      "Substitute \\sin x = \\frac{2t}{1+t^2},\\ \\cos x = \\frac{1-t^2}{1+t^2},\\ dx = \\frac{2}{1+t^2}\\,dt.",
      "Every trig function cancels away, leaving a rational function of t — integrate that with standard forms or partial fractions.",
      "Back-substitute t = \\tan\\frac{x}{2} (or convert the bounds directly, for a definite integral).",
    ],
    example: T_SUB_EXAMPLES[0],
    examples: T_SUB_EXAMPLES,
    pitfalls: [
      "t = \\tan\\frac{x}{2} is undefined at x = \\pi — never substitute across that point in one piece; split the integral there if it's inside the domain.",
      "The universal method rarely gives the prettiest route. If a quicker identity or plain substitution is staring at you, use it instead — save this for when nothing else moves.",
      "Don't forget the \\frac{2}{1+t^2} from dx — it's easy to substitute \\sin x and \\cos x and lose the differential.",
    ],
    checkYourself: {
      prompt: "\\frac1{1+\\sin x+\\cos x}",
      answer: "\\ln\\left|1+\\tan\\frac x2\\right| + C",
      hint: "Same substitution — express \\sin x+\\cos x in t, and don't forget the \\frac2{1+t^2} from dx.",
    },
    completions: [
      {
        setup: [
          "\\int\\frac{dx}{5-3\\cos x} — substitute \\cos x=\\frac{1-t^2}{1+t^2}: 5-3\\cos x=\\frac{5(1+t^2)-3(1-t^2)}{1+t^2}=\\frac{2+8t^2}{1+t^2}=\\frac{2(1+4t^2)}{1+t^2}.",
          "So \\frac1{5-3\\cos x}=\\frac{1+t^2}{2(1+4t^2)}, and multiplying by dx=\\frac2{1+t^2}\\,dt cancels the (1+t^2) exactly, leaving \\frac1{1+4t^2}\\,dt.",
        ],
        blank: "Integrate (a standard arctan form, just with a coefficient inside) and back-substitute.",
        answer: "\\int\\frac{dt}{1+4t^2}=\\frac12\\arctan(2t)+C, so \\frac12\\arctan\\!\\left(2\\tan\\frac x2\\right)+C.",
        integrandExpr: "1/(5-3*cos(x))",
        resultExpr: "(1/2)*atan(2*tan(x/2))",
        domain: [-2, 2],
        kind: "indefinite",
      },
      {
        setup: [
          "\\int_0^{\\pi/2}\\frac{dx}{1+\\sin x} — with t=\\tan\\frac x2: 1+\\sin x=1+\\frac{2t}{1+t^2}=\\frac{(1+t)^2}{1+t^2}, so \\frac1{1+\\sin x}=\\frac{1+t^2}{(1+t)^2}.",
          "Multiplying by dx=\\frac2{1+t^2}\\,dt cancels the (1+t^2) completely: \\frac{1+t^2}{(1+t)^2}\\cdot\\frac2{1+t^2}=\\frac2{(1+t)^2} — the integrand becomes purely a power of (1+t).",
          "Convert the bounds instead of substituting back: x=0\\Rightarrow t=0, and x=\\tfrac\\pi2\\Rightarrow t=\\tan\\tfrac\\pi4=1.",
        ],
        blank: "Integrate \\frac2{(1+t)^2} and evaluate between the converted bounds.",
        answer: "\\int_0^1\\frac2{(1+t)^2}\\,dt=\\left[-\\frac2{1+t}\\right]_0^1=-1-(-2)=1.",
        integrandExpr: "1/(1+sin(x))",
        resultExpr: "1",
        domain: [0, Math.PI / 2],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "t=\\tan\\frac x2 can, in principle, turn ANY integral of \\sin x and \\cos x into a rational function of t — including something as simple as \\int\\sin^3x\\,dx, which Trig identities solves in two lines by peeling off one factor. Since t-sub always works, why is reaching for it on \\int\\sin^3x\\,dx a bad idea?",
      answer: "Always works is a statement about t-sub eventually landing on some rational function of t — not a promise that it's the easy route there. \\sin^3x under t-sub becomes \\left(\\frac{2t}{1+t^2}\\right)^3\\cdot\\frac2{1+t^2}\\,dt=\\frac{16t^3}{(1+t^2)^4}\\,dt, a genuinely messy rational function that needs real partial-fractions work to integrate, then back-substitution through t=\\tan\\frac x2 at the end. Trig identities reaches the same answer in two lines because \\sin^3x=(1-\\cos^2x)\\sin x already has an obvious du=-\\sin x\\,dx sitting in it — no universal machine is needed when a direct pattern is already visible. t-sub is the fallback for when no such pattern is visible (a genuinely stubborn denominator like a+b\\cos x), not the first thing to try on every trig integral.",
    },
  },
  {
    id: "recurrence",
    name: "Recurrence relations",
    tagline: "Relate a hard integral to an easier one indexed one step down, then unwind.",
    prerequisites: ["Integration by parts"],
    whenToUse:
      "The integral is naturally indexed by an integer n — a power like \\sin^n x, or a family like \\frac{x^n}{1+x} — and integration by parts, or a small algebraic trick, relates I_n to I_{n-1} or I_{n-2}. Reach for this whenever a problem hands you a family rather than a single integral.",
    intuition:
      "A family I_n indexed by an integer n often has no antiderivative pattern that works for every n at once — but relating I_n to I_{n-1} turns ONE hard problem into infinitely many EASY ones, plus a base case you compute directly. That's the same logic as proof by induction, just run forwards as a calculation instead of backwards as a proof: pin down the relationship once, compute the base case once, and every I_n for every n follows just by unwinding. The relationship doesn't have to come from integration by parts, either — for \\frac{x^n}{1+x}, adding I_n and I_{n-1} directly produces something that collapses on its own: x^n+x^{n-1}=x^{n-1}(x+1), and that (x+1) cancels the (1+x) sitting in the denominator exactly, leaving a plain power of x to integrate.",
    recipe: [
      "Name the family I_n. Try peeling one factor off with integration by parts, or adding/subtracting a related power algebraically, to relate I_n to a lower index.",
      "Solve the recurrence down to a base case you can compute directly — usually I_0 or I_1.",
      "Unwind the recurrence for the specific n you actually need.",
      "Watch the parity: many recurrences behave differently for even and odd n, so pin down which branch you're on before unwinding.",
    ],
    example: RECURRENCE_EXAMPLES[0],
    examples: RECURRENCE_EXAMPLES,
    pitfalls: [
      "Unwinding by hand for a large n is exactly as much work as the original problem — look for whether the recurrence collapses into a product or telescopes before grinding through every step.",
      "A recurrence relating I_n to I_{n-2} needs BOTH I_0 and I_1 as base cases, one for each parity.",
      "Getting the algebra sign wrong in I_n + I_{n-1} = \\dots vs I_n - I_{n-1} = \\dots silently flips every answer downstream — verify the very first step against a value you can compute directly (n=1 or n=2) before trusting the pattern.",
    ],
    checkYourself: {
      prompt: "\\frac{x^3}{1+x} \\text{ on } [0,1]",
      answer: "\\frac56-\\ln2",
      hint: "Same family as the first worked example: I_3=\\frac13-I_2. You already have I_2=\\ln2-\\frac12 from the lesson.",
    },
    completions: [
      {
        setup: [
          "\\int_0^1x^3e^x\\,dx — continue the lesson's own by-parts family one step further: I_n=\\int_0^1x^ne^x\\,dx satisfies I_n=e-nI_{n-1} (same boundary-term argument as before: e at x=1, 0 at x=0). The lesson already found I_0=e-1 and I_2=e-2 — the target is I_3.",
          "I_3=e-3I_2, and I_2=e-2 is already known from the lesson's own worked example.",
        ],
        blank: "Substitute and simplify.",
        answer: "I_3=e-3(e-2)=e-3e+6=6-2e.",
        integrandExpr: "x^3*exp(x)",
        resultExpr: "6-2*e",
        domain: [0, 1],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^{\\pi/4}\\tan^2x\\,dx — name the family I_n=\\int_0^{\\pi/4}\\tan^nx\\,dx. Relate I_n to I_{n-2} algebraically this time, not by parts: I_n+I_{n-2}=\\int_0^{\\pi/4}\\tan^{n-2}x\\big(\\tan^2x+1\\big)\\,dx=\\int_0^{\\pi/4}\\tan^{n-2}x\\sec^2x\\,dx, which is a plain u=\\tan x substitution: =\\left[\\frac{\\tan^{n-1}x}{n-1}\\right]_0^{\\pi/4}=\\frac1{n-1}.",
          "So I_n=\\frac1{n-1}-I_{n-2}. Base case for even n: I_0=\\int_0^{\\pi/4}1\\,dx=\\frac\\pi4.",
        ],
        blank: "Apply the recurrence with n=2 to find I_2.",
        answer: "I_2=\\frac1{2-1}-I_0=1-\\frac\\pi4.",
        integrandExpr: "tan(x)^2",
        resultExpr: "1 - pi/4",
        domain: [0, Math.PI / 4],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "The pitfalls note that a recurrence relating I_n to I_{n-2} needs BOTH I_0 and I_1 as base cases. Why can't knowing only I_0 ever let you unwind such a recurrence down to a number for an ODD n — walk through what actually happens if you try?",
      answer: "Unwinding I_n=f(I_{n-2}) repeatedly subtracts 2 from the index each step: n\\to n-2\\to n-4\\to\\cdots. Starting from an ODD n, every index in that chain stays odd (odd minus an even number is always odd), so the chain can only ever reach 1,\\,3,\\,5,\\ldots — it will never land on 0, however many steps you take. I_0 sits on the EVEN chain entirely, unreachable from an odd starting index no matter how far you unwind; the two chains never touch. So an odd-indexed recurrence genuinely needs its own, separately-computed base case, I_1 — I_0 answers a different, disjoint question.",
    },
  },
  {
    id: "inverse-integral",
    name: "Integral of an inverse function",
    tagline: "Swap a hard integral for the easy area of its inverse, using the rectangle they share.",
    prerequisites: ["Integration by parts", "Substitution"],
    whenToUse:
      "You need \\int f(x)\\,dx for an f whose own antiderivative is annoying (\\arcsin, \\arctan, \\ln), but whose INVERSE — \\sin, \\tan, e^x — is trivial to integrate. The picture is a rectangle split by the curve y=f(x): the area under f and the area under f^{-1} (read off the y-axis) fill it between them.",
    intuition:
      "This isn't a separate trick — it's integration by parts and a substitution, bundled into one formula so you never redo either by hand. Let F(x)=x\\,f(x); the product rule gives F'(x)=f(x)+x\\,f'(x). Integrate both sides from a to b: F(b)-F(a)=\\int_a^bf(x)\\,dx+\\int_a^bx\\,f'(x)\\,dx, so \\int_a^bf(x)\\,dx=\\big[b\\,f(b)-a\\,f(a)\\big]-\\int_a^bx\\,f'(x)\\,dx. Now substitute y=f(x) in that last piece: x=f^{-1}(y) and dy=f'(x)\\,dx, so x\\,f'(x)\\,dx becomes f^{-1}(y)\\,dy, with the bounds turning into f(a) and f(b) — giving \\int_{f(a)}^{f(b)}f^{-1}(y)\\,dy. Rearranging lands exactly on the identity below.",
    recipe: [
      "Identify f and confirm it's injective (monotonic) on the interval — that's what gives it an inverse at all.",
      "Use \\int_a^b f(x)\\,dx + \\int_{f(a)}^{f(b)} f^{-1}(x)\\,dx = b\\,f(b) - a\\,f(a).",
      "Pick whichever of the two integrals is the easy one — usually the inverse function, since it's the one you actually know how to integrate — and compute it directly.",
      "Solve for the integral you actually wanted.",
    ],
    example: INVERSE_INTEGRAL_EXAMPLES[0],
    examples: INVERSE_INTEGRAL_EXAMPLES,
    pitfalls: [
      "The identity needs f INJECTIVE on the interval you're using — check that before reaching for it, or the 'inverse' isn't well defined.",
      "Matching the bounds is the whole trick: b must satisfy f(b) equal to the upper limit you actually want on the inverse integral, not just some convenient value.",
      "This is a shortcut around integration by parts, not a different answer — if you're unsure the identity applies, by parts on \\arcsin/\\arctan/\\ln always works too and is worth checking against.",
    ],
    checkYourself: {
      prompt: "\\ln x \\text{ on } [1,e]",
      answer: "1",
      hint: "f(x)=e^x is the easy direction here. Match bounds: f(a)=1\\Rightarrow a=0, and f(b)=e\\Rightarrow b=1.",
    },
  },
  {
    id: "floor-function",
    name: "Floor function integrals",
    tagline: "The floor has no antiderivative — split the domain at every integer, where it's constant, instead.",
    prerequisites: ["Standard forms"],
    whenToUse:
      "\\lfloor x\\rfloor, or the fractional part x - \\lfloor x\\rfloor, sits inside the integrand and the bounds span more than one integer. There is no calculus move that touches \\lfloor x\\rfloor directly — the only route in is chopping the interval into pieces where it's constant.",
    intuition:
      "There's no calculus trick that fixes this — \\lfloor x\\rfloor is discontinuous at every integer, so it has no derivative to reverse, and no substitution smooths it out. But a DEFINITE integral doesn't actually need an antiderivative; it's just signed area, and \\lfloor x\\rfloor is piecewise CONSTANT, which is the one shape whose area needs no calculus at all — a constant c held over a piece of width w contributes exactly c\\times w, by the plain definition of a rectangle's area. So the whole technique really is: find where the pieces are (the integers), read off the constant value on each one, and add up rectangles. Everything else in the recipe below is just bookkeeping around that one idea.",
    recipe: [
      "List every integer strictly inside the interval of integration — those are exactly where \\lfloor x\\rfloor jumps.",
      "Split \\int_a^b into a sum of integrals over [k,k+1] (with partial pieces at the two ends), replacing \\lfloor x\\rfloor by the fixed integer k on each piece.",
      "Integrate each ordinary piece — \\lfloor x\\rfloor is now just a constant — and sum the results.",
      "Look for the sum to collapse: it's often a short arithmetic series, or telescopes outright.",
    ],
    example: FLOOR_EXAMPLES[0],
    examples: FLOOR_EXAMPLES,
    pitfalls: [
      "The split points are the INTEGERS inside the interval, not the endpoints — double-check you haven't miscounted by one at either end.",
      "For x - \\lfloor x\\rfloor (the sawtooth), each piece [k,k+1) is just \\int_0^1 u\\,du = \\frac{1}{2} after shifting — every full unit interval contributes exactly \\frac{1}{2}, which is worth recognising on sight.",
      "\\lfloor x\\rfloor is discontinuous at every integer, so don't try to differentiate through one — this technique is fundamentally about summing, not about finding an antiderivative.",
      "\\lfloor x\\rfloor rounds DOWN even for negative x, so \\lfloor -0.5\\rfloor=-1, not 0 — a domain that dips below zero needs exactly the same integer-by-integer care as one that doesn't.",
    ],
    checkYourself: {
      prompt: "x-\\lfloor x\\rfloor \\text{ on } [0, 2.5]",
      answer: "\\frac98",
      hint: "Two full unit intervals, each worth \\frac12 by the pitfall above, plus a partial piece [2,2.5) where x-\\lfloor x\\rfloor=x-2 ranges from 0 to 0.5.",
    },
  },
  {
    id: "beta-integrals",
    name: "Beta function integrals",
    tagline: "\\int_0^1 x^m(1-x)^n\\,dx is always a clean rational number — recognise the shape and skip the algebra.",
    prerequisites: ["Integration by parts", "Standard forms"],
    whenToUse:
      "The integrand is a power of x times a power of (1-x) (or of u and a-u, after rescaling to [0,1]). Expanding (1-x)^n by hand and integrating term by term always works, but for anything beyond n=2 it's slower than just knowing the closed form.",
    intuition:
      "\\int_0^1x^m(1-x)^n\\,dx has no shortcut as written, but integration by parts with u=(1-x)^n,\\ dv=x^m\\,dx peels off one power of (1-x) at the cost of raising the power of x by one: du=-n(1-x)^{n-1}\\,dx,\\ v=\\frac{x^{m+1}}{m+1}, and the boundary term x^{m+1}(1-x)^n vanishes at both ends — x^{m+1}=0 at x=0, and (1-x)^n=0 at x=1. What's left is B(m,n)=\\frac n{m+1}B(m+1,n-1): the SAME shape of integral, just one step lower in n. Unrolling that all the way down to n=0, where B(m+n,0)=\\int_0^1x^{m+n}\\,dx=\\frac1{m+n+1} is a plain power rule, multiplies n! into the numerator against (m+1)(m+2)\\cdots(m+n) in the denominator — exactly the m! worth of factors an ordinary (m+n)! is missing — which is why B(m,n)=\\frac{m!\\,n!}{(m+n+1)!} drops out in one pass, without ever expanding a genuine product by hand.",
    recipe: [
      "Get the integral into the form \\int_0^1 x^m(1-x)^n\\,dx. An interval [a,b] rescales to [0,1] with u=\\frac{x-a}{b-a}.",
      "Use \\int_0^1 x^m(1-x)^n\\,dx = \\frac{m!\\,n!}{(m+n+1)!} — provable by repeated integration by parts, peeling one factor of (1-x) off at a time.",
      "Use the symmetry \\int_0^1 x^m(1-x)^n\\,dx = \\int_0^1 x^n(1-x)^m\\,dx (swap via u=1-x) as a free sanity check on the formula.",
      "For non-integer exponents the same pattern holds with factorials replaced by the Gamma function — the integer case is the one this bank drills.",
      "A stray \\ln x (or \\ln(1-x)) alongside the powers is a sign to differentiate the Beta identity itself: \\int_0^1 x^{m+\\varepsilon}(1-x)^n\\,dx = \\frac{\\Gamma(m+1+\\varepsilon)n!}{\\Gamma(m+n+2+\\varepsilon)}, and differentiating both sides with respect to \\varepsilon at \\varepsilon=0 brings down exactly one factor of \\ln x. The digamma values that appear are differences of digammas at (half-)integers, which are always elementary — the \\gamma constant that digamma normally carries cancels between the two terms.",
    ],
    example: BETA_EXAMPLES[0],
    examples: BETA_EXAMPLES,
    pitfalls: [
      "The formula needs the interval to be [0,1] with the two factors exactly x and 1-x — rescale first if it isn't, don't try to patch the formula.",
      "m and n must be nonnegative integers for the factorial form; a fractional power needs the Gamma function instead.",
      "Don't forget the +1 in the denominator's (m+n+1)! — it's the single most common slip with this identity.",
      "The digamma trick only stays elementary when the un-differentiated exponent is an integer or a half-integer (so \\Gamma of it is elementary too) — differentiating at a genuinely fractional exponent leaves the Euler-Mascheroni constant \\gamma sitting in the answer instead of cancelling.",
    ],
    checkYourself: {
      prompt: "x^4(1-x) \\text{ on } [0,1]",
      answer: "\\frac1{30}",
      hint: "m=4,\\ n=1 in \\frac{m!\\,n!}{(m+n+1)!}.",
    },
    completions: [
      {
        setup: [
          "\\int_1^3(x-1)^3(3-x)^2\\,dx — not on [0,1] yet: rescale with u=\\frac{x-1}{3-1}=\\frac{x-1}2, so x=1+2u,\\ dx=2\\,du, and the bounds x=1,3 become u=0,1.",
          "Then x-1=2u and 3-x=3-(1+2u)=2-2u=2(1-u), so the integrand becomes (2u)^3\\big(2(1-u)\\big)^2\\cdot2\\,du=8\\cdot4\\cdot2\\,u^3(1-u)^2\\,du=64\\,u^3(1-u)^2\\,du.",
        ],
        blank: "The rescaled integral is a plain Beta shape with m=3,\\ n=2 — apply the formula and multiply back by the constant the rescaling produced.",
        answer: "\\int_0^1u^3(1-u)^2\\,du=\\frac{3!\\,2!}{6!}=\\frac{12}{720}=\\frac1{60}. Multiplying back: 64\\cdot\\frac1{60}=\\frac{64}{60}=\\frac{16}{15}.",
        integrandExpr: "(x-1)^3*(3-x)^2",
        resultExpr: "16/15",
        domain: [1, 3],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^1x^2(1-x)^3\\ln x\\,dx — introduce \\varepsilon on the ln x factor's exponent: I(\\varepsilon)=\\int_0^1x^{2+\\varepsilon}(1-x)^3\\,dx=\\frac{\\Gamma(3+\\varepsilon)\\cdot3!}{\\Gamma(7+\\varepsilon)} (the recipe's digamma-trick formula with m=2,\\ n=3), so the target is I'(0).",
          "Differentiate: I'(\\varepsilon)=I(\\varepsilon)\\big[\\psi(3+\\varepsilon)-\\psi(7+\\varepsilon)\\big], where \\psi is the digamma function (the log-derivative of \\Gamma). At \\varepsilon=0, I(0)=\\frac{2!\\,3!}{6!}=\\frac1{60} — the ordinary Beta value.",
          "For a positive integer n, \\psi(n)=-\\gamma+H_{n-1} where H_k=1+\\frac12+\\cdots+\\frac1k, so \\psi(3)-\\psi(7)=H_2-H_6 — the \\gamma cancels exactly, as the pitfall promises.",
        ],
        blank: "Compute H_2-H_6 and combine with I(0) to get the answer.",
        answer: "H_2=\\frac32,\\quad H_6=\\frac{49}{20}, so \\psi(3)-\\psi(7)=\\frac32-\\frac{49}{20}=-\\frac{19}{20}. Then I'(0)=\\frac1{60}\\cdot\\left(-\\frac{19}{20}\\right)=-\\frac{19}{1200}.",
        integrandExpr: "x^2*(1-x)^3*log(x)",
        resultExpr: "-19/1200",
        domain: [0, 1],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "The pitfalls note that m and n must be nonnegative INTEGERS for \\frac{m!\\,n!}{(m+n+1)!} to make sense as written, with a fractional power needing \\Gamma instead. But \\Gamma(k+1)=k! for every nonnegative integer k — so why can't you just always write \\frac{\\Gamma(m+1)\\Gamma(n+1)}{\\Gamma(m+n+2)} and forget the distinction entirely, even when m,n happen to be integers?",
      answer: "You CAN — \\frac{\\Gamma(m+1)\\Gamma(n+1)}{\\Gamma(m+n+2)} and \\frac{m!\\,n!}{(m+n+1)!} are the exact same number whenever m,n are nonnegative integers, since \\Gamma agrees with factorial there by definition. The distinction in the pitfall isn't about correctness, it's about what's easy to compute BY HAND: m! for an integer is arithmetic anyone can do in their head (3!=6), while \\Gamma\\!\\left(\\tfrac72\\right) needs the recursive identity \\Gamma(z+1)=z\\Gamma(z) unwound several times down to \\Gamma\\!\\left(\\tfrac12\\right)=\\sqrt\\pi — genuinely more work, and a place a competitor under time pressure is likelier to slip. The formula is universal; the advice to use the factorial form for integers is purely about which route to the same number is faster on paper.",
    },
  },
  {
    id: "introducing-constants",
    name: "Introducing constants",
    tagline: "Split the numerator by adding and subtracting a constant, so one half is trivial and the other is a form you already know.",
    prerequisites: ["Partial fractions", "Completing the square"],
    whenToUse:
      "A rational (or rational-in-trig) integrand whose numerator is 'almost' a multiple of the denominator, or almost the denominator's derivative, plus some leftover constant. Especially useful for isolating a piece you've already solved elsewhere — this is a great second pass once a first technique gets you most of the way.",
    intuition:
      "Writing N=\\lambda D+\\mu isn't a trick that changes the integral at all — it's just the identity N=\\lambda D+(N-\\lambda D), true for ANY \\lambda whatsoever, since the two \\lambda D terms cancel on the right. What makes one choice of \\lambda good is that it makes the LEFTOVER piece, N-\\lambda D, collapse to something trivial: a bare constant (matching \\lambda to N and D's leading behaviour), or a multiple of D' (choosing \\lambda so N's x-dependent part matches D''s exactly). Either way, one of the two resulting integrals — \\int1\\,dx or \\int\\frac{D'}D\\,dx — is immediate, and the other is exactly the SAME \\int\\frac{dx}{D(x)} you'd have needed to solve anyway, now isolated instead of tangled up in a numerator that obscured it. Finding \\lambda and \\mu is ordinary coefficient matching, no different from clearing denominators in Partial fractions.",
    recipe: [
      "Write the numerator as \\lambda\\cdot(\\text{denominator, or its derivative}) + \\mu, solving for \\lambda and \\mu by matching coefficients.",
      "Split into \\lambda\\int 1\\,dx (or \\lambda\\int\\frac{D'}{D}\\,dx) plus \\mu\\int\\frac{dx}{D(x)}.",
      "The first piece is now trivial. For the second, reuse whatever standard form or previously-solved result applies to D(x) — don't re-derive it from scratch.",
      "The multiplicative version of the same idea — multiply and divide by a well-chosen constant — can reveal a hidden derivative; it's rarer, but worth trying when nothing else moves.",
    ],
    example: INTRODUCING_CONSTANTS_EXAMPLES[0],
    examples: INTRODUCING_CONSTANTS_EXAMPLES,
    pitfalls: [
      "Match coefficients carefully — get \\lambda or \\mu wrong and every downstream integral is off by a constant that's easy to miss.",
      "The 'remainder' after subtracting off \\lambda\\cdot D(x) must genuinely be a constant, or (for the derivative version) the rest must genuinely be D'(x); if it isn't, the split hasn't actually simplified anything.",
      "This is a setup move, not a finishing one — you still have to know how to integrate \\frac{1}{D(x)} once you've isolated it.",
    ],
    checkYourself: {
      prompt: "\\frac{5x-3}{x^2+4}",
      answer: "\\frac52\\ln(x^2+4)-\\frac32\\arctan\\!\\left(\\frac x2\\right)+C",
      hint: "D'(x)=2x here, with no constant term to match — split 5x-3=\\frac52(2x)+(-3), then integrate each piece separately (a log and a scaled arctan).",
    },
  },
  {
    id: "log-power-integrals",
    name: "Log-power integrals",
    tagline: "\\int_0^1 x^n\\ln^k x\\,dx is a closed-form rational number for every n,k \\geq 0 — a generating-function trick reads it off in one line.",
    prerequisites: ["Feynman's trick", "Standard forms"],
    whenToUse:
      "The integrand is x to a nonnegative integer power times a nonnegative integer power of \\ln x, over [0,1]. Repeated integration by parts always works, peeling one power of \\ln x off each time, but for k \\geq 2 it's a lot of bookkeeping for something with a one-line closed form.",
    intuition:
      "Differentiating x^a with respect to a — not x — is the whole trick, and it's legal because x^a is secretly x^a=e^{a\\ln x}: differentiating that with respect to a (chain rule on the exponent) gives \\ln x\\cdot e^{a\\ln x}=x^a\\ln x, so EVERY derivative in a brings down exactly one more factor of \\ln x, by the same chain rule each time. That turns the trivial integral J(a)=\\int_0^1x^a\\,dx=\\frac1{a+1} into a whole ladder of integrals for free: J'(a) has one \\ln x inside, J''(a) has two, and so on. The right-hand side climbs the same ladder by ordinary differentiation: \\frac{d}{da}(a+1)^{-1}=-(a+1)^{-2}, and differentiating AGAIN gives 2(a+1)^{-3} — each step multiplies in one more factor and knocks the exponent down by one, exactly the pattern (-1)^kk!(a+1)^{-(k+1)} continues by induction. This is Feynman's trick's own differentiate-under-the-integral-sign move, just aimed at the SAME trivial integral J(a) over and over instead of introducing a fresh parameter each time.",
    recipe: [
      "Introduce a parameter: J(a) = \\int_0^1 x^a\\,dx = \\frac{1}{a+1}, valid for any a > -1 — this is the trivial integral hiding underneath.",
      "Differentiate J with respect to a. Since \\frac{\\partial}{\\partial a}x^a = x^a\\ln x, each derivative brings down one more factor of \\ln x inside the integral: J^{(k)}(a) = \\int_0^1 x^a\\ln^k x\\,dx.",
      "Differentiate the closed form the same number of times: \\frac{d^k}{da^k}\\frac{1}{a+1} = \\frac{(-1)^k k!}{(a+1)^{k+1}}.",
      "Set a = n (the integer power actually in the problem): \\int_0^1 x^n\\ln^k x\\,dx = \\frac{(-1)^k k!}{(n+1)^{k+1}}.",
    ],
    example: LOG_POWER_EXAMPLES[0],
    examples: LOG_POWER_EXAMPLES,
    pitfalls: [
      "The sign alternates with k — \\ln x is negative on (0,1), so odd k gives a negative answer and even k gives a positive one. Sanity-check the sign before trusting the arithmetic.",
      "The exponent on the denominator is k+1, not k — it's easy to drop the extra +1 that comes from differentiating \\frac{1}{a+1} itself once more than you differentiated a^{\\text{power}}.",
      "This is the same differentiate-under-the-integral-sign move as the Feynman technique, just packaged as a formula worth recognising on sight instead of re-deriving from scratch every time.",
    ],
    checkYourself: {
      prompt: "\\ln^3x \\text{ on } [0,1]",
      answer: "-6",
      hint: "This is n=0,\\ k=3 — x^0=1 is still a valid power. Differentiate J(a)=\\frac1{a+1} three times and set a=0.",
    },
  },
  {
    id: "reciprocal-substitution",
    name: "Reciprocal substitution",
    tagline: "u=\\frac{1}{x} pairs an integral over (0,\\infty) with a twin of itself — average the two and the hard part cancels.",
    prerequisites: ["Substitution", "Symmetry and definite tricks"],
    whenToUse:
      "The integral runs over (0,\\infty), and the integrand involves \\ln x or an odd power of x in a way that looks antisymmetric under x \\to \\frac{1}{x}. If substituting u=\\frac{1}{x} turns the integral into something you can add to (or subtract from) the original to kill the ugly part, this is the move.",
    intuition:
      "If I=\\int_0^\\infty f(x)\\,dx, substituting x=\\frac1u (so dx=-\\frac{du}{u^2}) doesn't change the VALUE of I — it just gives a SECOND formula for the same number, I=\\int_0^\\infty f\\!\\left(\\frac1u\\right)\\frac{du}{u^2} (the (0,\\infty)\\to(\\infty,0) bound-flip is exactly what cancels that minus sign). Usually f\\!\\left(\\frac1u\\right)/u^2 looks nothing like f(u) — but for the right integrands (built from \\ln x, or a ratio symmetric under x\\to\\frac1x up to a known factor) the two expressions are related closely enough that adding or subtracting them cancels the hard part entirely. That's the exact same move as King's rule in Symmetry and definite tricks, just reflecting through x\\to\\frac1x instead of x\\to a-x: relabel the same area two different ways, then combine the two expressions to make something intractable collapse.",
    recipe: [
      "Substitute u = \\frac{1}{x}, so x = \\frac{1}{u} and dx = -\\frac{du}{u^2}. The bounds (0,\\infty) map to (\\infty,0), and flipping them back cancels the minus sign.",
      "Rewrite every x in the integrand in terms of u, including \\ln x = -\\ln u if a logarithm is present.",
      "Compare the transformed integral to the original. If it's the negative of the original, the integral is 0 outright. If it's a different but related integral, add the two expressions together — the awkward piece is often designed to cancel or double.",
      "Solve the resulting (usually much simpler) equation for the original integral I.",
    ],
    example: RECIPROCAL_SUB_EXAMPLES[0],
    examples: RECIPROCAL_SUB_EXAMPLES,
    pitfalls: [
      "Get the bounds and the sign right: (0,\\infty)\\to(\\infty,0) under x=\\frac{1}{t}, and flipping the limits back is exactly what cancels the minus sign in dx=-\\frac{dt}{t^2} — track this once, carefully, rather than by feel.",
      "\\ln\\frac{1}{t}=-\\ln t, so an even power of \\ln x survives the substitution unchanged while an odd power flips sign — that's usually the whole point of trying this move.",
      "The technique only pays off when the twin integral is genuinely related to the original (equal, opposite, or a known simpler one). If substituting just produces an unrelated mess, this isn't the right tool.",
      "The twin doesn't have to equal \\pm I outright to be useful — Example 3's twin equals \\frac\\pi2J-I for a DIFFERENT, simpler integral J, and solving that equation for I is still exactly this technique at work.",
    ],
    checkYourself: {
      prompt: "\\frac1{(1+x^2)(1+x)} \\text{ on } [0,\\infty)",
      answer: "\\frac\\pi4",
      hint: "Same pairing as the second worked example, with a=1: substitute x=\\frac1t, add the twin to the original, and the (1+x^a) factors cancel, leaving a plain arctan.",
    },
    completions: [
      {
        setup: [
          "\\int_0^\\infty\\frac{\\ln^3x}{1+x^2}\\,dx — let I be the integral. Substitute x=\\frac1t exactly as in the lesson's first example: \\frac{dx}{1+x^2} becomes \\frac{dt}{1+t^2} (the SAME measure, unchanged — this piece never depends on what sits in the numerator).",
          "Only the numerator changes, and this time it's a CUBE: \\ln^3x=\\ln^3\\frac1t=(-\\ln t)^3=-\\ln^3t.",
        ],
        blank: "Write the transformed integral in terms of I and solve — does an odd power of \\ln x behave the same way the first power did in the lesson's own example?",
        answer: "I=\\int_0^\\infty\\frac{-\\ln^3t}{1+t^2}\\,dt=-I (relabelling t as x), so 2I=0 and I=0 — any ODD power of \\ln x flips sign under x\\to\\frac1x the same way the first power did, so the same cancellation argument applies unchanged.",
        integrandExpr: "log(x)^3/(1+x^2)",
        resultExpr: "0",
        domain: [0, Infinity],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^\\infty\\frac{dx}{(1+x^2)(1+x^5)} — same pairing as the lesson's own second example, with a=5 instead of a=3. Let I be the integral. Substitute x=\\frac1t: (1+x^2)\\to\\frac{t^2+1}{t^2},\\ (1+x^5)\\to\\frac{t^5+1}{t^5}, and dx\\to-\\frac{dt}{t^2} (the bound-flip cancels the sign), so \\frac{dx}{(1+x^2)(1+x^5)} becomes \\frac{t^5\\,dt}{(1+t^2)(1+t^5)}.",
          "Relabelling t as x: I=\\int_0^\\infty\\frac{x^5\\,dx}{(1+x^2)(1+x^5)} — the SAME denominator as the original, just an extra x^5 upstairs.",
        ],
        blank: "Add this to the original expression for I, and simplify — the (1+x^5) should cancel exactly.",
        answer: "2I=\\int_0^\\infty\\frac{1+x^5}{(1+x^2)(1+x^5)}\\,dx=\\int_0^\\infty\\frac{dx}{1+x^2}=\\Big[\\arctan x\\Big]_0^\\infty=\\frac\\pi2, so I=\\frac\\pi4 — confirming the lesson's own note that the value doesn't depend on the specific power, here with a=5 instead of a=3.",
        integrandExpr: "1/((1+x^2)*(1+x^5))",
        resultExpr: "pi/4",
        domain: [0, Infinity],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "The pitfalls note that this technique only pays off when the twin integral is genuinely related to the original — but Example 3 in the lesson raises I=\\int_0^\\infty\\frac{\\arctan x}{x(1+\\ln^2x)}\\,dx, whose twin turns out to be \\frac\\pi2J-I for a DIFFERENT integral J, not \\pm I. Why does the technique still count as \\text{'this move'} rather than a different trick entirely, when the twin isn't simply a multiple of I?",
      answer: "The defining move isn't \\text{'the twin equals} \\pm I\\text{'} specifically — it's substituting x=\\frac1t to get a SECOND, equally valid expression for the same number I, then combining the two expressions to make something intractable collapse. When the twin literally IS \\pm I (as in the lesson's first two examples), combining means solving a one-line equation in I alone. When the twin instead involves a genuinely different quantity (J, in Example 3), combining still works the same way — you get one equation relating I and J, and if J happens to be independently computable (here, by a further substitution w=\\ln t), you can still solve for I. The substitution and the combining step are identical in both cases; only how much extra work is needed after combining differs. That's exactly why the pitfall frames it as \\text{'genuinely related to the original'} rather than \\text{'equal to} \\pm I\\text{'} — related is the real requirement, equal is just the easiest special case of it.",
    },
  },
  {
    id: "gamma-function",
    name: "The Gamma function",
    tagline: "\\int_0^\\infty x^n e^{-x}\\,dx = n! — a reduction formula in disguise, over an infinite domain.",
    prerequisites: ["Beta function integrals", "Integration by parts"],
    whenToUse:
      "A polynomial (or a single power of x) times a decaying exponential, integrated over (0,\\infty). If you see x^n e^{-x} — or e^{-ax}, or a^{-x} for some other base — recognise it as an instance of this family rather than reaching for integration by parts from scratch.",
    intuition:
      "\\int_0^\\infty x^ne^{-x}\\,dx has exactly the same peel-one-factor-off structure as the Beta integral — just run against a decaying exponential on (0,\\infty) instead of against (1-x) on [0,1]. Integrating by parts with u=x^n,\\ dv=e^{-x}\\,dx gives du=nx^{n-1}\\,dx,\\ v=-e^{-x}, and the boundary term -x^ne^{-x} vanishes at both ends — 0 outright at x=0 (for n\\ge1), and 0 in the limit because e^{-x} beats any polynomial as x\\to\\infty. What survives is I_n=nI_{n-1}, and unrolling that down to the base case I_0=\\int_0^\\infty e^{-x}\\,dx=1 gives I_n=n! in one pass — the SAME induction Beta integrals use, just indexed by one variable instead of two.",
    recipe: [
      "The base case: \\int_0^\\infty e^{-x}\\,dx = 1.",
      "Integration by parts (u=x^n,\\ dv=e^{-x}dx) gives the reduction \\int_0^\\infty x^n e^{-x}\\,dx = n\\int_0^\\infty x^{n-1}e^{-x}\\,dx — the boundary term vanishes at both ends since x^n e^{-x}\\to 0 as x\\to\\infty and equals 0 at x=0. Unrolling it gives \\int_0^\\infty x^n e^{-x}\\,dx = n!.",
      "For a decay rate other than 1, substitute u=ax first: \\int_0^\\infty x^n e^{-ax}\\,dx = \\frac{n!}{a^{n+1}}.",
      "For a base other than e, rewrite it: b^{-x} = e^{-x\\ln b}, then apply the same formula with a=\\ln b.",
      "A trailing \\cos x or \\sin x alongside the exponential is the formula in disguise with a complex a: since \\cos x=\\mathrm{Re}(e^{ix}), \\int_0^\\infty x^ne^{-x}\\cos x\\,dx=\\mathrm{Re}\\int_0^\\infty x^ne^{-(1-i)x}\\,dx=\\mathrm{Re}\\frac{n!}{(1-i)^{n+1}} — the same \\frac{n!}{a^{n+1}} formula, with a=1-i.",
    ],
    example: GAMMA_EXAMPLES[0],
    examples: GAMMA_EXAMPLES,
    pitfalls: [
      "n! here means the ordinary integer factorial (0!=1, and it grows fast) — don't confuse it with the Gamma function's shift, \\Gamma(n+1)=n!, unless a problem genuinely has a non-integer exponent.",
      "The boundary term in the by-parts reduction only vanishes because e^{-x} beats any polynomial as x\\to\\infty — this whole family depends on genuinely exponential (or faster) decay, not merely \\to 0.",
      "A Gaussian integrand (e^{-x^2}, not e^{-x}) is a different animal — it doesn't reduce to a factorial by integration by parts the same way; it needs the dedicated Gaussian/hypersphere approach instead.",
      "The complex-a trick only lands on an elementary real answer when \\mathrm{Re}\\frac{n!}{a^{n+1}} actually simplifies to a real number by hand (as it does for a=1-i, since (1-i)^{n+1} works out to a real or purely imaginary Gaussian integer for every n) — for a generic complex a you'd need the modulus-argument form of a^{n+1}, which is beyond a 'type the number' answer.",
    ],
    checkYourself: {
      prompt: "x^4e^{-2x} \\text{ on } [0,\\infty)",
      answer: "\\frac34",
      hint: "Either substitute u=2x to land on the base case, or apply \\frac{n!}{a^{n+1}} directly with n=4,\\ a=2.",
    },
    completions: [
      {
        setup: [
          "\\int_0^\\infty xe^{-x}\\sin x\\,dx — a trailing \\sin x is the formula in disguise: \\sin x=\\operatorname{Im}(e^{ix}), so this is \\operatorname{Im}\\int_0^\\infty xe^{-(1-i)x}\\,dx — the a=1-i case of \\int_0^\\infty xe^{-ax}\\,dx=\\frac{1!}{a^2}.",
          "So the integral is \\operatorname{Im}\\frac1{(1-i)^2}. Compute the denominator first: (1-i)^2=1-2i+i^2=1-2i-1=-2i.",
        ],
        blank: "Finish simplifying \\frac1{-2i} to a+bi form and take the imaginary part.",
        answer: "\\frac1{-2i}=\\frac1{-2i}\\cdot\\frac ii=\\frac i{-2i^2}=\\frac i2, so \\operatorname{Im}\\frac1{(1-i)^2}=\\operatorname{Im}\\frac i2=\\frac12.",
        integrandExpr: "x*exp(-x)*sin(x)",
        resultExpr: "1/2",
        domain: [0, Infinity],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^\\infty x^52^{-x}\\,dx — rewrite the base: 2^{-x}=e^{-x\\ln2}, so this is \\int_0^\\infty x^5e^{-x\\ln2}\\,dx, the a=\\ln2 case of \\int_0^\\infty x^ne^{-ax}\\,dx=\\frac{n!}{a^{n+1}}.",
        ],
        blank: "Plug in n=5,\\ a=\\ln2 and finish — don't forget n! here is the ordinary integer factorial, not something you need \\Gamma for.",
        answer: "\\frac{5!}{(\\ln2)^6}=\\frac{120}{(\\ln2)^6}.",
        integrandExpr: "x^5*2^(-x)",
        resultExpr: "120/log(2)^6",
        domain: [0, Infinity],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "The pitfalls note that a Gaussian integrand (e^{-x^2}) needs the separate Gaussian/hypersphere approach, not this technique. Try the by-parts move directly on \\int_0^\\infty x^ne^{-x^2}\\,dx — u=x^n,\\ dv=e^{-x^2}\\,dx — and explain exactly where it breaks down, compared to the e^{-x} case where dv=e^{-x}\\,dx integrates immediately to v=-e^{-x}.",
      answer: "The whole reduction depends on v being computable in the first place: dv=e^{-x}\\,dx integrates immediately to v=-e^{-x}, a genuine elementary antiderivative, which is what makes u=x^n,\\ dv=e^{-x}\\,dx a usable split at all. But \\int e^{-x^2}\\,dx has NO elementary antiderivative — that's the Gaussian integral's defining difficulty — so v can't even be written down as a formula, and the by-parts move never gets off the ground. (An ODD power, x^{2n+1}e^{-x^2}, dodges this entirely: substituting w=x^2 first turns it into a plain e^{-w} integral, which IS this technique's territory — it's only the even powers that are stuck needing v to exist for the bare e^{-x^2} factor.)",
    },
  },
  {
    id: "zeta-series",
    name: "Zeta-series integrals",
    tagline: "Expand \\frac{1}{e^x\\mp 1} as a geometric series in e^{-x}, then integrate term by term.",
    prerequisites: ["The Gamma function", "Geometric series"],
    whenToUse:
      "The integrand has \\frac{1}{e^x-1} or \\frac{1}{e^x+1} (or a scaled version, \\frac{1}{e^{ax}\\mp 1}) multiplied by a power of x, over (0,\\infty). Neither denominator is something you can attack directly — but both hide a geometric series that turns the integral into a sum of gamma-function integrals.",
    intuition:
      "\\frac1{e^x-1} hides a geometric series once you factor out e^{-x}: \\frac1{e^x-1}=\\frac{e^{-x}}{1-e^{-x}}, and for x>0, e^{-x}\\in(0,1), so \\frac1{1-e^{-x}}=\\sum_{j=0}^\\infty\\left(e^{-x}\\right)^j converges exactly the way \\frac1{1-r}=\\sum r^j does for any ratio |r|<1. Multiplying by x and integrating that series term by term turns ONE hard integral into infinitely many EASY ones — each \\int_0^\\infty xe^{-kx}\\,dx is just the Gamma-function's own n=1 case, scaled — and what's left over afterward is a bare numerical series, \\sum\\frac1{k^2}. That's where \\pi enters: at even powers this kind of series has a closed form in \\pi (the Basel problem and its relatives), which is exactly what makes these particular integrals come out elementary at all, rather than being left as an infinite sum.",
    recipe: [
      "Factor out e^{-x}: \\frac{1}{e^x-1} = \\frac{e^{-x}}{1-e^{-x}}, which is a geometric series \\sum_{k=1}^\\infty e^{-kx} (and \\frac{1}{e^x+1} = \\sum_{k=1}^\\infty(-1)^{k-1}e^{-kx}, the alternating version).",
      "Multiply through by x^n and integrate term by term: \\int_0^\\infty x^n\\cdot\\frac{1}{e^x\\mp1}\\,dx = \\sum_{k=1}^\\infty(\\pm1)^{k-1}\\int_0^\\infty x^ne^{-kx}\\,dx.",
      "Each term is a gamma-function integral: \\int_0^\\infty x^ne^{-kx}\\,dx=\\frac{n!}{k^{n+1}}.",
      "What's left is a numerical series in \\frac{1}{k^{n+1}} — \\zeta(n+1) for the \\frac{1}{e^x-1} case, or the alternating \\eta(n+1) for \\frac{1}{e^x+1}. For even n+1 these have closed forms in \\pi (e.g. \\zeta(2)=\\frac{\\pi^2}{6}, \\zeta(4)=\\frac{\\pi^4}{90}); that's what makes the integral come out elementary.",
      "The same series, differentiated once, handles \\frac{e^x}{(e^x-1)^2}: since \\frac{d}{dx}\\frac{1}{e^x-1}=-\\frac{e^x}{(e^x-1)^2}, the series \\sum e^{-kx} differentiates to \\sum ke^{-kx}, so \\int_0^\\infty x^n\\cdot\\frac{e^x}{(e^x-1)^2}\\,dx=\\sum_{k=1}^\\infty k\\int_0^\\infty x^ne^{-kx}\\,dx=n!\\,\\zeta(n).",
      "\\ln(1-x)=-\\sum_{k=1}^\\infty\\frac{x^k}{k}, so \\int_0^1\\frac{\\ln(1-x)}{x}\\,dx=-\\sum_{k=1}^\\infty\\int_0^1x^{k-1}\\,dx/k=-\\sum\\frac{1}{k^2}=-\\zeta(2)=-\\frac{\\pi^2}{6} — the same series trick, run on [0,1] instead of (0,\\infty).",
    ],
    example: ZETA_EXAMPLES[0],
    examples: ZETA_EXAMPLES,
    pitfalls: [
      "Swapping the sum and the integral needs justifying in a rigorous treatment (everything here is positive and the series converges absolutely, so it's fine) — but it's the one nontrivial step and worth naming, not just doing silently.",
      "\\frac{1}{e^x+1} gives the alternating series \\eta(n+1), not \\zeta(n+1) — mixing the two up gives an answer off by a factor of (1-2^{-n}).",
      "Only even n+1 has a known closed form in \\pi; \\zeta(3), for instance, has no elementary closed form, so \\int_0^\\infty\\frac{x^2}{e^x-1}\\,dx isn't a 'type the answer' problem the way the even cases are.",
    ],
    checkYourself: {
      prompt: "\\frac{-\\ln(1-x)}x \\text{ on } [0,1]",
      answer: "\\frac{\\pi^2}6",
      hint: "Expand -\\ln(1-x)=\\sum_{k=1}^\\infty\\frac{x^k}k, divide by x, and integrate term by term on [0,1] instead of (0,\\infty) — the last recipe bullet is this exact move.",
    },
    completions: [
      {
        setup: [
          "\\int_0^\\infty\\frac{x^3}{e^x-1}\\,dx — same expansion as the lesson's own example, one index up: \\frac1{e^x-1}=\\sum_{k=1}^\\infty e^{-kx}, so \\int_0^\\infty\\frac{x^3}{e^x-1}\\,dx=\\sum_{k=1}^\\infty\\int_0^\\infty x^3e^{-kx}\\,dx.",
          "Each term is a Gamma-function integral: \\int_0^\\infty x^3e^{-kx}\\,dx=\\frac{3!}{k^4}=\\frac6{k^4}.",
        ],
        blank: "Sum \\sum_{k=1}^\\infty\\frac6{k^4} — you'll need \\zeta(4)=\\sum_{k=1}^\\infty\\frac1{k^4}=\\frac{\\pi^4}{90} (cited, the same way \\zeta(2) was in the lesson's own worked example).",
        answer: "6\\zeta(4)=6\\cdot\\frac{\\pi^4}{90}=\\frac{\\pi^4}{15}.",
        integrandExpr: "x^3/(exp(x)-1)",
        resultExpr: "pi^4/15",
        domain: [0, Infinity],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^\\infty\\frac{x^3}{e^x+1}\\,dx — same family, alternating: \\int_0^\\infty\\frac{x^3}{e^x+1}\\,dx=3!\\,\\eta(4) where \\eta(4)=\\sum_{k=1}^\\infty(-1)^{k-1}\\frac1{k^4}.",
          "Split \\zeta(4) (from the completion above) into even- and odd-indexed terms: the even ones, \\frac1{(2j)^4}, sum to \\frac1{16}\\zeta(4), so the odd ones sum to the remaining \\frac{15}{16}\\zeta(4). \\eta(4) is odd minus even.",
        ],
        blank: "Compute \\eta(4), then 3!\\,\\eta(4).",
        answer: "\\eta(4)=\\frac{15}{16}\\zeta(4)-\\frac1{16}\\zeta(4)=\\frac{14}{16}\\zeta(4)=\\frac78\\zeta(4)=\\frac78\\cdot\\frac{\\pi^4}{90}=\\frac{7\\pi^4}{720}. So 3!\\,\\eta(4)=6\\cdot\\frac{7\\pi^4}{720}=\\frac{7\\pi^4}{120}.",
        integrandExpr: "x^3/(exp(x)+1)",
        resultExpr: "7*pi^4/120",
        domain: [0, Infinity],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "This technique turns \\int_0^\\infty x^n/(e^x-1)\\,dx into n!\\,\\zeta(n+1) mechanically, regardless of whether n+1 is even or odd. So why does the pitfall single out ODD n+1 (like \\zeta(3)) as not having a closed form, when nothing about the integral-to-series step itself seemed to care about parity?",
      answer: "The series-and-Gamma machinery genuinely doesn't care about parity — it lands on n!\\,\\zeta(n+1) either way, no extra work. The difficulty is entirely downstream, in a fact this technique doesn't derive: \\zeta at an EVEN integer has a known closed form in \\pi (Euler found \\zeta(2)=\\pi^2/6 by comparing \\sin x's power series to its factorisation over its roots, and every even \\zeta value follows the same route), but no analogous closed form at an odd integer is known at all — not merely harder to compute, but genuinely open. \\zeta(3) wasn't even proven irrational until 1978, let alone given a closed form. So this technique always lands you on a well-defined sum; whether that sum simplifies further is a fact about \\zeta itself, established independently of anything here, and one that happens to hand you an elementary answer at even n+1 and nothing at odd n+1.",
    },
  },
  {
    id: "wallis-product",
    name: "Wallis integrals",
    tagline: "\\int_0^{\\pi/2}\\sin^n x\\,dx follows the same reduction as the full-period version — and squeezing consecutive terms is how Wallis found his product for \\pi.",
    prerequisites: ["Recurrence relations", "Trig identities"],
    whenToUse:
      "A power of \\sin x or \\cos x integrated over [0,\\pi/2] (or [0,\\pi], or a full period) — exactly the shape the recurrence technique reduces, but here the point is the family of values itself, and the surprising fact that comparing consecutive terms produces an infinite product for \\pi.",
    intuition:
      "On [0,\\pi/2], \\sin x\\in[0,1], so raising it to a higher power can only make it SMALLER (or equal) at every point: \\sin^{n+1}x\\le\\sin^nx\\le\\sin^{n-1}x throughout the interval. Integrating a pointwise inequality over a fixed interval preserves it, so I_{n+1}\\le I_n\\le I_{n-1}. Divide through by I_{n-1} (positive, so the inequality direction survives): \\frac{I_{n+1}}{I_{n-1}}\\le\\frac{I_n}{I_{n-1}}\\le1 — and the reduction formula from Recurrence relations gives \\frac{I_{n+1}}{I_{n-1}}=\\frac n{n+1}, which tends to 1 as n grows. Squeezed between something tending to 1 and 1 itself, \\frac{I_n}{I_{n-1}} has no choice but to tend to 1 as well: already by n=5 the ratio is \\frac{I_5}{I_4}\\approx0.905, and by n=50 it's \\frac{I_{50}}{I_{49}}\\approx0.990. Unrolling the even- and odd-indexed reductions separately and pushing that ratio to its limit is exactly what turns a statement about ONE sequence into the infinite product for \\pi below.",
    recipe: [
      "Reduce with parts exactly as in the recurrence technique: I_n=\\int_0^{\\pi/2}\\sin^nx\\,dx satisfies I_n=\\frac{n-1}{n}I_{n-2}, with base cases I_0=\\frac{\\pi}{2} and I_1=1.",
      "On [0,\\pi/2], \\sin x\\in[0,1], so higher powers are pointwise smaller: \\sin^{n+1}x\\leq\\sin^nx\\leq\\sin^{n-1}x for every x there, hence I_{n+1}\\leq I_n\\leq I_{n-1}.",
      "Divide through by I_{n-1}: \\frac{I_{n+1}}{I_{n-1}}\\leq\\frac{I_n}{I_{n-1}}\\leq 1. The reduction formula gives \\frac{I_{n+1}}{I_{n-1}}=\\frac{n}{n+1}\\to1, so by squeezing, \\frac{I_n}{I_{n-1}}\\to1 too.",
      "Unrolling the even-index reduction all the way down and substituting into that ratio produces the Wallis product: \\frac{\\pi}{2}=\\prod_{k=1}^\\infty\\frac{2k}{2k-1}\\cdot\\frac{2k}{2k+1} = \\frac{2}{1}\\cdot\\frac{2}{3}\\cdot\\frac{4}{3}\\cdot\\frac{4}{5}\\cdot\\frac{6}{5}\\cdot\\frac{6}{7}\\cdots",
      "The two-power version \\int_0^{\\pi/2}\\cos^{2\\alpha-1}\\theta\\sin^{2\\beta-1}\\theta\\,d\\theta=\\frac{\\Gamma(\\alpha)\\Gamma(\\beta)}{2\\Gamma(\\alpha+\\beta)} comes from the same substitution that proves \\int_0^\\infty e^{-x^2}dx=\\frac{\\sqrt\\pi}{2}: write \\Gamma(\\alpha)\\Gamma(\\beta) as a product of two Gaussian integrals, switch to polar coordinates, and the angular integral left over is exactly this one.",
    ],
    example: WALLIS_EXAMPLES[0],
    examples: WALLIS_EXAMPLES,
    pitfalls: [
      "\\int_0^{\\pi/2}\\cos^nx\\,dx equals the exact same I_n — substitute x\\to\\frac{\\pi}{2}-x to see sin and cos trade places over this particular interval — so don't re-derive the cosine case from scratch.",
      "The squeeze argument needs sin x\\in[0,1] on the interval, which is specific to [0,\\pi/2] (or [0,\\pi]) — it's not a general fact about \\sin^nx for arbitrary bounds.",
      "The reduction formula alone answers every 'evaluate this integral' problem; the squeeze/product derivation is the extra mile that explains *why* the Wallis product converges to \\pi, not a step you need for a numeric answer.",
      "\\Gamma at a quarter-integer (like \\Gamma(3/4)) has no simpler closed form — an answer is allowed to contain it as-is, the same way an answer is allowed to contain \\pi or \\sqrt2.",
    ],
    checkYourself: {
      prompt: "\\cos^7x \\text{ on } \\left[0,\\frac\\pi2\\right]",
      answer: "\\frac{16}{35}",
      hint: "\\int_0^{\\pi/2}\\cos^nx\\,dx equals the same I_n as \\sin^nx on this interval — unwind the odd-index recursion starting from I_1=1.",
    },
    completions: [
      {
        setup: [
          "\\int_0^{\\pi/2}\\cos^8x\\,dx — \\cos^nx and \\sin^nx give the exact same I_n on [0,\\pi/2] (substitute x\\to\\tfrac\\pi2-x to see them trade places), so use the even reduction chain: I_0=\\tfrac\\pi2,\\quad I_2=\\tfrac12I_0=\\tfrac\\pi4,\\quad I_4=\\tfrac34I_2=\\tfrac{3\\pi}{16},\\quad I_6=\\tfrac56I_4=\\tfrac{5\\pi}{32}.",
        ],
        blank: "One more step: I_8=\\frac78I_6.",
        answer: "I_8=\\frac78\\cdot\\frac{5\\pi}{32}=\\frac{35\\pi}{256}.",
        integrandExpr: "cos(x)^8",
        resultExpr: "35*pi/256",
        domain: [0, Math.PI / 2],
        kind: "definite",
      },
      {
        setup: [
          "\\int_0^{\\pi/2}\\cos^3\\theta\\sin^5\\theta\\,d\\theta — matches the two-power formula \\int_0^{\\pi/2}\\cos^{2\\alpha-1}\\theta\\sin^{2\\beta-1}\\theta\\,d\\theta=\\frac{\\Gamma(\\alpha)\\Gamma(\\beta)}{2\\Gamma(\\alpha+\\beta)} with 2\\alpha-1=3\\Rightarrow\\alpha=2, and 2\\beta-1=5\\Rightarrow\\beta=3.",
        ],
        blank: "Apply the formula (\\Gamma at a positive integer is just factorial: \\Gamma(k)=(k-1)!) and simplify.",
        answer: "\\frac{\\Gamma(2)\\Gamma(3)}{2\\Gamma(5)}=\\frac{1!\\cdot2!}{2\\cdot4!}=\\frac{1\\cdot2}{2\\cdot24}=\\frac2{48}=\\frac1{24}.",
        integrandExpr: "cos(x)^3*sin(x)^5",
        resultExpr: "1/24",
        domain: [0, Math.PI / 2],
        kind: "definite",
      },
    ],
    selfExplain: {
      prompt: "The squeeze argument shows I_{n+1}\\le I_n\\le I_{n-1}, divides through by I_{n-1} to get \\frac{I_{n+1}}{I_{n-1}}\\le\\frac{I_n}{I_{n-1}}\\le1, and notes \\frac{I_{n+1}}{I_{n-1}}=\\frac n{n+1}\\to1. Why does this FORCE \\frac{I_n}{I_{n-1}}\\to1 — what's the actual logical machinery, and would the argument still work if \\frac{I_{n+1}}{I_{n-1}} only approached, say, \\frac23 instead of 1?",
      answer: "This is the squeeze (sandwich) theorem: a sequence trapped between two others that converge to the SAME limit has no room to do anything except converge to that limit too. Here \\frac{I_n}{I_{n-1}} is sandwiched between \\frac{I_{n+1}}{I_{n-1}}=\\frac n{n+1} below and the constant 1 above, and both bounds converge to 1 as n\\to\\infty — so \\frac{I_n}{I_{n-1}} has nowhere left to go but 1 as well. If the lower bound instead approached \\tfrac23, the squeeze would only prove \\frac{I_n}{I_{n-1}} is EVENTUALLY between \\tfrac23 and 1 — not pinned to a single value, since the upper bound (1) and that hypothetical lower limit (\\tfrac23) would no longer coincide. The argument's entire force comes from both bounds landing on exactly the same number in the limit; a gap of any size leaves the squeezed sequence free to wander anywhere inside it.",
    },
  },
  {
    id: "gaussian-hypersphere",
    name: "Gaussian integrals & the hypersphere",
    tagline: "Squaring \\int e^{-x^2}dx turns it into a 2-D integral you can do in polar coordinates — the same trick, run in d dimensions, gives the volume of a hypersphere.",
    prerequisites: ["Substitution", "The Gamma function"],
    whenToUse:
      "A polynomial times e^{-x^2} (or e^{-ax^2}) integrated over (0,\\infty) or (-\\infty,\\infty). There's no elementary antiderivative for e^{-x^2} itself — this family is solved by a dimension-raising trick, not by finding F(x).",
    intuition:
      "Squaring a single integral turns it into a genuinely 2-D one: if I=\\int e^{-x^2}\\,dx over the whole line, then I^2 is the SAME integral run twice, over two INDEPENDENT variables — which is exactly \\iint e^{-(x^2+y^2)}\\,dx\\,dy over the whole plane, a function that depends only on distance from the origin. That radial symmetry is what makes polar coordinates pay off: chop the plane into thin rings of radius r and thickness dr, each ring further split into wedges of angle d\\theta. To first order, one such patch is a rectangle with sides dr (radial) and r\\,d\\theta (tangential — arc length is radius times angle), so its area is r\\,dr\\,d\\theta, not just dr\\,d\\theta. That extra factor of r is the whole payoff: \\int e^{-r^2}r\\,dr is elementary by u=r^2, even though \\int e^{-x^2}\\,dx alone never was — the area element itself supplies exactly the factor a plain substitution needs.",
    recipe: [
      "Let I=\\int_{-\\infty}^\\infty e^{-x^2}\\,dx. Then I^2 = \\left(\\int_{-\\infty}^\\infty e^{-x^2}dx\\right)\\left(\\int_{-\\infty}^\\infty e^{-y^2}dy\\right) = \\iint_{\\mathbb{R}^2}e^{-(x^2+y^2)}\\,dx\\,dy.",
      "Switch to polar coordinates: x^2+y^2=r^2 and dx\\,dy=r\\,dr\\,d\\theta, so I^2=\\int_0^{2\\pi}\\int_0^\\infty e^{-r^2}r\\,dr\\,d\\theta — and the r makes the radial integral elementary (u=r^2).",
      "I^2 = 2\\pi\\cdot\\frac{1}{2} = \\pi, so I=\\sqrt{\\pi}, and by symmetry \\int_0^\\infty e^{-x^2}dx=\\frac{\\sqrt\\pi}{2}.",
      "For x^{2n}e^{-x^2} or e^{-ax^2}, don't re-derive — substitute u=x^2 or u=\\sqrt{a}\\,x to reduce to this base result or to a gamma-function integral (odd powers of x actually land there: x^{2n+1}e^{-x^2} has an elementary antiderivative once u=x^2 is applied, no \\sqrt\\pi involved).",
      "The same squaring trick generalises: \\int_{\\mathbb{R}^d}e^{-|x|^2}dx = \\pi^{d/2} (d independent 1-D Gaussians), and also equals \\int_0^\\infty e^{-r^2}\\,\\omega_{d-1}r^{d-1}\\,dr where \\omega_{d-1} is the surface area of the unit (d-1)-sphere. Matching the two (the radial integral is a gamma-function integral, \\frac{1}{2}\\Gamma(d/2)) gives \\omega_{d-1}=\\frac{2\\pi^{d/2}}{\\Gamma(d/2)} — the surface area of a radius-r sphere in d dimensions is \\frac{2\\pi^{d/2}}{\\Gamma(d/2)}r^{d-1}.",
    ],
    example: GAUSSIAN_EXAMPLES[0],
    examples: GAUSSIAN_EXAMPLES,
    pitfalls: [
      "\\int e^{-x^2}dx has no elementary antiderivative at all — every problem in this family is solved by a substitution or symmetry trick that avoids ever needing F(x), not by finding one.",
      "Odd powers (x,\\,x^3,\\,x^5,\\ldots) times e^{-x^2} are secretly elementary — u=x^2 turns x^{2n+1}e^{-x^2}dx into a plain gamma-function integral in u, with no \\sqrt\\pi in the answer. Only even powers carry the \\sqrt\\pi.",
      "\\Gamma(1/2)=\\sqrt\\pi is exactly this technique's I=\\sqrt\\pi in disguise — if a problem elsewhere needs \\Gamma at a half-integer, this derivation is where that value comes from.",
    ],
    checkYourself: {
      prompt: "x^4e^{-x^2} \\text{ on } [0,\\infty)",
      answer: "\\frac{3\\sqrt\\pi}8",
      hint: "By parts with u=x^3,\\ dv=xe^{-x^2}dx reduces this to a multiple of the second worked example's result, \\frac{\\sqrt\\pi}4.",
    },
  },
];

export const TECHNIQUE_BY_ID: Record<TechniqueId, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, Technique>;

export function techniqueName(id: TechniqueId): string {
  return TECHNIQUE_BY_ID[id]?.name ?? id;
}
