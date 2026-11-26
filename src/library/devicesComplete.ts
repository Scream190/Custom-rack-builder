import type { ArtElement, DeviceTemplate, ModuleBay } from '../model/types';
import { A, B, G, mk, type Blk, type Spec } from './proLayout';

/*
 * Completion batch: 19" units that were still missing, Shure first (Axient, UHF-R, legacy receivers, chargers with
 * exchangeable modules, distribution, mixers and conferencing), then other wireless brands and major DSP/amp lines.
 * Accuracy is stated per template in `source`:
 *  - "Datenblatt": height, width, depth and connector set from the manufacturer's spec sheet, positions estimated
 *  - "Schätzung": housing and connectors after product photos and manuals, check on the unit before use
 */

const RX = 'UHF Empfänger', DIST = 'Antennenverteiler', COMB = 'Antennen-Combiner', CHG = 'Ladegeräte', NET = 'Netzwerk';
const DSP = 'Signalprozessor', MIX = 'Mischpult (Rack)', STAGE = 'Stagebox', AMP = 'Endstufen', CONV = 'Audio-Interface / Wandler';
const UHF_FIELDS = ['Frequenz', 'Kanal / Name', 'Gruppe'];
const ds = (what: string) => `Datenblatt – ${what}; Anschlüsse laut Herstellerangaben, Positionen geschätzt (±10 mm)`;
const est = (what: string) => `Schätzung – ${what}; vor dem Einsatz am Gerät prüfen`;

const IEC = B.one('Power In', 'IEC_C14', 'in');
const IEC_THRU = B.one('Power Thru', 'IEC_C13', 'out', { gap: 4 });
const DCIN = B.one('DC In', 'DC', 'in');
const bnc = (names: string[], dir: Blk['dir'], o: Partial<Blk> = {}): Blk => B.list(names, 'BNC', dir, o);
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const ab = (n: number, pre = 'Out ') => [...seq(`${pre}A`, n), ...seq(`${pre}B`, n)];

/** two receiver channels: display, select buttons, level LEDs per channel */
const dualRxFront = (x0 = 70, w = 150) => (H: number): ArtElement[] => [0, 1].flatMap((i): ArtElement[] => [
  A.lcd(x0 + i * (w + 14), 7, w * 0.55, H - 14, '#e5f3ff', true),
  A.leds(x0 + i * (w + 14) + w * 0.6, 9, 6, ['#ef4444', '#f59e0b', '#22c55e'], 0, 4.4, 0.8),
  A.btn(x0 + i * (w + 14) + w * 0.7, 9, 14, 6, 'MENU'), A.btn(x0 + i * (w + 14) + w * 0.7, 22, 14, 6, 'SEL'),
  A.knob(x0 + i * (w + 14) + w * 0.92, H / 2, 5),
]).concat([A.sw(440, H / 2 - 7)]);
const singleRxHalf = (H: number): ArtElement[] => [A.lcd(70, 9, 70, H - 18, '#e5f3ff', true), A.btn(150, 10, 12, 6, 'MENU'), A.btn(150, 24, 12, 6, 'SEL'), A.knob(185, H / 2, 6), A.sw(205, H / 2 - 7)];
const distFront = (H: number): ArtElement[] => [A.lcd(150, 9, 70, H - 18, '#e5f3ff', false), A.leds(240, 10, 2, ['#22c55e', '#f59e0b'], 0, 6), A.btn(260, 10, 14, 6, 'ENTER'), A.btn(260, 24, 14, 6, 'EXIT'), A.knob(300, H / 2, 6), A.sw(440, H / 2 - 7)];

/** n charging bays across the front; the labels show what is fitted (fields) */
function chargerBays(options: ModuleBay['options'], n = 4, x0 = 96, x1 = 420, y = 3.2, h = 37.2): ModuleBay[] {
  const gap = 6, w = (x1 - x0 - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ name: `Schacht ${i + 1}`, x: Math.round((x0 + i * (w + gap)) * 10) / 10, y, w: Math.round(w * 10) / 10, h, options }));
}
/** template with module bays; the bays are also passed as rectangles so the logo avoids them */
function charger(s: Spec, bays: ModuleBay[]): DeviceTemplate {
  const fa = typeof s.fa === 'function' ? s.fa : () => (s.fa as ArtElement[] | undefined) ?? [];
  const t = mk({ ...s, fa: (H) => [...bays.map((b) => A.rect(b.x, b.y, b.w, b.h, '#0c0d0f', 1)), ...fa(H)] });
  return { ...t, modules: bays };
}

const SHURE = '#222428';
const SHURE_MODULES: ModuleBay['options'] = [
  { id: 'SBC-AX', label: 'SBC-AX: 2 × SB900A/B/C (Axient Digital, ULX-D, QLX-D, PSM 1000)' },
  { id: 'SBM910', label: 'SBM910: 2 × SB910 (ADX1)' },
  { id: 'SBM910M', label: 'SBM910M: 2 × SB910M (ADX1M)' },
  { id: 'SBM920', label: 'SBM920: 2 × SB920/SB920A (ADX2, ADX2FD)' },
  { id: 'AXT901', label: 'AXT901: 2 × AXT910 (Axient Taschensender)' },
  { id: 'AXT902', label: 'AXT902: 2 × AXT920 (Axient Handsender)' },
];

// ================================================================== Shure
const axt63x = (id: string, name: string, range: string) => mk({
  id, name, man: 'Shure', cat: DIST, u: 1, depth: 366, color: SHURE, weight: 4.6, logo: 'SHURE', model: `${name} Antenna Distribution`, fa: distFront,
  rear: [G([IEC, IEC_THRU, B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { gap: 8 })]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
  src: ds(`Shure AXT630/631 Spezifikation: 1 HE, 44 × 483 × 366 mm, 4,6 kg, ${range}`),
  notes: `Aktiver Antennenverteiler für Axient: 2 Antennen auf 4 Empfänger (A/B), Kaskade mit 3 dB Ausgleich, bis 15 dB Dämpfung, Steuerung über Wireless Workbench (Ethernet). ${range}.`,
});

const shure: DeviceTemplate[] = [
  mk({ id: 'shure-axt400', name: 'AXT400', man: 'Shure', cat: RX, u: 1, depth: 366, color: SHURE, weight: 5.4, logo: 'SHURE', model: 'AXT400 Dual Receiver', fields: UHF_FIELDS,
    front: [G([B.one('Phones', 'JACK', 'out')], 'left', { x0: 410 })], fa: dualRxFront(70, 150),
    rear: [G([IEC, IEC_THRU, B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { gap: 8 })]), G([B.xout(2, 'Out '), B.list(['Out 1 (Klinke)', 'Out 2 (Klinke)'], 'JACK', 'out', { gap: 5 }), bnc(['Ant B In', 'Ant A In'], 'in', { gap: 10 }), bnc(['Cascade B', 'Cascade A'], 'out', { gap: 5 })], 'right')],
    src: ds('Shure AXT400 User Guide: 1 HE, 483 × 366 mm'), notes: 'Axient Doppelempfänger mit Frequency Diversity und ShowLink. Vorgänger von Axient Digital, im Verleih noch verbreitet.' }),
  axt63x('shure-axt630', 'AXT630', '470–698 MHz'),
  axt63x('shure-axt631', 'AXT631', '606–814 MHz'),
  mk({ id: 'shure-axt620', name: 'AXT620 Ethernet-Switch', man: 'Shure', cat: NET, u: 1, depth: 280, color: SHURE, weight: 3.6, logo: 'SHURE', model: 'AXT620 Ethernet Switch',
    front: [G([B.one('Port 9 (vorne)', 'RJ45', 'io')], 'left', { x0: 400 })], fa: [A.leds(380, 12, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 0, 6)],
    rear: [G([IEC]), G([B.rj(4, 'Port '), B.rj(4, 'Port ', { start: 5, gap: 8, names: ['Port 5 (PoE)', 'Port 6 (PoE)', 'Port 7 (PoE)', 'Port 8 (PoE)'] })], 'right')],
    src: ds('Shure AXT620 User Guide: 1 HE, 440 × 44 × 280 mm, 3,6 kg, 8 Ports hinten (5–8 mit PoE) + 1 vorne'), notes: 'Ethernet-Switch mit DHCP-Server für Axient-Systeme. Nicht mehr lieferbar.' }),
  charger({ id: 'shure-axt900', name: 'AXT900 Ladestation', man: 'Shure', cat: CHG, u: 1, depth: 366, color: SHURE, weight: 4.4, logo: 'SHURE', model: 'AXT900',
    fa: [A.sw(440, 14.8)], rear: [G([IEC]), G([B.list(['Network 1', 'Network 2'], 'RJ45', 'io')], 'right')],
    src: ds('Shure AXT900 Spezifikation: 1 HE, 44 × 483 × 366 mm, 4,4 kg ohne Module, 4 Schächte'), notes: 'Netzwerkfähige Rack-Ladestation für Axient, 4 Schächte für Lademodule AXT901 (Taschensender-Akku AXT910) und AXT902 (Handsender-Akku AXT920). Schächte im Inspector belegen.' },
    chargerBays(SHURE_MODULES.filter((o) => o.id.startsWith('AXT')))),
  charger({ id: 'shure-sbrc', name: 'SBRC Rack-Ladegerät', man: 'Shure', cat: CHG, u: 1, depth: 300, color: SHURE, weight: 4, logo: 'SHURE', model: 'SBRC',
    fa: [A.sw(440, 14.8)], rear: [G([IEC]), G([B.list(['Network 1', 'Network 2'], 'RJ45', 'io')], 'right')],
    src: ds('Shure SBRC Produktseite und User Guide: 1 HE, 4 frei belegbare Schächte, bis 8 Akkus; Tiefe geschätzt'),
    notes: 'Rack-Ladegerät für bis zu 8 Shure-Akkus. Jeder der 4 Schächte nimmt ein Lademodul für 2 Akkus auf, Typen frei mischbar: SBC-AX (SB900A/B/C), SBM910, SBM910M, SBM920, AXT901, AXT902. Schächte im Inspector belegen.' },
    chargerBays(SHURE_MODULES)),
  mk({ id: 'shure-ur4dplus', name: 'UR4D+', man: 'Shure', cat: RX, u: 1, depth: 330, color: '#2a2c30', weight: 4.5, logo: 'SHURE', model: 'UR4D+ (UHF-R)', fields: UHF_FIELDS,
    front: [G([B.one('Phones', 'JACK', 'out')], 'left', { x0: 410 })], fa: dualRxFront(70, 150),
    rear: [G([IEC, B.one('Network', 'RJ45', 'io', { gap: 8 })]), G([B.xout(2, 'Out '), B.list(['Out 1 (Klinke)', 'Out 2 (Klinke)'], 'JACK', 'out', { gap: 5 }), bnc(['Ant B In', 'Ant A In'], 'in', { gap: 10 }), bnc(['Cascade B', 'Cascade A'], 'out', { gap: 5 })], 'right')],
    src: ds('Shure UHF-R UR4D+ User Guide: 1 HE, volle Breite'), notes: 'UHF-R Doppelempfänger. Nicht mehr lieferbar, im Bestand vieler Verleiher.' }),
  mk({ id: 'shure-ur4splus', name: 'UR4S+', man: 'Shure', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 330, color: '#2a2c30', weight: 2.5, logo: 'SHURE', model: 'UR4S+', fields: UHF_FIELDS,
    fa: singleRxHalf, rear: [G([IEC, B.one('Network', 'RJ45', 'io', { gap: 6 })]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 4 }), bnc(['Ant B', 'Ant A'], 'in', { gap: 6 })], 'right')],
    src: est('Shure UHF-R UR4S+, halbe Breite'), notes: 'UHF-R Einzelempfänger, halbe Rackbreite.' }),
  ...([['shure-slx4', 'SLX4', 'SLX'], ['shure-ulxs4', 'ULXS4', 'ULX Standard'], ['shure-ulxp4', 'ULXP4', 'ULX Professional']] as const).map(([id, name, series]) => mk({
    id, name, man: 'Shure', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 185, color: '#2a2c30', weight: 1.1, logo: 'SHURE', model: name, fields: UHF_FIELDS,
    fa: singleRxHalf, rear: [G([DCIN]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 4 }), bnc(['Ant B', 'Ant A'], 'in', { gap: 6 })], 'right')],
    src: est(`Shure ${series}, halbe Breite mit Rackkit`), notes: `${series} Einzelempfänger mit externem Netzteil. Älteres System, noch häufig im Bestand.` })),
  mk({ id: 'shure-blx4r', name: 'BLX4R', man: 'Shure', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 160, color: '#26282c', weight: 1, logo: 'SHURE', model: 'BLX4R', fields: UHF_FIELDS,
    fa: singleRxHalf, rear: [G([DCIN]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 4 }), bnc(['Antenne'], 'in', { gap: 6 })], 'right')],
    src: est('Shure BLX4R, halbe Breite'), notes: 'BLX-Empfänger in Metallgehäuse für den Racheinbau, Antenne hinten.' }),
  mk({ id: 'shure-glxd4rplus', name: 'GLXD4R+', man: 'Shure', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#26282c', weight: 1.2, logo: 'SHURE', model: 'GLXD4R+ (2,4/5,8 GHz)',
    fa: singleRxHalf, rear: [G([DCIN, B.one('Network', 'RJ45', 'io', { gap: 6 })]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 4 }), bnc(['Ant B', 'Ant A'], 'in', { gap: 6 })], 'right')],
    src: est('Shure GLX-D+ GLXD4R+, halbe Breite'), notes: 'Digitaler Empfänger im 2,4- und 5,8-GHz-Band, keine UHF-Koordination nötig.' }),
  mk({ id: 'shure-ua845uwb', name: 'UA845UWB', man: 'Shure', cat: DIST, u: 1, depth: 200, color: '#1f2124', weight: 2.3, logo: 'SHURE', model: 'UA845UWB Antenna Distribution',
    fa: [A.leds(200, 12, 4, ['#22c55e', '#22c55e', '#22c55e', '#22c55e'], 8, 0), A.sw(440, 14.8)],
    rear: [G([IEC, B.list(seq('DC Out ', 5), 'DC', 'out', { gap: 6 })]), G([bnc(ab(5), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: est('Shure UA845UWB, 470–952 MHz, 1 HE'), notes: 'Breitbandiger Antennenverteiler 1:5 (A/B) mit Kaskade und DC-Versorgung für Empfänger.' }),
  mk({ id: 'shure-pa421b', name: 'PA421B Combiner', man: 'Shure', cat: COMB, u: 1, depth: 200, color: '#1d1f22', weight: 2, logo: 'SHURE', model: 'PA421B Antenna Combiner',
    front: [G([bnc(['Antenna Out'], 'out')], 'left', { x0: 60 })], fa: [A.leds(200, 12, 4, ['#22c55e', '#22c55e', '#22c55e', '#22c55e'], 8, 0), A.sw(440, 14.8)],
    rear: [G([IEC]), G([B.list(seq('DC Out ', 4), 'DC', 'out'), bnc(seq('RF In ', 4), 'in', { gap: 10 })], 'right')],
    src: est('abgeleitet von PA821B (gleiche User Guide), 4 Eingänge'), notes: 'Aktiver Combiner 4:1 für PSM-Sender.' }),
  mk({ id: 'shure-scm820', name: 'SCM820', man: 'Shure', cat: DSP, u: 1, depth: 330, color: '#2a2c30', weight: 4.1, logo: 'SHURE', model: 'SCM820 Automatic Mixer',
    front: [G([B.one('Phones', 'JACK', 'out')], 'left', { x0: 410 })], fa: (H) => [...Array.from({ length: 8 }, (_, i) => A.knob(80 + i * 34, H / 2, 6)), A.leds(360, 9, 6, ['#ef4444', '#f59e0b', '#22c55e'], 0, 4.4, 0.8)],
    rear: [G([IEC]), G([B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { rows: 2 }), { c: 'DSUB25', names: ['Direct Out 1–8'], dir: 'out', gap: 6 }, B.list(['Aux In', 'Mix A Out (Block)', 'Mix B Out (Block)'], 'PHOENIX3', 'io', { gap: 6 }), B.xout(2, 'Mix ', { names: ['Mix A Out', 'Mix B Out'], gap: 6 }), B.xin(8, 'In ', { gap: 6 })], 'right')],
    src: ds('Shure SCM820 User Guide: 1 HE, 8 Kanäle; Dante nur bei SCM820-DAN'), notes: 'Digitaler Automatikmischer mit 8 Kanälen, IntelliMix, Dante (SCM820-DAN).' }),
  mk({ id: 'shure-scm800', name: 'SCM800', man: 'Shure', cat: DSP, u: 1, depth: 230, color: '#2a2c30', weight: 3.3, logo: 'SHURE', model: 'SCM800 Automatic Mixer',
    fa: (H) => [...Array.from({ length: 8 }, (_, i) => A.knob(80 + i * 34, H / 2, 6)), A.leds(360, 9, 6, ['#ef4444', '#f59e0b', '#22c55e'], 0, 4.4, 0.8)],
    rear: [G([IEC]), G([{ c: 'DSUB25', names: ['Link In', 'Link Out'], dir: 'io', pitch: 55 }, B.xout(1, 'Out ', { gap: 6 }), B.xin(8, 'In ', { gap: 6 })], 'right')],
    src: est('Shure SCM800, 1 HE'), notes: 'Analoger Automatikmischer mit 8 Kanälen, verkettbar.' }),
  mk({ id: 'shure-scm268', name: 'SCM268', man: 'Shure', cat: MIX, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#3a3c40', weight: 1.6, logo: 'SHURE', model: 'SCM268',
    fa: (H) => [...Array.from({ length: 5 }, (_, i) => A.knob(60 + i * 26, H / 2, 6))],
    rear: [G([IEC]), G([B.xin(4, 'In '), B.xout(1, 'Out ', { gap: 5 }), B.one('Aux Out', 'JACK', 'out', { gap: 4 })], 'right')],
    src: est('Shure SCM268, halbe Breite'), notes: '4-Kanal-Mikrofonmischer.' }),
  mk({ id: 'shure-scm262', name: 'SCM262', man: 'Shure', cat: MIX, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#3a3c40', weight: 1.6, logo: 'SHURE', model: 'SCM262',
    fa: (H) => [...Array.from({ length: 6 }, (_, i) => A.knob(56 + i * 24, H / 2, 5.5))],
    rear: [G([IEC]), G([B.xin(4, 'In '), B.xout(2, 'Out ', { names: ['Out L', 'Out R'], gap: 5 })], 'right')],
    src: est('Shure SCM262, halbe Breite'), notes: '4-Kanal-Stereomischer.' }),
  mk({ id: 'shure-scm410', name: 'SCM410', man: 'Shure', cat: DSP, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#3a3c40', weight: 1.5, logo: 'SHURE', model: 'SCM410',
    fa: (H) => [...Array.from({ length: 5 }, (_, i) => A.knob(60 + i * 26, H / 2, 5.5))],
    rear: [G([IEC]), G([B.list(seq('In ', 4), 'PHOENIX3', 'in'), B.xout(1, 'Out ', { gap: 5 }), { c: 'DSUB9', names: ['Logic'], dir: 'io', gap: 4 }], 'right')],
    src: est('Shure SCM410, halbe Breite'), notes: 'Automatikmischer mit 4 Kanälen, verkettbar.' }),
  mk({ id: 'shure-p300', name: 'IntelliMix P300', man: 'Shure', cat: DSP, u: 1, slots: 2, bodyW: 213, depth: 160, color: '#26282c', weight: 1, logo: 'SHURE', model: 'P300 IntelliMix',
    fa: [A.leds(60, 14, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([B.one('Dante (PoE+)', 'RJ45', 'io'), B.one('USB', 'USB', 'io', { gap: 5 })]), G([B.list(['Analog In 1', 'Analog In 2', 'Analog Out 1', 'Analog Out 2'], 'PHOENIX3', 'io'), B.list(['Mobile In', 'Mobile Out'], 'MINIJACK', 'io', { gap: 5 })], 'right')],
    src: ds('Shure P300 User Guide: halbe Breite, Versorgung über PoE+'), notes: 'Audio-Konferenz-Prozessor mit Dante, USB und Echokompensation.' }),
  ...([['shure-aniusb', 'ANIUSB-MATRIX', [B.one('USB', 'USB', 'io'), B.list(['Analog Out 1', 'Analog Out 2'], 'PHOENIX3', 'out', { gap: 5 })], 'Dante-Interface mit USB und Matrix.'],
    ['shure-ani4in', 'ANI4IN-XLR', [B.xin(4, 'In ')], 'Dante-Interface, 4 analoge Eingänge.'],
    ['shure-ani4out', 'ANI4OUT-XLR', [B.xout(4, 'Out ')], 'Dante-Interface, 4 analoge Ausgänge.']] as const).map(([id, name, io, notes]) => mk({
    id, name, man: 'Shure', cat: CONV, u: 1, slots: 3, bodyW: 140, depth: 130, color: '#1f2124', weight: 0.6, logo: 'SHURE', model: name,
    rear: [G([B.one('Dante (PoE)', 'RJ45', 'io')]), G([...io], 'right')],
    src: est('Shure ANI, Drittel-Breite im Rackeinbaukit CRT1'), notes })),
  mk({ id: 'shure-dfr22', name: 'DFR22', man: 'Shure', cat: DSP, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#2a2c30', weight: 1.7, logo: 'SHURE', model: 'DFR22 Audio Processor',
    fa: [A.leds(70, 12, 4, ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'], 6, 0)],
    rear: [G([IEC]), G([B.xin(2, 'In '), B.xout(2, 'Out ', { gap: 5 }), B.one('RS-232', 'DSUB9', 'io', { gap: 5 })], 'right')],
    src: est('Shure DFR22, halbe Breite'), notes: 'Feedback-Unterdrückung und Matrix, 2 × 2.' }),
];

// ================================================================== Sennheiser
const SENN = '#2b2e33';
const sennCharger = charger({ id: 'senn-l6000', name: 'L 6000 Ladegerät', man: 'Sennheiser', cat: CHG, u: 1, depth: 300, color: SENN, weight: 4, logo: 'SENNHEISER', model: 'L 6000',
  fa: [A.sw(440, 14.8)], rear: [G([IEC]), G([B.one('Network', 'RJ45', 'io')], 'right')],
  src: ds('Sennheiser L 6000 Produktspezifikation: 19", 1 HE, 4 Lademodule; Tiefe geschätzt'),
  notes: 'Rack-Ladegerät mit 4 Schächten für Lademodule, frei mischbar: LM 6060 (BA 60), LM 6061 (BA 61), LM 6062 (BA 62), LM 6070 (BA 70). Schächte im Inspector belegen.' },
chargerBays([
  { id: 'LM 6060', label: 'LM 6060: 2 × BA 60 (SK 6000, SK 6212)' },
  { id: 'LM 6061', label: 'LM 6061: 2 × BA 61 (SKM 6000)' },
  { id: 'LM 6062', label: 'LM 6062: 2 × BA 62 (SK 9000, SKM 9000)' },
  { id: 'LM 6070', label: 'LM 6070: 2 × BA 70 (EW-D, EW-DX)' },
]));
const sennheiser: DeviceTemplate[] = [
  mk({ id: 'senn-em3732', name: 'EM 3732-II', man: 'Sennheiser', cat: RX, u: 1, depth: 330, color: SENN, weight: 4.4, logo: 'SENNHEISER', model: 'EM 3732-II', fields: UHF_FIELDS,
    front: [G([B.one('Phones', 'JACK', 'out')], 'left', { x0: 400 })], fa: dualRxFront(70, 150),
    rear: [G([IEC, B.one('Network', 'RJ45', 'io', { gap: 8 })]), G([B.xout(2, 'Out '), B.list(['Out 1 (Klinke)', 'Out 2 (Klinke)'], 'JACK', 'out', { gap: 5 }), bnc(['Ant A In', 'Ant B In'], 'in', { gap: 10 }), bnc(['Ant A Out', 'Ant B Out'], 'out', { gap: 5 })], 'right')],
    src: ds('Sennheiser EM 3732-II Bedienungsanleitung: 1 HE, 2 Kanäle'), notes: 'Doppelempfänger der Serie 3000, Antennen-Durchschleifausgänge.' }),
  mk({ id: 'senn-asa3000', name: 'ASA 3000', man: 'Sennheiser', cat: DIST, u: 1, depth: 250, color: SENN, weight: 2.8, logo: 'SENNHEISER', model: 'ASA 3000 Antenna Splitter', fa: distFront,
    rear: [G([IEC]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: est('Sennheiser ASA 3000, 1 HE'), notes: 'Aktiver Antennenverteiler für die Serien 3000/5000, 4 Doppelempfänger.' }),
  mk({ id: 'senn-asa1', name: 'ASA 1', man: 'Sennheiser', cat: DIST, u: 1, depth: 200, color: SENN, weight: 2, logo: 'SENNHEISER', model: 'ASA 1 Antenna Splitter',
    fa: [A.leds(200, 14, 1, ['#22c55e']), A.sw(440, 14.8)],
    rear: [G([DCIN, B.list(seq('DC Out ', 4), 'DC', 'out', { gap: 6 })]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: est('Sennheiser ASA 1 mit Netzteil NT 1-1, 1 HE'), notes: 'Antennenverteiler für evolution wireless G3/G4: 4 Empfänger (A/B), versorgt die Empfänger über DC-Kabel.' }),
  mk({ id: 'senn-ewd-asa', name: 'EW-D ASA', man: 'Sennheiser', cat: DIST, u: 1, depth: 200, color: SENN, weight: 2.2, logo: 'SENNHEISER', model: 'EW-D ASA Antenna Splitter',
    fa: [A.leds(200, 14, 1, ['#22c55e']), A.sw(440, 14.8)],
    rear: [G([IEC, B.list(seq('DC Out ', 4), 'DC', 'out', { gap: 6 })]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: est('Sennheiser EW-D ASA, 1 HE'), notes: 'Aktiver Antennenverteiler für EW-D und EW-DX, 4 Empfänger, DC-Versorgung und Kaskade.' }),
  mk({ id: 'senn-ac3', name: 'AC 3', man: 'Sennheiser', cat: COMB, u: 1, depth: 200, color: SENN, weight: 2, logo: 'SENNHEISER', model: 'AC 3 Antenna Combiner',
    front: [G([bnc(['Antenna Out'], 'out')], 'left', { x0: 60 })], fa: [A.leds(200, 14, 4, ['#22c55e', '#22c55e', '#22c55e', '#22c55e'], 8, 0), A.sw(440, 14.8)],
    rear: [G([DCIN, B.list(seq('DC Out ', 4), 'DC', 'out', { gap: 6 })]), G([bnc(seq('RF In ', 4), 'in')], 'right')],
    src: est('Sennheiser AC 3, 1 HE'), notes: 'Combiner 4:1 für SR IEM G3/G4, versorgt die Sender über DC-Kabel.' }),
  mk({ id: 'senn-ac3200', name: 'AC 3200-II', man: 'Sennheiser', cat: COMB, u: 1, depth: 260, color: SENN, weight: 3.5, logo: 'SENNHEISER', model: 'AC 3200-II Combiner',
    front: [G([bnc(['Antenna Out'], 'out')], 'left', { x0: 60 })], fa: [A.leds(200, 14, 8, ['#22c55e'], 6, 0), A.sw(440, 14.8)],
    rear: [G([IEC]), G([bnc(seq('RF In ', 8), 'in'), bnc(['Cascade In'], 'in', { gap: 10 })], 'right')],
    src: ds('Sennheiser AC 3200-II: 1 HE, 8 Eingänge'), notes: 'Aktiver Combiner 8:1 für IEM-Sender der Serien 2000 und 3000.' }),
  sennCharger,
];

// ================================================================== other wireless
const others: DeviceTemplate[] = [
  mk({ id: 'at-atw-da49', name: 'ATW-DA49', man: 'Audio-Technica', cat: DIST, u: 1, depth: 220, color: '#26282c', weight: 2.4, logo: 'AUDIO-TECHNICA', model: 'ATW-DA49 Antenna Distribution',
    fa: [A.leds(220, 14, 4, ['#22c55e'], 8, 0), A.sw(440, 14.8)],
    rear: [G([IEC, B.list(seq('DC Out ', 4), 'DC', 'out', { gap: 6 })]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: ds('Audio-Technica ATW-DA49: 1 HE, 470–990 MHz'), notes: 'Antennenverteiler 1:4 (A/B) mit Kaskade und DC-Versorgung.' }),
  mk({ id: 'lect-vrt2', name: 'Venue 2 (VRT2)', man: 'Lectrosonics', cat: RX, u: 1, depth: 250, color: '#2d2f33', weight: 2.6, logo: 'LECTROSONICS', model: 'Venue 2 Receiver Frame', fields: UHF_FIELDS,
    front: [G([B.one('Phones', 'JACK', 'out'), B.one('USB', 'USB', 'io', { gap: 6 })], 'left', { x0: 390 })], fa: (H) => [A.lcd(80, 8, 120, H - 16, '#e5f3ff', true), A.knob(220, H / 2, 6), A.btn(240, 10, 12, 6), A.btn(240, 24, 12, 6)],
    rear: [G([DCIN]), G([B.xout(6, 'Out '), bnc(['Ant A Out', 'Ant B Out'], 'out', { gap: 10 }), bnc(['Ant A In', 'Ant B In'], 'in', { gap: 5 })], 'right')],
    src: est('Lectrosonics Venue 2, 1 HE, bis 6 Empfängermodule VRS2'), notes: 'Empfänger-Rahmen für bis zu 6 Kanäle (Module VRS2), Antennen-Durchschleifausgang.' }),
  mk({ id: 'sony-dwr-r03d', name: 'DWR-R03D', man: 'Sony', cat: RX, u: 1, slots: 2, bodyW: 210, depth: 270, color: '#25272b', weight: 2.2, logo: 'SONY', model: 'DWR-R03D Digital Receiver', fields: UHF_FIELDS,
    fa: singleRxHalf, rear: [G([DCIN, B.one('Network', 'RJ45', 'io', { gap: 5 })]), G([B.xout(2, 'Out '), B.one('AES Out', 'AES-XLR', 'out', { gap: 4 }), bnc(['Ant A', 'Ant B'], 'in', { gap: 5 })], 'right')],
    src: est('Sony DWR-R03D, halbe Breite'), notes: 'Digitaler Zweikanal-Empfänger der DWX-Serie.' }),
];

// ================================================================== DSP, stageboxes, amps
const pro: DeviceTemplate[] = [
  mk({ id: 'yam-mrx7d', name: 'MRX7-D', man: 'Yamaha', cat: DSP, u: 1, depth: 330, color: '#232528', logo: 'YAMAHA', fa: [A.leds(120, 12, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in'), B.list(seq('Out ', 8), 'PHOENIX3', 'out', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 }), B.one('Network', 'RJ45', 'io', { gap: 4 })], 'right')],
    src: ds('Yamaha MRX7-D: 1 HE, 8 × 8 analog, Dante, YDIF'), notes: 'Frei programmierbarer Matrix-Prozessor.' }),
  mk({ id: 'yam-mtx5d', name: 'MTX5-D', man: 'Yamaha', cat: DSP, u: 1, depth: 330, color: '#232528', logo: 'YAMAHA', fa: [A.leds(120, 12, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in'), B.list(seq('Out ', 8), 'PHOENIX3', 'out', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 }), B.one('Network', 'RJ45', 'io', { gap: 4 })], 'right')],
    src: ds('Yamaha MTX5-D: 1 HE, Dante'), notes: 'Matrix-Prozessor für Installationen.' }),
  mk({ id: 'yam-ri8d', name: 'Ri8-D', man: 'Yamaha', cat: STAGE, u: 1, depth: 300, color: '#232528', logo: 'YAMAHA', front: [G([B.xin(8, 'In ')], 'right')],
    rear: [G([IEC]), G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io')], 'right')], src: ds('Yamaha Ri8-D: 1 HE, 8 Mikrofoneingänge, Dante'), notes: 'Dante-Eingangsbox, 8 Kanäle.' }),
  mk({ id: 'yam-ro8d', name: 'Ro8-D', man: 'Yamaha', cat: STAGE, u: 1, depth: 300, color: '#232528', logo: 'YAMAHA', front: [G([B.xout(8, 'Out ')], 'right')],
    rear: [G([IEC]), G([B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io')], 'right')], src: ds('Yamaha Ro8-D: 1 HE, 8 Ausgänge, Dante'), notes: 'Dante-Ausgangsbox, 8 Kanäle.' }),
  mk({ id: 'qsys-core8flex', name: 'Core 8 Flex', man: 'Q-SYS', cat: DSP, u: 1, depth: 260, color: '#1d1e20', logo: 'Q-SYS', model: 'Core 8 Flex',
    rear: [G([IEC]), G([B.list(seq('Flex ', 8), 'PHOENIX3', 'io'), B.list(seq('GPIO ', 2), 'PHOENIX3', 'io', { gap: 5 }), B.list(['LAN A', 'LAN B'], 'RJ45', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: est('Q-SYS Core 8 Flex, 1 HE'), notes: 'Kleiner Q-SYS Core mit 8 Flex-Kanälen.' }),
  mk({ id: 'qsys-corenano', name: 'Core Nano', man: 'Q-SYS', cat: DSP, u: 1, slots: 2, bodyW: 213, depth: 230, color: '#1d1e20', logo: 'Q-SYS', model: 'Core Nano',
    rear: [G([DCIN]), G([B.list(['LAN A', 'LAN B', 'AUX A', 'AUX B'], 'RJ45', 'io'), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: est('Q-SYS Core Nano, halbe Breite'), notes: 'Q-SYS Core ohne lokales I/O, nur Netzwerk-Audio.' }),
  mk({ id: 'ah-ahm64', name: 'AHM-64', man: 'Allen & Heath', cat: DSP, u: 1, depth: 300, color: '#202124', logo: 'ALLEN & HEATH', model: 'AHM-64 Audio Matrix', fa: [A.leds(140, 12, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([IEC]), G([B.list(['I/O Port 1', 'I/O Port 2'], 'RJ45', 'io'), B.list(['SLink 1', 'SLink 2'], 'ETHERCON', 'io', { gap: 6 }), B.one('Network', 'RJ45', 'io', { gap: 6 })], 'right')],
    src: ds('Allen & Heath AHM-64: 1 HE, 64 × 64, 2 I/O-Ports, 2 SLink'), notes: 'Matrix-Prozessor, I/O über Erweiterungskarten und Stageboxen.' }),
  mk({ id: 'ah-ahm16', name: 'AHM-16', man: 'Allen & Heath', cat: DSP, u: 1, depth: 280, color: '#202124', logo: 'ALLEN & HEATH', model: 'AHM-16 Audio Matrix',
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in'), B.list(seq('Out ', 8), 'PHOENIX3', 'out', { gap: 5 }), B.one('SLink', 'ETHERCON', 'io', { gap: 6 }), B.one('Network', 'RJ45', 'io', { gap: 5 })], 'right')],
    src: est('Allen & Heath AHM-16, 1 HE'), notes: 'Kompakter Matrix-Prozessor mit 8 × 8 analog.' }),
  mk({ id: 'db-ds10', name: 'DS10', man: 'd&b audiotechnik', cat: CONV, u: 1, depth: 260, color: '#2a2b2e', logo: 'd&b', model: 'DS10 Audio network bridge',
    rear: [G([IEC]), G([B.list(['AES In 1/2', 'AES In 3/4'], 'XLR3F', 'in'), B.list(['AES Out 1/2', 'AES Out 3/4'], 'AES-XLR', 'out', { gap: 5 }), B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { gap: 6 }), B.one('OCA', 'ETHERCON', 'io', { gap: 5 })], 'right')],
    src: ds('d&b DS10: 1 HE, Dante auf AES3, Ethernet-Switch'), notes: 'Netzwerk-Bridge Dante ↔ AES3 für d&b-Verstärker.' }),
  mk({ id: 'la-la716', name: 'LA7.16', man: 'L-Acoustics', cat: AMP, u: 2, depth: 470, color: '#1c1d1f', logo: 'L-ACOUSTICS', model: 'LA7.16 Amplified Controller',
    rear: [G([B.one('Power', 'POWERCON32_IN', 'in')]), G([B.list(['AES In 1/2', 'AES In 3/4'], 'XLR3F', 'in'), B.list(['Milan/AVB 1', 'Milan/AVB 2'], 'ETHERCON', 'io', { gap: 6 }), B.nl4(4, 'Out ', { c: 'SPEAKON8', gap: 8 })], 'right')],
    src: ds('L-Acoustics LA7.16: 2 HE, 16 Kanäle, 4 SpeakON NL8'), notes: '16-Kanal-Endstufe mit DSP, Milan-AVB.' }),
  mk({ id: 'la-p1', name: 'P1', man: 'L-Acoustics', cat: DSP, u: 1, depth: 300, color: '#1c1d1f', logo: 'L-ACOUSTICS', model: 'P1 Processor',
    rear: [G([IEC]), G([B.xin(4, 'Analog In '), B.list(['AES In 1/2', 'AES In 3/4'], 'XLR3F', 'in', { gap: 5 }), B.list(['AES Out 1/2', 'AES Out 3/4'], 'AES-XLR', 'out', { gap: 5 }), B.list(['Milan/AVB 1', 'Milan/AVB 2'], 'ETHERCON', 'io', { gap: 6 })], 'right')],
    src: ds('L-Acoustics P1: 1 HE, analog/AES/Milan'), notes: 'System-Prozessor und Messplattform (M1).' }),
];

export const COMPLETE_DEVICES: DeviceTemplate[] = [...shure, ...sennheiser, ...others, ...pro];
