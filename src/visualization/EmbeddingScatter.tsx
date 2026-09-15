import { useEffect, useMemo, useRef } from "react";
import type { EmbeddingPoint } from "../types/embedding.ts";
import { pca } from "../analysis/pca.ts";

interface EmbeddingScatterProps {
  points: EmbeddingPoint[];
  pointColors: Map<string, string> | null;
  neutralColor: string;
  selectedPointId: string | null;
  hoveredPointId: string | null;
  queryPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  onHoverPoint: (id: string | null) => void;
}

const MIN_POINT_RADIUS = 2.5;

interface Sweep {
  points: EmbeddingPoint[];
  cols: Float64Array;
  rows: Float64Array;
}

function boundRect(rows: Float64Array, cols: Float64Array): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < rows.length; i += 1) {
    x0 = Math.min(x0, cols[i]);
    x1 = Math.max(x1, cols[i]);
    y0 = Math.min(y0, rows[i]);
    y1 = Math.max(y1, rows[i]);
  }
  if (!Number.isFinite(x0)) {
    return { x0: -1, x1: 1, y0: -1, y1: 1 };
  }
  return { x0, y0, x1, y1 };
}

/** Canvas scatter of a PCA projection, linked to the map view. */
export default function EmbeddingScatter({
  points,
  pointColors,
  neutralColor,
  selectedPointId,
  hoveredPointId,
  queryPointId,
  onSelectPoint,
  onHoverPoint,
}: EmbeddingScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({
    points,
    pointColors,
    neutralColor,
    selectedPointId,
    hoveredPointId,
    queryPointId,
  });
  propsRef.current = { points, pointColors, neutralColor, selectedPointId, hoveredPointId, queryPointId };

  const sweep = useMemo<Sweep | null>(() => {
    if (points.length === 0) return null;
    let projected: Float64Array[];
    try {
      projected = pca(points.map((p) => p.vector), 2).scores;
    } catch {
      return null;
    }
    const cols = new Float64Array(projected.length);
    const rows = new Float64Array(projected.length);
    projected.forEach((s, i) => {
      cols[i] = s[0];
      rows[i] = s[1];
    });
    return { points, cols, rows };
  }, [points]);

  const rect = useMemo(
    () => (sweep ? boundRect(sweep.rows, sweep.cols) : null),
    [sweep],
  );

  useEffect(() => {
    if (!sweep || !rect) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = 28;
    const dx = rect.x1 === rect.x0 ? 1 : rect.x1 - rect.x0;
    const dy = rect.y1 === rect.y0 ? 1 : rect.y1 - rect.y0;
    const scale = Math.min((width - 2 * pad) / dx, (height - 2 * pad) / dy);
    const ox = (width - dx * scale) / 2;
    const oy = (height - dy * scale) / 2;

    const selected = selectedPointId;
    const hovered = hoveredPointId;
    const { pointColors: colors, points: pts, neutralColor: neutral } = propsRef.current;

    const radius =
      pts.length > 1500 ? MIN_POINT_RADIUS : Math.max(MIN_POINT_RADIUS, 6 - pts.length / 350);

    // Draw non-highlighted points first so highlights sit on top.
    for (const pass of [0, 1]) {
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        const isSel = p.id === selected;
        const isHov = p.id === hovered;
        const isQ = p.id === queryPointId;
        if (pass === 0 && (isSel || isHov || isQ)) continue;
        if (pass === 1 && !(isSel || isHov || isQ)) continue;

        const px = ox + (sweep.cols[i] - rect.x0) * scale;
        const py = oy + (sweep.rows[i] - rect.y1) * scale * -1;
        const color = colors?.get(p.id) ?? neutral;
        ctx.beginPath();
        ctx.arc(px, py, isQ ? radius + 3 : radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = isQ ? 0.95 : isSel || isHov ? 1 : 0.75;
        ctx.fill();
        if (isSel || isHov) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#7fd6e0";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [sweep, rect, selectedPointId, hoveredPointId, queryPointId]);

  function onMove(e: React.PointerEvent) {
    const rectEl = wrapRef.current?.getBoundingClientRect();
    if (!rectEl || !sweep || !rect) return;
    if (e.buttons === 0) {
      const px = e.clientX - rectEl.left;
      const py = e.clientY - rectEl.top;
      const found = pick(px, py, sweep, rect, rectEl.width, rectEl.height);
      if (found !== hoveredPointId) {
        onHoverPoint(found);
      }
    }
  }

  function onClick(e: React.MouseEvent) {
    const rectEl = wrapRef.current?.getBoundingClientRect();
    if (!rectEl || !sweep || !rect) return;
    const px = e.clientX - rectEl.left;
    const py = e.clientY - rectEl.top;
    onSelectPoint(pick(px, py, sweep, rect, rectEl.width, rectEl.height));
  }

  return (
    <div ref={wrapRef} className="embedding-scatter" onPointerMove={onMove} onClick={onClick}>
      <canvas ref={canvasRef} />
      {!sweep && (
        <div className="message message--empty embedding-scatter__empty">
          Retrieve a sample to see embedding space.
        </div>
      )}
    </div>
  );
}

function pick(
  px: number,
  py: number,
  sweep: Sweep,
  rect: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
): string | null {
  const pad = 28;
  const dx = rect.x1 === rect.x0 ? 1 : rect.x1 - rect.x0;
  const dy = rect.y1 === rect.y0 ? 1 : rect.y1 - rect.y0;
  const scale = Math.min((width - 2 * pad) / dx, (height - 2 * pad) / dy);
  const ox = (width - dx * scale) / 2;
  const oy = (height - dy * scale) / 2;
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < sweep.rows.length; i += 1) {
    const x = ox + (sweep.cols[i] - rect.x0) * scale;
    const y = oy + (sweep.rows[i] - rect.y1) * scale * -1;
    const d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < 12 * 12 && d < bestDist) {
      bestDist = d;
      bestId = sweep.points[i].id;
    }
  }
  return bestId;
}