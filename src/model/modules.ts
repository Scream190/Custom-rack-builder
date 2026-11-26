import type { DeviceTemplate, ModuleBay, PlacedDevice, Port } from './types';

/*
 * Exchangeable modules (charging modules, plug-in cards). The choice per bay lives in PlacedDevice.fields[bay.name];
 * a module option can bring its own connectors, which then become real ports of the placed device.
 */

/** module fitted in a bay of a placed device */
export function moduleChoice(_tpl: DeviceTemplate, m: ModuleBay, device?: Pick<PlacedDevice, 'fields'>): string {
  const v = device?.fields?.[m.name];
  return v === undefined ? m.default ?? '' : v;
}

/** ports of the fitted modules: ids `m<bay>.<module>.<port>`, positions on the panel, names with the bay label */
export function modulePorts(tpl: DeviceTemplate, device?: Pick<PlacedDevice, 'fields'>): Port[] {
  return (tpl.modules ?? []).flatMap((m, i) => {
    const o = m.options.find((x) => x.id === moduleChoice(tpl, m, device));
    return (o?.ports ?? []).map((p) => ({
      ...p, id: `m${i + 1}.${o!.id}.${p.id}`, name: `${m.short ?? m.name} ${p.name}`, side: m.side ?? 'front',
      x: Math.round((m.x + p.x) * 10) / 10, y: Math.round((m.y + p.y) * 10) / 10,
    }));
  });
}

/** all ports of a placed device: those of the template plus those of its fitted modules */
export const devicePorts = (tpl: DeviceTemplate, device?: Pick<PlacedDevice, 'fields'>): Port[] =>
  tpl.modules?.length ? [...tpl.ports, ...modulePorts(tpl, device)] : tpl.ports;
