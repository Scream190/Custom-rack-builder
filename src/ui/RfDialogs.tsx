import { useMemo, useState } from 'react';
import { useActiveRack, useStore } from '../model/store';
import { deepClone, downloadBlob } from '../model/util';
import { Field, Modal } from './Modal';
import { applyFrequencyList, buildRfRequests, rfProductById, type RfImport } from '../integration/rf';
import { applyRfImport, type RfImportTarget } from '../integration/rfImport';

/** Import from the RF Frequency Manager: devices (.rfse / request) or a frequency list (freqs). */
export function RfImportDialog({ data }: { data: RfImport }) {
  return data.kind === 'freqs' ? <RfFreqsDialog data={data} /> : <RfDevicesDialog data={data} />;
}

function RfFreqsDialog({ data }: { data: Extract<RfImport, { kind: 'freqs' }> }) {
  const project = useStore((s) => s.project);
  const st = useStore.getState;
  // dry run on a copy to show what would match
  const preview = useMemo(() => applyFrequencyList(deepClone(project), data.items), [project, data]);
    return (
      <Modal title="Frequenzliste aus dem RF Frequency Manager" footer={<>
        <span className="spacer" />
        <button className="btn" onClick={() => st().openModal(null)}>Abbrechen</button>
        <button className="btn primary" disabled={!preview.matched} onClick={() => {
          let res = { matched: 0, unmatched: [] as string[] };
          st().mutate((p) => { res = applyFrequencyList(p, data.items); });
          st().showToast(`${res.matched} Frequenzen übernommen${res.unmatched.length ? `, ${res.unmatched.length} ohne passenden Kanal` : ''}`);
          st().openModal(null);
        }}>{preview.matched} Frequenzen übernehmen</button>
      </>}>
        <div className="muted">{data.source}, {data.items.length} Einträge</div>
        <div className="hint">Zuordnung über den Kanalnamen (wie beim Export an das RF-Programm vergeben). Backups gehen an das Gerät mit dem passenden Namen.</div>
        <div className="stats">
          <div><span>Passende Kanäle</span><b>{preview.matched}</b></div>
          <div><span>Ohne Treffer</span><b>{preview.unmatched.length}</b></div>
        </div>
        {preview.unmatched.length ? <div className="small muted">Ohne Treffer: {preview.unmatched.slice(0, 20).join(', ')}{preview.unmatched.length > 20 ? ' …' : ''}</div> : null}
    </Modal>
  );
}

function RfDevicesDialog({ data }: { data: Extract<RfImport, { kind: 'devices' }> }) {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const st = useStore.getState;
  const [target, setTarget] = useState<RfImportTarget>('perZone');
  const zones = Array.from(new Set(data.devices.map((d) => d.zone || '–')));
  const withFreq = data.devices.reduce((n, d) => n + d.channels.filter((c) => c.f).length, 0);
  return (
    <Modal wide title="Geräte aus dem RF Frequency Manager" footer={<>
      <span className="spacer" />
      <button className="btn" onClick={() => st().openModal(null)}>Abbrechen</button>
      <button className="btn primary" disabled={!data.devices.length} onClick={() => {
        let rep = { placed: 0, racks: [] as string[], notPlaced: [] as string[], genericTemplates: [] as string[] };
        const before = new Set(project.racks.map((r) => r.id));
        st().mutate((p) => { rep = applyRfImport(p, data.devices, target, rack.id, project.name || 'Funkrack'); });
        const added = useStore.getState().project.racks.find((r) => !before.has(r.id));
        if (added) st().setActiveRack(added.id);
        st().showToast(`${rep.placed} Geräte eingebaut in ${rep.racks.join(', ')}${rep.notPlaced.length ? `, ${rep.notPlaced.length} ohne Platz` : ''}${rep.genericTemplates.length ? `; Platzhalter: ${rep.genericTemplates.join(', ')}` : ''}`, rep.notPlaced.length ? 'error' : 'info');
        st().openModal(null);
      }}>{data.devices.length} Geräte importieren</button>
    </>}>
      <div className="muted">{data.source}: {data.devices.length} Geräte, {withFreq} Frequenzen, Zonen {zones.join(', ')}</div>
      <Field label="Einbauen in">
        <select value={target} onChange={(e) => setTarget(e.target.value as RfImportTarget)}>
          <option value="perZone">je Zone ein neues Rack (Größe automatisch)</option>
          <option value="oneRack">ein neues Rack für alle (Größe automatisch)</option>
          <option value="activeRack">freie Plätze im aktuellen Rack „{rack.name}“</option>
        </select>
      </Field>
      <div className="cable-table-wrap" style={{ maxHeight: 340 }}>
        <table className="cable-table">
          <thead><tr><th>Gerät</th><th>Produkt</th><th>Band</th><th>Zone</th><th>Kanäle</th><th>Frequenzen</th></tr></thead>
          <tbody>
            {data.devices.map((d, i) => {
              const prod = rfProductById(d.product);
              return (
                <tr key={i}>
                  <td>{d.name}</td>
                  <td>{prod ? `${prod.man} ${prod.model}` : <span className="muted">{d.product || '?'} (Platzhalter)</span>}</td>
                  <td>{d.band || '–'}</td>
                  <td>{d.zone || '–'}</td>
                  <td>{d.channels.map((c) => c.name).filter(Boolean).join(', ') || d.channels.length}</td>
                  <td>{d.channels.filter((c) => c.f).map((c) => c.f!.toFixed(3)).join(', ') || '–'}{d.backups.length ? `; Backup ${d.backups.map((f) => f.toFixed(3)).join(', ')}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint">Verkabelung wird nicht angelegt. Die Funkdaten (Band, Zone, Kanalnamen, Frequenzen) stehen danach im Eigenschaften-Bereich jedes Geräts und auf dem Gerätedisplay.</div>
    </Modal>
  );
}

/** Section in the export dialog: wireless devices → frequency request file for the RF Frequency Manager. */
export function RfExportCard({ scope }: { scope: 'current' | 'all' }) {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const st = useStore.getState;
  const [zoneMode, setZoneMode] = useState<'none' | 'rack' | 'device'>('device');
  const [result, setResult] = useState<string | null>(null);
  const run = () => {
    const rep = buildRfRequests(project, { racks: scope === 'all' ? project.racks : [rack], zoneMode, from: project.author || 'RackPlanner' });
    if (!rep.files.length) { st().showToast('Keine Funkgeräte mit RF-Produkt in der Auswahl', 'error'); return; }
    rep.files.forEach((f, i) => setTimeout(() => downloadBlob(new Blob([f.text], { type: 'application/json' }), f.name), i * 300));
    setResult(`${rep.files.reduce((n, f) => n + f.devices, 0)} Geräte in ${rep.files.length} Datei(en)${rep.skipped.length ? `; übersprungen: ${rep.skipped.join('; ')}` : ''}`);
  };
  return (
    <div className="export-card">
      <h4>RF Frequency Manager</h4>
      <p className="muted small">
        Funkgeräte als Frequenzanfrage (.rfreq). Im RF-Programm: <b>Inventar → Anfragen … → Datei …</b> – jedes Gerät wird ein Inventar-Eintrag
        mit Produkt, Band, Gerätename und Kanalnamen. Die koordinierte Frequenzliste kommt über „Importieren aus RF …“ zurück.
      </p>
      <select value={zoneMode} onChange={(e) => setZoneMode(e.target.value as typeof zoneMode)}>
        <option value="device">Zone aus den Funkdaten (eine Datei je Zone)</option>
        <option value="rack">Rackname als Zone (eine Datei je Rack)</option>
        <option value="none">ohne Zone (eine Datei)</option>
      </select>
      <button className="btn" onClick={run}>.rfreq herunterladen</button>
      {result ? <div className="small muted">{result}</div> : null}
    </div>
  );
}
