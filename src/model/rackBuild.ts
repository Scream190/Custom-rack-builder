import type { Rack, RackBuild, RackKind, RackType } from './types';
import type { CaseBom } from './cases';
import { bayDepth, bayZ, faceWidth, rackBays, rackDepth, rackExtent, U } from './geometry';

/*
 * Rack designer: the housing of a rack built from parameters instead of picked from a list. The mounting bays decide
 * the inner size; panels, profiles, lids, free space and dampers add up to the outer size and weight.
 * Coordinates: x = width (left → right seen from the front), y = up, z = depth (front = +z).
 */

export const BUILD_KINDS: { id: RackKind; label: string; title: string }[] = [
  { id: 'case', label: 'Rackcase', title: 'Flightcase aus Sperrholz mit Alu-Profilen, Deckel vorne und hinten' },
  { id: 'shockmount', label: 'Shockmount', title: 'Außencase mit federnd gelagertem Innenrack für empfindliche Geräte' },
  { id: 'cabinet', label: 'Schrank', title: 'Stahlschrank mit Tür, Seitenwänden und Sockel' },
  { id: 'open', label: 'Open Frame', title: 'Offenes Gestell aus vier Profilen' },
];

export const isFlightRack = (kind: RackKind) => kind === 'case' || kind === 'shockmount';

export function defaultBuild(t: RackType): RackBuild {
  const tall = rackExtent(t).h > 450;
  return {
    panel: 9, profile: 'alu30', cornerBalls: true,
    frontLid: t.frontLid === false ? 0 : isFlightRack(t.kind) ? 100 : 0,
    rearLid: t.rearLid === false ? 0 : isFlightRack(t.kind) ? 80 : 0,
    railInset: isFlightRack(t.kind) ? 30 : 60, rearGap: 30, sideGap: t.kind === 'cabinet' ? 50 : 20, topGap: 8,
    latches: tall ? 6 : 4, handles: tall ? 2 : 1, stackCups: false,
    castors: rackExtent(t).h >= 12 * U ? 4 : 0, castorSize: 100,
    shock: t.kind === 'shockmount' ? { travel: 35, damper: 'rubber' } : undefined,
  };
}

export const buildOf = (t: RackType): RackBuild => ({ ...defaultBuild(t), ...(t.build ?? {}) });

/** one closed part of the housing: bays with the same setback and depth share a body and its lids */
export interface RackBlock {
  /** indices of the bays in this block */
  bays: number[];
  /** outer box in housing coordinates: x from the left, y from the housing bottom (above the castors), z from the front */
  x: number; y: number; z: number;
  W: number; caseH: number; D: number;
  innerW: number; innerH: number;
  /** depth of the body tube and outer depth of each lid (0 = none) */
  bodyD: number; lidF: number; lidR: number;
  /** panel + aluminium */
  wall: number;
  /** inner rack frame of a shockmount, 0 otherwise */
  frame: number; travel: number;
  /** front rail behind the front opening of the body */
  railZ: number;
  /** mounting depth and setback of the bays in this block */
  depth: number; setback: number;
}

export interface RackDims {
  /** outer width / height (incl. castors) / depth of the whole housing */
  W: number; H: number; D: number;
  /** outer height of the housing without castors */
  caseH: number;
  castorH: number;
  blocks: RackBlock[];
  /** elevation coordinates (bay x/y) of the housing's left and bottom edge: housing x = bay x − ox */
  ox: number; oy: number;
  /** front rail of a bay without setback, measured from the front of the housing */
  Z0: number;
  /** work surfaces inside one case: a panel under every set-back bay (housing coordinates, y = top of the panel) */
  shelves: { x: number; y: number; w: number; z: number; d: number; t: number }[];
  // the block of the first bay, for single-body racks
  innerW: number; innerH: number; bodyD: number; lidF: number; lidR: number; wall: number; frame: number; travel: number; railZ: number;
}

/** housing position of a bay: left/bottom (x, y) and its front rail z from the housing front */
export function bayPlace(t: RackType, d: RackDims, i: number) {
  const bay = rackBays(t)[i];
  return { x: bay.x - d.ox, y: bay.y - d.oy, z: d.Z0 + bayZ(bay), depth: bayDepth(t, bay), bay };
}

export function rackDims(t: RackType): RackDims {
  const b = buildOf(t);
  const bays = rackBays(t);
  const e = b.profile === 'alu30' ? 2 : b.profile === 'alu35' ? 2.5 : 0;
  const castorH = b.castors ? b.castorSize + 25 : 0;
  if (isFlightRack(t.kind)) {
    const wall = b.panel + e;
    const travel = t.kind === 'shockmount' ? b.shock?.travel ?? 35 : 0;
    const frame = t.kind === 'shockmount' ? 9 + 12 : 0; // inner frame panel + rail profile
    const padX = b.sideGap + frame + travel, padY = b.topGap + frame + travel;
    const lidF = b.frontLid ? b.frontLid + wall : 0, lidR = b.rearLid ? b.rearLid + wall : 0;
    const railZ = b.railInset + travel;
    // one case for everything (set-back bays stand on work surfaces), or one body per plane
    const groups = new Map<string, number[]>();
    bays.forEach((bay, i) => { const k = b.separate ? `${bayZ(bay)}|${bayDepth(t, bay)}` : 'all'; groups.set(k, [...(groups.get(k) ?? []), i]); });
    const raw = [...groups.values()].map((idx) => {
      const bb = idx.map((i) => bays[i]);
      const x0 = Math.min(...bb.map((q) => q.x)) - padX - wall, x1 = Math.max(...bb.map((q) => q.x + faceWidth(q.rackStandard))) + padX + wall;
      const y0 = Math.min(...bb.map((q) => q.y)) - padY - wall, y1 = Math.max(...bb.map((q) => q.y + q.heightU * U)) + padY + wall;
      const setback = Math.min(...bb.map((q) => bayZ(q)));
      const depth = Math.max(...bb.map((q) => bayZ(q) + bayDepth(t, q))) - setback;
      const bodyD = b.railInset + depth + b.rearGap + (t.kind === 'shockmount' ? 2 * travel : 0);
      return { idx, x0, x1, y0, y1, depth, setback, bodyD };
    });
    const Z0 = Math.max(...raw.map((r) => lidF + railZ - r.setback));
    const ox = Math.min(...raw.map((r) => r.x0)), oy = Math.min(...raw.map((r) => r.y0));
    const blocks: RackBlock[] = raw.map((r) => {
      const W = r.x1 - r.x0, caseH = r.y1 - r.y0;
      return {
        bays: r.idx, x: r.x0 - ox, y: r.y0 - oy, z: Z0 + r.setback - railZ - lidF, W, caseH, D: r.bodyD + lidF + lidR,
        innerW: W - 2 * wall, innerH: caseH - 2 * wall, bodyD: r.bodyD, lidF, lidR, wall, frame, travel, railZ, depth: r.depth, setback: r.setback,
      };
    }).sort((p, q) => (p.bays.includes(0) ? -1 : q.bays.includes(0) ? 1 : p.y - q.y));
    const W = Math.max(...blocks.map((k) => k.x + k.W)), caseH = Math.max(...blocks.map((k) => k.y + k.caseH)), D = Math.max(...blocks.map((k) => k.z + k.D));
    const m = blocks[0];
    const SHELF = 15;
    const shelves = b.separate ? [] : bays.map((bay) => ({ bay, k: blocks[0] })).filter(({ bay }) => bayZ(bay) > 0).map(({ bay, k }) => ({
      x: k.x + wall, w: k.innerW, y: bay.y - oy - padY + (t.kind === 'shockmount' ? frame + travel : 0), z: k.z + lidF, d: k.bodyD, t: SHELF,
    }));
    return {
      W, H: caseH + castorH, D, caseH, castorH, blocks, ox, oy, Z0, shelves,
      innerW: m.innerW, innerH: m.innerH, bodyD: m.bodyD, lidF, lidR, wall, frame, travel, railZ,
    };
  }
  const ext = rackExtent(t);
  const depth = rackDepth(t);
  const all = bays.map((_, i) => i);
  if (t.kind === 'open') {
    const post = 30;
    const W = ext.w + 2 * (b.sideGap + post), caseH = ext.h + 2 * b.topGap + 2 * 40 + 20;
    const D = depth + 2 * 20;
    const blk: RackBlock = { bays: all, x: 0, y: 0, z: 0, W, caseH, D, innerW: W - 2 * post, innerH: caseH - 80, bodyD: D, lidF: 0, lidR: 0, wall: post, frame: 0, travel: 0, railZ: 20, depth, setback: 0 };
    return { W, H: caseH + castorH, D, caseH, castorH, blocks: [blk], shelves: [], ox: -(b.sideGap + post), oy: -(b.topGap + 50), Z0: 20, innerW: blk.innerW, innerH: blk.innerH, bodyD: D, lidF: 0, lidR: 0, wall: post, frame: 0, travel: 0, railZ: 20 };
  }
  // cabinet (also wall and desk housings): steel frame, door, plinth
  const sheet = 20, plinth = 60, top = 50;
  const W = ext.w + 2 * (b.sideGap + sheet), caseH = ext.h + 2 * b.topGap + plinth + top;
  const bodyD = b.railInset + depth + b.rearGap, D = bodyD + 2 * sheet;
  const blk: RackBlock = { bays: all, x: 0, y: 0, z: 0, W, caseH, D, innerW: W - 2 * sheet, innerH: caseH - plinth - top, bodyD, lidF: 0, lidR: 0, wall: sheet, frame: 0, travel: 0, railZ: b.railInset, depth, setback: 0 };
  return { W, H: caseH + castorH, D, caseH, castorH, blocks: [blk], shelves: [], ox: -(b.sideGap + sheet), oy: -(plinth + b.topGap), Z0: sheet + b.railInset, innerW: blk.innerW, innerH: blk.innerH, bodyD, lidF: 0, lidR: 0, wall: sheet, frame: 0, travel: 0, railZ: b.railInset };
}

/** blocks of the housing that intersect each other (bays placed too close in another plane) */
export function blockClashes(d: RackDims): [number, number][] {
  const out: [number, number][] = [];
  const bl = d.blocks;
  for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) {
    const p = bl[i], q = bl[j];
    const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 1;
    if (ov(p.x, p.x + p.W, q.x, q.x + q.W) && ov(p.y, p.y + p.caseH, q.y, q.y + q.caseH) && ov(p.z, p.z + p.D, q.z, q.z + q.D)) out.push([i, j]);
  }
  return out;
}

/**
 * vertical gap needed below a bay in another plane: in one case the work surface plus free space, with separate
 * bodies the walls, free space and frames of both
 */
export function blockGap(t: RackType) {
  const b = buildOf(t);
  if (!isFlightRack(t.kind)) return 40;
  if (!b.separate) return Math.ceil(15 + 2 * b.topGap + 4);
  const e = b.profile === 'alu30' ? 2 : b.profile === 'alu35' ? 2.5 : 0;
  const travel = t.kind === 'shockmount' ? b.shock?.travel ?? 35 : 0;
  const frame = t.kind === 'shockmount' ? 21 : 0;
  return Math.ceil(2 * (b.topGap + frame + travel + b.panel + e) + 2);
}

const PLY_DENSITY = 680;
const PROFILE_KG_M = { alu30: 0.35, alu35: 0.45, none: 0 } as const;
const CLOSING_KG_M = 0.6;
const RAIL_KG_PER_U = 0.06;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** parts list and weight estimate of a rack housing */
export function rackBom(t: RackType): CaseBom {
  const b = buildOf(t);
  const d = rackDims(t);
  const bays = rackBays(t);
  const hw = new Map<string, number>();
  const addHw = (label: string, n: number) => { if (n) hw.set(label, (hw.get(label) ?? 0) + n); };
  let hwKg = 0;
  const panels: CaseBom['panels'] = [];
  const profiles: CaseBom['profiles'] = [];
  const area = (a: number, c: number) => (a * c) / 1e6;
  let plyKg = 0, profKg = 0, steelKg = 0;
  const lids = (b.frontLid ? 1 : 0) + (b.rearLid ? 1 : 0);
  if (isFlightRack(t.kind)) {
    const p = b.panel;
    const many = d.blocks.length > 1;
    for (const [bi, k] of d.blocks.entries()) {
      const pre = many ? `Block ${bi + 1}, ` : '';
      panels.push(
        { name: `${pre}Ober- und Unterseite Korpus`, count: 2, a: k.innerW + 2 * p, b: k.bodyD },
        { name: `${pre}Seitenwand Korpus`, count: 2, a: k.innerH, b: k.bodyD },
      );
      for (const [name, depth] of [['Frontdeckel', b.frontLid], ['Rückdeckel', b.rearLid]] as const) {
        if (!depth) continue;
        panels.push(
          { name: `${pre}${name}: Platte`, count: 1, a: k.innerW + 2 * p, b: k.innerH + 2 * p },
          { name: `${pre}${name}: Rahmen oben/unten`, count: 2, a: k.innerW + 2 * p, b: depth },
          { name: `${pre}${name}: Rahmen seitlich`, count: 2, a: k.innerH, b: depth },
        );
      }
      if (t.kind === 'shockmount') {
        const fw = k.innerW - 2 * k.travel, fh = k.innerH - 2 * k.travel;
        panels.push(
          { name: `${pre}Innenrack oben/unten`, count: 2, a: fw, b: k.depth + b.railInset + b.rearGap },
          { name: `${pre}Innenrack seitlich`, count: 2, a: fh - 18, b: k.depth + b.railInset + b.rearGap },
        );
      }
    }
    const plyArea = panels.reduce((s, x) => s + x.count * area(x.a, x.b), 0);
    plyKg = plyArea * (p / 1000) * PLY_DENSITY;
    const nb = d.blocks.length;
    if (b.profile !== 'none') {
      const len = round2(d.blocks.reduce((s, k) => s + 4 * k.bodyD + 4 * (k.lidF + k.lidR) + lids * 2 * (k.W + k.caseH), 0) / 1000);
      profiles.push({ name: `Kantenprofil ${b.profile === 'alu30' ? '30 × 30' : '35 × 35'} mm`, length: len });
      profKg += len * PROFILE_KG_M[b.profile];
    }
    if (lids) {
      const len = round2(d.blocks.reduce((s, k) => s + lids * 2 * (k.W + k.caseH), 0) / 1000);
      profiles.push({ name: 'Schließprofil Hybrid (Paar)', length: len });
      profKg += len * CLOSING_KG_M * 2;
      addHw('Butterflyverschluss groß', nb * lids * b.latches); hwKg += nb * lids * b.latches * 0.3;
    }
    if (b.cornerBalls && lids) { addHw('Kugelecke', nb * lids * 4); hwKg += nb * lids * 4 * 0.12; }
    if (b.handles) { addHw('Klappgriff versenkt (Schalengriff)', nb * 2 * b.handles); hwKg += nb * 2 * b.handles * 0.45; }
    if (b.stackCups) { addHw('Stapelschale', 4); hwKg += 4 * 0.15; }
    if (nb > 1) { addHw('Verbindungsbeschlag zwischen den Blöcken', 4 * (nb - 1)); hwKg += 4 * (nb - 1) * 0.1; }
    for (const sh of d.shelves) { panels.push({ name: 'Arbeitsplatte unter dem zurückgesetzten Feld (Multiplex 15 mm)', count: 1, a: sh.w, b: sh.d }); plyKg += area(sh.w, sh.d) * 0.015 * PLY_DENSITY; }
    if (d.shelves.length) { profiles.push({ name: 'Kantenschutz Arbeitsplatte (Alu-U-Profil)', length: round2(d.shelves.reduce((s2, sh) => s2 + sh.w, 0) / 1000) }); }
    if (t.kind === 'shockmount') {
      const n = 8 * nb;
      addHw(b.shock?.damper === 'foam' ? 'Dämpfungsschaum-Block' : 'Gummi-Schwingmetall-Puffer', n);
      hwKg += n * (b.shock?.damper === 'foam' ? 0.05 : 0.18);
    }
  } else if (t.kind === 'open') {
    const posts = 4 * (d.caseH / 1000) * 1.4;
    const frame = 4 * ((d.W + d.D) / 1000) * 1.2;
    steelKg = posts + frame;
    profiles.push({ name: 'Stahlprofil senkrecht', length: round2(4 * d.caseH / 1000) }, { name: 'Rahmen oben und unten', length: round2(4 * (d.W + d.D) / 1000) });
  } else {
    // sheet steel 1.2 mm on sides, top, bottom, back, door (glass door ~ 4 mm)
    const sheet = (2 * area(d.D, d.caseH) + 2 * area(d.W, d.D) + area(d.W, d.caseH)) * 1.2 / 1000 * 7850;
    const door = area(d.W - 40, d.caseH - 120) * 4 / 1000 * 2500;
    steelKg = sheet + door;
    panels.push({ name: 'Seitenwand (Stahlblech)', count: 2, a: d.D, b: d.caseH }, { name: 'Tür (Glas, 4 mm)', count: 1, a: d.W - 40, b: d.caseH - 120 });
  }
  // rails
  for (const [i, bay] of bays.entries()) {
    const label = `Rackschiene ${bay.rackStandard}" ${bay.heightU} HE${bays.length > 1 ? ` (Feld ${bay.label ?? i + 1})` : ''}`;
    const n = t.hasRearRails ? 4 : 2;
    addHw(label, n);
    hwKg += n * bay.heightU * RAIL_KG_PER_U;
  }
  if (b.castors) {
    addHw(`Lenkrolle ${b.castorSize} mm`, 2); addHw(`Lenkrolle mit Bremse ${b.castorSize} mm`, 2);
    hwKg += 4 * (b.castorSize <= 75 ? 0.5 : b.castorSize <= 100 ? 0.8 : 1.1) + 0.2;
    if (isFlightRack(t.kind)) { const base = bottomBlock(d); panels.push({ name: 'Rollbrett (Multiplex 15 mm)', count: 1, a: base.W, b: base.bodyD }); plyKg += area(base.W, base.bodyD) * 0.015 * PLY_DENSITY; }
  }
  const total = plyKg + profKg + hwKg + steelKg;
  return {
    panels, profiles, hardware: [...hw.entries()].map(([label, count]) => ({ label, count })), foam: [],
    weight: { case: round1(total), contents: 0, total: round1(total), foam: 0 },
    volume: Math.round((d.W * d.H * d.D) / 1e9 * 1000) / 1000,
  };
}

/** the block the castors go under (lowest, widest) */
export const bottomBlock = (d: RackDims) => d.blocks.filter((k) => k.y < 0.5).sort((p, q) => q.W * q.bodyD - p.W * p.bodyD)[0] ?? d.blocks[0];

/** rack type with a build: outer size, weight and lid flags follow the construction */
export function applyBuild(t: RackType, patch: Partial<RackBuild> = {}): RackType {
  const build: RackBuild = { ...buildOf(t), ...patch };
  if (t.kind === 'shockmount' && !build.shock) build.shock = { travel: 35, damper: 'rubber' };
  if (t.kind !== 'shockmount') delete build.shock;
  const next: RackType = { ...t, build, custom: true, frontLid: build.frontLid > 0, rearLid: build.rearLid > 0 };
  const d = rackDims(next);
  next.outer = { w: Math.round(d.W), h: Math.round(d.H), d: Math.round(d.D) };
  next.weight = rackBom(next).weight.case;
  return next;
}

/** deepest device behind its mounting rail, per mounting side, for the depth check */
export function deepestDevice(rack: Rack, templates: Record<string, { depth: number; name: string }>) {
  let front = 0, rear = 0, name = '';
  for (const d of rack.devices) {
    const tpl = templates[d.templateId];
    if (!tpl) continue;
    if (d.mount === 'front' && tpl.depth > front) { front = tpl.depth; name = tpl.name; }
    if (d.mount === 'rear') rear = Math.max(rear, tpl.depth);
  }
  return { front, rear, name };
}
