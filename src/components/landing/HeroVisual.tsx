import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { mathTheme } from "@/lib/mathTheme";

/**
 * Ambient hero visual: a Taylor-series approximation of sin(x) that continuously
 * cycles through term counts, showing a jagged low-order guess resolve into the
 * true curve. Not interactive — it's here to *show* the product's core idea
 * (understanding forming through progressive refinement) rather than describe it.
 */

const SAMPLES = 160;
const X_RANGE = 9;
const CYCLE_SECONDS = 5.5;
const MAX_TERMS = 7;

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function taylorSin(x: number, terms: number): number {
  let sum = 0;
  for (let k = 0; k < terms; k++) {
    const power = 2 * k + 1;
    sum += (Math.pow(-1, k) * Math.pow(x, power)) / factorial(power);
  }
  return sum;
}

function buildCurve(termsFloat: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const wholeTerms = Math.max(1, Math.floor(termsFloat));
  const frac = termsFloat - wholeTerms;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = -X_RANGE / 2 + (i / SAMPLES) * X_RANGE;
    const lo = taylorSin(x, wholeTerms);
    const hi = taylorSin(x, wholeTerms + 1);
    const y = THREE.MathUtils.lerp(lo, hi, frac);
    const clampedY = THREE.MathUtils.clamp(y, -3.2, 3.2);
    pts.push(new THREE.Vector3(x, clampedY, 0));
  }
  return pts;
}

function TargetCurve() {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = -X_RANGE / 2 + (i / SAMPLES) * X_RANGE;
      out.push(new THREE.Vector3(x, Math.sin(x), 0));
    }
    return out;
  }, []);
  return <Line points={pts} color={mathTheme.curveTarget} lineWidth={1} transparent opacity={0.28} />;
}

function ApproximationCurve() {
  const lineRef = useRef<{ geometry: THREE.BufferGeometry } | null>(null);
  const glowRef = useRef<{ geometry: THREE.BufferGeometry } | null>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const phase = (t.current % CYCLE_SECONDS) / CYCLE_SECONDS;
    // ease so it lingers near integer term counts (the "click") rather than sliding evenly
    const eased = phase < 0.85 ? (phase / 0.85) : 1;
    const termsFloat = 1 + eased * (MAX_TERMS - 1);
    const pts = buildCurve(termsFloat);

    for (const ref of [lineRef, glowRef]) {
      const geom = ref.current?.geometry;
      if (!geom) continue;
      geom.setFromPoints(pts);
    }
  });

  return (
    <>
      <Line ref={glowRef as never} points={buildCurve(1)} color={mathTheme.curveApprox} lineWidth={8} transparent opacity={0.18} />
      <Line ref={lineRef as never} points={buildCurve(1)} color={mathTheme.curveApprox} lineWidth={2.5} />
    </>
  );
}

function Rig() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.18;
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.09) * 0.06;
  });
  return (
    <group ref={group}>
      <TargetCurve />
      <ApproximationCurve />
    </group>
  );
}

export default function HeroVisual() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.4, 6.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={[mathTheme.bg]} />
        <ambientLight intensity={0.7} />
        <Rig />
      </Canvas>
    </div>
  );
}
