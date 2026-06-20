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