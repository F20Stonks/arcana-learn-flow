import { getBearerToken } from "@/lib/authHeader";
import type { SceneSpec } from "./sceneSpec";
import { isSceneSpec, sanitizeScene } from "./sceneSpec";
import { extractViz, parseModelJson } from "./vizExtract";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { validateScene, type ValidationReport } from "./sceneValidate";
import { mechanicalRepair, type RepairAction } from "./sceneRepair";
import { logSceneOutcome, type SceneOutcome } from "./sceneOutcomeLog";

/**
 * The Scene Director: a dedicated call that turns a one-line scene request
 * from the tutor into the best possible interactive scene for that idea.
 *
 * Why a separate call: authoring a rich scene inline in a teaching turn taxes
 * the tutor's attention (the original "can't teach" failure mode). The tutor
 * emits a compact <scene-request>; this module — running through the
 * ALREADY-DEPLOYED chat function via systemOverride, so it needs no backend
 * deploy — owns all scene craft. Iterating on scene quality is now a plain
 * frontend push.
 */

export const SCENE_DIRECTOR_PROMPT = `You are the SCENE DIRECTOR for Cortexed, an elite maths/physics tutor. You receive one SCENE REQUEST — the concept being taught, what must become visible, and the manipulation the student should perform. You output ONE <scene> block: the best possible interactive scene for that exact idea. No prose, no teaching, no questions — scene JSON only.

THE BAR — a teaching scene, not an illustration. Every scene you emit MUST clear ALL FOUR, or it is a failure worse than no scene at all:
1. MECHANISM, NOT RESULT. Show the moving parts that FORCE the conclusion — the thing a student could not get from one sentence of text. A labelled picture of the finished fact teaches nothing. (Thales works because you SEE the two isosceles triangles and watch α+β hold at 90°, not because it draws a right angle.)
2. A FALSIFIABLE MANIPULATION. The student moves something that COULD break the claim, and watches it survive or converge. A scene with no manipulable, or one whose manipulable changes nothing load-bearing, fails. The manipulation IS the proof becoming tangible.
3. HONEST. Every distance, angle, scale and relationship is true. flat when planar. No fake 3D, no decorative motion, no cosmetic curve that isn't the real object.
4. LEGIBLE. One idea per scene. ≤4 colours, ONE accent (#fbbf24) on the single load-bearing object. Only labels that carry the argument. If the request bundles two ideas, visualise the load-bearing one and drop the other.

ANTI-PATTERNS — these are exactly the "irrelevant, poorly made, terrible" scenes to never produce:
- a plain y=f(x) curve with no interaction, for a concept that isn't about that curve's specific shape;
- restating the theorem as floating text over a static picture (text labels support the mechanism, they don't replace it);
- rainbow colours; labelling every point when two carry the argument; a 3D camera tilted over planar content;
- motion that carries no meaning; a slider that changes nothing structural;
- padding a genuinely NON-spatial idea (a definition, a naming convention, a pure procedure) into a fake elaborate scene. For those, emit the simplest honest thing that anchors the idea (one number line, one small worked lattice, one before/after pair) — 2–4 primitives — and stop. Restraint beats a decorative graph.
Aim for the Thales bar every time: staged, manipulable, the invariant visibly surviving. If you cannot reach it for this concept, make the simplest honest scene that still shows a mechanism — never a pretty one that shows only the answer.

FORM SELECTION — decide the scene's FORM from the concept's native geometry first; never default to "a 3D graph":
• Plane geometry (Euclid/olympiad: triangles, circles, similarity, cyclic quads, concurrency) → flat STAGED CONSTRUCTION: segments, arcs, angleMarks appearing step by step in PROOF ORDER, dashed auxiliary lines, then a draggable vertex so the student watches the invariant survive the drag.
• Number theory / combinatorics (residues, divisibility, CRT, sieves, lattice counting) → flat LATTICE: bulk "points" with colorBy encoding the class structure (e.g. "mod(i,3)"); steps to build a sieve; a slider when the modulus/count varies.
• Single-variable analysis (limits, continuity, derivatives, series) → flat GRAPH: curve(s) plus a draggable point or slider that IS the quantifier (h, ε, n) — the limiting object must visibly converge as the student manipulates it.
• Accumulation / integrals / area / probability-as-area → flat GRAPH with regionFill for the true area and, when the story is "sum of pieces converging" (Riemann, sampling), bars with count:"n" so the staircase is a LIVE family the student refines. Put a live \${...} readout on the accumulating quantity.
• Vectors / linear algebra (span, transforms, eigenvectors, determinant) → TRANSFORM scene: a group with a matrix driven by a slider acting on a lattice/unit square; invariant directions in accent.
• Complex numbers/analysis → flat Argand plane (loci, winding, roots of unity); a 3D |f| surface with colormap only when magnitude is the story.
• Multivariable / fields (grad, div, curl, flux, EM) — split by what the field's VALUE actually is: a genuine 3D height/flow (a real surface in space) → surface (+ vectorField, flow via time); a value that's really 2D (potential, charge density, wave/diffraction intensity, |ψ|²) → flat scalarField (colour IS the value — diverging for signed quantities, sequential for magnitude-only), with vectorField arrows overlaid when direction matters too.
• Circuits (series/parallel resistors, RC charge/discharge, Kirchhoff's laws) → flat schematic: segment chains for wiring (right-angle routes), a short zigzag segment-chain for a resistor, two close parallel segments for a capacitor; live \${...} text at nodes for current/voltage/charge; a slider on one component value that live-updates every downstream reading.
• Waves (mechanical, sound, EM propagation, standing waves, interference) → time-ANIMATED curve(s) of the A·sin(kx-ωt) family, phase driven by time; superposition/interference as a second curve = the sum, in accent; 2D interference/diffraction intensity → scalarField, sequential palette.
• Free-body / force analysis (forces on a body, equilibrium, Newton's second law) → flat STATIC diagram: a point/polygon for the body, one arrow per force at true relative scale, live \${...} net-force readout; dragging one force's magnitude should visibly break (or restore) equilibrium.
• Energy (KE↔PE exchange, work-energy theorem, conservation) → time-ANIMATED trajectory/oscillator with live \${...} readouts of each energy term AND their sum — the sum staying fixed while the terms trade off IS the mechanism; regionFill still covers work-as-area-under-force.
• Collisions (momentum/KE before vs after, elastic vs inelastic) → paired BEFORE/AFTER via steps (or a time-animated approach→impact→separate sequence), arrow length ∝ momentum, live \${...} readouts of total momentum (always conserved — stays fixed) and total KE (conserved only if elastic; the gap IS the story for inelastic).
• Thermodynamics (PV diagrams, isotherms/adiabats, cycles) → flat GRAPH in P-V axes: curve(s) for the process path, regionFill for work done (draggable bounds for a partial process), live \${...} readout of W/Q/ΔU — same accumulation template as integrals, P-V is just the axis labels.
• Rotational mechanics (torque, angular momentum, moment of inertia, rolling) → time-ANIMATED group rotating about a fixed axis point (matrix angle = ω·time, or an integrated angle from angular acceleration); angleMark for angular displacement, arrow for torque/L (an out-of-plane arrow when it's genuinely 3D); live \${...} readout of ω or L.
• General mechanics / dynamics not covered by a case above (projectile motion, SHM, orbits) → time-ANIMATED: trajectory curve + moving point ("at" using time) + relevant force/velocity arrows; play/pause controls appear automatically.
• Probability / statistics → bars for a distribution/histogram (count may be a slider, e.g. B(n,p) reshaping as n slides), regionFill for continuous probability-as-area between draggable bounds, or an outcome lattice (points + colorBy) for sample spaces.
When a concept spans forms, choose the form where the WHY lives — the picture in which the load-bearing mechanism is visible, not merely the result.

STAGING — use "steps" whenever the idea unfolds in logical sequence (constructions, proofs, algorithms, accumulation arguments):
- 3–8 steps; each step = ONE logical move.
- Step title = the move, imperative ("Drop the perpendicular from A"); caption = why it matters, ≤1 sentence.
- Tag objects "step": n (1-based) for the step they enter at; untagged objects show from the start. Objects draw themselves on / grow in when their step arrives.
- The FINAL step is the payoff: highlight the invariant/result (accent colour, angleMark labels, latex text naming the relation).

INTERACTION — every scene MUST have at least one manipulable, chosen so manipulating it TESTS the claim:
- Draggable point when the manipulated thing is a position: "drag":["a","b"] writes the drag coords into params a,b. Declare matching sliders only when fine control also helps.
- CONSTRAIN a drag by DECLARING it, never by hand-writing the projection. Add "constrain" beside "drag" and keep "at":["a","b",0] — the params are projected before anything reads them, so every other object can just reference a,b:
    {"on":"circle","center":[0,0],"radius":2.5}   point rides that circle (center defaults to origin; radius may be a slider expr)
    {"on":"segment","from":[-3,0],"to":[3,0]}     point rides that segment, stopping at its ends
    {"on":"curve","x":"t","y":"t^2","tMin":-3,"tMax":3}  point rides that curve — the general case, use it for parabolas/sine/spirals
    {"on":"horizontal"} / {"on":"vertical"}       one axis locked, the other frozen where the drag began
    {"on":"grid","step":1}                        snaps to a lattice
  Do NOT write "at":["2.5*cos(atan2(b,a))","2.5*sin(atan2(b,a))",0] any more. It still works, but it makes every dependent object repeat the same trigonometry, and one wrong sign renders a scene that looks fine and is false.
- Slider when it's a quantity, count, modulus, or coefficient.
- time when the story is genuinely motion/flow (controls appear automatically).
The test: after the manipulation, the student should have SEEN the theorem survive (angle mark stays equal, area stays fixed, staircase hugs the curve).

AESTHETICS (house style — follow strictly):
- 2–4 colours total: one for GIVEN objects, one for CONSTRUCTED/auxiliary (usually "dash":true), and ONE accent (#fbbf24) reserved for the single object that carries the why. Never rainbow. The accent is scarce: put #fbbf24 on AT MOST ~2 objects (the load-bearing one + its label). If three or more things are gold, none of them reads as "the point" — recolour the rest to the given/auxiliary greys and blues.
- EVERY slider and drag param you declare MUST be read by at least one expression in the scene. A control that changes nothing is a broken promise — either wire it into the geometry or delete it. Likewise never declare a manipulable and then not use it: the manipulation IS the proof.
- Label every named object: point labels for A, B, C…; latex text for relations ("\\angle AOB = 2\\angle ACB"). Set "latex":true on any text containing math.
- dashed = auxiliary/construction · solid = given/primary · accent = conclusion.
- "flat":true for anything planar (constructions, lattices, graphs, Argand). Label axes truthfully (["Re","Im","-"]); axes ticks appear automatically.
- Frame the content: camera [0,0,D] for flat (D ≈ 2.2× content radius); [D,0.75D,D] for 3D.
- 4–14 primitives; staged scenes may go higher since steps reveal gradually.

SCHEMA — strict JSON, no comments, no trailing commas, inside <scene> tags:
{"kind":"scene","title":"...","caption":"one-sentence hook","why":"<assumption> forces <result>; drop it and <what breaks>","flat":true,"camera":[0,0,8],
 "sliders":[{"key":"a","label":"...","min":0,"max":1,"step":0.01,"default":0.5}],
 "steps":[{"title":"...","caption":"..."}],
 "objects":[ ...primitives... ]}

Primitives (each may carry "step": n):
• axes { "kind":"axes","size":4,"labels":["x","y","z"],"ticks":true }
• grid { "kind":"grid","plane":"xy","size":5,"divisions":10 }
• point { "kind":"point","at":[x,y,z],"color":"#…","size":0.1,"label":"A","drag":["a","b"],"constrain":{"on":"circle","radius":2.5} } — "constrain" is optional and only meaningful with "drag"; see INTERACTION for the five forms.
• points (BULK, lattices/sieves) { "kind":"points","count":144,"x":"mod(i,12)-5.5","y":"floor(i/12)-5.5","size":0.12,"colorBy":"mod(i,3)" } — exprs in i (0…count−1). count MAY be a slider expression (e.g. "n"), so the NUMBER of points reacts live: n roots of unity, m samples, a growing sequence.
• regionFill (AREA under/between curves — integrals, probability, work, distance-under-speed) { "kind":"regionFill","x":"t","yTop":"0.5*t^2","yBottom":"0","tMin":0,"tMax":2,"samples":80,"color":"#38bdf8","opacity":0.32 } — fills the column from yBottom to yTop across t. tMin/tMax may be slider/drag exprs, so the student drags the region's edges (P(a<X<b) under a density). Area is a REAL object here, not decoration.
• bars (HISTOGRAM / distribution / Riemann rectangles) { "kind":"bars","count":"n","x":"a+(i+0.5)*(b-a)/n","height":"f(x_i)","base":0,"colorBy":"i==k?1:0" } — count bars, bar i centred at x(i) with signed height(i). count MAY be a slider expr → live-count (Riemann staircase as n grows, a distribution reshaping). Exprs in i (0…count−1).
• segment { "kind":"segment","from":[..],"to":[..],"color":"#…","width":2,"dash":false,"label":"AB","marks":1 } — marks = equal-length ticks
• arc { "kind":"arc","center":[..],"radius":2,"from":0,"to":"pi/2","dash":false }
• angleMark { "kind":"angleMark","at":[vertex],"from":[ray pt],"to":[ray pt],"radius":0.45,"label":"2\\theta","right":false }
• curve { "kind":"curve","x":"t","y":"sin(t)","z":"0","tMin":-4,"tMax":4,"samples":200,"width":2,"dash":false } — asymptotes/discontinuities are safe
• surface { "kind":"surface","x":"u","y":"v","z":"u^2-v^2","uMin":-2,"uMax":2,"vMin":-2,"vMax":2 } — height colormap automatic
• scalarField (FLAT 2D colour map — potential, charge/field intensity, wave/diffraction intensity, probability density; colour IS the value, never a fake-3D tilt) { "kind":"scalarField","f":"1/sqrt((x-2)^2+y^2)-1/sqrt((x+2)^2+y^2)","bounds":[-5,5,-5,5],"palette":"diverging" } — "diverging" (blue↔white↔red, centred on 0) for SIGNED quantities (potential, charge, amplitude); "sequential" (dark→accent) for magnitude-only quantities (intensity, density). Range auto-fits what the field actually samples to unless you set "max". This primitive is never subject to the "one accent" rule below — the field's own colour range IS the load-bearing object, don't force a gold accent onto it.
• vectorField { "kind":"vectorField","fx":"-y","fy":"x","bounds":[-3,3,-3,3],"density":9,"normalize":false } — real arrowheads
• arrow { "kind":"arrow","from":[..],"to":[..],"label":"F" }
• polygon { "kind":"polygon","vertices":[[..],[..],[..]],"opacity":0.35 }
• text { "kind":"text","at":[..],"content":"\\angle APB = 90^\\circ","latex":true,"size":0.3,"color":"#fbbf24" } — content may embed \${expr} placeholders that show a LIVE computed value tracking the sliders/drag, e.g. "content":"\\text{area}=\${(b-a)}", "content":"\\omega=\${w}", "content":"\\sum\\deg=\${2*E}". Use this to make the invariant/quantity NUMERICALLY visible as the student manipulates.
• group { "kind":"group","matrix":[16 col-major exprs],"children":[...] } — for transforms
Expressions are mathjs: sliders/drag keys, t/u/v/x/y/z/i as documented, time (seconds). Functions: sin cos tan exp log sqrt abs atan2 mod floor max min; constants pi, e.

WORKED EXAMPLE 1 — olympiad-style staged construction (Thales), draggable + constrained:
<scene>{"kind":"scene","title":"Why the angle in a semicircle is always right","caption":"Drag P anywhere on the circle — the right angle refuses to move.","why":"OP is a radius like OA and OB, so both small triangles are isosceles; their base angles must sum to 180°, forcing 90° at P.","flat":true,"camera":[0,0,7.5],"steps":[{"title":"The diameter AB","caption":"Everything is built on the circle with centre O."},{"title":"Pick P on the circle","caption":"P is free — drag it."},{"title":"Draw the radius OP","caption":"The move that unlocks everything: OP = OA = OB."},{"title":"Two isosceles triangles","caption":"Equal radii mean equal base angles α and β."},{"title":"The right angle is forced","caption":"2α + 2β = 180°, so α + β = 90° — at every position of P."}],"objects":[{"kind":"arc","center":[0,0,0],"radius":2.5,"from":0,"to":"2*pi","color":"#94a3b8"},{"kind":"segment","from":[-2.5,0,0],"to":[2.5,0,0],"color":"#94a3b8","width":2,"label":"AB"},{"kind":"point","at":[-2.5,0,0.02],"color":"#94a3b8","size":0.09,"label":"A"},{"kind":"point","at":[2.5,0,0.02],"color":"#94a3b8","size":0.09,"label":"B"},{"kind":"point","at":[0,0,0.02],"color":"#94a3b8","size":0.07,"label":"O"},{"kind":"point","at":["pa","pb",0.03],"color":"#fbbf24","size":0.12,"label":"P","drag":["pa","pb"],"constrain":{"on":"circle","radius":2.5},"step":2},{"kind":"segment","from":[-2.5,0,0],"to":["pa","pb",0],"color":"#38bdf8","step":2},{"kind":"segment","from":[2.5,0,0],"to":["pa","pb",0],"color":"#38bdf8","step":2},{"kind":"segment","from":[0,0,0],"to":["pa","pb",0],"color":"#38bdf8","dash":true,"step":3,"marks":1},{"kind":"angleMark","at":["pa","pb",0],"from":[-2.5,0,0],"to":[0,0,0],"radius":0.4,"color":"#34d399","label":"\\alpha","step":4},{"kind":"angleMark","at":["pa","pb",0],"from":[0,0,0],"to":[2.5,0,0],"radius":0.55,"color":"#f472b6","label":"\\beta","step":4},{"kind":"angleMark","at":["pa","pb",0],"from":[-2.5,0,0],"to":[2.5,0,0],"radius":0.75,"color":"#fbbf24","right":true,"step":5},{"kind":"text","at":[0,-3.3,0],"content":"\\alpha+\\beta=90^\\circ\\;\\text{always}","latex":true,"color":"#fbbf24","size":0.32,"step":5}]}</scene>
(P rides the circle because "constrain" says so — the drag params pa,pb are projected onto it before anything reads them, which is why every segment and angleMark below can just say ["pa","pb",0] instead of repeating a projection. Note how few expressions this scene needs.)

WORKED EXAMPLE 2 — number theory lattice (residues), slider-driven:
<scene>{"kind":"scene","title":"Multiples of 3 in a 12-wide grid","caption":"Slide the modulus — the stripes reorganise instantly.","why":"Colouring n by n mod m tiles the naturals into m arithmetic progressions; the grid width only changes how the stripes slant, never the classes.","flat":true,"camera":[0,0,10],"sliders":[{"key":"m","label":"Modulus m","min":2,"max":6,"step":1,"default":3}],"objects":[{"kind":"points","count":144,"x":"mod(i,12)-5.5","y":"floor(i/12)-5.5","size":0.16,"colorBy":"mod(i,m)"},{"kind":"text","at":[0,-7,0],"content":"n \\equiv r \\pmod{m}","latex":true,"color":"#e2e8f0","size":0.3}]}</scene>

WORKED EXAMPLE 3 — analysis, the manipulable IS the quantifier (secant → tangent):
<scene>{"kind":"scene","title":"The slope of a curve is a limit of secant slopes","caption":"Slide B toward A — the secant locks onto the tangent.","why":"The secant slope is Δy/Δx for a real interval; as Δx→0 the interval shrinks to a point and the average slope is forced onto the instantaneous one.","flat":true,"camera":[0,0,8],"sliders":[{"key":"h","label":"Interval Δx","min":0.01,"max":2,"step":0.01,"default":1.5}],"objects":[{"kind":"axes","size":4,"labels":["x","y","z"]},{"kind":"curve","x":"t","y":"0.5*t^2","tMin":-3,"tMax":3,"samples":200,"color":"#38bdf8","width":2.5},{"kind":"point","at":[1,0.5,0.02],"color":"#94a3b8","size":0.1,"label":"A"},{"kind":"point","at":["1+h","0.5*(1+h)^2",0.02],"color":"#f472b6","size":0.1,"label":"B"},{"kind":"curve","x":"t","y":"0.5*1^2 + ((0.5*(1+h)^2-0.5*1^2)/h)*(t-1)","tMin":-1.5,"tMax":3.5,"samples":8,"color":"#fbbf24","width":2},{"kind":"text","at":[-1.6,2.4,0],"content":"m=\\frac{\\Delta y}{\\Delta x}\\to f'(1)","latex":true,"color":"#fbbf24","size":0.3}]}</scene>
(The slider h IS Δx — the student drives the limit and watches the secant converge to the tangent. This is the analysis template: a curve, the fixed point, the moving point, the line through them, and the limiting quantity as an accent formula.)

WORKED EXAMPLE 4 — accumulation, LIVE-COUNT bars + region fill + live readout (Riemann sum):
<scene>{"kind":"scene","title":"Area is the limit of a rectangle staircase","caption":"Slide n up — the staircase collapses onto the true area.","why":"Each rectangle is f(x_i)·Δx, a real sub-area; as n→∞ the staircase error vanishes and the sum is forced onto the exact area 8/3.","flat":true,"camera":[0,0,7],"sliders":[{"key":"n","label":"Rectangles n","min":1,"max":60,"step":1,"default":6}],"objects":[{"kind":"axes","size":3,"labels":["x","y","z"]},{"kind":"regionFill","x":"t","yTop":"0.5*t^2","yBottom":"0","tMin":0,"tMax":2,"samples":80,"color":"#334155","opacity":0.5},{"kind":"bars","count":"n","x":"(i+0.5)*(2/n)","height":"0.5*((i+0.5)*(2/n))^2","base":0,"color":"#38bdf8"},{"kind":"curve","x":"t","y":"0.5*t^2","tMin":0,"tMax":2,"samples":120,"color":"#fbbf24","width":2.5},{"kind":"text","at":[-0.9,1.9,0],"content":"\\sum f(x_i)\\,\\Delta x \\to \\tfrac{8}{3}","latex":true,"color":"#fbbf24","size":0.28}]}</scene>
(count:"n" makes the bars a LIVE family driven by the slider; the shaded regionFill is the true area the staircase converges onto; the accent curve is the exact boundary. This is the accumulation template — reuse it for probability-as-area (regionFill under a density between draggable a,b), work, impulse, distance-under-speed.)

WORKED EXAMPLE 5 — physics field map, scalarField + vectorField together (electric dipole potential):
<scene>{"kind":"scene","title":"The field of an electric dipole","caption":"Two equal, opposite charges — watch how their potentials cancel exactly on the midline.","why":"Potential adds like a plain scalar (one term per charge), so between equal-and-opposite charges the two contributions fight to a standoff exactly on the perpendicular bisector — the field there points straight from + to -, not radially from either charge alone.","flat":true,"camera":[0,0,9],"objects":[{"kind":"scalarField","f":"1/sqrt((x-2)^2+y^2+0.09) - 1/sqrt((x+2)^2+y^2+0.09)","bounds":[-5,5,-5,5],"palette":"diverging","opacity":0.85},{"kind":"vectorField","fx":"(x-2)/((x-2)^2+y^2+0.09)^1.5 - (x+2)/((x+2)^2+y^2+0.09)^1.5","fy":"y/((x-2)^2+y^2+0.09)^1.5 - y/((x+2)^2+y^2+0.09)^1.5","bounds":[-5,5,-5,5],"density":9,"normalize":true,"color":"#0f172a"},{"kind":"point","at":[2,0,0.05],"color":"#ef4444","size":0.14,"label":"+q"},{"kind":"point","at":[-2,0,0.05],"color":"#2563eb","size":0.14,"label":"-q"},{"kind":"text","at":[0,-4.4,0],"content":"V(x,y)=\\tfrac{q}{r_+}-\\tfrac{q}{r_-}","latex":true,"color":"#f8fafc","size":0.28}]}</scene>
(scalarField gives the potential landscape its true sign — the blue/red split IS the physics, not decoration; vectorField's dark arrows sit on top for direction, since colour alone only gives magnitude+sign. The +q/-q point colours deliberately match the field's own red/blue so the charge and its potential read as the same fact, not two competing colour choices. This is the field-map template — reuse for charge density, wave/diffraction intensity, |ψ|².)

OUTPUT: exactly one <scene>{…}</scene> block. Nothing before it, nothing after it.`;

export interface DirectSceneRequest {
  /** the tutor's <scene-request> body */
  request: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  level?: string;
  /** last couple of conversation turns, for level/tone grounding */
  recentTranscript?: string;
  /** attribution for the scene_outcomes row; omitting them costs only telemetry detail */
  sessionId?: string | null;
  subtopicId?: string | null;
}

/**
 * Parse a Director response into a sanitized scene. Exported so the
 * coverage harness (scripts/scene-harness) exercises the EXACT parsing
 * path production uses — no drift between what we test and what we ship.
 */
export function parseDirectorResponse(acc: string): SceneSpec | null {
  // Preferred: a proper <scene> block (extractViz sanitizes it too).
  const { viz } = extractViz(acc);
  if (viz && isSceneSpec(viz)) return viz;

  // Fallbacks for a model that ignored the tag instruction: strip markdown
  // code fences and stray <scene> tags, then parse the largest JSON object
  // (with the same trailing-comma / comment / curly-quote repairs).
  const cleaned = acc
    .replace(/```(?:json)?/gi, "")
    .replace(/<\/?scene>/gi, "")
    .trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    const parsed = parseModelJson(m[0]);
    if (isSceneSpec(parsed)) return sanitizeScene(parsed);
  }
  return null;
}

/**
 * One-shot scene authorship through the deployed chat function.
 * Accumulates the SSE stream, then parses + sanitizes the scene.
 * Returns null on any failure — callers treat that as "no new scene".
 */
async function streamSceneOnce(userContent: string): Promise<{ acc: string; scene: SceneSpec | null }> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getBearerToken()}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: userContent }],
      systemOverride: SCENE_DIRECTOR_PROMPT,
    }),
  });
  if (!resp.ok || !resp.body) return { acc: "", scene: null };
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const j = line.slice(6).trim();
      if (j === "[DONE]") break;
      try {
        const d = JSON.parse(j).choices?.[0]?.delta?.content;
        if (d) acc += d;
      } catch {
        /* skip non-content events */
      }
    }
  }
  return { acc, scene: parseDirectorResponse(acc) };
}

/**
 * Rung 3: hand the model its own broken scene together with the exact validator errors.
 *
 * Exactly ONE attempt, on purpose. A model that cannot fix a named compile error with that error
 * quoted in front of it will not fix it on the third ask either, and every extra call is latency the
 * student spends looking at an empty canvas. This is also the only rung of the ladder that costs
 * anything, which is why it sits below the free mechanical pass rather than above it.
 */
async function modelRepairOnce(scene: SceneSpec, report: ValidationReport): Promise<SceneSpec | null> {
  const problems = [
    ...report.exprIssues.map(
      (i) => `- ${i.where} → ${i.kind}${i.detail ? ` (${i.detail})` : ""} · expression: ${i.expr}`,
    ),
    ...report.flags.map((f) => `- flag: ${f}`),
  ].join("\n");

  const userContent = `The scene below FAILED deterministic validation. Return the CORRECTED scene.

PROBLEMS FOUND:
${problems}

RULES FOR THE FIX:
- Keep the teaching intent, the objects, and the manipulables wherever they are already valid.
- Change only what is broken. Do NOT simplify or strip the scene to make validation easy — a
  degenerate scene that validates is a worse failure than the one you were given.
- Every expression must parse under mathjs and evaluate finite at the scene's default state.

BROKEN SCENE:
${JSON.stringify(scene)}`;

  const { scene: fixed } = await streamSceneOnce(userContent);
  return fixed;
}

/**
 * Authors a scene, then walks it down a ladder of increasingly expensive recoveries, recording which
 * rung it exited on. Before this, a scene either parsed or vanished — and a scene that parsed was
 * shown to the student whether or not its expressions actually evaluated, because nothing checked.
 *
 *   0  author (with the truncation retry below)
 *   1  validate — clean scenes return immediately, which is the overwhelmingly common path
 *   2  mechanical repair — free, deterministic, drops only what is provably broken
 *   3  one model repair call — the only rung that costs anything
 *   4  give up rather than render a scene known to be invalid
 *
 * Returning null still means "no new scene" to every caller, so nothing upstream changes.
 */
export async function directScene(req: DirectSceneRequest): Promise<SceneSpec | null> {
  const userContent = `SCENE REQUEST from the tutor:
${req.request}

Lesson context: subject=${req.subject ?? "maths"} · topic=${req.topic ?? "-"} · subtopic=${req.subtopic ?? "-"} · level=${req.level ?? "-"}
${req.recentTranscript ? `Recent conversation (for level/tone — do NOT teach, just scale the scene):\n${req.recentTranscript}` : ""}`;

  let attempts = 0;
  const finish = (
    scene: SceneSpec | null,
    outcome: SceneOutcome,
    rung: number,
    report?: ValidationReport,
    actions?: RepairAction[],
  ): SceneSpec | null => {
    // Deliberately not awaited: telemetry must never sit between the student and their scene.
    void logSceneOutcome({
      request: req.request,
      outcome,
      rung,
      sessionId: req.sessionId,
      subtopicId: req.subtopicId,
      hardFail: report?.hardFail ?? false,
      flags: report?.flags,
      issueKinds: report ? [...new Set(report.exprIssues.map((i) => i.kind))] : [],
      repairActions: (actions ?? []).map((a) => `${a.kind}: ${a.detail}`),
      primCount: scene?.objects.length ?? report?.primCount ?? null,
      attempts,
    });
    return scene;
  };

  // ---- rung 0: authorship ------------------------------------------------
  // The gateway intermittently truncates a long scene stream mid-JSON (measured: a rich scene that
  // opens <scene> but never closes it). That is NOT a model-competence failure — the same request
  // succeeds on a retry — so a truncated/empty response is retried with a short backoff. Without
  // this, exactly the richest scenes were the ones silently dropped.
  let authored: SceneSpec | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    attempts = attempt;
    try {
      const { acc, scene } = await streamSceneOnce(userContent);
      if (scene) {
        authored = scene;
        break;
      }
      const truncated = acc.includes("<scene>") && !acc.includes("</scene>");
      if (!truncated && acc.trim().length > 0) {
        // A complete but unparsable response won't improve on retry — stop.
        console.warn("[scene-director] no usable scene in response; head:", acc.slice(0, 120));
        break;
      }
      console.warn(`[scene-director] ${truncated ? "truncated" : "empty"} stream, attempt ${attempt}/3 — retrying`);
    } catch {
      /* network hiccup — fall through to backoff/retry */
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  if (!authored) return finish(null, "no-scene", 0);

  // ---- rung 1: deterministic validation ----------------------------------
  const report = validateScene(authored, 0);
  if (!report.hardFail) return finish(authored, "clean", 1, report);
  console.warn("[scene-director] scene failed validation:", report.exprIssues.map((i) => `${i.where}:${i.kind}`).join(", "));

  // ---- rung 2: mechanical repair (free) ----------------------------------
  const { scene: repaired, actions } = mechanicalRepair(authored, report);
  const afterRepair = validateScene(repaired, 0);
  if (!afterRepair.hardFail && repaired.objects.length > 0) {
    // Pruning can leave a scene technically valid but too thin to teach anything. Worth recording
    // separately: it renders, so it is not a failure, but it is not a win either.
    const thin = repaired.objects.length < 2;
    return finish(repaired, thin ? "degraded" : "repaired", 2, afterRepair, actions);
  }

  // ---- rung 3: one model repair call -------------------------------------
  let modelFixed: SceneSpec | null = null;
  try {
    modelFixed = await modelRepairOnce(authored, report);
  } catch {
    /* repair is best-effort; fall through to giving up */
  }
  if (modelFixed) {
    const afterModel = validateScene(modelFixed, 0);
    if (!afterModel.hardFail && modelFixed.objects.length > 0) {
      return finish(modelFixed, "model-repaired", 3, afterModel);
    }
  }

  // ---- rung 4: refuse to render something known to be broken --------------
  // The target is "no missing OR INACCURATE visualisations". A scene whose expressions provably do
  // not evaluate is the inaccurate half of that, so it is not shown at all.
  console.warn("[scene-director] scene unrecoverable after mechanical + model repair — showing nothing");
  return finish(null, "failed", 4, report, actions);
}
