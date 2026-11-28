import { renderMarkup as renderToStaticMarkup, trPdf } from '../i18n/render';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { FlightCase, Project } from '../model/types';
import { caseBom, caseDims, caseTypeOf, doorDepths, footprint, isDrawer, LID_LABELS, SEAM_LABELS } from '../model/cases';
import { panelMaterial, profileBySku } from '../library/caseHardware';

/** cut lengths grouped: "4 × 618, 2 × 800" */
const groupCuts = (pieces: number[]) => {
  const m = new Map<number, number>();
  for (const p of pieces) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([l, n]) => `${n} × ${l}`).join(', ');
};
import { CaseSheetSvg } from '../render/CaseDrawing';
import { HardwarePlanSvg, hardwarePlanLayout } from '../render/HardwarePlan';
import { Dxf } from './panelExport';
import { pdfSafe } from './render';
import { cutDepth, cutList, cutoutOutline, FOAM_MATERIALS, foamMaterial, inlayContainer, outlineBox } from '../model/inlay';
import { InlaySheetSvg } from '../render/InlayDrawing';
import { RackSheetSvg } from '../render/RackBuildDrawing';
import { buildOf, isFlightRack, rackBom, rackDims } from '../model/rackBuild';
import type { Rack } from '../model/types';
import { totalUnits } from '../model/geometry';

/**
 * Foam inlay as DXF (R12, mm, origin bottom-left of the inner space): outer contour on KONTUR, cut-outs (with corner
 * radii and finger grips) as closed polylines on AUSSCHNITT, engravings on GRAVUR. Names and cut depths go to INFO,
 * which is not cut. One file per layer (body / lid).
 */
export function caseFoamDxf(c: FlightCase, layer: 'body' | 'lid' = 'body'): string {
  const W = c.inner.w;
  const dxf = new Dxf(W);
  // Dxf works in "panel" coordinates (y down); the inner space has y from the front → y_panel = W - y
  dxf.rrect('KONTUR', c.inner.l / 2, W / 2, c.inner.l, W, 0);
  for (const it of c.items.filter((i) => i.layer === layer)) {
    const f = footprint(it);
    const pts = cutoutOutline(it);
    dxf.polyline('AUSSCHNITT', pts.map(([x, y]) => [x, W - y]));
    dxf.text('INFO', it.x + f.l / 2, W - (it.y + f.w / 2), Math.min(8, f.w / 4), `${it.name} T${cutDepth(it)}`, 'center');
    if (it.engrave) { const bb = outlineBox(pts); dxf.text('GRAVUR', it.x + f.l / 2, W - (bb.y1 + 6), 6, it.name, 'center'); }
  }
  return dxf.build({ w: c.inner.l, h: W });
}

function prepareSvg(markup: string): SVGSVGElement {
  const cleaned = pdfSafe(markup.replace(/font-family="[^"]*"/g, 'font-family="helvetica"'));
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  holder.innerHTML = cleaned;
  document.body.appendChild(holder);
  return holder.querySelector('svg') as SVGSVGElement;
}

/** PDF: drawing (top view with cut-outs, front and side view) and parts list, one or more pages per case */
export async function exportCasesPdf(project: Project, cases: FlightCase[]): Promise<Blob> {
  const doc = trPdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  const M = 12;
  const head = (title: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
    doc.text(pdfSafe(title), M, M + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(pdfSafe([project.name, new Date().toLocaleDateString('de-DE')].join('   |   ')), page.w - M, M + 4, { align: 'right' });
    doc.setDrawColor(200); doc.line(M, M + 7, page.w - M, M + 7);
  };
  for (const [ci, c] of cases.entries()) {
    if (ci) doc.addPage();
    head(`${c.name} – ${isDrawer(c) ? 'Schaumstoff-Einlage' : 'Flightcase'}`);
    const svg = prepareSvg(renderToStaticMarkup(<CaseSheetSvg c={c} project={project} light />));
    const vb = svg.viewBox.baseVal;
    const avail = { w: page.w - 2 * M, h: page.h - 2 * M - 14 };
    const k = Math.min(avail.w / vb.width, avail.h / vb.height);
    try { await doc.svg(svg, { x: M + (avail.w - vb.width * k) / 2, y: M + 10, width: vb.width * k, height: vb.height * k }); } finally { svg.parentElement?.remove(); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text(pdfSafe(`Maßstab ca. 1:${Math.round(1 / k)}`), M, page.h - 6);
    // drilling plan: positions of all hardware per side
    if (!isDrawer(c) && hardwarePlanLayout(c).count) {
      doc.addPage();
      head(`${c.name} – Bohrplan Beschläge`);
      const ps = prepareSvg(renderToStaticMarkup(<HardwarePlanSvg c={c} />));
      const pv = ps.viewBox.baseVal;
      const pk = Math.min(avail.w / pv.width, avail.h / pv.height);
      try { await doc.svg(ps, { x: M + (avail.w - pv.width * pk) / 2, y: M + 10, width: pv.width * pk, height: pv.height * pk }); } finally { ps.parentElement?.remove(); }
      doc.setFontSize(7); doc.setTextColor(150); doc.text(pdfSafe(`Maßstab ca. 1:${Math.round(1 / pk)}, Maße in mm zur Mitte des Beschlags`), M, page.h - 6);
    }
    // parts list
    doc.addPage();
    head(`${c.name} – Stückliste`);
    const b = caseBom(c, project);
    const d = caseDims(c);
    let y = M + 16;
    const line = (t: string, bold = false) => {
      if (y > page.h - 14) { doc.addPage(); head(`${c.name} – Stückliste (Forts.)`); y = M + 16; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10.5 : 9); doc.setTextColor(30);
      doc.text(pdfSafe(t), M, y); y += bold ? 6 : 4.8;
    };
    if (!isDrawer(c)) {
      line(`Innen ${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm, außen ca. ${Math.round(d.L)} × ${Math.round(d.W)} × ${Math.round(d.H)} mm`, true);
      line(`${caseTypeOf(c.caseType)?.label ? `${caseTypeOf(c.caseType)!.label}; ` : ''}${LID_LABELS[c.lidKind]}${c.lidKind !== 'none' ? `, Deckelhöhe innen ${c.lidH} mm${c.lidSplit ? ', geteilt' : ''}` : ''}; Platte ${String(c.panel).replace('.', ',')} mm${panelMaterial(c.parts?.panel) ? ` ${panelMaterial(c.parts?.panel)!.label}` : ''}; Profil ${c.parts?.edge ?? (c.profile === 'none' ? 'ohne' : c.profile === 'alu30' ? 'Alu 30 × 30' : 'Alu 35 × 35')}`);
      const dd = doorDepths(c);
      const doorText = (['front', 'back', 'left', 'right'] as const).filter((s) => dd[s]).map((s) => `${SEAM_LABELS[s]} ${dd[s]} mm`).join(', ');
      if (doorText || c.drawers?.length) line([doorText && `Türen (Innentiefe): ${doorText}`, c.drawers?.length ? `${c.drawers.length} Schubladen (${c.drawers.map((x) => x.h).join(' / ')} mm)` : ''].filter(Boolean).join('; '));
    } else line(`Innenmaß der Schublade ${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm`, true);
    line(`Gewicht ca. ${b.weight.total} kg (${b.weight.case} kg ${isDrawer(c) ? 'Schaum' : 'Case'}, ${b.weight.contents} kg Inhalt)${b.volume ? `, Volumen ${b.volume} m³` : ''}`);
    y += 3;
    if (b.panels.length) {
      line('Plattenzuschnitt (ohne Fräszugaben)', true); for (const p of b.panels) line(`${p.count} ×  ${p.name}: ${Math.round(p.a)} × ${Math.round(p.b)} mm`);
      if (b.sheets) line(`${b.sheets.material} ${String(b.sheets.thickness).replace('.', ',')} mm: ${String(b.sheets.area).replace('.', ',')} m², ${b.sheets.count} Tafel${b.sheets.count === 1 ? '' : 'n'} ${b.sheets.size[0]} × ${b.sheets.size[1]} mm (5 % Verschnitt)`);
      y += 3;
    }
    if (b.profiles.length) {
      line('Profile', true);
      for (const p of b.profiles) {
        line(`${p.name}: ${String(p.length).replace('.', ',')} m${p.bars ? `, ${p.bars} Stangen à ${profileBySku(p.sku)?.stock ?? 4} m` : ''}`);
        if (p.pieces?.length) for (const t of doc.splitTextToSize(pdfSafe(`   Zuschnitt: ${groupCuts(p.pieces)} mm`), page.w - 2 * M)) line(t);
      }
      y += 3;
    }
    if (b.hardware.length) { line('Beschläge', true); for (const h of b.hardware) line(`${h.count} ×  ${h.label}`); y += 3; }
    line('Schaumstoff', true); for (const f of b.foam) line(`${f.name}: ${Math.round(f.a)} × ${Math.round(f.b)} mm, ${Math.round(f.t)} mm stark${f.stack ? ` (${f.stack})` : ''}`); y += 3;
    if (c.items.length) {
      line('Ausschnitte (x/y ab linker vorderer Innenecke)', true);
      for (const it of c.items) line(`${it.name}: ${it.l} × ${it.w} mm, Tiefe ${cutDepth(it)} mm${it.rot ? ' (gedreht)' : ''}, Position ${Math.round(it.x)} / ${Math.round(it.y)} mm${it.layer === 'lid' ? ', Deckel' : ''}`);
    }
    if (c.notes) { y += 3; line('Notizen', true); for (const t of doc.splitTextToSize(pdfSafe(c.notes), page.w - 2 * M)) line(t); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text('Erstellt mit RackPlanner – Gewichte und Zuschnitte sind Schätzwerte.', M, page.h - 6);
  }
  return doc.output('blob');
}

/** PDF of foam inlays: cutting plan per layer (top view with dimensions and section) and a cut list */
export async function exportInlaysPdf(project: Project, inlays: FlightCase[]): Promise<Blob> {
  const doc = trPdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  const M = 12;
  const head = (title: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
    doc.text(pdfSafe(title), M, M + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(pdfSafe([project.name, new Date().toLocaleDateString('de-DE')].join('   |   ')), page.w - M, M + 4, { align: 'right' });
    doc.setDrawColor(200); doc.line(M, M + 7, page.w - M, M + 7);
  };
  let first = true;
  for (const c of inlays) {
    const layers: ('body' | 'lid')[] = c.items.some((it) => it.layer === 'lid') ? ['body', 'lid'] : ['body'];
    for (const layer of layers) {
      if (!first) doc.addPage();
      first = false;
      head(`${c.name} – Zuschnitt${layer === 'lid' ? ' Deckel' : ''}`);
      const svg = prepareSvg(renderToStaticMarkup(<InlaySheetSvg c={c} layer={layer} light />));
      const vb = svg.viewBox.baseVal;
      const avail = { w: page.w - 2 * M, h: page.h - 2 * M - 14 };
      const k = Math.min(avail.w / vb.width, avail.h / vb.height);
      try { await doc.svg(svg, { x: M + (avail.w - vb.width * k) / 2, y: M + 10, width: vb.width * k, height: vb.height * k }); } finally { svg.parentElement?.remove(); }
      doc.setFontSize(7); doc.setTextColor(150); doc.text(pdfSafe(`Maßstab ca. 1:${Math.round(1 / k)}. Für den Zuschnitt die DXF-Datei verwenden.`), M, page.h - 6);
    }
    doc.addPage();
    head(`${c.name} – Zuschnittliste`);
    const b = caseBom(c, project);
    let y = M + 16;
    const line = (t: string, bold = false) => {
      if (y > page.h - 14) { doc.addPage(); head(`${c.name} – Zuschnittliste (Forts.)`); y = M + 16; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10.5 : 9); doc.setTextColor(30);
      doc.text(pdfSafe(t), M, y); y += bold ? 6 : 4.8;
    };
    line(`Einlage für ${inlayContainer(project, c)}, Innenmaß ${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm`, true);
    line(`${FOAM_MATERIALS[foamMaterial(c)].label}, Farbe ${c.foam.color}; Gewicht Schaum ca. ${b.weight.foam} kg`);
    y += 3;
    line('Schaumteile', true);
    for (const f of b.foam) line(`${f.name}: ${Math.round(f.a)} × ${Math.round(f.b)} mm, ${Math.round(f.t)} mm stark${f.stack ? ` (${f.stack})` : ''}`);
    y += 3;
    line('Ausschnitte (Position ab linker vorderer Innenecke)', true);
    for (const r of cutList(c)) {
      const grips = r.it.grips?.length ? `, Griffmulden ${r.it.grips.map((g) => ({ left: 'links', right: 'rechts', front: 'vorne', back: 'hinten' })[g]).join('/')}` : '';
      line(`${r.it.name}: ${r.it.outline ? 'Kontur ' : r.it.shape === 'circle' ? 'rund ' : ''}${r.l} × ${r.w} mm, Tiefe ${r.depth} mm, Position ${Math.round(r.x)} / ${Math.round(r.y)} mm${r.it.layer === 'lid' ? ', Deckel' : ''}${grips}${r.it.engrave ? ', graviert' : ''}${r.inside ? '' : ' – passt nicht!'}`);
    }
    if (c.notes) { y += 3; line('Notizen', true); for (const t of doc.splitTextToSize(pdfSafe(c.notes), page.w - 2 * M)) line(t); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text('Erstellt mit RackPlanner – Maße vor dem Zuschnitt am Behälter prüfen.', M, page.h - 6);
  }
  return doc.output('blob');
}

/** PDF of rack housings: drawing (front, side, top section) and parts list per rack */
export async function exportRackBuildPdf(project: Project, racks: Rack[], devices = true): Promise<Blob> {
  const doc = trPdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  const M = 12;
  const head = (title: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
    doc.text(pdfSafe(title), M, M + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(pdfSafe([project.name, new Date().toLocaleDateString('de-DE')].join('   |   ')), page.w - M, M + 4, { align: 'right' });
    doc.setDrawColor(200); doc.line(M, M + 7, page.w - M, M + 7);
  };
  for (const [ri, rack] of racks.entries()) {
    if (ri) doc.addPage();
    head(`${rack.name} – Gehäuse ${rack.type.name}`);
    const svg = prepareSvg(renderToStaticMarkup(<RackSheetSvg project={project} rack={rack} devices={devices} light />));
    const vb = svg.viewBox.baseVal;
    const avail = { w: page.w - 2 * M, h: page.h - 2 * M - 14 };
    const k = Math.min(avail.w / vb.width, avail.h / vb.height);
    try { await doc.svg(svg, { x: M + (avail.w - vb.width * k) / 2, y: M + 10, width: vb.width * k, height: vb.height * k }); } finally { svg.parentElement?.remove(); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text(pdfSafe(`Maßstab ca. 1:${Math.round(1 / k)}`), M, page.h - 6);
    doc.addPage();
    head(`${rack.name} – Stückliste Gehäuse`);
    const t = rack.type, b = buildOf(t), d = rackDims(t), bom = rackBom(t);
    let y = M + 16;
    const line = (s: string, bold = false) => {
      if (y > page.h - 14) { doc.addPage(); head(`${rack.name} – Stückliste (Forts.)`); y = M + 16; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10.5 : 9); doc.setTextColor(30);
      doc.text(pdfSafe(s), M, y); y += bold ? 6 : 4.8;
    };
    line(`Außen ca. ${Math.round(d.W)} × ${Math.round(d.H)} × ${Math.round(d.D)} mm (B × H × T), ${totalUnits(t)} HE, Einbautiefe ${t.depth} mm`, true);
    if (isFlightRack(t.kind)) line(`Platte ${b.panel} mm, Profil ${b.profile === 'none' ? 'ohne' : b.profile === 'alu30' ? 'Alu 30 × 30' : 'Alu 35 × 35'}; Frontdeckel ${b.frontLid ? `${b.frontLid} mm innen` : 'ohne'}, Rückdeckel ${b.rearLid ? `${b.rearLid} mm innen` : 'ohne'}${t.kind === 'shockmount' ? `; Federweg ${b.shock?.travel ?? 35} mm` : ''}`);
    line(`Freiraum vor den Schienen ${b.railInset} mm, dahinter ${b.rearGap} mm, seitlich ${b.sideGap} mm, oben/unten ${b.topGap} mm`);
    line(`Gewicht leer ca. ${bom.weight.case} kg, Volumen ${bom.volume} m³`);
    y += 3;
    if (bom.panels.length) { line(isFlightRack(t.kind) ? 'Plattenzuschnitt (ohne Fräszugaben)' : 'Teile', true); for (const p of bom.panels) line(`${p.count} ×  ${p.name}: ${Math.round(p.a)} × ${Math.round(p.b)} mm`); y += 3; }
    if (bom.profiles.length) { line('Profile', true); for (const p of bom.profiles) line(`${p.name}: ${String(p.length).replace('.', ',')} m`); y += 3; }
    line('Beschläge und Schienen', true); for (const h of bom.hardware) line(`${h.count} ×  ${h.label}`);
    if (t.notes) { y += 3; line('Notizen', true); for (const s of doc.splitTextToSize(pdfSafe(t.notes), page.w - 2 * M)) line(s); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text('Erstellt mit RackPlanner – Gewichte und Zuschnitte sind Schätzwerte.', M, page.h - 6);
  }
  return doc.output('blob');
}
