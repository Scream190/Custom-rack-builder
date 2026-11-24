import { useMemo, useState } from 'react';
import { allTemplates, useActiveRack, useStore } from '../model/store';
import type { DeviceTemplate } from '../model/types';
import { libraryDrag } from './RackCanvas';

/** prefix of the categories holding the user's own templates (listed first) */
const CUSTOM = 'Eigene: ';

export function LibraryPanel() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const rack = useActiveRack();
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
        <div className="row gap4">
          <button className="btn sm" title="Neues Gerät anlegen" onClick={() => useStore.getState().openModal({ kind: 'device' })}>+ Gerät</button>
          <button className="btn sm" title="Neue Rackblende entwerfen" onClick={() => useStore.getState().openModal({ kind: 'panel' })}>+ Blende</button>
          <button className="btn sm" title="Neue Split- oder Kombidose anlegen" onClick={() => useStore.getState().openModal({ kind: 'box' })}>+ Dose</button>
        </div>
      </div>
      <input className="search" placeholder="Suchen (z. B. Shure, BNC, Splitter) …" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="hint row" style={{ justifyContent: 'space-between' }}>
        <span>In das Rack ziehen oder doppelklicken.</span>
        <button
          className="btn sm"
          title="Alle Kategorien auf- bzw. zuklappen"
          onClick={() => {
            const allClosed = groups.every(([c]) => collapsed[c]);
            setCollapsed(Object.fromEntries(groups.map(([c]) => [c, !allClosed])));
          }}
        >
          {groups.length && groups.every(([c]) => collapsed[c]) ? 'Alle auf' : 'Alle zu'}
        </button>
      </div>
      <div className="lib-list">
        {groups.map(([cat, items]) => (
          <div key={cat} className="lib-group">
            <button className="lib-cat" onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}>
              <span>{collapsed[cat] ? '▸' : '▾'} {cat}</span>
              <span className="muted">{items.length}</span>
            </button>
            {(!collapsed[cat] || !!q.trim()) &&
              items.map((t) => (
                <div
                  key={t.id}
                  className={'lib-item' + (t.rackStandard !== rack.type.rackStandard ? ' incompatible' : '')}
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
                    title={t.panel ? 'Blende bearbeiten' : t.custom ? 'Bearbeiten' : 'Als eigene Vorlage kopieren und bearbeiten'}
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
