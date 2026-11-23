import type { RackKind, RackType } from '../model/types';
import { U } from '../model/geometry';

function rt(id: string, name: string, kind: RackKind, heightU: number, depth: number, opts: Partial<RackType> = {}): RackType {
  const std = opts.rackStandard ?? 19;
  const wall = kind === 'shockmount' ? 70 : kind === 'cabinet' ? 60 : kind === 'open' ? 25 : 40;
  const outerW = (std === 19 ? 482.6 : 254) + 2 * wall;
  const top = kind === 'cabinet' ? 120 : kind === 'open' ? 40 : kind === 'shockmount' ? 120 : 70;
  return {
    id, name, kind, heightU, depth,
    rackStandard: std,
    hasRearRails: kind !== 'wall' && kind !== 'desk',
    outer: { w: Math.round(outerW), h: Math.round(heightU * U + top), d: depth + (kind === 'open' ? 0 : kind === 'shockmount' ? 160 : 100) },
    color: kind === 'cabinet' ? '#1f2937' : kind === 'open' ? '#374151' : '#2b2b2b',
    frontLid: kind === 'case' || kind === 'shockmount',
    rearLid: kind === 'case' || kind === 'shockmount',
    ...opts,
  };
}

export const BUILTIN_RACK_TYPES: RackType[] = [
  ...[2, 3, 4, 6, 8, 10, 12, 14, 16].map((h) => rt(`case-${h}u-450`, `Rackcase ${h} HE (Einbautiefe 450 mm)`, 'case', h, 450)),
  ...[4, 6, 8, 10, 12, 16].map((h) => rt(`case-${h}u-600`, `Rackcase ${h} HE tief (Einbautiefe 600 mm)`, 'case', h, 600)),
  ...[4, 6, 8, 10, 12, 14, 16, 20].map((h) => rt(`shock-${h}u-450`, `Shockmount-Case ${h} HE (450 mm)`, 'shockmount', h, 450)),
  ...[8, 10, 12, 16].map((h) => rt(`shock-${h}u-600`, `Shockmount-Case ${h} HE tief (600 mm)`, 'shockmount', h, 600)),
  rt('dd-12u-500', 'Doppeltür-Case 12 HE (500 mm)', 'case', 12, 500),
  rt('cab-24u-600', 'Netzwerkschrank 24 HE (600 mm)', 'cabinet', 24, 600),
  rt('cab-42u-800', 'Serverschrank 42 HE (800 mm)', 'cabinet', 42, 800),
  rt('open-12u', 'Open Frame 12 HE', 'open', 12, 500),
  rt('open-20u', 'Open Frame 20 HE', 'open', 20, 500),
  rt('wall-6u', 'Wandgehäuse 6 HE (19", 350 mm)', 'wall', 6, 350),
  rt('wall-9u', 'Wandgehäuse 9 HE (19", 450 mm)', 'wall', 9, 450),
  rt('desk-4u', 'Pult / Rack-Desk 4 HE', 'desk', 4, 300),
  rt('mini10-4u', '10" Minirack 4 HE', 'case', 4, 300, { rackStandard: 10 }),
  rt('mini10-6u', '10" Minirack 6 HE', 'case', 6, 300, { rackStandard: 10 }),
  rt('mini10-9u', '10" Minirack 9 HE', 'case', 9, 300, { rackStandard: 10 }),
];

export const RACK_KIND_LABELS: Record<RackKind, string> = {
  case: 'Rackcase (Flightcase)',
  shockmount: 'Shockmount-Case',
  cabinet: 'Schrank',
  open: 'Open Frame',
  wall: 'Wandgehäuse',
  desk: 'Pult / Desk',
};
