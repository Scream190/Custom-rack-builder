import { useMemo, useState } from 'react';
import { allTemplates, useActiveRack, useStore } from '../model/store';
import type { BoxDesign, BoxRow } from '../model/types';
import { CONNECTORS, connectorDef, SIGNAL_LABELS } from '../model/connectors';
import { buildBoxTemplate } from '../model/boxes';
import { BoxFace } from '../render/BoxFace';
import { uid } from '../model/util';
import { Field, Modal, NumberInput } from './Modal';

const CONNECTOR_GROUPS = Object.values(CONNECTORS).reduce<Record<string, { key: string; label: string }[]>>((acc, c) => {
  const g = SIGNAL_LABELS[c.signal];
  (acc[g] ??= []).push({ key: c.key, label: c.label });
  return acc;
}, {});

function ConnectorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 150 }}>
      {Object.entries(CONNECTOR_GROUPS).map(([g, list]) => (
        <optgroup key={g} label={g}>{list.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</optgroup>
      ))}
    </select>
  );
}

const EMPTY: BoxDesign = {
  multi: [{ connector: 'HARTING16', name: 'Multi', count: 1 }],
  singles: [{ connector: 'XLR3F', name: 'Ch', count: 4, via: 0 }],
};

/** Editor for split boxes (multi → singles) and combi boxes (singles → multi). */
export function BoxEditor({ templateId }: { templateId?: string }) {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const source = useMemo(() => (templateId ? allTemplates(project).find((t) => t.id === templateId) : undefined), [project, templateId]);
  const editable = !!source?.custom;
  const [name, setName] = useState(source ? (editable ? source.name : `${source.name} (Kopie)`) : 'Neue Dose');
  const [kind, setKind] = useState<'split' | 'combi'>(source?.box?.kind ?? 'split');
  const [color, setColor] = useState(source?.color ?? '#3a3d42');
  const [design, setDesign] = useState<BoxDesign>(() => structuredClone(source?.box?.design ?? EMPTY));
  const usedCount = project.racks.reduce((n, r) => n + (r.boxes ?? []).filter((b) => b.templateId === source?.id).length, 0);

  const preview = useMemo(() => buildBoxTemplate({ id: 'preview', name, kind, color }, design), [name, kind, color, design]);
  const setMulti = (i: number, patch: Partial<BoxRow>) => setDesign((d) => ({ ...d, multi: d.multi.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setSingle = (i: number, patch: Partial<BoxRow & { via: number }>) => setDesign((d) => ({ ...d, singles: d.singles.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const total = design.singles.reduce((n, r) => n + r.count, 0);

  const save = (place: boolean) => {
    const id = editable && source ? source.id : uid('box-');
    const t = buildBoxTemplate({ id, name: name.trim() || 'Dose', kind, color, custom: true }, design);
    const st = useStore.getState();
    st.upsertTemplate(t);
    if (place) st.addBox(rack.id, t);
    st.openModal(null);
    st.showToast(place ? `${t.name} unter dem Rack eingefügt` : `${t.name} gespeichert (Bibliothek, Kategorie Dosen)`);
  };

  const multiLabel = kind === 'split' ? 'Sammelanschluss (Eingang)' : 'Sammelanschluss (Ausgang)';
  return (
    <Modal
      title={source ? (editable ? `Dose bearbeiten: ${source.name}` : `Dose als eigene Vorlage: ${source.name}`) : 'Neue Split- oder Kombidose'}
      wide
      footer={
        <>
          <span className="muted small">{design.multi.reduce((n, r) => n + r.count, 0)} Sammel- und {total} Einzelanschlüsse</span>
          <span className="spacer" />
          <button className="btn" onClick={() => useStore.getState().openModal(null)}>Abbrechen</button>
          <button className="btn" onClick={() => save(false)}>{editable && usedCount ? `Speichern (${usedCount}× im Projekt)` : 'Speichern'}</button>
          {!editable || !usedCount ? <button className="btn primary" onClick={() => save(true)}>Speichern und unter dem Rack einfügen</button> : null}
        </>
      }
    >
      <div className="editor-grid">
        <div className="form-col">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="row gap8">
            <Field label="Art">
              <select value={kind} onChange={(e) => setKind(e.target.value as 'split' | 'combi')}>
                <option value="split">Splitdose (Sammel → Einzel)</option>
                <option value="combi">Kombidose (Einzel → Sammel)</option>
              </select>
            </Field>
            <Field label="Farbe"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
          </div>
          <div className="hint" style={{ padding: 0 }}>
            {kind === 'split'
              ? 'Ein Multicore- oder Leistungsanschluss wird auf einzelne Buchsen aufgeteilt, z. B. CEE 32 A auf Schuko oder Multipin auf XLR.'
              : 'Einzelne Leitungen werden in einem Sammelstecker zusammengefasst, z. B. Strom, DMX und Netzwerk in einem Hybridkabel.'}
          </div>

          <h4>{multiLabel}</h4>
          {design.multi.map((r, i) => (
            <div key={i} className="row gap4 wrap">
              <ConnectorSelect value={r.connector} onChange={(v) => setMulti(i, { connector: v })} />
              <input value={r.name} onChange={(e) => setMulti(i, { name: e.target.value })} style={{ width: 90 }} />
              <NumberInput value={r.count} min={1} max={4} onChange={(v) => setMulti(i, { count: Math.max(1, Math.min(4, v || 1)) })} style={{ width: 52 }} />
              {design.multi.length > 1 ? (
                <button className="icon-btn" title="Entfernen" onClick={() => setDesign((d) => ({
                  multi: d.multi.filter((_, j) => j !== i),
                  singles: d.singles.map((s) => ({ ...s, via: s.via === i ? 0 : s.via > i ? s.via - 1 : s.via })),
                }))}>✕</button>
              ) : null}
            </div>
          ))}
          <button className="btn sm" onClick={() => setDesign((d) => ({ ...d, multi: [...d.multi, { connector: 'HARTING16', name: `Multi ${d.multi.length + 1}`, count: 1 }] }))}>+ Sammelanschluss</button>

          <h4>Einzelanschlüsse</h4>
          {design.singles.map((r, i) => (
            <div key={i} className="row gap4 wrap">
              <ConnectorSelect value={r.connector} onChange={(v) => setSingle(i, { connector: v })} />
              <input value={r.name} onChange={(e) => setSingle(i, { name: e.target.value })} style={{ width: 80 }} title="Name, wird bei mehreren durchnummeriert" />
              <NumberInput value={r.count} min={1} max={48} onChange={(v) => setSingle(i, { count: Math.max(1, Math.min(48, v || 1)) })} style={{ width: 52 }} />
              {design.multi.length > 1 ? (
                <select value={r.via} onChange={(e) => setSingle(i, { via: Number(e.target.value) })} title="Über welchen Sammelanschluss">
                  {design.multi.map((m, j) => <option key={j} value={j}>über {m.name}</option>)}
                </select>
              ) : null}
              <button className="icon-btn" title="Entfernen" onClick={() => setDesign((d) => ({ ...d, singles: d.singles.filter((_, j) => j !== i) }))}>✕</button>
            </div>
          ))}
          <button className="btn sm" onClick={() => setDesign((d) => ({ ...d, singles: [...d.singles, { connector: 'SCHUKO', name: 'Out', count: 1, via: 0 }] }))}>+ Einzelanschlüsse</button>
        </div>

        <div className="canvas-col">
          <div className="face-preview" style={{ color: '#e5e7eb' }}>
            <svg viewBox={`-6 -10 ${preview.box!.w + 12} ${preview.box!.h + 16}`} width={Math.min(760, (preview.box!.w + 12) * 3)} style={{ display: 'block', cursor: 'default' }}>
              <BoxFace tpl={preview} plain />
            </svg>
          </div>
          <h4>Innere Verdrahtung</h4>
          <div className="stats">
            {preview.box!.links.map((l) => {
              const m = preview.ports.find((p) => p.id === l.multi)!;
              return (
                <div key={l.multi}>
                  <span>{m.name} ({connectorDef(m.connector).label})</span>
                  <b>{l.singles.map((sid) => preview.ports.find((p) => p.id === sid)!.name).join(', ') || '–'}</b>
                </div>
              );
            })}
          </div>
          <div className="hint" style={{ padding: 0 }}>
            Die Dose erscheint unter dem Rack in Vorder- und Rückansicht. Kabel zu ihr bekommen die eingestellte Entfernung als Länge
            dazu; in der 3D-Ansicht werden sie nicht gezeichnet.
          </div>
        </div>
      </div>
    </Modal>
  );
}
