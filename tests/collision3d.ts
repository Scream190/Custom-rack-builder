// Numeric collision check of the 3D cable routes (cable↔cable, cable↔device chassis). Run: npm run test:3d
// Fails (exit code 1) when a cable touches another cable or a device that it is not connected to.
import { sampleProject } from '../src/library/sample';
import { route3D } from '../src/three/route3d';
import { deviceFrontX, faceWidth, panelHeight, U } from '../src/model/geometry';
import type { Project, Rack } from '../src/model/types';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** distance between segments p1q1 and p2q2 */
function segDist(p1: V, q1: V, p2: V, q2: V) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) return Math.sqrt(dot(r, r));
  if (a <= 1e-9) { t = clamp(f / e, 0, 1); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-9) { s = clamp(-c / a, 0, 1); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1: V = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2: V = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  const w = sub(c1, c2);
  return Math.sqrt(dot(w, w));
}

/** does a segment come closer than r to an axis-aligned box? (sampled) */
function segBoxDist(p: V, q: V, lo: V, hi: V) {
  let best = Infinity;
  const n = Math.max(2, Math.ceil(Math.hypot(...sub(q, p)) / 1));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x: V = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const dx = Math.max(lo[0] - x[0], 0, x[0] - hi[0]), dy = Math.max(lo[1] - x[1], 0, x[1] - hi[1]), dz = Math.max(lo[2] - x[2], 0, x[2] - hi[2]);
    best = Math.min(best, Math.hypot(dx, dy, dz));
  }
  return best;
}

function check(project: Project, rack: Rack, label: string) {
  const radiusOf = (id: string) => (project.cableTypes.find((t) => t.id === id)?.width ?? 2) * 1.1;
  const { routes } = route3D(project, rack, radiusOf);
  const fw = faceWidth(rack.type.rackStandard);
  // chassis boxes (as drawn in Rack3D)
  const boxes = rack.devices.map((d) => {
    const t = project.templates[d.templateId];
    const w = fw / t.slots, h = panelHeight(t.heightU), depth = Math.min(t.depth, rack.type.depth);
    const bodyW = t.bodyWidth && t.bodyWidth < w ? t.bodyWidth : t.slots === 1 && !t.panel ? Math.min(w, fw - 32) : w - 4;
    const x0 = deviceFrontX(rack, d, t) + (w - bodyW) / 2, yTop = (d.u - 1 + t.heightU) * U - 0.4;
    const z1 = d.mount === 'front' ? -depth : -rack.type.depth, z2 = d.mount === 'front' ? 0 : -rack.type.depth + depth;
    return { id: d.id, name: d.label || t.name, lo: [x0, yTop - h, z1] as V, hi: [x0 + bodyW, yTop, z2] as V };
  });
  const cableDev = new Map(rack.cables.map((c) => [c.id, [c.a.deviceId, c.b.deviceId]]));
  let cc = 0, cd = 0, worstCC = Infinity, worstCD = Infinity;
  const msgs: string[] = [];
  for (let i = 0; i < routes.length; i++) {
    const A = routes[i];
    // cable ↔ device (own devices excluded for the port exits = first/last segment)
    for (let k = 0; k < A.points.length - 1; k++) {
      for (const b of boxes) {
        const own = cableDev.get(A.cableId)!.includes(b.id);
        if (own && (k === 0 || k === A.points.length - 2)) continue;
        const dist = segBoxDist(A.points[k], A.points[k + 1], b.lo, b.hi);
        if (own) continue; // own chassis: the cable starts on its surface
        worstCD = Math.min(worstCD, dist - A.radius);
        if (dist < A.radius - 0.3) { cd++; if (msgs.length < 8) msgs.push(`device: ${A.cableId} seg ${k} ↔ ${b.name} (${dist.toFixed(1)} < r ${A.radius.toFixed(1)})`); }
      }
    }
    for (let j = i + 1; j < routes.length; j++) {
      const B = routes[j];
      // legs of one Y cable start at the same connector
      const ya = rack.cables.find((c) => c.id === A.cableId)?.yGroup;
      if (ya && ya === rack.cables.find((c) => c.id === B.cableId)?.yGroup) continue;
      const need = A.radius + B.radius;
      let min = Infinity, where = '';
      for (let k = 0; k < A.points.length - 1; k++) for (let l = 0; l < B.points.length - 1; l++) {
        const dd = segDist(A.points[k], A.points[k + 1], B.points[l], B.points[l + 1]);
        if (dd < min) { min = dd; where = `A[${k}/${A.points.length - 1}] ${JSON.stringify(A.points[k].map(Math.round))}->${JSON.stringify(A.points[k + 1].map(Math.round))}  B[${l}/${B.points.length - 1}] ${JSON.stringify(B.points[l].map(Math.round))}->${JSON.stringify(B.points[l + 1].map(Math.round))}`; }
      }
      worstCC = Math.min(worstCC, min - need);
      if (min < need - 0.3) { cc++; if (msgs.length < 16) msgs.push(`cable: ${A.cableId} ↔ ${B.cableId} (${min.toFixed(1)} < ${need.toFixed(1)}) ${where}`); }
    }
  }
  if (cc || cd) failed = true;
  console.log(`${label}: ${routes.length} cables · cable↔cable collisions ${cc} (worst clearance ${worstCC.toFixed(1)} mm) · cable↔device collisions ${cd} (worst ${worstCD.toFixed(1)} mm)`);
  msgs.forEach((m) => console.log('   ', m));
}

let failed = false;
const p = sampleProject();
check(p, p.racks[0], 'sample rack');

// dense rack: 2× AD4Q + 16× XLR patch, all outputs patched, power + network
{
  const q = sampleProject();
  const rk = q.racks[0];
  const { BUILTIN_DEVICES } = await import('../src/library/devices');
  for (const id of ['shure-ad4q', 'gen-patch-xlr16', 'gen-switch16', 'gen-pdu-iec8']) q.templates[id] = structuredClone(BUILTIN_DEVICES.find((t) => t.id === id)!);
  rk.devices = [
    { id: 'pa', templateId: 'gen-patch-xlr16', u: 6, mount: 'front', slot: 0 },
    { id: 'q1', templateId: 'shure-ad4q', u: 5, mount: 'front', slot: 0 },
    { id: 'q2', templateId: 'shure-ad4q', u: 4, mount: 'front', slot: 0 },
    { id: 'sw', templateId: 'gen-switch16', u: 3, mount: 'front', slot: 0 },
    { id: 'pd', templateId: 'gen-pdu-iec8', u: 1, mount: 'front', slot: 0 },
  ];
  const port = (dev: string, name: string) => ({ deviceId: dev, portId: q.templates[rk.devices.find((d) => d.id === dev)!.templateId].ports.find((p) => p.name === name)!.id });
  let n = 0;
  const cab = (a: [string, string], b: [string, string], typeId: string) => ({ id: 'x' + ++n, number: n, a: port(...a), b: port(...b), typeId, lengthMode: 'auto' as const });
  rk.cables = [
    ...[1, 2, 3, 4].map((i) => cab(['q1', `Out ${i}`], ['pa', `R${i}`], 'ct-xlr')),
    ...[1, 2, 3, 4].map((i) => cab(['q2', `Out ${i}`], ['pa', `R${i + 4}`], 'ct-xlr')),
    cab(['q1', 'Dante 1'], ['sw', 'Port 1'], 'ct-cat'), cab(['q2', 'Dante 1'], ['sw', 'Port 2'], 'ct-cat'),
    cab(['q1', 'Ctrl 1'], ['sw', 'Port 3'], 'ct-cat'), cab(['q2', 'Ctrl 1'], ['sw', 'Port 4'], 'ct-cat'),
    cab(['pd', 'Out 1'], ['q1', 'Power In'], 'ct-iec'), cab(['pd', 'Out 2'], ['q2', 'Power In'], 'ct-iec'), cab(['pd', 'Out 3'], ['sw', 'Power'], 'ct-iec'),
    cab(['q1', 'C Cascade'], ['q2', 'Ant A'], 'ct-rg58'), cab(['q1', 'D Cascade'], ['q2', 'Ant B'], 'ct-rg58'),
  ];
  // a Y cable: switch port 5 to both receivers' second control port
  const y1 = cab(['sw', 'Port 5'], ['q1', 'Ctrl 2'], 'ct-cat'), y2 = cab(['sw', 'Port 5'], ['q2', 'Ctrl 2'], 'ct-cat');
  Object.assign(y1, { yGroup: 'y1', yLeg: 1 }); Object.assign(y2, { yGroup: 'y1', yLeg: 2, number: y1.number });
  rk.cables.push(y1, y2);
  check(q, rk, 'dense rack');
}
// performance: sample devices in a 42 U cabinet
{
  const q = sampleProject();
  const { BUILTIN_RACK_TYPES } = await import('../src/library/rackTypes');
  q.racks[0].type = structuredClone(BUILTIN_RACK_TYPES.find((t) => t.id === 'cab-42u-800')!);
  for (const d of q.racks[0].devices) d.u += 20;
  const t0 = Date.now();
  check(q, q.racks[0], '42 U cabinet');
  console.log('   time incl. check', Date.now() - t0, 'ms');
}

if (failed) { console.error('3D cable routing: collisions found'); process.exit(1); }
console.log('3D cable routing: no collisions');
