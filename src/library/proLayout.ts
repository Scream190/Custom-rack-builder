import type { ArtElement, DeviceTemplate, Face, Port } from '../model/types';
import { connectorDef } from '../model/connectors';

/*
 * Compact layout engine for the large data-sheet based libraries (devicesPro*.ts).
 * Connectors are described as blocks (count, connector type, rows) that are packed left to right, so a
 * template only states what sits where on the panel and in which order – the millimetre positions follow.
 * Coordinates follow devicesBranded.ts: front x from the left panel edge, rear x as seen from behind,
 * y from the top edge. Brand name and model are placed automatically in free panel space.
 */

const U = 44.45;
export const W19 = 482.6;
export const hOf = (u: number) => u * U - 0.8;
const r1 = (v: number) => Math.round(v * 10) / 10;

type Dir = Port['dir'];

/** a block of identical connectors */
export interface Blk {
  c: string;
  n?: number;
  pre?: string;
  start?: number;
  names?: string[];
  rows?: number;
  /** explicit row centres (default: rows spread evenly over the panel height) */
  ys?: number[];
  /** numbering: 'row' = left to right, then next row; 'col' = top to bottom first (switches: 1 top, 2 below) */
  order?: 'row' | 'col';
  dir?: Dir;
  /** distance to the previous block (default 7 mm) */
  gap?: number;
  pitch?: number;
  /** small caption above the block */
  label?: string;
  /** absolute x of the block's left edge (the group is then not aligned) */
  at?: number;
  /** start at the same x as the previous block (stacked rows, e.g. inputs above their link outputs) */
  stack?: boolean;
}
/** a group of blocks, aligned within the usable panel width */
export interface Grp { b: Blk[]; align?: 'left' | 'right' | 'center'; x0?: number; x1?: number }

type Rect = [number, number, number, number];
const FLANGED = new Set(['xlr', 'combo', 'ethercon', 'opticalcon', 'powercon', 'true1', 'speakon']);

function layGroup(g: Grp, side: Face, H: number, lo: number, hi: number, ports: Port[], rects: Rect[], art: ArtElement[], ink: string) {
  const x0 = g.x0 ?? lo, x1 = g.x1 ?? hi;
  const abs = g.b.some((b) => b.at !== undefined);
  const tmp: { name: string; c: string; x: number; y: number; dir?: Dir }[] = [];
  const labels: { x: number; y: number; text: string }[] = [];
  let cur = abs ? x0 : 0, first = true, prevXs = cur;
  for (const b of g.b) {
    const def = connectorDef(b.c);
    const names = b.names ?? Array.from({ length: b.n ?? 1 }, (_, i) => `${b.pre ?? ''}${(b.start ?? 1) + i}`);
    const rows = b.rows ?? 1;
    const cols = Math.ceil(names.length / rows);
    const pitch = b.pitch ?? def.w + (def.w >= 20 ? 2.5 : def.shape === 'phoenix' ? 1.6 : 3.5);
    const ys = b.ys ?? Array.from({ length: rows }, (_, i) => (H * (i + 0.5)) / rows);
    const xs = b.at ?? (b.stack ? prevXs : first ? cur : cur + (b.gap ?? 7));
    names.forEach((name, i) => {
      const col = b.order === 'col' ? Math.floor(i / rows) : i % cols;
      const row = b.order === 'col' ? i % rows : Math.floor(i / cols);
      tmp.push({ name, c: b.c, x: xs + def.w / 2 + col * pitch, y: ys[row], dir: b.dir });
    });
    if (b.label) labels.push({ x: xs, y: ys[0] - (FLANGED.has(def.shape) ? def.h / 2 + 2 : def.h / 2) - 1.2, text: b.label });
    cur = Math.max(b.stack ? cur : 0, xs + def.w + (cols - 1) * pitch);
    prevXs = xs;
    first = false;
  }
  const off = abs ? 0 : g.align === 'right' ? x1 - cur : g.align === 'center' ? (x0 + x1 - cur) / 2 : x0;
  for (const t of tmp) {
    const def = connectorDef(t.c);
    const hh = FLANGED.has(def.shape) ? def.h + 4 : def.h;
    ports.push({ id: '', name: t.name, connector: t.c, side, x: r1(t.x + off), y: r1(t.y), dir: t.dir });
    rects.push([t.x + off - def.w / 2, t.y - hh / 2, t.x + off + def.w / 2, t.y + hh / 2]);
  }
  for (const l of labels) {
    art.push({ t: 'text', x: l.x + off, y: l.y, text: l.text, size: 1.7, fill: ink });
    rects.push([l.x + off, l.y - 2, l.x + off + l.text.length * 1.1, l.y + 0.5]);
  }
}

function artBox(e: ArtElement): Rect | null {
  switch (e.t) {
    case 'rect': case 'lcd': case 'vents': case 'switch': case 'button': case 'labelArea': return [e.x, e.y, e.x + e.w, e.y + e.h];
    case 'knob': case 'circle': return [e.x - e.r, e.y - e.r, e.x + e.r, e.y + e.r];
    case 'leds': {
      const n = e.n - 1, r = (e.r ?? 0.9) + 0.6;
      return [e.x - r, e.y - r, e.x + (e.dx ?? 0) * n + r, e.y + (e.dy ?? 0) * n + r];
    }
    default: return null;
  }
}

function freeX(rects: Rect[], y0: number, y1: number, lo: number, hi: number): [number, number][] {
  const iv = rects.filter((r) => r[1] < y1 && r[3] > y0).map((r) => [r[0] - 2.5, r[2] + 2.5]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let x = lo;
  for (const [a, b] of iv) { if (a > x) out.push([x, a]); x = Math.max(x, b); }
  if (hi > x) out.push([x, hi]);
  return out;
}

/** candidate horizontal bands for text: centre on 1 U, top/bottom strip on taller panels */
function bands(H: number, tall: number): [number, number][] {
  return H < 50 ? [[H / 2 - tall / 2, H / 2 + tall / 2]] : [[3, 3 + tall], [H - 3 - tall, H - 3], [H / 2 - tall / 2, H / 2 + tall / 2]];
}

/** brand + model text in the first free spot (front) */
function placeLogo(brand: string, model: string, H: number, rects: Rect[], lo: number, hi: number, ink: string, earText: boolean): ArtElement[] {
  for (const [y0, y1] of bands(H, 12)) {
    const gap = freeX(rects, y0, y1, lo, hi).find(([a, b]) => b - a >= 28);
    if (!gap) continue;
    const w = gap[1] - gap[0] - 3;
    const s = Math.max(2, Math.min(3.6, w / (brand.length * 0.8)));
    const ms = Math.max(1.6, Math.min(2.6, w / (model.length * 0.62)));
    return [
      { t: 'text', x: gap[0] + 1.5, y: y0 + 5, text: brand, size: s, weight: 800, spacing: s * 0.08, fill: ink },
      { t: 'text', x: gap[0] + 1.5, y: y0 + 10.2, text: model, size: ms, fill: ink },
    ];
  }
  // nothing free: small brand on the rack ear
  return earText ? [{ t: 'text', x: 8, y: H / 2 + 0.6, text: brand.slice(0, 9), size: 1.5, weight: 800, anchor: 'middle', fill: ink }] : [];
}

/** model name (and optional rear grille) in free rear space */
function placeRear(model: string, H: number, rects: Rect[], lo: number, hi: number, ink: string, vents: boolean): ArtElement[] {
  const out: ArtElement[] = [];
  for (const [y0, y1] of bands(H, 5)) {
    const gap = freeX(rects, y0, y1, lo, hi).find(([a, b]) => b - a >= model.length * 1.4 + 4);
    if (gap) { out.push({ t: 'text', x: gap[0] + 1.5, y: y0 + 3.6, text: model, size: 2, fill: ink }); rects.push([gap[0], y0, gap[0] + model.length * 1.4 + 3, y1]); break; }
  }
  if (vents) {
    const y0 = H < 50 ? 6 : 8, y1 = H - (H < 50 ? 6 : 8);
    const gaps = freeX(rects, y0, y1, lo, hi).filter(([a, b]) => b - a >= 30);
    for (const [a, b] of gaps) out.push({ t: 'vents', x: a + 2, y: y0, w: b - a - 4, h: y1 - y0, n: Math.max(4, Math.round((b - a) / 5)) });
  }
  return out;
}

export interface Spec {
  id: string; name: string; man: string; cat: string; u: number;
  slots?: 1 | 2 | 3; bodyW?: number; depth: number; color: string; frontColor?: string;
  front?: Grp[]; rear?: Grp[];
  /** extra front/rear graphics (drawn under the auto logo) */
  fa?: ArtElement[] | ((H: number) => ArtElement[]);
  ra?: ArtElement[] | ((H: number) => ArtElement[]);
  /** brand text on the panel (default: manufacturer in capitals) */
  logo?: string | false;
  /** model text on the panel (default: name) */
  model?: string;
  rearVents?: boolean;
  /** text colour for light faceplates */
  ink?: string;
  src: string; notes?: string; weight?: number; fields?: string[];
}

/** build a template from a compact spec */
export function mk(s: Spec): DeviceTemplate {
  const slots = s.slots ?? 1;
  const W = W19 / slots;
  const H = hOf(s.u);
  const kit = !!s.bodyW && s.bodyW < W - 1;
  const bx0 = kit ? (W - s.bodyW!) / 2 : 0, bx1 = kit ? bx0 + s.bodyW! : W;
  const lo = kit ? bx0 + 3 : slots === 1 ? 22 : 4, hi = kit ? bx1 - 3 : slots === 1 ? W - 22 : W - 4;
  const ink = s.ink ?? '#e5e7eb';
  const ports: Port[] = [];
  const art = { front: [] as ArtElement[], rear: [] as ArtElement[] };
  for (const side of ['front', 'rear'] as const) {
    const rects: Rect[] = [];
    const extra = side === 'front' ? s.fa : s.ra;
    const extraArt = typeof extra === 'function' ? extra(H) : extra ?? [];
    for (const e of extraArt) { const b = artBox(e); if (b) rects.push(b); }
    const labels: ArtElement[] = [];
    for (const g of (side === 'front' ? s.front : s.rear) ?? []) layGroup(g, side, H, lo, hi, ports, rects, labels, ink);
    if (side === 'front') {
      const logo = s.logo === false ? [] : placeLogo(s.logo ?? s.man.toUpperCase(), s.model ?? s.name, H, rects, lo, hi, ink, slots === 1 && !kit);
      art.front = [...extraArt, ...labels, ...logo];
    } else {
      art.rear = [...extraArt, ...labels, ...placeRear(s.model ?? s.name, H, rects, lo, hi, ink, !!s.rearVents)];
    }
  }
  return {
    id: s.id, name: s.name, manufacturer: s.man, category: s.cat, heightU: s.u, rackStandard: 19, slots,
    bodyWidth: s.bodyW, depth: s.depth, color: s.color, frontColor: s.frontColor, textColor: ink,
    ports: ports.map((p, i) => ({ ...p, id: `p${i + 1}` })), art, source: s.src, notes: s.notes, weight: s.weight, fields: s.fields,
  };
}

// ------------------------------------------------------------------ block shorthands
export const B = {
  xin: (n: number, pre = 'In ', o: Partial<Blk> = {}): Blk => ({ c: 'XLR3F', n, pre, dir: 'in', ...o }),
  xout: (n: number, pre = 'Out ', o: Partial<Blk> = {}): Blk => ({ c: 'XLR3M', n, pre, dir: 'out', ...o }),
  combo: (n: number, pre = 'In ', o: Partial<Blk> = {}): Blk => ({ c: 'COMBO', n, pre, dir: 'in', ...o }),
  dmx: (n: number, pre = 'DMX ', o: Partial<Blk> = {}): Blk => ({ c: 'XLR5F', n, pre, dir: 'out', ...o }),
  ec: (n: number, pre = 'Port ', o: Partial<Blk> = {}): Blk => ({ c: 'ETHERCON', n, pre, dir: 'io', ...o }),
  rj: (n: number, pre = 'Port ', o: Partial<Blk> = {}): Blk => ({ c: 'RJ45', n, pre, dir: 'io', ...o }),
  sfp: (n: number, pre = 'SFP ', o: Partial<Blk> = {}): Blk => ({ c: 'SFP', n, pre, dir: 'io', ...o }),
  nl4: (n: number, pre = 'Out ', o: Partial<Blk> = {}): Blk => ({ c: 'SPEAKON', n, pre, dir: 'out', pitch: 29, ...o }),
  bnc: (n: number, pre: string, dir: Dir, o: Partial<Blk> = {}): Blk => ({ c: 'BNC-SDI', n, pre, dir, ...o }),
  one: (name: string, c: string, dir?: Dir, o: Partial<Blk> = {}): Blk => ({ c, names: [name], dir, ...o }),
  list: (names: string[], c: string, dir?: Dir, o: Partial<Blk> = {}): Blk => ({ c, names, dir, ...o }),
};
export const G = (b: Blk[], align: Grp['align'] = 'left', o: Partial<Grp> = {}): Grp => ({ b, align, ...o });

// ------------------------------------------------------------------ graphics shorthands
export const A = {
  lcd: (x: number, y: number, w: number, h: number, tint = '#e5f3ff', info = true): ArtElement => ({ t: 'lcd', x, y, w, h, tint, info }),
  leds: (x: number, y: number, n: number, colors: string[], dx = 0, dy = 3.4, r = 0.9): ArtElement => ({ t: 'leds', x, y, n, colors, dx, dy, r }),
  knob: (x: number, y: number, r = 5): ArtElement => ({ t: 'knob', x, y, r }),
  vents: (x: number, y: number, w: number, h: number, n?: number, horizontal = false): ArtElement => ({ t: 'vents', x, y, w, h, n: n ?? Math.max(4, Math.round((horizontal ? h : w) / 4.5)), horizontal }),
  rect: (x: number, y: number, w: number, h: number, fill: string, rx = 0.6): ArtElement => ({ t: 'rect', x, y, w, h, fill, rx }),
  text: (x: number, y: number, text: string, size = 2, extra: Partial<Extract<ArtElement, { t: 'text' }>> = {}): ArtElement => ({ t: 'text', x, y, text, size, ...extra }),
  sw: (x: number, y: number, w = 9, h = 14): ArtElement => ({ t: 'switch', x, y, w, h }),
  btn: (x: number, y: number, w = 8, h = 5, label?: string): ArtElement => ({ t: 'button', x, y, w, h, label }),
  label: (x: number, y: number, w: number, h = 4.6): ArtElement => ({ t: 'labelArea', x, y, w, h }),
};

/** amplifier front: grille, display, per-channel meters, power switch */
export function ampFront(ch: number, opts: { grille?: [number, number]; lcd?: boolean; accent?: string; meterX?: number; power?: boolean } = {}) {
  return (H: number): ArtElement[] => {
    const [g0, g1] = opts.grille ?? [120, 330];
    const out: ArtElement[] = [A.vents(g0, H * 0.14, g1 - g0, H * 0.72, undefined, H > 50)];
    let x = g1 + 8;
    if (opts.lcd !== false) { out.push(A.lcd(x, H / 2 - Math.min(14, H * 0.3), 44, Math.min(28, H * 0.6), '#dbeafe', false)); x += 52; }
    const mx = opts.meterX ?? x;
    const n = Math.min(ch, 8);
    for (let i = 0; i < n; i++) out.push(A.leds(mx + i * 5, H / 2 - (H < 50 ? 9 : 14), H < 50 ? 6 : 9, ['#ef4444', '#f59e0b', '#22c55e'], 0, H < 50 ? 3.2 : 3.4, 0.8));
    if (opts.power !== false) out.push(A.sw(mx + n * 5 + 6, H / 2 - 7));
    if (opts.accent) out.push(A.rect(22, H - 3.2, W19 - 44, 1.4, opts.accent, 0.3));
    return out;
  };
}

/** switch/node front: status LEDs at the left, optional small display */
export function statusFront(x: number, n = 3, lcdW = 0) {
  return (H: number): ArtElement[] => {
    const out: ArtElement[] = [A.leds(x, H / 2 - ((n - 1) * 3.4) / 2, n, ['#22c55e', '#f59e0b', '#3a3d42'])];
    if (lcdW) out.push(A.lcd(x + 5, H / 2 - 8, lcdW, 16, '#dbeafe'));
    return out;
  };
}

export const SRC = {
  DS: 'Datenblatt – Anschlussart und -anzahl laut Herstellerangaben, Positionen geschätzt (±10 mm)',
  EST: 'Schätzung – Bauhöhe und Anschlüsse nach Produktfotos/Datenblatt, vor dem Einsatz am Gerät prüfen',
};
