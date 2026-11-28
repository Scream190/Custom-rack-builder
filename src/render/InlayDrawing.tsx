import type { CaseItem, FlightCase } from '../model/types';
import { baseInner, caseDims, footprint, isDrawer, usableArea } from '../model/cases';
import { cutDepth, cutoutOutline, foamMaterial, FOAM_MATERIALS, inlayThickness, outlineBox, outlinePath } from '../model/inlay';
import { shade } from './DeviceFace';
import { CaseDefs, fitLabel } from './CaseDrawing';

/*
 * Cutting plan of a foam inlay (1 svg unit = 1 mm): top view of one layer with cut-out outlines (corner radii,
 * finger grips), engravings and dimensions of the selected cut-out, and a section showing the cut depths.
 */

export type InlayLayer = CaseItem['layer'];

/** font scale: small drawers get smaller lettering than big cases */
const unit = (c: FlightCase) => Math.max(0.55, Math.min(1.8, Math.max(c.inner.l, c.inner.w) / 650));

/** space the inlay occupies in the section: inner height of the drawer/container or of the case part */
function sectionHeight(c: FlightCase, layer: InlayLayer) {
  if (isDrawer(c) || c.kind === 'inlay') return c.inner.h;
  const d = caseDims(c);
  return layer === 'lid' ? c.lidH : d.bodyInner;
}

export function inlaySheetLayout(c: FlightCase, layer: InlayLayer) {
  const u = unit(c);
  const top = { x: 0, y: 46 * u, w: c.inner.l, h: c.inner.w };
  const sh = sectionHeight(c, layer);
  const section = { x: 0, y: top.y + top.h + 120 * u, w: c.inner.l, h: sh };
  return { u, top, section, w: c.inner.l + 110 * u, h: section.y + sh + 70 * u };
}

function Dim({ x1, y1, x2, y2, label, ink, fs, off = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; ink: string; fs: number; off?: number }) {
  const horiz = Math.abs(y2 - y1) < 0.01;
  const t = fs * 0.45;
  return (
    <g stroke={ink} strokeWidth={fs * 0.07} fill={ink}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {horiz
        ? <><line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} /><line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} /></>
        : <><line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} /><line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} /></>}
      {horiz
        ? <text x={(x1 + x2) / 2 + off} y={y1 - fs * 0.35} fontSize={fs} textAnchor="middle" stroke="none">{label}</text>
        : <text x={x1 + fs * 0.5} y={(y1 + y2) / 2 + fs * 0.35 + off} fontSize={fs} stroke="none">{label}</text>}
    </g>
  );
}

export interface InlaySheetProps {
  c: FlightCase;
  layer: InlayLayer;
  light?: boolean;
  selectedItemId?: string | null;
  warnItemIds?: Set<string>;
  onItemPointerDown?: (e: React.PointerEvent, itemId: string) => void;
}

export function InlaySheet(props: InlaySheetProps) {
  const { c, layer, light } = props;
  const L = inlaySheetLayout(c, layer);
  const { u, top, section } = L;
  const ink = light ? '#111' : '#cbd5e1';
  const W = c.inner.w;
  const X = (x: number) => top.x + x;
  const Y = (y: number) => top.y + W - y;
  const area = usableArea(c);
  const items = c.items.filter((i) => i.layer === layer);
  const foam = c.foam.color;
  const fsT = 19 * u, fsD = 14 * u;
  const sel = items.find((i) => i.id === props.selectedItemId);
  const mat = FOAM_MATERIALS[foamMaterial(c)];
  const thick = inlayThickness(c, layer);
  const base = layer === 'lid' ? c.foam.lid : c.foam.bottom;
  const title = (x: number, y: number, t: string) => <text x={x} y={y - 14 * u} fontSize={fsT} fontWeight={700} fill={ink}>{t}</text>;
  const container = isDrawer(c) ? 'Schublade' : c.kind === 'inlay' ? 'Behälter' : layer === 'lid' ? 'Deckel' : 'Unterteil';
  const d = !isDrawer(c) && c.kind !== 'inlay' ? caseDims(c) : null;
  const wall = d ? (d.L - c.inner.l) / 2 : 0;
  // foam of a flight case lies in the base (doors excluded); a lid over the whole case carries foam everywhere
  const fr = d && !(layer === 'lid' && c.doors?.span === 'body') ? baseInner(c) : { x0: 0, x1: c.inner.l, y0: 0, y1: W };

  return (
    <g>
      <CaseDefs />
      {title(top.x, top.y, `Zuschnitt ${container}, Draufsicht (vorne = unten)`)}
      {/* container edge */}
      {d ? <rect x={X(-wall)} y={top.y - wall} width={c.inner.l + 2 * wall} height={W + 2 * wall} rx={3} fill="url(#cs-alu-h)" stroke="#3f444b" strokeWidth={0.8} />
        : isDrawer(c) ? <rect x={X(-3)} y={top.y - 3} width={c.inner.l + 6} height={W + 6} fill="#1a1b1e" stroke="#4b5057" strokeWidth={1} />
          : <rect x={X(-4)} y={top.y - 4} width={c.inner.l + 8} height={W + 8} fill="none" stroke={ink} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="10 6" />}
      {/* foam */}
      {d && (fr.x0 > 0 || fr.y0 > 0 || fr.x1 < c.inner.l || fr.y1 < W) ? <rect x={X(0)} y={top.y} width={c.inner.l} height={W} fill="#1c1e22" /> : null}
      <rect x={X(fr.x0)} y={Y(fr.y1)} width={fr.x1 - fr.x0} height={fr.y1 - fr.y0} fill={foam} stroke={shade(foam, 0.4)} strokeWidth={1} />
      <rect x={X(fr.x0)} y={Y(fr.y1)} width={fr.x1 - fr.x0} height={fr.y1 - fr.y0} fill="url(#cs-foam)" pointerEvents="none" />
      {c.foam.sides > 0 ? <rect x={X(area.x0)} y={Y(area.y1)} width={area.x1 - area.x0} height={area.y1 - area.y0} fill="none" stroke={shade(foam, 0.5)} strokeWidth={1} strokeDasharray="8 6" pointerEvents="none" /> : null}
      {layer === 'body' ? c.dividers.map((dv, i) => (
        dv.axis === 'x'
          ? <rect key={i} x={X(0)} y={Y(dv.pos) - 3.5} width={c.inner.l} height={7} fill="#c8a77a" />
          : dv.axis === 'y' ? <rect key={i} x={X(dv.pos) - 3.5} y={top.y} width={7} height={W} fill="#c8a77a" /> : null
      )) : null}
      {/* cut-outs */}
      {items.map((it) => {
        const f = footprint(it);
        const pts = cutoutOutline(it);
        const dpath = outlinePath(pts, X, Y);
        const isSel = props.selectedItemId === it.id, warn = props.warnItemIds?.has(it.id);
        const wallIn = Math.max(1.5, Math.min(7, f.l / 10, f.w / 10, cutDepth(it) / 6));
        const fs = Math.max(7 * u, Math.min(20 * u, f.l / Math.max(8, it.name.length) * 1.6, f.w / 3.2));
        const lines = fitLabel(it.name, f.l - 8, fs, f.w > fs * 4.2 ? 2 : 1);
        const showSize = f.w > fs * (lines.length + 1.6) * 1.15;
        const cx = X(it.x + f.l / 2), cy = Y(it.y + f.w / 2);
        const box = outlineBox(pts);
        return (
          <g key={it.id} data-item={it.id} style={{ cursor: props.onItemPointerDown ? 'grab' : undefined }} onPointerDown={props.onItemPointerDown ? (e) => props.onItemPointerDown!(e, it.id) : undefined}>
            <clipPath id={`clip-${it.id}`}><path d={dpath} /></clipPath>
            <path d={dpath} fill={shade(foam, -0.72)} />
            {/* cut walls: a wide stroke clipped to the inside reads as depth */}
            <path d={dpath} fill="none" stroke={shade(foam, -0.38)} strokeWidth={wallIn * 2} clipPath={`url(#clip-${it.id})`} />
            <path d={dpath} fill="url(#cs-foam)" clipPath={`url(#clip-${it.id})`} />
            <path d={dpath} fill="none" stroke={warn ? '#ef4444' : isSel ? '#22d3ee' : shade(foam, 0.35)} strokeWidth={isSel || warn ? 3 : 1} />
            {lines.map((t, k) => (
              <text key={k} x={cx} y={cy + fs * (k - (lines.length - 1) / 2 - (showSize ? 0.45 : -0.35)) * 1.15} fontSize={fs} textAnchor="middle" fill="#f5f5f4" pointerEvents="none">{t}</text>
            ))}
            {showSize ? <text x={cx} y={cy + fs * ((lines.length - 1) / 2 * 1.15 + 1.1)} fontSize={fs * 0.75} textAnchor="middle" fill="#d6d3d1" pointerEvents="none">{`${f.l} × ${f.w}, T ${cutDepth(it)}`}</text> : null}
            {it.engrave ? <text x={cx} y={Y(box.y1) - 5 * u} fontSize={Math.max(6, 9 * u)} textAnchor="middle" fill={shade(foam, -0.55)} pointerEvents="none">{it.name}</text> : null}
          </g>
        );
      })}
      {/* overall dimensions */}
      <Dim x1={X(0)} y1={top.y + W + 34 * u} x2={X(c.inner.l)} y2={top.y + W + 34 * u} label={`${c.inner.l} mm`} ink={ink} fs={fsD} />
      <Dim x1={X(c.inner.l) + 30 * u} y1={top.y} x2={X(c.inner.l) + 30 * u} y2={top.y + W} label={`${W} mm`} ink={ink} fs={fsD} />
      {/* position of the selected cut-out */}
      {sel ? (() => {
        const f = footprint(sel);
        const yRow = Y(sel.y) + 16 * u, xCol = X(sel.x) - 16 * u;
        const acc = '#22d3ee';
        return (
          <g pointerEvents="none">
            {sel.x > 0.5 ? <Dim x1={X(0)} y1={yRow} x2={X(sel.x)} y2={yRow} label={`${Math.round(sel.x)}`} ink={acc} fs={fsD * 0.85} /> : null}
            <Dim x1={X(sel.x)} y1={yRow} x2={X(sel.x + f.l)} y2={yRow} label={`${f.l}`} ink={acc} fs={fsD * 0.85} />
            {sel.y > 0.5 ? <Dim x1={xCol} y1={Y(0)} x2={xCol} y2={Y(sel.y)} label={`${Math.round(sel.y)}`} ink={acc} fs={fsD * 0.85} /> : null}
            <Dim x1={xCol} y1={Y(sel.y)} x2={xCol} y2={Y(sel.y + f.w)} label={`${f.w}`} ink={acc} fs={fsD * 0.85} />
          </g>
        );
      })() : null}

      {/* section: base foam, inlay layer and the cut depths, seen from the front */}
      {title(section.x, section.y, `Schnitt von vorne, ${mat.label}`)}
      <rect x={section.x} y={section.y} width={section.w} height={section.h} fill="none" stroke={ink} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="10 6" />
      {base > 0 ? <rect x={section.x} y={section.y + section.h - base} width={section.w} height={base} fill={foam} stroke={shade(foam, 0.35)} strokeWidth={0.8} /> : null}
      {thick > 0 ? <rect x={section.x + area.x0} y={section.y + section.h - base - thick} width={area.x1 - area.x0} height={thick} fill={shade(foam, 0.08)} stroke={shade(foam, 0.35)} strokeWidth={0.8} /> : null}
      {c.foam.sides > 0 ? [0, section.w - c.foam.sides].map((x, i) => <rect key={i} x={section.x + x} y={section.y + section.h - base - Math.min(thick || section.h - base, section.h - base)} width={c.foam.sides} height={Math.min(thick || section.h - base, section.h - base)} fill={shade(foam, 0.05)} stroke={shade(foam, 0.35)} strokeWidth={0.6} />) : null}
      {items.map((it) => {
        const f = footprint(it);
        const dep = Math.min(cutDepth(it), thick);
        const yTop = section.y + section.h - base - thick;
        return (
          <g key={it.id}>
            <rect x={section.x + it.x} y={yTop} width={f.l} height={dep} fill={shade(foam, -0.72)} />
            <rect x={section.x + it.x + 2} y={yTop + dep - Math.min(it.h, dep)} width={Math.max(1, f.l - 4)} height={Math.min(it.h, dep)} fill="#4b5563" opacity={0.55} />
          </g>
        );
      })}
      <Dim x1={section.x + section.w + 26 * u} y1={section.y} x2={section.x + section.w + 26 * u} y2={section.y + section.h} label={`${Math.round(section.h)} mm innen`} ink={ink} fs={fsD} />
      {thick > 0 ? <Dim x1={section.x - 22 * u} y1={section.y + section.h - base - thick} x2={section.x - 22 * u} y2={section.y + section.h - base} label="" ink={ink} fs={fsD} /> : null}
      {thick > 0 ? <text x={section.x - 28 * u} y={section.y + section.h - base - thick / 2 + 4} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{thick}</text> : null}
      {base > 0 ? <text x={section.x - 28 * u} y={section.y + section.h - base / 2 + 4} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{base}</text> : null}
    </g>
  );
}

/** standalone svg (exports) */
export function InlaySheetSvg(props: InlaySheetProps) {
  const L = inlaySheetLayout(props.c, props.layer);
  const pad = 80 * L.u;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${-pad} ${-10} ${L.w + pad + 20} ${L.h + 20}`} width={L.w + pad + 20} height={L.h + 20} fontFamily="Inter, Arial, Helvetica, sans-serif">
      {props.light ? <rect x={-pad} y={-10} width={L.w + pad + 20} height={L.h + 20} fill="#ffffff" /> : null}
      <InlaySheet {...props} />
    </svg>
  );
}
