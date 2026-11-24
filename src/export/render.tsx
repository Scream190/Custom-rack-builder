import { renderToStaticMarkup } from 'react-dom/server';
import type { Face, Project, Rack } from '../model/types';
import { RackSvg, rackLayout } from '../render/RackSvg';
import { AssemblySheet } from '../render/CableAssemblies';
import type { Assembly } from '../model/assembly';

/** Front and/or rear view side by side as one standalone SVG string (mm user units). */
export function rackSvgString(project: Project, rack: Rack, views: Face[], pxPerMm = 1, column = false): string {
  const L = rackLayout(rack, project);
  const gap = 10;
  const { w: W, h: Hh } = rackSvgSize(rack, views.length, column, project);
  const markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${Hh}`} width={W * pxPerMm} height={Hh * pxPerMm}>
      <rect x={0} y={0} width={W} height={Hh} fill="#ffffff" />
      {views.map((v, i) => (
        <RackSvg key={v} project={project} rack={rack} view={v} forExport scale={1} x={column ? 0 : i * (L.vb.w + gap)} y={column ? i * (L.vb.h + gap) : 0} />
      ))}
    </svg>,
  );
  return markup;
}

/** Size of the combined drawing; `column` stacks the views vertically. */
export function rackSvgSize(rack: Rack, views: number, column = false, project?: Project) {
  const L = rackLayout(rack, project);
  return column
    ? { w: L.vb.w, h: views * L.vb.h + (views - 1) * 10 }
    : { w: views * L.vb.w + (views - 1) * 10, h: L.vb.h };
}

/** Characters outside WinAnsi break the built-in PDF fonts – replace them. */
export function pdfSafe(s: string): string {
  return s
    .replace(/↔/g, '<->').replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/Ω/g, 'Ohm').replace(/[✎★]/g, '*').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/[^\u0000-ÿ–—‘’“”•…€]/g, '?');
}

export async function svgToPngBlob(svg: string, widthPx: number, heightPx: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('SVG konnte nicht gerendert werden'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(widthPx);
    canvas.height = Math.round(heightPx);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG fehlgeschlagen'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Cable assembly drawings as standalone SVG markup (for the PDF). */
export function assemblySheetString(assemblies: Assembly[], demand?: { key: string; label: string; count: number }[], title?: string): string {
  return renderToStaticMarkup(<AssemblySheet assemblies={assemblies} demand={demand} light title={title} />);
}
