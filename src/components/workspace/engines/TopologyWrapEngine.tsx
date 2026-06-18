import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";
import type { TopologyWrapConfig } from "@/lib/simulationPayload";

interface Props {
  config: TopologyWrapConfig;
  params: Record<string, number>;
}

export default function TopologyWrapEngine({ config, params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const xRef = useRef<EvalFunction | null>(null);
  const yRef = useRef<EvalFunction | null>(null);
  const rafRef = useRef<number>();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    try { xRef.current = compile(config.x); } catch { xRef.current = null; }
    try { yRef.current = compile(config.y); } catch { yRef.current = null; }
  }, [config.x, config.y]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;

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
    const getPeriod = () => paramsRef.current.period ?? config.periodDefault ?? 10;
    const toScreen = (x: number, y: number) => {
      const p = getPeriod();
      return {
        sx: (((x % p) + p) % p) / p * W(),
        sy: H() - (((y % p) + p) % p) / p * H(),
      };
    };

    const evalAt = (t: number): [number, number] => {
      try {
        const scope = { t, ...paramsRef.current, period: getPeriod() };
        const x = xRef.current ? xRef.current.evaluate(scope) : t;
        const y = yRef.current ? yRef.current.evaluate(scope) : (paramsRef.current.slope ?? 1) * t;
        return [x, y];
      } catch { return [t, t]; }
    };

    const maxTrail = 1200;
    const trail: { x: number; y: number }[] = [];
    let t = 0;
    let last = performance.now();

    const drawGrid = () => {
      ctx.fillStyle = mathTheme.bg; ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = mathTheme.grid; ctx.lineWidth = 1;
      const cells = config.lattice ?? 10;
      for (let i = 0; i <= cells; i++) {
        const x = (i / cells) * W(); const y = (i / cells) * H();
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H()); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W(), y); ctx.stroke();
      }
      ctx.strokeStyle = mathTheme.gridStrong; ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, W() - 1, H() - 1);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      t += dt * (paramsRef.current.speed ?? config.speedDefault ?? 1.5);
      const [x, y] = evalAt(t);
      trail.push({ x, y });
      if (trail.length > maxTrail) trail.shift();

      drawGrid();
      ctx.lineWidth = 1.6;
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const sa = toScreen(a.x, a.y), sb = toScreen(b.x, b.y);
        if (Math.abs(sa.sx - sb.sx) > W() * 0.5 || Math.abs(sa.sy - sb.sy) > H() * 0.5) continue;
        const alpha = i / trail.length;
        ctx.strokeStyle = mathTheme.vector;
        ctx.globalAlpha = 0.15 + alpha * 0.7;
        ctx.beginPath(); ctx.moveTo(sa.sx, sa.sy); ctx.lineTo(sb.sx, sb.sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const head = toScreen(x, y);
      ctx.fillStyle = mathTheme.highlight;
      ctx.shadowColor = mathTheme.highlight; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(head.sx, head.sy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [config]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}