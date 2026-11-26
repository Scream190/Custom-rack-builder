import type { ArtElement, DeviceTemplate } from '../model/types';
import { A, B, G, mk, type Blk } from './proLayout';
import { PRO_DEVICES } from './devicesPro';
import { RFSCAN_DEVICES } from './devicesRfScan';
import { BRANDED_DEVICES } from './devicesBranded';

/*
 * Second completion pass over the other brands: legacy and current wireless, antenna distribution, mixing engines and
 * stage racks, intercom frames, converters, amps and lighting processors. Accuracy per template in `source`:
 *  - "abgeleitet": same housing as an existing template (named), connectors taken over
 *  - "Datenblatt": height/depth and connector set from the manufacturer's data, positions estimated
 *  - "Schätzung": after product photos and manuals, check on the unit before use
 */

const RX = 'UHF Empfänger', IEM = 'IEM Sender', DIST = 'Antennenverteiler', COMB = 'Antennen-Combiner', MIX = 'Mischpult (Rack)';
const STAGE = 'Stagebox', IC = 'Intercom', AMP = 'Endstufen', DSP = 'Signalprozessor', CONV = 'Audio-Interface / Wandler', DMX = 'Licht / DMX';
const STU = 'Studio-Interfaces', NET = 'Netzwerk';
const UHF_FIELDS = ['Frequenz', 'Kanal / Name', 'Gruppe'];
const ds = (what: string) => `Datenblatt – ${what}; Anschlüsse laut Herstellerangaben, Positionen geschätzt (±10 mm)`;
const est = (what: string) => `Schätzung – ${what}; vor dem Einsatz am Gerät prüfen`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const ab = (n: number, pre = 'Out ') => [...seq(`${pre}A`, n), ...seq(`${pre}B`, n)];
const bnc = (names: string[], dir: Blk['dir'], o: Partial<Blk> = {}): Blk => B.list(names, 'BNC', dir, o);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const DCIN = B.one('DC In', 'DC', 'in');
const PCON = B.one('Power In', 'POWERCON_IN', 'in');

/** copy of an existing template under a new id/name; texts on the panels are renamed too */
function like(baseId: string, id: string, name: string, source: string, o: Partial<DeviceTemplate> = {}, rename: [string, string][] = []): DeviceTemplate {
  const base = [...PRO_DEVICES, ...RFSCAN_DEVICES, ...BRANDED_DEVICES].find((t) => t.id === baseId);
  if (!base) throw new Error(`template ${baseId} missing`);
  const pairs: [string, string][] = [[base.name, name], ...rename];
  const fix = (items?: ArtElement[]) => items?.map((e) => (e.t === 'text' ? { ...e, text: pairs.reduce((s, [a, b]) => s.split(a).join(b), e.text) } : e));
  return { ...base, id, name, source, ...o, art: base.art ? { front: fix(base.art.front), rear: fix(base.art.rear) } : undefined };
}

const rxHalf = (H: number): ArtElement[] => [A.lcd(70, 9, 70, H - 18, '#e5f3ff', true), A.btn(150, 10, 12, 6, 'MENU'), A.btn(150, 24, 12, 6, 'SEL'), A.knob(185, H / 2, 6), A.sw(205, H / 2 - 7)];
const distFront = (H: number): ArtElement[] => [A.leds(150, 12, 4, ['#22c55e'], 8, 0), A.lcd(200, 9, 60, H - 18, '#e5f3ff', false), A.sw(440, H / 2 - 7)];
/** mixing engine / stage rack front: rows of preamp inputs plus a status strip */
const rackStatus = (x = 30) => (H: number): ArtElement[] => [A.leds(x, H - 10, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 5, 0)];

// ================================================================== wireless
const wireless: DeviceTemplate[] = [
  like('senn-em100g4', 'senn-em100g3', 'EM 100 G3', 'abgeleitet – gleiches Gehäuse und Anschlüsse wie EM 100 G4', { notes: 'evolution wireless G3, Vorgänger des EM 100 G4.' }, [['G4', 'G3']]),
  like('senn-em300g4', 'senn-em300g3', 'EM 300-500 G3', 'abgeleitet – gleiches Gehäuse und Anschlüsse wie EM 300-500 G4', { notes: 'evolution wireless G3 Serie 300/500.' }, [['G4', 'G3']]),
  like('senn-sriemg4', 'senn-sr300iemg3', 'SR 300 IEM G3', 'abgeleitet – gleiches Gehäuse und Anschlüsse wie SR IEM G4', { notes: 'In-Ear-Sender der Serie evolution wireless G3.' }, [['G4', 'G3']]),
  mk({ id: 'senn-em3731', name: 'EM 3731-II', man: 'Sennheiser', cat: RX, u: 1, depth: 330, color: '#2b2e33', weight: 4, logo: 'SENNHEISER', model: 'EM 3731-II', fields: UHF_FIELDS,
    front: [G([B.one('Phones', 'JACK', 'out')], 'left', { x0: 400 })], fa: [A.lcd(80, 8, 110, 27.6, '#e5f3ff', true), A.knob(220, 21.8, 6), A.sw(440, 14.8)],
    rear: [G([IEC, B.one('Network', 'RJ45', 'io', { gap: 8 })]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 5 }), bnc(['Ant A In', 'Ant B In'], 'in', { gap: 10 }), bnc(['Ant A Out', 'Ant B Out'], 'out', { gap: 5 })], 'right')],
    src: est('Sennheiser EM 3731-II, Einkanal-Version des EM 3732-II, 1 HE'), notes: 'Einkanal-Empfänger der Serie 3000.' }),
  mk({ id: 'akg-sr4500', name: 'SR4500', man: 'AKG', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#2b2d31', weight: 1.3, logo: 'AKG', model: 'SR4500 (WMS4500)', fields: UHF_FIELDS,
    fa: rxHalf, rear: [G([DCIN]), G([B.xout(1, 'Out '), B.one('Out (Klinke)', 'JACK', 'out', { gap: 4 }), bnc(['Ant B', 'Ant A'], 'in', { gap: 6 })], 'right')],
    src: est('AKG SR4500, halbe Breite'), notes: 'Empfänger WMS4500, externes Netzteil.' }),
  mk({ id: 'akg-dsr700', name: 'DSR700 V2', man: 'AKG', cat: RX, u: 1, slots: 2, bodyW: 213, depth: 230, color: '#2b2d31', weight: 1.6, logo: 'AKG', model: 'DSR700 V2 (DMS700)', fields: UHF_FIELDS,
    fa: rxHalf, rear: [G([DCIN, B.one('Network', 'RJ45', 'io', { gap: 5 })]), G([B.xout(1, 'Out '), B.one('AES Out', 'AES-XLR', 'out', { gap: 4 }), bnc(['Ant B', 'Ant A'], 'in', { gap: 6 })], 'right')],
    src: est('AKG DSR700 V2, halbe Breite'), notes: 'Digitaler Empfänger DMS700.' }),
  mk({ id: 'wisy-mtk982', name: 'MTK982', man: 'Wisycom', cat: IEM, u: 1, depth: 260, color: '#2a2c30', weight: 3, logo: 'WISYCOM', model: 'MTK982 Dual IEM Transmitter', fields: UHF_FIELDS,
    fa: [A.lcd(80, 8, 70, 27.6, '#e5f3ff', true), A.lcd(170, 8, 70, 27.6, '#e5f3ff', true), A.knob(270, 21.8, 6), A.sw(440, 14.8)],
    rear: [G([IEC, B.one('Network', 'RJ45', 'io', { gap: 8 })]), G([B.list(['In 1 L', 'In 1 R', 'In 2 L', 'In 2 R'], 'COMBO', 'in'), bnc(['RF Out 1', 'RF Out 2'], 'out', { gap: 10 })], 'right')],
    src: est('Wisycom MTK982, 1 HE'), notes: 'Zweikanal-In-Ear-Sender, Breitband.' }),
  mk({ id: 'rfv-distro4', name: 'DISTRO4 HDR', man: 'RF Venue', cat: DIST, u: 1, depth: 200, color: '#1f2124', weight: 2.3, logo: 'RF VENUE', model: 'DISTRO4 HDR', fa: distFront,
    rear: [G([IEC, B.list(seq('DC Out ', 4), 'DC', 'out', { gap: 6 })]), G([bnc(ab(4), 'out', { rows: 2, order: 'col' }), bnc(['Cascade A', 'Cascade B'], 'out', { rows: 2, gap: 8 }), bnc(['Ant A In', 'Ant B In'], 'in', { rows: 2, gap: 8 })], 'right')],
    src: est('RF Venue DISTRO4 HDR, 470–700 MHz, 1 HE'), notes: 'Antennenverteiler 1:4 (A/B) für Empfänger verschiedener Hersteller, mit DC-Versorgung.' }),
  ...([['rfv-combine4', 'COMBINE4', 4], ['rfv-combine8', 'COMBINE8', 8]] as const).map(([id, name, n]) => mk({
    id, name, man: 'RF Venue', cat: COMB, u: 1, depth: 200, color: '#1f2124', weight: n === 8 ? 2.6 : 2, logo: 'RF VENUE', model: `${name} IEM Combiner`,
    front: [G([bnc(['Antenna Out'], 'out')], 'left', { x0: 60 })], fa: [A.leds(200, 14, n, ['#22c55e'], 6, 0), A.sw(440, 14.8)],
    rear: [G([IEC]), G([bnc(seq('RF In ', n), 'in')], 'right')],
    src: est(`RF Venue ${name}, 1 HE`), notes: `Aktiver Combiner ${n}:1 für IEM-Sender verschiedener Hersteller.` })),
];

// ================================================================== mixing engines and stage racks
/** dLive MixRack front: input rows from the top, output rows from the bottom */
const ahIO = (u: number, ins: number, outs: number) => {
  const H = u * 44.45 - 0.8, ri = Math.ceil(ins / 16), ro = Math.ceil(outs / 16);
  return [
    G([B.xin(ins, 'In ', { rows: ri, ys: Array.from({ length: ri }, (_, i) => 25 + i * 36) })], 'right'),
    G([B.xout(outs, 'Out ', { rows: ro, ys: Array.from({ length: ro }, (_, i) => H - 25 - (ro - 1 - i) * 36) })], 'right'),
  ];
};
const mixing: DeviceTemplate[] = [
  mk({ id: 'ah-cdm32', name: 'dLive CDM32', man: 'Allen & Heath', cat: MIX, u: 5, depth: 309, color: '#202124', weight: 12.5, logo: 'ALLEN & HEATH', model: 'dLive CDM32 MixRack',
    front: ahIO(5, 32, 16), fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['GigaACE', 'DX 1/2', 'DX 3/4', 'Network'], 'ETHERCON', 'io'), B.list(['I/O Port 1', 'I/O Port 2'], 'GENERIC', 'io', { gap: 8 })], 'right')],
    src: ds('Allen & Heath CDM32 Datenblatt: 5 HE, 221 × 481,6 × 309 mm, 32 Eingänge, 16 Ausgänge'), notes: 'dLive C-Class MixRack, 32 Mic-Eingänge, 16 Ausgänge, 2 I/O-Ports.' }),
  mk({ id: 'ah-cdm48', name: 'dLive CDM48', man: 'Allen & Heath', cat: MIX, u: 7, depth: 309, color: '#202124', weight: 16, logo: 'ALLEN & HEATH', model: 'dLive CDM48 MixRack',
    front: ahIO(7, 48, 24), fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['GigaACE', 'DX 1/2', 'DX 3/4', 'Network'], 'ETHERCON', 'io'), B.list(['I/O Port 1', 'I/O Port 2', 'I/O Port 3'], 'GENERIC', 'io', { gap: 8 })], 'right')],
    src: ds('Allen & Heath CDM48 Datenblatt: 7 HE, 310 mm hoch, 48 Eingänge, 24 Ausgänge'), notes: 'dLive C-Class MixRack, 48 Mic-Eingänge.' }),
  mk({ id: 'ah-cdm64', name: 'dLive CDM64', man: 'Allen & Heath', cat: MIX, u: 8, depth: 309, color: '#202124', weight: 18, logo: 'ALLEN & HEATH', model: 'dLive CDM64 MixRack',
    front: ahIO(8, 64, 32), fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['GigaACE', 'DX 1/2', 'DX 3/4', 'Network'], 'ETHERCON', 'io'), B.list(['I/O Port 1', 'I/O Port 2', 'I/O Port 3'], 'GENERIC', 'io', { gap: 8 })], 'right')],
    src: ds('Allen & Heath CDM64 Datenblatt: 8 HE, 354,5 mm hoch, 64 Eingänge, 32 Ausgänge'), notes: 'dLive C-Class MixRack, 64 Mic-Eingänge.' }),
  mk({ id: 'ah-dm0', name: 'dLive DM0', man: 'Allen & Heath', cat: MIX, u: 4, depth: 350, color: '#202124', weight: 10, logo: 'ALLEN & HEATH', model: 'dLive DM0 MixRack', fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['GigaACE', 'DX 1/2', 'DX 3/4', 'Network'], 'ETHERCON', 'io'), B.list(seq('I/O Port ', 5), 'GENERIC', 'io', { gap: 8 })], 'right')],
    src: est('Allen & Heath DM0, 4 HE laut Hersteller, ohne lokale Ein- und Ausgänge'), notes: 'dLive S-Class Engine ohne lokales I/O, 5 I/O-Ports.' }),
  ...([['ah-dm32', 'dLive DM32', 6, 32, 16], ['ah-dm48', 'dLive DM48', 8, 48, 24], ['ah-dm64', 'dLive DM64', 10, 64, 32]] as const).map(([id, name, u, ins, outs]) => mk({
    id, name, man: 'Allen & Heath', cat: MIX, u, depth: 350, color: '#202124', weight: 10 + u * 1.5, logo: 'ALLEN & HEATH', model: `${name} MixRack`,
    front: ahIO(u, ins, outs), fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['GigaACE', 'DX 1/2', 'DX 3/4', 'Network'], 'ETHERCON', 'io'), B.list(seq('I/O Port ', 5), 'GENERIC', 'io', { gap: 8 })], 'right')],
    src: est(`Allen & Heath ${name}, Bauhöhe ${u} HE geschätzt`), notes: `dLive S-Class MixRack, ${ins} Mic-Eingänge, ${outs} Ausgänge, 5 I/O-Ports.` })),
  mk({ id: 'beh-wing-rack', name: 'WING RACK', man: 'Behringer', cat: MIX, u: 4, depth: 326, color: '#26282c', weight: 9.4, logo: 'BEHRINGER', model: 'WING RACK',
    front: [G([B.combo(24, 'In ', { rows: 2 })], 'right')], fa: [A.lcd(30, 20, 100, 60, '#dbeafe', false), A.knob(150, 40, 7), A.knob(150, 70, 7)],
    rear: [G([IEC]), G([B.xout(8, 'Out '), B.list(['AES50 A', 'AES50 B', 'StageConnect'], 'ETHERCON', 'io', { gap: 8 }), B.one('Network', 'RJ45', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 5 })], 'right')],
    src: ds('Behringer WING RACK: 4 HE, 486 × 183 × 326 mm, 9,4 kg (Thomann/Behringer)'), notes: '48-Kanal-Mischpult im Rack, 24 Midas-PRO-Vorverstärker, 8 Ausgänge.' }),
  mk({ id: 'digico-sd-rack', name: 'SD-Rack', man: 'DiGiCo', cat: STAGE, u: 10, depth: 410, color: '#2a2b2f', weight: 30, logo: 'DiGiCo', model: 'SD-Rack',
    front: [G([B.xin(56, 'In ', { rows: 7 })], 'right'), G([B.xout(24, 'Out ', { rows: 3, ys: [370, 395, 420] })], 'left')], fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['MADI A In', 'MADI A Out', 'MADI B In', 'MADI B Out'], 'MADI-BNC', 'io'), B.list(['Optocore A', 'Optocore B'], 'OPTICALCON', 'io', { gap: 8 })], 'right')],
    src: est('DiGiCo SD-Rack, 14 Steckplätze (bis 56 in / 56 out), Bauhöhe 10 HE nach DiGiCo-Broschüre'), notes: 'Stagerack mit 14 Kartensteckplätzen, hier bestückt mit 56 Eingängen und 24 Ausgängen.' }),
  mk({ id: 'digico-sd-nano', name: 'SD-Nano Rack', man: 'DiGiCo', cat: STAGE, u: 2, depth: 300, color: '#2a2b2f', weight: 6, logo: 'DiGiCo', model: 'SD-NANO Rack',
    front: [G([B.xin(16, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 10 })], 'right')],
    rear: [G([IEC]), G([B.list(['Optocore A', 'Optocore B'], 'OPTICALCON', 'io')], 'right')],
    src: est('DiGiCo SD-NANO Rack, 2 HE laut Hersteller, nur optisch angebunden'), notes: 'Kleines Stagerack mit Glasfaser-Anschluss.' }),
  mk({ id: 'avid-stage64', name: 'VENUE Stage 64', man: 'Avid', cat: STAGE, u: 10, depth: 560, color: '#232427', weight: 32, logo: 'AVID', model: 'VENUE | Stage 64',
    front: [G([B.xin(64, 'In ', { rows: 8 })], 'right'), G([B.xout(24, 'Out ', { rows: 3, ys: [370, 395, 420] })], 'left')], fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['AVB A', 'AVB B'], 'ETHERCON', 'io'), B.list(['Fiber A', 'Fiber B'], 'OPTICALCON', 'io', { gap: 8 })], 'right')],
    src: est('Avid VENUE Stage 64, 10 HE'), notes: 'Stagerack für VENUE S6L, bis 64 Eingänge, modulare Ausgangskarten.' }),
  mk({ id: 'avid-stage48', name: 'VENUE Stage 48', man: 'Avid', cat: STAGE, u: 8, depth: 568, color: '#232427', weight: 25, logo: 'AVID', model: 'VENUE | Stage 48',
    front: [G([B.xin(48, 'In ', { rows: 6 })], 'right'), G([B.xout(16, 'Out ', { rows: 2, ys: [300, 325] })], 'left')], fa: rackStatus(),
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(['AVB A', 'AVB B'], 'ETHERCON', 'io'), B.list(['AES In', 'AES Out'], 'XLR3F', 'io', { gap: 8 })], 'right')],
    src: ds('Avid Stage 48: 8 HE, 355 × 430 × 568 mm'), notes: 'Kompaktes Stagerack für VENUE S6L, 48 Eingänge, 16 Ausgänge.' }),
  mk({ id: 'avid-stage16', name: 'VENUE Stage 16', man: 'Avid', cat: STAGE, u: 4, depth: 300, color: '#232427', weight: 8, logo: 'AVID', model: 'VENUE | Stage 16',
    front: [G([B.xin(16, 'In ', { rows: 2 }), B.xout(8, 'Out ', { rows: 2, gap: 10 })], 'right')],
    rear: [G([IEC]), G([B.list(['AVB A', 'AVB B'], 'ETHERCON', 'io'), B.list(['AES In', 'AES Out'], 'XLR3F', 'io', { gap: 8 })], 'right')],
    src: est('Avid VENUE Stage 16, 4 HE'), notes: 'Stagebox für VENUE, 16 Eingänge, 8 Ausgänge.' }),
];

// ================================================================== intercom
const intercom: DeviceTemplate[] = [
  mk({ id: 'riedel-artist1024', name: 'Artist-1024', man: 'Riedel', cat: IC, u: 2, depth: 400, color: '#2a2c30', weight: 10, logo: 'RIEDEL', model: 'ARTIST-1024',
    fa: (H) => [A.lcd(120, H / 2 - 12, 80, 24, '#dbeafe', false), A.leds(220, H / 2 - 6, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(seq('UIC ', 10), 'RJ45', 'io', { rows: 2 }), B.list(['Fiber A', 'Fiber B'], 'LC', 'io', { gap: 8 })], 'right')],
    src: ds('Riedel Artist-1024: 2 HE, bis 10 UIC-128-II-Karten (1024 Ports)'), notes: 'Intercom-Knoten der Artist-Familie, Karten und Anschlüsse je nach Bestückung.' }),
  mk({ id: 'riedel-artist32', name: 'Artist 32', man: 'Riedel', cat: IC, u: 2, depth: 380, color: '#2a2c30', weight: 8, logo: 'RIEDEL', model: 'ARTIST 32',
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(seq('Port ', 8), 'RJ45', 'io', { rows: 2 }), B.list(['Fiber A', 'Fiber B'], 'LC', 'io', { gap: 8 })], 'right')],
    src: est('Riedel Artist 32, 2 HE'), notes: 'Kleiner Artist-Frame, Ports je nach Karten.' }),
  mk({ id: 'cc-hx-median', name: 'Eclipse HX-Median', man: 'Clear-Com', cat: IC, u: 6, depth: 400, color: '#25272a', weight: 15, logo: 'CLEAR-COM', model: 'Eclipse HX-Median',
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(seq('Port ', 32), 'RJ45', 'io', { rows: 4 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: ds('Clear-Com Eclipse HX-Median: 6 HE, 7 Kartensteckplätze, 8 Modulsteckplätze'), notes: 'Digitale Intercom-Matrix, Ports je nach Karten.' }),
  mk({ id: 'cc-hx-delta', name: 'Eclipse HX-Delta', man: 'Clear-Com', cat: IC, u: 3, depth: 400, color: '#25272a', weight: 9, logo: 'CLEAR-COM', model: 'Eclipse HX-Delta',
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(seq('Port ', 16), 'RJ45', 'io', { rows: 2 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: ds('Clear-Com Eclipse HX-Delta: 3 HE'), notes: 'Kompakte digitale Intercom-Matrix.' }),
];

// ================================================================== amps and processors
const amps: DeviceTemplate[] = [
  mk({ id: 'la-la8', name: 'LA8', man: 'L-Acoustics', cat: AMP, u: 2, depth: 450, color: '#1c1d1f', weight: 12, logo: 'L-ACOUSTICS', model: 'LA8 Amplified Controller',
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.xin(4, 'Analog/AES In '), B.one('Network', 'ETHERCON', 'io', { gap: 6 }), B.nl4(1, 'Out ', { c: 'SPEAKON8', gap: 8, names: ['Out 1–4 (NL8)'] }), B.nl4(4, 'Out ', { gap: 4 })], 'right')],
    src: ds('L-Acoustics LA8: 2 HE, 4 Kanäle, NL8 + 4 × NL4'), notes: '4-Kanal-Endstufe mit DSP, Vorgänger des LA12X.' }),
  mk({ id: 'db-d90', name: 'D90', man: 'd&b audiotechnik', cat: AMP, u: 2, depth: 460, color: '#2a2b2e', weight: 13, logo: 'd&b', model: 'D90 Amplifier',
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.xin(4, 'Analog In '), B.list(['AES In 1/2', 'AES In 3/4'], 'XLR3F', 'in', { gap: 4 }), B.list(['Milan/AVB 1', 'Milan/AVB 2'], 'ETHERCON', 'io', { gap: 6 }), B.nl4(4, 'Out ', { gap: 6 })], 'right')],
    src: ds('d&b D90: 2 HE, 4 Kanäle, Milan'), notes: 'Leistungsstärkste d&b-Endstufe, 4 Kanäle.' }),
  mk({ id: 'db-5d', name: '5D', man: 'd&b audiotechnik', cat: AMP, u: 1, depth: 330, color: '#2a2b2e', weight: 5.5, logo: 'd&b', model: '5D Installation Amplifier',
    rear: [G([IEC]), G([B.list(seq('In ', 4), 'PHOENIX3', 'in'), B.list(['Dante 1', 'Dante 2'], 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 4), 'PHOENIX-SPK', 'out', { gap: 6 })], 'right')],
    src: ds('d&b 5D: 1 HE, 4 Kanäle'), notes: 'Installationsendstufe, Euroblock-Ausgänge.' }),
  mk({ id: 'ps-ottocanali12k4', name: 'Ottocanali 12K4 DSP+D', man: 'Powersoft', cat: AMP, u: 1, depth: 420, color: '#1f2022', weight: 8.5, logo: 'POWERSOFT', model: 'Ottocanali 12K4 DSP+D',
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in'), B.list(['Dante 1', 'Dante 2'], 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 8), 'PHOENIX-SPK', 'out', { gap: 6 })], 'right')],
    src: ds('Powersoft Ottocanali 12K4: 1 HE, 8 Kanäle'), notes: '8-Kanal-Installationsendstufe mit DSP und Dante.' }),
  mk({ id: 'ps-t904', name: 'T904', man: 'Powersoft', cat: AMP, u: 2, depth: 450, color: '#1f2022', weight: 12, logo: 'POWERSOFT', model: 'T904',
    rear: [G([PCON]), G([B.xin(4, 'In '), B.xout(4, 'Link ', { gap: 4 }), B.list(['Network 1', 'Network 2'], 'ETHERCON', 'io', { gap: 6 }), B.nl4(4, 'Out ', { gap: 6 })], 'right')],
    src: ds('Powersoft T904: 2 HE, 4 Kanäle'), notes: '4-Kanal-Tourendstufe mit DSP.' }),
  mk({ id: 'yam-xmv4280', name: 'XMV4280', man: 'Yamaha', cat: AMP, u: 2, depth: 400, color: '#232528', weight: 9, logo: 'YAMAHA', model: 'XMV4280',
    rear: [G([IEC]), G([B.list(seq('In ', 4), 'PHOENIX3', 'in'), B.list(['YDIF In', 'YDIF Out'], 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 4), 'PHOENIX-SPK', 'out', { gap: 6 })], 'right')],
    src: ds('Yamaha XMV4280: 2 HE, 4 × 280 W'), notes: 'Installationsendstufe mit YDIF.' }),
  mk({ id: 'yam-pc412d', name: 'PC412-D', man: 'Yamaha', cat: AMP, u: 2, depth: 450, color: '#232528', weight: 12, logo: 'YAMAHA', model: 'PC412-D',
    rear: [G([PCON]), G([B.xin(4, 'In '), B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { gap: 6 }), B.nl4(4, 'Out ', { gap: 6 })], 'right')],
    src: ds('Yamaha PC412-D: 2 HE, 4 Kanäle, Dante'), notes: '4-Kanal-Endstufe mit DSP und Dante.' }),
  mk({ id: 'bss-blu806da', name: 'BLU-806DA', man: 'BSS', cat: DSP, u: 1, depth: 300, color: '#26282c', weight: 4, logo: 'BSS', model: 'BLU-806DA',
    rear: [G([IEC]), G([B.list(['BLU link In', 'BLU link Out'], 'RJ45', 'io'), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 }), B.one('Control', 'RJ45', 'io', { gap: 6 })], 'right')],
    src: ds('BSS BLU-806DA: 1 HE, Dante und BLU link'), notes: 'Soundweb-London-Prozessor mit Kartensteckplätzen.' }),
];

// ================================================================== converters
const rmeRear = (front: Blk[]) => [G([IEC]), G(front, 'right')];
const converters: DeviceTemplate[] = [
  mk({ id: 'rme-m32dapro', name: 'M-32 DA Pro II', man: 'RME', cat: CONV, u: 1, depth: 260, color: '#2a2c30', logo: 'RME',
    rear: rmeRear([{ c: 'DSUB25', names: ['Out 1–8', 'Out 9–16', 'Out 17–24', 'Out 25–32'], dir: 'out', pitch: 55 }, B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 5 }), B.list(['AVB 1', 'AVB 2'], 'RJ45', 'io', { gap: 5 })]),
    src: ds('RME M-32 DA Pro II: 1 HE, 32 analoge Ausgänge (D-Sub 25), MADI, AVB'), notes: '32-Kanal-D/A-Wandler.' }),
  ...([['rme-m16ad', 'M-16 AD', 'In', 'out'], ['rme-m16da', 'M-16 DA', 'Out', 'in']] as const).map(([id, name, io]) => mk({
    id, name, man: 'RME', cat: CONV, u: 1, depth: 240, color: '#2a2c30', logo: 'RME',
    rear: rmeRear([{ c: 'DSUB25', names: [`${io} 1–8`, `${io} 9–16`], dir: io === 'In' ? 'in' : 'out', pitch: 55 }, B.list(['ADAT 1', 'ADAT 2'], 'TOSLINK', 'io', { gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 5 })]),
    src: est(`RME ${name}, 1 HE`), notes: `16-Kanal-${io === 'In' ? 'A/D' : 'D/A'}-Wandler, ADAT und optional MADI.` })),
  mk({ id: 'rme-12mic', name: '12Mic', man: 'RME', cat: CONV, u: 1, depth: 250, color: '#2a2c30', logo: 'RME',
    front: [G([B.combo(4, 'In ')], 'left', { x0: 300 })],
    rear: rmeRear([B.xin(8, 'In ', { start: 5 }), B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 6 }), B.list(['AVB 1', 'AVB 2'], 'RJ45', 'io', { gap: 5 })]),
    src: ds('RME 12Mic: 1 HE, 12 Mikrofonvorverstärker, MADI, AVB'), notes: '12-Kanal-Mikrofonvorverstärker mit Wandler.' }),
  mk({ id: 'rme-ff802fs', name: 'Fireface 802 FS', man: 'RME', cat: STU, u: 1, depth: 250, color: '#2a2c30', logo: 'RME',
    front: [G([B.combo(4, 'Mic In '), B.list(['Phones 1', 'Phones 2'], 'JACK', 'out', { gap: 8 })], 'left', { x0: 210 })],
    rear: rmeRear([B.list(seq('Line In ', 8, 5), 'JACK', 'in', { rows: 2 }), B.list(seq('Out ', 8), 'JACK', 'out', { rows: 2, gap: 5 }), B.list(['ADAT 1', 'ADAT 2'], 'TOSLINK', 'io', { gap: 5 }), B.one('USB', 'USB', 'io', { gap: 4 })]),
    src: est('RME Fireface 802 FS, 1 HE'), notes: 'Audio-Interface, USB 2.0, ADAT, 4 Mic-Eingänge.' }),
  mk({ id: 'rme-adi648', name: 'ADI-648', man: 'RME', cat: CONV, u: 1, depth: 220, color: '#2a2c30', logo: 'RME',
    rear: rmeRear([B.list(seq('ADAT In ', 4), 'TOSLINK', 'in'), B.list(seq('ADAT Out ', 4), 'TOSLINK', 'out', { gap: 5 }), B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 5 })]),
    src: est('RME ADI-648, 1 HE'), notes: 'Formatwandler ADAT ↔ MADI, 64 Kanäle.' }),
  mk({ id: 'focusrite-rednet-a8r', name: 'RedNet A8R', man: 'Focusrite', cat: CONV, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([{ c: 'DSUB25', names: ['In 1–8', 'Out 1–8'], dir: 'io', pitch: 55 }, B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: est('Focusrite RedNet A8R, 1 HE'), notes: '8 × 8 analog auf Dante.' }),
  mk({ id: 'focusrite-rednet-hd32r', name: 'RedNet HD32R', man: 'Focusrite', cat: CONV, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([{ c: 'GENERIC', names: ['DigiLink 1', 'DigiLink 2'], dir: 'io' }, B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: est('Focusrite RedNet HD32R, 1 HE'), notes: '32 Kanäle Pro Tools HD auf Dante.' }),
  mk({ id: 'focusrite-rednet-d64r', name: 'RedNet D64R', man: 'Focusrite', cat: CONV, u: 1, depth: 280, color: '#b3182a', logo: 'FOCUSRITE',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([B.list(['MADI In (BNC)', 'MADI Out (BNC)'], 'MADI-BNC', 'io'), B.list(['MADI Optical'], 'LC', 'io', { gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: est('Focusrite RedNet D64R, 1 HE'), notes: '64 Kanäle MADI ↔ Dante.' }),
  mk({ id: 'directout-exboxmd', name: 'EXBOX.MD', man: 'DirectOut', cat: CONV, u: 1, slots: 2, bodyW: 213, depth: 200, color: '#2f3237', logo: 'DIRECTOUT', model: 'EXBOX.MD',
    rear: [G([DCIN]), G([B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io'), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 5 })], 'right')],
    src: est('DirectOut EXBOX.MD, halbe Breite'), notes: 'Wandler MADI ↔ Dante, 64 Kanäle.' }),
  mk({ id: 'directout-andiamo', name: 'ANDIAMO', man: 'DirectOut', cat: CONV, u: 1, depth: 300, color: '#2f3237', logo: 'DIRECTOUT', model: 'ANDIAMO',
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([{ c: 'DSUB25', names: ['In 1–8', 'In 9–16', 'In 17–24', 'In 25–32', 'Out 1–8', 'Out 9–16', 'Out 17–24', 'Out 25–32'], dir: 'io', rows: 2, pitch: 55 }, B.list(['MADI A In', 'MADI A Out'], 'MADI-BNC', 'io', { rows: 2, gap: 6 })], 'right')],
    src: est('DirectOut ANDIAMO, 1 HE'), notes: '32 × 32 analog ↔ MADI, optional Dante/RAVENNA.' }),
];

// ================================================================== network and lighting
const misc: DeviceTemplate[] = [
  like('ma3-pu-l', 'ma3-pu-m', 'grandMA3 processing unit M', 'abgeleitet – MA: Processing Unit M, L und XL haben gleiche Front und Rückseite; 482 × 372 × 87 mm, 5 kg', { notes: 'grandMA3 Processing Unit M, 2 HE.' }),
  like('ma3-pu-l', 'ma3-pu-xl', 'grandMA3 processing unit XL', 'abgeleitet – MA: Processing Unit M, L und XL haben gleiche Front und Rückseite; 482 × 372 × 87 mm, 5 kg', { notes: 'grandMA3 Processing Unit XL, 2 HE.' }),
  mk({ id: 'ma2-npu', name: 'MA NPU (grandMA2)', man: 'MA Lighting', cat: DMX, u: 3, depth: 332, color: '#141414', weight: 9, logo: 'MA LIGHTING', model: 'Network Processing Unit',
    fa: (H) => [A.lcd(140, H / 2 - 15, 90, 30, '#fde68a', false), A.btn(250, H / 2 - 8, 12, 6), A.btn(250, H / 2 + 2, 12, 6)],
    rear: [G([IEC]), G([B.dmx(4, 'DMX ', { gap: 6 }), B.list(['Ethernet 1', 'Ethernet 2'], 'ETHERCON', 'io', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 5 })], 'right')],
    src: ds('MA NPU Datenblatt: 3 HE, 485 × 126 × 332 mm, 9 kg'), notes: 'Network Processing Unit für grandMA2, erweitert Parameter.' }),
  mk({ id: 'yam-swp2-10mmf', name: 'SWP2-10MMF', man: 'Yamaha', cat: NET, u: 1, depth: 250, color: '#232528', weight: 3, logo: 'YAMAHA', model: 'SWP2-10MMF',
    fa: [A.leds(120, 12, 3, ['#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    rear: [G([IEC]), G([B.ec(8, 'Port '), B.list(['SFP 9', 'SFP 10'], 'OPTICALCON', 'io', { gap: 8 })], 'right')],
    src: est('Yamaha SWP2-10MMF, 1 HE'), notes: 'Netzwerk-Switch für Dante, etherCON und opticalCON.' }),
];

export const COMPLETE2_DEVICES: DeviceTemplate[] = [...wireless, ...mixing, ...intercom, ...amps, ...converters, ...misc];
