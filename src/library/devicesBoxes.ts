import type { DeviceTemplate } from '../model/types';
import { buildBoxTemplate } from '../model/boxes';

/* Common split and combi boxes as starting points; the box editor creates further ones. */
const gen = (id: string, name: string, kind: 'split' | 'combi', design: Parameters<typeof buildBoxTemplate>[1], color?: string, notes?: string): DeviceTemplate =>
  buildBoxTemplate({ id, name, kind, manufacturer: 'Generisch', color, notes }, design);

export const BOX_DEVICES: DeviceTemplate[] = [
  gen('box-cee32-split', 'Stromverteiler-Spinne CEE 32 A', 'split', {
    multi: [{ connector: 'CEE32_3P', name: 'CEE32 In', count: 1 }],
    singles: [{ connector: 'CEE16_3P', name: 'CEE16', count: 2, via: 0 }, { connector: 'SCHUKO', name: 'Schuko', count: 6, via: 0 }],
  }, '#4a3030', 'Mit FI/LS je Abgang (nicht dargestellt).'),
  gen('box-socapex-6schuko', 'Socapex-Peitsche 6× Schuko', 'split', {
    multi: [{ connector: 'SOCAPEX19', name: 'Socapex', count: 1 }],
    singles: [{ connector: 'SCHUKO', name: 'Ch', count: 6, via: 0 }],
  }, '#3a3d42'),
  gen('box-motor-harting', 'Motor-Splitbox Harting 16 → 4× CEE 16 A 4-pol', 'split', {
    multi: [{ connector: 'HARTING16', name: 'Harting In', count: 1 }],
    singles: [{ connector: 'CEE16_4P', name: 'Motor', count: 4, via: 0 }],
  }, '#2f3a2f'),
  gen('box-xlr8-dsub', 'XLR-Peitsche 8 Kanäle (D-Sub 25)', 'split', {
    multi: [{ connector: 'DSUB25', name: 'D-Sub 25', count: 1 }],
    singles: [{ connector: 'XLR3M', name: 'Ch', count: 8, via: 0 }],
  }, '#2a2f3a'),
  gen('box-stage-16', 'Bühnen-Stagebox passiv 16 Kanäle (Multipin)', 'split', {
    multi: [{ connector: 'HARTING16', name: 'Multipin', count: 1 }],
    singles: [{ connector: 'XLR3F', name: 'In', count: 12, via: 0 }, { connector: 'XLR3M', name: 'Return', count: 4, via: 0 }],
  }, '#2a2f3a', 'Multipin hier als Harting dargestellt.'),
  gen('box-light-combi', 'Kombidose Licht: Strom + DMX + Netzwerk', 'combi', {
    multi: [{ connector: 'HARTING16', name: 'Hybrid', count: 1 }],
    singles: [{ connector: 'TRUE1_OUT', name: 'Power', count: 2, via: 0 }, { connector: 'XLR5F', name: 'DMX', count: 2, via: 0 }, { connector: 'ETHERCON', name: 'Net', count: 1, via: 0 }],
  }, '#3a3530'),
];
