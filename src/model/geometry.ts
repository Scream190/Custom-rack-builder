import type { Cable, CableType, DeviceTemplate, Face, PlacedDevice, Port, Project, ProjectSettings, Rack, RackType } from './types';

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

export function deviceWidth(rack: Rack | RackType, tpl: DeviceTemplate): number {
  const std = 'type' in rack ? rack.type.rackStandard : rack.rackStandard;
  return faceWidth(std) / tpl.slots;
}

/** Left edge of a device in FRONT-view coordinates. */
export function deviceFrontX(rack: Rack, pd: PlacedDevice, tpl: DeviceTemplate): number {
  const fw = faceWidth(rack.type.rackStandard);
  const w = fw / tpl.slots;
  const xMount = pd.slot * w; // as seen from the mounting side
  return pd.mount === 'front' ? xMount : fw - xMount - w;
}

/** Left edge of a device in coordinates of the given view. */
export function deviceViewX(rack: Rack, pd: PlacedDevice, tpl: DeviceTemplate, view: Face): number {
  const fw = faceWidth(rack.type.rackStandard);
  const w = fw / tpl.slots;
  const fx = deviceFrontX(rack, pd, tpl);
  return view === 'front' ? fx : fw - fx - w;
}

/** Bottom edge (mm above bottom of U1) */
export const deviceBottomY = (pd: PlacedDevice) => (pd.u - 1) * U;
export const deviceTopY = (pd: PlacedDevice, tpl: DeviceTemplate) => (pd.u - 1 + tpl.heightU) * U;

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
  const fw = faceWidth(rack.type.rackStandard);
  const facing = panelFacing(pd, port.side);
  const left = deviceViewX(rack, pd, tpl, facing);
  const xView = left + port.x;
  const x = facing === 'front' ? xView : fw - xView;
  const y = deviceTopY(pd, tpl) - PANEL_GAP / 2 - port.y;
  let z: number;
  if (pd.mount === 'front') z = port.side === 'front' ? 0 : tpl.depth;
  else z = port.side === 'front' ? rack.type.depth : rack.type.depth - tpl.depth;
  return { x, y, z, facing };
}

/** Port position projected into a 2D view (x from left, y from bottom). */
export function portViewPos(rack: Rack, pos: PortPos, view: Face) {
  const fw = faceWidth(rack.type.rackStandard);
  return { x: view === 'front' ? pos.x : fw - pos.x, y: pos.y };
}

export interface ResolvedEnd {
  device: PlacedDevice;
  tpl: DeviceTemplate;
  port: Port;
  pos: PortPos;
}

export function resolveEnd(project: Project, rack: Rack, end: { deviceId: string; portId: string }): ResolvedEnd | null {
  const device = rack.devices.find((d) => d.id === end.deviceId);
  if (!device) return null;
  const tpl = project.templates[device.templateId];
  if (!tpl) return null;
  const port = tpl.ports.find((p) => p.id === end.portId);
  if (!port) return null;
  return { device, tpl, port, pos: portPosition(rack, device, tpl, port) };
}

/** Route length (mm) between two ports, before slack. Cables run orthogonally; front-to-rear runs go around the side. */
export function routeLength(rack: Rack, a: PortPos, b: PortPos, s: ProjectSettings): number {
  const fw = faceWidth(rack.type.rackStandard);
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
  const route = routeLength(rack, a.pos, b.pos, s);
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
): PlacementCheck {
  const rt = rack.type;
  if (tpl.rackStandard !== rt.rackStandard) return { ok: false, reason: `${tpl.rackStandard}"-Gerät passt nicht in ${rt.rackStandard}"-Rack` };
  if (u < 1 || u + tpl.heightU - 1 > rt.heightU) return { ok: false, reason: 'Außerhalb des Racks' };
  if (slot < 0 || slot >= tpl.slots) return { ok: false, reason: 'Ungültiger Einbauplatz' };
  if (mount === 'rear' && !rt.hasRearRails) return { ok: false, reason: 'Rack hat keine hinteren Schienen' };
  const lo = u;
  const hi = u + tpl.heightU - 1;
  const fw = faceWidth(rt.rackStandard);
  const w = fw / tpl.slots;
  // front-view horizontal span
  const fx = mount === 'front' ? slot * w : fw - slot * w - w;
  let warning: string | undefined;
  if (tpl.depth > rt.depth) warning = `Gerät (${tpl.depth} mm) ist tiefer als das Rack (${rt.depth} mm)`;
  for (const other of rack.devices) {
    if (other.id === ignoreId) continue;
    const ot = project.templates[other.templateId];
    if (!ot) continue;
    const olo = other.u;
    const ohi = other.u + ot.heightU - 1;
    if (hi < olo || lo > ohi) continue;
    const ofx = deviceFrontX(rack, other, ot);
    const ow = fw / ot.slots;
    const hOverlap = Math.min(fx + w, ofx + ow) - Math.max(fx, ofx) > 0.5;
    if (!hOverlap) continue;
    if (other.mount === mount) return { ok: false, reason: `Belegt durch ${other.label || ot.name}` };
    if (tpl.depth + ot.depth > rt.depth) return { ok: false, reason: `Zu tief: kollidiert mit ${other.label || ot.name} (${mount === 'front' ? 'hinten' : 'vorne'})` };
  }
  return { ok: true, warning };
}

/** Find the first free position (from top) for a template in a rack. */
export function findFreeSpot(project: Project, rack: Rack, tpl: DeviceTemplate, mount: Face): { u: number; slot: number } | null {
  for (let u = rack.type.heightU - tpl.heightU + 1; u >= 1; u--) {
    for (let slot = 0; slot < tpl.slots; slot++) {
      if (checkPlacement(project, rack, tpl, u, mount, slot).ok) return { u, slot };
    }
  }
  return null;
}

export function usedUnits(project: Project, rack: Rack): number {
  const used = new Set<string>();
  for (const d of rack.devices) {
    const t = project.templates[d.templateId];
    if (!t) continue;
    for (let i = 0; i < t.heightU; i++) used.add(d.mount + ':' + (d.u + i));
  }
  let n = 0;
  for (let u = 1; u <= rack.type.heightU; u++) if (used.has('front:' + u) || used.has('rear:' + u)) n++;
  return n;
}
