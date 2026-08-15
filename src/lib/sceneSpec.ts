/**
 * Universal scene-graph spec. The AI emits one of these per teaching turn.
 * The renderer composes the scene from primitive objects — there is no
 * fixed list of "archetypes". Anything in undergraduate maths/physics
 * should be expressible as a combination of these primitives.
 *
 * All numeric expressions are mathjs strings with access to:
 *   - parameter variables: t (curves), u/v (surfaces), x/y/z (fields, regions)
 *   - any slider key declared in `sliders`
 *   - `time` — seconds since the scene mounted (for ambient animation)
 *   - `uu` — the current step's playback progress, 0→1 over the step's
 *     `duration` (1 on steps without one). The choreography variable: tweens
 *     compile down to blends in it, and hand-authored expressions may read it
 *     directly for within-step motion.
 */

export interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** A named stage in a step-by-step scene (constructions, proofs, builds). */
export interface StepSpec {
  /** short imperative headline for this stage ("Drop the perpendicular from A") */
  title: string;
  /** optional one-sentence explanation shown under the title */
  caption?: string;
  /**
   * Seconds of choreographed playback when this step is entered. While the
   * step plays, the reserved scope variable `uu` runs 0→1 linearly (easing
   * belongs to each tween). Steps without a duration are static: uu = 1.
   * Playback auto-pauses at the end of the step — advancing to the next
   * beat is always the student's move, never the clock's.
   */
  duration?: number;
  /** camera position to fly to (eased, ~0.9s) when this step is entered */
  camera?: [number, number, number];
  /** parameter morphs that play over this step's duration */
  tweens?: TweenSpec[];
}

/**
 * A parameter morph on one identified object (`id` on the primitive). When
 * the step is entered the targeted params travel from their current values
 * to `to`: numbers and expressions blend continuously ((1−w)·from + w·to,
 * w eased from uu), [x,y,z]-style arrays blend per component, and
 * `color`/`label`/`content` snap. After the step completes — and in every
 * later step — the `to` values are BAKED: objects keep the state they
 * morphed into, so identity persists and scrubbing/revisiting is pure.
 */
export interface TweenSpec {
  /** id of the primitive this tween drives */
  target: string;
  /** param values reached by the end of the tween */
  to: Record<string, unknown>;
  /** seconds into the step before the morph starts (default 0) */
  delay?: number;
  /** seconds the morph runs (default: to the end of the step) */
  duration?: number;
  /** "smooth" (default, smoothstep) or "linear" */
  ease?: "smooth" | "linear";
}

/**
 * Every primitive may carry `step: n` (1-based) — it becomes visible from the
 * n-th step onward, entering with a draw-on / grow animation. Primitives
 * without a step are always visible. Only meaningful when the scene declares
 * a `steps` array.
 */
export interface Staged {
  step?: number;
  /** stable identity for choreography — step tweens target primitives by id */
  id?: string;
  /**
   * Hide this primitive from the n-th step (1-based) onward. An object may
   * enter with `step` and leave with `exitStep` — scaffolding that gives way
   * to what it became (the secant that exits when the tangent appears).
   */
  exitStep?: number;
}

/** Plain colour string (hex, rgb, hsl, or a named CSS colour). */
export type Color = string;

/**
 * Where a dragged point is allowed to go — a "glider", in JSXGraph's sense: a
 * point that lives ON another object rather than anywhere in the plane. The
 * shape of the field follows Mafs's `constrain` prop.
 *
 * WHY THIS EXISTS. Constraining a drag was already possible, by hand-writing
 * the projection inside `at` — pinning a point to the circle of radius 2 meant
 * `at: ["2*cos(atan2(b,a))", "2*sin(atan2(b,a))", 0]`, with the raw drag
 * writing (a,b) underneath. That works, but it asks whoever authors the scene
 * to get inverse trigonometry right for every constrained point, and a wrong
 * projection still renders — it just renders something false. Declaring the
 * constraint moves that arithmetic into the renderer, where it is written once
 * and tested once. Prefer it over projecting by hand.
 *
 * Numeric fields accept mathjs expressions, so the constraint itself may
 * depend on a slider: a glider on a circle whose radius the student controls.
 */
export type DragConstraint =
  /** Lock one axis; the other keeps the value it had when the drag started. */
  | { on: "horizontal" }
  | { on: "vertical" }
  /** Snap to a lattice. `step` defaults to 1. */
  | { on: "grid"; step?: number | string }
  /** Ride the circle of this centre and radius. `center` defaults to the origin. */
  | { on: "circle"; center?: [number | string, number | string]; radius: number | string }
  /** Ride the segment between two endpoints, clamped to the endpoints. */
  | {
      on: "segment";
      from: [number | string, number | string];
      to: [number | string, number | string];
    }
  /**
   * Ride an arbitrary parametric curve — the general glider. The renderer
   * samples the curve over [tMin,tMax] and snaps to the nearest point on it, so
   * this covers parabolas, sine waves and spirals without any projection maths.
   */
  | {
      on: "curve";
      x: string;
      y: string;
      tMin: number | string;
      tMax: number | string;
      samples?: number;
    };

export interface PointPrim extends Staged {
  kind: "point";
  /** literal numbers OR mathjs expressions */
  at: [number | string, number | string, number | string];
  color?: Color;
  size?: number;
  label?: string;
  /**
   * Makes the point draggable. The two entries name param keys that receive
   * the point's dragged (x, y) position — usable in every other expression.
   * Pair with `at: ["a", "b", 0]` and (ideally) sliders declaring a and b;
   * undeclared keys are seeded from the point's initial position.
   * To CONSTRAIN a drag, prefer the `constrain` field below — it does the
   * projection for you. Projecting by hand inside `at` still works (drag writes
   * raw (a,b), and `at: ["2*cos(atan2(b,a))", "2*sin(atan2(b,a))", 0]` snaps the
   * rendered point onto radius 2) but you have to get the trigonometry right.
   */
  drag?: [string, string];
  /**
   * Restrict where a drag may go. Only meaningful alongside `drag` — the
   * constraint is applied to the pointer position BEFORE the two param keys are
   * written, so every expression downstream sees already-projected values and
   * nothing else has to know the point is constrained.
   */
  constrain?: DragConstraint;
}

/**
 * Bulk indexed point cloud — lattices, sieves, samples, datasets.
 * Expressions receive `i` = 0 … count−1 (plus sliders/time as usual).
 *
 * `count` may itself be a mathjs expression in sliders/time — so the NUMBER
 * of points can react to a control (n roots of unity as n slides, m samples,
 * a growing sequence). This is the "live-count family" capability.
 */
export interface PointsPrim extends Staged {
  kind: "points";
  count: number | string;
  /** position of point i */
  x: string;
  y: string;
  z?: string;
  size?: number;
  color?: Color;
  /**
   * Optional palette selector: a mathjs expression in `i` evaluated per point,
   * floored and taken mod the theme palette length. Lets residue classes /
   * categories colour themselves, e.g. "mod(i, 3)".
   */
  colorBy?: string;
}

/**
 * Filled region between two boundaries swept over a parameter t ∈ [tMin,tMax]:
 * for each t the column from (x, yBottom) up to (x, yTop) is filled. With the
 * default yBottom "0" this is the area under a curve; give both boundaries for
 * the area between two curves. tMin/tMax may be expressions (slider/drag), so
 * the region's edges can be dragged — P(a<X<b) under a density, a Riemann
 * region, work-as-area-under-F, accumulated distance under a speed-time graph.
 * This is area-as-a-first-class-object, not a decorative fill.
 */
export interface RegionFillPrim extends Staged {
  kind: "regionFill";
  /** x-coordinate of the column at parameter t (expr in t, sliders, time); default "t" */
  x?: string;
  /** upper boundary height (expr in t, sliders, time) */
  yTop: string;
  /** lower boundary height (expr in t, sliders, time); default "0" */
  yBottom?: string;
  /** sweep range — numbers OR expressions (draggable/slider edges) */
  tMin: number | string;
  tMax: number | string;
  samples?: number; // default 64
  color?: Color;
  opacity?: number; // default 0.32
  /** outline the top boundary in a solid stroke (default true) */
  outline?: boolean;
}

/**
 * A bar chart / histogram / rectangle family — the discrete-quantity workhorse.
 * `count` bars (a number OR an expression in sliders → dynamic count), bar i
 * centred at x(i) with signed height(i), grown from `base`. Unlocks binomial &
 * discrete distributions, histograms, Markov state masses, AND Riemann-sum
 * rectangles (count = n slider, height = f(x_i)) — the same primitive, no
 * template. Expressions receive `i` = 0 … count−1 plus sliders/time.
 */
export interface BarsPrim extends Staged {
  kind: "bars";
  count: number | string;
  /** centre x of bar i (expr in i, sliders, time) */
  x: string;
  /** signed height of bar i (expr in i, sliders, time) */
  height: string;
  /** bar width (number or expr); default = 80% of the mean spacing */
  width?: number | string;
  /** baseline the bars grow from (number or expr); default 0 */
  base?: number | string;
  color?: Color;
  /** per-bar palette selector, expr in i (e.g. highlight one bar) */
  colorBy?: string;
}

export interface CurvePrim extends Staged {
  kind: "curve";
  /** parametric: each component is a mathjs expr in (t, sliders, time) */
  x: string;
  y: string;
  z?: string; // default "0"
  tMin: number;
  tMax: number;
  samples?: number; // default 200
  color?: Color;
  width?: number;
  label?: string;
  /** dashed stroke — the construction-line / auxiliary-object convention */
  dash?: boolean;
}

/** Straight segment between two points — the plane-geometry workhorse. */
export interface SegmentPrim extends Staged {
  kind: "segment";
  from: [number | string, number | string, (number | string)?];
  to: [number | string, number | string, (number | string)?];
  color?: Color;
  width?: number;
  dash?: boolean;
  label?: string;
  /** equal-length tick marks drawn at the midpoint (1, 2, or 3) */
  marks?: number;
}

/** Circular arc in the XY plane (use inside groups for other planes). */
export interface ArcPrim extends Staged {
  kind: "arc";
  center: [number | string, number | string, (number | string)?];
  radius: number | string;
  /** start/end angles in radians (mathjs exprs allowed) */
  from: number | string;
  to: number | string;
  color?: Color;
  width?: number;
  dash?: boolean;
}

/**
 * Marks the angle at vertex `at`, between the rays toward `from` and `to`.
 * Renders a small arc (or a square when `right`), with an optional label at
 * the bisector.
 */
export interface AngleMarkPrim extends Staged {
  kind: "angleMark";
  at: [number | string, number | string, (number | string)?];
  from: [number | string, number | string, (number | string)?];
  to: [number | string, number | string, (number | string)?];
  radius?: number; // default 0.45
  color?: Color;
  label?: string;
  /** draw the right-angle square instead of an arc */
  right?: boolean;
}

export interface SurfacePrim extends Staged {
  kind: "surface";
  /** parametric over (u, v) */
  x: string;
  y: string;
  z: string;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  uSamples?: number; // default 48
  vSamples?: number; // default 48
  color?: Color;
  opacity?: number; // default 0.7
  wireframe?: boolean;
  /** vertex-colour gradient by height — "height" (default) or "none" */
  colormap?: "height" | "none";
}

/**
 * A flat 2D scalar field rendered as a colour-mapped surface in the XY plane —
 * equipotential/field-intensity maps, wave interference, probability density,
 * temperature/pressure distributions. This is the primitive for "the value at
 * every point in a region", planar and honest by construction (no fake-3D
 * tilt: the field lives at z=0, read like a real contour map, never lit —
 * lighting would distort the very colour the student is meant to read off).
 *
 * `surface` is for when the THIRD axis is the story (a literal height). Use
 * `scalarField` whenever the underlying thing is genuinely 2D and colour is
 * standing in for a value, not a shape.
 */
export interface ScalarFieldPrim extends Staged {
  kind: "scalarField";
  /** value at (x, y) — mathjs expr in x, y, sliders, time */
  f: string;
  /** extent in the XY plane: [xMin, xMax, yMin, yMax] */
  bounds: [number, number, number, number];
  /** grid resolution per axis; default 40 */
  resolution?: number;
  /**
   * "diverging" (blue↔white↔red, centred on zero — potential, charge, signed
   * amplitude) or "sequential" (dark→accent — intensity, probability density,
   * temperature). Default "diverging".
   */
  palette?: "diverging" | "sequential";
  /**
   * Clamp range: |value| ≤ max (diverging) or 0..max (sequential). Omit it —
   * the range is auto-derived from what the field actually samples to, so a
   * field that rescales under a slider never needs the AI to predict bounds.
   */
  max?: number;
  /** tints the "sequential" ramp's bright end, or is ignored for "diverging" (which is
   *  always blue/red — a field's SIGN is data, not a style choice) */
  color?: Color;
  opacity?: number; // default 0.9
}

export interface VectorFieldPrim extends Staged {
  kind: "vectorField";
  /** components fx(x,y,z), fy(x,y,z), fz(x,y,z) — z optional */
  fx: string;
  fy: string;
  fz?: string;
  /** axis-aligned bounding box for the arrow grid */
  bounds: [number, number, number, number, number?, number?]; // [xMin,xMax,yMin,yMax,zMin?,zMax?]
  density?: number; // arrows per axis, default 8
  scale?: number;   // arrow length multiplier, default 0.3
  color?: Color;
  /** draw direction only — every arrow the same length */
  normalize?: boolean;
}

export interface ArrowPrim extends Staged {
  kind: "arrow";
  from: [number | string, number | string, number | string];
  to: [number | string, number | string, number | string];
  color?: Color;
  label?: string;
}

export interface PolygonPrim extends Staged {
  kind: "polygon";
  /** ordered vertices, each [x,y,z] (z optional) */
  vertices: Array<[number | string, number | string, (number | string)?]>;
  color?: Color;
  opacity?: number; // default 0.35
  outline?: Color;
}

export interface GridPrim extends Staged {
  kind: "grid";
  /** plane the grid lies on */
  plane?: "xy" | "xz" | "yz"; // default "xy"
  size?: number;     // half-extent, default 5
  divisions?: number; // default 10
  color?: Color;
}

export interface AxesPrim extends Staged {
  kind: "axes";
  size?: number; // default 4
  labels?: [string, string, string]; // default ["x","y","z"]
  /** numeric tick marks along each axis (default true) */
  ticks?: boolean;
}

export interface TextPrim extends Staged {
  kind: "text";
  at: [number | string, number | string, number | string];
  content: string;
  color?: Color;
  size?: number; // default 0.3
  /** render content as LaTeX (KaTeX) instead of plain text — use for any math notation */
  latex?: boolean;
}

/** Apply a 4x4 affine transform (column-major) to a sub-tree. */
export interface GroupPrim extends Staged {
  kind: "group";
  /** optional 4x4 column-major matrix (16 numbers OR mathjs exprs) */
  matrix?: Array<number | string>;
  children: Primitive[];
}

export type Primitive =
  | PointPrim
  | PointsPrim
  | RegionFillPrim
  | BarsPrim
  | CurvePrim
  | SegmentPrim
  | ArcPrim
  | AngleMarkPrim
  | SurfacePrim
  | ScalarFieldPrim
  | VectorFieldPrim
  | ArrowPrim
  | PolygonPrim
  | GridPrim
  | AxesPrim
  | TextPrim
  | GroupPrim;

export interface SceneSpec {
  /** discriminator for the renderer */
  kind: "scene";
  /** short headline rendered as overlay (e.g. "Why the FTA holds") */
  title: string;
  /** one-sentence pedagogical caption */
  caption?: string;
  /** the concept skeleton — what structural idea this scene shows */
  why?: string;
  /** lock camera to the XY plane (renders like a 2D Desmos scene) */
  flat?: boolean;
  /** initial camera position (default [6,6,6] for 3D, [0,0,8] for flat) */
  camera?: [number, number, number];
  /** sliders the student can manipulate; their values are injected into every expression */
  sliders?: SliderSpec[];
  /**
   * Step-by-step staging (constructions, proofs). Primitives tagged
   * `step: n` appear from the n-th step (1-based); untagged primitives are
   * always visible. The player shows ◀ ▶ controls with each step's title.
   */
  steps?: StepSpec[];
  /** the scene-graph itself */
  objects: Primitive[];
}

/** Type guard so MathTheater can dispatch between scene specs and legacy payloads. */
export function isSceneSpec(x: unknown): x is SceneSpec {
  return (
    !!x &&
    typeof x === "object" &&
    (x as { kind?: string }).kind === "scene" &&
    Array.isArray((x as { objects?: unknown }).objects)
  );
}

/**
 * Validate + sanitize an untrusted, possibly-absent value that MAY be a scene
 * (e.g. a `scene`/`option_scenes[i]` field on an AI-generated exam question —
 * unlike a teaching-turn scene, this never goes through the Scene Director's
 * own parse/sanitize path, so nothing upstream has cleaned it). Returns null
 * for anything that isn't shaped like a scene, so callers can render it
 * exactly like "no diagram was attached" instead of crashing.
 */
export function coerceScene(x: unknown): SceneSpec | null {
  return isSceneSpec(x) ? sanitizeScene(x) : null;
}

/* ---------------- sanitizer ----------------
 * The spec arrives from a language model. Rather than rejecting a whole
 * scene for one bad primitive (the old behaviour: silently keep the stale
 * scene), clamp what's clampable and drop only the primitives that are
 * structurally unusable. Never throws.
 */

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const isExpr = (v: unknown): v is string | number =>
  typeof v === "number" || (typeof v === "string" && v.trim().length > 0);

/** A [x,y] pair of literals-or-expressions, as constraint geometry uses. */
const isPair = (v: unknown): boolean =>
  Array.isArray(v) && v.length >= 2 && isExpr(v[0]) && isExpr(v[1]);

/**
 * Structural check on a DragConstraint. Deliberately strict: an unrecognised
 * `on` is rejected rather than defaulted, because silently substituting a
 * different constraint would move the point somewhere the author didn't mean.
 */
function isDragConstraint(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  switch (c.on) {
    case "horizontal":
    case "vertical":
      return true;
    case "grid":
      return c.step === undefined || isExpr(c.step);
    case "circle":
      return isExpr(c.radius) && (c.center === undefined || isPair(c.center));
    case "segment":
      return isPair(c.from) && isPair(c.to);
    case "curve":
      return isExpr(c.x) && isExpr(c.y) && isExpr(c.tMin) && isExpr(c.tMax);
    default:
      return false;
  }
}

const isTriple = (v: unknown): boolean =>
  Array.isArray(v) && v.length >= 2 && v.slice(0, 3).every((c) => c === undefined || isExpr(c));

function sanitizePrimitive(p: unknown, depth: number): Primitive | null {
  if (!p || typeof p !== "object") return null;
  const prim = p as Record<string, unknown>;
  if (prim.id !== undefined && typeof prim.id !== "string") delete prim.id;
  if (prim.exitStep !== undefined && (!Number.isFinite(prim.exitStep as number) || (prim.exitStep as number) < 2)) {
    delete prim.exitStep;
  }
  if (prim.step !== undefined && (!Number.isFinite(prim.step as number) || (prim.step as number) < 1)) {
    delete prim.step;
  }
  switch (prim.kind) {
    case "point":
      if (!isTriple(prim.at)) return null;
      if (prim.drag !== undefined) {
        const d = prim.drag;
        if (!Array.isArray(d) || d.length < 2 || typeof d[0] !== "string" || typeof d[1] !== "string") {
          delete prim.drag;
        }
      }
      // A bad constraint costs the constraint, never the point: an unconstrained
      // draggable point is a degraded scene, a dropped point is a broken one.
      // A constraint without a drag is inert rather than wrong, so it is left alone.
      if (prim.constrain !== undefined && !isDragConstraint(prim.constrain)) delete prim.constrain;
      return prim as unknown as Primitive;
    case "points":
      if (!isExpr(prim.x) || !isExpr(prim.y)) return null;
      // count may be a number (clamp it) or an expression (evaluated + clamped
      // at render time so a slider can drive how many points exist).
      if (typeof prim.count === "string" && prim.count.trim().length > 0) {
        /* keep expression */
      } else {
        prim.count = clamp(num(prim.count, 100), 1, 400);
      }
      if (prim.colorBy !== undefined && !isExpr(prim.colorBy)) delete prim.colorBy;
      return prim as unknown as Primitive;
    case "regionFill":
      if (!isExpr(prim.yTop) || !isExpr(prim.tMin) || !isExpr(prim.tMax)) return null;
      if (prim.x !== undefined && !isExpr(prim.x)) delete prim.x;
      if (prim.yBottom !== undefined && !isExpr(prim.yBottom)) delete prim.yBottom;
      if (prim.samples !== undefined) prim.samples = clamp(num(prim.samples, 64), 8, 400);
      if (prim.opacity !== undefined) prim.opacity = clamp(num(prim.opacity, 0.32), 0.05, 1);
      return prim as unknown as Primitive;
    case "bars":
      if (!isExpr(prim.x) || !isExpr(prim.height)) return null;
      if (typeof prim.count === "string" && prim.count.trim().length > 0) {
        /* keep expression */
      } else {
        prim.count = clamp(num(prim.count, 10), 1, 400);
      }
      if (prim.width !== undefined && !isExpr(prim.width)) delete prim.width;
      if (prim.base !== undefined && !isExpr(prim.base)) delete prim.base;
      if (prim.colorBy !== undefined && !isExpr(prim.colorBy)) delete prim.colorBy;
      return prim as unknown as Primitive;
    case "segment":
      if (!isTriple(prim.from) || !isTriple(prim.to)) return null;
      if (prim.marks !== undefined) prim.marks = clamp(num(prim.marks, 1), 1, 3);
      return prim as unknown as Primitive;
    case "arc":
      if (!isTriple(prim.center) || !isExpr(prim.radius) || !isExpr(prim.from) || !isExpr(prim.to)) return null;
      return prim as unknown as Primitive;
    case "angleMark":
      if (!isTriple(prim.at) || !isTriple(prim.from) || !isTriple(prim.to)) return null;
      if (prim.radius !== undefined) prim.radius = clamp(num(prim.radius, 0.45), 0.1, 2);
      return prim as unknown as Primitive;
    case "curve": {
      if (!isExpr(prim.x) || !isExpr(prim.y)) return null;
      prim.tMin = num(prim.tMin, 0);
      prim.tMax = num(prim.tMax, num(prim.tMin, 0) + 1);
      if (prim.tMax === prim.tMin) prim.tMax = (prim.tMin as number) + 1;
      if (prim.samples !== undefined) prim.samples = clamp(num(prim.samples, 200), 16, 800);
      return prim as unknown as Primitive;
    }
    case "surface": {
      if (!isExpr(prim.x) || !isExpr(prim.y) || !isExpr(prim.z)) return null;
      prim.uMin = num(prim.uMin, -3);
      prim.uMax = num(prim.uMax, 3);
      prim.vMin = num(prim.vMin, -3);
      prim.vMax = num(prim.vMax, 3);
      if (prim.uMax === prim.uMin) prim.uMax = (prim.uMin as number) + 1;
      if (prim.vMax === prim.vMin) prim.vMax = (prim.vMin as number) + 1;
      prim.uSamples = clamp(num(prim.uSamples, 48), 8, 96);
      prim.vSamples = clamp(num(prim.vSamples, 48), 8, 96);
      return prim as unknown as Primitive;
    }
    case "scalarField": {
      if (!isExpr(prim.f)) return null;
      if (!Array.isArray(prim.bounds) || prim.bounds.length < 4) return null;
      prim.bounds = (prim.bounds as unknown[]).slice(0, 4).map((b, i) => num(b, i % 2 === 0 ? -3 : 3));
      if (prim.resolution !== undefined) prim.resolution = clamp(num(prim.resolution, 40), 8, 80);
      if (prim.max !== undefined && !Number.isFinite(prim.max as number)) delete prim.max;
      if (prim.opacity !== undefined) prim.opacity = clamp(num(prim.opacity, 0.9), 0.05, 1);
      if (prim.palette !== "sequential") prim.palette = "diverging";
      return prim as unknown as Primitive;
    }
    case "vectorField": {
      if (!isExpr(prim.fx) || !isExpr(prim.fy)) return null;
      if (!Array.isArray(prim.bounds) || prim.bounds.length < 4) return null;
      prim.bounds = (prim.bounds as unknown[]).slice(0, 6).map((b, i) => num(b, i % 2 === 0 ? -3 : 3));
      prim.density = clamp(num(prim.density, 8), 2, 14);
      return prim as unknown as Primitive;
    }
    case "arrow":
      if (!isTriple(prim.from) || !isTriple(prim.to)) return null;
      return prim as unknown as Primitive;
    case "polygon":
      if (!Array.isArray(prim.vertices) || prim.vertices.length < 3) return null;
      if (!(prim.vertices as unknown[]).every(isTriple)) return null;
      if ((prim.vertices as unknown[]).length > 64) prim.vertices = (prim.vertices as unknown[]).slice(0, 64);
      return prim as unknown as Primitive;
    case "grid":
    case "axes":
      return prim as unknown as Primitive;
    case "text":
      if (!isTriple(prim.at) || typeof prim.content !== "string") return null;
      return prim as unknown as Primitive;
    case "group": {
      if (depth >= 3 || !Array.isArray(prim.children)) return null;
      if (prim.matrix !== undefined && (!Array.isArray(prim.matrix) || prim.matrix.length !== 16)) {
        delete prim.matrix;
      }
      prim.children = (prim.children as unknown[])
        .map((c) => sanitizePrimitive(c, depth + 1))
        .filter(Boolean);
      return prim as unknown as Primitive;
    }
    default:
      return null;
  }
}

/**
 * Clamp/repair a raw scene in place and return it. Drops structurally
 * unusable primitives (logging once) instead of losing the whole scene.
 */
export function sanitizeScene(spec: SceneSpec): SceneSpec {
  const before = spec.objects.length;
  spec.objects = spec.objects.slice(0, 30).map((o) => sanitizePrimitive(o, 0)).filter(Boolean) as Primitive[];
  if (spec.objects.length < before) {
    console.warn(`[scene] dropped ${before - spec.objects.length} invalid primitive(s)`);
  }
  if (spec.camera !== undefined) {
    if (!Array.isArray(spec.camera) || spec.camera.length !== 3 || !spec.camera.every((c) => Number.isFinite(c))) {
      delete spec.camera;
    }
  }
  if (spec.steps !== undefined) {
    spec.steps = (Array.isArray(spec.steps) ? spec.steps : [])
      .filter((s): s is StepSpec => !!s && typeof s === "object" && typeof s.title === "string")
      .slice(0, 12)
      .map((s) => {
        if (s.duration !== undefined) {
          const d = num(s.duration, 0);
          if (d < 0.2) delete s.duration;
          else s.duration = clamp(d, 0.2, 20);
        }
        if (s.camera !== undefined && (!Array.isArray(s.camera) || s.camera.length !== 3 || !s.camera.every((c) => Number.isFinite(c)))) {
          delete s.camera;
        }
        if (s.tweens !== undefined) {
          s.tweens = (Array.isArray(s.tweens) ? s.tweens : [])
            .filter(
              (tw): tw is TweenSpec =>
                !!tw && typeof tw === "object" && typeof (tw as TweenSpec).target === "string" &&
                !!(tw as TweenSpec).to && typeof (tw as TweenSpec).to === "object",
            )
            .slice(0, 8)
            .map((tw) => {
              if (tw.delay !== undefined) tw.delay = Math.max(0, num(tw.delay, 0));
              if (tw.duration !== undefined) {
                const d = num(tw.duration, 0);
                if (d <= 0) delete tw.duration;
                else tw.duration = Math.min(d, 20);
              }
              if (tw.ease !== "linear") delete tw.ease; // default smooth
              return tw;
            });
          if (s.tweens.length === 0) delete s.tweens;
        }
        return s;
      });
    if (spec.steps.length === 0) delete spec.steps;
  }
  spec.sliders = (Array.isArray(spec.sliders) ? spec.sliders : [])
    .filter(
      (s): s is SliderSpec =>
        !!s && typeof s === "object" && typeof s.key === "string" && s.key.length > 0,
    )
    .slice(0, 8)
    .map((s) => {
      const min = num(s.min, 0);
      let max = num(s.max, min + 1);
      if (max <= min) max = min + 1;
      const step = num(s.step, (max - min) / 100) > 0 ? num(s.step, (max - min) / 100) : (max - min) / 100;
      return {
        key: s.key,
        label: typeof s.label === "string" ? s.label : s.key,
        min,
        max,
        step,
        default: clamp(num(s.default, min), min, max),
      };
    });
  return spec;
}