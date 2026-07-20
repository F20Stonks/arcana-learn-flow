import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Text, Html } from "@react-three/drei";
import { parse, type EvalFunction } from "mathjs";
import * as THREE from "three";
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause, SkipBack } from "lucide-react";
import type {
  SceneSpec,
  Primitive,
  PointPrim,
  CurvePrim,
  SurfacePrim,
  VectorFieldPrim,
  ArrowPrim,
  PolygonPrim,
  GridPrim,
  AxesPrim,
  TextPrim,
  GroupPrim,
} from "@/lib/sceneSpec";
import { buildColorMap, type VizTheme } from "@/lib/vizThemes";

/* ---------------- theming helpers ---------------- */

interface Style {
  colorMap: Map<string, string>;
  glow: boolean;
  flat: boolean;
}

function resolveColor(original: string | undefined, fallback: string, style: Style): string {
  const c = original ?? fallback;
  return style.colorMap.get(c) ?? c;
}

function collectColors(objects: Primitive[]): string[] {
  const out: string[] = [];
  const visit = (p: Primitive) => {
    if ("color" in p && typeof p.color === "string") out.push(p.color);
    if (p.kind === "group") p.children.forEach(visit);
  };
  objects.forEach(visit);
  return out;
}

/* ---------------- expression compiler with dependency tracking ----------------
 *
 * compileExpr returns both an evaluator and the list of free variables the
 * expression actually references. Geometry memos key on the *values of those
 * variables only*, so a `time`-animated point never forces a 48×48 surface
 * rebuild, and dragging a slider recomputes only the primitives that use it.
 *
 * Failed / non-finite evaluations yield NaN (not 0) — renderers treat NaN as
 * "break the line here" or "hide", so asymptotes break instead of diving to
 * the origin.
 */

type Scope = Record<string, number>;

interface Compiled {
  fn: (scope: Scope) => number;
  deps: string[];
}

const CONSTANT_NAMES = new Set(["pi", "PI", "e", "E", "tau", "phi", "i", "Infinity", "NaN"]);

const CONST_ZERO: Compiled = { fn: () => 0, deps: [] };

function compileExpr(expr: string | number | undefined, fallback: Compiled = CONST_ZERO): Compiled {
  if (expr === undefined) return fallback;
  if (typeof expr === "number") return { fn: () => expr, deps: [] };
  const n = Number(expr);
  if (!Number.isNaN(n) && expr.trim() !== "") return { fn: () => n, deps: [] };
  try {
    const node = parse(expr);
    const deps: string[] = [];
    node.traverse((child, path, parent) => {
      const c = child as { isSymbolNode?: boolean; name?: string };
      const par = parent as { type?: string } | null;
      if (
        c.isSymbolNode &&
        typeof c.name === "string" &&
        !(par && par.type === "FunctionNode" && path === "fn") &&
        !CONSTANT_NAMES.has(c.name) &&
        !deps.includes(c.name)
      ) {
        deps.push(c.name);
      }
    });
    const compiled: EvalFunction = node.compile();
    return {
      fn: (scope: Scope) => {
        try {
          const v = compiled.evaluate(scope);
          return typeof v === "number" && Number.isFinite(v) ? v : NaN;
        } catch {
          return NaN;
        }
      },
      deps,
    };
  } catch {
    return { fn: () => NaN, deps: [] };
  }
}

/** Memo key from the scope values an expression set actually depends on. */
function depKey(compiled: Compiled[], scope: Scope, exclude: readonly string[]): string {
  const seen = new Set<string>();
  let key = "";
  for (const c of compiled) {
    for (const d of c.deps) {
      if (exclude.includes(d) || seen.has(d)) continue;
      seen.add(d);
      key += `${d}=${scope[d] ?? "?"};`;
    }
  }
  return key;
}

function vec3At(
  parts: readonly [number | string, number | string, (number | string)?],
  scope: Scope,
): THREE.Vector3 | null {
  const x = compileExprCached(parts[0]).fn(scope);
  const y = compileExprCached(parts[1]).fn(scope);
  const z = parts[2] === undefined ? 0 : compileExprCached(parts[2]).fn(scope);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return new THREE.Vector3(x, y, z);
}

/** Tiny cache so per-render evaluation of cheap prims doesn't re-parse. */
const exprCache = new Map<string | number, Compiled>();
function compileExprCached(expr: string | number): Compiled {
  let c = exprCache.get(expr);
  if (!c) {
    c = compileExpr(expr);
    if (exprCache.size > 500) exprCache.clear();
    exprCache.set(expr, c);
  }
  return c;
}

/* ---------------- drag plumbing ---------------- */

interface SceneCtxType {
  setParam: (key: string, value: number) => void;
  setDragging: (on: boolean) => void;
}

const SceneCtx = createContext<SceneCtxType>({ setParam: () => {}, setDragging: () => {} });

/* ---------------- primitive renderers ---------------- */

function PointR({ p, scope, style }: { p: PointPrim; scope: Scope; style: Style }) {
  const ctx = useContext(SceneCtx);
  const [hover, setHover] = useState(false);
  const draggingRef = useRef(false);
  const planeRef = useRef(new THREE.Plane());
  const hitRef = useRef(new THREE.Vector3());

  const pos = vec3At(p.at, scope);
  const draggable = Array.isArray(p.drag) && p.drag.length >= 2;
  const color = resolveColor(p.color, "#60a5fa", style);
  if (!pos) return null;

  const size = (p.size ?? 0.08) * (draggable && hover ? 1.35 : 1);

  return (
    <group position={pos}>
      <mesh
        onPointerOver={draggable ? (e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "grab"; } : undefined}
        onPointerOut={draggable ? () => { setHover(false); if (!draggingRef.current) document.body.style.cursor = ""; } : undefined}
        onPointerDown={
          draggable
            ? (e) => {
                e.stopPropagation();
                draggingRef.current = true;
                ctx.setDragging(true);
                document.body.style.cursor = "grabbing";
                (e.target as Element).setPointerCapture?.(e.pointerId);
                const normal = style.flat
                  ? new THREE.Vector3(0, 0, 1)
                  : e.camera.getWorldDirection(new THREE.Vector3()).negate();
                planeRef.current.setFromNormalAndCoplanarPoint(normal, e.object.getWorldPosition(new THREE.Vector3()));
              }
            : undefined
        }
        onPointerMove={
          draggable
            ? (e) => {
                if (!draggingRef.current || !p.drag) return;
                if (e.ray.intersectPlane(planeRef.current, hitRef.current)) {
                  const r = (v: number) => Math.round(v * 100) / 100;
                  ctx.setParam(p.drag[0], r(hitRef.current.x));
                  ctx.setParam(p.drag[1], r(hitRef.current.y));
                }
              }
            : undefined
        }
        onPointerUp={
          draggable
            ? (e) => {
                draggingRef.current = false;
                ctx.setDragging(false);
                document.body.style.cursor = hover ? "grab" : "";
                (e.target as Element).releasePointerCapture?.(e.pointerId);
              }
            : undefined
        }
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={style.glow ? 1.1 : 0.4} />
      </mesh>
      {draggable && (
        <mesh rotation={style.flat ? [0, 0, 0] : [Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.7, size * 1.95, 32]} />
          <meshBasicMaterial color={color} transparent opacity={hover ? 0.9 : 0.45} side={THREE.DoubleSide} />
        </mesh>
      )}
      {p.label && (
        <Html distanceFactor={10} style={{ pointerEvents: "none" }}>
          <span className="text-[10px] whitespace-nowrap select-none" style={{ color }}>{p.label}</span>
        </Html>
      )}
    </group>
  );
}

const CURVE_EXCLUDE = ["t"] as const;
const CLIP = 50; // coordinates beyond this are treated as "off to infinity"

function CurveR({ p, scope, style }: { p: CurvePrim; scope: Scope; style: Style }) {
  const samples = p.samples ?? 200;
  const fx = useMemo(() => compileExpr(p.x), [p.x]);
  const fy = useMemo(() => compileExpr(p.y), [p.y]);
  const fz = useMemo(() => compileExpr(p.z ?? "0"), [p.z]);
  const key = depKey([fx, fy, fz], scope, CURVE_EXCLUDE);

  // Split into continuous pieces: NaN or |coord| > CLIP breaks the polyline,
  // so tan/1-over-x render as branches instead of jumping through origin.
  const pieces = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    let cur: THREE.Vector3[] = [];
    const s: Scope = { ...scope, t: 0 };
    for (let i = 0; i <= samples; i++) {
      s.t = p.tMin + (i / samples) * (p.tMax - p.tMin);
      const x = fx.fn(s), y = fy.fn(s), z = fz.fn(s);
      const ok =
        Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) &&
        Math.abs(x) < CLIP && Math.abs(y) < CLIP && Math.abs(z) < CLIP;
      if (ok) {
        cur.push(new THREE.Vector3(x, y, z));
      } else if (cur.length > 0) {
        if (cur.length > 1) out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, p.tMin, p.tMax, samples, key]);

  if (pieces.length === 0) return null;
  const color = resolveColor(p.color, "#38bdf8", style);
  const width = p.width ?? 2;
  return (
    <>
      {pieces.map((pts, i) => (
        <group key={i}>
          {style.glow && <Line points={pts} color={color} lineWidth={width + 7} transparent opacity={0.25} />}
          <Line points={pts} color={color} lineWidth={width} />
        </group>
      ))}
    </>
  );
}

const SURFACE_EXCLUDE = ["u", "v"] as const;

function SurfaceR({ p, scope, style }: { p: SurfacePrim; scope: Scope; style: Style }) {
  const us = p.uSamples ?? 48;
  const vs = p.vSamples ?? 48;
  const fx = useMemo(() => compileExpr(p.x), [p.x]);
  const fy = useMemo(() => compileExpr(p.y), [p.y]);
  const fz = useMemo(() => compileExpr(p.z), [p.z]);
  const key = depKey([fx, fy, fz], scope, SURFACE_EXCLUDE);
  const color = resolveColor(p.color, "#3b82f6", style);
  const useColormap = (p.colormap ?? "height") !== "none";

  const geom = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const s: Scope = { ...scope, u: 0, v: 0 };
    for (let j = 0; j <= vs; j++) {
      s.v = p.vMin + (j / vs) * (p.vMax - p.vMin);
      for (let i = 0; i <= us; i++) {
        s.u = p.uMin + (i / us) * (p.uMax - p.uMin);
        const x = fx.fn(s), y = fy.fn(s), z = fz.fn(s);
        positions.push(
          Number.isFinite(x) ? x : 0,
          Number.isFinite(y) ? y : 0,
          Number.isFinite(z) ? z : 0,
        );
      }
    }
    for (let j = 0; j < vs; j++) {
      for (let i = 0; i < us; i++) {
        const a = j * (us + 1) + i;
        const b = a + 1;
        const c = a + (us + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();

    if (useColormap) {
      // height gradient: darkened base colour at the bottom → lightened at the top
      let zMin = Infinity, zMax = -Infinity;
      for (let i = 2; i < positions.length; i += 3) {
        if (positions[i] < zMin) zMin = positions[i];
        if (positions[i] > zMax) zMax = positions[i];
      }
      const range = zMax - zMin || 1;
      const base = new THREE.Color(color);
      const lo = base.clone().multiplyScalar(0.4);
      const hi = base.clone().lerp(new THREE.Color("#ffffff"), 0.45);
      const colors = new Float32Array(positions.length);
      const c = new THREE.Color();
      for (let i = 0; i < positions.length; i += 3) {
        const t = (positions[i + 2] - zMin) / range;
        c.lerpColors(lo, hi, t);
        colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, p.uMin, p.uMax, p.vMin, p.vMax, us, vs, useColormap, color, key]);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={useColormap ? "#ffffff" : color}
        vertexColors={useColormap}
        opacity={p.opacity ?? 0.75}
        transparent={(p.opacity ?? 0.75) < 1}
        wireframe={!!p.wireframe}
        side={THREE.DoubleSide}
        emissive={color}
        emissiveIntensity={style.glow ? 0.3 : 0.06}
      />
    </mesh>
  );
}

const FIELD_EXCLUDE = ["x", "y", "z"] as const;
const UP = new THREE.Vector3(0, 1, 0);

interface FieldArrow {
  base: THREE.Vector3;
  dir: THREE.Vector3;
  len: number;
}

function VectorFieldR({ p, scope, style }: { p: VectorFieldPrim; scope: Scope; style: Style }) {
  const [xMin, xMax, yMin, yMax, zMin = 0, zMax = 0] = p.bounds;
  const d = p.density ?? 8;
  const scale = p.scale ?? 0.3;
  const fx = useMemo(() => compileExpr(p.fx), [p.fx]);
  const fy = useMemo(() => compileExpr(p.fy), [p.fy]);
  const fz = useMemo(() => compileExpr(p.fz ?? "0"), [p.fz]);
  const key = depKey([fx, fy, fz], scope, FIELD_EXCLUDE);
  const color = resolveColor(p.color, "#60a5fa", style);
  const imRef = useRef<THREE.InstancedMesh>(null);

  const arrows = useMemo(() => {
    const out: FieldArrow[] = [];
    const zSteps = zMin === zMax ? 1 : d;
    const cell = Math.min((xMax - xMin) / d, (yMax - yMin) / d) || 1;
    const maxLen = cell * 0.85;
    const s: Scope = { ...scope, x: 0, y: 0, z: 0 };
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        for (let k = 0; k < zSteps; k++) {
          s.x = xMin + ((i + 0.5) / d) * (xMax - xMin);
          s.y = yMin + ((j + 0.5) / d) * (yMax - yMin);
          s.z = zSteps === 1 ? zMin : zMin + ((k + 0.5) / d) * (zMax - zMin);
          const vx = fx.fn(s), vy = fy.fn(s), vz = fz.fn(s);
          if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) continue;
          const mag = Math.hypot(vx, vy, vz);
          if (mag < 1e-6) continue;
          const len = p.normalize ? cell * 0.55 : Math.min(mag * scale, maxLen);
          out.push({
            base: new THREE.Vector3(s.x, s.y, s.z),
            dir: new THREE.Vector3(vx / mag, vy / mag, vz / mag),
            len,
          });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, xMin, xMax, yMin, yMax, zMin, zMax, d, scale, p.normalize, key]);

  // one geometry for every shaft
  const shaftGeom = useMemo(() => {
    const pos = new Float32Array(arrows.length * 6);
    arrows.forEach((a, i) => {
      const headLen = Math.min(a.len * 0.38, 0.16);
      const tip = a.base.clone().addScaledVector(a.dir, a.len - headLen);
      pos[i * 6] = a.base.x; pos[i * 6 + 1] = a.base.y; pos[i * 6 + 2] = a.base.z;
      pos[i * 6 + 3] = tip.x; pos[i * 6 + 4] = tip.y; pos[i * 6 + 5] = tip.z;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [arrows]);
  useEffect(() => () => shaftGeom.dispose(), [shaftGeom]);

  // instanced cone heads
  useEffect(() => {
    const mesh = imRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    arrows.forEach((a, i) => {
      const headLen = Math.min(a.len * 0.38, 0.16);
      const headW = headLen * 0.55;
      dummy.position.copy(a.base).addScaledVector(a.dir, a.len - headLen / 2);
      dummy.quaternion.setFromUnitVectors(UP, a.dir);
      dummy.scale.set(headW, headLen, headW);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = arrows.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [arrows]);

  if (arrows.length === 0) return null;
  return (
    <group>
      <lineSegments geometry={shaftGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </lineSegments>
      <instancedMesh
        key={arrows.length}
        ref={imRef}
        args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, arrows.length]}
      >
        <coneGeometry args={[0.5, 1, 6]} />
        <meshBasicMaterial color={color} />
      </instancedMesh>
    </group>
  );
}

function ArrowR({ p, scope, style }: { p: ArrowPrim; scope: Scope; style: Style }) {
  const from = vec3At(p.from, scope);
  const to = vec3At(p.to, scope);
  if (!from || !to) return null;
  const dir = to.clone().sub(from);
  const length = dir.length();
  if (length < 1e-6) return null;
  const color = resolveColor(p.color, "#fbbf24", style);
  return (
    <>
      <arrowHelper args={[dir.clone().normalize(), from, length, new THREE.Color(color).getHex(), Math.min(0.3, length * 0.2), Math.min(0.15, length * 0.1)]} />
      {p.label && (
        <Html position={to} distanceFactor={10} style={{ pointerEvents: "none" }}>
          <span className="text-[10px] whitespace-nowrap select-none" style={{ color }}>{p.label}</span>
        </Html>
      )}
    </>
  );
}

function PolygonR({ p, scope, style }: { p: PolygonPrim; scope: Scope; style: Style }) {
  const verts: THREE.Vector3[] = [];
  let bad = false;
  for (const v of p.vertices) {
    const pt = vec3At([v[0], v[1], v[2] ?? 0], scope);
    if (!pt) { bad = true; break; }
    verts.push(pt);
  }
  const vertKey = bad ? "bad" : verts.map((v) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`).join(";");

  const geom = useMemo(() => {
    if (bad || verts.length < 3) return null;
    const g = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 1; i < verts.length - 1; i++) {
      positions.push(verts[0].x, verts[0].y, verts[0].z);
      positions.push(verts[i].x, verts[i].y, verts[i].z);
      positions.push(verts[i + 1].x, verts[i + 1].y, verts[i + 1].z);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertKey]);
  useEffect(() => () => { geom?.dispose(); }, [geom]);

  if (!geom) return null;
  const outline = [...verts, verts[0]];
  const color = resolveColor(p.color, "#38bdf8", style);
  const outlineColor = resolveColor(p.outline ?? p.color, "#38bdf8", style);
  return (
    <>
      <mesh geometry={geom}>
        <meshStandardMaterial
          color={color}
          opacity={p.opacity ?? 0.35}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line points={outline} color={outlineColor} lineWidth={1.5} />
    </>
  );
}

function GridR({ p, theme }: { p: GridPrim; theme: VizTheme }) {
  const size = (p.size ?? 5) * 2;
  const divs = p.divisions ?? 10;
  const plane = p.plane ?? "xy";
  const rot: [number, number, number] =
    plane === "xy" ? [Math.PI / 2, 0, 0] : plane === "xz" ? [0, 0, 0] : [0, 0, Math.PI / 2];
  return (
    <Grid
      args={[size, size, divs, divs]}
      rotation={rot}
      cellColor={p.color ?? theme.gridColor}
      sectionColor={p.color ?? theme.gridColor}
      fadeDistance={30}
      infiniteGrid={false}
    />
  );
}

const TICK_COLOR = "#64748b";

function AxesR({ p, style }: { p: AxesPrim; style: Style }) {
  const s = p.size ?? 4;
  const labels = p.labels ?? ["x", "y", "z"];
  const flat = style.flat;
  const showTicks = p.ticks !== false;

  const { tickSegments, tickLabels } = useMemo(() => {
    const segs: [number, number, number][] = [];
    const lbls: { at: [number, number, number]; text: string }[] = [];
    if (!showTicks) return { tickSegments: segs, tickLabels: lbls };
    const step = s <= 5 ? 1 : s <= 12 ? 2 : 5;
    const h = 0.07;
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    for (let v = step; v <= s + 1e-9; v += step) {
      for (const sv of [v, -v]) {
        segs.push([sv, -h, 0], [sv, h, 0]);
        lbls.push({ at: [sv, -0.3, 0], text: fmt(sv) });
        segs.push([-h, sv, 0], [h, sv, 0]);
        lbls.push({ at: [-0.34, sv, 0], text: fmt(sv) });
        if (!flat) {
          segs.push([-h, 0, sv], [h, 0, sv]);
          lbls.push({ at: [-0.34, 0, sv], text: fmt(sv) });
        }
      }
    }
    return { tickSegments: segs, tickLabels: lbls };
  }, [s, flat, showTicks]);

  return (
    <group>
      <Line points={[[-s, 0, 0], [s, 0, 0]]} color="#ef4444" lineWidth={1} />
      <Line points={[[0, -s, 0], [0, s, 0]]} color="#22c55e" lineWidth={1} />
      {!flat && <Line points={[[0, 0, -s], [0, 0, s]]} color="#3b82f6" lineWidth={1} />}
      <Text position={[s + 0.25, 0, 0]} fontSize={0.25} color="#ef4444">{labels[0]}</Text>
      <Text position={[0, s + 0.25, 0]} fontSize={0.25} color="#22c55e">{labels[1]}</Text>
      {!flat && <Text position={[0, 0, s + 0.25]} fontSize={0.25} color="#3b82f6">{labels[2]}</Text>}
      {tickSegments.length > 0 && (
        <Line points={tickSegments} segments color={TICK_COLOR} lineWidth={0.8} transparent opacity={0.8} />
      )}
      {tickLabels.map((t, i) => (
        <Text key={i} position={t.at} fontSize={0.15} color={TICK_COLOR} anchorX="center" anchorY="middle">
          {t.text}
        </Text>
      ))}
    </group>
  );
}

function TextR({ p, scope }: { p: TextPrim; scope: Scope }) {
  const pos = vec3At(p.at, scope);
  if (!pos) return null;
  return (
    <Text position={pos} fontSize={p.size ?? 0.3} color={p.color ?? "#e2e8f0"} anchorX="center" anchorY="middle">
      {p.content}
    </Text>
  );
}

function GroupR({ p, scope, style, theme }: { p: GroupPrim; scope: Scope; style: Style; theme: VizTheme }) {
  let m: THREE.Matrix4 | null = null;
  if (p.matrix && p.matrix.length === 16) {
    const vals = p.matrix.map((e) => compileExprCached(e).fn(scope));
    if (vals.every(Number.isFinite)) m = new THREE.Matrix4().fromArray(vals);
  }
  return (
    <group matrixAutoUpdate={!m} matrix={m ?? undefined}>
      {p.children.map((c, i) => <PrimitiveR key={i} prim={c} scope={scope} style={style} theme={theme} />)}
    </group>
  );
}

function PrimitiveR({ prim, scope, style, theme }: { prim: Primitive; scope: Scope; style: Style; theme: VizTheme }) {
  switch (prim.kind) {
    case "point": return <PointR p={prim} scope={scope} style={style} />;
    case "curve": return <CurveR p={prim} scope={scope} style={style} />;
    case "surface": return <SurfaceR p={prim} scope={scope} style={style} />;
    case "vectorField": return <VectorFieldR p={prim} scope={scope} style={style} />;
    case "arrow": return <ArrowR p={prim} scope={scope} style={style} />;
    case "polygon": return <PolygonR p={prim} scope={scope} style={style} />;
    case "grid": return <GridR p={prim} theme={theme} />;
    case "axes": return <AxesR p={prim} style={style} />;
    case "text": return <TextR p={prim} scope={scope} />;
    case "group": return <GroupR p={prim} scope={scope} style={style} theme={theme} />;
    default: return null;
  }
}

/* ---------------- scene clock (only mounted when the scene uses `time`) ---------------- */

function SceneClock({
  playing,
  speed,
  resetNonce,
  onTick,
}: {
  playing: boolean;
  speed: number;
  resetNonce: number;
  onTick: (t: number) => void;
}) {
  const acc = useRef(0);
  const lastEmit = useRef(-1);
  useEffect(() => {
    acc.current = 0;
    lastEmit.current = -1;
    onTick(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);
  useFrame((_, delta) => {
    if (!playing) return;
    acc.current += Math.min(delta, 0.1) * speed;
    if (acc.current - lastEmit.current > 0.033) {
      lastEmit.current = acc.current;
      onTick(acc.current);
    }
  });
  return null;
}

/** Does any expression in the scene reference `time`? (cheap textual scan) */
function sceneUsesTime(spec: SceneSpec): boolean {
  const re = /\btime\b/;
  const visit = (p: Primitive): boolean => {
    for (const v of Object.values(p as Record<string, unknown>)) {
      if (typeof v === "string" && re.test(v)) return true;
      if (Array.isArray(v) && v.some((e) => typeof e === "string" && re.test(e))) return true;
    }
    return p.kind === "group" && p.children.some(visit);
  };
  return spec.objects.some(visit);
}

/* ---------------- public component ---------------- */

interface Props {
  spec: SceneSpec;
  params: Record<string, number>;
  onParam: (key: string, value: number) => void;
  theme: VizTheme;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrbitControlsImpl = any;

export default function Scene3D({ spec, params, onParam, theme }: Props) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetNonce, setResetNonce] = useState(0);

  const usesTime = useMemo(() => sceneUsesTime(spec), [spec]);
  const scope: Scope = { ...params, time };

  const cam: [number, number, number] = spec.camera ?? (spec.flat ? [0, 0, 8] : [6, 6, 6]);
  const initialCam = useRef(cam);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // The Canvas `camera` prop only applies on mount — when a NEW spec arrives
  // (next scene in a session), honour its designed viewpoint explicitly.
  useEffect(() => {
    initialCam.current = cam;
    const controls = controlsRef.current;
    if (controls) {
      controls.object.position.set(...cam);
      controls.target.set(0, 0, 0);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const style: Style = useMemo(() => {
    const used = collectColors(spec.objects);
    return { colorMap: buildColorMap(used, theme.palette), glow: theme.glow, flat: !!spec.flat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(spec.objects), theme, spec.flat]);

  const sceneCtx = useMemo<SceneCtxType>(
    () => ({
      setParam: onParam,
      setDragging: (on: boolean) => {
        if (controlsRef.current) controlsRef.current.enabled = !on;
      },
    }),
    [onParam],
  );

  // Seed params for draggable points whose keys weren't declared as sliders.
  useEffect(() => {
    const missing: Record<string, number> = {};
    const visit = (p: Primitive) => {
      if (p.kind === "point" && Array.isArray(p.drag)) {
        const pos = vec3At(p.at, { ...params, time: 0 });
        p.drag.slice(0, 2).forEach((k, i) => {
          if (params[k] === undefined && missing[k] === undefined) {
            missing[k] = pos ? (i === 0 ? pos.x : pos.y) : 0;
          }
        });
      }
      if (p.kind === "group") p.children.forEach(visit);
    };
    spec.objects.forEach(visit);
    Object.entries(missing).forEach(([k, v]) => onParam(k, v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  const zoomBy = (factor: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    const target = controls.target;
    const offset = camera.position.clone().sub(target).multiplyScalar(factor);
    camera.position.copy(target.clone().add(offset));
    controls.update();
  };

  const resetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...initialCam.current);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const cycleSpeed = () => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1));

  const btnCls =
    "p-1.5 rounded-md bg-black/40 border border-white/10 text-slate-200 hover:bg-black/60 hover:border-white/30 backdrop-blur-sm transition-colors";

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: cam, fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={[theme.background]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 12, 8]} intensity={0.8} />
        <directionalLight position={[-6, -4, -6]} intensity={0.3} color="#60a5fa" />
        <SceneCtx.Provider value={sceneCtx}>
          <Suspense fallback={null}>
            {spec.objects.map((o, i) => (
              <PrimitiveR key={i} prim={o} scope={scope} style={style} theme={theme} />
            ))}
          </Suspense>
        </SceneCtx.Provider>
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.1}
          enablePan
          enableZoom
          enableRotate={!spec.flat}
          minDistance={1}
          maxDistance={80}
        />
        {usesTime && (
          <SceneClock playing={playing} speed={speed} resetNonce={resetNonce} onTick={setTime} />
        )}
      </Canvas>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
        <button onClick={() => zoomBy(0.8)} title="Zoom in" className={btnCls}>
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => zoomBy(1.25)} title="Zoom out" className={btnCls}>
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={resetView} title="Reset view" className={btnCls}>
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {usesTime && (
        <div className="absolute left-3 bottom-3 flex items-center gap-1.5 z-10">
          <button onClick={() => setPlaying((v) => !v)} title={playing ? "Pause" : "Play"} className={btnCls}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setResetNonce((n) => n + 1)} title="Restart" className={btnCls}>
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button onClick={cycleSpeed} title="Speed" className={`${btnCls} text-[10px] font-semibold w-8 text-center`}>
            {speed === 0.5 ? "½×" : `${speed}×`}
          </button>
          <span className="text-[10px] font-mono text-slate-400 bg-black/40 border border-white/10 rounded-md px-1.5 py-1 backdrop-blur-sm">
            t = {time.toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  );
}
