import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";

interface Props {
  fxExpr: string;
  fyExpr: string;
  particleCount: number;
  strength: number;
  highlightTrails?: boolean;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  life: number;
}

export default function VectorFieldEnvironment({
  fxExpr,
  fyExpr,
  particleCount,
  strength,
  highlightTrails = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const fxRef = useRef<EvalFunction | null>(null);
  const fyRef = useRef<EvalFunction | null>(null);
  const rafRef = useRef<number>();

  // Recompile when expressions change
  useEffect(() => {
    try { fxRef.current = compile(fxExpr); } catch { fxRef.current = null; }
    try { fyRef.current = compile(fyExpr); } catch { fyRef.current = null; }
  }, [fxExpr, fyExpr]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // World coords: x in [-5,5], y in [-5,5]
    const W = () => canvas.getBoundingClientRect().width;
    const H = () => canvas.getBoundingClientRect().height;
    const toScreen = (x: number, y: number) => ({
      sx: ((x + 5) / 10) * W(),
      sy: H() - ((y + 5) / 10) * H(),
    });

    // Init particles
    const spawn = (n: number): Particle[] =>
      Array.from({ length: n }, () => {
        const x = Math.random() * 10 - 5;
        const y = Math.random() * 10 - 5;
        return { x, y, px: x, py: y, life: Math.random() * 200 };
      });
    particlesRef.current = spawn(particleCount);

    const evalField = (x: number, y: number): [number, number] => {
      try {
        const vx = fxRef.current ? fxRef.current.evaluate({ x, y }) : 0;
        const vy = fyRef.current ? fyRef.current.evaluate({ x, y }) : 0;
        if (!isFinite(vx) || !isFinite(vy)) return [0, 0];
        return [vx, vy];
      } catch {
        return [0, 0];
      }
    };

    const drawGrid = () => {
      ctx.fillStyle = mathTheme.bg;
      ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = mathTheme.grid;
      ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i++) {
        const { sx } = toScreen(i, 0);
        const { sy } = toScreen(0, i);
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H()); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W(), sy); ctx.stroke();
      }
      ctx.strokeStyle = mathTheme.gridStrong;
      const { sx: ax } = toScreen(0, 0);
      const { sy: ay } = toScreen(0, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H()); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W(), ay); ctx.stroke();
    };

    const drawArrows = () => {
      ctx.strokeStyle = mathTheme.vector;
      ctx.fillStyle = mathTheme.vector;
      ctx.lineWidth = 1.2;
      const step = 0.6;
      for (let x = -5; x <= 5; x += step) {
        for (let y = -5; y <= 5; y += step) {
          const [vx, vy] = evalField(x, y);
          const mag = Math.hypot(vx, vy) || 1;
          const len = Math.min(mag, 2) * 0.18;
          const ux = (vx / mag) * len;
          const uy = (vy / mag) * len;
          const a = toScreen(x, y);
          const b = toScreen(x + ux, y + uy);
          const alpha = Math.min(0.15 + mag * 0.08, 0.7);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      drawGrid();
      drawArrows();

      // particle trails layer
      ctx.strokeStyle = mathTheme.particle;
      ctx.lineWidth = 1;
      const particles = particlesRef.current;
      for (const p of particles) {
        const [vx, vy] = evalField(p.x, p.y);
        p.px = p.x;
        p.py = p.y;
        p.x += vx * dt * strength;
        p.y += vy * dt * strength;
        p.life += 1;
        if (
          p.x < -5 || p.x > 5 || p.y < -5 || p.y > 5 ||
          p.life > 400 || (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && p.life > 60)
        ) {
          p.x = Math.random() * 10 - 5;
          p.y = Math.random() * 10 - 5;
          p.px = p.x; p.py = p.y; p.life = 0;
        }
        const a = toScreen(p.px, p.py);
        const b = toScreen(p.x, p.y);
        if (highlightTrails) {
          ctx.strokeStyle = mathTheme.highlight;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = mathTheme.particle;
        ctx.beginPath();
        ctx.arc(b.sx, b.sy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [particleCount, strength, highlightTrails]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}