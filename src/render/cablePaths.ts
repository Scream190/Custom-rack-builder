import type { Cable, CableType, Face, Project, Rack } from '../model/types';
import { cableLength, faceWidth, formatLength, resolveEnd, U, type ResolvedEnd } from '../model/geometry';
import { connectorDef } from '../model/connectors';

export interface Pt { x: number; y: number }

export interface CableDrawing {
  cable: Cable;
  type: CableType | undefined;
  color: string;
  /** svg path in view coordinates */
  d: string;
  label: Pt;
  labelText: string;
  /** set when the cable continues on the other side of the rack */
  stub?: { side: 'left' | 'right'; end: Pt; text: string };
  a: ResolvedEnd;
  b: ResolvedEnd;
  length: number;
}

export function cableColor(project: Project, cable: Cable): string {
  return cable.color || project.cableTypes.find((t) => t.id === cable.typeId)?.color || '#888';
}

export function cableNumberText(c: Cable) {
  return 'W' + String(c.number).padStart(3, '0');
}

export function cableLabelText(project: Project, c: Cable, length: number): string {
  const mode = project.settings.cableLabel;
  const len = formatLength(length);
  const num = cableNumberText(c);
  const custom = c.label ? ` ${c.label}` : '';
  if (mode === 'length') return len + custom;
  if (mode === 'number') return num + custom;
  if (mode === 'both') return `${num} · ${len}${custom}`;
  return '';
}

/** Convert rack-space (x from left in view, y from bottom) into svg coordinates (y down, 0 = top of top U). */
export const toSvg = (rack: Rack, x: number, y: number): Pt => ({ x, y: rack.type.heightU * U - y });

function bezierMid(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt {
  return {
    x: 0.125 * p0.x + 0.375 * p1.x + 0.375 * p2.x + 0.125 * p3.x,
    y: 0.125 * p0.y + 0.375 * p1.y + 0.375 * p2.y + 0.125 * p3.y,
  };
}

/** Compute drawings of all cables visible in a view. `sideGap` = how far outside the rack face stubs reach. */
export function computeCableDrawings(project: Project, rack: Rack, view: Face, sideGap: number, lane = LANE): CableDrawing[] {
  const style = project.settings.curveStyle;
  if (style === 'orthogonal') return orthogonalDrawings(project, rack, view, sideGap, lane);
  return organicDrawings(project, rack, view, sideGap);
}

interface Item {
  cable: Cable;
  a: ResolvedEnd;
  b: ResolvedEnd;
  type: CableType | undefined;
  color: string;
  labelText: string;
  length: number;
  onA: boolean;
  onB: boolean;
}

function collect(project: Project, rack: Rack, view: Face): Item[] {
  const items: Item[] = [];
  for (const cable of rack.cables) {
    const a = resolveEnd(project, rack, cable.a);
    const b = resolveEnd(project, rack, cable.b);
    if (!a || !b) continue;
    const onA = a.pos.facing === view;
    const onB = b.pos.facing === view;
    if (!onA && !onB) continue;
    const length = cableLength(project, rack, cable)?.length ?? 0;
    items.push({
      cable, a, b, onA, onB, length,
      type: project.cableTypes.find((t) => t.id === cable.typeId),
      color: cableColor(project, cable),
      labelText: cableLabelText(project, cable, length),
    });
  }
  return items;
}

const LANE = 2.6; // spacing of parallel runs (mm)

/**
 * Schematic routing for maximum clarity (not physical):
 * every cable leaves its connector straight down on its own stub height (one per device and cable), runs
 * horizontally to its own vertical lane, and enters the other connector the same way. 90° corners only;
 * vertical runs that overlap in height get separate lanes, so parallel cables never cover each other.
 */
function orthogonalDrawings(project: Project, rack: Rack, view: Face, sideGap: number, LANE: number): CableDrawing[] {
  const fw = faceWidth(rack.type.rackStandard);
  const H = rack.type.heightU * U;
  const vx = (x: number) => (view === 'front' ? x : fw - x);
  const items = collect(project, rack, view);
  const pt = (e: ResolvedEnd) => toSvg(rack, vx(e.pos.x), e.pos.y);
  const rad = (e: ResolvedEnd) => { const d = connectorDef(e.port.connector); return Math.max(d.w, d.h) / 2; };

  // 1) stubs: each end leaves its connector towards the other end (up when the target is higher, else down),
  //    on its own lane per device and direction (sorted by connector x) so horizontal runs never coincide
  const ends: { item: Item; end: ResolvedEnd; key: 'a' | 'b'; x: number; up: boolean }[] = [];
  for (const it of items) {
    const both = it.onA && it.onB;
    if (it.onA) ends.push({ item: it, end: it.a, key: 'a', x: pt(it.a).x, up: both && pt(it.b).y < pt(it.a).y - 1 });
    if (it.onB) ends.push({ item: it, end: it.b, key: 'b', x: pt(it.b).x, up: both && pt(it.a).y < pt(it.b).y - 1 });
  }
  const stubY = new Map<string, number>();
  const groups = new Map<string, typeof ends>();
  for (const e of ends) {
    const k = e.end.device.id + (e.up ? ':up' : ':down');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  for (const list of groups.values()) {
    list.sort((p, q) => p.x - q.x);
    const up = list[0].up;
    const base = up
      ? Math.min(...list.map((e) => pt(e.end).y - rad(e.end))) - 2.4
      : Math.max(...list.map((e) => pt(e.end).y + rad(e.end))) + 2.4;
    list.forEach((e, i) => stubY.set(`${e.item.cable.id}:${e.key}`, up ? Math.max(-30, base - i * LANE) : Math.min(H + 30, base + i * LANE)));
  }

  // 2) vertical lanes, longest runs first; keep clear of runs already placed that overlap in height
  const placed: { x: number; y1: number; y2: number }[] = [];
  const laneX = new Map<string, number>();
  const both = items.filter((it) => it.onA && it.onB);
  both.sort((p, q) => Math.abs(stubY.get(q.cable.id + ':b')! - stubY.get(q.cable.id + ':a')!) - Math.abs(stubY.get(p.cable.id + ':b')! - stubY.get(p.cable.id + ':a')!));
  for (const it of both) {
    const ya = stubY.get(it.cable.id + ':a')!, yb = stubY.get(it.cable.id + ':b')!;
    const y1 = Math.min(ya, yb) - 0.5, y2 = Math.max(ya, yb) + 0.5;
    const x0 = (pt(it.a).x + pt(it.b).x) / 2;
    let x = x0;
    for (let n = 1; n < 200; n++) {
      const hit = placed.some((p) => Math.abs(p.x - x) < LANE * 0.95 && p.y1 < y2 && y1 < p.y2);
      if (!hit) break;
      x = x0 + Math.ceil(n / 2) * LANE * (n % 2 ? 1 : -1);
    }
    x = Math.max(-sideGap + 4, Math.min(fw + sideGap - 4, x));
    placed.push({ x, y1, y2 });
    laneX.set(it.cable.id, x);
  }

  const out: CableDrawing[] = [];
  for (const it of items) {
    if (it.onA && it.onB) {
      const p0 = pt(it.a), p3 = pt(it.b);
      const ya = stubY.get(it.cable.id + ':a')!, yb = stubY.get(it.cable.id + ':b')!;
      const x = laneX.get(it.cable.id)!;
      const d = `M${p0.x},${p0.y} V${ya} H${x} V${yb} H${p3.x} V${p3.y}`;
      // label on the longest segment
      const segs = [
        { len: Math.abs(x - p0.x), at: { x: (x + p0.x) / 2, y: ya } },
        { len: Math.abs(yb - ya), at: { x, y: (ya + yb) / 2 } },
        { len: Math.abs(p3.x - x), at: { x: (x + p3.x) / 2, y: yb } },
      ].sort((p, q) => q.len - p.len);
      out.push({ cable: it.cable, type: it.type, color: it.color, d, label: segs[0].at, labelText: it.labelText, a: it.a, b: it.b, length: it.length });
      continue;
    }
    // continues on the other side of the rack: stub down, then straight out to the side the route uses
    const here = it.onA ? it.a : it.b;
    const there = it.onA ? it.b : it.a;
    const viaLeftFront = it.a.pos.x + it.b.pos.x <= 2 * fw - it.a.pos.x - it.b.pos.x;
    const side: 'left' | 'right' = view === 'front' ? (viaLeftFront ? 'left' : 'right') : viaLeftFront ? 'right' : 'left';
    const p0 = pt(here);
    const y = stubY.get(`${it.cable.id}:${it.onA ? 'a' : 'b'}`)!;
    const ex = side === 'left' ? -sideGap : fw + sideGap;
    const otherName = there.device.label || there.tpl.name;
    out.push({
      cable: it.cable, type: it.type, color: it.color,
      d: `M${p0.x},${p0.y} V${y} H${ex}`,
      label: { x: side === 'left' ? -sideGap / 2 - 6 : fw + sideGap / 2 + 6, y },
      labelText: it.labelText,
      stub: { side, end: { x: ex, y }, text: `» ${view === 'front' ? 'hinten' : 'vorne'}: ${otherName} · ${there.port.name}` },
      a: it.a, b: it.b, length: it.length,
    });
  }
  return out;
}

/** Hanging / straight cables (the earlier, more realistic look). */
function organicDrawings(project: Project, rack: Rack, view: Face, sideGap: number): CableDrawing[] {
  const fw = faceWidth(rack.type.rackStandard);
  const style = project.settings.curveStyle;
  const out: CableDrawing[] = [];
  collect(project, rack, view).forEach((it, idx) => {
    const { cable, a, b, type, color, labelText, length, onA, onB } = it;
    const vx = (x: number) => (view === 'front' ? x : fw - x);
    if (onA && onB) {
      const p0 = toSvg(rack, vx(a.pos.x), a.pos.y);
      const p3 = toSvg(rack, vx(b.pos.x), b.pos.y);
      const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      let d: string;
      let label: Pt;
      if (style === 'straight') {
        d = `M${p0.x},${p0.y} L${p3.x},${p3.y}`;
        label = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
      } else {
        const sag = 14 + dist * 0.22 + (idx % 4) * 2;
        const p1 = { x: p0.x + (p3.x - p0.x) * 0.1, y: p0.y + sag };
        const p2 = { x: p3.x - (p3.x - p0.x) * 0.1, y: p3.y + sag };
        d = `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
        label = bezierMid(p0, p1, p2, p3);
      }
      out.push({ cable, type, color, d, label, labelText, a, b, length });
      return;
    }
    const here = onA ? a : b;
    const there = onA ? b : a;
    const viaLeftFront = a.pos.x + b.pos.x <= 2 * fw - a.pos.x - b.pos.x;
    const sideInView: 'left' | 'right' = view === 'front' ? (viaLeftFront ? 'left' : 'right') : viaLeftFront ? 'right' : 'left';
    const p0 = toSvg(rack, vx(here.pos.x), here.pos.y);
    const ex = sideInView === 'left' ? -sideGap : fw + sideGap;
    const ey = Math.min(rack.type.heightU * U, p0.y + 10 + (idx % 8) * 3.2);
    const otherName = there.device.label || there.tpl.name;
    out.push({
      cable, type, color,
      d: `M${p0.x},${p0.y} C${p0.x},${ey} ${(p0.x + ex) / 2},${ey} ${ex},${ey}`,
      label: { x: (p0.x + ex) / 2, y: ey - 0.5 },
      labelText,
      stub: { side: sideInView, end: { x: ex, y: ey }, text: `» ${view === 'front' ? 'hinten' : 'vorne'}: ${otherName} · ${there.port.name}` },
      a, b, length,
    });
  });
  return out;
}
