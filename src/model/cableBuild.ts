import type { CustomCable, PlugSpec, Project } from './types';
import { CONNECTORS, SIGNAL_LABELS, cablePlug, connectorDef } from './connectors';
import { colorOf, pinsOf, wiringFor, type Wire, type Wiring } from './pinout';
import type { Assembly } from './assembly';
import { uid } from './util';

/*
 * Cable workshop: custom cables (any plug combination, plain or Y), their pin assignment (standard or own) and the
 * build instructions shown for every cable, whether it comes from a rack or was designed here.
 */

export const specKey = (s: PlugSpec) => (s.dir ? `${s.conn}:${s.dir}` : s.conn);
export const parseSpec = (k: string): PlugSpec => { const [conn, dir] = k.split(':'); return dir ? { conn, dir: dir as 'in' | 'out' } : { conn }; };
export const plugOf = (s: PlugSpec) => cablePlug({ connector: s.conn, dir: s.dir });

const MAINS_GENDERLESS = new Set(['SCHUKO', 'CEE16', 'CEE16_3P', 'CEE32_3P', 'CEE63_3P', 'CEE16_4P']);

export interface PlugOption { spec: PlugSpec; key: string; label: string; icon: string; group: string }

/** every cable connector that can be chosen, one entry per distinct plug, grouped by signal */
export function plugOptions(): PlugOption[] {
  const seen = new Map<string, PlugOption>();
  for (const k of Object.keys(CONNECTORS)) {
    const dirs: (undefined | 'in' | 'out')[] = MAINS_GENDERLESS.has(k) ? ['out', 'in'] : [undefined];
    for (const dir of dirs) {
      const spec: PlugSpec = dir ? { conn: k, dir } : { conn: k };
      const p = plugOf(spec);
      if (p.key === 'generic' || seen.has(p.label)) continue;
      seen.set(p.label, { spec, key: specKey(spec), label: p.label, icon: p.key, group: SIGNAL_LABELS[connectorDef(k).signal] ?? 'Sonstiges' });
    }
  }
  return [...seen.values()].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

/** cable type that fits a connector (by the type's connector list or its signal) */
export function typeFor(project: Project, conn: string): string {
  const hit = project.cableTypes.find((t) => t.connectors?.includes(conn));
  if (hit) return hit.id;
  const sig = connectorDef(conn).signal;
  return (project.cableTypes.find((t) => t.signal === sig) ?? project.cableTypes[0])?.id ?? '';
}

export function newCustomCable(project: Project, name: string, a: PlugSpec = { conn: 'XLR3F' }, b: PlugSpec = { conn: 'XLR3M' }, length = 5): CustomCable {
  return { id: uid('cc-'), name, typeId: typeFor(project, a.conn), a, branches: [{ ...b, length }], qty: 1 };
}

export interface WiringResult {
  wiring: Wiring | null;
  /** own assignment in use */
  manual: boolean;
  /** pins of both ends are known, so an own assignment can be made */
  editable: boolean;
}

/** wiring of one branch: own assignment, standard assignment, or none */
export function cableWiring(aConn: string, bConn: string, map?: { a: string; b: string }[]): WiringResult {
  const pa = pinsOf(aConn), pb = pinsOf(bConn);
  const editable = !!pa && !!pb;
  if (map && pa && pb) {
    const wires: Wire[] = map
      .filter((m) => pa.pins.some((p) => p.pin === m.a) && pb.pins.some((p) => p.pin === m.b))
      .map((m) => {
        const sig = pa.pins.find((p) => p.pin === m.a)!.sig;
        const [color, stripe] = colorOf(pa.family, sig);
        return { a: m.a, b: m.b, sig, color, stripe };
      });
    const std = wiringFor(aConn, bConn);
    const same = std && std.wires.length === wires.length && std.wires.every((w) => wires.some((x) => x.a === w.a && x.b === w.b));
    const notes = same ? std!.notes : ['Eigene Belegung, weicht vom Standard ab. Kabel und beide Stecker deutlich kennzeichnen.'];
    return { wiring: { a: pa, b: pb, wires, bridges: same ? std!.bridges : [], notes }, manual: !same, editable };
  }
  const std = wiringFor(aConn, bConn);
  if (std) return { wiring: std, manual: false, editable };
  if (pa && pb) {
    return { wiring: { a: pa, b: pb, wires: [], bridges: [], notes: ['Für diese Steckerkombination gibt es keine Standardbelegung. Belegung in den Eigenschaften festlegen.'] }, manual: false, editable };
  }
  return { wiring: null, manual: false, editable: false };
}

/** starting point for an own assignment: the standard wires, otherwise pin by pin in order */
export function defaultMap(aConn: string, bConn: string): { a: string; b: string }[] {
  const std = wiringFor(aConn, bConn);
  if (std) return std.wires.map((w) => ({ a: w.a!, b: w.b! }));
  const pa = pinsOf(aConn), pb = pinsOf(bConn);
  if (!pa || !pb) return [];
  return pa.pins.slice(0, pb.pins.length).map((p, i) => ({ a: p.pin, b: pb.pins[i].pin }));
}

/** custom cables as assemblies (same drawing and lists as the rack cables) */
export function customAssemblies(project: Project): Assembly[] {
  return (project.customCables ?? []).map((cc) => ({
    key: `custom:${cc.id}`,
    typeName: project.cableTypes.find((t) => t.id === cc.typeId)?.name ?? '?',
    color: project.cableTypes.find((t) => t.id === cc.typeId)?.color ?? '#888888',
    common: plugOf(cc.a),
    commonConn: cc.a.conn,
    branches: cc.branches.map((b) => ({ plug: plugOf(b), conn: b.conn, length: b.length })),
    count: cc.qty,
    numbers: [],
    customId: cc.id,
    name: cc.name,
  }));
}

// ---------------------------------------------------------------- build instructions

type Method = 'solder' | 'crimp-net' | 'crimp-coax' | 'screw' | 'ready';
export function methodOf(conn: string): Method {
  if (['RJ45', 'ETHERCON'].includes(conn)) return 'crimp-net';
  if (['BNC', 'BNC-D', 'BNC75', 'BNC-SDI', 'MADI-BNC', 'TNC', 'N', 'N-D', 'SMA'].includes(conn)) return 'crimp-coax';
  if (/^(SPEAKON|POWERCON|TRUE1|SCHUKO|CEE|IEC|PHOENIX)/.test(conn)) return 'screw';
  if (pinsOf(conn)) return 'solder';
  return 'ready';
}
const METHOD_LABEL: Record<Method, string> = {
  solder: 'löten', 'crimp-net': 'crimpen (RJ45 / etherCON)', 'crimp-coax': 'crimpen (Koax)', screw: 'schrauben (Klemmen)', ready: 'fertig kaufen',
};
export const methodLabel = (conn: string) => METHOD_LABEL[methodOf(conn)];

const fmtM = (m: number) => `${String(Math.round(m * 100) / 100).replace('.', ',')} m`;

/** parts for building `asm.count` cables */
export function partsOf(asm: Assembly): { label: string; count: number; note?: string }[] {
  const out = new Map<string, { label: string; count: number; note?: string }>();
  const add = (label: string, n: number, note?: string) => { const e = out.get(label) ?? { label, count: 0, note }; e.count += n; out.set(label, e); };
  add(asm.common.label, asm.count, methodLabel(asm.commonConn));
  for (const b of asm.branches) add(b.plug.label, asm.count, methodLabel(b.conn));
  const meters = asm.branches.reduce((s, b) => s + b.length + 0.1, 0) * asm.count;
  add(`${asm.typeName} (inkl. 10 cm Reserve je Stück)`, Math.round(meters * 10) / 10);
  add('Kabelmarkierer / Beschriftung', (asm.branches.length + 1) * asm.count);
  if (asm.branches.length > 1) add('Schrumpfschlauch für den Verteilpunkt', asm.count);
  return [...out.values()];
}

const pairText = (w: Wiring) => w.wires.map((x) => `${x.a} → ${x.b}${x.sig && x.sig !== x.a ? ` (${x.sig})` : ''}`).join(', ');

/** step by step instructions for one kind of cable */
export function buildSteps(asm: Assembly, wiring: Wiring | null): string[] {
  const ends = [asm.commonConn, ...asm.branches.map((b) => b.conn)];
  const methods = new Set(ends.map(methodOf));
  const y = asm.branches.length > 1;
  const lengths = asm.branches.map((b) => fmtM(b.length)).join(' + ');
  const label = asm.name ?? (asm.numbers.length ? asm.numbers.slice(0, 6).join(', ') + (asm.numbers.length > 6 ? ' …' : '') : asm.typeName);
  const steps: string[] = [];
  if (methods.has('ready') && !wiring) {
    steps.push(`Dieses Kabel (${asm.common.label} auf ${asm.branches.map((b) => b.plug.label).join(' / ')}) wird üblicherweise fertig gekauft, Länge ${lengths}.`);
    steps.push(`Beide Enden beschriften: ${label}.`);
    return steps;
  }
  steps.push(y
    ? `Für jeden der ${asm.branches.length} Äste ein Stück ${asm.typeName} zuschneiden (${lengths}), je etwa 10 cm Reserve.`
    : `${asm.typeName} auf ${lengths} zuschneiden, dazu etwa 10 cm Reserve.`);
  steps.push('Tüllen, Knickschutz und Steckergehäuse auf das Kabel schieben, bevor angeschlossen wird.');
  if (methods.has('solder')) steps.push('Lötstecker: Mantel etwa 15 mm entfernen, Schirm verdrillen, Adern 3 bis 4 mm abisolieren und verzinnen.');
  if (methods.has('crimp-net')) steps.push('RJ45 / etherCON: Mantel etwa 25 mm entfernen, Paare entdrillen, Adern nach T568B ordnen und gerade auf etwa 12 mm kürzen.');
  if (methods.has('crimp-coax')) steps.push('Koax-Stecker: Mantel, Schirm und Dielektrikum nach der Maßangabe des Steckerherstellers abisolieren (Abisolierwerkzeug).');
  if (methods.has('screw')) steps.push('Schraubstecker: Mantel nach Angabe des Steckers entfernen, Adern abisolieren, Aderendhülsen aufcrimpen.');
  if (wiring && wiring.wires.length) {
    const verb = methods.has('crimp-net') || methods.has('crimp-coax') ? 'auflegen bzw. crimpen' : methods.has('screw') && !methods.has('solder') ? 'in die Klemmen schrauben' : 'anlöten';
    steps.push(`Adern nach der Pinbelegung ${verb}: ${pairText(wiring)}.`);
    for (const b of wiring.bridges) steps.push(`Am Stecker ${b.side === 'a' ? 'A' : 'B'} Pin ${b.from} mit Pin ${b.to} brücken.`);
  } else if (wiring) steps.push('Belegung festlegen (Eigenschaften, Abschnitt Verdrahtung), dann die Adern danach anschließen.');
  if (y) steps.push('Am gemeinsamen Stecker die Adern aller Äste parallel auflegen, den Verteilpunkt mit Schrumpfschlauch sichern.');
  steps.push('Zugentlastung schließen, Gehäuse verschrauben.');
  const fam = wiring?.a.family;
  if (fam === 'net') steps.push('Mit dem Kabeltester alle 8 Adern und den Schirm prüfen.');
  else if (fam === 'mains1' || fam === 'mains3') steps.push('Prüfung nach DGUV V3 (Schutzleiter, Isolationswiderstand) durch eine Elektrofachkraft, Prüfung dokumentieren.');
  else steps.push('Durchgang jeder Ader und Kurzschluss zwischen den Adern prüfen.');
  steps.push(`Beide Enden beschriften: ${label}, ${lengths}.`);
  return steps;
}
