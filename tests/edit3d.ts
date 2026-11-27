// Editing in the 3D view without a browser: connector picking, cabling by clicks, drop target and moving devices.
// Rays are built like the camera would cast them. Run: npm run test:edit3d
import { sampleProject } from '../src/library/sample';
import { BUILTIN_DEVICES } from '../src/library/devices';
import { useStore } from '../src/model/store';
import { clickPort } from '../src/model/cabling';
import { deviceBottomY, deviceFrontX, faceWidth, resolveEnd, U } from '../src/model/geometry';
import { devicePorts } from '../src/model/modules';
import { facingSide, hitMountPlane, pickPort, portTargets, targetAt, type V3 } from '../src/three/pick3d';

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.error('FAIL ' + msg); } };
const st = useStore.getState;

const pj = sampleProject();
useStore.setState({ project: pj, past: [], future: [], readOnly: false, pendingPort: null, selection: null });
const rack = () => st().project.racks[0];

// 1) every connector of every device is clickable, at the position the 3D cable routes use
const ports = portTargets(st().project, rack());
const expected = rack().devices.reduce((n, d) => n + devicePorts(st().project.templates[d.templateId], d).length, 0);
check(ports.length === expected, `portTargets: ${ports.length} of ${expected} connectors`);
for (const p of ports) {
  const e = resolveEnd(st().project, rack(), p)!;
  check(Math.abs(p.pos[0] - e.pos.x) < 1e-6 && Math.abs(p.pos[2] + e.pos.z) < 1e-6, `port ${p.deviceId}:${p.portId} position`);
}

/** ray straight at a connector from 1 m in front of the side it faces */
const rayAt = (pos: V3, n: number, dx = 0, dy = 0): { o: V3; d: V3 } => ({ o: [pos[0] + dx, pos[1] + dy, pos[2] + n * 1000], d: [0, 0, -n] });

// 2) picking: hits from the facing side, nothing from behind, nearest wins
let hits = 0;
for (const p of ports) {
  const { o, d } = rayAt(p.pos, p.n, 1, -1);
  const h = pickPort(ports, o, d);
  if (h && h.port.deviceId === p.deviceId && h.port.portId === p.portId) hits++;
  const back = pickPort(ports.filter((q) => q === p), [p.pos[0], p.pos[1], p.pos[2] - p.n * 1000], [0, 0, p.n]);
  check(!back, `port ${p.portId} must not be picked from behind`);
}
// neighbouring connectors may overlap with their click areas; nearly all must resolve to themselves
check(hits >= ports.length * 0.9, `picking resolved ${hits} of ${ports.length} connectors to themselves`);

// 3) cabling by two clicks, like in the 2D view
const free = ports.filter((p) => !rack().cables.some((c) => [c.a, c.b].some((e) => e.deviceId === p.deviceId && e.portId === p.portId)));
const a = free.find((p) => p.deviceId === 'd-rx1' && p.n === -1)!;
const b = free.find((p) => p.deviceId === 'd-xlr' && p.n === -1)!;
check(!!a && !!b, 'free rear connectors on RX 1 and the audio patch');
const before = rack().cables.length;
const pa = pickPort(ports, ...Object.values(rayAt(a.pos, a.n)) as [V3, V3])!;
clickPort(rack().id, pa.port.deviceId, pa.port.portId);
check(st().pendingPort?.portId === a.portId, 'first click starts a cable');
const pb = pickPort(ports, ...Object.values(rayAt(b.pos, b.n)) as [V3, V3])!;
clickPort(rack().id, pb.port.deviceId, pb.port.portId);
check(st().pendingPort === null, 'second click ends cabling');
check(rack().cables.length === before + 1, 'second click connects');
const nc = rack().cables[rack().cables.length - 1];
check(nc.a.portId === a.portId && nc.b.portId === b.portId, 'new cable joins the clicked connectors');
// clicking a connected connector selects its cable
clickPort(rack().id, a.deviceId, a.portId);
check(st().selection?.kind === 'cable' && st().selection?.id === nc.id && st().pendingPort === null, 'click on a connected connector selects the cable');
clickPort(rack().id, a.deviceId, a.portId, true);
check(st().pendingPort?.portId === a.portId, 'Alt-click on a connected connector starts another cable');
st().setPendingPort(null);

// 4) moving a device: drag the IEM transmitter two units down onto the PDU's place after removing the PDU
st().removeDevice(rack().id, 'd-pdu');
const iem = rack().devices.find((d) => d.id === 'd-iem')!;
const tplIem = st().project.templates[iem.templateId];
const cx = deviceFrontX(rack(), iem, tplIem) + faceWidth(19) / tplIem.slots / 2;
const cy = deviceBottomY(iem, rack()) + (tplIem.heightU * U) / 2;
const ray = { o: [cx + 30, cy - 2 * U, 1500] as V3, d: [0, 0, -1] as V3 };
const h = hitMountPlane(rack(), ray.o, ray.d, 'front')!;
check(!!h && Math.abs(h.z) < 1e-6 && h.bay === 0, 'ray from the front hits the front mounting plane');
const t = targetAt(st().project, rack(), tplIem, 'front', h.bay, h.x - 30, h.y, iem.id);
check(t.ok && t.u === iem.u - 2, `move target U ${t.u}, expected ${iem.u - 2} (${t.label})`);
check(st().moveDevice(rack().id, iem.id, t.u, 'front', t.slot, t.bay), 'moveDevice accepts the 3D target');
const occupied = targetAt(st().project, rack(), tplIem, 'front', 0, cx, deviceBottomY(rack().devices.find((d) => d.id === 'd-rx1')!, rack()) + U / 2, iem.id);
check(!occupied.ok && /RX 1/.test(occupied.label), `occupied slot is refused (${occupied.label})`);

// 5) drop from the library at the freed unit; the side follows the camera
const drop = BUILTIN_DEVICES.find((d) => d.id === 'gen-pdu-iec8')!;
check(facingSide(rack(), 1.5 * 1000) === 'front', 'camera in front → front mounting');
check(facingSide(rack(), -5000) === (rack().type.hasRearRails ? 'rear' : 'front'), 'camera behind → rear mounting when the rack has rear rails');
const freeU = iem.u;  // the IEM's old place is free now
const dh = hitMountPlane(rack(), [faceWidth(19) / 2, deviceBottomY({ ...iem, u: freeU }, rack()) + U / 2, 1500], [0, 0, -1], 'front')!;
const dt = targetAt(st().project, rack(), drop, 'front', dh.bay, dh.x, dh.y);
check(dt.ok && dt.u === freeU, `drop target U ${dt.u}, expected ${freeU} (${dt.label})`);
const id = st().placeDevice(rack().id, drop, dt.u, 'front', dt.slot, dt.bay);
check(!!id && rack().devices.some((d) => d.id === id && d.u === freeU), 'placeDevice puts the dropped device there');

// 6) rear mounting plane and rear slots are mirrored like in the rear view
if (rack().type.hasRearRails) {
  const rh = hitMountPlane(rack(), [100, 100, -5000], [0, 0, 1], 'rear')!;
  check(!!rh && rh.z < 0, 'ray from behind hits the rear mounting plane');
  const half = BUILTIN_DEVICES.find((d) => d.slots === 2 && d.heightU === 1 && d.rackStandard === 19)!;
  const left = targetAt(st().project, rack(), half, 'rear', 0, 100, 100);
  check(left.slot === 1, `rear mounting: front-view left half is slot 1 (got ${left.slot})`);
}

if (failures) { console.error(`edit3d: ${failures} problem(s)`); process.exit(1); }
console.log(`edit3d: ${ports.length} connectors, cabling, moving and dropping ok`);
