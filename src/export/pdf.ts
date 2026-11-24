import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { Face, Project, Rack } from '../model/types';
import { cableLength, formatLength } from '../model/geometry';
import { pdfSafe, rackSvgSize, rackSvgString } from './render';
import { cableRows } from '../ui/CableList';
import { rackStats } from '../ui/Inspector';
import { RACK_KIND_LABELS } from '../library/rackTypes';
import { drawerItemText, drawerSummary } from '../render/DrawerFront';
import { rfSummary } from '../integration/rf';

export interface PdfOptions {
  racks: Rack[];
  views: Face[];
  format: 'a4' | 'a3';
  includeCableList: boolean;
  includeBom: boolean;
}

const MARGIN = 12;

function prepareSvgForPdf(markup: string): SVGSVGElement {
  // svg2pdf only knows the built-in PDF fonts
  const cleaned = pdfSafe(markup.replace(/font-family="[^"]*"/g, 'font-family="helvetica"'));
  const holder = document.createElement('div');
  holder.className = 'export-scratch';
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  holder.innerHTML = cleaned;
  document.body.appendChild(holder);
  return holder.querySelector('svg') as SVGSVGElement;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function header(doc: jsPDF, project: Project, title: string, page: { w: number; h: number }) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(pdfSafe(title), MARGIN, MARGIN + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const right = [project.name, project.author, new Date().toLocaleDateString('de-DE')].filter(Boolean).join('   |   ');
  doc.text(pdfSafe(right), page.w - MARGIN, MARGIN + 4, { align: 'right' });
  doc.setDrawColor(200);
  doc.line(MARGIN, MARGIN + 7, page.w - MARGIN, MARGIN + 7);
}

function footer(doc: jsPDF, page: { w: number; h: number }) {
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('Erstellt mit RackPlanner', MARGIN, page.h - 6);
}

interface Col { title: string; w: number; get: (i: number) => string; color?: (i: number) => string | undefined }

/** Minimal paginated table. Returns y after the table. */
function table(doc: jsPDF, cols: Col[], count: number, startY: number, page: { w: number; h: number }, onNewPage: () => number): number {
  const rowH = 5.6;
  let y = startY;
  const drawHead = () => {
    doc.setFillColor(235, 237, 240);
    doc.rect(MARGIN, y, page.w - 2 * MARGIN, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30);
    let x = MARGIN + 1.5;
    for (const c of cols) { doc.text(pdfSafe(c.title), x, y + 3.9); x += c.w; }
    y += rowH;
    doc.setFont('helvetica', 'normal');
  };
  drawHead();
  for (let i = 0; i < count; i++) {
    if (y + rowH > page.h - 12) { y = onNewPage(); drawHead(); }
    if (i % 2 === 1) { doc.setFillColor(248, 249, 250); doc.rect(MARGIN, y, page.w - 2 * MARGIN, rowH, 'F'); }
    let x = MARGIN + 1.5;
    doc.setFontSize(8);
    doc.setTextColor(30);
    for (const c of cols) {
      const color = c.color?.(i);
      let tx = x;
      if (color) { doc.setFillColor(...hexToRgb(color)); doc.roundedRect(x, y + 1.3, 3, 3, 0.6, 0.6, 'F'); tx += 4.5; }
      const text = pdfSafe(c.get(i));
      const maxW = c.w - 2 - (color ? 4.5 : 0);
      const fitted = doc.splitTextToSize(text, maxW)[0] ?? '';
      doc.text(fitted, tx, y + 3.9);
      x += c.w;
    }
    y += rowH;
  }
  return y;
}

export async function exportPdf(project: Project, opt: PdfOptions): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: opt.format });
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  let first = true;
  const newPage = () => { if (!first) doc.addPage(); first = false; };

  for (const rack of opt.racks) {
    // ---- drawing page
    newPage();
    header(doc, project, `${rack.name} – Bestückung & Verkabelung`, page);
    const legendH = 14;
    const avail = { w: page.w - 2 * MARGIN, h: page.h - 2 * MARGIN - 12 - legendH };
    // pick the arrangement (side by side or stacked) that gives the larger drawing
    const fitScale = (sz: { w: number; h: number }) => Math.min(avail.w / sz.w, avail.h / sz.h);
    const column = opt.views.length > 1 && fitScale(rackSvgSize(rack, opt.views.length, true)) > fitScale(rackSvgSize(rack, opt.views.length));
    const size = rackSvgSize(rack, opt.views.length, column);
    const k = fitScale(size);
    const svgEl = prepareSvgForPdf(rackSvgString(project, rack, opt.views, 1, column));
    try {
      await doc.svg(svgEl, { x: MARGIN + (avail.w - size.w * k) / 2, y: MARGIN + 10, width: size.w * k, height: size.h * k });
    } finally {
      svgEl.parentElement?.remove();
    }
    // legend of used cable types
    const used = new Map<string, number>();
    for (const c of rack.cables) used.set(c.typeId, (used.get(c.typeId) ?? 0) + 1);
    let lx = MARGIN;
    const ly = page.h - MARGIN - legendH + 6;
    doc.setFontSize(8);
    for (const [id, n] of used) {
      const ct = project.cableTypes.find((t) => t.id === id);
      if (!ct) continue;
      const label = pdfSafe(`${ct.name} (${n})`);
      doc.setFillColor(...hexToRgb(ct.color));
      doc.rect(lx, ly - 2.6, 8, 3, 'F');
      doc.setTextColor(40);
      doc.text(label, lx + 10, ly);
      lx += 14 + doc.getTextWidth(label);
      if (lx > page.w - 60) break;
    }
    doc.setTextColor(100);
    doc.text(pdfSafe(`${rack.type.name}, ${RACK_KIND_LABELS[rack.type.kind]}, Außenmaß ${rack.type.outer.w}×${rack.type.outer.h}×${rack.type.outer.d} mm`), MARGIN, ly + 5);
    footer(doc, page);

    // ---- cable list
    if (opt.includeCableList && rack.cables.length) {
      newPage();
      header(doc, project, `${rack.name} – Kabelliste`, page);
      const rows = cableRows(project, rack);
      const W = page.w - 2 * MARGIN;
      const cols: Col[] = [
        { title: 'Nr.', w: W * 0.07, get: (i) => rows[i].number, color: (i) => rows[i].color },
        { title: 'Typ', w: W * 0.15, get: (i) => rows[i].type },
        { title: 'Von', w: W * 0.16, get: (i) => rows[i].from },
        { title: 'Port', w: W * 0.13, get: (i) => rows[i].fromPort },
        { title: 'Nach', w: W * 0.16, get: (i) => rows[i].to },
        { title: 'Port', w: W * 0.13, get: (i) => rows[i].toPort },
        { title: 'Länge', w: W * 0.07, get: (i) => formatLength(rows[i].length) + (rows[i].mode === 'manual' ? ' *' : '') },
        { title: 'Notiz', w: W * 0.13, get: (i) => rows[i].label },
      ];
      let y = table(doc, cols, rows.length, MARGIN + 11, page, () => { footer(doc, page); doc.addPage(); header(doc, project, `${rack.name} – Kabelliste (Forts.)`, page); return MARGIN + 11; });
      // pick list: cables per type and length
      const pick = new Map<string, Map<number, number>>();
      for (const c of rack.cables) {
        const l = cableLength(project, rack, c)?.length ?? 0;
        const m = pick.get(c.typeId) ?? new Map<number, number>();
        m.set(l, (m.get(l) ?? 0) + 1);
        pick.set(c.typeId, m);
      }
      y += 8;
      if (y > page.h - 30) { footer(doc, page); doc.addPage(); header(doc, project, `${rack.name} – Packliste Kabel`, page); y = MARGIN + 14; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
      doc.text('Packliste Kabel', MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      y += 5;
      for (const [id, m] of pick) {
        const ct = project.cableTypes.find((t) => t.id === id);
        const parts = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([l, n]) => `${n}× ${formatLength(l)}`).join(',  ');
        doc.setFillColor(...hexToRgb(ct?.color ?? '#888'));
        doc.rect(MARGIN, y - 2.6, 3, 3, 'F');
        doc.setTextColor(30);
        doc.text(pdfSafe(`${ct?.name ?? id}:  ${parts}`), MARGIN + 5, y);
        y += 5;
        if (y > page.h - 14) { footer(doc, page); doc.addPage(); header(doc, project, `${rack.name} – Packliste Kabel`, page); y = MARGIN + 14; }
      }
      footer(doc, page);
    }

    // ---- bill of materials
    if (opt.includeBom && rack.devices.length) {
      newPage();
      header(doc, project, `${rack.name} – Geräteliste`, page);
      const devs = [...rack.devices].sort((a, b) => b.u - a.u || a.mount.localeCompare(b.mount) || a.slot - b.slot);
      const W = page.w - 2 * MARGIN;
      const cols: Col[] = [
        { title: 'HE', w: W * 0.06, get: (i) => { const t = project.templates[devs[i].templateId]; return t.heightU > 1 ? `${devs[i].u}-${devs[i].u + t.heightU - 1}` : `${devs[i].u}`; } },
        { title: 'Montage', w: W * 0.08, get: (i) => { const t = project.templates[devs[i].templateId]; return (devs[i].mount === 'front' ? 'vorne' : 'hinten') + (t.slots > 1 ? ` ${devs[i].slot + 1}/${t.slots}` : ''); } },
        { title: 'Hersteller', w: W * 0.12, get: (i) => project.templates[devs[i].templateId].manufacturer },
        { title: 'Gerät', w: W * 0.17, get: (i) => project.templates[devs[i].templateId].name },
        { title: 'Bezeichnung', w: W * 0.15, get: (i) => devs[i].label ?? '' },
        { title: 'Eigenschaften / Inhalt', w: W * 0.27, get: (i) => [Object.entries(devs[i].fields ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('  '), rfSummary(project, devs[i]), drawerSummary(devs[i].contents)].filter(Boolean).join('  ') },
        { title: 'Notiz', w: W * 0.15, get: (i) => devs[i].notes ?? '' },
      ];
      let y = table(doc, cols, devs.length, MARGIN + 11, page, () => { footer(doc, page); doc.addPage(); header(doc, project, `${rack.name} – Geräteliste (Forts.)`, page); return MARGIN + 11; });
      const stats = rackStats(project, rack);
      y += 7;
      doc.setFontSize(9); doc.setTextColor(40);
      const sum = [`Belegt: ${stats.used} / ${rack.type.heightU} HE`, stats.weight ? `Gewicht ca. ${stats.weight.toFixed(1)} kg` : '', stats.power ? `Leistung ca. ${stats.power} W` : ''].filter(Boolean).join('   |   ');
      doc.text(pdfSafe(sum), MARGIN, y);
      if (rack.notes) { doc.text(doc.splitTextToSize(pdfSafe('Notizen: ' + rack.notes), page.w - 2 * MARGIN), MARGIN, y + 6); y += 6; }
      // full drawer contents
      const drawers = devs.filter((d) => project.templates[d.templateId]?.drawer && (d.contents ?? []).some((c) => c.text.trim()));
      if (drawers.length) {
        y += 10;
        const newPageIfNeeded = (need: number) => {
          if (y + need > page.h - 14) { footer(doc, page); doc.addPage(); header(doc, project, `${rack.name} – Schubladeninhalte (Forts.)`, page); y = MARGIN + 14; }
        };
        newPageIfNeeded(14);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20);
        doc.text('Schubladeninhalte', MARGIN, y);
        y += 6;
        for (const d of drawers) {
          const t = project.templates[d.templateId];
          const items = (d.contents ?? []).filter((c) => c.text.trim());
          newPageIfNeeded(10);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
          doc.text(pdfSafe(`HE ${d.u}${t.heightU > 1 ? '-' + (d.u + t.heightU - 1) : ''}: ${d.label || t.name}`), MARGIN, y);
          y += 4.6;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
          // three columns of items
          const colW = (page.w - 2 * MARGIN - 6) / 3;
          const rowsPerCol = Math.ceil(items.length / 3);
          for (let r = 0; r < rowsPerCol; r++) {
            newPageIfNeeded(5);
            for (let c = 0; c < 3; c++) {
              const it = items[c * rowsPerCol + r];
              if (it) doc.text(pdfSafe(`- ${drawerItemText(it)}`), MARGIN + 6 + c * colW, y);
            }
            y += 4.4;
          }
          y += 2;
        }
      }
      footer(doc, page);
    }
  }
  return doc.output('blob');
}
