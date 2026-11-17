// 背景：缓慢流动的极光色块 + 一层会躲开鼠标、彼此连线的光点。
// 只是背景：不接收点击；切到后台标签页时停止；系统开了「减少动态效果」时只画一帧静止的。
import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: number;
}

const COLORS = ["47, 76, 221", "124, 92, 255", "236, 72, 153", "20, 184, 166"];
const LINK = 130;

export function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      dots = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1 + Math.random() * 1.8,
        c: Math.floor(Math.random() * COLORS.length),
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        if (!reduce) {
          // 鼠标附近的光点被轻轻推开
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 140 * 140 && dist2 > 1) {
            const f = (1 - Math.sqrt(dist2) / 140) * 0.6;
            d.vx += (dx / Math.sqrt(dist2)) * f * 0.12;
            d.vy += (dy / Math.sqrt(dist2)) * f * 0.12;
          }
          d.vx *= 0.985;
          d.vy *= 0.985;
          // 保持一点漂移，别停下来
          if (Math.abs(d.vx) + Math.abs(d.vy) < 0.15) {
            d.vx += (Math.random() - 0.5) * 0.05;
            d.vy += (Math.random() - 0.5) * 0.05;
          }
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < -20) d.x = w + 20;
          if (d.x > w + 20) d.x = -20;
          if (d.y < -20) d.y = h + 20;
          if (d.y > h + 20) d.y = -20;
        }
      }
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(${COLORS[a.c]}, ${(1 - Math.sqrt(d2) / LINK) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // 靠近鼠标的光点和鼠标连一条线
        const mx = a.x - mouse.x;
        const my = a.y - mouse.y;
        const m2 = mx * mx + my * my;
        if (m2 < 180 * 180) {
          ctx.strokeStyle = `rgba(${COLORS[a.c]}, ${(1 - Math.sqrt(m2) / 180) * 0.35})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      for (const d of dots) {
        ctx.fillStyle = `rgba(${COLORS[d.c]}, 0.55)`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="backdrop" aria-hidden="true">
      <i className="aurora a1" />
      <i className="aurora a2" />
      <i className="aurora a3" />
      <i className="aurora a4" />
      <canvas ref={ref} />
    </div>
  );
}
