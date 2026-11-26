import type { DeviceTemplate, Face, Port } from '../model/types';
import { BRANDED_DEVICES } from './devicesBranded';
import { RFSCAN_DEVICES } from './devicesRfScan';
import { PRO_DEVICES } from './devicesPro';
import { PRO2_DEVICES } from './devicesPro2';
import { COMPLETE_DEVICES } from './devicesComplete';
import { BOX_DEVICES } from './devicesBoxes';
import { IT_DEVICES } from './devicesIT';
import { VIDEO_DEVICES } from './devicesVideo';

// NOTE: dimensions and connector positions are approximations meant as a useful starting point.
// Always verify against the manufacturer's data sheet – every template can be edited in the device editor.

let n = 0;
const p = (name: string, connector: string, side: Face, x: number, y: number, dir?: Port['dir']): Port => ({
  id: `p${++n}`, name, connector, side, x, y, dir,
});

/** helper: evenly spread a row of ports */
function row(prefix: string, count: number, connector: string, side: Face, x0: number, dx: number, y: number, dir?: Port['dir'], start = 1): Port[] {
  return Array.from({ length: count }, (_, i) => p(`${prefix}${i + start}`, connector, side, x0 + i * dx, y, dir));
}

function dev(t: Omit<DeviceTemplate, 'textColor' | 'rackStandard'> & Partial<Pick<DeviceTemplate, 'textColor' | 'rackStandard'>>): DeviceTemplate {
  n = 0;
  return { textColor: '#e5e7eb', rackStandard: 19, ...t, ports: t.ports.map((port, i) => ({ ...port, id: `p${i + 1}` })) };
}

const UHF_FIELDS = ['Frequenz', 'Kanal / Name', 'Gruppe'];

export const BUILTIN_DEVICES: DeviceTemplate[] = [
  ...BRANDED_DEVICES,
  ...RFSCAN_DEVICES,
  ...PRO_DEVICES,
  ...PRO2_DEVICES,
  ...COMPLETE_DEVICES,
  ...BOX_DEVICES,
  ...IT_DEVICES,
  ...VIDEO_DEVICES,
  // ---------------------------------------------------------------- Generic
  dev({
    id: 'gen-uhf-rx2', name: 'UHF Empfänger 2-Kanal', manufacturer: 'Generisch', category: 'UHF Empfänger',
    heightU: 1, slots: 1, depth: 300, color: '#30343b', fields: UHF_FIELDS,
    ports: [
      p('Power', 'IEC_C14', 'rear', 35, 22, 'in'), p('Network', 'RJ45', 'rear', 90, 22, 'io'),
      p('Out 2', 'XLR3M', 'rear', 240, 22, 'out'), p('Out 1', 'XLR3M', 'rear', 275, 22, 'out'),
      p('Ant B Out', 'BNC', 'rear', 345, 22, 'out'), p('Ant B In', 'BNC', 'rear', 370, 22, 'in'),
      p('Ant A Out', 'BNC', 'rear', 410, 22, 'out'), p('Ant A In', 'BNC', 'rear', 435, 22, 'in'),
    ],
  }),
  dev({
    id: 'gen-iem-tx2', name: 'IEM Sender 2-Kanal', manufacturer: 'Generisch', category: 'IEM Sender',
    heightU: 1, slots: 1, depth: 300, color: '#30343b', fields: UHF_FIELDS,
    ports: [
      p('Power', 'IEC_C14', 'rear', 35, 22, 'in'),
      ...row('In ', 4, 'XLR3F', 'rear', 150, 34, 22, 'in'),
      p('RF Out B', 'BNC', 'rear', 380, 22, 'out'), p('RF Out A', 'BNC', 'rear', 430, 22, 'out'),
    ],
  }),
  dev({
    id: 'gen-split-14', name: 'Antennenverteiler 1:4 (A/B)', manufacturer: 'Generisch', category: 'Antennenverteiler',
    heightU: 1, slots: 1, depth: 200, color: '#30343b',
    ports: [
      p('Power', 'IEC_C14', 'rear', 30, 22, 'in'),
      ...row('B Out ', 4, 'BNC', 'rear', 170, 25, 14, 'out'),
      ...row('A Out ', 4, 'BNC', 'rear', 170, 25, 32, 'out'),
      p('Ant B In', 'BNC', 'rear', 420, 22, 'in'), p('Ant A In', 'BNC', 'rear', 450, 22, 'in'),
    ],
  }),
  dev({
    id: 'gen-split-18', name: 'Antennenverteiler 1:8 (A/B)', manufacturer: 'Generisch', category: 'Antennenverteiler',
    heightU: 1, slots: 1, depth: 220, color: '#30343b',
    ports: [
      p('Power', 'IEC_C14', 'rear', 30, 22, 'in'),
      ...row('B Out ', 8, 'BNC', 'rear', 90, 28, 14, 'out'),
      ...row('A Out ', 8, 'BNC', 'rear', 90, 28, 32, 'out'),
      p('Ant B In', 'BNC', 'rear', 420, 22, 'in'), p('Ant A In', 'BNC', 'rear', 450, 22, 'in'),
    ],
  }),
  dev({
    id: 'gen-combiner-4', name: 'Antennen-Combiner 4:1', manufacturer: 'Generisch', category: 'Antennen-Combiner',
    heightU: 1, slots: 1, depth: 200, color: '#30343b',
    ports: [
      p('Power', 'IEC_C14', 'rear', 35, 22, 'in'),
      ...row('TX In ', 4, 'BNC', 'rear', 200, 35, 22, 'in'),
      p('Antenna Out', 'BNC', 'rear', 440, 22, 'out'),
    ],
  }),
  dev({
    id: 'gen-spectrum', name: 'Spektrumanalysator', manufacturer: 'Generisch', category: 'HF Messtechnik',
    heightU: 1, slots: 2, depth: 200, color: '#3b3f46',
    ports: [p('RF In', 'BNC', 'front', 200, 22, 'in'), p('USB', 'USB', 'rear', 40, 22, 'io'), p('DC In', 'DC', 'rear', 80, 22, 'in')],
  }),
  // ------------------------------------------------------------- Infrastruktur
  dev({
    id: 'gen-pdu-iec8', name: 'Stromverteiler 8× IEC C13', manufacturer: 'Generisch', category: 'Strom',
    heightU: 1, slots: 1, depth: 150, color: '#1f2126',
    ports: [
      p('Netz In', 'TRUE1_IN', 'front', 40, 22, 'in'),
      p('Thru', 'TRUE1_OUT', 'front', 80, 22, 'out'),
      ...row('Out ', 8, 'IEC_C13', 'rear', 60, 48, 22, 'out'),
    ],
  }),
  dev({
    id: 'gen-pdu-schuko8', name: 'Stromverteiler 8× Schuko', manufacturer: 'Generisch', category: 'Strom',
    heightU: 1, slots: 1, depth: 120, color: '#1f2126',
    ports: [p('Netz In', 'TRUE1_IN', 'front', 40, 22, 'in'), ...row('Out ', 8, 'SCHUKO', 'rear', 60, 48, 22, 'out')],
  }),
  dev({
    id: 'gen-switch8', name: 'Netzwerk-Switch 8-Port', manufacturer: 'Generisch', category: 'Netzwerk',
    heightU: 1, slots: 2, depth: 160, color: '#2d3640',
    ports: [...row('Port ', 8, 'RJ45', 'front', 50, 20, 22, 'io'), p('DC In', 'DC', 'rear', 30, 22, 'in')],
  }),
  dev({
    id: 'gen-switch16', name: 'Netzwerk-Switch 16-Port', manufacturer: 'Generisch', category: 'Netzwerk',
    heightU: 1, slots: 1, depth: 220, color: '#2d3640',
    ports: [
      ...row('Port ', 8, 'RJ45', 'front', 150, 20, 14, 'io', 1),
      ...row('Port ', 8, 'RJ45', 'front', 150, 20, 31, 'io', 9),
      p('SFP 1', 'SFP', 'front', 350, 22, 'io'), p('SFP 2', 'SFP', 'front', 372, 22, 'io'),
      p('Power', 'IEC_C14', 'rear', 40, 22, 'in'),
    ],
  }),
  dev({
    id: 'gen-patch-bnc8', name: 'Patchfeld 8× BNC', manufacturer: 'Generisch', category: 'Patchfeld',
    heightU: 1, slots: 1, depth: 40, color: '#18191c',
    ports: [
      ...row('Front ', 8, 'BNC-D', 'front', 100, 40, 22, 'io'),
      ...row('Rear ', 8, 'BNC-D', 'rear', 102.6, 40, 22, 'io'),
    ],
  }),
  dev({
    id: 'gen-patch-xlr16', name: 'Patchfeld 16× XLR', manufacturer: 'Generisch', category: 'Patchfeld',
    heightU: 1, slots: 1, depth: 50, color: '#18191c',
    ports: [
      ...row('', 16, 'XLR3F', 'front', 50, 26.5, 22, 'io'),
      ...row('R', 16, 'XLR3M', 'rear', 34.1, 26.5, 22, 'io'),
    ],
  }),
  dev({
    id: 'gen-patch-ethercon8', name: 'Patchfeld 8× etherCON', manufacturer: 'Generisch', category: 'Patchfeld',
    heightU: 1, slots: 1, depth: 50, color: '#18191c',
    ports: [...row('', 8, 'ETHERCON', 'front', 100, 40, 22, 'io'), ...row('R', 8, 'RJ45', 'rear', 102.6, 40, 22, 'io')],
  }),
  dev({ id: 'gen-blank1', name: 'Blindblende 1 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 1, slots: 1, depth: 2, color: '#141414', ports: [] }),
  dev({ id: 'gen-blank2', name: 'Blindblende 2 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 2, slots: 1, depth: 2, color: '#141414', ports: [] }),
  dev({ id: 'gen-vent1', name: 'Lüftungsblende 1 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 1, slots: 1, depth: 2, color: '#141414', ports: [] }),
  dev({ id: 'gen-shelf1', name: 'Fachboden 1 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 1, slots: 1, depth: 350, color: '#232323', ports: [] }),
  dev({ id: 'gen-shelf2', name: 'Fachboden 2 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 2, slots: 1, depth: 350, color: '#232323', ports: [] }),
  ...[1, 2, 3, 4].map((h) => dev({
    id: `gen-drawer${h}`, name: `Schublade ${h} HE`, manufacturer: 'Generisch', category: 'Schubladen', heightU: h, slots: 1,
    depth: h === 1 ? 300 : 400, color: '#202022', drawer: true, ports: [],
    notes: 'Inhalt im Eigenschaften-Bereich eintragen – er wird auf der Front, im Viewer und im PDF gezeigt.',
  })),
  dev({ id: 'gen-cablemgmt1', name: 'Kabelführung 1 HE', manufacturer: 'Generisch', category: 'Zubehör', heightU: 1, slots: 1, depth: 60, color: '#1a1a1a', ports: [] }),
];

export const DEVICE_CATEGORIES = Array.from(new Set(BUILTIN_DEVICES.map((d) => d.category)));
