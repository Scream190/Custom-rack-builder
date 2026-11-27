import type { ArtElement, DeviceTemplate } from '../model/types';
import { ampRear, ampRear1U, installRear, variants } from './devicesPro';
import { A, ampFront, B, G, mk, SRC, type Blk } from './proLayout';

/*
 * Second batch: live audio (EQ, dynamics, effects, splitters, headphone amps, amps, DSP), studio 19" gear
 * (interfaces, preamps, compressors, patchbays), video, lighting (dimmers, show control), rigging (chain hoist
 * controllers) and power. Accuracy per template in `source` (SRC.DS / SRC.EST / generic).
 */

const EQD = 'EQ & Dynamik', FX = 'Effektgeräte', SPLIT = 'Mikrofonsplitter', HP = 'Kopfhörerverstärker', REC = 'Zuspieler / Recording';
const CONV = 'Audio-Interface / Wandler', DSP = 'Signalprozessor', AMP = 'Endstufen', STU = 'Studio-Interfaces', PRE = 'Vorverstärker / Channelstrips';
const PB = 'Patchbay', VID = 'Video', DMX = 'Licht / DMX', DIM = 'Dimmer / Schaltpacks', RIG = 'Rigging / Motorsteuerung', PWR = 'Strom', IC = 'Intercom';
const GEN = 'Generische Vorlage';

const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const jacks = (names: string[], dir: Blk['dir'], o: Partial<Blk> = {}): Blk => B.list(names, 'JACK', dir, o);
const PSU = B.one('Power', 'IEC_C14', 'in');

// ------------------------------------------------------------------ front graphics
const vu = (x: number, y: number, w: number, h: number): ArtElement[] => [
  A.rect(x, y, w, h, '#cfc9b8', 0.8),
  { t: 'path', d: `M${x + w * 0.15},${y + h * 0.75} Q${x + w / 2},${y + h * 0.15} ${x + w * 0.85},${y + h * 0.75}`, stroke: '#3f3a2e', sw: 0.5 },
  { t: 'line', x1: x + w / 2, y1: y + h * 0.9, x2: x + w * 0.36, y2: y + h * 0.3, stroke: '#111', sw: 0.5 },
];
/** analogue outboard: VU meters, a grid of knobs, power switch */
function outboard(knobs: number, o: { vu?: number; x0?: number; x1?: number; r?: number; rows?: number; leds?: number; sw?: boolean; color?: string } = {}) {
  return (H: number): ArtElement[] => {
    const out: ArtElement[] = [];
    let x0 = o.x0 ?? (H < 50 ? 110 : 90);
    for (let i = 0; i < (o.vu ?? 0); i++) { out.push(...vu(x0, H * 0.2, Math.min(56, H * 0.9), H * 0.6)); x0 += Math.min(56, H * 0.9) + 8; }
    const x1 = o.x1 ?? 425, rows = o.rows ?? 1, cols = Math.ceil(knobs / rows);
    const r = o.r ?? Math.min(H < 50 ? 6 : 9, (x1 - x0) / cols / 2.6);
    for (let i = 0; i < knobs; i++) {
      const c = i % cols, rw = Math.floor(i / cols);
      out.push({ t: 'knob', x: x0 + r + 2 + c * ((x1 - x0 - 2 * r - 4) / Math.max(1, cols - 1)), y: (H * (rw + 0.5)) / rows, r, fill: o.color });
    }
    for (let i = 0; i < (o.leds ?? 0); i++) out.push(A.leds(x1 + 8 + i * 4, H / 2 - 8, 5, ['#ef4444', '#f59e0b', '#22c55e'], 0, 3.4, 0.8));
    if (o.sw !== false) out.push(A.sw(445, H / 2 - 7));
    return out;
  };
}
/** graphic EQ: rows of fader slots */
function faders(n: number, rows: number, x0 = 90, x1 = 430) {
  return (H: number): ArtElement[] => {
    const out: ArtElement[] = [];
    const rh = H / rows, pitch = (x1 - x0) / n;
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      const x = x0 + i * pitch + pitch / 2, y0 = r * rh + rh * 0.18, y1 = (r + 1) * rh - rh * 0.18;
      out.push({ t: 'line', x1: x, y1: y0, x2: x, y2: y1, stroke: '#050506', sw: 1 }, A.rect(x - 2, (y0 + y1) / 2 - 1.5, 4, 3, '#c9ccd1', 0.4));
    }
    out.push(A.sw(445, H / 2 - 7));
    return out;
  };
}
const btnRow = (x: number, y: number, labels: string[], w = 10): ArtElement[] => labels.map((l, i) => A.btn(x + i * (w + 3), y, w, 6, l));

// ================================================================== EQ & Dynamik (live + studio)
const twoChanRear = (jack = true) => [G([PSU]), G([
  B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Out A', 'Out B'], 'XLR3M', 'out', { gap: 5 }),
  ...(jack ? [jacks(['In A (Klinke)', 'Out A (Klinke)', 'In B (Klinke)', 'Out B (Klinke)'], 'io', { gap: 8 })] : []),
], 'right')];
const eqDyn: DeviceTemplate[] = [
  mk({ id: 'dbx-231s', name: '231s', man: 'dbx', cat: EQD, u: 2, depth: 200, color: '#1f2022', logo: 'dbx', model: '231s Graphic EQ', fa: faders(31, 2), rear: twoChanRear(), src: SRC.DS, notes: '2 × 31 Bänder.' }),
  mk({ id: 'dbx-1231', name: '1231', man: 'dbx', cat: EQD, u: 3, depth: 200, color: '#1f2022', logo: 'dbx', model: '1231 Graphic EQ', fa: faders(31, 2), rear: twoChanRear(), src: SRC.DS }),
  mk({ id: 'kt-dn370', name: 'DN370', man: 'Klark Teknik', cat: EQD, u: 2, depth: 260, color: '#2a2b2e', logo: 'KLARK TEKNIK', model: 'DN370 Graphic EQ', fa: faders(30, 2), rear: twoChanRear(false), src: SRC.DS, notes: '2 × 30 Bänder.' }),
  mk({ id: 'beh-fbq3102hd', name: 'FBQ3102HD', man: 'Behringer', cat: EQD, u: 2, depth: 200, color: '#2b2d31', logo: 'BEHRINGER', fa: faders(31, 2), rear: twoChanRear(), src: SRC.DS }),
  mk({ id: 'dbx-166xs', name: '166xs', man: 'dbx', cat: EQD, u: 1, depth: 180, color: '#1f2022', logo: 'dbx', model: '166xs Compressor/Gate', fa: outboard(14, { leds: 2 }), rear: [G([PSU]), G([B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Out A', 'Out B'], 'XLR3M', 'out', { gap: 4 }), jacks(['In A (Klinke)', 'Out A (Klinke)', 'SC A', 'In B (Klinke)', 'Out B (Klinke)', 'SC B'], 'io', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'dbx-160a', name: '160A', man: 'dbx', cat: EQD, u: 1, slots: 2, bodyW: 220, depth: 170, color: '#26272a', logo: 'dbx', fa: [A.knob(80, 21.8, 6), A.knob(105, 21.8, 6), A.knob(130, 21.8, 6), A.leds(150, 14, 3, ['#ef4444', '#f59e0b', '#22c55e'])], rear: [G([B.one('In', 'XLR3F', 'in'), B.one('Out', 'XLR3M', 'out', { gap: 4 }), B.one('Power', 'IEC_C14', 'in', { gap: 10 })], 'center')], src: SRC.EST, notes: 'Halbe Breite, Rackkit.' }),
  mk({ id: 'drawmer-ds201', name: 'DS201', man: 'Drawmer', cat: EQD, u: 1, depth: 200, color: '#1b2a3a', logo: 'DRAWMER', model: 'DS201 Dual Gate', fa: outboard(12, { leds: 2 }), rear: [G([PSU]), G([B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Out A', 'Out B'], 'XLR3M', 'out', { gap: 4 }), jacks(['Key A', 'Key B'], 'in', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'drawmer-dl241', name: 'DL241', man: 'Drawmer', cat: EQD, u: 1, depth: 200, color: '#1b2a3a', logo: 'DRAWMER', model: 'DL241 Dual Compressor', fa: outboard(14, { leds: 2 }), rear: [G([PSU]), G([B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Out A', 'Out B'], 'XLR3M', 'out', { gap: 4 }), jacks(['Key A', 'Key B'], 'in', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'bss-dpr901ii', name: 'DPR-901 II', man: 'BSS', cat: EQD, u: 1, depth: 200, color: '#26282c', logo: 'BSS', model: 'DPR-901 II Dynamic EQ', fa: outboard(12, { leds: 2 }), rear: twoChanRear(false), src: SRC.DS }),
  mk({ id: 'beh-mdx4600', name: 'MDX4600', man: 'Behringer', cat: EQD, u: 1, depth: 200, color: '#2b2d31', logo: 'BEHRINGER', fa: outboard(20, { rows: 2, r: 3.5 }), rear: [G([PSU]), G([B.xin(4, 'In '), B.xout(4, 'Out ', { gap: 4 }), jacks(seq('SC ', 4), 'in', { gap: 6 })], 'right')], src: SRC.EST, notes: '4-Kanal Kompressor/Gate.' }),
  // studio classics
  mk({ id: 'ua-1176ln', name: '1176LN', man: 'Universal Audio', cat: EQD, u: 2, depth: 230, color: '#1d1d1f', frontColor: '#16181b', logo: 'UNIVERSAL AUDIO', fa: (H) => [...vu(300, 18, 60, 48), A.knob(110, H / 2, 13), A.knob(160, H / 2, 13), A.knob(210, H / 2, 6), A.knob(240, H / 2, 6), ...btnRow(380, 36, ['4', '8', '12', '20'], 8), A.sw(445, H / 2 - 7)], rear: [G([PSU]), G([B.one('In', 'XLR3F', 'in'), B.one('Out', 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS, notes: 'FET-Kompressor.' }),
  mk({ id: 'ua-la2a', name: 'Teletronix LA-2A', man: 'Universal Audio', cat: EQD, u: 3, depth: 230, color: '#9aa1a8', frontColor: '#a9b0b6', ink: '#1f2328', logo: 'TELETRONIX', model: 'LA-2A Leveling Amplifier', fa: (H) => [{ t: 'knob', x: 110, y: H / 2, r: 16, fill: '#1f2022' }, { t: 'knob', x: 370, y: H / 2, r: 16, fill: '#1f2022' }, ...vu(200, H / 2 - 30, 80, 60), A.sw(300, H / 2 - 7)], rear: [G([PSU]), G([B.one('In', 'XLR3F', 'in'), B.one('Out', 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS, notes: 'Röhren-Opto-Kompressor.' }),
  mk({ id: 'tubetech-cl1b', name: 'CL 1B', man: 'Tube-Tech', cat: EQD, u: 2, depth: 220, color: '#2f3b4a', logo: 'TUBE-TECH', fa: outboard(6, { vu: 1, r: 9 }), rear: [G([PSU]), G([B.one('In', 'XLR3F', 'in'), B.one('Out', 'XLR3M', 'out', { gap: 6 }), jacks(['Sidechain In', 'Sidechain Out', 'Link'], 'io', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'ssl-fusion', name: 'Fusion', man: 'Solid State Logic', cat: EQD, u: 2, depth: 260, color: '#3a3c40', logo: 'SSL', model: 'Fusion Stereo Colour Processor', fa: outboard(14, { rows: 2, r: 6 }), rear: [G([PSU]), G([B.list(['In L', 'In R'], 'XLR3F', 'in'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'neve-33609', name: '33609/JD', man: 'AMS Neve', cat: EQD, u: 2, depth: 280, color: '#6b7a8f', ink: '#111', logo: 'NEVE', model: '33609/JD Stereo Compressor', fa: outboard(10, { rows: 2, vu: 2, r: 6 }), rear: [G([PSU]), G([B.list(['In L', 'In R'], 'XLR3F', 'in'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'el-distressor', name: 'EL8 Distressor', man: 'Empirical Labs', cat: EQD, u: 2, depth: 210, color: '#202124', logo: 'EMPIRICAL LABS', fa: outboard(4, { r: 9, leds: 1 }), rear: [G([PSU]), G([B.one('In', 'XLR3F', 'in'), B.one('Out', 'XLR3M', 'out', { gap: 6 }), jacks(['Link'], 'io', { gap: 6 })], 'right')], src: SRC.EST }),
];

// ================================================================== Effektgeräte
const fxRear = (o: { aes?: boolean; midi?: string[]; wc?: boolean; usb?: boolean; net?: boolean; jack?: boolean } = {}) => [G([PSU]), G([
  B.list(['In L', 'In R'], 'XLR3F', 'in'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 4 }),
  ...(o.jack ? [jacks(['In L (Klinke)', 'In R (Klinke)', 'Out L (Klinke)', 'Out R (Klinke)'], 'io', { gap: 6 })] : []),
  ...(o.aes ? [B.one('AES In', 'XLR3F', 'in', { gap: 6 }), B.one('AES Out', 'AES-XLR', 'out', { gap: 3 })] : []),
  ...(o.midi ? [B.list(o.midi, 'DIN5', 'io', { gap: 6 })] : []),
  ...(o.wc ? [B.one('Word Clock', 'BNC75', 'in', { gap: 5 })] : []),
  ...(o.usb ? [B.one('USB', 'USB', 'io', { gap: 5 })] : []),
  ...(o.net ? [B.one('Ethernet', 'RJ45', 'io', { gap: 5 })] : []),
], 'right')];
const fxFront = (lcdX = 120, lcdW = 70) => (H: number): ArtElement[] => [A.lcd(lcdX, 9, lcdW, 26, '#dbeafe', false), A.knob(lcdX + lcdW + 20, H / 2, 8), ...btnRow(lcdX + lcdW + 40, 12, ['', '', '', ''], 9), ...btnRow(lcdX + lcdW + 40, 25, ['', '', '', ''], 9), A.sw(445, H / 2 - 7)];
const effects: DeviceTemplate[] = [
  mk({ id: 'yam-spx2000', name: 'SPX2000', man: 'Yamaha', cat: FX, u: 1, depth: 300, color: '#232528', logo: 'YAMAHA', fa: fxFront(), rear: fxRear({ aes: true, midi: ['MIDI In', 'MIDI Out'], wc: true, usb: true, jack: true }), src: SRC.DS }),
  mk({ id: 'lexicon-pcm96', name: 'PCM96', man: 'Lexicon', cat: FX, u: 1, depth: 280, color: '#1d1e20', logo: 'LEXICON', fa: fxFront(), rear: fxRear({ aes: true, midi: ['MIDI In', 'MIDI Out'], net: true }), src: SRC.DS }),
  mk({ id: 'lexicon-pcm92', name: 'PCM92', man: 'Lexicon', cat: FX, u: 1, depth: 280, color: '#1d1e20', logo: 'LEXICON', fa: fxFront(), rear: fxRear({ aes: true, midi: ['MIDI In', 'MIDI Out'], usb: true, jack: true }), src: SRC.DS }),
  mk({ id: 'tc-m3000', name: 'M3000', man: 'TC Electronic', cat: FX, u: 1, depth: 260, color: '#2a2c30', logo: 'TC ELECTRONIC', fa: fxFront(), rear: fxRear({ aes: true, midi: ['MIDI In', 'MIDI Out', 'MIDI Thru'], wc: true }), src: SRC.DS }),
  mk({ id: 'tc-reverb4000', name: 'Reverb 4000', man: 'TC Electronic', cat: FX, u: 1, depth: 260, color: '#2a2c30', logo: 'TC ELECTRONIC', fa: fxFront(), rear: fxRear({ aes: true, midi: ['MIDI In', 'MIDI Out'] }), src: SRC.DS }),
  mk({ id: 'bricasti-m7', name: 'Model 7 (M7)', man: 'Bricasti Design', cat: FX, u: 1, depth: 300, color: '#b8bcc2', ink: '#1f2328', logo: 'BRICASTI', model: 'M7 Stereo Reverb', fa: fxFront(160, 90), rear: fxRear({ aes: true, midi: ['MIDI In'] }), src: SRC.DS }),
  mk({ id: 'eventide-h9000', name: 'H9000', man: 'Eventide', cat: FX, u: 1, depth: 300, color: '#1d1e20', logo: 'EVENTIDE', fa: fxFront(110, 110),
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([{ c: 'DSUB25', names: ['Analog In 1–8', 'Analog Out 1–8'], dir: 'io', pitch: 55 }, { c: 'DSUB25-AES', names: ['AES 1–8'], dir: 'io', gap: 4 }, B.list(['ADAT In 1', 'ADAT Out 1'], 'TOSLINK', 'io', { gap: 5 }), B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 5 }), B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: SRC.EST }),
];

// ================================================================== Mikrofonsplitter / Kopfhörer / Zuspieler
const splitters: DeviceTemplate[] = [
  mk({ id: 'radial-ox8j', name: 'OX8-j', man: 'Radial', cat: SPLIT, u: 1, depth: 220, color: '#2b2d31', logo: 'RADIAL', model: 'OX8-j 8-Kanal-Splitter', front: [G([B.xin(8, 'In ')], 'right')], rear: [G([B.xout(8, 'Direct '), B.xout(8, 'Iso ', { gap: 8 })], 'center')], src: SRC.EST, notes: '8 Kanäle: Direkt + 1 trafosymmetrierter Abgang.' }),
  mk({ id: 'gen-split8x3', name: 'Mikrofonsplitter 8 Kanäle 3-fach', man: 'Generisch', cat: SPLIT, u: 2, depth: 200, color: '#1f2126', model: 'Splitter 8 × 3',
    front: [G([B.xin(8, 'In ', { ys: [22] }), B.xout(8, 'Direct ', { ys: [66], stack: true })], 'right')], rear: [G([B.xout(8, 'Iso A ', { ys: [22] }), B.xout(8, 'Iso B ', { ys: [66], stack: true })], 'center')], src: GEN }),
  mk({ id: 'gen-split16x2', name: 'Mikrofonsplitter 16 Kanäle 2-fach', man: 'Generisch', cat: SPLIT, u: 2, depth: 200, color: '#1f2126', model: 'Splitter 16 × 2',
    front: [G([B.xin(16, 'In ', { ys: [22] }), B.xout(16, 'Direct ', { ys: [66], stack: true })], 'center')], rear: [G([B.xout(16, 'Iso ', { ys: [44] })], 'center')], src: GEN }),
];
const headphone: DeviceTemplate[] = [
  mk({ id: 'beh-ha8000', name: 'HA8000 V2', man: 'Behringer', cat: HP, u: 1, depth: 180, color: '#2b2d31', logo: 'BEHRINGER', front: [G([jacks(seq('Phones ', 8), 'out', { pitch: 28 })], 'right')], fa: [A.knob(100, 21.8, 6)], rear: [G([PSU]), G([B.list(['Main In L', 'Main In R'], 'COMBO', 'in'), jacks(seq('Aux In ', 8), 'in', { gap: 8 })], 'right')], src: SRC.DS, notes: '8 Kopfhörerkanäle.' }),
  mk({ id: 'beh-ha4700', name: 'HA4700', man: 'Behringer', cat: HP, u: 1, depth: 180, color: '#2b2d31', logo: 'BEHRINGER', front: [G([jacks(seq('Phones ', 4), 'out', { pitch: 50 })], 'right')], rear: [G([PSU]), G([jacks(['Main In L', 'Main In R'], 'in'), jacks(seq('Aux In ', 4), 'in', { gap: 8 })], 'right')], src: SRC.DS }),
  mk({ id: 'art-headamp6pro', name: 'HeadAMP 6 Pro', man: 'ART', cat: HP, u: 1, depth: 160, color: '#26282c', logo: 'ART', front: [G([jacks(seq('Phones ', 6), 'out', { pitch: 40 })], 'right')], rear: [G([PSU]), G([B.list(['In L', 'In R'], 'XLR3F', 'in'), jacks(seq('Aux In ', 6), 'in', { gap: 8 })], 'right')], src: SRC.DS }),
];
const players: DeviceTemplate[] = [
  ...variants({ id: '', name: '', man: 'Denon Professional', cat: REC, u: 1, depth: 260, color: '#1d1e20', logo: 'DENON',
    front: [G([B.one('USB', 'USB', 'io')], 'left', { x0: 300 })], fa: [A.lcd(150, 10, 80, 23, '#dbeafe', false), ...btnRow(330, 16, ['', '', '', ''], 12)],
    rear: [G([PSU, B.one('RS-232C', 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.list(['In L', 'In R'], 'XLR3F', 'in'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 4 }), B.list(['RCA In L', 'RCA In R', 'RCA Out L', 'RCA Out R'], 'RCA', 'io', { gap: 6 })], 'right')],
    src: SRC.DS }, [['denon-dn700r', 'DN-700R'], ['denon-dn300r', 'DN-300R MKII']]),
  mk({ id: 'tascam-ssr250n', name: 'SS-R250N', man: 'Tascam', cat: REC, u: 1, depth: 300, color: '#202124', logo: 'TASCAM',
    front: [G([B.one('USB', 'USB', 'io')], 'left', { x0: 300 })], fa: [A.lcd(150, 10, 80, 23, '#dbeafe', false)],
    rear: [G([PSU, B.one('RS-232C', 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.list(['In L', 'In R'], 'XLR3F', 'in'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS }),
  mk({ id: 'tascam-bdmp4k', name: 'BD-MP4K', man: 'Tascam', cat: REC, u: 1, depth: 300, color: '#202124', logo: 'TASCAM', fa: [A.rect(110, 14, 130, 6, '#0b0b0c'), A.lcd(260, 10, 70, 23, '#dbeafe', false)],
    rear: [G([PSU, B.one('RS-232C', 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.one('HDMI Out', 'HDMI', 'out'), B.list(['Out L', 'Out R'], 'XLR3M', 'out', { gap: 6 }), B.one('Coaxial Out', 'RCA', 'out', { gap: 6 })], 'right')], src: SRC.EST, notes: 'Blu-ray-Zuspieler.' }),
];

// ================================================================== Audio-Netzwerk / Wandler
const converters: DeviceTemplate[] = [
  mk({ id: 'focusrite-rednet-d16r', name: 'RedNet D16R MkII', man: 'Focusrite', cat: CONV, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([{ c: 'DSUB25-AES', names: ['AES 1–8', 'AES 9–16'], dir: 'io', pitch: 55 }, B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: '16 AES3-Kanäle (D-Sub 25) auf Dante.' }),
  mk({ id: 'ferrofish-a32dante', name: 'A32 Dante', man: 'Ferrofish', cat: CONV, u: 1, depth: 250, color: '#1d1e20', logo: 'FERROFISH',
    fa: [A.lcd(140, 9, 90, 26, '#dbeafe', false)],
    rear: [G([PSU]), G([{ c: 'DSUB25', names: ['In 1–8', 'In 9–16', 'In 17–24', 'In 25–32', 'Out 1–8', 'Out 9–16', 'Out 17–24', 'Out 25–32'], dir: 'io', rows: 2, pitch: 55 }, B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 })], 'right')],
    src: SRC.EST, notes: '32 × 32 analog (D-Sub 25), ADAT, Dante.' }),
  mk({ id: 'rme-m32adpro', name: 'M-32 AD Pro II', man: 'RME', cat: CONV, u: 1, depth: 260, color: '#2a2c30', logo: 'RME',
    fa: [A.lcd(140, 9, 70, 26, '#dbeafe', false), ...Array.from({ length: 32 }, (_, i) => A.leds(230 + i * 6, 15, 2, ['#22c55e', '#f59e0b'], 0, 5, 0.8))],
    rear: [G([PSU]), G([{ c: 'DSUB25', names: ['In 1–8', 'In 9–16', 'In 17–24', 'In 25–32'], dir: 'in', rows: 2, pitch: 55 }, B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { rows: 2, gap: 6 }), B.list(['MADI Optical In', 'MADI Optical Out'], 'GENERIC', 'io', { rows: 2, gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 })], 'right')],
    src: SRC.EST, notes: '32 analoge Eingänge auf MADI und Dante.' }),
  mk({ id: 'rme-madi-router', name: 'MADI Router', man: 'RME', cat: CONV, u: 1, depth: 220, color: '#2a2c30', logo: 'RME',
    rear: [G([PSU]), G([B.list(seq('MADI BNC In ', 4).concat(seq('MADI BNC Out ', 4)), 'MADI-BNC', 'io', { rows: 2 }), B.list(['MADI Optical In 1', 'MADI Optical Out 1', 'MADI Optical In 2', 'MADI Optical Out 2'], 'GENERIC', 'io', { rows: 2, gap: 8 }), B.list(['MADI TP 1', 'MADI TP 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 8 })], 'right')],
    src: SRC.EST }),
];

// ================================================================== Signalprozessoren / Endstufen (Ergänzung)
const dsp2: DeviceTemplate[] = [
  mk({ id: 'lake-lm26', name: 'LM 26', man: 'Lake', cat: DSP, u: 1, depth: 300, color: '#1f2124', logo: 'LAKE', fa: [A.lcd(150, 10, 60, 23, '#dbeafe')],
    rear: [G([PSU]), G([B.xin(2, 'In '), B.one('AES In', 'XLR3F', 'in', { gap: 4 }), B.xout(6, 'Out ', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 8 })], 'right')], src: SRC.EST }),
  mk({ id: 'meyer-galaxy408', name: 'GALAXY 408', man: 'Meyer Sound', cat: DSP, u: 1, depth: 300, color: '#1f2124', logo: 'MEYER SOUND', model: 'GALAXY 408', fa: [A.lcd(150, 10, 70, 23, '#dbeafe')],
    rear: [G([PSU]), G([B.xin(4, 'In '), B.xout(8, 'Out ', { gap: 6 }), B.list(['AVB 1', 'AVB 2'], 'RJ45', 'io', { gap: 8 })], 'right')], src: SRC.EST }),
  mk({ id: 'xta-dp548', name: 'DP548', man: 'XTA', cat: DSP, u: 1, depth: 250, color: '#2a2c30', logo: 'XTA', fa: [A.lcd(80, 10, 50, 23, '#bbf7d0')],
    rear: [G([PSU, B.one('RS-232', 'DSUB9', 'io', { gap: 8 })]), G([B.xin(4, 'In '), B.xout(8, 'Out ', { gap: 8 })], 'right')], src: SRC.DS }),
  mk({ id: 'bss-blu160', name: 'BLU-160', man: 'BSS', cat: DSP, u: 1, depth: 300, color: '#1f2022', logo: 'BSS',
    rear: [G([PSU]), G([{ c: 'PHOENIX3', n: 16, pre: 'Card ', dir: 'io' }, B.list(['BLU link In', 'BLU link Out', 'Network'], 'RJ45', 'io', { gap: 8 })], 'right')], src: SRC.EST, notes: '4 Kartenslots à 4 Kanäle.' }),
];
const amps2: DeviceTemplate[] = [
  mk({ id: 'db-d6', name: 'D6', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 450, color: '#2c2f33', logo: 'd&b audiotechnik', fa: ampFront(2, { grille: [120, 300] }),
    rear: ampRear({ mains: 'POWERCON_IN', ins: 2, link: true, outs: ['Out A', 'Out B'], mix: ['Out A/B'] }), rearVents: true, src: SRC.EST }),
  mk({ id: 'db-40d', name: '40D', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 440, color: '#2c2f33', logo: 'd&b audiotechnik', fa: ampFront(4, { grille: [120, 300] }), rear: installRear(4, 'IEC_C14', ['Ethernet 1', 'Ethernet 2'], false), rearVents: true, src: SRC.EST, notes: 'Installationsverstärker, Phoenix.' }),
  mk({ id: 'crown-xti4002', name: 'XTi 4002', man: 'Crown', cat: AMP, u: 2, depth: 400, color: '#1b1b1b', logo: 'CROWN', fa: ampFront(2, { grille: [130, 300] }),
    rear: [G([PSU]), G([B.combo(2, 'In ', { names: ['In A', 'In B'] }), B.list(['Thru A', 'Thru B'], 'XLR3M', 'out', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 8 })], 'center'), G([B.list(['Out A', 'Out B'], 'SPEAKON', 'out', { pitch: 30 })], 'right')], src: SRC.DS }),
  mk({ id: 'crown-cdi4600', name: 'CDi DriveCore 4|600', man: 'Crown', cat: AMP, u: 1, depth: 380, color: '#1b1b1b', logo: 'CROWN', fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4, 'IEC_C14', ['Network']), src: SRC.DS }),
  mk({ id: 'yam-pc406d', name: 'PC406-D', man: 'Yamaha', cat: AMP, u: 2, depth: 420, color: '#1d1e20', logo: 'YAMAHA', fa: ampFront(4, { grille: [130, 300] }),
    rear: [G([PSU]), G([{ c: 'PHOENIX3', n: 4, pre: 'In ', dir: 'in' }, B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 8, rows: 2 })], 'center', { x0: 70, x1: 300 }), G([B.list(['Out A/B', 'Out C/D'], 'SPEAKON', 'out', { rows: 2 }), { c: 'PHOENIX-SPK', n: 4, pre: 'Out ', dir: 'out', pitch: 23, gap: 8 }], 'right')], src: SRC.EST }),
  ...['4.2', '4.3'].map((v) => mk({ id: `qsc-pld${v.replace('.', '')}`, name: `PLD${v}`, man: 'QSC', cat: AMP, u: 2, depth: 400, color: '#1a1a1a', logo: 'QSC', fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'IEC_C14', ins: 4, link: true, outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), src: SRC.EST })),
  mk({ id: 'martin-ik42', name: 'iK42', man: 'Martin Audio', cat: AMP, u: 2, depth: 470, color: '#1c1c1e', logo: 'MARTIN AUDIO', fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, net: ['Network 1', 'Network 2'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), rearVents: true, src: SRC.EST }),
  mk({ id: 'beh-nx3000d', name: 'NX3000D', man: 'Behringer', cat: AMP, u: 1, depth: 300, color: '#2b2d31', logo: 'BEHRINGER', fa: ampFront(2, { grille: [130, 300] }),
    rear: ampRear1U({ mains: 'IEC_C14', ins: 2, link: true, outs: ['Out A', 'Out B'] }), src: SRC.DS }),
  mk({ id: 'ps-t604', name: 'T604', man: 'Powersoft', cat: AMP, u: 2, depth: 450, color: '#1b1c1f', logo: 'POWERSOFT', fa: ampFront(4, { grille: [130, 300], accent: '#f97316' }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, net: ['Network'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), rearVents: true, src: SRC.EST }),
  mk({ id: 'lg-c484', name: 'C 48:4', man: 'Lab.gruppen', cat: AMP, u: 2, depth: 420, color: '#26282b', logo: 'LAB.GRUPPEN', fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4, 'IEC_C14', ['NomadLink In', 'NomadLink Out'], false), src: SRC.EST }),
  mk({ id: 'tamp-tsa4700', name: 'TSA 4-700', man: 't.amp', cat: AMP, u: 2, depth: 450, color: '#202124', logo: 't.amp', fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'IEC_C14', ins: 4, link: true, outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), src: SRC.EST }),
];

// ================================================================== Studio: Interfaces
const thunder = (n = 2): Blk => B.list(seq('Thunderbolt ', n), 'USB-C', 'io', { rows: 2, gap: 6 });
const studio: DeviceTemplate[] = [
  mk({ id: 'ua-apollo-x8', name: 'Apollo x8', man: 'Universal Audio', cat: STU, u: 1, depth: 300, color: '#2a2c30', logo: 'UNIVERSAL AUDIO',
    front: [G([jacks(['Hi-Z 1', 'Hi-Z 2'], 'in'), jacks(['Phones 1', 'Phones 2'], 'out', { gap: 8 })], 'left', { x0: 105 })], fa: [A.lcd(200, 9, 150, 26, '#111827', false), A.knob(380, 21.8, 9), A.sw(445, 15)],
    rear: [G([PSU, B.combo(4, 'Mic ', { gap: 6 })]), G([{ c: 'JACK', names: seq('Line In ', 8), dir: 'in', ys: [11.5] }, { c: 'JACK', names: [...seq('Line Out ', 8), 'Monitor L', 'Monitor R'], dir: 'out', ys: [32], stack: true }, B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 }), thunder()], 'right')],
    src: SRC.DS, notes: '18 × 24 Thunderbolt-Interface, 4 Unison-Preamps.' }),
  mk({ id: 'ua-apollo-x8p', name: 'Apollo x8p', man: 'Universal Audio', cat: STU, u: 1, depth: 300, color: '#2a2c30', logo: 'UNIVERSAL AUDIO',
    front: [G([jacks(['Hi-Z 1', 'Hi-Z 2'], 'in'), jacks(['Phones 1', 'Phones 2'], 'out', { gap: 8 })], 'left', { x0: 105 })], fa: [A.lcd(200, 9, 150, 26, '#111827', false), A.knob(380, 21.8, 9), A.sw(445, 15)],
    rear: [G([PSU, B.combo(8, 'Mic ', { gap: 5 })]), G([{ c: 'JACK', names: [...seq('Line Out ', 8), 'Monitor L', 'Monitor R'], dir: 'out', rows: 2, pitch: 16.5 }, B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 4 }), thunder()], 'right')],
    src: SRC.DS, notes: '8 Unison-Preamps.' }),
  mk({ id: 'ua-apollo-x16', name: 'Apollo x16', man: 'Universal Audio', cat: STU, u: 1, depth: 300, color: '#2a2c30', logo: 'UNIVERSAL AUDIO',
    fa: [A.lcd(140, 9, 210, 26, '#111827', false), A.knob(380, 21.8, 9), A.sw(445, 15)],
    rear: [G([PSU]), G([{ c: 'DSUB25', names: ['Line In 1–8', 'Line In 9–16', 'Line Out 1–8', 'Line Out 9–16'], dir: 'io', rows: 2, pitch: 55 }, B.list(['Monitor L', 'Monitor R'], 'XLR3M', 'out', { gap: 6 }), B.list(['AES In', 'AES Out'], 'XLR3F', 'io', { gap: 4 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 }), thunder()], 'right')],
    src: SRC.DS, notes: '16 × 16 Line-I/O auf D-Sub 25.' }),
  ...variants({ id: '', name: '', man: 'Focusrite', cat: STU, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    front: [G([B.combo(2, 'In ')], 'left', { x0: 100 }), G([jacks(['Phones 1', 'Phones 2'], 'out')], 'right', { x1: 430 })], fa: [A.leds(170, 12, 6, ['#22c55e', '#22c55e', '#f59e0b', '#ef4444'], 6, 0), A.knob(330, 21.8, 9)],
    rear: [G([PSU, B.combo(6, 'In ', { start: 3, gap: 5 })]), G([jacks(seq('Line Out ', 10), 'out', { rows: 2, pitch: 16.5 }), B.list(['ADAT In', 'ADAT Out'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['S/PDIF In', 'S/PDIF Out'], 'RCA', 'io', { rows: 2, gap: 5 }), B.one('Word Clock Out', 'BNC75', 'out', { gap: 5 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { rows: 2, gap: 5 }), B.one('USB-C', 'USB-C', 'io', { gap: 5 })], 'right')],
    src: SRC.DS }, [['focusrite-clarett8pre', 'Clarett+ 8Pre'], ['focusrite-scarlett18i20', 'Scarlett 18i20']]),
  mk({ id: 'rme-ufx3', name: 'Fireface UFX III', man: 'RME', cat: STU, u: 1, depth: 280, color: '#2a2c30', logo: 'RME',
    front: [G([B.combo(4, 'Mic ', { pitch: 26 })], 'left', { x0: 100 }), G([jacks(['Phones 1', 'Phones 2'], 'out')], 'right', { x1: 430 })], fa: [A.lcd(220, 9, 60, 26, '#111827', false), A.knob(300, 21.8, 8)],
    rear: [G([PSU]), G([{ c: 'JACK', names: seq('Line In ', 8), dir: 'in', ys: [11.5], pitch: 16.5 }, { c: 'JACK', names: seq('Line Out ', 8), dir: 'out', ys: [32], stack: true, pitch: 16.5 }, B.list(['Main Out L', 'Main Out R'], 'XLR3M', 'out', { gap: 6 }), B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['MADI Optical In', 'MADI Optical Out'], 'GENERIC', 'io', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 }), B.one('Breakout (AES/MIDI)', 'DSUB9', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: SRC.DS }),
  mk({ id: 'rme-ucx2', name: 'Fireface UCX II', man: 'RME', cat: STU, u: 1, slots: 2, bodyW: 218, depth: 160, color: '#2a2c30', logo: 'RME',
    front: [G([B.combo(2, 'Mic '), jacks(['Inst 1', 'Phones'], 'io', { gap: 5 })], 'right')], fa: [A.lcd(70, 9, 40, 26, '#111827', false)],
    rear: [G([jacks(seq('Line In ', 4), 'in', { ys: [11.5], pitch: 15 }), jacks(seq('Line Out ', 6), 'out', { ys: [32], stack: true, pitch: 15 }), B.list(['ADAT In', 'ADAT Out'], 'TOSLINK', 'io', { rows: 2, gap: 4 }), B.list(['USB', 'Power (DC)'], 'USB', 'io', { rows: 2, gap: 4 })], 'center')],
    src: SRC.EST, notes: 'Halbe Breite, Rackkit.' }),
  mk({ id: 'rme-octamic-xtc', name: 'Octamic XTC', man: 'RME', cat: STU, u: 1, depth: 260, color: '#2a2c30', logo: 'RME',
    front: [G([B.combo(4, 'Mic ', { pitch: 26 })], 'right')], fa: [A.lcd(120, 9, 60, 26, '#111827', false), A.knob(200, 21.8, 8)],
    rear: [G([PSU]), G([B.combo(4, 'Mic ', { start: 5 }), { c: 'DSUB25', names: ['Analog Out 1–8'], dir: 'out', gap: 5 }, B.list(['ADAT Out 1', 'ADAT Out 2', 'ADAT In 1', 'ADAT In 2'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['MADI Optical In', 'MADI Optical Out'], 'GENERIC', 'io', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 })], 'right')],
    src: SRC.EST }),
  mk({ id: 'motu-828', name: '828', man: 'MOTU', cat: STU, u: 1, depth: 260, color: '#2a2c30', logo: 'MOTU',
    front: [G([B.combo(2, 'Mic ')], 'left', { x0: 100 }), G([jacks(['Phones 1', 'Phones 2'], 'out')], 'right', { x1: 430 })], fa: [A.lcd(170, 9, 120, 26, '#111827', false), A.knob(320, 21.8, 8)],
    rear: [G([PSU]), G([{ c: 'JACK', names: seq('Line In ', 8), dir: 'in', ys: [11.5], pitch: 16.5 }, { c: 'JACK', names: [...seq('Line Out ', 8), 'Main L', 'Main R'], dir: 'out', ys: [32], stack: true, pitch: 16.5 }, B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['S/PDIF In', 'S/PDIF Out'], 'RCA', 'io', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { rows: 2, gap: 5 }), B.list(['USB-C', 'AVB'], 'RJ45', 'io', { rows: 2, gap: 5 })], 'right')],
    src: SRC.DS }),
  mk({ id: 'motu-8pre-es', name: '8pre-es', man: 'MOTU', cat: STU, u: 1, depth: 260, color: '#2a2c30', logo: 'MOTU',
    front: [G([B.combo(8, 'Mic ', { pitch: 26 }), jacks(['Phones'], 'out', { gap: 6 })], 'right')],
    rear: [G([PSU]), G([jacks(['Main L', 'Main R', 'Line Out 1', 'Line Out 2'], 'out'), B.list(['ADAT In 1', 'ADAT Out 1', 'ADAT In 2', 'ADAT Out 2'], 'TOSLINK', 'io', { rows: 2, gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { rows: 2, gap: 6 }), B.list(['USB', 'AVB'], 'RJ45', 'io', { rows: 2, gap: 6 })], 'right')],
    src: SRC.DS }),
  mk({ id: 'motu-16a', name: '16A', man: 'MOTU', cat: STU, u: 1, depth: 260, color: '#2a2c30', logo: 'MOTU', fa: [A.lcd(140, 9, 200, 26, '#111827', false)],
    rear: [G([PSU]), G([{ c: 'JACK', names: seq('In ', 16), dir: 'in', ys: [11.5], pitch: 16 }, { c: 'JACK', names: seq('Out ', 16), dir: 'out', ys: [32], stack: true, pitch: 16 }, B.list(['Main L', 'Main R'], 'XLR3M', 'out', { gap: 6 }), B.list(['USB', 'AVB'], 'RJ45', 'io', { rows: 2, gap: 6 }), thunder(1)], 'right')],
    src: SRC.DS }),
  mk({ id: 'antelope-orion32', name: 'Orion 32+ Gen 4', man: 'Antelope Audio', cat: STU, u: 1, depth: 280, color: '#1d1e20', logo: 'ANTELOPE', fa: [A.lcd(130, 9, 80, 26, '#111827', false), A.knob(240, 21.8, 9)],
    rear: [G([PSU]), G([{ c: 'DSUB25', names: ['In 1–8', 'In 9–16', 'In 17–24', 'In 25–32', 'Out 1–8', 'Out 9–16', 'Out 17–24', 'Out 25–32'], dir: 'io', rows: 2, pitch: 55 }, B.list(['MADI In', 'MADI Out'], 'GENERIC', 'io', { rows: 2, gap: 5 }), B.list(['ADAT In', 'ADAT Out'], 'TOSLINK', 'io', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 }), B.list(['USB', 'Thunderbolt'], 'USB-C', 'io', { rows: 2, gap: 5 })], 'right')],
    src: SRC.EST }),
  mk({ id: 'apogee-symphony-mk2', name: 'Symphony I/O Mk II (16×16)', man: 'Apogee', cat: STU, u: 2, depth: 300, color: '#2a2c30', logo: 'APOGEE', fa: (H) => [A.lcd(140, 18, 180, 52, '#111827', false), A.knob(360, H / 2, 10)],
    rear: [G([PSU]), G([{ c: 'DSUB25', names: ['Analog In 1–8', 'Analog In 9–16', 'Analog Out 1–8', 'Analog Out 9–16'], dir: 'io', rows: 2, pitch: 55 }, B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 8 }), thunder()], 'right')],
    src: SRC.EST, notes: 'Modular; hier mit 16 × 16 analog.' }),
];

// ================================================================== Studio: Preamps / Channelstrips
const preamps: DeviceTemplate[] = [
  mk({ id: 'neve-1073dpx', name: '1073DPX', man: 'AMS Neve', cat: PRE, u: 2, depth: 300, color: '#6b7a8f', ink: '#111', logo: 'NEVE', front: [G([jacks(['DI 1', 'DI 2'], 'in', { pitch: 170 })], 'left', { x0: 90 })], fa: outboard(8, { x0: 115, x1: 430, rows: 2, r: 8, color: '#8b1e1e' }),
    rear: [G([PSU]), G([B.list(['Mic In 1', 'Mic In 2'], 'XLR3F', 'in'), B.list(['Line In 1', 'Line In 2'], 'XLR3F', 'in', { gap: 5 }), B.list(['Out 1', 'Out 2'], 'XLR3M', 'out', { gap: 5 })], 'right')], src: SRC.DS, notes: '2-Kanal Mic-Preamp/EQ.' }),
  mk({ id: 'api-3124v', name: '3124V', man: 'API', cat: PRE, u: 1, depth: 250, color: '#2f3c55', logo: 'API', front: [G([jacks(seq('DI ', 4), 'in', { pitch: 80 })], 'left', { x0: 110 })],
    rear: [G([PSU]), G([B.xin(4, 'Mic In '), B.xout(4, 'Out ', { gap: 6 })], 'right')], src: SRC.DS, notes: '4-Kanal Mic-Preamp.' }),
  mk({ id: 'api-500vpr', name: '500VPR (10 Slots)', man: 'API', cat: PRE, u: 3, depth: 230, color: '#2f3c55', logo: 'API', model: '500VPR Lunchbox 10 Slots', fa: (H) => Array.from({ length: 10 }, (_, i) => A.rect(32 + i * 42, 16, 38, H - 32, '#1f2a3d', 0.5)),
    rear: [G([PSU]), G([B.xin(10, 'In ', { ys: [36] }), B.xout(10, 'Out ', { ys: [86], stack: true })], 'right')], src: SRC.DS, notes: 'Rahmen für 10 Module im 500er-Format.' }),
  mk({ id: 'ua-6176', name: '6176', man: 'Universal Audio', cat: PRE, u: 2, depth: 260, color: '#2a2c30', logo: 'UNIVERSAL AUDIO', front: [G([jacks(['Hi-Z'], 'in')], 'left', { x0: 90 })], fa: (H) => [...vu(330, 18, 56, 48), A.knob(140, H / 2, 10), A.knob(180, H / 2, 10), A.knob(225, H / 2, 11), A.knob(270, H / 2, 11), A.sw(445, H / 2 - 7)],
    rear: [G([PSU]), G([B.one('Mic In', 'XLR3F', 'in'), B.one('Line In', 'XLR3F', 'in', { gap: 4 }), B.one('Pre Out', 'XLR3M', 'out', { gap: 4 }), B.one('Comp In', 'XLR3F', 'in', { gap: 4 }), B.one('Out', 'XLR3M', 'out', { gap: 4 })], 'right')], src: SRC.DS, notes: 'Channelstrip (610-Preamp + 1176).' }),
  mk({ id: 'avalon-vt737sp', name: 'VT-737sp', man: 'Avalon', cat: PRE, u: 2, depth: 300, color: '#9aa3ad', ink: '#111', logo: 'AVALON', front: [G([jacks(['Inst'], 'in')], 'left', { x0: 90 })], fa: outboard(10, { x0: 120, rows: 2, vu: 1, r: 7, color: '#1f2022' }),
    rear: [G([PSU]), G([B.one('Mic In', 'XLR3F', 'in'), B.one('Line In', 'XLR3F', 'in', { gap: 4 }), B.one('Out', 'XLR3M', 'out', { gap: 4 }), jacks(['Insert Send', 'Insert Return', 'Sidechain'], 'io', { gap: 6 })], 'right')], src: SRC.DS, notes: 'Röhren-Channelstrip.' }),
  mk({ id: 'focusrite-isa828', name: 'ISA 828 MkII', man: 'Focusrite', cat: PRE, u: 2, depth: 300, color: '#2f3d5e', logo: 'FOCUSRITE', front: [G([jacks(seq('Inst ', 8), 'in', { pitch: 42, ys: [70] })], 'left', { x0: 95 })], fa: outboard(16, { x0: 95, x1: 430, rows: 1, r: 6, sw: false }),
    rear: [G([PSU]), G([B.xin(8, 'Mic In ', { ys: [22] }), B.xout(8, 'Out ', { ys: [66], stack: true }), { c: 'DSUB25', names: ['Line In 1–8'], dir: 'in', gap: 8 }], 'right')], src: SRC.EST, notes: '8 ISA-Preamps.' }),
  mk({ id: 'ssl-puredrive-octo', name: 'PURE DRIVE OCTO', man: 'Solid State Logic', cat: PRE, u: 1, depth: 280, color: '#3a3c40', logo: 'SSL', fa: outboard(8, { x0: 110, r: 5.5 }),
    rear: [G([PSU]), G([B.xin(8, 'Mic In '), { c: 'DSUB25', names: ['Line Out 1–8'], dir: 'out', gap: 6 }, B.list(['ADAT Out 1', 'ADAT Out 2'], 'TOSLINK', 'out', { rows: 2, gap: 5 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 5 })], 'right')], src: SRC.EST }),
  mk({ id: 'rupert-neve-5211', name: '5211', man: 'Rupert Neve Designs', cat: PRE, u: 1, depth: 250, color: '#2a2c30', logo: 'RUPERT NEVE', front: [G([jacks(['DI 1', 'DI 2'], 'in', { pitch: 160 })], 'left', { x0: 120 })], fa: outboard(6, { x0: 150, r: 6 }),
    rear: [G([PSU]), G([B.list(['Mic In 1', 'Mic In 2'], 'XLR3F', 'in'), B.list(['Out 1', 'Out 2'], 'XLR3M', 'out', { gap: 6 })], 'right')], src: SRC.DS }),
];

// ================================================================== Patchbays
const trs48 = (id: string, name: string, man: string): DeviceTemplate => mk({
  id, name, man, cat: PB, u: 1, depth: 60, color: '#18191c', logo: false,
  front: [G([jacks(seq('Oben ', 24), 'io', { ys: [11], pitch: 17.6 }), jacks(seq('Unten ', 24), 'io', { ys: [33], stack: true, pitch: 17.6 })], 'center')],
  rear: [G([jacks(seq('R Oben ', 24), 'io', { ys: [11], pitch: 17.6 }), jacks(seq('R Unten ', 24), 'io', { ys: [33], stack: true, pitch: 17.6 })], 'center')],
  src: SRC.DS, notes: '48 Punkte 6,3 mm TRS, normalisierbar.',
});
const patchbays: DeviceTemplate[] = [
  trs48('neutrik-nys-spp-l1', 'NYS-SPP-L1', 'Neutrik'),
  trs48('samson-spatch-plus', 'S-Patch Plus', 'Samson'),
  mk({ id: 'gen-pb-tt96', name: 'TT-Patchbay 96 (D-Sub)', man: 'Generisch', cat: PB, u: 1, depth: 120, color: '#18191c', logo: false,
    front: [G([{ c: 'TT', names: seq('Oben ', 48), dir: 'io', ys: [12], pitch: 8.8 }, { c: 'TT', names: seq('Unten ', 48), dir: 'io', ys: [32], stack: true, pitch: 8.8 }], 'center')],
    rear: [G([{ c: 'DSUB25', names: ['Oben 1–8', 'Oben 9–16', 'Oben 17–24', 'Oben 25–32', 'Oben 33–40', 'Oben 41–48', 'Unten 1–8', 'Unten 9–16', 'Unten 17–24', 'Unten 25–32', 'Unten 33–40', 'Unten 41–48'], dir: 'io', rows: 2, pitch: 60 }], 'center')],
    src: GEN, notes: 'Bantam/TT, Rückseite D-Sub 25 (AES59).' }),
  mk({ id: 'gen-pb-xlr24', name: 'XLR-Patchbay 24 (Front F / Rück M)', man: 'Generisch', cat: PB, u: 2, depth: 60, color: '#18191c', logo: false,
    front: [G([B.xin(24, '', { rows: 2, dir: 'io' })], 'center')], rear: [G([B.xout(24, 'R', { rows: 2, dir: 'io' })], 'center')], src: GEN }),
];

// ================================================================== Video
const sdiRow = (pre: string, n: number, dir: Blk['dir'], ys: number[], o: Partial<Blk> = {}): Blk => B.bnc(n, pre, dir, { ys, rows: ys.length, ...o });
const video: DeviceTemplate[] = [
  mk({ id: 'bmd-atem-2me-constellation-hd', name: 'ATEM 2 M/E Constellation HD', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.lcd(150, 9, 60, 26, '#111827', false)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in'), B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdiRow('SDI In ', 20, 'in', [11]), sdiRow('SDI Out ', 12, 'out', [32.6], { stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })], 'right')], src: SRC.EST }),
  mk({ id: 'bmd-atem-4me-constellation-hd', name: 'ATEM 4 M/E Constellation HD', man: 'Blackmagic Design', cat: VID, u: 2, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.lcd(150, 22, 90, 44, '#111827', false)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in', { rows: 2 }), B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdiRow('SDI In ', 40, 'in', [12, 32]), sdiRow('SDI Out ', 24, 'out', [56, 76], { stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })], 'right')], src: SRC.EST }),
  mk({ id: 'bmd-multiview16', name: 'MultiView 16', man: 'Blackmagic Design', cat: VID, u: 1, depth: 200, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.lcd(150, 9, 60, 26, '#111827', false)],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 4 })]), G([sdiRow('SDI In ', 16, 'in', [11]), sdiRow('SDI Out ', 2, 'out', [32.6], { stack: true }), B.one('HDMI Out', 'HDMI', 'out', { gap: 8 })], 'right')], src: SRC.DS }),
  mk({ id: 'bmd-cleanswitch-12', name: 'Smart Videohub CleanSwitch 12×12', man: 'Blackmagic Design', cat: VID, u: 1, depth: 200, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.lcd(150, 9, 60, 26, '#111827', false)],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })]), G([sdiRow('SDI In ', 12, 'in', [11]), sdiRow('SDI Out ', 12, 'out', [32.6], { stack: true })], 'right')], src: SRC.DS }),
  mk({ id: 'bmd-teranex-av', name: 'Teranex AV', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.lcd(150, 9, 60, 26, '#111827', false), A.knob(230, 21.8, 8)],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdiRow('SDI In ', 2, 'in', [11]), sdiRow('SDI Out ', 2, 'out', [32.6], { stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 5 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { rows: 2, gap: 6 }), B.list(['Audio In L', 'Audio In R'], 'XLR3F', 'in', { gap: 6 }), B.list(['Audio Out L', 'Audio Out R'], 'XLR3M', 'out', { gap: 4 })], 'right')], src: SRC.EST }),
  mk({ id: 'bmd-hyperdeck-hd-pro', name: 'HyperDeck Studio HD Pro', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC', fa: [A.rect(110, 12, 70, 20, '#111214'), A.lcd(195, 9, 60, 26, '#111827', false), A.rect(270, 12, 70, 20, '#111214')],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('RS-422', 'DSUB9', 'io', { gap: 5 })]), G([sdiRow('SDI In ', 1, 'in', [11]), sdiRow('SDI Out ', 2, 'out', [32.6], { stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 4 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { rows: 2, gap: 5 }), B.list(['Audio In 1', 'Audio In 2'], 'XLR3F', 'in', { gap: 5 }), B.list(['Audio Out 1', 'Audio Out 2'], 'XLR3M', 'out', { gap: 3 }), B.one('Timecode In', 'XLR3F', 'in', { gap: 3 })], 'right')],
    src: SRC.EST }),
  ...variants({ id: '', name: '', man: 'Blackmagic Design', cat: VID, u: 1, slots: 3, bodyW: 150, depth: 120, color: '#2a2c30', logo: 'BLACKMAGIC', src: SRC.DS, notes: '1/3 Breite (Teranex Mini Rack Shelf).' }, [
    ['bmd-teranex-mini-sdi-hdmi', 'Teranex Mini SDI to HDMI 12G', { fa: [A.lcd(40, 9, 40, 26, '#111827', false)], rear: [G([B.one('SDI In', 'BNC-SDI', 'in'), B.one('SDI Loop', 'BNC-SDI', 'out', { gap: 4 }), B.one('HDMI Out', 'HDMI', 'out', { gap: 5 }), B.one('Power', 'IEC_C14', 'in', { gap: 5 })], 'center')] }],
    ['bmd-teranex-mini-hdmi-sdi', 'Teranex Mini HDMI to SDI 12G', { fa: [A.lcd(40, 9, 40, 26, '#111827', false)], rear: [G([B.one('HDMI In', 'HDMI', 'in'), B.one('SDI Out 1', 'BNC-SDI', 'out', { gap: 5 }), B.one('SDI Out 2', 'BNC-SDI', 'out', { gap: 4 }), B.one('Power', 'IEC_C14', 'in', { gap: 5 })], 'center')] }],
  ]),
  mk({ id: 'aja-kumo1616', name: 'KUMO 1616-12G', man: 'AJA', cat: VID, u: 1, depth: 200, color: '#26282c', logo: 'AJA',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in'), B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })]), G([sdiRow('SDI In ', 16, 'in', [11]), sdiRow('SDI Out ', 16, 'out', [32.6], { stack: true })], 'right')], src: SRC.DS }),
  mk({ id: 'aja-kumo3232', name: 'KUMO 3232-12G', man: 'AJA', cat: VID, u: 2, depth: 200, color: '#26282c', logo: 'AJA',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in', { rows: 2 }), B.one('Ethernet', 'RJ45', 'io', { gap: 5 }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })]), G([sdiRow('SDI In ', 32, 'in', [12, 32]), sdiRow('SDI Out ', 32, 'out', [56, 76], { stack: true })], 'right')], src: SRC.DS }),
  mk({ id: 'aja-fs-hdr', name: 'FS-HDR', man: 'AJA', cat: VID, u: 1, depth: 400, color: '#26282c', logo: 'AJA', fa: [A.lcd(150, 9, 60, 26, '#111827', false), A.knob(230, 21.8, 8)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in'), B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdiRow('SDI In ', 4, 'in', [11]), sdiRow('SDI Out ', 4, 'out', [32.6], { stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 5 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { rows: 2, gap: 6 }), B.one('AES', 'DSUB25-AES', 'io', { gap: 6 })], 'right')], src: SRC.EST }),
  mk({ id: 'gen-sdi-da8', name: 'SDI-Verteilverstärker 1→8', man: 'Generisch', cat: VID, u: 1, depth: 150, color: '#26282c',
    rear: [G([PSU]), G([sdiRow('In', 1, 'in', [21.8], { names: ['SDI In'] }), sdiRow('Loop', 1, 'out', [21.8], { names: ['SDI Loop'], gap: 4 }), sdiRow('SDI Out ', 8, 'out', [21.8], { gap: 12 })], 'right')], src: GEN }),
  mk({ id: 'gen-hdmi-matrix88', name: 'HDMI-Matrix 8×8', man: 'Generisch', cat: VID, u: 1, depth: 250, color: '#26282c', fa: [A.lcd(150, 9, 50, 26, '#111827', false), ...btnRow(220, 10, seq('', 8), 9), ...btnRow(220, 24, seq('', 8), 9)],
    rear: [G([PSU, B.one('RS-232', 'DSUB9', 'io', { gap: 5 }), B.one('LAN', 'RJ45', 'io', { gap: 5 })]), G([B.list(seq('HDMI In ', 8), 'HDMI', 'in', { ys: [12], pitch: 19 }), B.list(seq('HDMI Out ', 8), 'HDMI', 'out', { ys: [32], stack: true, pitch: 19 })], 'right')], src: GEN }),
  mk({ id: 'gen-sdi-fiber', name: 'SDI-Glasfaser-Konverter (opticalCON)', man: 'Generisch', cat: VID, u: 1, slots: 3, bodyW: 150, depth: 160, color: '#26282c', model: 'SDI ⇄ Fiber',
    rear: [G([B.one('SDI In', 'BNC-SDI', 'in'), B.one('SDI Out', 'BNC-SDI', 'out', { gap: 3 }), B.one('Fiber', 'OPTICALCON', 'io', { gap: 4 }), B.one('Power', 'DC', 'in', { gap: 4 })], 'center')], src: GEN }),
  mk({ id: 'gen-kvm-1u', name: 'KVM-Konsole 1 HE (17", Tastatur)', man: 'Generisch', cat: VID, u: 1, depth: 600, color: '#2a2c30', model: 'KVM 17"', fa: (H) => [A.rect(100, H / 2 - 3, 280, 6, '#111214', 1)],
    rear: [G([PSU]), G([B.list(['Video In 1', 'Video In 2'], 'HDMI', 'in'), B.list(['USB 1', 'USB 2'], 'USB', 'io', { gap: 6 })], 'right')], src: GEN, notes: 'Ausziehbarer Monitor mit Tastatur.' }),
  mk({ id: 'gen-rackmonitor-3x7', name: 'Rackmonitor 3× 7" (3 HE)', man: 'Generisch', cat: VID, u: 3, depth: 120, color: '#1d1e20', model: 'Rackmonitor 3 × 7"', logo: false,
    fa: (H) => [0, 1, 2].map((i) => A.rect(28 + i * 146, 12, 136, H - 24, '#0b0c0e', 1)),
    rear: [G([B.one('Power', 'DC', 'in')]), G([sdiRow('SDI In ', 3, 'in', [44], { pitch: 120 }), sdiRow('SDI Loop ', 3, 'out', [88], { stack: true, pitch: 120 }), B.list(seq('HDMI In ', 3), 'HDMI', 'in', { ys: [66], stack: true, pitch: 120 })], 'center')],
    src: GEN }),
  mk({ id: 'gen-mediaserver-4u', name: 'Medienserver 4 HE', man: 'Generisch', cat: VID, u: 4, depth: 600, color: '#26282c', model: 'Medienserver', fa: (H) => [A.vents(100, 30, 300, H - 60, 30)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in', { rows: 2 })]), G([B.list(seq('Video Out ', 4), 'HDMI', 'out', { rows: 2 }), sdiRow('SDI Out ', 4, 'out', [60, 100], { gap: 10 }), B.list(['LAN 1', 'LAN 2', 'LAN 3', 'LAN 4'], 'RJ45', 'io', { rows: 2, gap: 10 }), B.list(['USB 1', 'USB 2', 'USB 3', 'USB 4'], 'USB', 'io', { rows: 2, gap: 8 }), B.list(['Audio Out', 'LTC In'], 'XLR3F', 'io', { rows: 2, gap: 8 })], 'right')],
    rearVents: true, src: GEN }),
];

// ================================================================== Licht: Dimmer, Schaltpacks, Show-Control
const lighting: DeviceTemplate[] = [
  mk({ id: 'gen-dimmer6-3u', name: 'Dimmerpack 6× 2,3 kW', man: 'Generisch', cat: DIM, u: 3, depth: 350, color: '#26282c', model: 'Dimmer 6 × 2,3 kW',
    fa: (H) => [...Array.from({ length: 6 }, (_, i) => A.rect(120 + i * 30, 30, 4, H - 60, '#050506')), ...Array.from({ length: 6 }, (_, i) => A.leds(122 + i * 30, H - 22, 1, ['#22c55e'])), A.lcd(330, 30, 70, 30, '#dbeafe', false)],
    rear: [G([B.one('Netz In', 'CEE32_3P', 'in', { ys: [66] })]), G([B.one('DMX In', 'XLR5M', 'in', { ys: [36] }), B.one('DMX Thru', 'XLR5F', 'out', { ys: [96], stack: true }), { c: 'SCHUKO', n: 6, pre: 'Ch ', dir: 'out', rows: 2, ys: [40, 92], pitch: 42, gap: 12 }, B.one('Socapex Out (Ch 1–6)', 'SOCAPEX19', 'out', { ys: [66], gap: 12 })], 'right')],
    rearVents: false, src: GEN }),
  mk({ id: 'gen-dimmer12-4u', name: 'Dimmerrack 12× 2,3 kW (Socapex)', man: 'Generisch', cat: DIM, u: 4, depth: 450, color: '#26282c', model: 'Dimmer 12 × 2,3 kW',
    fa: (H) => [...Array.from({ length: 12 }, (_, i) => A.rect(100 + i * 22, 40, 4, H - 80, '#050506')), A.lcd(380, 40, 60, 30, '#dbeafe', false)],
    rear: [G([B.one('Netz In', 'CEE63_3P', 'in', { ys: [88] })]), G([B.list(['DMX In', 'DMX Thru'], 'XLR5M', 'io', { rows: 2, ys: [40, 136] }), B.list(['Socapex Out 1–6', 'Socapex Out 7–12'], 'SOCAPEX19', 'out', { rows: 2, ys: [50, 126], gap: 14 }), { c: 'SCHUKO', n: 6, pre: 'Ch ', dir: 'out', rows: 2, ys: [50, 126], pitch: 42, gap: 14 }], 'right')],
    src: GEN, notes: 'Schuko-Ausgänge parallel zu den ersten 6 Kanälen.' }),
  mk({ id: 'gen-switchpack6', name: 'Schaltpack 6 Kanäle (Relais)', man: 'Generisch', cat: DIM, u: 2, depth: 300, color: '#26282c', model: 'Schaltpack 6 × 16 A',
    fa: (H) => [...Array.from({ length: 6 }, (_, i) => A.leds(130 + i * 14, H / 2, 1, ['#22c55e'])), A.lcd(250, H / 2 - 12, 60, 24, '#dbeafe', false)],
    rear: [G([B.one('Netz In', 'CEE16_3P', 'in')]), G([B.one('DMX In', 'XLR5M', 'in', { ys: [22] }), B.one('DMX Thru', 'XLR5F', 'out', { ys: [66], stack: true }), { c: 'SCHUKO', n: 6, pre: 'Ch ', dir: 'out', pitch: 42, gap: 12 }], 'right')], src: GEN }),
  mk({ id: 'gen-socapex-breakout', name: 'Socapex-Ausspitzung 6× Schuko', man: 'Generisch', cat: DIM, u: 2, depth: 150, color: '#1f2126', model: 'Socapex → 6 × Schuko',
    front: [G([{ c: 'SCHUKO', n: 6, pre: 'Ch ', dir: 'out', pitch: 44 }], 'right')], rear: [G([B.one('Socapex In', 'SOCAPEX19', 'in')], 'right')], src: GEN }),
  // replaces a "dmXLAN node16" that ELC does not make; the id stays so saved projects still load
  mk({ id: 'elc-dmxlan-node16', name: 'dmXLAN NodeGBx 8', man: 'ELC Lighting', cat: DMX, u: 1, depth: 150, color: '#1f2022', logo: 'ELC', weight: 2, model: 'DLN8GBX',
    fa: (H) => [A.lcd(120, H / 2 - 16.5, 44, 33, '#0f172a', false), A.knob(185, H / 2, 7)],
    front: [G([B.dmx(8, 'DMX ', { dir: 'io' })], 'right')], rear: [G([B.one('Power', 'TRUE1_IN', 'in'), B.ec(2, 'Ethernet ', { gap: 16 })])],
    src: 'Datenblatt: ELC dmXLAN NodeGBx 8 Handbuch (44 × 483 × 150 mm, 2 kg; 8 × XLR5F vorne, bidirektional; 2 × Gigabit-etherCON hinten; powerCON TRUE1; 2,2"-Farbdisplay und Drehgeber), Positionen Schätzung',
    notes: 'Art-Net/sACN-Node mit 8 DMX/RDM-Ports und Gigabit-Switch. Die Slave-Version DLN8GBXSL hat kein Display.' }),
  mk({ id: 'gen-dmx-merger', name: 'DMX-Merger 2→1', man: 'Generisch', cat: DMX, u: 1, slots: 2, depth: 120, color: '#1f2126',
    front: [G([B.list(['In A', 'In B'], 'XLR5M', 'in'), B.list(['Out', 'Out 2'], 'XLR5F', 'out', { gap: 10 })], 'right')], rear: [G([B.one('Power', 'DC', 'in')], 'center')], src: GEN }),
  mk({ id: 'gen-dmx-player', name: 'DMX-Recorder / Stand-alone-Player', man: 'Generisch', cat: DMX, u: 1, depth: 160, color: '#1f2126', model: 'DMX-Player',
    fa: [A.lcd(120, 9, 60, 26, '#dbeafe', false), ...btnRow(200, 15, ['1', '2', '3', '4', '5', '6', '7', '8'], 10)],
    rear: [G([PSU, B.one('Ethernet', 'ETHERCON', 'io', { gap: 8 })]), G([B.one('DMX In', 'XLR5M', 'in'), B.list(['DMX Out 1', 'DMX Out 2'], 'XLR5F', 'out', { gap: 4 }), B.one('MIDI In', 'DIN5', 'in', { gap: 6 }), B.one('Kontakt', 'PHOENIX3', 'in', { gap: 6 })], 'right')], src: GEN }),
  mk({ id: 'gen-timecode', name: 'Timecode-Generator / Konverter', man: 'Generisch', cat: DMX, u: 1, slots: 2, depth: 150, color: '#1f2126', model: 'LTC / MTC',
    fa: [A.lcd(40, 9, 70, 26, '#fde68a', false)],
    rear: [G([B.one('LTC In', 'XLR3F', 'in'), B.one('LTC Out', 'XLR3M', 'out', { gap: 4 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 5 }), B.one('Power', 'DC', 'in', { gap: 5 })], 'center')], src: GEN }),
];

// ================================================================== Rigging: Motorsteuerungen
const estop = (x: number, H: number): ArtElement[] => [A.rect(x - 15, H / 2 - 15, 30, 30, '#facc15', 2), { t: 'circle', x, y: H / 2, r: 11, fill: '#dc2626', stroke: '#7f1d1d', sw: 1 }];
const hoistFront = (ch: number) => (H: number): ArtElement[] => [
  ...Array.from({ length: ch }, (_, i) => [A.btn(110 + i * 28, H / 2 - 12, 20, 9, '▲'), A.btn(110 + i * 28, H / 2 + 3, 20, 9, '▼')]).flat(),
  A.btn(110 + ch * 28 + 10, H / 2 - 6, 26, 12, 'GO'), A.knob(110 + ch * 28 + 60, H / 2, 7), ...estop(430, H),
];
const rigging: DeviceTemplate[] = [
  mk({ id: 'gen-hoist-d8-4', name: 'Motorsteuerung D8 4-Kanal (direkt)', man: 'Generisch', cat: RIG, u: 2, depth: 350, color: '#1d1e20', model: 'D8, 4 Kanäle', fa: hoistFront(4),
    rear: [G([B.one('Netz In', 'CEE32_3P', 'in'), B.one('Netz Thru', 'CEE32_3P', 'out', { gap: 6 })]), G([B.list(['Not-Aus In', 'Not-Aus Thru'], 'XLR4M', 'io', { rows: 2 }), { c: 'CEE16_4P', n: 4, pre: 'Motor ', dir: 'out', gap: 12, pitch: 46 }], 'right')],
    src: GEN, notes: 'Direktsteuerung BGV D8 / DGUV V17, Motor-Abgänge CEE 16 A 4-pol.' }),
  mk({ id: 'gen-hoist-d8-8', name: 'Motorsteuerung D8 8-Kanal (direkt)', man: 'Generisch', cat: RIG, u: 3, depth: 400, color: '#1d1e20', model: 'D8, 8 Kanäle', fa: hoistFront(8),
    rear: [G([B.one('Netz In', 'CEE32_3P', 'in', { ys: [40] }), B.one('Netz Thru', 'CEE32_3P', 'out', { ys: [95], stack: true })]), G([B.list(['Not-Aus In', 'Not-Aus Thru'], 'XLR4M', 'io', { rows: 2, ys: [40, 95] }), { c: 'CEE16_4P', n: 8, pre: 'Motor ', dir: 'out', gap: 12, pitch: 46, rows: 2, ys: [40, 95] }], 'right')],
    src: GEN }),
  mk({ id: 'gen-hoist-d8-8h', name: 'Motorsteuerung D8 8-Kanal (Harting)', man: 'Generisch', cat: RIG, u: 2, depth: 350, color: '#1d1e20', model: 'D8, 8 Kanäle, Harting', fa: hoistFront(8),
    rear: [G([B.one('Netz In', 'CEE32_3P', 'in')]), G([B.list(['Not-Aus In', 'Not-Aus Thru'], 'XLR4M', 'io', { rows: 2 }), B.list(['Motor 1–4', 'Motor 5–8'], 'HARTING16', 'out', { gap: 14 })], 'right')],
    src: GEN, notes: 'Je Harting 16-pol vier Motoren (Multicore zur Verteilerbox).' }),
  mk({ id: 'gen-hoist-lv-8', name: 'Motorsteuerung 8-Kanal Niederspannung (D8+)', man: 'Generisch', cat: RIG, u: 3, depth: 400, color: '#1d1e20', model: 'D8+, 8 Kanäle', fa: hoistFront(8),
    rear: [G([B.one('Netz In', 'CEE32_3P', 'in', { ys: [66] })]), G([B.list(['Not-Aus In', 'Not-Aus Thru'], 'XLR4M', 'io', { rows: 2, ys: [40, 95] }), B.list(['Steuerung 1–4', 'Steuerung 5–8'], 'HARTING16', 'out', { rows: 2, ys: [40, 95], gap: 14 }), { c: 'CEE16_4P', n: 4, pre: 'Leistung ', dir: 'out', rows: 2, ys: [40, 95], gap: 14, pitch: 46 }], 'right')],
    src: GEN, notes: 'Steuerleitungen über Harting, Leistung über CEE.' }),
  mk({ id: 'gen-estop-dist4', name: 'Not-Aus-Verteiler 4-fach', man: 'Generisch', cat: RIG, u: 1, depth: 120, color: '#1d1e20', model: 'Not-Aus 4-fach',
    fa: (H) => estop(80, H), front: [G([B.one('Not-Aus In', 'XLR4M', 'in'), B.list(seq('Not-Aus Out ', 4), 'XLR4F', 'out', { gap: 10 })], 'right')], src: GEN }),
  mk({ id: 'gen-loadcell-base', name: 'Lastmesssystem Basisstation', man: 'Generisch', cat: RIG, u: 1, depth: 200, color: '#1d1e20', model: 'Loadcell-Basis',
    fa: [A.lcd(120, 9, 100, 26, '#dbeafe', false)],
    rear: [G([PSU]), G([B.ec(4, 'Sensor-Strang ', { dir: 'in' }), B.one('Netzwerk', 'RJ45', 'io', { gap: 10 }), B.one('Alarm-Relais', 'PHOENIX3', 'out', { gap: 6 })], 'right')], src: GEN }),
  mk({ id: 'gen-hoist-power-63', name: 'Motorstromverteiler CEE 63 A → 4× CEE 32 A', man: 'Generisch', cat: RIG, u: 3, depth: 250, color: '#1d1e20', model: 'Motorstrom 63 A',
    front: [G([B.one('Netz In', 'CEE63_3P', 'in')]), G([{ c: 'CEE32_3P', n: 4, pre: 'Out ', dir: 'out', pitch: 54 }], 'right')], src: GEN }),
];

// ================================================================== Strom
const power2: DeviceTemplate[] = [
  mk({ id: 'eaton-5px1500', name: '5PX 1500i RT2U', man: 'Eaton', cat: PWR, u: 2, depth: 480, color: '#1c1d20', logo: 'EATON', weight: 26, fa: [A.lcd(320, 30, 50, 26, '#dbeafe', false), A.btn(380, 36, 10, 10, '⏻')],
    rear: [G([B.one('Netz In', 'IEC_C14', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', rows: 2, gap: 10 }, B.one('USB', 'USB', 'io', { gap: 10 }), B.one('RS-232', 'DSUB9', 'io', { gap: 6 }), B.one('Network', 'RJ45', 'io', { gap: 6 })])], src: SRC.DS, notes: 'USV 1500 VA.' }),
  mk({ id: 'eaton-9px3000', name: '9PX 3000i RT2U', man: 'Eaton', cat: PWR, u: 2, depth: 640, color: '#1c1d20', logo: 'EATON', weight: 33, fa: [A.lcd(320, 30, 50, 26, '#dbeafe', false), A.btn(380, 36, 10, 10, '⏻')],
    rear: [G([B.one('Netz In', 'IEC_C20', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', rows: 2, gap: 10 }, B.list(['Out 9 (C19)', 'Out 10 (C19)'], 'IEC_C19', 'out', { rows: 2, gap: 6 }), B.one('USB', 'USB', 'io', { gap: 8 }), B.one('Network', 'RJ45', 'io', { gap: 6 })])], src: SRC.DS, notes: 'Online-USV 3000 VA.' }),
  mk({ id: 'gen-distro-63', name: 'Stromverteiler CEE 63 A (4 HE)', man: 'Generisch', cat: PWR, u: 4, depth: 300, color: '#1f2126', model: 'CEE63 → 2 × CEE32, 2 × CEE16, Schuko',
    front: [G([B.one('Netz In', 'CEE63_3P', 'in', { ys: [50] }), { c: 'CEE32_3P', n: 2, pre: 'CEE32 ', dir: 'out', ys: [50], gap: 12, pitch: 54 }, { c: 'CEE16_3P', n: 2, pre: 'CEE16 ', dir: 'out', ys: [50], gap: 10, pitch: 48 }]), G([{ c: 'SCHUKO', n: 9, pre: 'Schuko ', dir: 'out', ys: [130], pitch: 46 }], 'center')],
    fa: (H) => [A.leds(440, 30, 3, ['#22c55e', '#22c55e', '#22c55e'], 0, 6, 1.4), A.text(434, H / 2, 'L1 L2 L3', 2)],
    src: GEN, notes: 'Mit FI/LS je Abgang (nicht dargestellt).' }),
  mk({ id: 'gen-distro-socapex', name: 'Stromverteiler CEE 32 A → 2× Socapex', man: 'Generisch', cat: PWR, u: 3, depth: 250, color: '#1f2126', model: 'CEE32 → 2 × Socapex',
    front: [G([B.one('Netz In', 'CEE32_3P', 'in'), B.list(['Socapex 1', 'Socapex 2'], 'SOCAPEX19', 'out', { gap: 20, pitch: 60 }), { c: 'SCHUKO', n: 3, pre: 'Schuko ', dir: 'out', gap: 20, pitch: 44 }])], src: GEN }),
  mk({ id: 'gen-pdu-true1-12', name: 'Stromverteiler 12× powerCON TRUE1 (2 HE)', man: 'Generisch', cat: PWR, u: 2, depth: 150, color: '#1f2126', model: 'TRUE1 12-fach',
    front: [G([B.one('Netz In', 'CEE16', 'in')]), G([{ c: 'TRUE1_OUT', n: 12, pre: 'Out ', dir: 'out', rows: 2, pitch: 32 }], 'right')], src: GEN }),
  mk({ id: 'gen-power-monitor', name: 'Netzmonitor / Phasenanzeige', man: 'Generisch', cat: PWR, u: 1, depth: 150, color: '#1f2126', model: 'Netzmonitor 3-phasig',
    fa: [A.lcd(120, 9, 120, 26, '#bbf7d0', false), A.leds(260, 15, 3, ['#22c55e', '#22c55e', '#22c55e'], 8, 0, 1.4)],
    rear: [G([B.one('Netz In', 'CEE16_3P', 'in'), B.one('Netz Thru', 'CEE16_3P', 'out', { gap: 10 })], 'right')], src: GEN, notes: 'Spannung, Strom und Phasenlage je Phase.' }),
  mk({ id: 'gen-sequencer8', name: 'Einschaltverzögerung 8× IEC', man: 'Generisch', cat: PWR, u: 1, depth: 200, color: '#1f2126', model: 'Sequenzer 8-fach',
    fa: (H) => [...Array.from({ length: 8 }, (_, i) => A.leds(140 + i * 14, H / 2, 1, ['#22c55e'])), A.sw(300, H / 2 - 7)],
    rear: [G([B.one('Netz In', 'IEC_C20', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', gap: 12, pitch: 30 }, B.one('Remote', 'PHOENIX3', 'in', { gap: 8 })])], src: GEN }),
  mk({ id: 'gen-conditioner9', name: 'Netzfilter / Power Conditioner 9× IEC', man: 'Generisch', cat: PWR, u: 1, depth: 220, color: '#1f2126', model: 'Netzfilter 9-fach',
    front: [G([B.one('Out Front', 'SCHUKO', 'out')], 'left', { x0: 60 })], fa: [A.lcd(200, 12, 60, 20, '#bbf7d0', false), A.sw(300, 15)],
    rear: [G([B.one('Netz In', 'IEC_C20', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', gap: 12, pitch: 30 }])], src: GEN }),
];

// ================================================================== Intercom
const intercom2: DeviceTemplate[] = [
  mk({ id: 'cc-fs2-base2', name: 'FreeSpeak II Base II', man: 'Clear-Com', cat: IC, u: 1, depth: 300, color: '#202124', logo: 'CLEAR-COM', fa: [A.lcd(150, 10, 90, 23, '#dbeafe'), A.knob(260, 21.8, 6)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([B.xin(4, 'Partyline ', { dir: 'io' }), B.rj(4, '4-Wire ', { gap: 5 }), B.rj(5, 'Transceiver ', { gap: 5 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 5 })], 'right')], src: SRC.EST }),
  mk({ id: 'gen-pl-psu2', name: 'Partyline-Netzteil 2-Kanal', man: 'Generisch', cat: IC, u: 1, depth: 200, color: '#202124', model: 'Partyline PSU',
    front: [G([B.list(['Headset A', 'Headset B'], 'XLR4M', 'io')], 'left', { x0: 90 })],
    rear: [G([PSU]), G([B.list(['Kanal A 1', 'Kanal A 2', 'Kanal A 3'], 'XLR3F', 'io'), B.list(['Kanal B 1', 'Kanal B 2', 'Kanal B 3'], 'XLR3F', 'io', { gap: 10 }), B.one('Program In', 'XLR3F', 'in', { gap: 10 })], 'right')], src: GEN }),
];

export const PRO2_DEVICES: DeviceTemplate[] = [
  ...eqDyn, ...effects, ...splitters, ...headphone, ...players, ...converters, ...dsp2, ...amps2,
  ...studio, ...preamps, ...patchbays, ...video, ...lighting, ...rigging, ...power2, ...intercom2,
];
