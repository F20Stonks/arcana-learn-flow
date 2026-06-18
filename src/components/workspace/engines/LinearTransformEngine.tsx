import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";
import type { LinearTransformConfig } from "@/lib/simulationPayload";

interface Props {
  config: LinearTransformConfig;
  params: Record<string, number>;
}

export default function LinearTransformEngine({ config, params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const exprRefs = useRef<{ a?: EvalFunction; b?: EvalFunction; c?: EvalFunction; d?: EvalFunction }>({});
  useEffect(() => {
    const safe = (s?: string) => { try { return s ? compile(s) : undefined; } catch { return undefined; } };
    exprRefs.current = { a: safe(config.a), b: safe(config.b), c: safe(config.c), d: safe(config.d) };
  }, [config.a, config.b, config.c, config.d]);

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
    const scale = () => Math.min(W(), H()) / 10; // world units = 10
    const toScreen = (x: number, y: number) => ({
      sx: W() / 2 + x * scale(),
      sy: H() / 2 - y * scale(),
    });

    const getMatrix = (): [[number, number], [number, number]] => {
      const p = paramsRef.current;
      const ev = (fn: EvalFunction | undefined, fallback: number) => {
        if (!fn) return fallback;
        try { const v = fn.evaluate(p); return isFinite(v) ? v : fallback; } catch { return fallback; }
      };
      const [[a0, b0], [c0, d0]] = config.matrix;
      const a = ev(exprRefs.current.a, p.a ?? a0);
      const b = ev(exprRefs.current.b, p.b ?? b0);
      const c = ev(exprRefs.current.c, p.c ?? c0);
      const d = ev(exprRefs.current.d, p.d ?? d0);
      return [[a, b], [c, d]];
    };

    const apply = (M: [[number, number], [number, number]], x: number, y: number) =>
      [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y] as const;

    let phase = 0;
    const tick = () => {
      phase = Math.min(1, phase + 0.012);
      const M = getMatrix();
      const I: [[number, number], [number, number]] = [[1, 0], [0, 1]];
      const lerp = (a: number, b: number) => a + (b - a) * phase;
      const Mt: [[number, number], [number, number]] = [
        [lerp(I[0][0], M[0][0]), lerp(I[0][1], M[0][1])],
        [lerp(I[1][0], M[1][0]), lerp(I[1][1], M[1][1])],
      ];

      ctx.fillStyle = mathTheme.bg; ctx.fillRect(0, 0, W(), H());
      // transformed grid
      ctx.strokeStyle = mathTheme.grid; ctx.lineWidth = 1;
      const rng = 5;
      for (let i = -rng; i <= rng; i++) {
        ctx.beginPath();
        for (let t = -rng; t <= rng; t += 0.25) {
          const [x, y] = apply(Mt, t, i);
          const { sx, sy } = toScreen(x, y);
          if (t === -rng) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let t = -rng; t <= rng; t += 0.25) {
          const [x, y] = apply(Mt, i, t);
          const { sx, sy } = toScreen(x, y);
          if (t === -rng) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // basis vectors
      const drawVec = (x: number, y: number, color: string) => {
        const o = toScreen(0, 0); const p = toScreen(x, y);
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(o.sx, o.sy); ctx.lineTo(p.sx, p.sy); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.sx, p.sy, 4, 0, Math.PI * 2); ctx.fill();
      };
      const [ix, iy] = apply(Mt, 1, 0);
      const [jx, jy] = apply(Mt, 0, 1);
      drawVec(ix, iy, mathTheme.curveTarget);
      drawVec(jx, jy, mathTheme.curveApprox);

      // det readout
      const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      ctx.fillStyle = mathTheme.textDim;
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.fillText(`det = ${det.toFixed(2)}`, 10, H() - 10);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [config]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}