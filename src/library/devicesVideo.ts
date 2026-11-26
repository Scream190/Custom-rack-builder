import type { ArtElement, DeviceTemplate } from '../model/types';
import { A, B, G, mk, SRC, type Blk } from './proLayout';

/*
 * LED wall processors and further video equipment. Most of these products are modular or exist in several
 * hardware revisions: connector sets follow the data sheets where known (SRC.DS), otherwise a typical
 * configuration is shown and marked as estimate (SRC.EST). Generic templates are marked as such.
 */

const LED = 'LED-Prozessor', VID = 'Video', GEN = 'Generische Vorlage';
const PSU = B.one('Power', 'IEC_C14', 'in');
const PSU2 = B.list(['PSU 1', 'PSU 2'], 'IEC_C14', 'in');
const sdi = (n: number, pre: string, dir: Blk['dir'], o: Partial<Blk> = {}): Blk => B.bnc(n, pre, dir, o);

/** processor front: display, rotary encoder, a few keys */
const procFront = (lcdW = 70, keys = 4) => (H: number): ArtElement[] => [
  A.lcd(120, H / 2 - Math.min(13, H * 0.3), lcdW, Math.min(26, H * 0.6), '#dbeafe', false),
  A.knob(120 + lcdW + 18, H / 2, Math.min(8, H * 0.2)),
  ...Array.from({ length: keys }, (_, i) => A.btn(120 + lcdW + 36 + i * 13, H / 2 - 4, 10, 8)),
  A.sw(445, H / 2 - 7),
];
/** card frame: vertical slots across the rear */
const slots = (n: number, x0 = 70, x1 = 440) => (H: number): ArtElement[] =>
  Array.from({ length: n }, (_, i) => A.rect(x0 + (i * (x1 - x0)) / n + 1, 6, (x1 - x0) / n - 2, H - 12, '#1c1e22', 0.6));

// ================================================================== LED wall processors
const led: DeviceTemplate[] = [
  mk({ id: 'nova-vx1000', name: 'VX1000', man: 'Novastar', cat: LED, u: 2, depth: 360, color: '#1d1f23', logo: 'NOVASTAR', fa: procFront(80, 5),
    rear: [G([PSU]), G([
      B.list(['HDMI In 1', 'HDMI In 2'], 'HDMI', 'in', { rows: 2 }), B.one('DVI In', 'DVI', 'in', { gap: 6, ys: [22] }), sdi(1, '3G-SDI In', 'in', { names: ['3G-SDI In'], ys: [66], stack: true }),
      B.rj(10, 'Out ', { rows: 2, order: 'col', gap: 8, pitch: 16 }), B.list(['OPT 1', 'OPT 2'], 'SFP', 'io', { rows: 2, gap: 6 }),
      B.list(['USB', 'Ethernet'], 'RJ45', 'io', { rows: 2, gap: 6 }),
    ], 'right')],
    src: SRC.EST, notes: 'All-in-one-Controller: 10× Gigabit-Ausgänge (ca. 6,5 Mio. Pixel), 2 Glasfaserausgänge.' }),
  mk({ id: 'nova-vx4s-n', name: 'VX4S-N', man: 'Novastar', cat: LED, u: 1, depth: 300, color: '#1d1f23', logo: 'NOVASTAR', fa: procFront(60, 4),
    rear: [G([PSU]), G([sdi(1, 'CVBS', 'in', { names: ['CVBS In'] }), B.one('VGA In', 'VGA', 'in', { gap: 4 }), B.one('DVI In', 'DVI', 'in', { gap: 4 }), B.one('HDMI In', 'HDMI', 'in', { gap: 4 }), sdi(1, 'SDI', 'in', { names: ['3G-SDI In'], gap: 4 }), B.rj(4, 'Out ', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: SRC.EST, notes: 'Videoprozessor mit Controller, 4 Gigabit-Ausgänge.' }),
  mk({ id: 'nova-mctrl4k', name: 'MCTRL4K', man: 'Novastar', cat: LED, u: 1, depth: 360, color: '#1d1f23', logo: 'NOVASTAR', fa: procFront(60, 4),
    rear: [G([PSU]), G([B.one('DP 1.2 In', 'DP', 'in'), B.one('HDMI 2.0 In', 'HDMI', 'in', { gap: 4 }), B.rj(16, 'Out ', { rows: 2, order: 'col', gap: 6, pitch: 15.4 }), B.list(['OPT 1', 'OPT 2', 'OPT 3', 'OPT 4'], 'SFP', 'io', { rows: 2, gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: '4K-Controller, 16 Gigabit-Ausgänge, 4 Glasfaserausgänge.' }),
  mk({ id: 'nova-mx40pro', name: 'MX40 Pro (COEX)', man: 'Novastar', cat: LED, u: 2, depth: 420, color: '#1d1f23', logo: 'NOVASTAR', model: 'MX40 Pro', fa: procFront(100, 5),
    rear: [G([PSU2]), G([
      B.list(['HDMI 2.0 In 1', 'HDMI 2.0 In 2'], 'HDMI', 'in', { rows: 2 }), B.one('DP 1.4 In', 'DP', 'in', { gap: 5, ys: [22] }), sdi(1, '12G-SDI In', 'in', { names: ['12G-SDI In'], ys: [66], stack: true }),
      B.rj(20, 'Out ', { rows: 2, order: 'col', gap: 8, pitch: 15.4 }), B.list(['10G OPT 1', '10G OPT 2', '10G OPT 3', '10G OPT 4'], 'SFP', 'io', { rows: 2, gap: 6 }),
      B.one('Control', 'RJ45', 'io', { gap: 6 }),
    ], 'right')],
    src: SRC.EST, notes: 'COEX-Controller: 20× Gigabit-Ausgänge, 4× 10-G-Glasfaser.' }),
  mk({ id: 'nova-cvt10pro', name: 'CVT10 Pro', man: 'Novastar', cat: LED, u: 1, depth: 250, color: '#1d1f23', logo: 'NOVASTAR',
    rear: [G([PSU]), G([B.list(['OPT 1', 'OPT 2'], 'OPTICALCON', 'io'), B.rj(10, 'Port ', { gap: 10, pitch: 16 })], 'right')],
    src: SRC.EST, notes: 'Glasfaser-Konverter: Glasfaser ↔ 10 Gigabit-Ports (am Bildschirm).' }),
  mk({ id: 'brompton-sx40', name: 'Tessera SX40', man: 'Brompton', cat: LED, u: 1, depth: 400, color: '#262a30', logo: 'BROMPTON', fa: procFront(70, 4),
    rear: [G([B.list(['Power In', 'Power Thru'], 'TRUE1_IN', 'io')]), G([B.one('HDMI 2.0 In', 'HDMI', 'in'), sdi(2, '12G-SDI In ', 'in', { gap: 5 }), sdi(1, 'SDI Loop', 'out', { names: ['12G-SDI Loop'], gap: 4 }), B.list(['10G Out 1', '10G Out 2', '10G Out 3', '10G Out 4'], 'ETHERCON', 'out', { gap: 8 }), B.one('Control', 'ETHERCON', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: '4K-LED-Prozessor, 4× 10-G-Ausgänge zu XD-Datenverteilern.' }),
  mk({ id: 'brompton-s8', name: 'Tessera S8', man: 'Brompton', cat: LED, u: 1, depth: 350, color: '#262a30', logo: 'BROMPTON', fa: procFront(60, 4),
    rear: [G([PSU]), G([B.one('DVI In', 'DVI', 'in'), B.one('HDMI In', 'HDMI', 'in', { gap: 4 }), sdi(1, 'SDI', 'in', { names: ['3G-SDI In'], gap: 4 }), B.ec(8, 'Out ', { gap: 8, pitch: 25.5 }), B.one('Control', 'ETHERCON', 'io', { gap: 4 })], 'right')],
    src: SRC.EST, notes: 'LED-Prozessor, 8 Gigabit-Ausgänge.' }),
  mk({ id: 'brompton-xd', name: 'Tessera XD', man: 'Brompton', cat: LED, u: 1, depth: 300, color: '#262a30', logo: 'BROMPTON',
    front: [G([B.ec(10, 'Out ', { pitch: 26 })], 'right')], rear: [G([PSU2]), G([B.list(['10G Trunk In', '10G Trunk Thru'], 'ETHERCON', 'io'), B.list(['10G Fiber In', '10G Fiber Thru'], 'SFP', 'io', { gap: 8 })], 'right')],
    src: SRC.EST, notes: 'Datenverteiler: 10-G-Trunk vom Prozessor auf 10 Gigabit-Ausgänge.' }),
  mk({ id: 'megapixel-helios', name: 'HELIOS LED-Prozessor', man: 'Megapixel VR', cat: LED, u: 1, depth: 400, color: '#1b1c1f', logo: 'MEGAPIXEL', model: 'HELIOS', fa: procFront(70, 3),
    rear: [G([PSU2]), G([B.one('HDMI 2.0 In', 'HDMI', 'in'), sdi(2, '12G-SDI In ', 'in', { gap: 5 }), B.list(['10G Out 1', '10G Out 2', '10G Out 3', '10G Out 4'], 'SFP', 'out', { rows: 2, gap: 8 }), B.list(['Control', 'Genlock'], 'RJ45', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Hardware-Revision mit HDMI/SDI-Eingängen dargestellt; ST-2110-Varianten weichen ab.' }),
  mk({ id: 'gen-led-proc-8', name: 'LED-Prozessor 1 HE (8 Ports)', man: 'Generisch', cat: LED, u: 1, depth: 300, color: '#1f2126', model: 'LED-Controller 8 Ports', fa: procFront(60, 3),
    rear: [G([PSU]), G([B.one('HDMI In', 'HDMI', 'in'), B.one('DVI In', 'DVI', 'in', { gap: 4 }), sdi(1, 'SDI', 'in', { names: ['SDI In'], gap: 4 }), B.ec(8, 'Out ', { gap: 8, pitch: 25.5 })], 'right')], src: GEN }),
];

// ================================================================== Bildmischer, Präsentationssysteme, Medienserver
const switchers: DeviceTemplate[] = [
  mk({ id: 'barco-e2-gen2', name: 'Event Master E2 Gen 2', man: 'Barco', cat: VID, u: 4, depth: 600, color: '#2a2c30', logo: 'BARCO', model: 'E2 Gen 2', fa: procFront(120, 6),
    rear: [G([PSU2]), G([
      B.list(Array.from({ length: 8 }, (_, i) => `HDMI In ${i + 1}`), 'HDMI', 'in', { rows: 2, ys: [30, 50], pitch: 20 }),
      B.list(Array.from({ length: 8 }, (_, i) => `DP In ${i + 1}`), 'DP', 'in', { rows: 2, ys: [80, 100], pitch: 20, stack: true }),
      sdi(8, '12G-SDI In ', 'in', { rows: 2, ys: [130, 150], stack: true, pitch: 20 }),
      B.list(Array.from({ length: 8 }, (_, i) => `DP Out ${i + 1}`), 'DP', 'out', { rows: 2, ys: [30, 50], pitch: 20, gap: 14 }),
      sdi(4, '12G-SDI Out ', 'out', { rows: 2, ys: [80, 100], stack: true, pitch: 20 }),
      B.list(['Ethernet 1', 'Ethernet 2'], 'RJ45', 'io', { rows: 2, ys: [130, 150], stack: true }),
    ], 'right')],
    rearVents: true, src: SRC.EST, notes: 'Kartenbasiert; typische Bestückung mit HDMI-, DP- und SDI-Karten dargestellt.' }),
  mk({ id: 'aw-aquilon-rs4', name: 'LivePremier Aquilon RS4', man: 'Analog Way', cat: VID, u: 4, depth: 600, color: '#1d1e20', logo: 'ANALOG WAY', model: 'Aquilon RS4', fa: procFront(140, 6),
    rear: [G([PSU2]), G([
      B.list(Array.from({ length: 8 }, (_, i) => `HDMI In ${i + 1}`), 'HDMI', 'in', { rows: 2, ys: [30, 50], pitch: 20 }),
      B.list(Array.from({ length: 8 }, (_, i) => `DP In ${i + 1}`), 'DP', 'in', { rows: 2, ys: [80, 100], pitch: 20, stack: true }),
      sdi(8, '12G-SDI In ', 'in', { rows: 2, ys: [130, 150], stack: true, pitch: 20 }),
      B.list(Array.from({ length: 8 }, (_, i) => `HDMI Out ${i + 1}`), 'HDMI', 'out', { rows: 2, ys: [30, 50], pitch: 20, gap: 14 }),
      sdi(4, '12G-SDI Out ', 'out', { rows: 2, ys: [80, 100], stack: true, pitch: 20 }),
      B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { rows: 2, ys: [130, 150], stack: true }),
    ], 'right')],
    rearVents: true, src: SRC.EST, notes: 'Modulares 4K-Präsentationssystem; typische Bestückung dargestellt.' }),
  mk({ id: 'bmd-atem-tvs-4k8', name: 'ATEM Television Studio 4K8', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC',
    fa: [A.lcd(150, 9, 60, 26, '#111827', false), ...Array.from({ length: 8 }, (_, i) => A.btn(230 + i * 13, 16, 10, 8))],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdi(8, '12G-SDI In ', 'in', { ys: [11] }), sdi(4, 'SDI Out ', 'out', { ys: [32.6], stack: true }), B.one('HDMI Out', 'HDMI', 'out', { gap: 6 }), B.list(['Audio In 1', 'Audio In 2'], 'XLR3F', 'in', { gap: 6 }), B.one('Ref In', 'BNC75', 'in', { gap: 5 })], 'right')],
    src: SRC.EST }),
  mk({ id: 'bmd-ultimatte12', name: 'Ultimatte 12 4K', man: 'Blackmagic Design', cat: VID, u: 1, depth: 250, color: '#2a2c30', logo: 'BLACKMAGIC', model: 'Ultimatte 12',
    fa: [A.lcd(150, 9, 60, 26, '#111827', false)],
    rear: [G([PSU, B.one('Ethernet', 'RJ45', 'io', { gap: 5 })]), G([sdi(4, '12G-SDI In ', 'in', { ys: [11] }), sdi(4, '12G-SDI Out ', 'out', { ys: [32.6], stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Keyer (Vordergrund, Hintergrund, Garbage-Matte, Fill/Key).' }),
  mk({ id: 'disguise-vx2', name: 'vx 2', man: 'disguise', cat: VID, u: 2, depth: 700, color: '#1b1c1f', logo: 'DISGUISE', fa: (H) => [A.vents(90, 12, 300, H - 24, 50), A.lcd(400, H / 2 - 12, 40, 24, '#dbeafe', false)],
    rear: [G([PSU2]), G([B.list(['Out 1', 'Out 2', 'Out 3', 'Out 4'], 'DP', 'out', { rows: 2 }), sdi(4, 'SDI Out ', 'out', { rows: 2, gap: 8 }), B.list(['10G 1', '10G 2'], 'SFP', 'io', { rows: 2, gap: 8 }), B.list(['1G 1', '1G 2'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.list(['USB 1', 'USB 2'], 'USB', 'io', { rows: 2, gap: 6 }), B.one('Genlock', 'BNC75', 'in', { gap: 6 })], 'right')],
    rearVents: true, src: SRC.EST, notes: 'Medienserver; Ausgangskarte (DP oder SDI) je nach Bestückung.' }),
  mk({ id: 'gen-mediaserver-2u', name: 'Medienserver 2 HE (4 Ausgänge)', man: 'Generisch', cat: VID, u: 2, depth: 600, color: '#26282c', model: 'Medienserver 2 HE', fa: (H) => [A.vents(90, 12, 330, H - 24, 50)],
    rear: [G([PSU2]), G([B.list(['Out 1', 'Out 2', 'Out 3', 'Out 4'], 'DP', 'out', { rows: 2 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['USB 1', 'USB 2'], 'USB', 'io', { rows: 2, gap: 6 }), B.one('LTC In', 'XLR3F', 'in', { gap: 6 })], 'right')],
    rearVents: true, src: GEN }),
];

// ================================================================== Kreuzschienen, Wandler, Multiviewer, Übertragung
const infra: DeviceTemplate[] = [
  mk({ id: 'aja-fs4', name: 'FS4', man: 'AJA', cat: VID, u: 1, depth: 400, color: '#26282c', logo: 'AJA', fa: [A.lcd(150, 9, 60, 26, '#111827', false), A.knob(230, 21.8, 8)],
    rear: [G([PSU2, B.one('LAN', 'RJ45', 'io', { gap: 5 })]), G([sdi(4, '12G-SDI In ', 'in', { ys: [11] }), sdi(4, '12G-SDI Out ', 'out', { ys: [32.6], stack: true }), B.one('Ref In', 'BNC75', 'in', { gap: 5 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { rows: 2, gap: 6 }), B.one('AES', 'DSUB25-AES', 'io', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Frame-Synchronizer/Wandler, 4 Kanäle HD oder 1 Kanal 4K.' }),
  mk({ id: 'lightware-mx2-8x8', name: 'MX2-8x8-HDMI20', man: 'Lightware', cat: VID, u: 1, depth: 300, color: '#1f2937', logo: 'LIGHTWARE', model: 'MX2-8x8',
    fa: [A.lcd(150, 9, 50, 26, '#111827', false), ...Array.from({ length: 8 }, (_, i) => A.btn(220 + i * 13, 10, 10, 8)), ...Array.from({ length: 8 }, (_, i) => A.btn(220 + i * 13, 24, 10, 8))],
    rear: [G([PSU, B.one('LAN', 'RJ45', 'io', { gap: 5 }), B.one('RS-232', 'PHOENIX3', 'io', { gap: 5 })]), G([B.list(Array.from({ length: 8 }, (_, i) => `HDMI In ${i + 1}`), 'HDMI', 'in', { ys: [12], pitch: 19 }), B.list(Array.from({ length: 8 }, (_, i) => `HDMI Out ${i + 1}`), 'HDMI', 'out', { ys: [32], stack: true, pitch: 19 })], 'right')],
    src: SRC.DS, notes: '8×8 HDMI-2.0-Kreuzschiene.' }),
  mk({ id: 'decimator-dmon16s', name: 'DMON-16S', man: 'Decimator Design', cat: VID, u: 1, depth: 200, color: '#2a2c30', logo: 'DECIMATOR',
    rear: [G([PSU, B.one('USB', 'USB', 'io', { gap: 5 })]), G([sdi(16, 'SDI In ', 'in', { ys: [11], pitch: 14.2 }), sdi(2, 'MV Out ', 'out', { ys: [32.6], stack: true }), B.one('HDMI Out', 'HDMI', 'out', { gap: 8 })], 'right')],
    src: SRC.EST, notes: 'Multiviewer für 16 SDI-Quellen.' }),
  mk({ id: 'ross-ogx-frame', name: 'openGear OGX-FR', man: 'Ross Video', cat: VID, u: 2, depth: 450, color: '#2a2c30', logo: 'ROSS', model: 'openGear-Rahmen 20 Slots',
    fa: (H) => [A.rect(90, 10, 330, H - 20, '#1c1e22', 1), ...Array.from({ length: 20 }, (_, i) => A.leds(100 + i * 16, H / 2, 1, ['#22c55e']))],
    ra: slots(20), rear: [G([PSU2]), G([B.list(['Network 1', 'Network 2'], 'RJ45', 'io', { rows: 2 })], 'right', { x0: 440 })],
    src: SRC.EST, notes: 'Rahmen für 20 openGear-Karten; die Anschlüsse hängen von den Rear-Modulen ab.' }),
  mk({ id: 'riedel-micron-uhd', name: 'MediorNet MicroN UHD', man: 'Riedel', cat: VID, u: 1, depth: 300, color: '#1f2937', logo: 'RIEDEL', model: 'MicroN UHD',
    rear: [G([PSU2]), G([sdi(8, 'SDI ', 'io', { ys: [11] }), sdi(8, 'SDI ', 'io', { ys: [32.6], stack: true, start: 9 }), B.list(['MADI 1', 'MADI 2'], 'MADI-BNC', 'io', { rows: 2, gap: 6 }), B.sfp(8, 'SFP+ ', { rows: 2, order: 'col', gap: 8 }), B.list(['LAN', 'Sync'], 'RJ45', 'io', { rows: 2, gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Dezentrales Signal-Netzwerk (Video, Audio, Daten über Glasfaser).' }),
  mk({ id: 'gen-hdbaset-tx4', name: 'HDBaseT-Sender 4-fach', man: 'Generisch', cat: VID, u: 1, depth: 200, color: '#26282c', model: 'HDBaseT TX 4×',
    rear: [G([PSU]), G([B.list(['HDMI In 1', 'HDMI In 2', 'HDMI In 3', 'HDMI In 4'], 'HDMI', 'in', { pitch: 22 }), B.list(['HDBT Out 1', 'HDBT Out 2', 'HDBT Out 3', 'HDBT Out 4'], 'RJ45', 'out', { gap: 12, pitch: 20 }), B.one('RS-232', 'PHOENIX3', 'io', { gap: 8 })], 'right')],
    src: GEN }),
  mk({ id: 'gen-sdi-mv16', name: 'SDI-Multiviewer 16 Eingänge', man: 'Generisch', cat: VID, u: 1, depth: 200, color: '#26282c', model: 'Multiviewer 16×',
    rear: [G([PSU]), G([sdi(16, 'SDI In ', 'in', { ys: [11], pitch: 14.2 }), sdi(1, 'MV Out', 'out', { names: ['SDI MV Out'], ys: [32.6], stack: true }), B.one('HDMI Out', 'HDMI', 'out', { gap: 8 }), B.one('LAN', 'RJ45', 'io', { gap: 6 })], 'right')], src: GEN }),
  mk({ id: 'gen-sdi-fiber-4', name: 'SDI-Glasfaserstrecke 4 Kanäle (opticalCON)', man: 'Generisch', cat: VID, u: 1, depth: 200, color: '#26282c', model: 'SDI ⇄ Fiber 4×',
    rear: [G([PSU]), G([sdi(4, 'SDI In ', 'in'), sdi(4, 'SDI Out ', 'out', { gap: 8 }), B.one('Fiber', 'OPTICALCON', 'io', { gap: 12 })], 'right')], src: GEN, notes: '4 SDI-Kanäle hin und zurück über opticalCON QUAD.' }),
];

export const VIDEO_DEVICES: DeviceTemplate[] = [...led, ...switchers, ...infra];
