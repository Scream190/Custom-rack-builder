/*
 * Picking helpers for editing in the 3D view (pure geometry, no three.js, so they can be tested in node).
 * Coordinates as in route3d.ts: mm, x from the left of the rack face (front view), y up from U1,
 * z towards the viewer (front rails at z = 0, the rack extends into negative z).
 */
import type { DeviceTemplate, Face, Project, Rack } from '../model/types';
import { bayDepth, bayZ, checkPlacement, faceWidth, panelHeight, rackBays, resolveEnd, U } from '../model/geometry';
import { connectorDef } from '../model/connectors';
import { devicePorts } from '../model/modules';

export type V3 = [number, number, number];

/** z of the mounting plane of a bay for front or rear mounting */
export function mountPlaneZ(rack: Rack, bayIndex: number, mount: Face): number {
  const bay = rackBays(rack.type)[bayIndex] ?? rackBays(rack.type)[0];
  return mount === 'front' ? -bayZ(bay) : -bayZ(bay) - bayDepth(rack.type, bay);
}

/**
 * Intersect a ray with the mounting planes of all bays (front or rear) and return the hit in the bay it falls into,
 * or the nearest bay when it misses all of them. null when the ray runs parallel to the planes or points away.
 */
export function hitMountPlane(rack: Rack, origin: V3, dir: V3, mount: Face): { x: number; y: number; z: number; bay: number } | null {
  const bays = rackBays(rack.type);
  let best: { x: number; y: number; z: number; bay: number; miss: number } | null = null;
  bays.forEach((b, i) => {
    if (Math.abs(dir[2]) < 1e-9) return;
    const z = mountPlaneZ(rack, i, mount);
    const t = (z - origin[2]) / dir[2];
    if (t <= 0) return;
    const x = origin[0] + dir[0] * t, y = origin[1] + dir[1] * t;
    const bfw = faceWidth(b.rackStandard), y1 = b.y + b.heightU * U;
    const miss = Math.max(b.x - x, 0, x - (b.x + bfw)) + Math.max(b.y - y, 0, y - y1);
    if (!best || miss < best.miss) best = { x, y, z, bay: i, miss };
  });
  if (!best) return null;
  const { x, y, z, bay } = best;
  return { x, y, z, bay };
}

export interface Target3D {
  u: number;
  slot: number;
  bay: number;
  ok: boolean;
  /** same wording as the 2D placement ghost */
  label: string;
  /** box of the ghost: front-view x of the left edge, top y, width, height, z of the mounting plane, direction into the rack */
  x0: number;
  yTop: number;
  w: number;
  h: number;
  z0: number;
  dirZ: number;
  depth: number;
}

/**
 * Placement target for a template whose panel centre should be at (cx, cy) in front-view coordinates,
 * mounted on the given side of the given bay. Mirrors RackCanvas.computeTarget.
 */
export function targetAt(project: Project, rack: Rack, tpl: DeviceTemplate, mount: Face, bayIndex: number, cx: number, cy: number, ignoreId?: string): Target3D {
  const bays = rackBays(rack.type);
  const b = bays[bayIndex] ?? bays[0];
  const bi = bays[bayIndex] ? bayIndex : 0;
  const hU = tpl.heightU;
  const bottom = cy - (hU * U) / 2 - b.y;
  const u = Math.max(1, Math.min(b.heightU - hU + 1, Math.round(bottom / U) + 1));
  const bfw = faceWidth(b.rackStandard);
  const w = bfw / tpl.slots;
  const xIn = cx - b.x;                                // front-view x inside the bay
  const xm = mount === 'front' ? xIn : bfw - xIn;      // as seen from the mounting side
  const slot = Math.max(0, Math.min(tpl.slots - 1, Math.floor(xm / w)));
  const chk = checkPlacement(project, rack, tpl, u, mount, slot, ignoreId, bi);
  const x0 = b.x + (mount === 'front' ? slot * w : bfw - slot * w - w);
  const bd = bayDepth(rack.type, b);
  return {
    u, slot, bay: bi, ok: chk.ok,
    label: chk.ok ? `${bays.length > 1 ? `Feld ${bi + 1}, ` : ''}HE ${u}${hU > 1 ? '–' + (u + hU - 1) : ''}` : chk.reason ?? '',
    x0, yTop: b.y + (u - 1 + hU) * U - 0.4, w, h: panelHeight(hU),
    z0: mountPlaneZ(rack, bi, mount), dirZ: mount === 'front' ? -1 : 1, depth: Math.max(4, Math.min(tpl.depth, bd)),
  };
}

/** Which side of the rack the camera looks at (decides front or rear mounting for drops). */
export function facingSide(rack: Rack, cameraZ: number): Face {
  if (!rack.type.hasRearRails) return 'front';
  const D = Math.max(...rackBays(rack.type).map((b) => bayZ(b) + bayDepth(rack.type, b)));
  return cameraZ > -D / 2 ? 'front' : 'rear';
}

export interface PortTarget {
  deviceId: string;
  portId: string;
  name: string;
  device: string;
  /** mounting side of the device (the 3D view can hide all devices of one side) */
  mount: Face;
  /** centre on the panel surface */
  pos: V3;
  /** outward normal in z (+1 front-facing, -1 rear-facing) */
  n: number;
  /** half size of the clickable area */
  hw: number;
  hh: number;
}

/** Clickable connector areas of all devices in the rack (positions as used by the 3D cable routes). */
export function portTargets(project: Project, rack: Rack): PortTarget[] {
  const out: PortTarget[] = [];
  for (const d of rack.devices) {
    const tpl = project.templates[d.templateId];
    if (!tpl) continue;
    for (const p of devicePorts(tpl, d)) {
      const end = resolveEnd(project, rack, { deviceId: d.id, portId: p.id });
      if (!end) continue;
      const def = connectorDef(p.connector);
      out.push({
        deviceId: d.id, portId: p.id, name: p.name, device: d.label || tpl.name, mount: d.mount,
        pos: [end.pos.x, end.pos.y, -end.pos.z], n: end.pos.facing === 'front' ? 1 : -1,
        hw: Math.max(4, (def?.w ?? 10) / 2), hh: Math.max(4, (def?.h ?? 10) / 2),
      });
    }
  }
  return out;
}

/** Nearest port hit by a ray (rectangles on the panel planes), with the ray parameter t. */
export function pickPort(ports: PortTarget[], origin: V3, dir: V3): { port: PortTarget; t: number } | null {
  let best: { port: PortTarget; t: number } | null = null;
  for (const p of ports) {
    if (Math.abs(dir[2]) < 1e-9 || dir[2] * p.n > 0) continue;   // only from the side the connector faces
    const t = (p.pos[2] - origin[2]) / dir[2];
    if (t <= 0 || (best && t >= best.t)) continue;
    const x = origin[0] + dir[0] * t, y = origin[1] + dir[1] * t;
    if (Math.abs(x - p.pos[0]) <= p.hw && Math.abs(y - p.pos[1]) <= p.hh) best = { port: p, t };
  }
  return best;
}

