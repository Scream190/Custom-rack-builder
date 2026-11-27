import type { DeviceTemplate } from '../model/types';
import { A, ampFront, B, G, mk, SRC, statusFront, type Blk, type Spec } from './proLayout';

/*
 * Pro-audio, lighting, network and video devices for event racks, built from manufacturers' data sheets.
 * Accuracy per template in `source` (SRC.DS = connector set from the data sheet, positions estimated;
 * SRC.EST = also height / connector set partly estimated from product photos). All templates can be
 * corrected in the device editor.
 */

const NET = 'Netzwerk', DMX = 'Licht / DMX', SB = 'Stagebox', AMP = 'Endstufen', DSP = 'Signalprozessor', MIX = 'Mischpult (Rack)';
const IC = 'Intercom', VID = 'Video', REC = 'Zuspieler / Recording', PWR = 'Strom', CONV = 'Audio-Interface / Wandler', PATCH = 'Patchfeld';

/** same housing, other model names */
export const variants = (base: Spec, list: [string, string, Partial<Spec>?][]): DeviceTemplate[] =>
  list.map(([id, name, extra]) => mk({ ...base, id, name, model: name, ...extra }));

const BLACK = '#18191c', DARK = '#222428';
const PSU_TRUE1 = B.one('Power', 'TRUE1_IN', 'in');
const PSU_IEC = B.one('Power', 'IEC_C14', 'in');

// ================================================================== Netzwerk
const luminex: DeviceTemplate[] = [
  mk({
    id: 'lmx-gc10', name: 'GigaCore 10', man: 'Luminex', cat: NET, u: 1, slots: 2, depth: 190, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(8, 'Port ', { pitch: 25 }), B.sfp(2, 'SFP ', { start: 9, rows: 2, gap: 4 })], 'right')],
    rear: [G([PSU_TRUE1], 'center')],
    src: SRC.EST, notes: '8× etherCON (4× PoE), 2× SFP; halbe Breite.',
  }),
  mk({
    id: 'lmx-gc12', name: 'GigaCore 12', man: 'Luminex', cat: NET, u: 1, depth: 230, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(10)], 'right')],
    rear: [G([B.one('Power', 'POWERCON_IN', 'in'), B.ec(2, 'Port ', { start: 11, gap: 20 })])],
    fa: statusFront(150), src: SRC.DS, notes: '12× etherCON (10 vorne, 2 hinten), PoE auf den Front-Ports.',
  }),
  mk({
    id: 'lmx-gc14r', name: 'GigaCore 14R', man: 'Luminex', cat: NET, u: 1, depth: 230, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(10), B.sfp(2, 'SFP ', { start: 13, rows: 2, gap: 9 })], 'right')],
    rear: [G([B.list(['PSU A', 'PSU B'], 'POWERCON_IN', 'in'), B.ec(2, 'Port ', { start: 11, gap: 20 })])],
    fa: statusFront(130), src: SRC.DS, notes: 'Redundante Netzteile; 12× etherCON + 2× SFP.',
  }),
  mk({
    id: 'lmx-gc16xt', name: 'GigaCore 16Xt', man: 'Luminex', cat: NET, u: 1, depth: 230, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(10), B.sfp(4, 'SFP ', { start: 13, rows: 2, gap: 9 })], 'right')],
    rear: [G([B.one('Power', 'POWERCON_IN', 'in'), B.ec(2, 'Port ', { start: 11, gap: 20 })])],
    fa: statusFront(120), src: SRC.DS,
  }),
  mk({
    id: 'lmx-gc16rfo', name: 'GigaCore 16RFO', man: 'Luminex', cat: NET, u: 1, depth: 230, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(10), { c: 'OPTICALCON', n: 4, pre: 'Fiber ', start: 13, dir: 'io', gap: 9 }], 'right')],
    rear: [G([B.list(['PSU A', 'PSU B'], 'POWERCON_IN', 'in'), B.ec(2, 'Port ', { start: 11, gap: 20 })])],
    src: SRC.DS, notes: '4 Glasfaser-Ports (opticalCON), redundante Netzteile.',
  }),
  mk({
    id: 'lmx-gc18t', name: 'GigaCore 18t', man: 'Luminex', cat: NET, u: 1, depth: 230, color: BLACK, logo: 'LUMINEX',
    front: [G([B.ec(16, 'Port ', { pitch: 25.6 }), B.sfp(2, 'SFP ', { start: 17, rows: 2, gap: 5 })], 'right')],
    rear: [G([PSU_TRUE1])], src: SRC.EST,
  }),
  ...variants({
    id: '', name: '', man: 'Luminex', cat: NET, u: 1, depth: 270, color: BLACK, logo: 'LUMINEX',
    front: [G([B.rj(12, 'Port ', { rows: 2, order: 'col', pitch: 15.4 }), B.rj(12, 'Port ', { start: 13, rows: 2, order: 'col', pitch: 15.4, gap: 6 }), B.sfp(6, 'SFP ', { start: 25, rows: 2, order: 'col', gap: 9 })], 'right')],
    rear: [G([B.list(['PSU 1', 'PSU 2'], 'TRUE1_IN', 'in')])], src: SRC.DS,
  }, [
    ['lmx-gc26i', 'GigaCore 26i', { notes: '24× RJ45 (davon 4 Dual-Media), 6× SFP.' }],
    ['lmx-gc30i', 'GigaCore 30i', { notes: '24× RJ45 1 G, 6× SFP+ 10 G.' }],
  ]),
];

const ciscoFront = (blocks: number, sfp: number, sfpStart: number, combo = 0) => [
  G([B.one('Console', 'RJ45', 'io'), B.one('USB', 'USB', 'io', { gap: 4 })], 'left', { x0: 92 }),
  G([
    ...Array.from({ length: blocks }, (_, i) => B.rj(12, 'Port ', { start: 1 + i * 12, rows: 2, order: 'col', pitch: 15.2, gap: 5 })),
    ...(combo ? [B.rj(combo, 'Port ', { start: blocks * 12 + 1, rows: 2, order: 'col', pitch: 15.2, gap: 5 })] : []),
    ...(sfp ? [B.sfp(sfp, 'SFP ', { start: sfpStart, rows: 2, order: 'col', gap: 8 })] : []),
  ], 'right'),
];
const cisco: DeviceTemplate[] = [
  mk({
    id: 'cisco-cbs350-8p', name: 'CBS350-8P-E-2G', man: 'Cisco', cat: NET, u: 1, bodyW: 279, depth: 185, color: DARK, logo: 'CISCO',
    front: [G([B.rj(8, 'Port ', { pitch: 15.4 }), B.rj(2, 'Port ', { start: 9, gap: 6 }), B.sfp(2, 'SFP ', { start: 9, gap: 4 })], 'right')],
    rear: [G([B.one('Power (12 V DC)', 'DC', 'in')], 'center')],
    src: SRC.DS, notes: 'Kompakt, mit 19"-Montagekit. 8× PoE+, 2 Combo-Uplinks (RJ45/SFP).',
  }),
  mk({
    id: 'cisco-cbs350-24p', name: 'CBS350-24P-4G', man: 'Cisco', cat: NET, u: 1, depth: 350, color: DARK, logo: 'CISCO',
    front: ciscoFront(2, 4, 25), rear: [G([PSU_IEC])], src: SRC.DS, notes: '24× Gigabit PoE+, 4× SFP.',
  }),
  mk({
    id: 'cisco-cbs350-48p', name: 'CBS350-48P-4G', man: 'Cisco', cat: NET, u: 1, depth: 350, color: DARK, logo: 'CISCO',
    front: [G([...Array.from({ length: 4 }, (_, i) => B.rj(12, 'Port ', { start: 1 + i * 12, rows: 2, order: 'col', pitch: 15, gap: 4 })), B.sfp(4, 'SFP ', { start: 49, rows: 2, order: 'col', gap: 6 }), B.one('Console', 'RJ45', 'io', { gap: 6 })], 'right')],
    rear: [G([PSU_IEC])], src: SRC.DS, notes: '48× Gigabit PoE+, 4× SFP.',
  }),
  mk({
    id: 'cisco-cbs350-16p', name: 'CBS350-16P-2G', man: 'Cisco', cat: NET, u: 1, depth: 260, color: DARK, logo: 'CISCO',
    front: [G([B.one('Console', 'RJ45', 'io')], 'left', { x0: 92 }), G([B.rj(16, 'Port ', { rows: 2, order: 'col', pitch: 15.2 }), B.sfp(2, 'SFP ', { start: 17, rows: 2, order: 'col', gap: 8 })], 'right')],
    rear: [G([PSU_IEC])], src: SRC.DS,
  }),
  mk({
    id: 'cisco-sg350-10p', name: 'SG350-10P', man: 'Cisco', cat: NET, u: 1, bodyW: 279, depth: 185, color: DARK, logo: 'CISCO',
    front: [G([B.rj(8, 'Port ', { pitch: 15.4 }), B.rj(2, 'Port ', { start: 9, gap: 6 }), B.sfp(2, 'SFP ', { start: 9, gap: 4 })], 'right')],
    rear: [G([PSU_IEC], 'center')], src: SRC.DS, notes: 'Kompakt, mit 19"-Montagekit. 8× PoE+, 2 Combo-Ports.',
  }),
  mk({
    id: 'cisco-sg350-28p', name: 'SG350-28P', man: 'Cisco', cat: NET, u: 1, depth: 350, color: DARK, logo: 'CISCO',
    front: ciscoFront(2, 4, 25), rear: [G([PSU_IEC])], src: SRC.DS, notes: '24× Gigabit PoE+, 2 Combo- + 2 SFP-Ports.',
  }),
  mk({
    id: 'cisco-c1000-24p', name: 'Catalyst 1000-24P-4G-L', man: 'Cisco', cat: NET, u: 1, depth: 300, color: '#3c4148', logo: 'CISCO',
    front: ciscoFront(2, 4, 25), rear: [G([PSU_IEC])], src: SRC.DS,
  }),
  mk({
    id: 'cisco-c9200l-24p', name: 'Catalyst 9200L-24P-4G', man: 'Cisco', cat: NET, u: 1, depth: 445, color: '#3c4148', logo: 'CISCO',
    front: ciscoFront(2, 4, 25), rear: [G([B.list(['PSU 1', 'PSU 2'], 'IEC_C14', 'in')]), G([B.list(['Stack 1', 'Stack 2'], 'GENERIC', 'io')], 'right')],
    src: SRC.DS, notes: 'Zwei Netzteil-Schächte (eins bestückt).',
  }),
];

const netOther: DeviceTemplate[] = [
  mk({
    id: 'ngr-m4250-10g2f', name: 'M4250-10G2F-PoE+', man: 'Netgear', cat: NET, u: 1, bodyW: 330, depth: 210, color: '#2a2f38', logo: 'NETGEAR',
    front: [G([B.rj(8, 'Port ', { rows: 2, order: 'col', pitch: 15.4 }), B.sfp(2, 'SFP ', { start: 9, rows: 2, gap: 6 }), B.one('Console', 'RJ45', 'io', { gap: 6 })], 'right')],
    rear: [G([PSU_IEC], 'center')], src: SRC.DS, notes: 'AV Line; 8× PoE+, 2× SFP.',
  }),
  mk({
    id: 'ngr-m4250-26g4f', name: 'M4250-26G4F-PoE+', man: 'Netgear', cat: NET, u: 1, depth: 330, color: '#2a2f38', logo: 'NETGEAR',
    front: [G([B.rj(26, 'Port ', { rows: 2, order: 'col', pitch: 15.2 }), B.sfp(4, 'SFP ', { start: 27, rows: 2, order: 'col', gap: 8 }), B.one('Console', 'RJ45', 'io', { gap: 6 })], 'right')],
    rear: [G([PSU_IEC])], src: SRC.EST, notes: 'AV Line; 26× 1 G (24× PoE+), 4× SFP.',
  }),
  mk({
    id: 'ubnt-usw-pro-24-poe', name: 'USW-Pro-24-PoE', man: 'Ubiquiti', cat: NET, u: 1, depth: 285, color: '#d9dcdf', ink: '#1f2328', logo: 'UBIQUITI',
    front: [G([B.rj(24, 'Port ', { rows: 2, order: 'col', pitch: 15.2 }), B.sfp(2, 'SFP+ ', { start: 25, rows: 2, gap: 8 })], 'right')],
    fa: [A.lcd(80, 10, 26, 22, '#dbeafe', false)], rear: [G([PSU_IEC])], src: SRC.EST,
  }),
];

// ================================================================== Licht / DMX
const ma: DeviceTemplate[] = [
  mk({
    id: 'ma3-8port-node', name: 'grandMA3 onPC 8Port Node 4k', man: 'MA Lighting', cat: DMX, u: 1, depth: 210, color: '#141414', logo: 'MA LIGHTING', model: 'grandMA3 8Port Node',
    front: [G([B.dmx(8)], 'right')], fa: [A.lcd(90, 10, 46, 23, '#fff7d6'), A.knob(148, 21.8, 6)],
    rear: [G([PSU_TRUE1, B.one('Ethernet', 'ETHERCON', 'io', { gap: 12 }), B.one('USB', 'USB', 'io', { gap: 10 })])],
    src: SRC.DS, notes: '8 DMX-Ausgänge, PoE-fähig.',
  }),
  ...variants({
    id: '', name: '', man: 'MA Lighting', cat: DMX, u: 1, slots: 2, bodyW: 207, depth: 184, color: '#141414', logo: 'MA',
    fa: [A.lcd(74, 10, 52, 23, '#fff7d6'), A.knob(140, 21.8, 6)], src: SRC.DS,
  }, [
    ['ma3-4port-node', 'grandMA3 4Port Node', { rear: [G([PSU_TRUE1, B.one('Ethernet', 'ETHERCON', 'io', { gap: 5 }), B.dmx(4, 'DMX ', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 5 })], 'center')], notes: 'Halbe Breite, Rackkit für 19".' }],
    ['ma3-2port-node', 'grandMA3 2Port Node', { rear: [G([PSU_TRUE1, B.one('Ethernet', 'ETHERCON', 'io', { gap: 8 }), B.dmx(2, 'DMX ', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 8 })], 'center')] }],
    ['ma3-io-node', 'grandMA3 I/O Node', {
      rear: [G([PSU_TRUE1, B.one('Ethernet', 'ETHERCON', 'io', { gap: 4 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { gap: 4 }), B.one('LTC In', 'XLR3F', 'in', { gap: 4 }), B.one('GPI', 'DSUB9', 'io', { gap: 4 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'center')],
      notes: 'MIDI, Timecode (LTC) und GPI für grandMA3.',
    }],
  ]),
  mk({
    id: 'ma3-pu-l', name: 'grandMA3 processing unit L', man: 'MA Lighting', cat: DMX, u: 2, depth: 372, color: '#141414', logo: 'MA LIGHTING',
    fa: [A.lcd(160, 18, 110, 52, '#fff7d6'), A.knob(300, 44, 9), A.btn(325, 30, 14, 8, 'ESC'), A.btn(325, 50, 14, 8, 'OK')],
    rear: [G([PSU_TRUE1]), G([B.ec(2, 'Ethernet ', { rows: 2 }), B.dmx(8, 'DMX ', { rows: 2, gap: 10 }), B.list(['USB 1', 'USB 2', 'USB 3'], 'USB', 'io', { rows: 3, gap: 10 })], 'right')],
    rearVents: true, src: SRC.DS, weight: 5,
  }),
  mk({
    id: 'ma3-onpc-rack', name: 'grandMA3 onPC rack-unit', man: 'MA Lighting', cat: DMX, u: 2, depth: 249, color: '#141414', logo: 'MA LIGHTING',
    front: [G([B.list(['USB Front 1', 'USB Front 2'], 'USB', 'io', { rows: 2 })], 'right')], fa: [A.btn(360, 38, 12, 12, '⏻')],
    rear: [G([PSU_IEC]), G([
      B.dmx(2, 'DMX Out ', { rows: 2 }), B.one('DMX In', 'XLR5M', 'in', { gap: 5 }), B.ec(2, 'Ethernet ', { rows: 2, gap: 8 }),
      B.one('MIDI Out', 'DIN5', 'out', { gap: 6 }), B.one('LTC In', 'XLR3F', 'in', { gap: 6 }), B.list(['Audio In', 'Audio Out'], 'MINIJACK', 'io', { rows: 2, gap: 6 }),
      B.one('GPI', 'DSUB9', 'io', { gap: 6 }), B.list(['USB 1', 'USB 2', 'USB 3', 'USB 4'], 'USB', 'io', { rows: 2, gap: 6 }), B.list(['Display 1', 'Display 2'], 'HDMI', 'out', { rows: 2, gap: 6 }),
    ], 'right')],
    src: SRC.EST, weight: 4,
  }),
];

const dmxOther: DeviceTemplate[] = [
  mk({
    id: 'lmx-luminode12', name: 'LumiNode 12', man: 'Luminex', cat: DMX, u: 1, depth: 200, color: BLACK, logo: 'LUMINEX',
    front: [G([B.dmx(12, 'DMX ', { dir: 'io', pitch: 25.5 }), B.ec(2, 'Ethernet ', { gap: 8 })], 'right')],
    rear: [G([PSU_TRUE1, B.one('Power Thru', 'TRUE1_OUT', 'out', { gap: 5 })])], src: SRC.DS, notes: '12 DMX/RDM-Ports, 16 Process-Engines.',
  }),
  mk({
    id: 'lmx-luminode4', name: 'LumiNode 4', man: 'Luminex', cat: DMX, u: 1, slots: 2, bodyW: 214, depth: 160, color: BLACK, logo: 'LUMINEX',
    front: [G([B.dmx(4, 'DMX ', { dir: 'io' })], 'right')], fa: [A.lcd(72, 11, 42, 21, '#fde9c8')],
    rear: [G([B.ec(2, 'Ethernet '), PSU_TRUE1], 'center')], src: SRC.DS, notes: 'Halbe Breite; 2 Geräte nebeneinander in 1 HE.',
  }),
  mk({
    id: 'lmx-lumisplit210', name: 'LumiSplit 2.10', man: 'Luminex', cat: DMX, u: 1, depth: 170, color: BLACK, logo: 'LUMINEX',
    front: [G([B.list(['In A', 'In B'], 'XLR5M', 'in'), B.dmx(10, 'Out ', { gap: 10 })], 'right')],
    rear: [G([PSU_TRUE1, B.list(['In/Thru A', 'In/Thru B'], 'XLR5M', 'io', { gap: 16 })])], src: SRC.DS, notes: 'DMX/RDM-Splitter, 2 Zonen (A/B).',
  }),
  mk({
    // id kept from an earlier, non-existent "LumiSplit 1.10" so saved projects still load
    id: 'lmx-lumisplit110', name: 'LumiSplit 1.6', man: 'Luminex', cat: DMX, u: 1, depth: 210, color: BLACK, logo: 'LUMINEX', weight: 2.62,
    front: [G([B.one('In', 'XLR5M', 'in'), B.one('Thru', 'XLR5F', 'out', { gap: 4 }), B.dmx(6, 'Out ', { gap: 10 })], 'right')],
    rear: [G([PSU_TRUE1, B.one('Power Thru', 'TRUE1_OUT', 'out', { gap: 4 })])], src: 'Datenblatt: Luminex LumiSplit 1.6 (1 × XLR5 In, 1 × Thru, 6 × Out, TRUE1 In/Out), Positionen Schätzung',
    notes: 'DMX/RDM-Splitter, 1 Eingang auf 6 Ausgänge.',
  }),
  mk({
    id: 'obs-netron-en12', name: 'NETRON EN12', man: 'Obsidian Control', cat: DMX, u: 1, depth: 200, color: '#1b1b1d', logo: 'OBSIDIAN',
    front: [G([B.dmx(12, 'DMX ', { dir: 'io', pitch: 25.5 })], 'right')],
    rear: [G([PSU_TRUE1, B.one('Power Thru', 'TRUE1_OUT', 'out', { gap: 4 }), B.ec(2, 'Ethernet ', { gap: 16 })])], src: SRC.EST,
  }),
  mk({
    id: 'swisson-xnd8', name: 'XND-8', man: 'Swisson', cat: DMX, u: 1, depth: 136, color: '#1f2022', logo: 'SWISSON', weight: 1.8,
    front: [G([B.dmx(8, 'DMX ', { dir: 'io' }), B.ec(1, 'Ethernet ', { gap: 12 })], 'right')], rear: [G([B.one('Power In', 'POWERCON_IN', 'in'), B.one('Power Out', 'POWERCON_OUT', 'out', { gap: 6 })])],
    src: 'Datenblatt – Swisson Produktseite (XND-8R5): 19", 44,5 mm hoch, 136 mm, 1,8 kg, powerCON Ein/Aus, 8 DMX (XLR 5-pol); Zahl der Ethernet-Buchsen nicht angegeben, Positionen geschätzt',
  }),
  mk({
    id: 'gen-dmx-split8', name: 'DMX-Splitter 1→8', man: 'Generisch', cat: DMX, u: 1, depth: 150, color: '#1f2126',
    front: [G([B.one('In', 'XLR5M', 'in'), B.one('Thru', 'XLR5F', 'out', { gap: 4 }), B.dmx(8, 'Out ', { gap: 12 })], 'right')],
    rear: [G([PSU_IEC])], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-artnet-node8', name: 'Art-Net/sACN-Node 8 Universen', man: 'Generisch', cat: DMX, u: 1, depth: 160, color: '#1f2126',
    front: [G([B.dmx(8, 'DMX ', { dir: 'io' })], 'right')], rear: [G([PSU_TRUE1, B.ec(2, 'Ethernet ', { gap: 16 })])], src: 'Generische Vorlage',
  }),
];

// ================================================================== Stageboxen
const yamahaRio = (id: string, name: string, dual: boolean): DeviceTemplate => mk({
  id, name, man: 'Yamaha', cat: SB, u: 5, depth: 370, color: '#232528', logo: 'YAMAHA', weight: 12,
  front: [
    G([B.xin(32, 'In ', { rows: 4, ys: [36, 69, 102, 135], label: 'INPUT' })]),
    G([B.xout(16, 'Out ', { rows: 2, ys: [36, 69], label: 'OUTPUT' })], 'right'),
    G([B.list(['AES Out 1/2', 'AES Out 3/4', 'AES Out 5/6', 'AES Out 7/8'], 'AES-XLR', 'out', { ys: [102], label: 'AES/EBU OUT' })], 'right'),
    G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { ys: [102] })], 'left', { x0: 258 }),
  ],
  rear: [G([dual ? B.list(['Power A', 'Power B'], 'IEC_C14', 'in') : PSU_IEC])],
  src: SRC.DS, notes: '32 Mic/Line-Eingänge, 16 Ausgänge, 4× AES/EBU (8 Kanäle), Dante redundant.',
});
const yamahaRio16 = (id: string, name: string, dual: boolean): DeviceTemplate => mk({
  id, name, man: 'Yamaha', cat: SB, u: 3, depth: 362, color: '#232528', logo: 'YAMAHA', weight: 8,
  front: [
    G([B.xin(16, 'In ', { rows: 2, ys: [40, 76], label: 'INPUT' })]),
    G([B.xout(8, 'Out ', { ys: [40], label: 'OUTPUT' })], 'right'),
    G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { ys: [76] })], 'right'),
  ],
  rear: [G([dual ? B.list(['Power A', 'Power B'], 'IEC_C14', 'in') : PSU_IEC])],
  src: SRC.DS, notes: '16 Mic/Line-Eingänge, 8 Ausgänge, Dante redundant.',
});
const ahPortable = (id: string, name: string, net: [string, string]): DeviceTemplate => mk({
  id, name, man: 'Allen & Heath', cat: SB, u: 4, bodyW: 390, depth: 190, color: '#1d1e20', logo: 'ALLEN&HEATH',
  front: [
    G([B.xin(16, 'In ', { rows: 2, ys: [42, 78], label: 'INPUTS' })]),
    G([B.xout(8, 'Out ', { ys: [124], label: 'OUTPUTS' })]),
    G([B.list(net, 'ETHERCON', 'io', { ys: [124] })], 'right'),
  ],
  rear: [G([PSU_IEC], 'center')],
  src: SRC.EST, notes: 'Portables Gehäuse, im Rack mit 4-HE-Rackkit (AB168-RK19).',
});
const ahFixed48 = (id: string, name: string, man: string, logo: string, color: string, net: string[], notes: string): DeviceTemplate => mk({
  id, name, man, cat: SB, u: 4, depth: 300, color, logo, weight: 14,
  front: [
    G([B.xin(48, 'In ', { rows: 3, ys: [24, 57, 90], pitch: 26.4 })]),
    G([B.xout(16, 'Out ', { ys: [123], pitch: 26.4 })]),
    G([B.list(net, 'ETHERCON', 'io', { ys: [157] })], 'right'),
  ],
  rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')])],
  src: SRC.EST, notes,
});
const behringerMidas32 = (id: string, name: string, man: string, logo: string): DeviceTemplate => mk({
  id, name, man, cat: SB, u: 3, depth: 220, color: '#1c1c1e', logo, weight: 8,
  front: [
    G([B.xin(32, 'In ', { rows: 4, ys: [18, 50.5, 83, 115.5] })]),
    G([B.xout(16, 'Out ', { rows: 2, ys: [18, 50.5] })], 'right'),
    G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { ys: [83] }), B.one('Ultranet', 'RJ45', 'out', { ys: [83], gap: 5 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { ys: [83], gap: 5 }), B.list(['ADAT Out 1', 'ADAT Out 2'], 'TOSLINK', 'out', { ys: [83], gap: 5 })], 'right'),
  ],
  rear: [G([PSU_IEC])], src: SRC.EST, notes: '32 Eingänge, 16 Ausgänge, AES50 A/B (Klark Teknik SuperMAC), Ultranet, ADAT.',
});
const behringerMidas16 = (id: string, name: string, man: string, logo: string, u: 2 | 3): DeviceTemplate => mk({
  id, name, man, cat: SB, u, depth: 220, color: '#1c1c1e', logo, weight: 6,
  front: [
    G([B.xin(16, 'In ', { rows: 2, ys: u === 2 ? [22, 66] : [36, 72] }), B.xout(8, 'Out ', { rows: 2, ys: u === 2 ? [22, 66] : [36, 72], gap: 9 })]),
    G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { rows: 2, ys: u === 2 ? [22, 66] : [36, 72] }), B.one('Ultranet', 'RJ45', 'out', { ys: [u === 2 ? 22 : 36], gap: 5 }), B.one('MIDI In', 'DIN5', 'in', { ys: [u === 2 ? 66 : 72], stack: true }), B.list(['ADAT Out 1', 'ADAT Out 2'], 'TOSLINK', 'out', { rows: 2, ys: u === 2 ? [22, 66] : [36, 72], gap: 5 })], 'right'),
  ],
  rear: [G([PSU_IEC])], src: u === 2 ? SRC.DS : SRC.EST, notes: '16 Eingänge, 8 Ausgänge, AES50 A/B, Ultranet, ADAT.',
});

const stageboxes: DeviceTemplate[] = [
  yamahaRio('yam-rio3224-d3', 'Rio3224-D3', true),
  yamahaRio('yam-rio3224-d2', 'Rio3224-D2', false),
  yamahaRio16('yam-rio1608-d3', 'Rio1608-D3', true),
  yamahaRio16('yam-rio1608-d2', 'Rio1608-D2', false),
  mk({
    id: 'yam-tio1608-d2', name: 'Tio1608-D2', man: 'Yamaha', cat: SB, u: 2, depth: 364, color: '#232528', logo: 'YAMAHA', weight: 6,
    front: [G([B.xin(16, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 10 }), B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { rows: 2, gap: 10 })])],
    rear: [G([PSU_IEC])], src: SRC.DS, notes: '16 Eingänge, 8 Ausgänge, Dante; für TF/DM3/CL/QL.',
  }),
  ahPortable('ah-dx168', 'DX168', ['DX Link A', 'DX Link B']),
  ahPortable('ah-dt168', 'DT168', ['Dante Primary', 'Dante Secondary']),
  mk({
    id: 'ah-ar2412', name: 'AR2412 AudioRack', man: 'Allen & Heath', cat: SB, u: 3, depth: 220, color: '#1d1e20', logo: 'ALLEN&HEATH', model: 'AR2412',
    front: [
      G([B.xin(24, 'In ', { rows: 3, ys: [22, 66, 110] })]),
      G([B.xout(12, 'Out ', { rows: 2, ys: [22, 66] })], 'right'),
      G([B.list(['dSNAKE', 'Expander'], 'ETHERCON', 'io', { ys: [110] })], 'right'),
    ],
    rear: [G([PSU_IEC])], src: SRC.DS, notes: '24 Eingänge, 12 Ausgänge; dSNAKE für Qu/SQ/GLD.',
  }),
  ahFixed48('ah-gx4816', 'GX4816', 'Allen & Heath', 'ALLEN&HEATH', '#1d1e20', ['gigaACE A', 'gigaACE B'], '48 Eingänge, 16 Ausgänge, 96 kHz.'),
  behringerMidas16('midas-dl16', 'DL16', 'Midas', 'MIDAS', 2),
  behringerMidas32('midas-dl32', 'DL32', 'Midas', 'MIDAS'),
  behringerMidas16('beh-s16', 'S16', 'Behringer', 'BEHRINGER', 3),
  behringerMidas32('beh-s32', 'S32', 'Behringer', 'BEHRINGER'),
  mk({
    id: 'midas-dl151', name: 'DL151', man: 'Midas', cat: SB, u: 2, depth: 300, color: '#1c1c1e', logo: 'MIDAS',
    front: [G([B.xin(24, 'In ', { rows: 2 })]), G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { rows: 2 })], 'right')],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')])], src: SRC.DS, notes: '24 Mic/Line-Eingänge, AES50 redundant (Pro Series / M32).',
  }),
  mk({
    id: 'midas-dl152', name: 'DL152', man: 'Midas', cat: SB, u: 2, depth: 300, color: '#1c1c1e', logo: 'MIDAS',
    front: [G([B.xout(24, 'Out ', { rows: 2 })]), G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { rows: 2 })], 'right')],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')])], src: SRC.DS, notes: '24 Line-Ausgänge, AES50 redundant.',
  }),
  ahFixed48('midas-dl251', 'DL251', 'Midas', 'MIDAS', '#1c1c1e', ['AES50 A', 'AES50 B', 'AES50 C'], '48 Eingänge, 16 Ausgänge, 3× AES50 (N+1).'),
  ahFixed48('digico-d2-rack', 'D2-Rack', 'DiGiCo', 'DiGiCo', '#151617', ['Cat5 A', 'Cat5 B'], '48 Eingänge, 16 Ausgänge (erweiterbar auf 32), MADI über BNC oder Cat5.'),
  mk({
    id: 'digico-sd-mini-rack', name: 'SD-MiNi Rack', man: 'DiGiCo', cat: SB, u: 4, depth: 408, color: '#151617', logo: 'DiGiCo',
    front: [
      G([B.xin(16, 'In ', { rows: 2, ys: [40, 76], label: 'INPUT CARDS' })]),
      G([B.xout(16, 'Out ', { rows: 2, ys: [40, 76], label: 'OUTPUT CARDS' })], 'right'),
    ],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([B.list(['MADI A In', 'MADI A Out', 'MADI B In', 'MADI B Out'], 'MADI-BNC', 'io', { rows: 2 }), B.list(['Optic A', 'Optic B'], 'OPTICALCON', 'io', { gap: 10 })], 'right')],
    src: SRC.EST, notes: '4 Kartenslots; hier mit 2 Eingangs- und 2 Ausgangskarten (je 8 Kanäle) dargestellt.',
  }),
  mk({
    id: 'radial-prod8', name: 'ProD8', man: 'Radial', cat: SB, u: 1, depth: 200, color: '#2b2d31', logo: 'RADIAL', model: 'ProD8 8-Kanal-DI',
    front: [G([{ c: 'JACK', n: 8, pre: 'In ', dir: 'in', pitch: 16 }, { c: 'JACK', n: 8, pre: 'Thru ', dir: 'out', pitch: 16, gap: 10 }], 'right')],
    rear: [G([B.xout(8, 'Out ')], 'right')], src: SRC.EST, notes: '8-Kanal passive DI.',
  }),
];

// ================================================================== Audio-Interfaces / Wandler
const converters: DeviceTemplate[] = [
  mk({
    id: 'focusrite-rednet-mp8r', name: 'RedNet MP8R', man: 'Focusrite', cat: CONV, u: 2, depth: 300, color: '#b3182a', logo: 'FOCUSRITE',
    fa: [A.lcd(150, 26, 80, 36, '#dbeafe'), ...Array.from({ length: 8 }, (_, i) => A.leds(250 + i * 6, 26, 9, ['#ef4444', '#f59e0b', '#22c55e'], 0, 4, 0.9))],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in', { rows: 2 })]), G([B.xin(8, 'Mic In '), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 8 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { rows: 2, gap: 8 })], 'right')],
    src: SRC.DS, notes: '8 Mikrofonvorverstärker auf Dante.',
  }),
  mk({
    id: 'focusrite-rednet-a16r', name: 'RedNet A16R MkII', man: 'Focusrite', cat: CONV, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([
      { c: 'DSUB25', names: ['Analog In 1–8', 'Analog In 9–16', 'Analog Out 1–8', 'Analog Out 9–16'], dir: 'io', pitch: 55 },
      B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 }),
    ], 'right')],
    src: SRC.DS, notes: '16 analoge Ein- und Ausgänge auf D-Sub 25 (AES59), Dante.',
  }),
  mk({
    id: 'kt-dn9650', name: 'DN9650 Network Bridge', man: 'Klark Teknik', cat: CONV, u: 1, depth: 250, color: '#1c1c1e', logo: 'KLARK TEKNIK', model: 'DN9650',
    rear: [G([PSU_IEC]), G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io'), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 10 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: SRC.EST, notes: 'AES50 ↔ Dante/MADI/AVB (je nach Modul); hier mit Dante-Modul.',
  }),
  mk({
    id: 'rosendahl-nanosyncs', name: 'nanosyncs HD', man: 'Rosendahl', cat: CONV, u: 1, depth: 220, color: '#26282c', logo: 'ROSENDAHL',
    fa: [A.lcd(120, 10, 60, 23, '#dbeafe')],
    rear: [G([PSU_IEC]), G([B.list(['Ref In', 'WC In'], 'BNC75', 'in'), { c: 'BNC75', n: 6, pre: 'WC Out ', dir: 'out', gap: 10 }, { c: 'BNC75', n: 4, pre: 'Video Out ', dir: 'out', gap: 10 }, B.one('AES Out', 'AES-XLR', 'out', { gap: 10 })], 'right')],
    src: SRC.EST, notes: 'Wordclock- und Video-Sync-Generator.',
  }),
];

// ================================================================== Endstufen
/** rear of a touring amp: mains left, inputs + link (stacked) and network in the middle, outputs right */
export function ampRear(o: { mains: string; ins: number; link?: boolean; aes?: string[]; net?: string[]; outs: string[]; mix?: string[]; nl8?: string[]; outC?: string; inC?: string; ys?: [number, number] }) {
  const ys = o.ys ?? [24, 64];
  const inC = o.inC ?? 'XLR3F';
  return [
    G([B.one('Mains', o.mains, 'in')]),
    G([
      { c: inC, n: o.ins, pre: 'In ', dir: 'in', ys: [ys[0]], label: 'INPUT' } satisfies Blk,
      ...(o.link ? [{ c: 'XLR3M', n: o.ins, pre: 'Link ', dir: 'out', ys: [ys[1]], stack: true } satisfies Blk] : []),
      ...(o.aes ? [B.list(o.aes, 'XLR3F', 'in', { rows: 2, ys, gap: 8 })] : []),
      ...(o.net ? [B.list(o.net, 'ETHERCON', 'io', { rows: 2, ys, gap: 10 })] : []),
    ], 'center', { x0: 70, x1: 300 }),
    G([
      { c: o.outC ?? 'SPEAKON', names: o.outs, dir: 'out', rows: o.outs.length > 2 ? 2 : 1, pitch: 29, ys: o.outs.length > 2 ? [...ys] : undefined } satisfies Blk,
      ...(o.mix?.length ? [B.list(o.mix, 'SPEAKON', 'out', { rows: 2, ys, gap: 7 })] : []),
      ...(o.nl8?.length ? [B.list(o.nl8, 'SPEAKON8', 'out', { rows: o.nl8.length, gap: 7 })] : []),
    ], 'right'),
  ];
}
export function ampRear1U(o: { mains: string; ins: number; link?: boolean; net?: string[]; outs: string[]; nl8?: string[] }) {
  return [
    G([
      B.one('Mains', o.mains, 'in'), B.xin(o.ins, 'In ', { gap: 8 }), ...(o.link ? [B.xout(o.ins, 'Link ', { gap: 3 })] : []),
      ...(o.net ? [B.list(o.net, 'ETHERCON', 'io', { gap: 6, pitch: 26 })] : []),
      B.list(o.outs, 'SPEAKON', 'out', { gap: 6, pitch: 27 }), ...(o.nl8 ? [B.list(o.nl8, 'SPEAKON8', 'out', { gap: 3 })] : []),
    ]),
  ];
}
/** installation amp: Phoenix inputs/outputs, network RJ45 */
export function installRear(ch: number, mains = 'IEC_C14', net = ['Network 1', 'Network 2'], H1U = true) {
  return [
    G([B.one('Mains', mains, 'in')]),
    G([{ c: 'PHOENIX3', n: ch, pre: 'In ', dir: 'in' as const }, B.list(net, 'RJ45', 'io', { gap: 8, rows: H1U ? 1 : 2 }), B.one('GPIO', 'PHOENIX3', 'io', { gap: 8 })], 'center', { x0: 70, x1: 330 }),
    G([{ c: 'PHOENIX-SPK', n: ch, pre: 'Out ', dir: 'out' as const, pitch: 23 }], 'right'),
  ];
}
const DB = '#2c2f33';
const amps: DeviceTemplate[] = [
  // d&b audiotechnik
  mk({
    id: 'db-d80', name: 'D80', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 530, color: DB, logo: 'd&b audiotechnik', weight: 19,
    fa: ampFront(4, { grille: [120, 300] }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, net: ['Ethernet 1', 'Ethernet 2'], outs: ['Out A', 'Out B', 'Out C', 'Out D'], nl8: ['Out A–D (NL8)'] }),
    rearVents: true, src: SRC.DS, notes: '4 Kanäle; 4× NL4 + 1× NL8 (alle Kanäle). Eingänge analog/AES3 mit Link.',
  }),
  ...variants({
    id: '', name: '', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 470, color: DB, logo: 'd&b audiotechnik',
    fa: ampFront(4, { grille: [120, 300] }),
    rear: ampRear({ mains: 'POWERCON_IN', ins: 4, link: true, net: ['Ethernet 1', 'Ethernet 2'], outs: ['Out A', 'Out B', 'Out C', 'Out D'], mix: ['Mix TOP/SUB AB', 'Mix TOP/SUB CD'], nl8: ['Out A–D (NL8)'] }),
    rearVents: true, src: SRC.DS,
  }, [
    ['db-d40', 'D40', { notes: '4 Kanäle; 4× NL4, 2× NL4 für Mix TOP/SUB bzw. 2-Wege, 1× NL8.' }],
    ['db-d20', 'D20', { notes: '4 Kanäle; 4× NL4, 2× NL4 (Mix TOP/SUB, 2-Wege) zentral, 1× NL8.' }],
  ]),
  ...variants({
    id: '', name: '', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 440, color: DB, logo: 'd&b audiotechnik',
    fa: ampFront(4, { grille: [120, 300] }), rear: installRear(4, 'IEC_C14', ['Ethernet 1', 'Ethernet 2'], false), rearVents: true, src: SRC.EST,
  }, [
    ['db-30d', '30D', { notes: 'Installationsverstärker, Phoenix-Anschlüsse.' }],
    ['db-10d', '10D', { notes: 'Installationsverstärker, Phoenix-Anschlüsse.' }],
  ]),
  // L-Acoustics
  mk({
    id: 'la-la12x', name: 'LA12X', man: 'L-Acoustics', cat: AMP, u: 2, depth: 480, color: '#16171a', logo: 'L-ACOUSTICS', weight: 15,
    fa: ampFront(4, { grille: [130, 300], accent: '#c8102e' }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, aes: ['AES In 1/2', 'AES In 3/4'], net: ['Network 1', 'Network 2'], outs: ['Out 1/2', 'Out 3/4'], outC: 'SPEAKON', nl8: [] }).map((g, i) => (i === 2 ? G([B.list(['Out 1/2', 'Out 3/4'], 'SPEAKON', 'out', { rows: 2 }), B.one('Out 1–4 (CA-COM)', 'CACOM', 'out', { gap: 8 })], 'right') : g)),
    rearVents: true, src: SRC.DS, notes: '4 Kanäle; 2× speakON 4-pol + 1× CA-COM 8-pol, powerCON 32 A, Milan/AVB.',
  }),
  mk({
    id: 'la-la4x', name: 'LA4X', man: 'L-Acoustics', cat: AMP, u: 1, depth: 400, color: '#16171a', logo: 'L-ACOUSTICS', weight: 10,
    fa: ampFront(4, { grille: [130, 300], accent: '#c8102e' }),
    rear: ampRear1U({ mains: 'POWERCON_IN', ins: 4, link: true, net: ['Network 1', 'Network 2'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }),
    src: SRC.EST, notes: '4 Kanäle, 4 analoge Eingänge mit Link.',
  }),
  mk({
    id: 'la-la2xi', name: 'LA2Xi', man: 'L-Acoustics', cat: AMP, u: 1, depth: 380, color: '#16171a', logo: 'L-ACOUSTICS',
    fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4), src: SRC.EST, notes: 'Installationsverstärker, Phoenix-Anschlüsse.',
  }),
  // Powersoft
  mk({
    id: 'ps-x8', name: 'X8', man: 'Powersoft', cat: AMP, u: 2, depth: 450, color: '#1b1c1f', logo: 'POWERSOFT', weight: 16,
    fa: ampFront(8, { grille: [130, 290], accent: '#f97316' }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 8, link: false, net: ['Network 1', 'Network 2'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4', 'Out 5', 'Out 6', 'Out 7', 'Out 8'], nl8: ['Out 1–4 (NL8)', 'Out 5–8 (NL8)'] }),
    rearVents: true, src: SRC.EST, notes: '8 Kanäle; Ein-/Ausgangsmodul wahlweise XLR/speakON oder Phoenix.',
  }),
  ...variants({
    id: '', name: '', man: 'Powersoft', cat: AMP, u: 1, depth: 450, color: '#1b1c1f', logo: 'POWERSOFT',
    fa: ampFront(4, { grille: [130, 300], accent: '#f97316' }),
    rear: ampRear1U({ mains: 'POWERCON_IN', ins: 4, net: ['Network 1', 'Network 2'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'], nl8: ['Out 1–4 (NL8)'] }),
    src: SRC.DS,
  }, [
    ['ps-x4l', 'X4L', { notes: '4 Kanäle; 4× NL4 + 1× NL8.' }],
    ['ps-x4', 'X4', { notes: '4 Kanäle; Ausgänge wie X4L angenommen.', src: SRC.EST }],
  ]),
  ...variants({
    id: '', name: '', man: 'Powersoft', cat: AMP, u: 1, depth: 400, color: '#1b1c1f', logo: 'POWERSOFT',
    fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4, 'IEC_C20', ['Dante Primary', 'Dante Secondary']), src: SRC.DS,
  }, [
    ['ps-qc1204', 'Quattrocanali 1204 DSP+D'], ['ps-qc2404', 'Quattrocanali 2404 DSP+D'],
    ['ps-qc4804', 'Quattrocanali 4804 DSP+D'], ['ps-qc8804', 'Quattrocanali 8804 DSP+D'],
  ].map(([id, name]) => [id, name, { notes: 'Installationsverstärker, 4 Kanäle, Phoenix, Dante.' }] as [string, string, Partial<Spec>])),
  mk({
    id: 'ps-dc1604', name: 'Duecanali 1604 DSP+D', man: 'Powersoft', cat: AMP, u: 1, depth: 380, color: '#1b1c1f', logo: 'POWERSOFT',
    fa: ampFront(2, { grille: [130, 300] }), rear: installRear(2, 'IEC_C14', ['Dante Primary', 'Dante Secondary']), src: SRC.DS,
  }),
  // Lab.gruppen
  ...variants({
    id: '', name: '', man: 'Lab.gruppen', cat: AMP, u: 2, depth: 424, color: '#26282b', logo: 'LAB.GRUPPEN',
    fa: ampFront(4, { grille: [130, 300], accent: '#e4572e' }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, aes: ['AES In 1/2', 'AES In 3/4'], net: ['Dante Primary', 'Dante Secondary'], outs: ['Out A/B', 'Out C/D'], nl8: ['Out A–D (NLT8)'] }),
    rearVents: true, src: SRC.DS, notes: '4 analoge + 4 AES-Eingänge, Dante, 2× NLT4 + 1× NLT8.',
  }, [['lg-plm20k44', 'PLM 20K44'], ['lg-plm12k44', 'PLM 12K44']]),
  ...variants({
    id: '', name: '', man: 'Lab.gruppen', cat: AMP, u: 2, depth: 424, color: '#26282b', logo: 'LAB.GRUPPEN',
    fa: ampFront(4, { grille: [130, 300], accent: '#e4572e' }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, net: ['Dante Primary', 'Dante Secondary'], outs: ['Out A/B', 'Out C/D'], nl8: ['Out A–D (NLT8)'] }),
    rearVents: true, src: SRC.EST,
  }, [['lg-d204l', 'D 20:4L'], ['lg-d804l', 'D 80:4L']]),
  mk({
    id: 'lg-fp10000q', name: 'FP 10000Q', man: 'Lab.gruppen', cat: AMP, u: 2, depth: 430, color: '#26282b', logo: 'LAB.GRUPPEN',
    fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'POWERCON32_IN', ins: 4, link: true, outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), rearVents: true, src: SRC.EST,
  }),
  mk({
    id: 'lg-ipd2400', name: 'IPD 2400', man: 'Lab.gruppen', cat: AMP, u: 1, depth: 300, color: '#26282b', logo: 'LAB.GRUPPEN',
    fa: ampFront(2, { grille: [130, 300] }), rear: installRear(2, 'IEC_C14', ['Network']), src: SRC.EST,
  }),
  // Crown, QSC, Yamaha, Camco
  ...variants({
    id: '', name: '', man: 'Crown', cat: AMP, u: 2, depth: 300, color: '#1b1b1b', logo: 'CROWN',
    fa: ampFront(2, { grille: [130, 320], lcd: false }),
    rear: [G([PSU_IEC]), G([B.combo(2, 'In ', { names: ['In A', 'In B'] })], 'center'), G([B.list(['Out A', 'Out B'], 'SPEAKON', 'out', { pitch: 30 })], 'right')],
    src: SRC.DS, notes: '2 Kanäle; XLR/Klinke-Eingänge, speakON + Polklemmen.',
  }, [['crown-xls1502', 'XLS 1502'], ['crown-xls2002', 'XLS 2002'], ['crown-xls2502', 'XLS 2502']]),
  mk({
    id: 'crown-it4x3500hd', name: 'I-Tech 4x3500HD', man: 'Crown', cat: AMP, u: 2, depth: 440, color: '#1b1b1b', logo: 'CROWN',
    fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'IEC_C20', ins: 4, link: true, net: ['Network'], outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), rearVents: true, src: SRC.EST,
  }),
  mk({
    id: 'crown-dci4600n', name: 'DCi 4|600N', man: 'Crown', cat: AMP, u: 2, depth: 380, color: '#1b1b1b', logo: 'CROWN',
    fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4, 'IEC_C14', ['BLU link In', 'BLU link Out'], false), src: SRC.EST,
  }),
  ...variants({
    id: '', name: '', man: 'QSC', cat: AMP, u: 2, depth: 330, color: '#1a1a1a', logo: 'QSC',
    fa: ampFront(2, { grille: [130, 320] }),
    rear: [G([PSU_IEC]), G([B.combo(2, 'In ', { names: ['In A', 'In B'] }), B.list(['Thru A', 'Thru B'], 'XLR3M', 'out', { gap: 6 })], 'center'), G([B.list(['Out A', 'Out B'], 'SPEAKON', 'out', { pitch: 30 })], 'right')],
    src: SRC.DS,
  }, [['qsc-gxd4', 'GXD 4'], ['qsc-gxd8', 'GXD 8']]),
  mk({
    id: 'qsc-pld45', name: 'PLD4.5', man: 'QSC', cat: AMP, u: 2, depth: 400, color: '#1a1a1a', logo: 'QSC',
    fa: ampFront(4, { grille: [130, 300] }),
    rear: ampRear({ mains: 'IEC_C14', ins: 4, link: true, outs: ['Out 1', 'Out 2', 'Out 3', 'Out 4'] }), src: SRC.EST,
  }),
  mk({
    id: 'qsc-cxd43', name: 'CXD4.3', man: 'QSC', cat: AMP, u: 2, depth: 400, color: '#1a1a1a', logo: 'QSC',
    fa: ampFront(4, { grille: [130, 300] }), rear: installRear(4, 'IEC_C14', ['Q-LAN A', 'Q-LAN B'], false), src: SRC.EST,
  }),
  ...variants({
    id: '', name: '', man: 'Yamaha', cat: AMP, u: 2, depth: 380, color: '#1d1e20', logo: 'YAMAHA',
    fa: ampFront(2, { grille: [130, 320] }),
    rear: [G([PSU_IEC]), G([B.combo(2, 'In ', { names: ['In A', 'In B'] }), B.list(['Thru A', 'Thru B'], 'XLR3M', 'out', { gap: 6 })], 'center'), G([B.list(['Out A', 'Out B'], 'SPEAKON', 'out', { pitch: 30 })], 'right')],
    src: SRC.DS,
  }, [['yam-px5', 'PX5'], ['yam-px8', 'PX8'], ['yam-px10', 'PX10']]),
  mk({
    id: 'camco-vortex6', name: 'Vortex 6', man: 'Camco', cat: AMP, u: 2, depth: 450, color: '#222222', logo: 'CAMCO',
    fa: ampFront(2, { grille: [130, 300] }),
    rear: ampRear({ mains: 'POWERCON_IN', ins: 2, link: true, outs: ['Out A', 'Out B'] }), src: SRC.EST,
  }),
];

// ================================================================== Signalprozessoren
const dsp: DeviceTemplate[] = [
  mk({
    id: 'lake-lm44', name: 'LM 44', man: 'Lake', cat: DSP, u: 1, depth: 300, color: '#1f2124', logo: 'LAKE',
    fa: [A.lcd(150, 10, 60, 23, '#dbeafe')],
    rear: [G([PSU_IEC]), G([B.xin(4, 'In '), B.xout(4, 'Out ', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: SRC.EST, notes: 'Lautsprecher-Prozessor, analog/AES und Dante.',
  }),
  mk({
    id: 'xta-dp448', name: 'DP448', man: 'XTA', cat: DSP, u: 1, depth: 250, color: '#2a2c30', logo: 'XTA',
    fa: [A.lcd(80, 10, 50, 23, '#bbf7d0')],
    rear: [G([PSU_IEC, B.one('RS-232', 'DSUB9', 'io', { gap: 8 })]), G([B.xin(4, 'In '), B.xout(8, 'Out ', { gap: 8 })], 'right')], src: SRC.DS, notes: '4 Eingänge, 8 Ausgänge.',
  }),
  mk({
    id: 'dbx-pa2', name: 'DriveRack PA2', man: 'dbx', cat: DSP, u: 1, depth: 200, color: '#1f2022', logo: 'dbx',
    front: [G([B.one('RTA Mic', 'XLR3F', 'in')], 'left', { x0: 80 })], fa: [A.lcd(120, 10, 70, 23, '#dbeafe'), A.knob(210, 21.8, 6)],
    rear: [G([PSU_IEC, B.one('Ethernet', 'RJ45', 'io', { gap: 8 })]), G([B.xin(2, 'In '), B.xout(6, 'Out ', { gap: 8 })], 'right')], src: SRC.DS,
  }),
  mk({
    id: 'bss-blu100', name: 'BLU-100', man: 'BSS', cat: DSP, u: 1, depth: 300, color: '#1f2022', logo: 'BSS',
    rear: [G([PSU_IEC]), G([{ c: 'PHOENIX3', n: 12, pre: 'In ', dir: 'in' }, { c: 'PHOENIX3', n: 8, pre: 'Out ', dir: 'out', gap: 8 }, B.list(['BLU link In', 'BLU link Out', 'Network'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'qsys-core110f', name: 'Core 110f', man: 'Q-SYS', cat: DSP, u: 1, depth: 360, color: '#232528', logo: 'Q-SYS',
    rear: [G([PSU_IEC]), G([
      { c: 'PHOENIX3', n: 8, pre: 'In ', dir: 'in', ys: [13] }, { c: 'PHOENIX3', n: 8, pre: 'Out ', dir: 'out', ys: [31], stack: true },
      { c: 'PHOENIX3', n: 8, pre: 'Flex ', dir: 'io', ys: [13], gap: 8 }, { c: 'PHOENIX3', n: 4, pre: 'GPIO ', dir: 'io', ys: [31], stack: true },
      B.list(['LAN A', 'LAN B'], 'RJ45', 'io', { gap: 8 }), B.list(['USB A', 'USB B'], 'USB', 'io', { rows: 2, gap: 6 }),
    ], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'biamp-forte-ai', name: 'TesiraFORTÉ AI', man: 'Biamp', cat: DSP, u: 1, depth: 300, color: '#232528', logo: 'BIAMP',
    rear: [G([PSU_IEC]), G([{ c: 'PHOENIX3', n: 12, pre: 'In ', dir: 'in' }, { c: 'PHOENIX3', n: 8, pre: 'Out ', dir: 'out', gap: 6 }, B.list(['AVB', 'Control'], 'RJ45', 'io', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 5 })], 'right')],
    src: SRC.EST,
  }),
];

// ================================================================== Mischpulte (Rack)
const mixers: DeviceTemplate[] = [
  mk({
    id: 'beh-x32-rack', name: 'X32 Rack', man: 'Behringer', cat: MIX, u: 3, depth: 230, color: '#1c1c1e', logo: 'BEHRINGER', weight: 7,
    front: [
      G([B.xin(16, 'In ', { rows: 2, ys: [24, 58] }), B.xout(8, 'Out ', { ys: [92], stack: true })]),
      G([{ c: 'JACK', n: 6, pre: 'Aux In ', dir: 'in', ys: [16] }, { c: 'JACK', n: 6, pre: 'Aux Out ', dir: 'out', ys: [36], stack: true }, B.one('Phones', 'JACK', 'out', { ys: [16], gap: 6 }), B.one('USB', 'USB', 'io', { ys: [36], stack: true })], 'right'),
      G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { ys: [112] }), B.one('Ultranet', 'RJ45', 'out', { ys: [112], gap: 5 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { ys: [112], gap: 5 }), B.one('AES Out', 'AES-XLR', 'out', { ys: [112], gap: 5 })], 'right'),
    ],
    fa: [A.lcd(300, 52, 90, 34, '#dbeafe'), A.knob(410, 69, 7)],
    rear: [G([PSU_IEC])], src: SRC.EST, notes: '16 Mic-Eingänge, 8 Ausgänge, AES50 A/B, Ultranet.',
  }),
  mk({
    id: 'midas-m32c', name: 'M32C', man: 'Midas', cat: MIX, u: 1, depth: 260, color: '#1c1c1e', logo: 'MIDAS',
    fa: [A.leds(200, 16, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 6, 0), A.btn(240, 13, 10, 6, 'SYNC'), A.sw(420, 15)],
    rear: [G([PSU_IEC]), G([B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io'), B.one('Ultranet', 'RJ45', 'out', { gap: 6 }), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { gap: 6 }), B.list(['Card USB', 'Remote'], 'USB', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Mischpult-Kern ohne Preamps, Bedienung über App / Stageboxen über AES50.',
  }),
  mk({
    id: 'yam-tf-rack', name: 'TF-Rack', man: 'Yamaha', cat: MIX, u: 3, depth: 400, color: '#232528', logo: 'YAMAHA', weight: 9,
    front: [G([B.combo(16, 'In ', { rows: 2, ys: [26, 62] }), B.xout(8, 'Out ', { ys: [100], stack: true })]), G([{ c: 'JACK', n: 2, pre: 'ST In ', dir: 'in', ys: [100] }, B.one('Phones', 'JACK', 'out', { ys: [100], gap: 6 }), B.one('USB', 'USB', 'io', { ys: [100], gap: 6 })], 'right')],
    fa: [A.lcd(300, 18, 110, 50, '#dbeafe')],
    rear: [G([PSU_IEC]), G([B.list(['Network', 'Card Primary', 'Card Secondary'], 'RJ45', 'io')], 'right')], src: SRC.EST,
  }),
];

// ================================================================== Intercom
const intercom: DeviceTemplate[] = [
  mk({
    id: 'cc-hms4x', name: 'HelixNet HMS-4X', man: 'Clear-Com', cat: IC, u: 1, depth: 280, color: '#202124', logo: 'CLEAR-COM',
    fa: [A.lcd(150, 10, 80, 23, '#dbeafe'), A.knob(250, 21.8, 6), A.knob(270, 21.8, 6)],
    rear: [G([PSU_IEC]), G([B.xin(4, 'Partyline ', { dir: 'io' }), B.list(['Program In'], 'XLR3F', 'in', { gap: 6 }), B.list(['4-Wire 1', '4-Wire 2', 'LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'cc-arcadia', name: 'Arcadia Central Station', man: 'Clear-Com', cat: IC, u: 1, depth: 300, color: '#202124', logo: 'CLEAR-COM', model: 'Arcadia',
    fa: [A.lcd(150, 10, 90, 23, '#dbeafe')],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([B.xin(4, '2-Wire ', { dir: 'io' }), B.rj(4, '4-Wire ', { gap: 6 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'cc-ms702', name: 'MS-702', man: 'Clear-Com', cat: IC, u: 1, depth: 250, color: '#202124', logo: 'CLEAR-COM',
    rear: [G([PSU_IEC]), G([B.list(['Channel A', 'Channel B'], 'XLR3F', 'io'), B.list(['Channel A Thru', 'Channel B Thru'], 'XLR3M', 'io', { gap: 4 }), B.one('Program In', 'XLR3F', 'in', { gap: 8 })], 'right')],
    src: SRC.EST, notes: '2-Kanal-Partyline-Hauptstation.',
  }),
];

// ================================================================== Video
const video: DeviceTemplate[] = [
  mk({
    id: 'bmd-videohub-12g-2020', name: 'Smart Videohub 12G 20×20', man: 'Blackmagic Design', cat: VID, u: 1, depth: 200, color: '#2a2c30', logo: 'BLACKMAGIC',
    fa: [A.lcd(150, 9, 60, 26, '#dbeafe', false)],
    rear: [G([PSU_IEC, B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 4 }), B.one('Ref In', 'BNC75', 'in', { gap: 6 })]), G([B.bnc(20, 'SDI In ', 'in', { ys: [11] }), B.bnc(20, 'SDI Out ', 'out', { ys: [32.6], stack: true })], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'bmd-videohub-12g-4040', name: 'Smart Videohub 12G 40×40', man: 'Blackmagic Design', cat: VID, u: 2, depth: 200, color: '#2a2c30', logo: 'BLACKMAGIC',
    fa: [A.lcd(150, 22, 90, 44, '#dbeafe', false)],
    rear: [G([PSU_IEC, B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 4 }), B.one('Ref In', 'BNC75', 'in', { gap: 6 })]), G([B.bnc(40, 'SDI In ', 'in', { rows: 2, ys: [12, 32] }), B.bnc(40, 'SDI Out ', 'out', { rows: 2, ys: [56, 76], stack: true })], 'right')],
    src: SRC.EST,
  }),
  mk({
    id: 'bmd-hyperdeck-hd-plus', name: 'HyperDeck Studio HD Plus', man: 'Blackmagic Design', cat: VID, u: 1, slots: 3, bodyW: 150, depth: 160, color: '#2a2c30', logo: 'BLACKMAGIC',
    fa: [A.lcd(30, 9, 40, 26, '#dbeafe', false)],
    rear: [G([B.bnc(2, 'SDI ', 'io', { names: ['SDI In', 'SDI Out'] }), B.one('Ref In', 'BNC75', 'in', { gap: 3 }), B.one('HDMI Out', 'HDMI', 'out', { gap: 3 }), B.one('Ethernet', 'RJ45', 'io', { gap: 3 }), B.one('Power', 'DC', 'in', { gap: 3 })], 'center')],
    src: SRC.EST, notes: '1/3 Rackbreite.',
  }),
  mk({
    id: 'bmd-atem-1me-constellation-hd', name: 'ATEM 1 M/E Constellation HD', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC',
    fa: [A.lcd(150, 9, 60, 26, '#dbeafe', false)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in'), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.bnc(10, 'SDI In ', 'in', { ys: [11] }), B.bnc(6, 'SDI Out ', 'out', { ys: [32.6], stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 6 })], 'right')],
    src: SRC.EST,
  }),
];

// ================================================================== Zuspieler / Recording / Computer
const recording: DeviceTemplate[] = [
  mk({
    id: 'tascam-sscdr250n', name: 'SS-CDR250N', man: 'Tascam', cat: REC, u: 1, depth: 300, color: '#202124', logo: 'TASCAM',
    front: [G([B.one('USB', 'USB', 'io')], 'left', { x0: 300 })], fa: [A.rect(80, 14, 120, 6, '#0b0b0c'), A.lcd(210, 10, 70, 23, '#dbeafe')],
    rear: [G([PSU_IEC, B.one('RS-232C', 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.xin(2, 'In ', { names: ['In L', 'In R'] }), B.xout(2, 'Out ', { names: ['Out L', 'Out R'], gap: 6 })], 'right')],
    src: SRC.EST, notes: 'CD/SD/USB-Recorder und Zuspieler.',
  }),
  mk({
    id: 'tascam-da6400', name: 'DA-6400', man: 'Tascam', cat: REC, u: 1, depth: 300, color: '#202124', logo: 'TASCAM',
    fa: [A.rect(80, 12, 110, 20, '#111214'), A.lcd(210, 10, 70, 23, '#dbeafe')],
    rear: [G([PSU_IEC, B.one('RS-232C', 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })]), G([B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io'), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: SRC.EST, notes: '64-Spur-Recorder (hier mit Dante-Karte).',
  }),
  mk({
    id: 'gen-rack-pc2', name: 'Rack-PC 2 HE', man: 'Generisch', cat: REC, u: 2, depth: 450, color: '#26282c',
    front: [G([B.list(['USB Front 1', 'USB Front 2'], 'USB', 'io', { rows: 2 })], 'right')],
    rear: [G([PSU_IEC]), G([B.list(['USB 1', 'USB 2', 'USB 3', 'USB 4'], 'USB', 'io', { rows: 2 }), B.list(['Display 1', 'Display 2'], 'HDMI', 'out', { rows: 2, gap: 8 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['Audio Out', 'Audio In'], 'MINIJACK', 'io', { rows: 2, gap: 8 })], 'right')],
    rearVents: true, src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-macmini-1u', name: 'Mac mini im 1-HE-Einschub', man: 'Generisch', cat: REC, u: 1, depth: 250, color: '#3a3d42', model: 'Mac mini 1 HE',
    rear: [G([B.one('Power', 'IEC_C14', 'in'), B.list(['USB-C 1', 'USB-C 2', 'USB 1', 'USB 2'], 'USB', 'io', { gap: 8 }), B.one('HDMI', 'HDMI', 'out', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.one('Audio Out', 'MINIJACK', 'out', { gap: 6 })], 'center')],
    src: 'Generische Vorlage',
  }),
];

// ================================================================== Strom
const power: DeviceTemplate[] = [
  mk({
    id: 'apc-smt1500rmi2u', name: 'Smart-UPS 1500 RM 2U', man: 'APC', cat: PWR, u: 2, depth: 480, color: '#1c1d20', logo: 'APC', weight: 27,
    fa: [A.lcd(300, 30, 50, 26, '#dbeafe', false), A.btn(360, 36, 10, 10, '⏻')],
    rear: [G([B.one('Netz In', 'IEC_C14', 'in'), { c: 'IEC_C13', n: 4, pre: 'Out ', dir: 'out', gap: 10, rows: 2 }, B.one('USB', 'USB', 'io', { gap: 10 }), B.one('Network', 'RJ45', 'io', { gap: 6 })])],
    src: SRC.EST, notes: 'USV 1500 VA.',
  }),
  mk({
    id: 'apc-smt3000rmi2u', name: 'Smart-UPS 3000 RM 2U', man: 'APC', cat: PWR, u: 2, depth: 660, color: '#1c1d20', logo: 'APC', weight: 39,
    fa: [A.lcd(300, 30, 50, 26, '#dbeafe', false), A.btn(360, 36, 10, 10, '⏻')],
    rear: [G([B.one('Netz In', 'IEC_C20', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', gap: 10, rows: 2 }, B.one('Out 9 (C19)', 'IEC_C19', 'out', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 10 }), B.one('Network', 'RJ45', 'io', { gap: 6 })])],
    src: SRC.EST, notes: 'USV 3000 VA.',
  }),
  mk({
    id: 'gen-pdu-cee16-schuko8', name: 'Stromverteiler CEE 16 A → 8× Schuko', man: 'Generisch', cat: PWR, u: 1, depth: 120, color: '#1f2126', model: 'CEE16 → 8× Schuko',
    front: [G([{ c: 'SCHUKO', n: 8, pre: 'Out ', dir: 'out', pitch: 41 }], 'right')], fa: [A.sw(60, 15)],
    rear: [G([B.one('Netz In', 'CEE16', 'in')], 'right')], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-pdu-true1-8', name: 'Stromverteiler 8× powerCON TRUE1', man: 'Generisch', cat: PWR, u: 1, depth: 120, color: '#1f2126', model: 'TRUE1 8-fach',
    front: [G([B.one('Netz In', 'TRUE1_IN', 'in'), B.one('Thru', 'TRUE1_OUT', 'out', { gap: 4 }), { c: 'TRUE1_OUT', n: 8, pre: 'Out ', dir: 'out', gap: 16, pitch: 30 }], 'right')],
    src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-pdu-powercon8', name: 'Stromverteiler 8× powerCON (Rückseite)', man: 'Generisch', cat: PWR, u: 1, depth: 120, color: '#1f2126', model: 'powerCON 8-fach',
    front: [G([B.one('Netz In', 'POWERCON_IN', 'in')], 'right')], fa: [A.sw(60, 15)],
    rear: [G([{ c: 'POWERCON_OUT', n: 8, pre: 'Out ', dir: 'out', pitch: 30 }])], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-distro-cee32', name: 'Drehstromverteiler CEE 32 A', man: 'Generisch', cat: PWR, u: 3, depth: 250, color: '#1f2126', model: 'CEE32 → CEE16 · Schuko · TRUE1',
    front: [
      G([B.one('Netz In', 'CEE32_3P', 'in', { ys: [40] }), B.one('Thru', 'CEE16_3P', 'out', { ys: [40], gap: 10 }), { c: 'TRUE1_OUT', n: 6, pre: 'TRUE1 ', dir: 'out', ys: [40], gap: 12, pitch: 30 }]),
      G([{ c: 'SCHUKO', n: 9, pre: 'Schuko ', dir: 'out', ys: [96], pitch: 46 }], 'center'),
    ],
    fa: (H) => [A.leds(440, 30, 3, ['#22c55e', '#22c55e', '#22c55e'], 0, 6, 1.4), A.text(436, H - 8, 'L1 L2 L3', 2)],
    src: 'Generische Vorlage', notes: 'Je Phase 3× Schuko und 2× TRUE1, mit FI/LS (nicht dargestellt).',
  }),
];

// ================================================================== Patchfelder
const patch: DeviceTemplate[] = [
  mk({
    id: 'gen-patch-rj45-24', name: 'Patchfeld 24× RJ45 (Cat6A)', man: 'Generisch', cat: PATCH, u: 1, depth: 60, color: '#18191c', logo: false,
    front: [G([B.rj(24, '', { pitch: 17 })], 'center')], rear: [G([B.rj(24, 'R', { pitch: 17 })], 'center')], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-patch-ethercon16', name: 'Patchfeld 16× etherCON', man: 'Generisch', cat: PATCH, u: 1, depth: 60, color: '#18191c', logo: false,
    front: [G([B.ec(16, '', { pitch: 26.5 })], 'center')], rear: [G([B.rj(16, 'R', { pitch: 26.5 })], 'center')], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-patch-xlr32', name: 'Patchfeld 32× XLR (2 HE)', man: 'Generisch', cat: PATCH, u: 2, depth: 60, color: '#18191c', logo: false,
    front: [G([B.xin(32, '', { rows: 2, dir: 'io' })], 'center')], rear: [G([B.xout(32, 'R', { rows: 2, dir: 'io' })], 'center')], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-patch-speakon8', name: 'Patchfeld 8× speakON', man: 'Generisch', cat: PATCH, u: 1, depth: 60, color: '#18191c', logo: false,
    front: [G([B.nl4(8, '', { dir: 'io', pitch: 40 })], 'center')], rear: [G([B.nl4(8, 'R', { dir: 'io', pitch: 40 })], 'center')], src: 'Generische Vorlage',
  }),
  mk({
    id: 'gen-patch-opticalcon4', name: 'Patchfeld 4× opticalCON DUO', man: 'Generisch', cat: PATCH, u: 1, depth: 80, color: '#18191c', logo: false,
    front: [G([{ c: 'OPTICALCON', n: 4, pre: '', dir: 'io', pitch: 60 }], 'center')], rear: [G([{ c: 'OPTICALCON', n: 4, pre: 'R', dir: 'io', pitch: 60 }], 'center')], src: 'Generische Vorlage',
  }),
];

export const PRO_DEVICES: DeviceTemplate[] = [
  ...luminex, ...cisco, ...netOther, ...ma, ...dmxOther, ...stageboxes, ...converters, ...amps, ...dsp, ...mixers, ...intercom, ...video, ...recording, ...power, ...patch,
];
