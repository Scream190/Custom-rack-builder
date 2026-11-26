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
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { DeviceEditor } from './DeviceEditor';
import { PanelDesigner } from './PanelDesigner';
import { BoxEditor } from './BoxEditor';
import { CaseWorkspace, openDrawerInlay, projectDrawers } from './CaseWorkspace';
import { newCase } from '../model/cases';
import { rackSizeLabel } from '../model/geometry';
import { CableTypeEditor, ExportDialog, RackTypeEditor, SettingsDialog } from './Dialogs';
import { Rack3D } from '../three/Rack3D';
import { sampleProject } from '../library/sample';
import type { Project } from '../model/types';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'front', label: 'Vorne' },
  { id: 'rear', label: 'Hinten' },
  { id: 'both', label: 'Vorne + Hinten' },
  { id: '3d', label: '3D' },
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
        else if (s.selection.kind === 'caseItem') { const c = s.project.cases?.find((x) => x.id === s.activeCaseId) ?? s.project.cases?.[0]; if (c) s.removeCaseItem(c.id, s.selection.id); }
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

  return (
    <div className={'app' + (readOnly ? ' viewer' : '')}>
      <header className="topbar">
        <div className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect x="3" y="2" width="18" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M6 7h12M6 12h12M6 17h12" stroke="#22d3ee" strokeWidth="2" /></svg>
          <span>RackPlanner</span>
        </div>
        {readOnly ? <span className="project-name ro">{project.name}</span> : (
          <input className="project-name" value={project.name} onChange={(e) => st().mutate((p) => { p.name = e.target.value; }, 'project:name')} />
        )}
        {!readOnly ? (
          <div className="menu-group">
            <details className="menu">
              <summary className="btn">Datei ▾</summary>
              <div className="menu-pop" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                <button onClick={() => { if (confirm('Neues leeres Projekt beginnen? (Rückgängig möglich)')) st().newProject(); }}>Neues Projekt</button>
                <button onClick={() => fileInput.current?.click()}>Projekt öffnen …</button>
                <button onClick={() => rfInput.current?.click()}>Aus RF Frequency Manager importieren …</button>
                <button onClick={() => st().openModal({ kind: 'export' })}>Speichern / Exportieren …</button>
                <hr />
                <button onClick={() => st().setProject(sampleProject(), true)}>Beispielprojekt laden (UHF-Rack)</button>
                <button onClick={() => st().openModal({ kind: 'settings' })}>Projekt-Einstellungen …</button>
              </div>
            </details>
            <details className="menu">
              <summary className="btn">Bibliotheken ▾</summary>
              <div className="menu-pop" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
                <button onClick={() => st().openModal({ kind: 'device' })}>Neues Gerät …</button>
                <button onClick={() => st().openModal({ kind: 'box' })}>Split- oder Kombidose …</button>
                <button onClick={() => st().openModal({ kind: 'panel' })}>Blenden-Designer …</button>
                <button onClick={() => st().openModal({ kind: 'rackTypes' })}>Rack-Typen …</button>
                <button onClick={() => st().openModal({ kind: 'cableTypes' })}>Kabeltypen & Farben …</button>
              </div>
            </details>
            <button className="btn icon" disabled={!canUndo} onClick={() => st().undo()} title="Rückgängig (Strg+Z)">↶</button>
            <button className="btn icon" disabled={!canRedo} onClick={() => st().redo()} title="Wiederholen (Strg+Y)">↷</button>
          </div>
        ) : <span className="badge">Nur-Ansicht</span>}
        <div className="seg">
          <button className={mode === 'racks' ? 'on' : ''} onClick={() => st().setMode('racks')}>Racks</button>
          <button className={mode === 'cases' ? 'on' : ''} onClick={() => st().setMode('cases')}>Cases</button>
        </div>
        {mode === 'racks' ? (
          <div className="seg">
            {VIEWS.map((v) => (
              <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => st().setView(v.id)}>{v.label}</button>
            ))}
          </div>
        ) : null}
        {!readOnly && mode === 'racks' ? (
          <label className="cable-pick" title="Kabeltyp für neue Verbindungen">
            <span>Kabel:</span>
            <select value={activeCableTypeId} onChange={(e) => st().setActiveCableType(e.target.value)}>
              <option value="auto">Automatisch (nach Stecker)</option>
              {project.cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ) : null}
        <span className="spacer" />
        <button className="btn primary" onClick={() => st().openModal({ kind: 'export' })}>Export</button>
        <input ref={rfInput} type="file" accept=".rfse,.rfreq,.json,.txt" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { st().openModal({ kind: 'rfImport', data: parseRfFile(await f.text()) }); } catch (err) { st().showToast((err as Error).message, 'error'); }
        }} />
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      </header>

      {mode === 'racks' ? (
        <>
      <div className="rack-tabs">
        {project.racks.map((r) => (
          <button key={r.id} className={'tab' + (r.id === rack.id ? ' on' : '')} onClick={() => st().setActiveRack(r.id)}>
            {r.name} <span className="muted small">{rackSizeLabel(r.type)}</span>
          </button>
        ))}
        <span className="spacer" />
        <div className="panel-toggles" title="Bereiche ein-/ausblenden">
          {!readOnly ? <button className={'tgl' + (layout.showLibrary ? ' on' : '')} onClick={() => setLayout({ showLibrary: !layout.showLibrary })}>Bibliothek</button> : null}
          <button className={'tgl' + (layout.showCableList ? ' on' : '')} onClick={() => setLayout({ showCableList: !layout.showCableList })}>Kabelliste</button>
          <button className={'tgl' + (layout.showInspector ? ' on' : '')} onClick={() => setLayout({ showInspector: !layout.showInspector })}>Eigenschaften</button>
        </div>
        {!readOnly ? (
          <>
            <button className="tab add" onClick={() => st().addRack(allRackTypes(project).find((t) => t.id === rack.type.id) ?? rack.type)} title="Rack hinzufügen">+ Rack</button>
            <button className="btn sm" onClick={() => st().duplicateRack(rack.id)}>Rack duplizieren</button>
            <button className="btn sm danger" onClick={() => { if (confirm(`„${rack.name}“ löschen?`)) st().removeRack(rack.id); }}>Rack löschen</button>
          </>
        ) : null}
      </div>

      <main className="workspace">
        {!readOnly && layout.showLibrary ? (
          <>
            <div className="col" style={{ width: layout.libraryW }}><LibraryPanel /></div>
            <Splitter dir="x" value={layout.libraryW} min={180} max={560} onChange={(v) => setLayout({ libraryW: v })} onReset={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW })} />
          </>
        ) : null}
        <section className="center">
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
      ) : (
        <>
      <div className="rack-tabs">
        {(project.cases ?? []).map((c) => (
          <button key={c.id} className={'tab' + (c.id === (activeCaseId ?? project.cases?.[0]?.id) ? ' on' : '')} onClick={() => st().setActiveCase(c.id)}>
            {c.name} <span className="muted small">{c.kind === 'drawer' ? 'Schublade' : `${c.inner.l} × ${c.inner.w} × ${c.inner.h}`}</span>
          </button>
        ))}
        <span className="spacer" />
        <div className="panel-toggles" title="Bereiche ein-/ausblenden">
          {!readOnly ? <button className={'tgl' + (layout.showLibrary ? ' on' : '')} onClick={() => setLayout({ showLibrary: !layout.showLibrary })}>Inhalt</button> : null}
          <button className={'tgl' + (layout.showCableList ? ' on' : '')} onClick={() => setLayout({ showCableList: !layout.showCableList })}>Stückliste</button>
          <button className={'tgl' + (layout.showInspector ? ' on' : '')} onClick={() => setLayout({ showInspector: !layout.showInspector })}>Eigenschaften</button>
        </div>
        {!readOnly ? (
          <>
            <button className="tab add" onClick={() => st().addCase(newCase(`Case ${(project.cases?.length ?? 0) + 1}`))}>+ Case</button>
            {projectDrawers(project).length ? (
              <select className="btn sm" value="" onChange={(e) => { const [r, d] = e.target.value.split('|'); if (r) openDrawerInlay(project, r, d); }}>
                <option value="">+ Schubladen-Einlage …</option>
                {projectDrawers(project).map((x) => <option key={x.device.id} value={`${x.rack.id}|${x.device.id}`}>{x.device.label || x.tpl.name} ({x.rack.name}, HE {x.device.u})</option>)}
              </select>
            ) : null}
            {project.cases?.length ? (() => {
              const cur = project.cases.find((c) => c.id === activeCaseId) ?? project.cases[0];
              return (
                <>
                  <button className="btn sm" onClick={() => st().duplicateCase(cur.id)}>Case duplizieren</button>
                  <button className="btn sm danger" onClick={() => { if (confirm(`„${cur.name}“ löschen?`)) st().removeCase(cur.id); }}>Case löschen</button>
                </>
              );
            })() : null}
          </>
        ) : null}
      </div>
          <CaseWorkspace />
        </>
      )}

      {modal?.kind === 'device' ? <DeviceEditor key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'panel' ? <PanelDesigner key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'box' ? <BoxEditor key={modal.templateId ?? 'new'} templateId={modal.templateId} /> : null}
      {modal?.kind === 'rackTypes' ? <RackTypeEditor /> : null}
      {modal?.kind === 'cableTypes' ? <CableTypeEditor /> : null}
      {modal?.kind === 'settings' ? <SettingsDialog /> : null}
      {modal?.kind === 'export' ? <ExportDialog /> : null}
      {modal?.kind === 'rfImport' ? <RfImportDialog data={modal.data} /> : null}
      {toast ? <div className={'toast ' + toast.kind}>{toast.text}</div> : null}
    </div>
  );
}
