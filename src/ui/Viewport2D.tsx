import { useEffect, useRef, useState } from 'react';
import { useActiveRack, useStore, ZOOM_MAX, ZOOM_MIN } from '../model/store';
import { rackLayout } from '../render/RackSvg';
import { BASE_PX_PER_MM, RackCanvas } from './RackCanvas';
import type { Face } from '../model/types';

/**
 * 2D view with Fusion-360-style navigation:
 *  - mouse wheel: zoom towards the cursor (pinch on trackpads too)
 *  - middle mouse button drag: pan; double-click middle button: fit
 *  - navigation bar tools: Pan / Zoom (left button drag), Fit
 *  - keyboard: F6 = fit, + / − = zoom
 * Left button keeps editing (move devices, draw cables) in the normal "select" mode.
 */
export function Viewport2D({ views }: { views: Face[] }) {
  const rack = useActiveRack();
  useStore((s) => s.zoom); // re-render on zoom (RackCanvas scales itself)
  const pan = useStore((s) => s.pan);
  const navMode = useStore((s) => s.navMode);
  const fitTick = useStore((s) => s.fitTick);
  const st = useStore.getState;
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'pan' | 'zoom'; x: number; y: number; pan: { x: number; y: number }; zoom: number; cx: number; cy: number } | null>(null);
  const lastMiddle = useRef(0);
  const [panning, setPanning] = useState(false);

  const gap = 24;
  const contentSize = (z: number) => {
    const L = rackLayout(rack);
    const s = BASE_PX_PER_MM * z;
    return { w: views.length * L.vb.w * s + (views.length - 1) * gap, h: L.vb.h * s };
  };

  const fit = () => {
    const el = stageRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const gaps = (views.length - 1) * gap;
    const one = contentSize(1);
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min((W - 40 - gaps) / (one.w - gaps), (H - 40) / one.h)));
    const c = contentSize(z);
    st().setZoom(z);
    st().setPan({ x: (W - c.w) / 2, y: (H - c.h) / 2 });
  };

  /** zoom to `z1` keeping the stage point (cx, cy) fixed */
  const zoomAt = (z1: number, cx: number, cy: number, from?: { pan: { x: number; y: number }; zoom: number }) => {
    const z0 = from?.zoom ?? st().zoom;
    const p0 = from?.pan ?? st().pan;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z1));
    const k = z / z0;
    st().setZoom(z);
    st().setPan({ x: cx - (cx - p0.x) * k, y: cy - (cy - p0.y) * k });
  };

  // fit on rack / view change and on request
  useEffect(() => {
    const t = setTimeout(fit, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack.id, rack.type.heightU, views.length, fitTick]);

  // wheel zoom (non-passive so the page doesn't scroll)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) {
        // horizontal two-finger swipe pans sideways
        const p = st().pan;
        st().setPan({ x: p.x - e.deltaX, y: p.y });
        return;
      }
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      const k = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
      zoomAt(st().zoom * k, cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard: F6 fit, +/- zoom around the centre
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select') || st().modal) return;
      const el = stageRef.current;
      if (!el) return;
      if (e.key === 'F6') { e.preventDefault(); fit(); }
      else if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) zoomAt(st().zoom * 1.2, el.clientWidth / 2, el.clientHeight / 2);
      else if (e.key === '-' && !e.ctrlKey && !e.metaKey) zoomAt(st().zoom / 1.2, el.clientWidth / 2, el.clientHeight / 2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerDownCapture = (e: React.PointerEvent) => {
    const el = stageRef.current!;
    const r = el.getBoundingClientRect();
    const middle = e.button === 1;
    const toolDrag = e.button === 0 && (navMode === 'pan' || navMode === 'zoom' || navMode === 'orbit');
    if (!middle && !toolDrag) return;
    e.preventDefault();
    e.stopPropagation();
    if (middle) {
      const now = Date.now();
      if (now - lastMiddle.current < 350) { fit(); lastMiddle.current = 0; return; }
      lastMiddle.current = now;
    }
    const kind = navMode === 'zoom' && !middle ? 'zoom' : 'pan';
    drag.current = { kind, x: e.clientX, y: e.clientY, pan: st().pan, zoom: st().zoom, cx: e.clientX - r.left, cy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') st().setPan({ x: d.pan.x + e.clientX - d.x, y: d.pan.y + e.clientY - d.y });
    else zoomAt(d.zoom * Math.exp(-(e.clientY - d.y) * 0.01), d.cx, d.cy, { pan: d.pan, zoom: d.zoom });
  };
  const endDrag = () => { drag.current = null; setPanning(false); };

  return (
    <div
      ref={stageRef}
      className={'viewport2d' + (panning ? ' panning' : '') + (navMode !== 'select' ? ` tool-${navMode}` : '')}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onAuxClick={(e) => e.preventDefault()}
      onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); /* no autoscroll */ }}
    >
      <div className="views" style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, gap: `${gap}px` }}>
        {views.map((v) => <RackCanvas key={v + rack.id} rack={rack} view={v} />)}
      </div>
    </div>
  );
}
