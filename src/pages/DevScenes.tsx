import { useState } from "react";
import MathTheater from "@/components/workspace/MathTheater";
import type { SceneSpec } from "@/lib/sceneSpec";
import { sanitizeScene } from "@/lib/sceneSpec";
import { directScene } from "@/lib/sceneDirector";

/**
 * DEV-ONLY scene bench (route registered only when import.meta.env.DEV).
 * A curated gauntlet for the scene engine — every renderer feature has a
 * scene here that exercises it, so engine changes can be verified without
 * burning an AI session.
 */

const SCENES: { name: string; spec: SceneSpec }[] = [
  {
    // Choreography showcase 1 — FORMAL TWEENS: step 2 morphs the group matrix
    // and both basis arrows over 3s (bake persists into step 3), step 3 flies
    // the camera out and reveals the eigen-directions.
    name: "Choreo: linear map morph (tweens, camera fly, bake)",
    spec: {
      kind: "scene",
      title: "A matrix is a machine that moves the whole plane",
      caption: "Play step 2 — every gridpoint rides to its destination; two directions refuse to turn.",
      why: "A linear map is determined by where the basis vectors land; watching the interpolation shows every point carried linearly, and the eigen-directions are the lines the map only stretches.",
      flat: true,
      camera: [0, 0, 9],
      steps: [
        { title: "The plane and its basis", caption: "A lattice of points, the unit square, and î, ĵ." },
        {
          title: "Watch A act",
          caption: "Every point moves linearly to its image — nothing tears, nothing bends.",
          duration: 3,
          tweens: [
            { target: "plane", to: { matrix: [3, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } },
            { target: "ihat", to: { to: [3, 0, 0.02] } },
            { target: "jhat", to: { to: [1, 2, 0.02] } },
          ],
        },
        { title: "The invariant directions", caption: "Along (1,0) and (1,−1), A only stretches — eigenvectors.", camera: [0, 0, 12] },
      ],
      objects: [
        { kind: "axes", size: 5, labels: ["x", "y", "z"] },
        {
          kind: "group",
          id: "plane",
          matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          children: [
            { kind: "points", count: 121, x: "mod(i,11)-5", y: "floor(i/11)-5", size: 0.07, color: "#38bdf8" },
            { kind: "polygon", vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: "#fbbf24", opacity: 0.3 },
          ],
        },
        { kind: "arrow", id: "ihat", from: [0, 0, 0.02], to: [1, 0, 0.02], color: "#34d399", label: "\\hat{\\imath}" },
        { kind: "arrow", id: "jhat", from: [0, 0, 0.02], to: [0, 1, 0.02], color: "#f472b6", label: "\\hat{\\jmath}" },
        { kind: "curve", x: "t", y: "0", z: "0.01", tMin: -5.5, tMax: 5.5, samples: 8, color: "#fbbf24", width: 2.5, dash: true, step: 3 },
        { kind: "curve", x: "t", y: "-t", z: "0.01", tMin: -4, tMax: 4, samples: 8, color: "#fbbf24", width: 2.5, dash: true, step: 3 },
        { kind: "text", at: [0, -6.2, 0], content: "A=\\begin{pmatrix}3&1\\\\0&2\\end{pmatrix}", latex: true, color: "#e2e8f0", size: 0.3 },
      ],
    },
  },
  {
    // Choreography showcase 2 — DIRECT-uu idiom: no formal tweens; expressions
    // read uu themselves (h: 2→0.02 as step 2 plays). Exercises exitStep (the
    // secant scaffolding leaves when the tangent appears) and live drag DURING
    // playback (a stays a free parameter throughout).
    name: "Choreo: secant → tangent (direct-uu, drag, exitStep)",
    spec: {
      kind: "scene",
      title: "The tangent is where the secant was heading",
      caption: "Step 2 slides B home; the slope readout converges. Then drag A — the tangent is yours.",
      why: "The derivative is not a formula but a limit you can watch: chord slopes stabilise as the second point arrives, and what remains is the line the curve was already leaning on.",
      flat: true,
      camera: [0, 0, 8],
      sliders: [{ key: "a", label: "Point a", min: -2, max: 2, step: 0.01, default: 1 }],
      steps: [
        { title: "A curve and a point", caption: "f(x) = x²/2, with A pinned at x = a (drag it any time)." },
        { title: "B slides home", caption: "The secant pivots as B → A; watch its slope settle.", duration: 3.5 },
        { title: "Your turn", caption: "The secant has become the tangent. Drag A along the curve." },
      ],
      objects: [
        { kind: "axes", size: 4, labels: ["x", "y", "z"] },
        { kind: "curve", x: "t", y: "t^2/2", tMin: -3, tMax: 3, samples: 200, color: "#38bdf8", width: 2.5 },
        { kind: "point", at: ["a", "a^2/2", 0.03], color: "#f472b6", size: 0.12, label: "A", drag: ["a", "ay"] },
        { kind: "point", at: ["a+(2-1.98*(uu^2*(3-2*uu)))", "(a+(2-1.98*(uu^2*(3-2*uu))))^2/2", 0.03], color: "#34d399", size: 0.1, label: "B", step: 2, exitStep: 3 },
        { kind: "curve", x: "t", y: "a^2/2+(a+(2-1.98*(uu^2*(3-2*uu)))/2)*(t-a)", tMin: -3.5, tMax: 3.5, samples: 8, color: "#34d399", width: 2, step: 2, exitStep: 3 },
        { kind: "text", at: [-2.5, 3.4, 0], content: "m_{AB}=${a+(2-1.98*(uu^2*(3-2*uu)))/2}", latex: true, color: "#34d399", size: 0.26, step: 2, exitStep: 3 },
        { kind: "curve", x: "t", y: "a^2/2+a*(t-a)", tMin: -3.5, tMax: 3.5, samples: 8, color: "#fbbf24", width: 2.5, step: 3 },
        { kind: "text", at: [-2.5, 3.4, 0], content: "f'(a)=a=${a}", latex: true, color: "#fbbf24", size: 0.26, step: 3 },
      ],
    },
  },
  {
    name: "FTA surface + winding (colormap, slider)",
    spec: {
      kind: "scene",
      title: "Why z² − 1 must vanish somewhere",
      caption: "Shrink r — the image loop is dragged across the origin.",
      why: "|P| is a continuous surface pinned above 0 far out; the winding image forces a zero inside.",
      camera: [5, 5, 6],
      sliders: [{ key: "r", label: "Circle radius r", min: 0.1, max: 2, step: 0.05, default: 1.5 }],
      objects: [
        { kind: "axes", size: 3, labels: ["Re", "Im", "|P|"] },
        {
          kind: "surface",
          x: "u", y: "v", z: "sqrt((u^2-v^2-1)^2+(2*u*v)^2)/2",
          uMin: -2, uMax: 2, vMin: -2, vMax: 2,
          uSamples: 56, vSamples: 56, color: "#3b82f6", opacity: 0.65,
        },
        {
          kind: "curve",
          x: "r^2*cos(2*t)-1", y: "r^2*sin(2*t)", z: "0.02",
          tMin: 0, tMax: 6.2832, samples: 240, color: "#fbbf24", width: 3,
        },
        { kind: "point", at: [0, 0, 0.02], color: "#f472b6", size: 0.09, label: "origin" },
      ],
    },
  },
  {
    name: "tan(t) asymptotes (discontinuity breaks)",
    spec: {
      kind: "scene",
      title: "tan breaks at π/2 — and the plot should too",
      caption: "Branches must NOT connect through the origin.",
      flat: true,
      camera: [0, 0, 9],
      objects: [
        { kind: "axes", size: 5, labels: ["x", "y", "z"] },
        { kind: "grid", plane: "xy", size: 5, divisions: 10 },
        { kind: "curve", x: "t", y: "tan(t)", tMin: -4.6, tMax: 4.6, samples: 500, color: "#38bdf8", width: 2.5 },
      ],
    },
  },
  {
    name: "Rotating vector field (time + arrowheads)",
    spec: {
      kind: "scene",
      title: "A field that turns with time",
      caption: "Play / pause / speed controls should appear bottom-left.",
      flat: true,
      camera: [0, 0, 9],
      objects: [
        { kind: "axes", size: 4, labels: ["x", "y", "z"] },
        {
          kind: "vectorField",
          fx: "-y*cos(time*0.6)-x*sin(time*0.6)",
          fy: "x*cos(time*0.6)-y*sin(time*0.6)",
          bounds: [-3.5, 3.5, -3.5, 3.5], density: 11, scale: 0.35, color: "#60a5fa",
        },
      ],
    },
  },
  {
    name: "Draggable point → moving tangent",
    spec: {
      kind: "scene",
      title: "Drag the point — the tangent follows",
      caption: "The slider a and the drag are the same control.",
      flat: true,
      camera: [0, 0, 9],
      sliders: [{ key: "a", label: "Point position a", min: -2, max: 2, step: 0.01, default: 1 }],
      objects: [
        { kind: "axes", size: 4, labels: ["x", "y", "z"] },
        { kind: "curve", x: "t", y: "t^2/2", tMin: -3, tMax: 3, samples: 200, color: "#38bdf8", width: 2.5 },
        { kind: "curve", x: "t", y: "a^2/2 + a*(t-a)", tMin: -3.5, tMax: 3.5, samples: 8, color: "#fbbf24", width: 2 },
        { kind: "point", at: ["a", "a^2/2", 0.02], color: "#f472b6", size: 0.12, label: "drag me", drag: ["a", "ay"] },
      ],
    },
  },
  {
    name: "Torus + (2,3) winding (3D beauty)",
    spec: {
      kind: "scene",
      title: "A curve that wraps 2 ways round, 3 ways through",
      caption: "Orbit it — modular structure as geometry.",
      camera: [6, 4.5, 6],
      objects: [
        { kind: "axes", size: 4, labels: ["x", "y", "z"], ticks: false },
        {
          kind: "surface",
          x: "(2.2+0.9*cos(v))*cos(u)", y: "(2.2+0.9*cos(v))*sin(u)", z: "0.9*sin(v)",
          uMin: 0, uMax: 6.2832, vMin: 0, vMax: 6.2832,
          uSamples: 64, vSamples: 40, color: "#3b82f6", opacity: 0.55,
        },
        {
          kind: "curve",
          x: "(2.2+0.9*cos(3*t))*cos(2*t)", y: "(2.2+0.9*cos(3*t))*sin(2*t)", z: "0.9*sin(3*t)",
          tMin: 0, tMax: 6.2832, samples: 400, color: "#fbbf24", width: 3,
        },
      ],
    },
  },
  {
    // Verbatim worked example 1 from SCENE_DIRECTOR_PROMPT — if this breaks,
    // the model is being taught to imitate broken JSON.
    name: "Thales construction (steps + constrained drag)",
    spec: {
      kind: "scene",
      title: "Why the angle in a semicircle is always right",
      caption: "Drag P anywhere on the circle — the right angle refuses to move.",
      why: "OP is a radius like OA and OB, so both small triangles are isosceles; their base angles must sum to 180°, forcing 90° at P.",
      flat: true,
      camera: [0, 0, 7.5],
      steps: [
        { title: "The diameter AB", caption: "Everything is built on the circle with centre O." },
        { title: "Pick P on the circle", caption: "P is free — drag it." },
        { title: "Draw the radius OP", caption: "The move that unlocks everything: OP = OA = OB." },
        { title: "Two isosceles triangles", caption: "Equal radii mean equal base angles α and β." },
        { title: "The right angle is forced", caption: "2α + 2β = 180°, so α + β = 90° — at every position of P." },
      ],
      objects: [
        { kind: "arc", center: [0, 0, 0], radius: 2.5, from: 0, to: "2*pi", color: "#94a3b8" },
        { kind: "segment", from: [-2.5, 0, 0], to: [2.5, 0, 0], color: "#94a3b8", width: 2, label: "AB" },
        { kind: "point", at: [-2.5, 0, 0.02], color: "#94a3b8", size: 0.09, label: "A" },
        { kind: "point", at: [2.5, 0, 0.02], color: "#94a3b8", size: 0.09, label: "B" },
        { kind: "point", at: [0, 0, 0.02], color: "#94a3b8", size: 0.07, label: "O" },
        { kind: "point", at: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0.03], color: "#fbbf24", size: 0.12, label: "P", drag: ["pa", "pb"], step: 2 },
        { kind: "segment", from: [-2.5, 0, 0], to: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], color: "#38bdf8", step: 2 },
        { kind: "segment", from: [2.5, 0, 0], to: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], color: "#38bdf8", step: 2 },
        { kind: "segment", from: [0, 0, 0], to: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], color: "#38bdf8", dash: true, step: 3, marks: 1 },
        { kind: "angleMark", at: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], from: [-2.5, 0, 0], to: [0, 0, 0], radius: 0.4, color: "#34d399", label: "\\alpha", step: 4 },
        { kind: "angleMark", at: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], from: [0, 0, 0], to: [2.5, 0, 0], radius: 0.55, color: "#f472b6", label: "\\beta", step: 4 },
        { kind: "angleMark", at: ["2.5*cos(atan2(pb,pa))", "2.5*sin(atan2(pb,pa))", 0], from: [-2.5, 0, 0], to: [2.5, 0, 0], radius: 0.75, color: "#fbbf24", right: true, step: 5 },
        { kind: "text", at: [0, -3.3, 0], content: "\\alpha+\\beta=90^\\circ\\;\\text{always}", latex: true, color: "#fbbf24", size: 0.32, step: 5 },
      ],
    },
  },
  {
    // Verbatim worked example 2 from SCENE_DIRECTOR_PROMPT.
    name: "Residue lattice (bulk points + colorBy + slider)",
    spec: {
      kind: "scene",
      title: "Multiples of 3 in a 12-wide grid",
      caption: "Slide the modulus — the stripes reorganise instantly.",
      why: "Colouring n by n mod m tiles the naturals into m arithmetic progressions; the grid width only changes how the stripes slant, never the classes.",
      flat: true,
      camera: [0, 0, 10],
      sliders: [{ key: "m", label: "Modulus m", min: 2, max: 6, step: 1, default: 3 }],
      objects: [
        { kind: "points", count: 144, x: "mod(i,12)-5.5", y: "floor(i/12)-5.5", size: 0.16, colorBy: "mod(i,m)" },
        { kind: "text", at: [0, -7, 0], content: "n \\equiv r \\pmod{m}", latex: true, color: "#e2e8f0", size: 0.3 },
      ],
    },
  },
  {
    name: "Riemann staircase (bars + live count + regionFill + readout)",
    spec: {
      kind: "scene",
      title: "Area is the limit of a rectangle staircase",
      caption: "Slide n up — the staircase collapses onto the true area.",
      why: "Each rectangle is f(x_i)·Δx; as n→∞ the staircase error vanishes and the sum is forced onto 8/3.",
      flat: true,
      camera: [0, 0, 7],
      sliders: [{ key: "n", label: "Rectangles n", min: 1, max: 60, step: 1, default: 6 }],
      objects: [
        { kind: "axes", size: 3, labels: ["x", "y", "z"] },
        { kind: "regionFill", x: "t", yTop: "0.5*t^2", yBottom: "0", tMin: 0, tMax: 2, samples: 80, color: "#334155", opacity: 0.5 },
        { kind: "bars", count: "n", x: "(i+0.5)*(2/n)", height: "0.5*((i+0.5)*(2/n))^2", base: 0, color: "#38bdf8" },
        { kind: "curve", x: "t", y: "0.5*t^2", tMin: 0, tMax: 2, samples: 120, color: "#fbbf24", width: 2.5 },
        { kind: "text", at: [-0.9, 1.9, 0], content: "\\sum f(x_i)\\,\\Delta x \\to \\tfrac{8}{3}", latex: true, color: "#fbbf24", size: 0.28 },
      ],
    },
  },
  {
    name: "Binomial distribution (bars, dynamic n & p)",
    spec: {
      kind: "scene",
      title: "The shape of B(n, p)",
      caption: "Slide n and p — the distribution slides and reshapes; peak near np.",
      why: "Each bar is P(X=k)=C(n,k)p^k(1-p)^(n-k); the mass concentrates near the mean np.",
      flat: true,
      camera: [0, 0, 9],
      sliders: [
        { key: "n", label: "Trials n", min: 1, max: 20, step: 1, default: 10 },
        { key: "p", label: "P(success)", min: 0.05, max: 0.95, step: 0.05, default: 0.5 },
      ],
      objects: [
        { kind: "axes", size: 5, labels: ["k", "P", "z"] },
        {
          kind: "bars",
          count: "n+1",
          x: "i-n/2",
          height: "6*combinations(n,i)*p^i*(1-p)^(n-i)",
          base: 0,
          colorBy: "abs(i-round(n*p))<0.5?1:0",
        },
        { kind: "text", at: [0, -1, 0], content: "\\mu=np=${n*p}", latex: true, color: "#fbbf24", size: 0.3 },
      ],
    },
  },
  {
    name: "Probability as area (regionFill, draggable bounds)",
    spec: {
      kind: "scene",
      title: "P(a < X < b) is area under the density",
      caption: "Drag a and b — the shaded area IS the probability.",
      why: "For a continuous variable probability is area under the pdf; the whole curve integrates to 1.",
      flat: true,
      camera: [0, 0, 7],
      sliders: [
        { key: "a", label: "a", min: -3, max: 0, step: 0.05, default: -1 },
        { key: "b", label: "b", min: 0, max: 3, step: 0.05, default: 1 },
      ],
      objects: [
        { kind: "axes", size: 3, labels: ["x", "y", "z"] },
        { kind: "curve", x: "t", y: "exp(-t^2/2)/sqrt(2*pi)", tMin: -3.2, tMax: 3.2, samples: 200, color: "#38bdf8", width: 2.5 },
        { kind: "regionFill", x: "t", yTop: "exp(-t^2/2)/sqrt(2*pi)", yBottom: "0", tMin: "a", tMax: "b", samples: 80, color: "#fbbf24", opacity: 0.4 },
        { kind: "point", at: ["a", 0, 0.02], color: "#f472b6", size: 0.1, label: "a", drag: ["a", "ay"] },
        { kind: "point", at: ["b", 0, 0.02], color: "#f472b6", size: 0.1, label: "b", drag: ["b", "by"] },
      ],
    },
  },
  {
    // Verbatim worked example 5 from SCENE_DIRECTOR_PROMPT — if this breaks,
    // the model is being taught to imitate broken JSON.
    name: "Dipole potential (scalarField diverging + vectorField)",
    spec: {
      kind: "scene",
      title: "The field of an electric dipole",
      caption: "Two equal, opposite charges — watch how their potentials cancel exactly on the midline.",
      why: "Potential adds like a plain scalar (one term per charge), so between equal-and-opposite charges the two contributions fight to a standoff exactly on the perpendicular bisector — the field there points straight from + to -, not radially from either charge alone.",
      flat: true,
      camera: [0, 0, 9],
      objects: [
        { kind: "scalarField", f: "1/sqrt((x-2)^2+y^2+0.09) - 1/sqrt((x+2)^2+y^2+0.09)", bounds: [-5, 5, -5, 5], palette: "diverging", opacity: 0.85 },
        { kind: "vectorField", fx: "(x-2)/((x-2)^2+y^2+0.09)^1.5 - (x+2)/((x+2)^2+y^2+0.09)^1.5", fy: "y/((x-2)^2+y^2+0.09)^1.5 - y/((x+2)^2+y^2+0.09)^1.5", bounds: [-5, 5, -5, 5], density: 9, normalize: true, color: "#0f172a" },
        { kind: "point", at: [2, 0, 0.05], color: "#ef4444", size: 0.14, label: "+q" },
        { kind: "point", at: [-2, 0, 0.05], color: "#2563eb", size: 0.14, label: "-q" },
        { kind: "text", at: [0, -4.4, 0], content: "V(x,y)=\\tfrac{q}{r_+}-\\tfrac{q}{r_-}", latex: true, color: "#f8fafc", size: 0.28 },
      ],
    },
  },
  {
    name: "Two-slit interference (scalarField sequential, slider, live text)",
    spec: {
      kind: "scene",
      title: "Where two waves agree, light lands",
      caption: "Slide the slit separation — the fringes squeeze together as d grows.",
      why: "Each point's brightness is set by the path difference to the two slits: a whole number of wavelengths means crests arrive together (bright), a half number means they cancel (dark). Changing d moves where those agreements happen — geometry, not magic.",
      flat: true,
      camera: [0, 0, 9],
      sliders: [{ key: "d", label: "Slit separation d", min: 0.5, max: 3, step: 0.05, default: 1.5 }],
      objects: [
        { kind: "scalarField", f: "1 + cos(6*(sqrt((x-d/2)^2+(y+4)^2) - sqrt((x+d/2)^2+(y+4)^2)))", bounds: [-4, 4, -3, 3], resolution: 60, palette: "sequential", color: "#fbbf24" },
        { kind: "point", at: ["d/2", -4, 0.05], color: "#38bdf8", size: 0.1, label: "S_1" },
        { kind: "point", at: ["-d/2", -4, 0.05], color: "#38bdf8", size: 0.1, label: "S_2" },
        { kind: "text", at: [0, 3.6, 0], content: "\\Delta r = n\\lambda \\Rightarrow \\text{bright}\\quad (d = ${d})", latex: true, color: "#f8fafc", size: 0.26 },
      ],
    },
  },
  {
    name: "Sanitizer stress (bad prims, huge density)",
    spec: sanitizeScene({
      kind: "scene",
      title: "Sanitizer should tame this",
      caption: "Density 40 clamped to 14; junk primitives dropped; scene still renders.",
      flat: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sliders: [{ key: "k", label: "k", min: 2, max: 0, step: -1, default: 99 } as any],
      objects: [
        { kind: "axes", size: 4 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { kind: "vectorField", fx: "-y", fy: "x", bounds: [-3, 3, -3, 3], density: 40 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { kind: "curve", x: "t" } as any, // missing y — dropped
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { kind: "banana" } as any, // unknown — dropped
        { kind: "curve", x: "cos(t)*k", y: "sin(t)*k", tMin: 0, tMax: 6.2832, samples: 5000, color: "#f472b6" },
      ],
    } as SceneSpec),
  },
];

const DIRECTOR_TEST_REQUEST = `concept: the derivative as the limit of secant slopes
show: a curve with a fixed point A and a second point B sliding toward it; the secant line visibly becoming the tangent
manipulate: drag or slide B toward A and watch the secant slope converge to the tangent slope
form: graph`;

export default function DevScenes() {
  const [idx, setIdx] = useState(0);
  const [directed, setDirected] = useState<SceneSpec | null>(null);
  const [directing, setDirecting] = useState(false);
  const [directErr, setDirectErr] = useState(false);

  const runDirector = async () => {
    setDirecting(true);
    setDirected(null);
    setDirectErr(false);
    const scene = await directScene({
      request: DIRECTOR_TEST_REQUEST,
      subject: "Mathematics",
      topic: "Differentiation",
      subtopic: "The derivative as a limit",
      level: "A-Level",
    });
    setDirecting(false);
    if (scene) setDirected(scene);
    else setDirectErr(true); // detail is in the console
  };

  const payload = directed ?? SCENES[idx].spec;

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto shrink-0">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">Scene bench (dev)</span>
        {SCENES.map((s, i) => (
          <button
            key={s.name}
            onClick={() => { setIdx(i); setDirected(null); }}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              i === idx && !directed
                ? "bg-primary/20 border-primary/60 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {i + 1}. {s.name}
          </button>
        ))}
        <button
          onClick={runDirector}
          disabled={directing}
          className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-colors ${
            directed
              ? "bg-primary/20 border-primary/60 text-foreground"
              : "border-amber-500/50 text-amber-300 hover:text-amber-100"
          } ${directing ? "opacity-60" : ""}`}
        >
          {directing ? "Directing… (live AI call)" : directed ? `Directed: ${directed.title}` : directErr ? "✕ No scene — retry" : "▶ Direct a scene (live AI call)"}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <MathTheater payload={payload} />
      </div>
    </div>
  );
}
