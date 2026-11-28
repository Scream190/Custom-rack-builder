// Case designer checks. Run: npm run test:cases
import { applyCaseType, bars, caseBom, caseBoxes, caseDims, caseSeams, caseWarnings, CASE_TYPES, drawerInner, HARDWARE, newCase, newDrawerInlay, packItems, ITEM_PRESETS } from '../src/model/cases';
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

if (failed) { console.error('case designer: problems found'); process.exit(1); }
console.log('case designer: ok');
