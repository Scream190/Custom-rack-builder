import type { Assembly } from '../model/assembly';
import { formatLength } from '../model/geometry';
import { ConnectorSymbol } from './ConnectorSymbol';
import { CablePlugIcon } from './PlugIcon';

/*
 * Cable assembly drawings ("Konfektion"): each kind of cable with the cable connectors it needs, length and count,
 * Y cables with their branches, followed by the connector demand. Plain SVG (px-like units) – used in the cable
 * list and, rendered to markup, in the PDF.
 */

export const SHEET_W = 760;
const ROW = 34, BRANCH = 26;
const X_COUNT = 4, X_LINE_START = 82, X_SPLIT = 176, X_LINE_END = 320, X_TEXT = 376;

export const assemblyHeight = (a: Assembly) => (a.branches.length > 1 ? a.branches.length * BRANCH + 12 : ROW);

/** panel-mount connector from the front (mm-sized symbol scaled into ~26 units) – only for parts built into boxes/panels */
function PanelPlug({ k, x, y, ring }: { k: string; x: number; y: number; ring?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(0.9)`}>
      <ConnectorSymbol connector={k} x={0} y={0} ring={!!ring} />
    </g>
  );
}

function LengthTag({ x, y, text, light }: { x: number; y: number; text: string; light?: boolean }) {
  const w = text.length * 5.6 + 8;
  return (
    <g>
      <rect x={x - w / 2} y={y - 6} width={w} height={12} rx={2} fill={light ? '#ffffff' : '#171a1f'} stroke={light ? '#9ca3af' : '#3a404a'} strokeWidth={0.6} />
      <text x={x} y={y + 3.4} fontSize={9.5} textAnchor="middle" fontWeight={700} fill={light ? '#111' : '#e5e7eb'}>{text}</text>
    </g>
  );
}

function AssemblyRow({ a, y, light }: { a: Assembly; y: number; light?: boolean }) {
  const h = assemblyHeight(a);
  const mid = y + h / 2;
  const ink = light ? '#111' : '#e5e7eb', muted = light ? '#555' : '#8b939e';
  const stroke = (d: string) => (
    <>
      <path d={d} fill="none" stroke={light ? '#555' : '#000'} strokeOpacity={0.6} strokeWidth={5.2} strokeLinecap="round" />
      <path d={d} fill="none" stroke={a.color} strokeWidth={4} strokeLinecap="round" />
    </>
  );
  const many = a.branches.length > 1;
  const by = (i: number) => y + 6 + BRANCH / 2 + i * BRANCH;
  const numbers = a.numbers.length > 8 ? `${a.numbers.slice(0, 8).join(', ')} …` : a.numbers.join(', ');
  return (
    <g>
      <text x={X_COUNT} y={mid + 5} fontSize={14} fontWeight={700} fill={ink}>{a.count}×</text>
      {many ? (
        <>
          {stroke(`M${X_LINE_START},${mid} H${X_SPLIT}`)}
          {a.branches.map((_, i) => <g key={i}>{stroke(`M${X_SPLIT},${mid} V${by(i)} H${X_LINE_END}`)}</g>)}
          <circle cx={X_SPLIT} cy={mid} r={4} fill={a.color} stroke={light ? '#555' : '#000'} strokeWidth={0.8} />
          {a.branches.map((b, i) => (
            <g key={'b' + i}>
              <LengthTag x={(X_SPLIT + X_LINE_END) / 2 + 10} y={by(i)} text={formatLength(b.length)} light={light} />
              <CablePlugIcon kind={b.plug.key} x={X_LINE_END} y={by(i)} flip />
            </g>
          ))}
        </>
      ) : (
        <>
          {stroke(`M${X_LINE_START},${mid} H${X_LINE_END}`)}
          <LengthTag x={(X_LINE_START + X_LINE_END) / 2} y={mid} text={formatLength(a.branches[0].length)} light={light} />
          <CablePlugIcon kind={a.branches[0].plug.key} x={X_LINE_END} y={mid} flip />
        </>
      )}
      <CablePlugIcon kind={a.common.key} x={X_LINE_START} y={mid} />
      <text x={X_TEXT} y={mid - (many ? 9 : 4)} fontSize={10.5} fontWeight={700} fill={ink}>
        {a.typeName}{many ? ` – Y-Kabel, ${a.branches.length} Äste` : ''}
      </text>
      <text x={X_TEXT} y={mid + (many ? 3 : 8)} fontSize={9} fill={muted}>
        {many ? `${a.common.label} → ${a.branches.map((b) => b.plug.label).join(' / ')}` : `${a.common.label} ↔ ${a.branches[0].plug.label}`}
      </text>
      <text x={X_TEXT} y={mid + (many ? 15 : 19)} fontSize={8.5} fill={muted}>{numbers}</text>
    </g>
  );
}

/** The drawing of a list of assemblies (and optionally the connector demand). Returns the svg element. */
type Demand = { key: string; label: string; count: number }[];

/** a titled grid of connectors with counts; `panel` = panel-mount parts (front view), otherwise cable connectors (side view) */
function DemandGrid({ title, items, top, panel, light }: { title: string; items: Demand; top: number; panel?: boolean; light?: boolean }) {
  const ink = light ? '#111' : '#e5e7eb';
  const cols = 2, row = 30;
  return (
    <g>
      <line x1={0} y1={top - 10} x2={SHEET_W} y2={top - 10} stroke={light ? '#9ca3af' : '#3a404a'} strokeWidth={1} />
      <text x={4} y={top + 6} fontSize={12} fontWeight={700} fill={ink}>{title}</text>
      {items.map((d, i) => {
        const cx = (i % cols) * (SHEET_W / cols), cy = top + 22 + Math.floor(i / cols) * row + row / 2;
        return (
          <g key={d.label}>
            {panel ? <PanelPlug k={d.key} x={cx + 26} y={cy} ring={!light} /> : <CablePlugIcon kind={d.key} x={cx + 46} y={cy} />}
            <text x={cx + 54} y={cy + 4.5} fontSize={13} fontWeight={700} fill={ink}>{d.count}×</text>
            <text x={cx + 90} y={cy + 4} fontSize={10.5} fill={ink}>{d.label}</text>
          </g>
        );
      })}
    </g>
  );
}
const demandHeight = (items?: Demand) => (items?.length ? 40 + Math.ceil(items.length / 2) * 30 : 0);

export function AssemblySheet({ assemblies, demand, panels, light, title }: { assemblies: Assembly[]; demand?: Demand; panels?: Demand; light?: boolean; title?: string }) {
  const ink = light ? '#111' : '#e5e7eb';
  let y = title ? 22 : 4;
  const rows = assemblies.map((a) => { const r = { a, y }; y += assemblyHeight(a) + 8; return r; });
  const demandTop = y + 18;
  const panelTop = demandTop + demandHeight(demand);
  const H = panelTop + (panels?.length ? demandHeight(panels) : -18) + 4;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SHEET_W} ${H}`} width={SHEET_W} height={H} fontFamily="Inter, Arial, Helvetica, sans-serif" style={{ display: 'block' }}>
      {light ? <rect x={0} y={0} width={SHEET_W} height={H} fill="#ffffff" /> : null}
      {title ? <text x={4} y={14} fontSize={12} fontWeight={700} fill={ink}>{title}</text> : null}
      {rows.map(({ a, y: ry }, i) => (
        <g key={a.key}>
          {i ? <line x1={0} y1={ry - 4} x2={SHEET_W} y2={ry - 4} stroke={light ? '#e5e7eb' : '#2b3038'} strokeWidth={0.8} /> : null}
          <AssemblyRow a={a} y={ry} light={light} />
        </g>
      ))}
      {demand?.length ? <DemandGrid title="Steckerbedarf Kabel" items={demand} top={demandTop} light={light} /> : null}
      {panels?.length ? <DemandGrid title="Einbaustecker für Dosen und eigene Blenden" items={panels} top={panelTop} panel light={light} /> : null}
    </svg>
  );
}
