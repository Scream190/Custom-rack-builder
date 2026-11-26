import type { CaseFace, CaseHardware, FlightCase, Project } from '../model/types';
import { caseDims, footprint, isDrawer, usableArea } from '../model/cases';
import { shade } from './DeviceFace';

/*
 * Technical drawing of a flight case in mm (1 svg unit = 1 mm): inner top view with foam cut-outs (interactive in the
 * designer), front and side view with hardware, dimension lines. Drawer inlays: top view and section only.
 */

const GAP = 140, LABEL = 34;
const ALU = '#b8bcc2', METAL = '#cfd3d8', DARK = '#16171a';

export function sheetLayout(c: FlightCase) {
  const d = caseDims(c);
  const lidItems = c.items.some((i) => i.layer === 'lid');
  if (isDrawer(c)) {
    const top = { x: 0, y: LABEL, w: c.inner.l, h: c.inner.w };
    const section = { x: 0, y: top.y + top.h + GAP, w: c.inner.l, h: c.inner.h };
    return { d, top, lid: null, front: section, side: null, w: c.inner.l + 60, h: section.y + section.h + 70 };
  }
  const top = { x: 0, y: LABEL, w: d.L, h: d.W };
  const lid = lidItems ? { x: d.L + GAP, y: LABEL, w: d.L, h: d.W } : null;
  const front = { x: 0, y: top.y + top.h + GAP, w: d.L, h: d.H };
  const side = { x: d.L + GAP, y: front.y, w: d.W, h: d.H };
  return { d, top, lid, front, side, w: Math.max(lid ? lid.x + lid.w : 0, side.x + side.w) + 60, h: front.y + d.H + 80 };
}

/** Breaks a label into at most `maxLines` lines that fit `width` at font size `fs`; the last line is shortened with an ellipsis. */
function fitLabel(text: string, width: number, fs: number, maxLines: number): string[] {
  const per = Math.max(3, Math.floor(width / (fs * 0.56)));
  if (text.length <= per) return [text];
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= per) { cur = next; continue; }
    if (cur) out.push(cur);
    cur = w;
  }
  if (cur) out.push(cur);
  if (out.length <= maxLines && out.every((l) => l.length <= per)) return out;
  const keep = out.slice(0, maxLines).map((l) => (l.length > per ? l.slice(0, per - 1) + '…' : l));
  if (out.length > maxLines) { const l = keep[maxLines - 1]; keep[maxLines - 1] = (l.length >= per ? l.slice(0, per - 1) : l) + '…'; }
  return keep;
}

function DimH({ x1, x2, y, label, ink }: { x1: number; x2: number; y: number; label: string; ink: string }) {
  return (
    <g stroke={ink} strokeWidth={1.2} fill={ink}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 8} x2={x1} y2={y + 8} /><line x1={x2} y1={y - 8} x2={x2} y2={y + 8} />
      <text x={(x1 + x2) / 2} y={y - 6} fontSize={16} textAnchor="middle" stroke="none">{label}</text>
    </g>
  );
}
function DimV({ y1, y2, x, label, ink }: { y1: number; y2: number; x: number; label: string; ink: string }) {
  return (
    <g stroke={ink} strokeWidth={1.2} fill={ink}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 8} y1={y1} x2={x + 8} y2={y1} /><line x1={x - 8} y1={y2} x2={x + 8} y2={y2} />
      <text x={x + 10} y={(y1 + y2) / 2 + 5} fontSize={16} stroke="none">{label}</text>
    </g>
  );
}

/** positions of `count` items spread evenly along a span */
const spread = (from: number, to: number, count: number) => Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 1)) / (count + 1));

/** one outside view (front = length, side = width) with the hardware of that face */
function OutsideView({ c, face, w, ink }: { c: FlightCase; face: CaseFace; w: number; ink: string }) {
  const d = caseDims(c);
  const hasLid = d.lidH > 0;
  const bodyTop = d.lidH, bodyBottom = d.lidH + d.bodyH;
  const hw = c.hardware.filter((h) => h.face === face);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const braked = c.hardware.filter((h) => h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const prof = c.profile !== 'none' ? 9 : 0;
  const lam = c.color;
  const items: JSX.Element[] = [];
  const draw = (h: CaseHardware, i: number) => {
    const xs = spread(0, w, h.count);
    return xs.map((x, k) => {
      const key = `${i}-${k}`;
      switch (h.kind) {
        case 'butterfly': case 'butterfly-small': {
          const s = h.kind === 'butterfly' ? 1 : 0.7;
          return (
            <g key={key} transform={`translate(${x},${bodyTop})`}>
              <rect x={-34 * s} y={-26 * s} width={68 * s} height={52 * s} rx={4} fill={METAL} stroke={DARK} strokeWidth={1} />
              <circle r={14 * s} fill="#9ca3af" stroke={DARK} strokeWidth={1} />
              <rect x={-3} y={-12 * s} width={6} height={24 * s} fill={DARK} />
            </g>
          );
        }
        case 'handle-recessed':
          return (
            <g key={key} transform={`translate(${x},${(bodyTop + bodyBottom) / 2})`}>
              <rect x={-75} y={-48} width={150} height={96} rx={10} fill={METAL} stroke={DARK} strokeWidth={1} />
              <rect x={-58} y={-30} width={116} height={60} rx={8} fill="#6b7280" />
              <rect x={-50} y={-8} width={100} height={14} rx={6} fill={DARK} />
            </g>
          );
        case 'handle-strap':
          return <g key={key} transform={`translate(${x},${(bodyTop + bodyBottom) / 2})`}><rect x={-70} y={-10} width={140} height={20} rx={9} fill={DARK} /><rect x={-80} y={-12} width={16} height={24} fill={METAL} /><rect x={64} y={-12} width={16} height={24} fill={METAL} /></g>;
        case 'label':
          return <g key={key} transform={`translate(${x},${bodyBottom - 70})`}><rect x={-45} y={-28} width={90} height={56} rx={3} fill={METAL} stroke={DARK} strokeWidth={1} /><rect x={-38} y={-21} width={76} height={42} fill="#f5f5f4" /></g>;
        case 'hinge':
          return <g key={key} transform={`translate(${x},${bodyTop})`}><rect x={-30} y={-22} width={60} height={44} fill={METAL} stroke={DARK} strokeWidth={1} /><line x1={-30} y1={0} x2={30} y2={0} stroke={DARK} strokeWidth={2} /></g>;
        default: return null;
      }
    });
  };
  hw.forEach((h, i) => items.push(...(draw(h, i).filter(Boolean) as JSX.Element[])));
  return (
    <g>
      {/* lid and body */}
      {hasLid ? <rect x={0} y={0} width={w} height={d.lidH} rx={4} fill={lam} stroke={shade(lam, 0.35)} strokeWidth={1.2} /> : null}
      <rect x={0} y={bodyTop} width={w} height={d.bodyH} rx={4} fill={lam} stroke={shade(lam, 0.35)} strokeWidth={1.2} />
      {/* aluminium edge and closing profiles */}
      {prof ? <>
        <rect x={0} y={0} width={prof} height={bodyBottom} fill={ALU} /><rect x={w - prof} y={0} width={prof} height={bodyBottom} fill={ALU} />
        <rect x={0} y={bodyBottom - prof} width={w} height={prof} fill={ALU} />
        {hasLid ? <rect x={0} y={0} width={w} height={prof} fill={ALU} /> : null}
      </> : null}
      {hasLid ? <rect x={0} y={bodyTop - 7} width={w} height={14} fill={ALU} stroke={shade(ALU, -0.3)} strokeWidth={0.8} /> : null}
      {c.cornerBalls ? [[0, 0], [w, 0], [0, bodyBottom], [w, bodyBottom]].filter(([, y]) => hasLid || y > 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={16} fill={METAL} stroke={DARK} strokeWidth={1} />
      )) : null}
      {items}
      {/* castors */}
      {castors ? [0.12, 0.88].map((f, i) => {
        const x = w * f, r = c.castorSize / 2;
        return (
          <g key={i}>
            <rect x={x - 45} y={bodyBottom} width={90} height={12} fill={METAL} stroke={DARK} strokeWidth={0.8} />
            <rect x={x - 12} y={bodyBottom + 12} width={24} height={d.castorH - 12 - r * 1.6} fill="#4b5563" />
            <circle cx={x} cy={bodyBottom + d.castorH - r} r={r} fill={DARK} stroke="#4b5563" strokeWidth={6} />
            {i === 0 && braked ? <rect x={x + r * 0.4} y={bodyBottom + d.castorH - r * 1.7} width={30} height={10} fill="#dc2626" /> : null}
          </g>
        );
      }) : null}
      {!castors && d.castorH ? <rect x={20} y={bodyBottom} width={w - 40} height={d.castorH} fill="#4b5563" /> : null}
      <DimH x1={0} x2={w} y={d.H + 34} label={`${Math.round(w)} mm`} ink={ink} />
      <DimV y1={0} y2={d.H} x={w + 26} label={`${Math.round(d.H)} mm`} ink={ink} />
      {hasLid ? <DimV y1={0} y2={d.lidH} x={-48} label={`${Math.round(d.lidH)}`} ink={ink} /> : null}
    </g>
  );
}

export interface CaseSheetProps {
  c: FlightCase;
  project?: Project;
  light?: boolean;
  selectedItemId?: string | null;
  warnItemIds?: Set<string>;
  onItemPointerDown?: (e: React.PointerEvent, itemId: string) => void;
}

/** foam inlay of one layer seen from above (inner space), with cut-outs */
function InlayView({ c, layer, x0, y0, ink, props }: { c: FlightCase; layer: 'body' | 'lid'; x0: number; y0: number; ink: string; props: CaseSheetProps }) {
  const area = usableArea(c);
  const W = c.inner.w;
  const Y = (y: number) => y0 + W - y;
  return (
    <g>
      <rect x={x0} y={y0} width={c.inner.l} height={W} fill={c.foam.color} stroke={shade(c.foam.color, 0.4)} strokeWidth={1} />
      {c.foam.sides > 0 ? <rect x={x0 + area.x0} y={Y(area.y1)} width={area.x1 - area.x0} height={area.y1 - area.y0} fill="none" stroke={shade(c.foam.color, 0.5)} strokeWidth={1} strokeDasharray="8 6" /> : null}
      {layer === 'body' ? c.dividers.map((dv, i) => (
        dv.axis === 'x'
          ? <rect key={i} x={x0} y={Y(dv.pos) - 4} width={c.inner.l} height={8} fill="#a8a29e" />
          : <rect key={i} x={x0 + dv.pos - 4} y={y0} width={8} height={W} fill="#a8a29e" />
      )) : null}
      {c.items.filter((it) => it.layer === layer).map((it) => {
        const f = footprint(it);
        const sel = props.selectedItemId === it.id, warn = props.warnItemIds?.has(it.id);
        const fs = Math.max(8, Math.min(22, f.l / Math.max(8, it.name.length) * 1.6, f.w / 3.2));
        const lines = fitLabel(it.name, f.l - 8, fs, f.w > fs * 4.2 ? 2 : 1);
        const showSize = f.w > fs * (lines.length + 1.6) * 1.15;
        return (
          <g key={it.id} data-item={it.id} style={{ cursor: props.onItemPointerDown ? 'grab' : undefined }} onPointerDown={props.onItemPointerDown ? (e) => props.onItemPointerDown!(e, it.id) : undefined}>
            <rect x={x0 + it.x} y={Y(it.y + f.w)} width={f.l} height={f.w} rx={4} fill={shade(c.foam.color, -0.55)}
              stroke={warn ? '#ef4444' : sel ? '#22d3ee' : shade(c.foam.color, 0.5)} strokeWidth={sel || warn ? 3 : 1.2} />
            {lines.map((t, k) => (
              <text key={k} x={x0 + it.x + f.l / 2} y={Y(it.y + f.w / 2) + fs * (k - (lines.length - 1) / 2 - (showSize ? 0.45 : -0.35)) * 1.15} fontSize={fs} textAnchor="middle" fill="#f5f5f4" pointerEvents="none">{t}</text>
            ))}
            {showSize ? <text x={x0 + it.x + f.l / 2} y={Y(it.y + f.w / 2) + fs * ((lines.length - 1) / 2 * 1.15 + 1.1)} fontSize={fs * 0.75} textAnchor="middle" fill="#d6d3d1" pointerEvents="none">{`${it.l} × ${it.w} × ${it.h}`}</text> : null}
          </g>
        );
      })}
      <DimH x1={x0} x2={x0 + c.inner.l} y={y0 + W + 30} label={`innen ${c.inner.l} mm`} ink={ink} />
      <DimV y1={y0} y2={y0 + W} x={x0 + c.inner.l + 24} label={`${W}`} ink={ink} />
    </g>
  );
}

/** The whole sheet as an svg <g> (wrap in <svg viewBox="0 0 w h">). */
export function CaseSheet(props: CaseSheetProps) {
  const { c, light } = props;
  const ink = light ? '#111' : '#cbd5e1';
  const L = sheetLayout(c);
  const d = L.d;
  const wall = (d.L - c.inner.l) / 2;
  const title = (x: number, y: number, t: string) => <text x={x} y={y - 12} fontSize={20} fontWeight={700} fill={ink}>{t}</text>;
  if (isDrawer(c)) {
    const s = L.front;
    const bottom = c.foam.bottom;
    return (
      <g>
        {title(L.top.x, L.top.y, 'Schaumstoff-Einlage, Draufsicht')}
        <InlayView c={c} layer="body" x0={L.top.x} y0={L.top.y} ink={ink} props={props} />
        {title(s.x, s.y, 'Schnitt (von vorne)')}
        <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={ink} strokeWidth={1.2} strokeDasharray="10 6" />
        <rect x={s.x} y={s.y + s.h - bottom} width={s.w} height={bottom} fill={c.foam.color} />
        <rect x={s.x} y={s.y + 3} width={s.w} height={s.h - bottom - 3} fill={c.foam.color} opacity={0.85} />
        {c.items.map((it) => {
          const f = footprint(it);
          return <rect key={it.id} x={s.x + it.x} y={s.y + s.h - bottom - it.h} width={f.l} height={it.h} fill={shade(c.foam.color, -0.55)} />;
        })}
        <DimV y1={s.y} y2={s.y + s.h} x={s.x + s.w + 24} label={`innen ${c.inner.h} mm`} ink={ink} />
      </g>
    );
  }
  return (
    <g>
      {title(L.top.x, L.top.y, 'Innenansicht Unterteil (von oben, vorne = unten)')}
      <rect x={L.top.x} y={L.top.y} width={d.L} height={d.W} rx={6} fill={c.color} stroke={shade(c.color, 0.35)} strokeWidth={1.2} />
      <InlayView c={c} layer="body" x0={L.top.x + wall} y0={L.top.y + wall} ink={ink} props={props} />
      {L.lid ? <>
        {title(L.lid.x, L.lid.y, 'Deckel-Einlage (von innen)')}
        <rect x={L.lid.x} y={L.lid.y} width={d.L} height={d.W} rx={6} fill={c.color} stroke={shade(c.color, 0.35)} strokeWidth={1.2} />
        <InlayView c={c} layer="lid" x0={L.lid.x + wall} y0={L.lid.y + wall} ink={ink} props={props} />
      </> : null}
      {title(L.front.x, L.front.y - 30, 'Vorderansicht')}
      <g transform={`translate(${L.front.x},${L.front.y})`}><OutsideView c={c} face="front" w={d.L} ink={ink} /></g>
      {L.side ? <>
        {title(L.side.x, L.side.y - 30, 'Seitenansicht (links)')}
        <g transform={`translate(${L.side.x},${L.side.y})`}><OutsideView c={c} face="left" w={d.W} ink={ink} /></g>
      </> : null}
    </g>
  );
}

/** standalone svg (exports) */
export function CaseSheetSvg(props: CaseSheetProps) {
  const L = sheetLayout(props.c);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`-70 -20 ${L.w + 90} ${L.h + 20}`} width={L.w + 90} height={L.h + 20} fontFamily="Inter, Arial, Helvetica, sans-serif">
      {props.light ? <rect x={-70} y={-20} width={L.w + 90} height={L.h + 20} fill="#ffffff" /> : null}
      <CaseSheet {...props} />
    </svg>
  );
}
