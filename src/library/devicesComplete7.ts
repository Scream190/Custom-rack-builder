import type { DeviceTemplate } from '../model/types';
import { A, B, G, mk } from './proLayout';

/*
 * Seventh completion pass (11/2026): manufacturers that were missing (NEXO, Waves, Soundcraft, Dynacord, Furman,
 * Netgear AV) and gaps at brands already in the library (stage boxes, amplifiers, intercom panels, processors).
 * Height, size and weight come from the data sheet or spec page named in `source`; where a figure was not published
 * the source says "Schätzung". Positions on the panels are estimated.
 */

const STAGE = 'Stagebox', IC = 'Intercom', AMP = 'Endstufen', DSP = 'Signalprozessor', NET = 'Netzwerk', VID = 'Video', LED = 'LED-Prozessor', PWR = 'Strom', SRV = 'Server', SPLIT = 'Mikrofonsplitter';
const sheet = (what: string) => `Datenblatt – ${what}; Positionen geschätzt (±10 mm)`;
const est = (what: string) => `Schätzung – ${what}; Positionen geschätzt (±10 mm)`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const PSU2 = B.list(['Power A', 'Power B'], 'IEC_C14', 'in');
const touch = (x = 150) => (h: number) => [A.lcd(x, h / 2 - Math.min(14, h / 2 - 6), 70, Math.min(28, h - 12), '#dbeafe', false)];

// ------------------------------------------------------------------ amplifiers
const amps: DeviceTemplate[] = [
  mk({ id: 'nexo-nxamp4x4mk2', name: 'NXAMP4x4mk2', man: 'NEXO', cat: AMP, u: 3, depth: 502, color: '#1d1e21', weight: 24.9, logo: 'NEXO', model: 'NXAMP4x4mk2', fa: touch(),
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.list(seq('In ', 4), 'XLR3F', 'in'), B.list(seq('Link ', 4), 'XLR3M', 'out', { gap: 6 }), B.one('Netzwerk (Karte)', 'RJ45', 'io', { gap: 8 }), B.list(seq('Out ', 4), 'SPEAKON', 'out', { gap: 10 })], 'right')],
    src: sheet('NEXO NXAMP4x4mk2: 3 HE, 480 × 132 × 502 mm, 24,9 kg; 4 analoge Eingänge mit Link, 4 Lautsprecherausgänge, Steckplatz für Netzwerkkarte (Dante/AES67), powerCON 32 A'), notes: 'Powered TD Controller, 4 × 4500 W.' }),
  ...(['4x2', '4x1'] as const).map((m) => mk({ id: `nexo-nxamp${m}mk2`, name: `NXAMP${m}mk2`, man: 'NEXO', cat: AMP, u: 2, depth: 502, color: '#1d1e21', weight: m === '4x2' ? 16.1 : 15.7, logo: 'NEXO', model: `NXAMP${m}mk2`, fa: touch(),
    rear: [G([B.one('Power In', 'POWERCON_IN', 'in')]), G([B.list(seq('In ', 4), 'XLR3F', 'in'), B.list(seq('Link ', 4), 'XLR3M', 'out', { gap: 6 }), B.one('Netzwerk (Karte)', 'RJ45', 'io', { gap: 8 }), B.list(seq('Out ', 4), 'SPEAKON', 'out', { gap: 10 })], 'right')],
    src: sheet(`NEXO NXAMP${m}mk2: 2 HE, 480 × 88 × 502 mm, ${m === '4x2' ? '16,1' : '15,7'} kg; 4 Eingänge mit Link, 4 Lautsprecherausgänge, Netzwerkkarten-Steckplatz, powerCON`), notes: `Powered TD Controller, 4 × ${m === '4x2' ? '2500' : '1300'} W.` })),
  ...(['K20', 'K10'] as const).map((m) => mk({ id: `pws-${m.toLowerCase()}`, name: `${m} DSP+AESOP`, man: 'Powersoft', cat: AMP, u: 1, depth: 475, color: '#2b2d31', weight: 12, logo: 'POWERSOFT', model: m,
    rear: [G([B.one('Power In', m === 'K20' ? 'POWERCON32_IN' : 'POWERCON_IN', 'in')]), G([B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Link A', 'Link B'], 'XLR3M', 'out', { gap: 4 }), B.one('AES3 In', 'AES-XLR', 'in', { gap: 6 }), B.one('Ethernet (KAESOP)', 'RJ45', 'io', { gap: 6 }), B.list(['Out 1', 'Out 2'], 'SPEAKON', 'out', { gap: 8 })], 'right')],
    src: sheet(`Powersoft ${m}: 483 × 44,5 × 475 mm (1 HE), 12 kg (K-Serien-Gehäuse); 2 analoge Eingänge mit Link, AES3, Ethernet, 2 × speakON, powerCON${m === 'K20' ? ' 32 A' : ''}`), notes: `Touring-Endstufe, 2 Kanäle${m === 'K20' ? ', bis 2 × 9000 W' : ', bis 2 × 4500 W'}.` })),
  ...(['4K4', '8K4'] as const).map((m) => mk({ id: `pws-ottocanali-${m.toLowerCase()}`, name: `Ottocanali ${m} DSP+D`, man: 'Powersoft', cat: AMP, u: 2, depth: 360, color: '#2b2d31', weight: 14, logo: 'POWERSOFT', model: `Ottocanali ${m}`,
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in', { rows: 2 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 8), 'PHOENIX-SPK', 'out', { rows: 2, gap: 10 })], 'right')],
    src: sheet(`Powersoft Ottocanali ${m} DSP+D: 483 × 89 × 360 mm (2 HE), 14 kg; 8 Eingänge (Euroblock), Dante, Ethernet, 8 Lautsprecherausgänge (Euroblock)`), notes: `Installationsendstufe, 8 Kanäle, ${m === '4K4' ? '4000' : '8000'} W gesamt.` })),
  mk({ id: 'la-la716i', name: 'LA7.16i', man: 'L-Acoustics', cat: AMP, u: 2, depth: 411, color: '#1f2023', weight: 14.5, logo: 'L-ACOUSTICS', model: 'LA7.16i', fa: touch(),
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.list(seq('In ', 16), 'PHOENIX3', 'in', { rows: 2 }), B.list(['Milan/AVB 1', 'Milan/AVB 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(seq('Out ', 16), 'PHOENIX-SPK', 'out', { rows: 2, gap: 10 })], 'right')],
    src: sheet('L-Acoustics LA7.16i: 483 × 88 × 411 mm (2 HE), 14,5 kg; 16 Kanäle, Milan/AVB, analoge und AES-Eingänge und Lautsprecherausgänge auf Euroblock (Aufteilung vereinfacht)'), notes: 'Installationsversion des LA7.16, 16 × 1300 W.' }),
  mk({ id: 'ma-ik81', name: 'iK81', man: 'Martin Audio', cat: AMP, u: 2, depth: 357, color: '#1d1e20', weight: 12.5, logo: 'MARTIN AUDIO', model: 'iKON iK81',
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.list(seq('In ', 4), 'XLR3F', 'in'), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 8 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 4), 'SPEAKON', 'out', { gap: 10 })], 'right')],
    src: sheet('Martin Audio iK81: 483 × 89 × 357 mm (2 HE, 441 mm mit Griffen und Stütze), 12,5 kg; 4 × 8 DSP, 4 Eingänge, Dante, 8 Kanäle auf 4 × speakON'), notes: 'Endstufe für Wavefront Precision, 8 × 1250 W.' }),
  mk({ id: 'db-d12', name: 'D12', man: 'd&b audiotechnik', cat: AMP, u: 3, depth: 353, color: '#2a2b2e', weight: 13, logo: 'd&b', model: 'D12',
    rear: [G([B.one('Power In', 'POWERCON_IN', 'in')]), G([B.list(['In A', 'In B'], 'XLR3F', 'in'), B.list(['Link A', 'Link B'], 'XLR3M', 'out', { gap: 4 }), B.list(['CAN In', 'CAN Out'], 'RJ45', 'io', { gap: 8 }), B.list(['Out A', 'Out B'], 'SPEAKON', 'out', { gap: 10 }), B.one('Out A+B', 'SPEAKON8', 'out', { gap: 6 })], 'right')],
    src: sheet('d&b D12: 3 HE, 19", Tiefe 353 mm, 13 kg; 2 Eingänge mit Link, CAN-Bus, 2 × NL4 und 1 × NL8'), notes: 'Klassischer Verstärker-Controller, in vielen Verleihlagern noch im Einsatz.' }),
  mk({ id: 'dyn-tgx20', name: 'TGX20', man: 'Dynacord', cat: AMP, u: 2, depth: 514, color: '#1f2023', weight: 18.3, logo: 'DYNACORD', model: 'TGX20', fa: touch(),
    rear: [G([B.one('Power In', 'POWERCON32_IN', 'in')]), G([B.list(seq('In ', 4), 'XLR3F', 'in'), B.list(['AES In 1/2', 'AES In 3/4'], 'AES-XLR', 'in', { gap: 6 }), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 8 }), B.list(seq('Out ', 4), 'SPEAKON', 'out', { gap: 10 })], 'right')],
    src: sheet('Dynacord TGX20: 483 × 88,1 × 514,2 mm (2 HE), 18,3 kg; 4 analoge und AES-Eingänge, Dante, OCA, 4 × speakON'), notes: 'Touring-Endstufe, 4 × 5000 W.' }),
];

// ------------------------------------------------------------------ stage boxes and splitters
const stage: DeviceTemplate[] = [
  mk({ id: 'midas-dl351', name: 'DL351', man: 'Midas', cat: STAGE, u: 7, depth: 416, color: '#1b1c1e', weight: 16.9, logo: 'MIDAS', model: 'DL351 Modular I/O',
    front: [G([B.list(seq('In ', 32), 'XLR3F', 'in', { rows: 4 }), B.list(seq('Out ', 32), 'XLR3M', 'out', { rows: 4, gap: 12 })], 'center')],
    rear: [G([PSU2, B.list(['AES50 A1', 'AES50 A2', 'AES50 B1', 'AES50 B2'], 'ETHERCON', 'io', { rows: 2, gap: 10 })])],
    src: sheet('Midas DL351 Product Information: 19", 7 HE, Tiefe 416 mm, 16,9 kg; 8 Kartensteckplätze für bis zu 64 Ein-/Ausgänge (hier 4 Eingangs- und 4 Ausgangskarten), AES50, 2 Netzteile'), notes: 'Modulare Stagebox für PRO-Serie und HD96, Kartenbelegung variiert.' }),
  mk({ id: 'midas-dl451', name: 'DL451', man: 'Midas', cat: STAGE, u: 3, depth: 410, color: '#1b1c1e', weight: 10.1, logo: 'MIDAS', model: 'DL451 Modular I/O',
    front: [G([B.list(seq('In ', 16), 'XLR3F', 'in', { rows: 2 }), B.list(seq('Out ', 8), 'XLR3M', 'out', { rows: 2, gap: 12 })], 'center')],
    rear: [G([PSU2, B.list(['AES50 A1', 'AES50 A2', 'AES50 B1', 'AES50 B2'], 'ETHERCON', 'io', { gap: 10 })])],
    src: sheet('Midas DL451: 3 HE, Tiefe 41 cm, 10,1 kg; 3 × 8 Kartensteckplätze (hier 2 Eingangs- und 1 Ausgangskarte), AES50, 2 Netzteile'), notes: 'Modulare I/O mit Karten für Mic, Line und AES3.' }),
  mk({ id: 'midas-dl231', name: 'DL231', man: 'Midas', cat: SPLIT, u: 5, depth: 410, color: '#1b1c1e', weight: 15, logo: 'MIDAS', model: 'DL231 Mic Splitter',
    front: [G([B.list(seq('In ', 24), 'XLR3F', 'in', { rows: 3 })], 'center')],
    rear: [G([PSU2, B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { rows: 2, gap: 10 })]), G([B.list(seq('Split ', 24), 'XLR3M', 'out', { rows: 3 })], 'right')],
    src: sheet('Midas DL231: 5 HE, 483 × 222 × 410 mm, 15 kg; 24 Mic-Eingänge mit Vorverstärker, 24 trafogetrennte Split-Ausgänge, 2 × AES50, 2 Netzteile'), notes: 'Aktiver Splitter 24 → 2 × 24, ein Ausgang analog.' }),
  mk({ id: 'beh-sd8', name: 'SD8', man: 'Behringer', cat: STAGE, u: 2, bodyW: 333, depth: 95, color: '#1c1d1f', weight: 2.5, logo: 'behringer', model: 'SD8',
    front: [G([B.list(seq('In ', 8), 'XLR3F', 'in', { rows: 2 }), B.list(seq('Out ', 8), 'XLR3M', 'out', { rows: 2, gap: 8 })], 'center')],
    rear: [G([IEC, B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { gap: 10 }), B.one('Ultranet', 'RJ45', 'out', { gap: 6 })], 'center')],
    src: sheet('Behringer SD8: 333 × 149 × 95 mm, 2 HE mit Rackwinkeln, 2,5 kg; 8 Midas-Vorverstärker, 8 XLR-Ausgänge, 2 × AES50, Ultranet; AES50 und Ultranet hinten gezeichnet'), notes: 'Kleine Stagebox für X32/M32/WING.' }),
  mk({ id: 'ah-dx012', name: 'DX012', man: 'Allen & Heath', cat: STAGE, u: 1, depth: 215, color: '#1f2022', weight: 2.95, logo: 'ALLEN&HEATH', model: 'DX012',
    front: [G([B.list(seq('Out ', 12), 'XLR3M', 'out')], 'center')],
    rear: [G([IEC, B.list(['DX Link 1', 'DX Link 2'], 'ETHERCON', 'io', { gap: 10 })], 'center')],
    src: sheet('Allen & Heath DX012 Weights and Dims: 482,6 × 214,7 × 48,2 mm (1 HE), 2,95 kg; 12 XLR-Ausgänge (analog oder AES), 2 × DX-Link etherCON'), notes: 'Ausgangserweiterung für dLive, Avantis und SQ.' }),
  mk({ id: 'sc-msb32i', name: 'Mini Stagebox 32i', man: 'Soundcraft', cat: STAGE, u: 3, depth: 285, color: '#1e1f22', weight: 6, logo: 'SOUNDCRAFT', model: 'Mini Stagebox 32i',
    front: [G([B.list(seq('In ', 32), 'XLR3F', 'in', { rows: 3 })], 'center')],
    rear: [G([IEC, B.list(['MADI Cat5 A', 'MADI Cat5 B'], 'RJ45', 'io', { gap: 10 }), B.one('MADI optisch', 'SC', 'io', { gap: 6 })]), G([B.list(seq('Out ', 12), 'XLR3M', 'out', { rows: 2 })], 'right')],
    src: sheet('Soundcraft Mini Stagebox 32i: 483 × 137 × 285 mm (3 HE), 6 kg (Händlerangabe); 32 Mic-Eingänge, 12 Ausgänge, MADI über Cat5 und optisch'), notes: 'Stagebox für Si- und Vi-Pulte.' }),
  mk({ id: 'ssl-sb88', name: 'SB 8.8', man: 'Solid State Logic', cat: STAGE, u: 2, depth: 250, color: '#24262a', weight: 4, logo: 'SSL', model: 'SB 8.8',
    front: [G([B.list(seq('In ', 8), 'XLR3F', 'in', { rows: 2 }), B.list(seq('Out ', 8), 'XLR3M', 'out', { rows: 2, gap: 12 })], 'center')],
    rear: [G([PSU2, B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { gap: 10 })], 'center')],
    src: est('SSL SB 8.8: 2 HE laut User Guide; Tiefe und Gewicht nicht veröffentlicht, nach ähnlichen Stageboxen ca. 250 mm, 4 kg; 8 SuperAnalogue-Eingänge, 8 Ausgänge, Dante redundant'), notes: 'Dante-Stagebox für SSL Live, auch für andere Dante-Systeme.' }),
  mk({ id: 'ssl-sbi16', name: 'SB i16', man: 'Solid State Logic', cat: STAGE, u: 2, depth: 250, color: '#24262a', weight: 4, logo: 'SSL', model: 'SB i16',
    front: [G([B.list(seq('In ', 16), 'XLR3F', 'in', { rows: 2 })], 'center')],
    rear: [G([PSU2, B.list(['Dante Primary', 'Dante Secondary'], 'ETHERCON', 'io', { gap: 10 })], 'center')],
    src: est('SSL SB i16: 2 HE laut User Guide; Tiefe und Gewicht nicht veröffentlicht, nach ähnlichen Stageboxen ca. 250 mm, 4 kg; 16 SuperAnalogue-Eingänge, Dante redundant'), notes: 'Dante-Eingangsstagebox, 16 Mic/Line.' }),
];

// ------------------------------------------------------------------ consoles engines, processing, networks
const engines: DeviceTemplate[] = [
  ...(['192', '144'] as const).map((m) => mk({ id: `avid-e6l-${m}`, name: `VENUE E6L-${m}`, man: 'Avid', cat: 'Mischpult (Rack)', u: 5, depth: 497, color: '#1b1c1f', weight: m === '192' ? 32 : 28, logo: 'AVID', model: `E6L-${m} Engine`,
    rear: [G([PSU2]), G([B.list(['Stage 1', 'Stage 2', 'Stage 3'], 'ETHERCON', 'io'), B.list(['Control', 'AVB 1', 'AVB 2'], 'ETHERCON', 'io', { gap: 10 }), B.list(['Pro Tools', 'ECx'], 'RJ45', 'io', { gap: 10 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC75', 'io', { gap: 8 })], 'right')],
    src: m === '192' ? sheet('Avid VENUE S6L Architectural Specifications: E6L 5 HE, Tiefe ohne Frontblende 497 mm, 32 kg; Stage- und Netzwerkports (Anzahl vereinfacht), redundante Netzteile, Optionskarten weggelassen')
      : sheet('Avid E6L-144: 5 HE, Tiefe ohne Frontblende 497 mm wie E6L-192, 28 kg (Händlerangabe); Ports wie E6L-192'), notes: `DSP-Engine für VENUE S6L, ${m} Eingangskanäle.` })),
  mk({ id: 'lawo-power-core', name: 'Power Core', man: 'Lawo', cat: 'Mischpult (Rack)', u: 1, depth: 385, color: '#2a2c30', weight: 6, logo: 'LAWO', model: 'Power Core',
    rear: [G([B.list(['DC In A', 'DC In B'], 'DC', 'in')]), G([B.list(['MADI 1', 'MADI 2'], 'SFP', 'io'), B.list(['RAVENNA 1', 'RAVENNA 2', 'RAVENNA 3', 'RAVENNA 4'], 'RJ45', 'io', { gap: 8 }), B.one('Management', 'RJ45', 'io', { gap: 8 })], 'right')],
    src: sheet('Lawo Power Core Technical Specification: 44 × 483 × 385 mm (1 HE, Tiefe mit Verriegelungen), externe DC-Netzteile; 8 I/O-Steckplätze hinten weggelassen; Gewicht nicht veröffentlicht, ca. 6 kg Schätzung'), notes: 'Mix-Engine und I/O-Knoten für Radio und Broadcast (RAVENNA/AES67).' }),
  mk({ id: 'waves-extreme-c', name: 'SoundGrid Extreme Server-C', man: 'Waves', cat: DSP, u: 2, slots: 2, bodyW: 220, depth: 284, color: '#232529', weight: 3.4, logo: 'WAVES', model: 'Extreme Server-C',
    rear: [G([IEC, B.list(['SoundGrid 1', 'SoundGrid 2'], 'RJ45', 'io', { gap: 8 }), B.list(['USB 1', 'USB 2'], 'USB', 'io', { gap: 6 }), B.one('Display', 'DP', 'out', { gap: 6 })], 'center')],
    src: sheet('Waves Extreme Server-C: 220 × 86 × 284 mm, 2 HE halbe Breite, 3,4 kg (V3: 3,2 kg); 2 × Ethernet SoundGrid, USB, Display'), notes: 'Plug-in-Server für SoundGrid (Live und Studio).' }),
  mk({ id: 'waves-digigrid-mgr', name: 'DiGiGrid MGR', man: 'Waves', cat: 'Audio-Interface / Wandler', u: 1, depth: 254, color: '#232529', weight: 3.2, logo: 'DiGiGrid', model: 'MGR',
    rear: [G([PSU2]), G([B.list(['MADI In 1', 'MADI Out 1', 'MADI In 2', 'MADI Out 2'], 'MADI-BNC', 'io'), B.list(['MADI optisch 1', 'MADI optisch 2'], 'SC', 'io', { gap: 8 }), B.list(seq('SoundGrid ', 4), 'RJ45', 'io', { gap: 8 })], 'right')],
    src: sheet('Waves DiGiGrid MGR: 483 × 254 × 44 mm (1 HE), 3,2 kg; 2 MADI-Ports koaxial und optisch, eingebauter Switch, redundante Netzteile'), notes: 'MADI-SoundGrid-Interface für zwei MADI-Strecken.' }),
  mk({ id: 'disguise-vx4plus', name: 'vx 4+', man: 'disguise', cat: SRV, u: 4, depth: 593, color: '#141518', weight: 21, logo: 'disguise', model: 'vx 4+', fa: (h) => [A.vents(30, 8, 380, h - 16)],
    rear: [G([PSU2]), G([B.list(['DP Out 1', 'DP Out 2', 'DP Out 3', 'DP Out 4'], 'DP', 'out'), B.list(['10GbE 1', '10GbE 2'], 'RJ45', 'io', { gap: 10 }), B.list(['25GbE 1', '25GbE 2'], 'SFP', 'io', { gap: 8 }), B.list(['USB 1', 'USB 2'], 'USB', 'io', { gap: 8 }), B.one('Genlock', 'BNC75', 'in', { gap: 8 })], 'right')],
    src: sheet('disguise vx 4+ Architectural Spec: 445 × 178 × 593 mm, 4 HE, 21 kg; 4 Ausgänge (VFC, hier DisplayPort), 10/25 GbE, Genlock, 2 Netzteile'), notes: 'Medienserver für große LED- und Projektionsshows.' }),
  mk({ id: 'la-ls10', name: 'LS10', man: 'L-Acoustics', cat: NET, u: 1, slots: 2, bodyW: 216, depth: 133, color: '#1f2023', weight: 1.5, logo: 'L-ACOUSTICS', model: 'LS10',
    front: [G([B.list(seq('Port ', 6), 'ETHERCON', 'io'), B.list(['SFP 1', 'SFP 2'], 'SFP', 'io', { gap: 4 })], 'center')],
    rear: [G([IEC, B.list(['Port 7', 'Port 8'], 'ETHERCON', 'io', { gap: 10 })], 'center')],
    src: sheet('L-Acoustics LS10: 1 HE, halbe Breite (216 mm), 1,5 kg; Tiefe aus der Maßzeichnung ca. 133 mm (unsicher); 10 Ports, Aufteilung etherCON/SFP und vorne/hinten geschätzt'), notes: 'Milan/AVB-Switch für L-Acoustics-Systeme.' }),
  mk({ id: 'ntg-m4250-26g4f', name: 'M4250-26G4F-PoE+', man: 'Netgear', cat: NET, u: 1, depth: 257, color: '#2b2e33', weight: 4.3, logo: 'NETGEAR', model: 'M4250-26G4F-PoE+',
    front: [G([B.list(seq('Port ', 24), 'RJ45', 'io', { rows: 2 }), B.list(['Port 25', 'Port 26'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.list(seq('SFP ', 4), 'SFP', 'io', { rows: 2, gap: 6 })], 'right')],
    rear: [G([IEC], 'center')],
    src: sheet('Netgear AV Line M4250-26G4F-PoE+ (GSM4230P): 440 × 43,2 × 257 mm (1 HE), 4,3 kg; 24 × 1G PoE+, 2 × 1G, 4 × SFP'), notes: 'AV-Switch mit Profilen für Dante, AES67 und NDI.' }),
];

// ------------------------------------------------------------------ intercom, video, power
const misc: DeviceTemplate[] = [
  mk({ id: 'riedel-artist-128', name: 'Artist 128', man: 'Riedel', cat: IC, u: 6, depth: 400, color: '#202226', weight: 20, logo: 'RIEDEL', model: 'Artist 128',
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in')]), G([B.list(seq('Port ', 64), 'RJ45', 'io', { rows: 4 }), B.list(['Fiber A', 'Fiber B'], 'SFP', 'io', { gap: 10 })], 'right')],
    src: est('Riedel Artist 128: 6 HE laut Händler, bis 128 Ports auf Client-Karten (hier 64 gezeichnet), redundante Netzteile und Controller; Tiefe ca. 400 mm und Gewicht ca. 20 kg nicht veröffentlicht'), notes: 'Intercom-Matrix, größter Rahmen der Artist-Serie unter dem Artist-1024.' }),
  mk({ id: 'riedel-rsp1232hl', name: 'RSP-1232HL', man: 'Riedel', cat: IC, u: 2, depth: 138, color: '#202226', weight: 3.4, logo: 'RIEDEL', model: 'RSP-1232HL',
    front: [G([B.one('Headset', 'XLR4M', 'io')], 'left', { x0: 30 })], fa: (h) => [A.lcd(70, 8, 340, h - 16, '#dbeafe', false)],
    rear: [G([IEC]), G([B.list(['AES67 1', 'AES67 2'], 'RJ45', 'io'), B.one('AES3', 'RJ45', 'io', { gap: 8 }), B.one('GPIO', 'DSUB9', 'io', { gap: 8 })], 'right')],
    src: sheet('Riedel RSP-1232HL: 483 × 88 × 138 mm (2 HE, Einbautiefe 95 mm), 3,4 kg; 32 Hebeltasten mit Displays, Headset vorne, AES67, AES3, GPIO'), notes: 'SmartPanel mit 32 Tasten für Artist und Bolero.' }),
  mk({ id: 'riedel-rsp1216hl', name: 'RSP-1216HL', man: 'Riedel', cat: IC, u: 1, depth: 138, color: '#202226', weight: 2.2, logo: 'RIEDEL', model: 'RSP-1216HL',
    front: [G([B.one('Headset', 'XLR4M', 'io')], 'left', { x0: 30 })], fa: (h) => [A.lcd(70, 6, 340, h - 12, '#dbeafe', false)],
    rear: [G([IEC]), G([B.list(['AES67 1', 'AES67 2'], 'RJ45', 'io'), B.one('GPIO', 'DSUB9', 'io', { gap: 8 })], 'right')],
    src: est('Riedel RSP-1216HL: 1 HE laut Datenblatt; Tiefe wie RSP-1232HL (138 mm), Gewicht ca. 2,2 kg geschätzt; 16 Hebeltasten, Headset vorne, AES67'), notes: 'SmartPanel mit 16 Tasten in 1 HE.' }),
  mk({ id: 'barco-em-ex', name: 'Event Master EX', man: 'Barco', cat: VID, u: 1, depth: 404, color: '#1f2124', weight: 5.53, logo: 'BARCO', model: 'Ex',
    rear: [G([IEC]), G([B.list(['HDMI In 1', 'HDMI In 2'], 'HDMI', 'in'), B.list(['SDI In 1', 'SDI In 2'], 'BNC-SDI', 'in', { gap: 6 }), B.one('DP In', 'DP', 'in', { gap: 6 }), B.list(['HDMI Out 1', 'HDMI Out 2'], 'HDMI', 'out', { gap: 8 }), B.list(['SDI Out 1', 'SDI Out 2'], 'BNC-SDI', 'out', { gap: 6 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: sheet('Barco Ex Spec Sheet: 484,1 × 43,7 × 404,1 mm (1 HE), 5,53 kg; 4K-Ein- und Ausgänge HDMI 2.0, 12G-SDI und DisplayPort (Belegung vereinfacht), Netzwerk'), notes: 'Kompakter Bildprozessor der Event-Master-Familie, auch als Erweiterung zum E2.' }),
  mk({ id: 'nova-mx30', name: 'MX30', man: 'Novastar', cat: LED, u: 2, depth: 394, color: '#1d1f22', weight: 7.2, logo: 'NOVASTAR', model: 'COEX MX30', fa: touch(),
    rear: [G([IEC]), G([B.list(['HDMI 2.0 In 1', 'HDMI 2.0 In 2'], 'HDMI', 'in'), B.one('DP 1.2 In', 'DP', 'in', { gap: 6 }), B.list(['12G-SDI In', '12G-SDI Loop'], 'BNC-SDI', 'io', { gap: 6 }), B.list(seq('Out ', 10), 'RJ45', 'out', { rows: 2, gap: 8 }), B.list(['OPT 1', 'OPT 2'], 'SFP', 'out', { rows: 2, gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 })], 'right')],
    src: sheet('Novastar MX30: 2 HE, 446 × 88 × 394 mm ohne Griffe (467 mm mit), 7,2 kg; 4K-Eingänge HDMI 2.0, DP 1.2, 12G-SDI; Gigabit- und Glasfaserausgänge (Anzahl vereinfacht)'), notes: 'LED-Controller der COEX-Serie, zwischen MX20 und MX40 Pro.' }),
  mk({ id: 'furman-p1800pfr', name: 'P-1800 PF R', man: 'Furman', cat: PWR, u: 1, depth: 267, color: '#1c1d1f', weight: 5.9, logo: 'FURMAN', model: 'P-1800 PF R', fa: (h) => [A.lcd(320, h / 2 - 8, 60, 16, '#fde68a', false)],
    rear: [G([B.one('Power In', 'GENERIC', 'in')]), G([B.list(seq('Out ', 8), 'GENERIC', 'out', { rows: 2 })], 'right')],
    src: sheet('Furman P-1800 PF R: 482,6 × 44,45 × 267 mm (1 HE, Tiefe je nach Quelle 267 bis 305 mm), 5,9 kg; Netzfilter mit Spannungsanzeige, 120-V-Modell mit NEMA-Steckdosen'), notes: 'Netzaufbereitung mit Power-Factor-Technik (US-Ausführung).' }),
];

export const COMPLETE7_DEVICES: DeviceTemplate[] = [...amps, ...stage, ...engines, ...misc];
