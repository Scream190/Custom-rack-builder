import type { CaseItem, FlightCase, FoamMaterial, Project } from './types';
import { footprint, isDrawer, packItems, usableArea } from './cases';
import { uid } from './util';

/*
 * Foam inlay helpers shared by the inlay designer, its drawing, the 3D view and the DXF export: cut-out outlines with
 * corner radii and finger grips, foam materials and the sheet stack an inlay is cut from.
 */

export const GRIP_R = 15;

export const FOAM_MATERIALS: Record<FoamMaterial, { label: string; density: number; sheets: number[]; note: string }> = {
  PE: { label: 'PE-Schaum (Polyethylen)', density: 30, sheets: [50, 40, 30, 20, 15, 10, 5], note: 'geschlossenzellig, fest, wasserabweisend, üblich für Werkzeug- und Technikeinlagen' },
  PU: { label: 'PU-Schaum (Polyurethan)', density: 25, sheets: [100, 80, 60, 50, 40, 30, 20, 10], note: 'offenzellig, weich, gut für empfindliche Oberflächen' },
  EVA: { label: 'EVA-Schaum', density: 60, sheets: [30, 20, 15, 10, 5], note: 'dicht und glatt, für sichtbare Einlagen und scharfe Kanten' },
};

export const foamMaterial = (c: FlightCase): FoamMaterial => c.foam.material ?? 'PE';

/** sheet thicknesses (largest first) that add up to at least `total` mm */
export function foamStack(total: number, material: FoamMaterial): number[] {
  const sheets = FOAM_MATERIALS[material].sheets;
  const out: number[] = [];
  let rest = Math.round(total);
  while (rest > 0.5) {
    const fit = sheets.find((s) => s <= rest);
    if (fit === undefined) { out.push(sheets[sheets.length - 1]); break; }
    out.push(fit);
    rest -= fit;
  }
  return out;
}

export const formatStack = (stack: number[]) => {
  const counts = new Map<number, number>();
  for (const t of stack) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([t, n]) => `${n} × ${t} mm`).join(' + ');
};

/** cut depth of an item (default: its height) */
export const cutDepth = (it: CaseItem) => it.depth ?? it.h;

/** thickness of the cut-out layer of an inlay (deepest cut, at least 10 mm) */
export function inlayThickness(c: FlightCase, layer: CaseItem['layer'] = 'body') {
  const items = c.items.filter((i) => i.layer === layer);
  return items.length ? Math.max(10, ...items.map(cutDepth)) : 0;
}

/**
 * Outline of a cut-out as a closed polygon in inlay coordinates (x from the left, y from the front, counter-clockwise
 * with y pointing backwards). Rounded corners and half-round finger grips are sampled.
 */
export function cutoutOutline(it: CaseItem): [number, number][] {
  const f = footprint(it);
  const x0 = it.x, y0 = it.y, x1 = it.x + f.l, y1 = it.y + f.w;
  const pts: [number, number][] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  };
  if (it.shape === 'circle') {
    const n = 48;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([(x0 + x1) / 2 + (f.l / 2) * Math.cos(a), (y0 + y1) / 2 + (f.w / 2) * Math.sin(a)]); }
    return pts;
  }
  const r = Math.max(0, Math.min(it.radius ?? 6, f.l / 2 - 0.5, f.w / 2 - 0.5));
  const grips = new Set(it.grips ?? []);
  const g = (side: number) => { const v = Math.min(GRIP_R, side / 2 - r - 1); return v >= 4 ? v : 0; };
  const gx = g(f.l), gy = g(f.w);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const P = Math.PI;
  const corner = (cx: number, cy: number, a0: number) => { if (r > 0) arc(cx, cy, r, a0, a0 + P / 2, 6); else pts.push([cx, cy]); };
  // front edge (left to right), grip bulging to the front
  if (r <= 0) pts.push([x0, y0]);
  if (grips.has('front') && gx) { pts.push([mx - gx, y0]); arc(mx, y0, gx, P, 2 * P, 12); }
  corner(r > 0 ? x1 - r : x1, r > 0 ? y0 + r : y0, -P / 2);
  if (grips.has('right') && gy) { pts.push([x1, my - gy]); arc(x1, my, gy, -P / 2, P / 2, 12); }
  corner(r > 0 ? x1 - r : x1, r > 0 ? y1 - r : y1, 0);
  if (grips.has('back') && gx) { pts.push([mx + gx, y1]); arc(mx, y1, gx, 0, P, 12); }
  corner(r > 0 ? x0 + r : x0, r > 0 ? y1 - r : y1, P / 2);
  if (grips.has('left') && gy) { pts.push([x0, my + gy]); arc(x0, my, gy, P / 2, 1.5 * P, 12); }
  if (r > 0) corner(x0 + r, y0 + r, P);
  // remove duplicate consecutive points
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.01);
}

/** bounding box of an outline */
export function outlineBox(pts: [number, number][]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

/** SVG path of an outline, with a y mapping (inlay y -> svg y) */
export const outlinePath = (pts: [number, number][], X: (x: number) => number, Y: (y: number) => number) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join('') + 'Z';

/** containers an inlay can belong to */
export function inlayContainer(p: Project, c: FlightCase): string {
  if (isDrawer(c)) {
    const rack = p.racks.find((r) => r.id === c.drawer?.rackId);
    const dev = rack?.devices.find((d) => d.id === c.drawer?.deviceId);
    const tpl = dev ? p.templates[dev.templateId] : undefined;
    return dev && rack ? `Schublade ${dev.label || tpl?.name || ''} in „${rack.name}“` : 'Schublade (nicht mehr im Rack)';
  }
  if (c.kind === 'inlay') return 'freier Behälter';
  return 'Flightcase aus dem Case-Designer';
}

/** free foam inlay for any container with the given inner size */
export function newFreeInlay(name: string, inner = { l: 500, w: 350, h: 80 }): FlightCase {
  return {
    id: uid('case-'), name, kind: 'inlay', inner, lidKind: 'none', lidH: 0, panel: 0, profile: 'none', color: '#202022',
    cornerBalls: false, hardware: [], castorSize: 100, foam: { bottom: 10, lid: 0, sides: 15, color: '#3f3f46', material: 'PE' },
    items: [], dividers: [],
  };
}

/** inlays shown in the inlay designer: drawers and free inlays first, then the foam of each flight case */
export function inlayList(p: Project): FlightCase[] {
  const all = p.cases ?? [];
  return [...all.filter((c) => c.kind === 'drawer' || c.kind === 'inlay'), ...all.filter((c) => !c.kind || c.kind === 'case')];
}

/** flight cases shown in the case designer */
export const caseList = (p: Project) => (p.cases ?? []).filter((c) => !c.kind || c.kind === 'case');

/** cut list rows (position from the left/front edge of the inner space) */
export function cutList(c: FlightCase) {
  const area = usableArea(c);
  return c.items.map((it) => {
    const f = footprint(it);
    return {
      it, l: f.l, w: f.w, depth: cutDepth(it), x: it.x, y: it.y,
      inside: it.x >= area.x0 - 0.5 && it.y >= area.y0 - 0.5 && it.x + f.l <= area.x1 + 0.5 && it.y + f.w <= area.y1 + 0.5,
    };
  });
}

/** re-pack with a gap and return the new item list */
export const arrangeItems = (c: FlightCase, gap: number) => packItems(c, gap).items;
