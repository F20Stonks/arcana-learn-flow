import type { Archetype } from "./mathTheme";

/**
 * Per-mode label set rendered as the overlay heading on the canvas.
 * Both `abstract` and `applied` are pulled DIRECTLY from the payload —
 * no string is hardcoded against any topic name in the engine layer.
 */
export interface ModeLabels {
  title: string;
  subtitle: string;
  formulas: string[]; // KaTeX strings
}

export interface SimulationLabels {
  abstract: ModeLabels;
  applied: ModeLabels;
}

/* ---------- Per-archetype generic config shapes ---------- */

export interface VectorFieldConfig {
  fx: string;             // mathjs expression in (x, y)
  fy: string;
  particles?: number;
  strength?: number;
  // optional slider declarations consumed by the UI
  sliders?: NumericSlider[];
}

export interface ApproximatorConfig {
  target: string;         // f(x) target expression
  // term(k, x) summed for k = 0..n-1  (Taylor / Fourier / Riemann)
  term: string;
  nDefault?: number;
  nMin?: number;
  nMax?: number;
  xRange?: [number, number];
  sliders?: NumericSlider[];
}

export interface TopologyWrapConfig {
  // expressions in (t, slope, period)
  x: string;
  y: string;
  slopeDefault?: number;
  periodDefault?: number;
  speedDefault?: number;
  // optional discrete lattice mod-n highlight
  lattice?: number;
  sliders?: NumericSlider[];
}

export interface LinearTransformConfig {
  // 2x2 matrix [[a,b],[c,d]] — animated from identity to this
  matrix: [[number, number], [number, number]];
  // optional dynamic matrix entries driven by sliders (overrides matrix when present)
  a?: string; b?: string; c?: string; d?: string;
  sliders?: NumericSlider[];
}

export interface NumericSlider {
  key: string;            // variable name injected into expressions
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export type ArchetypeConfig =
  | { archetype: "vector_field"; config: VectorFieldConfig }
  | { archetype: "approximator"; config: ApproximatorConfig }
  | { archetype: "topology_wrap"; config: TopologyWrapConfig }
  | { archetype: "linear_transform"; config: LinearTransformConfig };

export type SimulationPayload = ArchetypeConfig & {
  labels: SimulationLabels;
};

/* ---------- Resolver ---------- */

/**
 * Resolve a SimulationPayload from a database lesson object.
 * Order of precedence:
 *   1. subtopic.metadata.simulation  (full payload, user/db-defined)
 *   2. Generic keyword inference over (subtopic.title + topic.title + track.subject)
 *   3. Universal default: vector_field with f(x,y) = (-x, -y)
 *
 * No topic-specific strings are hardcoded; inference uses generic
 * mathematical concept keywords applicable to any user-generated lesson.
 */
export function resolveSimulationPayload(input: {
  subtopic?: { title?: string | null; metadata?: unknown } | null;
  topic?: { title?: string | null } | null;
  track?: { subject?: string | null } | null;
}): SimulationPayload {
  // 1. DB-provided payload
  const meta = (input.subtopic?.metadata ?? null) as
    | { simulation?: SimulationPayload }
    | null;
  if (meta && meta.simulation && (meta.simulation as SimulationPayload).archetype) {
    return meta.simulation;
  }

  // 2. Keyword inference
  const haystack = [
    input.subtopic?.title,
    input.topic?.title,
    input.track?.subject,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const has = (...kws: string[]) => kws.some((k) => haystack.includes(k));

  if (has("complex", "imaginary", "argand", "de moivre", "polar form")) {
    return DEFAULT_COMPLEX;
  }
  if (has("series", "expansion", "approx", "taylor", "fourier", "integral", "sum", "riemann")) {
    return DEFAULT_APPROXIMATOR;
  }
  if (has("modular", "mod ", "periodic", "torus", "wrap", "lattice", "cyclic", "phase")) {
    return DEFAULT_TOPOLOGY;
  }
  if (has("matrix", "transform", "linear map", "eigen", "rotation", "shear", "basis")) {
    return DEFAULT_LINEAR;
  }
  if (has("gradient", "field", "flow", "force", "vector", "differential", "calculus")) {
    return DEFAULT_VECTOR;
  }

  return DEFAULT_VECTOR;
}

/* ---------- Universal defaults (generic, topic-agnostic) ---------- */

const DEFAULT_VECTOR: SimulationPayload = {
  archetype: "vector_field",
  config: {
    fx: "-x",
    fy: "-y",
    particles: 220,
    strength: 1.2,
    sliders: [
      { key: "strength", label: "Strength", min: 0.1, max: 4, step: 0.05, default: 1.2 },
      { key: "particles", label: "Particles", min: 20, max: 300, step: 10, default: 220 },
    ],
  },
  labels: {
    abstract: {
      title: "Vector Field",
      subtitle: "Flow of $\\vec{v}(x,y)$ over the plane",
      formulas: ["$\\vec{v}(x,y) = (f_x, f_y)$"],
    },
    applied: {
      title: "Force Field",
      subtitle: "Particle motion under a continuous force",
      formulas: ["$\\vec{F} = m\\,\\vec{a}$"],
    },
  },
};

const DEFAULT_APPROXIMATOR: SimulationPayload = {
  archetype: "approximator",
  config: {
    target: "sin(x)",
    term: "((-1)^k) * x^(2k+1) / factorial(2k+1)",
    nDefault: 4,
    nMin: 0,
    nMax: 20,
    xRange: [-6, 6],
    sliders: [
      { key: "n", label: "Terms (n)", min: 0, max: 20, step: 1, default: 4 },
    ],
  },
  labels: {
    abstract: {
      title: "Series Approximation",
      subtitle: "Partial sum $S_n(x) = \\sum_{k=0}^{n-1} a_k(x)$",
      formulas: ["$f(x) \\approx S_n(x)$"],
    },
    applied: {
      title: "Signal Reconstruction",
      subtitle: "Adding harmonics rebuilds the target signal",
      formulas: ["error decays as $n \\to \\infty$"],
    },
  },
};

const DEFAULT_TOPOLOGY: SimulationPayload = {
  archetype: "topology_wrap",
  config: {
    x: "t",
    y: "slope * t",
    slopeDefault: 1.61,
    periodDefault: 10,
    speedDefault: 1.5,
    sliders: [
      { key: "slope", label: "Slope", min: 0.1, max: 4, step: 0.01, default: 1.61 },
      { key: "period", label: "Period", min: 2, max: 20, step: 0.5, default: 10 },
      { key: "speed", label: "Speed", min: 0.2, max: 6, step: 0.1, default: 1.5 },
    ],
  },
  labels: {
    abstract: {
      title: "Toroidal Wrap",
      subtitle: "Trajectory on $\\mathbb{R}^2 / (\\mathbb{Z}/n)^2$",
      formulas: ["$x \\equiv x \\pmod{n}$"],
    },
    applied: {
      title: "Periodic Phase Space",
      subtitle: "Coupled oscillators on a torus",
      formulas: ["$\\theta(t) = \\omega t \\pmod{2\\pi}$"],
    },
  },
};

const DEFAULT_COMPLEX: SimulationPayload = {
  archetype: "linear_transform",
  config: {
    matrix: [[1, 0], [0, 1]],
    a: "re", b: "-im", c: "im", d: "re",
    sliders: [
      { key: "re", label: "Re(z)", min: -2, max: 2, step: 0.05, default: 1 },
      { key: "im", label: "Im(z)", min: -2, max: 2, step: 0.05, default: 1 },
    ],
  },
  labels: {
    abstract: {
      title: "Complex Multiplication",
      subtitle: "Multiplying by $z = a+bi$ acts on the plane as $\\begin{pmatrix}a&-b\\\\b&a\\end{pmatrix}$",
      formulas: ["$z_1 z_2$ rotates by $\\arg(z_1)$ and scales by $|z_1|$"],
    },
    applied: {
      title: "Argand Plane",
      subtitle: "Every complex number is a point — multiplication is rotate + scale",
      formulas: ["$|z_1 z_2| = |z_1||z_2|$"],
    },
  },
};

const DEFAULT_LINEAR: SimulationPayload = {
  archetype: "linear_transform",
  config: {
    matrix: [[1, 0.5], [0, 1]],
    sliders: [
      { key: "a", label: "a (1,1)", min: -2, max: 2, step: 0.05, default: 1 },
      { key: "b", label: "b (1,2)", min: -2, max: 2, step: 0.05, default: 0.5 },
      { key: "c", label: "c (2,1)", min: -2, max: 2, step: 0.05, default: 0 },
      { key: "d", label: "d (2,2)", min: -2, max: 2, step: 0.05, default: 1 },
    ],
  },
  labels: {
    abstract: {
      title: "Linear Map",
      subtitle: "Action of $T:\\mathbb{R}^2 \\to \\mathbb{R}^2$ on basis",
      formulas: ["$T(\\vec{x}) = M\\vec{x}$"],
    },
    applied: {
      title: "Coordinate Transform",
      subtitle: "Stretch, shear, and rotation of a sheet",
      formulas: ["columns of $M$ = images of basis vectors"],
    },
  },
};
