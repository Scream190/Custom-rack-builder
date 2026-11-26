import { useMemo, useState } from 'react';
import { allTemplates, useActiveRack, useStore } from '../model/store';
import type { DeviceTemplate } from '../model/types';
import { rackBays } from '../model/geometry';
import { libraryDrag } from './RackCanvas';
import { Menu } from './Shell';

/** prefix of the categories holding the user's own templates (listed first) */
const CUSTOM = 'Eigene: ';
const OPEN_KEY = 'rackplanner.library.open.v1';

export function LibraryPanel() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const readOnly = useStore((s) => s.readOnly);
  const rack = useActiveRack();
  const [q, setQ] = useState('');
  // categories start closed so the list stays short; open ones are remembered
  const [openCats, setOpenCatsState] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch { return {}; } });
  const setOpenCats = (next: Record<string, boolean>) => { setOpenCatsState(next); try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } };
  const templates = useMemo(() => allTemplates(project), [project]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = templates.filter((t) =>
      !needle || `${t.manufacturer} ${t.name} ${t.category}`.toLowerCase().includes(needle),
    );
    const map = new Map<string, DeviceTemplate[]>();
    for (const t of filtered) {
      const cat = t.custom ? `${CUSTOM}${t.category}` : t.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => (a.startsWith(CUSTOM) ? -1 : b.startsWith(CUSTOM) ? 1 : a.localeCompare(b)));
  }, [templates, q]);

  const add = (t: DeviceTemplate) => (t.box ? useStore.getState().addBox(rack.id, t) : useStore.getState().addDeviceAuto(rack.id, t, view === 'rear' ? 'rear' : 'front'));

  return (
    <aside className="panel library">
      <div className="panel-head">
        <strong>Bibliothek</strong>
        {!readOnly ? (
          <Menu label="+ Eigene" className="sm accent" align="right" title="Eigene Vorlage anlegen">
            <button onClick={() => useStore.getState().openModal({ kind: 'device' })}>Gerät mit Anschlüssen …</button>
            <button onClick={() => useStore.getState().openModal({ kind: 'panel' })}>Rackblende (Blenden-Designer) …</button>
            <button onClick={() => useStore.getState().openModal({ kind: 'box' })}>Split- oder Kombidose …</button>
          </Menu>
        ) : null}
      </div>
      <input className="search" placeholder={`${templates.length} Vorlagen durchsuchen`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Bibliothek durchsuchen"
        title="Zum Einbauen eine Vorlage in das Rack ziehen oder doppelklicken" />
      {Object.values(openCats).some(Boolean) && !q.trim() ? (
        <div className="lib-tools"><button className="link-btn small" onClick={() => setOpenCats({})} title="Alle Kategorien zuklappen">Alle zuklappen</button></div>
      ) : null}
      <div className="lib-list">
        {groups.map(([cat, items]) => (
          <div key={cat} className="lib-group">
            <button className="lib-cat" aria-expanded={!!openCats[cat] || !!q.trim()} onClick={() => setOpenCats({ ...openCats, [cat]: !openCats[cat] })} title={openCats[cat] ? 'Kategorie zuklappen' : 'Kategorie aufklappen'}>
              <span>{openCats[cat] || q.trim() ? '▾' : '▸'} {cat}</span>
              <span className="muted">{items.length}</span>
            </button>
            {(openCats[cat] || !!q.trim()) &&
              items.map((t) => (
                <div
                  key={t.id}
                  className={'lib-item' + (!t.box && !rackBays(rack.type).some((b) => b.rackStandard === t.rackStandard) ? ' incompatible' : '')}
                  draggable
                  onDragStart={(e) => {
                    libraryDrag.tpl = t;
                    e.dataTransfer.setData('text/plain', t.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => { libraryDrag.tpl = null; }}
                  onDoubleClick={() => add(t)}
                  title={t.notes || `${t.manufacturer} ${t.name}`}
                >
                  <div className="swatch" style={{ background: t.color, height: 6 + t.heightU * 6 }} />
                  <div className="lib-text">
                    <div className="lib-name">{t.name}</div>
                    <div className="muted small">
                      {t.box ? `${t.box.kind === 'split' ? 'Splitdose' : 'Kombidose'}, ${t.ports.length} Anschlüsse` : [t.manufacturer, `${t.heightU} HE`, t.slots > 1 ? `1/${t.slots} Breite` : '', t.rackStandard === 10 ? '10"' : '', `${t.depth} mm`].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    title={t.panel ? 'Blende bearbeiten' : t.custom ? 'Vorlage bearbeiten' : 'Als eigene Vorlage kopieren und bearbeiten'}
                    aria-label="Vorlage bearbeiten"
                    onClick={() => useStore.getState().openModal(t.box ? { kind: 'box', templateId: t.id } : t.panel ? { kind: 'panel', templateId: t.id } : { kind: 'device', templateId: t.id })}
                  >✎</button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
