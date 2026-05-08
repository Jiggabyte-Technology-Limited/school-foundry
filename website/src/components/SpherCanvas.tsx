import { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export default function SphereCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NUM_DOTS = 420;
    const RADIUS = 200;
    const FOV = 600;

    // Generate evenly distributed points on sphere surface (Fibonacci sphere)
    const points: Point3D[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NUM_DOTS; i++) {
      const y = 1 - (i / (NUM_DOTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      points.push({
        x: Math.cos(theta) * r * RADIUS,
        y: y * RADIUS,
        z: Math.sin(theta) * r * RADIUS,
      });
    }

    let angle = 0;
    let animId: number;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function rotate(pt: Point3D, a: number): Point3D {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      return {
        x: pt.x * cos - pt.z * sin,
        y: pt.y,
        z: pt.x * sin + pt.z * cos,
      };
    }

    function project(pt: Point3D, cx: number, cy: number) {
      const scale = FOV / (FOV + pt.z);
      return {
        sx: pt.x * scale + cx,
        sy: pt.y * scale + cy,
        scale,
      };
    }

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;

      const rotated = points.map(p => rotate(p, angle));

      // Sort back-to-front so front dots render on top
      rotated.sort((a, b) => a.z - b.z);

      for (const pt of rotated) {
        const { sx, sy, scale } = project(pt, cx, cy);

        // Depth factor: 0 = far back, 1 = front
        const depth = (pt.z + RADIUS) / (2 * RADIUS);

        const size = Math.max(0.5, scale * 2.2);
        const alpha = 0.15 + depth * 0.75;

        // Front dots: vivid orange; back dots: dim gray
        const r = Math.round(249 * depth + 60 * (1 - depth));
        const g = Math.round(115 * depth + 60 * (1 - depth));
        const b = Math.round(22 * depth + 80 * (1 - depth));

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }

      angle += 0.004;
      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
