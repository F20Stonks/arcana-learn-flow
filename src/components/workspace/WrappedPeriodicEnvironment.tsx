import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";

interface Props {
  // path expressions parametrized by t
  fxExpr: string; // e.g. "t"
  fyExpr: string; // e.g. "slope * t"
  slope: number;
  period: number; // domain wraps [0, period]
  speed: number;
}

export default function WrappedPeriodicEnvironment({
  fxExpr,
  fyExpr,
  slope,
  period,
  speed,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<EvalFunction | null>(null);
  const fyRef = useRef<EvalFunction | null>(null);
  const rafRef = useRef<number>();

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

    const W = () => canvas.getBoundingClientRect().width;
    const H = () => canvas.getBoundingClientRect().height;

    const toScreen = (x: number, y: number) => ({
      sx: (((x % period) + period) % period) / period * W(),
      sy: H() - (((y % period) + period) % period) / period * H(),
    });

    const evalAt = (t: number): [number, number] => {
      try {
        const x = fxRef.current ? fxRef.current.evaluate({ t, slope, period }) : t;
        const y = fyRef.current ? fyRef.current.evaluate({ t, slope, period }) : slope * t;
        return [x, y];
      } catch {
        return [t, slope * t];
      }
    };

    // ring buffer of trail points
    const maxTrail = 1200;
    const trail: { x: number; y: number }[] = [];
    let t = 0;
    let last = performance.now();

    const drawGrid = () => {
      ctx.fillStyle = mathTheme.bg;
      ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = mathTheme.grid;
      ctx.lineWidth = 1;
      const cells = 10;
      for (let i = 0; i <= cells; i++) {
        const x = (i / cells) * W();
        const y = (i / cells) * H();
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W(), y); ctx.stroke();
      }
      // boundary highlight to evoke toroidal wrap
      ctx.strokeStyle = mathTheme.gridStrong;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, W() - 1, H() - 1);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt * speed;

      const [x, y] = evalAt(t);
      trail.push({ x, y });
      if (trail.length > maxTrail) trail.shift();

      drawGrid();

      // Draw trail, breaking segments that wrap across boundary
      ctx.lineWidth = 1.6;
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const sa = toScreen(a.x, a.y);
        const sb = toScreen(b.x, b.y);
        // skip segments that obviously wrapped
        if (Math.abs(sa.sx - sb.sx) > W() * 0.5 || Math.abs(sa.sy - sb.sy) > H() * 0.5) continue;
        const alpha = i / trail.length;
        ctx.strokeStyle = mathTheme.vector;
        ctx.globalAlpha = 0.15 + alpha * 0.7;
        ctx.beginPath();
        ctx.moveTo(sa.sx, sa.sy);
        ctx.lineTo(sb.sx, sb.sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // current point glow
      const head = toScreen(x, y);
      ctx.fillStyle = mathTheme.highlight;
      ctx.shadowColor = mathTheme.highlight;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(head.sx, head.sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [slope, period, speed]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}