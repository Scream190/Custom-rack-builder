// Sanity check of the built-in device library. Run: npm run test:lib
// Fails when ids repeat, port names repeat within a device (cables are re-linked by name),
// a connector sticks out of its panel or two connectors on the same panel overlap.
import { BUILTIN_DEVICES } from '../src/library/devices';
import { connectorDef } from '../src/model/connectors';
import { U } from '../src/model/geometry';

const FLANGED = new Set(['xlr', 'combo', 'ethercon', 'opticalcon', 'powercon', 'true1', 'speakon']);
const errors: string[] = [];
const ids = new Set<string>();
for (const t of BUILTIN_DEVICES) {
  if (ids.has(t.id)) errors.push(`${t.id}: duplicate id`);
  ids.add(t.id);
  const names = new Set<string>();
  // boxes: ports must lie inside the drawn box
  const W = t.box ? t.box.w : (t.rackStandard === 10 ? 254 : 482.6) / t.slots;
  const H = t.box ? t.box.h : t.heightU * U - 0.8;
  const kit = !t.box && !!t.bodyWidth && t.bodyWidth < W - 1;
  const bx0 = kit ? (W - t.bodyWidth!) / 2 : 0, bx1 = kit ? bx0 + t.bodyWidth! : W;
  const rects: Record<string, [number, number, number, number, string][]> = { front: [], rear: [] };
  for (const p of t.ports) {
    if (names.has(p.name)) errors.push(`${t.id}: duplicate port name "${p.name}"`);
    names.add(p.name);
    const d = connectorDef(p.connector);
    if (d.key === 'GENERIC' && p.connector !== 'GENERIC') errors.push(`${t.id}: unknown connector ${p.connector}`);
    const hw = d.w / 2, hh = (FLANGED.has(d.shape) ? d.h + 4 : d.h) / 2;
    const lo = t.box ? 0 : kit ? bx0 : t.slots === 1 ? (p.side === 'front' ? 0 : 16) : 0, hi = t.box ? W : kit ? bx1 : t.slots === 1 ? (p.side === 'front' ? W : W - 16) : W;
    if (p.x - hw < lo - 0.5 || p.x + hw > hi + 0.5 || p.y - hh < -0.5 || p.y + hh > H + 0.5) errors.push(`${t.id}: ${p.side} "${p.name}" outside the panel (${p.x}, ${p.y})`);
    // flanges may touch, the connectors themselves must not overlap
    const ow = Math.min(hw, d.w / 2), oh = Math.min(hh, d.h / 2);
    rects[p.side].push([p.x - ow, p.y - oh, p.x + ow, p.y + oh, p.name]);
  }
  for (const side of ['front', 'rear'] as const) {
    const r = rects[side];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i], b = r[j];
      if (a[0] < b[2] - 0.6 && b[0] < a[2] - 0.6 && a[1] < b[3] - 0.6 && b[1] < a[3] - 0.6) errors.push(`${t.id}: ${side} "${a[4]}" overlaps "${b[4]}"`);
    }
  }
}
// module bays (chargers): inside the front panel, not overlapping, with choices
for (const t of BUILTIN_DEVICES) {
  const bays = t.modules ?? [];
  const W = (t.rackStandard === 10 ? 254 : 482.6) / t.slots, H = t.heightU * U - 0.8;
  bays.forEach((m, i) => {
    if (m.x < 0 || m.y < 0 || m.x + m.w > W || m.y + m.h > H) errors.push(`${t.id}: bay "${m.name}" outside the panel`);
    if (!m.options.length) errors.push(`${t.id}: bay "${m.name}" has no modules`);
    if (bays.some((o, j) => j > i && m.x < o.x + o.w && o.x < m.x + m.w && m.y < o.y + o.h && o.y < m.y + m.h)) errors.push(`${t.id}: bay "${m.name}" overlaps another bay`);
  });
}
const bayed = BUILTIN_DEVICES.filter((t) => t.modules?.length);
console.log(`module bays: ${bayed.map((t) => `${t.name} (${t.modules!.length} × ${t.modules![0].options.length} Module)`).join(', ')}`);
errors.forEach((e) => console.log('  ', e));
console.log(`${BUILTIN_DEVICES.length} device templates checked, ${errors.length} problems`);
if (errors.length) process.exit(1);
