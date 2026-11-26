/* Cable workshop: plug list, wiring (standard, unbalanced bridge, own assignment), custom cables and their link to
   rack cables, build instructions. */
import { sampleProject } from '../src/library/sample';
import { cableAssemblies, pinoutCards } from '../src/model/assembly';
import { buildSteps, cableWiring, customAssemblies, defaultMap, newCustomCable, partsOf, plugOptions } from '../src/model/cableBuild';

let failed = false;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed = true; console.error('FAIL:', msg); } };

// 1) plug list
const opts = plugOptions();
ok(opts.length > 30 && new Set(opts.map((o) => o.label)).size === opts.length, `plug list: ${opts.length} distinct plugs`);
ok(opts.some((o) => o.label.startsWith('Schuko') && o.spec.dir === 'in') && opts.some((o) => o.label.startsWith('Schuko') && o.spec.dir === 'out'), 'Schuko plug and coupler both offered');

// 2) wiring
const xj = cableWiring('XLR3F', 'JACK');
ok(!!xj.wiring && xj.wiring.wires.length === 3 && !xj.manual, 'XLR to TRS jack: three wires, standard');
const xr = cableWiring('XLR3F', 'RCA');
ok(!!xr.wiring && xr.wiring.bridges.length === 1, 'XLR to RCA: pin 3 bridged to ground');
const xn = cableWiring('XLR3F', 'RJ45');
ok(!!xn.wiring && xn.wiring.wires.length === 0 && xn.editable, 'XLR to RJ45: no standard, but an own assignment is possible');
const hd = cableWiring('HDMI', 'HDMI');
ok(!hd.wiring && !hd.editable, 'HDMI: no pin data (bought ready-made)');
const std = defaultMap('XLR3F', 'XLR3M');
ok(cableWiring('XLR3F', 'XLR3M', std).manual === false, 'standard map counts as standard');
const flipped = std.map((m) => ({ ...m, b: m.b === '2' ? '3' : m.b === '3' ? '2' : m.b }));
const fw = cableWiring('XLR3F', 'XLR3M', flipped);
ok(fw.manual && fw.wiring!.wires.some((w) => w.a === '2' && w.b === '3'), 'phase reversed: own assignment with 2 → 3');
ok(defaultMap('XLR3F', 'RJ45').length === 3, 'fallback map pin by pin');

// 3) custom cables and the link to rack cables
const p = sampleProject();
const cc = newCustomCable(p, 'Phase gedreht', { conn: 'XLR3M' }, { conn: 'XLR3M' }, 0.5);
cc.wiring = defaultMap('XLR3M', 'XLR3M').map((m) => ({ ...m, b: m.b === '2' ? '3' : m.b === '3' ? '2' : m.b }));
cc.qty = 2;
p.customCables = [cc];
const ca = customAssemblies(p);
ok(ca.length === 1 && ca[0].count === 2 && ca[0].customId === cc.id, 'custom cable as assembly');
const rack = p.racks[0];
const before = cableAssemblies(p, [rack]);
const xlr = rack.cables.filter((c) => p.cableTypes.find((t) => t.id === c.typeId)?.name.includes('XLR')).slice(0, 2);
xlr.forEach((c) => { c.customId = cc.id; });
const after = cableAssemblies(p, [rack]);
const linked = after.find((a) => a.customId === cc.id);
ok(!!linked && linked.count === 2 && linked.name === 'Phase gedreht' && after.length >= before.length, 'linked rack cables form their own group');
const cards = pinoutCards([linked!], p);
ok(cards.length === 1 && cards[0].wiring.wires.some((w) => w.a === '2' && w.b === '3'), 'pin card of linked rack cables uses the own assignment');

// 4) instructions
const net = { ...ca[0], common: { key: 'rj45', label: 'RJ45-Stecker' }, commonConn: 'RJ45', branches: [{ plug: { key: 'rj45', label: 'RJ45-Stecker' }, conn: 'RJ45', length: 2 }], customId: undefined, name: 'Patch' };
const steps = buildSteps(net, cableWiring('RJ45', 'RJ45').wiring);
ok(steps.some((s) => s.includes('T568B')) && steps.some((s) => s.includes('Kabeltester')), 'network cable steps: T568B and cable tester');
const parts = partsOf(ca[0]);
ok(parts.some((x) => /Reserve/.test(x.label) && Math.abs(x.count - 1.2) < 0.01), `material for 2 × 0,5 m plus reserve: ${parts.map((x) => `${x.count} ${x.label}`).join('; ')}`);

if (failed) { console.error('cable workshop: problems found'); process.exit(1); }
console.log(`cable workshop: ${opts.length} plugs, wiring and links ok`);
