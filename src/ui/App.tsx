import { useEffect, useRef } from 'react';
import { allRackTypes, libraryUpdate, useActiveRack, useStore, type ViewMode } from '../model/store';
import { LibraryPanel } from './LibraryPanel';
import { Inspector } from './Inspector';
import { CableList } from './CableList';
import { Viewport2D } from './Viewport2D';
import { ErrorBoundary } from './ErrorBoundary';
import { RfImportDialog } from './RfDialogs';
import { parseRfFile } from '../integration/rf';
import { NavBar } from './NavBar';
import { Splitter } from './Splitter';
import { DEFAULT_LAYOUT, getLayout, setLayout, useLayout } from '../model/layout';
import { DeviceEditor } from './DeviceEditor';
import { PanelDesigner } from './PanelDesigner';
import { BoxEditor } from './BoxEditor';
import { CaseWorkspace, openDrawerInlay, projectDrawers } from './CaseWorkspace';
import { InlayWorkspace } from './InlayWorkspace';
import { RackBuildWorkspace } from './RackBuildWorkspace';
import { CableWorkspace } from './CableWorkspace';
import { newCustomCable } from '../model/cableBuild';
import { Menu, MenuCheck, ObjectBar, Seg, ShowMenu, ToolGroup, Toolbar } from './Shell';
import { caseList, inlayList, newFreeInlay } from '../model/inlay';
import type { AppMode } from '../model/store';
import { newCase } from '../model/cases';
import { rackSizeLabel } from '../model/geometry';
import { ExportDialog, RackTypeEditor } from './Dialogs';
import { SettingsDialog } from './SettingsDialog';
import { Rack3D } from '../three/Rack3D';
import { sampleProject } from '../library/sample';
import type { Project } from '../model/types';

const VIEWS: { id: ViewMode; label: string; title: string }[] = [
  { id: 'front', label: 'Vorne', title: 'Rack von vorne' },
  { id: 'rear', label: 'Hinten', title: 'Rack von hinten' },
  { id: 'both', label: 'Vorne + Hinten', title: 'Vorder- und Rückseite nebeneinander' },
  { id: '3d', label: '3D', title: 'Räumliche Ansicht mit Kabelführung' },
];

const MODES: { id: AppMode; label: string; title: string }[] = [
  { id: 'racks', label: 'Racks bestücken', title: 'Geräte einbauen, verkabeln, Kabelliste' },
  { id: 'cables', label: 'Kabel', title: 'Kabel bauen: Bauanleitung, Pinbelegung, Steckerbedarf, eigene Kabel' },
  { id: 'rackbuild', label: 'Rackgehäuse', title: 'Rackgehäuse konstruieren: Einbaufelder, Tiefe, Deckel, Bauweise, Griffe, Rollen' },
  { id: 'cases', label: 'Flightcases', title: 'Flightcases konstruieren: Maße, Deckel, Beschläge, Rollen' },
  { id: 'inlays', label: 'Einlagen', title: 'Schaumstoff-Einlagen mit Ausschnitten für Schubladen, Cases und andere Behälter' },
];

export function App() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const readOnly = useStore((s) => s.readOnly);
  const modal = useStore((s) => s.modal);
  const toast = useStore((s) => s.toast);
  const layout = useLayout();
  const pending = useStore((s) => s.pendingPort);
  const activeCableTypeId = useStore((s) => s.activeCableTypeId);
  const hover = useStore((s) => s.hoverCableId);
  const selection = useStore((s) => s.selection);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const rack = useActiveRack();
  const mode = useStore((s) => s.mode);
  const activeCaseId = useStore((s) => s.activeCaseId);
  const activeInlayId = useStore((s) => s.activeInlayId);
  const st = useStore.getState;
  const fileInput = useRef<HTMLInputElement>(null);
  const rfInput = useRef<HTMLInputElement>(null);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select') || st().modal) return;
      const s = st();
      if (e.key === 'Escape') { s.setPendingPort(null); s.select(null); s.setNavMode('select'); }
      if (s.readOnly) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); s.redo(); }
      else if (mod && e.key.toLowerCase() === 'd' && s.selection?.kind === 'device') { e.preventDefault(); s.duplicateDevice(s.activeRackId, s.selection.id); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection) {
        e.preventDefault();
        if (s.selection.kind === 'device') s.removeDevice(s.activeRackId, s.selection.id);
        else if (s.selection.kind === 'caseItem') { const c = s.project.cases?.find((x) => x.id === (s.mode === 'inlays' ? s.activeInlayId : s.activeCaseId)); if (c) s.removeCaseItem(c.id, s.selection.id); }
        else if (s.selection.kind === 'box') s.removeBox(s.activeRackId, s.selection.id);
        else s.removeCable(s.activeRackId, s.selection.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);

  const openFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Project;
      if (!data.racks) throw new Error('Keine gültige RackPlanner-Datei');
      libraryUpdate.updated = 0;
      libraryUpdate.droppedCables = 0;
      st().setProject(data, true);
      st().showToast(`„${data.name}“ geladen` + (libraryUpdate.updated
        ? ` – ${libraryUpdate.updated} Gerätevorlagen aktualisiert` + (libraryUpdate.droppedCables ? `, ${libraryUpdate.droppedCables} Kabel neu stecken` : '')
        : ''));
    } catch (e) {
      st().showToast((e as Error).message, 'error');
    }
  };

  const highlightCable = hover ?? (selection?.kind === 'cable' ? selection.id : null);
  const cases = caseList(project);
  const curCase = cases.find((c) => c.id === activeCaseId) ?? cases[0];
  const inlays = inlayList(project);
  const curInlay = inlays.find((c) => c.id === activeInlayId) ?? inlays[0];
  const drawers = projectDrawers(project);

  return (
    <div className={'app' + (readOnly ? ' viewer' : '')}>
      <header className="topbar">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect x="3" y="2" width="18" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M6 7h12M6 12h12M6 17h12" stroke="#22d3ee" strokeWidth="2" /></svg>
          <span>RackPlanner</span>
        </div>
        {readOnly ? <span className="project-name ro">{project.name}</span> : (
          <input className="project-name" value={project.name} onChange={(e) => st().mutate((p) => { p.name = e.target.value; }, 'project:name')} title="Projektname" aria-label="Projektname" />
        )}
        {!readOnly ? (
          <div className="menu-group">
            <Menu label="Datei" title="Projekt anlegen, öffnen, importieren, speichern">
              <button onClick={() => { if (confirm('Neues leeres Projekt beginnen? (Rückgängig möglich)')) st().newProject(); }}>Neues Projekt</button>
              <button onClick={() => fileInput.current?.click()}>Projekt öffnen …</button>
              <button onClick={() => st().openModal({ kind: 'export' })}>Speichern und exportieren …</button>
              <hr />
              <button onClick={() => rfInput.current?.click()}>Aus RF Frequency Manager importieren …</button>
              <button onClick={() => st().setProject(sampleProject(), true)}>Beispielprojekt laden (UHF-Rack)</button>
            </Menu>
            <div className="btn-group">
              <button className="btn icon" disabled={!canUndo} onClick={() => st().undo()} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
              <button className="btn icon" disabled={!canRedo} onClick={() => st().redo()} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
            </div>
          </div>
        ) : <span className="badge">Nur-Ansicht</span>}
        <nav className="modes" aria-label="Arbeitsbereich">
          {MODES.map((m) => (
            <button key={m.id} className={'mode' + (mode === m.id ? ' on' : '')} aria-current={mode === m.id ? 'page' : undefined} onClick={() => st().setMode(m.id)} title={m.title}>{m.label}</button>
          ))}
        </nav>
        <span className="spacer" />
        {!readOnly ? <button className="btn" onClick={() => st().openModal({ kind: 'settings' })} title="Alle Einstellungen: Darstellung, Kabel, Racks, Cases und Einlagen, Export, Projekt">Einstellungen</button> : null}
        <button className="btn primary big" onClick={() => st().openModal({ kind: 'export' })} title="PDF, Zeichnungen, DXF, Projektdatei">Export</button>
        <input ref={rfInput} type="file" accept=".rfse,.rfreq,.json,.txt" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { st().openModal({ kind: 'rfImport', data: parseRfFile(await f.text()) }); } catch (err) { st().showToast((err as Error).message, 'error'); }
        }} />
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      </header>

      {mode === 'racks' ? (
        <>
          <ObjectBar noun="Rack" activeId={rack.id} onSelect={(id) => st().setActiveRack(id)}
            tabs={project.racks.map((r) => ({ id: r.id, label: r.name, sub: rackSizeLabel(r.type) }))}
            newButton={<button className="btn sm accent" onClick={() => st().addRack(allRackTypes(project).find((t) => t.id === rack.type.id) ?? rack.type)} title="Neues leeres Rack mit dem gleichen Gehäuse anlegen">+ Neues Rack</button>}
            onDuplicate={() => st().duplicateRack(rack.id)}
            onDelete={project.racks.length > 1 ? () => { if (confirm(`„${rack.name}“ löschen?`)) st().removeRack(rack.id); } : undefined}
            deleteHint="Das letzte Rack kann nicht gelöscht werden." />
          <main className="workspace">
            {!readOnly && layout.showLibrary ? (
              <>
                <div className="col" style={{ width: layout.libraryW }}><LibraryPanel /></div>
                <Splitter dir="x" value={layout.libraryW} min={180} max={560} onChange={(v) => setLayout({ libraryW: v })} onReset={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW })} />
              </>
            ) : null}
            <section className="center">
              <Toolbar>
                <ToolGroup>
                  <Seg value={view} onChange={(v) => st().setView(v)} options={VIEWS} />
                </ToolGroup>
                {!readOnly ? (
                  <ToolGroup>
                    <select className="tool-select" value={activeCableTypeId} onChange={(e) => st().setActiveCableType(e.target.value)} title="Kabeltyp für neue Verbindungen. Kabel ziehen: Anschluss anklicken, dann Zielanschluss.">
                      <option value="auto">Neue Kabel: Typ nach Stecker</option>
                      {project.cableTypes.map((t) => <option key={t.id} value={t.id}>Neue Kabel: {t.name}</option>)}
                    </select>
                  </ToolGroup>
                ) : null}
                <span className="spacer" />
                <ShowMenu library="Bibliothek" list="Kabelliste">
                  <MenuCheck checked={project.settings.showPortLabels} onChange={(v) => st().updateSettings({ showPortLabels: v })}>Anschlussnamen</MenuCheck>
                  <MenuCheck checked={project.settings.showCableLabels} onChange={(v) => st().updateSettings({ showCableLabels: v })}>Kabelbeschriftung</MenuCheck>
                </ShowMenu>
              </Toolbar>
              {pending ? <div className="cabling-banner">Kabel ziehen: Zielanschluss anklicken. <kbd>Esc</kbd> bricht ab.</div> : null}
              <div className="stage">
                <ErrorBoundary resetKey={view + rack.id}>
                  {view === '3d' ? (
                    <Rack3D project={project} rack={rack} highlightCableId={highlightCable} />
                  ) : (
                    <Viewport2D views={view === 'both' ? ['front', 'rear'] : [view]} />
                  )}
                </ErrorBoundary>
                <NavBar is3d={view === '3d'} />
              </div>
              {layout.showCableList ? (
                <>
                  {!layout.cableListCollapsed ? <Splitter dir="y" sign={-1} value={layout.cableListH} min={80} max={900} onChange={(v) => setLayout({ cableListH: v })} onReset={() => setLayout({ cableListH: DEFAULT_LAYOUT.cableListH })} /> : null}
                  <div className="cable-list-wrap" style={{ height: layout.cableListCollapsed ? 'auto' : layout.cableListH }}><CableList /></div>
                </>
              ) : null}
            </section>
            {layout.showInspector ? (
              <>
                <Splitter dir="x" sign={-1} value={layout.inspectorW} min={220} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
                <div className="col" style={{ width: layout.inspectorW }}><Inspector /></div>
              </>
            ) : null}
          </main>
        </>
      ) : mode === 'cables' ? (
        <>
          <ObjectBar noun="Kabel" activeId={null} onSelect={() => {}} tabs={[]}
            emptyText={`${project.racks.reduce((n, r) => n + r.cables.length, 0)} Kabel in ${project.racks.length} ${project.racks.length === 1 ? 'Rack' : 'Racks'}, ${project.customCables?.length ?? 0} eigene Kabelarten`}
            newButton={<button className="btn sm accent" onClick={() => st().addCustomCable(newCustomCable(project, `Kabel ${(project.customCables?.length ?? 0) + 1}`))} title="Kabel mit beliebigen Steckern, Länge und Belegung anlegen">+ Eigenes Kabel</button>} />
          <CableWorkspace />
        </>
      ) : mode === 'rackbuild' ? (
        <>
          <ObjectBar noun="Rack" activeId={rack.id} onSelect={(id) => st().setActiveRack(id)}
            tabs={project.racks.map((r) => ({ id: r.id, label: r.name, sub: rackSizeLabel(r.type) }))}
            newButton={<button className="btn sm accent" onClick={() => st().addRack(allRackTypes(project).find((t) => t.id === rack.type.id) ?? rack.type)} title="Neues leeres Rack mit dem gleichen Gehäuse anlegen">+ Neues Rack</button>}
            onDuplicate={() => st().duplicateRack(rack.id)}
            onDelete={project.racks.length > 1 ? () => { if (confirm(`„${rack.name}“ löschen?`)) st().removeRack(rack.id); } : undefined}
            deleteHint="Das letzte Rack kann nicht gelöscht werden." />
          <RackBuildWorkspace />
        </>
      ) : mode === 'cases' ? (
        <>
          <ObjectBar noun="Case" activeId={curCase?.id ?? null} onSelect={(id) => st().setActiveCase(id)} emptyText="Noch kein Case angelegt."
            tabs={cases.map((c) => ({ id: c.id, label: c.name, sub: `${c.inner.l} × ${c.inner.w} × ${c.inner.h}` }))}
            newButton={<button className="btn sm accent" onClick={() => st().addCase(newCase(`Case ${cases.length + 1}`))} title="Neues Flightcase mit Standardmaßen anlegen">+ Neues Case</button>}
            onDuplicate={curCase ? () => st().duplicateCase(curCase.id) : undefined}
            onDelete={curCase ? () => { if (confirm(`„${curCase.name}“ samt Einlage löschen?`)) st().removeCase(curCase.id); } : undefined} />
          <CaseWorkspace />
        </>
      ) : (
        <>
          <ObjectBar noun="Einlage" activeId={curInlay?.id ?? null} onSelect={(id) => st().setActiveInlay(id)} emptyText="Noch keine Einlage angelegt."
            tabs={inlays.map((c) => ({ id: c.id, label: c.name, sub: c.kind === 'drawer' ? 'Schublade' : c.kind === 'inlay' ? 'frei' : 'Case' }))}
            newButton={!readOnly ? (
              <Menu label="+ Neue Einlage" className="sm accent" title="Neue Einlage für eine Schublade oder einen beliebigen Behälter" align="right">
                <button onClick={() => st().addCase({ ...newFreeInlay(`Einlage ${inlays.filter((c) => c.kind === 'inlay').length + 1}`), foam: { bottom: 10, lid: 0, sides: 15, color: getLayout().foamColor, material: getLayout().foamMaterial } })}>Für einen beliebigen Behälter (eigene Innenmaße)</button>
                {drawers.length ? <><hr /><div className="menu-head">Für eine Rackschublade</div></> : null}
                {drawers.map((x) => (
                  <button key={x.device.id} onClick={() => openDrawerInlay(project, x.rack.id, x.device.id)}>{x.device.label || x.tpl.name} ({x.rack.name}, HE {x.device.u})</button>
                ))}
                {cases.length ? <><hr /><div className="menu-note">Jedes Flightcase hat seine Einlage schon in der Liste.</div></> : null}
              </Menu>
            ) : undefined}
            onDuplicate={curInlay && curInlay.kind && curInlay.kind !== 'case' ? () => st().duplicateCase(curInlay.id) : undefined}
            onDelete={curInlay && curInlay.kind && curInlay.kind !== 'case' ? () => { if (confirm(`Einlage „${curInlay.name}“ löschen?`)) st().removeCase(curInlay.id); } : undefined}
            deleteHint="Diese Einlage gehört zu einem Flightcase. Das Case löschst du unter „Flightcases“." />
          <InlayWorkspace />
        </>
      )}

      {modal?.kind === 'device' ? <DeviceEditor key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'panel' ? <PanelDesigner key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'box' ? <BoxEditor key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'rackTypes' ? <RackTypeEditor /> : null}
      {modal?.kind === 'cableTypes' ? <SettingsDialog tab="cables" /> : null}
      {modal?.kind === 'settings' ? <SettingsDialog tab={modal.tab} /> : null}
      {modal?.kind === 'export' ? <ExportDialog /> : null}
      {modal?.kind === 'rfImport' ? <RfImportDialog data={modal.data} /> : null}
      {toast ? <div className={'toast ' + toast.kind}>{toast.text}</div> : null}
    </div>
  );
}
