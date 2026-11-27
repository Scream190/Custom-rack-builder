import { useMemo, useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { CaseItem, FlightCase, FoamMaterial, OutlinePt, Project } from '../model/types';
import { caseBom, caseWarnings, depthAvailable, drawerInner, footprint, freePosition, isDrawer, ITEM_PRESETS, itemFromTemplate } from '../model/cases';
import { arrangeItems, cutDepth, cutList, filletPolygon, FOAM_MATERIALS, foamMaterial, inlayContainer, inlayList, inlayThickness, rectOutline, shapeOutline } from '../model/inlay';
import { ShapeEditor } from './ShapeEditor';
import { uid } from '../model/util';
import { InlaySheet, inlaySheetLayout, type InlayLayer } from '../render/InlayDrawing';
import { Case3D } from '../three/Case3D';
import { ErrorBoundary } from './ErrorBoundary';
import { Splitter } from './Splitter';
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { Field, NumberInput } from './Modal';
import { Section } from './Section';
import { SheetCanvas } from './SheetCanvas';
import { EmptyState, Menu, Seg, ShowMenu, ToolGroup, Toolbar } from './Shell';
import { projectDrawers } from './CaseWorkspace';

const st = useStore.getState;
const kg = (n: number) => String(n).replace('.', ',');
const hasLid = (c: FlightCase) => (!c.kind || c.kind === 'case') && c.lidKind !== 'none' && c.lidH > 0;

// ------------------------------------------------------------------ left: add cut-outs

/** small top view of a contour, front at the bottom */
export function ShapePreview({ pts, l, w, size = 44, width = size * 2 }: { pts: OutlinePt[]; l: number; w: number; size?: number; width?: number }) {
  const m = 3, k = Math.min((width - 2 * m) / Math.max(l, 1), (size - 2 * m) / Math.max(w, 1));
  const ox = (width - l * k) / 2, oy = (size - w * k) / 2;
  const d = filletPolygon(pts).map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + x * k).toFixed(1)},${(size - oy - y * k).toFixed(1)}`).join('') + 'Z';
  return <svg className="shape-prev" width={width} height={size} viewBox={`0 0 ${width} ${size}`} aria-hidden><path d={d} /></svg>;
}

/** contour editor state shared by the add panel and the inspector */
let openEditor: (itemId: string) => void = () => {};

function AddPanel({ c, project, layer }: { c: FlightCase; project: Project; layer: InlayLayer }) {
  const selection = useStore((s) => s.selection);
  const [form, setForm] = useState({ name: 'Ausschnitt', shape: 'rect' as 'rect' | 'circle', l: 200, w: 100, h: 50, qty: 1 });
  const [q, setQ] = useState('');
  const templates = useMemo(() => allTemplates(project), [project]);
  const hits = q.trim().length >= 2 ? templates.filter((t) => `${t.manufacturer} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30) : [];
  const add = (base: Omit<CaseItem, 'id' | 'x' | 'y' | 'layer'>, qty = 1) => {
    let cur = c;
    const items: CaseItem[] = [];
    for (let i = 0; i < qty; i++) {
      const it: CaseItem = { ...base, id: uid('it-'), x: 0, y: 0, layer };
      Object.assign(it, freePosition(cur, it));
      items.push(it);
      cur = { ...cur, items: [...cur.items, it] };
    }
    st().addCaseItems(c.id, items);
  };
  const mine = c.items.filter((i) => i.layer === layer);
  return (
    <aside className="panel library">
      <div className="panel-head"><strong>Ausschnitte</strong><span className="muted small">{mine.length} in {layer === 'lid' ? 'Deckel' : 'dieser Ebene'}</span></div>
      <div className="lib-list">
        <div className="insp add-form">
          <Section id="inlay.add.own" title="Eigener Ausschnitt" defaultOpen>
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Seg value={form.shape} onChange={(v) => setForm({ ...form, shape: v })} options={[
            { id: 'rect', label: 'Rechteck', title: 'Rechteckiger Ausschnitt mit gerundeten Ecken' },
            { id: 'circle', label: 'Rund', title: 'Runder oder ovaler Ausschnitt (Länge und Breite = Durchmesser)' },
          ]} />
          <div className="row gap4">
            <Field label="Länge"><NumberInput value={form.l} min={5} onChange={(v) => setForm({ ...form, l: v })} /></Field>
            <Field label="Breite"><NumberInput value={form.w} min={5} onChange={(v) => setForm({ ...form, w: v })} /></Field>
            <Field label="Tiefe"><NumberInput value={form.h} min={1} onChange={(v) => setForm({ ...form, h: v })} /></Field>
            <Field label="Anzahl"><NumberInput value={form.qty} min={1} max={50} onChange={(v) => setForm({ ...form, qty: Math.max(1, Math.round(v)) })} /></Field>
          </div>
          <div className="row gap4 wrap">
            <button className="btn" onClick={() => add({ name: form.name, l: form.l, w: form.w, h: form.h, shape: form.shape === 'circle' ? 'circle' : undefined }, form.qty)} title="Ausschnitt an einer freien Stelle einfügen">Ausschnitt einfügen</button>
            <button className="btn" onClick={() => {
              const it: CaseItem = { name: form.name, l: form.l, w: form.w, h: form.h, outline: rectOutline(form.l, form.w, 6), id: uid('it-'), x: 0, y: 0, layer };
              Object.assign(it, freePosition(c, it));
              st().addCaseItems(c.id, [it]);
              st().select({ kind: 'caseItem', id: it.id });
              openEditor(it.id);
            }} title="Ausschnitt einfügen und die Kontur im Form-Editor selbst zeichnen, auf Wunsch über einem Foto des Produkts">Kontur zeichnen …</button>
          </div>
          </Section>

          <Section id="inlay.add.presets" title="Vorlagen" summary={`${ITEM_PRESETS.length} typische Inhalte`} defaultOpen>
          <div className="muted small">Typische Außenmaße mit passender Kontur. Danach anpassen oder im Form-Editor nachzeichnen.</div>
          {[...new Set(ITEM_PRESETS.map((p) => p.group))].map((g) => (
            <div key={g} className="tile-group">
              <div className="tile-group-head">{g}</div>
              <div className="tile-grid">
                {ITEM_PRESETS.filter((p) => p.group === g).map((p) => {
                  const pts = p.shape ? shapeOutline(p.shape, p.l, p.w) : rectOutline(p.l, p.w, 6);
                  return (
                    <button key={p.name} className="tile" onClick={() => add({ name: p.name, l: p.l, w: p.w, h: p.h, weight: p.weight, outline: p.shape ? pts : undefined })} title={`${p.name} einfügen (${p.l} × ${p.w} × ${p.h} mm)`}>
                      <ShapePreview pts={pts} l={p.l} w={p.w} />
                      <span className="tile-name">{p.name}</span>
                      <span className="tile-dim">{p.l} × {p.w} × {p.h}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </Section>
          <Section id="inlay.add.library" title="Aus der Gerätebibliothek" summary="Gehäusemaße übernehmen">
          <input placeholder="Gerät suchen, z. B. SM58" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.map((t) => <button key={t.id} className="list-btn" onClick={() => add(itemFromTemplate(t))} title="Mit den Gehäusemaßen des Geräts einfügen">{t.manufacturer} {t.name}</button>)}
          </Section>
        </div>
        <div className="insp add-form">
        <Section id="inlay.add.list" title="In dieser Ebene" defaultOpen summary={`${mine.length} Ausschnitte`}>
        {mine.length ? mine.map((it) => (
          <button key={it.id} className={'lib-item item-row' + (selection?.kind === 'caseItem' && selection.id === it.id ? ' sel-item' : '')} onClick={() => st().select({ kind: 'caseItem', id: it.id })} title="Ausschnitt auswählen">
            <span className="lib-text">
              <span className="lib-name">{it.name}</span>
              <span className="muted small">{footprint(it).l} × {footprint(it).w}, Tiefe {cutDepth(it)} mm{it.outline ? ', Kontur' : it.shape === 'circle' ? ', rund' : ''}</span>
            </span>
          </button>
        )) : <div className="hint">Noch keine Ausschnitte.</div>}
        </Section>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ right: properties

const SIDES: { id: 'left' | 'right' | 'front' | 'back'; label: string }[] = [
  { id: 'front', label: 'vorne' }, { id: 'back', label: 'hinten' }, { id: 'left', label: 'links' }, { id: 'right', label: 'rechts' },
];

function ItemInspector({ c, it }: { c: FlightCase; it: CaseItem }) {
  const ro = useStore((s) => s.readOnly);
  const up = (p: Partial<CaseItem>) => st().updateCaseItem(c.id, it.id, p);
  const warnings = caseWarnings(c).filter((w) => w.itemId === it.id);
  const grips = new Set(it.grips ?? []);
  const round = it.shape === 'circle';
  const own = !!(it.outline && it.outline.length >= 3);
  // scale the contour with the length and width fields
  const resize = (l: number, w: number) => up(own ? { l, w, outline: it.outline!.map((p) => ({ ...p, x: Math.round((p.x * l) / it.l * 10) / 10, y: Math.round((p.y * w) / it.w * 10) / 10 })) } : { l, w });
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <input className="insp-title" disabled={ro} value={it.name} onChange={(e) => up({ name: e.target.value })} title="Name des Ausschnitts" />
          <div className="muted small">Ausschnitt in {c.name}</div>
        </div>
        {warnings.length ? <div className="warn-box">{warnings.map((w, i) => <div key={i} className="warn">{w.text}</div>)}</div> : null}
        <Section id="inlay.item.size" title="Form und Maße" defaultOpen summary={`${it.l} × ${it.w}, Tiefe ${cutDepth(it)} mm`}>
        <Seg value={own ? 'outline' : round ? 'circle' : 'rect'} onChange={(v) => {
          if (v === 'outline') { if (!own) up({ outline: round ? rectOutline(it.l, it.w, Math.min(it.l, it.w) / 2) : rectOutline(it.l, it.w, it.radius ?? 6), shape: undefined }); openEditor(it.id); }
          else up({ shape: v === 'circle' ? 'circle' : undefined, outline: undefined, trace: undefined });
        }} options={[
          { id: 'rect', label: 'Rechteck', title: 'Rechteckig mit gerundeten Ecken' },
          { id: 'circle', label: 'Rund', title: 'Rund oder oval' },
          { id: 'outline', label: 'Kontur', title: 'Eigene Kontur, im Form-Editor gezeichnet' },
        ]} />
        {own ? (
          <div className="outline-box">
            <ShapePreview pts={it.outline!} l={it.l} w={it.w} size={56} width={96} />
            <div className="col gap4">
              <span className="muted small">{it.outline!.length} Eckpunkte{it.trace ? ', mit Hintergrundbild' : ''}</span>
              {!ro ? <button className="btn sm primary" onClick={() => openEditor(it.id)} title="Kontur im Form-Editor bearbeiten">Im Form-Editor bearbeiten</button> : null}
            </div>
          </div>
        ) : null}
        <div className="row gap8">
          <Field label={round ? 'Durchm. x (mm)' : 'Länge (mm)'}><NumberInput value={it.l} min={5} onChange={(v) => resize(v, it.w)} /></Field>
          <Field label={round ? 'Durchm. y (mm)' : 'Breite (mm)'}><NumberInput value={it.w} min={5} onChange={(v) => resize(it.l, v)} /></Field>
        </div>
        <div className="row gap8">
          <Field label="Höhe Inhalt (mm)"><NumberInput value={it.h} min={1} onChange={(v) => up({ h: v })} /></Field>
          <Field label="Schnitttiefe (mm)"><NumberInput value={cutDepth(it)} min={1} onChange={(v) => up({ depth: v === it.h ? undefined : v })} /></Field>
          {!round && !own ? <Field label="Eckenradius"><NumberInput value={it.radius ?? 6} min={0} max={50} onChange={(v) => up({ radius: v === 6 ? undefined : v })} /></Field> : null}
        </div>
        <div className="muted small">Schnitttiefe ist sonst gleich der Höhe. Platz in der Höhe: {Math.round(depthAvailable(c, it.layer))} mm.</div>
        </Section>
        <Section id="inlay.item.pos" title="Position" summary={`${Math.round(it.x)} / ${Math.round(it.y)} mm`}>
        <div className="row gap8">
          <Field label="von links (mm)"><NumberInput value={it.x} step={5} onChange={(v) => up({ x: v })} /></Field>
          <Field label="von vorne (mm)"><NumberInput value={it.y} step={5} onChange={(v) => up({ y: v })} /></Field>
        </div>
        {hasLid(c) ? (
          <Field label="Ebene"><select disabled={ro} value={it.layer} onChange={(e) => up({ layer: e.target.value as CaseItem['layer'] })}><option value="body">Unterteil</option><option value="lid">Deckel</option></select></Field>
        ) : null}
        </Section>
        {!round && !own ? (
          <>
            <Section id="inlay.item.grips" title="Griffmulden und Gravur" summary={[it.grips?.length ? `${it.grips.length} Griffmulden` : '', it.engrave ? 'graviert' : ''].filter(Boolean).join(', ') || 'keine'}>
            <div className="muted small">Halbrunde Aussparungen, um den Inhalt greifen zu können.</div>
            <div className="row gap8 wrap">
              {SIDES.map((s) => (
                <label key={s.id} className="check"><input disabled={ro} type="checkbox" checked={grips.has(s.id)} onChange={(e) => {
                  const next = new Set(grips); if (e.target.checked) next.add(s.id); else next.delete(s.id);
                  up({ grips: next.size ? [...next] : undefined });
                }} /> {s.label}</label>
              ))}
            </div>
            <label className="check"><input disabled={ro} type="checkbox" checked={!!it.engrave} onChange={(e) => up({ engrave: e.target.checked || undefined })} /> Namen in den Schaum gravieren</label>
            </Section>
          </>
        ) : <label className="check"><input disabled={ro} type="checkbox" checked={!!it.engrave} onChange={(e) => up({ engrave: e.target.checked || undefined })} /> Namen in den Schaum gravieren</label>}
        <Field label="Gewicht Inhalt (kg)"><NumberInput value={it.weight ?? 0} step={0.1} min={0} onChange={(v) => up({ weight: v || undefined })} /></Field>
        {!ro ? (
          <div className="action-row">
            <div className="btn-group">
              <button className="btn sm" onClick={() => up({ rot: !it.rot })} title="Länge und Breite tauschen">Um 90° drehen</button>
              <button className="btn sm" onClick={() => { const copy = { ...it, id: uid('it-') }; Object.assign(copy, freePosition(c, copy)); st().addCaseItems(c.id, [copy]); }} title="Gleichen Ausschnitt noch einmal einfügen">Duplizieren</button>
            </div>
            <button className="btn sm danger" onClick={() => st().removeCaseItem(c.id, it.id)} title="Ausschnitt entfernen (Entf)">Entfernen</button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function InlayInspector({ c, project }: { c: FlightCase; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const set = (patch: Partial<FlightCase>) => st().updateCase(c.id, patch);
  const b = caseBom(c, project);
  const warnings = caseWarnings(c);
  const mat = foamMaterial(c);
  const link = c.drawer ? projectDrawers(project).find((x) => x.device.id === c.drawer!.deviceId) : undefined;
  const drawerTpls = allTemplates(project).filter((t) => t.drawer);
  const dtpl = link?.tpl ?? drawerTpls.find((t) => t.id === c.drawerTemplate);
  const isCase = !c.kind || c.kind === 'case';
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <input className="insp-title" disabled={ro || isCase} value={c.name} onChange={(e) => set({ name: e.target.value })} title={isCase ? 'Name kommt aus dem Case' : 'Name der Einlage'} />
          <div className="muted small">Einlage für {inlayContainer(project, c)}</div>
        </div>
        <dl className="keyfigs">
          <div><dt>Innenmaß</dt><dd>{c.inner.l} × {c.inner.w} × {c.inner.h} mm</dd></div>
          <div><dt>Einlage</dt><dd>{inlayThickness(c) ? `${inlayThickness(c)} mm stark` : 'noch leer'}</dd></div>
          <div><dt>Gewicht Schaum</dt><dd>ca. {kg(b.weight.foam)} kg</dd></div>
        </dl>
        {warnings.length ? <div className="warn-box">{warnings.map((w, i) => <div key={i} className="warn">{w.text}</div>)}</div> : null}

        <Section id="inlay.container" title="Behälter und Innenmaß" defaultOpen={!isCase} summary={inlayContainer(project, c)}>
        {isDrawer(c) ? (
          <>
            {c.drawer ? (
              <div className="muted small">{link ? `${link.device.label || link.tpl.name} in „${link.rack.name}“, HE ${link.device.u}.` : 'Die verknüpfte Schublade gibt es nicht mehr im Rack.'} {dtpl?.drawerInner ? 'Innenmaß laut Hersteller.' : 'Die Innenmaße sind aus der Schubladen-Vorlage geschätzt. Bitte nachmessen.'}</div>
            ) : (
              <>
                <Field label="Schublade (Vorlage)">
                  <select disabled={ro} value={c.drawerTemplate ?? ''} onChange={(e) => { const t = drawerTpls.find((x) => x.id === e.target.value); if (t) set({ drawerTemplate: t.id, inner: drawerInner(t) }); }}>
                    {!dtpl ? <option value="">unbekannt</option> : null}
                    {drawerTpls.map((t) => <option key={t.id} value={t.id}>{t.manufacturer === 'Generisch' ? '' : `${t.manufacturer} `}{t.name} ({drawerInner(t).l} × {drawerInner(t).w} × {drawerInner(t).h})</option>)}
                  </select>
                </Field>
                <div className="muted small">{!dtpl?.drawerInner ? 'Innenmaß aus der Bauhöhe geschätzt. Bitte an der Schublade nachmessen.' : dtpl.drawerInner.hEstimated ? 'Breite und Tiefe laut Hersteller, Höhe geschätzt. Höhe bitte nachmessen.' : 'Innenmaß laut Hersteller, siehe Quelle in der Vorlage.'} Nicht mit einem Rack verknüpft.</div>
              </>
            )}
            {dtpl && !ro ? <button className="btn sm" onClick={() => set({ inner: drawerInner(dtpl) })} title="Innenmaß der Schubladen-Vorlage wieder einsetzen">Innenmaß aus der Vorlage übernehmen</button> : null}
          </>
        ) : isCase ? (
          <>
            <div className="muted small">Die Maße kommen aus dem Case. Ändern im Case-Designer.</div>
            <button className="btn sm" onClick={() => { st().setActiveCase(c.id); st().setMode('cases'); }} title="Dieses Case im Case-Designer öffnen">Case im Case-Designer öffnen</button>
          </>
        ) : <div className="muted small">Freier Behälter, zum Beispiel ein gekaufter Koffer oder eine Transportbox. Innenmaß unten eintragen.</div>}
        {!isCase ? (
          <div className="row gap8">
            <Field label="Länge (mm)"><NumberInput value={c.inner.l} min={30} onChange={(v) => set({ inner: { ...c.inner, l: v } })} /></Field>
            <Field label="Breite (mm)"><NumberInput value={c.inner.w} min={30} onChange={(v) => set({ inner: { ...c.inner, w: v } })} /></Field>
            <Field label="Höhe (mm)"><NumberInput value={c.inner.h} min={10} onChange={(v) => set({ inner: { ...c.inner, h: v } })} /></Field>
          </div>
        ) : null}

        </Section>
        <Section id="inlay.foam" title="Schaumstoff" defaultOpen summary={`${mat}, Boden ${c.foam.bottom}, Rand ${c.foam.sides} mm`}>
        <Field label="Material"><select disabled={ro} value={mat} onChange={(e) => set({ foam: { ...c.foam, material: e.target.value as FoamMaterial } })}>
          {Object.entries(FOAM_MATERIALS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select></Field>
        <div className="muted small">{FOAM_MATERIALS[mat].note}. Plattenstärken: {FOAM_MATERIALS[mat].sheets.slice().reverse().join(', ')} mm.</div>
        <div className="row gap8">
          <Field label="Boden (mm)"><NumberInput value={c.foam.bottom} min={0} onChange={(v) => set({ foam: { ...c.foam, bottom: v } })} /></Field>
          <Field label="Rand (mm)"><NumberInput value={c.foam.sides} min={0} onChange={(v) => set({ foam: { ...c.foam, sides: v } })} /></Field>
          {hasLid(c) ? <Field label="Deckel (mm)"><NumberInput value={c.foam.lid} min={0} onChange={(v) => set({ foam: { ...c.foam, lid: v } })} /></Field> : null}
          <Field label="Farbe"><input disabled={ro} type="color" value={c.foam.color} onChange={(e) => set({ foam: { ...c.foam, color: e.target.value } })} title="Farbe des Schaumstoffs" /></Field>
        </div>
        </Section>
        {!isCase ? <Section id="inlay.notes" title="Notizen" summary={c.notes ? c.notes.slice(0, 36) : 'keine'}><textarea disabled={ro} rows={3} value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} aria-label="Notizen" /></Section> : null}
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ bottom: cut list

function CutListPanel({ c, project }: { c: FlightCase; project: Project }) {
  const [open, setOpen] = useState(true);
  const selection = useStore((s) => s.selection);
  const rows = cutList(c);
  const b = caseBom(c, project);
  return (
    <div className={'cable-list' + (open ? '' : ' closed')}>
      <div className="cable-list-head">
        <button className="cable-list-title" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Zuschnittliste einklappen' : 'Zuschnittliste ausklappen'}>{open ? '▾' : '▸'} Zuschnittliste, {c.name}</button>
        <span className="muted small">{rows.length} Ausschnitte, {FOAM_MATERIALS[foamMaterial(c)].label}</span>
      </div>
      {open ? (
        <div className="cable-table-wrap parts-grid">
          <table className="cable-table">
            <thead><tr><th>Ausschnitt</th><th>Ebene</th><th>Form</th><th>L × B (mm)</th><th>Tiefe</th><th>von links</th><th>von vorne</th><th>Griffmulden</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.it.id} className={(selection?.kind === 'caseItem' && selection.id === r.it.id ? 'sel' : '') + (r.inside ? '' : ' bad-row')} onClick={() => st().select({ kind: 'caseItem', id: r.it.id })}>
                  <td>{r.it.name}</td><td>{r.it.layer === 'lid' ? 'Deckel' : 'Unterteil'}</td><td>{r.it.outline ? 'Kontur' : r.it.shape === 'circle' ? 'rund' : `R ${r.it.radius ?? 6}`}</td>
                  <td>{r.l} × {r.w}</td><td>{r.depth}</td><td>{Math.round(r.x)}</td><td>{Math.round(r.y)}</td>
                  <td>{r.it.grips?.length ? r.it.grips.map((g) => SIDES.find((s) => s.id === g)?.label).join(', ') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="cable-table"><thead><tr><th>Schaumteil</th><th>Maß (mm)</th><th>Stärke</th><th>aus Platten</th></tr></thead>
            <tbody>{b.foam.map((f) => <tr key={f.name}><td>{f.name}</td><td>{Math.round(f.a)} × {Math.round(f.b)}</td><td>{Math.round(f.t)} mm</td><td className="muted">{f.stack ?? ''}</td></tr>)}</tbody></table>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ workspace

export function InlayWorkspace() {
  const project = useStore((s) => s.project);
  const activeId = useStore((s) => s.activeInlayId);
  const selection = useStore((s) => s.selection);
  const ro = useStore((s) => s.readOnly);
  const layout = useLayout();
  const [view, setView] = useState<'plan' | '3d'>('plan');
  const [layerSel, setLayer] = useState<InlayLayer>('body');
  const [editing, setEditing] = useState<string | null>(null);
  openEditor = setEditing;
  const snap = layout.snap, gap = layout.packGap;
  const list = inlayList(project);
  const c = list.find((x) => x.id === activeId) ?? list[0];
  if (!c) {
    return (
      <main className="workspace">
        <EmptyState title="Einlagen-Designer" text="Schaumstoff-Einlagen mit Ausschnitten für Rackschubladen, für Flightcases aus dem Case-Designer oder für beliebige Behälter. Mit Griffmulden, runden Ausschnitten, Gravur, Zuschnittliste, PDF und DXF für den Zuschneider." />
      </main>
    );
  }
  const layer: InlayLayer = hasLid(c) ? layerSel : 'body';
  const it = selection?.kind === 'caseItem' ? c.items.find((x) => x.id === selection.id) : undefined;
  const warnIds = new Set(caseWarnings(c).map((w) => w.itemId).filter(Boolean) as string[]);
  const L = inlaySheetLayout(c, layer);
  const pad = 90 * L.u;
  return (
    <main className="workspace">
      {!ro && layout.showLibrary ? (
        <>
          <div className="col" style={{ width: layout.libraryW }}><AddPanel c={c} project={project} layer={layer} /></div>
          <Splitter dir="x" value={layout.libraryW} min={200} max={560} onChange={(v) => setLayout({ libraryW: v })} onReset={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW })} />
        </>
      ) : null}
      <section className="center">
        <Toolbar>
          <ToolGroup>
            <Seg value={view} onChange={setView} options={[
              { id: 'plan', label: 'Zuschnitt', title: 'Zuschnittplan: Draufsicht mit Maßen und Schnitt' },
              { id: '3d', label: '3D', title: 'Räumliche Ansicht der Einlage im Behälter' },
            ]} />
            {hasLid(c) ? (
              <Seg value={layer} onChange={setLayer} options={[
                { id: 'body', label: 'Unterteil', title: 'Schaum im Unterteil des Cases' },
                { id: 'lid', label: 'Deckel', title: 'Schaum im Deckel des Cases' },
              ]} />
            ) : null}
          </ToolGroup>
          {!ro ? (
            <ToolGroup>
              <button className="btn sm" disabled={!c.items.length} onClick={() => st().updateCase(c.id, { items: arrangeItems(c, gap) })} title={`Alle Ausschnitte platzsparend verteilen, Abstand ${gap} mm (änderbar in den Einstellungen). Was nicht passt, landet rot markiert daneben.`}>Automatisch anordnen</button>
              {layer === 'body' ? (
                <Menu label="Trennwände" className="sm" title="Holz-Trennwände im Behälter">
                  <button onClick={() => st().updateCase(c.id, { dividers: [...c.dividers, { axis: 'x', pos: Math.round(c.inner.w / 2) }] })}>Trennwand längs einsetzen</button>
                  <button onClick={() => st().updateCase(c.id, { dividers: [...c.dividers, { axis: 'y', pos: Math.round(c.inner.l / 2) }] })}>Trennwand quer einsetzen</button>
                  {c.dividers.length ? <><hr /><button className="danger" onClick={() => st().updateCase(c.id, { dividers: [] })}>Alle {c.dividers.length} Trennwände entfernen</button></> : null}
                </Menu>
              ) : null}
            </ToolGroup>
          ) : null}
          <span className="spacer" />
          <ShowMenu library="Ausschnitte einfügen" list="Zuschnittliste" />
        </Toolbar>
        <div className="stage">
          <ErrorBoundary resetKey={view + c.id}>
            {view === '3d' ? <Case3D c={c} /> : (
              <SheetCanvas c={c} size={{ x: -pad, y: -10, w: L.w + pad + 20, h: L.h + 20 }} fitKey={`${c.id}:${layer}:${Math.round(L.w)}:${Math.round(L.h)}`} snap={snap} editable={!ro}
                hint={`Ausschnitte ziehen (Raster ${snap} mm, Alt gedrückt = frei). Mausrad zoomt, Ziehen auf freier Fläche verschiebt, Doppelklick passt ein.`}>
                {(onDown) => <InlaySheet c={c} layer={layer} selectedItemId={it?.id ?? null} warnItemIds={warnIds} onItemPointerDown={onDown} />}
              </SheetCanvas>
            )}
          </ErrorBoundary>
        </div>
        {layout.showCableList ? <div className="cable-list-wrap" style={{ maxHeight: 300 }}><CutListPanel c={c} project={project} /></div> : null}
      </section>
      {editing && c.items.some((x) => x.id === editing) ? (
        <ShapeEditor item={c.items.find((x) => x.id === editing)!} onClose={() => setEditing(null)} onSave={(patch) => { st().updateCaseItem(c.id, editing, patch); setEditing(null); }} />
      ) : null}
      {layout.showInspector ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={240} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}>{it ? <ItemInspector c={c} it={it} /> : <InlayInspector c={c} project={project} />}</div>
        </>
      ) : null}
    </main>
  );
}
