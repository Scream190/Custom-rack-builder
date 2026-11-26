import { useEffect, useMemo, useRef, useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { CaseFace, CaseHardware, CaseItem, FlightCase, HardwareKind, Project } from '../model/types';
import {
  autoHardware, caseBom, caseDims, caseWarnings, depthAvailable, drawerInner, FACE_LABELS, freePosition, HARDWARE, isDrawer, ITEM_PRESETS,
  itemFromTemplate, LID_LABELS, newCase, newDrawerInlay, packItems,
} from '../model/cases';
import { formatLength } from '../model/geometry';
import { uid } from '../model/util';
import { CaseSheet, sheetLayout } from '../render/CaseDrawing';
import { Case3D } from '../three/Case3D';
import { ErrorBoundary } from './ErrorBoundary';
import { Splitter } from './Splitter';
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { Field, NumberInput } from './Modal';

const st = useStore.getState;

/** all drawers in the project's racks (for drawer inlays) */
export function projectDrawers(p: Project) {
  return p.racks.flatMap((r) => r.devices.filter((d) => p.templates[d.templateId]?.drawer).map((d) => ({ rack: r, device: d, tpl: p.templates[d.templateId] })));
}

/** open the inlay of a drawer, creating it from the drawer's size and contents if needed */
export function openDrawerInlay(p: Project, rackId: string, deviceId: string) {
  const existing = p.cases?.find((c) => c.drawer?.deviceId === deviceId);
  if (existing) { st().setActiveCase(existing.id); st().setMode('cases'); return; }
  const rack = p.racks.find((r) => r.id === rackId);
  const d = rack?.devices.find((x) => x.id === deviceId);
  const tpl = d && p.templates[d.templateId];
  if (!rack || !d || !tpl) return;
  st().addCase(newDrawerInlay(`Einlage ${d.label || tpl.name} (${rack.name})`, tpl, { rackId, deviceId }, d.contents ?? []));
}

// ------------------------------------------------------------------ canvas with zoom/pan and item dragging

function CaseCanvas({ c, selectedId, warnIds }: { c: FlightCase; selectedId: string | null; warnIds: Set<string> }) {
  const ro = useStore((s) => s.readOnly);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const L = sheetLayout(c);
  const full = { x: -90, y: -40, w: L.w + 130, h: L.h + 60 };
  const [vb, setVb] = useState(full);
  const drag = useRef<{ kind: 'item'; id: string; sx: number; sy: number; x: number; y: number; k: number } | { kind: 'pan'; sx: number; sy: number; vb: typeof vb } | null>(null);
  const fitKey = `${c.id}:${Math.round(L.w)}:${Math.round(L.h)}`;
  useEffect(() => setVb(full), [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const scale = () => svg.current?.getScreenCTM()?.a ?? 1;

  const onWheel = (e: React.WheelEvent) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.exp(e.deltaY * 0.0015);
    // keep the point under the cursor in place (viewBox is fitted with preserveAspectRatio meet)
    const s = Math.min(r.width / vb.w, r.height / vb.h);
    const ox = (r.width - vb.w * s) / 2, oy = (r.height - vb.h * s) / 2;
    const mx = vb.x + (e.clientX - r.left - ox) / s, my = vb.y + (e.clientY - r.top - oy) / s;
    setVb({ x: mx - (mx - vb.x) * k, y: my - (my - vb.y) * k, w: vb.w * k, h: vb.h * k });
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && !(e.target as Element).closest('[data-item]'))) {
      if (e.button === 0) st().select(null);
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vb };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onItemDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    st().select({ kind: 'caseItem', id });
    if (ro) return;
    const it = c.items.find((x) => x.id === id)!;
    drag.current = { kind: 'item', id, sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, k: scale() };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    if (dr.kind === 'pan') {
      const s = scale();
      setVb({ ...dr.vb, x: dr.vb.x - (e.clientX - dr.sx) / s, y: dr.vb.y - (e.clientY - dr.sy) / s });
      return;
    }
    const snap = e.altKey ? 1 : 5;
    const x = Math.round((dr.x + (e.clientX - dr.sx) / dr.k) / snap) * snap;
    const y = Math.round((dr.y - (e.clientY - dr.sy) / dr.k) / snap) * snap;
    st().updateCaseItem(c.id, dr.id, { x, y });
  };
  return (
    <div ref={wrap} className="case-canvas" onWheel={onWheel} onContextMenu={(e) => e.preventDefault()}>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" height="100%" fontFamily="Inter, Arial, Helvetica, sans-serif"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} onDoubleClick={(e) => { if (!(e.target as Element).closest('[data-item]')) setVb(full); }}>
        <CaseSheet c={c} selectedItemId={selectedId} warnItemIds={warnIds} onItemPointerDown={onItemDown} />
      </svg>
      <div className="case-hint">Ausschnitte ziehen (Alt = ohne 5-mm-Raster), Mausrad zoomt, Ziehen auf freier Fläche verschiebt, Doppelklick passt ein.</div>
    </div>
  );
}

// ------------------------------------------------------------------ left: contents

function ContentsPanel({ c, project }: { c: FlightCase; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const selection = useStore((s) => s.selection);
  const [form, setForm] = useState({ name: 'Inhalt', l: 200, w: 100, h: 50, weight: 0, qty: 1, layer: 'body' as CaseItem['layer'] });
  const [q, setQ] = useState('');
  const templates = useMemo(() => allTemplates(project), [project]);
  const hits = q.trim().length >= 2 ? templates.filter((t) => `${t.manufacturer} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30) : [];
  const add = (base: Omit<CaseItem, 'id' | 'x' | 'y'>, qty = 1) => {
    let cur = c;
    const items: CaseItem[] = [];
    for (let i = 0; i < qty; i++) {
      const it: CaseItem = { ...base, id: uid('it-'), x: 0, y: 0 };
      Object.assign(it, freePosition(cur, it));
      items.push(it);
      cur = { ...cur, items: [...cur.items, it] };
    }
    st().addCaseItems(c.id, items);
  };
  return (
    <aside className="panel library">
      <div className="panel-head"><strong>Inhalt</strong><span className="muted small">{c.items.length} Ausschnitte</span></div>
      <div className="lib-list">
        {!ro ? (
          <div className="insp" style={{ padding: '4px 6px' }}>
            <h4 style={{ borderTop: 0, paddingTop: 0 }}>Eigener Inhalt</h4>
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="row gap4">
              <Field label="Länge"><NumberInput value={form.l} min={5} onChange={(v) => setForm({ ...form, l: v })} /></Field>
              <Field label="Breite"><NumberInput value={form.w} min={5} onChange={(v) => setForm({ ...form, w: v })} /></Field>
              <Field label="Höhe"><NumberInput value={form.h} min={1} onChange={(v) => setForm({ ...form, h: v })} /></Field>
            </div>
            <div className="row gap4">
              <Field label="Gewicht (kg)"><NumberInput value={form.weight} step={0.1} min={0} onChange={(v) => setForm({ ...form, weight: v })} /></Field>
              <Field label="Anzahl"><NumberInput value={form.qty} min={1} max={50} onChange={(v) => setForm({ ...form, qty: Math.max(1, Math.round(v)) })} /></Field>
              {!isDrawer(c) && c.lidKind !== 'none' ? (
                <Field label="Ebene"><select value={form.layer} onChange={(e) => setForm({ ...form, layer: e.target.value as CaseItem['layer'] })}><option value="body">Unterteil</option><option value="lid">Deckel</option></select></Field>
              ) : null}
            </div>
            <button className="btn sm" onClick={() => add({ name: form.name, l: form.l, w: form.w, h: form.h, weight: form.weight || undefined, layer: form.layer }, form.qty)}>Hinzufügen</button>
            <h4>Vorlagen</h4>
            {ITEM_PRESETS.map((p) => (
              <button key={p.name} className="list-btn" onClick={() => add({ ...p, layer: 'body' })} title={`${p.l} × ${p.w} × ${p.h} mm`}>
                {p.name} <span className="muted small">{p.l}×{p.w}×{p.h}</span>
              </button>
            ))}
            <h4>Aus der Gerätebibliothek</h4>
            <input className="search" style={{ margin: 0 }} placeholder="Gerät suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
            {hits.map((t) => (
              <button key={t.id} className="list-btn" onClick={() => add({ ...itemFromTemplate(t), layer: 'body' })}>{t.manufacturer} {t.name}</button>
            ))}
          </div>
        ) : null}
        <h4 style={{ margin: '10px 6px 4px' }}>Im Case</h4>
        {c.items.map((it) => (
          <div key={it.id} className={'lib-item' + (selection?.kind === 'caseItem' && selection.id === it.id ? ' sel-item' : '')} onClick={() => st().select({ kind: 'caseItem', id: it.id })} style={{ cursor: 'pointer' }}>
            <div className="lib-text">
              <div className="lib-name">{it.name}</div>
              <div className="muted small">{it.l} × {it.w} × {it.h} mm{it.layer === 'lid' ? ', Deckel' : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ right: properties

const KINDS = Object.keys(HARDWARE) as HardwareKind[];

function CaseInspector({ c, project }: { c: FlightCase; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const selection = useStore((s) => s.selection);
  const it = selection?.kind === 'caseItem' ? c.items.find((x) => x.id === selection.id) : undefined;
  const set = (patch: Partial<FlightCase>) => st().updateCase(c.id, patch);
  const d = caseDims(c);
  const warnings = caseWarnings(c);
  if (it) {
    const up = (p: Partial<CaseItem>) => st().updateCaseItem(c.id, it.id, p);
    return (
      <aside className="panel inspector">
        <div className="insp">
          <h3>Ausschnitt</h3>
          <Field label="Name"><input disabled={ro} value={it.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          <div className="row gap8">
            <Field label="Länge (mm)"><NumberInput value={it.l} min={5} onChange={(v) => up({ l: v })} /></Field>
            <Field label="Breite (mm)"><NumberInput value={it.w} min={5} onChange={(v) => up({ w: v })} /></Field>
            <Field label="Höhe (mm)"><NumberInput value={it.h} min={1} onChange={(v) => up({ h: v })} /></Field>
          </div>
          <div className="row gap8">
            <Field label="x (mm)"><NumberInput value={it.x} step={5} onChange={(v) => up({ x: v })} /></Field>
            <Field label="y (mm, ab vorne)"><NumberInput value={it.y} step={5} onChange={(v) => up({ y: v })} /></Field>
          </div>
          <div className="row gap8">
            <Field label="Gewicht (kg)"><NumberInput value={it.weight ?? 0} step={0.1} min={0} onChange={(v) => up({ weight: v || undefined })} /></Field>
            {!isDrawer(c) && c.lidKind !== 'none' ? (
              <Field label="Ebene"><select disabled={ro} value={it.layer} onChange={(e) => up({ layer: e.target.value as CaseItem['layer'] })}><option value="body">Unterteil</option><option value="lid">Deckel</option></select></Field>
            ) : null}
          </div>
          <div className="muted small">Platz in der Höhe: {Math.round(depthAvailable(c, it.layer))} mm</div>
          {!ro ? (
            <div className="row gap4 wrap">
              <button className="btn sm" onClick={() => up({ rot: !it.rot })}>Um 90° drehen</button>
              <button className="btn sm" onClick={() => { const copy = { ...it, id: uid('it-') }; Object.assign(copy, freePosition(c, copy)); st().addCaseItems(c.id, [copy]); }}>Duplizieren</button>
              <button className="btn sm danger" onClick={() => st().removeCaseItem(c.id, it.id)}>Entfernen</button>
            </div>
          ) : null}
          {warnings.filter((w) => w.itemId === it.id).map((w, i) => <div key={i} className="warn">{w.text}</div>)}
        </div>
      </aside>
    );
  }
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const setCastors = (n: number) => set({ hardware: [...c.hardware.filter((h) => !h.kind.startsWith('castor')), ...(n ? [{ kind: 'castor' as const, face: 'bottom' as const, count: n / 2 }, { kind: 'castor-braked' as const, face: 'bottom' as const, count: n / 2 }] : [])] });
  const setHw = (i: number, p: Partial<CaseHardware>) => set({ hardware: c.hardware.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  const drawer = isDrawer(c);
  const link = c.drawer ? projectDrawers(project).find((x) => x.device.id === c.drawer!.deviceId) : undefined;
  return (
    <aside className="panel inspector">
      <div className="insp">
        <h3>{drawer ? 'Schubladen-Einlage' : 'Case'}</h3>
        <Field label="Name"><input disabled={ro} value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        {drawer ? (
          <div className="muted small">
            {link ? `Schublade: ${link.device.label || link.tpl.name} in „${link.rack.name}“ (HE ${link.device.u})` : 'Die verknüpfte Schublade gibt es nicht mehr.'}
            {link && !ro ? <><br /><button className="btn sm" style={{ marginTop: 4 }} onClick={() => set({ inner: drawerInner(link.tpl) })}>Innenmaße aus der Schublade übernehmen</button></> : null}
          </div>
        ) : null}
        <h4>{drawer ? 'Innenmaße der Schublade' : 'Innenmaße'}</h4>
        <div className="row gap8">
          <Field label="Länge"><NumberInput value={c.inner.l} min={50} onChange={(v) => set({ inner: { ...c.inner, l: v } })} /></Field>
          <Field label="Breite"><NumberInput value={c.inner.w} min={50} onChange={(v) => set({ inner: { ...c.inner, w: v } })} /></Field>
          <Field label="Höhe"><NumberInput value={c.inner.h} min={10} onChange={(v) => set({ inner: { ...c.inner, h: v } })} /></Field>
        </div>
        {!drawer ? (
          <>
            <div className="muted small">Außen: {Math.round(d.L)} × {Math.round(d.W)} × {Math.round(d.H)} mm{d.castorH ? ` (inkl. ${d.castorH} mm Rollen)` : ''}</div>
            <h4>Bauweise</h4>
            <div className="row gap8">
              <Field label="Platte (mm)"><select disabled={ro} value={c.panel} onChange={(e) => set({ panel: Number(e.target.value) })}>{[5, 6.5, 7, 9, 10, 12, 15].map((t) => <option key={t} value={t}>{String(t).replace('.', ',')} mm</option>)}</select></Field>
              <Field label="Profil"><select disabled={ro} value={c.profile} onChange={(e) => set({ profile: e.target.value as FlightCase['profile'] })}><option value="alu30">Alu 30 × 30</option><option value="alu35">Alu 35 × 35</option><option value="none">ohne</option></select></Field>
              <Field label="Laminat"><input disabled={ro} type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} /></Field>
            </div>
            <label className="check"><input disabled={ro} type="checkbox" checked={c.cornerBalls} onChange={(e) => set({ cornerBalls: e.target.checked })} /> Kugelecken</label>
            <h4>Deckel</h4>
            <div className="row gap8">
              <Field label="Art"><select disabled={ro} value={c.lidKind} onChange={(e) => { const k = e.target.value as FlightCase['lidKind']; set({ lidKind: k, lidH: k === 'none' ? 0 : c.lidH || 100 }); }}>
                {Object.entries(LID_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></Field>
              {c.lidKind !== 'none' ? <Field label="Deckelhöhe innen"><NumberInput value={c.lidH} min={20} max={c.inner.h - 20} onChange={(v) => set({ lidH: v })} /></Field> : null}
            </div>
          </>
        ) : null}
        <h4>Schaumstoff</h4>
        <div className="row gap8">
          <Field label="Boden"><NumberInput value={c.foam.bottom} min={0} onChange={(v) => set({ foam: { ...c.foam, bottom: v } })} /></Field>
          <Field label="Rand"><NumberInput value={c.foam.sides} min={0} onChange={(v) => set({ foam: { ...c.foam, sides: v } })} /></Field>
          {!drawer && c.lidKind !== 'none' ? <Field label="Deckel"><NumberInput value={c.foam.lid} min={0} onChange={(v) => set({ foam: { ...c.foam, lid: v } })} /></Field> : null}
          <Field label="Farbe"><input disabled={ro} type="color" value={c.foam.color} onChange={(e) => set({ foam: { ...c.foam, color: e.target.value } })} /></Field>
        </div>
        {!drawer ? (
          <>
            <h4>Rollen</h4>
            <div className="row gap8">
              <Field label="Anzahl"><select disabled={ro} value={castors} onChange={(e) => setCastors(Number(e.target.value))}><option value={0}>keine</option><option value={4}>4 (2 mit Bremse)</option></select></Field>
              <Field label="Größe"><select disabled={ro} value={c.castorSize} onChange={(e) => set({ castorSize: Number(e.target.value) as FlightCase['castorSize'] })}><option value={75}>75 mm</option><option value={100}>100 mm</option><option value={125}>125 mm</option></select></Field>
            </div>
            <h4>Beschläge</h4>
            <table className="ct-table">
              <tbody>
                {c.hardware.map((h, i) => (h.kind.startsWith('castor') ? null : (
                  <tr key={i}>
                    <td><select disabled={ro} value={h.kind} onChange={(e) => { const k = e.target.value as HardwareKind; setHw(i, { kind: k, face: HARDWARE[k].faces.includes(h.face) ? h.face : HARDWARE[k].faces[0] }); }}>
                      {KINDS.filter((k) => !k.startsWith('castor')).map((k) => <option key={k} value={k}>{HARDWARE[k].label}</option>)}
                    </select></td>
                    <td><select disabled={ro} value={h.face} onChange={(e) => setHw(i, { face: e.target.value as CaseFace })}>{HARDWARE[h.kind].faces.map((f) => <option key={f} value={f}>{FACE_LABELS[f]}</option>)}</select></td>
                    <td><NumberInput value={h.count} min={1} max={12} onChange={(v) => setHw(i, { count: Math.max(1, Math.round(v)) })} style={{ width: 48 }} /></td>
                    <td>{!ro ? <button className="icon-btn" title="Entfernen" onClick={() => set({ hardware: c.hardware.filter((_, j) => j !== i) })}>✕</button> : null}</td>
                  </tr>
                )))}
              </tbody>
            </table>
            {!ro ? (
              <div className="row gap4 wrap">
                <button className="btn sm" onClick={() => set({ hardware: [...c.hardware, { kind: 'butterfly', face: 'front', count: 1 }] })}>+ Beschlag</button>
                <button className="btn sm" onClick={() => set({ hardware: [...autoHardware(c), ...c.hardware.filter((h) => h.kind.startsWith('castor'))] })}>Automatisch setzen</button>
              </div>
            ) : null}
          </>
        ) : null}
        <Field label="Notizen"><textarea disabled={ro} rows={2} value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} /></Field>
        {warnings.length ? <><h4>Hinweise</h4>{warnings.map((w, i) => <div key={i} className="warn">{w.text}</div>)}</> : null}
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ bottom: parts list

function PartsList({ c, project }: { c: FlightCase; project: Project }) {
  const [open, setOpen] = useState(true);
  const b = caseBom(c, project);
  return (
    <div className={'cable-list' + (open ? '' : ' closed')}>
      <div className="cable-list-head">
        <button className="cable-list-title" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} Stückliste – {c.name}</button>
        <span className="muted small">Gewicht ca. {String(b.weight.total).replace('.', ',')} kg ({String(b.weight.case).replace('.', ',')} kg {isDrawer(c) ? 'Schaum' : 'Case'} + {String(b.weight.contents).replace('.', ',')} kg Inhalt){b.volume ? `, ${String(b.volume).replace('.', ',')} m³` : ''}</span>
      </div>
      {open ? (
        <div className="cable-table-wrap parts-grid">
          {b.panels.length ? (
            <table className="cable-table"><thead><tr><th>Platte ({String(c.panel).replace('.', ',')} mm)</th><th>Stk.</th><th>Zuschnitt (mm)</th></tr></thead>
              <tbody>{b.panels.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.count}</td><td>{Math.round(p.a)} × {Math.round(p.b)}</td></tr>)}</tbody></table>
          ) : null}
          {b.profiles.length ? (
            <table className="cable-table"><thead><tr><th>Profil</th><th>Länge</th></tr></thead>
              <tbody>{b.profiles.map((p) => <tr key={p.name}><td>{p.name}</td><td>{formatLength(p.length)}</td></tr>)}</tbody></table>
          ) : null}
          {b.hardware.length ? (
            <table className="cable-table"><thead><tr><th>Beschlag</th><th>Stk.</th></tr></thead>
              <tbody>{b.hardware.map((h) => <tr key={h.label}><td>{h.label}</td><td>{h.count}</td></tr>)}</tbody></table>
          ) : null}
          <table className="cable-table"><thead><tr><th>Schaumstoff</th><th>Maß (mm)</th><th>Stärke</th></tr></thead>
            <tbody>{b.foam.map((f) => <tr key={f.name}><td>{f.name}</td><td>{Math.round(f.a)} × {Math.round(f.b)}</td><td>{Math.round(f.t)} mm</td></tr>)}</tbody></table>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ workspace

export function CaseWorkspace() {
  const project = useStore((s) => s.project);
  const activeId = useStore((s) => s.activeCaseId);
  const selection = useStore((s) => s.selection);
  const ro = useStore((s) => s.readOnly);
  const layout = useLayout();
  const [view, setView] = useState<'drawing' | '3d'>('drawing');
  const cases = project.cases ?? [];
  const c = cases.find((x) => x.id === activeId) ?? cases[0];
  const drawers = projectDrawers(project);
  if (!c) {
    return (
      <main className="workspace">
        <section className="center case-empty">
          <div className="insp" style={{ maxWidth: 520 }}>
            <h3>Case-Designer</h3>
            <div className="muted">Hier gestaltest du Flightcases und Schaumstoff-Einlagen: Maße, Bauweise, Deckel, Beschläge, Rollen und Ausschnitte für den Inhalt, mit Stückliste, Gewicht, PDF und DXF für den Schaumzuschnitt.</div>
            {!ro ? (
              <div className="row gap8 wrap">
                <button className="btn primary" onClick={() => st().addCase(newCase('Case 1'))}>Neues Case</button>
                {drawers.map((x) => <button key={x.device.id} className="btn" onClick={() => openDrawerInlay(project, x.rack.id, x.device.id)}>Einlage für {x.device.label || x.tpl.name} ({x.rack.name})</button>)}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    );
  }
  const warnIds = new Set(caseWarnings(c).map((w) => w.itemId).filter(Boolean) as string[]);
  return (
    <main className="workspace">
      {!ro && layout.showLibrary ? (
        <>
          <div className="col" style={{ width: layout.libraryW }}><ContentsPanel c={c} project={project} /></div>
          <Splitter dir="x" value={layout.libraryW} min={180} max={560} onChange={(v) => setLayout({ libraryW: v })} onReset={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW })} />
        </>
      ) : null}
      <section className="center">
        <div className="case-toolbar">
          <span className="seg small-seg">
            <button className={view === 'drawing' ? 'on' : ''} onClick={() => setView('drawing')}>Zeichnung</button>
            <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D</button>
          </span>
          {!ro ? (
            <>
              <button className="btn sm" onClick={() => st().updateCase(c.id, { items: packItems(c).items })} disabled={!c.items.length}>Automatisch packen</button>
              <button className="btn sm" onClick={() => st().updateCase(c.id, { dividers: [...c.dividers, { axis: 'x', pos: Math.round(c.inner.w / 2) }] })}>+ Trennwand längs</button>
              <button className="btn sm" onClick={() => st().updateCase(c.id, { dividers: [...c.dividers, { axis: 'y', pos: Math.round(c.inner.l / 2) }] })}>+ Trennwand quer</button>
              {c.dividers.length ? <button className="btn sm" onClick={() => st().updateCase(c.id, { dividers: [] })}>Trennwände entfernen</button> : null}
            </>
          ) : null}
        </div>
        <div className="stage">
          <ErrorBoundary resetKey={view + c.id}>
            {view === '3d' ? <Case3D c={c} /> : <CaseCanvas c={c} selectedId={selection?.kind === 'caseItem' ? selection.id : null} warnIds={warnIds} />}
          </ErrorBoundary>
        </div>
        {layout.showCableList ? <div className="cable-list-wrap" style={{ maxHeight: 280 }}><PartsList c={c} project={project} /></div> : null}
      </section>
      {layout.showInspector ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={220} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}><CaseInspector c={c} project={project} /></div>
        </>
      ) : null}
    </main>
  );
}
