/**
 * Coverage battery: representative concepts spanning the app's whole scope
 * (HS -> undergrad, maths + physics), phrased as the EXACT <scene-request>
 * bodies the tutor emits in production (concept/show/manipulate/form).
 *
 * Selection is deliberately adversarial, not a highlight reel:
 *  - every suspected primitive-language gap gets probes (connectors/edges,
 *    region fill, live-count families, number line, bar charts);
 *  - non-spatial concepts test the Director's restraint (simplest honest
 *    scene, not a decorative fake);
 *  - a few TERSE requests simulate a lazy tutor turn — the Director must
 *    reason form/manipulation out itself;
 *  - happy-path forms (construction/lattice/graph/transform/field) keep a
 *    baseline so regressions show up too.
 *
 * This battery is the standing diagnostic for ANY scene-quality claim.
 * Add concepts freely; never remove a failing one to make a run look good.
 */

export interface BatteryConcept {
  id: string;
  level: "GCSE" | "A-level" | "Further/STEP" | "Undergrad";
  domain: string;
  subject: "maths" | "physics";
  topic: string;
  subtopic: string;
  /** which suspected framework gap this probes, if any */
  gapProbe?: string;
  /** the tutor's <scene-request> body, production format */
  request: string;
}

export const BATTERY: BatteryConcept[] = [
  // ---------- GCSE ----------
  {
    id: "gcse-same-segment",
    level: "GCSE",
    domain: "geometry",
    subject: "maths",
    topic: "Circle Theorems",
    subtopic: "Angles in the same segment",
    request: `concept: angles subtended by the same chord in the same segment are equal
show: two inscribed angles standing on the same chord AB, both visibly equal, and why the central angle forces both
manipulate: drag either inscribed vertex along its arc — both angles hold the same value while the vertex moves
form: construction`,
  },
  {
    id: "gcse-completing-square",
    level: "GCSE",
    domain: "algebra",
    subject: "maths",
    topic: "Quadratics",
    subtopic: "Completing the square",
    gapProbe: "region-fill (area rearrangement)",
    request: `concept: completing the square is literally completing a square — x^2 + bx rearranged as a square with a missing corner
show: an x-by-x square plus a b-by-x rectangle split in half and folded around the square, leaving a missing (b/2)^2 corner
manipulate: a slider for b — watch the rectangles fold and the missing corner grow as (b/2)^2
form: construction`,
  },
  {
    id: "gcse-speed-time-area",
    level: "GCSE",
    domain: "kinematics",
    subject: "physics",
    topic: "Motion Graphs",
    subtopic: "Area under a speed-time graph is distance",
    gapProbe: "region-fill",
    request: `concept: the area under a speed-time graph IS the distance travelled
show: a speed-time curve with the region beneath it visibly filled, and the filled area growing as time advances
manipulate: a slider for elapsed time T — the shaded region sweeps out and a distance readout grows with it
form: graph`,
  },
  {
    id: "gcse-similar-triangles",
    level: "GCSE",
    domain: "geometry",
    subject: "maths",
    topic: "Similarity",
    subtopic: "Similar triangles and scale factor",
    request: `concept: enlargement preserves angles and multiplies every length by the same scale factor
show: a triangle and its enlargement from a centre point, corresponding sides parallel, angles identical
manipulate: a slider for scale factor k (including k<1) — sides stretch together, angles never change
form: transform`,
  },
  // ---------- A-level ----------
  {
    id: "alevel-unit-circle-sine",
    level: "A-level",
    domain: "trigonometry",
    subject: "maths",
    topic: "Trigonometric Functions",
    subtopic: "The sine curve unwrapped from the unit circle",
    request: `concept: sin(θ) is the height of a point walking round the unit circle — the wave is the circle unrolled
show: a point on the unit circle and the sine curve being traced simultaneously, the height visibly shared
manipulate: drag the point round the circle (or slide θ) — watch the same height appear on the curve at x=θ
form: animated`,
  },
  {
    id: "alevel-integral-area",
    level: "A-level",
    domain: "calculus",
    subject: "maths",
    topic: "Integration",
    subtopic: "The definite integral as a limit of sums",
    gapProbe: "live-count + region-fill (Riemann)",
    request: `concept: the definite integral as the limit of rectangle sums — area captured by an ever-finer staircase
show: rectangles under y=x^2 on [0,2] whose total area approaches the true area as their number grows
manipulate: a slider for the number of rectangles n — the staircase hugs the curve and the rectangle-area total converges to 8/3
form: graph`,
  },
  {
    id: "alevel-binomial-dist",
    level: "A-level",
    domain: "statistics",
    subject: "maths",
    topic: "Probability Distributions",
    subtopic: "Shape of the binomial distribution",
    gapProbe: "bar-chart",
    request: `concept: the binomial distribution B(n,p) — how its shape shifts and narrows as n and p change
show: the probabilities P(X=k) for k=0..n displayed as a distribution, its peak near np
manipulate: sliders for n and p — the distribution slides and reshapes, the peak tracking np
form: lattice`,
  },
  {
    id: "alevel-geometric-series",
    level: "A-level",
    domain: "sequences",
    subject: "maths",
    topic: "Series",
    subtopic: "Convergence of a geometric series",
    gapProbe: "live-count + number-line",
    request: `concept: a geometric series with |r|<1 converges — the partial sums pile up against a wall at a/(1-r)
show: successive partial sums accumulating on a number line, the jumps shrinking geometrically, never passing the limit
manipulate: a slider for r between -0.95 and 0.95 — watch the pile-up point move to a/(1-r), and diverge as |r| approaches 1
form: graph`,
  },
  {
    id: "alevel-dot-product",
    level: "A-level",
    domain: "vectors",
    subject: "maths",
    topic: "Vectors",
    subtopic: "Dot product as projection",
    request: `concept: a·b measures how much of a lies along b — projection times length
show: vector a, vector b, the shadow of a dropped perpendicularly onto b, and a·b tracking that shadow's length times |b|
manipulate: drag the tip of a — the shadow and the dot-product value change together, hitting 0 exactly at 90°
form: graph`,
  },
  {
    id: "alevel-projectile",
    level: "A-level",
    domain: "mechanics",
    subject: "physics",
    topic: "Projectile Motion",
    subtopic: "Independence of horizontal and vertical motion",
    request: `concept: projectile motion is two independent motions — constant-velocity horizontal, constant-acceleration vertical
show: a projectile arcing while its shadow on the x-axis moves uniformly and its shadow on the y-axis decelerates, stops, falls
manipulate: play/pause time; a slider for launch angle — the horizontal shadow NEVER changes rhythm regardless of angle
form: animated`,
  },
  {
    id: "alevel-shm-circle",
    level: "A-level",
    domain: "mechanics",
    subject: "physics",
    topic: "Simple Harmonic Motion",
    subtopic: "SHM as the shadow of circular motion",
    request: `concept: SHM is uniform circular motion seen edge-on — the projection of a rotating point
show: a point rotating uniformly on a circle and its horizontal shadow oscillating on a line below, connected visibly
manipulate: time plays continuously; a slider for angular speed ω — the shadow's oscillation speeds up in lockstep
form: animated`,
  },
  {
    id: "alevel-chain-rule",
    level: "A-level",
    domain: "calculus",
    subject: "maths",
    topic: "Differentiation",
    subtopic: "The chain rule as multiplied rates",
    gapProbe: "connector (function composition)",
    request: `concept: the chain rule — rates multiply through a composition: if y changes 3× faster than u, and u changes 2× faster than x, y changes 6× faster than x
show: the pipeline x → u=g(x) → y=f(u) with a small nudge dx amplified through each stage
manipulate: a slider nudging x — watch the nudge pass through both stages, each stage scaling it by its own local slope
form: graph`,
  },
  {
    id: "alevel-radian",
    level: "A-level",
    domain: "trigonometry",
    subject: "maths",
    topic: "Radians",
    subtopic: "Definition of the radian",
    request: `concept: one radian is the angle whose arc length equals the radius
show: a circle with an arc being laid along it whose length equals r, the resulting angle marked
manipulate: a slider for the angle θ — the arc length reads θ·r, exactly θ radii laid along the rim
form: construction`,
  },
  // ---------- Further / STEP ----------
  {
    id: "further-roots-unity",
    level: "Further/STEP",
    domain: "complex",
    subject: "maths",
    topic: "Complex Numbers",
    subtopic: "nth roots of unity",
    gapProbe: "live-count (n changes how many points exist)",
    request: `concept: the n solutions of z^n = 1 sit at the vertices of a regular n-gon on the unit circle
show: the unit circle in the Argand plane with the n roots equally spaced, one at 1, spacing angle 2π/n
manipulate: a slider for n from 2 to 12 — the polygon reshapes, always regular, always one vertex at 1
form: argand`,
  },
  {
    id: "further-det-area",
    level: "Further/STEP",
    domain: "linear-algebra",
    subject: "maths",
    topic: "Matrices",
    subtopic: "Determinant as area scale factor",
    request: `concept: det(M) is the factor by which M scales area — negative when orientation flips
show: the unit square and its image parallelogram under M, with the area ratio displayed
manipulate: sliders for the matrix entries a,b,c,d — the parallelogram deforms and the area readout tracks ad-bc, flipping sign when the square turns over
form: transform`,
  },
  {
    id: "further-complex-loci",
    level: "Further/STEP",
    domain: "complex",
    subject: "maths",
    topic: "Complex Numbers",
    subtopic: "The locus |z - a| = r",
    request: `concept: |z - a| = r describes a circle — all points at distance r from the fixed point a
show: the fixed point a in the Argand plane, a point z with the distance |z-a| drawn, tracing the circle when the distance is held at r
manipulate: drag z — watch |z-a| change; the accent circle is exactly where it equals r
form: argand`,
  },
  {
    id: "further-induction",
    level: "Further/STEP",
    domain: "proof",
    subject: "maths",
    topic: "Proof",
    subtopic: "Proof by induction",
    gapProbe: "number-line / restraint (semi-spatial concept)",
    request: `concept: induction — a base case plus "each case forces the next" knocks over every natural number like dominoes
show: the naturals as a chain where P(1) lights up and each lit case lights its successor
manipulate: a slider for how many implication steps have fired — watch truth propagate down the chain, and see it stall if the base case is removed
form: lattice`,
  },
  {
    id: "step-epsilon-delta",
    level: "Further/STEP",
    domain: "analysis",
    subject: "maths",
    topic: "Limits",
    subtopic: "The ε-δ definition of a limit",
    request: `concept: lim f(x)=L means: for ANY ε-tolerance around L, some δ-window around a keeps f inside it
show: a curve with a horizontal ε-band around L and a vertical δ-window around a, the curve's image trapped in the band
manipulate: a slider for ε — shrink it and watch the δ-window shrink in response, the trap always achievable
form: graph`,
  },
  // ---------- Undergrad ----------
  {
    id: "ug-taylor",
    level: "Undergrad",
    domain: "analysis",
    subject: "maths",
    topic: "Taylor Series",
    subtopic: "Taylor polynomials converging to sin(x)",
    gapProbe: "live-count (degree changes the object)",
    request: `concept: Taylor polynomials of sin(x) — each added term extends the region where the polynomial hugs the curve
show: sin(x) with its Taylor polynomial overlaid, matching perfectly near 0 and peeling away further out
manipulate: a slider for the polynomial degree — each step visibly extends the hugging region outward
form: graph`,
  },
  {
    id: "ug-eigen",
    level: "Undergrad",
    domain: "linear-algebra",
    subject: "maths",
    topic: "Eigenvectors",
    subtopic: "Eigenvectors as invariant directions",
    request: `concept: an eigenvector's direction survives the transformation — everything else gets rotated off its line
show: a field of unit vectors being hit by matrix M, all knocked off their spans except the eigendirections, which only stretch
manipulate: drag a probe vector around the origin — watch its image leave its span except along two special lines
form: transform`,
  },
  {
    id: "ug-cayley",
    level: "Undergrad",
    domain: "group-theory",
    subject: "maths",
    topic: "Group Theory",
    subtopic: "The symmetries of a square compose into a group",
    gapProbe: "connector (composition structure)",
    request: `concept: the 8 symmetries of a square close under composition — doing one then another always lands on a third
show: a labelled square being acted on by rotations/reflections, and the composition of two symmetries visibly equalling a single third one
manipulate: pick (slide) which two symmetries to compose — watch the square move twice, then verify one single symmetry does the same job
form: transform`,
  },
  {
    id: "ug-graph-handshake",
    level: "Undergrad",
    domain: "graph-theory",
    subject: "maths",
    topic: "Graph Theory",
    subtopic: "The handshake lemma",
    gapProbe: "connector (edges between nodes)",
    request: `concept: the sum of all vertex degrees is exactly twice the number of edges — every edge donates two endpoint-touches
show: a small graph where each edge visibly contributes 1 to the degree of each endpoint, with Σdeg and 2E displayed equal
manipulate: a slider adding edges one at a time — Σdeg jumps by exactly 2 with every added edge
form: lattice`,
  },
  {
    id: "ug-markov",
    level: "Undergrad",
    domain: "probability",
    subject: "maths",
    topic: "Markov Chains",
    subtopic: "Convergence to a steady state",
    gapProbe: "connector (weighted transitions between states)",
    request: `concept: a Markov chain forgets its start — repeated transitions drive any initial distribution to the same steady state
show: two or three states with transition weights, and a probability mass redistributing itself each step toward the stationary distribution
manipulate: a slider for the number of steps taken, plus the starting state — different starts, same destination
form: lattice`,
  },
  {
    id: "ug-div-curl",
    level: "Undergrad",
    domain: "vector-calculus",
    subject: "maths",
    topic: "Vector Calculus",
    subtopic: "Divergence vs curl",
    request: `concept: divergence measures outflow from a point, curl measures rotation around it — a field can have either, both, or neither
show: a vector field morphing between a pure source (div>0, curl=0) and a pure vortex (div=0, curl≠0)
manipulate: a slider blending the field from source to vortex — watch arrows switch from radiating to circulating
form: field-3d`,
  },
  {
    id: "ug-gauss-law",
    level: "Undergrad",
    domain: "electromagnetism",
    subject: "physics",
    topic: "Electrostatics",
    subtopic: "Gauss's law — flux depends only on enclosed charge",
    request: `concept: the total electric flux through a closed surface depends only on the charge inside — not the surface's size or shape
show: a point charge with its radial field and a surrounding closed surface; the flux count staying fixed as the surface changes
manipulate: a slider for the surface's radius — field arrows weaken as 1/r² exactly while the area grows as r², flux constant
form: field-3d`,
  },
  {
    id: "ug-normal-area",
    level: "Undergrad",
    domain: "probability",
    subject: "maths",
    topic: "Continuous Distributions",
    subtopic: "Probability as area under the pdf",
    gapProbe: "region-fill",
    request: `concept: for a continuous variable, probability IS area — P(a<X<b) is the area under the density between a and b
show: the normal pdf with the region between a and b filled, its area equal to the probability
manipulate: drag the boundaries a and b — the filled region and its area readout change together; the total area is always 1
form: graph`,
  },
  {
    id: "ug-fourier",
    level: "Undergrad",
    domain: "analysis",
    subject: "maths",
    topic: "Fourier Series",
    subtopic: "Building a square wave from sines",
    gapProbe: "live-count (number of terms)",
    request: `concept: a square wave is an infinite recipe of odd sine harmonics — each added term sharpens the corners
show: the square wave target and the partial Fourier sum overlaid, wiggling less and hugging tighter as terms are added
manipulate: a slider for the number of harmonics — watch the sum converge, and the stubborn Gibbs overshoot at the jumps refuse to shrink
form: graph`,
  },
  {
    id: "ug-interference",
    level: "Undergrad",
    domain: "waves",
    subject: "physics",
    topic: "Interference",
    subtopic: "Two-source interference and path difference",
    request: `concept: two coherent sources interfere — constructive where the path difference is a whole wavelength, destructive at half
show: circular wavefronts from two sources, with the loud/quiet fringe directions emerging where crests meet crests or crests meet troughs
manipulate: a slider for the source separation d — watch the fringe directions squeeze together as d grows
form: animated`,
  },
  // ---------- restraint probes (non-spatial — the Director must NOT fake a scene) ----------
  {
    id: "restraint-nec-suff",
    level: "A-level",
    domain: "logic",
    subject: "maths",
    topic: "Logic & Proof",
    subtopic: "Necessary vs sufficient conditions",
    gapProbe: "restraint (non-spatial)",
    request: `concept: sufficient means guarantees, necessary means required — "rain ⇒ clouds" makes rain sufficient for clouds and clouds necessary for rain
show: whatever minimal honest picture anchors the asymmetry — do not force a graph
manipulate: something small that tests the asymmetry, if anything genuinely helps
form: lattice`,
  },
  {
    id: "restraint-sigma-notation",
    level: "A-level",
    domain: "notation",
    subject: "maths",
    topic: "Sequences and Series",
    subtopic: "Sigma notation",
    gapProbe: "restraint (pure notation)",
    request: `concept: Σ notation is just a compact for-loop: Σ_{k=1}^{n} means "add up the terms as k runs 1 to n"
show: the notation unpacked against the actual sum it abbreviates
manipulate: minimal — only if it genuinely helps
form: lattice`,
  },
  // ---------- terse probes (lazy tutor request — Director must reason it out) ----------
  {
    id: "terse-modulo",
    level: "Undergrad",
    domain: "number-theory",
    subject: "maths",
    topic: "Modular Arithmetic",
    subtopic: "Why congruence mod m partitions the integers",
    request: `concept: congruence mod m splits all integers into exactly m classes`,
  },
  {
    id: "terse-optimisation",
    level: "A-level",
    domain: "calculus",
    subject: "maths",
    topic: "Differentiation",
    subtopic: "Optimisation — why f'(x)=0 at a maximum",
    request: `concept: at a smooth maximum the derivative must be zero`,
  },
];
