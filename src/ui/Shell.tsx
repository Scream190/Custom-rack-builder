import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../model/store';
import { setLayout, useLayout } from '../model/layout';

/*
 * Shared frame of every workspace, so all four look and behave the same:
 *   object bar  = the things you work on (racks, cases, inlays) as tabs, then "new / duplicate / delete" as one group,
 *                 then which side panels are shown
 *   tool bar    = view switch first, then the tools of the workspace in labelled groups
 */

export interface ObjectTab { id: string; label: string; sub?: string; title?: string }

/**
 * Dropdown menu. Closes on outside click, Esc and (unless keepOpen) after choosing an item.
 * Children: <button>, <MenuCheck>, <hr>, <div className="menu-note">.
 */
export function Menu({ label, title, className = '', align = 'left', keepOpen = false, children }: {
  label: ReactNode; title?: string; className?: string; align?: 'left' | 'right'; keepOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={'btn ' + className + (open ? ' pressed' : '')} aria-haspopup="menu" aria-expanded={open} title={title} onClick={() => setOpen(!open)}>{label} ▾</button>
      {open ? (
        <div className={'menu-pop' + (align === 'right' ? ' right' : '')} role="menu"
          onClick={(e) => { if (!keepOpen && (e.target as HTMLElement).closest('button')) setOpen(false); }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** checkbox row inside a menu */
export function MenuCheck({ checked, onChange, children, title }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; title?: string }) {
  return <label className="menu-check" title={title}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {children}</label>;
}

/** "Anzeigen" menu at the right end of every tool bar: side panels plus view options of the workspace */
export function ShowMenu({ library, list, children }: { library?: string; list?: string; children?: ReactNode }) {
  const layout = useLayout();
  const ro = useStore((s) => s.readOnly);
  return (
    <Menu label="Anzeigen" title="Seitenbereiche und Anzeigeoptionen" align="right" keepOpen className="sm">
      <div className="menu-head">Bereiche</div>
      {library && !ro ? <MenuCheck checked={layout.showLibrary} onChange={(v) => setLayout({ showLibrary: v })}>{library} (links)</MenuCheck> : null}
      {list ? <MenuCheck checked={layout.showCableList} onChange={(v) => setLayout({ showCableList: v })}>{list} (unten)</MenuCheck> : null}
      <MenuCheck checked={layout.showInspector} onChange={(v) => setLayout({ showInspector: v })}>Eigenschaften (rechts)</MenuCheck>
      {children ? <><hr /><div className="menu-head">Ansicht</div>{children}</> : null}
    </Menu>
  );
}

export function ObjectBar({ noun, tabs, activeId, onSelect, newButton, onDuplicate, onDelete, deleteHint, emptyText }: {
  /** singular noun for button labels and tooltips ("Rack", "Case", "Einlage") */
  noun: string;
  tabs: ObjectTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** the "new" control: a button or a small menu */
  newButton?: ReactNode;
  onDuplicate?: () => void;
  onDelete?: () => void;
  /** why deleting is not possible here (shown in the menu instead of the item) */
  deleteHint?: string;
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
        <div className="obj-actions">
          {newButton}
          {active && (onDuplicate || onDelete || deleteHint) ? (
            <Menu label={noun} title={`Aktionen für ${noun} „${active.label}“`} align="right" className="sm">
              {onDuplicate ? <button onClick={onDuplicate}>„{active.label}“ duplizieren</button> : null}
              {onDelete ? <><hr /><button className="danger" onClick={onDelete}>„{active.label}“ löschen …</button></> : deleteHint ? <div className="menu-note">{deleteHint}</div> : null}
            </Menu>
          ) : null}
        </div>
      ) : null}
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
