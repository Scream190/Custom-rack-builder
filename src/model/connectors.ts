import type { SignalType } from './types';

export type ConnectorShape =
  | 'xlr' | 'combo' | 'bnc' | 'n' | 'sma' | 'jack' | 'rj45' | 'ethercon' | 'iec' | 'powercon'
  | 'true1' | 'schuko' | 'speakon' | 'usb' | 'hdmi' | 'dc' | 'sfp' | 'opticalcon' | 'dsub' | 'generic'
  | 'cee' | 'phoenix' | 'din' | 'harting' | 'socapex';

export interface ConnectorDef {
  key: string;
  label: string;
  signal: SignalType;
  shape: ConnectorShape;
  /** drawing size in mm (outer flange) */
  w: number;
  h: number;
  /** gender, purely informational */
  gender?: 'm' | 'f';
  /** true if it fits into a Neutrik D-size cutout (panel designer) */
  dSize?: boolean;
}

const c = (key: string, label: string, signal: SignalType, shape: ConnectorShape, w: number, h = w, extra: Partial<ConnectorDef> = {}): ConnectorDef =>
  ({ key, label, signal, shape, w, h, ...extra });

export const CONNECTORS: Record<string, ConnectorDef> = Object.fromEntries(
  [
    // RF
    c('BNC', 'BNC (50 Ω)', 'rf', 'bnc', 12),
    c('BNC75', 'BNC (75 Ω)', 'clock', 'bnc', 12),
    c('BNC-SDI', 'BNC SDI (75 Ω)', 'video', 'bnc', 12),
    c('MADI-BNC', 'BNC MADI (75 Ω)', 'aes', 'bnc', 12),
    c('BNC-D', 'BNC Durchführung (D-Size)', 'rf', 'bnc', 20, 20, { dSize: true }),
    c('TNC', 'TNC', 'rf', 'bnc', 13),
    c('N', 'N-Type', 'rf', 'n', 18, 18, { dSize: false }),
    c('N-D', 'N-Type Durchführung (D-Size)', 'rf', 'n', 20, 20, { dSize: true }),
    c('SMA', 'SMA', 'rf', 'sma', 8),
    // Audio
    c('XLR3F', 'XLR 3-pol female', 'audio', 'xlr', 24, 24, { gender: 'f', dSize: true }),
    c('XLR3M', 'XLR 3-pol male', 'audio', 'xlr', 24, 24, { gender: 'm', dSize: true }),
    c('XLR5F', 'XLR 5-pol female', 'audio', 'xlr', 24, 24, { gender: 'f', dSize: true }),
    c('XLR5M', 'XLR 5-pol male', 'audio', 'xlr', 24, 24, { gender: 'm', dSize: true }),
    c('COMBO', 'XLR/Klinke Combo (female)', 'audio', 'combo', 24, 24, { gender: 'f', dSize: true }),
    c('AES-XLR', 'AES/EBU (XLR male)', 'aes', 'xlr', 24, 24, { gender: 'm', dSize: true }),
    c('JACK', 'Klinke 6,3 mm', 'audio', 'jack', 14),
    c('JACK-D', 'Klinke 6,3 mm (D-Size)', 'audio', 'jack', 22, 22, { dSize: true }),
    c('MINIJACK', 'Klinke 3,5 mm', 'audio', 'jack', 9),
    c('SPEAKON', 'speakON', 'audio', 'speakon', 24, 24, { dSize: true }),
    c('SPEAKON8', 'speakON NL8', 'audio', 'speakon', 26, 26, { dSize: true }),
    c('CACOM', 'CA-COM 8-pol (L-Acoustics)', 'audio', 'speakon', 28, 28),
    c('PHOENIX3', 'Phoenix/Euroblock (Audio)', 'audio', 'phoenix', 15, 9),
    c('PHOENIX-SPK', 'Phoenix (Lautsprecher)', 'audio', 'phoenix', 20, 10),
    c('DSUB25', 'D-Sub 25 (8 Kanäle analog, AES59)', 'audio', 'dsub', 53, 12),
    c('DSUB25-AES', 'D-Sub 25 (AES/EBU, AES59)', 'aes', 'dsub', 53, 12),
    c('DIN5', 'MIDI (DIN 5-pol)', 'data', 'din', 16),
    c('XLR4F', 'XLR 4-pol female', 'other', 'xlr', 24, 24, { gender: 'f', dSize: true }),
    c('XLR4M', 'XLR 4-pol male', 'other', 'xlr', 24, 24, { gender: 'm', dSize: true }),
    c('TT', 'Bantam/TT (Patchbay)', 'audio', 'jack', 8),
    c('RCA', 'Cinch (RCA)', 'audio', 'jack', 10),
    c('TOSLINK', 'TOSLINK optisch (ADAT/S/PDIF)', 'aes', 'usb', 10, 8),
    c('USB-C', 'USB-C / Thunderbolt', 'data', 'usb', 10, 5),
    // Network / data
    c('RJ45', 'RJ45', 'network', 'rj45', 14, 12),
    c('ETHERCON', 'etherCON', 'network', 'ethercon', 24, 24, { dSize: true }),
    c('SFP', 'SFP', 'network', 'sfp', 14, 9),
    c('QSFP', 'QSFP (40/100 G)', 'network', 'sfp', 19, 9),
    c('LC', 'LC-Duplex (Glasfaser)', 'network', 'sfp', 13, 7),
    c('SC', 'SC-Duplex optisch (MADI)', 'aes', 'sfp', 14, 9),
    c('VGA', 'VGA (D-Sub 15)', 'video', 'dsub', 31, 12),
    c('DP', 'DisplayPort', 'video', 'hdmi', 17, 7),
    c('DVI', 'DVI-D', 'video', 'dsub', 39, 13),
    c('OPTICALCON', 'opticalCON', 'network', 'opticalcon', 24, 24, { dSize: true }),
    c('USB', 'USB', 'data', 'usb', 13, 7),
    c('USB-D', 'USB Durchführung (D-Size)', 'data', 'usb', 22, 22, { dSize: true }),
    c('HDMI', 'HDMI', 'video', 'hdmi', 16, 7),
    c('HDMI-D', 'HDMI Durchführung (D-Size)', 'video', 'hdmi', 22, 22, { dSize: true }),
    c('DSUB9', 'D-Sub 9', 'data', 'dsub', 30, 12),
    // Power
    c('IEC_C14', 'IEC C14 (Kaltgeräte Einbaustecker)', 'power', 'iec', 26, 20, { gender: 'm' }),
    c('IEC_C13', 'IEC C13 (Kaltgeräte Buchse)', 'power', 'iec', 26, 20, { gender: 'f' }),
    c('POWERCON_IN', 'powerCON IN (blau)', 'power', 'powercon', 26, 26, { dSize: true }),
    c('POWERCON_OUT', 'powerCON OUT (grau)', 'power', 'powercon', 26, 26, { dSize: true }),
    c('TRUE1_IN', 'powerCON TRUE1 IN', 'power', 'true1', 26, 26, { dSize: true }),
    c('TRUE1_OUT', 'powerCON TRUE1 OUT', 'power', 'true1', 26, 26, { dSize: true }),
    c('SCHUKO', 'Schuko', 'power', 'schuko', 38, 38),
    c('POWERCON32_IN', 'powerCON 32 A IN', 'power', 'powercon', 28, 28),
    c('IEC_C20', 'IEC C20 (16 A Einbaustecker)', 'power', 'iec', 30, 22, { gender: 'm' }),
    c('IEC_C19', 'IEC C19 (16 A Buchse)', 'power', 'iec', 30, 22, { gender: 'f' }),
    c('CEE16', 'CEE 16 A 230 V (blau)', 'power', 'cee', 40, 40),
    c('CEE16_3P', 'CEE 16 A 400 V (rot, 5-pol)', 'power', 'cee', 42, 42),
    c('CEE32_3P', 'CEE 32 A 400 V (rot, 5-pol)', 'power', 'cee', 48, 48),
    c('CEE16_4P', 'CEE 16 A 400 V (rot, 4-pol, Motor)', 'power', 'cee', 42, 42),
    c('CEE63_3P', 'CEE 63 A 400 V (rot, 5-pol)', 'power', 'cee', 60, 60),
    c('HARTING16', 'Harting 16-pol (Motor/Steuerung)', 'power', 'harting', 44, 30),
    c('SOCAPEX19', 'Socapex 19-pol (6 Stromkreise)', 'power', 'socapex', 34),
    c('DC', 'DC Hohlstecker', 'power', 'dc', 10),
    c('GENERIC', 'Sonstiger', 'other', 'generic', 14),
  ].map((d) => [d.key, d]),
);

export function connectorDef(key: string): ConnectorDef {
  return CONNECTORS[key] ?? CONNECTORS.GENERIC;
}

export const SIGNAL_LABELS: Record<SignalType, string> = {
  rf: 'HF / Antenne',
  audio: 'Audio analog',
  aes: 'AES/EBU',
  network: 'Netzwerk / Dante',
  power: 'Strom',
  clock: 'Wordclock / Sync',
  video: 'Video',
  data: 'Daten / Steuerung',
  other: 'Sonstiges',
};

/** Colours used to tint port markers by signal. */
export const SIGNAL_COLORS: Record<SignalType, string> = {
  rf: '#f2b705',
  audio: '#3b82f6',
  aes: '#a855f7',
  network: '#22c55e',
  power: '#ef4444',
  clock: '#06b6d4',
  video: '#ec4899',
  data: '#94a3b8',
  other: '#9ca3af',
};

// ---------------------------------------------------------------- cable plugs

/** cable connector needed for a panel connector: [pictogram kind (render/PlugIcon), name] */
const MATE: Record<string, [string, string]> = {
  XLR3F: ['xlr-m', 'XLR 3-pol Stecker (male)'], XLR3M: ['xlr-f', 'XLR 3-pol Kupplung (female)'],
  XLR5F: ['xlr-m', 'XLR 5-pol Stecker (male)'], XLR5M: ['xlr-f', 'XLR 5-pol Kupplung (female)'],
  XLR4F: ['xlr-m', 'XLR 4-pol Stecker (male)'], XLR4M: ['xlr-f', 'XLR 4-pol Kupplung (female)'],
  'AES-XLR': ['xlr-f', 'XLR 3-pol Kupplung (AES)'], COMBO: ['xlr-m', 'XLR-Stecker (male) oder Klinke'],
  IEC_C14: ['iec-f', 'Kaltgerätebuchse C13'], IEC_C13: ['iec-m', 'Kaltgerätestecker C14'],
  IEC_C20: ['iec16-f', 'Kaltgerätebuchse C19 (16 A)'], IEC_C19: ['iec16-m', 'Kaltgerätestecker C20 (16 A)'],
  POWERCON_IN: ['powercon-blue', 'powerCON Kabelbuchse blau'], POWERCON_OUT: ['powercon-grey', 'powerCON Kabelstecker grau'],
  POWERCON32_IN: ['powercon-blue', 'powerCON 32 A Kabelbuchse'],
  TRUE1_IN: ['true1', 'powerCON TRUE1 Kabelbuchse'], TRUE1_OUT: ['true1', 'powerCON TRUE1 Kabelstecker'],
  ETHERCON: ['ethercon', 'etherCON Kabelstecker'], RJ45: ['rj45', 'RJ45-Stecker'], SFP: ['lc', 'LC-Duplex-Stecker (SFP)'],
  QSFP: ['lc', 'MPO/LC-Stecker (QSFP)'], DP: ['hdmi', 'DisplayPort-Stecker'], DVI: ['dsub', 'DVI-D-Stecker'], LC: ['lc', 'LC-Duplex-Stecker'], VGA: ['dsub', 'VGA-Stecker (D-Sub 15)'],
  OPTICALCON: ['opticalcon', 'opticalCON Kabelstecker'],
  SPEAKON: ['speakon', 'speakON NL4 Kabelstecker'], SPEAKON8: ['speakon8', 'speakON NL8 Kabelstecker'], CACOM: ['cacom', 'CA-COM Kabelstecker'],
  JACK: ['jack', 'Klinkenstecker 6,3 mm'], 'JACK-D': ['jack', 'Klinkenstecker 6,3 mm'], MINIJACK: ['minijack', 'Klinkenstecker 3,5 mm'],
  TT: ['tt', 'Bantam/TT-Stecker'], RCA: ['rca', 'Cinch-Stecker'], TOSLINK: ['toslink', 'TOSLINK-Stecker'],
  BNC: ['bnc', 'BNC-Stecker 50 Ω'], 'BNC-D': ['bnc', 'BNC-Stecker 50 Ω'], BNC75: ['bnc', 'BNC-Stecker 75 Ω'], 'BNC-SDI': ['bnc', 'BNC-Stecker 75 Ω (SDI)'],
  'MADI-BNC': ['bnc', 'BNC-Stecker 75 Ω (MADI)'], TNC: ['bnc', 'TNC-Stecker'], N: ['n', 'N-Stecker'], 'N-D': ['n', 'N-Stecker'], SMA: ['sma', 'SMA-Stecker'],
  USB: ['usb', 'USB-Stecker'], 'USB-D': ['usb', 'USB-Stecker'], 'USB-C': ['usbc', 'USB-C-Stecker'], HDMI: ['hdmi', 'HDMI-Stecker'], 'HDMI-D': ['hdmi', 'HDMI-Stecker'],
  DSUB9: ['dsub', 'D-Sub 9 Stecker'], DSUB25: ['dsub', 'D-Sub 25 Stecker (analog)'], 'DSUB25-AES': ['dsub', 'D-Sub 25 Stecker (AES)'],
  DIN5: ['din', 'MIDI-Stecker (DIN 5-pol)'], DC: ['dc', 'DC-Hohlstecker'],
  PHOENIX3: ['phoenix', 'Phoenix-Stecker (Audio)'], 'PHOENIX-SPK': ['phoenix', 'Phoenix-Stecker (Lautsprecher)'],
  HARTING16: ['harting', 'Harting 16-pol Kabelstecker'], SOCAPEX19: ['socapex', 'Socapex 19-pol Kabelstecker'],
};
/** mains connectors without gender in the registry: sockets on distributors take a plug, device inlets a coupler */
const POWER_PLUG: Record<string, [string, string]> = {
  SCHUKO: ['schuko', 'Schuko'], CEE16: ['cee-blue', 'CEE 16 A blau'], CEE16_3P: ['cee-red', 'CEE 16 A rot 5-pol'], CEE32_3P: ['cee-red', 'CEE 32 A rot 5-pol'],
  CEE63_3P: ['cee-red-l', 'CEE 63 A rot 5-pol'], CEE16_4P: ['cee-red', 'CEE 16 A rot 4-pol'],
};

/** The cable connector needed to plug into this port (male into female and vice versa); `key` is its pictogram. */
export function cablePlug(port: { connector: string; dir?: string }): { key: string; label: string } {
  const m = MATE[port.connector];
  if (m) return { key: m[0], label: m[1] };
  const p = POWER_PLUG[port.connector];
  if (p) return port.dir === 'in' ? { key: `${p[0]}-f`, label: `${p[1]} Kupplung` } : { key: `${p[0]}-m`, label: `${p[1]} Stecker` };
  return { key: 'generic', label: `${connectorDef(port.connector).label} (Kabelseite)` };
}
