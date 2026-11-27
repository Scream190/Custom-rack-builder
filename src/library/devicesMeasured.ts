import type { ArtElement, DeviceTemplate, Face, ModuleBay, Port } from '../model/types';

/*
 * Devices rebuilt from the front/rear panel drawings in the manufacturer's user guides (Shure docs, 2026):
 * SBRC, AXT900, AXT630/AXT631, AXT400. Positions were measured on the drawings and scaled to the 482.6 mm panel width;
 * rear x as seen from behind (see devicesBranded.ts). The SBRC/AXT900/AXT630/AXT400 rear panels share one chassis,
 * the measured power/network positions agree within ±2 mm between the four drawings.
 */

const r1 = (v: number) => Math.round(v * 10) / 10;
const p = (name: string, connector: string, side: Face, x: number, y: number, dir?: Port['dir']): Port => ({ id: '', name, connector, side, x: r1(x), y: r1(y), dir });
const withIds = (ports: Port[]) => ports.map((q, i) => ({ ...q, id: `p${i + 1}` }));
const H1 = 43.65;
const HOLE = '#0a0a0a', INK = '#e5e7eb', FRAME = '#5a5e65';
const T = (x: number, y: number, text: string, size: number, extra: Partial<Extract<ArtElement, { t: 'text' }>> = {}): ArtElement => ({ t: 'text', x, y, text, size, ...extra });
const R = (x: number, y: number, w: number, h: number, extra: Partial<Extract<ArtElement, { t: 'rect' }>> = {}): ArtElement => ({ t: 'rect', x, y, w, h, ...extra });
const logo = (x: number, y: number, size: number): ArtElement => T(x, y, 'SHURE', size, { weight: 900, italic: true, spacing: size * 0.06 });
const arrowBtn = (x: number, y: number, w: number, h: number, up: boolean): ArtElement[] => [
  { t: 'button', x, y, w, h, fill: '#1b1c1f' },
  { t: 'path', d: up ? `M${x + w / 2 - 1.6},${y + h * 0.68} L${x + w / 2 + 1.6},${y + h * 0.68} L${x + w / 2},${y + h * 0.3} Z` : `M${x + w / 2 - 1.6},${y + h * 0.32} L${x + w / 2 + 1.6},${y + h * 0.32} L${x + w / 2},${y + h * 0.7} Z`, fill: '#e5e7eb' },
];
/** big round hole and handle bracket on the rack ears of this chassis family */
function ears(holeX: number, holeR: number, bracket: [number, number]): ArtElement[] {
  const [b0, b1] = bracket, W = 482.6;
  return [
    { t: 'circle', x: holeX, y: H1 / 2, r: holeR, fill: HOLE }, { t: 'circle', x: W - holeX, y: H1 / 2, r: holeR, fill: HOLE },
    R(b0, 0.4, b1 - b0, H1 - 0.8, { fill: '#2c2e33', stroke: '#111', sw: 0.3, rx: 1 }), R(W - b1, 0.4, b1 - b0, H1 - 0.8, { fill: '#2c2e33', stroke: '#111', sw: 0.3, rx: 1 }),
    R(b0 + (b1 - b0) * 0.55, 5, 1.6, H1 - 10, { fill: '#08090a', rx: 0.8 }), R(W - b0 - (b1 - b0) * 0.55 - 1.6, 5, 1.6, H1 - 10, { fill: '#08090a', rx: 0.8 }),
  ];
}
/** perforated grille as rows of holes */
function perforation(x0: number, x1: number, y0: number, y1: number, cols: number, rows: number): ArtElement[] {
  const out: ArtElement[] = [R(x0, y0, x1 - x0, y1 - y0, { stroke: FRAME, sw: 0.35, rx: 1.5 })];
  const dx = (x1 - x0) / cols, dy = (y1 - y0) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) out.push({ t: 'circle', x: x0 + dx * (i + 0.5), y: y0 + dy * (j + 0.5), r: Math.min(dx, dy) * 0.36, fill: HOLE });
  return out;
}
/** rocker power switch (rear of this chassis family) */
const rocker = (x: number, y: number, w: number, h: number): ArtElement[] => [
  R(x, y, w, h, { fill: '#111214', stroke: FRAME, sw: 0.4, rx: 1 }),
  R(x + w * 0.12, y + h * 0.08, w * 0.76, h * 0.84, { fill: '#26282c', stroke: '#55595f', sw: 0.3, rx: 0.8 }),
  { t: 'line', x1: x + w / 2, y1: y + h * 0.22, x2: x + w / 2, y2: y + h * 0.4, stroke: '#ddd', sw: 0.6 },
  { t: 'circle', x: x + w / 2, y: y + h * 0.68, r: w * 0.11, stroke: '#ddd', sw: 0.5 },
];

// ================================================================== SBRC / AXT900 charger chassis
// front measured on the SBRC drawing (identical front on the AXT900 drawing): 2000 px = 482.6 mm
const BAYS: [number, number][] = [[94.1, 86.2], [180.3, 86.1], [266.4, 89.5], [355.9, 89.3]];
const chargerBays = (options: ModuleBay['options'], defaults: string[] = []): ModuleBay[] =>
  BAYS.map(([x, w], i) => ({ name: `Schacht ${i + 1}`, x, y: 0.3, w, h: H1 - 0.6, options, default: defaults[i] }));

const SBRC_MODULES: ModuleBay['options'] = [
  { id: 'SBC-AX', label: 'SBC-AX: 2 × SB900A/B/C (Axient Digital, ULX-D, QLX-D, PSM 1000)', look: 'flat' },
  { id: 'SBM910', label: 'SBM910: 2 × SB910 (ADX1)', look: 'flat-small' },
  { id: 'SBM910M', label: 'SBM910M: 2 × SB910M (ADX1M)', look: 'flat-small' },
  { id: 'SBM920', label: 'SBM920: 2 × SB920/SB920A (ADX2, ADX2FD)', look: 'round' },
  { id: 'AXT901', label: 'AXT901: 2 × AXT910 (Axient Taschensender)', look: 'flat' },
  { id: 'AXT902', label: 'AXT902: 2 × AXT920 (Axient Handsender)', look: 'round' },
];

function chargerFront(model?: string): ArtElement[] {
  return [
    ...ears(20.5, 4.8, [26.5, 37.4]),
    R(37.6, 0.6, 56.3, H1 - 1.2, { stroke: FRAME, sw: 0.4, rx: 0.6 }),
    { t: 'line', x1: 37.6, y1: 37.2, x2: 93.9, y2: 37.2, stroke: FRAME, sw: 0.35 },
    logo(41, 6.4, 4), ...(model ? [T(41, 10.9, model, 2.6, { weight: 600 })] : []),
    { t: 'lcd', x: 44.6, y: 15.4, w: 27.8, h: 14.5, tint: '#e5f3ff' },
    ...arrowBtn(76, 12.1, 12.6, 4.8, true), { t: 'button', x: 76, y: 20.3, w: 12.6, h: 5.3, label: 'SET', fill: '#1b1c1f' }, ...arrowBtn(76, 28.7, 12.6, 4.6, false),
    T(41, 34.6, 'Charger System', 2.2),
  ];
}

const sbrc: DeviceTemplate = {
  id: 'shure-sbrc', name: 'SBRC Rack-Ladegerät', manufacturer: 'Shure', category: 'Ladegeräte', heightU: 1, rackStandard: 19, slots: 1,
  depth: 300, color: '#222428', textColor: INK, earWidth: 37.4, weight: 4,
  source: 'vermessen – Shure SBRC User Guide (shure.com/docs), Front/Rear Panel; Tiefe geschätzt',
  notes: 'Rack-Ladegerät für bis zu 8 Shure-Akkus. Jeder der 4 Schächte nimmt ein Lademodul für 2 Akkus auf, Typen frei mischbar: SBC-AX (SB900A/B/C), SBM910, SBM910M, SBM920, AXT901, AXT902. Netzschalter hinten. Schächte im Inspector belegen.',
  ports: withIds([p('Power In', 'IEC_C14', 'rear', 84.9, 24.4, 'in'), p('Ethernet', 'RJ45', 'rear', 165.3, 27.1, 'io')]),
  art: {
    front: chargerFront(),
    rear: [
      logo(42.2, 9.5, 3.4),
      R(75.3, 8.6, 35, 30.9, { stroke: FRAME, sw: 0.4, rx: 1 }), ...rocker(98.4, 12.6, 8.4, 23.6),
      R(155.5, 18.8, 19.6, 16.6, { stroke: FRAME, sw: 0.4 }),
      ...perforation(195.5, 299.2, 10.6, 35.1, 20, 5), ...perforation(307.6, 411.4, 10.6, 35.1, 20, 5),
    ],
  },
  modules: chargerBays(SBRC_MODULES, ['SBC-AX', 'SBC-AX', 'SBM920', 'SBM920']),
};

const axt900: DeviceTemplate = {
  id: 'shure-axt900', name: 'AXT900 Ladestation', manufacturer: 'Shure', category: 'Ladegeräte', heightU: 1, rackStandard: 19, slots: 1,
  depth: 366, color: '#222428', textColor: INK, earWidth: 37.4, weight: 4.4,
  source: 'vermessen – Shure AXT900 User Guide (shure.com/docs), Front/Rear Panel; Front wie SBRC',
  notes: 'Netzwerkfähige Rack-Ladestation für Axient, 4 Schächte für Lademodule AXT901 (Taschensender-Akku AXT910) und AXT902 (Handsender-Akku AXT920). Netzschalter, Netz-Durchschleifung und 2 × Ethernet hinten. Schächte im Inspector belegen.',
  ports: withIds([
    p('Power In', 'IEC_C14', 'rear', 87.1, 22.9, 'in'), p('Power Thru', 'IEC_C13', 'rear', 125.7, 22.9, 'out'),
    p('Network 1', 'RJ45', 'rear', 165.6, 14.5, 'io'), p('Network 2', 'RJ45', 'rear', 165.6, 27.5, 'io'),
  ]),
  art: {
    front: chargerFront('AXT 900'),
    rear: [
      logo(43.2, 5.8, 3), T(56, 5.8, 'AXT900', 2.2),
      ...rocker(46, 9.8, 18.6, 27),
      R(73.4, 9.6, 26.6, 26.6, { stroke: FRAME, sw: 0.4 }), R(110.8, 9.6, 33, 26.6, { stroke: FRAME, sw: 0.4 }),
      R(157.9, 8.6, 15.4, 33, { stroke: FRAME, sw: 0.4 }),
      ...perforation(196.3, 301.6, 9.6, 35.5, 20, 5), ...perforation(309.3, 414.6, 9.6, 35.5, 20, 5),
    ],
  },
  modules: chargerBays(SBRC_MODULES.filter((o) => o.id.startsWith('AXT')), ['AXT901', 'AXT901', 'AXT902', 'AXT902']),
};

// ================================================================== AXT630 / AXT631 antenna distribution
function axt63x(id: string, model: string, range: string): DeviceTemplate {
  const outsB = ['4B', '3B', '2B', '1B'], outsA = ['4A', '3A', '2A', '1A'];
  return {
    id, name: model, manufacturer: 'Shure', category: 'Antennenverteiler', heightU: 1, rackStandard: 19, slots: 1,
    depth: 366, color: '#222428', textColor: INK, earWidth: 40.6, weight: 4.6,
    source: 'vermessen – Shure AXT630/AXT631 User Guide (shure.com/docs), Front/Rear Panel; Maße laut Spezifikation 44 × 483 × 366 mm, 4,6 kg',
    notes: `Aktiver Antennenverteiler für Axient: 2 Antennen auf 4 Empfänger (A/B), Kaskade mit 3,5 dB Ausgleich, Filter umschaltbar, Steuerung über Ethernet (Wireless Workbench). ${range}. Netzschalter vorne und hinten.`,
    ports: withIds([
      p('Power In', 'IEC_C14', 'rear', 86.4, 20.5, 'in'), p('Power Thru', 'IEC_C13', 'rear', 126.2, 20.5, 'out'),
      p('Network 1', 'RJ45', 'rear', 169.5, 18.3, 'io'), p('Network 2 (PoE)', 'RJ45', 'rear', 169.5, 31.3, 'io'),
      ...outsB.map((n, i) => p(`RF Out ${n}`, 'BNC', 'rear', [210.5, 230.5, 250.6, 270.6][i], 30.8, 'out')),
      ...outsA.map((n, i) => p(`RF Out ${n}`, 'BNC', 'rear', [303.5, 323.6, 343.6, 363.6][i], 30.8, 'out')),
      p('Antenna In B', 'BNC', 'rear', 391.5, 12.5, 'in'), p('Antenna In A', 'BNC', 'rear', 420.9, 12.5, 'in'),
      p('Cascade Out B', 'BNC', 'rear', 391.5, 30.8, 'out'), p('Cascade Out A', 'BNC', 'rear', 420.9, 30.8, 'out'),
    ]),
    art: {
      front: [
        ...ears(24.7, 7, [34.7, 40.6]),
        logo(44.3, 7.4, 5), T(42.8, 13, model, 4.2), T(42.8, 15.6, range, 1.5),
        T(42.3, 31.3, 'Antenna Distribution', 2.8), T(42.3, 35.5, 'Amplifier', 2.8),
        R(77.7, 8.6, 133, 27.8, { stroke: FRAME, sw: 0.5, rx: 1.5 }),
        { t: 'lcd', x: 168.2, y: 15.2, w: 25.2, h: 13.4, tint: '#e5f3ff' },
        ...arrowBtn(199.3, 11, 7.3, 4.8, true), { t: 'button', x: 199.3, y: 19, w: 7.3, h: 4.8, label: 'SET', fill: '#1b1c1f' }, ...arrowBtn(199.3, 27.6, 7.3, 4.8, false),
        T(430.8, 4.6, 'power', 1.9, { anchor: 'middle' }), { t: 'switch', x: 423.2, y: 6.6, w: 15.2, h: 30.6 },
      ],
      rear: [
        logo(43, 4.6, 3), T(56, 4.6, model, 2.2),
        ...rocker(47.6, 6.2, 16, 29.8),
        R(76.6, 7, 21.6, 28, { stroke: FRAME, sw: 0.4 }), R(110.5, 7, 32.6, 28, { stroke: FRAME, sw: 0.4 }),
        R(161.4, 4.2, 22, 37, { stroke: FRAME, sw: 0.4, rx: 1 }), T(172.4, 42.2, 'PoE Class 1', 1.3, { anchor: 'middle' }),
        R(197.3, 3.7, 88.5, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(283, 8, 'RF  outputs', 2.6, { anchor: 'end' }),
        R(287.9, 3.7, 88, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(373, 8, 'RF  outputs', 2.6, { anchor: 'end' }),
        ...outsB.map((n, i): ArtElement => T([210.5, 230.5, 250.6, 270.6][i], 22.5, n, 1.9, { anchor: 'middle' })),
        ...outsA.map((n, i): ArtElement => T([303.5, 323.6, 343.6, 363.6][i], 22.5, n, 1.9, { anchor: 'middle' })),
        R(381.3, 3.7, 64.7, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(431, 10, 'antenna in', 1.4), T(395, 39.6, 'B', 1.6), T(424.4, 39.6, 'A', 1.6),
        { t: 'leds', x: 406.3, y: 23.6, n: 1, colors: ['#22c55e'], r: 1.2 },
      ],
    },
  };
}

// ================================================================== AXT400 dual receiver
function rxPanel(x0: number, ch: number, sync: boolean): ArtElement[] {
  const off = x0 - 78.1;
  const ys = Array.from({ length: 7 }, (_, i) => 11.8 + i * 3.77);
  return [
    R(x0, 8.8, 131, 28.1, { stroke: FRAME, sw: 0.5, rx: 2 }),
    ...(sync ? [R(80.6, 12.6, 3.5, 22.5, { fill: '#4b4f56', rx: 0.6 }), T(82.3, 6.6, 'sync', 1.8, { anchor: 'middle' })] : []),
    T(97.2 + off, 6.2, 'RF', 1.8, { anchor: 'middle' }), T(108.2 + off, 6.2, 'audio', 1.8, { anchor: 'middle' }),
    { t: 'leds', x: 93.6 + off, y: ys[0], n: 7, colors: ['#3a3d42', '#3a3d42', '#3a3d42', '#22c55e', '#22c55e', '#22c55e', '#22c55e'], dx: 0, dy: 3.77, r: 0.75 },
    { t: 'leds', x: 100.7 + off, y: ys[0], n: 7, colors: ['#3a3d42', '#3a3d42', '#3a3d42', '#3a3d42', '#22c55e', '#22c55e', '#22c55e'], dx: 0, dy: 3.77, r: 0.75 },
    { t: 'leds', x: 108.2 + off, y: ys[0], n: 7, colors: ['#3a3d42', '#3a3d42', '#f59e0b', '#22c55e', '#22c55e', '#22c55e', '#22c55e'], dx: 0, dy: 3.77, r: 0.75 },
    { t: 'lcd', x: 123 + off, y: 10.5, w: 67.8, h: 23.9, tint: '#e5f3ff', info: true, channel: ch },
    T(201.3 + off, 6.2, 'navigate', 1.7, { anchor: 'middle' }),
    ...[11.2, 17.5, 23.8, 30].map((y): ArtElement => ({ t: 'button', x: 196 + off, y, w: 10.6, h: 4.2, fill: '#1b1c1f' })),
  ];
}
const axt400: DeviceTemplate = {
  id: 'shure-axt400', name: 'AXT400', manufacturer: 'Shure', category: 'UHF Empfänger', heightU: 1, rackStandard: 19, slots: 1,
  depth: 366, color: '#222428', textColor: INK, earWidth: 40.9, weight: 5.4, fields: ['Frequenz', 'Kanal / Name', 'Gruppe'],
  source: 'vermessen – Shure AXT400 User Guide (shure.com/docs), Front/Rear Panel',
  notes: 'Axient Doppelempfänger mit Frequency Diversity und ShowLink. Vorgänger von Axient Digital, im Verleih noch verbreitet.',
  ports: withIds([
    p('Phones', 'JACK', 'front', 406.1, 32.1, 'out'),
    p('Power In', 'IEC_C14', 'rear', 86.4, 14, 'in'), p('Power Thru', 'IEC_C13', 'rear', 128.4, 14, 'out'),
    p('Network 1', 'RJ45', 'rear', 169.2, 16.2, 'io'), p('Network 2 (PoE)', 'RJ45', 'rear', 169.2, 31.3, 'io'),
    p('Word Clock In', 'BNC75', 'rear', 193.7, 13.3, 'in'), p('Word Clock Thru', 'BNC75', 'rear', 193.7, 31.3, 'out'),
    p('AES3 Out', 'AES-XLR', 'rear', 230.1, 24.8, 'out'),
    p('Out 2', 'XLR3M', 'rear', 275.6, 23.4, 'out'), p('Out 2 (Klinke)', 'JACK', 'rear', 310.6, 23.4, 'out'),
    p('Out 1', 'XLR3M', 'rear', 350.7, 23.4, 'out'), p('Out 1 (Klinke)', 'JACK', 'rear', 385.9, 23.4, 'out'),
    p('Antenna In B', 'BNC', 'rear', 406, 12.8, 'in'), p('Antenna In A', 'BNC', 'rear', 443.4, 12.8, 'in'),
    p('Cascade Out B', 'BNC', 'rear', 406, 31.3, 'out'), p('Cascade Out A', 'BNC', 'rear', 443.4, 31.3, 'out'),
  ]),
  art: {
    front: [
      ...ears(25.1, 6.8, [35.9, 40.9]),
      logo(43.4, 6.8, 4.4), T(43.4, 13.1, 'AXT400', 3.8), T(43.4, 15.7, 'A 470-698 MHz', 1.4), T(42.9, 35.6, 'Dual Wireless Receiver', 2.6),
      ...rxPanel(78.1, 1, true), ...rxPanel(216.6, 2, false),
      { t: 'button', x: 351.4, y: 13.1, w: 9.8, h: 6.2, label: 'enter', fill: '#1b1c1f' }, { t: 'button', x: 351.4, y: 25.9, w: 9.8, h: 6, label: 'exit', fill: '#1b1c1f' },
      T(374.5, 3.9, 'control', 1.8, { anchor: 'middle' }), { t: 'circle', x: 374.5, y: 23.1, r: 12.6, stroke: FRAME, sw: 0.5 }, { t: 'knob', x: 374.5, y: 23.1, r: 10.8 }, T(374.5, 38.2, 'push', 1.6, { anchor: 'middle' }),
      { t: 'leds', x: 391.8, y: 9.8, n: 1, colors: ['#ef4444'], r: 0.9 }, T(393.6, 10.4, 'clip', 1.4),
      { t: 'leds', x: 391.8, y: 19.6, n: 2, colors: ['#22c55e', '#3a3d42'], dx: 0, dy: 7.5, r: 0.8 }, T(393.6, 20.2, '1', 1.4), T(393.6, 27.7, '2', 1.4),
      T(406.1, 3.9, 'monitor', 1.8, { anchor: 'middle' }), { t: 'knob', x: 406.1, y: 13.8, r: 6.4 },
      T(430.8, 3, 'power', 1.8, { anchor: 'middle' }), { t: 'switch', x: 423.2, y: 7, w: 15.3, h: 30.7 },
    ],
    rear: [
      logo(31.6, 4.6, 3.2), T(46, 4.6, 'AXT400', 2.2),
      ...rocker(40.4, 5, 30.4, 25.8),
      R(76.5, 6, 20.4, 18, { stroke: FRAME, sw: 0.4 }), R(110.5, 6, 37, 18, { stroke: FRAME, sw: 0.4 }),
      T(87, 36, 'Input 100-240 V~ 50/60 Hz', 1.3, { anchor: 'middle' }), T(128.4, 36, 'Output 100-240~ 5A max.', 1.3, { anchor: 'middle' }),
      R(160.6, 4, 17.6, 36.2, { stroke: FRAME, sw: 0.4, rx: 1 }), T(169.4, 41.7, 'Class 1 PoE', 1.3, { anchor: 'middle' }),
      R(183.2, 3.6, 62.5, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(244, 7.4, 'AES3 output', 2.4, { anchor: 'end' }), T(198, 14.4, 'word clock', 1.3),
      { t: 'switch', x: 206.2, y: 27.4, w: 3.2, h: 6 }, T(207.8, 26.4, 'thru', 1.2, { anchor: 'middle' }), T(200, 38, 'Term 75Ω', 1.2),
      R(247.4, 3.6, 72.3, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(283.5, 7.4, 'analog outputs receiver 2', 2.2, { anchor: 'middle' }),
      { t: 'switch', x: 255.8, y: 28, w: 3.2, h: 6 }, { t: 'switch', x: 291.3, y: 28, w: 3.2, h: 6 }, T(257.4, 26.6, 'line/mic', 1.1, { anchor: 'middle' }), T(292.9, 26.6, 'lift', 1.1, { anchor: 'middle' }),
      R(322.7, 3.6, 73.1, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), T(359.2, 7.4, 'analog outputs receiver 1', 2.2, { anchor: 'middle' }),
      { t: 'switch', x: 329.3, y: 28, w: 3.2, h: 6 }, { t: 'switch', x: 366.6, y: 28, w: 3.2, h: 6 }, T(330.9, 26.6, 'line/mic', 1.1, { anchor: 'middle' }), T(368.2, 26.6, 'lift', 1.1, { anchor: 'middle' }),
      R(397.4, 3.6, 68.6, 37.3, { stroke: FRAME, sw: 0.45, rx: 1.5 }), { t: 'leds', x: 423.4, y: 15.4, n: 1, colors: ['#22c55e'], r: 1.2 },
      T(448, 21, 'antenna in', 1.2), T(448, 30, 'cascade out', 1.2), T(407, 40, 'B', 1.5), T(444, 40, 'A', 1.5),
    ],
  },
};

export const MEASURED_DEVICES: DeviceTemplate[] = [sbrc, axt900, axt63x('shure-axt630', 'AXT630', '470–698 MHz'), axt63x('shure-axt631', 'AXT631', '606–814 MHz'), axt400];
