import type { DeviceTemplate } from '../model/types';
import { A, B, G, mk } from './proLayout';

/*
 * Sixth completion pass (11/2026): devices missing at manufacturers already in the library. Height, size, weight and
 * the connector set come from the data sheet or spec page named in `source`; positions on the panels are estimated.
 */

const STAGE = 'Stagebox', IC = 'Intercom', AMP = 'Endstufen', DSP = 'Signalprozessor', CONV = 'Audio-Interface / Wandler', NET = 'Netzwerk', VID = 'Video', LED = 'LED-Prozessor', STU = 'Studio-Interfaces';
const sheet = (what: string) => `Datenblatt – ${what}; Positionen geschätzt (±10 mm)`;
const seq = (pre: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => `${pre}${start + i}`);
const IEC = B.one('Power In', 'IEC_C14', 'in');
const PSU2 = B.list(['Power A', 'Power B'], 'IEC_C14', 'in');

const audio: DeviceTemplate[] = [
  mk({ id: 'yam-xmv8280', name: 'XMV8280', man: 'Yamaha', cat: AMP, u: 2, depth: 422, color: '#232528', weight: 8.1, logo: 'YAMAHA', model: 'XMV8280',
    rear: [G([IEC]), G([B.list(seq('In ', 8), 'PHOENIX3', 'in', { rows: 2 }), B.list(['YDIF In', 'YDIF Out'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.one('Network', 'RJ45', 'io', { gap: 6 }), B.list(seq('Out ', 8), 'PHOENIX-SPK', 'out', { rows: 2, gap: 10 })], 'right')],
    src: sheet('Yamaha XMV-Serie: 480 × 88 × 422 mm (2 HE), 8,1 kg; 8 Kanäle à 280 W, Euroblock-Eingänge und Lautsprecherausgänge, YDIF, Netzwerk'), notes: 'Installationsendstufe, 8 × 280 W an 4/8 Ω oder 100/70 V.' }),
  mk({ id: 'yam-dme7', name: 'DME7', man: 'Yamaha', cat: DSP, u: 3, depth: 363, color: '#232528', weight: 9.5, logo: 'YAMAHA', model: 'DME7', fa: (h) => [A.lcd(150, h / 2 - 14, 90, 28, '#dbeafe', false)],
    rear: [G([PSU2]), G([B.one('Dante / Netzwerk', 'RJ45', 'io'), B.list(['MIDI In', 'MIDI Out'], 'DIN5', 'io', { gap: 8 }), B.list(['GPI 1', 'GPI 2'], 'PHOENIX3', 'io', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 8 })], 'right')],
    src: sheet('Yamaha DME7: 480 × 132 × 363 mm (3 HE), 9,5 kg; 2 × Netzbuchse, RJ45, MIDI In/Out (DIN 5), 2 × GPI (Euroblock 16-pol.), USB; 64 × 64 Dante, erweiterbar'), notes: 'Offener DSP mit Dante.' }),
  mk({ id: 'yam-swr2311p', name: 'SWR2311P-10G', man: 'Yamaha', cat: NET, u: 1, slots: 2, bodyW: 220, depth: 294, color: '#232528', weight: 2.3, logo: 'YAMAHA', model: 'SWR2311P-10G',
    front: [G([B.list(seq('Port ', 8), 'RJ45', 'io', { rows: 2 }), B.list(['Port 9 (SFP)', 'Port 10 (SFP)'], 'SFP', 'io', { rows: 2, gap: 6 }), B.one('Console', 'RJ45', 'io', { gap: 6 })], 'center')],
    rear: [G([IEC], 'center')],
    src: sheet('Yamaha SWR2311P-10G: 220 × 42,4 × 294 mm, 2,3 kg; 8 × LAN mit PoE, 2 × LAN/SFP-Kombi, Konsole RJ45; Rackwinkel RK-SWR für 1 HE'), notes: 'Managed Dante-Switch mit PoE, halbe Rackbreite.' }),
  mk({ id: 'ah-me-u', name: 'ME-U', man: 'Allen & Heath', cat: NET, u: 2, depth: 253, color: '#1f2022', weight: 4.6, logo: 'ALLEN&HEATH', model: 'ME-U Hub',
    rear: [G([IEC]), G([B.one('Eingang (Karte)', 'ETHERCON', 'in'), B.list(seq('ME Out ', 10), 'ETHERCON', 'out', { rows: 2, gap: 12 })], 'right')],
    src: sheet('Allen & Heath ME-U: 483 × 253 × 92 mm (2 HE), 4,6 kg; 10 Ports etherCON mit PoE (15 W), Eingangskarte (Standard, Dante, MADI, Waves)'), notes: 'Hub für ME-1/ME-500 Personal-Monitormixer.' }),
  mk({ id: 'ah-ahm32', name: 'AHM-32', man: 'Allen & Heath', cat: DSP, u: 1, depth: 270, color: '#1f2022', weight: 4, logo: 'ALLEN&HEATH', model: 'AHM-32',
    rear: [G([IEC]), G([B.list(seq('In ', 12), 'PHOENIX3', 'in', { rows: 2 }), B.list(seq('Out ', 12), 'PHOENIX3', 'out', { rows: 2, gap: 8 }), B.one('Network', 'RJ45', 'io', { gap: 8 }), B.one('SLink', 'ETHERCON', 'io', { gap: 6 })], 'right')],
    src: sheet('Allen & Heath AHM-32: 483 × 270 × 44 mm (1 HE), 4 kg; 24 Phoenix-Stecker 3-pol. (12 Ein, 12 Aus), Netzwerk, SLink, Steckplatz für I/O-Karte (weggelassen)'), notes: 'Audio-Matrix-Prozessor 32 × 32.' }),
  mk({ id: 'beh-sd16', name: 'SD16', man: 'Behringer', cat: STAGE, u: 3, bodyW: 333, depth: 149, color: '#1c1d1f', weight: 3.2, logo: 'behringer', model: 'SD16',
    front: [G([B.list(seq('In ', 16), 'COMBO', 'in', { rows: 2 }), B.list(seq('Out ', 8), 'XLR3M', 'out', { rows: 2, gap: 8 })], 'center')],
    rear: [G([IEC, B.list(['AES50 A', 'AES50 B'], 'ETHERCON', 'io', { gap: 10 }), B.one('Ultranet', 'RJ45', 'out', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 6 })], 'center')],
    src: sheet('Behringer/Thomann SD16: 333 × 149 × 140 mm, 3 HE mit Rackwinkeln, 3,2 kg; 16 Mic/Line-Eingänge, 8 XLR-Ausgänge, 2 × AES50 (etherCON), Ultranet, USB; AES50 und Ultranet hinten gezeichnet'), notes: 'Stagebox für X32/M32/WING, mit Rackwinkeln auf 19".' }),
  mk({ id: 'midas-dl431', name: 'DL431', man: 'Midas', cat: STAGE, u: 6, depth: 402, color: '#1b1c1e', weight: 21.5, logo: 'MIDAS', model: 'DL431 Mic Splitter',
    front: [G([B.list(seq('In ', 24), 'XLR3F', 'in', { rows: 2 })], 'right')],
    rear: [G([PSU2, B.list(['AES50 A1', 'AES50 A2', 'AES50 B1', 'AES50 B2', 'AES50 C1', 'AES50 C2'], 'ETHERCON', 'io', { rows: 6, gap: 8 })]), G([B.list([...seq('Out A', 24), ...seq('Out B', 24), ...seq('Out C', 24)], 'XLR3M', 'out', { rows: 6 })], 'right')],
    src: sheet('Midas DL431 Product Information: 19", 6 HE, Einbautiefe 402 mm, 21,5 kg; 24 Mic/Line-Eingänge mit je drei Vorverstärkern, 72 Ausgänge, AES50, 2 Netzteile; Verteilung der Buchsen auf Front und Rückseite sowie Zahl der AES50-Buchsen geschätzt'), notes: 'Aktiver Mikrofonsplitter 24 → 3 × 24.' }),
  mk({ id: 'db-ds100', name: 'DS100', man: 'd&b audiotechnik', cat: DSP, u: 3, depth: 481, color: '#2a2b2e', weight: 11.2, logo: 'd&b', model: 'DS100 Signal Engine',
    rear: [G([IEC]), G([B.one('Ethernet', 'RJ45', 'io'), B.list(['Dante Primary', 'Dante Secondary'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: sheet('d&b DS100: 3 HE, Tiefe 481 mm, 11,2 kg; IEC, Ethernet (OCA/OSC), 2 × RJ45 Dante Primary/Secondary'), notes: 'Soundscape-Prozessor, 64 × 64 Dante.' }),
  ...(['4K4', '8K4'] as const).map((m) => mk({ id: `qsc-cxq${m.toLowerCase()}`, name: `CX-Q ${m}`, man: 'QSC', cat: AMP, u: 2, depth: 406, color: '#1d1e20', weight: m === '4K4' ? 11.3 : 11.8, logo: 'Q-SYS', model: `CX-Q ${m}`,
    rear: [G([IEC]), G([B.list(['Q-LAN A', 'Q-LAN B'], 'RJ45', 'io'), B.list(seq('In ', 4), 'PHOENIX3', 'in', { gap: 10 }), B.one('GPIO', 'GENERIC', 'io', { gap: 8 }), B.list(seq('Out ', 4), 'PHOENIX-SPK', 'out', { gap: 10 })], 'right')],
    src: sheet(`QSC CX-Q ${m}: 89 × 482 × 406 mm (2 HE), ${m === '4K4' ? '11,3' : '11,8'} kg; 2 × Q-LAN, 4 Eingänge (Euroblock 3-pol.), 4 Lautsprecherausgänge (Euroblock), GPIO, IEC`), notes: `Netzwerk-Endstufe für Q-SYS, ${m === '4K4' ? '4000' : '8000'} W.` })),
  ...(['24Ai', '24Ao'] as const).map((m) => mk({ id: `motu-${m.toLowerCase()}`, name: m, man: 'MOTU', cat: STU, u: 1, depth: 177.5, color: '#2a2c30', weight: m === '24Ai' ? 2.08 : 1.99, logo: 'MOTU', model: m,
    rear: [G([IEC]), G([B.list(m === '24Ai' ? ['Analog In 1-8', 'Analog In 9-16', 'Analog In 17-24'] : ['Analog Out 1-8', 'Analog Out 9-16', 'Analog Out 17-24'], 'DSUB25', m === '24Ai' ? 'in' : 'out'), B.list(['Optical In A', 'Optical In B', 'Optical In C'], 'TOSLINK', 'in', { gap: 8 }), B.list(['Optical Out A', 'Optical Out B', 'Optical Out C'], 'TOSLINK', 'out', { gap: 4 }), B.list(['Word Clock In', 'Word Clock Out'], 'BNC', 'io', { gap: 8 }), B.one('AVB', 'RJ45', 'io', { gap: 6 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    src: sheet(`MOTU ${m}: 483 × 177,5 × 45 mm (1 HE), ${m === '24Ai' ? '2,08' : '1,99'} kg; 24 analoge ${m === '24Ai' ? 'Eingänge' : 'Ausgänge'} auf 3 × D-Sub 25, 3 × ADAT optisch Ein/Aus, Word Clock, AVB, USB`), notes: `AVB-Interface mit 24 analogen ${m === '24Ai' ? 'Eingängen' : 'Ausgängen'}.` })),
  mk({ id: 'merging-hapi-mk2', name: 'HAPI MkII', man: 'Merging Technologies', cat: CONV, u: 1, depth: 320, color: '#26282c', weight: 4.5, logo: 'MERGING', model: 'HAPI MkII',
    rear: [G([IEC]), G([B.list(['Analog Karte 1', 'Analog Karte 2'], 'DSUB25', 'io'), B.list(['MADI In', 'MADI Out'], 'MADI-BNC', 'io', { gap: 8 }), B.one('MADI optisch', 'SC', 'io', { gap: 6 }), B.list(['ADAT In', 'ADAT Out'], 'TOSLINK', 'io', { gap: 6 }), B.one('Sync (LTC/Video/MIDI)', 'GENERIC', 'io', { gap: 6 }), B.list(['RAVENNA 1', 'RAVENNA 2'], 'RJ45', 'io', { gap: 8 })], 'right')],
    src: sheet('Merging HAPI MkII: 483 × 320 × 44 mm (1 HE), 4,5 kg ohne zweites Netzteil; RAVENNA/AES67 (2 × RJ45), MADI BNC und SC, ADAT/S/PDIF optisch, Sync D-Sub 15, analoge Karten auf D-Sub 25'), notes: 'Modularer RAVENNA/AES67-Wandler, Kartenbelegung variiert.' }),
];

const comms: DeviceTemplate[] = [
  mk({ id: 'cc-freespeak-edge-base', name: 'FreeSpeak Edge Base', man: 'Clear-Com', cat: IC, u: 1, depth: 260, color: '#25272a', weight: 3.29, logo: 'CLEAR-COM', model: 'FSE-BASE',
    front: [G([B.one('Headset', 'XLR4M', 'io')], 'left', { x0: 40 })], fa: (h) => [A.lcd(150, h / 2 - 10, 110, 20, '#dbeafe', false)],
    rear: [G([IEC]), G([B.list(['Antenne 1', 'Antenne 2'], 'RJ45', 'io'), B.list(['Fiber 1', 'Fiber 2'], 'SFP', 'io', { gap: 8 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 8 }), B.list(['Sync In', 'Sync Out'], 'RJ45', 'io', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 6 })], 'right')],
    src: sheet('Clear-Com FSE-BASE: 1 HE, Tiefe 260 mm, 3,29 kg; Headset XLR 4-pol. vorne, 2 × E1-Antenne RJ45, 2 × Glasfaser, Netzwerk, RF-Sync In/Out RJ45, USB; Audio-Ports (2-Draht/4-Draht) weggelassen'), notes: 'Basisstation für FreeSpeak Edge (1,9 und 5 GHz), bis 16 Beltpacks.' }),
  mk({ id: 'cc-hx-omega', name: 'Eclipse HX-Omega', man: 'Clear-Com', cat: IC, u: 6, depth: 410, color: '#25272a', weight: 35, logo: 'CLEAR-COM', model: 'Eclipse HX-Omega',
    rear: [G([IEC, B.one('Power Redundant', 'IEC_C14', 'in', { gap: 6 })]), G([B.list(seq('Port ', 48), 'RJ45', 'io', { rows: 4 }), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 10 })], 'right')],
    src: sheet('Clear-Com Eclipse HX-Omega: 482 × 267 × 410 mm (6 HE), 20 bis 35 kg je nach Bestückung, 15 Kartensteckplätze; Portzahl je nach Karten, hier 48 gezeichnet'), notes: 'Digitale Intercom-Matrix, Ports je nach Karten.' }),
];

const video: DeviceTemplate[] = [
  mk({ id: 'bmd-atem-constellation-8k', name: 'ATEM Constellation 8K', man: 'Blackmagic Design', cat: VID, u: 2, depth: 336, color: '#2a2c30', weight: 8.4, logo: 'Blackmagic Design', model: 'ATEM Constellation 8K',
    rear: [G([PSU2]), G([B.list(seq('SDI In ', 40), 'BNC-SDI', 'in', { rows: 4 }), B.list(seq('SDI Out ', 24), 'BNC-SDI', 'out', { rows: 4, gap: 8 }), B.one('Ref In', 'BNC75', 'in', { gap: 6 }), B.one('Ethernet', 'RJ45', 'io', { gap: 6 }), B.one('USB-C', 'USB-C', 'io', { gap: 4 })], 'right')],
    src: sheet('Blackmagic ATEM Constellation 8K: 2 HE, 482,6 × 336 × 90 mm, 8,4 kg; 40 × 12G-SDI Eingänge, 24 × 12G-SDI Aux-Ausgänge, Referenz, Ethernet, USB; Audio- und Talkback-Buchsen weggelassen'), notes: 'Bildmischer 4 M/E, 8K/UHD/HD.' }),
  mk({ id: 'bmd-hyperdeck-studio-4k-pro', name: 'HyperDeck Studio 4K Pro', man: 'Blackmagic Design', cat: VID, u: 1, depth: 236, color: '#2a2c30', weight: 2.5, logo: 'Blackmagic Design', model: 'HyperDeck Studio 4K Pro',
    rear: [G([PSU2, B.one('12V DC', 'XLR4M', 'in', { gap: 6 })]), G([B.one('SDI In', 'BNC-SDI', 'in'), B.list(['SDI Out A', 'SDI Out B', 'SDI Monitor'], 'BNC-SDI', 'out', { gap: 6 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { gap: 6 }), B.list(['Ref In', 'Ref Out'], 'BNC75', 'io', { gap: 6 }), B.list(['Timecode In', 'Timecode Out'], 'XLR3F', 'io', { gap: 6 }), B.list(['RS-422 In', 'RS-422 Out'], 'DSUB9', 'io', { gap: 6 }), B.one('Ethernet 10G', 'RJ45', 'io', { gap: 6 }), B.one('USB-C', 'USB-C', 'io', { gap: 4 })], 'right')],
    src: sheet('Blackmagic HyperDeck Studio 4K Pro: 1 HE, 483 × 236 × 44 mm, 2,5 kg (Händler); SDI In, 2 × SDI Out, SDI Monitor, HDMI In/Out, Timecode XLR, Referenz BNC, RS-422, 12 V XLR 4-pol., 2 Netzteile, USB-C, 10G Ethernet; analoge Audioeingänge weggelassen'), notes: 'Rekorder für SD-Karte, SSD und USB-Laufwerk.' }),
  mk({ id: 'aja-kipro-ultra-12g', name: 'Ki Pro Ultra 12G', man: 'AJA', cat: VID, u: 2, slots: 2, bodyW: 237, depth: 220, color: '#26282c', weight: 2.6, logo: 'AJA', model: 'Ki Pro Ultra 12G',
    rear: [G([B.one('Power 12V', 'XLR4M', 'in')]), G([B.list(['12G-SDI In 1', ...seq('SDI In ', 3, 2)], 'BNC-SDI', 'in', { rows: 2 }), B.list(['12G-SDI Out 1', ...seq('SDI Out ', 3, 2)], 'BNC-SDI', 'out', { rows: 2, gap: 6 }), B.one('SDI Monitor', 'BNC-SDI', 'out', { gap: 6 }), B.list(['HDMI In', 'HDMI Out'], 'HDMI', 'io', { rows: 2, gap: 6 }), B.list(['Ref In 1', 'Ref In 2'], 'BNC75', 'in', { rows: 2, gap: 6 }), B.list(['LAN', 'RS-422'], 'RJ45', 'io', { rows: 2, gap: 6 })], 'right')],
    src: sheet('AJA Ki Pro Ultra 12G: 2 HE, halbe Rackbreite, 237 × 220 × 84 mm, 2,6 kg; 12G-SDI Ein/Aus, 3 × 3G-SDI Ein/Aus, HDMI Ein/Aus, SDI Monitor, SFP-Schächte, LAN, RS-422 (D-Sub 9, hier RJ45 gezeichnet), Ref; SFP und Ref Out weggelassen'), notes: 'Rekorder/Player, 4 Kanäle HD oder 1 × 4K; seit 09/2024 abgekündigt.' }),
  mk({ id: 'nova-vx600', name: 'VX600', man: 'Novastar', cat: LED, u: 1, depth: 351.2, color: '#1d1f23', weight: 4, logo: 'NOVASTAR', model: 'VX600',
    rear: [G([IEC]), G([B.list(['3G-SDI In', '3G-SDI Loop'], 'BNC-SDI', 'io'), B.list(['HDMI In 1', 'HDMI Loop', 'HDMI In 2'], 'HDMI', 'io', { gap: 6 }), B.list(['DVI In', 'DVI Loop'], 'DVI', 'io', { gap: 6 }), B.rj(6, 'Out ', { gap: 8 }), B.list(['OPT 1', 'OPT 2'], 'SFP', 'io', { gap: 6 })], 'right')],
    src: sheet('Novastar/Händler VX600: 483,6 × 351,2 × 50,1 mm (1 HE), 4 kg; 3G-SDI In/Loop, HDMI 1.3 In/Loop, HDMI In, DVI In/Loop, 6 × RJ45 Ausgang, 2 × 10G optisch'), notes: 'All-in-one-Controller bis 3,9 Mio. Pixel.' }),
  mk({ id: 'nova-mx20', name: 'MX20', man: 'Novastar', cat: LED, u: 1, depth: 384, color: '#1d1f23', weight: 4.5, logo: 'NOVASTAR', model: 'MX20 (COEX)',
    rear: [G([IEC]), G([B.list(['HDMI In 1', 'HDMI In 2', 'HDMI Loop 1', 'HDMI Loop 2'], 'HDMI', 'io', { rows: 2 }), B.list(['SDI In 1', 'SDI In 2', 'SDI Loop 1', 'SDI Loop 2'], 'BNC-SDI', 'io', { rows: 2, gap: 6 }), B.one('Genlock', 'BNC75', 'in', { gap: 6 }), B.rj(6, 'Ethernet ', { rows: 2, gap: 8 }), B.one('OPT 10G', 'SFP', 'io', { gap: 6 })], 'right')],
    src: sheet('Novastar/Händler MX20: 482,6 × 384 × 49,9 mm (1 HE), 4,5 kg; 2 × HDMI 1.3 mit Loop, 2 × 3G-SDI mit Loop, 6 × Gigabit-Ethernet, 1 × 10G optisch, Genlock'), notes: 'COEX-Controller, 3 Layer.' }),
];

export const COMPLETE6_DEVICES: DeviceTemplate[] = [...audio, ...comms, ...video];
