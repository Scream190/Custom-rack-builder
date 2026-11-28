import type { CaseParam, FlightCase } from './types';

/*
 * User parameters of a flight case, after "Change Parameters" in parametric CAD: named values (e.g. device width) that
 * size fields refer to by formula ("Gerätebreite + 2 * Polster"). A linked field keeps its formula and follows when a
 * parameter changes; typing a plain number or dragging the size in 3D unlinks it.
 */

/** fields that can hold a formula: path -> read / write */
export const PARAM_FIELDS: Record<string, { label: string; get: (c: FlightCase) => number; set: (c: FlightCase, v: number) => Partial<FlightCase> }> = {
  'inner.l': { label: 'Länge innen', get: (c) => c.inner.l, set: (c, v) => ({ inner: { ...c.inner, l: Math.max(50, v) } }) },
  'inner.w': { label: 'Breite innen', get: (c) => c.inner.w, set: (c, v) => ({ inner: { ...c.inner, w: Math.max(50, v) } }) },
  'inner.h': { label: 'Höhe innen', get: (c) => c.inner.h, set: (c, v) => ({ inner: { ...c.inner, h: Math.max(10, v) } }) },
  lidH: { label: 'Deckelhöhe', get: (c) => c.lidH, set: (_c, v) => ({ lidH: Math.max(0, v) }) },
  'doors.front': { label: 'Tür vorne', get: (c) => c.doors?.front ?? 0, set: (c, v) => ({ doors: { ...c.doors, front: Math.max(0, v) || undefined } }) },
  'doors.back': { label: 'Tür hinten', get: (c) => c.doors?.back ?? 0, set: (c, v) => ({ doors: { ...c.doors, back: Math.max(0, v) || undefined } }) },
  'doors.left': { label: 'Tür links', get: (c) => c.doors?.left ?? 0, set: (c, v) => ({ doors: { ...c.doors, left: Math.max(0, v) || undefined } }) },
  'doors.right': { label: 'Tür rechts', get: (c) => c.doors?.right ?? 0, set: (c, v) => ({ doors: { ...c.doors, right: Math.max(0, v) || undefined } }) },
};

/** parameter names: a letter first, then letters, digits and _ (umlauts allowed) */
export const PARAM_NAME = /^[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*$/;
const FUNCS: Record<string, (...a: number[]) => number> = { min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs };

/**
 * Evaluates a formula: numbers (comma or point as decimal mark), + - * / ( ), parameter names and min, max, round,
 * floor, ceil, abs. Returns null for anything else (no code is ever executed).
 */
export function evalExpr(src: string, params: CaseParam[] = []): number | null {
  const s = src.trim().replace(/^=/, '');
  if (!s) return null;
  const toks = s.match(/\d+(?:[.,]\d+)?|[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*|[-+*/(),]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const vals = new Map(params.map((p) => [p.name.toLowerCase(), p.value]));
  const fail = (): never => { throw new Error('bad'); };
  const primary = (): number => {
    const t = toks[i++];
    if (t === undefined) return fail();
    if (t === '(') { const v = sum(); if (toks[i++] !== ')') fail(); return v; }
    if (t === '-') return -primary();
    if (t === '+') return primary();
    if (/^\d/.test(t)) return parseFloat(t.replace(',', '.'));
    if (/^[A-Za-zÄÖÜäöüß_]/.test(t)) {
      const f = FUNCS[t.toLowerCase()];
      if (f && peek() === '(') {
        i++;
        const args: number[] = [];
        if (peek() !== ')') { args.push(sum()); while (peek() === ',') { i++; args.push(sum()); } }
        if (toks[i++] !== ')') fail();
        return f(...args);
      }
      const v = vals.get(t.toLowerCase());
      return v === undefined ? fail() : v;
    }
    return fail();
  };
  const product = (): number => {
    let v = primary();
    while (peek() === '*' || peek() === '/') { const op = toks[i++]; const r = primary(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === '+' || peek() === '-') { const op = toks[i++]; const r = product(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  try {
    const v = sum();
    return i === toks.length && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  } catch { return null; }
}

/** true when the text is more than a plain number (a formula worth keeping) */
export const isFormula = (s: string) => !/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(s);

/** the values of every linked field for the given parameters (fields whose formula fails keep their value) */
export function recompute(c: FlightCase, params = c.params ?? []): Partial<FlightCase> {
  let next = { ...c };
  for (const [path, ex] of Object.entries(c.exprs ?? {})) {
    const f = PARAM_FIELDS[path];
    const v = f && evalExpr(ex, params);
    if (f && v !== null && v !== undefined && v !== f.get(next)) next = { ...next, ...f.set(next, v) };
  }
  const out: Partial<FlightCase> = {};
  if (next.inner !== c.inner) out.inner = next.inner;
  if (next.lidH !== c.lidH) out.lidH = next.lidH;
  if (next.doors !== c.doors) out.doors = next.doors;
  return out;
}

/** enters a field: a plain number unlinks it, a formula links it; null when the formula cannot be evaluated */
export function setFieldExpr(c: FlightCase, path: string, text: string): Partial<FlightCase> | null {
  const f = PARAM_FIELDS[path];
  if (!f) return null;
  const v = evalExpr(text, c.params);
  if (v === null) return null;
  const exprs = { ...(c.exprs ?? {}) };
  if (isFormula(text)) exprs[path] = text.trim().replace(/^=/, ''); else delete exprs[path];
  return { ...f.set(c, v), exprs };
}

/** changes, adds or renames parameters; linked fields follow (renaming also rewrites the formulas) */
export function setParams(c: FlightCase, params: CaseParam[], rename?: [string, string]): Partial<FlightCase> {
  let exprs = c.exprs;
  if (rename && rename[0] !== rename[1] && exprs) {
    const re = new RegExp(`(?<![A-Za-zÄÖÜäöüß0-9_])${rename[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÄÖÜäöüß0-9_])`, 'gi');
    exprs = Object.fromEntries(Object.entries(exprs).map(([k, v]) => [k, v.replace(re, rename[1])]));
  }
  const base = { ...c, params, exprs };
  // exprs always travels along, so the store does not take the recomputed sizes for a direct edit (which unlinks)
  return { params, exprs: exprs ? { ...exprs } : exprs, ...recompute(base, params) };
}

/** fields whose formula no longer evaluates (a parameter was deleted or renamed elsewhere) */
export function brokenExprs(c: FlightCase): string[] {
  return Object.entries(c.exprs ?? {}).filter(([, ex]) => evalExpr(ex, c.params) === null).map(([k]) => k);
}

/**
 * A patch that sets a linked field directly (dragging in 3D, a preset) unlinks it, so the field keeps the new size
 * instead of jumping back on the next parameter change.
 */
export function unlinkOverridden(c: FlightCase, patch: Partial<FlightCase>): Partial<FlightCase> {
  if (!c.exprs || 'exprs' in patch) return patch;
  const touched = Object.keys(c.exprs).filter((path) => {
    const f = PARAM_FIELDS[path];
    const top = path.split('.')[0] as keyof FlightCase;
    return f && top in patch && f.get({ ...c, ...patch } as FlightCase) !== f.get(c);
  });
  if (!touched.length) return patch;
  const exprs = { ...c.exprs };
  for (const p of touched) delete exprs[p];
  return { ...patch, exprs };
}
