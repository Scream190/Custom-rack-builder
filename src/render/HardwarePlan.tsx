import type { FlightCase } from '../model/types';
import { FACE_LABELS, hardwarePlan, type PlanFace } from '../model/cases';

/*
 * Drilling plan for the workshop: every side with hardware, the pieces drawn at their usual outer size with numbers,
 * ordinate dimensions of the piece centres from the left and the bottom edge, and a list of all pieces with positions.
 */

const GAP = 150, MARGIN = 90, ROWH = 22, TABLE_W = 760;
const VIEW_TITLE: Record<string, string> = { front: 'Vorderseite', back: 'Rückseite', left: 'Seite links', right: 'Seite rechts', top: 'Deckel oben' };

/** placement of the side views (two per row) and of the list */
export function hardwarePlanLayout(c: FlightCase) {
  const faces = hardwarePlan(c);
  const pos: { f: PlanFace; x: number; y: number }[] = [];
  let y = 60, maxW = TABLE_W;
  for (let i = 0; i < faces.length; i += 2) {
    const row = faces.slice(i, i + 2);
    let x = MARGIN;
    for (const f of row) { pos.push({ f, x, y }); x += f.w + MARGIN + GAP; }
    maxW = Math.max(maxW, x);
    y += Math.max(...row.map((f) => f.h)) + 150;
  }
  const n = faces.reduce((s, f) => s + f.pieces.length, 0);
  const table = { x: MARGIN, y, h: 40 + (n + 1) * ROWH };
  return { faces: pos, table, w: maxW, h: table.y + table.h + 20, count: n };
}

function FaceView({ f, x, y, ink, light }: { f: PlanFace; x: number; y: number; ink: string; light?: boolean }) {
  const Y = (z: number) => f.h - z;
  const us = [...new Set(f.pieces.map((p) => p.u))].sort((a, b) => a - b);
  const zs = [...new Set(f.pieces.map((p) => p.z))].sort((a, b) => a - b);
  const fill = light ? '#e5e7eb' : '#334155';
  const vertical = f.face === 'top' ? 'von vorne' : 'von unten';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={-16} fontSize={20} fontWeight={700} fill={ink}>{`${VIEW_TITLE[f.face] ?? FACE_LABELS[f.face]} (${f.w.toFixed(0)} × ${f.h.toFixed(0)} mm)`}</text>
      <rect x={0} y={0} width={f.w} height={f.h} fill="none" stroke={ink} strokeWidth={2} />
      {f.shells.map((s, i) => <rect key={i} x={s.u0} y={Y(s.z1)} width={s.u1 - s.u0} height={s.z1 - s.z0} fill="none" stroke={ink} strokeWidth={1} strokeDasharray="8 6" opacity={0.7} />)}
      {f.pieces.map((p) => (
        <g key={p.n}>
          <rect x={p.u - p.w / 2} y={Y(p.z) - p.h / 2} width={p.w} height={p.h} rx={4} fill={fill} stroke={ink} strokeWidth={1.2} />
          <line x1={p.u - 10} y1={Y(p.z)} x2={p.u + 10} y2={Y(p.z)} stroke={ink} strokeWidth={1} />
          <line x1={p.u} y1={Y(p.z) - 10} x2={p.u} y2={Y(p.z) + 10} stroke={ink} strokeWidth={1} />
          <text x={p.u + 8} y={Y(p.z) - 8} fontSize={16} fontWeight={700} fill={ink}>{p.n}</text>
        </g>
      ))}
      {/* ordinates along the bottom: centres from the left edge */}
      <g stroke={ink} strokeWidth={1} fill={ink}>
        <line x1={0} y1={f.h + 24} x2={f.w} y2={f.h + 24} />
        <line x1={0} y1={f.h + 14} x2={0} y2={f.h + 34} />
        <text x={0} y={f.h + 52} fontSize={13} textAnchor="middle" stroke="none">0</text>
        {us.map((u) => <g key={u}><line x1={u} y1={f.h + 6} x2={u} y2={f.h + 34} strokeDasharray="3 3" /><text x={u + 4} y={f.h + 40} fontSize={13} stroke="none" transform={`rotate(90 ${u + 4} ${f.h + 40})`}>{u}</text></g>)}
        <text x={f.w} y={f.h + 52} fontSize={12} textAnchor="end" stroke="none" opacity={0.8}>von links</text>
      </g>
      {/* ordinates on the left: centres from the bottom edge (top: from the front edge) */}
      <g stroke={ink} strokeWidth={1} fill={ink}>
        <line x1={-24} y1={0} x2={-24} y2={f.h} />
        <line x1={-34} y1={f.h} x2={-14} y2={f.h} />
        <text x={-30} y={f.h + 5} fontSize={13} textAnchor="end" stroke="none">0</text>
        {zs.map((z) => <g key={z}><line x1={-34} y1={Y(z)} x2={-6} y2={Y(z)} strokeDasharray="3 3" /><text x={-38} y={Y(z) + 5} fontSize={13} textAnchor="end" stroke="none">{z}</text></g>)}
        <text x={-30} y={-4} fontSize={12} textAnchor="end" stroke="none" opacity={0.8}>{vertical}</text>
      </g>
    </g>
  );
}

/** the drilling plan as an svg <g> (wrap in <svg>) */
export function HardwarePlanSheet({ c, light }: { c: FlightCase; light?: boolean }) {
  const ink = light ? '#111' : '#cbd5e1';
  const L = hardwarePlanLayout(c);
  if (!L.count) return <text x={MARGIN} y={80} fontSize={20} fill={ink}>Keine Beschläge an den Außenseiten.</text>;
  const rows = L.faces.flatMap(({ f }) => f.pieces.map((p) => ({ p, f })));
  const cols = [0, 50, 340, 520, 640, 720];
  return (
    <g fontFamily="Inter, Arial, Helvetica, sans-serif">
      <text x={MARGIN} y={24} fontSize={22} fontWeight={700} fill={ink}>{`Bohrplan Beschläge, ${c.name}`}</text>
      <text x={MARGIN + 520} y={24} fontSize={13} fill={ink} opacity={0.75}>Maße zur Mitte des Beschlags, gesehen auf die jeweilige Seite; Teilegrößen sind übliche Außenmaße.</text>
      {L.faces.map(({ f, x, y }) => <FaceView key={f.face} f={f} x={x} y={y} ink={ink} light={light} />)}
      <g transform={`translate(${L.table.x},${L.table.y})`} fill={ink} fontSize={14}>
        {['Nr.', 'Beschlag', 'Artikel', 'Seite', 'von links', 'von unten / vorne'].map((h, i) => <text key={h} x={cols[i]} y={0} fontWeight={700}>{h}</text>)}
        <line x1={0} y1={8} x2={TABLE_W + 120} y2={8} stroke={ink} strokeWidth={1} />
        {rows.map(({ p, f }, i) => (
          <g key={p.n} transform={`translate(0,${(i + 1) * ROWH + 6})`}>
            <text x={cols[0]}>{p.n}</text>
            <text x={cols[1]}>{p.label}</text>
            <text x={cols[2]}>{p.sku ?? '–'}</text>
            <text x={cols[3]}>{VIEW_TITLE[f.face] ?? f.face}</text>
            <text x={cols[4]}>{`${p.u} mm`}</text>
            <text x={cols[5]}>{`${p.z} mm`}</text>
          </g>
        ))}
      </g>
    </g>
  );
}

/** standalone svg (PDF) */
export function HardwarePlanSvg({ c }: { c: FlightCase }) {
  const L = hardwarePlanLayout(c);
  const w = Math.max(L.w, 900) + 40, h = L.h + 20;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <rect x={0} y={0} width={w} height={h} fill="#ffffff" />
      <HardwarePlanSheet c={c} light />
    </svg>
  );
}
