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
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause, SkipBack, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  SceneSpec,
  Primitive,
  PointPrim,
  PointsPrim,
  RegionFillPrim,
  BarsPrim,
  CurvePrim,
  SegmentPrim,
  ArcPrim,
  AngleMarkPrim,
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
import MathRenderer from "@/components/MathRenderer";

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

/* ---------------- label de-overlap manager ----------------
 *
 * Every text label (point names, segment/arrow labels, angle marks, LaTeX
 * annotations) registers its world anchor and DOM element here. Each frame
 * the manager projects all anchors to screen space and nudges colliding
 * labels apart vertically — higher-priority labels (deliberate formulas)
 * hold their place, incidental point names move around them. This is what
 * stops "O" and "B" from mashing into "OB".
 */

interface LabelReg {
  worldRef: { current: THREE.Vector3 };
  elRef: { current: HTMLDivElement | null };
  baseX: number;
  baseY: number;
  w: number;
  h: number;
  priority: number;
}

interface LabelApi {
  add: (r: LabelReg) => void;
  remove: (r: LabelReg) => void;
}

const LabelMgrCtx = createContext<LabelApi | null>(null);

function LabelLayer({ children }: { children: React.ReactNode }) {
  const regs = useRef<Set<LabelReg>>(new Set());
  const api = useMemo<LabelApi>(
    () => ({ add: (r) => regs.current.add(r), remove: (r) => regs.current.delete(r) }),
    [],
  );
  const proj = useRef(new THREE.Vector3());

  useFrame((state) => {
    if (regs.current.size === 0) return;
    const cam = state.camera;
    const W = state.size.width;
    const H = state.size.height;
    const items: { r: LabelReg; x: number; y0: number }[] = [];
    regs.current.forEach((r) => {
      if (!r.elRef.current) return;
      proj.current.copy(r.worldRef.current).project(cam);
      if (proj.current.z > 1) return; // behind the camera
      const x = (proj.current.x * 0.5 + 0.5) * W + r.baseX;
      const y0 = (-proj.current.y * 0.5 + 0.5) * H + r.baseY;
      items.push({ r, x, y0 });
    });
    // deliberate labels first (they anchor), then top-to-bottom
    items.sort((a, b) => b.r.priority - a.r.priority || a.y0 - b.y0);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const it of items) {
      let y = it.y0;
      let guard = 0;
      let moved = true;
      while (moved && guard++ < 24) {
        moved = false;
        for (const p of placed) {
          if (Math.abs(it.x - p.x) < (it.r.w + p.w) / 2 && Math.abs(y - p.y) < (it.r.h + p.h) / 2) {
            y = p.y + (it.r.h + p.h) / 2 + 2;
            moved = true;
          }
        }
      }
      placed.push({ x: it.x, y, w: it.r.w, h: it.r.h });
      const el = it.r.elRef.current;
      if (el) {
        const want = `translate(${it.r.baseX}px, ${(it.r.baseY + (y - it.y0)).toFixed(1)}px)`;
        if (el.style.transform !== want) el.style.transform = want;
      }
    }
  });

  return <LabelMgrCtx.Provider value={api}>{children}</LabelMgrCtx.Provider>;
}

function SceneLabel({
  world,
  children,
  baseX = 0,
  baseY = 0,
  priority = 0,
  approxChars = 3,
  fontPx = 11,
  style,
}: {
  world: THREE.Vector3;
  children: React.ReactNode;
  baseX?: number;
  baseY?: number;
  priority?: number;
  approxChars?: number;
  fontPx?: number;
  style?: React.CSSProperties;
}) {
  const mgr = useContext(LabelMgrCtx);
  const worldRef = useRef(world);
  worldRef.current = world;
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mgr) return;
    const reg: LabelReg = {
      worldRef,
      elRef,
      baseX,
      baseY,
      w: approxChars * fontPx * 0.62 + 8,
      h: fontPx * 1.4,
      priority,
    };
    mgr.add(reg);
    return () => mgr.remove(reg);
  }, [mgr, baseX, baseY, priority, approxChars, fontPx]);

  return (
    <Html position={world} center distanceFactor={10} style={{ pointerEvents: "none" }}>
      <div ref={elRef} style={{ transform: `translate(${baseX}px, ${baseY}px)`, willChange: "transform", ...style }}>
        {children}
      </div>
    </Html>
  );
}

/* ---------------- staging: step visibility + entrance animation ----------------
 *
 * A primitive tagged `step: n` renders from the n-th step onward. Whenever a
 * primitive BECOMES visible (scene mount or step advance), it animates in:
 * line-like primitives draw themselves on, points/marks/text grow, surfaces
 * and fields fade. `progress` (0→1, eased) drives all of it.
 */

function useEntrance(visible: boolean): number {
  const [progress, setProgress] = useState(0);
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      prevVisible.current = true;
      const t0 = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 700);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (!visible && prevVisible.current) {
      prevVisible.current = false;
      setProgress(0);
    }
  }, [visible]);
  return visible ? progress : 0;
}

function StagedPrim({
  prim,
  stepIdx,
  scope,
  style,
  theme,
}: {
  prim: Primitive;
  stepIdx: number;
  scope: Scope;
  style: Style;
  theme: VizTheme;
}) {
  const visible = (prim.step ?? 1) - 1 <= stepIdx;
  const progress = useEntrance(visible);
  if (!visible) return null;
  return <PrimitiveR prim={prim} scope={scope} style={style} theme={theme} progress={progress} />;
}

/* ---------------- primitive renderers ---------------- */

function PointR({ p, scope, style, progress }: { p: PointPrim; scope: Scope; style: Style; progress: number }) {
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
    <>
    <group position={pos} scale={Math.max(progress, 0.001)}>
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
    </group>
    {/* label lives at scene root (absolute world pos) so it isn't double-translated by the group */}
    {p.label && (
      <SceneLabel world={pos} baseX={11} baseY={-11} priority={0} approxChars={p.label.length} fontPx={11}>
        <span className="text-[11px] whitespace-nowrap select-none" style={{ color }}>{p.label}</span>
      </SceneLabel>
    )}
    </>
  );
}

const CURVE_EXCLUDE = ["t"] as const;
const CLIP = 50; // coordinates beyond this are treated as "off to infinity"

function CurveR({ p, scope, style, progress }: { p: CurvePrim; scope: Scope; style: Style; progress: number }) {
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

  // draw-on entrance: reveal the polyline point-by-point as progress rises
  const drawn = useMemo(() => {
    if (progress >= 1) return pieces;
    const total = pieces.reduce((n, pc) => n + pc.length, 0);
    let budget = Math.max(2, Math.floor(total * progress));
    const out: THREE.Vector3[][] = [];
    for (const pc of pieces) {
      if (budget < 2) break;
      if (pc.length <= budget) {
        out.push(pc);
        budget -= pc.length;
      } else {
        out.push(pc.slice(0, budget));
        break;
      }
    }
    return out;
  }, [pieces, progress]);

  if (drawn.length === 0) return null;
  const color = resolveColor(p.color, "#38bdf8", style);
  const width = p.width ?? 2;
  return (
    <>
      {drawn.map((pts, i) => (
        <group key={i}>
          {style.glow && !p.dash && (
            <Line points={pts} color={color} lineWidth={width + 7} transparent opacity={0.25} />
          )}
          <Line
            points={pts}
            color={color}
            lineWidth={width}
            dashed={!!p.dash}
            dashSize={0.16}
            gapSize={0.1}
          />
        </group>
      ))}
    </>
  );
}

/* ----- plane-geometry primitives: segment, arc, angle mark ----- */

function SegmentR({ p, scope, style, progress }: { p: SegmentPrim; scope: Scope; style: Style; progress: number }) {
  const from = vec3At(p.from, scope);
  const to = vec3At(p.to, scope);
  if (!from || !to) return null;
  const color = resolveColor(p.color, "#38bdf8", style);
  const end = progress < 1 ? from.clone().lerp(to, Math.max(progress, 0.02)) : to;

  // equal-length tick marks at the midpoint, perpendicular in the XY plane
  const marks: THREE.Vector3[][] = [];
  if (p.marks && progress > 0.6) {
    const dir = to.clone().sub(from).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.12);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const n = Math.min(p.marks, 3);
    for (let i = 0; i < n; i++) {
      const c = mid.clone().addScaledVector(dir, (i - (n - 1) / 2) * 0.09);
      marks.push([c.clone().sub(perp), c.clone().add(perp)]);
    }
  }

  return (
    <>
      <Line points={[from, end]} color={color} lineWidth={p.width ?? 2} dashed={!!p.dash} dashSize={0.16} gapSize={0.1} />
      {marks.map((m, i) => (
        <Line key={i} points={m} color={color} lineWidth={1.5} />
      ))}
      {p.label && (
        <SceneLabel world={from.clone().add(to).multiplyScalar(0.5)} baseX={0} baseY={-11} priority={2} approxChars={p.label.length} fontPx={11}>
          <span className="text-[11px] whitespace-nowrap select-none" style={{ color }}>{p.label}</span>
        </SceneLabel>
      )}
    </>
  );
}

function ArcR({ p, scope, style, progress }: { p: ArcPrim; scope: Scope; style: Style; progress: number }) {
  const center = vec3At(p.center, scope);
  const radius = compileExprCached(p.radius).fn(scope);
  const a0 = compileExprCached(p.from).fn(scope);
  const a1 = compileExprCached(p.to).fn(scope);
  if (!center || !Number.isFinite(radius) || !Number.isFinite(a0) || !Number.isFinite(a1)) return null;
  const sweep = (a1 - a0) * Math.min(progress, 1);
  const pts: THREE.Vector3[] = [];
  const n = Math.max(8, Math.ceil(Math.abs(sweep) * 24));
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * sweep;
    pts.push(new THREE.Vector3(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a), center.z));
  }
  if (pts.length < 2) return null;
  const color = resolveColor(p.color, "#38bdf8", style);
  return (
    <Line points={pts} color={color} lineWidth={p.width ?? 2} dashed={!!p.dash} dashSize={0.16} gapSize={0.1} />
  );
}

function AngleMarkR({ p, scope, style, progress }: { p: AngleMarkPrim; scope: Scope; style: Style; progress: number }) {
  const at = vec3At(p.at, scope);
  const from = vec3At(p.from, scope);
  const to = vec3At(p.to, scope);
  if (!at || !from || !to) return null;
  const a0 = Math.atan2(from.y - at.y, from.x - at.x);
  let a1 = Math.atan2(to.y - at.y, to.x - at.x);
  // take the sweep on the short way round so the mark sits inside the angle
  while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
  const r = p.radius ?? 0.45;
  const color = resolveColor(p.color, "#fbbf24", style);
  const mid = (a0 + a1) / 2;

  let markPts: THREE.Vector3[];
  if (p.right) {
    // right-angle square: corner at distance r along both rays
    const c1 = new THREE.Vector3(at.x + r * Math.cos(a0), at.y + r * Math.sin(a0), at.z);
    const c2 = new THREE.Vector3(at.x + r * Math.cos(a1), at.y + r * Math.sin(a1), at.z);
    const corner = c1.clone().add(c2).sub(at);
    markPts = [c1, corner, c2];
  } else {
    markPts = [];
    const sweep = (a1 - a0) * Math.min(progress, 1);
    const n = Math.max(6, Math.ceil(Math.abs(sweep) * 16));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * sweep;
      markPts.push(new THREE.Vector3(at.x + r * Math.cos(a), at.y + r * Math.sin(a), at.z));
    }
  }

  const labelPos = new THREE.Vector3(at.x + r * 1.75 * Math.cos(mid), at.y + r * 1.75 * Math.sin(mid), at.z);
  return (
    <>
      <group scale={p.right ? Math.max(progress, 0.001) : 1}>
        <Line points={markPts} color={color} lineWidth={1.8} />
      </group>
      {p.label && progress > 0.5 && (
        <SceneLabel world={labelPos} priority={6} approxChars={p.label.length + 1} fontPx={13}>
          <span className="text-[11px] whitespace-nowrap select-none" style={{ color }}>
            <MathRenderer content={`$${p.label}$`} />
          </span>
        </SceneLabel>
      )}
    </>
  );
}

/* ----- bulk indexed points: lattices, sieves, samples ----- */

const POINTS_EXCLUDE = ["i"] as const;

function PointsR({ p, scope, style, theme, progress }: { p: PointsPrim; scope: Scope; style: Style; theme: VizTheme; progress: number }) {
  const fx = useMemo(() => compileExpr(p.x), [p.x]);
  const fy = useMemo(() => compileExpr(p.y), [p.y]);
  const fz = useMemo(() => compileExpr(p.z ?? "0"), [p.z]);
  const fc = useMemo(() => (p.colorBy ? compileExpr(p.colorBy) : null), [p.colorBy]);
  const fcount = useMemo(() => compileExpr(p.count), [p.count]);
  const key = depKey(fc ? [fx, fy, fz, fc, fcount] : [fx, fy, fz, fcount], scope, POINTS_EXCLUDE);
  const imRef = useRef<THREE.InstancedMesh>(null);
  const baseColor = resolveColor(p.color, theme.palette[0] ?? "#60a5fa", style);
  // count may depend on a slider — evaluate + clamp each render
  const count = Math.max(0, Math.min(600, Math.round(fcount.fn(scope)) || 0));

  const data = useMemo(() => {
    const out: { pos: THREE.Vector3; palette: number }[] = [];
    const s: Scope = { ...scope, i: 0 };
    for (let i = 0; i < count; i++) {
      s.i = i;
      const x = fx.fn(s), y = fy.fn(s), z = fz.fn(s);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      let palette = -1;
      if (fc) {
        const c = fc.fn(s);
        if (Number.isFinite(c)) palette = ((Math.floor(c) % theme.palette.length) + theme.palette.length) % theme.palette.length;
      }
      out.push({ pos: new THREE.Vector3(x, y, z), palette });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, fc, count, theme, key]);

  useEffect(() => {
    const mesh = imRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    data.forEach((d, i) => {
      dummy.position.copy(d.pos);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.set(d.palette >= 0 ? theme.palette[d.palette] : baseColor);
      mesh.setColorAt(i, col);
    });
    mesh.count = data.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data, theme, baseColor]);

  if (data.length === 0) return null;
  const size = p.size ?? 0.07;
  return (
    <group scale={Math.max(progress, 0.001)}>
      <instancedMesh
        key={data.length}
        ref={imRef}
        args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, data.length]}
      >
        <sphereGeometry args={[size, 10, 10]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

/* ----- region fill: area under / between curves (integrals, probability) ----- */

const REGION_EXCLUDE = ["t"] as const;

function RegionFillR({ p, scope, style, progress }: { p: RegionFillPrim; scope: Scope; style: Style; progress: number }) {
  const samples = p.samples ?? 64;
  const fx = useMemo(() => compileExpr(p.x ?? "t"), [p.x]);
  const fTop = useMemo(() => compileExpr(p.yTop), [p.yTop]);
  const fBot = useMemo(() => compileExpr(p.yBottom ?? "0"), [p.yBottom]);
  const fMin = useMemo(() => compileExpr(p.tMin), [p.tMin]);
  const fMax = useMemo(() => compileExpr(p.tMax), [p.tMax]);
  const key = depKey([fx, fTop, fBot, fMin, fMax], scope, REGION_EXCLUDE);
  const color = resolveColor(p.color, "#38bdf8", style);
  const showOutline = p.outline !== false;

  const { geom, topPts } = useMemo(() => {
    const tMin = fMin.fn(scope);
    const tMax = fMax.fn(scope);
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin === tMax) {
      return { geom: null as THREE.BufferGeometry | null, topPts: [] as THREE.Vector3[] };
    }
    const positions: number[] = [];
    const indices: number[] = [];
    const top: THREE.Vector3[] = [];
    const s: Scope = { ...scope, t: 0 };
    let valid = 0;
    for (let i = 0; i <= samples; i++) {
      s.t = tMin + (i / samples) * (tMax - tMin);
      const x = fx.fn(s);
      const yt = fTop.fn(s);
      const yb = fBot.fn(s);
      if (!Number.isFinite(x) || !Number.isFinite(yt) || !Number.isFinite(yb)) continue;
      positions.push(x, yb, 0, x, yt, 0); // bottom, top vertex for this column
      top.push(new THREE.Vector3(x, yt, 0.001));
      valid++;
      if (valid >= 2) {
        const b = (valid - 2) * 2; // previous bottom index
        // quad (prevBot, prevTop, curBot, curTop) → two triangles
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    if (valid < 2) return { geom: null as THREE.BufferGeometry | null, topPts: [] as THREE.Vector3[] };
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return { geom: g, topPts: top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fTop, fBot, fMin, fMax, samples, key]);

  useEffect(() => () => geom?.dispose(), [geom]);
  if (!geom) return null;
  const opacity = (p.opacity ?? 0.32) * (0.15 + 0.85 * progress);
  return (
    <>
      <mesh geometry={geom}>
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {showOutline && topPts.length > 1 && (
        <Line points={topPts} color={color} lineWidth={2} transparent opacity={Math.max(progress, 0.05)} />
      )}
    </>
  );
}

/* ----- bars: histograms, distributions, Riemann rectangles ----- */

const BARS_EXCLUDE = ["i"] as const;

function BarsR({ p, scope, style, theme, progress }: { p: BarsPrim; scope: Scope; style: Style; theme: VizTheme; progress: number }) {
  const fx = useMemo(() => compileExpr(p.x), [p.x]);
  const fh = useMemo(() => compileExpr(p.height), [p.height]);
  const fcount = useMemo(() => compileExpr(p.count), [p.count]);
  const fwidth = useMemo(() => (p.width !== undefined ? compileExpr(p.width) : null), [p.width]);
  const fbase = useMemo(() => compileExpr(p.base ?? "0"), [p.base]);
  const fc = useMemo(() => (p.colorBy ? compileExpr(p.colorBy) : null), [p.colorBy]);
  const count = Math.max(0, Math.min(400, Math.round(fcount.fn(scope)) || 0));
  const key = depKey([fx, fh, fcount, fbase, ...(fwidth ? [fwidth] : []), ...(fc ? [fc] : [])], scope, BARS_EXCLUDE);
  const imRef = useRef<THREE.InstancedMesh>(null);
  const baseColor = resolveColor(p.color, "#38bdf8", style);

  const data = useMemo(() => {
    const out: { cx: number; cy: number; w: number; h: number; palette: number }[] = [];
    const s: Scope = { ...scope, i: 0 };
    const base = fbase.fn(scope);
    const b = Number.isFinite(base) ? base : 0;
    // infer default width from mean neighbour spacing when not given
    let autoW = 0.8;
    if (!fwidth && count > 1) {
      const x0 = ((s.i = 0), fx.fn(s));
      const x1 = ((s.i = 1), fx.fn(s));
      if (Number.isFinite(x0) && Number.isFinite(x1) && x1 !== x0) autoW = Math.abs(x1 - x0) * 0.8;
    }
    for (let i = 0; i < count; i++) {
      s.i = i;
      const x = fx.fn(s);
      const hRaw = fh.fn(s);
      if (!Number.isFinite(x) || !Number.isFinite(hRaw)) continue;
      const w = fwidth ? fwidth.fn(s) : autoW;
      if (!Number.isFinite(w) || w <= 0) continue;
      let palette = -1;
      if (fc) {
        const c = fc.fn(s);
        if (Number.isFinite(c)) palette = ((Math.floor(c) % theme.palette.length) + theme.palette.length) % theme.palette.length;
      }
      out.push({ cx: x, cy: b + hRaw / 2, w, h: hRaw, palette });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fh, fwidth, fbase, fc, count, theme, key]);

  useEffect(() => {
    const mesh = imRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    data.forEach((d, i) => {
      dummy.position.set(d.cx, d.cy, 0);
      dummy.scale.set(Math.max(d.w * 0.92, 1e-3), Math.max(Math.abs(d.h) * progress, 1e-3), Math.max(d.w * 0.92, 1e-3));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.set(d.palette >= 0 ? theme.palette[d.palette] : baseColor);
      mesh.setColorAt(i, col);
    });
    mesh.count = data.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data, theme, baseColor, progress]);

  if (data.length === 0) return null;
  return (
    <instancedMesh
      key={data.length}
      ref={imRef}
      args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, data.length]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        transparent
        opacity={0.9}
        emissiveIntensity={style.glow ? 0.35 : 0.12}
        roughness={0.5}
      />
    </instancedMesh>
  );
}

const SURFACE_EXCLUDE = ["u", "v"] as const;

function SurfaceR({ p, scope, style, progress }: { p: SurfacePrim; scope: Scope; style: Style; progress: number }) {
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
        opacity={(p.opacity ?? 0.75) * (0.15 + 0.85 * progress)}
        transparent={(p.opacity ?? 0.75) * (0.15 + 0.85 * progress) < 1}
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

function VectorFieldR({ p, scope, style, progress }: { p: VectorFieldPrim; scope: Scope; style: Style; progress: number }) {
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
        <lineBasicMaterial color={color} transparent opacity={0.85 * progress} />
      </lineSegments>
      <instancedMesh
        key={arrows.length}
        ref={imRef}
        args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, arrows.length]}
      >
        <coneGeometry args={[0.5, 1, 6]} />
        <meshBasicMaterial color={color} transparent opacity={progress} />
      </instancedMesh>
    </group>
  );
}

function ArrowR({ p, scope, style, progress }: { p: ArrowPrim; scope: Scope; style: Style; progress: number }) {
  const from = vec3At(p.from, scope);
  const fullTo = vec3At(p.to, scope);
  if (!from || !fullTo) return null;
  const to = progress < 1 ? from.clone().lerp(fullTo, Math.max(progress, 0.02)) : fullTo;
  const dir = to.clone().sub(from);
  const length = dir.length();
  if (length < 1e-6) return null;
  const color = resolveColor(p.color, "#fbbf24", style);
  return (
    <>
      <arrowHelper args={[dir.clone().normalize(), from, length, new THREE.Color(color).getHex(), Math.min(0.3, length * 0.2), Math.min(0.15, length * 0.1)]} />
      {p.label && (
        <SceneLabel world={to} baseX={11} baseY={-11} priority={2} approxChars={p.label.length} fontPx={11}>
          <span className="text-[11px] whitespace-nowrap select-none" style={{ color }}>{p.label}</span>
        </SceneLabel>
      )}
    </>
  );
}

function PolygonR({ p, scope, style, progress }: { p: PolygonPrim; scope: Scope; style: Style; progress: number }) {
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
          opacity={(p.opacity ?? 0.35) * progress}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line points={outline} color={outlineColor} lineWidth={1.5} transparent opacity={Math.max(progress, 0.05)} />
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

/**
 * Interpolate ${expr} placeholders in a text label against the live scope, so
 * a readout can show a computed value that tracks the sliders/drag ("area =
 * ${...}", "\\omega = ${...}", "\\sum\\deg = ${2*E}"). Non-finite → "?".
 * Integers print clean; otherwise 2 dp. Everything outside ${...} is untouched,
 * so it composes with KaTeX ($...$ math) without collision.
 */
function interpolateContent(content: string, scope: Scope): string {
  if (!content.includes("${")) return content;
  return content.replace(/\$\{([^}]+)\}/g, (_m, e: string) => {
    const v = compileExprCached(e.trim()).fn(scope);
    if (!Number.isFinite(v)) return "?";
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  });
}

function TextR({ p, scope, progress }: { p: TextPrim; scope: Scope; progress: number }) {
  const pos = vec3At(p.at, scope);
  if (!pos) return null;
  const content = interpolateContent(p.content, scope);
  if (p.latex) {
    return (
      <SceneLabel world={pos} priority={10} approxChars={content.length} fontPx={(p.size ?? 0.3) * 46} style={{ opacity: progress }}>
        <span
          className="whitespace-nowrap select-none"
          style={{ color: p.color ?? "#e2e8f0", fontSize: `${(p.size ?? 0.3) * 46}px` }}
        >
          <MathRenderer content={`$${content}$`} />
        </span>
      </SceneLabel>
    );
  }
  return (
    <Text
      position={pos}
      fontSize={p.size ?? 0.3}
      color={p.color ?? "#e2e8f0"}
      anchorX="center"
      anchorY="middle"
      fillOpacity={progress}
    >
      {content}
    </Text>
  );
}

function GroupR({ p, scope, style, theme, progress }: { p: GroupPrim; scope: Scope; style: Style; theme: VizTheme; progress: number }) {
  let m: THREE.Matrix4 | null = null;
  if (p.matrix && p.matrix.length === 16) {
    const vals = p.matrix.map((e) => compileExprCached(e).fn(scope));
    if (vals.every(Number.isFinite)) m = new THREE.Matrix4().fromArray(vals);
  }
  return (
    <group matrixAutoUpdate={!m} matrix={m ?? undefined}>
      {p.children.map((c, i) => (
        <PrimitiveR key={i} prim={c} scope={scope} style={style} theme={theme} progress={progress} />
      ))}
    </group>
  );
}

function PrimitiveR({ prim, scope, style, theme, progress = 1 }: { prim: Primitive; scope: Scope; style: Style; theme: VizTheme; progress?: number }) {
  switch (prim.kind) {
    case "point": return <PointR p={prim} scope={scope} style={style} progress={progress} />;
    case "points": return <PointsR p={prim} scope={scope} style={style} theme={theme} progress={progress} />;
    case "regionFill": return <RegionFillR p={prim} scope={scope} style={style} progress={progress} />;
    case "bars": return <BarsR p={prim} scope={scope} style={style} theme={theme} progress={progress} />;
    case "curve": return <CurveR p={prim} scope={scope} style={style} progress={progress} />;
    case "segment": return <SegmentR p={prim} scope={scope} style={style} progress={progress} />;
    case "arc": return <ArcR p={prim} scope={scope} style={style} progress={progress} />;
    case "angleMark": return <AngleMarkR p={prim} scope={scope} style={style} progress={progress} />;
    case "surface": return <SurfaceR p={prim} scope={scope} style={style} progress={progress} />;
    case "vectorField": return <VectorFieldR p={prim} scope={scope} style={style} progress={progress} />;
    case "arrow": return <ArrowR p={prim} scope={scope} style={style} progress={progress} />;
    case "polygon": return <PolygonR p={prim} scope={scope} style={style} progress={progress} />;
    case "grid": return <GridR p={prim} theme={theme} />;
    case "axes": return <AxesR p={prim} style={style} />;
    case "text": return <TextR p={prim} scope={scope} progress={progress} />;
    case "group": return <GroupR p={prim} scope={scope} style={style} theme={theme} progress={progress} />;
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
    for (const v of Object.values(p as unknown as Record<string, unknown>)) {
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
  /** height (px) of any panel overlaying the canvas bottom (e.g. sliders) */
  bottomInset?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrbitControlsImpl = any;

let specSeq = 0;

export default function Scene3D({ spec, params, onParam, theme, bottomInset = 0 }: Props) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetNonce, setResetNonce] = useState(0);

  const steps = spec.steps ?? [];
  const hasSteps = steps.length > 0;
  const [stepIdx, setStepIdx] = useState(0);
  // remount primitives per scene so entrance animations replay
  const specKey = useMemo(() => ++specSeq, [spec]);

  const usesTime = useMemo(() => sceneUsesTime(spec), [spec]);
  const scope: Scope = { ...params, time };

  const cam: [number, number, number] = spec.camera ?? (spec.flat ? [0, 0, 8] : [6, 6, 6]);
  const initialCam = useRef(cam);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // The Canvas `camera` prop only applies on mount — when a NEW spec arrives
  // (next scene in a session), honour its designed viewpoint explicitly.
  useEffect(() => {
    initialCam.current = cam;
    setStepIdx(0);
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
          <LabelLayer>
            <Suspense fallback={null}>
              {spec.objects.map((o, i) => (
                <StagedPrim key={`${specKey}-${i}`} prim={o} stepIdx={stepIdx} scope={scope} style={style} theme={theme} />
              ))}
            </Suspense>
          </LabelLayer>
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
        <div className="absolute left-3 flex items-center gap-1.5 z-10" style={{ bottom: 12 + bottomInset }}>
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

      {/* step player — constructions & proofs advance one logical move at a time */}
      {hasSteps && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 max-w-[78%]"
          style={{ bottom: 12 + bottomInset }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              title="Previous step"
              className={`${btnCls} disabled:opacity-30 disabled:pointer-events-none`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="text-center px-3 py-1.5 rounded-md bg-black/50 border border-white/10 backdrop-blur-sm min-w-[180px]">
              <div className="text-[11px] font-semibold text-slate-100">
                {stepIdx + 1}/{steps.length} · {steps[stepIdx]?.title}
              </div>
              {steps[stepIdx]?.caption && (
                <div className="text-[10px] text-slate-400 mt-0.5">{steps[stepIdx].caption}</div>
              )}
            </div>
            <button
              onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
              disabled={stepIdx === steps.length - 1}
              title="Next step"
              className={`${btnCls} disabled:opacity-30 disabled:pointer-events-none ${
                stepIdx < steps.length - 1 ? "border-sky-400/50" : ""
              }`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx ? "w-4 bg-sky-400" : i < stepIdx ? "w-1.5 bg-sky-400/50" : "w-1.5 bg-white/20"
                }`}
                title={steps[i].title}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
