import { useEffect, useRef } from "react";

/**
 * Live 2D vector field — the Math Theater's signature scene,
 * v(x,y) = (sin(a·y + t), cos(a·x − t)), drawn as fading particle trails.
 * A real divergence-varying field, not decorative noise: the product's own
 * mathematics flowing under the hero.
 *
 * Cheap on purpose (single 2D canvas, 150 particles, DPR-clamped, paused
 * offscreen). Reads --accent / --field-alpha from the .ldg scope so it
 * follows the landing palette in both color schemes.
 */
export default function VectorField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let accent = "#7a2230";
    let fieldAlpha = 0.16;
    const readTheme = () => {
      const cs = getComputedStyle(canvas);
      accent = cs.getPropertyValue("--accent").trim() || accent;
      fieldAlpha = parseFloat(cs.getPropertyValue("--field-alpha")) || fieldAlpha;
    };
    readTheme();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const N = 150;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      life: 60 + Math.random() * 160,
    }));

    let t = 0;
    const vel = (px: number, py: number) => {
      const a = 3.1;
      return { vx: Math.sin(a * py + t), vy: Math.cos(a * px - t) };
    };

    // Reduced motion: static streamlines instead of animation.
    const drawStatic = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = fieldAlpha;
      ctx.lineWidth = 1;
      for (let s = 0; s < 90; s++) {
        let px = Math.random();
        let py = Math.random();
        ctx.beginPath();
        ctx.moveTo(px * W, py * H);
        for (let k = 0; k < 40; k++) {
          const v = vel(px, py);
          px += v.vx * 0.003;
          py += v.vy * 0.003;
          ctx.lineTo(px * W, py * H);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    let running = true;
    const io = new IntersectionObserver((es) => {
      running = es[0].isIntersecting;
    });
    io.observe(canvas);

    let raf = 0;
    const step = () => {
      if (running) {
        t += 0.0022;
        // fade previous trails without painting an opaque background,
        // so the canvas stays transparent over the page background
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,0.045)";
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = accent;
        ctx.globalAlpha = fieldAlpha;
        ctx.lineWidth = 1;
        for (const p of parts) {
          const v = vel(p.x, p.y);
          const nx = p.x + v.vx * 0.0011;
          const ny = p.y + v.vy * 0.0011;
          ctx.beginPath();
          ctx.moveTo(p.x * W, p.y * H);
          ctx.lineTo(nx * W, ny * H);
          ctx.stroke();
          p.x = nx;
          p.y = ny;
          p.life--;
          if (p.life <= 0 || p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02) {
            p.x = Math.random();
            p.y = Math.random();
            p.life = 60 + Math.random() * 160;
          }
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(step);
    };

    const onResize = () => {
      resize();
      if (reduced) drawStatic();
    };
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      readTheme();
      ctx.clearRect(0, 0, W, H);
      if (reduced) drawStatic();
    };
    window.addEventListener("resize", onResize);
    scheme.addEventListener("change", onScheme);

    if (reduced) drawStatic();
    else raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      scheme.removeEventListener("change", onScheme);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
