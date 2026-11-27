import type { OutlinePt } from '../model/types';
import { rectOutline, shapeOutline } from '../model/inlay';

/*
 * Cut-out templates for the inlay designer: the portable gear that belongs to the 19" devices of the library
 * (handheld, bodypack and plug-on transmitters, IEM receivers, microphones, chargers, batteries, antennas).
 * Sizes in mm: l = length (incl. antenna where there is one), w = width, h = thickness / diameter.
 * `src`: 'ds' = housing size from the manufacturer's data sheet or product page, 'est' = estimated from similar
 * housings or photos (please measure before cutting). Bodypack/IEM antennas are added with an estimated length.
 */

export type CutoutKind = 'Handsender' | 'Taschensender' | 'Aufstecksender' | 'IEM-Empfänger' | 'Mikrofon' | 'Headset / Lavalier' | 'In-Ear-Hörer' | 'Ladegerät' | 'Akku' | 'Antenne';
export const CUTOUT_KINDS: CutoutKind[] = ['Handsender', 'Taschensender', 'Aufstecksender', 'IEM-Empfänger', 'Mikrofon', 'Headset / Lavalier', 'In-Ear-Hörer', 'Ladegerät', 'Akku', 'Antenne'];

export interface CutoutTemplate {
  id: string; man: string; name: string; kind: CutoutKind;
  l: number; w: number; h: number; weight?: number;
  outline: OutlinePt[];
  /** where the size comes from */
  source: string;
  /** what it belongs to, e.g. "ULX-D" */
  system?: string;
}

const ANT = 70, IEM_ANT = 50;

/** bodypack housing (l × w) with an antenna stub of `ant` mm leaving the top edge near the right side */
function bodypackOutline(l: number, w: number, ant: number): OutlinePt[] {
  if (ant <= 0) return rectOutline(l, w, 5);
  const aw = 9, a0 = w - aw - 6;
  return [{ x: 0, y: 0, r: 5 }, { x: l, y: 0, r: 5 }, { x: l, y: a0, r: 0 }, { x: l + ant, y: a0, r: aw / 2 }, { x: l + ant, y: a0 + aw, r: aw / 2 }, { x: l, y: a0 + aw, r: 0 }, { x: l, y: w, r: 5 }, { x: 0, y: w, r: 5 }];
}

type Row = [man: string, name: string, kind: CutoutKind, l: number, w: number, h: number, src: 'ds' | 'est', system?: string, weight?: number, special?: 'whip' | 'paddle' | 'clip' | 'coil' | 'flat' | 'stick' | 'boundary'];

const ROWS: Row[] = [
  // ---------------------------------------------------------------- Shure
  ['Shure', 'ULXD2 Handsender', 'Handsender', 256, 51, 51, 'ds', 'ULX-D', 0.34],
  ['Shure', 'ULXD1 Taschensender', 'Taschensender', 86, 66, 23, 'ds', 'ULX-D', 0.14],
  ['Shure', 'QLXD2 Handsender', 'Handsender', 256, 51, 51, 'ds', 'QLX-D', 0.32],
  ['Shure', 'QLXD1 Taschensender', 'Taschensender', 86, 65, 23, 'ds', 'QLX-D', 0.14],
  ['Shure', 'SLXD2 Handsender', 'Handsender', 255, 51, 51, 'est', 'SLX-D'],
  ['Shure', 'SLXD1 Taschensender', 'Taschensender', 86, 66, 23, 'est', 'SLX-D'],
  ['Shure', 'AD2 Handsender', 'Handsender', 272, 51, 51, 'est', 'Axient Digital'],
  ['Shure', 'AD1 Taschensender', 'Taschensender', 86, 66, 21, 'est', 'Axient Digital'],
  ['Shure', 'AD3 Aufstecksender', 'Aufstecksender', 105, 40, 40, 'est', 'Axient Digital'],
  ['Shure', 'ADX2 Handsender', 'Handsender', 272, 51, 51, 'est', 'Axient Digital ADX'],
  ['Shure', 'ADX2FD Handsender', 'Handsender', 272, 51, 51, 'est', 'Axient Digital ADX'],
  ['Shure', 'ADX1 Taschensender', 'Taschensender', 86, 66, 21, 'est', 'Axient Digital ADX'],
  ['Shure', 'ADX1M Micro-Taschensender', 'Taschensender', 64, 51, 16, 'est', 'Axient Digital ADX'],
  ['Shure', 'ADX3 Aufstecksender', 'Aufstecksender', 105, 40, 40, 'est', 'Axient Digital ADX'],
  ['Shure', 'AXT200 Handsender', 'Handsender', 256, 51, 51, 'est', 'Axient'],
  ['Shure', 'AXT100 Taschensender', 'Taschensender', 99, 66, 23, 'est', 'Axient'],
  ['Shure', 'UR2 Handsender', 'Handsender', 256, 51, 51, 'est', 'UHF-R'],
  ['Shure', 'UR1 Taschensender', 'Taschensender', 86, 66, 23, 'est', 'UHF-R'],
  ['Shure', 'UR1M Micro-Taschensender', 'Taschensender', 66, 56, 18, 'est', 'UHF-R'],
  ['Shure', 'UR3 Aufstecksender', 'Aufstecksender', 105, 40, 40, 'est', 'UHF-R'],
  ['Shure', 'BLX2 Handsender', 'Handsender', 245, 51, 51, 'est', 'BLX'],
  ['Shure', 'BLX1 Taschensender', 'Taschensender', 92, 64, 28, 'est', 'BLX'],
  ['Shure', 'GLXD2+ Handsender', 'Handsender', 235, 51, 51, 'est', 'GLX-D+'],
  ['Shure', 'GLXD1+ Taschensender', 'Taschensender', 86, 65, 23, 'est', 'GLX-D+'],
  ['Shure', 'SLX2 / ULX2 Handsender', 'Handsender', 250, 51, 51, 'est', 'SLX / ULX'],
  ['Shure', 'SLX1 / ULX1 Taschensender', 'Taschensender', 90, 65, 25, 'est', 'SLX / ULX'],
  ['Shure', 'P10R+ IEM-Empfänger', 'IEM-Empfänger', 99, 66, 23, 'ds', 'PSM 1000', 0.19],
  ['Shure', 'P9RA+ IEM-Empfänger', 'IEM-Empfänger', 87, 66, 23, 'est', 'PSM 900'],
  ['Shure', 'P3RA IEM-Empfänger', 'IEM-Empfänger', 86, 65, 25, 'est', 'PSM 300'],
  ['Shure', 'ADTR IEM-Empfänger', 'IEM-Empfänger', 99, 66, 23, 'est', 'Axient Digital PSM'],
  ['Shure', 'SBC220 Ladestation 2-fach', 'Ladegerät', 165, 112, 75, 'est', 'SB900'],
  ['Shure', 'SBC200 Ladestation 2-fach', 'Ladegerät', 140, 100, 70, 'est', 'SB900'],
  ['Shure', 'SB900B Akku', 'Akku', 66, 33, 20, 'est', 'ULX-D, QLX-D, AD, PSM'],
  ['Shure', 'SB910 Akku', 'Akku', 57, 33, 17, 'est', 'ADX1'],
  ['Shure', 'SB920 Akku', 'Akku', 92, 28, 28, 'est', 'ADX2', undefined, 'stick'],
  ['Shure', 'UA874 Richtantenne', 'Antenne', 345, 250, 55, 'est', 'UHF', undefined, 'paddle'],
  ['Shure', 'UA860SWB Stabantenne', 'Antenne', 215, 25, 25, 'est', 'UHF', undefined, 'whip'],
  ['Shure', 'SM58', 'Mikrofon', 162, 51, 51, 'ds', undefined, 0.3],
  ['Shure', 'Beta 58A', 'Mikrofon', 160, 50, 50, 'ds', undefined, 0.28],
  ['Shure', 'SM57', 'Mikrofon', 157, 32, 32, 'est', undefined, 0.28, 'stick'],
  ['Shure', 'Beta 57A', 'Mikrofon', 160, 38, 38, 'est', undefined, 0.28, 'stick'],
  ['Shure', 'SM86', 'Mikrofon', 190, 50, 50, 'est'],
  ['Shure', 'Beta 87A', 'Mikrofon', 192, 50, 50, 'est'],
  ['Shure', 'KSM9', 'Mikrofon', 193, 50, 50, 'est'],
  ['Shure', 'SM7B', 'Mikrofon', 191, 121, 96, 'est', undefined, 0.77, 'flat'],
  ['Shure', 'Beta 52A', 'Mikrofon', 160, 95, 95, 'est'],
  ['Shure', 'Beta 91A', 'Mikrofon', 110, 76, 40, 'est', undefined, undefined, 'boundary'],
  ['Shure', 'Beta 98AMP (mit Klemme)', 'Mikrofon', 110, 45, 40, 'est', undefined, undefined, 'clip'],
  ['Shure', 'SM81', 'Mikrofon', 212, 23, 23, 'est', undefined, undefined, 'stick'],
  ['Shure', 'Beta 53 / 54 Headset (aufgerollt)', 'Headset / Lavalier', 150, 140, 40, 'est', undefined, undefined, 'coil'],
  ['Shure', 'TwinPlex TL47 Lavalier (aufgerollt)', 'Headset / Lavalier', 70, 70, 20, 'est', undefined, undefined, 'coil'],
  ['Shure', 'SE215 / SE535 im Etui', 'In-Ear-Hörer', 100, 75, 40, 'est'],
  // ---------------------------------------------------------------- Sennheiser
  ['Sennheiser', 'SKM 6000 Handsender', 'Handsender', 270, 40, 40, 'ds', 'Digital 6000', 0.35],
  ['Sennheiser', 'SK 6000 Taschensender', 'Taschensender', 76, 62, 20, 'ds', 'Digital 6000'],
  ['Sennheiser', 'SK 6212 Mini-Taschensender', 'Taschensender', 60, 55, 18, 'est', 'Digital 6000'],
  ['Sennheiser', 'SKM 9000 Handsender', 'Handsender', 270, 40, 40, 'est', 'Digital 9000'],
  ['Sennheiser', 'SK 9000 Taschensender', 'Taschensender', 87, 65, 21, 'est', 'Digital 9000'],
  ['Sennheiser', 'EW-DX SKM Handsender', 'Handsender', 265, 50, 50, 'est', 'EW-DX'],
  ['Sennheiser', 'EW-DX SKM-S Handsender', 'Handsender', 265, 50, 50, 'est', 'EW-DX'],
  ['Sennheiser', 'EW-DX SK Taschensender', 'Taschensender', 92, 64, 24, 'est', 'EW-DX'],
  ['Sennheiser', 'EW-D SKM-S Handsender', 'Handsender', 265, 50, 50, 'est', 'EW-D'],
  ['Sennheiser', 'EW-D SK Taschensender', 'Taschensender', 90, 64, 24, 'est', 'EW-D'],
  ['Sennheiser', 'EW-D SKP Aufstecksender', 'Aufstecksender', 105, 43, 43, 'est', 'EW-D'],
  ['Sennheiser', 'SKM 100/300/500 G4 Handsender', 'Handsender', 265, 50, 50, 'ds', 'ew G4 / G3', 0.45],
  ['Sennheiser', 'SK 100/300/500 G4 Taschensender', 'Taschensender', 82, 64, 24, 'est', 'ew G4 / G3'],
  ['Sennheiser', 'SKP 100/300/500 G4 Aufstecksender', 'Aufstecksender', 105, 43, 43, 'est', 'ew G4 / G3'],
  ['Sennheiser', 'EK IEM G4 Empfänger', 'IEM-Empfänger', 82, 64, 24, 'ds', 'ew IEM G4 / G3', 0.125],
  ['Sennheiser', 'EK 2000 IEM Empfänger', 'IEM-Empfänger', 82, 64, 24, 'est', '2000 IEM'],
  ['Sennheiser', 'SKM 2000 Handsender', 'Handsender', 270, 50, 50, 'est', '2000'],
  ['Sennheiser', 'SK 2000 Taschensender', 'Taschensender', 82, 64, 24, 'est', '2000'],
  ['Sennheiser', 'XSW SKM Handsender', 'Handsender', 255, 50, 50, 'est', 'XS Wireless'],
  ['Sennheiser', 'XSW SK Taschensender', 'Taschensender', 82, 64, 24, 'est', 'XS Wireless'],
  ['Sennheiser', 'Spectera SEK Taschen-Transceiver', 'Taschensender', 90, 65, 22, 'est', 'Spectera'],
  ['Sennheiser', 'L 70 USB Ladegerät', 'Ladegerät', 160, 90, 60, 'est', 'EW-D / EW-DX'],
  ['Sennheiser', 'L 2015 Ladegerät', 'Ladegerät', 200, 110, 60, 'est', 'ew G4'],
  ['Sennheiser', 'BA 70 Akku', 'Akku', 57, 36, 18, 'est', 'EW-D / EW-DX'],
  ['Sennheiser', 'BA 2015 Akku', 'Akku', 66, 32, 20, 'est', 'ew G4 / G3'],
  ['Sennheiser', 'BA 60 Akku', 'Akku', 60, 36, 18, 'est', 'SK 6000'],
  ['Sennheiser', 'BA 61 Akku', 'Akku', 95, 30, 30, 'est', 'SKM 6000', undefined, 'stick'],
  ['Sennheiser', 'AD 3700 Richtantenne', 'Antenne', 420, 330, 60, 'est', 'UHF', undefined, 'paddle'],
  ['Sennheiser', 'A 2003 Richtantenne', 'Antenne', 320, 260, 50, 'est', 'UHF', undefined, 'paddle'],
  ['Sennheiser', 'e835', 'Mikrofon', 180, 48, 48, 'est'],
  ['Sennheiser', 'e935', 'Mikrofon', 182, 48, 48, 'est'],
  ['Sennheiser', 'e945', 'Mikrofon', 182, 48, 48, 'est'],
  ['Sennheiser', 'MD 421 II', 'Mikrofon', 200, 48, 48, 'est', undefined, undefined, 'flat'],
  ['Sennheiser', 'MD 441', 'Mikrofon', 160, 33, 33, 'est', undefined, undefined, 'flat'],
  ['Sennheiser', 'e604 (mit Klemme)', 'Mikrofon', 60, 55, 45, 'est', undefined, undefined, 'clip'],
  ['Sennheiser', 'e904 (mit Klemme)', 'Mikrofon', 65, 50, 45, 'est', undefined, undefined, 'clip'],
  ['Sennheiser', 'e906', 'Mikrofon', 135, 54, 34, 'est', undefined, undefined, 'flat'],
  ['Sennheiser', 'MKE 2 Lavalier (aufgerollt)', 'Headset / Lavalier', 70, 70, 20, 'est', undefined, undefined, 'coil'],
  ['Sennheiser', 'HSP 4 Headset (aufgerollt)', 'Headset / Lavalier', 150, 140, 40, 'est', undefined, undefined, 'coil'],
  ['Sennheiser', 'IE 400 PRO im Etui', 'In-Ear-Hörer', 100, 75, 40, 'est'],
  // ---------------------------------------------------------------- Audio-Technica
  ['Audio-Technica', 'ATW-T3202 Handsender', 'Handsender', 255, 50, 50, 'est', '3000'],
  ['Audio-Technica', 'ATW-T3201 Taschensender', 'Taschensender', 99, 69, 25, 'est', '3000'],
  ['Audio-Technica', 'ATW-T5202 Handsender', 'Handsender', 260, 50, 50, 'est', '5000'],
  ['Audio-Technica', 'ATW-T5201 Taschensender', 'Taschensender', 99, 69, 25, 'est', '5000'],
  ['Audio-Technica', 'M3R IEM-Empfänger', 'IEM-Empfänger', 99, 66, 26, 'est', 'M3'],
  // ---------------------------------------------------------------- Lectrosonics
  ['Lectrosonics', 'HHa Handsender', 'Handsender', 250, 50, 50, 'est', 'D Squared'],
  ['Lectrosonics', 'DBu Taschensender', 'Taschensender', 60, 51, 18, 'est', 'D Squared'],
  ['Lectrosonics', 'DBSM Mini-Taschensender', 'Taschensender', 53, 48, 16, 'est', 'D Squared'],
  ['Lectrosonics', 'DPR Aufstecksender', 'Aufstecksender', 96, 35, 35, 'est', 'D Squared'],
  ['Lectrosonics', 'M2R IEM-Empfänger', 'IEM-Empfänger', 89, 61, 23, 'est', 'Duet'],
  // ---------------------------------------------------------------- Wisycom, AKG, Sony, Sound Devices, EV, DPA
  ['Wisycom', 'MTH400 Handsender', 'Handsender', 258, 51, 51, 'est', 'MRK'],
  ['Wisycom', 'MTP41 Taschensender', 'Taschensender', 66, 58, 19, 'est', 'MRK'],
  ['Wisycom', 'MTP61 Taschensender', 'Taschensender', 78, 60, 20, 'est', 'MRK'],
  ['AKG', 'DHT800 Handsender', 'Handsender', 242, 48, 48, 'est', 'DMS800'],
  ['AKG', 'DPT800 Taschensender', 'Taschensender', 89, 66, 21, 'est', 'DMS800'],
  ['AKG', 'HT470 Handsender', 'Handsender', 240, 50, 50, 'est', 'WMS470'],
  ['AKG', 'PT470 Taschensender', 'Taschensender', 90, 65, 25, 'est', 'WMS470'],
  ['AKG', 'C414 XLII', 'Mikrofon', 160, 50, 38, 'est', undefined, undefined, 'flat'],
  ['AKG', 'C451 B', 'Mikrofon', 160, 19, 19, 'est', undefined, undefined, 'stick'],
  ['Sony', 'UTX-M40 Handsender', 'Handsender', 245, 50, 50, 'est', 'UWP-D'],
  ['Sony', 'UTX-B40 Taschensender', 'Taschensender', 69, 63, 24, 'est', 'UWP-D'],
  ['Sony', 'UTX-P40 Aufstecksender', 'Aufstecksender', 100, 40, 40, 'est', 'UWP-D'],
  ['Sony', 'DWM-02N Handsender', 'Handsender', 250, 50, 50, 'est', 'DWX'],
  ['Sony', 'DWT-B30 Taschensender', 'Taschensender', 88, 64, 20, 'est', 'DWX'],
  ['Sound Devices', 'Astral A20-TX Taschensender', 'Taschensender', 73, 52, 18, 'est', 'Astral'],
  ['Sound Devices', 'Astral A20-Mini Taschensender', 'Taschensender', 51, 43, 19, 'est', 'Astral'],
  ['Electro-Voice', 'RE3-HHT Handsender', 'Handsender', 258, 53, 53, 'est', 'RE3'],
  ['Electro-Voice', 'RE3-BPT Taschensender', 'Taschensender', 98, 64, 24, 'est', 'RE3'],
  ['DPA', '4099 Instrumentenmikrofon (mit Klemme)', 'Mikrofon', 110, 40, 30, 'est', undefined, undefined, 'clip'],
  ['DPA', 'd:fine Headset (aufgerollt)', 'Headset / Lavalier', 150, 140, 35, 'est', undefined, undefined, 'coil'],
  ['DPA', '4061 Lavalier (aufgerollt)', 'Headset / Lavalier', 70, 70, 20, 'est', undefined, undefined, 'coil'],
  // ---------------------------------------------------------------- studio and instrument microphones
  ['Neumann', 'KMS 105', 'Mikrofon', 182, 48, 48, 'est'],
  ['Neumann', 'KMS 104', 'Mikrofon', 182, 48, 48, 'est'],
  ['Neumann', 'KM 184', 'Mikrofon', 107, 22, 22, 'est', undefined, undefined, 'stick'],
  ['Neumann', 'U 87 Ai', 'Mikrofon', 200, 56, 56, 'est', undefined, undefined, 'flat'],
  ['Neumann', 'TLM 103', 'Mikrofon', 132, 60, 60, 'est', undefined, undefined, 'flat'],
  ['Audix', 'D6', 'Mikrofon', 105, 60, 60, 'est', undefined, undefined, 'flat'],
  ['Audix', 'i5', 'Mikrofon', 140, 37, 37, 'est', undefined, undefined, 'stick'],
  ['Audix', 'OM7', 'Mikrofon', 167, 48, 48, 'est'],
  ['Countryman', 'E6 Headset (aufgerollt)', 'Headset / Lavalier', 150, 120, 35, 'est', undefined, undefined, 'coil'],
];

function outlineFor(r: Row): OutlinePt[] {
  const [, , kind, l, w, , , , , special] = r;
  switch (special) {
    case 'whip': return shapeOutline('whip', l, w);
    case 'paddle': return shapeOutline('paddle', l, w);
    case 'clip': return rectOutline(l, w, 8);
    case 'coil': return shapeOutline('drum', l, w);
    case 'flat': return rectOutline(l, w, Math.min(w / 3, 14));
    case 'stick': return shapeOutline('stick', l, w);
    case 'boundary': return [{ x: 0, y: 0, r: 4 }, { x: l, y: 0, r: 4 }, { x: l, y: w, r: w * 0.45 }, { x: 0, y: w, r: w * 0.45 }];
    default:
  }
  switch (kind) {
    case 'Handsender': return shapeOutline('mic', l, w);
    case 'Mikrofon': return shapeOutline('mic-wired', l, w);
    case 'Taschensender': return bodypackOutline(l, w, ANT);
    case 'IEM-Empfänger': return bodypackOutline(l, w, IEM_ANT);
    case 'Aufstecksender': return shapeOutline('stick', l, w);
    case 'Ladegerät': return shapeOutline('charger', l, w);
    case 'Akku': return shapeOutline('battery-box', l, w);
    case 'In-Ear-Hörer': return rectOutline(l, w, 18);
    default: return rectOutline(l, w, 6);
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const CUTOUT_LIBRARY: CutoutTemplate[] = ROWS.map((r) => {
  const [man, name, kind, l, w, h, src, system, weight] = r;
  const antenna = kind === 'Taschensender' ? ANT : kind === 'IEM-Empfänger' ? IEM_ANT : 0;
  const total = l + antenna;
  const source = src === 'ds'
    ? `Datenblatt/Produktseite: Gehäuse ${l} × ${w} × ${h} mm${antenna ? `, Antenne ca. ${antenna} mm geschätzt` : ''}`
    : `Schätzung nach ähnlichen Gehäusen: ${l} × ${w} × ${h} mm${antenna ? ` + Antenne ca. ${antenna} mm` : ''}, bitte nachmessen`;
  return { id: `${slug(man)}-${slug(name)}`, man, name, kind, l: total, w, h, weight, outline: outlineFor(r), source, system };
});
