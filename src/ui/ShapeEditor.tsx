import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CaseItem, OutlinePt } from '../model/types';
import { filletPolygon, normalizeOutline, rectOutline, shapeOutline, SHAPE_LABELS, type ShapeKind } from '../model/inlay';
import { useLayout } from '../model/layout';
import { NumberInput } from './Modal';

/**
 * Small 2D CAD for the contour of one cut-out. World coordinates are item coordinates in mm (x along the length,
 * y along the width from the front); on screen the front is at the bottom like in the cut plan, so svg y = −y.
 * Navigation follows Fusion 360: middle mouse drags pan, the wheel zooms around the cursor, a double click with the
 * middle button fits everything into view.
 */

type Trace = NonNullable<CaseItem['trace']>;
type Tool = 'select' | 'line' | 'rect' | 'circle' | 'fillet' | 'pan' | 'image' | 'calib';
type Snapshot = { pts: OutlinePt[]; trace?: Trace };
type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'vertex'; i: number }
  | { kind: 'image'; ox: number; oy: number; tx: number; ty: number };

const TOOLS: { id: Tool; label: string; key: string; title: string }[] = [
  { id: 'select', label: 'Auswahl', key: 'Esc', title: 'Eckpunkte ziehen, Punkt auf einer Kante ziehen fügt einen Eckpunkt ein, Entf löscht den gewählten Punkt' },
  { id: 'line', label: 'Linie', key: 'L', title: 'Polylinie: Punkte nacheinander klicken, Klick auf den ersten Punkt, Doppelklick oder Enter schließt die Kontur. Umschalt = nur waagerecht/senkrecht' },
  { id: 'rect', label: 'Rechteck', key: 'R', title: 'Rechteck über zwei Ecken' },
  { id: 'circle', label: 'Kreis', key: 'C', title: 'Kreis über Mittelpunkt und Radius' },
  { id: 'fillet', label: 'Abrunden', key: 'F', title: 'Eckpunkt anklicken, um ihn mit dem eingestellten Radius abzurunden (0 = scharfe Ecke)' },
];

const STEPS = [0.5, 1, 2, 5, 10];

export function ShapeEditor({ item, onSave, onClose }: { item: CaseItem; onSave: (patch: Partial<CaseItem>) => void; onClose: () => void }) {
  const layout = useLayout();
  const initial: Snapshot = useMemo(() => ({
    pts: item.outline && item.outline.length >= 3 ? item.outline.map((p) => ({ ...p })) : item.shape === 'circle' ? rectOutline(item.l, item.w, Math.min(item.l, item.w) / 2) : rectOutline(item.l, item.w, item.radius ?? 6),
    trace: item.trace ? { ...item.trace } : undefined,
  }), [item]);
  const [doc, setDoc] = useState<Snapshot>(initial);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [redo, setRedo] = useState<Snapshot[]>([]);
  const [tool, setToolRaw] = useState<Tool>('select');
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [step, setStep] = useState(STEPS.includes(layout.snap) ? layout.snap : 1);
  const [filletR, setFilletR] = useState(5);
  const [calib, setCalib] = useState<{ x: number; y: number }[]>([]);
  const [calibMm, setCalibMm] = useState(100);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ vx: -50, vy: -300, s: 2 });
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastMiddle = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = doc !== initial;
  const { pts, trace } = doc;

  const commit = (next: Snapshot) => { setUndo((u) => [...u.slice(-80), doc]); setRedo([]); setDoc(next); };
  const setTool = (t: Tool) => { setToolRaw(t); setDraft([]); setCalib([]); };
  const doUndo = () => { if (!undo.length) return; setRedo((r) => [...r, doc]); setDoc(undo[undo.length - 1]); setUndo(undo.slice(0, -1)); setSel(null); };
  const doRedo = () => { if (!redo.length) return; setUndo((u) => [...u, doc]); setDoc(redo[redo.length - 1]); setRedo(redo.slice(0, -1)); };

  // ---------------------------------------------------------------- view
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fit = (d: Snapshot = doc, sz = size) => {
    const xs = d.pts.map((p) => p.x), ys = d.pts.map((p) => p.y);
    if (d.trace) { xs.push(d.trace.x, d.trace.x + d.trace.w); ys.push(d.trace.y, d.trace.y + d.trace.h); }
    if (!xs.length) { xs.push(0, 200); ys.push(0, 100); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = Math.max(20, x1 - x0) * 1.25, h = Math.max(20, y1 - y0) * 1.25;
    const s = Math.min(sz.w / w, sz.h / h);
    setView({ s, vx: (x0 + x1) / 2 - sz.w / s / 2, vy: -(y0 + y1) / 2 - sz.h / s / 2 });
  };
  const fitted = useRef(false);
  useEffect(() => { if (!fitted.current && size.w > 50) { fitted.current = true; fit(); } });
  const zoomAt = (cx: number, cy: number, f: number) => setView((v) => {
    const s = Math.max(0.05, Math.min(80, v.s * f));
    const wx = v.vx + cx / v.s, wy = v.vy + cy / v.s;
    return { s, vx: wx - cx / s, vy: wy - cy / s };
  });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------------------------------------------------------------- coordinates and snapping
  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { cx: e.clientX - r.left, cy: e.clientY - r.top };
  };
  const world = (e: { clientX: number; clientY: number }) => {
    const { cx, cy } = local(e);
    return { x: view.vx + cx / view.s, y: -(view.vy + cy / view.s) };
  };
  const tol = 9 / view.s;
  const hitVertex = (p: { x: number; y: number }) => {
    let best = -1, bd = tol;
    pts.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const hitMid = (p: { x: number; y: number }) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (Math.hypot((a.x + b.x) / 2 - p.x, (a.y + b.y) / 2 - p.y) < tol) return i;
    }
    return -1;
  };
  const snap = (raw: { x: number; y: number }, e: { altKey: boolean; shiftKey: boolean }, from?: { x: number; y: number }) => {
    let p = raw;
    if (!e.altKey) {
      // existing corners first, then the grid
      const v = pts.find((q) => Math.hypot(q.x - raw.x, q.y - raw.y) < tol) ?? draft.find((q) => Math.hypot(q.x - raw.x, q.y - raw.y) < tol);
      p = v ? { x: v.x, y: v.y } : { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step };
    }
    if (from && e.shiftKey) p = Math.abs(p.x - from.x) > Math.abs(p.y - from.y) ? { x: p.x, y: from.y } : { x: from.x, y: p.y };
    return p;
  };

  // ---------------------------------------------------------------- drawing
  const closeDraft = (d = draft) => {
    const clean = d.filter((p, i) => i === 0 || Math.hypot(p.x - d[i - 1].x, p.y - d[i - 1].y) > 0.01);
    if (clean.length >= 3) { commit({ ...doc, pts: clean.map((p) => ({ x: p.x, y: p.y })) }); setSel(null); }
    setDraft([]);
  };
  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): OutlinePt[] => {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  };
  const circleFrom = (c: { x: number; y: number }, p: { x: number; y: number }): OutlinePt[] => {
    const r = Math.max(1, Math.hypot(p.x - c.x, p.y - c.y));
    return [{ x: c.x - r, y: c.y - r, r }, { x: c.x + r, y: c.y - r, r }, { x: c.x + r, y: c.y + r, r }, { x: c.x - r, y: c.y + r, r }];
  };

  const onDown = (e: React.PointerEvent) => {
    const { cx, cy } = local(e);
    if (e.button === 1 || (e.button === 0 && tool === 'pan')) {
      e.preventDefault();
      if (e.button === 1) {
        const now = performance.now();
        if (now - lastMiddle.current < 350) { lastMiddle.current = 0; fit(); return; }
        lastMiddle.current = now;
      }
      drag.current = { kind: 'pan', sx: cx, sy: cy, vx: view.vx, vy: view.vy };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const raw = world(e);
    const last = draft[draft.length - 1];
    const p = snap(raw, e, last);
    switch (tool) {
      case 'select': {
        const v = hitVertex(raw);
        if (v >= 0) { setSel(v); commit({ ...doc }); drag.current = { kind: 'vertex', i: v }; break; }
        const m = hitMid(raw);
        if (m >= 0) {
          const a = pts[m], b = pts[(m + 1) % pts.length];
          const next = [...pts.slice(0, m + 1), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...pts.slice(m + 1)];
          commit({ ...doc, pts: next });
          setSel(m + 1);
          drag.current = { kind: 'vertex', i: m + 1 };
          break;
        }
        setSel(null);
        drag.current = { kind: 'pan', sx: cx, sy: cy, vx: view.vx, vy: view.vy };
        break;
      }
      case 'line':
        if (draft.length >= 3 && Math.hypot(p.x - draft[0].x, p.y - draft[0].y) < tol) closeDraft();
        else setDraft([...draft, p]);
        break;
      case 'rect':
        if (!draft.length) setDraft([p]);
        else { commit({ ...doc, pts: rectFrom(draft[0], p) }); setDraft([]); setSel(null); }
        break;
      case 'circle':
        if (!draft.length) setDraft([p]);
        else { commit({ ...doc, pts: circleFrom(draft[0], p) }); setDraft([]); setSel(null); }
        break;
      case 'fillet': {
        const v = hitVertex(raw);
        if (v >= 0) { commit({ ...doc, pts: pts.map((q, i) => (i === v ? { ...q, r: filletR || undefined } : q)) }); setSel(v); }
        break;
      }
      case 'image':
        if (trace) { commit({ ...doc }); drag.current = { kind: 'image', ox: raw.x, oy: raw.y, tx: trace.x, ty: trace.y }; }
        break;
      case 'calib':
        setCalib(calib.length >= 2 ? [raw] : [...calib, raw]);
        break;
      default:
    }
    if (drag.current) (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const raw = world(e);
    if (d?.kind === 'pan') {
      const { cx, cy } = local(e);
      setView((v) => ({ ...v, vx: d.vx - (cx - d.sx) / v.s, vy: d.vy - (cy - d.sy) / v.s }));
      return;
    }
    if (d?.kind === 'vertex') {
      const others = pts.filter((_, i) => i !== d.i);
      let p = e.altKey ? raw : { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step };
      const v = !e.altKey && others.find((q) => Math.hypot(q.x - raw.x, q.y - raw.y) < tol);
      if (v) p = { x: v.x, y: v.y };
      if (e.shiftKey) {
        // keep the corner on a horizontal or vertical line with a neighbour
        const n = pts.length, a = pts[(d.i + n - 1) % n], b = pts[(d.i + 1) % n];
        const ref = [a, b].sort((m, k) => Math.min(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) - Math.min(Math.abs(k.x - p.x), Math.abs(k.y - p.y)))[0];
        p = Math.abs(ref.x - p.x) < Math.abs(ref.y - p.y) ? { x: ref.x, y: p.y } : { x: p.x, y: ref.y };
      }
      setDoc((s) => ({ ...s, pts: s.pts.map((q, i) => (i === d.i ? { ...q, x: p.x, y: p.y } : q)) }));
      return;
    }
    if (d?.kind === 'image') {
      setDoc((s) => (s.trace ? { ...s, trace: { ...s.trace, x: d.tx + raw.x - d.ox, y: d.ty + raw.y - d.oy } } : s));
      return;
    }
    setHover(tool === 'calib' ? raw : snap(raw, e, draft[draft.length - 1]));
  };
  const onUp = () => { drag.current = null; };

  // ---------------------------------------------------------------- background image
  const loadImage = (f: File) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        // store a downscaled JPEG in the project so files stay manageable
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
        const src = cv.toDataURL('image/jpeg', 0.82);
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const bw = Math.max(50, Math.max(...xs) - Math.min(...xs)), cxm = (Math.max(...xs) + Math.min(...xs)) / 2, cym = (Math.max(...ys) + Math.min(...ys)) / 2;
        const w = bw * 1.1, h = (w * cv.height) / cv.width;
        const next = { ...doc, trace: { src, x: cxm - w / 2, y: cym - h / 2, w, h, opacity: 0.6 } };
        commit(next);
        fit(next);
        setTool('calib');
      };
      img.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  };
  const calibDist = calib.length === 2 ? Math.hypot(calib[1].x - calib[0].x, calib[1].y - calib[0].y) : 0;
  const applyCalib = () => {
    if (!trace || calibDist < 0.01 || calibMm <= 0) return;
    const k = calibMm / calibDist, a = calib[0];
    commit({ ...doc, trace: { ...trace, x: a.x + (trace.x - a.x) * k, y: a.y + (trace.y - a.y) * k, w: trace.w * k, h: trace.h * k } });
    setCalib([]);
    setTool('line');
  };

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); if (draft.length || calib.length) { setDraft([]); setCalib([]); } else setTool('select'); return; }
      if (e.key === 'Enter' && tool === 'line') { e.preventDefault(); closeDraft(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== null && pts.length > 3) { e.preventDefault(); commit({ ...doc, pts: pts.filter((_, i) => i !== sel) }); setSel(null); return; }
      const map: Record<string, Tool> = { l: 'line', r: 'rect', c: 'circle', f: 'fillet', s: 'select' };
      if (map[k]) { e.preventDefault(); setTool(map[k]); }
      else if (k === 'h') { e.preventDefault(); setTool('pan'); }
      else if (k === 'z') { e.preventDefault(); fit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------------------------------------------------------- save
  const box = useMemo(() => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { l: Math.max(...xs) - Math.min(...xs), w: Math.max(...ys) - Math.min(...ys) };
  }, [pts]);
  const save = () => {
    const n = normalizeOutline(pts);
    const tr = trace ? { ...trace, x: trace.x - n.dx, y: trace.y - n.dy } : undefined;
    // keep the cut-out where it is on the sheet although its origin moved
    const pos = item.rot ? { x: item.x + n.dy, y: item.y + item.l - n.l - n.dx } : { x: item.x + n.dx, y: item.y + n.dy };
    onSave({ outline: n.pts, l: Math.max(1, n.l), w: Math.max(1, n.w), shape: undefined, grips: undefined, trace: tr, x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 });
  };
  const close = () => { if (!dirty || confirm('Änderungen an der Kontur verwerfen?')) onClose(); };
  const applyTemplate = (kind: ShapeKind | 'rect' | 'circle') => {
    const l = Math.max(10, Math.round(box.l)), w = Math.max(10, Math.round(box.w));
    const x0 = Math.min(...pts.map((p) => p.x)), y0 = Math.min(...pts.map((p) => p.y));
    const base = kind === 'rect' ? rectOutline(l, w, 6) : kind === 'circle' ? rectOutline(Math.min(l, w), Math.min(l, w), Math.min(l, w) / 2) : shapeOutline(kind, l, w);
    commit({ ...doc, pts: base.map((p) => ({ ...p, x: p.x + x0, y: p.y + y0 })) });
    setSel(null);
  };

  // ---------------------------------------------------------------- render
  const { s, vx, vy } = view;
  const vw = size.w / s, vh = size.h / s;
  const px = 1 / s;
  const contour = filletPolygon(pts);
  const path = contour.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${(-y).toFixed(2)}`).join('') + 'Z';
  const gridStep = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((g) => g * s >= 14) ?? 1000;
  const major = gridStep * 5;
  const gx0 = Math.floor(vx / gridStep) * gridStep, gy0 = Math.floor(vy / gridStep) * gridStep;
  const gridLines: React.ReactNode[] = [];
  for (let x = gx0; x <= vx + vw; x += gridStep) gridLines.push(<line key={'x' + x} x1={x} x2={x} y1={vy} y2={vy + vh} stroke={Math.abs(x % major) < 1e-6 ? '#333a44' : '#232830'} strokeWidth={px} />);
  for (let y = gy0; y <= vy + vh; y += gridStep) gridLines.push(<line key={'y' + y} y1={y} y2={y} x1={vx} x2={vx + vw} stroke={Math.abs(y % major) < 1e-6 ? '#333a44' : '#232830'} strokeWidth={px} />);
  const last = draft[draft.length - 1];
  const preview = hover && draft.length ? (
    tool === 'rect' ? rectFrom(draft[0], hover) : tool === 'circle' ? circleFrom(draft[0], hover) : null
  ) : null;
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const cursor = tool === 'pan' ? 'grab' : tool === 'image' ? 'move' : tool === 'select' ? 'default' : 'crosshair';
  const hint = {
    select: 'Eckpunkt ziehen verschiebt ihn. Die kleinen Punkte auf den Kanten ziehen fügt einen Eckpunkt ein. Entf löscht den gewählten Punkt.',
    line: draft.length ? `Nächster Punkt. Länge ${hover && last ? fmt(Math.hypot(hover.x - last.x, hover.y - last.y)) : 0} mm. Ersten Punkt anklicken, Doppelklick oder Enter schließt die Kontur.` : 'Ersten Punkt der Kontur klicken. Die neue Kontur ersetzt die alte.',
    rect: draft.length ? `Zweite Ecke klicken. ${hover ? `${fmt(Math.abs(hover.x - draft[0].x))} × ${fmt(Math.abs(hover.y - draft[0].y))} mm` : ''}` : 'Erste Ecke klicken.',
    circle: draft.length ? `Radius klicken. ${hover ? `Durchmesser ${fmt(2 * Math.hypot(hover.x - draft[0].x, hover.y - draft[0].y))} mm` : ''}` : 'Mittelpunkt klicken.',
    fillet: `Eckpunkt anklicken, um ihn mit ${fmt(filletR)} mm abzurunden.`,
    pan: 'Ziehen verschiebt die Ansicht.',
    image: 'Bild ziehen, um es unter die Kontur zu legen.',
    calib: calib.length < 2 ? `Bild kalibrieren: ${calib.length ? 'zweiten' : 'ersten'} Punkt einer bekannten Strecke auf dem Bild klicken.` : `Gemessen ${fmt(calibDist)} mm. Echte Länge rechts eintragen und übernehmen.`,
  }[tool];

  return (
    <div className="modal-backdrop">
      <div className="modal wide shape-editor" role="dialog" aria-label="Form-Editor">
        <div className="modal-head">
          <h2>Kontur zeichnen: {item.name}</h2>
          <button className="icon-btn" onClick={close} aria-label="Schließen" title="Schließen">✕</button>
        </div>
        <div className="se-body">
          <div className="se-tools">
            <div className="se-group">
              <span className="se-label">Zeichnen</span>
              {TOOLS.map((t) => (
                <button key={t.id} className={'se-tool' + (tool === t.id ? ' on' : '')} onClick={() => setTool(t.id)} title={t.title}>
                  {t.label}<kbd>{t.key}</kbd>
                </button>
              ))}
            </div>
            <div className="se-group">
              <span className="se-label">Bearbeiten</span>
              <div className="row gap4">
                <button className="btn sm" disabled={!undo.length} onClick={doUndo} title="Rückgängig (Strg+Z)">Rückgängig</button>
                <button className="btn sm" disabled={!redo.length} onClick={doRedo} title="Wiederholen (Strg+Y)">Wiederholen</button>
              </div>
              <label className="se-field">Radius Abrunden <NumberInput value={filletR} min={0} max={200} onChange={setFilletR} /></label>
              <label className="se-field">Raster
                <select value={step} onChange={(e) => setStep(Number(e.target.value))}>{STEPS.map((v) => <option key={v} value={v}>{String(v).replace('.', ',')} mm</option>)}</select>
              </label>
              <div className="muted small">Alt gedrückt: ohne Raster. Umschalt: nur waagerecht oder senkrecht.</div>
            </div>
            <div className="se-group">
              <span className="se-label">Vorlage einsetzen</span>
              <select value="" onChange={(e) => e.target.value && applyTemplate(e.target.value as ShapeKind)} title="Ersetzt die Kontur durch eine Vorlage in der aktuellen Größe">
                <option value="">Vorlage wählen …</option>
                <option value="rect">Rechteck</option>
                <option value="circle">Kreis</option>
                {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((k) => <option key={k} value={k}>{SHAPE_LABELS[k]}</option>)}
              </select>
            </div>
            <div className="se-group">
              <span className="se-label">Hintergrundbild</span>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = ''; }} />
              <button className="btn sm" onClick={() => fileRef.current?.click()} title="Foto oder Zeichnung des Produkts laden, am besten genau von oben">{trace ? 'Anderes Bild laden' : 'Bild laden'}</button>
              {trace ? (
                <>
                  <div className="row gap4">
                    <button className={'btn sm' + (tool === 'image' ? ' primary' : '')} onClick={() => setTool('image')} title="Bild mit der Maus verschieben">Verschieben</button>
                    <button className={'btn sm' + (tool === 'calib' ? ' primary' : '')} onClick={() => setTool('calib')} title="Zwei Punkte mit bekanntem Abstand anklicken und den echten Abstand eintragen">Kalibrieren</button>
                  </div>
                  {tool === 'calib' && calib.length === 2 ? (
                    <div className="row gap4 align-end">
                      <label className="se-field">Echter Abstand (mm) <NumberInput value={calibMm} min={1} onChange={setCalibMm} /></label>
                      <button className="btn sm primary" onClick={applyCalib}>Übernehmen</button>
                    </div>
                  ) : null}
                  <label className="se-field">Deckkraft
                    <input type="range" min={0.1} max={1} step={0.05} value={trace.opacity} onChange={(e) => setDoc({ ...doc, trace: { ...trace, opacity: Number(e.target.value) } })} />
                  </label>
                  <div className="muted small">Bildbreite {fmt(trace.w)} mm</div>
                  <button className="btn sm danger" onClick={() => commit({ ...doc, trace: undefined })}>Bild entfernen</button>
                </>
              ) : <div className="muted small">Produkt von oben fotografieren, Bild laden, über eine bekannte Länge kalibrieren und die Kontur nachzeichnen.</div>}
            </div>
          </div>

          <div className="se-canvas" ref={boxRef}>
            <svg ref={svgRef} width={size.w} height={size.h} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{ cursor }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)}
              onDoubleClick={() => { if (tool === 'line' && draft.length >= 3) closeDraft(draft.slice(0, -1)); }}
              onAuxClick={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
              <rect x={vx} y={vy} width={vw} height={vh} fill="#15181c" />
              {gridLines}
              <line x1={vx} x2={vx + vw} y1={0} y2={0} stroke="#7f1d1d" strokeWidth={px * 1.2} />
              <line y1={vy} y2={vy + vh} x1={0} x2={0} stroke="#14532d" strokeWidth={px * 1.2} />
              {trace ? <image href={trace.src} x={trace.x} y={-(trace.y + trace.h)} width={trace.w} height={trace.h} opacity={trace.opacity} preserveAspectRatio="none" style={{ pointerEvents: 'none' }} /> : null}
              <path d={path} fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth={px * 1.6} />
              {/* control polygon */}
              <polygon points={pts.map((p) => `${p.x},${-p.y}`).join(' ')} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeWidth={px} strokeDasharray={`${4 * px} ${3 * px}`} />
              {tool === 'select' ? pts.map((a, i) => {
                const b = pts[(i + 1) % pts.length];
                return <circle key={'m' + i} cx={(a.x + b.x) / 2} cy={-(a.y + b.y) / 2} r={3 * px} fill="#15181c" stroke="#22d3ee" strokeOpacity={0.7} strokeWidth={px} />;
              }) : null}
              {pts.map((p, i) => (
                <rect key={i} x={p.x - 4 * px} y={-p.y - 4 * px} width={8 * px} height={8 * px} fill={sel === i ? '#22d3ee' : '#15181c'} stroke={p.r ? '#fbbf24' : '#22d3ee'} strokeWidth={px * 1.4} />
              ))}
              {/* drafts */}
              {draft.length && tool === 'line' ? (
                <polyline points={[...draft, ...(hover ? [hover] : [])].map((p) => `${p.x},${-p.y}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={px * 1.5} />
              ) : null}
              {preview ? <polygon points={(tool === 'circle' ? filletPolygon(preview).map(([x, y]) => ({ x, y })) : preview).map((p) => `${p.x},${-p.y}`).join(' ')} fill="rgba(251,191,36,0.1)" stroke="#fbbf24" strokeWidth={px * 1.5} /> : null}
              {draft.map((p, i) => <circle key={'d' + i} cx={p.x} cy={-p.y} r={3.5 * px} fill="#fbbf24" />)}
              {calib.map((p, i) => <circle key={'c' + i} cx={p.x} cy={-p.y} r={5 * px} fill="none" stroke="#f472b6" strokeWidth={px * 2} />)}
              {calib.length === 2 ? <line x1={calib[0].x} y1={-calib[0].y} x2={calib[1].x} y2={-calib[1].y} stroke="#f472b6" strokeWidth={px * 1.5} /> : null}
              {hover && tool !== 'select' && tool !== 'pan' && tool !== 'image' ? (
                <g stroke="#fbbf24" strokeWidth={px}>
                  <line x1={hover.x - 8 * px} x2={hover.x + 8 * px} y1={-hover.y} y2={-hover.y} />
                  <line x1={hover.x} x2={hover.x} y1={-hover.y - 8 * px} y2={-hover.y + 8 * px} />
                </g>
              ) : null}
            </svg>
            <div className="se-hint">{hint}</div>
            <div className="se-nav" title="Mittlere Maustaste ziehen: verschieben. Mausrad: zoomen um den Mauszeiger. Doppelklick mittlere Maustaste: einpassen.">
              <button className={tool === 'pan' ? 'on' : ''} onClick={() => setTool(tool === 'pan' ? 'select' : 'pan')} title="Ansicht verschieben (H, oder mittlere Maustaste ziehen)">Verschieben</button>
              <button onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)} title="Vergrößern (Mausrad)">+</button>
              <button onClick={() => zoomAt(size.w / 2, size.h / 2, 0.8)} title="Verkleinern (Mausrad)">−</button>
              <button onClick={() => fit()} title="Alles einpassen (Z, oder Doppelklick mit der mittleren Maustaste)">Einpassen</button>
              <span className="se-coord">{hover ? `x ${fmt(hover.x)}  y ${fmt(hover.y)} mm` : ''}</span>
            </div>
          </div>

          <div className="se-props">
            <div className="se-group">
              <span className="se-label">Kontur</span>
              <div className="se-size">{fmt(box.l)} × {fmt(box.w)} mm</div>
              <div className="muted small">{pts.length} Eckpunkte. Die Tasche wird so groß wie die Kontur, Länge und Breite folgen daraus.</div>
            </div>
            <div className="se-group se-points">
              <span className="se-label">Eckpunkte</span>
              <table className="se-table">
                <thead><tr><th></th><th>x</th><th>y</th><th>Radius</th></tr></thead>
                <tbody>
                  {pts.map((p, i) => (
                    <tr key={i} className={sel === i ? 'sel' : ''} onClick={() => setSel(i)}>
                      <td>{i + 1}</td>
                      <td><NumberInput value={Math.round(p.x * 10) / 10} step={step} onChange={(v) => commit({ ...doc, pts: pts.map((q, k) => (k === i ? { ...q, x: v } : q)) })} /></td>
                      <td><NumberInput value={Math.round(p.y * 10) / 10} step={step} onChange={(v) => commit({ ...doc, pts: pts.map((q, k) => (k === i ? { ...q, y: v } : q)) })} /></td>
                      <td><NumberInput value={Math.round((p.r ?? 0) * 10) / 10} min={0} onChange={(v) => commit({ ...doc, pts: pts.map((q, k) => (k === i ? { ...q, r: v || undefined } : q)) })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span className="muted small">Mittlere Maustaste ziehen verschiebt, Mausrad zoomt, Doppelklick mit der mittleren Taste passt ein.</span>
          <span className="spacer" />
          <button className="btn" onClick={close}>Abbrechen</button>
          <button className="btn primary" disabled={pts.length < 3} onClick={save} title="Kontur für diesen Ausschnitt übernehmen">Kontur übernehmen</button>
        </div>
      </div>
    </div>
  );
}
