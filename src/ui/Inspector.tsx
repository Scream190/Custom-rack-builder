import { useState } from 'react';
import { allRackTypes, useActiveRack, useStore } from '../model/store';
import { cableLength, formatLength, resolveEnd, usedUnits } from '../model/geometry';
import { connectorDef, SIGNAL_LABELS } from '../model/connectors';
import { RACK_KIND_LABELS } from '../library/rackTypes';
import { cableNumberText } from '../render/cablePaths';
import type { DrawerItem, PlacedDevice, Project, Rack, RfDeviceData } from '../model/types';
import { bandLabel, channelCount, channelLabel, rfBandsFor, rfProductOf, rfProductsFor } from '../integration/rf';

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const rack = useActiveRack();
  const project = useStore((s) => s.project);
  return (
    <aside className="panel inspector">
      {selection?.kind === 'device' ? <DeviceInspector key={selection.id} rack={rack} id={selection.id} project={project} />
        : selection?.kind === 'cable' ? <CableInspector key={selection.id} rack={rack} id={selection.id} project={project} />
        : <RackInspector rack={rack} project={project} />}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function rackStats(project: Project, rack: Rack) {
  let weight = rack.type.weight ?? 0;
  let power = 0;
  for (const d of rack.devices) {
    const t = project.templates[d.templateId];
    weight += t?.weight ?? 0;
    power += t?.power ?? 0;
  }
  const lengths: Record<string, { count: number; total: number }> = {};
  for (const c of rack.cables) {
    const l = cableLength(project, rack, c)?.length ?? 0;
    const k = c.typeId;
    lengths[k] = lengths[k] || { count: 0, total: 0 };
    lengths[k].count++;
    lengths[k].total += l;
  }
  return { weight, power, used: usedUnits(project, rack), lengths };
}

function RackInspector({ rack, project }: { rack: Rack; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const st = useStore.getState;
  const types = allRackTypes(project);
  const stats = rackStats(project, rack);
  return (
    <div className="insp">
      <h3>Rack</h3>
      <Field label="Name">
        <input disabled={ro} value={rack.name} onChange={(e) => st().updateRack(rack.id, { name: e.target.value })} />
      </Field>
      <Field label="Rack-Typ">
        <select
          disabled={ro}
          value={types.some((t) => t.id === rack.type.id) ? rack.type.id : ''}
          onChange={(e) => {
            const t = types.find((x) => x.id === e.target.value);
            if (!t) return;
            const tooTall = rack.devices.some((d) => d.u + (project.templates[d.templateId]?.heightU ?? 1) - 1 > t.heightU);
            if (tooTall && !confirm('Einige Geräte liegen außerhalb des neuen Racks. Trotzdem wechseln?')) return;
            st().updateRack(rack.id, { type: t });
          }}
        >
          {!types.some((t) => t.id === rack.type.id) ? <option value="">{rack.type.name}</option> : null}
          {Object.entries(RACK_KIND_LABELS).map(([kind, label]) => (
            <optgroup key={kind} label={label}>
              {types.filter((t) => t.kind === kind).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      {!ro ? <button className="btn sm" onClick={() => st().openModal({ kind: 'rackTypes' })}>Rack-Typen verwalten …</button> : null}
      <div className="stats">
        <div><span>Bauart</span><b>{RACK_KIND_LABELS[rack.type.kind]}</b></div>
        <div><span>Höhe</span><b>{rack.type.heightU} HE ({rack.type.rackStandard}")</b></div>
        <div><span>Belegt</span><b>{stats.used} / {rack.type.heightU} HE</b></div>
        <div><span>Einbautiefe</span><b>{rack.type.depth} mm</b></div>
        <div><span>Außenmaß</span><b>{rack.type.outer.w} × {rack.type.outer.h} × {rack.type.outer.d} mm</b></div>
        <div><span>Hintere Schienen</span><b>{rack.type.hasRearRails ? 'ja' : 'nein'}</b></div>
        <div><span>Geräte</span><b>{rack.devices.length}</b></div>
        <div><span>Kabel</span><b>{rack.cables.length}</b></div>
        {stats.weight > 0 ? <div><span>Gewicht (ca.)</span><b>{stats.weight.toFixed(1)} kg</b></div> : null}
        {stats.power > 0 ? <div><span>Leistung (ca.)</span><b>{stats.power} W</b></div> : null}
      </div>
      {Object.keys(stats.lengths).length ? (
        <>
          <h4>Kabel nach Typ</h4>
          <div className="stats">
            {Object.entries(stats.lengths).map(([id, v]) => {
              const ct = project.cableTypes.find((t) => t.id === id);
              return (
                <div key={id}>
                  <span><i className="dot" style={{ background: ct?.color }} />{ct?.name ?? id}</span>
                  <b>{v.count}×, {formatLength(v.total)}</b>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <Field label="Notizen">
        <textarea disabled={ro} rows={4} value={rack.notes ?? ''} onChange={(e) => st().updateRack(rack.id, { notes: e.target.value })} />
      </Field>
      {!ro ? (
        <div className="hint">
          Tipp: Port anklicken, dann Zielport anklicken = Kabel. <kbd>Esc</kbd> bricht ab, <kbd>Entf</kbd> löscht die Auswahl,
          <kbd>Strg</kbd>+<kbd>Z</kbd> rückgängig. Belegten Port mit <kbd>Alt</kbd> anklicken = weiteres Kabel.
        </div>
      ) : null}
    </div>
  );
}

function DeviceInspector({ rack, id, project }: { rack: Rack; id: string; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const st = useStore.getState;
  const d = rack.devices.find((x) => x.id === id);
  const [newField, setNewField] = useState('');
  if (!d) return null;
  const tpl = project.templates[d.templateId];
  // wireless devices keep frequency / channel / group in the RF section; the old free-text fields only when filled
  const legacy = rfProductsFor(tpl).length ? new Set(['Frequenz', 'Kanal / Name', 'Gruppe']) : new Set<string>();
  const fieldNames = Array.from(new Set([...(tpl.fields ?? []), ...Object.keys(d.fields ?? {})])).filter((f) => !legacy.has(f) || d.fields?.[f]);
  const cables = rack.cables.filter((c) => c.a.deviceId === id || c.b.deviceId === id);
  return (
    <div className="insp">
      <h3>Gerät</h3>
      <div className="muted">{tpl.manufacturer} {tpl.name}<br />{[`${tpl.heightU} HE`, tpl.slots > 1 ? `1/${tpl.slots} Breite` : '', `${tpl.depth} mm tief`].filter(Boolean).join(', ')}</div>
      <Field label="Bezeichnung">
        <input disabled={ro} placeholder={tpl.name} value={d.label ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { label: e.target.value || undefined })} />
      </Field>
      <div className="row gap8">
        <Field label="HE (unten)">
          <input disabled={ro} type="number" min={1} max={rack.type.heightU} value={d.u} onChange={(e) => st().moveDevice(rack.id, id, Number(e.target.value), d.mount, d.slot)} />
        </Field>
        <Field label="Montage">
          <select disabled={ro} value={d.mount} onChange={(e) => st().moveDevice(rack.id, id, d.u, e.target.value as 'front' | 'rear', d.slot)}>
            <option value="front">vorne</option>
            <option value="rear" disabled={!rack.type.hasRearRails}>hinten</option>
          </select>
        </Field>
        {tpl.slots > 1 ? (
          <Field label="Platz">
            <select disabled={ro} value={d.slot} onChange={(e) => st().moveDevice(rack.id, id, d.u, d.mount, Number(e.target.value))}>
              {Array.from({ length: tpl.slots }, (_, i) => <option key={i} value={i}>{tpl.slots === 2 ? (i === 0 ? 'links' : 'rechts') : `${i + 1}`}</option>)}
            </select>
          </Field>
        ) : null}
      </div>
      {fieldNames.map((f) => (
        <Field key={f} label={f}>
          <input disabled={ro} value={d.fields?.[f] ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), [f]: e.target.value } })} />
        </Field>
      ))}
      {!ro ? (
        <div className="row gap4">
          <input placeholder="Feld hinzufügen (z. B. IP-Adresse)" value={newField} onChange={(e) => setNewField(e.target.value)} />
          <button className="btn sm" disabled={!newField.trim()} onClick={() => { st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), [newField.trim()]: '' } }); setNewField(''); }}>+</button>
        </div>
      ) : null}
      {rfProductsFor(tpl).length ? <RfSection project={project} rack={rack} d={d} ro={ro} /> : null}
      {tpl.drawer ? <DrawerContents rack={rack} deviceId={id} items={d.contents ?? []} ro={ro} /> : null}
      <Field label="Notizen">
        <textarea disabled={ro} rows={3} value={d.notes ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { notes: e.target.value })} />
      </Field>
      {!ro ? (
        <div className="row gap4 wrap">
          <button className="btn sm" onClick={() => st().duplicateDevice(rack.id, id)}>Duplizieren</button>
          <button className="btn sm" onClick={() => st().openModal(tpl.panel ? { kind: 'panel', templateId: tpl.id } : { kind: 'device', templateId: tpl.id })}>Vorlage bearbeiten</button>
          <button className="btn sm danger" onClick={() => st().removeDevice(rack.id, id)}>Entfernen</button>
        </div>
      ) : null}
      <h4>Anschlüsse ({tpl.ports.length})</h4>
      <div className="port-list">
        {tpl.ports.map((p) => {
          const c = cables.find((x) => (x.a.deviceId === id && x.a.portId === p.id) || (x.b.deviceId === id && x.b.portId === p.id));
          const other = c ? resolveEnd(project, rack, c.a.deviceId === id && c.a.portId === p.id ? c.b : c.a) : null;
          return (
            <div key={p.id} className={'port-row' + (c ? ' linked' : '')} onClick={() => c && st().select({ kind: 'cable', id: c.id })}>
              <span className="muted small">{p.side === 'front' ? 'V' : 'H'}</span>
              <span>{p.name}</span>
              <span className="muted small">{connectorDef(p.connector).label}</span>
              <span className="small">{other ? `an ${other.device.label || other.tpl.name}, ${other.port.name}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CableInspector({ rack, id, project }: { rack: Rack; id: string; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const st = useStore.getState;
  const c = rack.cables.find((x) => x.id === id);
  if (!c) return null;
  const a = resolveEnd(project, rack, c.a);
  const b = resolveEnd(project, rack, c.b);
  const len = cableLength(project, rack, c);
  const ct = project.cableTypes.find((t) => t.id === c.typeId);
  const endText = (e: typeof a) => (e ? `${e.device.label || e.tpl.name}, ${e.port.name} (${connectorDef(e.port.connector).label}, ${e.port.side === 'front' ? 'Front' : 'Rückseite'})` : '?');
  return (
    <div className="insp">
      <h3>Kabel {cableNumberText(c)}</h3>
      <div className="cable-ends">
        <div><span className="muted small">A</span> {endText(a)}</div>
        <div><span className="muted small">B</span> {endText(b)}</div>
      </div>
      <Field label="Kabeltyp">
        <select disabled={ro} value={c.typeId} onChange={(e) => st().updateCable(rack.id, id, { typeId: e.target.value })}>
          {project.cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name} ({SIGNAL_LABELS[t.signal]})</option>)}
        </select>
      </Field>
      <div className="row gap8 align-end">
        <Field label="Farbe">
          <input disabled={ro} type="color" value={c.color ?? ct?.color ?? '#888888'} onChange={(e) => st().updateCable(rack.id, id, { color: e.target.value })} />
        </Field>
        {c.color && !ro ? <button className="btn sm" onClick={() => st().updateCable(rack.id, id, { color: undefined })}>Typfarbe</button> : null}
      </div>
      <Field label="Länge">
        <div className="row gap4">
          <select disabled={ro} value={c.lengthMode} onChange={(e) => st().updateCable(rack.id, id, { lengthMode: e.target.value as 'auto' | 'manual', manualLength: c.manualLength ?? len?.auto })}>
            <option value="auto">automatisch</option>
            <option value="manual">manuell</option>
          </select>
          {c.lengthMode === 'manual' ? (
            <input disabled={ro} type="number" step={0.05} min={0.05} value={c.manualLength ?? ''} onChange={(e) => st().updateCable(rack.id, id, { manualLength: Number(e.target.value) })} style={{ width: 80 }} />
          ) : null}
          <span>m</span>
        </div>
      </Field>
      {len ? (
        <div className="stats">
          <div><span>Verwendet</span><b>{formatLength(len.length)}</b></div>
          <div><span>Automatisch</span><b>{formatLength(len.auto)}</b></div>
          <div><span>Berechnet (exakt)</span><b>{formatLength(len.exact)}</b></div>
        </div>
      ) : null}
      <Field label="Beschriftung / Notiz">
        <input disabled={ro} value={c.label ?? ''} placeholder="z. B. Vox 1" onChange={(e) => st().updateCable(rack.id, id, { label: e.target.value || undefined })} />
      </Field>
      {!ro ? (
        <div className="row gap4">
          <button className="btn sm" onClick={() => st().updateCable(rack.id, id, { a: c.b, b: c.a })}>A ↔ B tauschen</button>
          <button className="btn sm danger" onClick={() => st().removeCable(rack.id, id)}>Kabel löschen</button>
        </div>
      ) : null}
    </div>
  );
}

/** "2x SM58", "2 × SM58", "SM58" → { qty, text } */
export function parseDrawerLine(line: string): DrawerItem | null {
  const t = line.trim();
  if (!t) return null;
  const m = /^(\d+)\s*(?:x|×|stk\.?|st\.?)?\s+(.+)$/i.exec(t);
  return m ? { qty: Number(m[1]), text: m[2].trim() } : { text: t };
}

function DrawerContents({ rack, deviceId, items, ro }: { rack: Rack; deviceId: string; items: DrawerItem[]; ro: boolean }) {
  const st = useStore.getState;
  const [bulk, setBulk] = useState<string | null>(null);
  const save = (next: DrawerItem[]) => st().updateDevice(rack.id, deviceId, { contents: next });
  return (
    <div className="drawer-box">
      <h4>Inhalt der Schublade</h4>
      {items.length === 0 && ro ? <div className="muted small">leer</div> : null}
      {items.map((it, i) => (
        <div key={i} className="row gap4 drawer-row">
          <input disabled={ro} type="number" min={1} value={it.qty ?? ''} placeholder="1" style={{ width: 54 }}
            onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, qty: e.target.value ? Number(e.target.value) : undefined } : x)))} />
          <input disabled={ro} value={it.text} placeholder="Artikel" style={{ flex: 1 }}
            onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          {!ro ? <button className="icon-btn" title="Nach oben" disabled={i === 0} onClick={() => { const n = items.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; save(n); }}>↑</button> : null}
          {!ro ? <button className="icon-btn" title="Entfernen" onClick={() => save(items.filter((_, j) => j !== i))}>✕</button> : null}
        </div>
      ))}
      {!ro ? (
        <div className="row gap4 wrap">
          <button className="btn sm" onClick={() => save([...items, { qty: 1, text: '' }])}>+ Eintrag</button>
          <button className="btn sm" onClick={() => setBulk(bulk === null ? items.map((x) => (x.qty && x.qty !== 1 ? `${x.qty}x ${x.text}` : x.text)).join('\n') : null)}>
            {bulk === null ? 'Als Liste bearbeiten' : 'Liste schließen'}
          </button>
        </div>
      ) : null}
      {bulk !== null && !ro ? (
        <>
          <textarea rows={6} value={bulk} placeholder={'Eine Zeile pro Artikel, z. B.\n4x SM58\nBatterien AA\n2x Gaffa'} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn sm primary" onClick={() => { save(bulk.split(/\r?\n/).map(parseDrawerLine).filter((x): x is DrawerItem => !!x)); setBulk(null); }}>Übernehmen</button>
        </>
      ) : null}
    </div>
  );
}

/** Wireless data of a device: exchanged with the RF Frequency Manager (product, band, zone, channels, frequencies). */
function RfSection({ project, rack, d, ro }: { project: Project; rack: Rack; d: PlacedDevice; ro: boolean }) {
  const st = useStore.getState;
  const tpl = project.templates[d.templateId];
  const products = rfProductsFor(tpl);
  const prod = rfProductOf(tpl, d);
  const bands = rfBandsFor(prod);
  const band = bands.find((b) => b.band === d.rf?.band);
  const n = channelCount(prod, d);
  const rf = d.rf ?? {};
  const save = (patch: Partial<RfDeviceData>) => st().updateDevice(rack.id, d.id, { rf: { ...rf, ...patch } });
  const setCh = (i: number, patch: { name?: string; f?: number }) => {
    const chans = Array.from({ length: n }, (_, k) => ({ ...(rf.channels?.[k] || {}) }));
    chans[i] = { ...chans[i], ...patch };
    save({ channels: chans });
  };
  const zones = Array.from(new Set(project.racks.flatMap((r) => r.devices.map((x) => x.rf?.zone).filter(Boolean) as string[])));
  const inBand = (f?: number) => !f || !band || band.ranges.some(([a, z]) => f >= a - 1e-6 && f <= z + 1e-6);
  return (
    <div className="drawer-box">
      <h4>Funk (RF Frequency Manager)</h4>
      {products.length > 1 ? (
        <Field label="Betriebsart / Produkt">
          <select disabled={ro} value={prod?.id} onChange={(e) => save({ product: e.target.value, band: undefined })}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}
          </select>
        </Field>
      ) : <div className="muted small">{prod ? `${prod.man} ${prod.model}, Serie ${prod.seriesName}` : ''}</div>}
      <div className="row gap8">
        <Field label="Band">
          <select disabled={ro} value={d.rf?.band ?? ''} onChange={(e) => save({ band: e.target.value || undefined })}>
            <option value="">– wählen –</option>
            {bands.map((b) => <option key={b.id} value={b.band}>{bandLabel(b)}</option>)}
            {d.rf?.band && !band ? <option value={d.rf.band}>{d.rf.band} (unbekannt)</option> : null}
          </select>
        </Field>
        <Field label="Zone">
          <input disabled={ro} list="rf-zones" value={rf.zone ?? ''} onChange={(e) => save({ zone: e.target.value || undefined })} placeholder="z. B. Bühne A" />
          <datalist id="rf-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
        </Field>
      </div>
      {!prod?.ch && !ro ? (
        <Field label={`Kanäle (1–${prod?.free || 200})`}>
          <input type="number" min={1} max={prod?.free || 200} value={n} onChange={(e) => {
            const m = Math.max(1, Math.min(prod?.free || 200, Number(e.target.value) || 1));
            save({ channels: Array.from({ length: m }, (_, k) => ({ ...(rf.channels?.[k] || {}) })) });
          }} />
        </Field>
      ) : null}
      <table className="rf-table">
        <thead><tr><th>#</th><th>Kanalname</th><th>MHz</th></tr></thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => {
            const c = rf.channels?.[i];
            return (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                <td><input disabled={ro} value={c?.name ?? ''} placeholder={channelLabel(d, tpl, i, n)} onChange={(e) => setCh(i, { name: e.target.value || undefined })} /></td>
                <td><input disabled={ro} className={inBand(c?.f) ? '' : 'bad'} title={inBand(c?.f) ? '' : 'Außerhalb des gewählten Bands'} type="number" step={0.025} value={c?.f ?? ''}
                  onChange={(e) => setCh(i, { f: e.target.value ? Number(e.target.value) : undefined })} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rf.backups?.length ? <div className="small muted">Backup: {rf.backups.map((f) => f.toFixed(3)).join(', ')} MHz</div> : null}
    </div>
  );
}
