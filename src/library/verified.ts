/*
 * Data-sheet check of the device library (November 2026).
 *
 * Every device was compared with its manufacturer's data sheet (or a retailer listing that quotes it). The results are
 * kept in verifiedData.ts, one entry per device with the source, and applied here when the library is built:
 *  - depth, weight, body width and name are replaced
 *  - a different number of height units or a different width (half rack / full width) moves the connectors, module
 *    bays and front artwork along, so the layout stays inside the panel (centred when the panel grows, compressed when
 *    it shrinks)
 *  - the template's `source` says what was checked and where the figures come from
 * Devices without any source get the accuracy label the project rules ask for.
 */
import type { ArtElement, DeviceTemplate, ModuleBay, Port } from '../model/types';
import { U } from '../model/geometry';
import { VERIFIED } from './verifiedData';

export interface VerifiedEntry {
  id: string;
  /** where the figures come from */
  src: string;
  /** no reliable figure found: values stay as they are */
  unconfirmed?: boolean;
  depth?: number;
  weight?: number;
  heightU?: number;
  /** 0 removes a body width that was too narrow */
  bodyWidth?: number;
  /** 1 = full 19" width, 2 = half rack */
  slots?: number;
  name?: string;
  /** hand-placed connectors (name -> [x, y]) where the moved layout does not fit the new panel; positions estimated */
  pos?: Record<string, [number, number]>;
}

const panelH = (u: number) => u * U - 0.8;

/** usable x range of a panel side (rack ears at the front, chassis at the rear, or the body of a kit device) */
function xRange(t: Pick<DeviceTemplate, 'slots' | 'bodyWidth' | 'rackStandard' | 'panel'>, side: 'front' | 'rear'): [number, number] {
  const W = (t.rackStandard === 10 ? 254 : 482.6) / t.slots;
  if (t.bodyWidth && t.bodyWidth < W - 1) return [(W - t.bodyWidth) / 2, (W + t.bodyWidth) / 2];
  if (t.slots === 1 && !t.panel) return side === 'front' ? [20, W - 20] : [16, W - 16];
  return [0, W];
}

type Map1 = (v: number) => number;
interface Xf { x: Map1; y: Map1; kx: number; ky: number }

function xfArt(a: ArtElement, f: Xf): ArtElement {
  const sw = Math.min(1, f.kx), sh = Math.min(1, f.ky), sr = Math.min(sw, sh);
  switch (a.t) {
    case 'rect': case 'lcd': case 'button': case 'switch': case 'vents': case 'labelArea': {
      const w = a.w * sw, h = a.h * sh;
      return { ...a, x: f.x(a.x + a.w / 2) - w / 2, y: f.y(a.y + a.h / 2) - h / 2, w, h } as ArtElement;
    }
    case 'circle': case 'knob':
      return { ...a, x: f.x(a.x), y: f.y(a.y), r: a.r * sr };
    case 'line':
      return { ...a, x1: f.x(a.x1), y1: f.y(a.y1), x2: f.x(a.x2), y2: f.y(a.y2) };
    case 'text':
      return { ...a, x: f.x(a.x), y: f.y(a.y), size: a.size * Math.min(1, sr + 0.15) };
    case 'leds':
      return { ...a, x: f.x(a.x), y: f.y(a.y), dx: a.dx !== undefined ? a.dx * sw : a.dx, dy: a.dy !== undefined ? a.dy * sh : a.dy };
    default:
      return a; // free paths cannot be moved reliably; they keep their place
  }
}

/** move connectors, bays and artwork of one panel side from the old to the new panel geometry */
function relayout(old: DeviceTemplate, next: DeviceTemplate): Partial<DeviceTemplate> {
  const oh = panelH(old.heightU), nh = panelH(next.heightU);
  const fy: Map1 = nh >= oh ? (y) => y + (nh - oh) / 2 : (y) => (y * nh) / oh;
  const sideXf = (side: 'front' | 'rear'): Xf => {
    const [a0, a1] = xRange(old, side), [b0, b1] = xRange(next, side);
    const kx = (b1 - b0) / (a1 - a0);
    return { x: (x) => b0 + (x - a0) * kx, y: fy, kx, ky: nh / oh };
  };
  const xf = { front: sideXf('front'), rear: sideXf('rear') };
  const ports: Port[] = old.ports.map((p) => ({ ...p, x: Math.round(xf[p.side].x(p.x) * 10) / 10, y: Math.round(xf[p.side].y(p.y) * 10) / 10 }));
  const modules: ModuleBay[] | undefined = old.modules?.map((m) => {
    const f = xf[m.side ?? 'front'];
    const w = m.w * Math.min(1, f.kx), h = m.h * Math.min(1, f.ky);
    return { ...m, x: f.x(m.x + m.w / 2) - w / 2, y: f.y(m.y + m.h / 2) - h / 2, w, h };
  });
  const art = old.art ? { front: old.art.front?.map((a) => xfArt(a, xf.front)), rear: old.art.rear?.map((a) => xfArt(a, xf.rear)) } : undefined;
  return { ports, modules, art };
}

/** connector types corrected in the check (the port name says what the connector is) */
const PORT_FIX: Record<string, Record<string, string>> = {
  'motu-828': { 'USB-C': 'USB-C' },
  'motu-8pre-es': { USB: 'USB' },
  'motu-16a': { USB: 'USB' },
  'nova-vx1000': { USB: 'USB' },
  'rme-m32adpro': { 'MADI Optical In': 'SC', 'MADI Optical Out': 'SC' },
  'rme-madi-router': { 'MADI Optical In 1': 'SC', 'MADI Optical Out 1': 'SC', 'MADI Optical In 2': 'SC', 'MADI Optical Out 2': 'SC' },
  'rme-ufx3': { 'MADI Optical In': 'SC', 'MADI Optical Out': 'SC' },
  'rme-octamic-xtc': { 'MADI Optical In': 'SC', 'MADI Optical Out': 'SC' },
  'antelope-orion32': { 'MADI In': 'SC', 'MADI Out': 'SC' },
};

const ACCURACY = /vermessen|abgeleitet|Datenblatt|Schätzung|geschätzt|generisch|Generische/i;

export function applyVerified(list: DeviceTemplate[]): DeviceTemplate[] {
  const byId = new Map(VERIFIED.map((v) => [v.id, v]));
  return list.map((t) => {
    const v = byId.get(t.id);
    let out: DeviceTemplate = t;
    if (v) {
      if (v.unconfirmed) {
        out = { ...t, source: `${t.source ?? 'Schätzung'}; Maße 11/2026 nicht bestätigt (${v.src})` };
      } else {
        const next: DeviceTemplate = { ...t };
        if (v.depth !== undefined) next.depth = v.depth;
        if (v.weight !== undefined) next.weight = v.weight;
        if (v.name) next.name = v.name;
        if (v.heightU !== undefined) next.heightU = v.heightU;
        if (v.slots !== undefined) next.slots = v.slots as DeviceTemplate["slots"];
        if (v.bodyWidth === 0) delete next.bodyWidth;
        else if (v.bodyWidth !== undefined) next.bodyWidth = v.bodyWidth;
        // a full-width device has no separate body width unless it is narrower than the panel
        if (next.slots === 1 && v.slots === 1 && t.slots !== 1) delete next.bodyWidth;
        const geometryChanged = next.heightU !== t.heightU || next.slots !== t.slots
          || xRange(next, 'front')[0] !== xRange(t, 'front')[0] || xRange(next, 'rear')[0] !== xRange(t, 'rear')[0];
        if (geometryChanged) Object.assign(next, relayout(t, next));
        if (v.pos) next.ports = next.ports.map((p) => (v.pos![p.name] ? { ...p, x: v.pos![p.name][0], y: v.pos![p.name][1] } : p));
        next.source = `Datenblatt: ${v.src}${t.source ? ` (Anschlüsse: ${t.source})` : ''}`;
        out = next;
      }
    }
    const fix = PORT_FIX[out.id];
    if (fix) out = { ...out, ports: out.ports.map((p) => (fix[p.name] ? { ...p, connector: fix[p.name] } : p)) };
    // every template states how accurate it is (project rule)
    if (!out.source) out = { ...out, source: out.manufacturer === 'Generisch' ? 'Generische Vorlage, Maße Schätzung' : 'Schätzung' };
    else if (!ACCURACY.test(out.source)) out = { ...out, source: `abgeleitet: ${out.source}` };
    return out;
  });
}
