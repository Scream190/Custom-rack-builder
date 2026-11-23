import type { PanelDesign, PanelElement } from '../model/types';
import { DSIZE, dsizeScrews, MOUNT_SLOT, mountHolePositions, panelSize } from '../model/panel';

const HOLE = '#050506';

/** Cut-outs, engravings and mounting slots of a custom panel, drawn in panel coordinates (mm). */
export function PanelArt({ pd, showMounting = true, selectedId }: { pd: PanelDesign; showMounting?: boolean; selectedId?: string | null }) {
  return (
    <g>
      {showMounting ? <MountingHoles pd={pd} /> : null}
      {pd.elements.map((el) => (
        <PanelElementArt key={el.id} el={el} pd={pd} selected={el.id === selectedId} />
      ))}
    </g>
  );
}

export function MountingHoles({ pd }: { pd: PanelDesign }) {
  return (
    <g>
      {mountHolePositions(pd).map((p, i) =>
        pd.mountHoles === 'slot'
          ? <rect key={i} x={p.x - MOUNT_SLOT.w / 2} y={p.y - MOUNT_SLOT.h / 2} width={MOUNT_SLOT.w} height={MOUNT_SLOT.h} rx={MOUNT_SLOT.h / 2} fill={HOLE} />
          : <circle key={i} cx={p.x} cy={p.y} r={MOUNT_SLOT.h / 2} fill={HOLE} />,
      )}
    </g>
  );
}

export function PanelElementArt({ el, pd, selected }: { el: PanelElement; pd: PanelDesign; selected?: boolean }) {
  const sel = selected ? <SelectionBox el={el} /> : null;
  switch (el.kind) {
    case 'dseries':
      return (
        <g>
          <circle cx={el.x} cy={el.y} r={DSIZE.holeD / 2} fill={HOLE} />
          {dsizeScrews(el).map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={DSIZE.screwD / 2} fill={HOLE} />)}
          {sel}
        </g>
      );
    case 'hole':
      return <g><circle cx={el.x} cy={el.y} r={(el.d ?? 6) / 2} fill={HOLE} />{sel}</g>;
    case 'rect':
      return (
        <g>
          <rect x={el.x - (el.w ?? 20) / 2} y={el.y - (el.h ?? 10) / 2} width={el.w ?? 20} height={el.h ?? 10} rx={el.r ?? 0} fill={HOLE} />
          {sel}
        </g>
      );
    case 'engraveRect':
      return (
        <g>
          <rect x={el.x - (el.w ?? 40) / 2} y={el.y - (el.h ?? 20) / 2} width={el.w ?? 40} height={el.h ?? 20} rx={el.r ?? 0} fill="none" stroke={pd.engraveColor} strokeWidth={0.5} />
          {sel}
        </g>
      );
    case 'engraveLine':
      return (
        <g>
          <line x1={el.x - (el.w ?? 40) / 2} y1={el.y} x2={el.x + (el.w ?? 40) / 2} y2={el.y} stroke={pd.engraveColor} strokeWidth={0.5} />
          {sel}
        </g>
      );
    case 'text': {
      const fs = el.fontSize ?? 3.5;
      const anchor = el.align === 'left' ? 'start' : el.align === 'right' ? 'end' : 'middle';
      return (
        <g>
          {/* fontSize = cap height × 1.4 so the given value matches the engraving height */}
          <text x={el.x} y={el.y + fs / 2} fontSize={fs * 1.4} fill={pd.engraveColor} textAnchor={anchor} fontFamily="Arial, Helvetica, sans-serif">
            {el.text ?? ''}
          </text>
          {sel}
        </g>
      );
    }
  }
}

function SelectionBox({ el }: { el: PanelElement }) {
  const b = elementBounds(el);
  return <rect x={b.x - 1.5} y={b.y - 1.5} width={b.w + 3} height={b.h + 3} fill="none" stroke="#22d3ee" strokeWidth={0.6} strokeDasharray="2 1.2" pointerEvents="none" />;
}

export function elementBounds(el: PanelElement) {
  switch (el.kind) {
    case 'dseries': {
      const w = el.rotate ? DSIZE.flangeH : DSIZE.flangeW;
      const h = el.rotate ? DSIZE.flangeW : DSIZE.flangeH;
      return { x: el.x - w / 2, y: el.y - h / 2, w, h };
    }
    case 'hole': { const d = el.d ?? 6; return { x: el.x - d / 2, y: el.y - d / 2, w: d, h: d }; }
    case 'text': {
      const fs = el.fontSize ?? 3.5;
      const w = Math.max(4, (el.text ?? '').length * fs * 0.78);
      const x = el.align === 'left' ? el.x : el.align === 'right' ? el.x - w : el.x - w / 2;
      return { x, y: el.y - fs / 2 - 0.6, w, h: fs + 1.2 };
    }
    case 'engraveLine': { const w = el.w ?? 40; return { x: el.x - w / 2, y: el.y - 1, w, h: 2 }; }
    default: { const w = el.w ?? 20; const h = el.h ?? 10; return { x: el.x - w / 2, y: el.y - h / 2, w, h }; }
  }
}

/** Plain panel (outline + art) – used in the panel designer and exports. */
export function PanelDrawing({ pd, selectedId }: { pd: PanelDesign; selectedId?: string | null }) {
  const { w, h } = panelSize(pd);
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={pd.cornerRadius} fill={pd.color} stroke="#666" strokeWidth={0.3} />
      <PanelArt pd={pd} selectedId={selectedId} />
    </g>
  );
}
