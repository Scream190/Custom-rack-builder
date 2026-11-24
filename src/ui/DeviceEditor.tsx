import { useMemo, useRef, useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { DeviceTemplate, Face, Port } from '../model/types';
import { faceWidth, panelHeight } from '../model/geometry';
import { CONNECTORS, connectorDef, SIGNAL_LABELS } from '../model/connectors';
import { DeviceFace } from '../render/DeviceFace';
import { deepClone, uid } from '../model/util';
import { Field, Modal, NumberInput } from './Modal';
import { RF_PRODUCTS, rfProductsFor } from '../integration/rf';

function blankTemplate(): DeviceTemplate {
  return {
    id: uid('custom-'),
    name: 'Neues Gerät',
    manufacturer: '',
    category: 'UHF Empfänger',
    heightU: 1,
    rackStandard: 19,
    slots: 1,
    depth: 250,
    color: '#2a2d33',
    textColor: '#e5e7eb',
    ports: [],
    custom: true,
  };
}

export function DeviceEditor({ templateId }: { templateId?: string }) {
  const project = useStore((s) => s.project);
  const templates = useMemo(() => allTemplates(project), [project]);
  const source = templateId ? templates.find((t) => t.id === templateId) : undefined;
  const [draft, setDraft] = useState<DeviceTemplate>(() => (source ? deepClone(source) : blankTemplate()));
  const [side, setSide] = useState<Face>('rear');
  const [selPort, setSelPort] = useState<string | null>(null);
  const [connector, setConnector] = useState('XLR3M');
  const [snap, setSnap] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const usedCount = project.racks.reduce((n, r) => n + r.devices.filter((d) => d.templateId === draft.id).length, 0);
  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const w = faceWidth(draft.rackStandard) / draft.slots;
  const h = panelHeight(draft.heightU);
  const set = (patch: Partial<DeviceTemplate>) => setDraft((d) => ({ ...d, ...patch }));
  const setPort = (id: string, patch: Partial<Port>) => setDraft((d) => ({ ...d, ports: d.ports.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const sel = draft.ports.find((p) => p.id === selPort);

  const toLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const q = (v: number) => Math.round(v / snap) * snap;
    return { x: Math.max(0, Math.min(w, q(r.x))), y: Math.max(0, Math.min(h, q(r.y))) };
  };

  const onDown = (e: React.PointerEvent) => {
    const portEl = (e.target as Element).closest('[data-port]');
    if (portEl) {
      const id = portEl.getAttribute('data-port')!;
      setSelPort(id);
      dragRef.current = { id };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    const p = toLocal(e);
    const def = connectorDef(connector);
    const count = draft.ports.filter((x) => x.connector === connector).length + 1;
    const port: Port = { id: uid('p'), name: `${def.label.split(' ')[0]} ${count}`, connector, side, x: p.x, y: p.y, dir: 'io' };
    setDraft((d) => ({ ...d, ports: [...d.ports, port] }));
    setSelPort(port.id);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = toLocal(e);
    setPort(dragRef.current.id, { x: p.x, y: p.y });
  };

  const save = (asNew: boolean) => {
    const t = { ...deepClone(draft), custom: true };
    if (asNew) { t.id = uid('custom-'); if (source && t.name === source.name) t.name += ' (Kopie)'; }
    useStore.getState().upsertTemplate(t);
    useStore.getState().showToast(`„${t.name}“ gespeichert`);
    useStore.getState().openModal(null);
  };

  const scale = Math.min(1.9, 900 / w);
  const portsHere = draft.ports.filter((p) => p.side === side);

  return (
    <Modal
      wide
      title={source ? `Gerät bearbeiten: ${source.manufacturer} ${source.name}` : 'Neues Gerät'}
      footer={
        <>
          {source?.custom && usedCount === 0 ? (
            <button className="btn danger" onClick={() => { useStore.getState().deleteTemplate(draft.id); useStore.getState().openModal(null); }}>Löschen</button>
          ) : null}
          <span className="spacer" />
          {source ? <button className="btn" onClick={() => save(true)}>Als neue Vorlage speichern</button> : null}
          <button className="btn primary" onClick={() => save(false)}>
            {source ? (usedCount ? `Speichern (${usedCount} Geräte im Projekt aktualisieren)` : 'Speichern') : 'Gerät anlegen'}
          </button>
        </>
      }
    >
      <div className="editor-grid">
        <div className="form-col">
          <Field label="Name"><input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Hersteller"><input value={draft.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
          <Field label="Kategorie">
            <input list="cat-list" value={draft.category} onChange={(e) => set({ category: e.target.value })} />
            <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <div className="row gap8">
            <Field label="Höhe (HE)"><NumberInput value={draft.heightU} min={1} max={20} onChange={(v) => set({ heightU: Math.max(1, Math.round(v)) })} /></Field>
            <Field label="Breite">
              <select value={draft.slots} onChange={(e) => set({ slots: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>voll</option><option value={2}>½</option><option value={3}>⅓</option>
              </select>
            </Field>
            <Field label="Standard">
              <select value={draft.rackStandard} onChange={(e) => set({ rackStandard: Number(e.target.value) as 19 | 10 })}>
                <option value={19}>19"</option><option value={10}>10"</option>
              </select>
            </Field>
          </div>
          <div className="row gap8">
            <Field label="Tiefe (mm)"><NumberInput value={draft.depth} min={1} onChange={(v) => set({ depth: v })} /></Field>
            <Field label="Gewicht (kg)"><NumberInput value={draft.weight ?? 0} step={0.1} min={0} onChange={(v) => set({ weight: v })} /></Field>
            <Field label="Leistung (W)"><NumberInput value={draft.power ?? 0} min={0} onChange={(v) => set({ power: v })} /></Field>
          </div>
          <div className="row gap8">
            <Field label="Gehäusefarbe"><input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })} /></Field>
            <Field label="Schriftfarbe"><input type="color" value={draft.textColor} onChange={(e) => set({ textColor: e.target.value })} /></Field>
          </div>
          <Field label="Eigenschaftsfelder" hint="Kommagetrennt, z. B. Frequenz, Kanal / Name, IP-Adresse">
            <input value={(draft.fields ?? []).join(', ')} onChange={(e) => set({ fields: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Produkt im RF Frequency Manager" hint="Für den Austausch der Funkgeräte (Export .rfreq / Import .rfse)">
            <select value={draft.rfProduct ?? ''} onChange={(e) => set({ rfProduct: e.target.value || undefined })}>
              <option value="">{rfProductsFor({ ...draft, rfProduct: undefined }).map((p) => p.model).join(' / ') || '– keins –'}{rfProductsFor({ ...draft, rfProduct: undefined }).length ? ' (automatisch)' : ''}</option>
              {Array.from(new Set(RF_PRODUCTS.map((p) => p.man))).map((m) => (
                <optgroup key={m} label={m}>{RF_PRODUCTS.filter((p) => p.man === m).map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <Field label="Notizen"><textarea rows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </div>

        <div className="canvas-col">
          <div className="row gap8 wrap align-end">
            <div className="seg">
              <button className={side === 'front' ? 'on' : ''} onClick={() => setSide('front')}>Front</button>
              <button className={side === 'rear' ? 'on' : ''} onClick={() => setSide('rear')}>Rückseite</button>
            </div>
            <Field label="Neuer Anschluss">
              <select value={connector} onChange={(e) => setConnector(e.target.value)}>
                {Object.entries(SIGNAL_LABELS).map(([sig, label]) => (
                  <optgroup key={sig} label={label}>
                    {Object.values(CONNECTORS).filter((c) => c.signal === sig).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Raster">
              <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
                <option value={0.5}>0,5 mm</option><option value={1}>1 mm</option><option value={2.5}>2,5 mm</option><option value={5}>5 mm</option>
              </select>
            </Field>
          </div>
          <div className="hint">Ein Klick auf eine freie Fläche setzt einen Anschluss, Ziehen verschiebt ihn. Die Rückseite ist von hinten gesehen dargestellt.</div>
          <div className="face-preview">
            <svg ref={svgRef} viewBox={`-6 -6 ${w + 12} ${h + 12}`} width={(w + 12) * scale} height={(h + 12) * scale} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { dragRef.current = null; }}>
              <DeviceFace tpl={draft} panel={side} width={w} portStates={selPort ? { [selPort]: 'highlight' } : undefined} />
            </svg>
          </div>
          {sel ? (
            <div className="port-edit">
              <Field label="Name"><input value={sel.name} onChange={(e) => setPort(sel.id, { name: e.target.value })} /></Field>
              <Field label="Stecker">
                <select value={sel.connector} onChange={(e) => setPort(sel.id, { connector: e.target.value })}>
                  {Object.values(CONNECTORS).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Seite">
                <select value={sel.side} onChange={(e) => setPort(sel.id, { side: e.target.value as Face, x: w - sel.x })}>
                  <option value="front">Front</option><option value="rear">Rückseite</option>
                </select>
              </Field>
              <Field label="Richtung">
                <select value={sel.dir ?? 'io'} onChange={(e) => setPort(sel.id, { dir: e.target.value as Port['dir'] })}>
                  <option value="in">Eingang</option><option value="out">Ausgang</option><option value="io">bidirektional</option>
                </select>
              </Field>
              <Field label="X (mm)"><NumberInput value={sel.x} step={0.5} onChange={(v) => setPort(sel.id, { x: v })} style={{ width: 70 }} /></Field>
              <Field label="Y (mm)"><NumberInput value={sel.y} step={0.5} onChange={(v) => setPort(sel.id, { y: v })} style={{ width: 70 }} /></Field>
              <button className="btn sm" onClick={() => {
                const copy = { ...sel, id: uid('p'), x: Math.min(w - 5, sel.x + connectorDef(sel.connector).w + 4), name: sel.name.replace(/(\d+)$/, (m) => String(Number(m) + 1)) };
                setDraft((d) => ({ ...d, ports: [...d.ports, copy] }));
                setSelPort(copy.id);
              }}>Duplizieren</button>
              <button className="btn sm danger" onClick={() => { setDraft((d) => ({ ...d, ports: d.ports.filter((p) => p.id !== sel.id) })); setSelPort(null); }}>Löschen</button>
            </div>
          ) : null}
          <div className="port-table">
            <table>
              <thead><tr><th>Anschluss</th><th>Stecker</th><th>X</th><th>Y</th></tr></thead>
              <tbody>
                {portsHere.map((p) => (
                  <tr key={p.id} className={p.id === selPort ? 'sel' : ''} onClick={() => setSelPort(p.id)}>
                    <td>{p.name}</td><td>{connectorDef(p.connector).label}</td><td>{p.x}</td><td>{p.y}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!portsHere.length ? <div className="hint pad">Keine Anschlüsse auf dieser Seite.</div> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
