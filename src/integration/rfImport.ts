import type { DeviceTemplate, PlacedDevice, Project, Rack, RackType } from '../model/types';
import { allTemplates } from '../model/store';
import { BUILTIN_RACK_TYPES } from '../library/rackTypes';
import { BUILTIN_DEVICES } from '../library/devices';
import { checkPlacement } from '../model/geometry';
import { deepClone, uid } from '../model/util';
import { rfDataFromImport, rfProductById, rfProductsFor, templateIdForProduct, type RfImportDevice } from './rf';

export type RfImportTarget = 'perZone' | 'oneRack' | 'activeRack';

export interface RfImportReport { placed: number; racks: string[]; notPlaced: string[]; genericTemplates: string[] }

const SHOCK_SIZES = [4, 6, 8, 10, 12, 14, 16, 20];

/** template for an imported device; unknown products get a generic receiver/transmitter copy with the RF product set */
function templateFor(p: Project, dev: RfImportDevice, report: RfImportReport): DeviceTemplate {
  const all = allTemplates(p);
  const tid = templateIdForProduct(dev.product, all);
  let tpl = all.find((t) => t.id === tid)!;
  const mapped = rfProductsFor(tpl).some((x) => x.id === dev.product);
  if (!mapped && dev.product) {
    // e.g. "series:Shure|ULX-D" (channels free) or a product from the user's WWB database
    const id = 'rf-' + dev.product.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let copy = all.find((t) => t.id === id);
    if (!copy) {
      const prod = rfProductById(dev.product);
      const label = dev.product.replace(/^series:/, '').split('|');
      copy = { ...deepClone(tpl), id, name: prod ? prod.model : label.slice(1).join(' ') || dev.product, manufacturer: prod ? prod.man : label[0] || 'RF',
        custom: true, rfProduct: prod ? prod.id : undefined, art: undefined, source: 'Platzhalter aus dem RF-Import (generisches Gehäuse)' };
      report.genericTemplates.push(`${copy.manufacturer} ${copy.name}`);
    }
    tpl = copy;
  }
  if (!p.templates[tpl.id]) p.templates[tpl.id] = deepClone(tpl.custom ? tpl : BUILTIN_DEVICES.find((b) => b.id === tpl.id) ?? tpl);
  return p.templates[tpl.id];
}

/** first free spot scanning from the bottom (U1) upwards */
function spotFromBottom(p: Project, rack: Rack, tpl: DeviceTemplate) {
  for (let u = 1; u + tpl.heightU - 1 <= rack.type.heightU; u++) {
    for (let slot = 0; slot < tpl.slots; slot++) if (checkPlacement(p, rack, tpl, u, 'front', slot).ok) return { u, slot };
  }
  return null;
}

const rackType = (h: number): RackType => {
  const size = SHOCK_SIZES.find((s) => s >= h);
  return deepClone(BUILTIN_RACK_TYPES.find((t) => t.id === (size ? `shock-${size}u-450` : 'cab-42u-800'))!);
};

/** Put imported devices into the project (draft, mutated). */
export function applyRfImport(p: Project, devices: RfImportDevice[], target: RfImportTarget, activeRackId: string, baseName: string): RfImportReport {
  const report: RfImportReport = { placed: 0, racks: [], notPlaced: [], genericTemplates: [] };
  const make = (dev: RfImportDevice): { dev: RfImportDevice; tpl: DeviceTemplate } => ({ dev, tpl: templateFor(p, dev, report) });

  if (target === 'activeRack') {
    const rack = p.racks.find((r) => r.id === activeRackId) ?? p.racks[0];
    for (const it of devices.map(make)) {
      const spot = spotFromBottom(p, rack, it.tpl);
      if (!spot) { report.notPlaced.push(it.dev.name); continue; }
      rack.devices.push(device(it.dev, it.tpl, spot));
      report.placed++;
    }
    report.racks.push(rack.name);
    return report;
  }

  // an untouched default project: its single empty rack gets replaced by the imported ones
  const emptyDefault = p.racks.length === 1 && !p.racks[0].devices.length ? p.racks[0] : null;
  const groups = new Map<string, RfImportDevice[]>();
  for (const d of devices) {
    const k = target === 'perZone' ? d.zone || '' : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  for (const [zone, list] of groups) {
    // largest devices first, full width before half width – packs the rack tightly
    let todo = list.map(make).sort((a, b) => b.tpl.heightU - a.tpl.heightU || a.tpl.slots - b.tpl.slots);
    let part = 1;
    while (todo.length) {
      const name = (zone || baseName) + (part > 1 ? ` (${part})` : '');
      const rack: Rack = { id: uid('rack-'), name, type: rackType(42), devices: [], cables: [], notes: 'Importiert aus dem RF Frequency Manager' };
      const rest: typeof todo = [];
      for (const it of todo) {
        const spot = spotFromBottom(p, rack, it.tpl);
        if (spot) { rack.devices.push(device(it.dev, it.tpl, spot)); report.placed++; } else rest.push(it);
      }
      if (!rack.devices.length) { report.notPlaced.push(...rest.map((r) => r.dev.name)); break; }
      const used = Math.max(...rack.devices.map((d) => d.u + p.templates[d.templateId].heightU - 1));
      rack.type = rackType(used);
      p.racks.push(rack);
      report.racks.push(rack.name);
      todo = rest;
      part++;
    }
  }
  if (emptyDefault && p.racks.length > 1) p.racks = p.racks.filter((r) => r !== emptyDefault);
  return report;
}

function device(dev: RfImportDevice, tpl: DeviceTemplate, spot: { u: number; slot: number }): PlacedDevice {
  const products = rfProductsFor(tpl);
  const prod = products.find((x) => x.id === dev.product);
  const rf = rfDataFromImport(dev, products.length > 1 ? prod : undefined);
  return { id: uid('dev-'), templateId: tpl.id, u: spot.u, mount: 'front', slot: spot.slot, label: dev.name, rf };
}
