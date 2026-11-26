import type { ReactNode } from 'react';
import { useStore } from '../model/store';

/*
 * Shared frame of every workspace, so all four look and behave the same:
 *   object bar  = the things you work on (racks, cases, inlays) as tabs, then "new / duplicate / delete" as one group,
 *                 then which side panels are shown
 *   tool bar    = view switch first, then the tools of the workspace in labelled groups
 */

export interface ObjectTab { id: string; label: string; sub?: string; title?: string }
export interface PanelToggle { label: string; title: string; on: boolean; onClick: () => void }

export function ObjectBar({ noun, tabs, activeId, onSelect, newButton, onDuplicate, onDelete, toggles, emptyText }: {
  /** singular noun for button labels and tooltips ("Rack", "Case", "Einlage") */
  noun: string;
  tabs: ObjectTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** the "new" control: a button or a small menu */
  newButton?: ReactNode;
  onDuplicate?: () => void;
  onDelete?: () => void;
  toggles: PanelToggle[];
  emptyText?: string;
}) {
  const ro = useStore((s) => s.readOnly);
  const active = tabs.find((t) => t.id === activeId);
  return (
    <div className="objbar">
      <div className="obj-tabs" role="tablist">
        {tabs.length ? tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === activeId} className={'tab' + (t.id === activeId ? ' on' : '')} onClick={() => onSelect(t.id)} title={t.title ?? `${noun} „${t.label}“ öffnen`}>
            {t.label}{t.sub ? <span className="tab-sub">{t.sub}</span> : null}
          </button>
        )) : <span className="muted small obj-empty">{emptyText}</span>}
      </div>
      {!ro ? (
        <div className="btn-group" aria-label={`${noun} verwalten`}>
          {newButton}
          {onDuplicate ? <button className="btn sm" disabled={!active} onClick={onDuplicate} title={active ? `Kopie von „${active.label}“ anlegen` : undefined}>Duplizieren</button> : null}
          {onDelete ? <button className="btn sm danger" disabled={!active} onClick={onDelete} title={active ? `„${active.label}“ löschen (Rückgängig mit Strg+Z)` : undefined}>Löschen</button> : null}
        </div>
      ) : null}
      <div className="panel-toggles" role="group" aria-label="Bereiche ein- und ausblenden">
        <span className="tool-label">Bereiche</span>
        {toggles.map((t) => (
          <button key={t.label} className={'tgl' + (t.on ? ' on' : '')} aria-pressed={t.on} onClick={t.onClick} title={t.title}>{t.label}</button>
        ))}
      </div>
    </div>
  );
}

/** tool bar above the stage */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

/** a labelled group of related tools */
export function ToolGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="tool-group">
      {label ? <span className="tool-label">{label}</span> : null}
      {children}
    </div>
  );
}

/** segmented switch (views, layers): exactly one option is active */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; title: string }[]; onChange: (v: T) => void }) {
  return (
    <span className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)} title={o.title}>{o.label}</button>
      ))}
    </span>
  );
}

/** empty workspace: what this workspace is for and how to start */
export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className="center case-empty">
      <div className="empty-box">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        {children ? <div className="row gap8 wrap">{children}</div> : null}
      </div>
    </section>
  );
}
