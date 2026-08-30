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
      "The sum is \\sum_{k=1}^\\infty\\frac1{k^2}=\\zeta(2)=\\frac{\\pi^2}6 — the Basel-problem constant, cited rather than re-derived here (the Gamma-function lesson's 'why it works' has the family this belongs to).",
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
      "Let I=\\int_0^\\infty\\frac{dx}{(1+x^2)(1+x^3)}. Substitute x=\\frac1t as before: the (1+x^2) factor becomes \\frac{t^2+1}{t^2}$ and $(1+x^3)$ becomes $\\frac{t^3+1}{t^3}$, while $dx=-\\frac{dt}{t^2}$ — so $\\frac{dx}{(1+x^2)(1+x^3)}$ becomes $\\frac{t^3\\,dt}{(1+t^2)(1+t^3)}$ after the t^2 in the numerator cancels one power of t^2 from (1+x^2).",
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
    integrand: "\\frac{\\arctan x}{x(1+\\ln^2x)} \\text{ on } [0,\\infty) \\text{ (a flagship that needs a second move)}",
    work: [
      "The raw x\\to\\frac1x pairing doesn't close up here — try it and the twin integral isn't simply related to the original. The fix is to substitute u=\\ln x FIRST: x=e^u,\\ dx=e^u\\,du, so x(1+\\ln^2x)=e^u(1+u^2) and the e^u cancels exactly, leaving I=\\int_{-\\infty}^\\infty\\frac{\\arctan(e^u)}{1+u^2}\\,du.",
      "That's now an integral over the WHOLE real line — and x\\to\\frac1x, in log coordinates, is exactly u\\to-u. Relabel: I=\\int_{-\\infty}^\\infty\\frac{\\arctan(e^{-u})}{1+u^2}\\,du too (the domain (-\\infty,\\infty) is unchanged by u\\to-u, so this relabelling is free).",
      "Add the two forms: 2I=\\int_{-\\infty}^\\infty\\frac{\\arctan(e^u)+\\arctan(e^{-u})}{1+u^2}\\,du. Since e^u>0 always, \\arctan(y)+\\arctan\\frac1y=\\frac\\pi2 for every y>0 (complementary angles in a right triangle with legs y and 1) — so the numerator is the CONSTANT \\frac\\pi2.",
      "2I=\\frac\\pi2\\int_{-\\infty}^\\infty\\frac{du}{1+u^2}=\\frac\\pi2\\cdot\\pi=\\frac{\\pi^2}2, so I=\\frac{\\pi^2}4.",
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
  },
  {
    id: "zeta-series",
    name: "Zeta-series integrals",
    tagline: "Expand \\frac{1}{e^x\\mp 1} as a geometric series in e^{-x}, then integrate term by term.",
    whenToUse:
      "The integrand has \\frac{1}{e^x-1} or \\frac{1}{e^x+1} (or a scaled version, \\frac{1}{e^{ax}\\mp 1}) multiplied by a power of x, over (0,\\infty). Neither denominator is something you can attack directly — but both hide a geometric series that turns the integral into a sum of gamma-function integrals.",
    recipe: [
      "Factor out e^{-x}: \\frac{1}{e^x-1} = \\frac{e^{-x}}{1-e^{-x}}, which is a geometric series \\sum_{k=1}^\\infty e^{-kx} (and \\frac{1}{e^x+1} = \\sum_{k=1}^\\infty(-1)^{k-1}e^{-kx}, the alternating version).",
      "Multiply through by x^n and integrate term by term: \\int_0^\\infty x^n\\cdot\\frac{1}{e^x\\mp1}\\,dx = \\sum_{k=1}^\\infty(\\pm1)^{k-1}\\int_0^\\infty x^ne^{-kx}\\,dx.",
      "Each term is a gamma-function integral: \\int_0^\\infty x^ne^{-kx}\\,dx=\\frac{n!}{k^{n+1}}.",
      "What's left is a numerical series in \\frac{1}{k^{n+1}} — \\zeta(n+1) for the \\frac{1}{e^x-1} case, or the alternating \\eta(n+1) for \\frac{1}{e^x+1}. For even n+1 these have closed forms in \\pi (e.g. \\zeta(2)=\\frac{\\pi^2}{6}, \\zeta(4)=\\frac{\\pi^4}{90}); that's what makes the integral come out elementary.",
      "The same series, differentiated once, handles \\frac{e^x}{(e^x-1)^2}: since \\frac{d}{dx}\\frac{1}{e^x-1}=-\\frac{e^x}{(e^x-1)^2}, the series \\sum e^{-kx} differentiates to \\sum ke^{-kx}, so \\int_0^\\infty x^n\\cdot\\frac{e^x}{(e^x-1)^2}\\,dx=\\sum_{k=1}^\\infty k\\int_0^\\infty x^ne^{-kx}\\,dx=n!\\,\\zeta(n).",
      "\\ln(1-x)=-\\sum_{k=1}^\\infty\\frac{x^k}{k}, so \\int_0^1\\frac{\\ln(1-x)}{x}\\,dx=-\\sum_{k=1}^\\infty\\int_0^1x^{k-1}\\,dx/k=-\\sum\\frac{1}{k^2}=-\\zeta(2)=-\\frac{\\pi^2}{6} — the same series trick, run on [0,1] instead of (0,\\infty).",
    ],
    example: {
      integrand: "\\frac{x}{e^x-1} \\text{ on } (0,\\infty)",
      work: [
        "\\frac{1}{e^x-1}=\\sum_{k=1}^\\infty e^{-kx}, so the integral is \\sum_{k=1}^\\infty\\int_0^\\infty xe^{-kx}\\,dx.",
        "Each term is the n=1 gamma-function integral: \\int_0^\\infty xe^{-kx}\\,dx=\\frac{1}{k^2}.",
        "The sum is \\sum_{k=1}^\\infty\\frac{1}{k^2}=\\zeta(2)=\\frac{\\pi^2}{6} — the same constant Euler found by comparing \\frac{\\sin x}{x}'s power series to its Weierstrass product over its roots \\pm k\\pi.",
      ],
      result: "\\frac{\\pi^2}{6}",
    },
    pitfalls: [
      "Swapping the sum and the integral needs justifying in a rigorous treatment (everything here is positive and the series converges absolutely, so it's fine) — but it's the one nontrivial step and worth naming, not just doing silently.",
      "\\frac{1}{e^x+1} gives the alternating series \\eta(n+1), not \\zeta(n+1) — mixing the two up gives an answer off by a factor of (1-2^{-n}).",
      "Only even n+1 has a known closed form in \\pi; \\zeta(3), for instance, has no elementary closed form, so \\int_0^\\infty\\frac{x^2}{e^x-1}\\,dx isn't a 'type the answer' problem the way the even cases are.",
    ],
  },
  {
    id: "wallis-product",
    name: "Wallis integrals",
    tagline: "\\int_0^{\\pi/2}\\sin^n x\\,dx follows the same reduction as the full-period version — and squeezing consecutive terms is how Wallis found his product for \\pi.",
    whenToUse:
      "A power of \\sin x or \\cos x integrated over [0,\\pi/2] (or [0,\\pi], or a full period) — exactly the shape the recurrence technique reduces, but here the point is the family of values itself, and the surprising fact that comparing consecutive terms produces an infinite product for \\pi.",
    recipe: [
      "Reduce with parts exactly as in the recurrence technique: I_n=\\int_0^{\\pi/2}\\sin^nx\\,dx satisfies I_n=\\frac{n-1}{n}I_{n-2}, with base cases I_0=\\frac{\\pi}{2} and I_1=1.",
      "On [0,\\pi/2], \\sin x\\in[0,1], so higher powers are pointwise smaller: \\sin^{n+1}x\\leq\\sin^nx\\leq\\sin^{n-1}x for every x there, hence I_{n+1}\\leq I_n\\leq I_{n-1}.",
      "Divide through by I_{n-1}: \\frac{I_{n+1}}{I_{n-1}}\\leq\\frac{I_n}{I_{n-1}}\\leq 1. The reduction formula gives \\frac{I_{n+1}}{I_{n-1}}=\\frac{n}{n+1}\\to1, so by squeezing, \\frac{I_n}{I_{n-1}}\\to1 too.",
      "Unrolling the even-index reduction all the way down and substituting into that ratio produces the Wallis product: \\frac{\\pi}{2}=\\prod_{k=1}^\\infty\\frac{2k}{2k-1}\\cdot\\frac{2k}{2k+1} = \\frac{2}{1}\\cdot\\frac{2}{3}\\cdot\\frac{4}{3}\\cdot\\frac{4}{5}\\cdot\\frac{6}{5}\\cdot\\frac{6}{7}\\cdots",
      "The two-power version \\int_0^{\\pi/2}\\cos^{2\\alpha-1}\\theta\\sin^{2\\beta-1}\\theta\\,d\\theta=\\frac{\\Gamma(\\alpha)\\Gamma(\\beta)}{2\\Gamma(\\alpha+\\beta)} comes from the same substitution that proves \\int_0^\\infty e^{-x^2}dx=\\frac{\\sqrt\\pi}{2}: write \\Gamma(\\alpha)\\Gamma(\\beta) as a product of two Gaussian integrals, switch to polar coordinates, and the angular integral left over is exactly this one.",
    ],
    example: {
      integrand: "\\sin^6 x \\text{ on } \\left[0,\\frac{\\pi}{2}\\right]",
      work: [
        "I_n=\\frac{n-1}{n}I_{n-2}, base case I_0=\\frac{\\pi}{2}.",
        "I_2=\\frac{1}{2}\\cdot\\frac{\\pi}{2}=\\frac{\\pi}{4}.\\quad I_4=\\frac{3}{4}\\cdot\\frac{\\pi}{4}=\\frac{3\\pi}{16}.",
        "I_6=\\frac{5}{6}\\cdot\\frac{3\\pi}{16}=\\frac{15\\pi}{96}.",
      ],
      result: "\\frac{5\\pi}{32}",
    },
    pitfalls: [
      "\\int_0^{\\pi/2}\\cos^nx\\,dx equals the exact same I_n — substitute x\\to\\frac{\\pi}{2}-x to see sin and cos trade places over this particular interval — so don't re-derive the cosine case from scratch.",
      "The squeeze argument needs sin x\\in[0,1] on the interval, which is specific to [0,\\pi/2] (or [0,\\pi]) — it's not a general fact about \\sin^nx for arbitrary bounds.",
      "The reduction formula alone answers every 'evaluate this integral' problem; the squeeze/product derivation is the extra mile that explains *why* the Wallis product converges to \\pi, not a step you need for a numeric answer.",
      "\\Gamma at a quarter-integer (like \\Gamma(3/4)) has no simpler closed form — an answer is allowed to contain it as-is, the same way an answer is allowed to contain \\pi or \\sqrt2.",
    ],
  },
  {
    id: "gaussian-hypersphere",
    name: "Gaussian integrals & the hypersphere",
    tagline: "Squaring \\int e^{-x^2}dx turns it into a 2-D integral you can do in polar coordinates — the same trick, run in d dimensions, gives the volume of a hypersphere.",
    whenToUse:
      "A polynomial times e^{-x^2} (or e^{-ax^2}) integrated over (0,\\infty) or (-\\infty,\\infty). There's no elementary antiderivative for e^{-x^2} itself — this family is solved by a dimension-raising trick, not by finding F(x).",
    recipe: [
      "Let I=\\int_{-\\infty}^\\infty e^{-x^2}\\,dx. Then I^2 = \\left(\\int_{-\\infty}^\\infty e^{-x^2}dx\\right)\\left(\\int_{-\\infty}^\\infty e^{-y^2}dy\\right) = \\iint_{\\mathbb{R}^2}e^{-(x^2+y^2)}\\,dx\\,dy.",
      "Switch to polar coordinates: x^2+y^2=r^2 and dx\\,dy=r\\,dr\\,d\\theta, so I^2=\\int_0^{2\\pi}\\int_0^\\infty e^{-r^2}r\\,dr\\,d\\theta — and the r makes the radial integral elementary (u=r^2).",
      "I^2 = 2\\pi\\cdot\\frac{1}{2} = \\pi, so I=\\sqrt{\\pi}, and by symmetry \\int_0^\\infty e^{-x^2}dx=\\frac{\\sqrt\\pi}{2}.",
      "For x^{2n}e^{-x^2} or e^{-ax^2}, don't re-derive — substitute u=x^2 or u=\\sqrt{a}\\,x to reduce to this base result or to a gamma-function integral (odd powers of x actually land there: x^{2n+1}e^{-x^2} has an elementary antiderivative once u=x^2 is applied, no \\sqrt\\pi involved).",
      "The same squaring trick generalises: \\int_{\\mathbb{R}^d}e^{-|x|^2}dx = \\pi^{d/2} (d independent 1-D Gaussians), and also equals \\int_0^\\infty e^{-r^2}\\,\\omega_{d-1}r^{d-1}\\,dr where \\omega_{d-1} is the surface area of the unit (d-1)-sphere. Matching the two (the radial integral is a gamma-function integral, \\frac{1}{2}\\Gamma(d/2)) gives \\omega_{d-1}=\\frac{2\\pi^{d/2}}{\\Gamma(d/2)} — the surface area of a radius-r sphere in d dimensions is \\frac{2\\pi^{d/2}}{\\Gamma(d/2)}r^{d-1}.",
    ],
    example: {
      integrand: "\\text{The hypersphere formula, checked at } d=3",
      work: [
        "\\omega_{d-1}=\\frac{2\\pi^{d/2}}{\\Gamma(d/2)}. At d=3: \\omega_2=\\frac{2\\pi^{3/2}}{\\Gamma(3/2)}.",
        "\\Gamma\\left(\\frac{3}{2}\\right)=\\frac{1}{2}\\Gamma\\left(\\frac{1}{2}\\right)=\\frac{\\sqrt\\pi}{2}, using \\Gamma(1/2)=\\sqrt\\pi (which is exactly I=\\sqrt\\pi from the derivation, in Gamma-function notation).",
        "\\omega_2 = \\frac{2\\pi^{3/2}}{\\sqrt\\pi/2} = 4\\pi, and the surface area of a radius-r sphere is \\omega_2r^2=4\\pi r^2 — the familiar formula.",
      ],
      result: "4\\pi r^2",
    },
    pitfalls: [
      "\\int e^{-x^2}dx has no elementary antiderivative at all — every problem in this family is solved by a substitution or symmetry trick that avoids ever needing F(x), not by finding one.",
      "Odd powers (x,\\,x^3,\\,x^5,\\ldots) times e^{-x^2} are secretly elementary — u=x^2 turns x^{2n+1}e^{-x^2}dx into a plain gamma-function integral in u, with no \\sqrt\\pi in the answer. Only even powers carry the \\sqrt\\pi.",
      "\\Gamma(1/2)=\\sqrt\\pi is exactly this technique's I=\\sqrt\\pi in disguise — if a problem elsewhere needs \\Gamma at a half-integer, this derivation is where that value comes from.",
    ],
  },
];

export const TECHNIQUE_BY_ID: Record<TechniqueId, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, Technique>;

export function techniqueName(id: TechniqueId): string {
  return TECHNIQUE_BY_ID[id]?.name ?? id;
}
