import type { CaseStep, CaseTimeline, FlightCase } from './types';
import { DIVIDER_LABELS, HARDWARE, CASE_TYPES, SEAM_LABELS } from './cases';
import { uid } from './util';

/*
 * Design history of a flight case, after the timeline of parametric CAD programs: a base state plus steps. The case's
 * construction fields are the replay of the active steps up to the marker; foam, cut-outs, name and notes stay outside
 * the history. Steps store differences, so suppressing, deleting or inserting a step earlier replays the later ones on
 * top; a later step that refers to something that no longer exists simply has no effect (shown in the timeline).
 */

export const TRACKED = ['inner', 'lidKind', 'lidH', 'lidSplit', 'doors', 'drawers', 'dividers', 'hardware', 'castorSize', 'panel', 'profile', 'cornerBalls', 'color', 'parts', 'caseType', 'params', 'exprs', 'racks', 'doorHinge', 'doorShelves'] as const;
type Key = (typeof TRACKED)[number];
const OBJ: Key[] = ['inner', 'doors', 'parts', 'exprs', 'doorHinge', 'doorShelves'];
const ARR: Key[] = ['hardware', 'dividers', 'drawers', 'params', 'racks'];
type Tracked = Partial<Pick<FlightCase, Key>>;
interface ArrDiff { add?: unknown[]; remove?: unknown[]; change?: [unknown, unknown][] }
/** steps kept; older ones are folded into the base */
export const MAX_STEPS = 100;

/** stable JSON (sorted keys) for value comparison */
const sj = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function trackedOf(c: Partial<FlightCase>): Tracked {
  const o: Record<string, unknown> = {};
  for (const k of TRACKED) if (c[k] !== undefined) o[k] = clone(c[k]);
  return o as Tracked;
}

function arrDiff(a: unknown[], b: unknown[]): ArrDiff | null {
  const rest = b.map(sj);
  const keep = new Array(b.length).fill(false);
  const removed: unknown[] = [];
  for (const x of a) {
    const s = sj(x);
    const j = rest.findIndex((r, k) => !keep[k] && r === s);
    if (j >= 0) keep[j] = true; else removed.push(x);
  }
  const added = b.filter((_, k) => !keep[k]);
  const n = Math.min(removed.length, added.length);
  const d: ArrDiff = {};
  if (n) d.change = removed.slice(0, n).map((x, k) => [x, added[k]]);
  if (removed.length > n) d.remove = removed.slice(n);
  if (added.length > n) d.add = added.slice(n);
  return d.add || d.remove || d.change ? clone(d) : null;
}
function applyArr(a: unknown[], d: ArrDiff): unknown[] {
  const out = a.slice();
  for (const x of d.remove ?? []) { const i = out.findIndex((y) => sj(y) === sj(x)); if (i >= 0) out.splice(i, 1); }
  for (const [o, n] of d.change ?? []) { const i = out.findIndex((y) => sj(y) === sj(o)); if (i >= 0) out[i] = clone(n); }
  for (const x of d.add ?? []) out.push(clone(x));
  return out;
}

/** what changes from `a` to `b` (construction fields only); null when nothing does */
export function diffTracked(a: Tracked, b: Tracked): Record<string, unknown> | null {
  const d: Record<string, unknown> = {};
  for (const k of TRACKED) {
    const x = a[k] as unknown, y = b[k] as unknown;
    if (sj(x) === sj(y)) continue;
    if (OBJ.includes(k)) {
      const xo = (x ?? {}) as Record<string, unknown>, yo = (y ?? {}) as Record<string, unknown>;
      const part: Record<string, unknown> = {};
      for (const s of new Set([...Object.keys(xo), ...Object.keys(yo)])) if (sj(xo[s]) !== sj(yo[s])) part[s] = yo[s] === undefined ? null : clone(yo[s]);
      if (Object.keys(part).length) d[k] = part;
    } else if (ARR.includes(k)) {
      const ad = arrDiff((x ?? []) as unknown[], (y ?? []) as unknown[]);
      if (ad) d[k] = ad;
    } else d[k] = y === undefined ? null : clone(y);
  }
  return Object.keys(d).length ? d : null;
}
export function applyDiff(s: Tracked, d: Record<string, unknown>): Tracked {
  const o = { ...s } as Record<string, unknown>;
  for (const [k, v] of Object.entries(d)) {
    if (OBJ.includes(k as Key)) {
      const cur = { ...((o[k] ?? {}) as Record<string, unknown>) };
      for (const [s2, v2] of Object.entries(v as Record<string, unknown>)) { if (v2 === null) delete cur[s2]; else cur[s2] = clone(v2); }
      o[k] = Object.keys(cur).length || k === 'inner' ? cur : undefined;
    } else if (ARR.includes(k as Key)) o[k] = applyArr((o[k] ?? []) as unknown[], v as ArrDiff);
    else o[k] = v === null ? undefined : clone(v);
  }
  return o as Tracked;
}

const markerOf = (tl: CaseTimeline) => Math.min(tl.marker ?? tl.steps.length, tl.steps.length);
/** construction state after the active steps before index `upto` */
export function replay(tl: CaseTimeline, upto = markerOf(tl)): Tracked {
  let s = trackedOf(tl.base);
  for (let i = 0; i < upto && i < tl.steps.length; i++) if (!tl.steps[i].off) s = applyDiff(s, tl.steps[i].d);
  return s;
}
/** the case with its construction fields set from the timeline (fields missing in the replay are cleared) */
function withReplay(c: FlightCase, tl: CaseTimeline): FlightCase {
  const s = replay(tl) as Record<string, unknown>;
  const out = { ...c, timeline: tl } as Record<string, unknown>;
  for (const k of TRACKED) out[k] = s[k];
  return out as unknown as FlightCase;
}

/**
 * Applies an edit to a case and records it in the timeline: inserted at the marker (later steps stay and are replayed),
 * or merged into the previous step when it continues the same edit (same key within 1.5 s, or one mouse drag).
 */
export function recordStep(c: FlightCase, patch: Partial<FlightCase>, key: string | undefined, now: number): FlightCase {
  const tracked = Object.keys(patch).filter((k) => (TRACKED as readonly string[]).includes(k));
  const plain = Object.fromEntries(Object.entries(patch).filter(([k]) => !tracked.includes(k)));
  if (!tracked.length) return { ...c, ...plain };
  const tl: CaseTimeline = c.timeline ? clone(c.timeline) : { base: trackedOf(c), steps: [] };
  let m = markerOf(tl);
  // edits made outside the history (older files, other tools) become a step of their own first
  const shown = replay(tl, m), now0 = trackedOf(c);
  const outside = diffTracked(shown, now0);
  if (outside) { tl.steps.splice(m, 0, { id: uid('st-'), t: now, d: outside }); m++; }
  const before = trackedOf(c);
  const after = { ...before, ...trackedOf(patch as FlightCase) } as Record<string, unknown>;
  for (const k of tracked) if ((patch as Record<string, unknown>)[k] === undefined) delete after[k];
  const prev = tl.steps[m - 1];
  if (!outside && prev && key && prev.key === key && !prev.off && (key.startsWith('drag:') || now - prev.t < 1500)) {
    const d = diffTracked(replay(tl, m - 1), after as Tracked);
    if (d) { prev.d = d; prev.t = now; } else { tl.steps.splice(m - 1, 1); m--; }
  } else {
    const d = diffTracked(before, after as Tracked);
    if (d) { tl.steps.splice(m, 0, { id: uid('st-'), t: now, key, d }); m++; }
  }
  tl.marker = m >= tl.steps.length ? undefined : m;
  while (tl.steps.length > MAX_STEPS) {
    const first = tl.steps.shift()!;
    if (!first.off) tl.base = { ...tl.base, ...(applyDiff(trackedOf(tl.base), first.d) as Partial<FlightCase>) };
    if (tl.marker !== undefined) tl.marker = Math.max(0, tl.marker - 1);
  }
  return withReplay({ ...c, ...plain }, tl);
}

/** moves the marker: steps from `m` on are rolled back (not active) */
export function setMarker(c: FlightCase, m: number): FlightCase {
  if (!c.timeline) return c;
  const tl = clone(c.timeline);
  const mm = Math.max(0, Math.min(tl.steps.length, Math.round(m)));
  tl.marker = mm >= tl.steps.length ? undefined : mm;
  return withReplay(c, tl);
}
/** suppresses a step or makes it active again */
export function toggleStep(c: FlightCase, i: number): FlightCase {
  if (!c.timeline?.steps[i]) return c;
  const tl = clone(c.timeline);
  tl.steps[i].off = !tl.steps[i].off || undefined;
  return withReplay(c, tl);
}
/** removes a step; the later ones are replayed without it */
export function deleteStep(c: FlightCase, i: number): FlightCase {
  if (!c.timeline?.steps[i]) return c;
  const tl = clone(c.timeline);
  tl.steps.splice(i, 1);
  if (tl.marker !== undefined && i < tl.marker) tl.marker--;
  if (tl.marker !== undefined && tl.marker >= tl.steps.length) tl.marker = undefined;
  return withReplay(c, tl);
}

export type StepKind = 'type' | 'size' | 'lid' | 'door' | 'drawer' | 'divider' | 'hardware' | 'build' | 'color' | 'castor' | 'param' | 'rack' | 'other';
export interface StepInfo { label: string; kind: StepKind; sel?: string; /** false when the step changes nothing where it stands (refers to something removed earlier) */ effective: boolean; active: boolean }

const sideLabel = (s: string) => SEAM_LABELS[s as keyof typeof SEAM_LABELS] ?? s;
/** a readable name of what a step does */
export function describeStep(d: Record<string, unknown>, before: Tracked, after: Tracked): Omit<StepInfo, 'effective' | 'active'> {
  if (d.caseType !== undefined && d.caseType !== null) return { label: `Bauform: ${CASE_TYPES.find((t) => t.id === d.caseType)?.label ?? d.caseType}`, kind: 'type' };
  if (d.params) {
    const a = d.params as ArrDiff;
    const p = (a.change?.[0]?.[1] ?? a.add?.[0] ?? a.remove?.[0]) as { name: string; value: number } | undefined;
    if (p && a.remove && !a.add && !a.change) return { label: `Parameter ${p.name} gelöscht`, kind: 'param' };
    return { label: p ? `Parameter ${p.name} = ${p.value}` : 'Parameter', kind: 'param' };
  }
  if (d.exprs && !d.inner && !d.lidH && !d.doors) return { label: 'Formel geändert', kind: 'param' };
  if (d.racks) {
    const a = d.racks as ArrDiff;
    const r = (a.add?.[0] ?? a.change?.[0]?.[1] ?? a.remove?.[0]) as { units: number; name?: string } | undefined;
    const name = r?.name || 'Rack';
    const idx = r ? (after.racks ?? []).findIndex((x) => sj(x) === sj(r)) : -1;
    if (a.add && !a.remove && !a.change) return { label: `${name} ${r?.units} HE eingebaut`, kind: 'rack', sel: idx >= 0 ? `rack:${idx}` : undefined };
    if (a.remove && !a.add && !a.change) return { label: `${name} entfernt`, kind: 'rack' };
    return { label: `${name} geändert`, kind: 'rack', sel: idx >= 0 ? `rack:${idx}` : undefined };
  }
  if (d.doorHinge) {
    const p = d.doorHinge as Record<string, string | null>;
    const s = Object.keys(p)[0];
    return { label: p[s] ? `${sideLabel(s)}: Schwingtür` : `${sideLabel(s)}: abnehmbar`, kind: 'door', sel: `part:door-${s}` };
  }
  if (d.doorShelves) return { label: `Fächer ${sideLabel(Object.keys(d.doorShelves as object)[0])}`, kind: 'door', sel: `part:door-${Object.keys(d.doorShelves as object)[0]}` };
  if (d.inner) {
    const p = d.inner as Partial<FlightCase['inner']>;
    const ks = Object.keys(p);
    if (ks.length === 1) return { label: `${ks[0] === 'l' ? 'Länge' : ks[0] === 'w' ? 'Breite' : 'Höhe'} innen ${p[ks[0] as 'l']} mm`, kind: 'size', sel: 'part:base' };
    const i = after.inner!;
    return { label: `Innenmaß ${i.l} × ${i.w} × ${i.h} mm`, kind: 'size', sel: 'part:base' };
  }
  if (d.doors) {
    const p = d.doors as Record<string, number | null | string>;
    const sides = Object.keys(p).filter((k) => k !== 'span');
    if (sides.length === 1) { const s = sides[0], v = p[s]; return { label: v === null ? `${sideLabel(s)} entfernt` : `${sideLabel(s)}: ${v} mm`, kind: 'door', sel: v === null ? undefined : `part:door-${s}` }; }
    return { label: sides.length ? 'Türen geändert' : 'Türen und Deckel', kind: 'door' };
  }
  if (d.lidKind !== undefined) return { label: d.lidKind === 'none' || d.lidKind === null ? 'Deckel entfernt' : `Deckel ${after.lidH ?? ''} mm`, kind: 'lid', sel: d.lidKind === 'none' ? undefined : 'part:lid' };
  if (d.lidH !== undefined) return { label: `Deckelhöhe ${d.lidH} mm`, kind: 'lid', sel: 'part:lid' };
  if (d.lidSplit !== undefined) return { label: d.lidSplit ? 'Deckel geteilt' : 'Deckelteilung aufgehoben', kind: 'lid', sel: 'part:lid' };
  if (d.dividers) {
    const a = d.dividers as ArrDiff;
    const first = (a.add?.[0] ?? a.change?.[0]?.[1] ?? a.remove?.[0]) as FlightCase['dividers'][number] | undefined;
    const name = first ? DIVIDER_LABELS[first.axis] : 'Einbau';
    const idx = first ? (after.dividers ?? []).findIndex((x) => sj(x) === sj(first)) : -1;
    const sel = idx >= 0 ? `div:${idx}` : undefined;
    if (a.add && !a.remove && !a.change) return { label: a.add.length > 1 ? `${a.add.length} Einbauten gesetzt` : `${name} gesetzt`, kind: 'divider', sel };
    if (a.remove && !a.add && !a.change) return { label: `${name} gelöscht`, kind: 'divider' };
    return { label: (a.change?.length ?? 0) > 1 ? 'Einbauten verschoben' : `${name} verschoben`, kind: 'divider', sel };
  }
  if (d.drawers) {
    const n = (after.drawers ?? []).length, m0 = (before.drawers ?? []).length;
    return { label: n > m0 ? 'Schublade hinzugefügt' : n < m0 ? 'Schublade entfernt' : 'Schublade geändert', kind: 'drawer' };
  }
  if (d.hardware) {
    const a = d.hardware as ArrDiff;
    const first = (a.add?.[0] ?? a.change?.[0]?.[1] ?? a.remove?.[0]) as FlightCase['hardware'][number] | undefined;
    const name = first ? HARDWARE[first.kind]?.label ?? first.kind : 'Beschlag';
    const castor = !!first && first.kind.startsWith('castor');
    const idx = first ? (after.hardware ?? []).findIndex((x) => sj(x) === sj(first)) : -1;
    const sel = idx >= 0 && !castor ? `hw:${idx}` : undefined;
    const kind: StepKind = castor ? 'castor' : 'hardware';
    if (castor) return { label: a.remove && !a.add ? 'Rollen entfernt' : 'Rollen', kind };
    const many = (a.add?.length ?? 0) + (a.remove?.length ?? 0) + (a.change?.length ?? 0) > 2;
    if (many) return { label: 'Beschläge neu gesetzt', kind, sel };
    if (a.add && !a.remove && !a.change) return { label: `${name} gesetzt`, kind, sel };
    if (a.remove && !a.add && !a.change) return { label: `${name} gelöscht`, kind };
    const [o, n] = a.change![0] as [FlightCase['hardware'][number], FlightCase['hardware'][number]];
    const moved = sj({ ...o, at: undefined, count: undefined }) === sj({ ...n, at: undefined, count: undefined });
    return { label: moved ? `${name} verschoben` : `${name} geändert`, kind, sel };
  }
  if (d.castorSize !== undefined) return { label: `Rollen ${d.castorSize} mm`, kind: 'castor' };
  if (d.color !== undefined) return { label: 'Laminatfarbe', kind: 'color', sel: 'part:base' };
  if (d.panel !== undefined || d.profile !== undefined || d.parts !== undefined || d.cornerBalls !== undefined) return { label: 'Bauweise geändert', kind: 'build', sel: 'part:base' };
  if (d.caseType === null) return { label: 'Bauform frei', kind: 'type' };
  return { label: 'Änderung', kind: 'other' };
}

/** every step with its name, kind, related selection and whether it changes anything where it stands */
export function describeSteps(c: FlightCase): StepInfo[] {
  const tl = c.timeline;
  if (!tl) return [];
  const m = markerOf(tl);
  let s = trackedOf(tl.base);
  return tl.steps.map((st, i) => {
    const after = applyDiff(s, st.d);
    const info = describeStep(st.d, s, after);
    const effective = sj(after) !== sj(s);
    if (!st.off) s = after;
    return { ...info, effective, active: i < m && !st.off };
  });
}
export const timelineMarker = (c: FlightCase) => (c.timeline ? markerOf(c.timeline) : 0);
export const isRolledBack = (c: FlightCase) => !!c.timeline && c.timeline.marker !== undefined && c.timeline.marker < c.timeline.steps.length;
export type { CaseStep };
