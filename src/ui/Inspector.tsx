import { useState } from 'react';
import { Section } from './Section';
import { openCableBuild } from './CableWorkspace';
import { allRackTypes, useActiveRack, useStore } from '../model/store';
import { bayOf, cableLength, formatLength, rackBays, rackSizeLabel, resolveEnd, totalUnits, usedUnits } from '../model/geometry';
import { cablePlug, connectorDef, SIGNAL_LABELS } from '../model/connectors';
import { RACK_KIND_LABELS } from '../library/rackTypes';
import { cableNumberText } from '../render/cablePaths';
import { openDrawerInlay } from './CaseWorkspace';
import { Menu } from './Shell';
import { devicePorts, moduleChoice } from '../model/modules';
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
        : selection?.kind === 'box' ? <BoxInspector key={selection.id} rack={rack} id={selection.id} project={project} />
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
      <div className="insp-head">
        <input className="insp-title" disabled={ro} value={rack.name} onChange={(e) => st().updateRack(rack.id, { name: e.target.value })} title="Name des Racks" />
        <div className="muted small">Rack, {RACK_KIND_LABELS[rack.type.kind]}, {rackSizeLabel(rack.type)}</div>
      </div>
      <dl className="keyfigs">
        <div><dt>Belegt</dt><dd>{`${stats.used} von ${totalUnits(rack.type)} HE`}</dd></div>
        <div title="Breite × Höhe × Tiefe"><dt>Außenmaß</dt><dd>{rack.type.outer.w} × {rack.type.outer.h} × {rack.type.outer.d} mm</dd></div>
        {stats.weight > 0 ? <div><dt>Gewicht</dt><dd>ca. {stats.weight.toFixed(1).replace('.', ',')} kg</dd></div> : null}
        {stats.power > 0 ? <div><dt>Leistung</dt><dd>ca. {stats.power} W</dd></div> : null}
      </dl>
      <Section id="rack.housing" title="Gehäuse und Details" summary={rack.type.name}>
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
      {!ro ? (
        <div className="btn-group">
          <button className="btn sm" onClick={() => st().setMode('rackbuild')} title="Gehäuse dieses Racks im Arbeitsbereich Rackgehäuse konstruieren">Gehäuse konstruieren</button>
          <button className="btn sm" onClick={() => st().openModal({ kind: 'rackTypes' })} title="Gespeicherte Rack-Typen ansehen, kopieren und löschen">Rack-Typen verwalten …</button>
        </div>
      ) : null}
      <div className="stats">
        <div><span>Bauart</span><b>{RACK_KIND_LABELS[rack.type.kind]}</b></div>
        <div><span>Größe</span><b>{rackSizeLabel(rack.type)} ({Array.from(new Set(rackBays(rack.type).map((b) => `${b.rackStandard}"`))).join(' / ')})</b></div>
        {rackBays(rack.type).length > 1 ? <div><span>Einbaufelder</span><b>{rackBays(rack.type).length}</b></div> : null}
        <div><span>Einbautiefe</span><b>{rack.type.depth} mm</b></div>
        <div><span>Hintere Schienen</span><b>{rack.type.hasRearRails ? 'ja' : 'nein'}</b></div>
        <div><span>Geräte</span><b>{rack.devices.length}</b></div>
        <div><span>Kabel</span><b>{rack.cables.length}</b></div>
      </div>
      </Section>
      {Object.keys(stats.lengths).length ? (
        <Section id="rack.cables" title="Kabel nach Typ" summary={`${rack.cables.length} Kabel`}>
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
        </Section>
      ) : null}
      <Section id="rack.notes" title="Notizen" summary={rack.notes ? rack.notes.slice(0, 36) : 'keine'}>
        <textarea disabled={ro} rows={4} value={rack.notes ?? ''} onChange={(e) => st().updateRack(rack.id, { notes: e.target.value })} aria-label="Notizen" />
      </Section>
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
  const modules = tpl.modules ?? [];
  const fieldNames = Array.from(new Set([...(tpl.fields ?? []), ...Object.keys(d.fields ?? {})])).filter((f) => (!legacy.has(f) || d.fields?.[f]) && !modules.some((m) => m.name === f));
  const cables = rack.cables.filter((c) => c.a.deviceId === id || c.b.deviceId === id);
  return (
    <div className="insp">
      <div className="insp-head">
        <input className="insp-title" disabled={ro} placeholder={tpl.name} value={d.label ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { label: e.target.value || undefined })} title="Bezeichnung im Rack (leer = Gerätename)" />
        <div className="muted small">{[`${tpl.manufacturer} ${tpl.name}`, `${tpl.heightU} HE`, tpl.slots > 1 ? `1/${tpl.slots} Breite` : '', `${tpl.depth} mm tief`].filter(Boolean).join(', ')}</div>
      </div>
      {rackBays(rack.type).length > 1 ? (
        <Field label="Einbaufeld">
          <select disabled={ro} value={d.bay ?? 0} onChange={(e) => st().moveDevice(rack.id, id, d.u, d.mount, d.slot, Number(e.target.value))}>
            {rackBays(rack.type).map((b, i) => <option key={i} value={i}>{b.label || `Feld ${i + 1}`} ({b.heightU} HE, {b.rackStandard}")</option>)}
          </select>
        </Field>
      ) : null}
      <div className="row gap8">
        <Field label="HE (unten)">
          <input disabled={ro} type="number" min={1} max={bayOf(rack, d).heightU} value={d.u} onChange={(e) => st().moveDevice(rack.id, id, Number(e.target.value), d.mount, d.slot)} />
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
      <label className="check" title="Das Gerät sitzt umgekehrt in den Schienen: die Rückseite mit ihren Anschlüssen zeigt nach außen, die Rackwinkel sind nach hinten versetzt.">
        <input disabled={ro} type="checkbox" checked={!!d.reversed} onChange={(e) => st().updateDevice(rack.id, id, { reversed: e.target.checked })} /> Gedreht eingebaut (Rückseite nach außen)
      </label>
      {!ro ? (
        <div className="action-row">
          <div className="btn-group">
            <button className="btn sm" onClick={() => st().duplicateDevice(rack.id, id)} title="Gleiches Gerät noch einmal einbauen (Strg+D)">Duplizieren</button>
            <button className="btn sm" onClick={() => st().openModal(tpl.panel ? { kind: 'panel', templateId: tpl.id } : { kind: 'device', templateId: tpl.id })} title="Anschlüsse und Maße der Vorlage ändern; gilt für alle Geräte dieses Typs">Vorlage bearbeiten</button>
          </div>
          <button className="btn sm danger" onClick={() => st().removeDevice(rack.id, id)} title="Gerät aus dem Rack nehmen, seine Kabel werden mit entfernt (Entf)">Entfernen</button>
        </div>
      ) : null}
      {modules.length ? (
        <Section id="device.modules" title="Schächte" defaultOpen summary={modules.map((m) => moduleChoice(tpl, m, d) || 'leer').join(', ')}>
          <div className="muted small">{modules.some((m) => m.options.some((o) => o.ports?.length))
            ? 'Jeder Steckplatz nimmt eine Karte auf. Ihre Anschlüsse sind normale Ports für Kabel; beim Tausch der Karte werden die Kabel daran entfernt (Rückgängig möglich).'
            : 'Jeder Schacht nimmt ein Modul auf. Die Auswahl erscheint auf der Front.'}</div>
          {modules.map((m) => (
            <Field key={m.name} label={m.name}>
              <select disabled={ro} value={moduleChoice(tpl, m, d)} onChange={(e) => st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), [m.name]: e.target.value } })}>
                <option value="">leer</option>
                {m.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          ))}
          {!ro ? (
            <Menu label="Alle Schächte gleich belegen" className="sm" title="Ein Modul in alle Schächte setzen">
              {[{ id: '', label: 'leer' }, ...modules[0].options].map((o) => (
                <button key={o.id || 'empty'} onClick={() => st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), ...Object.fromEntries(modules.map((m) => [m.name, o.id])) } })}>{o.label}</button>
              ))}
            </Menu>
          ) : null}
        </Section>
      ) : null}
      <Section id="device.fields" title="Eigene Felder" summary={fieldNames.length ? fieldNames.join(', ') : 'z. B. IP-Adresse'}>
      {fieldNames.map((f) => (
        <Field key={f} label={f}>
          <input disabled={ro} value={d.fields?.[f] ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), [f]: e.target.value } })} />
        </Field>
      ))}
      {!ro ? (
        <div className="row gap4">
          <input placeholder="Feld hinzufügen (z. B. IP-Adresse)" value={newField} onChange={(e) => setNewField(e.target.value)} />
          <button className="btn sm" disabled={!newField.trim()} title="Eigenes Feld mit diesem Namen anlegen" onClick={() => { st().updateDevice(rack.id, id, { fields: { ...(d.fields ?? {}), [newField.trim()]: '' } }); setNewField(''); }}>Feld anlegen</button>
        </div>
      ) : null}
      </Section>
      {rfProductsFor(tpl).length ? <RfSection project={project} rack={rack} d={d} ro={ro} /> : null}
      {tpl.drawer ? <DrawerContents rack={rack} deviceId={id} items={d.contents ?? []} ro={ro} /> : null}
      <Section id="device.notes" title="Notizen" summary={d.notes ? d.notes.slice(0, 36) : 'keine'}>
        <textarea disabled={ro} rows={3} value={d.notes ?? ''} onChange={(e) => st().updateDevice(rack.id, id, { notes: e.target.value })} aria-label="Notizen" />
      </Section>
      <Section id="device.ports" title={`Anschlüsse (${devicePorts(tpl, d).length})`} summary={`${cables.length} belegt`}>
      <div className="port-list">
        {devicePorts(tpl, d).map((p) => {
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
      </Section>
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
      <div className="insp-head">
        <h3>Kabel {cableNumberText(c)}</h3>
        <div className="muted small">{ct?.name ?? 'Kabel'}{c.yGroup ? ', Ast eines Y-Kabels' : ''}</div>
      </div>
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
        {c.color && !ro ? <button className="btn sm" onClick={() => st().updateCable(rack.id, id, { color: undefined })} title="Eigene Farbe entfernen und die Farbe des Kabeltyps verwenden">Typfarbe verwenden</button> : null}
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
        <dl className="keyfigs"><div><dt>Länge in der Liste</dt><dd>{formatLength(len.length)}</dd></div></dl>
      ) : null}
      {len ? (
        <div className="stats">
          <div><span>Automatisch (auf Lagerlänge)</span><b>{formatLength(len.auto)}</b></div>
          <div><span>Berechnet (exakt)</span><b>{formatLength(len.exact)}</b></div>
        </div>
      ) : null}
      <Field label="Beschriftung / Notiz">
        <input disabled={ro} value={c.label ?? ''} placeholder="z. B. Vox 1" onChange={(e) => st().updateCable(rack.id, id, { label: e.target.value || undefined })} />
      </Field>
      <Section id="cable.build" title="Konfektion" defaultOpen summary={c.customId ? project.customCables?.find((x) => x.id === c.customId)?.name ?? 'eigenes Kabel' : 'Standard'}>
        <div className="stats">
          <div><span>Ende A</span><b>{a ? cablePlug(a.port).label : '?'}</b></div>
          <div><span>Ende B</span><b>{b ? cablePlug(b.port).label : '?'}</b></div>
        </div>
        {(project.customCables ?? []).length ? (
          <Field label="Gebaut als">
            <select disabled={ro} value={c.customId ?? ''} onChange={(e) => st().updateCable(rack.id, id, { customId: e.target.value || undefined })} title="Eigenes Kabel aus dem Reiter Kabel, dessen Name und Belegung für dieses Kabel gelten">
              <option value="">Standardbelegung</option>
              {(project.customCables ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
        ) : null}
        <div><button className="btn sm" onClick={() => openCableBuild(cableNumberText(c).replace(c.yGroup ? /[a-z]$/ : /$^/, ''))} title="Bauanleitung mit Pinbelegung und Arbeitsschritten im Reiter Kabel öffnen">Bauanleitung öffnen</button></div>
      </Section>
      <Section id="cable.y" title="Y-Kabel" summary={c.yGroup ? `${rack.cables.filter((x) => x.yGroup === c.yGroup).length} Äste` : 'Ast hinzufügen'}>
      {c.yGroup ? (
        <div className="muted small">
          {`Ast ${String.fromCharCode(96 + (c.yLeg ?? 1))} von ${rack.cables.filter((x) => x.yGroup === c.yGroup).length}`}. Alle Äste teilen den Stecker an Ende A
          ({a ? `${a.device.label || a.tpl.name}, ${a.port.name}` : '?'}); die Länge gilt vom gemeinsamen Stecker bis zum Ende des Asts.
        </div>
      ) : <div className="muted small">Ein weiterer Ast macht aus diesem Kabel ein Y-Kabel mit gemeinsamem Stecker.</div>}
      {!ro ? (
        <div className="btn-group">
          {c.yGroup
            ? <button className="btn sm" onClick={() => st().startYLeg(rack.id, id, 'a')} title="Weiteren Ast am gemeinsamen Stecker anlegen, danach den Zielanschluss anklicken">Ast hinzufügen</button>
            : <>
                <button className="btn sm" onClick={() => st().startYLeg(rack.id, id, 'a')} title="Ende A wird der gemeinsame Stecker; danach den Zielanschluss des neuen Asts anklicken">Ast an Ende A</button>
                <button className="btn sm" onClick={() => st().startYLeg(rack.id, id, 'b')} title="Ende B wird der gemeinsame Stecker; danach den Zielanschluss des neuen Asts anklicken">Ast an Ende B</button>
              </>}
        </div>
      ) : null}
      </Section>
      {!ro ? (
        <div className="action-row" style={{ marginTop: 10 }}>
          {!c.yGroup ? <button className="btn sm" onClick={() => st().updateCable(rack.id, id, { a: c.b, b: c.a })} title="Anfang und Ende tauschen (für Beschriftung und Kabelliste)">A und B tauschen</button> : <span />}
          <button className="btn sm danger" onClick={() => st().removeCable(rack.id, id)} title="Kabel entfernen (Entf)">{c.yGroup ? 'Ast löschen' : 'Kabel löschen'}</button>
        </div>
      ) : null}
    </div>
  );
}

function BoxInspector({ rack, id, project }: { rack: Rack; id: string; project: Project }) {
  const ro = useStore((s) => s.readOnly);
  const st = useStore.getState;
  const b = rack.boxes?.find((x) => x.id === id);
  const tpl = b && project.templates[b.templateId];
  if (!b || !tpl?.box) return null;
  const portName = (pid: string) => tpl.ports.find((p) => p.id === pid)?.name ?? '?';
  const cables = rack.cables.filter((c) => c.a.deviceId === id || c.b.deviceId === id);
  return (
    <div className="insp">
      <div className="insp-head">
        <input className="insp-title" disabled={ro} placeholder={tpl.name} value={b.label ?? ''} onChange={(e) => st().updateBox(rack.id, id, { label: e.target.value || undefined })} title="Bezeichnung (leer = Name der Vorlage)" />
        <div className="muted small">{tpl.box.kind === 'split' ? 'Splitdose' : 'Kombidose'}, {tpl.name}</div>
      </div>
      <Field label="Entfernung zum Rack (m)">
        <input disabled={ro} type="number" min={0} step={0.5} value={b.distance} onChange={(e) => st().updateBox(rack.id, id, { distance: Math.max(0, Number(e.target.value) || 0) })} />
      </Field>
      <div className="muted small">Die Entfernung fließt in die automatische Länge aller Kabel zu dieser Dose ein.</div>
      <Field label="Notizen">
        <textarea disabled={ro} rows={2} value={b.notes ?? ''} onChange={(e) => st().updateBox(rack.id, id, { notes: e.target.value || undefined })} />
      </Field>
      {!ro ? (
        <div className="action-row">
          <button className="btn sm" onClick={() => st().openModal({ kind: 'box', templateId: tpl.id })} title="Anschlüsse und Verdrahtung der Dose ändern">Vorlage bearbeiten</button>
          <button className="btn sm danger" onClick={() => st().removeBox(rack.id, id)} title="Dose entfernen, ihre Kabel werden mit entfernt (Entf)">Entfernen</button>
        </div>
      ) : null}
      <Section id="box.links" title="Innere Verdrahtung" summary={`${tpl.box.links.length} Sammelanschlüsse`}>
      <div className="stats">
        {tpl.box.links.map((l) => (
          <div key={l.multi}><span>{portName(l.multi)}</span><b>{l.singles.map(portName).join(', ') || '–'}</b></div>
        ))}
      </div>
      </Section>
      <Section id="box.ports" title={`Anschlüsse (${tpl.ports.length})`} summary={`${cables.length} belegt`}>
      <div className="port-list">
        {tpl.ports.map((p) => {
          const c = cables.find((x) => (x.a.deviceId === id && x.a.portId === p.id) || (x.b.deviceId === id && x.b.portId === p.id));
          const other = c ? resolveEnd(project, rack, c.a.deviceId === id && c.a.portId === p.id ? c.b : c.a) : null;
          return (
            <div key={p.id} className={'port-row' + (c ? ' linked' : '')} onClick={() => c && st().select({ kind: 'cable', id: c.id })}>
              <span className="muted small"></span>
              <span>{p.name}</span>
              <span className="muted small">{connectorDef(p.connector).label}</span>
              <span className="small">{other ? `an ${other.device.label || other.tpl.name}, ${other.port.name}` : ''}</span>
            </div>
          );
        })}
      </div>
      </Section>
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
    <Section id="device.drawer" title="Inhalt der Schublade" defaultOpen summary={`${items.length} Positionen`}>
    <div className="drawer-box">
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => openDrawerInlay(st().project, rack.id, deviceId)}>Schaumstoff-Einlage gestalten</button>
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
    </Section>
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
    <Section id="device.rf" title="Funk (RF Frequency Manager)" defaultOpen summary={rf.band ? `Band ${rf.band}` : 'kein Band'}>
    <div className="drawer-box">
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
    </Section>
  );
}
