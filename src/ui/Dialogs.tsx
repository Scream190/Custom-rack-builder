import { useState } from 'react';
import { caseList, inlayList } from '../model/inlay';
import { allRackTypes, useActiveRack, useStore } from '../model/store';
import type { Bay, CableType, Face, RackKind, RackType, SignalType } from '../model/types';
import { RACK_KIND_LABELS } from '../library/rackTypes';
import { SIGNAL_LABELS } from '../model/connectors';
import { arrangeBays, faceWidth, rackBays, rackExtent, U } from '../model/geometry';
import { deepClone, downloadBlob, safeFileName, uid } from '../model/util';
import { Field, Modal, NumberInput } from './Modal';
import { rackSvgSize, rackSvgString, svgToPngBlob } from '../export/render';
import { buildInteractiveHtml } from '../export/html';
import { RfExportCard } from './RfDialogs';

// ----------------------------------------------------------------------------- rack types

export function RackTypeEditor() {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const types = allRackTypes(project);
  const [draft, setDraft] = useState<RackType>(() => ({ ...deepClone(rack.type), id: uid('rt-'), name: rack.type.name + ' (eigen)', custom: true }));
  const set = (p: Partial<RackType>) => setDraft((d) => ({ ...d, ...p }));
  const isExisting = project.rackTypes.some((t) => t.id === draft.id);
  const [gap, setGap] = useState(40);
  const bays = draft.bays?.length ? draft.bays : null;
  const ext = rackExtent(draft);
  const setBays = (b: Bay[] | null) => setDraft((d) => {
    if (!b) { const first = d.bays?.[0]; const { bays: _drop, ...rest } = d; void _drop; return { ...rest, heightU: first?.heightU ?? d.heightU, rackStandard: first?.rackStandard ?? d.rackStandard }; }
    const next = { ...d, bays: b };
    const e = rackExtent(next);
    return { ...next, heightU: Math.round(e.h / U), rackStandard: b[0].rackStandard };
  });
  const setBay = (i: number, p: Partial<Bay>) => setBays(bays!.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const fitOuter = () => {
    const wall = draft.kind === 'shockmount' ? 70 : draft.kind === 'cabinet' ? 60 : draft.kind === 'open' ? 25 : 40;
    const top = draft.kind === 'cabinet' || draft.kind === 'shockmount' ? 120 : draft.kind === 'open' ? 40 : 70;
    set({ outer: { ...draft.outer, w: Math.round(ext.w + 2 * wall), h: Math.round(ext.h + top) } });
  };
  const st = useStore.getState;

  const save = (apply: boolean) => {
    st().upsertRackType(draft);
    if (apply) {
      // devices in bays that no longer exist move to the first bay
      const n = rackBays(draft).length;
      st().updateRack(rack.id, { type: draft, devices: rack.devices.map((d) => ((d.bay ?? 0) < n ? d : { ...d, bay: undefined })) });
    }
    st().showToast(`Rack-Typ „${draft.name}“ gespeichert`);
  };

  return (
    <Modal wide title="Rack-Typen" footer={
      <>
        {isExisting ? <button className="btn danger" onClick={() => { st().deleteRackType(draft.id); setDraft({ ...draft, id: uid('rt-') }); }}>Löschen</button> : null}
        <span className="spacer" />
        <button className="btn" onClick={() => save(false)}>Speichern</button>
        <button className="btn primary" onClick={() => { save(true); st().openModal(null); }}>Speichern & auf „{rack.name}“ anwenden</button>
      </>
    }>
      <div className="editor-grid">
        <div className="type-list">
          <div className="muted small">Vorlage wählen (wird als eigener Typ kopiert):</div>
          {Object.entries(RACK_KIND_LABELS).map(([kind, label]) => (
            <div key={kind}>
              <div className="lib-cat static">{label}</div>
              {types.filter((t) => t.kind === kind).map((t) => (
                <button key={t.id} className={'list-btn' + (t.id === draft.id ? ' on' : '')}
                  onClick={() => setDraft(t.custom ? deepClone(t) : { ...deepClone(t), id: uid('rt-'), name: t.name + ' (eigen)', custom: true })}>
                  {t.name}{t.custom ? ' (eigen)' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="form-col">
          <Field label="Name"><input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <div className="row gap8">
            <Field label="Bauart">
              <select value={draft.kind} onChange={(e) => set({ kind: e.target.value as RackKind })}>
                {Object.entries(RACK_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {!bays ? (
              <Field label="Standard">
                <select value={draft.rackStandard} onChange={(e) => set({ rackStandard: Number(e.target.value) as 19 | 10 })}>
                  <option value={19}>19"</option><option value={10}>10"</option>
                </select>
              </Field>
            ) : null}
          </div>
          <div className="row gap8">
            {!bays ? <Field label="Höhe (HE)"><NumberInput value={draft.heightU} min={1} max={60} onChange={(v) => set({ heightU: Math.round(v), outer: { ...draft.outer, h: Math.round(Math.round(v) * U + (draft.outer.h - draft.heightU * U)) } })} /></Field> : null}
            <Field label="Einbautiefe (mm)" hint="Schiene vorne bis Schiene hinten"><NumberInput value={draft.depth} min={50} onChange={(v) => set({ depth: v })} /></Field>
          </div>

          <h4>Einbaufelder</h4>
          {!bays ? (
            <div className="row gap8 wrap">
              <span className="muted small">Ein Einbaufeld ({draft.heightU} HE, {draft.rackStandard}").</span>
              <button className="btn sm" onClick={() => setBays(arrangeBays([{ heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'links' }, { heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'rechts' }], 'row', gap))}>Doppelrack daraus machen</button>
              <button className="btn sm" onClick={() => setBays(arrangeBays([{ heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'links' }, { heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'Mitte' }, { heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'rechts' }], 'row', gap))}>Triple-Rack</button>
              <button className="btn sm" onClick={() => setBays(arrangeBays([{ heightU: 4, rackStandard: draft.rackStandard, label: 'oben' }, { heightU: draft.heightU, rackStandard: draft.rackStandard, label: 'unten' }], 'stack', gap))}>Kombirack (oben + unten)</button>
            </div>
          ) : (
            <>
              <table className="ct-table">
                <thead><tr><th>Name</th><th>HE</th><th>Std.</th><th>x (mm)</th><th>y (mm)</th><th /></tr></thead>
                <tbody>
                  {bays.map((b, i) => (
                    <tr key={i}>
                      <td><input value={b.label ?? ''} placeholder={`Feld ${i + 1}`} onChange={(e) => setBay(i, { label: e.target.value || undefined })} /></td>
                      <td><NumberInput value={b.heightU} min={1} max={60} onChange={(v) => setBay(i, { heightU: Math.max(1, Math.round(v)) })} style={{ width: 60 }} /></td>
                      <td><select value={b.rackStandard} onChange={(e) => setBay(i, { rackStandard: Number(e.target.value) as 19 | 10 })}><option value={19}>19"</option><option value={10}>10"</option></select></td>
                      <td><NumberInput value={Math.round(b.x)} step={5} min={0} onChange={(v) => setBay(i, { x: Math.max(0, v) })} style={{ width: 70 }} /></td>
                      <td><NumberInput value={Math.round(b.y)} step={5} min={0} onChange={(v) => setBay(i, { y: Math.max(0, v) })} style={{ width: 70 }} /></td>
                      <td><button className="icon-btn" title="Feld entfernen" onClick={() => setBays(bays.length > 2 ? bays.filter((_, j) => j !== i) : null)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row gap8 wrap align-end">
                <button className="btn sm" onClick={() => setBays([...bays, { heightU: bays[bays.length - 1].heightU, rackStandard: bays[bays.length - 1].rackStandard, x: rackExtent({ ...draft, bays }).w + gap, y: 0 }])}>+ Feld</button>
                <Field label="Abstand (mm)"><NumberInput value={gap} min={0} step={5} onChange={(v) => setGap(Math.max(0, v))} style={{ width: 70 }} /></Field>
                <button className="btn sm" onClick={() => setBays(arrangeBays(bays, 'row', gap))}>Nebeneinander anordnen</button>
                <button className="btn sm" onClick={() => setBays(arrangeBays(bays, 'stack', gap))}>Übereinander anordnen</button>
                <button className="btn sm" onClick={() => setBays(null)}>Ein Feld</button>
              </div>
              <svg className="bay-preview" viewBox={`${-20} ${-20} ${ext.w + 40} ${ext.h + 40}`} style={{ width: '100%', maxHeight: 180 }}>
                <rect x={-20} y={-20} width={ext.w + 40} height={ext.h + 40} rx={10} fill={draft.color} opacity={0.6} />
                {bays.map((b, i) => (
                  <g key={i}>
                    <rect x={b.x} y={ext.h - b.y - b.heightU * U} width={faceWidth(b.rackStandard)} height={b.heightU * U} fill="#0c0d0f" stroke="#5b6068" strokeWidth={4} />
                    <text x={b.x + faceWidth(b.rackStandard) / 2} y={ext.h - b.y - (b.heightU * U) / 2 + 12} fontSize={34} textAnchor="middle" fill="#e5e7eb">{b.label || `Feld ${i + 1}`}: {b.heightU} HE</text>
                  </g>
                ))}
              </svg>
              <div className="hint" style={{ padding: 0 }}>x/y = linke untere Ecke des Feldes in mm. Felder dürfen unterschiedlich hoch sein und auch übereinander liegen.</div>
            </>
          )}
          <button className="btn sm" onClick={fitOuter}>Außenmaß aus den Feldern berechnen</button>
          <label className="check"><input type="checkbox" checked={draft.hasRearRails} onChange={(e) => set({ hasRearRails: e.target.checked })} /> Hintere Rackschienen (Rückseiten-Montage möglich)</label>
          <div className="row gap8">
            <Field label="Außen B"><NumberInput value={draft.outer.w} min={ext.w} onChange={(v) => set({ outer: { ...draft.outer, w: v } })} /></Field>
            <Field label="Außen H"><NumberInput value={draft.outer.h} onChange={(v) => set({ outer: { ...draft.outer, h: v } })} /></Field>
            <Field label="Außen T"><NumberInput value={draft.outer.d} onChange={(v) => set({ outer: { ...draft.outer, d: v } })} /></Field>
          </div>
          <div className="row gap8">
            <Field label="Leergewicht (kg)"><NumberInput value={draft.weight ?? 0} step={0.5} min={0} onChange={(v) => set({ weight: v })} /></Field>
            <Field label="Farbe"><input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })} /></Field>
          </div>
          <div className="row gap8">
            <label className="check"><input type="checkbox" checked={!!draft.frontLid} onChange={(e) => set({ frontLid: e.target.checked })} /> Frontdeckel</label>
            <label className="check"><input type="checkbox" checked={!!draft.rearLid} onChange={(e) => set({ rearLid: e.target.checked })} /> Rückdeckel</label>
          </div>
          <Field label="Notizen"><textarea rows={3} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------- cable types

export function CableTypeEditor() {
  const project = useStore((s) => s.project);
  const st = useStore.getState;
  const usage = (id: string) => project.racks.reduce((n, r) => n + r.cables.filter((c) => c.typeId === id).length, 0);
  const upd = (t: CableType, p: Partial<CableType>) => st().upsertCableType({ ...t, ...p });
  return (
    <Modal wide title="Kabeltypen & Farben" footer={
      <>
        <button className="btn" onClick={() => st().upsertCableType({ id: uid('ct-'), name: 'Neuer Kabeltyp', signal: 'other', color: '#14b8a6', width: 2, stockLengths: [0.5, 1, 2, 3, 5], custom: true })}>+ Kabeltyp</button>
        <span className="spacer" />
        <button className="btn primary" onClick={() => st().openModal(null)}>Fertig</button>
      </>
    }>
      <div className="hint">Farben und Lagerlängen gelten für das ganze Projekt. Automatische Längen werden auf die nächste Lagerlänge aufgerundet (abschaltbar in den Einstellungen).</div>
      <table className="ct-table">
        <thead><tr><th>Farbe</th><th>Name</th><th>Signal</th><th>Strich</th><th>Lagerlängen (m)</th><th>Stecker (Auto-Zuordnung)</th><th>Verwendet</th><th /></tr></thead>
        <tbody>
          {project.cableTypes.map((t) => (
            <tr key={t.id}>
              <td><input type="color" value={t.color} onChange={(e) => upd(t, { color: e.target.value })} /></td>
              <td><input value={t.name} onChange={(e) => upd(t, { name: e.target.value })} /></td>
              <td>
                <select value={t.signal} onChange={(e) => upd(t, { signal: e.target.value as SignalType })}>
                  {Object.entries(SIGNAL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </td>
              <td>
                <select value={t.dash ?? ''} onChange={(e) => upd(t, { dash: e.target.value || undefined })}>
                  <option value="">durchgezogen</option><option value="6 3">gestrichelt</option><option value="2 2">gepunktet</option>
                </select>
              </td>
              <td><LengthsInput value={t.stockLengths} onChange={(v) => upd(t, { stockLengths: v })} /></td>
              <td><input value={(t.connectors ?? []).join(', ')} onChange={(e) => upd(t, { connectors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></td>
              <td className="muted">{usage(t.id)}</td>
              <td><button className="icon-btn" disabled={usage(t.id) > 0} title="Löschen" onClick={() => st().deleteCableType(t.id)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function LengthsInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.map((v) => String(v).replace('.', ',')).join('; '));
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = text.split(/[;\s]+/).map((s) => parseFloat(s.replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
        onChange(v);
        setText(v.map((x) => String(x).replace('.', ',')).join('; '));
      }}
    />
  );
}

// ----------------------------------------------------------------------------- settings

export function SettingsDialog() {
  const project = useStore((s) => s.project);
  const s = project.settings;
  const st = useStore.getState;
  const up = st().updateSettings;
  return (
    <Modal title="Projekt-Einstellungen" footer={<><span className="spacer" /><button className="btn primary" onClick={() => st().openModal(null)}>Fertig</button></>}>
      <Field label="Projektname"><input value={project.name} onChange={(e) => st().mutate((p) => { p.name = e.target.value; })} /></Field>
      <Field label="Ersteller / Firma"><input value={project.author ?? ''} onChange={(e) => st().mutate((p) => { p.author = e.target.value; })} /></Field>
      <h4>Kabellängen (automatisch)</h4>
      <div className="row gap8">
        <Field label="Zuschlag (%)"><NumberInput value={s.slackPercent} min={0} max={200} onChange={(v) => up({ slackPercent: v })} /></Field>
        <Field label="Serviceschlaufe (mm)"><NumberInput value={s.serviceLoop} min={0} step={10} onChange={(v) => up({ serviceLoop: v })} /></Field>
        <Field label="Biegeweg je Ende (mm)"><NumberInput value={s.exitLength} min={0} step={5} onChange={(v) => up({ exitLength: v })} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={s.roundToStock} onChange={(e) => up({ roundToStock: e.target.checked })} /> Auf Lagerlängen des Kabeltyps aufrunden (sonst auf 0,1 m)</label>
      <div className="hint">Länge = (Weg orthogonal entlang Rack, Front↔Rück über die Seite + Biegewege) × (1 + Zuschlag) + Serviceschlaufe.</div>
      <h4>Darstellung</h4>
      <div className="row gap8">
        <Field label="Kabelverlauf">
          <select value={s.curveStyle} onChange={(e) => up({ curveStyle: e.target.value as typeof s.curveStyle })}>
            <option value="orthogonal">orthogonal, 90° (Übersicht)</option><option value="curved">hängend (realistisch)</option><option value="straight">direkt (Linie)</option>
          </select>
        </Field>
        <Field label="Kabel-Beschriftung">
          <select value={s.cableLabel} onChange={(e) => up({ cableLabel: e.target.value as typeof s.cableLabel })}>
            <option value="length">Länge</option><option value="number">Kabelnummer</option><option value="both">Nummer + Länge</option><option value="none">keine</option>
          </select>
        </Field>
      </div>
      <label className="check"><input type="checkbox" checked={s.showPortLabels} onChange={(e) => up({ showPortLabels: e.target.checked })} /> Anschlussnamen anzeigen</label>
      <label className="check"><input type="checkbox" checked={s.showCableLabels} onChange={(e) => up({ showCableLabels: e.target.checked })} /> Kabel-Beschriftung anzeigen</label>
      <div className="row gap8" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => { if (confirm('Kabelnummern projektweit neu vergeben (W001 …)?')) st().renumberCables(); }}>Kabel neu nummerieren</button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------- export

export function ExportDialog() {
  const mode = useStore((s) => s.mode);
  return mode === 'cases' ? <CaseExportDialog /> : mode === 'inlays' ? <InlayExportDialog /> : mode === 'rackbuild' ? <RackBuildExportDialog /> : <RackExportDialog />;
}

function CaseExportDialog() {
  const project = useStore((s) => s.project);
  const activeId = useStore((s) => s.activeCaseId);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [busy, setBusy] = useState(false);
  const cases = caseList(project);
  const cur = cases.find((c) => c.id === activeId) ?? cases[0];
  const list = scope === 'all' ? cases : cur ? [cur] : [];
  const st = useStore.getState;
  return (
    <Modal title="Export Cases" footer={<><span className="spacer" /><button className="btn" onClick={() => st().openModal(null)}>Schließen</button></>}>
      {!cases.length ? <div className="muted">Noch keine Cases angelegt.</div> : (
        <>
          <Field label="Umfang">
            <select value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')}>
              <option value="current">Aktuelles Case ({cur?.name})</option><option value="all">Alle Cases ({cases.length})</option>
            </select>
          </Field>
          <div className="export-grid">
            <div className="export-card">
              <h4>PDF</h4>
              <p className="muted small">Zeichnung (Innenansicht mit Ausschnitten, Vorder- und Seitenansicht) und Stückliste mit Zuschnitt, Beschlägen, Schaumstoff und Gewicht.</p>
              <button className="btn primary" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  const { exportCasesPdf } = await import('../export/caseExport');
                  downloadBlob(await exportCasesPdf(project, list), `${safeFileName(scope === 'all' ? project.name + '_Cases' : list[0].name)}.pdf`);
                } catch (e) { st().showToast((e as Error).message, 'error'); } finally { setBusy(false); }
              }}>{busy ? 'Erzeuge …' : 'PDF herunterladen'}</button>
            </div>
            <div className="export-card">
              <h4>Schaumstoff-Zuschnitt (DXF)</h4>
              <p className="muted small">Kontur der Einlage und alle Ausschnitte im Maßstab 1:1 für den CNC- oder Wasserstrahl-Zuschnitt; Namen und Frästiefen als Beschriftung. Eine Datei je Case und Ebene.</p>
              <button className="btn" onClick={async () => {
                const { caseFoamDxf } = await import('../export/caseExport');
                list.forEach((c, i) => {
                  const layers: ('body' | 'lid')[] = c.items.some((it) => it.layer === 'lid') ? ['body', 'lid'] : ['body'];
                  layers.forEach((l, j) => setTimeout(() => downloadBlob(new Blob([caseFoamDxf(c, l)], { type: 'application/dxf' }), `${safeFileName(c.name)}_Schaum${l === 'lid' ? '_Deckel' : ''}.dxf`), (i * 2 + j) * 300));
                });
              }}>DXF herunterladen</button>
            </div>
            <div className="export-card">
              <h4>Projektdatei</h4>
              <p className="muted small">Komplettes Projekt mit Racks und Cases (.rackplan.json).</p>
              <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${safeFileName(project.name)}.rackplan.json`)}>Projekt speichern</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function RackBuildExportDialog() {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [busy, setBusy] = useState(false);
  const list = scope === 'all' ? project.racks : [rack];
  const st = useStore.getState;
  return (
    <Modal title="Export Rackgehäuse" footer={<><span className="spacer" /><button className="btn" onClick={() => st().openModal(null)}>Schließen</button></>}>
      <Field label="Umfang">
        <select value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')}>
          <option value="current">Aktuelles Rack ({rack.name})</option><option value="all">Alle Racks ({project.racks.length})</option>
        </select>
      </Field>
      <div className="export-grid">
        <div className="export-card">
          <h4>Gehäusezeichnung und Stückliste (PDF)</h4>
          <p className="muted small">Vorderansicht mit Schienen und Geräten, Seitenansicht geschlossen, Schnitt mit Einbautiefe, dazu Plattenzuschnitt, Profile, Beschläge, Schienen und Gewicht. Für das Gespräch mit dem Casebauer.</p>
          <button className="btn primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const { exportRackBuildPdf } = await import('../export/caseExport');
              downloadBlob(await exportRackBuildPdf(project, list), `${safeFileName(scope === 'all' ? project.name + '_Rackgehaeuse' : rack.name + '_Gehaeuse')}.pdf`);
            } catch (e) { st().showToast((e as Error).message, 'error'); } finally { setBusy(false); }
          }}>{busy ? 'Erzeuge …' : 'PDF herunterladen'}</button>
        </div>
        <div className="export-card">
          <h4>Projektdatei</h4>
          <p className="muted small">Komplettes Projekt mit Racks, Gehäusen, Cases und Einlagen (.rackplan.json).</p>
          <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${safeFileName(project.name)}.rackplan.json`)}>Projekt speichern</button>
        </div>
        <div className="export-card">
          <h4>Bestückung und Verkabelung</h4>
          <p className="muted small">Zeichnungen, Kabelliste und interaktive Ansicht gibt es im Export unter „Racks bestücken“.</p>
          <button className="btn" onClick={() => { st().setMode('racks'); st().openModal({ kind: 'export' }); }}>Zum Export der Bestückung</button>
        </div>
      </div>
    </Modal>
  );
}

function InlayExportDialog() {
  const project = useStore((s) => s.project);
  const activeId = useStore((s) => s.activeInlayId);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [busy, setBusy] = useState(false);
  const inlays = inlayList(project);
  const cur = inlays.find((c) => c.id === activeId) ?? inlays[0];
  const list = scope === 'all' ? inlays : cur ? [cur] : [];
  const st = useStore.getState;
  return (
    <Modal title="Export Einlagen" footer={<><span className="spacer" /><button className="btn" onClick={() => st().openModal(null)}>Schließen</button></>}>
      {!inlays.length ? <div className="muted">Noch keine Einlagen angelegt.</div> : (
        <>
          <Field label="Umfang">
            <select value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')}>
              <option value="current">Aktuelle Einlage ({cur?.name})</option><option value="all">Alle Einlagen ({inlays.length})</option>
            </select>
          </Field>
          <div className="export-grid">
            <div className="export-card">
              <h4>Zuschnitt für den Schaumstoff-Zuschneider (DXF)</h4>
              <p className="muted small">Maßstab 1:1. Layer KONTUR = Außenkontur, AUSSCHNITT = Ausschnitte mit Eckenradien und Griffmulden, GRAVUR = Gravuren, INFO = Namen und Tiefen (wird nicht geschnitten). Eine Datei je Einlage und Ebene.</p>
              <button className="btn primary" onClick={async () => {
                const { caseFoamDxf } = await import('../export/caseExport');
                list.forEach((c, i) => {
                  const layers: ('body' | 'lid')[] = c.items.some((it) => it.layer === 'lid') ? ['body', 'lid'] : ['body'];
                  layers.forEach((l, j) => setTimeout(() => downloadBlob(new Blob([caseFoamDxf(c, l)], { type: 'application/dxf' }), `${safeFileName(c.name)}_Zuschnitt${l === 'lid' ? '_Deckel' : ''}.dxf`), (i * 2 + j) * 300));
                });
              }}>DXF herunterladen</button>
            </div>
            <div className="export-card">
              <h4>Zuschnittplan (PDF)</h4>
              <p className="muted small">Draufsicht mit Maßen und Schnitt je Ebene, dazu die Zuschnittliste mit Positionen, Tiefen, Griffmulden und dem Plattenaufbau.</p>
              <button className="btn" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  const { exportInlaysPdf } = await import('../export/caseExport');
                  downloadBlob(await exportInlaysPdf(project, list), `${safeFileName(scope === 'all' ? project.name + '_Einlagen' : list[0].name)}_Zuschnittplan.pdf`);
                } catch (e) { st().showToast((e as Error).message, 'error'); } finally { setBusy(false); }
              }}>{busy ? 'Erzeuge …' : 'PDF herunterladen'}</button>
            </div>
            <div className="export-card">
              <h4>Projektdatei</h4>
              <p className="muted small">Komplettes Projekt mit Racks, Cases und Einlagen (.rackplan.json).</p>
              <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${safeFileName(project.name)}.rackplan.json`)}>Projekt speichern</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function RackExportDialog() {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const readOnly = useStore((s) => s.readOnly);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [views, setViews] = useState<'both' | Face>('both');
  const [format, setFormat] = useState<'a4' | 'a3'>('a3');
  const [cableList, setCableList] = useState(true);
  const [bom, setBom] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const st = useStore.getState;
  const racks = scope === 'all' ? project.racks : [rack];
  const viewList: Face[] = views === 'both' ? ['front', 'rear'] : [views];
  const base = safeFileName(project.name);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { st().showToast((e as Error).message, 'error'); console.error(e); } finally { setBusy(null); }
  };

  return (
    <Modal title="Export" footer={<><span className="spacer" /><button className="btn" onClick={() => st().openModal(null)}>Schließen</button></>}>
      <div className="row gap8 wrap">
        <Field label="Umfang">
          <select value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')}>
            <option value="current">Aktuelles Rack ({rack.name})</option>
            <option value="all">Alle Racks ({project.racks.length})</option>
          </select>
        </Field>
        <Field label="Ansichten">
          <select value={views} onChange={(e) => setViews(e.target.value as 'both' | Face)}>
            <option value="both">Vorder- + Rückansicht</option><option value="front">nur vorne</option><option value="rear">nur hinten</option>
          </select>
        </Field>
      </div>

      <div className="export-grid">
        <div className="export-card">
          <h4>PDF</h4>
          <p className="muted small">Zeichnung, Kabelliste mit Packliste und Geräteliste zum Drucken oder Versenden.</p>
          <div className="row gap8 wrap">
            <select value={format} onChange={(e) => setFormat(e.target.value as 'a4' | 'a3')}><option value="a3">A3 quer</option><option value="a4">A4 quer</option></select>
            <label className="check"><input type="checkbox" checked={cableList} onChange={(e) => setCableList(e.target.checked)} /> Kabelliste</label>
            <label className="check"><input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} /> Geräteliste</label>
          </div>
          <button className="btn primary" disabled={!!busy} onClick={() => run('pdf', async () => {
            const { exportPdf } = await import('../export/pdf');
            downloadBlob(await exportPdf(project, { racks, views: viewList, format, includeCableList: cableList, includeBom: bom }), `${base}.pdf`);
          })}>{busy === 'pdf' ? 'Erzeuge …' : 'PDF herunterladen'}</button>
        </div>

        <div className="export-card">
          <h4>Bild</h4>
          <p className="muted small">PNG in hoher Auflösung oder SVG (verlustfrei skalierbar, für Grafik-Programme).</p>
          <div className="row gap8">
            <button className="btn" disabled={!!busy} onClick={() => run('png', async () => {
              for (const r of racks) {
                const size = rackSvgSize(r, viewList.length, false, project);
                const px = 4; // px per mm  ≈ 100 dpi
                downloadBlob(await svgToPngBlob(rackSvgString(project, r, viewList, px), size.w * px, size.h * px), `${base}_${safeFileName(r.name)}.png`);
              }
            })}>PNG</button>
            <button className="btn" disabled={!!busy} onClick={() => run('svg', async () => {
              for (const r of racks) downloadBlob(new Blob([rackSvgString(project, r, viewList, 1)], { type: 'image/svg+xml' }), `${base}_${safeFileName(r.name)}.svg`);
            })}>SVG</button>
          </div>
        </div>

        <div className="export-card">
          <h4>Interaktiv (HTML)</h4>
          <p className="muted small">
            Eine einzelne HTML-Datei, die in jedem Browser öffnet – ohne Installation, auch offline. Mit Vorder-/Rückansicht, 3D, Kabel-Hervorhebung,
            Kabelliste und Zoom. Lässt sich per Mail oder Cloud verschicken.
          </p>
          <button className="btn primary" disabled={!!busy} onClick={() => run('html', async () => {
            const html = buildInteractiveHtml(project);
            downloadBlob(new Blob([html], { type: 'text/html' }), `${base}_interaktiv.html`);
          })}>HTML herunterladen</button>
        </div>

        {!readOnly ? <RfExportCard scope={scope} /> : null}

        {!readOnly ? (
          <div className="export-card">
            <h4>Projektdatei</h4>
            <p className="muted small">Komplettes Projekt inkl. eigener Geräte, Blenden und Kabeltypen (.rackplan.json) zum Weiterbearbeiten.</p>
            <button className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${base}.rackplan.json`)}>Projekt speichern</button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
