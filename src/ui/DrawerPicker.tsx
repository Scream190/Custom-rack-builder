import { useMemo, useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { DeviceTemplate } from '../model/types';
import { drawerInner, newDrawerInlay } from '../model/cases';
import { getLayout } from '../model/layout';
import { Modal } from './Modal';

/** pick a rack drawer template for a new drawer inlay (inner size from the manufacturer where known) */
export function DrawerPicker() {
  const project = useStore((s) => s.project);
  const [q, setQ] = useState('');
  const [u, setU] = useState<number | 0>(0);
  const drawers = useMemo(() => allTemplates(project).filter((t) => t.drawer), [project]);
  const sizes = [...new Set(drawers.map((t) => t.heightU))].sort((a, b) => a - b);
  const hits = drawers.filter((t) => (!u || t.heightU === u) && `${t.manufacturer} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const brands = [...new Set(hits.map((t) => t.manufacturer))].sort((a, b) => (a === 'Generisch' ? 1 : b === 'Generisch' ? -1 : a.localeCompare(b)));
  const pick = (t: DeviceTemplate) => {
    const st = useStore.getState();
    const n = (st.project.cases ?? []).filter((c) => c.kind === 'drawer').length + 1;
    const c = newDrawerInlay(`Einlage ${t.manufacturer === 'Generisch' ? '' : `${t.manufacturer} `}${t.name}`.replace(/\s+/g, ' ').trim() || `Schublade ${n}`, t, null, []);
    c.foam = { ...c.foam, color: getLayout().foamColor, material: getLayout().foamMaterial };
    st.addCase(c);
    st.setActiveInlay(c.id);
    st.openModal(null);
  };
  return (
    <Modal title="Einlage für eine Rackschublade" wide>
      <div className="row gap8 wrap">
        <input placeholder="Hersteller oder Modell suchen" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} autoFocus />
        <div className="seg">
          <button className={u === 0 ? 'on' : ''} onClick={() => setU(0)}>Alle</button>
          {sizes.map((s) => <button key={s} className={u === s ? 'on' : ''} onClick={() => setU(s)}>{s} HE</button>)}
        </div>
      </div>
      <div className="muted small">Innenmaß als Breite × Tiefe × Höhe. Bei Herstellerangaben steht „laut Hersteller“, sonst ist es aus der Bauhöhe geschätzt und sollte nachgemessen werden.</div>
      {brands.map((b) => (
        <div key={b} className="tile-group">
          <div className="tile-group-head">{b}</div>
          <div className="drawer-grid">
            {hits.filter((t) => t.manufacturer === b).map((t) => {
              const inner = drawerInner(t);
              return (
                <button key={t.id} className="drawer-tile" onClick={() => pick(t)} title={t.source ?? 'Innenmaß aus der Bauhöhe geschätzt'}>
                  <span className="drawer-tile-u">{t.heightU} HE</span>
                  <span className="tile-name">{t.name}</span>
                  <span className="tile-dim">{inner.l} × {inner.w} × {inner.h} mm</span>
                  <span className="muted small">{!t.drawerInner ? 'geschätzt' : t.drawerInner.hEstimated ? 'laut Hersteller, Höhe geschätzt' : 'laut Hersteller'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!hits.length ? <div className="hint">Keine Schublade gefunden.</div> : null}
    </Modal>
  );
}
