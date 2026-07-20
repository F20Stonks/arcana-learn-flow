import { useEffect, useRef, useState } from "react";

/**
 * A live, touchable scene — the one the tutor would build for the skater
 * conversation in the section above. Conservation of angular momentum:
 * drag the mass inward, ω must rise to hold L = Iω fixed (I = mr², so ω
 * scales with 1/r² — the payoff is visceral).
 *
 * The stage is deliberately dark in both page themes: it's a window into
 * the Math Theater, which is dark. Fixed palette, no CSS-var reads.
 * Cheap: one 2D canvas, explicit trail buffer, paused offscreen,
 * DPR-clamped. Readouts write straight to DOM refs — no re-renders.
 */

const STAGE = {
  ink: "rgba(236,235,230,0.92)",
  dim: "rgba(236,235,230,0.30)",
  faint: "rgba(236,235,230,0.14)",
  accent: "#d98a95",
};
const R_MIN = 0.26;
const R_MAX = 0.95;
const L = 1.1; // the conserved quantity; ω = L / r²
const TRAIL = 46;

export default function SceneDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rReadRef = useRef<HTMLSpanElement>(null);
  const wReadRef = useRef<HTMLSpanElement>(null);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let Rpx = 0;

    let r = R_MAX;
    let rTarget = R_MAX;
    let theta = -Math.PI / 3;
    let dragging = false;
    const trail: { x: number; y: number }[] = [];
    const omega = () => L / (r * r);

    const massPos = () => ({
      x: cx + Math.cos(theta) * r * Rpx,
      y: cy + Math.sin(theta) * r * Rpx,
    });

    const drawFrame = () => {
      ctx.clearRect(0, 0, W, H);

      // current orbit guide
      ctx.strokeStyle = STAGE.faint;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * Rpx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const m = massPos();

      // radius "string"
      ctx.strokeStyle = STAGE.dim;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // trail
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = STAGE.accent;
        ctx.globalAlpha = (i / trail.length) * 0.45;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // pivot
      ctx.fillStyle = STAGE.dim;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // mass
      ctx.shadowColor = STAGE.accent;
      ctx.shadowBlur = 14;
      ctx.fillStyle = STAGE.accent;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawStatic = () => {
      drawFrame();
      // inward arrow hinting the drag
      const ax = cx + Math.cos(-Math.PI / 3) * (r * Rpx - 18);
      const ay = cy + Math.sin(-Math.PI / 3) * (r * Rpx - 18);
      ctx.strokeStyle = STAGE.ink;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        cx + Math.cos(-Math.PI / 3) * (r * Rpx - 52),
        cy + Math.sin(-Math.PI / 3) * (r * Rpx - 52),
      );
      ctx.stroke();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2;
      Rpx = Math.min(W, H) / 2 - 34;
      trail.length = 0;
    };
    resize();

    const updateReadouts = () => {
      if (rReadRef.current) rReadRef.current.textContent = r.toFixed(2);
      if (wReadRef.current) wReadRef.current.textContent = omega().toFixed(1);
    };
    updateReadouts();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      drawStatic();
      const onResizeStatic = () => {
        resize();
        drawStatic();
      };
      window.addEventListener("resize", onResizeStatic);
      return () => window.removeEventListener("resize", onResizeStatic);
    }

    let running = true;
    const io = new IntersectionObserver((es) => {
      running = es[0].isIntersecting;
    });
    io.observe(canvas);

    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (running && W > 0) {
        // the "string pull": r eases toward the hand, θ keeps integrating —
        // ω responds instantly because L is fixed
        r += (rTarget - r) * 0.25;
        theta += omega() * dt * 0.9;
        const m = massPos();
        trail.push(m);
        if (trail.length > TRAIL) trail.shift();
        drawFrame();
        updateReadouts();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const pointOnStage = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      setEngaged(true);
      const p = pointOnStage(e);
      rTarget = Math.min(R_MAX, Math.max(R_MIN, Math.hypot(p.x - cx, p.y - cy) / Rpx));
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const p = pointOnStage(e);
      rTarget = Math.min(R_MAX, Math.max(R_MIN, Math.hypot(p.x - cx, p.y - cy) / Rpx));
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="stage-card">
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        role="img"
        aria-label="Interactive scene: conservation of angular momentum. Drag the orbiting mass inward and its angular velocity rises to keep L constant."
      />
      <div className="stage-readout" aria-hidden="true">
        r <span ref={rReadRef}>0.95</span>
        <br />
        ω <span ref={wReadRef}>1.2</span> rad/s
        <br />
        <b>L {L.toFixed(2)} — held constant</b>
      </div>
      <div className="stage-cap">
        {engaged ? (
          <>
            ω rose on its own — <b>that's conservation</b>
          </>
        ) : (
          <>
            L = Iω · <b>drag the mass inward</b>
          </>
        )}
      </div>
    </div>
  );
}
