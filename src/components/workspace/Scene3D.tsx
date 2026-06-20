import { useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Line, Text, Html } from "@react-three/drei";
import { evaluate, parse, type EvalFunction } from "mathjs";
import * as THREE from "three";
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

/* ---------------- expression compiler with safe fallback ---------------- */

type Scope = Record<string, number>;

function compile(expr: string | number): (scope: Scope) => number {
  if (typeof expr === "number") return () => expr;
  // numeric literal fast-path
  const n = Number(expr);
  if (!Number.isNaN(n) && expr.trim() !== "") return () => n;
  try {
    const node: EvalFunction = parse(expr).compile();
    return (scope: Scope) => {
      try {
        const v = node.evaluate(scope);
        return typeof v === "number" && Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

function vec3(
  parts: [number | string, number | string, (number | string)?],
): (s: Scope) => THREE.Vector3 {
  const fx = compile(parts[0]);
  const fy = compile(parts[1]);
  const fz = compile(parts[2] ?? 0);
  return (s) => new THREE.Vector3(fx(s), fy(s), fz(s));
}

/* ---------------- primitive renderers ---------------- */

function PointR({ p, scope }: { p: PointPrim; scope: Scope }) {
  const getPos = useMemo(() => vec3(p.at), [p.at]);
  const pos = getPos(scope);
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[p.size ?? 0.08, 16, 16]} />
        <meshStandardMaterial color={p.color ?? "#60a5fa"} emissive={p.color ?? "#60a5fa"} emissiveIntensity={0.4} />
      </mesh>
      {p.label && (
        <Html distanceFactor={10} style={{ pointerEvents: "none" }}>
          <span className="text-[10px] text-sky-200/90 whitespace-nowrap select-none">{p.label}</span>
        </Html>
      )}
    </group>
  );
}

function CurveR({ p, scope }: { p: CurvePrim; scope: Scope }) {
  const samples = p.samples ?? 200;
  const fx = useMemo(() => compile(p.x), [p.x]);
  const fy = useMemo(() => compile(p.y), [p.y]);
  const fz = useMemo(() => compile(p.z ?? "0"), [p.z]);
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = p.tMin + (i / samples) * (p.tMax - p.tMin);
      const s = { ...scope, t };
      const x = fx(s), y = fy(s), z = fz(s);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        out.push(new THREE.Vector3(x, y, z));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, p.tMin, p.tMax, samples, JSON.stringify(scope)]);
  if (pts.length < 2) return null;
  return <Line points={pts} color={p.color ?? "#38bdf8"} lineWidth={p.width ?? 2} />;
}

function SurfaceR({ p, scope }: { p: SurfacePrim; scope: Scope }) {
  const us = p.uSamples ?? 48;
  const vs = p.vSamples ?? 48;
  const fx = useMemo(() => compile(p.x), [p.x]);
  const fy = useMemo(() => compile(p.y), [p.y]);
  const fz = useMemo(() => compile(p.z), [p.z]);
  const geom = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let j = 0; j <= vs; j++) {
      const v = p.vMin + (j / vs) * (p.vMax - p.vMin);
      for (let i = 0; i <= us; i++) {
        const u = p.uMin + (i / us) * (p.uMax - p.uMin);
        const s = { ...scope, u, v };
        const x = fx(s), y = fy(s), z = fz(s);
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
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, p.uMin, p.uMax, p.vMin, p.vMax, us, vs, JSON.stringify(scope)]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={p.color ?? "#3b82f6"}
        opacity={p.opacity ?? 0.7}
        transparent={(p.opacity ?? 0.7) < 1}
        wireframe={!!p.wireframe}
        side={THREE.DoubleSide}
        emissive={p.color ?? "#3b82f6"}
        emissiveIntensity={0.08}
      />
    </mesh>
  );
}

function VectorFieldR({ p, scope }: { p: VectorFieldPrim; scope: Scope }) {
  const [xMin, xMax, yMin, yMax, zMin = 0, zMax = 0] = p.bounds;
  const d = p.density ?? 8;
  const scale = p.scale ?? 0.3;
  const fx = useMemo(() => compile(p.fx), [p.fx]);
  const fy = useMemo(() => compile(p.fy), [p.fy]);
  const fz = useMemo(() => compile(p.fz ?? "0"), [p.fz]);
  const arrows = useMemo(() => {
    const out: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
    const zSteps = zMin === zMax ? 1 : d;
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        for (let k = 0; k < zSteps; k++) {
          const x = xMin + ((i + 0.5) / d) * (xMax - xMin);
          const y = yMin + ((j + 0.5) / d) * (yMax - yMin);
          const z = zSteps === 1 ? zMin : zMin + ((k + 0.5) / d) * (zMax - zMin);
          const s = { ...scope, x, y, z };
          const vx = fx(s), vy = fy(s), vz = fz(s);
          if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) continue;
          out.push({
            from: new THREE.Vector3(x, y, z),
            to: new THREE.Vector3(x + vx * scale, y + vy * scale, z + vz * scale),
          });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx, fy, fz, xMin, xMax, yMin, yMax, zMin, zMax, d, scale, JSON.stringify(scope)]);
  return (
    <group>
      {arrows.map((a, i) => (
        <Line key={i} points={[a.from, a.to]} color={p.color ?? "#60a5fa"} lineWidth={1.2} />
      ))}
    </group>
  );
}

function ArrowR({ p, scope }: { p: ArrowPrim; scope: Scope }) {
  const from = vec3(p.from)(scope);
  const to = vec3(p.to)(scope);
  const dir = to.clone().sub(from);
  const length = dir.length();
  if (length < 1e-6) return null;
  return (
    <>
      <arrowHelper args={[dir.clone().normalize(), from, length, new THREE.Color(p.color ?? "#fbbf24").getHex(), Math.min(0.3, length * 0.2), Math.min(0.15, length * 0.1)]} />
      {p.label && (
        <Html position={to} distanceFactor={10} style={{ pointerEvents: "none" }}>
          <span className="text-[10px] text-amber-200 whitespace-nowrap select-none">{p.label}</span>
        </Html>
      )}
    </>
  );
}

function PolygonR({ p, scope }: { p: PolygonPrim; scope: Scope }) {
  const verts = p.vertices.map((v) => vec3([v[0], v[1], v[2] ?? 0])(scope));
  if (verts.length < 3) return null;
  const geom = useMemo(() => {
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
  }, [JSON.stringify(verts.map(v => [v.x, v.y, v.z]))]);
  const outline = [...verts, verts[0]];
  return (
    <>
      <mesh geometry={geom}>
        <meshStandardMaterial
          color={p.color ?? "#38bdf8"}
          opacity={p.opacity ?? 0.35}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line points={outline} color={p.outline ?? p.color ?? "#38bdf8"} lineWidth={1.5} />
    </>
  );
}

function GridR({ p }: { p: GridPrim }) {
  const size = (p.size ?? 5) * 2;
  const divs = p.divisions ?? 10;
  const plane = p.plane ?? "xy";
  const rot: [number, number, number] =
    plane === "xy" ? [Math.PI / 2, 0, 0] : plane === "xz" ? [0, 0, 0] : [0, 0, Math.PI / 2];
  return (
    <Grid
      args={[size, size, divs, divs]}
      rotation={rot}
      cellColor={p.color ?? "#1e3a8a"}
      sectionColor={p.color ?? "#3b82f6"}
      fadeDistance={30}
      infiniteGrid={false}
    />
  );
}

function AxesR({ p }: { p: AxesPrim }) {
  const s = p.size ?? 4;
  const labels = p.labels ?? ["x", "y", "z"];
  return (
    <group>
      <Line points={[[-s, 0, 0], [s, 0, 0]]} color="#ef4444" lineWidth={1} />
      <Line points={[[0, -s, 0], [0, s, 0]]} color="#22c55e" lineWidth={1} />
      <Line points={[[0, 0, -s], [0, 0, s]]} color="#3b82f6" lineWidth={1} />
      <Text position={[s + 0.2, 0, 0]} fontSize={0.25} color="#ef4444">{labels[0]}</Text>
      <Text position={[0, s + 0.2, 0]} fontSize={0.25} color="#22c55e">{labels[1]}</Text>
      <Text position={[0, 0, s + 0.2]} fontSize={0.25} color="#3b82f6">{labels[2]}</Text>
    </group>
  );
}

function TextR({ p, scope }: { p: TextPrim; scope: Scope }) {
  const pos = vec3(p.at)(scope);
  return (
    <Text position={pos} fontSize={p.size ?? 0.3} color={p.color ?? "#e2e8f0"} anchorX="center" anchorY="middle">
      {p.content}
    </Text>
  );
}

function GroupR({ p, scope }: { p: GroupPrim; scope: Scope }) {
  const m = p.matrix && p.matrix.length === 16
    ? new THREE.Matrix4().fromArray(p.matrix.map((e) => compile(e)(scope)))
    : null;
  return (
    <group matrixAutoUpdate={!m} matrix={m ?? undefined}>
      {p.children.map((c, i) => <PrimitiveR key={i} prim={c} scope={scope} />)}
    </group>
  );
}

function PrimitiveR({ prim, scope }: { prim: Primitive; scope: Scope }) {
  switch (prim.kind) {
    case "point": return <PointR p={prim} scope={scope} />;
    case "curve": return <CurveR p={prim} scope={scope} />;
    case "surface": return <SurfaceR p={prim} scope={scope} />;
    case "vectorField": return <VectorFieldR p={prim} scope={scope} />;
    case "arrow": return <ArrowR p={prim} scope={scope} />;
    case "polygon": return <PolygonR p={prim} scope={scope} />;
    case "grid": return <GridR p={prim} />;
    case "axes": return <AxesR p={prim} />;
    case "text": return <TextR p={prim} scope={scope} />;
    case "group": return <GroupR p={prim} scope={scope} />;
    default: return null;
  }
}

/* ---------------- time ticker for ambient animation ---------------- */

function TimeTicker({ onTick }: { onTick: (t: number) => void }) {
  const last = useRef(0);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (t - last.current > 0.05) {
      last.current = t;
      onTick(t);
    }
  });
  return null;
}

/* ---------------- public component ---------------- */

interface Props {
  spec: SceneSpec;
  params: Record<string, number>;
  time: number;
  onTime: (t: number) => void;
}

export default function Scene3D({ spec, params, time, onTime }: Props) {
  const scope: Scope = { ...params, time };
  const cam: [number, number, number] = spec.camera ?? (spec.flat ? [0, 0, 8] : [6, 6, 6]);
  return (
    <Canvas
      camera={{ position: cam, fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <color attach="background" args={["#070b1a"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 8]} intensity={0.8} />
      <directionalLight position={[-6, -4, -6]} intensity={0.3} color="#60a5fa" />
      <Suspense fallback={null}>
        {spec.objects.map((o, i) => (
          <PrimitiveR key={i} prim={o} scope={scope} />
        ))}
      </Suspense>
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        enablePan
        enableZoom
        enableRotate={!spec.flat}
        minDistance={1}
        maxDistance={80}
      />
      <TimeTicker onTick={onTime} />
    </Canvas>
  );
}