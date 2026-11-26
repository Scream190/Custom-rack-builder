import type { ArtElement, DeviceTemplate, ModuleBay } from '../model/types';
import { A, B, G, mk, type Blk, type Spec } from './proLayout';

/*
 * Third completion pass: stage racks and engines with plug-in cards (Yamaha RIVAGE PM, DirectOut PRODIGY), Midas DL150
 * series and Neutron, SSL Network I/O, Avid Stage 32, DiGiCo Orange Box, Allen & Heath AB168, Riedel Artist 64,
 * Clear-Com HX-PiCo, Lectrosonics multicoupler, Wisycom MRK16. Heights were checked against manufacturer or dealer data,
 * see `source` of each template.
 */

const STAGE = 'Stagebox', MIX = 'Mischpult (Rack)', IC = 'Intercom', CONV = 'Audio-Interface / Wandler', DIST = 'Antennenverteiler', RX = 'UHF Empfänger';
const ds = (what: string) => `Datenblatt – ${what}; Anschlüsse laut Herstellerangaben, Positionen geschätzt (±10 mm)`;
const est = (what: string) => `Schätzung – ${what}; vor dem Einsatz am Gerät prüfen`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const bnc = (names: string[], dir: Blk['dir'], o: Partial<Blk> = {}): Blk => B.list(names, 'BNC', dir, o);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const PSU2 = B.list(['Power A', 'Power B'], 'IEC_C14', 'in');
const H = (u: number) => u * 44.45 - 0.8;

/** template with plug-in card bays (front); the bays are passed as rectangles so the logo avoids them */
function withCards(s: Spec, bays: ModuleBay[]): DeviceTemplate {
  const fa = typeof s.fa === 'function' ? s.fa : () => (s.fa as ArtElement[] | undefined) ?? [];
  const t = mk({ ...s, fa: (h) => [...bays.map((b) => A.rect(b.x, b.y, b.w, b.h, '#0c0d0f', 0.8)), ...fa(h)] });
  return { ...t, modules: bays };
}
/** n horizontal card slots stacked from the top */
function stackedSlots(n: number, prefix: string, options: ModuleBay['options'], o: { x0?: number; x1?: number; y0?: number; h: number; gap?: number; def?: string }): ModuleBay[] {
  const x0 = o.x0 ?? 40, x1 = o.x1 ?? 442, gap = o.gap ?? 3;
  return Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, x: x0, y: Math.round(((o.y0 ?? 6) + i * (o.h + gap)) * 10) / 10, w: x1 - x0, h: o.h, options, default: o.def, style: 'card' as const }));
}
/** n vertical card slots side by side */
function sideSlots(n: number, prefix: string, options: ModuleBay['options'], o: { x0: number; x1: number; y0: number; h: number; gap?: number; def?: string }): ModuleBay[] {
  const gap = o.gap ?? 3, w = (o.x1 - o.x0 - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, x: Math.round((o.x0 + i * (w + gap)) * 10) / 10, y: o.y0, w: Math.round(w * 10) / 10, h: o.h, options, default: o.def, style: 'card' as const }));
}

const RY_CARDS: ModuleBay['options'] = [
  { id: 'RY16-ML-SRC', label: 'RY16-ML-SRC: 16 Mic/Line-Eingänge' },
  { id: 'RY16-DA', label: 'RY16-DA: 16 Line-Ausgänge' },
  { id: 'RY16-AE', label: 'RY16-AE: 16 Kanäle AES/EBU' },
];
const PRODIGY_CARDS: ModuleBay['options'] = [
  { id: 'AD.MIC', label: 'AD.MIC: 8 Mic/Line-Eingänge' },
  { id: 'DA.LINE', label: 'DA.LINE: 8 Line-Ausgänge' },
  { id: 'AES.IO', label: 'AES.IO: 8 Kanäle AES3 Ein/Aus' },
];

// ================================================================== Yamaha RIVAGE PM, DirectOut PRODIGY
const cardRacks: DeviceTemplate[] = [
  withCards({ id: 'yam-rpio622', name: 'RPio622', man: 'Yamaha', cat: STAGE, u: 10, depth: 490, color: '#232528', weight: 30, logo: 'YAMAHA', model: 'RPio622 I/O Rack',
    fa: (h) => [A.leds(22, h - 14, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 5, 0), A.sw(450, h - 30)],
    rear: [G([PSU2]), G([B.list(['HY Slot 1', 'HY Slot 2'], 'GENERIC', 'io', { rows: 2, ys: [40, 80] }), B.one('Network', 'RJ45', 'io', { gap: 10, ys: [40] }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6, ys: [40] })], 'right')],
    src: ds('Yamaha RPio622: 10 HE, 480 × 455 × 489,7 mm, 30 kg, 6 RY- und 2 HY-Steckplätze'),
    notes: 'I/O-Rack für RIVAGE PM. Jeder der 6 RY-Steckplätze nimmt eine Karte auf (16 Mic/Line-Eingänge, 16 Ausgänge oder 16 AES), die HY-Steckplätze hinten die Netzwerkkarten (TWINLANe, Dante). Steckplätze im Inspector belegen.' },
  stackedSlots(6, 'RY-Steckplatz', RY_CARDS, { y0: 8, h: 60, def: 'RY16-ML-SRC' })),
  withCards({ id: 'yam-rpio222', name: 'RPio222', man: 'Yamaha', cat: STAGE, u: 5, depth: 491, color: '#232528', weight: 19, logo: 'YAMAHA', model: 'RPio222 I/O Rack',
    fa: (h) => [A.leds(22, h - 14, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 5, 0)],
    rear: [G([PSU2]), G([B.list(['HY Slot 1', 'HY Slot 2'], 'GENERIC', 'io'), B.one('Network', 'RJ45', 'io', { gap: 10 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 })], 'right')],
    src: ds('Yamaha RPio222: 5 HE, 480 × 232 × 491 mm, 19 kg; Zahl der RY-Steckplätze geschätzt'),
    notes: 'Kompaktes I/O-Rack für RIVAGE PM. RY-Steckplätze im Inspector belegen.' },
  stackedSlots(2, 'RY-Steckplatz', RY_CARDS, { y0: 12, h: 64, gap: 8, def: 'RY16-ML-SRC' })),
  withCards({ id: 'directout-prodigy-mc', name: 'PRODIGY.MC', man: 'DirectOut', cat: CONV, u: 2, depth: 254, color: '#2f3237', weight: 10, logo: 'DIRECTOUT', model: 'PRODIGY.MC',
    fa: (h) => [A.lcd(30, 10, 60, h - 20, '#dbeafe', false)],
    rear: [G([PSU2]), G([B.list(['MADI A In', 'MADI A Out', 'MADI B In', 'MADI B Out'], 'MADI-BNC', 'io', { rows: 2 }), B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 })], 'right')],
    src: ds('DirectOut PRODIGY.MC: 2 HE, 19" × 10" × 3,5", 10 kg; Zahl der Steckplätze je nach Quelle 8 bis 11, hier 8 für Ein-/Ausgangsmodule'),
    notes: 'Modularer Wandler mit Ein-/Ausgangsmodulen und Netzwerk-Audio (MADI, Dante, RAVENNA). Steckplätze im Inspector belegen.' },
  sideSlots(8, 'Modul', PRODIGY_CARDS, { x0: 100, x1: 450, y0: 6, h: H(2) - 12, def: 'AD.MIC' })),
  withCards({ id: 'directout-prodigy-mp', name: 'PRODIGY.MP', man: 'DirectOut', cat: CONV, u: 2, depth: 254, color: '#2f3237', weight: 10, logo: 'DIRECTOUT', model: 'PRODIGY.MP',
    fa: (h) => [A.lcd(30, 10, 60, h - 20, '#dbeafe', false)],
    rear: [G([PSU2]), G([B.list(['MADI A In', 'MADI A Out', 'MADI B In', 'MADI B Out'], 'MADI-BNC', 'io', { rows: 2 }), B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 })], 'right')],
    src: ds('DirectOut PRODIGY.MP: 2 HE, 8 Steckplätze; Tiefe wie PRODIGY.MC angenommen'),
    notes: 'Multifunktions-Audioprozessor mit Modulen, Routing und DSP. Steckplätze im Inspector belegen.' },
  sideSlots(8, 'Modul', PRODIGY_CARDS, { x0: 100, x1: 450, y0: 6, h: H(2) - 12, def: 'AD.MIC' })),
];

// ================================================================== stage boxes and engines
const aes50 = B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { rows: 2 });
const stage: DeviceTemplate[] = [
  mk({ id: 'midas-dl153', name: 'DL153', man: 'Midas', cat: STAGE, u: 2, depth: 300, color: '#1c1c1e', logo: 'MIDAS',
    front: [G([B.xin(16, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 10 })]), G([aes50], 'right')], rear: [G([PSU2])],
    src: ds('Midas DL153: 2 HE, 16 Mic-Eingänge, 8 Line-Ausgänge, AES50 auf etherCON'), notes: '16 in, 8 out, AES50 redundant (Pro Series / M32).' }),
  mk({ id: 'midas-dl154', name: 'DL154', man: 'Midas', cat: STAGE, u: 2, depth: 300, color: '#1c1c1e', logo: 'MIDAS',
    front: [G([B.xin(8, 'In ', { rows: 2 }), B.xout(16, 'Out ', { rows: 2, gap: 10 })]), G([aes50], 'right')], rear: [G([PSU2])],
    src: ds('Midas DL154: 2 HE, 8 Eingänge, 16 Ausgänge'), notes: '8 in, 16 out, AES50 redundant. Nicht mehr lieferbar.' }),
  mk({ id: 'midas-dl155', name: 'DL155', man: 'Midas', cat: STAGE, u: 2, depth: 300, color: '#1c1c1e', logo: 'MIDAS',
    front: [G([B.xin(8, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 8 }), B.list(['AES In 1/2', 'AES In 3/4', 'AES In 5/6', 'AES In 7/8'], 'XLR3F', 'in', { rows: 2, gap: 8 }), B.list(['AES Out 1/2', 'AES Out 3/4', 'AES Out 5/6', 'AES Out 7/8'], 'AES-XLR', 'out', { rows: 2, gap: 4 })]), G([aes50], 'right')], rear: [G([PSU2])],
    src: est('Midas DL155: 2 HE; Kanalzahl je nach Quelle 16 × 16 oder 8 × 8 + 8 AES, hier 8 analog + 8 AES je Richtung'), notes: '8 Mic-Eingänge, 8 Ausgänge, AES3, AES50 redundant.' }),
  mk({ id: 'midas-neutron', name: 'Neutron', man: 'Midas', cat: MIX, u: 7, depth: 450, color: '#1c1c1e', weight: 25, logo: 'MIDAS', model: 'NEUTRON Audio System Engine',
    fa: () => [A.lcd(40, 30, 120, 60, '#dbeafe', false), A.leds(180, 40, 3, ['#22c55e', '#22c55e', '#22c55e'], 8, 0)],
    rear: [G([B.list(['Power A', 'Power B', 'Power C'], 'IEC_C14', 'in')]), G([B.list(seq('AES50 ', 8), 'ETHERCON', 'io', { rows: 2 }), B.list(['HyperMAC A', 'HyperMAC B'], 'OPTICALCON', 'io', { gap: 10 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 8 })], 'right')],
    src: est('Midas NEUTRON: 7 HE, 3 Netzteile (2 nötig), 192 Kanäle'), notes: 'Audio-Engine für PRO X. Nicht mehr lieferbar.' }),
  mk({ id: 'ssl-sb3224', name: 'SB 32.24', man: 'Solid State Logic', cat: STAGE, u: 5, depth: 300, color: '#3a3c40', weight: 14, logo: 'SSL', model: 'SB 32.24 Network I/O',
    front: [G([B.xin(32, 'In ', { rows: 4, ys: [25, 61, 97, 133] })], 'right'), G([B.xout(16, 'Out ', { rows: 2, ys: [175, 205] }), B.list(['AES In 1–8', 'AES Out 1–8'], 'DSUB25-AES', 'io', { gap: 10, ys: [190] })], 'right')],
    rear: [G([PSU2]), G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io')], 'right')],
    src: ds('SSL SB 32.24 User Guide: 5 HE, 32 Mic/Line-Eingänge, 16 Line-Ausgänge, AES3, Dante'), notes: 'Dante-Stagebox, 40 Eingänge und 24 Ausgänge inklusive AES.' }),
  mk({ id: 'ssl-sb1612', name: 'SB 16.12', man: 'Solid State Logic', cat: STAGE, u: 3, depth: 300, color: '#3a3c40', weight: 9, logo: 'SSL', model: 'SB 16.12 Network I/O',
    front: [G([B.xin(16, 'In ', { rows: 2, ys: [25, 61] })], 'right'), G([B.xout(8, 'Out ', { ys: [110] }), B.list(['AES In 1–4', 'AES Out 1–4'], 'DSUB25-AES', 'io', { gap: 10, ys: [110] })], 'right')],
    rear: [G([PSU2]), G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io')], 'right')],
    src: ds('SSL SB 16.12 User Guide: 3 HE, 16 Mic/Line-Eingänge, 8 Line-Ausgänge, AES3, Dante'), notes: 'Dante-Stagebox, 20 Eingänge und 12 Ausgänge inklusive AES.' }),
  mk({ id: 'avid-stage32', name: 'VENUE Stage 32', man: 'Avid', cat: STAGE, u: 5, depth: 400, color: '#232427', weight: 14, logo: 'AVID', model: 'VENUE | Stage 32',
    front: [G([B.xin(24, 'In ', { rows: 3, ys: [25, 61, 97] })], 'right'), G([B.xout(8, 'Out ', { ys: [190] })], 'right')],
    rear: [G([PSU2]), G([B.list(['AVB A', 'AVB B'], 'ETHERCON', 'io'), B.list(['AES In', 'AES Out'], 'XLR3F', 'io', { gap: 8 })], 'right')],
    src: est('Avid VENUE Stage 32, 5 HE laut Händlerangaben, 24 Eingänge / 8 Ausgänge'), notes: 'Stagerack für VENUE S6L, ausbaubar.' }),
  mk({ id: 'digico-orange-box', name: 'Orange Box', man: 'DiGiCo', cat: CONV, u: 2, depth: 260, color: '#e8762b', ink: '#1f2328', weight: 5, logo: 'DiGiCo', model: 'Orange Box',
    rear: [G([PSU2]), G([B.list(['DMI Slot A', 'DMI Slot B'], 'GENERIC', 'io'), B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 8 }), B.list(['Optocore A', 'Optocore B'], 'OPTICALCON', 'io', { gap: 8 })], 'right')],
    src: ds('DiGiCo Orange Box: 2 HE, 2 DMI-Steckplätze, redundante Netzteile'), notes: 'Formatwandler mit zwei DMI-Karten (Dante, MADI, Waves, AES …).' }),
  mk({ id: 'ah-ab168', name: 'AB168', man: 'Allen & Heath', cat: STAGE, u: 4, depth: 200, color: '#202124', weight: 6.5, logo: 'ALLEN & HEATH', model: 'AB168 AudioRack',
    front: [G([B.xin(16, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 10 })], 'right')],
    rear: [G([IEC]), G([B.list(['dSNAKE', 'Expander'], 'ETHERCON', 'io')], 'right')],
    src: ds('Allen & Heath AB168: mit Rackkit mindestens 4 HE (Gerät 3 HE)'), notes: 'Portable AudioRack, 16 in / 8 out, dSNAKE.' }),
];

// ================================================================== intercom and RF
const misc: DeviceTemplate[] = [
  mk({ id: 'riedel-artist64', name: 'Artist 64', man: 'Riedel', cat: IC, u: 6, depth: 400, color: '#2a2c30', weight: 15, logo: 'RIEDEL', model: 'ARTIST 64',
    rear: [G([PSU2]), G([B.list(seq('Port ', 32), 'RJ45', 'io', { rows: 4 }), B.list(['Fiber A', 'Fiber B'], 'LC', 'io', { gap: 10 })], 'right')],
    src: ds('Riedel Artist 64: 19", 6 HE laut Riedel, 64 Ports je Frame'), notes: 'Intercom-Matrix der Artist-Familie, Ports je nach Karten.' }),
  mk({ id: 'cc-hx-pico', name: 'Eclipse HX-PiCo', man: 'Clear-Com', cat: IC, u: 1, depth: 300, color: '#25272a', weight: 4, logo: 'CLEAR-COM', model: 'Eclipse HX-PiCo',
    rear: [G([PSU2]), G([B.list(seq('Port ', 12), 'RJ45', 'io', { rows: 2 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: ds('Clear-Com Eclipse HX-PiCo: 1 HE, 36 Ports; nicht mehr lieferbar'), notes: 'Kleine Intercom-Matrix, analoge Ports auf RJ45, weitere über IP.' }),
  mk({ id: 'lect-umcwbd', name: 'UMCWBD-L', man: 'Lectrosonics', cat: DIST, u: 1, depth: 250, color: '#2d2f33', weight: 3, logo: 'LECTROSONICS', model: 'UMCWBD-L Multicoupler',
    fa: [A.rect(80, 4, 300, 35.6, '#121316', 1), A.sw(440, 14.8)],
    rear: [G([IEC]), G([bnc(['Ant A In', 'Ant B In'], 'in'), bnc(['Ant A Out', 'Ant B Out'], 'out', { gap: 8 })], 'right')],
    src: est('Lectrosonics UMCWBD-L, 1 HE, für 4 kompakte Diversity-Empfänger'), notes: 'Rackmultikoppler mit Halterung, Strom- und HF-Verteilung für 4 Empfänger (DCR822, DSR, DSR4, UCR411, SR).' }),
  withCards({ id: 'wisy-mrk16', name: 'MRK16', man: 'Wisycom', cat: RX, u: 1, depth: 300, color: '#2a2c30', weight: 4, logo: 'WISYCOM', model: 'MRK16',
    fields: ['Frequenz', 'Kanal / Name', 'Gruppe'],
    rear: [G([IEC]), G([B.list(['Ethernet 1', 'Ethernet 2'], 'RJ45', 'io'), B.one('USB-C', 'USB-C', 'io', { gap: 5 }), { c: 'DSUB25-AES', names: ['AES 1–8'], dir: 'out', gap: 6 }, { c: 'DSUB25', names: ['Analog Out 1–8', 'Analog Out 9–16'], dir: 'out', gap: 4, pitch: 55 }, bnc(['Ant A In', 'Ant B In'], 'in', { gap: 8 })], 'right')],
    src: est('Wisycom MRK16: 1 HE laut Hersteller, 4 Steckplätze für MCR54; Audioanschlüsse geschätzt'),
    notes: 'Modularer Empfänger für bis zu 4 MCR54 (16 Kanäle) oder MCR54-DUAL (8 Kanäle), mit Antennenverteilung und Dante. Steckplätze im Inspector belegen.' },
  sideSlots(4, 'MCR54-Steckplatz', [{ id: 'MCR54', label: 'MCR54: 4 Kanäle' }, { id: 'MCR54-DUAL', label: 'MCR54-DUAL: 2 Kanäle' }], { x0: 120, x1: 440, y0: 4, h: 35.6, def: 'MCR54' })),
];

export const COMPLETE3_DEVICES: DeviceTemplate[] = [...cardRacks, ...stage, ...misc];
