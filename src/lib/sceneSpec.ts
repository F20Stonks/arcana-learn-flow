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
 */

export interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Plain colour string (hex, rgb, hsl, or a named CSS colour). */
export type Color = string;

export interface PointPrim {
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
   */
  drag?: [string, string];
}

export interface CurvePrim {
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
}

export interface SurfacePrim {
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

export interface VectorFieldPrim {
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

export interface ArrowPrim {
  kind: "arrow";
  from: [number | string, number | string, number | string];
  to: [number | string, number | string, number | string];
  color?: Color;
  label?: string;
}

export interface PolygonPrim {
  kind: "polygon";
  /** ordered vertices, each [x,y,z] (z optional) */
  vertices: Array<[number | string, number | string, (number | string)?]>;
  color?: Color;
  opacity?: number; // default 0.35
  outline?: Color;
}

export interface GridPrim {
  kind: "grid";
  /** plane the grid lies on */
  plane?: "xy" | "xz" | "yz"; // default "xy"
  size?: number;     // half-extent, default 5
  divisions?: number; // default 10
  color?: Color;
}

export interface AxesPrim {
  kind: "axes";
  size?: number; // default 4
  labels?: [string, string, string]; // default ["x","y","z"]
  /** numeric tick marks along each axis (default true) */
  ticks?: boolean;
}

export interface TextPrim {
  kind: "text";
  at: [number | string, number | string, number | string];
  content: string;
  color?: Color;
  size?: number; // default 0.3
}

/** Apply a 4x4 affine transform (column-major) to a sub-tree. */
export interface GroupPrim {
  kind: "group";
  /** optional 4x4 column-major matrix (16 numbers OR mathjs exprs) */
  matrix?: Array<number | string>;
  children: Primitive[];
}

export type Primitive =
  | PointPrim
  | CurvePrim
  | SurfacePrim
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

const isTriple = (v: unknown): boolean =>
  Array.isArray(v) && v.length >= 2 && v.slice(0, 3).every((c) => c === undefined || isExpr(c));

function sanitizePrimitive(p: unknown, depth: number): Primitive | null {
  if (!p || typeof p !== "object") return null;
  const prim = p as Record<string, unknown>;
  switch (prim.kind) {
    case "point":
      if (!isTriple(prim.at)) return null;
      if (prim.drag !== undefined) {
        const d = prim.drag;
        if (!Array.isArray(d) || d.length < 2 || typeof d[0] !== "string" || typeof d[1] !== "string") {
          delete prim.drag;
        }
      }
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