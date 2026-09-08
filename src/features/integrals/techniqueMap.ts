/**
 * The technique map (WS-11, UK_BEE_BURST.md).
 *
 * Twenty-seven techniques as a flat list is twenty-seven things to memorise. As a structure it's a
 * handful of real ideas with variations — and recognising which idea a problem wants, on sight, is
 * exactly what separates someone who *knows* the techniques from someone who *sees* the right one.
 *
 * Every family below was checked against techniques.ts's own `intuition`/`prerequisites`/`pitfalls`
 * text before being asserted here, not invented to make a tidier diagram — several places cite the
 * exact sentence that grounds the claim. Where the codebase's content did NOT support a suggested
 * link, it was left out rather than forced (see the "considered and rejected" note on t-substitution
 * below): a false family is worse than an honest "this one stands alone".
 *
 * A technique with no genuine sibling is placed in STANDALONE_TECHNIQUES instead, each with a note
 * on why — and, where a real but looser connection exists, CROSS_LINKS records it without claiming
 * sibling-strength kinship. Every TechniqueId is placed in exactly one of
 * TECHNIQUE_FAMILIES/STANDALONE_TECHNIQUES — see techniqueMap.test.ts's totality check, which fails
 * loudly if a 28th technique is ever added here without being placed.
 *
 * Originally built against the 21 drillable TECHNIQUES; extended to cover all 27 real technique ids
 * (the 21 plus the six syllabus-completion lessons in LESSON_ONLY_TECHNIQUES, none of which have a
 * drill pool yet) once those six had real `intuition`/`prerequisites` prose to place them against
 * honestly rather than guess at — see leibniz-rule joining the differentiate-under-integral family,
 * and the new series-expansion family below, for the two genuine sibling-strength placements found;
 * the other four (named-series, euler-reflection, euler-mascheroni, sine-product) are standalone
 * with cross-links, per the same no-forced-family principle as everything else here.
 */
import type { TechniqueId } from "./types";

export interface FamilyMember {
  id: TechniqueId;
  /** What tells this member apart from its siblings, once you already know you're somewhere in
   *  this family — the actual recognition cue, not a recap of the technique itself. */
  cue: string;
}

export interface TechniqueFamily {
  id: string;
  name: string;
  /** The shared mechanism underneath every member — why they're one idea, not several. */
  bigIdea: string;
  members: FamilyMember[];
}

export interface StandaloneTechnique {
  id: TechniqueId;
  /** Why this technique has no genuine sibling family — and, where real, what it's related to
   *  without sharing a recognition cue tight enough to call it a sibling. */
  note: string;
}

/** A real but looser connection than family membership — worth surfacing, not worth claiming as
 *  "the same recognition cue". Unordered: `a` and `b` carry no direction. */
export interface CrossLink {
  a: TechniqueId;
  b: TechniqueId;
  note: string;
}

// ── families ───────────────────────────────────────────────────────────────────────────────────

export const TECHNIQUE_FAMILIES: TechniqueFamily[] = [
  {
    id: "reverse-a-rule",
    name: "Reverse a differentiation rule",
    bigIdea:
      "Nothing clever yet — each of these three undoes one named differentiation rule. Standard forms are memorised derivatives read straight off; substitution's own lesson says outright that it is the chain rule in reverse; and integration by parts' own lesson says it is the product rule in reverse, the same way substitution is the chain rule's. The recognition question is simply which rule, if any, was run forwards to build the integrand in front of you.",
    members: [
      {
        id: "power",
        cue: "Nothing is composed and nothing is multiplied — or it becomes that once you expand a bracket, split a fraction, or cancel. It's already one of the dozen memorised forms.",
      },
      {
        id: "u-sub",
        cue: "A composition f(g(x)) where g'(x) is also sitting in the integrand as a factor, up to a constant — the chain rule's own shape.",
      },
      {
        id: "parts",
        cue: "A product of two unlike factors, neither the other's derivative — or a lone \\ln x, \\arcsin x or \\arctan x, taking dv=dx. The product rule's own shape, reversed.",
      },
    ],
  },
  {
    id: "trig-integrand",
    name: "Taming a trig integrand",
    bigIdea:
      "Here the problem itself already shows you \\sin x, \\cos x or \\tan x — the only question is how to reshape that expression until a standard form or a plain substitution appears. Trig identities exist, in its own lesson's words, to manufacture the du a substitution needs; the t-substitution is what's left once no identity manufactures one — a single substitution that always works, which is exactly why it's the fallback, never the first move.",
    members: [
      {
        id: "trig-identity",
        cue: "Powers of \\sin x, \\cos x or \\tan x, or a product of two different frequencies (\\sin3x\\cos5x) — an identity (odd-power peel, double-angle, product-to-sum) exposes the pattern a plain substitution needs.",
      },
      {
        id: "t-sub",
        cue: "A rational function of \\sin x and \\cos x that resists every identity — classically a+b\\cos x sitting in a denominator. t=\\tan\\frac x2 always works, which is exactly why it's the last resort, not the first.",
      },
    ],
  },
  {
    id: "quadratic-reshaping",
    name: "Quadratic reshaping",
    bigIdea:
      "A quadratic that isn't already a standard form, with nothing trigonometric in the problem itself — the fork is purely about the quadratic's own shape, not its numerator. First: is there a root (or a non-integer power) sitting on it? No amount of algebra removes a root — only the Pythagorean-identity substitution does. If there's no root, completing the square's own reasoning decides the rest: a negative discriminant means the quadratic never factors over the reals, landing you on \\arctan directly; a positive one means it factors, which is partial fractions' own territory. Same first step (complete the square), same quadratic — the sign of one number sends you down a different one of these three.",
    members: [
      {
        id: "complete-square",
        cue: "No root, and the discriminant is negative — irreducible over the reals. Completing the square lands directly on the \\arctan/\\arcsin/\\log standard form, no further substitution needed.",
      },
      {
        id: "partial-fractions",
        cue: "No root, and the discriminant is non-negative — the quadratic (or a higher-degree denominator built the same way) factors into real linear or irreducible-quadratic pieces. Split into simple fractions instead of completing the square.",
      },
      {
        id: "trig-sub",
        cue: "A root — or a half-integer power — sits ON the quadratic itself: \\sqrt{a^2-x^2}, \\sqrt{a^2+x^2}, \\sqrt{x^2-a^2}, or those raised to a further power. Completing the square alone can't remove a root; the \\sin\\theta/\\tan\\theta/\\sec\\theta substitution does.",
      },
    ],
  },
  {
    id: "symmetry-substitution",
    name: "Change variable until a symmetry becomes visible",
    bigIdea:
      "Both members substitute the SAME definite integral into a second expression for the identical number, using an involution that maps the interval back onto itself — x\\to a-x on [0,a] for King's rule, x\\to\\frac1x on (0,\\infty) for reciprocal substitution. Reciprocal substitution's own lesson says this outright — it calls itself the exact same move as King's rule, just reflecting through a different involution. Neither needs an antiderivative: adding (or subtracting) the two expressions is what makes the hard part cancel.",
    members: [
      {
        id: "symmetry",
        cue: "A definite integral over a finite, symmetric interval — [-a,a], or [0,a] where f(x) and f(a-x) turn out related (classically [0,\\pi/2], swapping \\sin and \\cos, or [0,\\pi] with \\sin(\\pi-x)=\\sin x).",
      },
      {
        id: "reciprocal-substitution",
        cue: "A definite integral over the INFINITE interval (0,\\infty) — not a finite symmetric one — where \\ln x or an odd power of x looks antisymmetric under x\\to\\frac1x.",
      },
    ],
  },
  {
    id: "reduction-formulas",
    name: "Reduction formulas",
    bigIdea:
      "Each member relates a hard integral indexed by n to an easier one at n-1 — peel one factor off with integration by parts, unwind to a trivial base case. Recurrence relations is that pattern stated in general; Beta, Gamma and Wallis are exactly the same pattern run against three specific integrands, and their closed forms are the same object besides. \\Gamma is the generalisation (\\Gamma(n+1)=n!); the Beta integral is a ratio of Gammas (B(m,n)=\\frac{\\Gamma(m+1)\\Gamma(n+1)}{\\Gamma(m+n+2)}=\\frac{m!\\,n!}{(m+n+1)!}); and Wallis's own two-power identity is exactly half of that same Beta value (\\int_0^{\\pi/2}\\cos^{2\\alpha-1}\\theta\\sin^{2\\beta-1}\\theta\\,d\\theta=\\frac{\\Gamma(\\alpha)\\Gamma(\\beta)}{2\\Gamma(\\alpha+\\beta)}).",
    members: [
      {
        id: "recurrence",
        cue: "The general pattern — any problem shape that hands you an integer index n, related to n-1 usually by parts, occasionally by pure algebra (e.g. \\frac{x^n}{1+x}).",
      },
      {
        id: "beta-integrals",
        cue: "Specifically \\int_0^1x^m(1-x)^n\\,dx — TWO indices, peeling one factor of (1-x) off at a time; closed form \\frac{m!\\,n!}{(m+n+1)!}, on the finite interval [0,1].",
      },
      {
        id: "gamma-function",
        cue: "Specifically \\int_0^\\infty x^ne^{-x}\\,dx — ONE index against a fixed exponential kernel, on the infinite interval (0,\\infty); closed form n!.",
      },
      {
        id: "wallis-product",
        cue: "Specifically \\int_0^{\\pi/2}\\sin^nx\\,dx — a trig power on a finite interval, the same by-parts reduction, PLUS (uniquely here) a squeeze-theorem argument on consecutive terms that turns the family itself into the infinite product for \\pi.",
      },
    ],
  },
  {
    id: "differentiate-under-integral",
    name: "Differentiate under the integral sign",
    bigIdea:
      "Introduce a parameter into a fixed integral, turn I into a family I(a), and differentiate the FAMILY — in a — instead of integrating the original in x; the a-derivative is almost always the far easier integral. Log-power integrals' own lesson names this outright, calling itself Feynman's trick's own differentiate-under-the-integral-sign move, just aimed at the SAME trivial integral J(a)=\\int_0^1x^a\\,dx=\\frac1{a+1} over and over, rather than a fresh parameter chosen per problem.",
    members: [
      {
        id: "feynman",
        cue: "No direct technique makes progress in x at all — introduce a fresh parameter a matching the actual problem at one value, with I trivial at another.",
      },
      {
        id: "log-power-integrals",
        cue: "Specifically \\int_0^1x^n\\ln^kx\\,dx — don't invent a new parameter each time; reuse the SAME trivial integral J(a)=\\frac1{a+1} as a generating function and differentiate it k times.",
      },
      {
        id: "leibniz-rule",
        cue: "The BOUNDS themselves are functions of the same letter you're differentiating with respect to — a(t), b(t), not fixed constants. Every other member of this family holds the bounds fixed and only the integrand moves; here two more terms appear, one per moving edge, and the fixed-bounds case is just this one with a'=b'=0.",
      },
    ],
  },
  // Series-swap's own lesson text names zeta-series as the specific instance it generalises
  // ("Zeta-series integrals expands 1/(e^x∓1) as a geometric series... You have actually used this
  // move twice already without the name attached to it") — the same general-technique-plus-its-
  // own-repeated-special-case shape as feynman/log-power-integrals above, just for a different
  // mechanism (expand as a series and integrate termwise, rather than differentiate a parameter).
  // log-power-integrals ALSO has an alternate series-expansion route per series-swap's own text,
  // but its canonical placement (grounded in log-power-integrals' own lesson, which frames itself
  // via Feynman's trick) stays in differentiate-under-integral above — a technique is placed once,
  // so that secondary connection is a CROSS_LINK below, not a second family membership.
  {
    id: "series-expansion",
    name: "Expand as a series, integrate termwise",
    bigIdea:
      "An integrand with no elementary antiderivative at all can still be an infinite SUM of pieces that each integrate on sight — spot a Maclaurin expansion (geometric, exponential, logarithmic, binomial) hiding in the integrand, swap \\int\\sum for \\sum\\int, integrate the resulting general term, then recognise the sum you're left with. Zeta-series integrals is this exact move aimed at one specific, repeated shape (\\frac1{e^x\\mp1} times a power of x, expanded as a geometric series in e^{-x} and handed to the Gamma function term by term) rather than a fresh expansion chosen per problem — the same relationship log-power-integrals has to Feynman's trick, one family over.",
    members: [
      {
        id: "series-swap",
        cue: "No standard technique makes progress, but a Maclaurin series you already know — \\frac1{1-u}, e^u, \\ln(1+u), (1+u)^r — is visibly hiding inside the integrand.",
      },
      {
        id: "zeta-series",
        cue: "Specifically \\frac1{e^x\\mp1} multiplied by a power of x — don't hunt for a fresh expansion; it's always the same geometric series in e^{-x}, with each term handed to the Gamma function.",
      },
    ],
  },
];

// ── standalone ─────────────────────────────────────────────────────────────────────────────────
//
// Each of these was checked against a candidate family and left out on purpose — see the note for
// the specific reasoning, not just "didn't fit anywhere".

export const STANDALONE_TECHNIQUES: StandaloneTechnique[] = [
  {
    id: "floor-function",
    note: "No calculus move touches \\lfloor x\\rfloor at all — it's discontinuous at every integer, so there's no derivative to reverse and no substitution that smooths it out. The entire technique is arithmetic, not calculus: split at the integers, where the floor is constant, and sum rectangles. Nothing else in the curriculum shares this recognition cue.",
  },
  {
    id: "introducing-constants",
    note: "A general-purpose algebraic identity (N=\\lambda D+\\mu, true for any \\lambda) rather than a first-sight trigger of its own — the cue is broader than any single integrand shape, and it's most often reached for as a second pass once another technique has already done most of the work. See the cross-link to Completing the square: its own recipe already uses this exact move as one step, not as a separate technique.",
  },
  {
    id: "inverse-integral",
    note: "Derived FROM integration by parts plus a substitution, bundled into one reusable identity — its own lesson works through the derivation in full — but its trigger is unmistakably its own: a DEFINITE integral, f monotonic on the interval, and f^{-1} genuinely easier to integrate than f. See the cross-link to Integration by parts: both target the exact same integrands (\\ln x, \\arcsin x, \\arctan x), by different routes.",
  },
  {
    id: "gaussian-hypersphere",
    note: "Its base case, \\int_0^\\infty e^{-x^2}\\,dx=\\frac{\\sqrt\\pi}2, is not a by-parts reduction at all — it's a dimension-raising trick (square the integral, switch to polar coordinates) that none of the reduction-formula family needs for its own base cases, which are all elementary lookups. Higher powers of x times e^{-x^2} do then reduce by parts, two powers at a time, but the technique's defining, on-sight move is the squaring trick, not the reduction. See the cross-link to The Gamma function.",
  },
  // ── the six syllabus-completion lessons (UKUIB_PATH.md) — placed against their own actual
  // prerequisites/intuition text in lessons/*.ts, on the same no-forced-family principle as above.
  // zeta-series itself MOVED here from a standalone entry into the new series-expansion family
  // below, once series-swap's own lesson text named it as the specific instance the general
  // technique was built to describe — see that family's bigIdea for the citation.
  {
    id: "named-series",
    note: "Genuinely two mechanisms sit inside one lesson, not one: three of its five sums (\\zeta(2), \\beta(2), \\beta(3)) fall out of the same geometric-series machinery as zeta-series and series-swap, but the two two-sided sums come from an unrelated place — the partial-fraction expansions of \\cot and \\csc, evaluated at z=i. A technique whose own content splits across two mechanisms doesn't have one recognition cue to give it family membership; its real cue is simply \"do you recognise this constant on sight,\" which is its own kind of skill. See the cross-link to Zeta-series integrals for the three it does share a mechanism with.",
  },
  {
    id: "euler-reflection",
    note: "Its own lesson derives it by combining two already-distinct techniques (substitute the workhorse integral into Beta-function form, then apply the Beta-to-Gamma identity) rather than by peeling a factor or introducing a parameter — no existing family's mechanism describes it. See the cross-links to The Gamma function and Beta function integrals, the two techniques it's built from.",
  },
  {
    id: "euler-mascheroni",
    note: "Not a technique with an on-sight integrand shape at all — its own lesson's recognition cue is closer to \"you differentiated Gamma at 1 (or log-differentiated a Beta integral) and a constant appeared,\" which presupposes The Gamma function or Beta function integrals rather than sitting beside them as a sibling trigger. See the cross-links to both.",
  },
  {
    id: "sine-product",
    note: "Derives two already-existing results — \\zeta(2)=\\frac{\\pi^2}6 and Wallis' product — by an entirely different mechanism from either (root-factorisation of \\sin(\\pi x), read off by matching Taylor coefficients or substituting a specific point) rather than sharing a recognition cue with the techniques that reach the same numbers their own way. See the cross-links to Zeta-series integrals and Wallis integrals.",
  },
];

// ── cross-links ────────────────────────────────────────────────────────────────────────────────
//
// Real connections that don't rise to "shares a recognition cue with its siblings" — mostly one
// technique's own text explicitly citing another's. Layered on top of the family/standalone
// partition; a technique can carry any number of these regardless of where it's primary-placed.

export const CROSS_LINKS: CrossLink[] = [
  {
    a: "trig-sub",
    b: "trig-identity",
    note: "Both list Trig identities as a direct prerequisite, and for good reason: once a trig substitution has introduced \\theta, simplifying what's left (a power of \\sec\\theta, say) is ordinary Trig identities work. They sit in different families here because their RECOGNITION cue differs — trig-sub's own problem statement contains no trig function at all, only an algebraic quadratic under a root.",
  },
  {
    a: "introducing-constants",
    b: "complete-square",
    note: "Completing the square's own recipe already performs this exact move as one step on the way to an \\arctan — split the numerator once it has an x in it. Introducing constants is that same split, generalised past quadratics: reach for it whenever a numerator is almost, but not quite, a multiple of the denominator or its derivative, layered on top of whatever technique handles what's left.",
  },
  {
    a: "inverse-integral",
    b: "parts",
    note: "Parts already lists a lone \\ln x, \\arcsin x or \\arctan x among its own triggers — exactly what Integral of an inverse function targets. Its own pitfalls are explicit that this is a shortcut around integration by parts, not a different answer: by parts on the same integrand always works too, and is worth checking against when unsure the identity applies.",
  },
  {
    a: "zeta-series",
    b: "gamma-function",
    note: "Every term of zeta-series' geometric-series expansion IS a Gamma-function integral (\\int_0^\\infty x^ne^{-kx}\\,dx=\\frac{n!}{k^{n+1}}) — recognise which one you're looking at by the denominator: a bare e^{-x} is Gamma; \\frac1{e^x\\mp1} is zeta-series, which reduces to a sum of Gamma integrals plus a fact about \\zeta at even integers.",
  },
  {
    a: "gaussian-hypersphere",
    b: "gamma-function",
    note: "Each lesson's own pitfalls names the other directly: a linear exponent (e^{-x}) is Gamma's territory, a quadratic one (e^{-x^2}) is this technique's — and an ODD power of x times e^{-x^2} is secretly a plain Gamma integral in disguise (substitute u=x^2 and the square vanishes, with no \\sqrt\\pi in the answer at all).",
  },
  {
    a: "beta-integrals",
    b: "feynman",
    note: "Beta integrals' own extension for a stray \\ln x factor differentiates the Beta identity under the integral sign with respect to a parameter \\varepsilon — exactly Feynman's core move, reused as an advanced finishing step rather than the primary recognition trigger for either technique.",
  },
  // ── the six syllabus-completion lessons' cross-links (see their STANDALONE_TECHNIQUES notes
  // above for why each is a real but looser connection rather than family-sibling kinship).
  {
    a: "named-series",
    b: "zeta-series",
    note: "Three of the five named series (\\zeta(2)=\\frac{\\pi^2}6, \\beta(2)=G, \\beta(3)=\\frac{\\pi^3}{32}) come from exactly zeta-series' own geometric-series-and-integrate mechanism, just summed over odd denominators with an alternating sign — the other two (the two-sided sums) come from a different place entirely, the \\cot/\\csc partial-fraction expansions, which is why this is a cross-link and not a shared family.",
  },
  {
    a: "euler-reflection",
    b: "gamma-function",
    note: "The identity IS a statement about \\Gamma: \\Gamma(s)\\Gamma(1-s)=\\frac\\pi{\\sin(\\pi s)}. Euler reflection's own worked example even re-derives \\Gamma(\\tfrac12)=\\sqrt\\pi as a special case at s=\\tfrac12, a fact the Gamma function's own lesson states without deriving.",
  },
  {
    a: "euler-reflection",
    b: "beta-integrals",
    note: "The derivation route IS the Beta function: substitute t=\\frac x{1+x} in the workhorse integral \\int_0^\\infty\\frac{x^{s-1}}{1+x}\\,dx and it becomes exactly B(s,1-s), which the reflection formula then evaluates via \\Gamma. Beta function integrals is a genuine prerequisite, not a loose association.",
  },
  {
    a: "euler-mascheroni",
    b: "gamma-function",
    note: "\\gamma appears as \\Gamma'(1) — differentiate the Gamma integral once with respect to its own exponent and \\gamma falls out as \\int_0^\\infty e^{-x}\\ln x\\,dx=-\\gamma, the same trick the Gamma function's own reduction uses aimed at a derivative instead of a value.",
  },
  {
    a: "euler-mascheroni",
    b: "beta-integrals",
    note: "Beta function integrals' own log-differentiation extension produces the digamma function \\psi(n)=-\\gamma+H_{n-1}, so \\gamma is literally -\\psi(1) sitting inside a formula that lesson already uses — not a separate fact bolted on afterward.",
  },
  {
    a: "sine-product",
    b: "zeta-series",
    note: "Both reach \\zeta(2)=\\frac{\\pi^2}6 — zeta-series by expanding a geometric series in e^{-x} and summing Gamma integrals, sine-product by matching the x^2 Taylor coefficient of a root-factorisation of \\sin(\\pi x). Same number, two structurally unrelated derivations, which is exactly what a cross-link records and a shared family would misrepresent.",
  },
  {
    a: "sine-product",
    b: "wallis-product",
    note: "Sine product's own worked example derives Wallis' entire product in one line by substituting x=\\tfrac12 into the sine-product identity — a genuine alternate derivation of the same result, not merely a passing resemblance.",
  },
];

// ── lookups ────────────────────────────────────────────────────────────────────────────────────

const FAMILY_BY_TECHNIQUE = new Map<TechniqueId, TechniqueFamily>();
for (const family of TECHNIQUE_FAMILIES) {
  for (const member of family.members) {
    FAMILY_BY_TECHNIQUE.set(member.id, family);
  }
}

const STANDALONE_BY_ID = new Map<TechniqueId, StandaloneTechnique>(
  STANDALONE_TECHNIQUES.map((s) => [s.id, s]),
);

/** The family a technique belongs to, or undefined if it's standalone (see STANDALONE_TECHNIQUES). */
export function familyOf(id: TechniqueId): TechniqueFamily | undefined {
  return FAMILY_BY_TECHNIQUE.get(id);
}

export function standaloneNoteFor(id: TechniqueId): string | undefined {
  return STANDALONE_BY_ID.get(id)?.note;
}

/** The technique's family siblings — the other members of its family, or [] if it has none. */
export function siblingsOf(id: TechniqueId): TechniqueId[] {
  const family = FAMILY_BY_TECHNIQUE.get(id);
  return family ? family.members.filter((m) => m.id !== id).map((m) => m.id) : [];
}

/** The other end of every CROSS_LINKS entry touching `id`. */
export function crossLinksFor(id: TechniqueId): TechniqueId[] {
  return CROSS_LINKS.filter((l) => l.a === id || l.b === id).map((l) => (l.a === id ? l.b : l.a));
}

/**
 * Confusable techniques for `id`: family siblings first, then cross-linked techniques, deduplicated.
 * This is the pool recognition.ts draws "same family" distractors from — a realistic test of
 * discrimination, since these are the techniques a student would actually mix `id` up with, not an
 * arbitrary pair from the curriculum. Empty for a technique with neither (floor-function, today).
 */
export function confusablesFor(id: TechniqueId): TechniqueId[] {
  return [...new Set([...siblingsOf(id), ...crossLinksFor(id)])];
}
