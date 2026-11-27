import type { ArtElement, DeviceTemplate, ModuleBay, Port } from '../model/types';
import { A, B, G, mk, type Spec } from './proLayout';

/*
 * Fourth completion pass: Allen & Heath DX32 (with card ports) and AR84, Meyer Sound GALAXY 816, Barco Event Master
 * S3-4K, ETC Net3/Response gateways, Green-GO Bridge X and SW81, Ross Ultrix FR1, Luminex GigaCore 16i. Heights and
 * widths were checked against manufacturer or dealer data, see `source` of each template.
 */

const STAGE = 'Stagebox', DSP = 'Signalprozessor', VID = 'Video', DMX = 'Licht / DMX', IC = 'Intercom', NET = 'Netzwerk';
const ds = (what: string) => `Datenblatt – ${what}; Anschlüsse laut Herstellerangaben, Positionen geschätzt (±10 mm)`;
const est = (what: string) => `Schätzung – ${what}; vor dem Einsatz am Gerät prüfen`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const PSU2 = B.list(['Power A', 'Power B'], 'IEC_C14', 'in');

/** connectors of a card in a grid (cols across, rows from ys), centred in a bay of width w; relative to the bay */
function gridPorts(names: string[], connector: string, dir: Port['dir'], w: number, cols: number, colPitch: number, ys: number[]): Port[] {
  return names.map((name, i) => ({
    id: `p${i + 1}`, name, connector, side: 'front' as const, dir,
    x: Math.round((w / 2 + ((i % cols) - (cols - 1) / 2) * colPitch) * 10) / 10, y: ys[Math.floor(i / cols)],
  }));
}

// ================================================================== Allen & Heath DX32 with card ports
const DX_X0 = 40, DX_X1 = 442, DX_Y0 = 8, DX_H = 160, DX_GAP = 3;
const DX_W = Math.round(((DX_X1 - DX_X0 - 3 * DX_GAP) / 4) * 10) / 10;
const DX_ROWS = [30, 64, 98, 132];
const dxCards: ModuleBay['options'] = [
  { id: 'M-DX32-IN', label: 'M-DX32-IN: 8 Mic/Line-Eingänge (XLR)', ports: gridPorts(seq('In ', 8), 'XLR3F', 'in', DX_W, 2, 36, DX_ROWS) },
  { id: 'M-DX32-OUT', label: 'M-DX32-OUT: 8 Line-Ausgänge (XLR)', ports: gridPorts(seq('Out ', 8), 'XLR3M', 'out', DX_W, 2, 36, DX_ROWS) },
  { id: 'M-DX32-INPR-A', label: 'M-DX32-INPR-A (PRIME): 8 Eingänge (XLR)', ports: gridPorts(seq('In ', 8), 'XLR3F', 'in', DX_W, 2, 36, DX_ROWS) },
  { id: 'M-DX32-OUTPR-A', label: 'M-DX32-OUTPR-A (PRIME): 8 Ausgänge (XLR)', ports: gridPorts(seq('Out ', 8), 'XLR3M', 'out', DX_W, 2, 36, DX_ROWS) },
  { id: 'M-DX32-DOUT', label: 'M-DX32-DOUT: 4 AES3-Ausgänge stereo (XLR)', ports: gridPorts(['AES Out 1/2', 'AES Out 3/4', 'AES Out 5/6', 'AES Out 7/8'], 'AES-XLR', 'out', DX_W, 2, 36, DX_ROWS.slice(0, 2)) },
];
const dxBays: ModuleBay[] = Array.from({ length: 4 }, (_, i) => ({
  name: `Kartensteckplatz ${i + 1}`, short: `S${i + 1}`, x: Math.round((DX_X0 + i * (DX_W + DX_GAP)) * 10) / 10, y: DX_Y0, w: DX_W, h: DX_H,
  options: dxCards, default: i < 2 ? 'M-DX32-IN' : 'M-DX32-OUT', style: 'card' as const,
}));
function withCards(s: Spec, bays: ModuleBay[]): DeviceTemplate {
  const fa = typeof s.fa === 'function' ? s.fa : () => (s.fa as ArtElement[] | undefined) ?? [];
  const t = mk({ ...s, fa: (h) => [...bays.map((b) => A.rect(b.x, b.y, b.w, b.h, '#0c0d0f', 0.8)), ...fa(h)] });
  return { ...t, modules: bays };
}

const ah: DeviceTemplate[] = [
  withCards({ id: 'ah-dx32', name: 'DX32', man: 'Allen & Heath', cat: STAGE, u: 4, depth: 290, color: '#202124', weight: 10.5, logo: 'ALLEN & HEATH', model: 'dLive DX32 Expander',
    fa: (h) => [A.leds(452, h / 2 - 10, 3, ['#22c55e', '#22c55e', '#f59e0b'], 0, 6)],
    rear: [G([PSU2]), G([B.list(['DX Link A', 'DX Link B'], 'ETHERCON', 'io')], 'right')],
    src: ds('Allen & Heath DX32 Datenblatt: 4 HE, 433 × 290 × 177 mm, 10,5 kg, 4 Steckplätze für 8-Kanal-Karten'),
    notes: 'Modularer Expander für dLive, Avantis, SQ und AHM: 4 Steckplätze für Ein- oder Ausgangskarten (analog oder AES). Steckplätze im Inspector belegen; die Anschlüsse der Karten sind danach normale Ports.' },
  dxBays),
  mk({ id: 'ah-ar84', name: 'AR84', man: 'Allen & Heath', cat: STAGE, u: 1, depth: 220, color: '#202124', weight: 3, logo: 'ALLEN & HEATH', model: 'AR84 AudioRack',
    front: [G([B.xin(8, 'In '), B.xout(4, 'Out ', { gap: 8 })], 'right')],
    rear: [G([IEC]), G([B.list(['dSNAKE In', 'Link'], 'ETHERCON', 'io')], 'right')],
    src: ds('Allen & Heath AR84: 1 HE, 483 × 220 × 48 mm, 8 Eingänge, 4 Ausgänge; nicht mehr lieferbar'), notes: 'Erweiterung für AR2412 und AB168 über dSNAKE.' }),
];

// ================================================================== processors and video
const proc: DeviceTemplate[] = [
  mk({ id: 'meyer-galaxy816', name: 'GALAXY 816', man: 'Meyer Sound', cat: DSP, u: 2, depth: 410, color: '#202124', weight: 7.6, logo: 'MEYER SOUND', model: 'GALILEO GALAXY 816',
    fa: (h) => [A.lcd(150, h / 2 - 12, 90, 24, '#dbeafe', false), A.leds(260, h / 2 - 12, 8, ['#22c55e'], 6, 0)],
    rear: [G([IEC]), G([B.xin(8, 'In ', { names: seq('In ', 8).map((_, i) => `In ${'ABCDEFGH'[i]}`), ys: [22] }), B.xout(8, 'Out ', { ys: [66], stack: true }), B.xout(8, 'Out ', { start: 9, rows: 2, ys: [22, 66], gap: 8 }), B.list(['AVB 1', 'AVB 2'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.list(['SIM Bus 1', 'SIM Bus 2'], 'GENERIC', 'io', { rows: 2, gap: 4 })], 'right')],
    src: ds('Meyer Sound GALAXY 816: 2 HE, 19" × 3,48" × 16,14", 7,6 kg; 8 XLR-Eingänge (analog/AES/AVB), 16 XLR-Ausgänge, 2 RJ45, 2 SIM-Bus'),
    notes: 'Lautsprecher-Management-Prozessor, AVB/Milan, SIM-Anbindung.' }),
  mk({ id: 'barco-s3-4k', name: 'Event Master S3-4K', man: 'Barco', cat: VID, u: 3, depth: 480, color: '#24262a', weight: 14, logo: 'BARCO', model: 'Event Master S3-4K',
    fa: (h) => [A.lcd(150, h / 2 - 20, 120, 40, '#dbeafe', false), A.knob(300, h / 2, 10)],
    rear: [G([PSU2]), G([B.list(seq('SDI In ', 4), 'BNC-SDI', 'in', { rows: 2 }), B.list(seq('HDMI In ', 4), 'HDMI', 'in', { rows: 2, gap: 8 }), B.list(seq('DP In ', 4), 'DP', 'in', { rows: 2, gap: 8 }), B.list(seq('HDMI Out ', 4), 'HDMI', 'out', { rows: 2, gap: 10 }), B.list(['Multiviewer 1', 'Multiviewer 2'], 'HDMI', 'out', { rows: 2, gap: 8 }), B.list(['Network'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: est('Barco S3-4K: 3 HE laut Barco (13,26 cm); Ein- und Ausgänge je nach Kartenbestückung, hier eine typische Auswahl'),
    notes: 'Bildmischer/Screen-Management der Event-Master-Familie. Kartenbestückung im Geräte-Editor anpassen.' }),
  mk({ id: 'ross-ultrix-fr1', name: 'Ultrix FR1', man: 'Ross Video', cat: VID, u: 1, depth: 400, color: '#2a2c30', weight: 5, logo: 'ROSS', model: 'Ultrix FR1',
    rear: [G([PSU2]), G([B.list(seq('In ', 16), 'BNC-SDI', 'in', { rows: 2 }), B.list([...seq('Out ', 16), 'Aux 1', 'Aux 2'], 'BNC-SDI', 'out', { rows: 2, gap: 8 }), B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { rows: 2, gap: 8 })], 'right')],
    src: ds('Ross Ultrix NS-FR1: 1 HE, 16 × 16 + 2 Aux (Händlerangabe)'), notes: 'Kreuzschiene 16 × 16, erweiterbar auf 32 × 32 mit HDIO-Blade.' }),
];

// ================================================================== lighting gateways, intercom, network
const misc: DeviceTemplate[] = [
  mk({ id: 'etc-net3-4port', name: 'Net3 4-Port Gateway', man: 'ETC', cat: DMX, u: 1, slots: 2, bodyW: 213, depth: 150, color: '#26282c', weight: 1.2, logo: 'ETC', model: 'Net3 4-Port Gateway',
    front: [G([B.dmx(4, 'DMX ')], 'right')], rear: [G([B.one('DC In', 'DC', 'in')]), G([B.one('Ethernet (PoE)', 'RJ45', 'io')], 'right')],
    src: ds('ETC Net3 4-Port Gateway: 1 HE, halbe 19"-Breite; jeder Anschluss als DMX-Ein- oder Ausgang wählbar, hier 4 Ausgänge'), notes: 'DMX über Ethernet (sACN, Net3), Versorgung über PoE oder Netzteil.' }),
  mk({ id: 'etc-response-4port', name: 'Response 4-Port Gateway', man: 'ETC', cat: DMX, u: 1, slots: 2, bodyW: 213, depth: 140, color: '#26282c', weight: 1, logo: 'ETC', model: 'Response 4-Port Gateway',
    front: [G([B.dmx(4, 'DMX ')], 'right')], rear: [G([B.one('Ethernet (PoE)', 'RJ45', 'io')], 'right')],
    src: ds('ETC Response 4-Port Gateway: 1 HE, halbe 19"-Breite, feste Ausstattung'), notes: 'Günstigeres Gateway ohne Wechselmodule, PoE-versorgt.' }),
  mk({ id: 'greengo-bridgex', name: 'Bridge X', man: 'Green-GO', cat: IC, u: 1, depth: 200, color: '#1f2a24', weight: 2, logo: 'GREEN-GO', model: 'Bridge X',
    fa: [A.lcd(140, 9, 70, 26, '#dcfce7', false)],
    rear: [G([IEC]), G([B.list(seq('Interface ', 4), 'RJ45', 'io'), B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: est('Green-GO Bridge X: 1 HE laut Händler, 4 Schnittstellen-Streams'), notes: 'Netzwerkbrücke für Green-GO-Intercom, verbindet Netze und Schnittstellen.' }),
  mk({ id: 'greengo-sw81', name: 'SW81', man: 'Green-GO', cat: NET, u: 1, depth: 200, color: '#1f2a24', weight: 2, logo: 'GREEN-GO', model: 'SW81 PoE Switch',
    rear: [G([IEC]), G([B.list([...seq('Port ', 8).map((n) => `${n} (PoE)`), 'Port 9'], 'RJ45', 'io')], 'right')],
    src: ds('Green-GO SW81: 1 HE, 8 PoE-Ports + 1 ohne PoE'), notes: 'Switch für Green-GO-Sprechstellen.' }),
  mk({ id: 'lmx-gc16i', name: 'GigaCore 16i', man: 'Luminex', cat: NET, u: 1, slots: 2, bodyW: 213, depth: 296, color: '#1d1e20', weight: 2.4, logo: 'LUMINEX', model: 'GigaCore 16i',
    rear: [G([B.one('Power', 'IEC_C14', 'in')]), G([B.one('Serial (USB-C)', 'USB-C', 'io'), B.rj(12, 'Port ', { rows: 2, gap: 4 }), B.sfp(4, 'SFP+ ', { rows: 2, gap: 4 })], 'right')],
    src: ds('Luminex GigaCore 16i Produktseite: halbe 19"-Breite, 220 × 296,4 × 43,2 mm, 2,4 kg; 12 × RJ45, 4 × SFP+, USB-C, IEC C14'), notes: '10-Gigabit-Switch für Installationen.' }),
];

// ================================================================== Biamp Tesira SERVER-IO (rear card slots with ports)
const TS = { x0: 110, x1: 466, y0: 10, y1: 122, cols: 6, rows: 2, gap: 4 };
const TS_W = Math.round(((TS.x1 - TS.x0 - TS.gap * (TS.cols - 1)) / TS.cols) * 10) / 10;
const TS_H = Math.round(((TS.y1 - TS.y0 - TS.gap * (TS.rows - 1)) / TS.rows) * 10) / 10;
const tsPorts = (pre: string, dir: Port['dir']) => gridPorts(seq(pre, 4), 'PHOENIX3', dir, TS_W, 2, 22, [TS_H * 0.42, TS_H * 0.78]).map((p) => ({ ...p, side: 'rear' as const }));
const tesiraCards: ModuleBay['options'] = [
  { id: 'SIC-4', label: 'SIC-4: 4 Mic/Line-Eingänge', ports: tsPorts('In ', 'in') },
  { id: 'SOC-4', label: 'SOC-4: 4 Line-Ausgänge', ports: tsPorts('Out ', 'out') },
  { id: 'AEC-4', label: 'AEC-4: 4 Eingänge mit Echokompensation', ports: tsPorts('In ', 'in') },
];
const tesiraBays: ModuleBay[] = Array.from({ length: TS.cols * TS.rows }, (_, i) => ({
  name: `Kartensteckplatz ${i + 1}`, short: `C${i + 1}`, side: 'rear' as const, style: 'card' as const,
  x: Math.round((TS.x0 + (i % TS.cols) * (TS_W + TS.gap)) * 10) / 10, y: Math.round((TS.y0 + Math.floor(i / TS.cols) * (TS_H + TS.gap)) * 10) / 10,
  w: TS_W, h: TS_H, options: tesiraCards, default: i < 6 ? 'SIC-4' : 'SOC-4',
}));
const tesira: DeviceTemplate = (() => {
  const t = mk({ id: 'biamp-tesira-server-io', name: 'Tesira SERVER-IO', man: 'Biamp', cat: DSP, u: 3, depth: 400, color: '#232528', weight: 10, logo: 'BIAMP', model: 'TesiraSERVER-IO',
    fa: (h) => [A.lcd(150, h / 2 - 15, 100, 30, '#dbeafe', false), A.leds(270, h / 2 - 6, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 6, 0)],
    ra: tesiraBays.map((b) => A.rect(b.x, b.y, b.w, b.h, '#0c0d0f', 0.8)),
    rear: [G([PSU2, B.list(['Network', 'Control'], 'RJ45', 'io', { gap: 8, ys: [40] })], 'left', { x1: 105 })],
    src: est('Biamp Tesira SERVER-IO: 3 HE laut Datenblatt (133 mm); 12 Kartensteckplätze hinten angenommen'),
    notes: 'Konfigurierbarer DSP-Rahmen mit Ein-/Ausgangskarten (je 4 Kanäle). Steckplätze im Inspector belegen; die Anschlüsse der Karten sind danach normale Ports.' });
  return { ...t, modules: tesiraBays };
})();

export const COMPLETE4_DEVICES: DeviceTemplate[] = [...ah, ...proc, tesira, ...misc];
