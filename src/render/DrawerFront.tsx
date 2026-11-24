import type { DrawerItem, PlacedDevice } from '../model/types';

const FONT = 'Inter, Arial, Helvetica, sans-serif';

export const drawerItemText = (i: DrawerItem) => (i.qty && i.qty !== 1 ? `${i.qty}× ${i.text}` : i.text);

/** One-line summary of a drawer's contents, e.g. "2× SM58, Batterien AA, Gaffa" */
export function drawerSummary(contents?: DrawerItem[]) {
  return (contents ?? []).filter((i) => i.text.trim()).map(drawerItemText).join(', ');
}

/**
 * Drawer front: recessed front plate, handle and a white label card with the contents.
 * The card shows as many lines as fit the drawer height; the full list is in the tooltip, the viewer and the PDF.
 */
export function DrawerFront({ width, h, device, ear }: { width: number; h: number; device?: PlacedDevice; ear: number }) {
  const items = (device?.contents ?? []).filter((i) => i.text.trim());
  const title = device?.label;
  const cardX = ear + 6;
  const cardW = width - 2 * ear - 12;
  const cardY = 3.2;
  const cardH = h - 6.4 - 6; // leave room for the handle below the card
  const head = title ? 1 : 0;
  // largest font (≤ 6 mm) for which all items fit into at most 3 columns; 1 U drawers use a single line
  let fs = 3.3, rows = 1, cols = 1;
  if (h >= 50) {
    for (let f = 6; f >= 2.6; f -= 0.2) {
      const r = Math.max(1, Math.floor((cardH - 2.4) / (f * 1.32)) - head);
      const c = Math.max(1, Math.ceil(items.length / r));
      const longest = Math.max(8, ...items.map((i) => drawerItemText(i).length + 2));
      if (c <= 3 && longest * f * 0.56 <= (cardW - 4) / c) { fs = f; rows = r; cols = c; break; }
      fs = f; rows = r; cols = Math.min(3, c);
    }
  }
  const lineH = fs * 1.32;
  const perCol = h < 50 ? 1 : rows;
  const shown = h < 50 ? 0 : Math.min(items.length, rows * cols);
  const colW = (cardW - 4) / cols;
  const oneLine = h < 50 ? [title, drawerSummary(items)].filter(Boolean).join(': ') : '';
  const maxChars = (w: number) => Math.floor(w / (fs * 0.56));
  const clip = (t: string, w: number) => (t.length > maxChars(w) ? t.slice(0, Math.max(1, maxChars(w) - 1)) + '…' : t);
  return (
    <g pointerEvents="none">
      <title>{[title || 'Schublade', ...items.map(drawerItemText)].join('\n')}</title>
      <rect x={ear + 2} y={1.2} width={width - 2 * ear - 4} height={h - 2.4} rx={1.2} fill="#18191c" stroke="#3a3d42" strokeWidth={0.5} />
      {/* handle */}
      <rect x={width / 2 - 45} y={h - 5.4} width={90} height={3.2} rx={1.6} fill="#9ca3af" stroke="#4b5563" strokeWidth={0.3} />
      {/* label card */}
      <rect x={cardX} y={cardY} width={cardW} height={cardH} rx={0.6} fill={items.length || title ? '#f5f5f0' : '#2a2c30'} stroke="#9ca3af" strokeWidth={0.3} />
      {!items.length && !title ? (
        <text x={width / 2} y={cardY + cardH / 2 + 1.2} fontSize={3.2} textAnchor="middle" fill="#9ca3af" fontFamily={FONT}>Schublade – Inhalt im Eigenschaften-Bereich eintragen</text>
      ) : h < 50 ? (
        <text x={cardX + 2} y={cardY + cardH / 2 + fs * 0.36} fontSize={fs} fill="#111" fontFamily={FONT} fontWeight={600}>{clip(oneLine, cardW - 4)}</text>
      ) : (
        <g>
          {title ? <text x={cardX + 2} y={cardY + lineH} fontSize={fs} fill="#111" fontWeight={800} fontFamily={FONT}>{clip(title, cardW - 4)}</text> : null}
          {items.slice(0, shown).map((it, i) => {
            const c = Math.floor(i / perCol), r = i % perCol;
            const last = i === shown - 1 && shown < items.length;
            return (
              <text key={i} x={cardX + 2 + c * colW} y={cardY + lineH * (r + 1 + head)} fontSize={fs} fill="#111" fontFamily={FONT}>
                {last ? `+ ${items.length - shown + 1} weitere …` : clip(`• ${drawerItemText(it)}`, colW - 2)}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}
