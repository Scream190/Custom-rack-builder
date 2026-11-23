import type { ArtElement, DeviceTemplate, Face, Port } from '../model/types';

/*
 * All products of the user's frequency management software (RF-Scan-Editor, src/js/56b-products.js and the
 * scanners it supports) that were not in the library yet. Accuracy is stated per template in `source`:
 *  - "vermessen": connector positions measured on the manufacturer's front/back panel drawing (user guide)
 *  - "abgeleitet": same housing as a measured sibling, connector set from the manual / data sheet
 *  - "Datenblatt": connector set from the data sheet / manual text, positions estimated (±10 mm)
 * Coordinates: see devicesBranded.ts (rear x as seen from behind; half-width devices within the 241.3 mm slot,
 * full-width devices with a narrower body: within the 482.6 mm slot).
 */

const UHF_FIELDS = ['Frequenz', 'Kanal / Name', 'Gruppe'];
const r1 = (v: number) => Math.round(v * 10) / 10;
let pid = 0;
const p = (name: string, connector: string, side: Face, x: number, y: number, dir?: Port['dir']): Port => ({ id: `p${++pid}`, name, connector, side, x: r1(x), y: r1(y), dir });
function dev(t: Omit<DeviceTemplate, 'textColor' | 'rackStandard'> & Partial<Pick<DeviceTemplate, 'textColor' | 'rackStandard'>>): DeviceTemplate {
  pid = 0;
  return { textColor: '#e5e7eb', rackStandard: 19, ...t, ports: t.ports.map((port, i) => ({ ...port, id: `p${i + 1}` })) };
}

const BLUE = '#3b82f6', AMBER = '#f59e0b', GREEN = '#22c55e', YELLOW = '#eab308', RED = '#ef4444', OFF = '#3a3d42', HOLE = '#0a0a0a';
const T = (x: number, y: number, text: string, size: number, extra: Partial<Extract<ArtElement, { t: 'text' }>> = {}): ArtElement => ({ t: 'text', x, y, text, size, ...extra });
const logo = (x: number, y: number, brand: string, size = 3.2): ArtElement =>
  brand === 'Shure' ? T(x, y, 'SHURE', size, { weight: 900, italic: true, spacing: 0.2 }) : T(x, y, brand.toUpperCase(), size * 0.8, { weight: 800, spacing: size * 0.12 });
const triUp = (cx: number, cy: number, s = 1.6): ArtElement => ({ t: 'path', d: `M${cx - s},${cy + s * 0.6} L${cx + s},${cy + s * 0.6} L${cx},${cy - s * 0.8} Z`, fill: '#e5e7eb' });
const triDown = (cx: number, cy: number, s = 1.6): ArtElement => ({ t: 'path', d: `M${cx - s},${cy - s * 0.6} L${cx + s},${cy - s * 0.6} L${cx},${cy + s * 0.8} Z`, fill: '#e5e7eb' });
function wideEars(seps: number[], holeX: number, holeR: number, h = 43.65, w = 482.6): ArtElement[] {
  const out: ArtElement[] = [];
  for (const x of seps) out.push({ t: 'line', x1: x, y1: 0.6, x2: x, y2: h - 0.6, stroke: '#000', sw: 0.5 }, { t: 'line', x1: w - x, y1: 0.6, x2: w - x, y2: h - 0.6, stroke: '#000', sw: 0.5 });
  out.push({ t: 'circle', x: holeX, y: h / 2, r: holeR, fill: HOLE }, { t: 'circle', x: w - holeX, y: h / 2, r: holeR, fill: HOLE });
  return out;
}
const powerBtn = (x: number, y: number, r: number): ArtElement[] => [
  { t: 'circle', x, y, r, fill: '#1f2124', stroke: '#9aa0a8', sw: 0.5 },
  { t: 'path', d: `M${x - r * 0.35},${y - r * 0.3} A${r * 0.5},${r * 0.5} 0 1 0 ${x + r * 0.35},${y - r * 0.3}`, stroke: '#ddd', sw: 0.5 },
  { t: 'line', x1: x, y1: y - r * 0.6, x2: x, y2: y - r * 0.05, stroke: '#ddd', sw: 0.5 },
];
const SRC_SHURE = (guide: string, what = 'Front/Back Panel') => `vermessen – Shure ${guide} User Guide (pubs.shure.com), ${what}`;

// ------------------------------------------------------------------ Shure AD-style 1U chassis (ANX4, AD600)
function adChassisFront(model: string, ir: boolean, ventsX: number): ArtElement[] {
  return [
    ...wideEars([37.5, 42.4], 25.5, 6.7),
    logo(46, 5.4, 'Shure', 3.2), T(46, 10.2, model, 3.2),
    { t: 'knob', x: 74.5, y: 14.7, r: 5.2 },
    ...(ir ? [{ t: 'rect', x: 85.3, y: 9.4, w: 7.2, h: 10.8, fill: '#4b4f56' } as ArtElement, { t: 'rect', x: 85.3, y: 27.9, w: 7.2, h: 10.5, fill: '#9aa0a8' } as ArtElement] : []),
    { t: 'vents', x: ventsX, y: 3.9, w: 72.4, h: 35.9, n: 19 },
    { t: 'lcd', x: 176.1, y: 6.1, w: 182.1, h: 32, tint: '#e5f3ff', info: true },
    T(371.5, 5, 'FUNCTION', 1.6, { anchor: 'middle' }),
    ...[7.2, 15.5, 24.3, 32.6].map((y): ArtElement => ({ t: 'button', x: 365.7, y, w: 12.6, h: 5.5 })),
    { t: 'button', x: 384.2, y: 7.2, w: 15, h: 6.9, label: 'ENTER' },
    { t: 'button', x: 384.2, y: 31.4, w: 15, h: 6.7, label: 'EXIT' },
    T(410.7, 5, 'CONTROL', 1.6, { anchor: 'middle' }), { t: 'knob', x: 410.7, y: 21.5, r: 10 },
    T(433.5, 5, 'POWER', 1.6, { anchor: 'middle' }), { t: 'switch', x: 428.4, y: 12.7, w: 10.2, h: 22.7 },
  ];
}
const adChassisRearArt = (bncLabels: [string, number][]): ArtElement[] => [
  T(20.5, 30, 'AC Power', 2.2),
  { t: 'rect', x: 32, y: 4, w: 39, h: 34, rx: 0.8, stroke: '#9aa0a8' },
  { t: 'rect', x: 57, y: 9, w: 9, h: 24, rx: 1, fill: '#1a1b1e', stroke: '#9aa0a8' },
  { t: 'rect', x: 73, y: 4, w: 37, h: 34, rx: 0.8, stroke: '#9aa0a8' },
  T(125, 22, 'PoE', 2.4, { anchor: 'middle' }),
  ...bncLabels.map(([l, x]) => T(x - 7, 13, l, 2.6, { weight: 700 })),
  { t: 'vents', x: 345.9, y: 5.4, w: 108.3, h: 5.5, n: 20 },
];
const adChassisRearPorts = (): Port[] => [
  p('Power In', 'IEC_C14', 'rear', 44.9, 20, 'in'), p('Power Thru', 'IEC_C13', 'rear', 91.3, 20, 'out'),
  p('Ctrl 1', 'RJ45', 'rear', 135.9, 13.1, 'io'), p('Dante 1', 'RJ45', 'rear', 157.2, 13.1, 'io'),
  p('Ctrl 2', 'RJ45', 'rear', 135.9, 31.1, 'io'), p('Dante 2', 'RJ45', 'rear', 157.2, 31.1, 'io'),
  p('USB', 'USB', 'rear', 187.9, 34.5, 'io'),
];

// ------------------------------------------------------------------ SLX-D / SLX-D+ fronts (measured)
function slxdHalfFront(): ArtElement[] {
  return [
    logo(29.5, 6, 'Shure', 3), { t: 'leds', x: 35, y: 21.3, n: 1, colors: [OFF], r: 0.7 }, T(35, 27.5, 'IR', 1.6, { anchor: 'middle' }),
    { t: 'rect', x: 31.6, y: 29.8, w: 8, h: 4, fill: '#4b4f56' },
    { t: 'lcd', x: 46, y: 16.2, w: 69.2, h: 18.6, tint: '#e5f3ff', info: true },
    { t: 'line', x1: 120.6, y1: 0.8, x2: 120.6, y2: 42.8, stroke: '#000', sw: 0.6 },
    { t: 'button', x: 130.2, y: 13.3, w: 13, h: 5.4, label: 'exit' },
    { t: 'button', x: 130.2, y: 24.9, w: 13, h: 5.3, label: 'sync' },
    T(150, 23.5, 'push –', 1.5), { t: 'knob', x: 168.7, y: 22.9, r: 8.8 },
    ...powerBtn(204.3, 22, 6.5),
    { t: 'labelArea', x: 46, y: 6.5, w: 40, h: 5 },
  ];
}
/** SLXD4Q+ / SLXD4D: 393 mm body centred in the 19" slot (offset 44.8 mm), two display sections */
function slxdWideFront(): ArtElement[] {
  return [
    logo(50, 6, 'Shure', 3), { t: 'leds', x: 57.7, y: 21.1, n: 1, colors: [OFF], r: 0.7 }, { t: 'rect', x: 53, y: 28.9, w: 9.8, h: 4.8, fill: '#4b4f56' },
    { t: 'lcd', x: 68.5, y: 16.3, w: 69.1, h: 18.4, tint: '#e5f3ff', info: true },
    { t: 'line', x1: 143.3, y1: 0.8, x2: 143.3, y2: 42.8, stroke: '#000', sw: 0.6 },
    { t: 'button', x: 155, y: 13.3, w: 13.2, h: 5.1, label: 'exit' }, { t: 'button', x: 155, y: 25, w: 13.2, h: 5, label: 'sync' },
    { t: 'knob', x: 190.7, y: 22.6, r: 8.8 },
    { t: 'lcd', x: 264.5, y: 16.3, w: 69.1, h: 18.4, tint: '#e5f3ff', info: true, channel: 3 },
    { t: 'line', x1: 339.8, y1: 0.8, x2: 339.8, y2: 42.8, stroke: '#000', sw: 0.6 },
    { t: 'button', x: 352.6, y: 11.8, w: 12.9, h: 5, label: 'exit' }, { t: 'button', x: 352.6, y: 23.4, w: 12.9, h: 5, label: 'sync' },
    { t: 'knob', x: 388.1, y: 21.4, r: 8.8 },
    ...powerBtn(423.4, 20.1, 6.5),
    { t: 'labelArea', x: 68.5, y: 6.5, w: 45, h: 5 },
  ];
}

// ------------------------------------------------------------------ generic compact receiver front (data-sheet devices)
interface GenFront {
  brand: string; model: string; x0: number; x1: number;
  displays?: { x: number; w: number; tint?: string; ch?: number }[];
  knobs?: { x: number; r?: number }[];
  buttons?: { x: number; y: number; w?: number; label?: string }[];
  power?: number; phones?: boolean; leds?: { x: number; colors: string[] }[]; vents?: { x: number; w: number };
  accent?: string;
}
function genFront(g: GenFront): ArtElement[] {
  const out: ArtElement[] = [logo(g.x0 + 3, 7, g.brand, 3), T(g.x0 + 3, 12, g.model, 2.6)];
  if (g.accent) out.push({ t: 'rect', x: g.x0 + 0.6, y: 40.6, w: g.x1 - g.x0 - 1.2, h: 2.2, fill: g.accent });
  for (const d of g.displays ?? []) out.push({ t: 'lcd', x: d.x, y: 10, w: d.w, h: 24, tint: d.tint ?? '#e5f3ff', info: true, channel: d.ch });
  for (const k of g.knobs ?? []) out.push({ t: 'knob', x: k.x, y: 22, r: k.r ?? 7.5 });
  for (const b of g.buttons ?? []) out.push({ t: 'button', x: b.x, y: b.y, w: b.w ?? 9, h: 5.4, label: b.label });
  for (const l of g.leds ?? []) out.push({ t: 'leds', x: l.x, y: 12, n: l.colors.length, dy: 3.6, colors: l.colors, r: 0.9 });
  if (g.vents) out.push({ t: 'vents', x: g.vents.x, y: 6, w: g.vents.w, h: 31, n: Math.max(4, Math.round(g.vents.w / 4)) });
  if (g.power) out.push(...powerBtn(g.power, 22, 5.5));
  out.push({ t: 'labelArea', x: g.x0 + 3, y: 35, w: Math.min(40, (g.x1 - g.x0) * 0.3), h: 4.6 });
  return out;
}

const PORTABLE = 'Portabel (Rackwanne)';
const portableNote = 'Portables Gerät – im Rack auf Fachboden/Rackwanne; als 1/3-Breite 1 HE dargestellt.';
function portable(id: string, man: string, name: string, bodyWidth: number, color: string, ports: Port[], extra: Partial<DeviceTemplate> = {}): DeviceTemplate {
  return dev({
    id, name, manufacturer: man, category: PORTABLE, heightU: 1, slots: 3, bodyWidth, depth: 120, color, fields: UHF_FIELDS,
    notes: portableNote, source: 'Datenblatt – Anschlüsse laut Herstellerangaben, Positionen geschätzt',
    ports,
    art: { front: [logo(80.45 - bodyWidth / 2 + 2, 7, man, 2.4), T(80.45 - bodyWidth / 2 + 2, 11.5, name, 2), { t: 'lcd', x: 80.45 - bodyWidth / 2 + 4, y: 15, w: bodyWidth - 8, h: 18, info: true }] },
    ...extra,
  });
}
const C = 80.45; // centre of a third-width slot

export const RFSCAN_DEVICES: DeviceTemplate[] = [
  // ===================================================================================== Shure
  dev({
    id: 'shure-anx4', name: 'ANX4', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 286, color: '#222428', earWidth: 42,
    fields: UHF_FIELDS, weight: 3.9, power: 30, source: SRC_SHURE('ANX4'),
    notes: 'Netzwerk-Empfänger 4 Kanäle (ULX-D bis 24 / Axient Digital bis 16 Kanäle über Dante). Antenneneingänge A–D.',
    ports: [
      p('Phones', 'JACK', 'front', 74, 31.2, 'out'), ...adChassisRearPorts(),
      p('Ant D', 'BNC', 'rear', 362.1, 25.6, 'in'), p('Ant C', 'BNC', 'rear', 390.4, 25.6, 'in'),
      p('Ant B', 'BNC', 'rear', 418.8, 25.6, 'in'), p('Ant A', 'BNC', 'rear', 447.4, 25.6, 'in'),
    ],
    art: { front: adChassisFront('ANX4', true, 96.5), rear: [...adChassisRearArt([['D', 362.1], ['C', 390.4], ['B', 418.8], ['A', 447.4]]), { t: 'vents', x: 196, y: 5, w: 144, h: 33, n: 32 }] },
  }),
  dev({
    id: 'shure-ad600', name: 'AD600 Spectrum Manager', manufacturer: 'Shure', category: 'HF Messtechnik', heightU: 1, slots: 1, depth: 286, color: '#222428', earWidth: 42,
    weight: 3.7, source: SRC_SHURE('AD600'), notes: 'Spectrum Manager für Axient Digital, 6 HF-Eingänge A–F.',
    ports: [
      p('Phones', 'JACK', 'front', 74, 31.6, 'out'), ...adChassisRearPorts(),
      ...(['F', 'E', 'D', 'C', 'B', 'A'] as const).map((l, i) => p(`RF In ${l}`, 'BNC', 'rear', [305.4, 333.8, 362.1, 390.4, 418.8, 447.4][i], 25, 'in')),
    ],
    art: { front: adChassisFront('AD600', false, 88.5), rear: [...adChassisRearArt([['F', 305.4], ['E', 333.8], ['D', 362.1], ['C', 390.4], ['B', 418.8], ['A', 447.4]]), { t: 'vents', x: 196, y: 5, w: 92, h: 33, n: 20 }] },
  }),
  dev({
    id: 'shure-axt600', name: 'AXT600 Spectrum Manager', manufacturer: 'Shure', category: 'HF Messtechnik', heightU: 1, slots: 1, depth: 366, color: '#222428', earWidth: 40,
    weight: 5.5, source: SRC_SHURE('AXT600', 'Front Panel / Rear Panel'), notes: 'Axient Spectrum Manager.',
    ports: [
      p('Phones', 'JACK', 'front', 404.7, 29.7, 'out'),
      p('Power In', 'IEC_C14', 'rear', 76, 20.6, 'in'), p('Power Out', 'IEC_C13', 'rear', 119, 20.6, 'out'),
      p('Network 1', 'RJ45', 'rear', 165.2, 16.4, 'io'), p('Network 2', 'RJ45', 'rear', 165.2, 29.3, 'io'),
      p('Ant B In', 'BNC', 'rear', 402, 12, 'in'), p('Ant A In', 'BNC', 'rear', 433.8, 12, 'in'),
      p('B Cascade Out', 'BNC', 'rear', 402, 30.5, 'out'), p('A Cascade Out', 'BNC', 'rear', 433.8, 30.5, 'out'),
    ],
    art: {
      front: [
        ...wideEars([35.2, 40.1], 24.4, 6.6), logo(46, 5.6, 'Shure', 3.4), T(46, 10.8, 'AXT600', 3), T(46, 35, 'Spectrum Manager', 2),
        { t: 'rect', x: 77.8, y: 8.7, w: 130.9, h: 28.1, rx: 1.2, stroke: '#4b4f56', sw: 0.5 },
        { t: 'lcd', x: 122.8, y: 10.9, w: 67.5, h: 23.7, tint: '#e5f3ff', info: true }, T(201, 7, 'navigate', 1.6, { anchor: 'middle' }),
        ...[11.3, 17.8, 24.3, 30.8].map((y): ArtElement => ({ t: 'button', x: 196.6, y, w: 9.4, h: 3.4 })),
        { t: 'rect', x: 216.3, y: 8.7, w: 130.7, h: 28.1, rx: 1.2, stroke: '#4b4f56', sw: 0.5 },
        { t: 'lcd', x: 261.6, y: 10.9, w: 67.2, h: 23.7, tint: '#e5f3ff', info: true, channel: 2 },
        ...[11.3, 17.8, 24.3, 30.8].map((y): ArtElement => ({ t: 'button', x: 334.8, y, w: 9.5, h: 3.4 })),
        { t: 'button', x: 351.3, y: 12.8, w: 10.3, h: 6, label: 'enter' }, { t: 'button', x: 351.3, y: 25.4, w: 10.3, h: 6, label: 'exit' },
        { t: 'knob', x: 374.6, y: 21, r: 10.5 },
        { t: 'leds', x: 391.7, y: 9.3, n: 3, dy: 8.8, colors: [RED, GREEN, OFF], r: 0.9 }, { t: 'knob', x: 405.8, y: 14.2, r: 6.3 },
        { t: 'switch', x: 423.4, y: 6.5, w: 14.7, h: 30.3 },
      ],
      rear: [{ t: 'switch', x: 28.3, y: 6, w: 29.4, h: 31 }, logo(20, 4, 'Shure', 2.4), { t: 'rect', x: 394, y: 3, w: 72, h: 38, rx: 1, stroke: '#9aa0a8' },
        T(450, 6.5, 'antenna in', 1.5), T(450, 38, 'cascade out', 1.5)],
    },
  }),
  ...(['ADTQ', 'ADTD'] as const).map((m) => {
    const quad = m === 'ADTQ';
    const inputs = quad ? [4, 3, 2, 1] : [2, 1];
    const xs = quad ? [180, 206, 232.1, 258.2, 284.2, 310, 336.1, 361.5] : [284.2, 310, 336.1, 361.5];
    return dev({
      id: `shure-${m.toLowerCase()}`, name: `${m} (Axient Digital PSM)`, manufacturer: 'Shure', category: 'IEM Sender', heightU: 1, slots: 1, depth: 385, color: '#222428', earWidth: 40,
      fields: UHF_FIELDS, weight: 4.7, power: 60, source: SRC_SHURE('Axient Digital PSM (ADPSM)', 'Transmitter Front/Back Panel'),
      notes: `${quad ? 'Vierfach' : 'Doppel'}-Sender Axient Digital PSM. Eingänge XLR/6,3-mm-Combo (analog oder AES3).`,
      ports: [
        p('Phones', 'JACK', 'front', 142.5, 33.4, 'out'),
        p('Power In', 'IEC_C14', 'rear', 68.9, 23.7, 'in'), p('Power Thru', 'IEC_C13', 'rear', 106.1, 23.7, 'out'),
        p('Ctrl 1', 'RJ45', 'rear', 139, 15.8, 'io'), p('Dante 1', 'RJ45', 'rear', 155.8, 15.8, 'io'),
        p('Ctrl 2', 'RJ45', 'rear', 139, 30, 'io'), p('Dante 2', 'RJ45', 'rear', 155.8, 30, 'io'),
        ...inputs.flatMap((n, i) => [p(`TX${n} In L`, 'COMBO', 'rear', xs[i * 2], 22.1, 'in'), p(`TX${n} In R`, 'COMBO', 'rear', xs[i * 2 + 1], 22.1, 'in')]),
        p('RF Out B', 'BNC', 'rear', 393.5, 12, 'out'), p('RF Out A', 'BNC', 'rear', 423, 12, 'out'),
        ...(quad ? [p('RF Out D', 'BNC', 'rear', 393.5, 29.1, 'out'), p('RF Out C', 'BNC', 'rear', 423, 29.1, 'out')] : []),
      ],
      art: {
        front: [
          ...wideEars([35.5, 40.5], 27.8, 6.8), logo(46, 4.4, 'Shure', 3), T(72, 4.4, m, 2.8),
          { t: 'vents', x: 42, y: 6, w: 90, h: 35, n: 5, horizontal: true },
          { t: 'knob', x: 142.5, y: 18.5, r: 5.6 },
          { t: 'rect', x: 153.6, y: 11.4, w: 6.6, h: 9.1, fill: '#4b4f56' }, { t: 'rect', x: 153.6, y: 28.5, w: 6.6, h: 9.4, fill: '#9aa0a8' },
          T(176.7, 5, 'RF', 1.8, { anchor: 'middle' }), { t: 'switch', x: 171.6, y: 12, w: 10.3, h: 20.8 },
          { t: 'lcd', x: 189.4, y: 11.1, w: 163.3, h: 27.4, tint: '#e5f3ff', info: true },
          T(368.8, 5, 'FUNCTION', 1.6, { anchor: 'middle' }),
          ...[10.8, 18, 25.4, 32.8].map((y): ArtElement => ({ t: 'button', x: 363.8, y, w: 10, h: 3.7 })),
          { t: 'button', x: 380.2, y: 10.3, w: 12.2, h: 6.2, label: 'ENTER' }, { t: 'button', x: 380.2, y: 31.4, w: 12.2, h: 6.3, label: 'EXIT' },
          T(405.7, 5, 'CONTROL', 1.6, { anchor: 'middle' }), { t: 'knob', x: 405.7, y: 24.3, r: 11.2 },
          { t: 'line', x1: 421.5, y1: 1, x2: 421.5, y2: 42.6, stroke: '#000', sw: 0.5 },
          T(431.5, 5, 'POWER', 1.6, { anchor: 'middle' }), { t: 'switch', x: 426.3, y: 12, w: 10.5, h: 20.8 },
        ],
        rear: [T(60, 34, 'AC Power', 1.6), { t: 'rect', x: 82, y: 11, w: 10, h: 18, rx: 1, fill: '#1a1b1e', stroke: '#9aa0a8' },
          ...inputs.map((n, i) => T((xs[i * 2] + xs[i * 2 + 1]) / 2, 4.6, `L  transmitter ${n}  R`, 1.6, { anchor: 'middle' })),
          T(382, 41, 'analog / AES3', 1.4, { anchor: 'middle' })],
      },
    });
  }),
  dev({
    id: 'shure-qlxd4', name: 'QLXD4', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 197, depth: 151, color: '#2b2d31',
    fields: UHF_FIELDS, weight: 0.78, power: 12, source: SRC_SHURE('QLX-D', 'Receiver Front and Back Panels'),
    notes: 'Halbe 19"-Breite. Versorgung 15 V DC (PS45).',
    ports: [
      p('DC In', 'DC', 'rear', 44.2, 29.5, 'in'), p('Ethernet', 'RJ45', 'rear', 60.9, 26.6, 'io'),
      p('Ant B', 'BNC', 'rear', 90.6, 28.5, 'in'), p('Audio Out', 'XLR3M', 'rear', 142, 22, 'out'),
      p('Inst/Aux Out', 'JACK', 'rear', 165.9, 28.1, 'out'), p('Ant A', 'BNC', 'rear', 196.8, 28.5, 'in'),
    ],
    art: {
      front: [
        logo(30, 8, 'Shure', 3.2), T(30, 12.5, 'QLXD4', 2.6),
        { t: 'rect', x: 75.7, y: 5.9, w: 101.6, h: 26.9, rx: 1, stroke: '#6b7078', sw: 0.6 },
        { t: 'lcd', x: 78.7, y: 8.2, w: 51.3, h: 22.2, tint: '#e5f3ff', info: true },
        { t: 'button', x: 138.3, y: 10.3, w: 9.3, h: 4.7 }, triUp(143, 12.7, 1.3), { t: 'button', x: 138.3, y: 23.6, w: 9.3, h: 5.1 }, triDown(143, 26.2, 1.3),
        { t: 'button', x: 151, y: 10.3, w: 9.1, h: 4.7, label: 'menu' }, { t: 'button', x: 151, y: 23.6, w: 9.1, h: 5.1, label: 'enter' },
        { t: 'rect', x: 163.4, y: 10.3, w: 9.2, h: 4.7, fill: '#6b7078' }, { t: 'button', x: 163.4, y: 23.6, w: 9.2, h: 5.1, label: 'sync' },
        { t: 'leds', x: 143, y: 19.1, n: 3, dx: 12.6, colors: [GREEN, BLUE, AMBER], r: 0.8 },
        ...powerBtn(197.1, 20.9, 6),
        { t: 'labelArea', x: 30, y: 30, w: 38, h: 4.6 },
      ],
      rear: [logo(30, 7, 'Shure', 2.8), T(52, 7, 'QLXD4', 2.2), { t: 'rect', x: 26, y: 13, w: 7, h: 16, rx: 1, fill: '#111' },
        { t: 'rect', x: 116, y: 22, w: 9, h: 4, rx: 0.6, fill: '#111', stroke: '#9aa0a8' }, T(120.5, 40, 'mic / line', 1.5, { anchor: 'middle' })],
    },
  }),
  dev({
    id: 'shure-slxd4', name: 'SLXD4', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 197, depth: 152, color: '#2b2d31',
    fields: UHF_FIELDS, weight: 0.82, power: 12, source: SRC_SHURE('SLX-D', 'SLXD4 Hardware Callouts'), notes: 'Halbe 19"-Breite. Versorgung 15 V DC.',
    ports: [
      p('Ant B', 'BNC', 'rear', 35, 25.7, 'in'), p('DC In', 'DC', 'rear', 60.5, 25.2, 'in'), p('Ethernet', 'RJ45', 'rear', 82.5, 25.2, 'io'),
      p('Audio Out', 'XLR3M', 'rear', 135.9, 19, 'out'), p('Inst/Aux Out', 'JACK', 'rear', 162.7, 25.7, 'out'), p('Ant A', 'BNC', 'rear', 203.4, 25.7, 'in'),
    ],
    art: { front: slxdHalfFront(), rear: [T(35, 8, 'antenna B', 2, { anchor: 'middle' }), T(203.4, 8, 'antenna A', 2, { anchor: 'middle' })] },
  }),
  dev({
    id: 'shure-slxd4d', name: 'SLXD4D', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 1, bodyWidth: 393, depth: 152, color: '#2b2d31',
    fields: UHF_FIELDS, power: 20, source: 'abgeleitet – Gehäuse SLXD4Q+ (393 mm, vermessen); Ausgänge 1/2 laut SLX-D User Guide, Positionen geschätzt',
    notes: 'Doppelempfänger, 393 mm breit (mit Rackwinkeln 19").',
    ports: [
      p('Ant B', 'BNC', 'rear', 62.8, 25.3, 'in'), p('DC In', 'DC', 'rear', 119.8, 21.8, 'in'),
      p('Out 2', 'XLR3M', 'rear', 170, 18.3, 'out'), p('Out 2 Jack', 'JACK', 'rear', 195, 26.5, 'out'),
      p('Ethernet', 'RJ45', 'rear', 247.6, 24.1, 'io'),
      p('Out 1', 'XLR3M', 'rear', 300, 18.3, 'out'), p('Out 1 Jack', 'JACK', 'rear', 325, 26.5, 'out'),
      p('Ant A', 'BNC', 'rear', 419.5, 25.3, 'in'),
    ],
    art: { front: slxdWideFront() },
  }),
  dev({
    id: 'shure-slxd4plus', name: 'SLXD4+', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 197, depth: 152, color: '#2b2d31',
    fields: UHF_FIELDS, power: 12, source: SRC_SHURE('SLXD4+/SLXD4D+', 'Receiver Front/Back'),
    ports: [
      p('Ant B', 'BNC', 'rear', 38.8, 27.5, 'in'), p('DC In', 'DC', 'rear', 63.4, 26.8, 'in'), p('Ethernet', 'RJ45', 'rear', 84.2, 27.2, 'io'),
      p('Audio Out', 'XLR3M', 'rear', 135.5, 19.8, 'out'), p('Inst/Aux Out', 'JACK', 'rear', 161, 27.5, 'out'), p('Ant A', 'BNC', 'rear', 200, 27.5, 'in'),
    ],
    art: { front: slxdHalfFront(), rear: [T(38.8, 8, 'antenna B', 2, { anchor: 'middle' }), T(200, 8, 'antenna A', 2, { anchor: 'middle' })] },
  }),
  dev({
    id: 'shure-slxd4dplus', name: 'SLXD4D+', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 197, depth: 152, color: '#2b2d31',
    fields: UHF_FIELDS, power: 15, source: 'abgeleitet – Gehäuse SLXD4+ (vermessen, gleiche Maße laut Guide); zweiter XLR-Ausgang geschätzt',
    ports: [
      p('Ant B', 'BNC', 'rear', 38.8, 27.5, 'in'), p('DC In', 'DC', 'rear', 63.4, 26.8, 'in'), p('Ethernet', 'RJ45', 'rear', 84.2, 27.2, 'io'),
      p('Out 2', 'XLR3M', 'rear', 120, 19.8, 'out'), p('Out 1', 'XLR3M', 'rear', 150, 19.8, 'out'), p('Ant A', 'BNC', 'rear', 200, 27.5, 'in'),
    ],
    art: { front: slxdHalfFront() },
  }),
  ...(['SLXD4Q+', 'SLXD4QDAN+'] as const).map((m) => dev({
    id: m === 'SLXD4Q+' ? 'shure-slxd4qplus' : 'shure-slxd4qdanplus', name: m, manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 1, bodyWidth: 393, depth: 152, color: '#2b2d31',
    fields: UHF_FIELDS, weight: 1.75, power: 25,
    source: m === 'SLXD4Q+' ? SRC_SHURE('SLXD4Q+', 'SLXD4Q+ Receiver') : 'abgeleitet – Gehäuse SLXD4Q+ (vermessen); Netzwerkbuchsen als Dante Primary/Secondary',
    notes: 'Vierfach-Empfänger, 393 mm breit (mit Rackwinkeln 19"). Versorgung PS60 (DC).',
    ports: [
      p('Ant B', 'BNC', 'rear', 62.8, 25.3, 'in'), p('B Cascade', 'BNC', 'rear', 90.8, 25.3, 'out'), p('DC In', 'DC', 'rear', 119.8, 21.8, 'in'),
      p('Out 4', 'XLR3M', 'rear', 149.5, 18.3, 'out'), p('Out 4 Jack', 'JACK', 'rear', 174.3, 26.5, 'out'),
      p('Out 3', 'XLR3M', 'rear', 199.5, 18.3, 'out'), p('Out 3 Jack', 'JACK', 'rear', 224.4, 26.5, 'out'),
      p(m === 'SLXD4Q+' ? 'Network 1' : 'Dante Primary', 'RJ45', 'rear', 247.6, 24.1, 'io'), p(m === 'SLXD4Q+' ? 'Network 2' : 'Dante Secondary', 'RJ45', 'rear', 262.5, 24.1, 'io'),
      p('Out 2', 'XLR3M', 'rear', 291.3, 18.3, 'out'), p('Out 2 Jack', 'JACK', 'rear', 316.2, 26.5, 'out'),
      p('Out 1', 'XLR3M', 'rear', 341.4, 18.3, 'out'), p('Out 1 Jack', 'JACK', 'rear', 366.1, 26.5, 'out'),
      p('A Cascade', 'BNC', 'rear', 391.2, 25.3, 'out'), p('Ant A', 'BNC', 'rear', 419.5, 25.3, 'in'),
    ],
    art: { front: slxdWideFront() },
  })),
  portable('shure-slxd5plus', 'Shure', 'SLXD5+', 66, '#2b2d31', [p('Audio Out', 'MINIJACK', 'rear', C - 18, 22, 'out'), p('Audio Out XLR (TA3)', 'GENERIC', 'rear', C, 22, 'out'), p('USB-C', 'USB', 'rear', C + 18, 22, 'io')]),
  dev({
    id: 'shure-blx4', name: 'BLX4', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 188, depth: 103, color: '#26272a',
    fields: UHF_FIELDS, weight: 0.24, power: 3, source: SRC_SHURE('BLX', 'Front/Back Panel BLX4'), notes: 'Tischempfänger, im Rack mit URT2-Kit. Versorgung 12–15 V DC.',
    ports: [p('DC In', 'DC', 'rear', 63.9, 24.6, 'in'), p('Mic Out', 'XLR3M', 'rear', 122.3, 17, 'out'), p('Instrument Out', 'JACK', 'rear', 150.7, 23.1, 'out')],
    art: {
      front: [logo(56, 12, 'Shure', 3.6), T(56, 17, 'BLX4', 2.2), { t: 'leds', x: 89.8, y: 24.4, n: 2, dx: 13.9, colors: [GREEN, GREEN], r: 0.8 },
        T(89.8, 19.5, 'audio', 1.6, { anchor: 'middle' }), T(103.7, 19.5, 'ready', 1.6, { anchor: 'middle' }),
        { t: 'lcd', x: 112.4, y: 12.4, w: 17.7, h: 22.2, tint: '#fca5a5' },
        { t: 'button', x: 136.8, y: 20.5, w: 7.8, h: 7.8, round: true }, { t: 'button', x: 151.7, y: 20.5, w: 7.8, h: 7.8, round: true },
        T(140.7, 17, 'group', 1.5, { anchor: 'middle' }), T(155.6, 17, 'channel', 1.5, { anchor: 'middle' }), ...powerBtn(174.4, 24.4, 7.2),
        { t: 'labelArea', x: 56, y: 33, w: 30, h: 4.5 }],
      rear: [{ t: 'rect', x: 73, y: 16, w: 7, h: 16, rx: 1.5, fill: '#111' }, { t: 'rect', x: 165, y: 10, w: 34, h: 20, rx: 0.6, stroke: '#6b7078' }],
    },
  }),
  dev({
    id: 'shure-blx88', name: 'BLX88', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 160, color: '#26272a',
    fields: UHF_FIELDS, power: 5, source: SRC_SHURE('BLX', 'Front/Back Panel BLX88'), notes: 'Doppelempfänger. Versorgung 12–15 V DC. Rückseite links = Kanal 2 (von vorne rechts).',
    ports: [
      p('Mic Out 2', 'XLR3M', 'rear', 153, 17, 'out'), p('Instrument Out 2', 'JACK', 'rear', 195.2, 26.8, 'out'), p('DC In', 'DC', 'rear', 251.7, 26.8, 'in'),
      p('Mic Out 1', 'XLR3M', 'rear', 302.9, 17, 'out'), p('Instrument Out 1', 'JACK', 'rear', 350, 26.8, 'out'),
    ],
    art: {
      front: [logo(60, 14, 'Shure', 3.6), T(60, 19, 'BLX88', 2.2),
        ...[0, 190.4].flatMap((dx): ArtElement[] => [
          { t: 'leds', x: 101.4 + dx, y: 23.2, n: 2, dx: 19.6, colors: [GREEN, GREEN], r: 0.9 },
          { t: 'lcd', x: 133.5 + dx, y: 15.7, w: 24.1, h: 17.5, tint: '#fca5a5' },
          { t: 'button', x: 168.2 + dx, y: 20.5, w: 9, h: 9, round: true }, { t: 'button', x: 188.3 + dx, y: 20.5, w: 9, h: 9, round: true },
        ]),
        ...powerBtn(409.8, 24, 8), { t: 'labelArea', x: 60, y: 32, w: 30, h: 4.6 }],
      rear: [{ t: 'rect', x: 222, y: 18, w: 8, h: 16, rx: 1.5, fill: '#111' }, { t: 'rect', x: 365, y: 8, w: 50, h: 22, rx: 0.6, stroke: '#6b7078' }],
    },
  }),
  dev({
    id: 'shure-p9t', name: 'P9T (PSM 900)', manufacturer: 'Shure', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 197, depth: 177, color: '#26282c',
    fields: UHF_FIELDS, power: 8, source: SRC_SHURE('PSM900', 'Front Panel Controls / Rear Panel Connectors'), notes: 'Halbe 19"-Breite. Versorgung 15 V DC.',
    ports: [
      p('Phones', 'JACK', 'front', 174.9, 31.5, 'out'),
      p('DC In', 'DC', 'rear', 50.5, 26.3, 'in'), p('Loop Out L', 'JACK', 'rear', 98.5, 21.6, 'out'), p('Loop Out R', 'JACK', 'rear', 114.5, 21.6, 'out'),
      p('In L/CH1', 'COMBO', 'rear', 139, 22.3, 'in'), p('In R/CH2', 'COMBO', 'rear', 169.3, 22.3, 'in'), p('RF Out', 'BNC', 'rear', 194.1, 28.6, 'out'),
    ],
    art: {
      front: [logo(30, 4.2, 'Shure', 2.8), T(52, 4.2, 'PSM900 Transmitter P9T', 2), { t: 'labelArea', x: 193.4, y: 1.4, w: 22, h: 3.2 },
        { t: 'button', x: 28, y: 13.8, w: 10.5, h: 7.2 }, triUp(33.2, 17.4), { t: 'button', x: 28, y: 24.3, w: 10.5, h: 7.2 }, triDown(33.2, 27.9),
        { t: 'leds', x: 43.6, y: 12.6, n: 8, dy: 3.1, colors: [RED, YELLOW, GREEN], r: 0.8 }, { t: 'leds', x: 50.8, y: 12.6, n: 8, dy: 3.1, colors: [RED, YELLOW, GREEN], r: 0.8 },
        { t: 'lcd', x: 57.9, y: 12.1, w: 45.9, h: 21, tint: '#fbbf24', info: true },
        { t: 'button', x: 108, y: 13.5, w: 11.2, h: 7, label: 'enter' }, { t: 'button', x: 108, y: 24.7, w: 11.2, h: 7, label: 'exit' },
        { t: 'knob', x: 132.4, y: 22.6, r: 9 }, { t: 'button', x: 149.6, y: 24.9, w: 14.1, h: 9.4, label: 'sync' },
        { t: 'knob', x: 174.9, y: 18.7, r: 5.2 }, { t: 'switch', x: 186.4, y: 12.1, w: 9.7, h: 23.4 }, { t: 'switch', x: 202.8, y: 12.1, w: 10.3, h: 23.4 }],
      rear: [T(30, 9, 'PSM900 Transmitter P9T', 1.8), logo(186, 12, 'Shure', 2.6)],
    },
  }),
  dev({
    id: 'shure-p3t', name: 'P3T (PSM 300)', manufacturer: 'Shure', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 198, depth: 172, color: '#26282c',
    fields: UHF_FIELDS, power: 6, source: 'vermessen – Shure PSM300 User Guide (PDF), P3T Front/Rear Panel', notes: 'Halbe 19"-Breite. Eingänge 6,3 mm TRS.',
    ports: [
      p('DC In', 'DC', 'rear', 39.2, 25.8, 'in'), p('Loop Out L', 'JACK', 'rear', 121.3, 25.8, 'out'), p('Loop Out R', 'JACK', 'rear', 139.2, 25.8, 'out'),
      p('In L/CH1', 'JACK', 'rear', 157.1, 25.8, 'in'), p('In R/CH2', 'JACK', 'rear', 175, 25.8, 'in'), p('Antenna', 'BNC', 'rear', 219, 25.8, 'out'),
    ],
    art: {
      front: [logo(25.5, 5.2, 'Shure', 2.8), T(47, 5.2, 'PSM300 Transmitter P3T', 1.9),
        { t: 'knob', x: 36.7, y: 24.7, r: 5.8 }, T(36.7, 15.5, 'input', 1.6, { anchor: 'middle' }),
        { t: 'leds', x: 56.4, y: 21, n: 1, colors: [GREEN], r: 0.8 }, { t: 'rect', x: 49.9, y: 25.7, w: 13.3, h: 7.8, fill: '#4b4f56' },
        { t: 'button', x: 69.1, y: 20, w: 8.8, h: 8.8, round: true }, { t: 'lcd', x: 94.6, y: 15.6, w: 52.8, h: 22.3, tint: '#e5f3ff', info: true },
        { t: 'button', x: 166.2, y: 20.7, w: 8.8, h: 8.8, round: true }, { t: 'button', x: 180.5, y: 20.7, w: 8.8, h: 8.8, round: true },
        ...powerBtn(203, 25.1, 6.5), { t: 'labelArea', x: 94.6, y: 9.5, w: 40, h: 4.4 }],
      rear: [{ t: 'rect', x: 50, y: 17, w: 5, h: 17, rx: 1.5, fill: '#111' }, { t: 'line', x1: 30, y1: 34.8, x2: 225, y2: 34.8, stroke: '#9aa0a8', sw: 0.3 }],
    },
  }),

  // ================================================================================= Sennheiser
  dev({
    id: 'senn-em6000dante', name: 'EM 6000 Dante', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 340, color: '#2b2d31',
    fields: UHF_FIELDS, weight: 4.6, power: 32, source: 'vermessen – Sennheiser Digital 6000 Manual, EM6000DANTE_back.svg (perspektivisch, ±5 mm)',
    ports: [
      p('Phones', 'JACK', 'front', 25.1, 28, 'out'),
      p('Power', 'IEC_C14', 'rear', 50.2, 23.4, 'in'),
      p('Dante Secondary', 'ETHERCON', 'rear', 106.5, 22, 'io'), p('Dante Primary', 'ETHERCON', 'rear', 137.9, 22, 'io'),
      p('Ethernet', 'RJ45', 'rear', 162.8, 24.5, 'io'), p('AES3 Out', 'AES-XLR', 'rear', 191, 21.8, 'out'),
      p('Wordclock In', 'BNC75', 'rear', 220, 11, 'in'), p('Wordclock Out', 'BNC75', 'rear', 220, 30, 'out'),
      p('Out 2 Jack', 'JACK', 'rear', 242.5, 29, 'out'), p('Out 2', 'XLR3M', 'rear', 261, 21, 'out'),
      p('Out 1 Jack', 'JACK', 'rear', 290, 29, 'out'), p('Out 1', 'XLR3M', 'rear', 310.5, 21, 'out'),
      p('Ant A In', 'BNC', 'rear', 347.9, 21, 'in'), p('Ant A Out', 'BNC', 'rear', 374, 21, 'out'),
      p('Ant B Out', 'BNC', 'rear', 405.4, 21, 'out'), p('Ant B In', 'BNC', 'rear', 426.3, 21, 'in'),
    ],
    art: {
      front: [
        { t: 'rect', x: 16, y: 0.5, w: 44.3, h: 42.6, fill: '#b9bcc0' }, { t: 'knob', x: 46, y: 26, r: 5 },
        { t: 'lcd', x: 90.7, y: 8, w: 93.3, h: 25, tint: '#fdba74', info: true, channel: 0 }, { t: 'knob', x: 210.6, y: 22, r: 8.5 },
        { t: 'button', x: 225, y: 9, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 238.5, y: 9, w: 8, h: 8, label: 'SAVE', round: true },
        { t: 'button', x: 225, y: 26, w: 8, h: 8, label: 'SYNC', round: true }, { t: 'button', x: 238.5, y: 26, w: 8, h: 8, round: true },
        { t: 'lcd', x: 264, y: 8, w: 90.6, h: 25, tint: '#fdba74', info: true, channel: 2 }, { t: 'knob', x: 386.6, y: 22, r: 8.5 },
        { t: 'button', x: 400, y: 9, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 413.5, y: 9, w: 8, h: 8, label: 'SAVE', round: true },
        { t: 'button', x: 400, y: 26, w: 8, h: 8, label: 'SYNC', round: true }, { t: 'button', x: 413.5, y: 26, w: 8, h: 8, round: true },
        { t: 'button', x: 440, y: 7, w: 8, h: 8, round: true, fill: '#3a1d1d' },
        T(446, 39, 'Digital 6000 · Dante', 1.6, { anchor: 'end' }), T(446, 35.6, 'SENNHEISER', 1.8, { anchor: 'end', weight: 700, spacing: 0.3 }),
        { t: 'labelArea', x: 120, y: 35.5, w: 40, h: 5 },
      ],
      rear: [{ t: 'rect', x: 92, y: 3, w: 60, h: 38, rx: 1, stroke: '#6b7078' }, T(122, 40, 'Dante', 1.8, { anchor: 'middle' }),
        { t: 'rect', x: 336, y: 3, w: 53, h: 38, rx: 1, stroke: '#6b7078' }, T(361, 39.5, 'A', 2.8, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 392, y: 3, w: 50, h: 38, rx: 1, stroke: '#6b7078' }, T(416, 39.5, 'B', 2.8, { anchor: 'middle', weight: 700 })],
    },
  }),
  ...(['EW-DX EM 2', 'EW-DX EM 2 Dante', 'EW-DX EM 4 Dante'] as const).map((m) => {
    const dante = m.includes('Dante');
    const quad = m.includes('EM 4');
    const outs = quad ? [4, 3, 2, 1] : [2, 1];
    const outX = quad ? [205, 235, 265, 295] : [245, 280];
    return dev({
      id: `senn-${m.toLowerCase().replace(/[^a-z0-9]+/g, '')}`, name: m, manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 225, color: '#2b2d31',
      fields: UHF_FIELDS, power: quad ? 30 : 20,
      source: 'Datenblatt – Sennheiser EW-DX Quick Guide / Manual (Anschlüsse), Positionen nach Kurzanleitungs-Zeichnung geschätzt',
      notes: `${quad ? 'Vierfach' : 'Doppel'}-Empfänger Evolution Wireless Digital${dante ? ' mit Dante' : ''}. Versorgung über Netzteil (DC, Zugentlastung).`,
      ports: [
        p('Phones', 'JACK', 'front', 26, 30, 'out'),
        p('Network', 'RJ45', 'rear', 60, 24, 'io'),
        ...(dante ? [p('Dante Primary', 'RJ45', 'rear', 84, 16, 'io'), p('Dante Secondary', 'RJ45', 'rear', 84, 31, 'io')] : []),
        ...(!quad ? [p('Out 2 Jack', 'JACK', 'rear', 220, 29, 'out')] : []),
        ...outs.map((o, i) => p(`Out ${o}`, 'XLR3M', 'rear', outX[i], 21, 'out')),
        ...(!quad ? [p('Out 1 Jack', 'JACK', 'rear', 305, 29, 'out')] : []),
        p('Ant A In', 'BNC', 'rear', 345, 15, 'in'), p('Ant A Out', 'BNC', 'rear', 345, 32, 'out'),
        p('Ant B In', 'BNC', 'rear', 405, 15, 'in'), p('Ant B Out', 'BNC', 'rear', 405, 32, 'out'),
        p('DC In', 'DC', 'rear', 440, 24, 'in'),
      ],
      art: {
        front: [
          { t: 'rect', x: 16, y: 0.5, w: 30, h: 42.6, fill: '#e5e7eb' }, { t: 'knob', x: 38, y: 30, r: 4 },
          ...(quad ? [0, 200] : [0]).flatMap((dx, i): ArtElement[] => [
            { t: 'leds', x: 60 + dx, y: 14, n: 2, dy: 14, colors: [GREEN, GREEN], r: 0.8 },
            { t: 'button', x: 64 + dx, y: 10, w: 7, h: 7, round: true, label: String(i * 2 + 1) }, { t: 'button', x: 64 + dx, y: 26, w: 7, h: 7, round: true, label: String(i * 2 + 2) },
            { t: 'lcd', x: 80 + dx, y: 8, w: 70, h: 27, tint: '#e0f2fe', info: true, channel: i === 0 ? 0 : 3 },
            { t: 'knob', x: 165 + dx, y: 22, r: 8 },
            { t: 'button', x: 178 + dx, y: 9, w: 8, h: 8, round: true, label: 'SET', fill: '#1e3a8a' }, { t: 'button', x: 178 + dx, y: 26, w: 8, h: 8, round: true, label: 'ESC' },
          ]),
          { t: 'button', x: 445, y: 18, w: 8, h: 8, round: true, fill: '#3a1d1d' },
          T(452, 39.5, 'EW-DX  SENNHEISER', 1.7, { anchor: 'end', weight: 700 }), { t: 'labelArea', x: 80, y: 37, w: 50, h: 4.6 },
        ],
        rear: [{ t: 'rect', x: 450, y: 6, w: 10, h: 10, rx: 1, fill: '#111' }],
      },
    });
  }),
  dev({
    id: 'senn-ewd-em', name: 'EW-D EM', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 200, depth: 160, color: '#2b2d31',
    fields: UHF_FIELDS, power: 6, source: 'Datenblatt – Sennheiser EW-D Manual (Anschlüsse), Positionen geschätzt', notes: 'Halbe 19"-Breite (Rackkit). Versorgung NT 12-5 CW (DC).',
    ports: [p('Ant B', 'BNC', 'rear', 32, 26, 'in'), p('DC In', 'DC', 'rear', 60, 26, 'in'), p('Audio Out', 'XLR3M', 'rear', 140, 21, 'out'), p('Line Out', 'JACK', 'rear', 170, 27, 'out'), p('Ant A', 'BNC', 'rear', 208, 26, 'in')],
    art: { front: genFront({ brand: 'Sennheiser', model: 'EW-D EM', x0: 20.6, x1: 220.6, displays: [{ x: 70, w: 70 }], knobs: [{ x: 160 }], buttons: [{ x: 174, y: 12, label: 'SYNC' }], power: 204 }) },
  }),
  dev({
    id: 'senn-spectera-bs', name: 'Spectera Base Station', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 440, color: '#1f2124',
    fields: ['WMAS-Block', 'Kanal / Name'], power: 120,
    source: 'Datenblatt – Sennheiser Spectera Base Station Quick Guide (Übersicht: 2 Netzteile, 4× robuste RJ45-Antennenports), Positionen geschätzt',
    notes: 'WMAS-Basisstation (8 MHz Block, bis 32 Links). Antennen (DAD) über robuste RJ45/etherCON, Dante und MADI optional.',
    ports: [
      p('Phones', 'JACK', 'front', 36, 22, 'out'),
      p('PSU 1', 'IEC_C14', 'rear', 50, 21, 'in'), p('PSU 2', 'IEC_C14', 'rear', 88, 21, 'in'),
      ...['A', 'B', 'C', 'D'].map((l, i) => p(`Antenna ${l}`, 'ETHERCON', 'rear', 125 + i * 28, 22, 'io')),
      p('Dante Primary', 'RJ45', 'rear', 255, 15, 'io'), p('Dante Secondary', 'RJ45', 'rear', 255, 30, 'io'),
      p('Control', 'RJ45', 'rear', 278, 22, 'io'), p('Wordclock In', 'BNC75', 'rear', 305, 22, 'in'),
      p('MADI', 'OPTICALCON', 'rear', 340, 22, 'io'),
    ],
    art: {
      front: [{ t: 'rect', x: 18, y: 2, w: 40, h: 39.6, rx: 1, fill: '#2b2d31' }, { t: 'knob', x: 50, y: 22, r: 4.5 },
        { t: 'vents', x: 70, y: 6, w: 210, h: 31, n: 6, horizontal: true },
        { t: 'lcd', x: 300, y: 10, w: 70, h: 24, tint: '#e0f2fe', info: true }, { t: 'knob', x: 395, y: 22, r: 8 },
        { t: 'button', x: 410, y: 10, w: 8, h: 8, round: true, label: 'ESC' }, { t: 'button', x: 440, y: 18, w: 8, h: 8, round: true, fill: '#3a1d1d' },
        T(450, 39.5, 'SPECTERA  SENNHEISER', 1.7, { anchor: 'end', weight: 700 }), { t: 'labelArea', x: 300, y: 36, w: 50, h: 4.4 }],
      rear: [{ t: 'rect', x: 330, y: 8, w: 40, h: 28, rx: 1, stroke: '#6b7078' }, T(350, 39, 'MADI Card', 1.6, { anchor: 'middle' })],
    },
  }),
  dev({
    id: 'senn-em9046', name: 'EM 9046 (Digital 9000)', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 4, slots: 1, depth: 496, color: '#2a2b2e',
    fields: UHF_FIELDS, weight: 17, power: 150,
    source: 'Datenblatt – Sennheiser Digital 9000 Manual (Übersicht Rückseite: PSU, CCC, ASP, AAO/DAO-Module), Positionen geschätzt',
    notes: 'Modularer 8-Kanal-Empfänger, 177 × 449 × 496 mm. Beispielkonfiguration: 1× AAO (analog, 8 XLR) + 1× DAO. Antenneneingänge N-Buchse.',
    ports: [
      p('Phones', 'JACK', 'front', 40, 150, 'out'),
      p('Power', 'IEC_C14', 'rear', 40, 150, 'in'),
      p('LAN Up', 'RJ45', 'rear', 75, 40, 'io'), p('LAN Down', 'RJ45', 'rear', 95, 40, 'io'),
      p('Wordclock In', 'BNC75', 'rear', 75, 80, 'in'), p('Wordclock Out', 'BNC75', 'rear', 95, 80, 'out'),
      ...Array.from({ length: 8 }, (_, i) => p(`Out ${i + 1}`, 'XLR3M', 'rear', 140 + (i % 4) * 30, i < 4 ? 40 : 75, 'out')),
      p('Analog Multicore', 'DSUB9', 'rear', 185, 120, 'out'),
      p('AES3 Out 1-8', 'DSUB9', 'rear', 300, 120, 'out'),
      p('RF In A', 'N', 'rear', 400, 50, 'in'), p('RF In B', 'N', 'rear', 440, 50, 'in'),
      p('RF Out A', 'N', 'rear', 400, 100, 'out'), p('RF Out B', 'N', 'rear', 440, 100, 'out'),
    ],
    art: {
      front: [{ t: 'vents', x: 30, y: 20, w: 70, h: 120, n: 10, horizontal: true },
        ...Array.from({ length: 8 }, (_, i): ArtElement => ({ t: 'lcd', x: 115 + i * 36, y: 40, w: 32, h: 70, tint: '#e0f2fe', info: i === 0, channel: i ? i + 1 : 0 })),
        { t: 'knob', x: 425, y: 75, r: 12 }, T(130, 25, 'SENNHEISER  Digital 9000', 4, { weight: 700 }), { t: 'labelArea', x: 115, y: 125, w: 80, h: 8 }],
      rear: [{ t: 'rect', x: 25, y: 20, w: 35, h: 150, rx: 2, stroke: '#6b7078' }, { t: 'rect', x: 65, y: 20, w: 40, h: 150, rx: 2, stroke: '#6b7078' },
        { t: 'rect', x: 120, y: 20, w: 130, h: 150, rx: 2, stroke: '#6b7078' }, T(185, 165, 'AAO', 3, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 255, y: 20, w: 120, h: 150, rx: 2, stroke: '#6b7078' }, T(315, 165, 'DAO', 3, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 385, y: 20, w: 75, h: 150, rx: 2, stroke: '#6b7078' }, T(422, 165, 'ASP', 3, { anchor: 'middle', weight: 700 })],
    },
  }),
  dev({
    id: 'senn-em100g4', name: 'EM 100 G4', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 212, depth: 190, color: '#2a2b2e', frontColor: '#b9bcc0', textColor: '#1f2328',
    fields: UHF_FIELDS, power: 6, source: 'abgeleitet – Gehäuse EM 300-500 G4 (vermessen); Anschlüsse laut ew 100 G4 Manual (Rückseite ohne Ethernet)',
    notes: 'Halbe 19"-Breite (GA 3). Versorgung NT 2-3 (12 V DC).',
    ports: [p('Phones', 'JACK', 'front', 28.1, 23.1, 'out'), p('Ant II', 'BNC', 'rear', 24.9, 29.4, 'in'), p('Ant I', 'BNC', 'rear', 107.9, 29.4, 'in'),
      p('AF Out Unbal', 'JACK', 'rear', 133.8, 26.7, 'out'), p('AF Out Bal', 'XLR3M', 'rear', 160, 21.4, 'out'), p('DC In', 'DC', 'rear', 211.8, 29.4, 'in')],
    art: { front: [{ t: 'knob', x: 47.2, y: 23.5, r: 5.8 }, { t: 'rect', x: 59, y: 8.4, w: 90.1, h: 29.3, rx: 1, fill: '#15171a' }, { t: 'rect', x: 63.4, y: 15.6, w: 11.9, h: 13.7, fill: '#2563eb' },
      { t: 'lcd', x: 80.9, y: 10.2, w: 66.4, h: 26.6, tint: '#e0f2fe', info: true }, { t: 'knob', x: 170, y: 24.4, r: 8.2 },
      { t: 'button', x: 186.3, y: 11.6, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 186.3, y: 26.9, w: 8, h: 8, label: 'SET', round: true },
      { t: 'button', x: 209.8, y: 19.5, w: 8, h: 8, round: true, fill: '#3a1d1d' }, T(225.5, 40.5, 'SENNHEISER', 2.2, { anchor: 'end', weight: 700, spacing: 0.3 }), { t: 'labelArea', x: 18, y: 36.5, w: 38, h: 4.6 }] },
  }),
  dev({
    id: 'senn-sriemg4', name: 'SR IEM G4', manufacturer: 'Sennheiser', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 212, depth: 190, color: '#2a2b2e', frontColor: '#b9bcc0', textColor: '#1f2328',
    fields: UHF_FIELDS, power: 6, source: 'abgeleitet – G4-Gehäuse (EM 300-500 G4 vermessen); Anschlüsse laut ew IEM G4 Manual, Positionen geschätzt',
    notes: 'Halbe 19"-Breite. Eingänge XLR/6,3-mm-Combo, Loop Out, Versorgung 12 V DC.',
    ports: [p('Phones', 'JACK', 'front', 28.1, 23.1, 'out'), p('Antenna', 'BNC', 'rear', 24.9, 29.4, 'out'), p('Loop Out L', 'JACK', 'rear', 68, 24, 'out'), p('Loop Out R', 'JACK', 'rear', 88, 24, 'out'),
      p('AF In L(I)', 'COMBO', 'rear', 122, 21, 'in'), p('AF In R(II)', 'COMBO', 'rear', 155, 21, 'in'), p('DC In', 'DC', 'rear', 211.8, 29.4, 'in')],
    art: { front: [{ t: 'knob', x: 47.2, y: 23.5, r: 5.8 }, { t: 'rect', x: 59, y: 8.4, w: 90.1, h: 29.3, rx: 1, fill: '#15171a' },
      { t: 'lcd', x: 80.9, y: 10.2, w: 66.4, h: 26.6, tint: '#fdba74', info: true }, { t: 'knob', x: 170, y: 24.4, r: 8.2 },
      { t: 'button', x: 186.3, y: 11.6, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 186.3, y: 26.9, w: 8, h: 8, label: 'SYNC', round: true },
      { t: 'button', x: 209.8, y: 19.5, w: 8, h: 8, round: true, fill: '#3a1d1d' }, T(225.5, 40.5, 'SENNHEISER', 2.2, { anchor: 'end', weight: 700, spacing: 0.3 }), { t: 'labelArea', x: 18, y: 36.5, w: 38, h: 4.6 }] },
  }),
  dev({
    id: 'senn-em2050', name: 'EM 2050', manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 300, color: '#2a2b2e', frontColor: '#c3c6ca', textColor: '#1f2328', earWidth: 22,
    fields: UHF_FIELDS, power: 25, source: 'abgeleitet – Gehäuse SR 2050 IEM (vermessen); Anschlüsse laut EM 2000/EM 2050 Bedienungsanleitung, Positionen geschätzt',
    notes: 'Doppelempfänger 2000er-Serie. A = linker Empfänger (von vorne).',
    ports: [p('Phones A', 'JACK', 'front', 36.8, 31.6, 'out'), p('Phones B', 'JACK', 'front', 252.8, 31.6, 'out'),
      p('Power', 'IEC_C14', 'rear', 46.2, 17.1, 'in'),
      p('Ethernet B', 'RJ45', 'rear', 111.4, 23.5, 'io'), p('B Out Unbal', 'JACK', 'rear', 140, 24.3, 'out'), p('B Out Bal', 'XLR3M', 'rear', 180, 18.5, 'out'),
      p('Ant II In', 'BNC', 'rear', 225, 26.5, 'in'), p('Ant II Out', 'BNC', 'rear', 250, 26.5, 'out'),
      p('Ethernet A', 'RJ45', 'rear', 303.6, 23.5, 'io'), p('A Out Unbal', 'JACK', 'rear', 330, 24.3, 'out'), p('A Out Bal', 'XLR3M', 'rear', 365, 18.5, 'out'),
      p('Ant I In', 'BNC', 'rear', 425, 26.5, 'in'), p('Ant I Out', 'BNC', 'rear', 452, 26.5, 'out')],
    art: { front: [0, 216].flatMap((dx, i): ArtElement[] => [
      { t: 'path', d: `M${186 + dx},0.5 Q${178 + dx},21.8 ${186 + dx},43.1 L${223 + dx},43.1 Q${229 + dx},21.8 ${223 + dx},0.5 Z`, fill: '#141518' },
      { t: 'knob', x: 56.5 + dx, y: 33, r: 3.8 }, { t: 'button', x: 80.6 + dx, y: 21.2, w: 8, h: 8, round: true, label: 'sync' },
      { t: 'lcd', x: 92.8 + dx, y: 8.7, w: 77.2, h: 29.2, tint: '#fb923c', info: true, channel: i === 0 ? 0 : 2 },
      { t: 'knob', x: 193.9 + dx, y: 29, r: 5.5 }, { t: 'button', x: 209.7 + dx, y: 21.7, w: 8, h: 8, round: true, fill: '#2a2c30' },
      T(68 + dx, 7, i === 0 ? 'A' : 'B', 3, { weight: 700 }),
    ]).concat([T(238, 7.5, 'SENNHEISER  EM 2050', 2.2, { weight: 700 }), { t: 'labelArea', x: 100, y: 39, w: 50, h: 4 }]) },
  }),
  ...(['EM XSW 1', 'EM XSW 2'] as const).map((m) => dev({
    id: `senn-${m.toLowerCase().replace(/[^a-z0-9]+/g, '')}`, name: m, manufacturer: 'Sennheiser', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 200, depth: 150, color: '#2b2d31',
    fields: UHF_FIELDS, power: 4, source: 'Datenblatt – Sennheiser XS Wireless Manual (Rückseite: Antennen, XLR, Klinke, DC), Positionen geschätzt',
    notes: 'Halbe 19"-Breite mit GA 4. Versorgung Steckernetzteil (DC).',
    ports: [p('Antenna II', 'BNC', 'rear', 32, 22, 'in'), p('DC In', 'DC', 'rear', 60, 26, 'in'), p('AF Out Bal', 'XLR3M', 'rear', 130, 21, 'out'), p('AF Out Unbal', 'JACK', 'rear', 165, 26, 'out'), p('Antenna I', 'BNC', 'rear', 208, 22, 'in')],
    art: { front: genFront({ brand: 'Sennheiser', model: m, x0: 20.6, x1: 220.6, displays: [{ x: 80, w: 60 }], buttons: [{ x: 150, y: 12, label: 'SET' }, { x: 150, y: 24, label: 'SYNC' }], power: 205 }) },
  })),
  dev({
    id: 'senn-srxswiem', name: 'SR XSW IEM', manufacturer: 'Sennheiser', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 200, depth: 150, color: '#2b2d31',
    fields: UHF_FIELDS, power: 4, source: 'Datenblatt – Sennheiser XSW IEM Manual (Rückseite), Positionen geschätzt', notes: 'Halbe 19"-Breite. Eingänge XLR/6,3-mm-Combo.',
    ports: [p('Antenna', 'BNC', 'rear', 32, 22, 'out'), p('DC In', 'DC', 'rear', 60, 26, 'in'), p('AF In L', 'COMBO', 'rear', 125, 21, 'in'), p('AF In R', 'COMBO', 'rear', 160, 21, 'in')],
    art: { front: genFront({ brand: 'Sennheiser', model: 'SR XSW IEM', x0: 20.6, x1: 220.6, displays: [{ x: 80, w: 60, tint: '#fdba74' }], knobs: [{ x: 160 }], power: 205 }) },
  }),

  // ===================================================================================== others
  dev({
    id: 'dpa-ndr1', name: 'N-DR1 (N-Series)', manufacturer: 'DPA', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 210, depth: 180, color: '#1d1e21',
    fields: UHF_FIELDS, power: 15, source: 'Datenblatt – DPA N-Series Receiver (Anschlüsse), Positionen geschätzt', notes: 'Doppelempfänger, halbe 19"-Breite. Dante.',
    ports: [p('Ant B', 'BNC', 'rear', 30, 22, 'in'), p('Power', 'DC', 'rear', 55, 26, 'in'), p('Dante', 'RJ45', 'rear', 80, 24, 'io'),
      p('Out 2', 'XLR3M', 'rear', 135, 21, 'out'), p('Out 1', 'XLR3M', 'rear', 170, 21, 'out'), p('Ant A', 'BNC', 'rear', 210, 22, 'in')],
    art: { front: genFront({ brand: 'DPA', model: 'N-DR1', x0: 15.6, x1: 225.6, displays: [{ x: 60, w: 50 }, { x: 115, w: 50, ch: 2 }], knobs: [{ x: 185 }], power: 212 }) },
  }),
  ...([['ATW-R3210', false], ['ATW-R3210N', true]] as const).map(([m, net]) => dev({
    id: `at-${m.toLowerCase()}`, name: m, manufacturer: 'Audio-Technica', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 210, depth: 170, color: '#1f2023',
    fields: UHF_FIELDS, power: 6, source: 'Datenblatt – Audio-Technica 3000 Series (4th gen) Receiver, Positionen geschätzt',
    notes: `Halbe 19"-Breite. Versorgung 12 V DC.${net ? ' Mit Netzwerkanschluss (Wireless Manager).' : ''}`,
    ports: [p('Ant B', 'BNC', 'rear', 30, 22, 'in'), p('DC In', 'DC', 'rear', 55, 26, 'in'), ...(net ? [p('Ethernet', 'RJ45', 'rear', 80, 24, 'io')] : []),
      p('Audio Out Bal', 'XLR3M', 'rear', 140, 21, 'out'), p('Audio Out Unbal', 'JACK', 'rear', 172, 26, 'out'), p('Ant A', 'BNC', 'rear', 210, 22, 'in')],
    art: { front: genFront({ brand: 'audio-technica', model: m, x0: 15.6, x1: 225.6, displays: [{ x: 70, w: 60 }], leds: [{ x: 140, colors: [RED, YELLOW, GREEN, GREEN, GREEN] }], buttons: [{ x: 150, y: 12, label: 'SET' }, { x: 150, y: 24, label: 'SYNC' }], knobs: [{ x: 180 }], power: 210 }) },
  })),
  dev({
    id: 'at-atw-r5220', name: 'ATW-R5220', manufacturer: 'Audio-Technica', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 260, color: '#1f2023',
    fields: UHF_FIELDS, power: 20, source: 'Datenblatt – Audio-Technica 5000 Series ATW-R5220, Positionen geschätzt', notes: 'Doppelempfänger 5000 Serie, Dante optional.',
    ports: [p('Power', 'IEC_C14', 'rear', 45, 22, 'in'), p('Ethernet', 'RJ45', 'rear', 90, 24, 'io'), p('Dante', 'RJ45', 'rear', 110, 24, 'io'),
      p('Out 2', 'XLR3M', 'rear', 170, 21, 'out'), p('Out 2 Jack', 'JACK', 'rear', 195, 28, 'out'), p('Out 1', 'XLR3M', 'rear', 240, 21, 'out'), p('Out 1 Jack', 'JACK', 'rear', 265, 28, 'out'),
      p('Ant B In', 'BNC', 'rear', 350, 15, 'in'), p('Ant B Out', 'BNC', 'rear', 350, 32, 'out'), p('Ant A In', 'BNC', 'rear', 420, 15, 'in'), p('Ant A Out', 'BNC', 'rear', 420, 32, 'out')],
    art: { front: genFront({ brand: 'audio-technica', model: 'ATW-R5220', x0: 16, x1: 466.6, displays: [{ x: 90, w: 110 }, { x: 250, w: 110, ch: 2 }], knobs: [{ x: 220 }, { x: 380 }], power: 440 }) },
  }),
  dev({
    id: 'at-m3t', name: 'M3T (M3)', manufacturer: 'Audio-Technica', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 210, depth: 170, color: '#1f2023',
    fields: UHF_FIELDS, power: 6, source: 'Datenblatt – Audio-Technica M3 Transmitter, Positionen geschätzt', notes: 'Halbe 19"-Breite.',
    ports: [p('Antenna', 'BNC', 'rear', 30, 22, 'out'), p('DC In', 'DC', 'rear', 55, 26, 'in'), p('In L/Mono', 'COMBO', 'rear', 130, 21, 'in'), p('In R', 'COMBO', 'rear', 165, 21, 'in')],
    art: { front: genFront({ brand: 'audio-technica', model: 'M3T', x0: 15.6, x1: 225.6, displays: [{ x: 70, w: 55, tint: '#fdba74' }], knobs: [{ x: 150 }], power: 210 }) },
  }),
  dev({
    id: 'lect-dsqd', name: 'DSQD', manufacturer: 'Lectrosonics', category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 215, depth: 200, color: '#3a3d42',
    fields: UHF_FIELDS, power: 15, source: 'Datenblatt – Lectrosonics DSQD (4-Kanal D2), Positionen geschätzt', notes: 'Vierkanal-Digitalempfänger, halbe 19"-Breite. Dante, AES3.',
    ports: [p('Ant 2', 'BNC', 'rear', 25, 22, 'in'), p('Ant 2 Out', 'BNC', 'rear', 45, 22, 'out'), p('DC In', 'DC', 'rear', 65, 26, 'in'), p('Dante', 'RJ45', 'rear', 85, 24, 'io'),
      p('Out 1-4 (DB25)', 'DSUB9', 'rear', 125, 22, 'out'), p('AES3 Out', 'AES-XLR', 'rear', 165, 21, 'out'), p('Ant 1 Out', 'BNC', 'rear', 195, 22, 'out'), p('Ant 1', 'BNC', 'rear', 215, 22, 'in')],
    art: { front: genFront({ brand: 'Lectrosonics', model: 'DSQD', x0: 13, x1: 228, displays: [{ x: 60, w: 90 }], knobs: [{ x: 170 }], buttons: [{ x: 185, y: 12, label: 'MENU' }], power: 212 }) },
  }),
  dev({
    id: 'lect-m2t', name: 'M2T (Duet)', manufacturer: 'Lectrosonics', category: 'IEM Sender', heightU: 1, slots: 2, bodyWidth: 215, depth: 200, color: '#3a3d42',
    fields: UHF_FIELDS, power: 12, source: 'Datenblatt – Lectrosonics Duet M2T, Positionen geschätzt', notes: 'Digitaler Stereo-IEM-Sender (2 Kanäle), Dante.',
    ports: [p('RF Out', 'BNC', 'rear', 25, 22, 'out'), p('DC In', 'DC', 'rear', 50, 26, 'in'), p('Dante', 'RJ45', 'rear', 75, 24, 'io'), p('In L', 'COMBO', 'rear', 130, 21, 'in'), p('In R', 'COMBO', 'rear', 165, 21, 'in'), p('AES3 In', 'XLR3F', 'rear', 200, 21, 'in')],
    art: { front: genFront({ brand: 'Lectrosonics', model: 'M2T Duet', x0: 13, x1: 228, displays: [{ x: 60, w: 90, tint: '#fdba74' }], knobs: [{ x: 170 }], power: 212 }) },
  }),
  dev({
    id: 'wisy-mrk980', name: 'MRK980', manufacturer: 'Wisycom', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 300, color: '#2c2f33',
    fields: UHF_FIELDS, power: 25, source: 'Datenblatt – Wisycom MRK980, Positionen geschätzt', notes: 'Mehrkanal-Empfänger; im RF-Scan-Editor mit 2 Kanälen pro Einheit geführt.',
    ports: [p('Power', 'IEC_C14', 'rear', 45, 22, 'in'), p('Ethernet', 'RJ45', 'rear', 90, 24, 'io'), p('Out 2', 'XLR3M', 'rear', 170, 21, 'out'), p('Out 1', 'XLR3M', 'rear', 210, 21, 'out'),
      p('AES3 Out', 'AES-XLR', 'rear', 250, 21, 'out'), p('Ant B In', 'BNC', 'rear', 350, 15, 'in'), p('Ant B Out', 'BNC', 'rear', 350, 32, 'out'), p('Ant A In', 'BNC', 'rear', 420, 15, 'in'), p('Ant A Out', 'BNC', 'rear', 420, 32, 'out')],
    art: { front: genFront({ brand: 'Wisycom', model: 'MRK980', x0: 16, x1: 466.6, displays: [{ x: 120, w: 150 }], knobs: [{ x: 300 }], buttons: [{ x: 320, y: 12, label: 'MENU' }, { x: 320, y: 24, label: 'ESC' }], power: 440, vents: { x: 360, w: 60 } }) },
  }),
  dev({
    id: 'akg-dsr800', name: 'DSR800 (DMS800)', manufacturer: 'AKG', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 300, color: '#202226',
    fields: UHF_FIELDS, power: 25, source: 'Datenblatt – AKG DMS800 DSR800, Positionen geschätzt', notes: 'Digitaler Doppelempfänger.',
    ports: [p('Power', 'IEC_C14', 'rear', 45, 22, 'in'), p('Ethernet', 'RJ45', 'rear', 90, 24, 'io'), p('Wordclock In', 'BNC75', 'rear', 120, 22, 'in'),
      p('AES/EBU Out', 'AES-XLR', 'rear', 160, 21, 'out'), p('Out 2', 'XLR3M', 'rear', 210, 21, 'out'), p('Out 1', 'XLR3M', 'rear', 250, 21, 'out'),
      p('Ant B In', 'BNC', 'rear', 350, 15, 'in'), p('Ant B Out', 'BNC', 'rear', 350, 32, 'out'), p('Ant A In', 'BNC', 'rear', 420, 15, 'in'), p('Ant A Out', 'BNC', 'rear', 420, 32, 'out')],
    art: { front: genFront({ brand: 'AKG', model: 'DSR800', x0: 16, x1: 466.6, displays: [{ x: 100, w: 100 }, { x: 250, w: 100, ch: 2 }], knobs: [{ x: 220 }, { x: 370 }], power: 440 }) },
  }),
  ...([['akg-sr470', 'SR470 (WMS470)', 'AKG', 'Datenblatt – AKG WMS470 SR470'], ['ev-re3rx', 'RE3-RX', 'Electro-Voice', 'Datenblatt – Electro-Voice RE3 Receiver']] as const).map(([id, name, man, src]) => dev({
    id, name, manufacturer: man, category: 'UHF Empfänger', heightU: 1, slots: 2, bodyWidth: 205, depth: 170, color: '#222327',
    fields: UHF_FIELDS, power: 6, source: `${src}, Positionen geschätzt`, notes: 'Halbe 19"-Breite. Versorgung 12 V DC.',
    ports: [p('Ant B', 'BNC', 'rear', 30, 22, 'in'), p('DC In', 'DC', 'rear', 55, 26, 'in'), p('Audio Out Bal', 'XLR3M', 'rear', 140, 21, 'out'), p('Audio Out Unbal', 'JACK', 'rear', 172, 26, 'out'), p('Ant A', 'BNC', 'rear', 210, 22, 'in')],
    art: { front: genFront({ brand: man, model: name.split(' ')[0], x0: 18, x1: 223, displays: [{ x: 70, w: 60 }], leds: [{ x: 140, colors: [RED, YELLOW, GREEN, GREEN] }], buttons: [{ x: 152, y: 12, label: 'SET' }, { x: 152, y: 24, label: 'UP' }], power: 205 }) },
  })),
  dev({
    id: 'sd-a20nexus', name: 'A20-Nexus (Astral)', manufacturer: 'Sound Devices', category: 'UHF Empfänger', heightU: 1, slots: 1, depth: 260, color: '#2a2c30',
    fields: UHF_FIELDS, power: 40, source: 'Datenblatt – Sound Devices A20-Nexus, Positionen geschätzt', notes: 'Bis zu 8 Kanäle (Astral), Dante/AES/analog.',
    ports: [p('DC In', 'DC', 'rear', 40, 24, 'in'), p('Dante Primary', 'RJ45', 'rear', 80, 16, 'io'), p('Dante Secondary', 'RJ45', 'rear', 80, 31, 'io'),
      p('Analog Out 1-8 (DB25)', 'DSUB9', 'rear', 150, 22, 'out'), p('AES Out 1-8 (DB25)', 'DSUB9', 'rear', 230, 22, 'out'), p('Wordclock In', 'BNC75', 'rear', 290, 22, 'in'),
      ...['D', 'C', 'B', 'A'].map((l, i) => p(`Ant ${l}`, 'BNC', 'rear', 340 + i * 30, 22, 'in'))],
    art: { front: genFront({ brand: 'Sound Devices', model: 'A20-Nexus', x0: 16, x1: 466.6, displays: [{ x: 100, w: 200 }], knobs: [{ x: 330 }], buttons: [{ x: 350, y: 12, label: 'MENU' }], power: 440, vents: { x: 370, w: 50 } }) },
  }),
  portable('lect-dchr', 'Lectrosonics', 'DCHR', 62, '#3a3d42', [p('Ant', 'SMA', 'rear', C - 20, 20, 'in'), p('Audio Out (TA5)', 'GENERIC', 'rear', C, 22, 'out'), p('USB', 'USB', 'rear', C + 18, 22, 'io')]),
  portable('wisy-mpr52', 'Wisycom', 'MPR52', 70, '#2c2f33', [p('Ant', 'SMA', 'rear', C - 22, 20, 'in'), p('Audio Out 1/2 (TA5)', 'GENERIC', 'rear', C, 22, 'out'), p('DC In', 'DC', 'rear', C + 22, 22, 'in')]),
  portable('sd-a20rx', 'Sound Devices', 'A20-RX (Astral)', 70, '#2a2c30', [p('Ant A', 'SMA', 'rear', C - 25, 20, 'in'), p('Ant B', 'SMA', 'rear', C - 10, 20, 'in'), p('Audio Out (TA5)', 'GENERIC', 'rear', C + 8, 22, 'out'), p('USB-C', 'USB', 'rear', C + 25, 22, 'io')]),
  portable('zax-zmt4', 'Zaxcom', 'ZMT4 (Sender)', 60, '#26282c', [p('Mic In (TA5)', 'GENERIC', 'rear', C - 12, 22, 'in'), p('Antenna', 'SMA', 'rear', C + 14, 20, 'out')], { category: PORTABLE }),
  portable('sony-urxp03d', 'Sony', 'URX-P03D (UWP-D)', 63, '#202124', [p('Audio Out', 'MINIJACK', 'rear', C - 10, 22, 'out'), p('Phones', 'MINIJACK', 'rear', C + 10, 22, 'out')]),
  portable('sony-urxs03d', 'Sony', 'URX-S03D (UWP-D)', 70, '#202124', [p('Slot / Audio Out', 'GENERIC', 'rear', C, 22, 'out')], { notes: 'Slot-in-Empfänger für Kameras. ' + portableNote }),
  portable('tinysa-basic', 'TinySA', 'TinySA Basic', 64, '#3b3f46', [p('Low In', 'SMA', 'front', C - 14, 26, 'in'), p('High In', 'SMA', 'front', C + 14, 26, 'in'), p('USB-C', 'USB', 'rear', C, 22, 'io')], { category: 'HF Messtechnik', fields: undefined, notes: 'Scanner (USB, im RF-Scan-Editor als Live-Quelle). ' + portableNote }),
  portable('tinysa-ultra', 'TinySA', 'TinySA Ultra', 98, '#3b3f46', [p('RF In', 'SMA', 'front', C - 30, 26, 'in'), p('RF Out', 'SMA', 'front', C + 30, 26, 'out'), p('USB-C', 'USB', 'rear', C, 22, 'io')], { category: 'HF Messtechnik', fields: undefined, notes: 'Scanner (USB, im RF-Scan-Editor als Live-Quelle). ' + portableNote }),
  portable('rfexplorer', 'RF Explorer', 'RF Explorer', 70, '#3b3f46', [p('RF In', 'SMA', 'front', C, 6, 'in'), p('USB', 'USB', 'rear', C, 22, 'io')], { category: 'HF Messtechnik', fields: undefined, notes: 'Scanner (USB). ' + portableNote }),
];

// colours used above but referenced only through art helpers
void BLUE; void AMBER;
