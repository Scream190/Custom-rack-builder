import { renderMarkup as renderToStaticMarkup, trPdf } from '../i18n/render';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { PanelDesign, PanelElement } from '../model/types';
import { DSIZE, dsizeScrews, MOUNT_SLOT, mountHolePositions, panelSize } from '../model/panel';
import { connectorDef } from '../model/connectors';
import { PanelDrawing } from '../render/PanelArt';
import { pdfSafe } from './render';

// ---------------------------------------------------------------------------------------------
// DXF (AutoCAD R12 / AC1009, ASCII) – the most widely accepted format for front panel makers.
// Units: mm, scale 1:1, origin bottom-left of the panel.
// Layers: KONTUR (outline), AUSSCHNITT (all cut-outs & holes), GRAVUR (engraving / print).
// ---------------------------------------------------------------------------------------------

export class Dxf {
  private out: string[] = [];
  constructor(private h: number) {}
  private g(code: number, value: string | number) {
    // group codes 60–99 and 170–179 are integers in DXF – everything else numeric is a float
    const intCode = (code >= 60 && code <= 99) || (code >= 170 && code <= 179);
    this.out.push(String(code), typeof value === 'number' ? (intCode ? String(Math.round(value)) : fmt(value)) : value);
  }
  /** panel coords (y down) -> dxf (y up) */
  private Y(y: number) { return this.h - y; }
  line(layer: string, x1: number, y1: number, x2: number, y2: number) {
    this.g(0, 'LINE'); this.g(8, layer);
    this.g(10, x1); this.g(20, this.Y(y1)); this.g(30, 0);
    this.g(11, x2); this.g(21, this.Y(y2)); this.g(31, 0);
  }
  circle(layer: string, x: number, y: number, r: number) {
    this.g(0, 'CIRCLE'); this.g(8, layer); this.g(10, x); this.g(20, this.Y(y)); this.g(30, 0); this.g(40, r);
  }
  /** angles in degrees, CCW, in DXF (y-up) orientation */
  arc(layer: string, x: number, y: number, r: number, a0: number, a1: number) {
    this.g(0, 'ARC'); this.g(8, layer); this.g(10, x); this.g(20, this.Y(y)); this.g(30, 0); this.g(40, r); this.g(50, a0); this.g(51, a1);
  }
  text(layer: string, x: number, y: number, height: number, text: string, align: 'left' | 'center' | 'right' = 'left') {
    const j = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    this.g(0, 'TEXT'); this.g(8, layer);
    this.g(10, x); this.g(20, this.Y(y)); this.g(30, 0);
    this.g(40, height); this.g(1, text.replace(/[\r\n]+/g, ' '));
    if (j) { this.g(72, j); this.g(11, x); this.g(21, this.Y(y)); this.g(31, 0); }
  }
  /** closed polyline (R12 POLYLINE with vertices) in panel coords */
  polyline(layer: string, pts: [number, number][], closed = true) {
    this.g(0, 'POLYLINE'); this.g(8, layer); this.g(66, 1); this.g(70, closed ? 1 : 0);
    this.g(10, 0); this.g(20, 0); this.g(30, 0);
    for (const [x, y] of pts) { this.g(0, 'VERTEX'); this.g(8, layer); this.g(10, x); this.g(20, this.Y(y)); this.g(30, 0); }
    this.g(0, 'SEQEND'); this.g(8, layer);
  }
  /** rounded rectangle centred at (cx, cy) in panel coords */
  rrect(layer: string, cx: number, cy: number, w: number, h: number, r: number) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const x0 = cx - w / 2, x1 = cx + w / 2, yt = cy - h / 2, yb = cy + h / 2;
    if (r <= 0.001) {
      this.line(layer, x0, yt, x1, yt); this.line(layer, x1, yt, x1, yb);
      this.line(layer, x1, yb, x0, yb); this.line(layer, x0, yb, x0, yt);
      return;
    }
    if (w - 2 * r > 0.001) { this.line(layer, x0 + r, yt, x1 - r, yt); this.line(layer, x0 + r, yb, x1 - r, yb); }
    if (h - 2 * r > 0.001) { this.line(layer, x0, yt + r, x0, yb - r); this.line(layer, x1, yt + r, x1, yb - r); }
    // in y-up space: top edge = yt (panel) -> larger DXF Y
    this.arc(layer, x1 - r, yt + r, r, 0, 90);     // top-right
    this.arc(layer, x0 + r, yt + r, r, 90, 180);   // top-left
    this.arc(layer, x0 + r, yb - r, r, 180, 270);  // bottom-left
    this.arc(layer, x1 - r, yb - r, r, 270, 360);  // bottom-right
  }
  build(extents: { w: number; h: number }): string {
    const head = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1009',
      '9', '$INSBASE', '10', '0.0', '20', '0.0', '30', '0.0',
      '9', '$EXTMIN', '10', '0.0', '20', '0.0', '30', '0.0',
      '9', '$EXTMAX', '10', fmt(extents.w), '20', fmt(extents.h), '30', '0.0',
      '9', '$MEASUREMENT', '70', '1',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES',
      '0', 'TABLE', '2', 'LTYPE', '70', '1',
      '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
      '0', 'ENDTAB',
      '0', 'TABLE', '2', 'LAYER', '70', '3',
      ...layer('KONTUR', 7), ...layer('AUSSCHNITT', 1), ...layer('GRAVUR', 5),
      '0', 'ENDTAB',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
    ];
    return [...head, ...this.out, '0', 'ENDSEC', '0', 'EOF', ''].join('\r\n');
  }
}

function layer(name: string, color: number) {
  return ['0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS'];
}

function fmt(n: number) {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

export function panelToDxf(pd: PanelDesign): string {
  const { w, h } = panelSize(pd);
  const dxf = new Dxf(h);
  dxf.rrect('KONTUR', w / 2, h / 2, w, h, pd.cornerRadius);
  for (const p of mountHolePositions(pd)) {
    if (pd.mountHoles === 'slot') dxf.rrect('AUSSCHNITT', p.x, p.y, MOUNT_SLOT.w, MOUNT_SLOT.h, MOUNT_SLOT.h / 2);
    else dxf.circle('AUSSCHNITT', p.x, p.y, MOUNT_SLOT.h / 2);
  }
  for (const el of pd.elements) elementToDxf(dxf, el);
  return dxf.build({ w, h });
}

function elementToDxf(dxf: Dxf, el: PanelElement) {
  switch (el.kind) {
    case 'dseries':
      dxf.circle('AUSSCHNITT', el.x, el.y, DSIZE.holeD / 2);
      for (const s of dsizeScrews(el)) dxf.circle('AUSSCHNITT', s.x, s.y, DSIZE.screwD / 2);
      break;
    case 'hole':
      dxf.circle('AUSSCHNITT', el.x, el.y, (el.d ?? 6) / 2);
      break;
    case 'rect':
      dxf.rrect('AUSSCHNITT', el.x, el.y, el.w ?? 20, el.h ?? 10, el.r ?? 0);
      break;
    case 'engraveRect':
      dxf.rrect('GRAVUR', el.x, el.y, el.w ?? 40, el.h ?? 20, el.r ?? 0);
      break;
    case 'engraveLine':
      dxf.line('GRAVUR', el.x - (el.w ?? 40) / 2, el.y, el.x + (el.w ?? 40) / 2, el.y);
      break;
    case 'text': {
      const fs = el.fontSize ?? 3.5;
      // insertion point = baseline
      dxf.text('GRAVUR', el.x, el.y + fs / 2, fs, el.text ?? '', el.align ?? 'center');
      break;
    }
  }
}

// ------------------------------------------------------------------------------------- SVG

export function panelToSvg(pd: PanelDesign): string {
  const { w, h } = panelSize(pd);
  const body = renderToStaticMarkup(<PanelDrawing pd={pd} />);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// ------------------------------------------------------------------------------------- PDF drawing

export function elementDescription(el: PanelElement): string {
  switch (el.kind) {
    case 'dseries': return `D-Size Ø${DSIZE.holeD} + 2× Ø${DSIZE.screwD}${el.connector ? ', ' + connectorDef(el.connector).label : ''}${el.rotate ? ' (90°)' : ''}`;
    case 'hole': return `Bohrung Ø${el.d ?? 6}`;
    case 'rect': return `Ausschnitt ${el.w ?? 20} × ${el.h ?? 10}${el.r ? ` R${el.r}` : ''}`;
    case 'engraveRect': return `Gravur Rahmen ${el.w ?? 40} × ${el.h ?? 20}`;
    case 'engraveLine': return `Gravur Linie ${el.w ?? 40}`;
    case 'text': return `Gravur Text "${el.text ?? ''}" H${el.fontSize ?? 3.5}`;
  }
}

export async function panelToPdf(pd: PanelDesign, name: string): Promise<Blob> {
  const doc = trPdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const { w, h } = panelSize(pd);
  const M = 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(pdfSafe(`Frontplatte: ${name}`), M, M + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
  doc.text(pdfSafe(`${pd.heightU} HE, ${w} × ${h} mm, ${pd.thickness} mm ${pd.material}, Befestigung: ${pd.mountHoles === 'slot' ? 'Langloch 10 × 6,5' : 'Bohrung Ø6,5'}`), M, M + 10);
  const k = (pw - 2 * M) / w;
  const svgStr = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h}><PanelDrawing pd={pd} /></svg>,
  ).replace(/font-family="[^"]*"/g, 'font-family="helvetica"');
  const holder = document.createElement('div');
  holder.className = 'export-scratch';
  holder.style.cssText = 'position:fixed;left:-99999px;top:0';
  holder.innerHTML = pdfSafe(svgStr);
  document.body.appendChild(holder);
  try {
    await doc.svg(holder.querySelector('svg')!, { x: M, y: M + 16, width: w * k, height: h * k });
  } finally {
    holder.remove();
  }
  // element table, coordinates from top-left corner of the panel
  let y = M + 22 + h * k;
  doc.setFontSize(9); doc.setTextColor(30); doc.setFont('helvetica', 'bold');
  doc.text(`Elemente (Maße in mm, Bezug: linke obere Ecke, Maßstab Zeichnung ${k.toFixed(2)}:1)`, M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  y += 6;
  doc.text('Nr.', M, y); doc.text('X', M + 12, y); doc.text('Y', M + 32, y); doc.text('Element', M + 52, y); doc.text('Bezeichnung', M + 160, y);
  y += 1.5; doc.setDrawColor(200); doc.line(M, y, pw - M, y); y += 4;
  pd.elements.forEach((el, i) => {
    if (y > ph - 12) { doc.addPage(); y = M + 6; }
    doc.text(String(i + 1), M, y);
    doc.text(el.x.toFixed(2), M + 12, y);
    doc.text(el.y.toFixed(2), M + 32, y);
    doc.text(pdfSafe(elementDescription(el)), M + 52, y);
    doc.text(pdfSafe(el.label ?? ''), M + 160, y);
    y += 5;
  });
  doc.setFontSize(7); doc.setTextColor(130);
  doc.text('Alle Maße ohne Gewähr – Ausschnitte vor Bestellung mit den Datenblättern der Einbaubuchsen abgleichen.', M, ph - 6);
  return doc.output('blob');
}
