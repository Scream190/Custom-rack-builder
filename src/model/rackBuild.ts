import type { Rack, RackBuild, RackKind, RackType } from './types';
import type { CaseBom } from './cases';
import { rackBays, rackExtent, U } from './geometry';

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

export interface RackDims {
  /** outer width / height (incl. castors) / depth */
  W: number; H: number; D: number;
  /** outer height of the housing without castors */
  caseH: number;
  castorH: number;
  /** inner clear width / height of the body */
  innerW: number; innerH: number;
  /** depth of the body tube and outer depth of each lid (0 = none) */
  bodyD: number; lidF: number; lidR: number;
  /** panel + aluminium */
  wall: number;
  /** inner rack frame of a shockmount (offset of the bays inside the body), 0 otherwise */
  frame: number; travel: number;
  /** z of the front rail, measured from the front opening of the body into the depth */
  railZ: number;
  /** position of the bay arrangement inside the body: left/bottom inner edge to the bays */
  bayX: number; bayY: number;
}

export function rackDims(t: RackType): RackDims {
  const b = buildOf(t);
  const ext = rackExtent(t);
  const e = b.profile === 'alu30' ? 2 : b.profile === 'alu35' ? 2.5 : 0;
  const castorH = b.castors ? b.castorSize + 25 : 0;
  if (isFlightRack(t.kind)) {
    const wall = b.panel + e;
    const travel = t.kind === 'shockmount' ? b.shock?.travel ?? 35 : 0;
    const frame = t.kind === 'shockmount' ? 9 + 12 : 0; // inner frame panel + rail profile
    const innerW = ext.w + 2 * (b.sideGap + frame + travel);
    const innerH = ext.h + 2 * (b.topGap + frame + travel);
    const bodyD = b.railInset + t.depth + b.rearGap + (t.kind === 'shockmount' ? 2 * travel : 0);
    const lidF = b.frontLid ? b.frontLid + wall : 0, lidR = b.rearLid ? b.rearLid + wall : 0;
    const W = innerW + 2 * wall, caseH = innerH + 2 * wall;
    return {
      W, H: caseH + castorH, D: bodyD + lidF + lidR, caseH, castorH, innerW, innerH, bodyD, lidF, lidR, wall, frame, travel,
      railZ: b.railInset + travel, bayX: b.sideGap + frame + travel, bayY: b.topGap + frame + travel,
    };
  }
  if (t.kind === 'open') {
    const post = 30;
    const W = ext.w + 2 * (b.sideGap + post), caseH = ext.h + 2 * b.topGap + 2 * 40;
    return {
      W, H: caseH + castorH, D: t.depth + 2 * 20, caseH, castorH, innerW: W - 2 * post, innerH: caseH - 80, bodyD: t.depth + 40, lidF: 0, lidR: 0,
      wall: post, frame: 0, travel: 0, railZ: 20, bayX: b.sideGap, bayY: b.topGap + 40 - post,
    };
  }
  // cabinet (also wall and desk housings): steel frame, door, plinth
  const sheet = 20, plinth = 60, top = 50;
  const W = ext.w + 2 * (b.sideGap + sheet), caseH = ext.h + 2 * b.topGap + plinth + top;
  const bodyD = b.railInset + t.depth + b.rearGap;
  return {
    W, H: caseH + castorH, D: bodyD + 2 * sheet, caseH, castorH, innerW: W - 2 * sheet, innerH: caseH - plinth - top, bodyD, lidF: 0, lidR: 0,
    wall: sheet, frame: 0, travel: 0, railZ: b.railInset, bayX: b.sideGap, bayY: b.topGap,
  };
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
    panels.push(
      { name: 'Ober- und Unterseite Korpus', count: 2, a: d.innerW + 2 * p, b: d.bodyD },
      { name: 'Seitenwand Korpus', count: 2, a: d.innerH, b: d.bodyD },
    );
    for (const [name, depth] of [['Frontdeckel', b.frontLid], ['Rückdeckel', b.rearLid]] as const) {
      if (!depth) continue;
      panels.push(
        { name: `${name}: Platte`, count: 1, a: d.innerW + 2 * p, b: d.innerH + 2 * p },
        { name: `${name}: Rahmen oben/unten`, count: 2, a: d.innerW + 2 * p, b: depth },
        { name: `${name}: Rahmen seitlich`, count: 2, a: d.innerH, b: depth },
      );
    }
    if (t.kind === 'shockmount') {
      const fw = d.innerW - 2 * d.travel, fh = d.innerH - 2 * d.travel;
      panels.push(
        { name: 'Innenrack oben/unten', count: 2, a: fw, b: t.depth + b.railInset + b.rearGap },
        { name: 'Innenrack seitlich', count: 2, a: fh - 18, b: t.depth + b.railInset + b.rearGap },
      );
    }
    const plyArea = panels.reduce((s, x) => s + x.count * area(x.a, x.b), 0);
    plyKg = plyArea * (p / 1000) * PLY_DENSITY;
    if (b.profile !== 'none') {
      const along = 4 * d.bodyD + 4 * (d.lidF + d.lidR);
      const faces = lids * 2 * (d.W + d.caseH);
      const len = round2((along + faces) / 1000);
      profiles.push({ name: `Kantenprofil ${b.profile === 'alu30' ? '30 × 30' : '35 × 35'} mm`, length: len });
      profKg += len * PROFILE_KG_M[b.profile];
    }
    if (lids) {
      const len = round2((lids * 2 * (d.W + d.caseH)) / 1000);
      profiles.push({ name: 'Schließprofil Hybrid (Paar)', length: len });
      profKg += len * CLOSING_KG_M * 2;
      addHw('Butterflyverschluss groß', lids * b.latches); hwKg += lids * b.latches * 0.3;
    }
    if (b.cornerBalls && lids) { addHw('Kugelecke', lids * 4); hwKg += lids * 4 * 0.12; }
    if (b.handles) { addHw('Klappgriff versenkt (Schalengriff)', 2 * b.handles); hwKg += 2 * b.handles * 0.45; }
    if (b.stackCups) { addHw('Stapelschale', 4); hwKg += 4 * 0.15; }
    if (t.kind === 'shockmount') {
      const n = 8;
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
    if (isFlightRack(t.kind)) { panels.push({ name: 'Rollbrett (Multiplex 15 mm)', count: 1, a: d.W, b: d.D - d.lidF - d.lidR }); plyKg += area(d.W, d.D - d.lidF - d.lidR) * 0.015 * PLY_DENSITY; }
  }
  const total = plyKg + profKg + hwKg + steelKg;
  return {
    panels, profiles, hardware: [...hw.entries()].map(([label, count]) => ({ label, count })), foam: [],
    weight: { case: round1(total), contents: 0, total: round1(total), foam: 0 },
    volume: Math.round((d.W * d.H * d.D) / 1e9 * 1000) / 1000,
  };
}

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
