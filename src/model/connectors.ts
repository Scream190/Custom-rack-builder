import type { SignalType } from './types';

export type ConnectorShape =
  | 'xlr' | 'combo' | 'bnc' | 'n' | 'sma' | 'jack' | 'rj45' | 'ethercon' | 'iec' | 'powercon'
  | 'true1' | 'schuko' | 'speakon' | 'usb' | 'hdmi' | 'dc' | 'sfp' | 'opticalcon' | 'dsub' | 'generic'
  | 'cee' | 'phoenix' | 'din';

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
    // Network / data
    c('RJ45', 'RJ45', 'network', 'rj45', 14, 12),
    c('ETHERCON', 'etherCON', 'network', 'ethercon', 24, 24, { dSize: true }),
    c('SFP', 'SFP', 'network', 'sfp', 14, 9),
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
