import { useState } from "react";
import MathTheater from "@/components/workspace/MathTheater";
import type { SceneSpec } from "@/lib/sceneSpec";
import { sanitizeScene } from "@/lib/sceneSpec";

/**
 * DEV-ONLY scene bench (route registered only when import.meta.env.DEV).
 * A curated gauntlet for the scene engine — every renderer feature has a
 * scene here that exercises it, so engine changes can be verified without
 * burning an AI session.
 */

const SCENES: { name: string; spec: SceneSpec }[] = [
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

export default function DevScenes() {
  const [idx, setIdx] = useState(0);
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto shrink-0">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">Scene bench (dev)</span>
        {SCENES.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setIdx(i)}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              i === idx
                ? "bg-primary/20 border-primary/60 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {i + 1}. {s.name}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <MathTheater payload={SCENES[idx].spec} />
      </div>
    </div>
  );
}
