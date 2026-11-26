import { useState, type ReactNode } from 'react';

/** Collapsible section in the properties panels and side lists; open/closed is remembered per section. */
const KEY = 'rackplanner.sections.v1';
let state: Record<string, boolean> = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
})();

export function Section({ id, title, summary, defaultOpen = false, children }: {
  /** key for remembering the state, e.g. "case.hardware" */
  id: string;
  title: string;
  /** short text shown on the right while the section is closed (current values) */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(state[id] ?? defaultOpen);
  const toggle = () => {
    const v = !open;
    setOpen(v);
    state = { ...state, [id]: v };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  };
  return (
    <section className={'sect' + (open ? ' open' : '')}>
      <button className="sect-head" aria-expanded={open} onClick={toggle} title={open ? `${title} einklappen` : `${title} aufklappen`}>
        <span className="sect-chev" aria-hidden>{open ? '▾' : '▸'}</span>
        <span className="sect-title">{title}</span>
        {!open && summary ? <span className="sect-sum">{summary}</span> : null}
      </button>
      {open ? <div className="sect-body">{children}</div> : null}
    </section>
  );
}
