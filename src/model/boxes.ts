import type { BoxDesign, DeviceTemplate, Port } from './types';
import { connectorDef } from './connectors';

/** Lay out a box: multi connectors on the left, single connectors in rows on the right. */
export function layoutBox(multi: { name: string; connector: string }[], singles: { name: string; connector: string }[]) {
  const pad = 8, gap = 6, labelH = 6;
  const mw = Math.max(0, ...multi.map((m) => connectorDef(m.connector).w));
  const mh = multi.reduce((s, m) => s + connectorDef(m.connector).h + 4 + labelH, 0);
  const sw = Math.max(14, ...singles.map((m) => connectorDef(m.connector).w));
  const sh = Math.max(14, ...singles.map((m) => connectorDef(m.connector).h + 4));
  const perRow = singles.length <= 8 ? Math.max(1, singles.length) : Math.ceil(singles.length / Math.ceil(singles.length / 8));
  const rows = Math.ceil(singles.length / perRow) || 0;
  const singlesW = singles.length ? perRow * (sw + gap) - gap : 0;
  const x0 = pad + (multi.length ? mw + 18 : 0);
  const w = Math.max(60, Math.round(x0 + singlesW + pad));
  const h = Math.max(34, Math.round(Math.max(mh + pad, rows * (sh + labelH) + pad) + 4));
  const ports: { name: string; connector: string; x: number; y: number; multi: boolean }[] = [];
  let y = (h - mh) / 2;
  for (const m of multi) {
    const d = connectorDef(m.connector);
    ports.push({ ...m, x: pad + mw / 2 + 4, y: y + (d.h + 4) / 2, multi: true });
    y += d.h + 4 + labelH;
  }
  const top = (h - rows * (sh + labelH)) / 2;
  singles.forEach((s, i) => {
    const r = Math.floor(i / perRow), c = i % perRow;
    ports.push({ ...s, x: x0 + sw / 2 + c * (sw + gap), y: top + r * (sh + labelH) + sh / 2, multi: false });
  });
  return { w, h, ports };
}

const expand = (row: { name: string; count: number }) =>
  row.count <= 1 ? [row.name] : Array.from({ length: row.count }, (_, i) => `${row.name} ${i + 1}`);

/** Build a box template (split / combi) from the editor's rows. */
export function buildBoxTemplate(
  base: { id: string; name: string; manufacturer?: string; color?: string; kind: 'split' | 'combi'; custom?: boolean; notes?: string },
  design: BoxDesign,
): DeviceTemplate {
  const multi = design.multi.flatMap((r, ri) => expand(r).map((name) => ({ name, connector: r.connector, row: ri })));
  const singles = design.singles.flatMap((r) => expand(r).map((name) => ({ name, connector: r.connector, via: r.via })));
  // unique port names (cables are re-linked by name)
  const seen = new Map<string, number>();
  const uniq = (n: string) => { const k = seen.get(n) ?? 0; seen.set(n, k + 1); return k ? `${n} (${k + 1})` : n; };
  multi.forEach((m) => { m.name = uniq(m.name); });
  singles.forEach((s) => { s.name = uniq(s.name); });
  const lay = layoutBox(multi, singles);
  const ports: Port[] = lay.ports.map((p, i) => ({ id: `p${i + 1}`, name: p.name, connector: p.connector, side: 'front', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, dir: 'io' }));
  const links = multi.map((m, mi) => ({
    multi: ports[mi].id,
    singles: singles.map((s, si) => (s.via === m.row ? ports[multi.length + si].id : '')).filter(Boolean),
  }));
  return {
    id: base.id, name: base.name, manufacturer: base.manufacturer ?? 'Eigene', category: 'Dosen', heightU: 1, rackStandard: 19, slots: 1,
    depth: 100, color: base.color ?? '#3a3d42', textColor: '#e5e7eb', ports, custom: base.custom, notes: base.notes,
    box: { kind: base.kind, w: lay.w, h: lay.h, links, design },
  };
}
