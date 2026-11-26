import type { CaseFace, CaseHardware, CaseItem, DeviceTemplate, FlightCase, HardwareKind, Project } from './types';
import { faceWidth, U } from './geometry';
import { uid } from './util';
import { cutDepth, FOAM_MATERIALS, foamStack, formatStack } from './inlay';

/*
 * Flight case designer: dimensions, hardware, foam inlay packing, checks, parts list and weight estimate.
 * Coordinates: x along the length (left → right in the front view), y from front to back, z upwards.
 * Items are positioned in the inner space (left-front corner of the foam cut-out).
 */

export const LID_LABELS: Record<FlightCase['lidKind'], string> = {
  removable: 'abnehmbarer Deckel', hinged: 'Scharnierdeckel', telescope: 'Teleskopdeckel (Stülpdeckel)', none: 'ohne Deckel',
};
export const FACE_LABELS: Record<CaseFace, string> = { front: 'vorne', back: 'hinten', left: 'links', right: 'rechts', top: 'Deckel oben', bottom: 'Boden' };

export const HARDWARE: Record<HardwareKind, { label: string; weight: number; faces: CaseFace[] }> = {
  butterfly: { label: 'Butterflyverschluss groß', weight: 0.3, faces: ['front', 'back', 'left', 'right'] },
  'butterfly-small': { label: 'Butterflyverschluss klein', weight: 0.15, faces: ['front', 'back', 'left', 'right'] },
  'handle-recessed': { label: 'Klappgriff versenkt (Schalengriff)', weight: 0.45, faces: ['front', 'back', 'left', 'right', 'top'] },
  'handle-strap': { label: 'Riemengriff', weight: 0.2, faces: ['front', 'back', 'left', 'right', 'top'] },
  'stack-cup': { label: 'Stapelschale', weight: 0.15, faces: ['top'] },
  hinge: { label: 'Scharnier', weight: 0.12, faces: ['back'] },
  label: { label: 'Etikettenhalter', weight: 0.05, faces: ['front', 'back', 'left', 'right', 'top'] },
  castor: { label: 'Lenkrolle', weight: 0.8, faces: ['bottom'] },
  'castor-braked': { label: 'Lenkrolle mit Bremse', weight: 0.9, faces: ['bottom'] },
  skid: { label: 'Gleitkufe', weight: 0.15, faces: ['bottom'] },
};

const castorWeight = (size: number) => (size <= 75 ? 0.5 : size <= 100 ? 0.8 : 1.1);
/** plywood (birch, laminated) and aluminium estimates */
const PLY_DENSITY = 680;              // kg/m³
const PROFILE_KG_M = { alu30: 0.35, alu35: 0.45, none: 0 } as const;
const CLOSING_KG_M = 0.6;             // closing profile at the lid split, per side
const FOAM_DENSITY = 30;              // kg/m³ (PE foam)
const BALL_CORNER_KG = 0.12;

export const isDrawer = (c: FlightCase) => c.kind === 'drawer';

/** sensible hardware for a case of this size */
export function autoHardware(c: Pick<FlightCase, 'inner' | 'lidKind' | 'lidH'>): CaseHardware[] {
  if (c.lidKind === 'none' || c.lidH <= 0) {
    return [{ kind: 'handle-recessed', face: 'left', count: 1 }, { kind: 'handle-recessed', face: 'right', count: 1 }];
  }
  const long = c.inner.l > 800 ? 3 : c.inner.l > 450 ? 2 : 1;
  const short = c.inner.w > 500 ? 2 : 1;
  const out: CaseHardware[] = [];
  if (c.lidKind === 'hinged') {
    out.push({ kind: 'butterfly', face: 'front', count: long }, { kind: 'hinge', face: 'back', count: Math.max(2, long) });
    if (c.inner.w > 350) out.push({ kind: 'butterfly', face: 'left', count: 1 }, { kind: 'butterfly', face: 'right', count: 1 });
  } else {
    out.push({ kind: 'butterfly', face: 'front', count: long }, { kind: 'butterfly', face: 'back', count: long });
    out.push({ kind: 'butterfly', face: 'left', count: short }, { kind: 'butterfly', face: 'right', count: short });
  }
  out.push({ kind: 'handle-recessed', face: 'left', count: 1 }, { kind: 'handle-recessed', face: 'right', count: 1 });
  if (c.inner.l > 1000) out.push({ kind: 'handle-recessed', face: 'front', count: 1 });
  out.push({ kind: 'stack-cup', face: 'top', count: 4 });
  return out;
}

export function newCase(name = 'Neues Case'): FlightCase {
  const base = { inner: { l: 600, w: 400, h: 300 }, lidKind: 'removable' as const, lidH: 100 };
  return {
    id: uid('case-'), name, kind: 'case', ...base, panel: 7, profile: 'alu30', color: '#2b2b2b', cornerBalls: true,
    hardware: autoHardware(base), castorSize: 100, foam: { bottom: 30, lid: 30, sides: 20, color: '#3f3f46' }, items: [], dividers: [],
  };
}

/** Inner space of a 19" drawer (estimated from the template: rails, drawer walls and front take some room). */
export function drawerInner(tpl: DeviceTemplate): { l: number; w: number; h: number } {
  const fw = faceWidth(tpl.rackStandard);
  return { l: Math.round(fw - 72), w: Math.max(60, Math.round(tpl.depth - 30)), h: Math.max(20, Math.round(tpl.heightU * U - 14)) };
}

/** Foam inlay for a rack drawer; items are created from the drawer's contents list. */
export function newDrawerInlay(name: string, tpl: DeviceTemplate, link: { rackId: string; deviceId: string }, contents: { qty?: number; text: string }[]): FlightCase {
  const inner = drawerInner(tpl);
  const c: FlightCase = {
    id: uid('case-'), name, kind: 'drawer', drawer: link, inner, lidKind: 'none', lidH: 0, panel: 0, profile: 'none', color: '#202022',
    cornerBalls: false, hardware: [], castorSize: 100, foam: { bottom: Math.min(10, Math.round(inner.h * 0.2)), lid: 0, sides: 10, color: '#3f3f46' },
    items: [], dividers: [],
    notes: 'Innenmaße aus der Schubladen-Vorlage geschätzt – bitte an der Schublade nachmessen.',
  };
  const depth = Math.max(10, inner.h - c.foam.bottom - 3);
  // one cut-out per line of the contents list (sizes are placeholders to be adjusted)
  for (const it of contents.filter((x) => x.text.trim())) {
    c.items.push({ id: uid('it-'), name: (it.qty && it.qty > 1 ? `${it.qty}× ` : '') + it.text, l: 100, w: 60, h: Math.min(40, depth), x: 0, y: 0, layer: 'body' });
  }
  return packItems(c);
}

/** footprint of an item in the top view (rotation swaps length and width) */
export const footprint = (it: CaseItem) => (it.rot ? { l: it.w, w: it.l } : { l: it.l, w: it.w });

export interface CaseDims {
  /** outer length / width / height incl. castors */
  L: number; W: number; H: number;
  /** outer heights of the body and the lid part, castor height */
  bodyH: number; lidH: number; castorH: number;
  /** inner height of the body part */
  bodyInner: number;
}
export function caseDims(c: FlightCase): CaseDims {
  if (isDrawer(c)) return { L: c.inner.l, W: c.inner.w, H: c.inner.h, bodyH: c.inner.h, lidH: 0, castorH: 0, bodyInner: c.inner.h };
  const extra = c.profile === 'alu30' ? 2 : c.profile === 'alu35' ? 2.5 : 0;
  const t = c.panel + extra;
  const hasLid = c.lidKind !== 'none' && c.lidH > 0;
  const bodyInner = c.inner.h - (hasLid ? c.lidH : 0);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const castorH = castors ? c.castorSize + 25 : c.hardware.some((h) => h.kind === 'skid') ? 12 : 0;
  const bodyH = bodyInner + t;
  const lidH = hasLid ? c.lidH + t : 0;
  return { L: c.inner.l + 2 * t, W: c.inner.w + 2 * t, H: bodyH + lidH + castorH, bodyH, lidH, castorH, bodyInner };
}

/** usable area for foam cut-outs (inside the side foam) */
export function usableArea(c: FlightCase) {
  const s = c.foam.sides;
  return { x0: s, y0: s, x1: c.inner.l - s, y1: c.inner.w - s };
}

/** height available for an item of the given layer (cut depth) */
export function depthAvailable(c: FlightCase, layer: CaseItem['layer']): number {
  const d = caseDims(c);
  if (layer === 'lid') return Math.max(0, c.lidH - c.foam.lid);
  // body items may reach into the lid space as far as the lid foam allows
  return Math.max(0, d.bodyInner - c.foam.bottom + (c.lidKind !== 'none' ? Math.max(0, c.lidH - c.foam.lid) : 0));
}

interface Rect { x: number; y: number; w: number; h: number }

/**
 * MaxRects packing (best short side fit) per layer: biggest items first, each in the orientation that leaves the least
 * waste, `gap` mm foam between cut-outs. Items that do not fit are put next to the case and reported as warnings.
 */
export function packItems(c: FlightCase, gap = 15): FlightCase {
  const area = usableArea(c);
  const items = c.items.map((it) => ({ ...it }));
  for (const layer of ['body', 'lid'] as const) {
    // free space grown by one gap so that items placed at a free rect keep `gap` to each other and fit up to the edge
    let free: Rect[] = [{ x: area.x0, y: area.y0, w: area.x1 - area.x0 + gap, h: area.y1 - area.y0 + gap }];
    const list = items.filter((it) => it.layer === layer).sort((a, b) => b.l * b.w - a.l * a.w || Math.max(b.l, b.w) - Math.max(a.l, a.w));
    let overflowX = c.inner.l + 60;
    for (const it of list) {
      let best: { x: number; y: number; rot: boolean; score: number } | null = null;
      for (const rot of [false, true]) {
        const w = (rot ? it.w : it.l) + gap, h = (rot ? it.l : it.w) + gap;
        for (const f of free) {
          if (w > f.w + 0.01 || h > f.h + 0.01) continue;
          const score = Math.min(f.w - w, f.h - h) * 1e6 + f.y * 1000 + f.x;
          if (!best || score < best.score) best = { x: f.x, y: f.y, rot, score };
        }
      }
      if (!best) { it.rot = false; it.x = overflowX; it.y = area.y0; overflowX += it.l + gap; continue; }
      it.rot = best.rot; it.x = best.x; it.y = best.y;
      const used: Rect = { x: best.x, y: best.y, w: (best.rot ? it.w : it.l) + gap, h: (best.rot ? it.l : it.w) + gap };
      // split every free rect that intersects the used one
      const next: Rect[] = [];
      for (const f of free) {
        if (used.x >= f.x + f.w || used.x + used.w <= f.x || used.y >= f.y + f.h || used.y + used.h <= f.y) { next.push(f); continue; }
        if (used.x > f.x) next.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
        if (used.x + used.w < f.x + f.w) next.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
        if (used.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
        if (used.y + used.h < f.y + f.h) next.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
      }
      // drop rects contained in others
      free = next.filter((a, ai) => !next.some((b, bi) => bi !== ai && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (ai > bi || a.w * a.h < b.w * b.h)));
    }
  }
  return { ...c, items };
}

export interface CaseWarning { itemId?: string; text: string }
export function caseWarnings(c: FlightCase): CaseWarning[] {
  const out: CaseWarning[] = [];
  const area = usableArea(c);
  for (const it of c.items) {
    const f = footprint(it);
    if (it.x >= c.inner.l) out.push({ itemId: it.id, text: `${it.name}: passt nicht mehr hinein (liegt neben ${isDrawer(c) ? 'der Einlage' : 'dem Case'})` });
    else if (it.x < area.x0 - 0.5 || it.y < area.y0 - 0.5 || it.x + f.l > area.x1 + 0.5 || it.y + f.w > area.y1 + 0.5) out.push({ itemId: it.id, text: `${it.name}: ragt in den Randschaum oder aus dem Case` });
    const avail = depthAvailable(c, it.layer);
    if (it.h > avail + 0.5) out.push({ itemId: it.id, text: `${it.name}: ${it.h} mm hoch, nur ${Math.round(avail)} mm Platz ${it.layer === 'lid' ? 'im Deckel' : 'bis zum Deckelschaum'}` });
  }
  for (let i = 0; i < c.items.length; i++) for (let j = i + 1; j < c.items.length; j++) {
    const a = c.items[i], b = c.items[j];
    if (a.layer !== b.layer) continue;
    const fa = footprint(a), fb = footprint(b);
    if (a.x < b.x + fb.l - 0.5 && b.x < a.x + fa.l - 0.5 && a.y < b.y + fb.w - 0.5 && b.y < a.y + fa.w - 0.5) out.push({ itemId: a.id, text: `${a.name} und ${b.name} überlappen` });
  }
  if (!isDrawer(c) && c.lidKind !== 'none' && c.lidH >= c.inner.h) out.push({ text: 'Deckel ist so hoch wie das ganze Case' });
  return out;
}

// ---------------------------------------------------------------- parts list and weight

export interface CaseBom {
  panels: { name: string; count: number; a: number; b: number }[];
  profiles: { name: string; length: number }[];
  hardware: { label: string; count: number }[];
  /** stack = how the thickness is made up from standard sheets */
  foam: { name: string; a: number; b: number; t: number; stack?: string }[];
  /** case = empty case incl. foam, foam = foam alone */
  weight: { case: number; contents: number; total: number; foam: number };
  volume: number;
}

export function caseBom(c: FlightCase, project?: Project): CaseBom {
  const d = caseDims(c);
  const contents = c.items.reduce((s, it) => s + (it.weight ?? (it.templateId ? project?.templates[it.templateId]?.weight ?? 0 : 0)), 0);
  const foamParts: CaseBom['foam'] = [];
  const area = (a: number, b: number) => (a * b) / 1e6;
  const usable = usableArea(c);
  const cut = c.items.reduce((s, i) => s + i.l * i.w * cutDepth(i), 0) / 1e9;
  const mat = c.foam.material ?? 'PE';
  const density = FOAM_MATERIALS[mat]?.density ?? FOAM_DENSITY;
  const stackNote = (t: number) => (t > 0 ? formatStack(foamStack(t, mat)) : '');
  if (isDrawer(c) || c.kind === 'inlay') {
    const t = Math.max(0, c.inner.h - c.foam.bottom - 3);
    // one block with the cut-outs; the side foam is just the margin of that block
    foamParts.push({ name: 'Grundplatte', a: c.inner.l, b: c.inner.w, t: c.foam.bottom, stack: stackNote(c.foam.bottom) });
    foamParts.push({ name: 'Einlage mit Ausschnitten', a: c.inner.l, b: c.inner.w, t, stack: stackNote(t) });
    const foamVol = foamParts.reduce((s, f) => s + area(f.a, f.b) * f.t / 1000, 0) - cut;
    const w = Math.max(0, foamVol) * density;
    return { panels: [], profiles: [], hardware: [], foam: foamParts, weight: { case: round1(w), contents: round1(contents), total: round1(w + contents), foam: round1(w) }, volume: 0 };
  }
  const p = c.panel, L = c.inner.l + 2 * p, Wd = c.inner.w + 2 * p;
  const hasLid = c.lidKind !== 'none' && c.lidH > 0;
  const panels: CaseBom['panels'] = [
    { name: 'Boden', count: 1, a: L, b: Wd },
    { name: 'Front-/Rückwand Unterteil', count: 2, a: L, b: d.bodyInner },
    { name: 'Seitenwand Unterteil', count: 2, a: c.inner.w, b: d.bodyInner },
  ];
  if (hasLid) panels.push(
    { name: 'Deckelplatte', count: 1, a: L, b: Wd },
    { name: 'Front-/Rückwand Deckel', count: 2, a: L, b: c.lidH },
    { name: 'Seitenwand Deckel', count: 2, a: c.inner.w, b: c.lidH },
  );
  else panels.push({ name: 'Abdeckung oben', count: 0, a: L, b: Wd });
  const plyArea = panels.reduce((s, x) => s + x.count * area(x.a, x.b), 0);
  const plyKg = plyArea * (p / 1000) * PLY_DENSITY;
  const Lm = d.L / 1000, Wm = d.W / 1000;
  const profiles: CaseBom['profiles'] = [];
  if (c.profile !== 'none') {
    profiles.push({ name: `Kantenprofil ${c.profile === 'alu30' ? '30 × 30' : '35 × 35'} mm senkrecht`, length: round2(4 * (d.bodyH + d.lidH) / 1000) });
    profiles.push({ name: 'Kantenprofil waagerecht (Boden und Deckel)', length: round2(2 * 2 * (Lm + Wm)) });
  }
  if (hasLid) profiles.push({ name: c.lidKind === 'telescope' ? 'Teleskop-Schließprofil (Paar)' : 'Schließprofil Hybrid (Paar)', length: round2(2 * (Lm + Wm)) });
  const profKg = profiles.reduce((s, x) => s + x.length * (x.name.startsWith('Kanten') ? PROFILE_KG_M[c.profile] : CLOSING_KG_M * 2), 0);
  const hw = new Map<string, number>();
  let hwKg = 0;
  for (const h of c.hardware) {
    const info = HARDWARE[h.kind];
    const label = h.kind.startsWith('castor') ? `${info.label} ${c.castorSize} mm` : info.label;
    hw.set(label, (hw.get(label) ?? 0) + h.count);
    hwKg += h.count * (h.kind.startsWith('castor') ? castorWeight(c.castorSize) + (h.kind === 'castor-braked' ? 0.1 : 0) : info.weight);
  }
  if (c.cornerBalls) { hw.set('Kugelecke', (hw.get('Kugelecke') ?? 0) + (hasLid ? 8 : 4)); hwKg += (hasLid ? 8 : 4) * BALL_CORNER_KG; }
  if (hasLid && c.lidKind === 'hinged') { hw.set('Deckelhalter', 2); hwKg += 0.2; }
  foamParts.push({ name: 'Boden-Schaum', a: c.inner.l, b: c.inner.w, t: c.foam.bottom, stack: stackNote(c.foam.bottom) });
  if (c.foam.sides > 0) foamParts.push({ name: 'Randschaum (Streifen)', a: round2(2 * (c.inner.l + c.inner.w)), b: d.bodyInner, t: c.foam.sides });
  const bodyItems = c.items.filter((i) => i.layer === 'body'), lidItems = c.items.filter((i) => i.layer === 'lid');
  if (bodyItems.length) { const t = Math.round(Math.max(...bodyItems.map(cutDepth))); foamParts.push({ name: 'Einlage Unterteil mit Ausschnitten', a: usable.x1 - usable.x0, b: usable.y1 - usable.y0, t, stack: stackNote(t) }); }
  if (hasLid && c.foam.lid > 0) foamParts.push({ name: 'Deckel-Schaum', a: c.inner.l, b: c.inner.w, t: c.foam.lid, stack: stackNote(c.foam.lid) });
  if (hasLid && lidItems.length) { const t = Math.round(Math.max(...lidItems.map(cutDepth))); foamParts.push({ name: 'Einlage Deckel mit Ausschnitten', a: usable.x1 - usable.x0, b: usable.y1 - usable.y0, t, stack: stackNote(t) }); }
  const foamVol = foamParts.reduce((s, f) => s + (f.name.startsWith('Randschaum') ? (f.a / 1000) * (f.b / 1000) * (f.t / 1000) : area(f.a, f.b) * f.t / 1000), 0) - cut;
  const foamKg = Math.max(0, foamVol) * density;
  const caseKg = plyKg + profKg + hwKg + foamKg;
  return {
    panels: panels.filter((x) => x.count > 0), profiles, hardware: [...hw.entries()].map(([label, count]) => ({ label, count })), foam: foamParts,
    weight: { case: round1(caseKg), contents: round1(contents), total: round1(caseKg + contents), foam: round1(foamKg) }, volume: round2((d.L * d.W * d.H) / 1e9 * 1000) / 1000,
  };
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** item from a device template: 19" devices lie flat (length = panel width, width = depth, height = rack units) */
export function itemFromTemplate(t: DeviceTemplate): Omit<CaseItem, 'id' | 'x' | 'y' | 'layer'> {
  if (t.box) return { name: t.name, l: t.box.w, w: t.box.h, h: 60, templateId: t.id, weight: t.weight };
  const w = t.bodyWidth ?? faceWidth(t.rackStandard) / t.slots;
  return { name: `${t.manufacturer} ${t.name}`, l: Math.round(w), w: Math.round(t.depth + 10), h: Math.round(t.heightU * U), templateId: t.id, weight: t.weight };
}

/** common contents as starting points (outer dimensions in mm, approximate) */
export const ITEM_PRESETS: { name: string; l: number; w: number; h: number; weight?: number }[] = [
  { name: 'Handsender (Funkmikrofon)', l: 260, w: 55, h: 55, weight: 0.3 },
  { name: 'Taschensender', l: 85, w: 65, h: 25, weight: 0.15 },
  { name: 'In-Ear-Empfänger', l: 90, w: 65, h: 25, weight: 0.2 },
  { name: 'Ladestation 2-fach', l: 200, w: 110, h: 70, weight: 0.5 },
  { name: 'Mikrofon (Kabel, Gesang)', l: 165, w: 52, h: 52, weight: 0.3 },
  { name: 'Headset-Mikrofon', l: 180, w: 150, h: 40, weight: 0.05 },
  { name: 'Antenne (Stab)', l: 300, w: 30, h: 30, weight: 0.15 },
  { name: 'Richtantenne (Paddle)', l: 330, w: 250, h: 50, weight: 0.6 },
  { name: 'Laptop 15"', l: 360, w: 250, h: 25, weight: 2 },
  { name: 'Tablet', l: 250, w: 175, h: 10, weight: 0.5 },
  { name: 'Netzteil (Laptop)', l: 140, w: 65, h: 30, weight: 0.4 },
  { name: 'Akku AA (8er-Box)', l: 75, w: 60, h: 30, weight: 0.2 },
  { name: 'Kopfhörer', l: 200, w: 180, h: 90, weight: 0.3 },
  { name: 'DI-Box', l: 120, w: 90, h: 50, weight: 0.6 },
  { name: 'Kabeltrommel 25 m', l: 290, w: 290, h: 180, weight: 4 },
  { name: 'Werkzeug-Etui', l: 300, w: 200, h: 60, weight: 1.5 },
];

/** first free spot for a new item (scanning the usable area in 10 mm steps), or the area origin */
export function freePosition(c: FlightCase, it: Pick<CaseItem, 'l' | 'w' | 'rot' | 'layer'>): { x: number; y: number } {
  const a = usableArea(c);
  const f = it.rot ? { l: it.w, w: it.l } : { l: it.l, w: it.w };
  const others = c.items.filter((o) => o.layer === it.layer).map((o) => ({ ...footprint(o), x: o.x, y: o.y }));
  const gap = 10;
  for (let y = a.y0; y + f.w <= a.y1 + 0.01; y += 10) {
    for (let x = a.x0; x + f.l <= a.x1 + 0.01; x += 10) {
      if (!others.some((o) => x < o.x + o.l + gap && o.x < x + f.l + gap && y < o.y + o.w + gap && o.y < y + f.w + gap)) return { x, y };
    }
  }
  return { x: a.x0, y: a.y0 };
}
