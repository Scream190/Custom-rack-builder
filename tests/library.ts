// Sanity check of the built-in device library. Run: npm run test:lib
// Fails when ids repeat, port names repeat within a device (cables are re-linked by name),
// a connector sticks out of its panel or two connectors on the same panel overlap.
import { BUILTIN_DEVICES } from '../src/library/devices';
import { connectorDef } from '../src/model/connectors';
import { U } from '../src/model/geometry';
import { devicePorts } from '../src/model/modules';
import type { DeviceTemplate, Port } from '../src/model/types';

const FLANGED = new Set(['xlr', 'combo', 'ethercon', 'opticalcon', 'powercon', 'true1', 'speakon']);
const errors: string[] = [];
const ids = new Set<string>();
function checkPorts(t: DeviceTemplate, ports: Port[], tag: string) {
  const names = new Set<string>();
  // boxes: ports must lie inside the drawn box
  const W = t.box ? t.box.w : (t.rackStandard === 10 ? 254 : 482.6) / t.slots;
  const H = t.box ? t.box.h : t.heightU * U - 0.8;
  const kit = !t.box && !!t.bodyWidth && t.bodyWidth < W - 1;
  const bx0 = kit ? (W - t.bodyWidth!) / 2 : 0, bx1 = kit ? bx0 + t.bodyWidth! : W;
  const rects: Record<string, [number, number, number, number, string][]> = { front: [], rear: [] };
  for (const p of ports) {
    if (names.has(p.name)) errors.push(`${t.id}${tag}: duplicate port name "${p.name}"`);
    names.add(p.name);
    if (ports.filter((q) => q.id === p.id).length > 1) errors.push(`${t.id}${tag}: duplicate port id "${p.id}"`);
    const d = connectorDef(p.connector);
    if (d.key === 'GENERIC' && p.connector !== 'GENERIC') errors.push(`${t.id}${tag}: unknown connector ${p.connector}`);
    const hw = d.w / 2, hh = (FLANGED.has(d.shape) ? d.h + 4 : d.h) / 2;
    const lo = t.box ? 0 : kit ? bx0 : t.slots === 1 ? (p.side === 'front' ? 0 : 16) : 0, hi = t.box ? W : kit ? bx1 : t.slots === 1 ? (p.side === 'front' ? W : W - 16) : W;
    if (p.x - hw < lo - 0.5 || p.x + hw > hi + 0.5 || p.y - hh < -0.5 || p.y + hh > H + 0.5) errors.push(`${t.id}${tag}: ${p.side} "${p.name}" outside the panel (${p.x}, ${p.y})`);
    // flanges may touch, the connectors themselves must not overlap
    const ow = Math.min(hw, d.w / 2), oh = Math.min(hh, d.h / 2);
    rects[p.side].push([p.x - ow, p.y - oh, p.x + ow, p.y + oh, p.name]);
  }
  for (const side of ['front', 'rear'] as const) {
    const r = rects[side];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i], b = r[j];
      if (a[0] < b[2] - 0.6 && b[0] < a[2] - 0.6 && a[1] < b[3] - 0.6 && b[1] < a[3] - 0.6) errors.push(`${t.id}${tag}: ${side} "${a[4]}" overlaps "${b[4]}"`);
    }
  }
}
let cardChecks = 0;
for (const t of BUILTIN_DEVICES) {
  if (ids.has(t.id)) errors.push(`${t.id}: duplicate id`);
  ids.add(t.id);
  checkPorts(t, t.ports, '');
  // every module option fitted in every bay at once: its connectors must fit next to all others
  const opts = new Set((t.modules ?? []).flatMap((m) => m.options.filter((o) => o.ports?.length).map((o) => o.id)));
  for (const o of opts) {
    const fields = Object.fromEntries((t.modules ?? []).map((m) => [m.name, m.options.some((x) => x.id === o) ? o : '']));
    const all = devicePorts(t, { fields });
    for (const m of t.modules ?? []) for (const q of m.options.find((x) => x.id === o)?.ports ?? []) {
      const d = connectorDef(q.connector), hh = (FLANGED.has(d.shape) ? d.h + 4 : d.h) / 2;
      if (q.x - d.w / 2 < -0.5 || q.x + d.w / 2 > m.w + 0.5 || q.y - hh < -0.5 || q.y + hh > m.h + 0.5) errors.push(`${t.id} [${o}]: "${q.name}" outside its bay`);
    }
    checkPorts(t, all, ` [${o}]`);
    cardChecks++;
  }
}
// data-sheet rules: accuracy stated, connector matches what the port name says, direction matches the connector
const NAME_HINTS: [RegExp, (c: string) => boolean, string][] = [
  [/\bBNC\b/i, (c) => /BNC/.test(c), 'BNC'],
  [/\bUSB\b/i, (c) => /USB/.test(c), 'USB'],
  [/\bHDMI\b/i, (c) => /HDMI/.test(c), 'HDMI'],
  [/\betherCON\b/i, (c) => c === 'ETHERCON', 'etherCON'],
  [/\bspeakON\b|\bNL4\b|\bNL8\b/i, (c) => /SPEAKON/.test(c), 'speakON'],
  [/\bpowerCON\b/i, (c) => /POWERCON|TRUE1/.test(c), 'powerCON'],
  [/\bIEC\b/i, (c) => /IEC/.test(c), 'IEC'],
  [/\bXLR\b(?!.*TA3)/i, (c) => /XLR|COMBO/.test(c), 'XLR'],
  [/\bMADI\b/i, (c) => /BNC|SFP|LC|SC|OPTICALCON|RJ45/.test(c), 'MADI'],
  [/\bSDI\b/i, (c) => /BNC|SFP|LC/.test(c), 'SDI'],
];
for (const t of BUILTIN_DEVICES) {
  if (!t.source || !/vermessen|abgeleitet|Datenblatt|Schätzung|generisch|Generische/i.test(t.source)) errors.push(`${t.id}: source without accuracy (vermessen / abgeleitet / Datenblatt / Schätzung)`);
  for (const p of t.ports) {
    for (const [re, ok, what] of NAME_HINTS) if (re.test(p.name) && !ok(p.connector)) errors.push(`${t.id}: "${p.name}" sounds like ${what}, connector is ${p.connector}`);
    if (p.dir === 'out' && ['IEC_C14', 'POWERCON_IN', 'TRUE1_IN', 'POWERCON32_IN', 'IEC_C20'].includes(p.connector)) errors.push(`${t.id}: "${p.name}" is an output on inlet ${p.connector}`);
    if (p.dir === 'in' && ['IEC_C13', 'POWERCON_OUT', 'TRUE1_OUT', 'IEC_C19', 'SCHUKO'].includes(p.connector)) errors.push(`${t.id}: "${p.name}" is an input on outlet ${p.connector}`);
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
console.log(`module bays (${cardChecks} card fits checked): ${bayed.map((t) => `${t.name} (${t.modules!.length} × ${t.modules![0].options.length} Module)`).join(', ')}`);
errors.forEach((e) => console.log('  ', e));
console.log(`${BUILTIN_DEVICES.length} device templates checked, ${errors.length} problems`);
if (errors.length) process.exit(1);
