import { useState } from 'react';
import { allRackTypes, useActiveRack, useStore } from '../model/store';
import type { Bay, Project, Rack, RackBuild, RackKind, RackType } from '../model/types';
import { applyBuild, BUILD_KINDS, buildOf, isFlightRack, rackBom, rackDims } from '../model/rackBuild';
import { arrangeBays, rackBays, rackExtent, totalUnits, U, formatLength } from '../model/geometry';
import { deepClone, uid } from '../model/util';
import { RackSheet, rackSheetLayout } from '../render/RackBuildDrawing';
import { RackBuild3D } from '../three/RackBuild3D';
import { ErrorBoundary } from './ErrorBoundary';
import { Splitter } from './Splitter';
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { Field, NumberInput } from './Modal';
import { SheetCanvas } from './SheetCanvas';
import { Seg, ToolGroup, Toolbar } from './Shell';

const st = useStore.getState;
const kg = (n: number) => String(n).replace('.', ',');

/** write a changed rack type (and build) back to the rack; devices in removed bays move to the first bay */
function commit(rack: Rack, t: RackType, build: Partial<RackBuild> = {}) {
  const next = applyBuild(t, build);
  const n = rackBays(next).length;
  st().updateRack(rack.id, { type: next, devices: rack.devices.map((d) => ((d.bay ?? 0) < n ? d : { ...d, bay: undefined })) });
}

/** devices that do not fit the mounting depth */
function depthProblems(project: Project, rack: Rack) {
  const t = rack.type, b = buildOf(t), d = rackDims(t);
  const out: string[] = [];
  for (const dev of rack.devices) {
    const tpl = project.templates[dev.templateId];
    if (!tpl) continue;
    const room = dev.mount === 'front' ? t.depth + b.rearGap : t.depth + d.railZ;
    if (tpl.depth > room) out.push(`${dev.label || tpl.name}: ${tpl.depth} mm tief, Platz ${Math.round(room)} mm`);
  }
  return out;
}

function BuildInspector({ project, rack }: { project: Project; rack: Rack }) {
  const ro = useStore((s) => s.readOnly);
  const t = rack.type;
  const b = buildOf(t);
  const d = rackDims(t);
  const bom = rackBom(t);
  const flight = isFlightRack(t.kind);
  const [gap, setGap] = useState(40);
  const bays = rackBays(t);
  const multi = (t.bays?.length ?? 0) > 1;
  const setB = (p: Partial<RackBuild>) => commit(rack, t, p);
  const setT = (p: Partial<RackType>) => commit(rack, { ...t, ...p });
  const setBays = (list: Bay[] | null) => {
    if (!list || list.length < 2) {
      const first = list?.[0] ?? bays[0];
      const { bays: _drop, ...rest } = t; void _drop;
      commit(rack, { ...rest, heightU: first.heightU, rackStandard: first.rackStandard });
      return;
    }
    const next = { ...t, bays: list };
    setT({ bays: list, heightU: Math.round(rackExtent(next).h / U), rackStandard: list[0].rackStandard });
  };
  const setBay = (i: number, p: Partial<Bay>) => {
    if (!multi) { setT({ heightU: p.heightU ?? t.heightU, rackStandard: p.rackStandard ?? t.rackStandard }); return; }
    setBays(bays.map((x, j) => (j === i ? { ...x, ...p } : x)));
  };
  const problems = depthProblems(project, rack);
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <input className="insp-title" disabled={ro} value={t.name} onChange={(e) => st().updateRack(rack.id, { type: { ...t, name: e.target.value, custom: true } })} title="Name des Rackgehäuses" />
          <div className="muted small">Gehäuse von „{rack.name}“</div>
        </div>
        <dl className="keyfigs">
          <div title="Breite × Höhe × Tiefe, inklusive Rollen und Deckel"><dt>Außenmaß</dt><dd>{Math.round(d.W)} × {Math.round(d.H)} × {Math.round(d.D)} mm</dd></div>
          <div><dt>Gewicht leer</dt><dd>ca. {kg(bom.weight.case)} kg</dd></div>
          <div><dt>Einbau</dt><dd>{totalUnits(t)} HE, {t.depth} mm tief</dd></div>
        </dl>
        {d.castorH ? <div className="muted small">Höhe inklusive {d.castorH} mm Rollen.</div> : null}

        <h4>Bauart</h4>
        <Seg value={(BUILD_KINDS.some((k) => k.id === t.kind) ? t.kind : 'cabinet') as RackKind} onChange={(k) => setT({ kind: k })} options={BUILD_KINDS} />

        <h4>Einbaufelder</h4>
        <div className="bay-list">
          {bays.map((bay, i) => (
            <div key={i} className="bay-row">
              {multi ? <input className="bay-name" value={bay.label ?? ''} placeholder={`Feld ${i + 1}`} disabled={ro} onChange={(e) => setBay(i, { label: e.target.value || undefined })} title="Name des Feldes" /> : <span className="muted small bay-name">Ein Feld</span>}
              <label className="inline-field">HE <NumberInput value={bay.heightU} min={1} max={60} onChange={(v) => setBay(i, { heightU: Math.max(1, Math.round(v)) })} style={{ width: 54 }} /></label>
              <select value={bay.rackStandard} disabled={ro} onChange={(e) => setBay(i, { rackStandard: Number(e.target.value) as 19 | 10 })} title="Rackbreite">
                <option value={19}>19"</option><option value={10}>10"</option>
              </select>
              {multi && !ro ? <button className="icon-btn" title={`Feld ${bay.label ?? i + 1} entfernen`} aria-label="Feld entfernen" onClick={() => setBays(bays.filter((_, j) => j !== i))}>✕</button> : null}
            </div>
          ))}
        </div>
        {!ro ? (
          <>
            <div className="row gap8 wrap">
              <button className="btn sm" onClick={() => setBays(arrangeBays([...bays.map(({ x: _x, y: _y, ...r }) => r), { heightU: bays[bays.length - 1].heightU, rackStandard: bays[bays.length - 1].rackStandard }], 'row', gap))} title="Weiteres Einbaufeld daneben anlegen (Doppel-, Triple-Rack)">+ Feld daneben</button>
              <button className="btn sm" onClick={() => setBays(arrangeBays([{ heightU: 4, rackStandard: bays[0].rackStandard, label: 'oben' }, ...bays.map(({ x: _x, y: _y, ...r }) => r)], 'stack', gap))} title="Weiteres Einbaufeld darüber anlegen (Kombirack)">+ Feld darüber</button>
            </div>
            {multi ? (
              <div className="row gap8 wrap">
                <label className="inline-field" title="Abstand zwischen den Feldern (Mittelwand)">Abstand <NumberInput value={gap} min={0} step={5} onChange={(v) => setGap(Math.max(0, v))} style={{ width: 56 }} /> mm</label>
                <div className="btn-group">
                  <button className="btn sm" onClick={() => setBays(arrangeBays(bays.map(({ x: _x, y: _y, ...r }) => r), 'row', gap))} title="Felder nebeneinander anordnen">nebeneinander</button>
                  <button className="btn sm" onClick={() => setBays(arrangeBays(bays.map(({ x: _x, y: _y, ...r }) => r), 'stack', gap))} title="Felder übereinander anordnen">übereinander</button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <h4>Tiefe und Freiräume</h4>
        <div className="row gap8">
          <Field label="Einbautiefe" title="Abstand vordere bis hintere Rackschiene in mm"><NumberInput value={t.depth} min={100} step={10} onChange={(v) => setT({ depth: v })} /></Field>
          <Field label="Platz vorne" title="Freiraum vor den Frontschienen für Knöpfe, Griffe und Kabel (mm)"><NumberInput value={b.railInset} min={0} step={5} onChange={(v) => setB({ railInset: v })} /></Field>
          <Field label="Platz hinten" title="Freiraum hinter den hinteren Schienen für Stecker und Kabel (mm)"><NumberInput value={b.rearGap} min={0} step={5} onChange={(v) => setB({ rearGap: v })} /></Field>
        </div>
        <div className="row gap8">
          <Field label="Platz seitlich" title="Abstand Schiene bis Seitenwand je Seite, zum Beispiel als Kabelkanal (mm)"><NumberInput value={b.sideGap} min={0} step={5} onChange={(v) => setB({ sideGap: v })} /></Field>
          <Field label="Platz oben/unten" title="Abstand der Einbaufelder zu Deckel und Boden (mm)"><NumberInput value={b.topGap} min={0} step={2} onChange={(v) => setB({ topGap: v })} /></Field>
        </div>
        <label className="check"><input disabled={ro} type="checkbox" checked={t.hasRearRails} onChange={(e) => setT({ hasRearRails: e.target.checked })} /> Hintere Rackschienen (Montage auch von hinten)</label>

        {flight ? (
          <>
            <h4>Deckel</h4>
            <div className="row gap8">
              <Field label="Frontdeckel (mm)" title="Innentiefe des Frontdeckels, 0 = kein Deckel"><NumberInput value={b.frontLid} min={0} step={10} onChange={(v) => setB({ frontLid: Math.max(0, v) })} /></Field>
              <Field label="Rückdeckel (mm)" title="Innentiefe des Rückdeckels, 0 = kein Deckel"><NumberInput value={b.rearLid} min={0} step={10} onChange={(v) => setB({ rearLid: Math.max(0, v) })} /></Field>
            </div>
            <Field label="Butterflyverschlüsse je Deckel"><select disabled={ro} value={b.latches} onChange={(e) => setB({ latches: Number(e.target.value) as RackBuild['latches'] })}>
              <option value={4}>4 (je Seite einer)</option><option value={6}>6 (oben und unten je zwei)</option><option value={8}>8 (je Seite zwei)</option>
            </select></Field>

            <h4>Bauweise</h4>
            <div className="row gap8">
              <Field label="Platte"><select disabled={ro} value={b.panel} onChange={(e) => setB({ panel: Number(e.target.value) })}>{[7, 9, 10, 12, 15].map((x) => <option key={x} value={x}>{x} mm</option>)}</select></Field>
              <Field label="Kantenprofil"><select disabled={ro} value={b.profile} onChange={(e) => setB({ profile: e.target.value as RackBuild['profile'] })}><option value="alu30">Alu 30 × 30</option><option value="alu35">Alu 35 × 35</option><option value="none">ohne</option></select></Field>
              <Field label="Laminat"><input disabled={ro} type="color" value={t.color} onChange={(e) => setT({ color: e.target.value })} title="Farbe des Laminats" /></Field>
            </div>
            <label className="check"><input disabled={ro} type="checkbox" checked={b.cornerBalls} onChange={(e) => setB({ cornerBalls: e.target.checked })} /> Kugelecken an den Deckeln</label>
            {t.kind === 'shockmount' ? (
              <div className="row gap8">
                <Field label="Federweg je Seite (mm)"><NumberInput value={b.shock?.travel ?? 35} min={10} max={100} step={5} onChange={(v) => setB({ shock: { damper: b.shock?.damper ?? 'rubber', travel: v } })} /></Field>
                <Field label="Dämpfer"><select disabled={ro} value={b.shock?.damper ?? 'rubber'} onChange={(e) => setB({ shock: { travel: b.shock?.travel ?? 35, damper: e.target.value as 'rubber' | 'foam' } })}><option value="rubber">Gummi-Schwingmetall</option><option value="foam">Dämpfungsschaum</option></select></Field>
              </div>
            ) : null}

            <h4>Griffe und Stapeln</h4>
            <div className="row gap8">
              <Field label="Klappgriffe je Seite"><select disabled={ro} value={b.handles} onChange={(e) => setB({ handles: Number(e.target.value) as RackBuild['handles'] })}><option value={0}>keine</option><option value={1}>1</option><option value={2}>2</option></select></Field>
            </div>
            <label className="check"><input disabled={ro} type="checkbox" checked={b.stackCups} onChange={(e) => setB({ stackCups: e.target.checked })} /> Stapelschalen oben (Rollen des oberen Racks stehen darin)</label>
          </>
        ) : (
          <>
            <h4>Farbe</h4>
            <Field label="Pulverbeschichtung"><input disabled={ro} type="color" value={t.color} onChange={(e) => setT({ color: e.target.value })} /></Field>
          </>
        )}

        <h4>Rollen</h4>
        <div className="row gap8">
          <Field label="Anzahl"><select disabled={ro} value={b.castors} onChange={(e) => setB({ castors: Number(e.target.value) as RackBuild['castors'] })}><option value={0}>keine</option><option value={4}>4, davon 2 mit Bremse</option></select></Field>
          <Field label="Raddurchmesser"><select disabled={ro} value={b.castorSize} onChange={(e) => setB({ castorSize: Number(e.target.value) as RackBuild['castorSize'] })}><option value={75}>75 mm</option><option value={100}>100 mm</option><option value={125}>125 mm</option></select></Field>
        </div>

        {!ro ? (
          <>
            <h4>Wiederverwenden</h4>
            <button className="btn sm" onClick={() => { const copy = { ...deepClone(t), id: uid('rt-'), custom: true }; st().upsertRackType(copy); st().updateRack(rack.id, { type: copy }); st().showToast(`„${t.name}“ ist jetzt unter Bibliotheken → Rack-Typen gespeichert`); }} title="Dieses Gehäuse als eigenen Rack-Typ speichern, um es für weitere Racks zu verwenden">Als Rack-Typ speichern</button>
          </>
        ) : null}
        <Field label="Notizen"><textarea disabled={ro} rows={2} value={t.notes ?? ''} onChange={(e) => st().updateRack(rack.id, { type: { ...t, notes: e.target.value || undefined } })} /></Field>
        {problems.length ? <div className="warn-box"><h4>Zu tief</h4>{problems.map((p, i) => <div key={i} className="warn">{p}</div>)}</div> : null}
      </div>
    </aside>
  );
}

function RackPartsList({ rack }: { rack: Rack }) {
  const [open, setOpen] = useState(true);
  const b = rackBom(rack.type);
  const panel = buildOf(rack.type).panel;
  return (
    <div className={'cable-list' + (open ? '' : ' closed')}>
      <div className="cable-list-head">
        <button className="cable-list-title" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Stückliste einklappen' : 'Stückliste ausklappen'}>{open ? '▾' : '▸'} Stückliste Gehäuse, {rack.type.name}</button>
        <span className="muted small">Gewicht leer ca. {kg(b.weight.case)} kg, Volumen {kg(b.volume)} m³</span>
      </div>
      {open ? (
        <div className="cable-table-wrap parts-grid">
          {b.panels.length ? (
            <table className="cable-table"><thead><tr><th>{isFlightRack(rack.type.kind) ? `Platte (${panel} mm)` : 'Teil'}</th><th>Stk.</th><th>Zuschnitt (mm)</th></tr></thead>
              <tbody>{b.panels.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.count}</td><td>{Math.round(p.a)} × {Math.round(p.b)}</td></tr>)}</tbody></table>
          ) : null}
          {b.profiles.length ? (
            <table className="cable-table"><thead><tr><th>Profil</th><th>Länge</th></tr></thead>
              <tbody>{b.profiles.map((p) => <tr key={p.name}><td>{p.name}</td><td>{formatLength(p.length)}</td></tr>)}</tbody></table>
          ) : null}
          <table className="cable-table"><thead><tr><th>Beschlag und Schienen</th><th>Stk.</th></tr></thead>
            <tbody>{b.hardware.map((h) => <tr key={h.label}><td>{h.label}</td><td>{h.count}</td></tr>)}</tbody></table>
        </div>
      ) : null}
    </div>
  );
}

export function RackBuildWorkspace() {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const ro = useStore((s) => s.readOnly);
  const layout = useLayout();
  const [view, setView] = useState<'drawing' | '3d'>('drawing');
  const [devices, setDevices] = useState(true);
  const L = rackSheetLayout(rack);
  const pad = 90 * L.u;
  const types = allRackTypes(project);
  return (
    <main className="workspace">
      <section className="center">
        <Toolbar>
          <ToolGroup label="Ansicht">
            <Seg value={view} onChange={setView} options={[
              { id: 'drawing', label: 'Zeichnung', title: 'Vorderansicht, Seitenansicht und Schnitt mit Maßen' },
              { id: '3d', label: '3D', title: 'Räumliche Ansicht des Gehäuses' },
            ]} />
            <label className="check" title="Die eingebauten Geräte in Zeichnung und 3D zeigen"><input type="checkbox" checked={devices} onChange={(e) => setDevices(e.target.checked)} /> Geräte zeigen</label>
          </ToolGroup>
          {!ro ? (
            <ToolGroup label="Startpunkt">
              <select className="tool-select" value="" onChange={(e) => {
                const src = types.find((x) => x.id === e.target.value);
                if (src) commit(rack, { ...deepClone(src), id: rack.type.custom ? rack.type.id : uid('rt-'), name: src.name, build: undefined, custom: true });
              }} title="Maße und Bauart eines vorhandenen Rack-Typs übernehmen und dann anpassen. Die eingebauten Geräte bleiben.">
                <option value="">Werte aus einem Rack-Typ übernehmen …</option>
                {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </ToolGroup>
          ) : null}
        </Toolbar>
        <div className="stage">
          <ErrorBoundary resetKey={view + rack.id}>
            {view === '3d' ? <RackBuild3D project={project} rack={rack} devices={devices} /> : (
              <SheetCanvas size={{ x: -pad, y: 0, w: L.w + pad, h: L.h }} fitKey={`${rack.id}:${Math.round(L.w)}:${Math.round(L.h)}`} editable={false}
                hint="Mausrad zoomt, Ziehen verschiebt, Doppelklick passt ein. Geräte baust du unter „Racks bestücken“ ein.">
                {() => <RackSheet project={project} rack={rack} devices={devices} />}
              </SheetCanvas>
            )}
          </ErrorBoundary>
        </div>
        {layout.showCableList ? <div className="cable-list-wrap" style={{ maxHeight: 300 }}><RackPartsList rack={rack} /></div> : null}
      </section>
      {layout.showInspector ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={260} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}><BuildInspector project={project} rack={rack} /></div>
        </>
      ) : null}
    </main>
  );
}
