import type { Cable, Project, Rack } from './types';
import { cableLength, resolveEnd } from './geometry';
import { cablePlug, connectorDef } from './connectors';
import { cableColor, cableNumberText } from '../render/cablePaths';

/** One kind of cable to prepare: a plain cable (one branch) or a Y cable (several branches from a common plug). */
export interface Assembly {
  key: string;
  typeName: string;
  color: string;
  common: { key: string; label: string };
  branches: { plug: { key: string; label: string }; length: number }[];
  count: number;
  numbers: string[];
}

/** Group the cables of the given racks into assemblies (same type, plugs and lengths). */
export function cableAssemblies(project: Project, racks: Rack[]): Assembly[] {
  const out = new Map<string, Assembly>();
  for (const rack of racks) {
    const groups = new Map<string, Cable[]>();
    for (const c of rack.cables) {
      const k = c.yGroup ? `y:${c.yGroup}` : c.id;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(c);
    }
    for (const legs of groups.values()) {
      legs.sort((x, y) => (x.yLeg ?? 0) - (y.yLeg ?? 0));
      const first = legs[0];
      const a = resolveEnd(project, rack, first.a);
      if (!a) continue;
      const ct = project.cableTypes.find((t) => t.id === first.typeId);
      let common = cablePlug(a.port);
      let branches = legs.map((c) => {
        const b = resolveEnd(project, rack, c.b);
        return { plug: b ? cablePlug(b.port) : { key: 'GENERIC', label: '?' }, length: cableLength(project, rack, c)?.length ?? 0 };
      });
      // plain cables: put the plugs in a fixed order so A↔B swapped cables group together
      if (legs.length === 1 && branches[0].plug.label < common.label) [common, branches] = [branches[0].plug, [{ plug: common, length: branches[0].length }]];
      const key = [first.typeId, common.label, ...branches.map((b) => `${b.plug.label}@${b.length}`)].join('|');
      const hit = out.get(key);
      const num = legs.length > 1 ? cableNumberText(first).replace(/[a-z]$/, '') : cableNumberText(first);
      if (hit) { hit.count++; hit.numbers.push(num); continue; }
      out.set(key, { key, typeName: ct?.name ?? '?', color: cableColor(project, first), common, branches, count: 1, numbers: [num] });
    }
  }
  return [...out.values()].sort((x, y) => x.typeName.localeCompare(y.typeName) || x.branches.length - y.branches.length || x.branches[0].length - y.branches[0].length);
}

/** How many cable connectors of each kind are needed. */
export function plugDemand(assemblies: Assembly[]): { key: string; label: string; count: number }[] {
  const m = new Map<string, { key: string; label: string; count: number }>();
  const add = (p: { key: string; label: string }, n: number) => {
    const e = m.get(p.label) ?? { ...p, count: 0 };
    e.count += n;
    m.set(p.label, e);
  };
  for (const a of assemblies) {
    add(a.common, a.count);
    for (const b of a.branches) add(b.plug, a.count);
  }
  return [...m.values()].sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
}

/**
 * Panel-mount connectors needed to build the split/combi boxes and custom panels used in these racks
 * (only here the panel-mount pictogram is shown).
 */
export function panelDemand(project: Project, racks: Rack[]): { key: string; label: string; count: number }[] {
  const m = new Map<string, { key: string; label: string; count: number }>();
  const add = (tplId: string) => {
    const t = project.templates[tplId];
    if (!t) return;
    // a panel insert is one part, even though it appears as a front and a rear port
    for (const p of t.ports.filter((q) => !t.panel || q.side === 'front')) {
      const e = m.get(p.connector) ?? { key: p.connector, label: `${connectorDef(p.connector).label} (Einbau)`, count: 0 };
      e.count++;
      m.set(p.connector, e);
    }
  };
  for (const r of racks) {
    for (const b of r.boxes ?? []) add(b.templateId);
    for (const d of r.devices) if (project.templates[d.templateId]?.panel) add(d.templateId);
  }
  return [...m.values()].sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
}
