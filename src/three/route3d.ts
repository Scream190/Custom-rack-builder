/*
 * Collision-free cable routing for the 3D view: A* search on a voxel grid of the free space inside the rack.
 *
 *  - obstacles: device front plates and chassis (real body width), rack rails – expanded by the largest cable radius
 *  - every cable starts/ends a little in front of its connector (along the panel normal)
 *  - routes are orthogonal; each bend costs extra, so cables run in straight bundles like in a real rack
 *  - a routed cable blocks the space around it (its radius + largest radius + air) for all following cables;
 *    passing through that space is allowed only at a very high cost, i.e. only when there is no other way
 *  - grid: 6 mm cells (8 mm for racks above 20 U)
 * Coordinates: mm, x from the left of the 19" face (front view), y up from U1, z towards the viewer (front rails at 0).
 */
import type { DeviceTemplate, PlacedDevice, Project, Rack } from '../model/types';
import { deviceFrontX, deviceTopY, faceWidth, panelHeight, resolveEnd, U } from '../model/geometry';
import { cableColor } from '../render/cablePaths';

export interface Route3D { cableId: string; color: string; radius: number; points: [number, number, number][]; blocked: boolean }

const AIR = 1.5;
const PLATE = 3;
const TURN = 6;          // extra cost of a bend (in cells)
const CROSS = 400;       // extra cost of entering space reserved by another cable

/** chassis width as drawn in the 3D view */
export function bodyWidth3D(rack: Rack, tpl: DeviceTemplate) {
  const w = faceWidth(rack.type.rackStandard) / tpl.slots;
  return tpl.bodyWidth && tpl.bodyWidth < w ? tpl.bodyWidth : tpl.slots === 1 && !tpl.panel ? Math.min(w, faceWidth(rack.type.rackStandard) - 32) : w - 4;
}

/** axis-aligned boxes (plate + chassis) of a placed device */
export function deviceBoxes(rack: Rack, d: PlacedDevice, tpl: DeviceTemplate): { lo: number[]; hi: number[] }[] {
  const w = faceWidth(rack.type.rackStandard) / tpl.slots;
  const h = panelHeight(tpl.heightU);
  const D = rack.type.depth;
  const depth = Math.max(PLATE + 1, Math.min(tpl.depth, D));
  const x0 = deviceFrontX(rack, d, tpl);
  const yTop = deviceTopY(d, tpl) - 0.4;
  const bw = bodyWidth3D(rack, tpl);
  const bx = x0 + (w - bw) / 2;
  if (d.mount === 'front') {
    return [{ lo: [x0, yTop - h, -PLATE], hi: [x0 + w, yTop, 0] }, { lo: [bx, yTop - h + 0.3, -depth], hi: [bx + bw, yTop - 0.3, -PLATE] }];
  }
  return [{ lo: [x0, yTop - h, -D], hi: [x0 + w, yTop, -D + PLATE] }, { lo: [bx, yTop - h + 0.3, -D + PLATE], hi: [bx + bw, yTop - 0.3, -D + depth] }];
}

/** binary min-heap on (priority, value) */
class Heap {
  private p: number[] = [];
  private v: number[] = [];
  get size() { return this.v.length; }
  push(pr: number, val: number) {
    const p = this.p, v = this.v;
    let i = v.length;
    p.push(pr); v.push(val);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= pr) break;
      p[i] = p[j]; v[i] = v[j]; i = j;
    }
    p[i] = pr; v[i] = val;
  }
  pop(): number {
    const p = this.p, v = this.v;
    const top = v[0];
    const lp = p.pop()!, lv = v.pop()!;
    if (v.length) {
      let i = 0;
      const n = v.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && p[c + 1] < p[c]) c++;
        if (p[c] >= lp) break;
        p[i] = p[c]; v[i] = v[c]; i = c;
      }
      p[i] = lp; v[i] = lv;
    }
    return top;
  }
}

export function route3D(project: Project, rack: Rack, radiusOf: (typeId: string) => number): { routes: Route3D[] } {
  const fw = faceWidth(rack.type.rackStandard);
  const H = rack.type.heightU * U;
  const D = rack.type.depth;
  const wall = Math.max(18, Math.min(70, (rack.type.outer.w - fw) / 2));
  const shell = Math.min(10, wall);
  const space = Math.max(30, Math.min(80, (rack.type.outer.d - D) / 2));
  const rMax = Math.max(1.5, ...rack.cables.map((c) => radiusOf(c.typeId)));
  const c = rack.type.heightU > 20 ? 8 : 6;

  // grid
  const X0 = -wall + shell + 0.5, X1 = fw + wall - shell - 0.5;
  const Y0 = 0.5, Y1 = H - 0.5;          // inside the case (top and bottom panels are solid)
  const Z0 = -D - space, Z1 = space;
  const nx = Math.ceil((X1 - X0) / c), ny = Math.ceil((Y1 - Y0) / c), nz = Math.ceil((Z1 - Z0) / c);
  const N = nx * ny * nz;
  const idx = (ix: number, iy: number, iz: number) => (iz * ny + iy) * nx + ix;
  const cx = (ix: number) => X0 + (ix + 0.5) * c, cy = (iy: number) => Y0 + (iy + 0.5) * c, cz = (iz: number) => Z0 + (iz + 0.5) * c;
  const cell = (x: number, y: number, z: number) => [
    Math.max(0, Math.min(nx - 1, Math.floor((x - X0) / c))),
    Math.max(0, Math.min(ny - 1, Math.floor((y - Y0) / c))),
    Math.max(0, Math.min(nz - 1, Math.floor((z - Z0) / c))),
  ];
  const solid = new Uint8Array(N);   // devices, rails
  const taken = new Uint8Array(N);   // reserved by routed cables

  const blockBox = (lo: number[], hi: number[], grow: number) => {
    const a = cell(lo[0] - grow, lo[1] - grow, lo[2] - grow), b = cell(hi[0] + grow, hi[1] + grow, hi[2] + grow);
    for (let iz = a[2]; iz <= b[2]; iz++) for (let iy = a[1]; iy <= b[1]; iy++) for (let ix = a[0]; ix <= b[0]; ix++) {
      const x = cx(ix), y = cy(iy), z = cz(iz);
      if (x >= lo[0] - grow && x <= hi[0] + grow && y >= lo[1] - grow && y <= hi[1] + grow && z >= lo[2] - grow && z <= hi[2] + grow) solid[idx(ix, iy, iz)] = 1;
    }
  };
  const grow = rMax + 0.5;
  for (const d of rack.devices) {
    const t = project.templates[d.templateId];
    if (t) for (const b of deviceBoxes(rack, d, t)) blockBox(b.lo, b.hi, grow);
  }
  const railW = 16;
  for (const z of rack.type.hasRearRails ? [0, -D] : [0]) {
    blockBox([0, 0, z - 2], [railW, H, z], grow);
    blockBox([fw - railW, 0, z - 2], [fw, H, z], grow);
  }

  // neighbourhood offsets for reserving the space around a routed cable
  const sphere = (rad: number) => {
    const k = Math.ceil(rad / c), out: number[][] = [];
    for (let dz = -k; dz <= k; dz++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (Math.hypot(dx, dy, dz) * c <= rad + c * 0.5) out.push([dx, dy, dz]);
    return out;
  };
  const sphereCache = new Map<number, number[][]>();

  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const g = new Float32Array(N);
  const from = new Int32Array(N);
  const dirOf = new Int8Array(N);
  const stamp = new Uint32Array(N);
  let gen = 0;

  /** nearest non-solid cell walking from (x,y,z) along the normal */
  const freeCellAlong = (x: number, y: number, z: number, nzDir: number) => {
    for (let k = 0; k < 40; k++) {
      const [ix, iy, iz] = cell(x, y, z + nzDir * k * c);
      if (!solid[idx(ix, iy, iz)]) return [ix, iy, iz];
    }
    return cell(x, y, z);
  };

  // cables: short ones first – they have the fewest alternatives
  const jobs = rack.cables.map((cab) => {
    const a = resolveEnd(project, rack, cab.a), b = resolveEnd(project, rack, cab.b);
    return { cab, a, b, len: a && b ? Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y) + Math.abs(a.pos.z - b.pos.z) : 0 };
  }).filter((j) => j.a && j.b).sort((p, q) => p.len - q.len);

  // exit zones in front of every used connector belong to that cable: nobody else may pass right in front of a port
  const owner = new Int32Array(N).fill(-1);       // -1 free, ≥0 job index, -2 shared by several cables
  const exitOf = (e: NonNullable<typeof jobs[number]['a']>) => {
    const n = e.pos.facing === 'front' ? 1 : -1;            // outward normal in z
    const z = -e.pos.z;
    const anchor: [number, number, number] = [e.pos.x, e.pos.y, z + n * (grow + c)];
    return { n, port: [e.pos.x, e.pos.y, z] as [number, number, number], anchor, cell: freeCellAlong(anchor[0], anchor[1], anchor[2], n) };
  };
  const exitR = 2 * rMax + AIR;
  jobs.forEach((j, ji) => {
    for (const e of [j.a!, j.b!]) {
      const ex = exitOf(e);
      const [ax, ay] = [ex.port[0], ex.port[1]];
      const za = Math.min(ex.port[2], ex.anchor[2] + ex.n * c), zb = Math.max(ex.port[2], ex.anchor[2] + ex.n * c);
      const lo = cell(ax - exitR, ay - exitR, za), hi = cell(ax + exitR, ay + exitR, zb);
      for (let iz = lo[2]; iz <= hi[2]; iz++) for (let iy = lo[1]; iy <= hi[1]; iy++) for (let ix = lo[0]; ix <= hi[0]; ix++) {
        if (Math.hypot(cx(ix) - ax, cy(iy) - ay) > exitR + c * 0.5) continue;
        const v = idx(ix, iy, iz);
        owner[v] = owner[v] === -1 || owner[v] === ji ? ji : -2;
      }
    }
  });

  const routes: Route3D[] = [];
  for (let ji = 0; ji < jobs.length; ji++) {
    const { cab, a, b } = jobs[ji];
    const r = radiusOf(cab.typeId);
    const ends = [exitOf(a!), exitOf(b!)];
    const s = idx(ends[0].cell[0], ends[0].cell[1], ends[0].cell[2]);
    const t = idx(ends[1].cell[0], ends[1].cell[1], ends[1].cell[2]);
    const [tx, ty, tz] = ends[1].cell;

    // A*
    gen++;
    const heap = new Heap();
    g[s] = 0; from[s] = -1; dirOf[s] = -1; stamp[s] = gen;
    heap.push(0, s);
    let found = false, iter = 0;
    const MAX_ITER = 3_000_000;
    while (heap.size && iter++ < MAX_ITER) {
      const u = heap.pop();
      if (u === t) { found = true; break; }
      const iz = Math.floor(u / (nx * ny)), rem = u - iz * nx * ny, iy = Math.floor(rem / nx), ix = rem - iy * nx;
      const gu = g[u];
      for (let k = 0; k < 6; k++) {
        const jx = ix + DIRS[k][0], jy = iy + DIRS[k][1], jz = iz + DIRS[k][2];
        if (jx < 0 || jy < 0 || jz < 0 || jx >= nx || jy >= ny || jz >= nz) continue;
        const v = idx(jx, jy, jz);
        if (solid[v] && v !== t) continue;
        const own = owner[v];
        if (own >= 0 && own !== ji && v !== t) continue;          // another cable's connector exit
        const cost = gu + 1 + (dirOf[u] >= 0 && dirOf[u] !== k ? TURN : 0) + (taken[v] ? CROSS : 0) + (own === -2 ? CROSS / 4 : 0);
        if (stamp[v] === gen && cost >= g[v]) continue;
        stamp[v] = gen; g[v] = cost; from[v] = u; dirOf[v] = k;
        heap.push(cost + Math.abs(jx - tx) + Math.abs(jy - ty) + Math.abs(jz - tz), v);
      }
    }

    const cells: number[] = [];
    if (found) for (let u = t; u !== -1; u = from[u]) cells.push(u);
    cells.reverse();
    let blocked = !found;
    const pts: [number, number, number][] = [ends[0].port, ends[0].anchor];
    for (const u of cells) {
      const iz = Math.floor(u / (nx * ny)), rem = u - iz * nx * ny, iy = Math.floor(rem / nx), ix = rem - iy * nx;
      if (taken[u]) blocked = true;
      pts.push([cx(ix), cy(iy), cz(iz)]);
    }
    pts.push(ends[1].anchor, ends[1].port);

    // reserve the space around the cable for the following cables
    const rad = r + rMax + AIR;
    const key = Math.round(rad * 10);
    if (!sphereCache.has(key)) sphereCache.set(key, sphere(rad));
    const off = sphereCache.get(key)!;
    for (const u of cells) {
      const iz = Math.floor(u / (nx * ny)), rem = u - iz * nx * ny, iy = Math.floor(rem / nx), ix = rem - iy * nx;
      for (const [dx, dy, dz] of off) {
        const jx = ix + dx, jy = iy + dy, jz = iz + dz;
        if (jx >= 0 && jy >= 0 && jz >= 0 && jx < nx && jy < ny && jz < nz) taken[idx(jx, jy, jz)] = 1;
      }
    }
    routes.push({ cableId: cab.id, color: cableColor(project, cab), radius: r, points: simplify(pts), blocked });
  }
  return { routes };
}

/** drop points on straight lines */
function simplify(pts: [number, number, number][]) {
  const out: [number, number, number][] = [];
  for (const p of pts) {
    if (out.length && Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1], p[2] - out[out.length - 1][2]) < 0.05) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (Math.hypot(...cr) < 1e-6 && u[0] * v[0] + u[1] * v[1] + u[2] * v[2] > 0) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}
