import type { ArtElement, DeviceTemplate, Face, Port } from '../model/types';

/*
 * Branded devices rebuilt from the manufacturers' own panel drawings (user guides / online manuals).
 * Connector positions were measured on those drawings and scaled to the real panel size:
 *  - front: x from the left edge of the 19" panel (incl. ears), y from the top edge
 *  - rear:  x as seen from behind, chassis mapped to 16 … 466.6 mm, y from the top edge
 *  - half-width devices: x within the 241.3 mm slot, real chassis (bodyWidth) centred in the slot
 * Panels are simplified, positions are accurate to a few millimetres – good enough for cable planning,
 * not for mechanical work. Sources are noted per template.
 */

const UHF_FIELDS = ['Frequenz', 'Kanal / Name', 'Gruppe'];

// ------------------------------------------------------------------ helpers

let pid = 0;
const p = (name: string, connector: string, side: Face, x: number, y: number, dir?: Port['dir']): Port => ({ id: `p${++pid}`, name, connector, side, x: r1(x), y: r1(y), dir });
const r1 = (v: number) => Math.round(v * 10) / 10;

function dev(t: Omit<DeviceTemplate, 'textColor' | 'rackStandard'> & Partial<Pick<DeviceTemplate, 'textColor' | 'rackStandard'>>): DeviceTemplate {
  pid = 0;
  return { textColor: '#e5e7eb', rackStandard: 19, ...t, ports: t.ports.map((port, i) => ({ ...port, id: `p${i + 1}` })) };
}

const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const GREEN = '#22c55e';
const YELLOW = '#eab308';
const RED = '#ef4444';
const OFF = '#3a3d42';
const HOLE = '#0a0a0a';

const T = (x: number, y: number, text: string, size: number, extra: Partial<Extract<ArtElement, { t: 'text' }>> = {}): ArtElement => ({ t: 'text', x, y, text, size, ...extra });
const shureLogo = (x: number, y: number, size = 3.6): ArtElement => T(x, y, 'SHURE', size, { weight: 900, italic: true, spacing: 0.2 });
const sennLogo = (x: number, y: number, size = 2.6, ink?: string): ArtElement[] => [
  { t: 'rect', x, y: y - size * 1.05, w: size * 1.15, h: size * 1.15, fill: ink ?? '#e5e7eb' },
  { t: 'path', d: `M${x + size * 0.25},${y + 0.05} L${x + size * 0.9},${y - size * 1.0}`, stroke: '#111', sw: size * 0.22 },
  T(x + size * 1.6, y, 'SENNHEISER', size, { weight: 700, spacing: size * 0.18, fill: ink }),
];
const triUp = (cx: number, cy: number, s = 1.6): ArtElement => ({ t: 'path', d: `M${cx - s},${cy + s * 0.6} L${cx + s},${cy + s * 0.6} L${cx},${cy - s * 0.8} Z`, fill: '#e5e7eb' });
const triDown = (cx: number, cy: number, s = 1.6): ArtElement => ({ t: 'path', d: `M${cx - s},${cy - s * 0.6} L${cx + s},${cy - s * 0.6} L${cx},${cy + s * 0.8} Z`, fill: '#e5e7eb' });

/** Shure-style wide rack ears: separator lines + large round handle hole on each side */
function wideEars(sepL: number[], holeX: number, holeR: number, h: number, w = 482.6): ArtElement[] {
  const out: ArtElement[] = [];
  for (const x of sepL) {
    out.push({ t: 'line', x1: x, y1: 0.6, x2: x, y2: h - 0.6, stroke: '#000', sw: 0.5 });
    out.push({ t: 'line', x1: w - x, y1: 0.6, x2: w - x, y2: h - 0.6, stroke: '#000', sw: 0.5 });
  }
  out.push({ t: 'circle', x: holeX, y: h / 2, r: holeR, fill: HOLE }, { t: 'circle', x: w - holeX, y: h / 2, r: holeR, fill: HOLE });
  return out;
}

const H1 = 43.65;

// ------------------------------------------------------------------ Shure ULX-D

/** ULXD4D/4Q channel strip, measured on the ULXD4Q front drawing (block starts at the separator line) */
function ulxdChannel(sx: number, n: number): ArtElement[] {
  return [
    { t: 'line', x1: sx, y1: 7, x2: sx, y2: 37, stroke: '#000', sw: 0.6 },
    T(sx + 6, 8.2, `RX${n}`, 3, { weight: 700 }),
    { t: 'button', x: sx + 5.3, y: 12.9, w: 10.6, h: 10.9, label: 'SEL' },
    { t: 'button', x: sx + 5.3, y: 29.3, w: 10.6, h: 3.4, label: 'sync' },
    T(sx + 22.5, 6.8, 'RF', 1.9), T(sx + 31.5, 6.8, 'audio', 1.9), T(sx + 43.6, 6.8, 'gain', 1.9),
    { t: 'leds', x: sx + 23.6, y: 13.2, n: 2, dx: 5, colors: [BLUE, BLUE], r: 1 },
    { t: 'leds', x: sx + 26.2, y: 16.9, n: 6, dy: 3, colors: [RED, AMBER, AMBER, AMBER, AMBER, AMBER], r: 1 },
    { t: 'leds', x: sx + 34.9, y: 13.2, n: 7, dy: 3.1, colors: [RED, YELLOW, YELLOW, GREEN, GREEN, GREEN, GREEN], r: 1 },
    { t: 'button', x: sx + 42.6, y: 12.3, w: 8, h: 7.9 }, triUp(sx + 46.6, 16.3),
    { t: 'button', x: sx + 42.6, y: 24.8, w: 8, h: 7.9 }, triDown(sx + 46.6, 28.8),
  ];
}

function ulxdMultiFront(model: string, channels: number): ArtElement[] {
  const starts = [201.4, 257.6, 316, 372.5];
  return [
    ...wideEars([35.6], 25, 6.6, H1),
    shureLogo(44.5, 8.6), T(44.5, 14, model, 3.6), T(44.5, 17, 'Digital Wireless Receiver', 1.6),
    { t: 'labelArea', x: 44.9, y: 27.5, w: 22.6, h: 5.3 },
    { t: 'rect', x: 79.4, y: 8.9, w: 8.7, h: 23.6, fill: '#4b4f56' }, T(83.7, 37.5, 'IR', 2, { anchor: 'middle' }),
    { t: 'lcd', x: 98, y: 9.6, w: 50.6, h: 22.9, tint: '#e5f3ff', info: true },
    { t: 'button', x: 155.2, y: 12.3, w: 14, h: 5.9, label: 'ENTER' },
    { t: 'button', x: 155.2, y: 22.5, w: 14, h: 6, label: 'EXIT' },
    { t: 'button', x: 155.2, y: 32.5, w: 14, h: 5.9, label: 'SCAN' },
    T(186.1, 5, 'control', 2, { anchor: 'middle' }), { t: 'knob', x: 186.1, y: 20.5, r: 10 }, T(186.1, 37.5, 'push', 2, { anchor: 'middle' }),
    ...starts.slice(0, channels).flatMap((sx, i) => ulxdChannel(sx, i + 1)),
    { t: 'line', x1: 427, y1: 7, x2: 427, y2: 37, stroke: '#000', sw: 0.6 },
    T(434.6, 7, 'power', 2, { anchor: 'middle' }), { t: 'switch', x: 429, y: 12.3, w: 11.3, h: 23.5 },
  ];
}

/** Rear art of ULXD4D/Q: output boxes, network box, A/B labels (from the ULXD4Q back panel drawing) */
function ulxdMultiRear(outputs: number[]): ArtElement[] {
  const boxes: ArtElement[] = [];
  const outX: Record<number, number> = { 4: 172.7, 3: 220.0, 2: 331.0, 1: 378.3 };
  for (const o of outputs) {
    const x = outX[o];
    boxes.push({ t: 'rect', x: x - 30, y: 3, w: 43, h: 37, rx: 2.5, stroke: '#9aa0a8' }, T(x - 8.5, 6.2, `output ${o}`, 2.2, { anchor: 'middle' }));
    boxes.push({ t: 'rect', x: x - 20.5, y: 18, w: 3, h: 6, rx: 1, fill: '#111', stroke: '#9aa0a8' }, T(x - 22, 31, 'line/mic', 1.4, { anchor: 'middle' }));
  }
  return [
    { t: 'rect', x: 44, y: 5, w: 33, h: 34, rx: 1, stroke: '#9aa0a8' },
    T(103, 6.5, 'B', 3.2, { weight: 700 }), T(407, 6.5, 'A', 3.2, { weight: 700 }),
    ...boxes,
    { t: 'rect', x: 244, y: 3, w: 48, h: 37, rx: 2.5, stroke: '#9aa0a8' },
    T(256.8, 11.5, 'Secondary', 1.7, { anchor: 'middle' }), T(279, 11.5, 'Primary', 1.7, { anchor: 'middle' }),
  ];
}

const ULXD4Q_PORTS = (outputs: number[]) => {
  const outX: Record<number, number> = { 4: 172.7, 3: 220.0, 2: 331.0, 1: 378.3 };
  return [
    p('Power', 'IEC_C14', 'rear', 61.5, 19.8, 'in'),
    p('Ant B', 'BNC', 'rear', 95.0, 10.5, 'in'),
    p('Ant B Cascade', 'BNC', 'rear', 117.0, 29.5, 'out'),
    ...outputs.map((o) => p(`Out ${o}`, 'XLR3M', 'rear', outX[o], 21, 'out')),
    p('Dante Sec.', 'RJ45', 'rear', 256.8, 21.5, 'io'),
    p('Dante Prim.', 'RJ45', 'rear', 279.0, 21.5, 'io'),
    p('Ant A Cascade', 'BNC', 'rear', 414.2, 29.5, 'out'),
    p('Ant A', 'BNC', 'rear', 436.6, 10.5, 'in'),
  ];
};

// ------------------------------------------------------------------ Shure Axient Digital

/** AD4D/AD4Q channel strip, measured on the AD4Q front drawing (block starts at separator line) */
function adChannel(sx: number, n: number): ArtElement[] {
  const rows = [16.5, 20.8, 25.1, 29.4, 33.8, 38.1];
  return [
    { t: 'line', x1: sx, y1: 5, x2: sx, y2: 39, stroke: '#000', sw: 0.5 },
    { t: 'rect', x: sx + 6.5, y: 7.1, w: 12.1, h: 13.2, rx: 0.8, stroke: '#9aa0a8', sw: 0.4 },
    T(sx + 12.55, 17.2, String(n), 8, { anchor: 'middle', weight: 500 }),
    { t: 'button', x: sx + 6.5, y: 33.5, w: 12.1, h: 4.6, label: 'SYNC' },
    { t: 'leds', x: sx + 24.2, y: 8.1, n: 1, colors: [BLUE], r: 1 },
    { t: 'leds', x: sx + 32.5, y: 8.1, n: 1, colors: [BLUE], r: 1 },
    { t: 'leds', x: sx + 24.2, y: rows[0], n: 6, dy: 4.32, colors: [RED, AMBER, AMBER, AMBER, AMBER, AMBER], r: 1 },
    { t: 'leds', x: sx + 32.5, y: rows[0], n: 6, dy: 4.32, colors: [RED, AMBER, AMBER, AMBER, AMBER, AMBER], r: 1 },
    { t: 'leds', x: sx + 40.7, y: 8.1, n: 8, dy: 4.29, colors: [RED, YELLOW, YELLOW, GREEN, GREEN, GREEN, GREEN, GREEN], r: 1 },
  ];
}

function adFront(model: string, channels: number): ArtElement[] {
  const starts = [94.1, 141.3, 188.5, 235.7];
  return [
    ...wideEars([36.8, 41.1], 26.6, 6.5, H1),
    shureLogo(46, 5.2, 3.2), T(46, 10.2, model, 3.4),
    { t: 'leds', x: 68.5, y: 5.8, n: 1, colors: [OFF], r: 0.8 },
    { t: 'knob', x: 73.6, y: 11.9, r: 5.2 },
    { t: 'leds', x: 73.6, y: 22.3, n: 1, colors: [OFF], r: 0.8 },
    { t: 'rect', x: 83.3, y: 8.9, w: 7.7, h: 10.9, fill: '#4b4f56' },
    { t: 'rect', x: 83.3, y: 27.9, w: 7.7, h: 10.7, fill: '#9aa0a8' },
    ...starts.slice(0, channels).flatMap((sx, i) => adChannel(sx, i + 1)),
    { t: 'line', x1: starts[channels - 1] + 47.2, y1: 5, x2: starts[channels - 1] + 47.2, y2: 39, stroke: '#000', sw: 0.5 },
    { t: 'lcd', x: 289.7, y: 6.1, w: 68.5, h: 32.5, tint: '#e5f3ff', info: true },
    ...[7.1, 15.7, 24.4, 33].map((y): ArtElement => ({ t: 'button', x: 366, y, w: 12.5, h: 5.6 })),
    { t: 'button', x: 384.3, y: 7.1, w: 15, h: 6.6, label: 'ENTER' },
    { t: 'button', x: 384.3, y: 31.7, w: 15, h: 6.6, label: 'EXIT' },
    { t: 'knob', x: 413.4, y: 21.6, r: 10 },
    { t: 'switch', x: 428.9, y: 12.2, w: 10.4, h: 23.8 },
  ];
}

function adRear(outputs: number[], quad: boolean): ArtElement[] {
  const out: ArtElement[] = [
    T(20.5, 30, 'AC Power', 2.2, {}),
    { t: 'rect', x: 32, y: 4, w: 39, h: 34, rx: 0.8, stroke: '#9aa0a8' },
    { t: 'rect', x: 57, y: 9, w: 9, h: 24, rx: 1, fill: '#1a1b1e', stroke: '#9aa0a8' },
    { t: 'rect', x: 73, y: 4, w: 37, h: 34, rx: 0.8, stroke: '#9aa0a8' },
    T(128.5, 22, 'PoE', 2.4, { anchor: 'middle' }),
    T(418, 4.5, 'B', 2.6, { weight: 700 }), T(454, 4.5, 'A', 2.6, { weight: 700 }),
    T(436, 23.5, 'cascade', 1.6, { anchor: 'middle' }),
    { t: 'leds', x: 433.5, y: 13.5, n: 1, colors: [OFF], r: 1 }, T(433.5, 9, '12 V DC out', 1.5, { anchor: 'middle' }),
  ];
  if (!quad) out.push(T(233.5, 4.5, 'AES3 1&2', 2, { anchor: 'middle' }));
  else out.push(T(231, 4.5, 'AES3 3&4', 1.9, { anchor: 'middle' }), T(276, 4.5, 'AES3 1&2', 1.9, { anchor: 'middle' }));
  void outputs;
  return out;
}

// ------------------------------------------------------------------ devices

export const BRANDED_DEVICES: DeviceTemplate[] = [
  // ===== Shure ULXD4 (half rack) – source: Shure ULX-D user guide, front/back panel drawings
  dev({
    id: 'shure-ulxd4', name: 'ULXD4', manufacturer: 'Shure', category: 'UHF Empfänger',
    heightU: 1, slots: 2, bodyWidth: 197, depth: 171, color: '#2b2d31', fields: UHF_FIELDS, weight: 0.9, power: 12,
    source: 'Shure ULX-D User Guide (pubs.shure.com/guide/ULXD) – Front/Back Panel',
    notes: 'Halbe 19"-Breite, Einbau mit Rackkit. Versorgung über externes 15-V-Netzteil oder Antennenverteiler (DC).',
    ports: [
      p('Ant B', 'BNC', 'rear', 33.9, 31.5, 'in'),
      p('DC In', 'DC', 'rear', 60.3, 28, 'in'),
      p('Ethernet', 'RJ45', 'rear', 81.3, 27.2, 'io'),
      p('Audio Out', 'XLR3M', 'rear', 147.5, 21, 'out'),
      p('Inst/Aux Out', 'JACK', 'rear', 174.9, 25.7, 'out'),
      p('Ant A', 'BNC', 'rear', 208.3, 31.5, 'in'),
    ],
    art: {
      front: [
        shureLogo(35.6, 9.2, 3.3), T(35.6, 14.7, 'ULXD4', 3.4), T(35.6, 17.6, 'Digital Wireless Receiver', 1.5),
        { t: 'labelArea', x: 24.9, y: 27.9, w: 20.4, h: 4.6 },
        { t: 'rect', x: 55.7, y: 10.9, w: 8.1, h: 21.3, fill: '#4b4f56' }, T(59.7, 36, 'IR', 1.8, { anchor: 'middle' }),
        { t: 'lcd', x: 72.8, y: 11.3, w: 45.6, h: 20.9, tint: '#e5f3ff', info: true },
        { t: 'button', x: 124.2, y: 13.5, w: 13, h: 5.7, label: 'ENTER' },
        { t: 'button', x: 124.2, y: 22.8, w: 13, h: 5.7, label: 'EXIT' },
        { t: 'button', x: 124.2, y: 32.2, w: 13, h: 5.7, label: 'SCAN' },
        T(151.9, 8, 'control', 1.8, { anchor: 'middle' }), { t: 'knob', x: 151.9, y: 21, r: 9.4 }, T(151.9, 35.5, 'push', 1.8, { anchor: 'middle' }),
        T(166.5, 8, 'RF', 1.8), T(176.2, 8, 'audio', 1.8),
        { t: 'leds', x: 168, y: 11.7, n: 2, dx: 5, colors: [BLUE, BLUE], r: 0.95 },
        { t: 'leds', x: 170.4, y: 15.6, n: 5, dy: 3.7, colors: [RED, AMBER, AMBER, AMBER, AMBER], r: 0.95 },
        { t: 'leds', x: 179, y: 11.7, n: 6, dy: 3.7, colors: [RED, YELLOW, GREEN, GREEN, GREEN, GREEN], r: 0.95 },
        T(190.8, 8, 'gain', 1.8, { anchor: 'middle' }),
        { t: 'button', x: 186.9, y: 11.2, w: 7.8, h: 7.8 }, triUp(190.8, 15.1),
        { t: 'button', x: 186.9, y: 23.8, w: 7.8, h: 7.8 }, triDown(190.8, 27.7),
        T(208.8, 8, 'power', 1.8, { anchor: 'middle' }), { t: 'switch', x: 204, y: 11, w: 9.5, h: 21 },
      ],
      rear: [
        shureLogo(46, 7.5, 3), 
        { t: 'rect', x: 135.3, y: 22, w: 3, h: 6, rx: 1, fill: '#111', stroke: '#9aa0a8' }, T(132, 24, 'line/mic', 1.3, { anchor: 'end' }),
      ],
    },
  }),
  // ===== Shure ULXD4D – same chassis as ULXD4Q with outputs 1/2 (source: ULXD4D/4Q user guide)
  dev({
    id: 'shure-ulxd4d', name: 'ULXD4D', manufacturer: 'Shure', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 274, color: '#2b2d31', earWidth: 36, fields: UHF_FIELDS, weight: 3.4, power: 25,
    source: 'Shure ULX-D Dual/Quad User Guide – Front/Back Panel (Zeichnung zeigt ULXD4Q; ULXD4D = Ausgänge 1/2)',
    ports: ULXD4Q_PORTS([2, 1]),
    art: { front: ulxdMultiFront('ULXD4D', 2), rear: ulxdMultiRear([2, 1]) },
  }),
  // ===== Shure ULXD4Q
  dev({
    id: 'shure-ulxd4q', name: 'ULXD4Q', manufacturer: 'Shure', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 274, color: '#2b2d31', earWidth: 36, fields: UHF_FIELDS, weight: 3.7, power: 30,
    source: 'Shure ULX-D Dual/Quad User Guide – Front Panel / Back Panel',
    ports: ULXD4Q_PORTS([4, 3, 2, 1]),
    art: { front: ulxdMultiFront('ULXD4Q', 4), rear: ulxdMultiRear([4, 3, 2, 1]) },
  }),
  // ===== Shure AD4D – source: pubs.shure.com/guide/AD4D (Receiver Front/Back Panel)
  dev({
    id: 'shure-ad4d', name: 'AD4D', manufacturer: 'Shure', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 333, color: '#222428', earWidth: 41, fields: UHF_FIELDS, weight: 4.6, power: 23,
    source: 'Shure Axient Digital AD4D User Guide – Receiver Front/Back Panel',
    notes: 'AES3 über separate XLR (AES3 1&2). C/D: Cascade-Ausgänge bzw. Quadversity-Eingänge.',
    ports: [
      p('Phones', 'JACK', 'front', 73.6, 33.5, 'out'),
      p('Power In', 'IEC_C14', 'rear', 44.0, 21.7, 'in'),
      p('Power Thru', 'IEC_C13', 'rear', 91.3, 20.6, 'out'),
      p('Ctrl 1', 'RJ45', 'rear', 140.2, 13.3, 'io'), p('Dante 1', 'RJ45', 'rear', 163.6, 13.3, 'io'),
      p('Ctrl 2', 'RJ45', 'rear', 140.2, 31.0, 'io'), p('Dante 2', 'RJ45', 'rear', 163.6, 31.0, 'io'),
      p('Wordclock In', 'BNC75', 'rear', 192.7, 12.2, 'in'), p('Wordclock Thru', 'BNC75', 'rear', 192.7, 31.0, 'out'),
      p('AES3 1&2', 'AES-XLR', 'rear', 233.5, 20.6, 'out'),
      p('Out 2', 'XLR3M', 'rear', 325.1, 19.9, 'out'), p('Out 2 (-10 dB)', 'JACK', 'rear', 349.3, 31.5, 'out'),
      p('Out 1', 'XLR3M', 'rear', 374.0, 19.9, 'out'), p('Out 1 (-10 dB)', 'JACK', 'rear', 396.0, 31.5, 'out'),
      p('Ant B', 'BNC', 'rear', 415.3, 13.3, 'in'), p('D Cascade', 'BNC', 'rear', 415.3, 31.0, 'io'),
      p('Ant A', 'BNC', 'rear', 451.4, 13.3, 'in'), p('C Cascade', 'BNC', 'rear', 451.4, 31.0, 'io'),
    ],
    art: { front: adFront('AD4D', 2), rear: adRear([2, 1], false) },
  }),
  // ===== Shure AD4Q – source: pubs.shure.com/guide/AD4Q
  dev({
    id: 'shure-ad4q', name: 'AD4Q', manufacturer: 'Shure', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 333, color: '#222428', earWidth: 41, fields: UHF_FIELDS, weight: 4.8, power: 31,
    source: 'Shure Axient Digital AD4Q User Guide – Receiver Front/Back Panel',
    notes: 'AES3 wird über die XLR-Ausgänge 3 (AES3 1&2) und 4 (AES3 3&4) ausgegeben (Schalter „AES3 on“). C/D: Cascade bzw. Quadversity.',
    ports: [
      p('Phones', 'JACK', 'front', 73.6, 33.5, 'out'),
      p('Power In', 'IEC_C14', 'rear', 42.9, 20.9, 'in'),
      p('Power Thru', 'IEC_C13', 'rear', 90.3, 19.8, 'out'),
      p('Ctrl 1', 'RJ45', 'rear', 139.4, 13.2, 'io'), p('Dante 1', 'RJ45', 'rear', 162.8, 13.2, 'io'),
      p('Ctrl 2', 'RJ45', 'rear', 139.4, 30.9, 'io'), p('Dante 2', 'RJ45', 'rear', 162.8, 30.9, 'io'),
      p('Wordclock In', 'BNC75', 'rear', 192.0, 12.8, 'in'), p('Wordclock Thru', 'BNC75', 'rear', 192.0, 30.4, 'out'),
      p('Out 4', 'XLR3M', 'rear', 231.2, 19.4, 'out'), p('Out 4 (-10 dB)', 'JACK', 'rear', 252.7, 31.5, 'out'),
      p('Out 3', 'XLR3M', 'rear', 276.1, 19.4, 'out'), p('Out 3 (-10 dB)', 'JACK', 'rear', 298.3, 31.5, 'out'),
      p('Out 2', 'XLR3M', 'rear', 322.8, 19.4, 'out'), p('Out 2 (-10 dB)', 'JACK', 'rear', 345.0, 31.5, 'out'),
      p('Out 1', 'XLR3M', 'rear', 370.0, 19.4, 'out'), p('Out 1 (-10 dB)', 'JACK', 'rear', 392.5, 31.5, 'out'),
      p('Ant B', 'BNC', 'rear', 415.2, 13.2, 'in'), p('D Cascade', 'BNC', 'rear', 415.2, 30.9, 'io'),
      p('Ant A', 'BNC', 'rear', 449.0, 13.2, 'in'), p('C Cascade', 'BNC', 'rear', 449.0, 30.9, 'io'),
    ],
    art: { front: adFront('AD4Q', 4), rear: adRear([4, 3, 2, 1], true) },
  }),
  // ===== Shure UA844+SWB – source: UA844+SWB user guide (front/rear panel drawing)
  dev({
    id: 'shure-ua844', name: 'UA844+SWB', manufacturer: 'Shure', category: 'Antennenverteiler',
    heightU: 1, slots: 1, depth: 172, color: '#1f2124', weight: 1.62, power: 15,
    source: 'Shure UA844+SWB Bedienungsanleitung – Vorder- und Rückseite',
    notes: 'Aktiver Antennenverteiler 1:4 (A/B) + Kaskade. Versorgung über externes 15-V-Netzteil, 4 DC-Ausgänge für Empfänger. Front-BNC nur mit Front-Montage-Kit.',
    ports: [
      p('Ant A (Front-Kit)', 'BNC', 'front', 30.6, 21.3, 'in'),
      p('Ant B (Front-Kit)', 'BNC', 'front', 452, 21.3, 'in'),
      p('DC In', 'DC', 'rear', 35.9, 12.3, 'in'),
      p('DC Out 1', 'DC', 'rear', 65.0, 12.3, 'out'), p('DC Out 2', 'DC', 'rear', 94.1, 12.3, 'out'),
      p('DC Out 3', 'DC', 'rear', 50.5, 29.6, 'out'), p('DC Out 4', 'DC', 'rear', 79.1, 29.6, 'out'),
      p('Ant B In', 'BNC', 'rear', 118.9, 28.4, 'in'),
      p('B Cascade', 'BNC', 'rear', 148.7, 29.6, 'out'),
      ...[177.8, 206.9, 236.1, 264.7].map((x, i) => p(`B Out ${i + 1}`, 'BNC', 'rear', x, 29.6, 'out')),
      ...[298.0, 327.1, 356.2, 384.8].map((x, i) => p(`A Out ${i + 1}`, 'BNC', 'rear', x, 29.6, 'out')),
      p('A Cascade', 'BNC', 'rear', 414.0, 29.6, 'out'),
      p('Ant A In', 'BNC', 'rear', 443.6, 29.6, 'in'),
    ],
    art: {
      front: [
        shureLogo(50, 7.5, 3.2), T(50, 12, 'UA844+SWB', 2.6), T(50, 15.5, 'Antenna/Power Distribution System', 1.6),
        { t: 'line', x1: 16, y1: 39.5, x2: 466.6, y2: 39.5, stroke: '#000', sw: 1.2 },
        { t: 'leds', x: 353.8, y: 26.4, n: 1, colors: [GREEN], r: 1 }, T(353.8, 21.5, 'power', 1.6, { anchor: 'middle' }),
        { t: 'switch', x: 379.8, y: 14, w: 5, h: 14 },
        { t: 'labelArea', x: 120, y: 17, w: 60, h: 6 },
      ],
      rear: [
        { t: 'line', x1: 102.6, y1: 1, x2: 102.6, y2: 42.6, stroke: '#9aa0a8', sw: 0.4 },
        { t: 'line', x1: 135.9, y1: 1, x2: 135.9, y2: 42.6, stroke: '#9aa0a8', sw: 0.4 },
        { t: 'line', x1: 427.8, y1: 1, x2: 427.8, y2: 42.6, stroke: '#9aa0a8', sw: 0.4 },
        shureLogo(160, 10, 3.6), T(221, 6, 'RF output B', 1.8, { anchor: 'middle' }), T(341, 6, 'RF output A', 1.8, { anchor: 'middle' }),
        T(400, 11, 'antenna/power distribution system', 1.8, { anchor: 'middle' }),
      ],
    },
  }),
  // ===== Shure P10T (PSM1000) – source: PSM1000 user guide, front panel controls / rear panel
  dev({
    id: 'shure-p10t', name: 'P10T (PSM1000)', manufacturer: 'Shure', category: 'IEM Sender',
    heightU: 1, slots: 1, depth: 343, color: '#1d1f22', earWidth: 31, fields: UHF_FIELDS, weight: 3.6, power: 40,
    source: 'Shure PSM1000 User Guide – Front Panel Controls / Rear Panel',
    notes: 'Doppelsender. Eingänge: XLR/6,3-mm-Combo. Kaltgeräte-Ausgang (unswitched) zum Durchschleifen.',
    ports: [
      p('Phones', 'JACK', 'front', 410.6, 32.4, 'out'),
      p('Power In', 'IEC_C14', 'rear', 73.5, 21.4, 'in'),
      p('Power Out', 'IEC_C13', 'rear', 118.1, 19.9, 'out'),
      p('Antenna 2 Out', 'BNC', 'rear', 158.5, 27.5, 'out'),
      p('TX2 Loop Out L', 'JACK', 'rear', 193.9, 13.3, 'out'), p('TX2 Loop Out R', 'JACK', 'rear', 193.9, 32.5, 'out'),
      p('TX2 In L/CH1', 'COMBO', 'rear', 226.1, 26, 'in'), p('TX2 In R/CH2', 'COMBO', 'rear', 256.5, 26, 'in'),
      p('Network 1', 'RJ45', 'rear', 295.6, 14.2, 'io'), p('Network 2', 'RJ45', 'rear', 295.6, 31.8, 'io'),
      p('TX1 In L/CH1', 'COMBO', 'rear', 348.4, 26, 'in'), p('TX1 In R/CH2', 'COMBO', 'rear', 379.7, 26, 'in'),
      p('TX1 Loop Out L', 'JACK', 'rear', 405.9, 13.3, 'out'), p('TX1 Loop Out R', 'JACK', 'rear', 405.9, 32.5, 'out'),
      p('Antenna 1 Out', 'BNC', 'rear', 445.0, 27.5, 'out'),
    ],
    art: {
      front: [
        ...wideEars([31.2], 27, 3, H1),
        shureLogo(40, 5.2, 3.2), T(40, 9.6, 'PSM1000', 2.5), T(40, 13.8, 'P10T', 2.5), T(40, 17, 'Dual Wireless Transmitter', 1.4),
        { t: 'rect', x: 37.5, y: 34.1, w: 12.5, h: 5, fill: '#08090a' }, T(43.7, 41.8, 'sync', 1.5, { anchor: 'middle' }),
        ...[0, 141.4].flatMap((dx, i): ArtElement[] => [
          { t: 'rect', x: 70.7 + dx, y: 8.4, w: 139.4, h: 33, rx: 1.2, stroke: '#4b4f56', sw: 0.5 },
          T(73 + dx, 7.2, 'RF', 2), T(99.8 + dx, 7.2, 'L', 2), T(105.6 + dx, 7.2, 'R', 2), T(203 + dx, 7.2, 'navigate', 2, { anchor: 'end' }),
          { t: 'leds', x: 74.9 + dx, y: 17.6, n: 2, dy: 13.5, colors: [BLUE, BLUE], r: 1 },
          { t: 'switch', x: 81.9 + dx, y: 14.3, w: 12.9, h: 22.7 },
          { t: 'leds', x: 100.7 + dx, y: 13.4, n: 7, dy: 3.7, colors: [RED, YELLOW, GREEN, GREEN, GREEN, GREEN, GREEN], r: 0.9 },
          { t: 'leds', x: 106.5 + dx, y: 13.4, n: 7, dy: 3.7, colors: [RED, YELLOW, GREEN, GREEN, GREEN, GREEN, GREEN], r: 0.9 },
          { t: 'lcd', x: 114.4 + dx, y: 13.4, w: 75.7, h: 21.9, tint: '#fbbf24', info: true, channel: i === 0 ? 0 : 2 },
          ...[13.9, 21, 28.1, 35.3].map((y): ArtElement => ({ t: 'button', x: 194.7 + dx, y, w: 10.4, h: 5 })),
        ]),
        { t: 'button', x: 352.7, y: 14.3, w: 10, h: 8.4, label: 'enter', fill: '#7f1d1d' },
        { t: 'button', x: 352.7, y: 25.2, w: 10, h: 8.4, label: 'exit', fill: '#7f1d1d' },
        T(377.7, 9, 'control', 2, { anchor: 'middle' }), { t: 'knob', x: 377.7, y: 24, r: 9 },
        T(405, 9, 'monitor', 2, { anchor: 'middle' }),
        { t: 'leds', x: 397.3, y: 14.3, n: 3, dy: 8, colors: [RED, GREEN, GREEN], r: 0.9 },
        { t: 'knob', x: 412.6, y: 18.5, r: 4.8 },
        T(432.6, 9, 'power', 2, { anchor: 'middle' }), { t: 'switch', x: 427.2, y: 14.3, w: 10.8, h: 21 },
      ],
      rear: [
        { t: 'switch', x: 22, y: 6, w: 22, h: 32 }, T(30, 4, 'P10T', 1.8),
        { t: 'rect', x: 136, y: 2, w: 45, h: 39, rx: 1, stroke: '#4b4f56' }, T(158.5, 5.5, 'antenna 2 out', 1.8, { anchor: 'middle' }),
        { t: 'rect', x: 184, y: 2, w: 92, h: 39, rx: 1, stroke: '#4b4f56' }, T(230, 5.5, 'transmitter 2 inputs', 1.8, { anchor: 'middle' }),
        { t: 'rect', x: 285, y: 2, w: 21, h: 39, rx: 1, stroke: '#4b4f56' },
        { t: 'rect', x: 329, y: 2, w: 89, h: 39, rx: 1, stroke: '#4b4f56' }, T(373, 5.5, 'transmitter 1 inputs', 1.8, { anchor: 'middle' }),
        { t: 'rect', x: 423, y: 2, w: 43, h: 39, rx: 1, stroke: '#4b4f56' }, T(445, 5.5, 'antenna 1 out', 1.8, { anchor: 'middle' }),
      ],
    },
  }),
  // ===== Shure PA821B – source: PA421B/PA821B user guide (front & rear panels)
  dev({
    id: 'shure-pa821b', name: 'PA821B Combiner', manufacturer: 'Shure', category: 'Antennen-Combiner',
    heightU: 1, slots: 1, depth: 200, color: '#1d1f22', earWidth: 36, weight: 2.4, power: 20,
    source: 'Shure PA421B/PA821B User Guide – Front Panels / Rear Panels',
    notes: 'Aktiver Combiner 8:1 für PSM-Sender. Expansion Port zum Kaskadieren weiterer Combiner.',
    ports: [
      p('Antenna Out', 'BNC', 'front', 63.3, 27.4, 'out'),
      p('Expansion A In', 'BNC', 'front', 263.9, 28.1, 'in'),
      p('Expansion B In', 'BNC', 'front', 291.2, 28.1, 'in'),
      p('Expansion A+B Out', 'BNC', 'front', 360.7, 28.1, 'out'),
      p('Power', 'IEC_C14', 'rear', 64.6, 21.5, 'in'),
      ...[445.3, 405.0, 365.5, 325.8, 286.4, 247.4, 207.9, 167.9].map((x, i) => p(`RF In ${i + 1}`, 'BNC', 'rear', x, 28.9, 'in')),
    ],
    art: {
      front: [
        ...wideEars([35.6], 25.1, 4, H1),
        shureLogo(39.5, 5.5, 3), T(39.5, 9.5, 'PA821B', 2.2), T(39.5, 12.3, 'PSM Antenna Combiner', 1.5), T(39.5, 14.8, '470-865 MHz', 1.5),
        T(63.3, 40.5, 'MAIN OUT 50 OHMS', 1.4, { anchor: 'middle' }),
        T(90.5, 12.5, 'ACTIVE COMBINER', 1.8, { anchor: 'middle', weight: 700 }), T(90.5, 16.5, 'INPUT SIGNAL', 1.4, { anchor: 'middle' }),
        { t: 'leds', x: 83, y: 22, n: 4, dx: 5, colors: [GREEN], r: 1 },
        { t: 'leds', x: 83, y: 28, n: 4, dx: 5, colors: [GREEN], r: 1 },
        { t: 'vents', x: 123.6, y: 6.3, w: 111, h: 31.4, n: 17 },
        { t: 'line', x1: 263.9, y1: 28.1, x2: 360.7, y2: 28.1, sw: 0.5 },
        T(263.9, 16.5, 'A IN', 1.5, { anchor: 'middle' }), T(291.2, 16.5, 'B IN', 1.5, { anchor: 'middle' }), T(360.7, 16.5, 'A+B OUT', 1.5, { anchor: 'middle' }),
        T(312, 41, 'EXPANSION PORT', 1.4, { anchor: 'middle' }),
        { t: 'leds', x: 397.1, y: 21.8, n: 1, colors: [GREEN], r: 1 }, T(397.1, 26.5, 'POWER', 1.4, { anchor: 'middle' }),
        { t: 'switch', x: 407.6, y: 8.4, w: 17.6, h: 27.2 },
      ],
      rear: [
        shureLogo(22, 7, 2.8), T(22, 10.5, 'PA821B', 1.8),
        { t: 'vents', x: 104, y: 9.7, w: 26, h: 22, n: 4, horizontal: true },
        { t: 'vents', x: 150, y: 4.5, w: 308, h: 2.6, n: 8 },
        { t: 'vents', x: 150, y: 10.5, w: 308, h: 2.6, n: 8 },
        T(306, 41.8, 'RF INPUTS', 1.8, { anchor: 'middle' }),
      ],
    },
  }),

  // ===== Sennheiser EM 6000 – source: Digital 6000 online manual, EM6000_front.svg / EM6000_back.svg
  dev({
    id: 'senn-em6000', name: 'EM 6000', manufacturer: 'Sennheiser', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 340, color: '#2b2d31', fields: UHF_FIELDS, weight: 4.5, power: 30,
    source: 'Sennheiser Digital 6000 Manual – EM 6000 Produktübersicht (Front/Rückseite, perspektivisch, Positionen ±5 mm)',
    ports: [
      p('Phones', 'JACK', 'front', 25.1, 28, 'out'),
      p('Power', 'IEC_C14', 'rear', 52.8, 23.4, 'in'),
      p('Ethernet', 'RJ45', 'rear', 161.0, 24.5, 'io'),
      p('AES3 Out', 'AES-XLR', 'rear', 189.7, 21.8, 'out'),
      p('Wordclock In', 'BNC75', 'rear', 223.2, 11, 'in'), p('Wordclock Out', 'BNC75', 'rear', 223.2, 30, 'out'),
      p('Out 2 Jack', 'JACK', 'rear', 242.1, 29, 'out'), p('Out 2', 'XLR3M', 'rear', 262, 21, 'out'),
      p('Out 1 Jack', 'JACK', 'rear', 291.5, 29, 'out'), p('Out 1', 'XLR3M', 'rear', 312, 21, 'out'),
      p('Ant A In', 'BNC', 'rear', 350.3, 21, 'in'), p('Ant A Out', 'BNC', 'rear', 377.4, 21, 'out'),
      p('Ant B Out', 'BNC', 'rear', 404.4, 21, 'out'), p('Ant B In', 'BNC', 'rear', 428.8, 21, 'in'),
    ],
    art: {
      front: [
        { t: 'rect', x: 16, y: 0.5, w: 44.3, h: 42.6, fill: '#b9bcc0' },
{ t: 'knob', x: 46, y: 26, r: 5 }, T(46, 40, 'VOLUME', 1.5, { anchor: 'middle', fill: '#222' }),
        { t: 'rect', x: 70, y: 4.5, w: 4.6, h: 4.6, fill: '#e5e7eb' },
        { t: 'path', d: 'M70.9,8.6 L73.8,5', stroke: '#111', sw: 0.8 },
        T(74, 37, 'SYNC', 1.4), { t: 'leds', x: 71.5, y: 36.5, n: 1, colors: [OFF], r: 0.7 },
        { t: 'lcd', x: 90.7, y: 8, w: 93.3, h: 25, tint: '#fdba74', info: true, channel: 0 },
        triUp(194.6, 16, 1.2), { t: 'knob', x: 210.6, y: 22, r: 8.5 },
        { t: 'button', x: 225, y: 9, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 238.5, y: 9, w: 8, h: 8, label: 'SAVE', round: true },
        { t: 'button', x: 225, y: 26, w: 8, h: 8, label: 'SYNC', round: true }, { t: 'button', x: 238.5, y: 26, w: 8, h: 8, round: true },
        { t: 'lcd', x: 264, y: 8, w: 90.6, h: 25, tint: '#fdba74', info: true, channel: 2 },
        triUp(368, 16, 1.2), { t: 'knob', x: 386.6, y: 22, r: 8.5 },
        { t: 'button', x: 400, y: 9, w: 8, h: 8, label: 'ESC', round: true }, { t: 'button', x: 413.5, y: 9, w: 8, h: 8, label: 'SAVE', round: true },
        { t: 'button', x: 400, y: 26, w: 8, h: 8, label: 'SYNC', round: true }, { t: 'button', x: 413.5, y: 26, w: 8, h: 8, round: true },
        { t: 'button', x: 440, y: 7, w: 8, h: 8, round: true, fill: '#3a1d1d' },
        T(446, 39, 'Digital 6000', 1.6, { anchor: 'end' }), T(446, 35.6, 'SENNHEISER', 1.8, { anchor: 'end', weight: 700, spacing: 0.3 }),
        { t: 'labelArea', x: 120, y: 35.5, w: 40, h: 5 },
      ],
      rear: [
        { t: 'vents', x: 18, y: 5, w: 2, h: 34, n: 1 },
        { t: 'rect', x: 150, y: 4, w: 22, h: 37, rx: 1, stroke: '#6b7078' }, T(161, 7.5, 'Ethernet', 1.7, { anchor: 'middle' }),
        { t: 'rect', x: 175, y: 4, w: 29, h: 37, rx: 1, stroke: '#6b7078' }, T(189.7, 7.5, 'Digital Audio', 1.7, { anchor: 'middle' }), T(189.7, 39.5, 'AES 3', 2.6, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 233, y: 3, w: 40, h: 38, rx: 1, stroke: '#6b7078' }, T(255, 6.5, 'Bal AF out', 1.7, { anchor: 'middle' }), T(262, 39.5, '2', 2.6, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 282, y: 3, w: 40, h: 38, rx: 1, stroke: '#6b7078' }, T(304, 6.5, 'Bal AF out', 1.7, { anchor: 'middle' }), T(312, 39.5, '1', 2.6, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 336, y: 3, w: 53, h: 38, rx: 1, stroke: '#6b7078' }, T(350.3, 7, 'RF in', 1.7, { anchor: 'middle' }), T(377.4, 7, 'RF out', 1.7, { anchor: 'middle' }), T(363.8, 39.5, 'A', 2.8, { anchor: 'middle', weight: 700 }),
        { t: 'rect', x: 392, y: 3, w: 50, h: 38, rx: 1, stroke: '#6b7078' }, T(404.4, 7, 'RF out', 1.7, { anchor: 'middle' }), T(428.8, 7, 'RF in', 1.7, { anchor: 'middle' }), T(416.6, 39.5, 'B', 2.8, { anchor: 'middle', weight: 700 }),
      ],
    },
  }),
  // ===== Sennheiser EM 300-500 G4 (half rack) – source: ew 300-500 G4 manual, product overview front/rear
  dev({
    id: 'senn-em300g4', name: 'EM 300-500 G4', manufacturer: 'Sennheiser', category: 'UHF Empfänger',
    heightU: 1, slots: 2, bodyWidth: 212, depth: 202, color: '#2a2b2e', frontColor: '#b9bcc0', textColor: '#1f2328', fields: UHF_FIELDS, weight: 1.0, power: 8,
    source: 'Sennheiser evolution wireless G4 300/500 Manual – Product overview front/rear of the EM 300-500 G4',
    notes: 'Halbe 19"-Breite, Einbau mit GA 3 Rackkit. Versorgung über NT 2-3 (12 V DC) oder ASA 214.',
    ports: [
      p('Phones', 'JACK', 'front', 28.1, 23.1, 'out'),
      p('Ant II', 'BNC', 'rear', 24.9, 29.4, 'in'),
      p('Ant I', 'BNC', 'rear', 107.9, 29.4, 'in'),
      p('AF Out Unbal', 'JACK', 'rear', 133.8, 26.7, 'out'),
      p('AF Out Bal', 'XLR3M', 'rear', 160.0, 21.4, 'out'),
      p('Ethernet', 'RJ45', 'rear', 190.0, 25.8, 'io'),
      p('DC In', 'DC', 'rear', 211.8, 29.4, 'in'),
    ],
    art: {
      front: [
        ...sennLogo(17.5, 8.5, 2.6, '#1f2328').slice(0, 2),
        { t: 'knob', x: 47.2, y: 23.5, r: 5.8 },
        { t: 'rect', x: 59, y: 8.4, w: 90.1, h: 29.3, rx: 1, fill: '#15171a' },
        { t: 'rect', x: 63.4, y: 9.8, w: 11.9, h: 4.3, fill: '#dc2626' },
        { t: 'rect', x: 63.4, y: 15.6, w: 11.9, h: 13.7, fill: '#2563eb' },
        T(66, 34, 'SYNC', 1.6, { fill: '#ddd' }),
        { t: 'lcd', x: 80.9, y: 10.2, w: 66.4, h: 26.6, tint: '#e0f2fe', info: true },
        { t: 'knob', x: 170, y: 24.4, r: 8.2 },
        { t: 'button', x: 186.3, y: 11.6, w: 8, h: 8, label: 'ESC', round: true },
        { t: 'button', x: 186.3, y: 26.9, w: 8, h: 8, label: 'SYNC', round: true },
        { t: 'button', x: 209.8, y: 19.5, w: 8, h: 8, round: true, fill: '#3a1d1d' },
        T(225.5, 40.5, 'SENNHEISER', 2.2, { anchor: 'end', weight: 700, spacing: 0.3 }),
        { t: 'labelArea', x: 18, y: 36.5, w: 38, h: 4.6 },
      ],
      rear: [
        { t: 'rect', x: 45.9, y: 6.3, w: 43.6, h: 30.5, rx: 1.6, fill: '#1f2023' },
        T(66, 41.5, 'DC IN 12V/350mA', 1.5, { anchor: 'middle' }),
        T(160, 6, '+18dBu MAX', 1.5, { anchor: 'middle' }),
        { t: 'rect', x: 214, y: 6, w: 9, h: 9, rx: 1, fill: '#111' },
      ],
    },
  }),
  // ===== Sennheiser ASA 214 (half rack) – source: ew G4 manual, product overview rear of the ASA 214
  dev({
    id: 'senn-asa214', name: 'ASA 214', manufacturer: 'Sennheiser', category: 'Antennenverteiler',
    heightU: 1, slots: 2, bodyWidth: 212, depth: 168, color: '#2a2b2e', frontColor: '#b9bcc0', textColor: '#1f2328', weight: 1.1, power: 10,
    source: 'Sennheiser ew G4 Manual – Product overview for the rear side of the ASA 214',
    notes: 'Aktiver Antennensplitter 2× 1:4. A1–A4 liefern zusätzlich 12 V DC für Empfänger. RF OUT A zum Kaskadieren eines zweiten ASA 214. Versorgung NT 1-1.',
    ports: [
      p('B4', 'BNC', 'rear', 28.5, 15.5, 'out'), p('B3', 'BNC', 'rear', 45.6, 33, 'out'),
      p('B2', 'BNC', 'rear', 62.1, 15.5, 'out'), p('B1', 'BNC', 'rear', 78.8, 33, 'out'),
      p('Ant RF In B', 'BNC', 'rear', 95.4, 15.5, 'in'),
      p('Ant RF In A', 'BNC', 'rear', 112.5, 33, 'in'),
      p('A4', 'BNC', 'rear', 129.2, 15.5, 'out'), p('A3', 'BNC', 'rear', 146.0, 33, 'out'),
      p('A2', 'BNC', 'rear', 162.9, 15.5, 'out'), p('A1', 'BNC', 'rear', 179.6, 33, 'out'),
      p('RF Out A', 'BNC', 'rear', 196.3, 15.5, 'out'),
      p('DC In', 'DC', 'rear', 212.9, 18.3, 'in'),
    ],
    art: {
      front: [
        ...sennLogo(22, 13, 3, '#1f2328'),
        T(22, 26, 'ASA 214', 4.2, { weight: 700 }), T(22, 31, 'Active Antenna Splitter', 2),
        { t: 'leds', x: 200, y: 22, n: 1, colors: [GREEN], r: 1.2 }, T(200, 28, 'ON', 1.8, { anchor: 'middle' }),
        { t: 'button', x: 206, y: 18, w: 8, h: 8, round: true, fill: '#3a3d42' },
        { t: 'labelArea', x: 100, y: 18.5, w: 60, h: 6 },
      ],
      rear: [
        T(155, 3.2, 'A1/2/3/4: DC OUT 12V/350mA', 1.4, { anchor: 'middle' }),
        { t: 'rect', x: 216, y: 30, w: 9, h: 10, rx: 1, fill: '#111' },
      ],
    },
  }),
  // ===== Sennheiser SR 2050 IEM – source: SR 2000/SR 2050 IEM manual, product overview
  dev({
    id: 'senn-sr2050', name: 'SR 2050 IEM', manufacturer: 'Sennheiser', category: 'IEM Sender',
    heightU: 1, slots: 1, depth: 300, color: '#2a2b2e', frontColor: '#c3c6ca', textColor: '#1f2328', earWidth: 22, fields: UHF_FIELDS, weight: 4.0, power: 30,
    source: 'Sennheiser SR 2000 IEM / SR 2050 IEM Manual – Product overview (perspektivisch, Positionen ±5 mm)',
    notes: 'Doppelsender: A = linker Sender (von vorne), B = rechter. Eingänge XLR/6,3-mm-Combo, Loop Out 6,3 mm.',
    ports: [
      p('Phones A', 'JACK', 'front', 36.8, 31.6, 'out'),
      p('Phones B', 'JACK', 'front', 252.8, 31.6, 'out'),
      p('Power', 'IEC_C14', 'rear', 46.2, 17.1, 'in'),
      p('Ethernet B', 'RJ45', 'rear', 111.4, 23.5, 'io'),
      p('B Loop Out L', 'JACK', 'rear', 138.2, 24.3, 'out'), p('B Loop Out R', 'JACK', 'rear', 164.6, 24.3, 'out'),
      p('B In L(I)', 'COMBO', 'rear', 194.8, 18.5, 'in'), p('B In R(II)', 'COMBO', 'rear', 230.3, 18.5, 'in'),
      p('RF Out B', 'BNC', 'rear', 267.7, 26.5, 'out'),
      p('Ethernet A', 'RJ45', 'rear', 303.6, 23.5, 'io'),
      p('A Loop Out L', 'JACK', 'rear', 322.8, 24.3, 'out'), p('A Loop Out R', 'JACK', 'rear', 349.2, 24.3, 'out'),
      p('A In L(I)', 'COMBO', 'rear', 375.5, 18.5, 'in'), p('A In R(II)', 'COMBO', 'rear', 410.5, 18.5, 'in'),
      p('RF Out A', 'BNC', 'rear', 452.3, 26.5, 'out'),
    ],
    art: {
      front: [
        ...[0, 216].flatMap((dx, i): ArtElement[] => [
          { t: 'path', d: `M${186 + dx},0.5 Q${178 + dx},21.8 ${186 + dx},43.1 L${223 + dx},43.1 Q${229 + dx},21.8 ${223 + dx},0.5 Z`, fill: '#141518' },
          { t: 'knob', x: 56.5 + dx, y: 33, r: 3.8 },
          { t: 'button', x: 80.6 + dx, y: 21.2, w: 8, h: 8, round: true, label: 'sync' },
          { t: 'lcd', x: 92.8 + dx, y: 8.7, w: 77.2, h: 29.2, tint: '#fb923c', info: true, channel: i === 0 ? 0 : 2 },
          { t: 'knob', x: 193.9 + dx, y: 29, r: 5.5 },
          { t: 'button', x: 209.7 + dx, y: 21.7, w: 8, h: 8, round: true, fill: '#2a2c30' },
          { t: 'path', d: `M${213.7 + dx},23.6 L${213.7 + dx},26`, stroke: '#ef4444', sw: 0.6 },
          T(68 + dx, 7, i === 0 ? 'A' : 'B', 3, { weight: 700 }),
        ]),
        ...sennLogo(236, 7.5, 2.4, '#1f2328'),
        T(236, 12, 'Stereo Transmitter SR 2050 IEM', 1.6),
        { t: 'labelArea', x: 100, y: 39, w: 50, h: 4 },
      ],
      rear: [
        { t: 'rect', x: 62, y: 6, w: 24, h: 16, rx: 1, fill: '#111' },
        T(46.2, 34, '100–240V 50/60Hz', 1.4, { anchor: 'middle' }),
        { t: 'rect', x: 238, y: 2, w: 100, h: 9, rx: 0.5, stroke: '#6b7078' }, T(288, 7.6, 'SENNHEISER  Stereo Transmitter SR 2050 IEM', 1.6, { anchor: 'middle' }),
      ],
    },
  }),
];
