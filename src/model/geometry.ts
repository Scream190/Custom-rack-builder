import type { Bay, Cable, CableType, DeviceTemplate, Face, PlacedBox, PlacedDevice, Port, Project, ProjectSettings, Rack, RackType } from './types';
import { devicePorts } from './modules';

/** One rack unit (Höheneinheit) in mm. */
export const U = 44.45;
/** Front panel heights are 0.8 mm (1/32") smaller than n·U so neighbours don't touch. */
export const PANEL_GAP = 0.8;

export const faceWidth = (std: 19 | 10) => (std === 19 ? 482.6 : 254);
/** clear opening between the rails */
export const railOpening = (std: 19 | 10) => (std === 19 ? 450 : 222.25);
/** distance between mounting hole centres (left/right) */
export const holeSpacing = (std: 19 | 10) => (std === 19 ? 465.1 : 236.5);

export const panelHeight = (heightU: number) => heightU * U - PANEL_GAP;

export const opposite = (f: Face): Face => (f === 'front' ? 'rear' : 'front');

// ---------------------------------------------------------------- bays (double / triple / combination racks)

/** the rack's mounting bays (a plain rack has exactly one) */
export function rackBays(rt: RackType): Bay[] {
  return rt.bays?.length ? rt.bays : [{ heightU: rt.heightU, rackStandard: rt.rackStandard, x: 0, y: 0 }];
}
/** overall width/height (mm) of the bay arrangement – the drawing area of the rack */
export function rackExtent(rt: RackType): { w: number; h: number } {
  const bays = rackBays(rt);
  return { w: Math.max(...bays.map((b) => b.x + faceWidth(b.rackStandard))), h: Math.max(...bays.map((b) => b.y + b.heightU * U)) };
}
export const bayOf = (rack: Rack, pd: PlacedDevice): Bay => { const b = rackBays(rack.type); return b[pd.bay ?? 0] ?? b[0]; };
/** setback of a bay's front rail (mm behind the frontmost rail) */
export const bayZ = (bay: Bay) => bay.z ?? 0;
/** mounting depth of a bay */
export const bayDepth = (rt: RackType, bay: Bay) => bay.depth ?? rt.depth;
/** overall depth from the frontmost front rail to the rearmost rear rail */
export const rackDepth = (rt: RackType) => Math.max(...rackBays(rt).map((b) => bayZ(b) + bayDepth(rt, b)));
/** total rack units of all bays */
export const totalUnits = (rt: RackType) => rackBays(rt).reduce((n, b) => n + b.heightU, 0);
/** short size text: "12 HE" or "2 × 12 HE" / "4 + 10 HE" */
export function rackSizeLabel(rt: RackType): string {
  const bays = rackBays(rt);
  if (bays.length === 1) return `${bays[0].heightU} HE`;
  const hs = bays.map((b) => b.heightU);
  return hs.every((h) => h === hs[0]) ? `${bays.length} × ${hs[0]} HE` : `${hs.join(' + ')} HE`;
}
/** lay bays out side by side (gap = divider width) or stacked, bottom aligned */
export function arrangeBays(bays: Omit<Bay, 'x' | 'y'>[], mode: 'row' | 'stack', gap = 40): Bay[] {
  let x = 0, y = 0;
  const maxW = Math.max(...bays.map((b) => faceWidth(b.rackStandard)));
  // stacked: the first bay is at the top
  const ys = mode === 'stack' ? bays.map((_, i) => bays.slice(i + 1).reduce((s, b) => s + b.heightU * U + gap, 0)) : [];
  return bays.map((b, i) => {
    const out: Bay = mode === 'row' ? { ...b, x, y: 0 } : { ...b, x: (maxW - faceWidth(b.rackStandard)) / 2, y: ys[i] };
    x += faceWidth(b.rackStandard) + gap;
    y += b.heightU * U + gap;
    return out;
  });
}

export function deviceWidth(rack: Rack | RackType, tpl: DeviceTemplate, pd?: PlacedDevice): number {
  const std = 'type' in rack ? (pd ? bayOf(rack, pd).rackStandard : rack.type.rackStandard) : rack.rackStandard;
  return faceWidth(std) / tpl.slots;
}

/** Left edge of a device in FRONT-view coordinates (whole bay arrangement). */
export function deviceFrontX(rack: Rack, pd: PlacedDevice, tpl: DeviceTemplate): number {
  const bay = bayOf(rack, pd);
  const fw = faceWidth(bay.rackStandard);
  const w = fw / tpl.slots;
  const xMount = pd.slot * w; // as seen from the mounting side
  return bay.x + (pd.mount === 'front' ? xMount : fw - xMount - w);
}

/** Left edge of a device in coordinates of the given view. */
export function deviceViewX(rack: Rack, pd: PlacedDevice, tpl: DeviceTemplate, view: Face): number {
  const W = rackExtent(rack.type).w;
  const w = faceWidth(bayOf(rack, pd).rackStandard) / tpl.slots;
  const fx = deviceFrontX(rack, pd, tpl);
  return view === 'front' ? fx : W - fx - w;
}

/** Bottom / top edge (mm above the bottom of the bay arrangement); without `rack` relative to the bay */
export const deviceBottomY = (pd: PlacedDevice, rack?: Rack) => (rack ? bayOf(rack, pd).y : 0) + (pd.u - 1) * U;
export const deviceTopY = (pd: PlacedDevice, tpl: DeviceTemplate, rack?: Rack) => (rack ? bayOf(rack, pd).y : 0) + (pd.u - 1 + tpl.heightU) * U;

/** Which way a device panel faces in the rack. */
export function panelFacing(pd: PlacedDevice, panel: Face): Face {
  return panel === 'front' ? pd.mount : opposite(pd.mount);
}

export interface PortPos {
  /** x in FRONT-view coordinates, mm from left edge of the 19" face */
  x: number;
  /** y in mm above bottom of U1 */
  y: number;
  /** depth, mm behind the front mounting plane */
  z: number;
  /** the rack side the connector faces */
  facing: Face;
}

export function portPosition(rack: Rack, pd: PlacedDevice, tpl: DeviceTemplate, port: Port): PortPos {
  const fw = rackExtent(rack.type).w;
  const facing = panelFacing(pd, port.side);
  const left = deviceViewX(rack, pd, tpl, facing);
  const xView = left + port.x;
  const x = facing === 'front' ? xView : fw - xView;
  const y = deviceTopY(pd, tpl, rack) - PANEL_GAP / 2 - port.y;
  let z: number;
  const bay = bayOf(rack, pd);
  const bz = bayZ(bay), bd = bayDepth(rack.type, bay);
  if (pd.mount === 'front') z = bz + (port.side === 'front' ? 0 : tpl.depth);
  else z = bz + (port.side === 'front' ? bd : bd - tpl.depth);
  return { x, y, z, facing };
}

/** Port position projected into a 2D view (x from left, y from bottom). */
export function portViewPos(rack: Rack, pos: PortPos, view: Face) {
  const fw = rackExtent(rack.type).w;
  return { x: view === 'front' ? pos.x : fw - pos.x, y: pos.y };
}

export interface ResolvedEnd {
  device: PlacedDevice;
  tpl: DeviceTemplate;
  port: Port;
  pos: PortPos;
  /** set when the end is a split/combi box below the rack (pos.x is then a view x, the same in both views) */
  box?: PlacedBox;
}

// ---------------------------------------------------------------- boxes below the rack

/** height of the drawn case frame below U1 */
export const frameBottom = (kind: RackType['kind']) => (kind === 'cabinet' ? 70 : kind === 'open' ? 22 : 34);
const BOX_TOP = 44, BOX_ROW_GAP = 30, BOX_GAP_X = 24;

export interface BoxSlot { box: PlacedBox; tpl: DeviceTemplate; x: number; yTop: number; w: number; h: number }

/** Boxes are drawn in rows below the rack: x in view space (identical in front and rear view), yTop in rack space (mm above U1, negative). */
export function boxLayout(project: Project, rack: Rack): BoxSlot[] {
  const fw = rackExtent(rack.type).w;
  const out: BoxSlot[] = [];
  let x = 0, yTop = -(frameBottom(rack.type.kind) + BOX_TOP), rowH = 0;
  for (const box of rack.boxes ?? []) {
    const tpl = project.templates[box.templateId];
    if (!tpl?.box) continue;
    const { w, h } = tpl.box;
    if (x > 0 && x + w > fw) { x = 0; yTop -= rowH + BOX_ROW_GAP; rowH = 0; }
    out.push({ box, tpl, x, yTop, w, h });
    x += w + BOX_GAP_X;
    rowH = Math.max(rowH, h);
  }
  return out;
}

/** extra drawing height below the rack frame needed for the boxes (0 without boxes) */
export function boxAreaHeight(project: Project, rack: Rack): number {
  const slots = boxLayout(project, rack);
  if (!slots.length) return 0;
  return Math.max(...slots.map((s) => -s.yTop + s.h)) - frameBottom(rack.type.kind) + 16;
}

export function resolveEnd(project: Project, rack: Rack, end: { deviceId: string; portId: string }): ResolvedEnd | null {
  const device = rack.devices.find((d) => d.id === end.deviceId);
  if (!device) {
    const slot = rack.boxes?.some((b) => b.id === end.deviceId) ? boxLayout(project, rack).find((s) => s.box.id === end.deviceId) : undefined;
    const port = slot?.tpl.ports.find((p) => p.id === end.portId);
    if (!slot || !port) return null;
    const pseudo: PlacedDevice = { id: slot.box.id, templateId: slot.tpl.id, u: 0, mount: 'front', slot: 0, label: slot.box.label };
    return { device: pseudo, tpl: slot.tpl, port, pos: { x: slot.x + port.x, y: slot.yTop - port.y, z: 0, facing: 'front' }, box: slot.box };
  }
  const tpl = project.templates[device.templateId];
  if (!tpl) return null;
  const port = devicePorts(tpl, device).find((p) => p.id === end.portId);
  if (!port) return null;
  return { device, tpl, port, pos: portPosition(rack, device, tpl, port) };
}

/** Route length (mm) between two ports, before slack. Cables run orthogonally; front-to-rear runs go around the side. */
export function routeLength(rack: Rack, a: PortPos, b: PortPos, s: ProjectSettings): number {
  const fw = rackExtent(rack.type).w;
  const dy = Math.abs(a.y - b.y);
  if (a.facing === b.facing) {
    return Math.abs(a.x - b.x) + dy + 2 * s.exitLength;
  }
  const viaLeft = a.x + b.x;
  const viaRight = fw - a.x + (fw - b.x);
  return Math.min(viaLeft, viaRight) + dy + Math.abs(a.z - b.z) + 2 * s.exitLength;
}

export function roundLength(m: number, ct: CableType | undefined, s: ProjectSettings): number {
  if (s.roundToStock && ct && ct.stockLengths.length) {
    const sorted = [...ct.stockLengths].sort((x, y) => x - y);
    const hit = sorted.find((l) => l >= m - 1e-9);
    if (hit !== undefined) return hit;
    return Math.ceil(m * 2) / 2;
  }
  return Math.ceil(m * 10) / 10;
}

export interface CableLengthInfo {
  /** final length shown/used (m) */
  length: number;
  /** computed automatic length (rounded, m) */
  auto: number;
  /** computed exact length incl. slack (m) */
  exact: number;
}

export function cableLength(project: Project, rack: Rack, cable: Cable): CableLengthInfo | null {
  const a = resolveEnd(project, rack, cable.a);
  const b = resolveEnd(project, rack, cable.b);
  if (!a || !b) return null;
  const s = project.settings;
  const ct = project.cableTypes.find((t) => t.id === cable.typeId);
  let route: number;
  if (a.box && b.box) route = Math.abs(a.box.distance - b.box.distance) * 1000 + 1000;
  else if (a.box || b.box) {
    // in the rack: down to the floor and out at the nearer side, then the distance to the box
    const r = a.box ? b : a, box = (a.box ?? b.box)!;
    const fw = rackExtent(rack.type).w;
    route = r.pos.y + Math.min(r.pos.x, fw - r.pos.x) + s.exitLength + box.distance * 1000;
  } else route = routeLength(rack, a.pos, b.pos, s);
  const exact = (route * (1 + s.slackPercent / 100) + s.serviceLoop) / 1000;
  const auto = roundLength(exact, ct, s);
  const length = cable.lengthMode === 'manual' && cable.manualLength ? cable.manualLength : auto;
  return { length, auto, exact };
}

export function formatLength(m: number): string {
  return (Math.round(m * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' m';
}

// ---------------------------------------------------------------- placement

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  /** soft warnings (placement allowed) */
  warning?: string;
}

export function checkPlacement(
  project: Project,
  rack: Rack,
  tpl: DeviceTemplate,
  u: number,
  mount: Face,
  slot: number,
  ignoreId?: string,
  bayIndex = 0,
): PlacementCheck {
  const rt = rack.type;
  const bay = rackBays(rt)[bayIndex];
  if (!bay) return { ok: false, reason: 'Ungültiges Einbaufeld' };
  if (tpl.box) return { ok: false, reason: 'Dosen stehen unter dem Rack' };
  if (tpl.rackStandard !== bay.rackStandard) return { ok: false, reason: `${tpl.rackStandard}"-Gerät passt nicht in ${bay.rackStandard}"-Feld` };
  if (u < 1 || u + tpl.heightU - 1 > bay.heightU) return { ok: false, reason: 'Außerhalb des Racks' };
  if (slot < 0 || slot >= tpl.slots) return { ok: false, reason: 'Ungültiger Einbauplatz' };
  if (mount === 'rear' && !rt.hasRearRails) return { ok: false, reason: 'Rack hat keine hinteren Schienen' };
  const lo = u;
  const hi = u + tpl.heightU - 1;
  const fw = faceWidth(bay.rackStandard);
  const w = fw / tpl.slots;
  // front-view horizontal span within the bay
  const fx = mount === 'front' ? slot * w : fw - slot * w - w;
  let warning: string | undefined;
  const bd = bayDepth(rt, bay);
  if (tpl.depth > bd) warning = `Gerät (${tpl.depth} mm) ist tiefer als das Einbaufeld (${bd} mm)`;
  for (const other of rack.devices) {
    if (other.id === ignoreId || (other.bay ?? 0) !== bayIndex) continue;
    const ot = project.templates[other.templateId];
    if (!ot) continue;
    const olo = other.u;
    const ohi = other.u + ot.heightU - 1;
    if (hi < olo || lo > ohi) continue;
    const ofx = deviceFrontX(rack, other, ot) - bay.x;
    const ow = fw / ot.slots;
    const hOverlap = Math.min(fx + w, ofx + ow) - Math.max(fx, ofx) > 0.5;
    if (!hOverlap) continue;
    if (other.mount === mount) return { ok: false, reason: `Belegt durch ${other.label || ot.name}` };
    if (tpl.depth + ot.depth > bd) return { ok: false, reason: `Zu tief: kollidiert mit ${other.label || ot.name} (${mount === 'front' ? 'hinten' : 'vorne'})` };
  }
  return { ok: true, warning };
}

/** Find the first free position (from the top of the first bay) for a template in a rack. */
export function findFreeSpot(project: Project, rack: Rack, tpl: DeviceTemplate, mount: Face): { u: number; slot: number; bay: number } | null {
  const bays = rackBays(rack.type);
  for (let bay = 0; bay < bays.length; bay++) {
    for (let u = bays[bay].heightU - tpl.heightU + 1; u >= 1; u--) {
      for (let slot = 0; slot < tpl.slots; slot++) {
        if (checkPlacement(project, rack, tpl, u, mount, slot, undefined, bay).ok) return { u, slot, bay };
      }
    }
  }
  return null;
}

export function usedUnits(project: Project, rack: Rack): number {
  const used = new Set<string>();
  for (const d of rack.devices) {
    const t = project.templates[d.templateId];
    if (!t) continue;
    for (let i = 0; i < t.heightU; i++) used.add(`${d.bay ?? 0}:${d.u + i}`);
  }
  return used.size;
}
