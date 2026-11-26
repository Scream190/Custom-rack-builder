/*
 * Pin assignments of self-made cables. Every connector maps to a family of signals; two ends of the same family are
 * wired by signal name (e.g. XLR pin 2 "+" to the jack tip). Only standardised assignments are listed – connectors
 * without one (USB, HDMI, fibre, Harting, Socapex, CA-COM …) return null and get no diagram.
 */

export interface Pin { pin: string; sig: string }
export interface PinSet { family: string; pins: Pin[] }

export interface Wire { a?: string; b?: string; sig: string; color: string; stripe?: string }
export interface Wiring {
  a: PinSet;
  b: PinSet;
  wires: Wire[];
  /** links on one side (e.g. XLR pin 3 to pin 1 when going unbalanced) */
  bridges: { side: 'a' | 'b'; from: string; to: string }[];
  notes: string[];
}

const AUDIO_XLR: Pin[] = [{ pin: '1', sig: 'GND' }, { pin: '2', sig: '+' }, { pin: '3', sig: '−' }];
const AUDIO_TRS: Pin[] = [{ pin: 'T', sig: '+' }, { pin: 'R', sig: '−' }, { pin: 'S', sig: 'GND' }];
const NET: Pin[] = ['1', '2', '3', '4', '5', '6', '7', '8'].map((p) => ({ pin: p, sig: p }));
const MAINS1 = (pe = '⏚'): Pin[] => [{ pin: 'L', sig: 'L' }, { pin: 'N', sig: 'N' }, { pin: pe, sig: 'PE' }];

export function pinsOf(connector: string): PinSet | null {
  switch (connector) {
    case 'XLR3F': case 'XLR3M': case 'COMBO': case 'AES-XLR': return { family: 'audio', pins: AUDIO_XLR };
    case 'JACK': case 'JACK-D': case 'TT': return { family: 'audio', pins: AUDIO_TRS };
    case 'PHOENIX3': return { family: 'audio', pins: [{ pin: '+', sig: '+' }, { pin: '−', sig: '−' }, { pin: '⏚', sig: 'GND' }] };
    case 'RCA': return { family: 'audio', pins: [{ pin: 'I', sig: '+' }, { pin: 'M', sig: 'GND' }] };
    case 'MINIJACK': return { family: 'stereo', pins: [{ pin: 'T', sig: 'L' }, { pin: 'R', sig: 'R' }, { pin: 'S', sig: 'GND' }] };
    case 'XLR5F': case 'XLR5M': return { family: 'dmx', pins: [{ pin: '1', sig: 'GND' }, { pin: '2', sig: 'Data −' }, { pin: '3', sig: 'Data +' }, { pin: '4', sig: 'Data 2 −' }, { pin: '5', sig: 'Data 2 +' }] };
    case 'XLR4F': case 'XLR4M': return { family: 'xlr4', pins: ['1', '2', '3', '4'].map((p) => ({ pin: p, sig: `Pin ${p}` })) };
    case 'SPEAKON': return { family: 'speaker', pins: ['1+', '1−', '2+', '2−'].map((p) => ({ pin: p, sig: p })) };
    case 'SPEAKON8': return { family: 'speaker', pins: ['1+', '1−', '2+', '2−', '3+', '3−', '4+', '4−'].map((p) => ({ pin: p, sig: p })) };
    case 'PHOENIX-SPK': return { family: 'speaker', pins: [{ pin: '+', sig: '1+' }, { pin: '−', sig: '1−' }] };
    case 'BNC': case 'BNC-D': case 'BNC75': case 'BNC-SDI': case 'MADI-BNC': case 'TNC': case 'N': case 'N-D': case 'SMA':
      return { family: 'coax', pins: [{ pin: 'I', sig: 'Innenleiter' }, { pin: 'M', sig: 'Schirm' }] };
    case 'RJ45': case 'ETHERCON': return { family: 'net', pins: NET };
    case 'DIN5': return { family: 'midi', pins: [{ pin: '4', sig: 'Strom' }, { pin: '5', sig: 'Daten' }, { pin: '2', sig: 'Schirm' }] };
    case 'IEC_C13': case 'IEC_C14': case 'IEC_C19': case 'IEC_C20': case 'SCHUKO': case 'POWERCON_IN': case 'POWERCON_OUT':
    case 'POWERCON32_IN': case 'TRUE1_IN': case 'TRUE1_OUT': return { family: 'mains1', pins: MAINS1() };
    case 'CEE16': return { family: 'mains1', pins: MAINS1('PE') };
    case 'CEE16_3P': case 'CEE32_3P': case 'CEE63_3P':
      return { family: 'mains3', pins: ['L1', 'L2', 'L3', 'N', 'PE'].map((p) => ({ pin: p, sig: p })) };
    case 'CEE16_4P': return { family: 'mains3', pins: ['L1', 'L2', 'L3', 'PE'].map((p) => ({ pin: p, sig: p })) };
    case 'DSUB25': case 'DSUB25-AES': return { family: 'dsub25', pins: DSUB25 };
    default: return null;
  }
}

/** AES59 (Tascam analogue) D-Sub 25: hot / cold / ground per channel */
export const AES59: [number, number, number][] = [[24, 12, 25], [10, 23, 11], [21, 9, 22], [7, 20, 8], [18, 6, 19], [4, 17, 5], [15, 3, 16], [1, 14, 2]];
const DSUB25: Pin[] = AES59.flatMap(([h, c, g], i) => [
  { pin: String(h), sig: `${i + 1}+` }, { pin: String(c), sig: `${i + 1}−` }, { pin: String(g), sig: `${i + 1} GND` },
]);

// conductor colours: standardised for mains (IEC 60446) and network (T568B); audio/speaker colours vary by cable
const T568B: Record<string, [string, string?]> = {
  '1': ['#f97316', '#ffffff'], '2': ['#f97316'], '3': ['#16a34a', '#ffffff'], '4': ['#2563eb'],
  '5': ['#2563eb', '#ffffff'], '6': ['#16a34a'], '7': ['#92400e', '#ffffff'], '8': ['#92400e'],
};
const COLOR: Record<string, [string, string?]> = {
  '+': ['#dc2626'], '−': ['#f5f5f4'], GND: ['#9ca3af'], L: ['#c2410c'], R: ['#2563eb'],
  'Data +': ['#dc2626'], 'Data −': ['#f5f5f4'], 'Data 2 +': ['#2563eb'], 'Data 2 −': ['#facc15'],
  '1+': ['#dc2626'], '1−': ['#1f2937'], '2+': ['#2563eb'], '2−': ['#9ca3af'], '3+': ['#16a34a'], '3−': ['#a16207'], '4+': ['#9333ea'], '4−': ['#f5f5f4'],
  Innenleiter: ['#d97706'], Schirm: ['#9ca3af'],
  L1: ['#7c4a1e'], L2: ['#111111'], L3: ['#9ca3af'], N: ['#2563eb'], PE: ['#16a34a', '#facc15'],
  Strom: ['#dc2626'], Daten: ['#2563eb'], 'Pin 1': ['#9ca3af'], 'Pin 2': ['#dc2626'], 'Pin 3': ['#2563eb'], 'Pin 4': ['#16a34a'],
};
export const colorOf = (family: string, sig: string): [string, string?] => (family === 'net' ? T568B[sig] : sig === 'L' && family === 'mains1' ? ['#7c4a1e'] : COLOR[sig] ?? ['#6b7280']);

/** Wiring between two connectors, or null when the cable is not meant to be self-made / not standardised. */
export function wiringFor(connA: string, connB: string): Wiring | null {
  const a = pinsOf(connA), b = pinsOf(connB);
  if (!a || !b || a.family !== b.family) return null;
  const fam = a.family;
  const wires: Wire[] = [];
  const bridges: Wiring['bridges'] = [];
  const notes: string[] = [];
  const sigs = Array.from(new Set([...a.pins, ...b.pins].map((p) => p.sig)));
  for (const sig of sigs) {
    const pa = a.pins.find((p) => p.sig === sig), pb = b.pins.find((p) => p.sig === sig);
    const [color, stripe] = colorOf(fam, sig);
    if (pa && pb) wires.push({ a: pa.pin, b: pb.pin, sig, color, stripe });
  }
  // balanced → unbalanced: link the cold conductor to ground on the balanced side
  if (fam === 'audio') {
    const aCold = a.pins.find((p) => p.sig === '−'), bCold = b.pins.find((p) => p.sig === '−');
    const aG = a.pins.find((p) => p.sig === 'GND')!, bG = b.pins.find((p) => p.sig === 'GND')!;
    if (aCold && !bCold) { bridges.push({ side: 'a', from: aCold.pin, to: aG.pin }); notes.push(`Unsymmetrisch: am ${connLabel(connA)} „−“ (${aCold.pin}) mit Masse (${aG.pin}) brücken.`); }
    if (bCold && !aCold) { bridges.push({ side: 'b', from: bCold.pin, to: bG.pin }); notes.push(`Unsymmetrisch: am ${connLabel(connB)} „−“ (${bCold.pin}) mit Masse (${bG.pin}) brücken.`); }
    if (['JACK', 'JACK-D', 'TT'].some((k) => k === connA || k === connB)) notes.push('Klinke symmetrisch (TRS): Spitze +, Ring −, Schaft Masse.');
    notes.push('Schirm nur an einem Ende auflegen, wenn Brummschleifen auftreten (Ground Lift).');
  }
  if (fam === 'dmx') notes.push('DMX512: Kabel mit 110 Ω Wellenwiderstand; Pins 4/5 nur bei zweitem Universum belegen.');
  if (fam === 'net') notes.push('T568B auf beiden Seiten (1:1). Für Dante/AVB Cat5e oder besser.');
  if (fam === 'coax') notes.push(connA.includes('BNC75') || connA.includes('SDI') || connA.includes('MADI') ? 'Koax 75 Ω (z. B. für SDI/MADI/Wordclock).' : 'Koax 50 Ω (HF/Antenne).');
  if (fam === 'speaker') notes.push('Aderquerschnitt nach Kabellänge und Leistung wählen.');
  if (fam === 'mains1' || fam === 'mains3') notes.push('Netzkabel nur durch eine Elektrofachkraft konfektionieren und nach DGUV V3 prüfen.');
  if (fam === 'mains1' && (connA === 'SCHUKO' || connB === 'SCHUKO')) notes.push('Schuko ist verpolbar: L und N sind nicht festgelegt.');
  if (fam === 'dsub25') notes.push('1:1 alle Pins; Belegung AES59 (Kanal: + / − / Masse).');
  if (fam === 'xlr4') notes.push('1:1 – die Bedeutung der Pins hängt vom Gerät ab (z. B. Intercom, Not-Aus, 12 V).');
  if (fam !== 'net' && fam !== 'mains1' && fam !== 'mains3' && fam !== 'dsub25') notes.push('Aderfarben zur Unterscheidung, je nach Kabel abweichend.');
  return { a, b, wires, bridges, notes };
}

const LABELS: Record<string, string> = { XLR3F: 'XLR', XLR3M: 'XLR', COMBO: 'XLR', 'AES-XLR': 'XLR', JACK: 'Klinke', 'JACK-D': 'Klinke', TT: 'TT', PHOENIX3: 'Phoenix', RCA: 'Cinch' };
export const connLabel = (c: string) => LABELS[c] ?? c;
