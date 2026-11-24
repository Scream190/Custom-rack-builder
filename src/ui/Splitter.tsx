import { useRef } from 'react';

/**
 * Drag handle between two areas. `dir="x"` resizes a column (vertical bar), `dir="y"` a row.
 * `sign` = +1 when dragging right/down grows the controlled area, −1 when it shrinks it.
 */
export function Splitter({ dir, value, onChange, min, max, sign = 1, onReset, title }: {
  dir: 'x' | 'y'; value: number; onChange: (v: number) => void; min: number; max: number; sign?: 1 | -1; onReset?: () => void; title?: string;
}) {
  const start = useRef<{ p: number; v: number } | null>(null);
  return (
    <div
      className={'splitter splitter-' + dir}
      title={title ?? 'Ziehen zum Anpassen, Doppelklick setzt die Standardgröße'}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        start.current = { p: dir === 'x' ? e.clientX : e.clientY, v: value };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        document.body.classList.add(dir === 'x' ? 'resizing-x' : 'resizing-y');
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const d = (dir === 'x' ? e.clientX : e.clientY) - s.p;
        onChange(Math.round(Math.max(min, Math.min(max, s.v + sign * d))));
      }}
      onPointerUp={() => { start.current = null; document.body.classList.remove('resizing-x', 'resizing-y'); }}
      onDoubleClick={onReset}
    />
  );
}
