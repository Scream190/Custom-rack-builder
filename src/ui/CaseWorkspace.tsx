import { useEffect, useState } from 'react';
import { useStore } from '../model/store';
import type { CaseFace, CaseHardware, CaseSeam, FlightCase, HardwareKind, Project } from '../model/types';
import { addDivider, applyCaseType, autoHardware, DIVIDER_LABELS, dividerGaps, dividerRange, spreadDividers, type DividerAxis, caseBom, caseBoxes, caseDims, caseWarnings, CASE_TYPES, doorDepths, FACE_LABELS, faceSpan, HARDWARE, hardwareInstances, hasDoors, LID_LABELS, mirrorHardware, moveHardware, OPPOSITE_FACE, newCase, newDrawerInlay, partLabelOf, removeSelection, SEAM_LABELS, type CasePartId } from '../model/cases';
import { panelMaterial, PANEL_MATERIALS, partLabel, partsForKind, partsInGroup, profileBySku, profileLabel, profilesFor } from '../library/caseHardware';
import { caseList, foamMaterial, FOAM_MATERIALS, inlayThickness } from '../model/inlay';
import { formatLength } from '../model/geometry';
import { CaseSheet, sheetLayout } from '../render/CaseDrawing';
import { Case3D, type CaseEdit, type CaseTool } from '../three/Case3D';
import { CaseTimeline } from './CaseTimeline';
import { isRolledBack, setMarker, timelineMarker } from '../model/timeline';
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
const seamKinds: HardwareKind[] = ['butterfly', 'butterfly-small', 'draw-latch', 'hinge', 'piano-hinge'];

function CaseInspector({ c, project, edit }: { c: FlightCase; project: Project; edit?: CaseEdit }) {
  const ro = useStore((s) => s.readOnly);
  const set = (patch: Partial<FlightCase>) => st().updateCase(c.id, patch);
  const d = caseDims(c);
  const b = caseBom(c, project);
  const warnings = caseWarnings(c);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const setCastors = (n: number) => set({ hardware: [...c.hardware.filter((h) => !h.kind.startsWith('castor')), ...(n ? [{ kind: 'castor' as const, face: 'bottom' as const, count: n / 2 }, { kind: 'castor-braked' as const, face: 'bottom' as const, count: n / 2 }] : [])] });
  const setHw = (i: number, p: Partial<CaseHardware>) => set({ hardware: c.hardware.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  const nItems = c.items.length;
  const dd = doorDepths(c);
  const seams: CaseSeam[] = [...(c.lidKind !== 'none' ? ['lid' as const] : []), ...(['front', 'back', 'left', 'right'] as const).filter((s) => dd[s] > 0)];
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
        {isRolledBack(c) ? (
          <div className="warn-box">
            <div className="warn">{c.timeline!.steps.length - timelineMarker(c) === 1 ? 'Zeitleiste zurückgerollt: Der letzte Schritt ist nicht aktiv. Neue Änderungen werden an der Markierung eingefügt.' : `Zeitleiste zurückgerollt: ${c.timeline!.steps.length - timelineMarker(c)} spätere Schritte sind nicht aktiv. Neue Änderungen werden an der Markierung eingefügt.`}</div>
            {!ro ? <button className="btn sm" onClick={() => st().caseHistory(c.id, (x) => setMarker(x, x.timeline!.steps.length))} title="Alle Schritte wieder abspielen">Ans Ende</button> : null}
          </div>
        ) : null}
        {edit?.selected ? <SelectionBox c={c} edit={edit} /> : null}

        <Section id="case.inner" title="Innenmaße" defaultOpen summary={`${c.inner.l} × ${c.inner.w} × ${c.inner.h} mm`}>
        <div className="row gap8">
          <Field label="Länge (mm)"><NumberInput value={c.inner.l} min={50} onChange={(v) => set({ inner: { ...c.inner, l: v } })} /></Field>
          <Field label="Breite (mm)"><NumberInput value={c.inner.w} min={50} onChange={(v) => set({ inner: { ...c.inner, w: v } })} /></Field>
          <Field label="Höhe (mm)"><NumberInput value={c.inner.h} min={10} onChange={(v) => set({ inner: { ...c.inner, h: v } })} /></Field>
        </div>

        </Section>
        <Section id="case.type" title="Bauform" defaultOpen summary={CASE_TYPES.find((x) => x.id === c.caseType)?.label ?? (hasDoors(c) ? 'mit Türen' : c.lidKind === 'none' ? 'ohne Deckel' : 'mit Deckel')}>
        <div className="case-types">
          {CASE_TYPES.map((ty) => (
            <button key={ty.id} disabled={ro} className={'btn sm' + (c.caseType === ty.id ? ' active' : '')} title={ty.note} onClick={() => set(applyCaseType(c, ty.id))}>{ty.label}</button>
          ))}
        </div>
        <div className="muted small">Setzt Deckel, Türen und Beschläge passend. Innenmaße bleiben. Rack-Cases (auch Shockmount) baust du im Rack-Designer. Türen: Innentiefe in mm, 0 = keine Tür.</div>
        <div className="row gap8">
          {(['front', 'back', 'left', 'right'] as const).map((s) => (
            <Field key={s} label={`${SEAM_LABELS[s]} (mm)`}><NumberInput value={c.doors?.[s] ?? 0} min={0} max={Math.round((s === 'front' || s === 'back' ? c.inner.w : c.inner.l) / 2)} onChange={(v) => set({ doors: { ...c.doors, [s]: Math.max(0, Math.round(v)) || undefined }, caseType: undefined })} /></Field>
          ))}
        </div>
        {hasDoors(c) && c.lidKind !== 'none' ? (
          <Field label="Türen und Deckel"><select disabled={ro} value={c.doors?.span ?? 'full'} onChange={(e) => set({ doors: { ...c.doors, span: e.target.value as 'full' | 'body' } })}>
            <option value="full">Türen über die ganze Höhe, Deckel dazwischen</option>
            <option value="body">Deckel über alles, Türen darunter</option>
          </select></Field>
        ) : null}
        {c.lidKind !== 'none' ? <label className="check"><input disabled={ro} type="checkbox" checked={!!c.lidSplit} onChange={(e) => set({ lidSplit: e.target.checked || undefined })} /> Deckel in der Mitte geteilt (zwei Hälften)</label> : null}
        <div className="muted small">Schubladen im Unterteil{c.drawers?.length ? `: ${c.drawers.length}` : ': keine'}</div>
        {(c.drawers ?? []).map((dr, i) => (
          <div key={i} className="hw-row">
            <label className="inline-field">{`Schublade ${i + 1}, Fronthöhe (mm)`} <NumberInput value={dr.h} min={40} max={600} onChange={(v) => set({ drawers: (c.drawers ?? []).map((x, j) => (j === i ? { h: Math.max(40, Math.round(v)) } : x)) })} style={{ width: 64 }} /></label>
            {!ro ? <button className="icon-btn" title="Schublade entfernen" aria-label="Entfernen" onClick={() => set({ drawers: (c.drawers ?? []).filter((_, j) => j !== i) })}>✕</button> : null}
          </div>
        ))}
        {!ro ? <button className="btn sm" onClick={() => set({ drawers: [...(c.drawers ?? []), { h: 120 }] })} title="Schublade auf Auszügen ins Unterteil einsetzen">Schublade hinzufügen</button> : null}
        <div className="muted small">{c.dividers.length ? `Einbauten: Fachböden ${c.dividers.filter((x) => x.axis === 'z').length}, Trennwände ${c.dividers.filter((x) => x.axis !== 'z').length}` : 'Einbauten: keine'}</div>
        {!ro ? (
          <div className="case-add">
            {(['z', 'x', 'y'] as DividerAxis[]).map((a) => {
              const [r0, r1] = dividerRange(c, a);
              return <button key={a} className="btn sm" onClick={() => { const dividers = spreadDividers({ ...c, dividers: addDivider(c, a, (r0 + r1) / 2) }, a); set({ dividers }); edit?.select(`div:${dividers.length - 1}`); }} title={`${DIVIDER_LABELS[a]} einsetzen, alle dieser Richtung werden gleichmäßig verteilt`}>{`${DIVIDER_LABELS[a]} +`}</button>;
            })}
          </div>
        ) : null}

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
          <Field label="Material" grow={2}><select disabled={ro} value={c.parts?.panel ?? ''} onChange={(e) => {
            const m = panelMaterial(e.target.value);
            const panel = m ? m.thicknesses.reduce((a, b) => (Math.abs(b - c.panel) < Math.abs(a - c.panel) ? b : a)) : c.panel;
            set({ parts: { ...c.parts, panel: m?.id }, panel });
          }}>
            <option value="">allgemein (Multiplex)</option>
            {PANEL_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.maker})</option>)}
          </select></Field>
          <Field label="Platte"><select disabled={ro} value={c.panel} onChange={(e) => set({ panel: Number(e.target.value) })}>{(panelMaterial(c.parts?.panel)?.thicknesses ?? [5, 6.5, 7, 9, 10, 12, 15]).map((t) => <option key={t} value={t}>{String(t).replace('.', ',')} mm</option>)}</select></Field>
          <Field label="Laminat"><input disabled={ro} type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} title="Farbe des Laminats" /></Field>
        </div>
        <Field label="Kantenprofil"><select disabled={ro} value={c.parts?.edge ? `sku:${c.parts.edge}` : c.profile} onChange={(e) => {
          const v = e.target.value;
          if (v.startsWith('sku:')) { const pr = profileBySku(v.slice(4))!; set({ parts: { ...c.parts, edge: pr.sku }, profile: Math.max(...pr.legs) >= 33 ? 'alu35' : 'alu30' }); }
          else set({ parts: { ...c.parts, edge: undefined }, profile: v as FlightCase['profile'] });
        }}>
          <option value="alu30">Alu 30 × 30 (allgemein)</option><option value="alu35">Alu 35 × 35 (allgemein)</option><option value="none">ohne</option>
          <optgroup label={`Doppelwinkel für ${String(c.panel).replace('.', ',')} mm`}>{profilesFor('double', c.panel).map((p) => <option key={p.sku} value={`sku:${p.sku}`}>{profileLabel(p)}</option>)}</optgroup>
          <optgroup label="Einfachwinkel">{profilesFor('single', c.panel).map((p) => <option key={p.sku} value={`sku:${p.sku}`}>{profileLabel(p)}</option>)}</optgroup>
          {c.parts?.edge && !profilesFor(['double', 'single'], c.panel).some((p) => p.sku === c.parts?.edge) ? <option value={`sku:${c.parts.edge}`}>{profileLabel(profileBySku(c.parts.edge)!)} (passt nicht zur Platte)</option> : null}
        </select></Field>
        <Field label="Schließprofil (Deckel- und Türfuge)"><select disabled={ro} value={c.parts?.closing ?? ''} onChange={(e) => set({ parts: { ...c.parts, closing: e.target.value || undefined } })}>
          <option value="">Hybrid (allgemein)</option>
          <optgroup label={`Hybrid für ${String(c.panel).replace('.', ',')} mm`}>{profilesFor('hybrid', c.panel).map((p) => <option key={p.sku} value={p.sku}>{profileLabel(p)}</option>)}</optgroup>
          <optgroup label="Nut und Feder (Paar)">{profilesFor('tongue', c.panel).map((p) => <option key={p.sku} value={p.sku}>{`${p.maker} ${p.sku} + ${p.mate}: Nut-Feder-Paar, Platte ${String(p.panel![0]).replace('.', ',')} bis ${String(p.panel![1]).replace('.', ',')} mm`}</option>)}</optgroup>
          {c.parts?.closing && ![...profilesFor('hybrid', c.panel), ...profilesFor('tongue', c.panel)].some((p) => p.sku === c.parts?.closing) ? <option value={c.parts.closing}>{profileLabel(profileBySku(c.parts.closing)!)} (passt nicht zur Platte)</option> : null}
        </select></Field>
        <label className="check"><input disabled={ro} type="checkbox" checked={c.cornerBalls} onChange={(e) => set({ cornerBalls: e.target.checked })} /> Kugelecken an allen Außenecken</label>
        {c.cornerBalls ? <Field label="Kugelecke"><select disabled={ro} value={c.parts?.corner ?? ''} onChange={(e) => set({ parts: { ...c.parts, corner: e.target.value || undefined } })}>
          <option value="">allgemein</option>
          {partsInGroup('corner').map((p) => <option key={p.sku} value={p.sku}>{partLabel(p)}</option>)}
        </select></Field> : null}

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
              {seamKinds.includes(h.kind) && seams.length > 1 ? <label className="inline-field">Fuge <select disabled={ro} value={h.seam ?? 'lid'} onChange={(e) => setHw(i, { seam: e.target.value === 'lid' ? undefined : (e.target.value as CaseSeam) })}>{seams.map((s) => <option key={s} value={s}>{SEAM_LABELS[s]}</option>)}</select></label> : null}
              {partsForKind(h.kind).length ? <label className="inline-field">Artikel <select disabled={ro} value={h.sku ?? ''} onChange={(e) => setHw(i, { sku: e.target.value || undefined })}><option value="">allgemein</option>{partsForKind(h.kind).map((p) => <option key={p.sku} value={p.sku}>{partLabel(p)}</option>)}</select></label> : null}
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

// ------------------------------------------------------------------ editor: selection, component tree

/** what is selected in the 3D editor, with its own fields (position of a piece, depth of a door, ...) */
function SelectionBox({ c, edit }: { c: FlightCase; edit: CaseEdit }) {
  const ro = useStore((s) => s.readOnly);
  const set = (patch: Partial<FlightCase>) => st().updateCase(c.id, patch);
  const sel = edit.selected!;
  const del = () => { const p = removeSelection(c, sel); if (p) { set(p); edit.select(null); } };
  const hw = /^hw:(\d+)(?::(\d+))?$/.exec(sel);
  if (hw) {
    const i = Number(hw[1]), h = c.hardware[i];
    if (!h) return null;
    const k = hw[2] === undefined ? null : Number(hw[2]);
    const inst = k === null ? null : hardwareInstances(c).find((x) => x.i === i && x.k === k);
    const n = h.at?.length ?? h.count;
    const span = faceSpan(c, h.face);
    const where = FACE_LABELS[h.face] + (h.seam && h.seam !== 'lid' ? ` (${SEAM_LABELS[h.seam]})` : '');
    const mirrored = mirrorHardware(c, i);
    return (
      <div className="case-sel">
        <div><b>{HARDWARE[h.kind].label}</b> <span className="muted small">{k !== null ? `${where}, Stück ${k + 1} von ${n}` : `${where}, ${n} Stück`}</span></div>
        {inst ? (
          <div className="row gap8">
            <Field label={h.face === 'top' ? 'von links (mm)' : 'von der linken Kante (mm)'}><NumberInput value={Math.round(inst.u)} min={0} max={Math.round(span)} onChange={(v) => set({ hardware: moveHardware(c, i, k!, v, inst.z) })} /></Field>
            <Field label={h.face === 'top' ? 'von vorne (mm)' : 'Höhe (mm)'}><NumberInput value={Math.round(inst.z)} min={0} onChange={(v) => set({ hardware: moveHardware(c, i, k!, inst.u, v) })} /></Field>
          </div>
        ) : null}
        {!ro ? (
          <div className="btn-group">
            {h.at ? <button className="btn sm" onClick={() => set({ hardware: c.hardware.map((x, j) => (j === i ? { ...x, at: undefined, count: x.at!.length } : x)) })} title="Handgesetzte Positionen verwerfen und die Teile wieder gleichmäßig verteilen">Gleichmäßig verteilen</button> : null}
            {k !== null ? <button className="btn sm" onClick={() => edit.select(`hw:${i}`)} title="Alle Teile dieser Zeile auswählen">Ganze Zeile</button> : null}
            {mirrored ? <button className="btn sm" onClick={() => { set({ hardware: mirrored }); edit.select(`hw:${mirrored.length - 1}`); }} title={`Dieselben Beschläge spiegelbildlich auf die Seite ${FACE_LABELS[OPPOSITE_FACE[h.face]!]} setzen`}>Auf Gegenseite spiegeln</button> : null}
            <button className="btn sm danger" onClick={del} title="Ausgewähltes löschen (Entf)">{k !== null ? 'Stück löschen' : 'Zeile löschen'}</button>
          </div>
        ) : null}
      </div>
    );
  }
  const dvm = /^div:(\d+)$/.exec(sel);
  if (dvm) {
    const i = Number(dvm[1]), dv = c.dividers[i];
    if (!dv) return null;
    const [r0, r1] = dividerRange(c, dv.axis);
    const [g0, g1] = dividerGaps(c, i);
    const nr = c.dividers.slice(0, i + 1).filter((x) => x.axis === dv.axis).length;
    const sameAxis = c.dividers.filter((x) => x.axis === dv.axis).length;
    const posLabel = dv.axis === 'z' ? 'Höhe über dem Boden (mm)' : dv.axis === 'x' ? 'Abstand von vorne (mm)' : 'Abstand von links (mm)';
    const gapText = dv.axis === 'z' ? `frei darunter ${g0} mm, darüber ${g1} mm` : dv.axis === 'x' ? `frei davor ${g0} mm, dahinter ${g1} mm` : `frei links ${g0} mm, rechts ${g1} mm`;
    return (
      <div className="case-sel">
        <div><b>{`${DIVIDER_LABELS[dv.axis]} ${nr}`}</b> <span className="muted small">{gapText}</span></div>
        <Field label={posLabel}><NumberInput value={Math.round(dv.pos)} min={Math.round(r0 + 10)} max={Math.round(r1 - 10)} onChange={(v) => set({ dividers: c.dividers.map((x, j) => (j === i ? { ...x, pos: Math.max(r0 + 10, Math.min(r1 - 10, v)) } : x)) })} /></Field>
        {!ro ? (
          <div className="btn-group">
            {sameAxis > 1 ? <button className="btn sm" onClick={() => set({ dividers: spreadDividers(c, dv.axis) })} title="Alle Einbauten dieser Richtung mit gleichen Abständen verteilen">Gleichmäßig verteilen</button> : null}
            <button className="btn sm danger" onClick={del} title="Ausgewähltes löschen (Entf)">Einbau löschen</button>
          </div>
        ) : null}
      </div>
    );
  }
  const part = sel.startsWith('part:') ? (sel.slice(5) as CasePartId) : null;
  const bx = part ? caseBoxes(c).find((b) => b.id === part) : null;
  if (!part || !bx) return null;
  const dd = doorDepths(c);
  return (
    <div className="case-sel">
      <div><b>{partLabelOf(c, part)}</b> <span className="muted small">{`außen ${Math.round(bx.x1 - bx.x0)} × ${Math.round(bx.y1 - bx.y0)} × ${Math.round(bx.z1 - bx.z0)} mm`}</span></div>
      {bx.role === 'door' && bx.side ? <Field label="Tiefe innen (mm)"><NumberInput value={dd[bx.side]} min={30} max={Math.round((bx.side === 'front' || bx.side === 'back' ? c.inner.w : c.inner.l) / 2)} onChange={(v) => set({ doors: { ...c.doors, [bx.side!]: Math.max(30, Math.round(v)) }, caseType: undefined })} /></Field> : null}
      {bx.role === 'lid' ? <Field label="Deckelhöhe innen (mm)"><NumberInput value={c.lidH} min={20} max={c.inner.h - 20} onChange={(v) => set({ lidH: v })} /></Field> : null}
      {bx.role === 'base' ? <div className="muted small">Maße ändern: an den Pfeilen ziehen oder unter Innenmaße eintragen.</div> : null}
      {!ro && bx.role !== 'base' ? <div className="btn-group"><button className="btn sm danger" onClick={del} title="Ausgewähltes löschen (Entf)">{bx.role === 'lid' ? (c.lidSplit ? 'Teilung aufheben' : 'Deckel entfernen') : 'Tür entfernen'}</button></div> : null}
    </div>
  );
}

const Eye = ({ off }: { off: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" />
    {off ? <path d="M2.5 13.5 13.5 2.5" /> : <circle cx="8" cy="8" r="2" />}
  </svg>
);

/** component browser: shells, hardware rows (and pieces), foam; with visibility toggles */
function CaseTree({ c, edit, setHidden }: { c: FlightCase; edit: CaseEdit; setHidden: (h: Set<string>) => void }) {
  const toggle = (k: string) => { const h = new Set(edit.hidden); if (h.has(k)) h.delete(k); else h.add(k); setHidden(h); };
  const insts = hardwareInstances(c);
  const selRow = /^hw:(\d+)/.exec(edit.selected ?? '')?.[1];
  const node = (key: string, label: string, sel: string | null, sub = false, eyeKey?: string) => (
    <div key={key} className={'node' + (sub ? ' sub' : '') + (sel && edit.selected === sel ? ' sel' : '') + (eyeKey && edit.hidden.has(eyeKey) ? ' off' : '')} onClick={() => sel && edit.select(sel)}>
      {eyeKey ? <button className="eye" title={edit.hidden.has(eyeKey) ? 'Einblenden' : 'Ausblenden'} aria-label={edit.hidden.has(eyeKey) ? 'Einblenden' : 'Ausblenden'} onClick={(e) => { e.stopPropagation(); toggle(eyeKey); }}><Eye off={edit.hidden.has(eyeKey)} /></button> : <span className="eye" />}
      <span className="nm" title={label}>{label}</span>
    </div>
  );
  return (
    <div className="case-tree" aria-label="Bauteile">
      <h4>Körper</h4>
      {caseBoxes(c).map((b) => node(b.id, partLabelOf(c, b.id), `part:${b.id}`, false, `part:${b.id}`))}
      <h4>Beschläge</h4>
      {c.hardware.map((h, i) => {
        if (h.kind.startsWith('castor')) return null;
        const pieces = insts.filter((x) => x.i === i);
        const n = h.at?.length ?? h.count;
        return [
          node(`hw${i}`, `${HARDWARE[h.kind].label}, ${FACE_LABELS[h.face]}${h.seam && h.seam !== 'lid' ? ` (${SEAM_LABELS[h.seam]})` : ''}, ${n} ×`, `hw:${i}`, false, `hw:${i}`),
          ...(selRow === String(i) && pieces.length > 1 ? pieces.map((p) => node(`hw${i}:${p.k}`, `Stück ${p.k + 1}${h.at ? '' : ', verteilt'}`, `hw:${i}:${p.k}`, true)) : []),
        ];
      })}
      {c.dividers.length ? <h4>Einbauten</h4> : null}
      {c.dividers.map((dv, i) => node(`div${i}`, `${DIVIDER_LABELS[dv.axis]} ${c.dividers.slice(0, i + 1).filter((x) => x.axis === dv.axis).length}`, `div:${i}`, false, `div:${i}`))}
      <h4>Einlage</h4>
      {node('foam', 'Schaumstoff', null, false, 'foam')}
    </div>
  );
}

/** hardware the placement tool offers (things that sit on the outside and can be clicked onto a face) */
const PLACEABLE = (Object.keys(HARDWARE) as HardwareKind[]).filter((k) => !['castor', 'castor-braked', 'skid', 'foot', 'lid-stay'].includes(k) && HARDWARE[k].faces.some((f) => f !== 'bottom'));

// ------------------------------------------------------------------ parts list

/** cut lengths grouped: "4 × 618, 2 × 800" */
function cutList(pieces: number[]) {
  const m = new Map<number, number>();
  for (const p of pieces) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([l, n]) => `${n} × ${l}`).join(', ');
}

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
              <tbody>{b.panels.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.count}</td><td>{Math.round(p.a)} × {Math.round(p.b)}</td></tr>)}
                {b.sheets ? <tr><td className="muted">{b.sheets.material} {kg(b.sheets.thickness)} mm, {kg(b.sheets.area)} m²</td><td>{b.sheets.count}</td><td className="muted">Tafeln {b.sheets.size[0]} × {b.sheets.size[1]}, 5 % Verschnitt</td></tr> : null}</tbody></table>
          ) : null}
          {b.profiles.length ? (
            <table className="cable-table"><thead><tr><th>Profil</th><th>Länge</th><th>Zuschnitt (mm)</th><th>Stangen</th></tr></thead>
              <tbody>{b.profiles.map((p) => <tr key={p.name}><td>{p.name}</td><td>{formatLength(p.length)}</td><td className="muted">{p.pieces ? cutList(p.pieces) : ''}</td><td>{p.bars ? `${p.bars} × ${profileBySku(p.sku)?.stock ?? 4} m` : ''}</td></tr>)}</tbody></table>
          ) : null}
          {b.hardware.length ? (
            <table className="cable-table"><thead><tr><th>Beschlag</th><th>Stk.</th></tr></thead>
              <tbody>{b.hardware.map((h, i) => <tr key={i}><td>{h.label}</td><td>{h.count}</td></tr>)}</tbody></table>
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
  const [view, setView] = useState<'drawing' | '3d'>('3d');
  const [tool, setTool] = useState<CaseTool>('select');
  const [selected, select] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const cases = caseList(project);
  const c = cases.find((x) => x.id === activeId) ?? cases[0];
  const edit: CaseEdit | undefined = c ? { tool, setTool, selected, select, hidden, readOnly: ro } : undefined;
  useEffect(() => { select(null); setTool('select'); }, [c?.id]);
  // keyboard: Del removes the selection, Esc ends a tool or clears the selection
  useEffect(() => {
    if (view !== '3d' || !c) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'Escape') { if (tool !== 'select') setTool('select'); else select(null); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !ro) {
        const p = removeSelection(c, selected);
        if (p) { st().updateCase(c.id, p); select(null); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, c, tool, selected, ro]);
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
          {view === '3d' && !ro ? (
            <ToolGroup label="Werkzeug">
              <Seg value={tool.startsWith('place:') ? ('place' as CaseTool) : tool} onChange={(v) => setTool(v === ('place' as CaseTool) ? (`place:${PLACEABLE[0]}` as CaseTool) : v)} options={[
                { id: 'select', label: 'Auswählen', title: 'Auswählen, Beschläge verschieben, an den Pfeilen Maße ziehen (Esc)' },
                { id: 'seam-h', label: 'Fuge waagrecht', title: 'Case waagrecht teilen: Klick auf eine Seitenwand setzt die Deckelfuge' },
                { id: 'seam-v', label: 'Fuge senkrecht', title: 'Case senkrecht teilen: Klick nahe einem Ende setzt eine Tür, in der Deckelmitte wird der Deckel geteilt' },
              ]} />
              <select className={tool.startsWith('place:') ? 'active' : ''} value={tool.startsWith('place:') ? tool.slice(6) : ''} onChange={(e) => setTool(e.target.value ? (`place:${e.target.value}` as CaseTool) : 'select')} title="Beschlag wählen und auf die Außenseite klicken">
                <option value="">Beschlag setzen …</option>
                {PLACEABLE.map((k) => <option key={k} value={k}>{HARDWARE[k].label}</option>)}
              </select>
              <select className={tool.startsWith('div:') ? 'active' : ''} value={tool.startsWith('div:') ? tool.slice(4) : ''} onChange={(e) => setTool(e.target.value ? (`div:${e.target.value}` as CaseTool) : 'select')} title="Fachboden oder Trennwand wählen und auf eine Außenwand klicken">
                <option value="">Einbau setzen …</option>
                {(['z', 'x', 'y'] as const).map((a) => <option key={a} value={a}>{DIVIDER_LABELS[a]}</option>)}
              </select>
            </ToolGroup>
          ) : null}
          {!ro ? (
            <ToolGroup>
              <button className="btn sm" onClick={() => openCaseInlay(c)} title="Schaumstoff und Ausschnitte dieses Cases im Einlagen-Designer bearbeiten">Einlage bearbeiten</button>
            </ToolGroup>
          ) : null}
          <span className="spacer" />
          <ShowMenu list="Stückliste" library="Bauteile" />
        </Toolbar>
        <div className="stage">
          <ErrorBoundary resetKey={view + c.id}>
            {view === '3d' ? (
              <div className="case-edit">
                {layout.showLibrary ? <CaseTree c={c} edit={edit!} setHidden={setHidden} /> : null}
                <div className="case-view"><Case3D c={c} edit={edit} /></div>
              </div>
            ) : (
              <SheetCanvas c={c} size={{ x: -90, y: -40, w: L.w + 130, h: L.h + 60 }} fitKey={`${c.id}:${Math.round(L.w)}:${Math.round(L.h)}`} editable={false}
                hint="Mausrad zoomt, Ziehen verschiebt, Doppelklick passt ein. Ausschnitte bearbeitest du im Einlagen-Designer.">
                {() => <CaseSheet c={c} />}
              </SheetCanvas>
            )}
          </ErrorBoundary>
        </div>
        <CaseTimeline c={c} edit={view === '3d' ? edit : undefined} />
        {layout.showCableList ? <div className="cable-list-wrap" style={{ maxHeight: 300 }}><PartsList c={c} project={project} /></div> : null}
      </section>
      {layout.showInspector ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={240} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}><CaseInspector c={c} project={project} edit={view === '3d' ? edit : undefined} /></div>
        </>
      ) : null}
    </main>
  );
}
