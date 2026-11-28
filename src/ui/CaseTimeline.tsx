import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../model/store';
import type { FlightCase } from '../model/types';
import { deleteStep, describeSteps, setMarker, timelineMarker, toggleStep, type StepKind } from '../model/timeline';
import type { CaseEdit } from '../three/Case3D';

const st = useStore.getState;

/** small glyphs per kind of step (16 × 16, stroked) */
const GLYPH: Record<StepKind, ReactNode> = {
  type: <><rect x="2.5" y="5" width="11" height="8" rx="1" /><path d="M2.5 8h11M6 5V3.5h4V5" /></>,
  size: <><path d="M2 13h12M2 11v4M14 11v4M3 3l4 4M3 3h3M3 3v3M13 3l-4 4M13 3h-3M13 3v3" /></>,
  lid: <><rect x="2.5" y="8" width="11" height="5.5" rx="1" /><path d="M2 5.5l6-2.5 6 2.5" /></>,
  door: <><rect x="3" y="2.5" width="10" height="11" rx="1" /><path d="M8 2.5v11M10.5 8h.5" /></>,
  drawer: <><rect x="2.5" y="3" width="11" height="10" rx="1" /><path d="M2.5 8h11M7 5.5h2M7 10.5h2" /></>,
  divider: <><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M2.5 8h11" /></>,
  hardware: <><rect x="4" y="5" width="8" height="6" rx="1.5" /><path d="M6 8h4M8 3v2M8 11v2" /></>,
  build: <><path d="M3 13V3h10" /><path d="M5.5 13V5.5H13" /></>,
  color: <><circle cx="8" cy="8" r="5" /><path d="M8 3v10M3 8h5" /></>,
  castor: <><circle cx="8" cy="10" r="3" /><path d="M5 3h6M8 3v4" /></>,
  param: <><path d="M5 13c1.5 0 2-1 2.4-3l1.2-5C9 3 9.5 2.5 11 2.5M4.5 7h6" /></>,
  rack: <><path d="M4 2.5v11M12 2.5v11M4 5h8M4 8h8M4 11h8" /></>,
  object: <><path d="M8 2.5 13.5 5.5v5L8 13.5 2.5 10.5v-5Z" /><path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" /></>,
  other: <><circle cx="8" cy="8" r="1.2" /><circle cx="4" cy="8" r="1.2" /><circle cx="12" cy="8" r="1.2" /></>,
};
const Glyph = ({ k }: { k: StepKind }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{GLYPH[k]}</svg>;
const Nav = ({ d }: { d: string }) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

const TILE = 30; // tile width incl. gap (px), used for dragging the marker

/**
 * Timeline of a flight case like in parametric CAD: one tile per step, the marker after the last active step.
 * Drag the marker (or use the arrows) to roll the design back; new edits are inserted at the marker. Click a tile to
 * select it (and what it made), double-click to play up to it; suppress or delete steps from the bar on the right.
 */
export function CaseTimeline({ c, edit }: { c: FlightCase; edit?: CaseEdit }) {
  const ro = useStore((s) => s.readOnly);
  const steps = describeSteps(c);
  const n = steps.length;
  const marker = timelineMarker(c);
  const [sel, setSel] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const markerEl = useRef<HTMLDivElement>(null);
  useEffect(() => { setSel(null); }, [c.id]);
  useEffect(() => { if (sel !== null && sel >= n) setSel(null); }, [n, sel]);
  useEffect(() => { markerEl.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [marker, n]);
  const move = (m: number, coalesce?: string) => { if (!ro) st().caseHistory(c.id, (x) => setMarker(x, m), coalesce); };

  // dragging the marker: index from the pointer position over the strip
  const onMarkerDown = (e: React.PointerEvent) => {
    if (ro) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const key = `timeline-marker:${c.id}:${Date.now()}`;
    const at = (x: number) => {
      const r = strip.current!.getBoundingClientRect();
      return Math.max(0, Math.min(n, Math.round((x - r.left + strip.current!.scrollLeft - 4) / TILE)));
    };
    let last = marker;
    const mv = (ev: PointerEvent) => { const m = at(ev.clientX); if (m !== last) { last = m; move(m, key); } };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };

  const info = sel !== null ? steps[sel] : null;
  const tiles: ReactNode[] = [];
  steps.forEach((s, i) => {
    if (i === marker) tiles.push(<Marker key="m" refEl={markerEl} onDown={onMarkerDown} />);
    const cls = 'tl-step' + (i >= marker ? ' rolled' : '') + (c.timeline!.steps[i].off ? ' off' : '') + (!s.effective && !c.timeline!.steps[i].off ? ' void' : '') + (sel === i ? ' sel' : '');
    tiles.push(
      <button key={c.timeline!.steps[i].id} className={cls} title={`${i + 1}. ${s.label}${c.timeline!.steps[i].off ? ' (unterdrückt)' : !s.effective ? ' (ohne Wirkung)' : ''}`}
        onClick={() => { setSel(i); if (s.sel && s.active) edit?.select(s.sel); }}
        onDoubleClick={() => move(i + 1)}
        onContextMenu={(e) => { e.preventDefault(); setSel(i); }}>
        <Glyph k={s.kind} />
      </button>,
    );
  });
  if (marker >= n) tiles.push(<Marker key="m" refEl={markerEl} onDown={onMarkerDown} />);

  return (
    <div className="timeline" aria-label="Zeitleiste">
      <div className="tl-nav">
        <button className="icon-btn" disabled={ro || marker === 0} onClick={() => move(0)} title="Zum Anfang: alle Schritte zurückrollen" aria-label="Zum Anfang"><Nav d="M3 2.5v9M11 2.5 6 7l5 4.5" /></button>
        <button className="icon-btn" disabled={ro || marker === 0} onClick={() => move(marker - 1)} title="Einen Schritt zurück" aria-label="Zurück"><Nav d="M9 2.5 4.5 7 9 11.5" /></button>
        <button className="icon-btn" disabled={ro || marker >= n} onClick={() => move(marker + 1)} title="Einen Schritt vor" aria-label="Vor"><Nav d="M5 2.5 9.5 7 5 11.5" /></button>
        <button className="icon-btn" disabled={ro || marker >= n} onClick={() => move(n)} title="Zum Ende: alle Schritte abspielen" aria-label="Zum Ende"><Nav d="M11 2.5v9M3 2.5 8 7l-5 4.5" /></button>
      </div>
      <div className="tl-strip" ref={strip}>
        {n ? tiles : <span className="muted small tl-empty">Zeitleiste: Jede Änderung an Maßen, Deckel, Türen, Einbauten und Beschlägen erscheint hier als Schritt.</span>}
      </div>
      <div className="tl-info">
        {info && sel !== null ? (
          <>
            <span className="tl-label"><b>{`Schritt ${sel + 1} von ${n}`}</b>{' '}<span>{info.label}</span>{c.timeline!.steps[sel].off ? <span className="muted">{' (unterdrückt)'}</span> : !info.effective ? <span className="muted" title="Der Schritt bezieht sich auf etwas, das vorher entfernt oder geändert wurde.">{' (ohne Wirkung)'}</span> : null}</span>
            {!ro ? (
              <>
                <button className="btn sm" onClick={() => move(sel + 1)} title="Zeitleiste bis einschließlich dieses Schritts abspielen, spätere zurückrollen">Bis hier</button>
                <button className="btn sm" onClick={() => st().caseHistory(c.id, (x) => toggleStep(x, sel))} title="Schritt vorübergehend abschalten, spätere werden ohne ihn neu angewendet">{c.timeline!.steps[sel].off ? 'Aktivieren' : 'Unterdrücken'}</button>
                <button className="btn sm danger" onClick={() => { st().caseHistory(c.id, (x) => deleteStep(x, sel)); setSel(null); }} title="Schritt aus der Zeitleiste löschen, spätere werden ohne ihn neu angewendet">Löschen</button>
              </>
            ) : null}
          </>
        ) : n ? <span className="muted small">{marker < n ? `${n - marker} von ${n} Schritten zurückgerollt` : `${n} Schritte`}</span> : null}
      </div>
    </div>
  );
}

function Marker({ refEl, onDown }: { refEl: React.RefObject<HTMLDivElement>; onDown: (e: React.PointerEvent) => void }) {
  return <div ref={refEl} className="tl-marker" onPointerDown={onDown} title="Markierung ziehen, um die Konstruktion zurückzurollen" role="separator" aria-label="Markierung" />;
}
