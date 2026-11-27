import { useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { CableType, SignalType } from '../model/types';
import { SIGNAL_LABELS } from '../model/connectors';
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { FOAM_MATERIALS } from '../model/inlay';
import { RACK_KIND_LABELS } from '../library/rackTypes';
import { uid } from '../model/util';
import { Field, Modal, NumberInput } from './Modal';
import { getLang, setLang } from '../i18n';

/*
 * One place for every setting. Left: topics, right: the settings of the topic. Each block says whether it belongs to
 * the project (saved in the project file) or to this browser (applies to all projects on this computer).
 */

export type SettingsTab = 'view' | 'cables' | 'racks' | 'inlays' | 'library' | 'export' | 'project';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'view', label: 'Darstellung' },
  { id: 'cables', label: 'Kabel' },
  { id: 'racks', label: 'Racks' },
  { id: 'inlays', label: 'Cases und Einlagen' },
  { id: 'library', label: 'Eigene Vorlagen' },
  { id: 'export', label: 'Export' },
  { id: 'project', label: 'Projekt' },
];

const Scope = ({ project }: { project?: boolean }) => (
  <div className="scope muted small">{project ? 'Gilt für dieses Projekt und wird in der Projektdatei gespeichert.' : 'Gilt in diesem Browser für alle Projekte.'}</div>
);

export function SettingsDialog({ tab: initial = 'view' }: { tab?: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(initial);
  const st = useStore.getState;
  return (
    <Modal wide title="Einstellungen" footer={<><span className="spacer" /><button className="btn primary" onClick={() => st().openModal(null)}>Fertig</button></>}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Einstellungen">
          {TABS.map((t) => (
            <button key={t.id} className={'list-btn' + (tab === t.id ? ' on' : '')} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <div className="settings-body">
          {tab === 'view' ? <ViewTab /> : tab === 'cables' ? <CablesTab /> : tab === 'racks' ? <RacksTab /> : tab === 'inlays' ? <InlaysTab />
            : tab === 'library' ? <LibraryTab /> : tab === 'export' ? <ExportTab /> : <ProjectTab />}
        </div>
      </div>
    </Modal>
  );
}

function ViewTab() {
  const s = useStore((x) => x.project.settings);
  const up = useStore.getState().updateSettings;
  const layout = useLayout();
  return (
    <>
      <h3>Sprache</h3>
      <div className="muted small" data-no-tr>Sprache der Oberfläche, der Exporte und der Zeichnungen. / Language of the interface, exports and drawings.</div>
      <div className="seg" data-no-tr>
        <button className={getLang() === 'de' ? 'on' : ''} onClick={() => getLang() !== 'de' && setLang('de')}>Deutsch</button>
        <button className={getLang() === 'en' ? 'on' : ''} onClick={() => getLang() !== 'en' && setLang('en')}>English</button>
      </div>
      <h3>Zeichnung der Racks</h3>
      <Scope project />
      <div className="row gap8">
        <Field label="Kabelverlauf">
          <select value={s.curveStyle} onChange={(e) => up({ curveStyle: e.target.value as typeof s.curveStyle })}>
            <option value="orthogonal">orthogonal, 90° (Übersicht)</option><option value="curved">hängend (realistisch)</option><option value="straight">direkt (Linie)</option>
          </select>
        </Field>
        <Field label="Text an den Kabeln">
          <select value={s.cableLabel} onChange={(e) => up({ cableLabel: e.target.value as typeof s.cableLabel })}>
            <option value="length">Länge</option><option value="number">Kabelnummer</option><option value="both">Nummer und Länge</option><option value="none">keiner</option>
          </select>
        </Field>
      </div>
      <label className="check"><input type="checkbox" checked={s.showPortLabels} onChange={(e) => up({ showPortLabels: e.target.checked })} /> Anschlussnamen anzeigen</label>
      <label className="check"><input type="checkbox" checked={s.showCableLabels} onChange={(e) => up({ showCableLabels: e.target.checked })} /> Kabelbeschriftung anzeigen</label>

      <h3>Seitenbereiche</h3>
      <Scope />
      <label className="check"><input type="checkbox" checked={layout.showLibrary} onChange={(e) => setLayout({ showLibrary: e.target.checked })} /> Linker Bereich (Bibliothek, Ausschnitte einfügen)</label>
      <label className="check"><input type="checkbox" checked={layout.showCableList} onChange={(e) => setLayout({ showCableList: e.target.checked })} /> Unterer Bereich (Kabelliste, Stückliste, Zuschnittliste)</label>
      <label className="check"><input type="checkbox" checked={layout.showInspector} onChange={(e) => setLayout({ showInspector: e.target.checked })} /> Rechter Bereich (Eigenschaften)</label>
      <div><button className="btn sm" onClick={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW, inspectorW: DEFAULT_LAYOUT.inspectorW, cableListH: DEFAULT_LAYOUT.cableListH })} title="Breiten und Höhen der Bereiche auf die Standardwerte setzen">Bereichsgrößen zurücksetzen</button></div>

      <h3>3D-Ansicht</h3>
      <Scope />
      <label className="check"><input type="checkbox" checked={layout.ao} onChange={(e) => setLayout({ ao: e.target.checked })} /> Kontaktschatten in Vertiefungen bei Cases und Rackgehäusen (schöner, braucht mehr Rechenleistung)</label>
      <label className="check"><input type="checkbox" checked={layout.buildDevices} onChange={(e) => setLayout({ buildDevices: e.target.checked })} /> Eingebaute Geräte im Rackgehäuse zeigen</label>
    </>
  );
}

function CablesTab() {
  const project = useStore((x) => x.project);
  const active = useStore((x) => x.activeCableTypeId);
  const s = project.settings;
  const st = useStore.getState;
  const up = st().updateSettings;
  return (
    <>
      <h3>Kabellängen</h3>
      <Scope project />
      <div className="row gap8">
        <Field label="Zuschlag (%)"><NumberInput value={s.slackPercent} min={0} max={200} onChange={(v) => up({ slackPercent: v })} /></Field>
        <Field label="Serviceschlaufe (mm)"><NumberInput value={s.serviceLoop} min={0} step={10} onChange={(v) => up({ serviceLoop: v })} /></Field>
        <Field label="Biegeweg je Ende (mm)"><NumberInput value={s.exitLength} min={0} step={5} onChange={(v) => up({ exitLength: v })} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={s.roundToStock} onChange={(e) => up({ roundToStock: e.target.checked })} /> Auf Lagerlängen des Kabeltyps aufrunden (sonst auf 0,1 m)</label>
      <div className="hint" style={{ padding: 0 }}>Länge = (Weg im Rack + Biegewege) × (1 + Zuschlag) + Serviceschlaufe.</div>

      <h3>Neue Kabel</h3>
      <Field label="Kabeltyp für neue Verbindungen">
        <select value={active} onChange={(e) => st().setActiveCableType(e.target.value)}>
          <option value="auto">automatisch nach Stecker</option>
          {project.cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <div><button className="btn sm" onClick={() => { if (confirm('Kabelnummern projektweit neu vergeben (W001 …)?')) st().renumberCables(); }} title="Alle Kabel der Reihe nach neu nummerieren">Kabel neu nummerieren</button></div>

      <h3>Kabeltypen und Farben</h3>
      <Scope project />
      <CableTypesTable />
    </>
  );
}

export function CableTypesTable() {
  const project = useStore((s) => s.project);
  const st = useStore.getState;
  const usage = (id: string) => project.racks.reduce((n, r) => n + r.cables.filter((c) => c.typeId === id).length, 0);
  const upd = (t: CableType, p: Partial<CableType>) => st().upsertCableType({ ...t, ...p });
  return (
    <>
      <div className="table-scroll">
        <table className="ct-table">
          <thead><tr><th>Farbe</th><th>Name</th><th>Signal</th><th>Strich</th><th>Lagerlängen (m)</th><th>Stecker (Zuordnung)</th><th>Kabel</th><th /></tr></thead>
          <tbody>
            {project.cableTypes.map((t) => (
              <tr key={t.id}>
                <td><input type="color" value={t.color} onChange={(e) => upd(t, { color: e.target.value })} title="Farbe" /></td>
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
                <td><input value={(t.connectors ?? []).join(', ')} onChange={(e) => upd(t, { connectors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} title="Stecker, bei denen dieser Typ automatisch gewählt wird, kommagetrennt" /></td>
                <td className="muted">{usage(t.id)}</td>
                <td><button className="icon-btn" disabled={usage(t.id) > 0} title={usage(t.id) ? 'Wird verwendet und kann nicht gelöscht werden' : 'Kabeltyp löschen'} aria-label="Löschen" onClick={() => st().deleteCableType(t.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><button className="btn sm accent" onClick={() => st().upsertCableType({ id: uid('ct-'), name: 'Neuer Kabeltyp', signal: 'other', color: '#14b8a6', width: 2, stockLengths: [0.5, 1, 2, 3, 5], custom: true })}>+ Neuer Kabeltyp</button></div>
    </>
  );
}

function LengthsInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.map((v) => String(v).replace('.', ',')).join('; '));
  return (
    <input
      value={text}
      title="Lagerlängen in m, mit Semikolon getrennt"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = text.split(/[;\s]+/).map((s) => parseFloat(s.replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
        onChange(v);
        setText(v.map((x) => String(x).replace('.', ',')).join('; '));
      }}
    />
  );
}

function RacksTab() {
  const project = useStore((x) => x.project);
  const st = useStore.getState;
  const own = project.rackTypes;
  return (
    <>
      <h3>Rackgehäuse</h3>
      <div className="muted">Das Gehäuse eines Racks konstruierst du im Arbeitsbereich <b>Rackgehäuse</b>: Felder, Tiefe, Deckel, Bauweise, Rollen.</div>
      <div><button className="btn sm" onClick={() => { st().setMode('rackbuild'); st().openModal(null); }}>Zum Arbeitsbereich Rackgehäuse</button></div>
      <h3>Eigene Rack-Typen</h3>
      <Scope project />
      {own.length ? (
        <div className="settings-list">
          {own.map((t) => (
            <div key={t.id} className="settings-row">
              <span>{t.name} <span className="muted small">{RACK_KIND_LABELS[t.kind]}, {t.outer.w} × {t.outer.h} × {t.outer.d} mm</span></span>
              <button className="btn sm danger" onClick={() => { if (confirm(`Rack-Typ „${t.name}“ löschen? Racks, die ihn verwenden, behalten ihr Gehäuse.`)) st().deleteRackType(t.id); }}>Löschen</button>
            </div>
          ))}
        </div>
      ) : <div className="muted small">Noch keine. Im Rackgehäuse-Designer unter „Notizen und Wiederverwenden“ speichern oder unten aus einer Vorlage anlegen.</div>}
      <div><button className="btn sm" onClick={() => st().openModal({ kind: 'rackTypes' })} title="Rack-Typen aus den mitgelieferten Vorlagen ableiten und bearbeiten">Rack-Typen bearbeiten …</button></div>
    </>
  );
}

function InlaysTab() {
  const layout = useLayout();
  return (
    <>
      <h3>Ausschnitte ziehen und anordnen</h3>
      <Scope />
      <div className="row gap8">
        <Field label="Raster beim Ziehen">
          <select value={layout.snap} onChange={(e) => setLayout({ snap: Number(e.target.value) })}>
            <option value={1}>1 mm</option><option value={5}>5 mm</option><option value={10}>10 mm</option>
          </select>
        </Field>
        <Field label="Abstand beim automatischen Anordnen (mm)"><NumberInput value={layout.packGap} min={0} max={80} step={5} onChange={(v) => setLayout({ packGap: Math.max(0, v) })} /></Field>
      </div>
      <div className="hint" style={{ padding: 0 }}>Beim Ziehen mit gedrückter Alt-Taste wird das Raster ignoriert.</div>
      <h3>Schaumstoff für neue Einlagen</h3>
      <Scope />
      <div className="row gap8">
        <Field label="Material">
          <select value={layout.foamMaterial} onChange={(e) => setLayout({ foamMaterial: e.target.value as typeof layout.foamMaterial })}>
            {Object.entries(FOAM_MATERIALS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Farbe"><input type="color" value={layout.foamColor} onChange={(e) => setLayout({ foamColor: e.target.value })} /></Field>
      </div>
    </>
  );
}

function LibraryTab() {
  const project = useStore((x) => x.project);
  const st = useStore.getState;
  const own = allTemplates(project).filter((t) => t.custom);
  return (
    <>
      <h3>Eigene Vorlagen</h3>
      <Scope project />
      <div className="btn-group">
        <button className="btn sm" onClick={() => st().openModal({ kind: 'device' })}>+ Gerät</button>
        <button className="btn sm" onClick={() => st().openModal({ kind: 'panel' })}>+ Rackblende</button>
        <button className="btn sm" onClick={() => st().openModal({ kind: 'box' })}>+ Split- oder Kombidose</button>
      </div>
      {own.length ? (
        <div className="settings-list">
          {own.map((t) => (
            <div key={t.id} className="settings-row">
              <span>{t.name} <span className="muted small">{t.box ? 'Dose' : t.panel ? 'Rackblende' : `${t.manufacturer || 'Gerät'}, ${t.heightU} HE`}</span></span>
              <button className="btn sm" onClick={() => st().openModal(t.box ? { kind: 'box', templateId: t.id } : t.panel ? { kind: 'panel', templateId: t.id } : { kind: 'device', templateId: t.id })}>Bearbeiten</button>
            </div>
          ))}
        </div>
      ) : <div className="muted small">Noch keine eigenen Vorlagen. Mitgelieferte Geräte lassen sich in der Bibliothek über den Stift kopieren und anpassen.</div>}
    </>
  );
}

function ExportTab() {
  const layout = useLayout();
  return (
    <>
      <h3>PDF der Bestückung</h3>
      <Scope />
      <Field label="Papierformat">
        <select value={layout.pdfFormat} onChange={(e) => setLayout({ pdfFormat: e.target.value as 'a4' | 'a3' })}>
          <option value="a3">A3 quer</option><option value="a4">A4 quer</option>
        </select>
      </Field>
      <label className="check"><input type="checkbox" checked={layout.pdfCableList} onChange={(e) => setLayout({ pdfCableList: e.target.checked })} /> Kabelliste mit Packliste</label>
      <label className="check"><input type="checkbox" checked={layout.pdfBom} onChange={(e) => setLayout({ pdfBom: e.target.checked })} /> Geräteliste</label>
      <div className="hint" style={{ padding: 0 }}>Das sind die Voreinstellungen; im Export-Dialog lässt sich jeder Export einzeln anpassen.</div>
    </>
  );
}

function ProjectTab() {
  const project = useStore((x) => x.project);
  const st = useStore.getState;
  return (
    <>
      <h3>Projekt</h3>
      <Scope project />
      <Field label="Projektname"><input value={project.name} onChange={(e) => st().mutate((p) => { p.name = e.target.value; }, 'project:name')} /></Field>
      <Field label="Ersteller oder Firma (erscheint im PDF)"><input value={project.author ?? ''} onChange={(e) => st().mutate((p) => { p.author = e.target.value; }, 'project:author')} /></Field>
      <div className="muted small">Das Projekt wird automatisch in diesem Browser gespeichert. Zum Weitergeben unter Export die Projektdatei speichern.</div>
    </>
  );
}
