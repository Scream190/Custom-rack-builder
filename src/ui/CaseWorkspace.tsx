import { useState } from 'react';
import { useStore } from '../model/store';
import type { CaseFace, CaseHardware, FlightCase, HardwareKind, Project } from '../model/types';
import { autoHardware, caseBom, caseDims, caseWarnings, FACE_LABELS, HARDWARE, LID_LABELS, newCase, newDrawerInlay } from '../model/cases';
import { caseList, foamMaterial, FOAM_MATERIALS, inlayThickness } from '../model/inlay';
import { formatLength } from '../model/geometry';
import { CaseSheet, sheetLayout } from '../render/CaseDrawing';
import { Case3D } from '../three/Case3D';
import { ErrorBoundary } from './ErrorBoundary';
import { Splitter } from './Splitter';
import { DEFAULT_LAYOUT, getLayout, setLayout, useLayout } from '../model/layout';
import { Field, NumberInput } from './Modal';
import { Section } from './Section';
import { SheetCanvas } from './SheetCanvas';
import { EmptyState, Seg, ShowMenu, ToolGroup, Toolbar } from './Shell';

const st = useStore.getState;
const kg = (n: number) => String(n).replace('.', ',');

/** all drawers in the project's racks (for drawer inlays) */
export function projectDrawers(p: Project) {
  return p.racks.flatMap((r) => r.devices.filter((d) => p.templates[d.templateId]?.drawer).map((d) => ({ rack: r, device: d, tpl: p.templates[d.templateId] })));
}

/** open the inlay of a drawer in the inlay designer, creating it from the drawer's size and contents if needed */
export function openDrawerInlay(p: Project, rackId: string, deviceId: string) {
  const existing = p.cases?.find((c) => c.drawer?.deviceId === deviceId);
  if (existing) { st().setActiveInlay(existing.id); st().setMode('inlays'); return; }
  const rack = p.racks.find((r) => r.id === rackId);
  const d = rack?.devices.find((x) => x.id === deviceId);
  const tpl = d && p.templates[d.templateId];
  if (!rack || !d || !tpl) return;
  const inlay = newDrawerInlay(`Einlage ${d.label || tpl.name} (${rack.name})`, tpl, { rackId, deviceId }, d.contents ?? []);
  const prefs = getLayout();
  st().addCase({ ...inlay, foam: { ...inlay.foam, material: prefs.foamMaterial, color: prefs.foamColor } });
}

/** open the foam of a flight case in the inlay designer */
export function openCaseInlay(c: FlightCase) {
  st().setActiveInlay(c.id);
  st().setMode('inlays');
}

// ------------------------------------------------------------------ properties

const KINDS = Object.keys(HARDWARE) as HardwareKind[];

function CaseInspector({ c, project }: { c: FlightCase; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const set = (patch: Partial<FlightCase>) => st().updateCase(c.id, patch);
  const d = caseDims(c);
  const b = caseBom(c, project);
  const warnings = caseWarnings(c);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const setCastors = (n: number) => set({ hardware: [...c.hardware.filter((h) => !h.kind.startsWith('castor')), ...(n ? [{ kind: 'castor' as const, face: 'bottom' as const, count: n / 2 }, { kind: 'castor-braked' as const, face: 'bottom' as const, count: n / 2 }] : [])] });
  const setHw = (i: number, p: Partial<CaseHardware>) => set({ hardware: c.hardware.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  const nItems = c.items.length;
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <input className="insp-title" disabled={ro} value={c.name} onChange={(e) => set({ name: e.target.value })} title="Name des Cases" />
          <div className="muted small">Flightcase</div>
        </div>
        <dl className="keyfigs">
          <div><dt>Außenmaß</dt><dd>{Math.round(d.L)} × {Math.round(d.W)} × {Math.round(d.H)} mm</dd></div>
          <div><dt>Gewicht leer</dt><dd>ca. {kg(b.weight.case)} kg</dd></div>
          {b.weight.contents ? <div><dt>mit Inhalt</dt><dd>ca. {kg(b.weight.total)} kg</dd></div> : null}
        </dl>
        {d.castorH ? <div className="muted small">Höhe inklusive {d.castorH} mm Rollen.</div> : null}
        {warnings.length ? <div className="warn-box">{warnings.map((w, i) => <div key={i} className="warn">{w.text}</div>)}</div> : null}

        <Section id="case.inner" title="Innenmaße" defaultOpen summary={`${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm`}>
        <div className="row gap8">
          <Field label="Länge (mm)"><NumberInput value={c.inner.l} min={50} onChange={(v) => set({ inner: { ...c.inner, l: v } })} /></Field>
          <Field label="Breite (mm)"><NumberInput value={c.inner.w} min={50} onChange={(v) => set({ inner: { ...c.inner, w: v } })} /></Field>
          <Field label="Höhe (mm)"><NumberInput value={c.inner.h} min={10} onChange={(v) => set({ inner: { ...c.inner, h: v } })} /></Field>
        </div>

        </Section>
        <Section id="case.lid" title="Deckel" defaultOpen summary={c.lidKind === 'none' ? 'ohne' : `${LID_LABELS[c.lidKind]}, ${c.lidH} mm`}>
        <div className="row gap8">
          <Field label="Art" grow={2}><select disabled={ro} value={c.lidKind} onChange={(e) => { const k = e.target.value as FlightCase['lidKind']; set({ lidKind: k, lidH: k === 'none' ? 0 : c.lidH || 100 }); }}>
            {Object.entries(LID_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></Field>
          {c.lidKind !== 'none' ? <Field label="Höhe innen (mm)"><NumberInput value={c.lidH} min={20} max={c.inner.h - 20} onChange={(v) => set({ lidH: v })} /></Field> : null}
        </div>

        </Section>
        <Section id="case.build" title="Bauweise" summary={`${String(c.panel).replace('.', ',')} mm, ${c.profile === 'none' ? 'ohne Profil' : c.profile === 'alu30' ? 'Alu 30' : 'Alu 35'}${c.cornerBalls ? ', Kugelecken' : ''}`}>
        <div className="row gap8">
          <Field label="Platte"><select disabled={ro} value={c.panel} onChange={(e) => set({ panel: Number(e.target.value) })}>{[5, 6.5, 7, 9, 10, 12, 15].map((t) => <option key={t} value={t}>{String(t).replace('.', ',')} mm</option>)}</select></Field>
          <Field label="Kantenprofil"><select disabled={ro} value={c.profile} onChange={(e) => set({ profile: e.target.value as FlightCase['profile'] })}><option value="alu30">Alu 30 × 30</option><option value="alu35">Alu 35 × 35</option><option value="none">ohne</option></select></Field>
          <Field label="Laminat"><input disabled={ro} type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} title="Farbe des Laminats" /></Field>
        </div>
        <label className="check"><input disabled={ro} type="checkbox" checked={c.cornerBalls} onChange={(e) => set({ cornerBalls: e.target.checked })} /> Kugelecken an allen Außenecken</label>

        </Section>
        <Section id="case.castors" title="Rollen" summary={castors ? `${castors} × ${c.castorSize} mm` : 'keine'}>
        <div className="row gap8">
          <Field label="Anzahl"><select disabled={ro} value={castors} onChange={(e) => setCastors(Number(e.target.value))}><option value={0}>keine</option><option value={4}>4, davon 2 mit Bremse</option></select></Field>
          <Field label="Raddurchmesser"><select disabled={ro} value={c.castorSize} onChange={(e) => set({ castorSize: Number(e.target.value) as FlightCase['castorSize'] })}><option value={75}>75 mm</option><option value={100}>100 mm</option><option value={125}>125 mm</option></select></Field>
        </div>

        </Section>
        <Section id="case.hardware" title="Beschläge" summary={`${c.hardware.filter((h) => !h.kind.startsWith('castor')).reduce((n, h) => n + h.count, 0)} Teile`}>
        <div className="hw-list">
          {c.hardware.map((h, i) => (h.kind.startsWith('castor') ? null : (
            <div key={i} className="hw-row">
              <select className="hw-kind" disabled={ro} value={h.kind} title="Art des Beschlags" onChange={(e) => { const k = e.target.value as HardwareKind; setHw(i, { kind: k, face: HARDWARE[k].faces.includes(h.face) ? h.face : HARDWARE[k].faces[0] }); }}>
                {KINDS.filter((k) => !k.startsWith('castor')).map((k) => <option key={k} value={k}>{HARDWARE[k].label}</option>)}
              </select>
              <label className="inline-field">Seite <select disabled={ro} value={h.face} onChange={(e) => setHw(i, { face: e.target.value as CaseFace })}>{HARDWARE[h.kind].faces.map((f) => <option key={f} value={f}>{FACE_LABELS[f]}</option>)}</select></label>
              <label className="inline-field">Stück <NumberInput value={h.count} min={1} max={12} onChange={(v) => setHw(i, { count: Math.max(1, Math.round(v)) })} style={{ width: 52 }} /></label>
              {!ro ? <button className="icon-btn" title={`${HARDWARE[h.kind].label} entfernen`} aria-label="Entfernen" onClick={() => set({ hardware: c.hardware.filter((_, j) => j !== i) })}>✕</button> : null}
            </div>
          )))}
        </div>
        {!ro ? (
          <div className="btn-group">
            <button className="btn sm" onClick={() => set({ hardware: [...c.hardware, { kind: 'butterfly', face: 'front', count: 1 }] })} title="Weiteren Beschlag in die Liste aufnehmen">Beschlag hinzufügen</button>
            <button className="btn sm" onClick={() => set({ hardware: [...autoHardware(c), ...c.hardware.filter((h) => h.kind.startsWith('castor'))] })} title="Verschlüsse, Griffe und Stapelschalen passend zur Größe neu setzen (Rollen bleiben)">Passend zur Größe setzen</button>
          </div>
        ) : null}

        </Section>
        <Section id="case.inlay" title="Einlage" summary={nItems ? `${nItems} Ausschnitte` : 'leer'}>
        <div className="muted small">
          {nItems ? `${nItems} Ausschnitt${nItems === 1 ? '' : 'e'}, Einlage ${inlayThickness(c)} mm` : 'Noch keine Ausschnitte'}. {FOAM_MATERIALS[foamMaterial(c)].label}, Boden {c.foam.bottom} mm, Rand {c.foam.sides} mm{c.lidKind !== 'none' ? `, Deckel ${c.foam.lid} mm` : ''}.
        </div>
        <button className="btn" onClick={() => openCaseInlay(c)} title="Schaumstoff und Ausschnitte dieses Cases im Einlagen-Designer bearbeiten">Einlage im Einlagen-Designer bearbeiten</button>

        </Section>
        <Section id="case.notes" title="Notizen" summary={c.notes ? c.notes.slice(0, 40) : 'keine'}>
          <textarea disabled={ro} rows={3} value={c.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} aria-label="Notizen" />
        </Section>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ parts list

export function PartsList({ c, project }: { c: FlightCase; project: Project }) {
  const [open, setOpen] = useState(true);
  const b = caseBom(c, project);
  return (
    <div className={'cable-list' + (open ? '' : ' closed')}>
      <div className="cable-list-head">
        <button className="cable-list-title" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Stückliste einklappen' : 'Stückliste ausklappen'}>{open ? '▾' : '▸'} Stückliste, {c.name}</button>
        <span className="muted small">Gewicht ca. {kg(b.weight.total)} kg ({kg(b.weight.case)} kg {c.kind && c.kind !== 'case' ? 'Schaum' : 'Case'} + {kg(b.weight.contents)} kg Inhalt){b.volume ? `, Volumen ${kg(b.volume)} m³` : ''}</span>
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
          <table className="cable-table"><thead><tr><th>Schaumstoff</th><th>Maß (mm)</th><th>Stärke</th><th>aus Platten</th></tr></thead>
            <tbody>{b.foam.map((f) => <tr key={f.name}><td>{f.name}</td><td>{Math.round(f.a)} × {Math.round(f.b)}</td><td>{Math.round(f.t)} mm</td><td className="muted">{f.stack ?? ''}</td></tr>)}</tbody></table>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ workspace

export function CaseWorkspace() {
  const project = useStore((s) => s.project);
  const activeId = useStore((s) => s.activeCaseId);
  const ro = useStore((s) => s.readOnly);
  const layout = useLayout();
  const [view, setView] = useState<'drawing' | '3d'>('drawing');
  const cases = caseList(project);
  const c = cases.find((x) => x.id === activeId) ?? cases[0];
  if (!c) {
    return (
      <main className="workspace">
        <EmptyState title="Case-Designer" text="Flightcases konstruieren: Innenmaß, Deckel, Platten, Kantenprofile, Beschläge und Rollen. Außenmaß, Plattenzuschnitte und Gewicht rechnet die App aus. Den Schaumstoff mit den Ausschnitten gestaltest du danach im Einlagen-Designer.">
          {!ro ? <button className="btn primary" onClick={() => st().addCase(newCase('Case 1'))}>Neues Case anlegen</button> : null}
        </EmptyState>
      </main>
    );
  }
  const L = sheetLayout(c);
  return (
    <main className="workspace">
      <section className="center">
        <Toolbar>
          <ToolGroup>
            <Seg value={view} onChange={setView} options={[
              { id: 'drawing', label: 'Zeichnung', title: 'Maßzeichnung: Innenansicht, Vorder- und Seitenansicht' },
              { id: '3d', label: '3D', title: 'Räumliche Ansicht, mit der Maus drehen und zoomen' },
            ]} />
          </ToolGroup>
          {!ro ? (
            <ToolGroup>
              <button className="btn sm" onClick={() => openCaseInlay(c)} title="Schaumstoff und Ausschnitte dieses Cases im Einlagen-Designer bearbeiten">Einlage bearbeiten</button>
            </ToolGroup>
          ) : null}
          <span className="spacer" />
          <ShowMenu list="Stückliste" />
        </Toolbar>
        <div className="stage">
          <ErrorBoundary resetKey={view + c.id}>
            {view === '3d' ? <Case3D c={c} /> : (
              <SheetCanvas c={c} size={{ x: -90, y: -40, w: L.w + 130, h: L.h + 60 }} fitKey={`${c.id}:${Math.round(L.w)}:${Math.round(L.h)}`} editable={false}
                hint="Mausrad zoomt, Ziehen verschiebt, Doppelklick passt ein. Ausschnitte bearbeitest du im Einlagen-Designer.">
                {() => <CaseSheet c={c} />}
              </SheetCanvas>
            )}
          </ErrorBoundary>
        </div>
        {layout.showCableList ? <div className="cable-list-wrap" style={{ maxHeight: 300 }}><PartsList c={c} project={project} /></div> : null}
      </section>
      {layout.showInspector ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={240} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}><CaseInspector c={c} project={project} /></div>
        </>
      ) : null}
    </main>
  );
}
