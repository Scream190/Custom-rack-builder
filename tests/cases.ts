// Case designer checks. Run: npm run test:cases
import { addDivider, dimChains, dividerGaps, dividerRange, moveDivider, spreadDividers, DIVIDER_T, applyCaseType, bars, caseBom, caseBoxes, caseDims, caseSeams, caseWarnings, CASE_TYPES, drawerInner, faceToOuter, HARDWARE, hardwareInstances, mirrorHardware, moveHardware, newCase, snapHardware, newDrawerInlay, outerToFace, packItems, pinHardware, placeHardware, pushPull, removeSelection, shellSize, snapToSeam, splitAt, ITEM_PRESETS } from '../src/model/cases';
import { deleteStep, describeSteps, isRolledBack, MAX_STEPS, recordStep, setMarker, timelineMarker, toggleStep } from '../src/model/timeline';
import { brokenExprs, evalExpr, isFormula, setFieldExpr, setParams, unlinkOverridden } from '../src/model/params';
import { hardwareClashes } from '../src/model/cases';
import { HARDWARE_PARTS, PROFILES, profileBySku, profilesFor, rackStripLength, rackStripSku } from '../src/library/caseHardware';
import { BUILTIN_DEVICES } from '../src/library/devices';
import { CUTOUT_KINDS, CUTOUT_LIBRARY } from '../src/library/cutouts';
import { inlayContainer } from '../src/model/inlay';
import { sampleProject } from '../src/library/sample';
import { uid } from '../src/model/util';
import { applyBuild, blockClashes, blockGap, rackBom, rackDims } from '../src/model/rackBuild';
import { portPosition, rackDepth } from '../src/model/geometry';
import { cutoutOutline, filletPolygon, foamStack, inlayList, caseList, newFreeInlay, normalizeOutline, outlineBox, rectOutline, shapeOutline, SHAPE_LABELS, GRIP_R, type ShapeKind } from '../src/model/inlay';

let failed = false;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed = true; console.log('  FAIL', msg); } };

// 1) packing: mixed items into a 800 × 600 case – nothing may overlap or stick into the side foam;
//    what does not fit must be reported as such
const c0 = newCase('Test');
c0.inner = { l: 800, w: 600, h: 350 };
c0.items = ITEM_PRESETS.slice(0, 12).map(({ shape: _s, group: _g, ...p }) => ({ ...p, id: uid('it-'), x: 0, y: 0, layer: 'body' as const }));
const packed = packItems(c0);
const w0 = caseWarnings(packed);
ok(!w0.some((w) => /überlappen|ragt/.test(w.text)), `packing produced: ${w0.map((w) => w.text).join('; ')}`);
const placed = packed.items.filter((i) => i.x < packed.inner.l).length;
console.log(`packing: ${placed}/${packed.items.length} items placed, ${w0.filter((w) => /passt nicht/.test(w.text)).length} reported as not fitting`);
// a set that fits easily must be placed completely
const c1 = { ...c0, items: ITEM_PRESETS.slice(0, 6).map(({ shape: _s, group: _g, ...p }) => ({ ...p, id: uid('it-'), x: 0, y: 0, layer: 'body' as const })) };
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

// 6) rack housing with several planes: two 12 U bays stacked, a 3 U bay on top set back and shallower
const tiers = applyBuild({ ...caseT, bays: [
  { heightU: 12, rackStandard: 19, x: 0, y: 0 },
  { heightU: 12, rackStandard: 19, x: 0, y: 12 * 44.45 + 40 },
  { heightU: 3, rackStandard: 19, x: 0, y: 24 * 44.45 + 40 + blockGap(applyBuild(caseT, { separate: true })), z: 150, depth: 250 },
] });
const one = rackDims(tiers);
ok(one.blocks.length === 1 && one.shelves.length === 1 && rackBom(tiers).panels.some((x) => x.name.startsWith('Arbeitsplatte')), 'default: one case with a work surface under the set-back bay');
const dt = rackDims(applyBuild(tiers, { separate: true }));
ok(dt.blocks.length === 2 && blockClashes(dt).length === 0, `tiers: ${dt.blocks.length} blocks, clashes ${blockClashes(dt).length}`);
const top = dt.blocks.find((k) => k.bays.includes(2))!, main = dt.blocks.find((k) => k.bays.includes(0))!;
ok(Math.abs(top.z - main.z - 150) < 0.01 && top.y >= main.y + main.caseH - 0.5, `top block set back by 150 mm and above the main block (z ${top.z} vs ${main.z})`);
ok(dt.D === Math.max(main.z + main.D, top.z + top.D) && rackDepth(tiers) === 450, 'overall depth from the blocks, rack depth from the bays');
const tooClose = applyBuild({ ...applyBuild(tiers, { separate: true }), bays: tiers.bays!.map((x, i) => (i === 2 ? { ...x, y: 24 * 44.45 + 45 } : x)) });
ok(blockClashes(rackDims(tooClose)).length > 0, 'a set-back bay placed too close is reported');
ok(rackBom(applyBuild(tiers, { separate: true })).panels.some((x) => x.name.startsWith('Block 2')), 'parts list per body when separate');
// devices in the set-back bay sit at its depth
const pj2 = sampleProject();
const r2 = { ...pj2.racks[0], type: tiers, devices: pj2.racks[0].devices.map((x, i) => (i === 0 ? { ...x, bay: 2, u: 1 } : x)) };
const dev0 = r2.devices[0], tpl0 = pj2.templates[dev0.templateId];
const pfront = tpl0.ports.find((q) => q.side === 'front');
if (pfront) ok(Math.abs(portPosition(r2, dev0, tpl0, pfront).z - 150) < 0.01, 'front port of a set-back bay lies 150 mm back');
console.log(`rack tiers: one case with ${one.shelves.length} work surface, separate: ${dt.blocks.length} bodies, outer ${tiers.outer.w} × ${tiers.outer.h} × ${tiers.outer.d} mm, ${tiers.weight} kg`);

// 7) own contours: rounding, normalising, rotation and the shape templates
const area = (q: [number, number][]) => Math.abs(q.reduce((a, [x, y], i) => { const [x2, y2] = q[(i + 1) % q.length]; return a + x * y2 - x2 * y; }, 0) / 2);
const sq = filletPolygon(rectOutline(100, 100, 50));
ok(Math.abs(area(sq) - Math.PI * 50 * 50) < 60, `square with full radius is a circle (area ${Math.round(area(sq))})`);
ok(Math.abs(area(filletPolygon(rectOutline(100, 60, 0))) - 6000) < 0.01, 'sharp rectangle keeps its area');
const nz = normalizeOutline([{ x: 40, y: 25 }, { x: 140, y: 25 }, { x: 90, y: 105 }]);
ok(nz.dx === 40 && nz.dy === 25 && nz.l === 100 && nz.w === 80 && nz.pts[0].x === 0, 'contour normalised to its bounding box');
const own = { id: 'o', name: 'Kontur', l: 100, w: 80, h: 20, x: 30, y: 40, layer: 'body' as const, outline: nz.pts };
const ob = outlineBox(cutoutOutline(own)), obr = outlineBox(cutoutOutline({ ...own, rot: true }));
ok(ob.x0 === 30 && ob.x1 === 130 && ob.y0 === 40 && ob.y1 === 120, `contour placed at the item position (${JSON.stringify(ob)})`);
ok(Math.abs(obr.x1 - obr.x0 - 80) < 0.01 && Math.abs(obr.y1 - obr.y0 - 100) < 0.01 && obr.x0 === 30 && obr.y0 === 40, 'rotated contour swaps length and width');
for (const k of Object.keys(SHAPE_LABELS) as ShapeKind[]) {
  const q = filletPolygon(shapeOutline(k, 260, 90)), b = outlineBox(q);
  ok(b.x0 >= -0.01 && b.y0 >= -0.01 && b.x1 <= 260.01 && b.y1 <= 90.01 && area(q) > 0.15 * 260 * 90, `template ${k} stays inside its box and has a body`);
}
ok(ITEM_PRESETS.filter((p) => p.shape).length >= 15 && ITEM_PRESETS.every((p) => p.group), 'presets carry groups and most of them a contour');
const mic = filletPolygon(shapeOutline('mic', 260, 55));
ok(area(mic) < 0.75 * 260 * 55, 'microphone contour is narrower than its rectangle');
console.log(`contours: ${Object.keys(SHAPE_LABELS).length} templates, microphone ${Math.round((area(mic) / (260 * 55)) * 100)} % of its rectangle`);

// 8) drawer templates with the manufacturer's inner size: inlay without a placed drawer
const ah4 = BUILTIN_DEVICES.find((t) => t.id === 'ah-87404')!;
const di = newDrawerInlay('Test', ah4, null, []);
ok(di.kind === 'drawer' && !di.drawer && di.drawerTemplate === 'ah-87404', 'drawer inlay from a template has no rack link but remembers the template');
ok(di.inner.l === 401 && di.inner.w === 373 && di.inner.h === 175, `inner size from the data sheet (${di.inner.l} × ${di.inner.w} × ${di.inner.h})`);
ok(inlayContainer(sampleProject(), di) === 'Schublade Adam Hall 87404 Rackschublade 4 HE', `container label: ${inlayContainer(sampleProject(), di)}`);
const drawerTpls = BUILTIN_DEVICES.filter((t) => t.drawer);
ok(drawerTpls.filter((t) => t.drawerInner).every((t) => t.drawerInner!.h < t.heightU * 44.45 && t.drawerInner!.l <= 420), 'drawer inner sizes fit their height and the 19" opening');
const gen2 = BUILTIN_DEVICES.find((t) => t.id === 'gen-drawer2')!;
ok(drawerInner(gen2).h > 0 && !gen2.drawerInner, 'generic drawers keep the estimated inner size');
console.log(`drawer templates: ${drawerTpls.length} (${drawerTpls.filter((t) => t.drawerInner).length} with manufacturer inner size)`);

// 9) cut-out library: accessories of the 19" gear
const cids = new Set<string>();
for (const t of CUTOUT_LIBRARY) {
  ok(!cids.has(t.id), `cut-out id ${t.id} unique`); cids.add(t.id);
  ok(t.l > 0 && t.w > 0 && t.h > 0 && t.l >= t.w * 0.9 - 1 || t.kind === 'Headset / Lavalier' || t.kind === 'Ladegerät' || t.kind === 'In-Ear-Hörer' || t.kind === 'Antenne' || t.kind === 'Mikrofon', `${t.id}: sensible size`);
  const b = outlineBox(filletPolygon(t.outline));
  ok(b.x0 >= -0.5 && b.y0 >= -0.5 && Math.abs(b.x1 - t.l) < 1 && Math.abs(b.y1 - t.w) < 1, `${t.id}: contour fills its box (${Math.round(b.x1)} × ${Math.round(b.y1)} vs ${t.l} × ${t.w})`);
  ok(/^(Datenblatt|Schätzung)/.test(t.source), `${t.id}: source states accuracy`);
}
for (const k of CUTOUT_KINDS) ok(CUTOUT_LIBRARY.some((t) => t.kind === k), `cut-outs contain ${k}`);
// every brand with 19" wireless receivers or IEM transmitters in the library has matching transmitters/receivers
const wirelessBrands = [...new Set(BUILTIN_DEVICES.filter((t) => /UHF Empfänger|IEM Sender/.test(t.category) && t.manufacturer !== 'Generisch').map((t) => t.manufacturer))];
const covered = wirelessBrands.filter((m) => CUTOUT_LIBRARY.some((t) => t.man === m && /sender|Empfänger/.test(t.kind)));
console.log(`cut-out library: ${CUTOUT_LIBRARY.length} templates (${CUTOUT_LIBRARY.filter((t) => t.source.startsWith('Datenblatt')).length} after data sheet), wireless brands covered ${covered.length}/${wirelessBrands.length}${covered.length < wirelessBrands.length ? ` (missing: ${wirelessBrands.filter((m) => !covered.includes(m)).join(', ')})` : ''}`);

// case types (construction presets after common case design software), parts library
{
  const base = newCase('Typen');
  base.inner = { l: 700, w: 500, h: 600 };
  const results: string[] = [];
  for (const ty of CASE_TYPES) {
    const c = { ...base, ...applyCaseType(base, ty.id) } as typeof base;
    const d = caseDims(c), b = caseBom(c), boxes = caseBoxes(c);
    const t = 7 + 2;
    ok(d.L === 700 + 2 * t && d.W === 500 + 2 * t, `${ty.id}: outer size ${d.L} × ${d.W} (doors lie inside the inner size)`);
    const w = caseWarnings(c);
    ok(w.length === 0, `${ty.id}: warnings ${w.map((x) => x.text).join('; ')}`);
    // shells tile the outer box without overlap
    const vol = boxes.reduce((s, bx) => s + (bx.x1 - bx.x0) * (bx.y1 - bx.y0) * (bx.z1 - bx.z0), 0);
    const outer = d.L * d.W * (d.H - d.castorH);
    ok(Math.abs(vol - outer) / outer < 1e-6, `${ty.id}: shells fill the case (${Math.round(vol / 1e6)} vs ${Math.round(outer / 1e6)} dm³)`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], o = boxes[j];
      const ov = Math.min(a.x1, o.x1) - Math.max(a.x0, o.x0) > 0.5 && Math.min(a.y1, o.y1) - Math.max(a.y0, o.y0) > 0.5 && Math.min(a.z1, o.z1) - Math.max(a.z0, o.z0) > 0.5;
      ok(!ov, `${ty.id}: ${a.id} overlaps ${o.id}`);
    }
    // every seam gets latches, the hardware names the seam it bridges
    for (const bx of boxes.filter((x) => x.role === 'door')) ok(c.hardware.some((h) => h.seam === bx.side && h.kind === 'butterfly'), `${ty.id}: latches on the ${bx.side} door seam`);
    ok(b.profiles.some((p) => /Schließprofil/.test(p.name)) === boxes.length > 1, `${ty.id}: closing profile only with more than one shell`);
    ok(b.profiles.every((p) => !p.pieces || Math.abs(p.pieces.reduce((s, x) => s + x, 0) / 1000 - p.length * (p.name.endsWith('(Paar)') ? 2 : 1)) < 0.05), `${ty.id}: cut lengths add up to the profile length`);
    ok(!!b.sheets && b.sheets.count >= 1, `${ty.id}: sheet estimate`);
    results.push(`${ty.label} ${boxes.length} Teile ${b.weight.case} kg`);
  }
  const triple = { ...base, ...applyCaseType(base, 'triple-door') } as typeof base;
  const balls = caseBom(triple).hardware.find((h) => h.label === 'Kugelecke')?.count;
  ok(balls === 12, `triple case: 12 ball corners (8 on the doors, 4 on the lid), got ${balls}`);
  const clam = { ...base, ...applyCaseType(base, 'clamshell') } as typeof base;
  ok(caseBoxes(clam).filter((b) => b.role === 'lid').length === 2 && caseSeams(caseBoxes(clam)).length === 3, 'clamshell: two hood halves, three seams (two to the base, one between the halves)');
  const drawerCase = { ...base, ...applyCaseType(base, 'drawer-case') } as typeof base;
  const db = caseBom(drawerCase);
  ok((drawerCase.drawers?.length ?? 0) >= 3 && db.hardware.some((h) => h.sku && /^R24\d\dZ$/.test(h.sku)), `drawer case: drawers on Penn Elcom slides (${db.hardware.map((h) => h.sku).filter(Boolean).join(', ')})`);
  ok(caseWarnings({ ...drawerCase, drawers: [{ h: 400 }, { h: 400 }] }).some((w) => /Schubladen zusammen/.test(w.text)), 'drawers higher than the body are reported');
  // a lid case without doors keeps the old geometry exactly
  const plain = newCase('Alt');
  ok(caseBoxes(plain).length === 2 && caseBom(plain).panels.length === 6, 'plain lid case: base and lid, six panel sizes as before');
  // tongue and groove closing profile gives both halves, an edge profile from the library its part number
  const tg = { ...plain, parts: { closing: '3018', edge: 'E2390' } };
  const tb = caseBom(tg);
  ok(tb.profiles.some((p) => p.sku === '3018') && tb.profiles.some((p) => p.sku === '3019') && tb.profiles.some((p) => p.sku === 'E2390'), `tongue and groove pair and edge profile by part number: ${tb.profiles.map((p) => p.sku).join(', ')}`);
  ok(caseWarnings({ ...tg, panel: 12 }).some((w) => /Profil E2390/.test(w.text)), 'a profile that does not take the panel is reported');
  ok(profilesFor('double', 7).every((p) => p.panel![0] <= 7 && p.panel![1] >= 7) && profilesFor('double', 7).length >= 5, 'double angles are filtered by panel thickness');
  ok(PROFILES.filter((p) => p.mate).every((p) => profileBySku(p.mate)?.mate === p.sku), 'every tongue has its groove and back');
  ok(rackStripLength(12) === 536.6 && rackStripLength(14) === 625.5 && rackStripSku(13) === 'R0863-14', 'rack strip length 44.45 mm per unit + 3.2 mm');
  ok(bars([3800, 190, 3800], 4000) === 2 && bars([3800, 3800, 300], 4000) === 3 && bars([1000, 1000, 1000], 4000) === 1, 'stock bars: first fit decreasing with saw cut');
  ok(HARDWARE_PARTS.every((h) => !h.as || h.as.every((k) => k in HARDWARE)), 'library parts map to hardware kinds of the designer');
  console.log(`case types: ${results.join(' | ')}`);
}

// ------------------------------------------------------------------ direct editing (3D editor)
{
  const c = newCase('Edit');
  const t = c.panel + 2;
  // face coordinates round-trip
  for (const face of ['front', 'back', 'left', 'right', 'top'] as const) {
    const p = faceToOuter(c, face, 123, 45), q = outerToFace(c, face, ...p);
    ok(Math.abs(q.u - 123) < 1e-6 && Math.abs(q.z - 45) < 1e-6, `face coordinates round-trip on ${face}`);
  }
  // pinning keeps every position, moving a lid latch keeps it on the seam
  const inst = hardwareInstances(c);
  const fi = c.hardware.findIndex((h) => h.kind === 'butterfly' && h.face === 'front');
  const pinned = { ...c, hardware: pinHardware(c, fi) };
  const same = hardwareInstances(pinned).filter((x) => x.i === fi).every((x, k) => { const y = inst.filter((z) => z.i === fi)[k]; return Math.abs(x.u - y.u) < 1 && Math.abs(x.z - y.z) < 1; });
  ok(same && !!pinned.hardware[fi].at, 'pinning a hardware row keeps the positions');
  const moved = { ...c, hardware: moveHardware(c, fi, 0, 150, 30) };
  const m0 = hardwareInstances(moved).find((x) => x.i === fi && x.k === 0)!;
  const lidZ = caseBoxes(c).find((b) => b.role === 'lid')!.z0;
  ok(Math.round(m0.u) === 150 && m0.z === lidZ, `a lid latch slides along the seam only (u ${m0.u}, z ${m0.z})`);
  const hi = c.hardware.findIndex((h) => h.kind === 'handle-recessed');
  const handle = hardwareInstances({ ...c, hardware: moveHardware(c, hi, 0, 200, 120) }).find((x) => x.i === hi && x.k === 0)!;
  ok(handle.u === 200 && handle.z === 120, 'a handle moves freely on its face');
  // placing: a latch snaps to the lid seam, a label stays where clicked
  const placed = placeHardware(c, 'butterfly-small', 'front', 300, lidZ - 25)!;
  ok(placed.length === c.hardware.length + 1 && placed.at(-1)!.at![0].z === Math.round(lidZ), 'a placed latch snaps to the lid seam');
  ok(placeHardware(c, 'stack-cup', 'front', 100, 100) === null, 'hardware is not placed on a face it cannot sit on');
  const lab = placeHardware(c, 'label', 'right', 100, 80)!;
  ok(hardwareInstances({ ...c, hardware: lab }).some((x) => x.kind === 'label' && x.face === 'right' && x.u === 100 && x.z === 80), 'a placed label keeps its position');
  // push/pull
  ok(pushPull(c, 'base', 'right', 47).inner?.l === c.inner.l + 45, 'pulling the right face lengthens the case (5 mm steps)');
  ok(pushPull(c, 'base', 'right', 47, 1).inner?.l === c.inner.l + 47, 'pulling with 1 mm steps');
  ok(pushPull(c, 'base', 'top', 20).lidH === c.lidH - 20, 'pulling the top of the base raises the lid seam');
  const lt = pushPull(c, 'lid', 'top', 30);
  ok(lt.inner?.h === c.inner.h + 30 && lt.lidH === c.lidH + 30, 'pulling the lid top makes the lid deeper');
  ok(pushPull(c, 'lid', 'bottom', 10).lidH === c.lidH + 10, 'pulling the lid underside lowers the seam');
  ok(pushPull(c, 'base', 'front', -10000).inner?.w === 50, 'push stops at the minimum size');
  // splitting: a vertical click near the left end of the front adds a left door, a horizontal one sets the lid seam
  const { L, H } = shellSize(c);
  const sv = splitAt(c, 'front', 200, 0, 100, true)!;
  ok(sv.doors?.left === Math.round((200 - t) / 5) * 5 && caseBoxes({ ...c, ...sv }).some((b) => b.id === 'door-left'), `vertical split near the left end adds a left door (${sv.doors?.left} mm)`);
  ok(splitAt(c, 'top', L / 2, 100, H, true)?.lidSplit === true, 'vertical split in the middle of the lid splits the lid');
  const crate = { ...c, lidKind: 'none' as const, lidH: 0 };
  const sh = splitAt(crate, 'front', 100, 0, 200, false)!;
  const after = { ...crate, ...sh };
  const seamZ = caseBoxes(after).find((b) => b.role === 'lid')!.z0;
  ok(sh.lidKind === 'removable' && Math.abs(seamZ - 200) <= 5, `horizontal split adds a lid with its seam where clicked (${seamZ})`);
  // seams of a door case: latches snap to the door seam on the side faces
  const door = { ...c, ...sv } as typeof c;
  const s = snapToSeam(door, 'back', shellSize(door).L - (sv.doors!.left + t) - 10, 60);
  ok(s?.seam === 'left', `snap on the back near the door picks the door seam (${s?.seam})`);
  // removing
  const r1 = removeSelection(c, `hw:${fi}:0`)!;
  ok(r1.hardware![fi].count === c.hardware[fi].count - 1, 'deleting one spread piece lowers the count');
  ok(removeSelection(c, `hw:${fi}`)!.hardware!.length === c.hardware.length - 1, 'deleting a row');
  ok(removeSelection(door, 'part:door-left')!.doors?.left === undefined, 'deleting a door');
  ok(removeSelection(c, 'part:lid')!.lidKind === 'none' && removeSelection(c, 'part:base') === null, 'deleting the lid, the base stays');
  ok(removeSelection({ ...c, lidSplit: true }, 'part:lid2')!.lidSplit === undefined, 'deleting a lid half joins the halves');
  // snapping: middle of the face, mirror image of the other piece, grid
  const span = shellSize(c).L;
  ok(snapHardware(c, fi, 0, span / 2 + 4, 33).guide === 'mitte' && snapHardware(c, fi, 0, span / 2 + 4, 33).u === span / 2, 'snap to the middle of the face');
  const other = hardwareInstances(c).find((x) => x.i === fi && x.k === 1)!;
  const sm = snapHardware(c, fi, 0, span - other.u + 3, 50);
  ok(sm.guide === 'symmetrisch' && Math.abs(sm.u - (span - other.u)) < 1e-6, 'snap to the mirror image of the other piece');
  const sg = snapHardware(c, fi, 0, 101.7, 47.2);
  ok(!sg.guide && sg.u === 100 && sg.z === 45, `snap to the 5 mm grid (${sg.u}, ${sg.z})`);
  ok(snapHardware(c, fi, 0, 101.7, 47.2, 1).u === 102, 'snap to 1 mm with Ctrl');
  // mirroring a hand-placed handle to the back keeps its position seen from the front
  const withLab = { ...c, hardware: placeHardware(c, 'label', 'front', 200, 80)! };
  const li = withLab.hardware.length - 1;
  const mir = mirrorHardware(withLab, li)!;
  const back = hardwareInstances({ ...withLab, hardware: mir }).find((x) => x.i === mir.length - 1)!;
  const pf = faceToOuter(withLab, 'front', 200, 80), pb = faceToOuter(withLab, 'back', back.u, back.z);
  ok(back.face === 'back' && Math.abs(pf[0] - pb[0]) < 1 && pb[2] === 80, `mirrored label sits at the same x on the back (${pf[0]} / ${pb[0]})`);
  ok(mirrorHardware(c, c.hardware.findIndex((h) => h.kind === 'stack-cup')) === null, 'top hardware has no opposite side');
  // shelves and walls: placing, gaps, dragging with snap to the middle, spreading, deleting
  const body = caseDims(c).bodyInner;
  const shf = { ...c, dividers: addDivider(c, 'z', 100) };
  ok(shf.dividers[0].pos === 100 && dividerRange(c, 'z')[1] === body, 'a shelf sits at the clicked height, range = body height');
  const [below, above] = dividerGaps(shf, 0);
  ok(below === Math.round(100 - DIVIDER_T / 2) && above === Math.round(body - 100 - DIVIDER_T / 2), `clear space under and over a shelf (${below} / ${above})`);
  const mv = moveDivider(shf, 0, body / 2 + 3);
  ok(mv.guide === 'mitte' && mv.pos === Math.round((body / 2) * 10) / 10, 'a shelf snaps to the middle of its space');
  ok(moveDivider(shf, 0, 63.4).pos === 65 && moveDivider(shf, 0, 63.4, 1).pos === 63, 'grid of 5 mm, 1 mm with Ctrl');
  ok(moveDivider(shf, 0, -50).pos === 10 && moveDivider(shf, 0, 99999).pos === body - 10, 'a shelf stays inside the body');
  const two = { ...shf, dividers: addDivider(shf, 'z', 120) };
  const sp = spreadDividers(two, 'z');
  const g = (cc: typeof c, i: number) => dividerGaps(cc, i);
  const spc = { ...two, dividers: sp };
  const gs = [g(spc, 0), g(spc, 1)].flat();
  ok(Math.max(...gs) - Math.min(...gs) <= 1, `spreading gives equal clear spaces (${gs.join(', ')})`);
  const walls = addDivider(c, 'x', 50);
  ok(walls[0].axis === 'x' && removeSelection({ ...c, dividers: walls }, 'div:0')!.dividers!.length === 0, 'a wall is added and deleted');
  ok(addDivider(door, 'y', 0)[0].pos >= sv.doors!.left! + 10, 'a crosswise wall stays out of the door');
  // chain dimensions: base and lid up the height, door along the length, totals at the ends
  const dc = dimChains(c);
  const dd0 = caseDims(c);
  ok(dc.L[0] === 0 && Math.round(dc.L[dc.L.length - 1]) === Math.round(dd0.L) && dc.H.length === (dd0.castorH ? 4 : 3) && Math.round(dc.H[dc.H.length - 1]) === Math.round(dd0.H), `outer chains: ${dc.L.join('/')} | ${dc.H.join('/')}`);
  const rolling = { ...c, hardware: [...c.hardware, { kind: 'castor' as const, face: 'bottom' as const, count: 2 }, { kind: 'castor-braked' as const, face: 'bottom' as const, count: 2 }] };
  const dr = dimChains(rolling);
  ok(dr.castorH > 0 && dr.H.length === 4 && dr.H[1] === dr.castorH, `castors get their own segment in the height chain (${dr.H.join('/')})`);
  const dcd = dimChains(door);
  ok(dcd.L.length === 3 && Math.round(dcd.L[1]) === Math.round(sv.doors!.left! + t), `a left door splits the length chain (${dcd.L.join('/')})`);
  console.log(`3D editor: push/pull, split, place, move, snap, mirror, shelves, dimensions, delete ok`);
}

// ------------------------------------------------------------------ design history (timeline)
{
  let c = newCase('History');
  const l0 = c.inner.l, h0 = c.inner.h;
  let now = 1000;
  const rec = (patch: Partial<typeof c>, key?: string, dt = 5000) => { now += dt; c = recordStep(c, patch, key, now); };
  rec({ inner: { ...c.inner, l: 700 } });
  rec({ dividers: addDivider(c, 'z', 80) });
  rec({ inner: { ...c.inner, h: 320 } });
  ok(c.timeline!.steps.length === 3 && c.inner.l === 700 && c.inner.h === 320 && c.dividers.length === 1, 'three edits make three steps');
  ok(describeSteps(c).map((s) => s.label).join(' | ') === 'Länge innen 700 mm | Fachboden gesetzt | Höhe innen 320 mm', `step names: ${describeSteps(c).map((s) => s.label).join(' | ')}`);
  // typing into the same field within 1.5 s and one mouse drag merge into one step
  rec({ inner: { ...c.inner, h: 330 } }, 'case:x:inner', 100);
  rec({ inner: { ...c.inner, h: 340 } }, 'case:x:inner', 100);
  ok(c.timeline!.steps.length === 4 && describeSteps(c)[3].label === 'Höhe innen 340 mm', 'continued typing merges into one step');
  rec({ dividers: [{ ...c.dividers[0], pos: 90 }] }, 'drag:1', 3000);
  rec({ dividers: [{ ...c.dividers[0], pos: 100 }] }, 'drag:1', 3000);
  ok(c.timeline!.steps.length === 5 && describeSteps(c)[4].label === 'Fachboden verschoben' && c.dividers[0].pos === 100, 'a slow drag is still one step');
  // roll back: marker after step 1 shows the state after the first edit
  const back = setMarker(c, 1);
  ok(back.inner.l === 700 && back.inner.h === h0 && back.dividers.length === 0 && isRolledBack(back) && timelineMarker(back) === 1, 'rolling back to step 1');
  ok(setMarker(back, 5).inner.h === 340 && setMarker(back, 5).dividers[0].pos === 100 && !isRolledBack(setMarker(back, 5)), 'playing to the end restores everything');
  // editing while rolled back inserts at the marker, later steps replay on top
  let mid = recordStep(back, { inner: { ...back.inner, w: 450 } }, undefined, now + 9000);
  ok(mid.timeline!.steps.length === 6 && timelineMarker(mid) === 2 && mid.inner.w === 450 && mid.inner.h === h0, 'an edit while rolled back is inserted at the marker');
  mid = setMarker(mid, 6);
  ok(mid.inner.w === 450 && mid.inner.h === 340 && mid.inner.l === 700 && mid.dividers[0].pos === 100, 'later steps replay on top of the inserted one');
  // suppress and delete: the shelf step off -> the later move has nothing to move (no effect), shelf gone
  const off = toggleStep(c, 1);
  ok(off.dividers.length === 0 && off.inner.h === 340 && describeSteps(off)[4].effective === false, 'suppressing the shelf: shelf gone, the later move has no effect');
  ok(toggleStep(off, 1).dividers[0].pos === 100, 'activating it again brings the shelf back where it was moved to');
  const del = deleteStep(c, 0);
  ok(del.inner.l === l0 && del.inner.h === 340 && del.timeline!.steps.length === 4, 'deleting the first step keeps the later ones');
  // edits made outside the history become a step first, nothing is lost
  const ext = { ...c, lidH: 80 };
  const after = recordStep(ext, { inner: { ...ext.inner, l: 720 } }, undefined, now + 20000);
  ok(after.lidH === 80 && after.inner.l === 720 && after.timeline!.steps.length === 7, 'an outside change is kept as its own step');
  // untracked fields (name, foam) do not make steps, the history stays bounded
  ok(recordStep(c, { name: 'X' }, undefined, now).timeline!.steps.length === 5, 'renaming makes no step');
  let big = newCase('Big');
  for (let k = 0; k < MAX_STEPS + 15; k++) big = recordStep(big, { inner: { ...big.inner, l: 600 + k } }, undefined, 1000 + k * 5000);
  ok(big.timeline!.steps.length === MAX_STEPS && big.inner.l === 600 + MAX_STEPS + 14 && setMarker(big, 0).inner.l === 614, `old steps fold into the base (${setMarker(big, 0).inner.l})`);
  console.log(`timeline: ${c.timeline!.steps.length} steps, roll back, insert, suppress, delete, merge ok`);
}

// ------------------------------------------------------------------ parameters, formulas, interference check
{
  const P = [{ name: 'Geraet', value: 482 }, { name: 'Polster', value: 20 }];
  ok(evalExpr('Geraet + 2 * Polster', P) === 522 && evalExpr('=(10+5)*2', P) === 30 && evalExpr('max(Geraet, 500)', P) === 500 && evalExpr('12,5 * 2') === 25, 'formulas: + - * / ( ), names, functions, decimal comma');
  ok(evalExpr('Geraet +', P) === null && evalExpr('alert(1)', P) === null && evalExpr('Unbekannt * 2', P) === null && evalExpr('', P) === null, 'bad formulas are refused (nothing is executed)');
  ok(isFormula('Geraet+2') && !isFormula(' 600 ') && !isFormula('12,5'), 'plain numbers are not kept as formulas');
  let c = { ...newCase('Param'), params: P } as ReturnType<typeof newCase>;
  c = { ...c, ...setFieldExpr(c, 'inner.l', 'Geraet + 2 * Polster')! };
  ok(c.inner.l === 522 && c.exprs?.['inner.l'] === 'Geraet + 2 * Polster', 'a field takes a formula and its value');
  c = { ...c, ...setParams(c, [{ name: 'Geraet', value: 600 }, P[1]]) };
  ok(c.inner.l === 640, `the linked field follows the parameter (${c.inner.l})`);
  const viaStore = unlinkOverridden(c, setParams(c, [{ name: 'Geraet', value: 700 }, P[1]]));
  ok(viaStore.inner?.l === 740 && viaStore.exprs?.['inner.l'] === 'Geraet + 2 * Polster', 'a parameter change through the store keeps the formula');
  c = { ...c, ...setParams(c, c.params!, ['Geraet', 'Mixer']) };
  ok(c.exprs?.['inner.l'] === 'Mixer + 2 * Polster' && c.inner.l === 640, 'renaming a parameter rewrites the formula');
  ok(brokenExprs({ ...c, params: [P[1]] }).includes('inner.l'), 'a formula whose parameter is gone is reported');
  const plain = { ...c, ...setFieldExpr(c, 'inner.l', '700')! };
  ok(plain.inner.l === 700 && !plain.exprs?.['inner.l'], 'a plain number unlinks the field');
  const dragged = unlinkOverridden(c, { inner: { ...c.inner, l: 655 } });
  ok(dragged.exprs !== undefined && !dragged.exprs['inner.l'], 'dragging a linked size in 3D unlinks it');
  ok(unlinkOverridden(c, { inner: { ...c.inner, w: 455 } }).exprs === undefined, 'changing another size keeps the link');
  ok(setFieldExpr(c, 'inner.l', 'Mixer +') === null, 'an unreadable formula is not applied');
  // interference check: every preset is clean, overlapping and edge pieces are found
  const base = newCase('Clash');
  ok(hardwareClashes(base).length === 0, `the default case has no clashes (${hardwareClashes(base).map((x) => x.text).join('; ')})`);
  for (const ty of CASE_TYPES) { const cc = { ...base, ...applyCaseType(base, ty.id) } as typeof base; ok(hardwareClashes(cc).length === 0, `${ty.id}: no clashes (${hardwareClashes(cc).map((x) => x.text).join('; ')})`); }
  const two = { ...base, hardware: [...base.hardware, { kind: 'label' as const, face: 'right' as const, count: 1, at: [{ u: 200, z: 100 }] }, { kind: 'label' as const, face: 'right' as const, count: 1, at: [{ u: 240, z: 110 }] }] };
  const cl = hardwareClashes(two);
  ok(cl.some((x) => x.keys.length === 2 && /überschneiden sich/.test(x.text)), 'two labels on top of each other are found');
  const edge = { ...base, hardware: [...base.hardware, { kind: 'label' as const, face: 'front' as const, count: 1, at: [{ u: 40, z: 100 }] }] };
  ok(hardwareClashes(edge).some((x) => /Kantenprofil/.test(x.text)), 'a label on the edge profile is found');
  const seam = { ...base, hardware: [...base.hardware, { kind: 'label' as const, face: 'front' as const, count: 1, at: [{ u: 300, z: caseBoxes(base).find((b) => b.role === 'lid')!.z0 - 10 }] }] };
  ok(hardwareClashes(seam).some((x) => /Fuge/.test(x.text)), 'a label over the lid seam is found');
  ok(caseWarnings(two).some((w) => /überschneiden sich/.test(w.text)), 'clashes appear in the warnings');
  console.log('parameters, formulas and interference check ok');
}

if (failed) { console.error('case designer: problems found'); process.exit(1); }
console.log('case designer: ok');
