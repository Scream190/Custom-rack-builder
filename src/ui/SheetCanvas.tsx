import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../model/store';
import type { FlightCase } from '../model/types';

const st = useStore.getState;

/**
 * Zoomable drawing sheet (svg in mm) with draggable foam cut-outs. Wheel zooms to the cursor, dragging empty space
 * pans, double click on empty space fits the sheet.
 */
export function SheetCanvas({ c, size, fitKey, snap = 5, editable, hint, children }: {
  /** case whose cut-outs can be dragged (none = plain drawing) */
  c?: FlightCase;
  /** sheet extent: x/y origin and size in mm */
  size: { x: number; y: number; w: number; h: number };
  fitKey: string;
  snap?: number;
  editable: boolean;
  hint?: string;
  children: (onItemPointerDown?: (e: React.PointerEvent, id: string) => void) => ReactNode;
}) {
  const ro = useStore((s) => s.readOnly);
  const svg = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState(size);
  const drag = useRef<{ kind: 'item'; id: string; sx: number; sy: number; x: number; y: number; k: number } | { kind: 'pan'; sx: number; sy: number; vb: typeof vb } | null>(null);
  useEffect(() => setVb(size), [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = () => svg.current?.getScreenCTM()?.a ?? 1;

  const onWheel = (e: React.WheelEvent) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.exp(e.deltaY * 0.0015);
    const s = Math.min(r.width / vb.w, r.height / vb.h);
    const ox = (r.width - vb.w * s) / 2, oy = (r.height - vb.h * s) / 2;
    const mx = vb.x + (e.clientX - r.left - ox) / s, my = vb.y + (e.clientY - r.top - oy) / s;
    setVb({ x: mx - (mx - vb.x) * k, y: my - (my - vb.y) * k, w: vb.w * k, h: vb.h * k });
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && !(e.target as Element).closest('[data-item]'))) {
      if (e.button === 0) st().select(null);
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vb };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onItemDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    st().select({ kind: 'caseItem', id });
    if (ro || !editable || !c) return;
    const it = c.items.find((x) => x.id === id)!;
    drag.current = { kind: 'item', id, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, k: scale() };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    if (dr.kind === 'pan') {
      const s = scale();
      setVb({ ...dr.vb, x: dr.vb.x - (e.clientX - dr.sx) / s, y: dr.vb.y - (e.clientY - dr.sy) / s });
      return;
    }
    const g = e.altKey ? 1 : snap;
    const x = Math.round((dr.x + (e.clientX - dr.sx) / dr.k) / g) * g;
    const y = Math.round((dr.y - (e.clientY - dr.sy) / dr.k) / g) * g;
    if (c) st().updateCaseItem(c.id, dr.id, { x, y });
  };
  return (
    <div className="case-canvas" onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" height="100%" fontFamily="Inter, Arial, Helvetica, sans-serif"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }}
        onDoubleClick={(e) => { if (!(e.target as Element).closest('[data-item]')) setVb(size); }}>
        {children(onItemDown)}
      </svg>
      {hint ? <span className="nav-help canvas-help" title={hint} aria-label={hint}>?</span> : null}
    </div>
  );
}
