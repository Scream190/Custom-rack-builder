// Case designer checks. Run: npm run test:cases
import { caseBom, caseDims, caseWarnings, newCase, newDrawerInlay, packItems, ITEM_PRESETS } from '../src/model/cases';
import { sampleProject } from '../src/library/sample';
import { uid } from '../src/model/util';
import { applyBuild, rackBom, rackDims } from '../src/model/rackBuild';
import { cutoutOutline, foamStack, inlayList, caseList, newFreeInlay, outlineBox, GRIP_R } from '../src/model/inlay';

let failed = false;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed = true; console.log('  FAIL', msg); } };

// 1) packing: mixed items into a 800 × 600 case – nothing may overlap or stick into the side foam;
//    what does not fit must be reported as such
const c0 = newCase('Test');
c0.inner = { l: 800, w: 600, h: 350 };
c0.items = ITEM_PRESETS.slice(0, 12).map((p) => ({ ...p, id: uid('it-'), x: 0, y: 0, layer: 'body' as const }));
const packed = packItems(c0);
const w0 = caseWarnings(packed);
ok(!w0.some((w) => /überlappen|ragt/.test(w.text)), `packing produced: ${w0.map((w) => w.text).join('; ')}`);
const placed = packed.items.filter((i) => i.x < packed.inner.l).length;
console.log(`packing: ${placed}/${packed.items.length} items placed, ${w0.filter((w) => /passt nicht/.test(w.text)).length} reported as not fitting`);
// a set that fits easily must be placed completely
const c1 = { ...c0, items: ITEM_PRESETS.slice(0, 6).map((p) => ({ ...p, id: uid('it-'), x: 0, y: 0, layer: 'body' as const })) };
const w1 = caseWarnings(packItems(c1)).filter((w) => !/hoch/.test(w.text));
ok(w1.length === 0, `small set: ${w1.map((w) => w.text).join('; ')}`);

// 2) outer dimensions and parts list
const d = caseDims(packed);
ok(d.L === 800 + 2 * (7 + 2) && d.W === 600 + 2 * (7 + 2), `outer size ${d.L} × ${d.W}`);
const bom = caseBom(packed);
ok(bom.panels.length === 6 && bom.weight.case > 5 && bom.weight.case < 40, `parts list: ${bom.panels.length} panels, ${bom.weight.case} kg`);
ok(bom.hardware.some((h) => h.label.startsWith('Butterfly')), 'butterfly locks in the parts list');
console.log(`case: outer ${Math.round(d.L)} × ${Math.round(d.W)} × ${Math.round(d.H)} mm, ${bom.weight.case} kg empty`);

// 3) drawer inlay from the sample project's drawer
const p = sampleProject();
const rack = p.racks[0];
const drw = rack.devices.find((x) => p.templates[x.templateId]?.drawer)!;
const inlay = newDrawerInlay('Einlage', p.templates[drw.templateId], { rackId: rack.id, deviceId: drw.id }, drw.contents ?? []);
ok(inlay.kind === 'drawer' && inlay.items.length === (drw.contents ?? []).filter((x) => x.text.trim()).length, 'drawer inlay: one cut-out per contents line');
ok(inlay.inner.h < p.templates[drw.templateId].heightU * 44.45, 'drawer inlay height fits the drawer');
console.log(`drawer inlay: ${inlay.items.length} cut-outs, inner ${inlay.inner.l} × ${inlay.inner.w} × ${inlay.inner.h} mm, warnings ${caseWarnings(inlay).length}`);

// 4) inlay designer helpers
const it0 = { id: 'a', name: 'Test', l: 100, w: 60, h: 30, x: 50, y: 40, layer: 'body' as const };
const plain = outlineBox(cutoutOutline(it0));
ok(Math.abs(plain.x0 - 50) < 0.01 && Math.abs(plain.x1 - 150) < 0.01 && Math.abs(plain.y0 - 40) < 0.01 && Math.abs(plain.y1 - 100) < 0.01, `plain outline box ${JSON.stringify(plain)}`);
const gripped = outlineBox(cutoutOutline({ ...it0, grips: ['front', 'right'] }));
ok(Math.abs(gripped.y0 - (40 - GRIP_R)) < 0.01 && Math.abs(gripped.x1 - (150 + GRIP_R)) < 0.01 && Math.abs(gripped.y1 - 100) < 0.01, `grips extend the outline ${JSON.stringify(gripped)}`);
const round = outlineBox(cutoutOutline({ ...it0, shape: 'circle' as const, l: 80, w: 80 }));
ok(Math.abs(round.x1 - round.x0 - 80) < 0.5, 'round cut-out spans its diameter');
const st70 = foamStack(70, 'PE');
ok(st70.reduce((a, b) => a + b, 0) >= 70 && st70[0] === 50, `PE stack for 70 mm: ${st70.join('+')}`);
const pj = sampleProject();
pj.cases = [newCase('C'), newFreeInlay('F'), inlay];
ok(inlayList(pj).length === 3 && caseList(pj).length === 1 && inlayList(pj)[0].kind !== 'case', 'inlay list: drawers and free inlays first, cases last');
const free = newFreeInlay('F2');
free.items = [{ ...it0, id: 'b', x: 0, y: 0 }];
const fb = caseBom(packItems(free));
ok(fb.foam.length === 2 && !fb.foam.some((f) => /Randschaum/.test(f.name)) && fb.weight.foam > 0, `free inlay parts: ${fb.foam.map((f) => f.name).join(', ')}`);
console.log(`inlays: outline with grips ok, PE stack 70 mm = ${st70.join(' + ')} mm`);

// 5) rack designer
const base = sampleProject().racks[0].type;
const caseT = applyBuild({ ...base, kind: 'case', bays: undefined }, { frontLid: 100, rearLid: 80, castors: 0 });
const dCase = rackDims(caseT);
ok(Math.abs(dCase.D - (dCase.bodyD + dCase.lidF + dCase.lidR)) < 0.01 && dCase.lidF === 100 + dCase.wall, `rack case depth adds up: ${dCase.D}`);
ok(caseT.outer.w === Math.round(dCase.W) && caseT.weight! > 10 && caseT.weight! < 80, `rack case outer ${JSON.stringify(caseT.outer)}, ${caseT.weight} kg`);
const shockT = applyBuild({ ...caseT, kind: 'shockmount' });
ok(rackDims(shockT).W > dCase.W && rackDims(shockT).H > dCase.H, 'shockmount is bigger than a plain rack case');
const noLids = applyBuild(caseT, { frontLid: 0, rearLid: 0 });
ok(rackDims(noLids).D === rackDims(noLids).bodyD && !rackBom(noLids).hardware.some((h) => /Butterfly/.test(h.label)), 'no lids: no lid depth, no latches');
const withCastors = applyBuild(caseT, { castors: 4, castorSize: 100 });
ok(rackDims(withCastors).H === dCase.H + 125, 'castors add their height');
const rails = rackBom({ ...caseT, hasRearRails: true }).hardware.find((h) => /Rackschiene/.test(h.label));
ok(rails?.count === 4, 'four rails with rear rails');
console.log(`rack designer: case ${caseT.outer.w} × ${caseT.outer.h} × ${caseT.outer.d} mm, ${caseT.weight} kg; shockmount ${shockT.outer.w} × ${shockT.outer.h} × ${shockT.outer.d} mm`);

if (failed) { console.error('case designer: problems found'); process.exit(1); }
console.log('case designer: ok');
