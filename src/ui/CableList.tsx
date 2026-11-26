import { setLayout, useLayout } from '../model/layout';
import { useActiveRack, useStore } from '../model/store';
import { cableLength, formatLength, resolveEnd } from '../model/geometry';
import { cableColor, cableNumberText } from '../render/cablePaths';
import type { Project, Rack } from '../model/types';
import { openCableBuild } from './CableWorkspace';

export interface CableRow {
  id: string;
  number: string;
  type: string;
  color: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  length: number;
  mode: 'auto' | 'manual';
  label: string;
}

export function cableRows(project: Project, rack: Rack): CableRow[] {
  return [...rack.cables]
    .sort((a, b) => a.number - b.number || (a.yLeg ?? 0) - (b.yLeg ?? 0))
    .map((c) => {
      const a = resolveEnd(project, rack, c.a);
      const b = resolveEnd(project, rack, c.b);
      const ct = project.cableTypes.find((t) => t.id === c.typeId);
      return {
        id: c.id,
        number: cableNumberText(c),
        type: ct?.name ?? '?',
        color: cableColor(project, c),
        from: a ? `${a.device.label || a.tpl.name}` : '?',
        fromPort: a ? `${a.port.name} (${a.box ? 'Dose' : `HE ${a.device.u}`})` : '',
        to: b ? `${b.device.label || b.tpl.name}` : '?',
        toPort: b ? `${b.port.name} (${b.box ? 'Dose' : `HE ${b.device.u}`})` : '',
        length: cableLength(project, rack, c)?.length ?? 0,
        mode: c.lengthMode,
        label: c.label ?? '',
      };
    });
}

export function CableList() {
  const project = useStore((s) => s.project);
  const rack = useActiveRack();
  const selection = useStore((s) => s.selection);
  const hover = useStore((s) => s.hoverCableId);
  const open = !useLayout().cableListCollapsed;
  const setOpen = (o: boolean) => setLayout({ cableListCollapsed: !o });
  const rows = cableRows(project, rack);
  const st = useStore.getState;
  return (
    <div className={'cable-list' + (open ? '' : ' closed')}>
      <div className="cable-list-head">
        <button className="cable-list-title" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Kabelliste einklappen' : 'Kabelliste ausklappen'}>{open ? '▾' : '▸'} Kabelliste, {rack.name} ({rows.length})</button>
        <span className="row gap8">
          <button className="btn sm" onClick={() => { const sel = st().selection; const c = sel?.kind === 'cable' ? rack.cables.find((x) => x.id === sel.id) : undefined; if (c) openCableBuild(cableNumberText(c).replace(c.yGroup ? /[a-z]$/ : /$^/, '')); else st().setMode('cables'); }} title="Stecker, Pinbelegung und Arbeitsschritte im Reiter Kabel">Bauanleitungen</button>
          <span className="muted small">Gesamt: {formatLength(rows.reduce((s, r) => s + r.length, 0))}</span>
        </span>
      </div>
      {open ? (
        <div className="cable-table-wrap">
          {rows.length === 0 ? (
            <div className="hint pad">Noch keine Kabel. Klicke auf einen Anschluss im Rack und dann auf den Zielanschluss.</div>
          ) : (
            <table className="cable-table">
              <thead>
                <tr><th>Nr.</th><th>Typ</th><th>Von</th><th>Port</th><th>Nach</th><th>Port</th><th>Länge</th><th>Notiz</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={(selection?.kind === 'cable' && selection.id === r.id ? 'sel ' : '') + (hover === r.id ? 'hover' : '')}
                    onClick={() => st().select({ kind: 'cable', id: r.id })}
                    onMouseEnter={() => st().setHoverCable(r.id)}
                    onMouseLeave={() => st().setHoverCable(null)}
                  >
                    <td><i className="dot" style={{ background: r.color }} />{r.number}</td>
                    <td>{r.type}</td>
                    <td>{r.from}</td>
                    <td className="muted">{r.fromPort}</td>
                    <td>{r.to}</td>
                    <td className="muted">{r.toPort}</td>
                    <td>{formatLength(r.length)}{r.mode === 'manual' ? ' ✎' : ''}</td>
                    <td>{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
