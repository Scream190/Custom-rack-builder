import type { CaseFace, FlightCase, Project } from '../model/types';
import { baseInner, caseBoxes, caseDims, footprint, isDrawer, usableArea, type CaseBox } from '../model/cases';
import { shade } from './DeviceFace';
import { cutoutOutline, outlinePath } from '../model/inlay';

/*
 * Technical drawing of a flight case in mm (1 svg unit = 1 mm): inner top view with foam cut-outs (interactive in the
 * designer), front and side view with hardware, dimension lines. Drawer inlays: top view and section only.
 */

const GAP = 140, LABEL = 34;

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
export function fitLabel(text: string, width: number, fs: number, maxLines: number): string[] {
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

/** gradients and patterns used by the case drawing (ids are shared; identical definitions may appear twice) */
export function CaseDefs() {
  return (
    <defs>
      <linearGradient id="cs-alu-v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8e949c" /><stop offset="0.18" stopColor="#e9ecef" /><stop offset="0.55" stopColor="#c3c8ce" /><stop offset="1" stopColor="#9aa0a8" />
      </linearGradient>
      <linearGradient id="cs-alu-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef0f2" /><stop offset="0.35" stopColor="#c7ccd2" /><stop offset="0.8" stopColor="#aab0b8" /><stop offset="1" stopColor="#80868e" />
      </linearGradient>
      <linearGradient id="cs-chrome" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f8f9fa" /><stop offset="0.45" stopColor="#c9ced4" /><stop offset="0.6" stopColor="#eef0f2" /><stop offset="1" stopColor="#8c929a" />
      </linearGradient>
      <radialGradient id="cs-dome" cx="0.35" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#ffffff" /><stop offset="0.35" stopColor="#d9dde2" /><stop offset="0.85" stopColor="#7d838b" /><stop offset="1" stopColor="#5b6168" />
      </radialGradient>
      <linearGradient id="cs-recess" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#060708" /><stop offset="0.5" stopColor="#1d1f23" /><stop offset="1" stopColor="#34373c" />
      </linearGradient>
      <linearGradient id="cs-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#000000" stopOpacity="0.22" />
      </linearGradient>
      <radialGradient id="cs-hub" cx="0.4" cy="0.38" r="0.65">
        <stop offset="0" stopColor="#c4c9cf" /><stop offset="1" stopColor="#6b7178" />
      </radialGradient>
      {/* phenolic hammer-tone laminate */}
      <pattern id="cs-lam" patternUnits="userSpaceOnUse" width="14" height="12">
        <circle cx="3.5" cy="3" r="2.3" fill="#ffffff" fillOpacity="0.045" />
        <circle cx="10.5" cy="9" r="2.3" fill="#ffffff" fillOpacity="0.045" />
        <circle cx="4.2" cy="3.7" r="1.6" fill="#000000" fillOpacity="0.12" />
        <circle cx="11.2" cy="9.7" r="1.6" fill="#000000" fillOpacity="0.12" />
      </pattern>
      {/* closed-cell foam pores */}
      <pattern id="cs-foam" patternUnits="userSpaceOnUse" width="9" height="9">
        <circle cx="2" cy="3" r="0.9" fill="#000000" fillOpacity="0.16" />
        <circle cx="6.6" cy="7.1" r="0.7" fill="#000000" fillOpacity="0.14" />
        <circle cx="7.2" cy="1.6" r="0.6" fill="#ffffff" fillOpacity="0.08" />
        <circle cx="3.4" cy="7.6" r="0.5" fill="#ffffff" fillOpacity="0.07" />
      </pattern>
    </defs>
  );
}

const EDGE = '#3f444b';
const along = (a: number, b: number, step: number) => {
  const n = Math.max(1, Math.round((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
};
const Rivet = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="url(#cs-dome)" stroke="#5b6168" strokeWidth={0.4} />;

/** laminated panel with texture and soft shading */
function Panel({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      <rect x={x} y={y} width={w} height={h} fill="url(#cs-lam)" />
      <rect x={x} y={y} width={w} height={h} fill="url(#cs-shade)" />
    </g>
  );
}

/** ball corner seen from the front; (x, y) = outer corner, sx/sy = direction into the case */
function BallCorner({ x, y, sx, sy }: { x: number; y: number; sx: number; sy: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${sx},${sy})`}>
      <path d="M0,0 H48 Q47,10 38,16 L16,38 Q10,47 0,48 Z" transform="translate(2,3)" fill="#000" fillOpacity={0.35} />
      <path d="M0,0 H48 Q47,10 38,16 L16,38 Q10,47 0,48 Z" fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
      <circle cx={13} cy={13} r={16} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.8} />
      <Rivet x={34} y={9} r={2.2} /><Rivet x={9} y={34} r={2.2} />
    </g>
  );
}

/** chrome parts seen from the front, drawn around (0, 0) */
function Latch({ s, keeper }: { s: number; keeper: boolean }) {
  const closeH = 20, cy = closeH + 2 + 28 * s;
  return (
    <g>
      {keeper ? <g transform={`translate(0,${-closeH - 2})`}>
        <rect x={-20 * s} y={-18 * s} width={40 * s} height={18 * s} rx={2.5} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
        <rect x={-9 * s} y={-9 * s} width={18 * s} height={6 * s} rx={1.5} fill="url(#cs-recess)" />
        <Rivet x={-14 * s} y={-11 * s} r={2} /><Rivet x={14 * s} y={-11 * s} r={2} />
      </g> : null}
      <g transform={`translate(0,${cy})`}>
        <rect x={-34 * s + 2.5} y={-27 * s + 3.5} width={68 * s} height={54 * s} rx={6} fill="#000" fillOpacity={0.35} />
        <rect x={-34 * s} y={-27 * s} width={68 * s} height={54 * s} rx={6} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
        <rect x={-27 * s} y={-20 * s} width={54 * s} height={40 * s} rx={4.5} fill="url(#cs-recess)" />
        <rect x={-3.5 * s} y={-27 * s - (keeper ? closeH + 2 : 0)} width={7 * s} height={27 * s + (keeper ? closeH + 2 : 0)} rx={1.5} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} />
        <path transform={`scale(${s})`} d="M-22,0 C-22,-13 -6,-10 0,-4 C6,-10 22,-13 22,0 C22,13 6,10 0,4 C-6,10 -22,13 -22,0 Z" fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
        <circle r={4.5 * s} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.5} />
        {[[-29, -22], [29, -22], [-29, 22], [29, 22]].map(([rx, ry], j) => <Rivet key={j} x={rx * s} y={ry * s} r={2} />)}
      </g>
    </g>
  );
}
const RecessedHandle = () => (
  <g>
    <rect x={-72} y={-44} width={150} height={96} rx={10} fill="#000" fillOpacity={0.35} />
    <rect x={-75} y={-48} width={150} height={96} rx={10} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
    <rect x={-63} y={-36} width={126} height={72} rx={9} fill="url(#cs-recess)" />
    <rect x={-53} y={-3} width={6} height={20} fill="url(#cs-alu-v)" /><rect x={47} y={-3} width={6} height={20} fill="url(#cs-alu-v)" />
    <rect x={-52} y={10} width={104} height={13} rx={6.5} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
    {[[-66, -40], [66, -40], [-66, 40], [66, 40]].map(([rx, ry], j) => <Rivet key={j} x={rx} y={ry} />)}
  </g>
);
const StrapHandle = () => (
  <g>
    <path d="M-64,-11 Q0,-17 64,-11 L64,11 Q0,17 -64,11 Z" fill="#1a1b1e" stroke="#000" strokeWidth={0.6} />
    <path d="M-60,-6 Q0,-11 60,-6" stroke="#3a3d42" strokeWidth={1} fill="none" strokeDasharray="4 3" />
    <path d="M-60,6 Q0,11 60,6" stroke="#3a3d42" strokeWidth={1} fill="none" strokeDasharray="4 3" />
    {[-72, 72].map((ex) => <g key={ex}><rect x={ex - 10} y={-15} width={20} height={30} rx={3} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.6} /><Rivet x={ex} y={0} /></g>)}
  </g>
);
const LabelHolder = () => (
  <g>
    <rect x={-44} y={-26} width={92} height={58} rx={3} fill="#000" fillOpacity={0.3} />
    <rect x={-46} y={-29} width={92} height={58} rx={3} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
    <rect x={-39} y={-22} width={78} height={44} fill="#f3f1ec" />
    <line x1={-32} y1={-8} x2={22} y2={-8} stroke="#9ca3af" strokeWidth={1.4} />
    <line x1={-32} y1={4} x2={10} y2={4} stroke="#9ca3af" strokeWidth={1.4} />
    <Rivet x={-42} y={0} r={1.8} /><Rivet x={42} y={0} r={1.8} />
  </g>
);
function Dish({ kind }: { kind: string }) {
  const big = kind === 'dish-connector';
  const w = big ? 120 : kind === 'cable-gland' ? 70 : 100, h = big ? 80 : 70;
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
      <rect x={-w / 2 + 9} y={-h / 2 + 9} width={w - 18} height={h - 18} rx={5} fill="url(#cs-recess)" />
      {kind === 'dish-vent' ? [-3, -2, -1, 0, 1, 2, 3].map((k) => <rect key={k} x={k * 11 - 3} y={-h / 2 + 15} width={6} height={h - 30} rx={2} fill="url(#cs-alu-v)" />) : null}
      {kind === 'dish-connector' ? [-26, 26].map((x) => <circle key={x} cx={x} cy={0} r={13} fill="#111" stroke="#3a3d42" />) : null}
      {kind === 'cable-gland' ? <circle r={16} fill="#1b1c1f" stroke="#3a3d42" /> : null}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], j) => <Rivet key={j} x={sx * (w / 2 - 7)} y={sy * (h / 2 - 7)} r={2} />)}
    </g>
  );
}
const HingeLeaf = ({ closeH }: { closeH: number }) => (
  <g>
    <rect x={-30} y={-22 - closeH} width={60} height={22} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
    <rect x={-30} y={closeH} width={60} height={22} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
    <rect x={-30} y={-5} width={60} height={10} rx={5} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
  </g>
);

interface FaceRect { box: CaseBox; u0: number; u1: number; z0: number; z1: number }
/** the shells seen on one face, as rectangles in face coordinates (u across from the left as seen from outside, z up) */
function faceRects(c: FlightCase, face: CaseFace): { rects: FaceRect[]; w: number; H: number } {
  const boxes = caseBoxes(c);
  const L = boxes.reduce((m, b) => Math.max(m, b.x1), 0), W = boxes.reduce((m, b) => Math.max(m, b.y1), 0), H = boxes.reduce((m, b) => Math.max(m, b.z1), 0);
  const e = 0.5;
  const rects: FaceRect[] = [];
  for (const b of boxes) {
    if (face === 'front' && b.y0 < e) rects.push({ box: b, u0: b.x0, u1: b.x1, z0: b.z0, z1: b.z1 });
    if (face === 'back' && b.y1 > W - e) rects.push({ box: b, u0: L - b.x1, u1: L - b.x0, z0: b.z0, z1: b.z1 });
    if (face === 'left' && b.x0 < e) rects.push({ box: b, u0: W - b.y1, u1: W - b.y0, z0: b.z0, z1: b.z1 });
    if (face === 'right' && b.x1 > L - e) rects.push({ box: b, u0: b.y0, u1: b.y1, z0: b.z0, z1: b.z1 });
  }
  return { rects, w: face === 'front' || face === 'back' ? L : W, H };
}

/** one outside view (front = length, side = width) with the hardware of that face */
function OutsideView({ c, face, w, ink }: { c: FlightCase; face: CaseFace; w: number; ink: string }) {
  const d = caseDims(c);
  const { rects, H: Hc } = faceRects(c, face);
  const Y = (z: number) => Hc - z;
  const hw = c.hardware.filter((h) => h.face === face);
  const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const braked = c.hardware.filter((h) => h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const leg = c.profile === 'alu35' ? 35 : c.profile === 'alu30' ? 30 : 0;
  const closeH = 20;
  const lam = c.color;
  const e = 0.5;
  const lidRects = rects.filter((r) => r.box.role === 'lid');
  const zs = lidRects.length ? lidRects[0].z0 : Hc;
  const items: JSX.Element[] = [];
  const at = (key: string, x: number, y: number, el: JSX.Element, rot = 0) => items.push(<g key={key} transform={`translate(${x},${y})${rot ? ` rotate(${rot})` : ''}`}>{el}</g>);
  // the rectangle that carries handles, labels and dishes on this face: the base, else the door on this face
  const carrier = rects.find((r) => r.box.role === 'base') ?? rects.find((r) => r.box.role === 'door') ?? rects[0];
  hw.forEach((h, i) => {
    const isLatch = h.kind === 'butterfly' || h.kind === 'butterfly-small' || h.kind === 'draw-latch';
    const s = h.kind === 'butterfly' ? 1 : h.kind === 'draw-latch' ? 0.6 : 0.7;
    const seam = h.seam ?? 'lid';
    if ((isLatch || h.kind === 'hinge' || h.kind === 'piano-hinge') && seam !== 'lid') {
      // vertical door seam on this face
      const door = rects.find((r) => r.box.role === 'door' && r.box.side === seam);
      if (!door) return;
      const doorRight = door.u1 > w - e;
      const x = doorRight ? door.u0 : door.u1;
      for (let k = 0; k < h.count; k++) {
        const z = door.z0 + ((door.z1 - door.z0) * (k + 1)) / (h.count + 1);
        if (isLatch) at(`${i}-${k}`, x, Y(z), <Latch s={s} keeper />, doorRight ? 90 : -90);
        else at(`${i}-${k}`, x, Y(z), <HingeLeaf closeH={closeH} />, 90);
      }
      return;
    }
    if (isLatch || h.kind === 'hinge' || h.kind === 'piano-hinge') {
      if (!lidRects.length) return;
      const u0 = Math.min(...lidRects.map((r) => r.u0)), u1 = Math.max(...lidRects.map((r) => r.u1));
      if (h.kind === 'piano-hinge') { items.push(<rect key={i} x={u0 + 20} y={Y(zs) - 5} width={u1 - u0 - 40} height={10} rx={5} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />); return; }
      spread(u0, u1, h.count).forEach((x, k) => at(`${i}-${k}`, x, Y(zs), h.kind === 'hinge' ? <HingeLeaf closeH={closeH} /> : <Latch s={s} keeper />));
      return;
    }
    if (!carrier) return;
    const top = carrier.z1 - (carrier.box.closing.includes('top') ? closeH : 0);
    const mid = carrier.z0 + (top - carrier.z0) * 0.5;
    spread(carrier.u0, carrier.u1, h.count).forEach((x, k) => {
      const key = `${i}-${k}`;
      if (h.kind === 'handle-recessed') at(key, x, Y(mid), <RecessedHandle />);
      else if (h.kind === 'handle-strap' || h.kind === 'handle-surface') at(key, x, Y(mid), <StrapHandle />);
      else if (h.kind === 'label') at(key, x, Y(carrier.z0 + leg + 52), <LabelHolder />);
      else if (h.kind.startsWith('dish') || h.kind === 'cable-gland') at(key, x, Y(carrier.z0 + (top - carrier.z0) * 0.3), <Dish kind={h.kind} />);
    });
  });

  // aluminium angles along the outer border of the face, closing profiles along the seams between shells
  const strips: JSX.Element[] = [];
  const seams: JSX.Element[] = [];
  const corners: JSX.Element[] = [];
  rects.forEach((r, i) => {
    const shortB = r.z0 > e ? closeH : 0, shortT = r.z1 < Hc - e ? closeH : 0;
    const shortL = r.u0 > e ? closeH : 0, shortR = r.u1 < w - e ? closeH : 0;
    if (leg) {
      if (r.u0 < e) strips.push(<VStrip key={`l${i}`} x={0} y1={Y(r.z1) + (shortT || leg)} y2={Y(r.z0) - (shortB || leg)} leg={leg} />);
      if (r.u1 > w - e) strips.push(<VStrip key={`r${i}`} x={w - leg} y1={Y(r.z1) + (shortT || leg)} y2={Y(r.z0) - (shortB || leg)} leg={leg} />);
      if (r.z0 < e && !r.box.open.includes('bottom')) strips.push(<HStrip key={`b${i}`} y={Y(0) - leg} x1={r.u0 + shortL} x2={r.u1 - shortR} leg={leg} />);
      if (r.z1 > Hc - e && !r.box.open.includes('top')) strips.push(<HStrip key={`t${i}`} y={0} x1={r.u0 + shortL} x2={r.u1 - shortR} leg={leg} />);
    }
    // seams: the upper and the right edge of each rectangle that meets another one
    if (r.z1 < Hc - e) seams.push(<g key={`sh${i}`}>
      <rect x={r.u0 - 1} y={Y(r.z1)} width={r.u1 - r.u0 + 2} height={closeH} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
      <rect x={r.u0 - 1} y={Y(r.z1) - closeH} width={r.u1 - r.u0 + 2} height={closeH} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
      <rect x={r.u0 - 1} y={Y(r.z1) - 1} width={r.u1 - r.u0 + 2} height={2} fill="#0b0c0e" />
      {along(r.u0 + 60, r.u1 - 60, 150).map((x, j) => <g key={j}><Rivet x={x} y={Y(r.z1) - closeH / 2} /><Rivet x={x} y={Y(r.z1) + closeH / 2} /></g>)}
    </g>);
    if (r.u1 < w - e) seams.push(<g key={`sv${i}`}>
      <rect x={r.u1 - closeH} y={Y(r.z1) - 1} width={closeH} height={r.z1 - r.z0 + 2} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
      <rect x={r.u1} y={Y(r.z1) - 1} width={closeH} height={r.z1 - r.z0 + 2} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
      <rect x={r.u1 - 1} y={Y(r.z1) - 1} width={2} height={r.z1 - r.z0 + 2} fill="#0b0c0e" />
      {along(Y(r.z1) + 60, Y(r.z0) - 60, 150).map((y, j) => <g key={j}><Rivet x={r.u1 - closeH / 2} y={y} /><Rivet x={r.u1 + closeH / 2} y={y} /></g>)}
    </g>);
    if (c.cornerBalls) {
      const closedT = !r.box.open.includes('top'), closedB = !r.box.open.includes('bottom');
      if (r.u0 < e && r.z1 > Hc - e && closedT) corners.push(<BallCorner key={`c1${i}`} x={0} y={0} sx={1} sy={1} />);
      if (r.u1 > w - e && r.z1 > Hc - e && closedT) corners.push(<BallCorner key={`c2${i}`} x={w} y={0} sx={-1} sy={1} />);
      if (r.u0 < e && r.z0 < e && closedB) corners.push(<BallCorner key={`c3${i}`} x={0} y={Hc} sx={1} sy={-1} />);
      if (r.u1 > w - e && r.z0 < e && closedB) corners.push(<BallCorner key={`c4${i}`} x={w} y={Hc} sx={-1} sy={-1} />);
    }
  });
  const bodyBottom = Hc;
  const feet = c.hardware.some((h) => h.kind === 'foot');
  return (
    <g>
      {rects.map((r, i) => <Panel key={i} x={r.u0} y={Y(r.z1)} w={r.u1 - r.u0} h={r.z1 - r.z0} color={lam} />)}
      {strips}
      {seams}
      {items}
      {corners}
      {/* castors: plate, swivel, fork, wheel */}
      {castors ? [0.12, 0.88].map((f, i) => {
        const x = Math.max(60, Math.min(w - 60, w * f)), r = c.castorSize / 2;
        const cy = bodyBottom + d.castorH - r;
        const forkTop = bodyBottom + 16;
        return (
          <g key={i}>
            <rect x={x - 50} y={bodyBottom} width={100} height={6} rx={1.5} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.6} />
            <rect x={x - 28} y={bodyBottom + 6} width={56} height={10} rx={2} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
            <circle cx={x} cy={cy} r={r} fill="#25282d" stroke="#0d0e10" strokeWidth={1} />
            <circle cx={x} cy={cy} r={r * 0.86} fill="none" stroke="#33373d" strokeWidth={1.2} />
            <circle cx={x} cy={cy} r={r * 0.58} fill="url(#cs-hub)" stroke="#4b5057" strokeWidth={0.8} />
            <path d={`M${x - 24},${forkTop} L${x + 24},${forkTop} L${x + 12},${cy + 4} L${x - 12},${cy + 4} Z`} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
            <circle cx={x} cy={cy} r={6} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.6} />
            {i === 0 && braked ? <path d={`M${x + 14},${forkTop + 4} L${x + 44},${forkTop - 2} L${x + 46},${forkTop + 6} L${x + 16},${forkTop + 13} Z`} fill="#c62828" stroke="#7f1d1d" strokeWidth={0.6} /> : null}
          </g>
        );
      }) : null}
      {!castors && d.castorH ? [0.1, 0.9].map((f, i) => (feet
        ? <rect key={i} x={w * f - 20} y={bodyBottom} width={40} height={d.castorH} rx={6} fill="#2b2e34" />
        : <rect key={i} x={w * f - 35} y={bodyBottom} width={70} height={d.castorH} rx={3} fill="#2b2e34" />)) : null}
      <DimH x1={0} x2={w} y={d.H + 34} label={`${Math.round(w)} mm`} ink={ink} />
      <DimV y1={0} y2={d.H} x={w + 26} label={`${Math.round(d.H)} mm`} ink={ink} />
      {lidRects.length ? <DimV y1={0} y2={Y(zs)} x={-48} label={`${Math.round(Hc - zs)}`} ink={ink} /> : null}
    </g>
  );
}

function VStrip({ x, y1, y2, leg }: { x: number; y1: number; y2: number; leg: number }) {
  if (y2 <= y1) return null;
  return (
    <g>
      <rect x={x} y={y1} width={leg} height={y2 - y1} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} />
      <line x1={x < 1 ? leg - 1 : x + 1} y1={y1} x2={x < 1 ? leg - 1 : x + 1} y2={y2} stroke="#000" strokeOpacity={0.35} strokeWidth={1.4} />
      {along(y1 + 40, y2 - 40, 110).map((y, j) => <Rivet key={j} x={x + leg / 2} y={y} />)}
    </g>
  );
}
function HStrip({ y, x1, x2, leg }: { y: number; x1: number; x2: number; leg: number }) {
  if (x2 <= x1) return null;
  return (
    <g>
      <rect x={x1} y={y} width={x2 - x1} height={leg} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.5} />
      <line x1={x1} y1={y < 1 ? leg - 1 : y + 1} x2={x2} y2={y < 1 ? leg - 1 : y + 1} stroke="#000" strokeOpacity={0.35} strokeWidth={1.4} />
      {along(x1 + 70, x2 - 70, 120).map((x, j) => <Rivet key={j} x={x} y={y + leg / 2} />)}
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
  // foam lies in the base; doors are drawn as empty bays (a lid over the whole case carries foam everywhere)
  const r = layer === 'lid' && c.doors?.span === 'body' ? { x0: 0, x1: c.inner.l, y0: 0, y1: W } : baseInner(c);
  const doorBays = r.x1 - r.x0 < c.inner.l - 0.5 || r.y1 - r.y0 < W - 0.5;
  return (
    <g>
      {doorBays ? <rect x={x0} y={y0} width={c.inner.l} height={W} fill="#1c1e22" stroke={shade(c.foam.color, 0.4)} strokeWidth={1} strokeDasharray="6 5" /> : null}
      {doorBays ? (['front', 'back', 'left', 'right'] as const).map((s) => {
        const b = s === 'front' ? { x: 0, y: 0, w: c.inner.l, h: r.y0 } : s === 'back' ? { x: 0, y: r.y1, w: c.inner.l, h: W - r.y1 } : s === 'left' ? { x: 0, y: 0, w: r.x0, h: W } : { x: r.x1, y: 0, w: c.inner.l - r.x1, h: W };
        if (b.w < 1 || b.h < 1) return null;
        return <text key={s} x={x0 + b.x + b.w / 2} y={Y(b.y + b.h / 2) + 6} fontSize={Math.min(18, Math.max(9, Math.min(b.w, b.h) / 3))} textAnchor="middle" fill={ink} opacity={0.75}>{`Tür ${{ front: 'vorne', back: 'hinten', left: 'links', right: 'rechts' }[s]}, ${Math.round(s === 'front' || s === 'back' ? b.h : b.w)} mm`}</text>;
      }) : null}
      <rect x={x0 + r.x0} y={Y(r.y1)} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={c.foam.color} stroke={shade(c.foam.color, 0.4)} strokeWidth={1} />
      <rect x={x0 + r.x0} y={Y(r.y1)} width={r.x1 - r.x0} height={r.y1 - r.y0} fill="url(#cs-foam)" pointerEvents="none" />
      {c.foam.sides > 0 ? <rect x={x0 + area.x0} y={Y(area.y1)} width={area.x1 - area.x0} height={area.y1 - area.y0} fill="none" stroke={shade(c.foam.color, 0.5)} strokeWidth={1} strokeDasharray="8 6" /> : null}
      {layer === 'body' ? c.dividers.map((dv, i) => (
        dv.axis === 'x'
          ? <rect key={i} x={x0 + r.x0} y={Y(dv.pos) - 4} width={r.x1 - r.x0} height={8} fill="#a8a29e" />
          : dv.axis === 'y' ? <rect key={i} x={x0 + dv.pos - 4} y={Y(r.y1)} width={8} height={r.y1 - r.y0} fill="#a8a29e" /> : null
      )) : null}
      {layer === 'body' && c.drawers?.length ? <text x={x0 + (r.x0 + r.x1) / 2} y={Y((r.y0 + r.y1) / 2)} fontSize={18} textAnchor="middle" fill="#f5f5f4">{`${c.drawers.length} Schublade${c.drawers.length === 1 ? '' : 'n'} (${c.drawers.map((x) => x.h).join(' / ')} mm)`}</text> : null}
      {c.items.filter((it) => it.layer === layer).map((it) => {
        const f = footprint(it);
        const sel = props.selectedItemId === it.id, warn = props.warnItemIds?.has(it.id);
        const fs = Math.max(8, Math.min(22, f.l / Math.max(8, it.name.length) * 1.6, f.w / 3.2));
        const lines = fitLabel(it.name, f.l - 8, fs, f.w > fs * 4.2 ? 2 : 1);
        const showSize = f.w > fs * (lines.length + 1.6) * 1.15;
        const wallIn = Math.max(1.5, Math.min(6, f.l / 10, f.w / 10, it.h / 8));
        const dpath = outlinePath(cutoutOutline(it), (x) => x0 + x, Y);
        return (
          <g key={it.id} data-item={it.id} style={{ cursor: props.onItemPointerDown ? 'grab' : undefined }} onPointerDown={props.onItemPointerDown ? (e) => props.onItemPointerDown!(e, it.id) : undefined}>
            <clipPath id={`cc-${it.id}`}><path d={dpath} /></clipPath>
            <path d={dpath} fill={shade(c.foam.color, -0.72)} />
            <path d={dpath} fill="none" stroke={shade(c.foam.color, -0.38)} strokeWidth={wallIn * 2} clipPath={`url(#cc-${it.id})`} />
            <path d={dpath} fill="url(#cs-foam)" clipPath={`url(#cc-${it.id})`} />
            <path d={dpath} fill="none" stroke={warn ? '#ef4444' : sel ? '#22d3ee' : shade(c.foam.color, 0.35)} strokeWidth={sel || warn ? 3 : 1} />
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

/** case seen from above with the lid off: aluminium closing profile on the wall tops, ball corners below */
export function TopRim({ x, y, c }: { x: number; y: number; c: FlightCase }) {
  const d = caseDims(c);
  return (
    <g>
      <rect x={x} y={y} width={d.L} height={d.W} rx={3} fill="url(#cs-alu-h)" stroke="#3f444b" strokeWidth={0.8} />
      <rect x={x + 3} y={y + 3} width={d.L - 6} height={d.W - 6} rx={2} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
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
        <CaseDefs />
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
      <CaseDefs />
      {title(L.top.x, L.top.y, 'Innenansicht Unterteil (von oben, vorne = unten)')}
      <TopRim x={L.top.x} y={L.top.y} c={c} />
      <InlayView c={c} layer="body" x0={L.top.x + wall} y0={L.top.y + wall} ink={ink} props={props} />
      {L.lid ? <>
        {title(L.lid.x, L.lid.y, 'Deckel-Einlage (von innen)')}
        <TopRim x={L.lid.x} y={L.lid.y} c={c} />
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
