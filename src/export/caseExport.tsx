import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { FlightCase, Project } from '../model/types';
import { caseBom, caseDims, footprint, isDrawer, LID_LABELS } from '../model/cases';
import { CaseSheetSvg } from '../render/CaseDrawing';
import { Dxf } from './panelExport';
import { pdfSafe } from './render';

/**
 * Foam inlay as DXF (R12, mm, origin bottom-left of the inner space): outline on KONTUR, cut-outs on AUSSCHNITT,
 * names and cut depths on GRAVUR. One file per layer (body / lid).
 */
export function caseFoamDxf(c: FlightCase, layer: 'body' | 'lid' = 'body'): string {
  const W = c.inner.w;
  const dxf = new Dxf(W);
  // Dxf works in "panel" coordinates (y down); the inner space has y from the front → y_panel = W - y
  dxf.rrect('KONTUR', c.inner.l / 2, W / 2, c.inner.l, W, 0);
  for (const it of c.items.filter((i) => i.layer === layer)) {
    const f = footprint(it);
    dxf.rrect('AUSSCHNITT', it.x + f.l / 2, W - (it.y + f.w / 2), f.l, f.w, 3);
    dxf.text('GRAVUR', it.x + f.l / 2, W - (it.y + f.w / 2), Math.min(8, f.w / 4), `${it.name} T${it.h}`, 'center');
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
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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
      line(`${LID_LABELS[c.lidKind]}${c.lidKind !== 'none' ? `, Deckelhöhe innen ${c.lidH} mm` : ''}; Platte ${String(c.panel).replace('.', ',')} mm; Profil ${c.profile === 'none' ? 'ohne' : c.profile === 'alu30' ? 'Alu 30 × 30' : 'Alu 35 × 35'}`);
    } else line(`Innenmaß der Schublade ${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm`, true);
    line(`Gewicht ca. ${b.weight.total} kg (${b.weight.case} kg ${isDrawer(c) ? 'Schaum' : 'Case'}, ${b.weight.contents} kg Inhalt)${b.volume ? `, Volumen ${b.volume} m³` : ''}`);
    y += 3;
    if (b.panels.length) { line('Plattenzuschnitt (ohne Fräszugaben)', true); for (const p of b.panels) line(`${p.count} ×  ${p.name}: ${Math.round(p.a)} × ${Math.round(p.b)} mm`); y += 3; }
    if (b.profiles.length) { line('Profile', true); for (const p of b.profiles) line(`${p.name}: ${String(p.length).replace('.', ',')} m`); y += 3; }
    if (b.hardware.length) { line('Beschläge', true); for (const h of b.hardware) line(`${h.count} ×  ${h.label}`); y += 3; }
    line('Schaumstoff', true); for (const f of b.foam) line(`${f.name}: ${Math.round(f.a)} × ${Math.round(f.b)} mm, ${Math.round(f.t)} mm stark`); y += 3;
    if (c.items.length) {
      line('Ausschnitte (x/y ab linker vorderer Innenecke)', true);
      for (const it of c.items) line(`${it.name}: ${it.l} × ${it.w} × ${it.h} mm${it.rot ? ' (gedreht)' : ''}, Position ${Math.round(it.x)} / ${Math.round(it.y)} mm${it.layer === 'lid' ? ', Deckel' : ''}`);
    }
    if (c.notes) { y += 3; line('Notizen', true); for (const t of doc.splitTextToSize(pdfSafe(c.notes), page.w - 2 * M)) line(t); }
    doc.setFontSize(7); doc.setTextColor(150); doc.text('Erstellt mit RackPlanner – Gewichte und Zuschnitte sind Schätzwerte.', M, page.h - 6);
  }
  return doc.output('blob');
}
