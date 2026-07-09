import { useEffect, useRef } from "react";
import { compile, EvalFunction } from "mathjs";
import { mathTheme } from "@/lib/mathTheme";
import type { ApproximatorConfig } from "@/lib/simulationPayload";

interface Props {
  config: ApproximatorConfig;
  params: Record<string, number>;
}

export default function ApproximatorEngine({ config, params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<EvalFunction | null>(null);
  const termRef = useRef<EvalFunction | null>(null);
  const rafRef = useRef<number>();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    try { targetRef.current = compile(config.target); } catch { targetRef.current = null; }
    try { termRef.current = compile(config.term); } catch { termRef.current = null; }
  }, [config.target, config.term]);

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
    const [xMin, xMax] = config.xRange ?? [-6, 6];
    const yMin = -3, yMax = 3;
    const toScreen = (x: number, y: number) => ({
      sx: ((x - xMin) / (xMax - xMin)) * W(),
      sy: H() - ((y - yMin) / (yMax - yMin)) * H(),
    });

    const evalTarget = (x: number) => {
      try { return targetRef.current ? targetRef.current.evaluate({ x, ...paramsRef.current }) : 0; }
      catch { return 0; }
    };
    const evalPartial = (x: number, n: number) => {
      let s = 0;
      for (let k = 0; k < n; k++) {
        try {
          const v = termRef.current ? termRef.current.evaluate({ x, k, ...paramsRef.current }) : 0;
          if (isFinite(v)) s += v;
        } catch { /* noop */ }
      }
      return s;
    };

    const drawGrid = () => {
      ctx.fillStyle = mathTheme.bg; ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = mathTheme.grid; ctx.lineWidth = 1;
      for (let x = Math.ceil(xMin); x <= xMax; x++) {
        const { sx } = toScreen(x, 0);
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H()); ctx.stroke();
      }
      for (let y = Math.ceil(yMin); y <= yMax; y++) {
        const { sy } = toScreen(0, y);
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W(), sy); ctx.stroke();
      }
      ctx.strokeStyle = mathTheme.gridStrong;
      const o = toScreen(0, 0);
      ctx.beginPath(); ctx.moveTo(o.sx, 0); ctx.lineTo(o.sx, H()); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, o.sy); ctx.lineTo(W(), o.sy); ctx.stroke();
    };

    const drawCurve = (color: string, fn: (x: number) => number, width = 1.6) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath();
      const samples = 400;
      let started = false;
      for (let i = 0; i <= samples; i++) {
        const x = xMin + (i / samples) * (xMax - xMin);
        const y = fn(x);
        if (!isFinite(y) || Math.abs(y) > 1e3) { started = false; continue; }
        const { sx, sy } = toScreen(x, y);
        if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    };

    let t = 0;
    const tick = () => {
      t += 1;
      const n = Math.max(0, Math.round(paramsRef.current.n ?? config.nDefault ?? 4));
      drawGrid();
      drawCurve(mathTheme.curveTarget, evalTarget, 2);
      ctx.globalAlpha = 0.9;
      drawCurve(mathTheme.curveApprox, (x) => evalPartial(x, n), 2.2);
      ctx.globalAlpha = 1;

      // label
      ctx.fillStyle = mathTheme.textDim;
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.fillText(`n = ${n}`, 10, H() - 10);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [config]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}