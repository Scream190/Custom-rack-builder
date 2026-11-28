import type { CaseFace, CaseHardware, CaseItem, CaseSeam, DeviceTemplate, FlightCase, HardwareKind, Project } from './types';
import { footHeight, hardwarePart, panelMaterial, profileBySku, profileKgPerM, sheetOf, slideFor } from '../library/caseHardware';
import { faceWidth, U } from './geometry';
import { uid } from './util';
import { cutDepth, FOAM_MATERIALS, foamStack, formatStack, type ShapeKind } from './inlay';

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
  'draw-latch': { label: 'Spannverschluss', weight: 0.15, faces: ['front', 'back', 'left', 'right', 'top'] },
  'lid-stay': { label: 'Deckelstütze', weight: 0.15, faces: ['back', 'front', 'left', 'right'] },
  'piano-hinge': { label: 'Klavierband (Meterware)', weight: 0.4, faces: ['back', 'front', 'left', 'right'] },
  foot: { label: 'Gummifuß', weight: 0.05, faces: ['bottom'] },
  'dish-vent': { label: 'Einbauschale mit Lüftung', weight: 0.2, faces: ['front', 'back', 'left', 'right', 'top'] },
  'dish-connector': { label: 'Einbauschale für Steckverbinder', weight: 0.25, faces: ['front', 'back', 'left', 'right'] },
  'cable-gland': { label: 'Kabeldurchführung in Schale', weight: 0.15, faces: ['front', 'back', 'left', 'right'] },
  'handle-surface': { label: 'Aufschraubgriff', weight: 0.25, faces: ['front', 'back', 'left', 'right', 'top'] },
};

export const SEAM_LABELS: Record<CaseSeam, string> = { lid: 'Deckel', front: 'Tür vorne', back: 'Tür hinten', left: 'Tür links', right: 'Tür rechts' };
const SIDES = ['front', 'back', 'left', 'right'] as const;
type Side = (typeof SIDES)[number];

/** door depths (inner, mm) with doors on left/right taking precedence over front/back */
export function doorDepths(c: Pick<FlightCase, 'doors'>): Record<Side, number> {
  const d = c.doors ?? {};
  const pos = (v?: number) => (v && v > 0 ? v : 0);
  const x = pos(d.left) + pos(d.right) > 0;
  return { left: pos(d.left), right: pos(d.right), front: x ? 0 : pos(d.front), back: x ? 0 : pos(d.back) };
}
export const hasDoors = (c: Pick<FlightCase, 'doors'>) => Object.values(doorDepths(c)).some((v) => v > 0);
export const hasLidPart = (c: Pick<FlightCase, 'lidKind' | 'lidH'>) => c.lidKind !== 'none' && c.lidH > 0;
/** wall thickness: panel plus what the edge profile adds */
export const wallOf = (c: Pick<FlightCase, 'panel' | 'profile'>) => c.panel + (c.profile === 'alu30' ? 2 : c.profile === 'alu35' ? 2.5 : 0);

export type CasePartId = 'base' | 'lid' | 'lid2' | 'door-front' | 'door-back' | 'door-left' | 'door-right';
/** one shell of the case in outer coordinates (x along the length, y front to back, z up from the bottom, castors excluded) */
export interface CaseBox {
  id: CasePartId;
  role: 'base' | 'lid' | 'door';
  side?: Side;
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  /** faces without a panel (towards the neighbouring part, or the open top of a crate) */
  open: CaseFace[];
  /** open faces that carry a closing profile */
  closing: CaseFace[];
}

/**
 * The case as shells: base, optional top lid (split into two halves for a clamshell) and doors on the sides.
 * `t` = wall thickness (panel + profile for the outer size, panel alone for the cutting list).
 */
export function caseBoxes(c: FlightCase, t = wallOf(c)): CaseBox[] {
  const dd = doorDepths(c);
  const lid = hasLidPart(c), doors = hasDoors(c);
  const topWall = lid || doors;
  const L = c.inner.l + 2 * t, W = c.inner.w + 2 * t, H = c.inner.h + t + (topWall ? t : 0);
  const span = c.doors?.span === 'body' && lid ? 'body' : 'full';
  const zs = lid ? H - (c.lidH + t) : H;
  const out = (s: Side) => (dd[s] ? dd[s] + t : 0);
  const cx0 = out('left'), cx1 = L - out('right'), cy0 = out('front'), cy1 = W - out('back');
  const boxes: CaseBox[] = [];
  const baseOpen: CaseFace[] = [];
  if (lid || !doors) baseOpen.push('top');
  for (const s of SIDES) if (dd[s]) baseOpen.push(s);
  boxes.push({ id: 'base', role: 'base', x0: cx0, x1: cx1, y0: cy0, y1: cy1, z0: 0, z1: zs, open: baseOpen, closing: baseOpen.filter((f) => f !== 'top' || lid) });
  const opposite: Record<Side, Side> = { front: 'back', back: 'front', left: 'right', right: 'left' };
  for (const s of SIDES) {
    if (!dd[s]) continue;
    const z1 = span === 'body' ? zs : H;
    const open: CaseFace[] = [opposite[s]];
    if (span === 'body') open.push('top');
    const b = { x0: s === 'right' ? cx1 : 0, x1: s === 'left' ? cx0 : L, y0: s === 'back' ? cy1 : 0, y1: s === 'front' ? cy0 : W };
    // front/back doors span the full length, left/right doors the full width
    if (s === 'front' || s === 'back') { b.x0 = 0; b.x1 = L; }
    else { b.y0 = 0; b.y1 = W; }
    boxes.push({ id: `door-${s}` as CasePartId, role: 'door', side: s, ...b, z0: 0, z1, open, closing: open });
  }
  if (lid) {
    const lx0 = span === 'body' ? 0 : cx0, lx1 = span === 'body' ? L : cx1, ly0 = span === 'body' ? 0 : cy0, ly1 = span === 'body' ? W : cy1;
    if (c.lidSplit) {
      const mid = (lx0 + lx1) / 2;
      boxes.push({ id: 'lid', role: 'lid', x0: lx0, x1: mid, y0: ly0, y1: ly1, z0: zs, z1: H, open: ['bottom', 'right'], closing: ['bottom', 'right'] });
      boxes.push({ id: 'lid2', role: 'lid', x0: mid, x1: lx1, y0: ly0, y1: ly1, z0: zs, z1: H, open: ['bottom', 'left'], closing: ['bottom', 'left'] });
    } else boxes.push({ id: 'lid', role: 'lid', x0: lx0, x1: lx1, y0: ly0, y1: ly1, z0: zs, z1: H, open: ['bottom'], closing: ['bottom'] });
  }
  return boxes;
}

/** inner space of the base (inner coordinates), i.e. without the doors */
export function baseInner(c: FlightCase) {
  const dd = doorDepths(c);
  return { x0: dd.left, x1: c.inner.l - dd.right, y0: dd.front, y1: c.inner.w - dd.back };
}

/** outer size without castors (mm) */
export function shellSize(c: FlightCase) {
  const boxes = caseBoxes(c);
  return { L: Math.max(...boxes.map((b) => b.x1)), W: Math.max(...boxes.map((b) => b.y1)), H: Math.max(...boxes.map((b) => b.z1)), boxes };
}
/** width of a face in face coordinates */
export const faceSpan = (c: FlightCase, face: CaseFace) => { const s = shellSize(c); return face === 'front' || face === 'back' || face === 'top' || face === 'bottom' ? s.L : s.W; };
/** face coordinates -> outer coordinates (x along, y front to back, z up) */
export function faceToOuter(c: FlightCase, face: CaseFace, u: number, z: number): [number, number, number] {
  const { L, W, H } = shellSize(c);
  switch (face) {
    case 'front': return [u, 0, z];
    case 'back': return [L - u, W, z];
    case 'left': return [0, W - u, z];
    case 'right': return [L, u, z];
    case 'top': return [u, z, H];
    default: return [u, z, 0];
  }
}
/** outer coordinates -> face coordinates */
export function outerToFace(c: FlightCase, face: CaseFace, x: number, y: number, z: number): { u: number; z: number } {
  const { L, W } = shellSize(c);
  switch (face) {
    case 'front': return { u: x, z };
    case 'back': return { u: L - x, z };
    case 'left': return { u: W - y, z };
    case 'right': return { u: y, z };
    default: return { u: x, z: y };
  }
}
export const LATCH_KINDS: HardwareKind[] = ['butterfly', 'butterfly-small', 'draw-latch', 'hinge', 'piano-hinge'];
/** span of a shell on a face (u range; on top/bottom the x range) */
function uRangeOf(c: FlightCase, bx: CaseBox, face: CaseFace): [number, number] {
  const { L, W } = shellSize(c);
  switch (face) {
    case 'front': case 'top': case 'bottom': return [bx.x0, bx.x1];
    case 'back': return [L - bx.x1, L - bx.x0];
    case 'left': return [W - bx.y1, W - bx.y0];
    default: return [bx.y0, bx.y1];
  }
}
/** the shells whose panel forms this face (top: closed tops at full height) */
function shellsOnFace(c: FlightCase, face: CaseFace): CaseBox[] {
  const { L, W, H, boxes } = shellSize(c);
  const e = 0.5;
  const on = (b: CaseBox) => (face === 'front' ? b.y0 < e : face === 'back' ? b.y1 > W - e : face === 'left' ? b.x0 < e : face === 'right' ? b.x1 > L - e : face === 'top' ? b.z1 > H - e : b.z0 < e);
  return boxes.filter((b) => on(b) && !b.open.includes(face));
}
/** where a hand-placed or spread piece of hardware sits: seam it bridges and its range */
export interface HwInstance { i: number; k: number; kind: HardwareKind; face: CaseFace; seam?: CaseSeam; u: number; z: number; vertical?: boolean }
/**
 * Every piece of hardware with its position in face coordinates. Hand-placed pieces keep `at`; the others are spread
 * evenly: latches and hinges along their seam, handles and labels over the base (or the door on that face).
 */
export function hardwareInstances(c: FlightCase): HwInstance[] {
  const out: HwInstance[] = [];
  const { H, boxes } = shellSize(c);
  const lid = boxes.find((b) => b.role === 'lid');
  const zs = lid ? lid.z0 : H;
  const closeH = 20;
  c.hardware.forEach((h, i) => {
    if (h.kind.startsWith('castor') || h.kind === 'skid' || h.kind === 'foot' || h.kind === 'lid-stay' || h.face === 'bottom') return;
    const latch = LATCH_KINDS.includes(h.kind);
    const seam = latch ? h.seam ?? 'lid' : undefined;
    const n = h.at?.length ?? h.count;
    if (latch && seam && seam !== 'lid') {
      const door = boxes.find((b) => b.role === 'door' && b.side === seam);
      if (!door || h.face === seam) return;
      if (h.face === 'top') {
        // seam runs across the top: position along it, depth = the seam line
        const along = seam === 'front' || seam === 'back';
        const pos = seam === 'front' ? door.y1 : seam === 'back' ? door.y0 : seam === 'left' ? door.x1 : door.x0;
        const span = along ? shellSize(c).L : shellSize(c).W;
        for (let k = 0; k < n; k++) {
          const a = h.at?.[k] ? (along ? h.at[k].u : h.at[k].z) : (span * (k + 1)) / (n + 1);
          out.push({ i, k, kind: h.kind, face: 'top', seam, u: along ? a : pos, z: along ? pos : a, vertical: !along });
        }
        return;
      }
      const seamOuter: [number, number, number] = seam === 'front' ? [0, door.y1, 0] : seam === 'back' ? [0, door.y0, 0] : seam === 'left' ? [door.x1, 0, 0] : [door.x0, 0, 0];
      const u = outerToFace(c, h.face, ...seamOuter).u;
      for (let k = 0; k < n; k++) out.push({ i, k, kind: h.kind, face: h.face, seam, u, z: h.at?.[k]?.z ?? door.z0 + ((door.z1 - door.z0) * (k + 1)) / (n + 1), vertical: true });
      return;
    }
    if (latch) {
      if (!lid || h.face === 'top') return;
      const lids = boxes.filter((b) => b.role === 'lid');
      const u0 = Math.min(...lids.map((b) => uRangeOf(c, b, h.face)[0])), u1 = Math.max(...lids.map((b) => uRangeOf(c, b, h.face)[1]));
      for (let k = 0; k < n; k++) out.push({ i, k, kind: h.kind, face: h.face, seam: 'lid', u: h.at?.[k]?.u ?? u0 + ((u1 - u0) * (k + 1)) / (n + 1), z: zs });
      return;
    }
    if (h.at) { h.at.forEach((p, k) => out.push({ i, k, kind: h.kind, face: h.face, u: p.u, z: p.z })); return; }
    if (h.kind === 'stack-cup') {
      const { L, W } = shellSize(c);
      const pts: [number, number][] = [[75, 75], [L - 75, 75], [75, W - 75], [L - 75, W - 75]];
      pts.slice(0, Math.max(1, Math.min(4, n))).forEach(([u, z], k) => out.push({ i, k, kind: h.kind, face: 'top', u, z }));
      return;
    }
    const shells = shellsOnFace(c, h.face);
    const carrier = h.face === 'top' ? shells : [shells.find((b) => b.role === 'base') ?? shells.find((b) => b.role === 'door') ?? shells[0]].filter(Boolean);
    let k = 0;
    for (const bx of carrier) {
      const [u0, u1] = uRangeOf(c, bx, h.face);
      const top = bx.z1 - (bx.closing.includes('top') ? closeH : 0);
      for (let j = 0; j < n; j++) {
        const u = u0 + ((u1 - u0) * (j + 1)) / (n + 1);
        const z = h.face === 'top' ? (bx.y0 + bx.y1) / 2 : h.kind === 'label' ? Math.min(top - 60, bx.z0 + 82) : h.kind.startsWith('dish') || h.kind === 'cable-gland' ? bx.z0 + (top - bx.z0) * 0.3 : bx.z0 + (top - bx.z0) * 0.52;
        out.push({ i, k: k++, kind: h.kind, face: h.face, u, z });
      }
    }
  });
  return out;
}
/** turns the spread pieces of one hardware row into hand-placed ones (so a single piece can move) */
export function pinHardware(c: FlightCase, i: number): CaseHardware[] {
  const inst = hardwareInstances(c).filter((x) => x.i === i);
  return c.hardware.map((h, j) => (j === i && !h.at ? { ...h, at: inst.map((x) => ({ u: Math.round(x.u), z: Math.round(x.z) })), count: inst.length } : h));
}
/** the face and seam a click on the outside lands on, for placing hardware: latches snap to the nearest seam */
export function snapToSeam(c: FlightCase, face: CaseFace, u: number, z: number): { seam: CaseSeam; u: number; z: number } | null {
  const { boxes } = shellSize(c);
  const cand: { seam: CaseSeam; u: number; z: number; d: number }[] = [];
  const lid = boxes.find((b) => b.role === 'lid');
  if (lid && face !== 'top') cand.push({ seam: 'lid', u, z: lid.z0, d: Math.abs(z - lid.z0) });
  for (const door of boxes.filter((b) => b.role === 'door')) {
    if (door.side === face) continue;
    const s = door.side!;
    if (face === 'top') {
      const along = s === 'front' || s === 'back';
      const pos = s === 'front' ? door.y1 : s === 'back' ? door.y0 : s === 'left' ? door.x1 : door.x0;
      cand.push({ seam: s, u: along ? u : pos, z: along ? pos : z, d: Math.abs((along ? z : u) - pos) });
    } else {
      const seamOuter: [number, number, number] = s === 'front' ? [0, door.y1, 0] : s === 'back' ? [0, door.y0, 0] : s === 'left' ? [door.x1, 0, 0] : [door.x0, 0, 0];
      const su = outerToFace(c, face, ...seamOuter).u;
      cand.push({ seam: s, u: su, z, d: Math.abs(u - su) });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  return cand[0] ?? null;
}

// ------------------------------------------------------------------ direct editing (3D editor)

const r5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const PART_LABELS: Record<CasePartId, string> = { base: 'Unterteil', lid: 'Deckel', lid2: 'Deckelhälfte rechts', 'door-front': 'Tür vorne', 'door-back': 'Tür hinten', 'door-left': 'Tür links', 'door-right': 'Tür rechts' };
export const partLabelOf = (c: FlightCase, id: CasePartId) => (id === 'lid' && c.lidSplit ? 'Deckelhälfte links' : PART_LABELS[id]);

/**
 * Push/pull on one face of a shell: `d` mm outwards along the face normal (negative = inwards). Faces of the base
 * and lid change the inner size, the outer face of a door its depth, the top of the base (with a lid) and the
 * underside of the lid move the lid seam. Returns the patch, rounded to `step` mm.
 */
export function pushPull(c: FlightCase, part: CasePartId, face: CaseFace, d: number, step = 5): Partial<FlightCase> {
  const rd = (n: number) => Math.round(n / step) * step;
  const bx = caseBoxes(c).find((b) => b.id === part);
  if (!bx || face === 'bottom' && bx.role !== 'lid') return {};
  const lid = hasLidPart(c);
  const dd = doorDepths(c);
  if (bx.role === 'door' && face === bx.side) {
    const max = Math.round((face === 'front' || face === 'back' ? c.inner.w : c.inner.l) / 2);
    return { doors: { ...c.doors, [face]: clamp(rd(dd[face] + d), 30, max) }, caseType: undefined };
  }
  if (face === 'front' || face === 'back') return { inner: { ...c.inner, w: Math.max(50, rd(c.inner.w + d)) } };
  if (face === 'left' || face === 'right') return { inner: { ...c.inner, l: Math.max(50, rd(c.inner.l + d)) } };
  if (face === 'bottom') return { lidH: clamp(rd(c.lidH + d), 20, c.inner.h - 20) };
  // top
  if (bx.role === 'base' && lid) return { lidH: clamp(rd(c.lidH - d), 20, c.inner.h - 20) };
  const h = Math.max(lid ? c.lidH + 20 : 10, rd(c.inner.h + d));
  return lid && bx.role !== 'base' ? { inner: { ...c.inner, h }, lidH: clamp(c.lidH + (h - c.inner.h), 20, h - 20) } : { inner: { ...c.inner, h } };
}

/**
 * Splits the case where the user clicked on the outside (outer coordinates). Horizontal: a lid seam at that height
 * (adds a lid when there is none). Vertical: a door on the nearer end; on the top in the middle it splits the lid
 * into two halves (or joins them again).
 */
export function splitAt(c: FlightCase, face: CaseFace, x: number, y: number, z: number, vertical: boolean): Partial<FlightCase> | null {
  const t = wallOf(c);
  const { L, W } = shellSize(c);
  if (!vertical) {
    if (face === 'top' || face === 'bottom') return null;
    const lidH = clamp(r5(c.inner.h + t - z), 20, c.inner.h - 20);
    return { lidKind: c.lidKind === 'none' ? 'removable' : c.lidKind, lidH, caseType: undefined };
  }
  if (face === 'bottom') return null;
  if (face === 'top' && hasLidPart(c) && Math.abs(x - L / 2) < L * 0.06) return { lidSplit: c.lidSplit ? undefined : true, caseType: undefined };
  let side: Side, dist: number;
  if (face === 'front' || face === 'back') { side = x < L / 2 ? 'left' : 'right'; dist = side === 'left' ? x : L - x; }
  else if (face === 'left' || face === 'right') { side = y < W / 2 ? 'front' : 'back'; dist = side === 'front' ? y : W - y; }
  else {
    const cand: [Side, number][] = [['left', x], ['right', L - x], ['front', y], ['back', W - y]];
    [side, dist] = cand.sort((a, b) => a[1] - b[1])[0];
  }
  const max = Math.round((side === 'front' || side === 'back' ? c.inner.w : c.inner.l) / 2);
  const depth = clamp(r5(dist - t), 30, max);
  const doors = { ...c.doors, [side]: depth };
  // left/right doors win over front/back ones: a new front/back door replaces them
  if (side === 'front' || side === 'back') { delete doors.left; delete doors.right; }
  return { doors, caseType: undefined };
}

/** removes the selected component: one piece of hardware ('hw:i:k'), a hardware row ('hw:i'), the lid or a door */
export function removeSelection(c: FlightCase, sel: string): Partial<FlightCase> | null {
  const m = /^hw:(\d+)(?::(\d+))?$/.exec(sel);
  if (m) {
    const i = Number(m[1]), h = c.hardware[i];
    if (!h) return null;
    if (m[2] === undefined) return { hardware: c.hardware.filter((_, j) => j !== i) };
    const k = Number(m[2]);
    const next: CaseHardware | null = h.at ? (h.at.length > 1 ? { ...h, at: h.at.filter((_, j) => j !== k), count: h.at.length - 1 } : null) : h.count > 1 ? { ...h, count: h.count - 1 } : null;
    return { hardware: next ? c.hardware.map((x, j) => (j === i ? next : x)) : c.hardware.filter((_, j) => j !== i) };
  }
  if (sel === 'part:lid' || sel === 'part:lid2') {
    if (sel === 'part:lid2' || (c.lidSplit && sel === 'part:lid')) return { lidSplit: undefined, caseType: undefined };
    return { lidKind: 'none', lidH: 0, lidSplit: undefined, caseType: undefined };
  }
  const div = /^div:(\d+)$/.exec(sel);
  if (div) return c.dividers[Number(div[1])] ? { dividers: c.dividers.filter((_, j) => j !== Number(div[1])) } : null;
  const door = /^part:door-(front|back|left|right)$/.exec(sel);
  if (door) {
    const doors = { ...c.doors };
    delete doors[door[1] as Side];
    return { doors, caseType: undefined };
  }
  return null;
}

/** moves one piece of hardware to a point on its face (face coordinates): latches only slide along their seam */
export function moveHardware(c: FlightCase, i: number, k: number, u: number, z: number): CaseHardware[] {
  const pinned = pinHardware(c, i);
  const inst = hardwareInstances({ ...c, hardware: pinned }).find((x) => x.i === i && x.k === k);
  const h = pinned[i];
  if (!inst || !h?.at) return c.hardware;
  const span = faceSpan(c, inst.face);
  const { W, H } = shellSize(c);
  const zMax = inst.face === 'top' ? W : H;
  let p = { u: clamp(u, 20, span - 20), z: clamp(z, 20, zMax - 20) };
  if (inst.seam === 'lid') p = { u: p.u, z: inst.z };
  else if (inst.seam && inst.face !== 'top') p = { u: inst.u, z: p.z };
  const at = h.at.map((q, j) => (j === k ? { u: Math.round(p.u), z: Math.round(p.z) } : q));
  return pinned.map((x, j) => (j === i ? { ...x, at } : x));
}

/** opposite face of a side (top and bottom have none for hardware) */
export const OPPOSITE_FACE: Partial<Record<CaseFace, CaseFace>> = { front: 'back', back: 'front', left: 'right', right: 'left' };

/**
 * Snapping while a piece of hardware is dragged (face coordinates): to the middle of the face, to the mirror image of
 * another piece of the same row, then to a `step` grid. `guide` names what it snapped to (for the readout).
 */
export function snapHardware(c: FlightCase, i: number, k: number, u: number, z: number, step = 5): { u: number; z: number; guide?: 'mitte' | 'symmetrisch' } {
  const h = c.hardware[i];
  if (!h) return { u, z };
  const span = faceSpan(c, h.face);
  const tol = Math.max(6, step * 1.6);
  if (Math.abs(u - span / 2) <= tol) return { u: span / 2, z: Math.round(z / step) * step, guide: 'mitte' };
  const others = hardwareInstances(c).filter((x) => x.i === i && x.k !== k);
  for (const o of others) {
    const m = span - o.u;
    if (Math.abs(u - m) <= tol) return { u: m, z: Math.round(z / step) * step, guide: 'symmetrisch' };
  }
  return { u: Math.round(u / step) * step, z: Math.round(z / step) * step };
}

/**
 * Copies a hardware row to the opposite side, mirrored through the middle of the case (a handle 200 mm from the left
 * on the front sits 200 mm from the left on the back as seen from the front). Returns null for faces without an
 * opposite side or when the kind cannot sit there.
 */
export function mirrorHardware(c: FlightCase, i: number): CaseHardware[] | null {
  const h = c.hardware[i];
  const face = h && OPPOSITE_FACE[h.face];
  if (!h || !face || !HARDWARE[h.kind].faces.includes(face)) return null;
  const span = faceSpan(c, h.face);
  // a door seam on the side faces stays the same door; on a front/back door the seam would face the other way
  if (h.seam && h.seam !== 'lid' && (h.seam === face || h.seam === h.face)) return null;
  const copy: CaseHardware = { ...h, face, at: h.at?.map((p) => ({ u: Math.round(span - p.u), z: p.z })) };
  return [...c.hardware, copy];
}

/** adds one hand-placed piece of hardware where the user clicked (latches and hinges snap to the nearest seam) */
export function placeHardware(c: FlightCase, kind: HardwareKind, face: CaseFace, u: number, z: number): CaseHardware[] | null {
  if (!HARDWARE[kind].faces.includes(face)) return null;
  if (LATCH_KINDS.includes(kind)) {
    const s = snapToSeam(c, face, u, z);
    if (!s) return null;
    // a piece on a door seam seen from the top lies along that seam
    return [...c.hardware, { kind, face, count: 1, seam: s.seam === 'lid' ? undefined : s.seam, at: [{ u: Math.round(s.u), z: Math.round(s.z) }] }];
  }
  return [...c.hardware, { kind, face, count: 1, at: [{ u: Math.round(u), z: Math.round(z) }] }];
}

// ------------------------------------------------------------------ shelves and walls (3D editor)

export type DividerAxis = FlightCase['dividers'][number]['axis'];
export const DIVIDER_LABELS: Record<DividerAxis, string> = { x: 'Trennwand längs', y: 'Trennwand quer', z: 'Fachboden' };
/** panel thickness of shelves and walls (mm) */
export const DIVIDER_T = 7;
/** range a divider can sit in (inner coordinates: x walls along y, y walls along x, shelves above the inner floor) */
export function dividerRange(c: FlightCase, axis: DividerAxis): [number, number] {
  const bi = baseInner(c);
  if (axis === 'x') return [bi.y0, bi.y1];
  if (axis === 'y') return [bi.x0, bi.x1];
  return [0, caseDims(c).bodyInner];
}
/** clear space on both sides of a divider (to the next one of the same direction or the inner wall), in mm */
export function dividerGaps(c: FlightCase, i: number, pos = c.dividers[i]?.pos): [number, number] {
  const dv = c.dividers[i];
  if (!dv) return [0, 0];
  const [a, b] = dividerRange(c, dv.axis);
  const others = c.dividers.filter((x, j) => j !== i && x.axis === dv.axis).map((x) => x.pos);
  const lo = Math.max(a, ...others.filter((p) => p <= pos).map((p) => p + DIVIDER_T / 2));
  const hi = Math.min(b, ...others.filter((p) => p > pos).map((p) => p - DIVIDER_T / 2));
  return [Math.round(pos - DIVIDER_T / 2 - lo), Math.round(hi - pos - DIVIDER_T / 2)];
}
/** moves a divider: snaps to the middle of its free space, then to the grid; stays inside the case */
export function moveDivider(c: FlightCase, i: number, pos: number, step = 5): { dividers: FlightCase['dividers']; pos: number; guide?: 'mitte' } {
  const dv = c.dividers[i];
  if (!dv) return { dividers: c.dividers, pos };
  const [a, b] = dividerRange(c, dv.axis);
  const others = c.dividers.filter((x, j) => j !== i && x.axis === dv.axis).map((x) => x.pos);
  const lo = Math.max(a, ...others.filter((p) => p <= dv.pos).map((p) => p + DIVIDER_T / 2));
  const hi = Math.min(b, ...others.filter((p) => p > dv.pos).map((p) => p - DIVIDER_T / 2));
  const mid = (lo + hi) / 2;
  let p: number, guide: 'mitte' | undefined;
  if (Math.abs(pos - mid) <= Math.max(6, step * 1.6)) { p = mid; guide = 'mitte'; }
  else p = Math.round(pos / step) * step;
  p = Math.max(a + 10, Math.min(b - 10, p));
  p = Math.round(p * 10) / 10;
  return { dividers: c.dividers.map((x, j) => (j === i ? { ...x, pos: p } : x)), pos: p, guide };
}
/** adds a shelf or wall at a position (clamped into the case) */
export function addDivider(c: FlightCase, axis: DividerAxis, pos: number): FlightCase['dividers'] {
  const [a, b] = dividerRange(c, axis);
  return [...c.dividers, { axis, pos: Math.round(Math.max(a + 10, Math.min(b - 10, pos))) }];
}
/** spreads all dividers of one direction evenly over the space (equal clear spaces) */
export function spreadDividers(c: FlightCase, axis: DividerAxis): FlightCase['dividers'] {
  const [a, b] = dividerRange(c, axis);
  const idx = c.dividers.map((d, i) => [d, i] as const).filter(([d]) => d.axis === axis).sort((p, q) => p[0].pos - q[0].pos).map(([, i]) => i);
  const n = idx.length;
  if (!n) return c.dividers;
  const gap = (b - a - n * DIVIDER_T) / (n + 1);
  const at = new Map(idx.map((i, k) => [i, Math.round((a + gap * (k + 1) + DIVIDER_T * (k + 0.5)) * 10) / 10]));
  return c.dividers.map((d, i) => (at.has(i) ? { ...d, pos: at.get(i)! } : d));
}

/**
 * Chain dimensions of the outside (mm from the outer corner): break points along the length and width (where doors
 * meet the base) and up the height (castors, base, lid). Every list starts at 0 and ends at the total.
 */
export function dimChains(c: FlightCase): { L: number[]; W: number[]; H: number[]; castorH: number } {
  const { L, W, H, boxes } = shellSize(c);
  const uniq = (v: number[]) => [...new Set(v.map((x) => Math.round(x * 10) / 10))].sort((a, b) => a - b);
  const d = caseDims(c);
  const zs = uniq([0, ...boxes.filter((b) => b.role !== 'door').flatMap((b) => [b.z0, b.z1]), H]).map((z) => z + d.castorH);
  return {
    L: uniq([0, ...boxes.flatMap((b) => [b.x0, b.x1]), L]),
    W: uniq([0, ...boxes.flatMap((b) => [b.y0, b.y1]), W]),
    H: d.castorH ? [0, ...zs] : zs,
    castorH: d.castorH,
  };
}

/** construction presets after the case types of common case design software */
export interface CaseType { id: string; label: string; note: string; apply: (c: FlightCase) => Partial<FlightCase> }
const depthOf = (n: number) => Math.max(60, Math.round(n / 10) * 10);
export const CASE_TYPES: CaseType[] = [
  { id: 'trunk-5050', label: 'Truhe 50/50', note: 'waagrecht in der Mitte geteilt', apply: (c) => ({ lidKind: c.lidKind === 'none' ? 'removable' : c.lidKind, lidH: Math.round(c.inner.h / 2), doors: undefined, lidSplit: false }) },
  { id: 'shallow-lid', label: 'Flacher Deckel', note: 'tiefe Wanne, flacher Deckel oben', apply: (c) => ({ lidKind: c.lidKind === 'none' ? 'removable' : c.lidKind, lidH: depthOf(c.inner.h * 0.25), doors: undefined, lidSplit: false }) },
  { id: 'shallow-base', label: 'Flache Wanne', note: 'flacher Boden, hohe Haube zum Abheben', apply: (c) => ({ lidKind: 'removable', lidH: Math.round(c.inner.h * 0.75), doors: undefined, lidSplit: false }) },
  { id: 'single-door', label: 'Eintür-Case', note: 'Deckel als Tür an der Vorderseite', apply: (c) => ({ lidKind: 'none', lidH: 0, doors: { front: depthOf(c.inner.w * 0.2), span: 'full' }, lidSplit: false, drawers: undefined }) },
  { id: 'double-door', label: 'Doppeltür-Case', note: 'Türen vorne und hinten', apply: (c) => ({ lidKind: 'none', lidH: 0, doors: { front: depthOf(c.inner.w * 0.15), back: depthOf(c.inner.w * 0.15), span: 'full' }, lidSplit: false }) },
  { id: 'triple-door', label: 'Dreifach-Case', note: 'Türen vorne und hinten, Deckel dazwischen', apply: (c) => ({ lidKind: 'removable', lidH: depthOf(c.inner.h * 0.2), doors: { front: depthOf(c.inner.w * 0.15), back: depthOf(c.inner.w * 0.15), span: 'full' }, lidSplit: false }) },
  { id: 'clamshell', label: 'Klappdeckel geteilt', note: 'flache Wanne, Haube in der Mitte geteilt', apply: (c) => ({ lidKind: 'removable', lidH: Math.round(c.inner.h * 0.7), doors: undefined, lidSplit: true }) },
  { id: 'rack-lids', label: 'Rack-Case mit Deckeln', note: 'durchgehender Deckel oben, darunter Türen vorne und hinten', apply: (c) => ({ lidKind: 'removable', lidH: depthOf(c.inner.h * 0.15), doors: { front: depthOf(c.inner.w * 0.12), back: depthOf(c.inner.w * 0.12), span: 'body' }, lidSplit: false }) },
  { id: 'production', label: 'Production-Case', note: 'Arbeitsplatz-Case mit Türen vorne und hinten und Fachböden', apply: (c) => ({ lidKind: 'none', lidH: 0, doors: { front: depthOf(c.inner.w * 0.12), back: depthOf(c.inner.w * 0.12), span: 'full' }, lidSplit: false, dividers: [...c.dividers.filter((d) => d.axis !== 'z'), { axis: 'z', pos: Math.round(c.inner.h / 3) }, { axis: 'z', pos: Math.round((c.inner.h * 2) / 3) }] }) },
  { id: 'drawer-case', label: 'Schubladen-Case', note: 'Tür vorne, innen Schubladen auf Auszügen', apply: (c) => {
    const inH = c.inner.h - 30;
    const n = Math.max(1, Math.min(6, Math.floor(inH / 120)));
    return { lidKind: 'none', lidH: 0, doors: { front: depthOf(c.inner.w * 0.1), span: 'full' }, lidSplit: false, drawers: Array.from({ length: n }, () => ({ h: Math.floor(inH / n) })) };
  } },
];
export const caseTypeOf = (id?: string) => CASE_TYPES.find((t) => t.id === id);
/** applies a preset and sets fitting hardware (castors stay) */
export function applyCaseType(c: FlightCase, id: string): Partial<FlightCase> {
  const ty = caseTypeOf(id);
  if (!ty) return {};
  const patch: Partial<FlightCase> = { ...ty.apply(c), caseType: id };
  if (!('drawers' in patch)) patch.drawers = undefined;
  const next = { ...c, ...patch };
  return { ...patch, hardware: [...autoHardware(next), ...c.hardware.filter((h) => h.kind.startsWith('castor') || h.kind === 'foot' || h.kind === 'skid')] };
}

const castorWeight = (size: number) => (size <= 75 ? 0.5 : size <= 100 ? 0.8 : 1.1);
/** plywood (birch, laminated) and aluminium estimates */
const PLY_DENSITY = 680;              // kg/m³
const PROFILE_KG_M = { alu30: 0.35, alu35: 0.45, none: 0 } as const;
const CLOSING_KG_M = 0.6;             // closing profile at the lid split, per side
const FOAM_DENSITY = 30;              // kg/m³ (PE foam)
const BALL_CORNER_KG = 0.12;

export const isDrawer = (c: FlightCase) => c.kind === 'drawer';

/** sensible hardware for a case of this size */
export function autoHardware(c: Pick<FlightCase, 'inner' | 'lidKind' | 'lidH'> & Partial<Pick<FlightCase, 'doors' | 'lidSplit'>>): CaseHardware[] {
  const dd = doorDepths(c);
  if (Object.values(dd).some((v) => v > 0)) return doorHardware(c, dd);
  if (c.lidKind === 'none' || c.lidH <= 0) {
    return [{ kind: 'handle-recessed', face: 'left', count: 1 }, { kind: 'handle-recessed', face: 'right', count: 1 }];
  }
  if (c.lidSplit) {
    // two hood halves: latches along the front and back of each half, one on each end
    const per = c.inner.l > 900 ? 2 : 1;
    return [
      { kind: 'butterfly', face: 'front', count: 2 * per }, { kind: 'butterfly', face: 'back', count: 2 * per },
      { kind: 'butterfly', face: 'left', count: 1 }, { kind: 'butterfly', face: 'right', count: 1 },
      // the base is low: handles between the latches on the long sides, not under the end latches
      { kind: 'handle-recessed', face: 'front', count: 1 }, { kind: 'handle-recessed', face: 'back', count: 1 },
    ];
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

/** latches at every door seam, handles on the faces without doors, stacking cups on top */
function doorHardware(c: Pick<FlightCase, 'inner' | 'lidKind' | 'lidH'> & Partial<Pick<FlightCase, 'doors'>>, dd: Record<Side, number>): CaseHardware[] {
  const out: CaseHardware[] = [];
  const lid = c.lidKind !== 'none' && c.lidH > 0;
  const span = c.doors?.span === 'body' && lid ? 'body' : 'full';
  const tall = c.inner.h > 700 ? 2 : 1;
  const across = (n: number) => (n > 500 ? 2 : 1);
  for (const s of SIDES) {
    if (!dd[s]) continue;
    const sideFaces: CaseFace[] = s === 'front' || s === 'back' ? ['left', 'right'] : ['front', 'back'];
    for (const f of sideFaces) out.push({ kind: 'butterfly', face: f, count: tall, seam: s });
    // the top face carries the seam too when the door runs the full height
    if (span === 'full') out.push({ kind: 'butterfly', face: 'top', count: across(s === 'front' || s === 'back' ? c.inner.l : c.inner.w), seam: s });
  }
  if (lid) {
    const xDoors = dd.left + dd.right > 0;
    const faces: CaseFace[] = span === 'body' ? ['front', 'back', 'left', 'right'] : xDoors ? ['front', 'back'] : ['left', 'right'];
    for (const f of faces) out.push({ kind: 'butterfly', face: f, count: f === 'front' || f === 'back' ? across(c.inner.l) : 1, seam: 'lid' });
  }
  const handleFaces: CaseFace[] = dd.left + dd.right > 0 ? ['front', 'back'] : ['left', 'right'];
  for (const f of handleFaces) out.push({ kind: 'handle-recessed', face: f, count: c.inner.l > 1000 && (f === 'front' || f === 'back') ? 2 : 1 });
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
  if (tpl.drawerInner) return { l: tpl.drawerInner.l, w: tpl.drawerInner.w, h: tpl.drawerInner.h };
  const fw = faceWidth(tpl.rackStandard);
  return { l: Math.round(fw - 72), w: Math.max(60, Math.round(tpl.depth - 30)), h: Math.max(20, Math.round(tpl.heightU * U - 14)) };
}

/** Foam inlay for a rack drawer; items are created from the drawer's contents list. */
export function newDrawerInlay(name: string, tpl: DeviceTemplate, link: { rackId: string; deviceId: string } | null, contents: { qty?: number; text: string }[]): FlightCase {
  const inner = drawerInner(tpl);
  const c: FlightCase = {
    id: uid('case-'), name, kind: 'drawer', ...(link ? { drawer: link } : { drawerTemplate: tpl.id }), inner, lidKind: 'none', lidH: 0, panel: 0, profile: 'none', color: '#202022',
    cornerBalls: false, hardware: [], castorSize: 100, foam: { bottom: Math.min(10, Math.round(inner.h * 0.2)), lid: 0, sides: 10, color: '#3f3f46' },
    items: [], dividers: [],
    notes: tpl.drawerInner ? `Innenmaße laut Hersteller (${tpl.manufacturer} ${tpl.name}).` : 'Innenmaße aus der Schubladen-Vorlage geschätzt – bitte an der Schublade nachmessen.',
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
  const t = wallOf(c);
  const hasLid = hasLidPart(c);
  const topWall = hasLid || hasDoors(c);
  const bodyInner = c.inner.h - (hasLid ? c.lidH : 0);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const feet = c.hardware.find((h) => h.kind === 'foot');
  const castorH = castors ? c.castorSize + 25 : c.hardware.some((h) => h.kind === 'skid') ? 12 : feet ? footHeight(feet.sku) : 0;
  // the base carries the top panel itself when doors close the case without a lid
  const bodyH = bodyInner + t + (topWall && !hasLid ? t : 0);
  const lidH = hasLid ? c.lidH + t : 0;
  return { L: c.inner.l + 2 * t, W: c.inner.w + 2 * t, H: bodyH + lidH + castorH, bodyH, lidH, castorH, bodyInner };
}

/** usable area for foam cut-outs (inside the side foam of the base, doors excluded) */
export function usableArea(c: FlightCase) {
  const s = c.foam.sides;
  const b = baseInner(c);
  return { x0: b.x0 + s, y0: b.y0 + s, x1: b.x1 - s, y1: b.y1 - s };
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
  if (isDrawer(c) || c.kind === 'inlay') return out;
  const dd = doorDepths(c), bi = baseInner(c);
  if (bi.x1 - bi.x0 < 60 || bi.y1 - bi.y0 < 60) out.push({ text: 'Die Türen sind zusammen fast so tief wie das Case, für den Innenraum bleibt kaum Platz' });
  const d0 = c.doors ?? {};
  if ((d0.left || d0.right) && (d0.front || d0.back)) out.push({ text: 'Türen vorne/hinten und links/rechts lassen sich nicht kombinieren, es gelten die Türen links/rechts' });
  if (c.drawers?.length) {
    const sum = c.drawers.reduce((s, x) => s + x.h, 0);
    if (sum > caseDims(c).bodyInner + 0.5) out.push({ text: `Schubladen zusammen ${sum} mm hoch, im Unterteil sind nur ${Math.round(caseDims(c).bodyInner)} mm Platz` });
    if (!slideFor(bi.y1 - bi.y0 - 15)) out.push({ text: `Kein Schubladenauszug passt in ${Math.round(bi.y1 - bi.y0)} mm Tiefe (kürzester 310 mm)` });
    if (!dd.front && !dd.back) out.push({ text: 'Schubladen ohne Tür vorne: die Fronten liegen hinter der Vorderwand' });
  }
  for (const h of c.hardware) if (h.seam && h.seam !== 'lid' && !dd[h.seam]) out.push({ text: `${HARDWARE[h.kind].label}: ${SEAM_LABELS[h.seam]} gibt es nicht mehr` });
  const edge = profileBySku(c.parts?.edge), closing = profileBySku(c.parts?.closing);
  for (const pr of [edge, closing]) if (pr?.panel && (c.panel < pr.panel[0] - 0.01 || c.panel > pr.panel[1] + 0.01)) out.push({ text: `Profil ${pr.sku} ist für ${String(pr.panel[0]).replace('.', ',')} bis ${String(pr.panel[1]).replace('.', ',')} mm Platte, gewählt sind ${String(c.panel).replace('.', ',')} mm` });
  return out;
}

// ---------------------------------------------------------------- parts list and weight

export interface CaseBom {
  panels: { name: string; count: number; a: number; b: number }[];
  /** length in m; pieces = cut lengths in mm; bars = stock bars needed */
  profiles: { name: string; length: number; sku?: string; pieces?: number[]; bars?: number }[];
  hardware: { label: string; count: number; sku?: string }[];
  /** sheets of panel material needed (area plus 5 % waste, no nesting) */
  sheets?: { material: string; thickness: number; size: [number, number]; count: number; area: number };
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
  const p = c.panel;
  const hasLid = hasLidPart(c);
  const boxes = caseBoxes(c, p);
  // panels of every shell: top/bottom full size, front/back between them in height, sides fit between all others
  const panelMap = new Map<string, { name: string; count: number; a: number; b: number }>();
  const addPanel = (name: string, a: number, b: number) => {
    if (a <= 0 || b <= 0) return;
    const key = `${name}|${Math.round(a)}|${Math.round(b)}`;
    const e0 = panelMap.get(key);
    if (e0) e0.count++; else panelMap.set(key, { name, count: 1, a, b });
  };
  for (const bx of boxes) {
    const closed = (f: CaseFace) => !bx.open.includes(f);
    const lx = bx.x1 - bx.x0, ly = bx.y1 - bx.y0, lz = bx.z1 - bx.z0;
    const zIn = lz - (closed('bottom') ? p : 0) - (closed('top') ? p : 0);
    const yIn = ly - (closed('front') ? p : 0) - (closed('back') ? p : 0);
    const n = panelNames(bx);
    if (closed('bottom')) addPanel(n.bottom, lx, ly);
    if (closed('top')) addPanel(n.top, lx, ly);
    for (const f of ['front', 'back'] as const) if (closed(f)) addPanel(bx.role === 'door' && bx.side === f ? n.outer : n.fb, lx, zIn);
    for (const f of ['left', 'right'] as const) if (closed(f)) addPanel(bx.role === 'door' && bx.side === f ? n.outer : n.lr, yIn, zIn);
  }
  const bi = baseInner(c);
  for (const dv of c.dividers) {
    if (dv.axis === 'x') addPanel('Trennwand längs', bi.x1 - bi.x0, d.bodyInner);
    else if (dv.axis === 'y') addPanel('Trennwand quer', bi.y1 - bi.y0, d.bodyInner);
    else addPanel('Fachboden', bi.x1 - bi.x0, bi.y1 - bi.y0);
  }
  const hw = new Map<string, { label: string; count: number; sku?: string }>();
  const addHw = (label: string, count: number, sku?: string) => {
    const k = label + (sku ?? '');
    const e0 = hw.get(k);
    if (e0) e0.count += count; else hw.set(k, { label, count, sku });
  };
  let hwKg = 0;
  // drawers on slides: front over the base width, box between the slides
  const slide = slideFor(bi.y1 - bi.y0 - 15);
  for (const dr of c.drawers ?? []) {
    const wIn = bi.x1 - bi.x0, depth = slide ? slide.length : bi.y1 - bi.y0 - 20, boxW = wIn - 2 * 13.5, boxH = Math.max(20, dr.h - 15);
    addPanel('Schubladenfront', wIn, dr.h);
    addPanel('Schubladenboden', boxW, depth);
    addPanel('Schubladenseite', depth, boxH);
    addPanel('Schubladenseite', depth, boxH);
    addPanel('Schubladenrückwand', boxW - 2 * p, boxH);
    addHw(slide ? 'Schubladenauszug (Paar)' : 'Schubladenauszug (Paar), keiner passt in die Tiefe', 1, slide?.sku);
    addHw('Schubladengriff', 1);
    hwKg += 0.9;
  }
  const panels = [...panelMap.values()];
  const plyArea = panels.reduce((s, x) => s + x.count * area(x.a, x.b), 0);
  const pm = panelMaterial(c.parts?.panel);
  const plyKg = plyArea * (p / 1000) * (pm?.density ?? PLY_DENSITY);
  const sheet = sheetOf(c.parts?.panel);
  const sheets = { material: pm ? pm.label : 'Multiplex', thickness: p, size: sheet, area: round2(plyArea), count: Math.max(1, Math.ceil((plyArea * 1.05) / ((sheet[0] * sheet[1]) / 1e6))) };

  // profiles: edges where two closed faces meet, closing profiles at every seam
  const t = wallOf(c);
  const outerBoxes = caseBoxes(c, t);
  const profiles: CaseBom['profiles'] = [];
  const edge = profileBySku(c.parts?.edge);
  if (c.profile !== 'none') {
    const vert: number[] = [], hor: number[] = [];
    for (const bx of outerBoxes) for (const e0 of boxEdges(bx)) (e0.axis === 'z' ? vert : hor).push(Math.round(e0.length));
    const name = edge ? `Kantenprofil ${edge.maker} ${edge.sku}` : `Kantenprofil ${c.profile === 'alu30' ? '30 × 30' : '35 × 35'} mm`;
    if (vert.length) profiles.push({ name: `${name} senkrecht`, sku: edge?.sku, length: round2(vert.reduce((a, b) => a + b, 0) / 1000), pieces: vert, bars: bars(vert, (edge?.stock ?? 4) * 1000) });
    if (hor.length) profiles.push({ name: `${name} waagerecht`, sku: edge?.sku, length: round2(hor.reduce((a, b) => a + b, 0) / 1000), pieces: hor, bars: bars(hor, (edge?.stock ?? 4) * 1000) });
  }
  const closing = profileBySku(c.parts?.closing);
  const seams = caseSeams(outerBoxes);
  if (seams.length) {
    const lens = seams.map((s) => Math.round(s.perimeter));
    const total = round2(lens.reduce((a, b) => a + b, 0) / 1000);
    // every seam is cut as four mitred pieces per half
    const pieces = seams.flatMap((s) => [s.a, s.a, s.b, s.b].map(Math.round));
    const stock = (closing?.stock ?? 4) * 1000;
    if (closing && (closing.kind === 'tongue' || closing.kind === 'groove')) {
      const mate = profileBySku(closing.mate);
      const tongue = closing.kind === 'tongue' ? closing : mate, groove = closing.kind === 'groove' ? closing : mate;
      if (tongue) profiles.push({ name: `Schließprofil Feder ${tongue.maker} ${tongue.sku}`, sku: tongue.sku, length: total, pieces, bars: bars(pieces, stock) });
      if (groove) profiles.push({ name: `Schließprofil Nut ${groove.maker} ${groove.sku}`, sku: groove.sku, length: total, pieces, bars: bars(pieces, stock) });
    } else {
      const name = closing ? `Hybrid-Schließprofil ${closing.maker} ${closing.sku} (Paar)` : c.lidKind === 'telescope' && !hasDoors(c) ? 'Teleskop-Schließprofil (Paar)' : 'Schließprofil Hybrid (Paar)';
      profiles.push({ name, sku: closing?.sku, length: total, pieces: [...pieces, ...pieces], bars: bars([...pieces, ...pieces], stock) });
    }
  }
  const profKg = profiles.reduce((s, x) => {
    const pr = profileBySku(x.sku);
    if (pr) return s + x.length * profileKgPerM(pr) * (x.name.endsWith('(Paar)') ? 2 : 1);
    return s + x.length * (x.name.startsWith('Kanten') ? PROFILE_KG_M[c.profile] : CLOSING_KG_M * 2);
  }, 0);
  for (const h of c.hardware) {
    const info = HARDWARE[h.kind];
    const part = hardwarePart(h.sku);
    const base = h.kind.startsWith('castor') ? `${info.label} ${c.castorSize} mm` : info.label;
    const label = part ? `${base} (${part.maker} ${part.sku})` : h.seam && h.seam !== 'lid' ? `${base}, ${SEAM_LABELS[h.seam]}` : base;
    addHw(label, h.count, h.sku);
    hwKg += h.count * (h.kind.startsWith('castor') ? castorWeight(c.castorSize) + (h.kind === 'castor-braked' ? 0.1 : 0) : info.weight);
  }
  if (c.cornerBalls) {
    const n = outerBoxes.reduce((s, bx) => s + boxCorners(bx), 0);
    const part = hardwarePart(c.parts?.corner);
    addHw(part ? `Kugelecke (${part.maker} ${part.sku})` : 'Kugelecke', n, part?.sku);
    hwKg += n * BALL_CORNER_KG;
  }
  if (hasLid && c.lidKind === 'hinged' && !c.hardware.some((h) => h.kind === 'lid-stay')) { addHw('Deckelhalter', 2); hwKg += 0.2; }
  const fullFoam = { l: bi.x1 - bi.x0, w: bi.y1 - bi.y0 };
  foamParts.push({ name: 'Boden-Schaum', a: fullFoam.l, b: fullFoam.w, t: c.foam.bottom, stack: stackNote(c.foam.bottom) });
  if (c.foam.sides > 0) foamParts.push({ name: 'Randschaum (Streifen)', a: round2(2 * (fullFoam.l + fullFoam.w)), b: d.bodyInner, t: c.foam.sides });
  const bodyItems = c.items.filter((i) => i.layer === 'body'), lidItems = c.items.filter((i) => i.layer === 'lid');
  if (bodyItems.length) { const th = Math.round(Math.max(...bodyItems.map(cutDepth))); foamParts.push({ name: 'Einlage Unterteil mit Ausschnitten', a: usable.x1 - usable.x0, b: usable.y1 - usable.y0, t: th, stack: stackNote(th) }); }
  if (hasLid && c.foam.lid > 0) foamParts.push({ name: 'Deckel-Schaum', a: c.inner.l, b: c.inner.w, t: c.foam.lid, stack: stackNote(c.foam.lid) });
  if (hasLid && lidItems.length) { const th = Math.round(Math.max(...lidItems.map(cutDepth))); foamParts.push({ name: 'Einlage Deckel mit Ausschnitten', a: usable.x1 - usable.x0, b: usable.y1 - usable.y0, t: th, stack: stackNote(th) }); }
  const foamVol = foamParts.reduce((s, f) => s + (f.name.startsWith('Randschaum') ? (f.a / 1000) * (f.b / 1000) * (f.t / 1000) : area(f.a, f.b) * f.t / 1000), 0) - cut;
  const foamKg = Math.max(0, foamVol) * density;
  const caseKg = plyKg + profKg + hwKg + foamKg;
  return {
    panels, profiles, hardware: [...hw.values()], foam: foamParts, sheets,
    weight: { case: round1(caseKg), contents: round1(contents), total: round1(caseKg + contents), foam: round1(foamKg) }, volume: Math.round((d.L * d.W * d.H) / 1e9 * 1000) / 1000,
  };
}

/** panel names per shell (German, as they appear in the cutting list) */
function panelNames(bx: CaseBox) {
  if (bx.role === 'lid') return { bottom: 'Deckel unten', top: 'Deckelplatte', fb: 'Front-/Rückwand Deckel', lr: 'Seitenwand Deckel', outer: '' };
  if (bx.role === 'door') {
    const s = SEAM_LABELS[bx.side!];
    return { bottom: `${s}, Rand unten`, top: `${s}, Rand oben`, fb: `${s}, Rand`, lr: `${s}, Rand`, outer: `${s}, Außenplatte` };
  }
  return { bottom: 'Boden', top: 'Deckplatte', fb: 'Front-/Rückwand Unterteil', lr: 'Seitenwand Unterteil', outer: '' };
}

const FACE_AXIS: Record<CaseFace, ['x' | 'y' | 'z', number]> = { left: ['x', 0], right: ['x', 1], front: ['y', 0], back: ['y', 1], bottom: ['z', 0], top: ['z', 1] };
/** the 12 edges of a shell where two closed faces meet (axis = direction of the edge) */
export function boxEdges(bx: CaseBox): { axis: 'x' | 'y' | 'z'; length: number; a: CaseFace; b: CaseFace }[] {
  const len = { x: bx.x1 - bx.x0, y: bx.y1 - bx.y0, z: bx.z1 - bx.z0 };
  const faces: CaseFace[] = ['left', 'right', 'front', 'back', 'bottom', 'top'];
  const out: { axis: 'x' | 'y' | 'z'; length: number; a: CaseFace; b: CaseFace }[] = [];
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const [ai] = FACE_AXIS[faces[i]], [aj] = FACE_AXIS[faces[j]];
    if (ai === aj) continue;
    if (bx.open.includes(faces[i]) || bx.open.includes(faces[j])) continue;
    const axis = (['x', 'y', 'z'] as const).find((k) => k !== ai && k !== aj)!;
    out.push({ axis, length: len[axis], a: faces[i], b: faces[j] });
  }
  return out;
}
/** ball corners: vertices where three closed faces meet */
export function boxCorners(bx: CaseBox): number {
  let n = 0;
  for (const fx of ['left', 'right'] as const) for (const fy of ['front', 'back'] as const) for (const fz of ['bottom', 'top'] as const) {
    if (![fx, fy, fz].some((f) => bx.open.includes(f))) n++;
  }
  return n;
}
/** seams between shells (each counted once), with the size of the joint face */
export function caseSeams(boxes: CaseBox[]): { part: CasePartId; face: CaseFace; a: number; b: number; perimeter: number }[] {
  const out: { part: CasePartId; face: CaseFace; a: number; b: number; perimeter: number }[] = [];
  for (const bx of boxes) {
    if (bx.role === 'base') continue;
    for (const f of bx.closing) {
      if (bx.id === 'lid2' && (f === 'left' || f === 'right')) continue; // the middle seam of a clamshell is counted with the first half
      const [ax] = FACE_AXIS[f];
      const dims = ax === 'x' ? [bx.y1 - bx.y0, bx.z1 - bx.z0] : ax === 'y' ? [bx.x1 - bx.x0, bx.z1 - bx.z0] : [bx.x1 - bx.x0, bx.y1 - bx.y0];
      out.push({ part: bx.id, face: f, a: dims[0], b: dims[1], perimeter: 2 * (dims[0] + dims[1]) });
    }
  }
  return out;
}
/** stock bars needed for a list of cut lengths (first fit decreasing, 3 mm saw cut) */
export function bars(pieces: number[], stock: number): number {
  const free: number[] = [];
  for (const pc of [...pieces].sort((a, b) => b - a)) {
    const need = pc + 3;
    const i = free.findIndex((f) => f >= need);
    if (i >= 0) free[i] -= need; else free.push(Math.max(0, stock - need));
  }
  return free.length;
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
export const ITEM_PRESETS: { name: string; l: number; w: number; h: number; weight?: number; group: string; shape?: ShapeKind }[] = [
  { name: 'Handsender (Funkmikrofon)', l: 260, w: 55, h: 55, weight: 0.3, group: 'Funk', shape: 'mic' },
  { name: 'Taschensender', l: 85, w: 65, h: 25, weight: 0.15, group: 'Funk', shape: 'bodypack' },
  { name: 'In-Ear-Empfänger', l: 90, w: 65, h: 25, weight: 0.2, group: 'Funk', shape: 'iem' },
  { name: 'Ladestation 2-fach', l: 200, w: 110, h: 70, weight: 0.5, group: 'Funk', shape: 'charger' },
  { name: 'Antenne (Stab)', l: 300, w: 30, h: 30, weight: 0.15, group: 'Funk', shape: 'whip' },
  { name: 'Richtantenne (Paddle)', l: 330, w: 250, h: 50, weight: 0.6, group: 'Funk', shape: 'paddle' },
  { name: 'Akku (Sender)', l: 60, w: 40, h: 25, weight: 0.1, group: 'Funk', shape: 'battery-box' },
  { name: 'Mikrofon (Kabel, Gesang)', l: 165, w: 52, h: 52, weight: 0.3, group: 'Mikrofone', shape: 'mic-wired' },
  { name: 'Headset-Mikrofon', l: 180, w: 150, h: 40, weight: 0.05, group: 'Mikrofone' },
  { name: 'Ansteckmikrofon, aufgerollt', l: 90, w: 90, h: 25, weight: 0.05, group: 'Mikrofone', shape: 'drum' },
  { name: 'Instrumentenmikrofon mit Klemme', l: 130, w: 60, h: 45, weight: 0.15, group: 'Mikrofone' },
  { name: 'Laptop 15"', l: 360, w: 250, h: 25, weight: 2, group: 'IT', shape: 'laptop' },
  { name: 'Tablet', l: 250, w: 175, h: 10, weight: 0.5, group: 'IT', shape: 'laptop' },
  { name: 'Netzteil (Laptop)', l: 140, w: 65, h: 30, weight: 0.4, group: 'IT', shape: 'charger' },
  { name: 'SSD / Festplatte 2,5"', l: 100, w: 70, h: 10, weight: 0.1, group: 'IT', shape: 'battery-box' },
  { name: 'Akku AA (8er-Box)', l: 75, w: 60, h: 30, weight: 0.2, group: 'Strom und Kabel', shape: 'battery-box' },
  { name: 'Kabeltrommel 25 m', l: 290, w: 290, h: 180, weight: 4, group: 'Strom und Kabel', shape: 'drum' },
  { name: 'Kabel aufgerollt (5 m)', l: 200, w: 200, h: 60, weight: 0.5, group: 'Strom und Kabel', shape: 'drum' },
  { name: 'Kopfhörer', l: 200, w: 180, h: 90, weight: 0.3, group: 'Audio', shape: 'headphones' },
  { name: 'DI-Box', l: 120, w: 90, h: 50, weight: 0.6, group: 'Audio', shape: 'charger' },
  { name: 'Gaffa-Rolle', l: 110, w: 110, h: 50, weight: 0.3, group: 'Werkzeug' , shape: 'drum' },
  { name: 'Werkzeug-Etui', l: 300, w: 200, h: 60, weight: 1.5, group: 'Werkzeug' },
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
