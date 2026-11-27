import type { ArtElement, DeviceTemplate, ModuleBay, Port } from '../model/types';
import { A, B, G, mk } from './proLayout';

/*
 * Fifth completion pass, read directly from the manufacturers' spec pages and datasheets: Q-SYS Core 510i, Analog Way
 * Aquilon RS1/RS2/RS3, Lawo A__mic 8 and A__madi 6, Luminex GigaCore 20t, Swisson XND-4R, Blackmagic Videohub 10x10 12G
 * and ATEM Constellation 4K (2 M/E, 4 M/E, 4 M/E Plus). Height, size, weight and the connector set come from the page
 * named in `source`; positions on the panels are estimated.
 */

const DSP = 'Signalprozessor', VID = 'Video', STAGE = 'Stagebox', CONV = 'Audio-Interface / Wandler', NET = 'Netzwerk', DMX = 'Licht / DMX';
const sheet = (what: string) => `Datenblatt – ${what}; Positionen geschätzt (±10 mm)`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const PSU2 = B.list(['Power A', 'Power B'], 'IEC_C14', 'in');

// ================================================================== Q-SYS Core 510i (8 rear card bays with ports)
function gridPorts(names: string[], connector: string, dir: Port['dir'], w: number, cols: number, colPitch: number, ys: number[]): Port[] {
  return names.map((name, i) => ({
    id: `p${i + 1}`, name, connector, side: 'rear' as const, dir,
    x: Math.round((w / 2 + ((i % cols) - (cols - 1) / 2) * colPitch) * 10) / 10, y: ys[Math.floor(i / cols)],
  }));
}
const QC = { x0: 150, x1: 466, y0: 4, y1: 84, cols: 4, rows: 2, gap: 3 };
const QC_W = Math.round(((QC.x1 - QC.x0 - QC.gap * (QC.cols - 1)) / QC.cols) * 10) / 10;
const QC_H = Math.round(((QC.y1 - QC.y0 - QC.gap * (QC.rows - 1)) / QC.rows) * 10) / 10;
const qcards: ModuleBay['options'] = [
  { id: 'CIML4-HP', label: 'CIML4-HP: 4 Mic/Line-Eingänge (Euroblock)', ports: gridPorts(seq('In ', 4), 'PHOENIX3', 'in', QC_W, 4, 17, [QC_H * 0.62]) },
  { id: 'COL4', label: 'COL4: 4 Line-Ausgänge (Euroblock)', ports: gridPorts(seq('Out ', 4), 'PHOENIX3', 'out', QC_W, 4, 17, [QC_H * 0.62]) },
  { id: 'CDN64', label: 'CDN64: Dante, 64 × 64 Kanäle', ports: gridPorts(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', QC_W, 2, 30, [QC_H * 0.6]) },
];
const qBays: ModuleBay[] = Array.from({ length: QC.cols * QC.rows }, (_, i) => ({
  name: `Kartensteckplatz ${i + 1}`, short: `C${i + 1}`, side: 'rear' as const, style: 'card' as const,
  x: Math.round((QC.x0 + (i % QC.cols) * (QC_W + QC.gap)) * 10) / 10, y: Math.round((QC.y0 + Math.floor(i / QC.cols) * (QC_H + QC.gap)) * 10) / 10,
  w: QC_W, h: QC_H, options: qcards, default: i < 4 ? 'CIML4-HP' : 'COL4',
}));
const core510i: DeviceTemplate = (() => {
  const t = mk({ id: 'qsys-core510i', name: 'Core 510i', man: 'Q-SYS', cat: DSP, u: 2, depth: 381, color: '#1d1e20', logo: 'Q-SYS', model: 'Core 510i',
    front: [G([B.list(['USB 1 (vorne)', 'USB 2 (vorne)'], 'USB', 'io')], 'left', { x0: 400 })], fa: (h) => [A.lcd(150, h / 2 - 10, 80, 20, '#dbeafe', false)],
    ra: qBays.map((b) => A.rect(b.x, b.y, b.w, b.h, '#0c0d0f', 0.8)),
    rear: [G([IEC, B.list(['LAN A', 'LAN B', 'AUX LAN'], 'RJ45', 'io', { rows: 3, gap: 6, ys: [16, 44, 72] }), B.list(['GPIO 1', 'GPIO 2'], 'DSUB25', 'io', { rows: 2, gap: 4, ys: [22, 62] })], 'left', { x1: 146 })],
    src: sheet('Q-SYS Hilfe Core 510i: 89 × 483 × 381 mm (2 HE), 8 Steckplätze für I/O-Karten, LAN A/B, AUX LAN, 2 × GPIO (DA-15), RS232 (DE-9), HDMI, IEC; RS232, HDMI und USB-A hinten weggelassen, GPIO als D-Sub gezeichnet; Kartenbelegung geschätzt'),
    notes: 'Q-SYS Core mit 8 Steckplätzen für Typ-2-I/O-Karten. Steckplätze im Inspector belegen; die Anschlüsse der Karten sind danach normale Ports.' });
  return { ...t, modules: qBays };
})();

// ================================================================== Analog Way Aquilon RS1/RS2/RS3
const aqFront = (h: number): ArtElement[] => [A.lcd(150, h / 2 - 25, 140, 50, '#dbeafe', false), A.knob(320, h / 2, 12), A.leds(350, h / 2 - 10, 4, ['#22c55e', '#22c55e', '#f59e0b', '#3a3d42'], 0, 6)];
function aquilon(id: string, name: string, u: number, hdmiIn: number, dpIn: number, out: number) {
  return mk({ id, name: `LivePremier Aquilon ${name}`, man: 'Analog Way', cat: VID, u, depth: 500, color: '#1f2124', logo: 'ANALOG WAY', model: `Aquilon ${name}`, fa: aqFront,
    rear: [G([PSU2, B.list(['Network 1', 'Network 2', 'Dante'], 'RJ45', 'io', { rows: 3, gap: 6 })]), G([
      B.list(seq('HDMI In ', hdmiIn), 'HDMI', 'in', { rows: 4 }), B.list(seq('DP In ', dpIn), 'DP', 'in', { rows: 4, gap: 6 }), B.list(seq('SDI In ', 4), 'BNC-SDI', 'in', { rows: 4, gap: 6 }),
      B.list(seq('HDMI Out ', out), 'HDMI', 'out', { rows: 4, gap: 10 }), B.list(['Multiviewer 1', 'Multiviewer 2'], 'HDMI', 'out', { rows: 4, gap: 6 }), B.list(['Genlock In', 'Genlock Loop'], 'BNC', 'io', { rows: 4, gap: 6 }), B.one('GPIO / Tally', 'GENERIC', 'io', { gap: 6 }),
    ], 'right')],
    src: sheet(`Analog Way Produktseite Aquilon ${name}: ${u} Rack Units, ${hdmiIn} × HDMI 2.0, ${dpIn} × DisplayPort 1.2, 4 × 12G-SDI Eingänge, ${out} × HDMI 2.0 Ausgänge, 2 Multiviewer; Tiefe und Gewicht nicht angegeben (geschätzt), Zahl der Netzwerkbuchsen geschätzt`),
    notes: `Bildmischer/Presentation-Switcher, ${hdmiIn + dpIn + 4} Eingänge, ${out} Ausgänge plus 2 Multiviewer, Dante. Karten optional tauschbar.` });
}
const video: DeviceTemplate[] = [
  aquilon('aw-aquilon-rs1', 'RS1', 4, 8, 4, 8),
  aquilon('aw-aquilon-rs2', 'RS2', 4, 8, 4, 12),
  aquilon('aw-aquilon-rs3', 'RS3', 5, 12, 8, 12),
  mk({ id: 'bmd-videohub-12g-1010', name: 'Videohub 10x10 12G', man: 'Blackmagic Design', cat: VID, u: 1, depth: 150, color: '#2a2c30', logo: 'Blackmagic Design', model: 'Videohub 10x10 12G',
    rear: [G([IEC]), G([B.list(seq('SDI In ', 10), 'BNC-SDI', 'in', { rows: 2 }), B.list(seq('SDI Out ', 10), 'BNC-SDI', 'out', { rows: 2, gap: 6 }), B.list(['Ref In', 'Ref Loop'], 'BNC75', 'io', { rows: 2, gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.one('USB-C', 'USB-C', 'io', { gap: 4 })], 'right')],
    src: sheet('Blackmagic Tech Specs Videohub 10x10 12G: 1 HE, 10 × 12G-SDI Ein/Aus, Referenz mit Durchschleifung, Ethernet, USB-C, IEC; Tiefe geschätzt'), notes: 'SDI-Kreuzschiene 10 × 10.' }),
  mk({ id: 'bmd-atem-2me-constellation-4k', name: 'ATEM 2 M/E Constellation 4K', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'Blackmagic Design', model: 'ATEM 2 M/E Constellation 4K',
    rear: [G([IEC]), G([B.list(seq('SDI In ', 20), 'BNC-SDI', 'in', { rows: 2 }), B.list([...seq('SDI Out ', 10), 'Multiview 1', 'Multiview 2'], 'BNC-SDI', 'out', { rows: 2, gap: 6 }), B.list(['Ref In'], 'BNC75', 'in', { gap: 4 }), B.list(['Audio In L', 'Audio In R'], 'JACK', 'in', { rows: 2, gap: 4 }), B.list(['Ethernet', 'Talkback'], 'RJ45', 'io', { rows: 2, gap: 4 }), B.list(['USB-C', 'Webcam USB-C'], 'USB-C', 'io', { rows: 2, gap: 3 })], 'right')],
    src: sheet('Blackmagic Tech Specs ATEM 2 M/E Constellation 4K: 1 HE, 20 × 12G-SDI Ein, 12 Aus inkl. Multiview, 2 Klinke Audio Ein, Talkback (XLR5 und RJ45), Ethernet, 2 × USB-C, 140 W; Talkback-XLR weggelassen, Tiefe geschätzt'), notes: 'Bildmischer mit 2 M/E.' }),
  mk({ id: 'bmd-atem-4me-constellation-4k', name: 'ATEM 4 M/E Constellation 4K', man: 'Blackmagic Design', cat: VID, u: 2, depth: 260, color: '#2a2c30', logo: 'Blackmagic Design', model: 'ATEM 4 M/E Constellation 4K',
    rear: [G([PSU2]), G([B.list(seq('SDI In ', 40), 'BNC-SDI', 'in', { rows: 4 }), B.list([...seq('SDI Out ', 24), ...seq('Multiview ', 4)], 'BNC-SDI', 'out', { rows: 4, gap: 6 }), B.list(['MADI In', 'MADI Out 1', 'MADI Out 2', 'Ref In'], 'BNC75', 'io', { rows: 4, gap: 5 }), B.list(['Audio In L', 'Audio In R', 'Audio Out L', 'Audio Out R'], 'JACK', 'io', { rows: 4, gap: 4 }), B.list(['Talkback In', 'Talkback Out'], 'XLR5F', 'io', { rows: 2, gap: 4 }), B.list(['Ethernet', 'Talkback', 'RS-422'], 'RJ45', 'io', { rows: 3, gap: 4 })], 'right')],
    src: sheet('Blackmagic Tech Specs ATEM 4 M/E Constellation 4K: 2 HE, 40 × 12G-SDI Ein, 28 Aus inkl. 4 Multiview, MADI 1 Ein/2 Aus, Klinke Audio, Talkback XLR5, RJ12 RS-422, Ethernet, 2 × Netzteil; USB-C weggelassen, Tiefe geschätzt'), notes: 'Bildmischer mit 4 M/E.' }),
  mk({ id: 'bmd-atem-4me-constellation-4kplus', name: 'ATEM 4 M/E Constellation 4K Plus', man: 'Blackmagic Design', cat: VID, u: 4, depth: 300, color: '#2a2c30', logo: 'Blackmagic Design', model: 'ATEM 4 M/E Constellation 4K Plus',
    rear: [G([PSU2]), G([B.list(seq('SDI In ', 80), 'BNC-SDI', 'in', { rows: 8 }), B.list([...seq('SDI Out ', 48), ...seq('Multiview ', 4), ...seq('Down-Conv ', 8)], 'BNC-SDI', 'out', { rows: 8, gap: 6 }), B.list(['MADI In 1', 'MADI In 2', 'MADI Out 1', 'MADI Out 2', 'MADI Out 3', 'MADI Out 4', 'Ref In'], 'BNC75', 'io', { rows: 7, gap: 5 }), B.list(['Audio In L', 'Audio In R', 'Audio Out L', 'Audio Out R'], 'JACK', 'io', { rows: 4, gap: 4 }), B.list(['Timecode In', 'Timecode Out', 'Talkback In', 'Talkback Out'], 'XLR3F', 'io', { rows: 4, gap: 4 }), B.list(['Ethernet', 'Talkback', 'RS-422'], 'RJ45', 'io', { rows: 3, gap: 4 })], 'right')],
    src: sheet('Blackmagic Tech Specs ATEM 4 M/E Constellation 4K Plus: 4 HE, 80 × 12G-SDI Ein, 52 Aus, 8 Down-Converter, 2 MADI Ein/4 Aus, Timecode XLR, Talkback, 2 × Netzteil 400 W; Talkback als XLR3 gezeichnet, Tiefe geschätzt'), notes: 'Großer Bildmischer mit 4 M/E und 80 Eingängen.' }),
];

// ================================================================== audio I/O, network, lighting
const misc: DeviceTemplate[] = [
  mk({ id: 'lawo-amic8', name: 'A__mic 8', man: 'Lawo', cat: STAGE, u: 1, depth: 210, color: '#2a2c30', weight: 2.1, logo: 'LAWO', model: 'A__mic8',
    front: [G([B.xin(8, 'Mic In '), B.xout(4, 'Out ', { gap: 8 })], 'right')],
    rear: [G([B.one('DC In', 'DC', 'in')]), G([B.list(['Ethernet 1 (PoE)', 'Ethernet 2'], 'RJ45', 'io'), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 6 }), { c: 'GENERIC', names: ['GPIO (DB-37)'], dir: 'io', gap: 6 }], 'right')],
    src: sheet('Lawo A__line: A__mic 8 44 × 481 × 210 mm (1 HE), 2,1 kg; 8 Mic/Line XLR, 4 Line-Ausgänge XLR, 2 × RJ45, Word Clock BNC Ein/Aus, GPIO DB-37, PoE Klasse 3 oder DC 10–14 V'), notes: 'RAVENNA/AES67-Stagebox, PoE-versorgt.' }),
  mk({ id: 'lawo-amadi6', name: 'A__madi 6', man: 'Lawo', cat: CONV, u: 1, depth: 266, color: '#2a2c30', weight: 3.1, logo: 'LAWO', model: 'A__madi6',
    rear: [G([PSU2]), G([B.sfp(6, 'MADI ', { rows: 2 }), B.rj(6, 'Ethernet ', { rows: 2, gap: 6 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { rows: 2, gap: 6 })], 'right')],
    src: sheet('Lawo A__line: A__madi 6 44 × 448 × 266 mm (1 HE), 3,1 kg; 3 MADI-Brücken mit je 2 × MADI (SFP) und 2 × Ethernet (RJ45/SFP), Word Clock BNC, 2 Netzteile; Ethernet als RJ45 gezeichnet'), notes: 'Drei unabhängige MADI ↔ RAVENNA/AES67-Brücken.' }),
  mk({ id: 'lmx-gc20t', name: 'GigaCore 20t', man: 'Luminex', cat: NET, u: 1, depth: 204, color: '#1d1e20', weight: 4, logo: 'LUMINEX', model: 'GigaCore 20t',
    front: [G([B.ec(4, 'etherCON ')], 'right')],
    rear: [G([B.one('Power In', 'TRUE1_IN', 'in'), B.one('Power Out', 'TRUE1_OUT', 'out', { gap: 4 })]), G([B.ec(4, 'etherCON ', { start: 5 }), B.rj(8, 'Port ', { rows: 2, gap: 6 }), B.sfp(4, 'SFP+ ', { rows: 2, gap: 4 })], 'right')],
    src: sheet('Luminex GigaCore 20t Produktseite: 482 × 204,1 × 44 mm, 4 kg; 8 × etherCON (4 vorne, 4 hinten), 8 × RJ45, 4 × SFP+, powerCON TRUE1 Ein/Aus'), notes: '10-Gigabit-Switch für Live-Produktion.' }),
  mk({ id: 'swisson-xnd4', name: 'XND-4', man: 'Swisson', cat: DMX, u: 1, depth: 136, color: '#1f2022', weight: 1.6, logo: 'SWISSON',
    front: [G([B.dmx(4, 'DMX ', { dir: 'io' }), B.ec(1, 'Ethernet ', { gap: 12 })], 'right')], rear: [G([B.one('Power In', 'POWERCON_IN', 'in'), B.one('Power Out', 'POWERCON_OUT', 'out', { gap: 6 })])],
    src: sheet('Swisson Produktseite (XND-4R5): 19", 44,5 mm hoch, 136 mm, 1,6 kg, powerCON Ein/Aus, 4 DMX (XLR 5-pol, als Ein- oder Ausgang); Zahl der Ethernet-Buchsen nicht angegeben'), notes: 'Ethernet-DMX-Node, Art-Net/sACN.' }),
];

export const COMPLETE5_DEVICES: DeviceTemplate[] = [core510i, ...video, ...misc];
