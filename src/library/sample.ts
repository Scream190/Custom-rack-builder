import type { Cable, Project } from '../model/types';
import { emptyProject } from '../model/store';
import { BUILTIN_DEVICES } from './devices';
import { BUILTIN_RACK_TYPES } from './rackTypes';
import { deepClone } from '../model/util';

/** A typical 8 U UHF rack: antenna patch, distributor, 2× quad receiver, IEM, power. */
export function sampleProject(): Project {
  const p = emptyProject('Beispiel: UHF-Rack Funkstrecken');
  p.author = '';
  const type = deepClone(BUILTIN_RACK_TYPES.find((t) => t.id === 'shock-10u-450')!);
  const rack = p.racks[0];
  rack.name = 'UHF Rack 1';
  rack.type = type;
  rack.notes = 'Antennen A/B über BNC-Patch vorne (Front 1/2), IEM-Antennen über Front 3/4. UA844+ über externes 15-V-Netzteil (PS45), Switch über eigenes Netzteil.';
  const use = (id: string) => {
    const t = BUILTIN_DEVICES.find((d) => d.id === id)!;
    p.templates[id] = deepClone(t);
    return t;
  };
  ['gen-patch-bnc8', 'gen-patch-xlr16', 'shure-ua844', 'shure-ulxd4q', 'shure-p10t', 'gen-pdu-iec8', 'gen-switch8', 'gen-drawer2'].forEach(use);

  rack.devices = [
    { id: 'd-bnc', templateId: 'gen-patch-bnc8', u: 8, mount: 'front', slot: 0, label: 'Antennen-Patch' },
    { id: 'd-xlr', templateId: 'gen-patch-xlr16', u: 7, mount: 'front', slot: 0, label: 'Audio-Patch' },
    { id: 'd-dist', templateId: 'shure-ua844', u: 6, mount: 'front', slot: 0, label: 'Antennenverteiler' },
    { id: 'd-rx1', templateId: 'shure-ulxd4q', u: 5, mount: 'front', slot: 0, label: 'RX 1–4',
      rf: { band: 'G50', zone: 'Bühne', channels: [{ name: 'Vox 1', f: 470.275 }, { name: 'Vox 2', f: 472.825 }, { name: 'Vox 3', f: 476.150 }, { name: 'Vox 4', f: 481.425 }] } },
    { id: 'd-rx2', templateId: 'shure-ulxd4q', u: 4, mount: 'front', slot: 0, label: 'RX 5–8',
      rf: { band: 'G50', zone: 'Bühne', channels: [{ name: 'Vox 5', f: 484.900 }, { name: 'Vox 6', f: 491.075 }, { name: 'Vox 7', f: 495.350 }, { name: 'Vox 8', f: 502.625 }] } },
    { id: 'd-iem', templateId: 'shure-p10t', u: 3, mount: 'front', slot: 0, label: 'IEM 1/2',
      rf: { band: 'G10E', zone: 'Bühne', channels: [{ name: 'IEM MD', f: 518.400 }, { name: 'IEM Drums', f: 524.125 }] } },
    { id: 'd-sw', templateId: 'gen-switch8', u: 2, mount: 'front', slot: 1, label: 'Control Switch' },
    { id: 'd-pdu', templateId: 'gen-pdu-iec8', u: 1, mount: 'front', slot: 0, label: 'Strom' },
  ];
  // everything up by 2 U: a drawer with spares goes to the bottom
  for (const d of rack.devices) d.u += 2;
  rack.devices.push({
    id: 'd-drawer', templateId: 'gen-drawer2', u: 1, mount: 'front', slot: 0, label: 'Ersatz & Zubehör',
    contents: [
      { qty: 2, text: 'Shure ULXD2/B58 Handsender' }, { qty: 2, text: 'Shure ULXD1 Taschensender' },
      { qty: 24, text: 'Batterien AA (Mignon)' }, { qty: 4, text: 'Shure SB900B Akku' },
      { qty: 4, text: 'BNC-Kabel 1 m (Ersatz)' }, { qty: 2, text: 'XLR-Kabel 1 m (Ersatz)' },
      { qty: 2, text: 'Antenne UA860SWB (Stab)' }, { text: 'Gaffa schwarz + Edding' },
      { qty: 1, text: 'Kopfhörer HPA' }, { qty: 1, text: 'Ladegerät SBC220' },
    ],
  });

  const port = (deviceId: string, name: string) => {
    const d = rack.devices.find((x) => x.id === deviceId)!;
    const t = p.templates[d.templateId];
    const pt = t.ports.find((x) => x.name === name);
    if (!pt) throw new Error(`Port ${name} not found on ${t.name}`);
    return { deviceId, portId: pt.id };
  };
  let n = 1;
  const cable = (a: [string, string], b: [string, string], typeId: string, label?: string): Cable => ({
    id: `c${n}`, number: n++, a: port(...a), b: port(...b), typeId, lengthMode: 'auto', label,
  });
  rack.cables = [
    cable(['d-bnc', 'Rear 1'], ['d-dist', 'Ant A In'], 'ct-rg58', 'Ant A'),
    cable(['d-bnc', 'Rear 2'], ['d-dist', 'Ant B In'], 'ct-rg58', 'Ant B'),
    cable(['d-dist', 'A Out 1'], ['d-rx1', 'Ant A'], 'ct-rg58'),
    cable(['d-dist', 'B Out 1'], ['d-rx1', 'Ant B'], 'ct-rg58'),
    cable(['d-dist', 'A Out 2'], ['d-rx2', 'Ant A'], 'ct-rg58'),
    cable(['d-dist', 'B Out 2'], ['d-rx2', 'Ant B'], 'ct-rg58'),
    cable(['d-iem', 'Antenna 1 Out'], ['d-bnc', 'Rear 3'], 'ct-rg58', 'IEM Ant 1'),
    cable(['d-iem', 'Antenna 2 Out'], ['d-bnc', 'Rear 4'], 'ct-rg58', 'IEM Ant 2'),
    ...[1, 2, 3, 4].map((i) => cable(['d-rx1', `Out ${i}`], ['d-xlr', `R${i}`], 'ct-xlr', `Vox ${i}`)),
    ...[1, 2, 3, 4].map((i) => cable(['d-rx2', `Out ${i}`], ['d-xlr', `R${i + 4}`], 'ct-xlr', `Vox ${i + 4}`)),
    cable(['d-xlr', 'R13'], ['d-iem', 'TX1 In L/CH1'], 'ct-xlr', 'IEM 1 L'),
    cable(['d-xlr', 'R14'], ['d-iem', 'TX1 In R/CH2'], 'ct-xlr', 'IEM 1 R'),
    cable(['d-xlr', 'R15'], ['d-iem', 'TX2 In L/CH1'], 'ct-xlr', 'IEM 2 L'),
    cable(['d-xlr', 'R16'], ['d-iem', 'TX2 In R/CH2'], 'ct-xlr', 'IEM 2 R'),
    cable(['d-rx1', 'Dante Prim.'], ['d-sw', 'Port 1'], 'ct-cat'),
    cable(['d-rx2', 'Dante Prim.'], ['d-sw', 'Port 2'], 'ct-cat'),
    cable(['d-iem', 'Network 1'], ['d-sw', 'Port 3'], 'ct-cat'),
    cable(['d-pdu', 'Out 2'], ['d-rx1', 'Power'], 'ct-iec'),
    cable(['d-pdu', 'Out 3'], ['d-rx2', 'Power'], 'ct-iec'),
    cable(['d-pdu', 'Out 4'], ['d-iem', 'Power In'], 'ct-iec'),
  ];
  return p;
}
