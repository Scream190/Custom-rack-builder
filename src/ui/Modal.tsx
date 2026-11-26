import { useEffect } from 'react';
import { useStore } from '../model/store';

export function Modal({ title, children, footer, wide, onClose }: { title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; onClose?: () => void }) {
  const close = onClose ?? (() => useStore.getState().openModal(null));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Schließen">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, grow }: { label: string; children: React.ReactNode; hint?: string; grow?: number }) {
  return (
    <label className="field" style={grow ? { flex: grow } : undefined}>
      <span>{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

export function NumberInput({ value, onChange, step = 1, min, max, style }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; style?: React.CSSProperties }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      max={max}
      style={style}
      onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
    />
  );
}
