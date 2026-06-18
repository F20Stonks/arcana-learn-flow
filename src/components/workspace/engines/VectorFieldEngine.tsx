import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";
import type { VectorFieldConfig } from "@/lib/simulationPayload";

interface Props {
  config: VectorFieldConfig;
  params: Record<string, number>; // user-bound sliders
}

interface Particle { x: number; y: number; px: number; py: number; life: number }

export default function VectorFieldEngine({ config, params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<EvalFunction | null>(null);
  const fyRef = useRef<EvalFunction | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    try { fxRef.current = compile(config.fx); } catch { fxRef.current = null; }
    try { fyRef.current = compile(config.fy); } catch { fyRef.current = null; }
  }, [config.fx, config.fy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const W = () => canvas.getBoundingClientRect().width;
    const H = () => canvas.getBoundingClientRect().height;
    const toScreen = (x: number, y: number) => ({
      sx: ((x + 5) / 10) * W(),
      sy: H() - ((y + 5) / 10) * H(),
    });

    const targetCount = () => Math.round(paramsRef.current.particles ?? config.particles ?? 220);
    const spawn = (n: number): Particle[] =>
      Array.from({ length: n }, () => {
        const x = Math.random() * 10 - 5, y = Math.random() * 10 - 5;
        return { x, y, px: x, py: y, life: Math.random() * 200 };
      });
    particlesRef.current = spawn(targetCount());

    const evalField = (x: number, y: number): [number, number] => {
      try {
        const scope = { x, y, ...paramsRef.current };
        const vx = fxRef.current ? fxRef.current.evaluate(scope) : 0;
        const vy = fyRef.current ? fyRef.current.evaluate(scope) : 0;
        if (!isFinite(vx) || !isFinite(vy)) return [0, 0];
        return [vx, vy];
      } catch { return [0, 0]; }
    };

    const drawGrid = () => {
      ctx.fillStyle = mathTheme.bg; ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = mathTheme.grid; ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i++) {
        const { sx } = toScreen(i, 0); const { sy } = toScreen(0, i);
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H()); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W(), sy); ctx.stroke();
      }
      ctx.strokeStyle = mathTheme.gridStrong;
      const { sx: ax, sy: ay } = toScreen(0, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H()); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W(), ay); ctx.stroke();
    };

    const drawArrows = () => {
      ctx.strokeStyle = mathTheme.vector; ctx.lineWidth = 1.2;
      const step = 0.6;
      for (let x = -5; x <= 5; x += step) {
        for (let y = -5; y <= 5; y += step) {
          const [vx, vy] = evalField(x, y);
          const mag = Math.hypot(vx, vy) || 1;
          const len = Math.min(mag, 2) * 0.18;
          const a = toScreen(x, y);
          const b = toScreen(x + (vx / mag) * len, y + (vy / mag) * len);
          ctx.globalAlpha = Math.min(0.15 + mag * 0.08, 0.7);
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      // dynamic resize of particle pool
      const tc = targetCount();
      if (particlesRef.current.length !== tc) {
        if (tc > particlesRef.current.length) {
          particlesRef.current = particlesRef.current.concat(spawn(tc - particlesRef.current.length));
        } else particlesRef.current.length = tc;
      }
      const strength = paramsRef.current.strength ?? config.strength ?? 1.2;

      drawGrid(); drawArrows();
      ctx.lineWidth = 1;
      for (const p of particlesRef.current) {
        const [vx, vy] = evalField(p.x, p.y);
        p.px = p.x; p.py = p.y;
        p.x += vx * dt * strength; p.y += vy * dt * strength; p.life++;
        if (p.x < -5 || p.x > 5 || p.y < -5 || p.y > 5 || p.life > 400 ||
            (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && p.life > 60)) {
          p.x = Math.random() * 10 - 5; p.y = Math.random() * 10 - 5;
          p.px = p.x; p.py = p.y; p.life = 0;
        }
        const a = toScreen(p.px, p.py); const b = toScreen(p.x, p.y);
        ctx.strokeStyle = mathTheme.highlight; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = mathTheme.particle;
        ctx.beginPath(); ctx.arc(b.sx, b.sy, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [config]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}