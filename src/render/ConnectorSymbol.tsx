import { connectorDef, SIGNAL_COLORS } from '../model/connectors';

interface Props {
  connector: string;
  x: number;
  y: number;
  /** draw a coloured signal ring around the connector */
  ring?: boolean;
  state?: 'normal' | 'connected' | 'highlight' | 'pending' | 'dim';
}

const METAL = '#c9ccd1';
const DARK = '#0b0c0e';
const PLASTIC = '#1c1d20';

/** Simplified but recognisable front view of common connectors, drawn in mm around (x, y). */
export function ConnectorSymbol({ connector, x, y, ring = true, state = 'normal' }: Props) {
  const def = connectorDef(connector);
  const w = def.w;
  const h = def.h;
  const r = Math.max(w, h) / 2;
  const sig = SIGNAL_COLORS[def.signal];
  let body: JSX.Element;

  switch (def.shape) {
    case 'xlr': {
      const male = def.gender === 'm';
      body = (
        <>
          <rect x={-w / 2} y={-w / 2 - 1.5} width={w} height={w + 3} rx={2} fill={PLASTIC} stroke="#3a3c40" strokeWidth={0.4} />
          <circle r={w * 0.39} fill={male ? METAL : DARK} stroke={METAL} strokeWidth={0.8} />
          {male ? <circle r={w * 0.3} fill={DARK} /> : null}
          {[[-3.2, -1.5], [3.2, -1.5], [0, 3.2]].map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r={male ? 0.9 : 1.1} fill={male ? METAL : '#000'} stroke={male ? 'none' : '#555'} strokeWidth={0.3} />
          ))}
          <rect x={-2} y={-w / 2 - 0.5} width={4} height={2.4} rx={0.6} fill={male ? '#555' : METAL} />
        </>
      );
      break;
    }
    case 'combo':
      body = (
        <>
          <rect x={-w / 2} y={-w / 2 - 1.5} width={w} height={w + 3} rx={2} fill={PLASTIC} stroke="#3a3c40" strokeWidth={0.4} />
          <circle r={w * 0.4} fill={DARK} stroke={METAL} strokeWidth={0.8} />
          {[[-4.2, -2.6], [4.2, -2.6], [0, 5]].map(([px, py], i) => <circle key={i} cx={px} cy={py} r={1} fill="#000" stroke="#555" strokeWidth={0.3} />)}
          <circle r={3.6} fill="#1a1a1a" stroke={METAL} strokeWidth={0.6} />
          <circle r={1.7} fill="#000" />
          <rect x={-2} y={-w / 2 - 0.5} width={4} height={2.4} rx={0.6} fill={METAL} />
        </>
      );
      break;
    case 'bnc':
    case 'n':
      body = (
        <>
          {def.dSize ? <rect x={-w / 2 - 1} y={-w / 2 - 3} width={w + 2} height={w + 6} rx={2} fill={PLASTIC} /> : null}
          {def.shape === 'n'
            ? <polygon points={hexPoints(r * 0.95)} fill={METAL} stroke="#888" strokeWidth={0.3} />
            : <circle r={def.dSize ? r * 0.55 : r * 0.95} fill={METAL} stroke="#8a8d92" strokeWidth={0.4} />}
          <circle r={(def.dSize ? r * 0.55 : r) * 0.55} fill={DARK} />
          <circle r={0.7} fill="#e9e3c9" />
        </>
      );
      break;
    case 'sma':
      body = (<><polygon points={hexPoints(r)} fill="#d4b26a" /><circle r={r * 0.45} fill={DARK} /></>);
      break;
    case 'jack':
      body = (
        <>
          {def.dSize ? <rect x={-w / 2} y={-w / 2 - 2} width={w} height={w + 4} rx={2} fill={PLASTIC} /> : null}
          <circle r={def.dSize ? 6 : r * 0.9} fill={METAL} />
          <circle r={def.dSize ? 3.2 : r * 0.45} fill={DARK} />
        </>
      );
      break;
    case 'rj45':
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.6} fill={METAL} />
          <rect x={-w / 2 + 1.2} y={-h / 2 + 1.2} width={w - 2.4} height={h - 3.6} fill={DARK} />
          <rect x={-2} y={h / 2 - 2.6} width={4} height={1.8} fill={DARK} />
        </>
      );
      break;
    case 'ethercon':
    case 'opticalcon':
      body = (
        <>
          <rect x={-w / 2} y={-w / 2 - 2} width={w} height={w + 4} rx={2} fill={PLASTIC} />
          <circle r={11} fill="#2b2d31" stroke={METAL} strokeWidth={0.7} />
          {def.shape === 'ethercon'
            ? <><rect x={-6} y={-5} width={12} height={8.5} fill={DARK} stroke={METAL} strokeWidth={0.5} /><rect x={-2} y={3} width={4} height={1.6} fill={DARK} /></>
            : <><circle cx={-3.5} r={2} fill="#7dd3fc" /><circle cx={3.5} r={2} fill="#7dd3fc" /></>}
        </>
      );
      break;
    case 'iec': {
      const f = def.gender === 'f';
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1.5} fill={PLASTIC} stroke="#3a3c40" strokeWidth={0.4} />
          <path d={`M-9,-6 H9 V2 L5,6 H-5 L-9,2 Z`} fill={f ? DARK : '#2a2c30'} stroke="#555" strokeWidth={0.4} />
          {[[-4, -1], [4, -1], [0, 3]].map(([px, py], i) => (
            <rect key={i} x={px - 0.6} y={py - 1.4} width={1.2} height={2.8} fill={f ? '#000' : METAL} />
          ))}
        </>
      );
      break;
    }
    case 'powercon':
    case 'true1': {
      const isIn = connector.includes('IN');
      const col = def.shape === 'true1' ? (isIn ? '#facc15' : '#facc15') : isIn ? '#2563eb' : '#9ca3af';
      body = (
        <>
          <rect x={-w / 2} y={-w / 2 - 2} width={w} height={w + 4} rx={2} fill={PLASTIC} />
          <circle r={11.5} fill={col} />
          <circle r={8.5} fill={DARK} />
          {def.shape === 'true1' ? <circle r={8.5} fill="none" stroke="#111" strokeWidth={1.4} strokeDasharray="2 2" /> : null}
          <rect x={-1} y={-7.5} width={2} height={3} fill={col} />
        </>
      );
      break;
    }
    case 'schuko':
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#202125" stroke="#3a3c40" strokeWidth={0.4} />
          <circle r={w * 0.36} fill="#111" stroke="#444" strokeWidth={0.5} />
          <circle cx={-4.8} r={2} fill="#000" /><circle cx={4.8} r={2} fill="#000" />
          <rect x={-1.5} y={-w * 0.36} width={3} height={2} fill={METAL} /><rect x={-1.5} y={w * 0.36 - 2} width={3} height={2} fill={METAL} />
        </>
      );
      break;
    case 'speakon':
      body = (
        <>
          <rect x={-w / 2} y={-w / 2 - 2} width={w} height={w + 4} rx={2} fill={PLASTIC} />
          <circle r={11} fill="#111" stroke={METAL} strokeWidth={0.6} />
          <circle r={5} fill="#333" /><rect x={-1} y={-11} width={2} height={4} fill={METAL} />
        </>
      );
      break;
    case 'usb':
    case 'hdmi':
    case 'sfp':
    case 'dsub':
      body = (
        <>
          {def.dSize ? <rect x={-w / 2} y={-w / 2 - 2} width={w} height={w + 4} rx={2} fill={PLASTIC} /> : null}
          {def.shape === 'dsub'
            ? <path d={`M${-w / 2},${-h / 2} H${w / 2} L${w / 2 - 3},${h / 2} H${-w / 2 + 3} Z`} fill={METAL} />
            : <rect x={def.dSize ? -7 : -w / 2} y={def.dSize ? -3 : -h / 2} width={def.dSize ? 14 : w} height={def.dSize ? 6 : h} rx={0.8} fill={METAL} />}
          <rect x={(def.dSize ? -7 : -w / 2) + 1.4} y={(def.dSize ? -3 : -h / 2) + 1.2} width={(def.dSize ? 14 : w) - 2.8} height={(def.dSize ? 6 : h) - 2.4} fill={DARK} />
        </>
      );
      break;
    case 'cee': {
      // housing colour: blue = 230 V, red = 400 V
      const red = /_(3P|4P)$/.test(connector);
      const col = red ? '#dc2626' : '#2563eb';
      const pins = connector.endsWith('_4P') ? 4 : connector.endsWith('_3P') ? 5 : 3;
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={col} stroke="#111" strokeWidth={0.5} />
          <circle r={w * 0.36} fill="#111" stroke="#333" strokeWidth={0.5} />
          {Array.from({ length: pins }, (_, i) => {
            const a = (i / pins) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} cx={Math.cos(a) * w * 0.22} cy={Math.sin(a) * w * 0.22} r={1.4} fill={METAL} />;
          })}
        </>
      );
      break;
    }
    case 'phoenix': {
      const n = Math.max(2, Math.round(w / 5));
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.6} fill="#2f6f3a" stroke="#14351b" strokeWidth={0.4} />
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={-w / 2 + (w / n) * (i + 0.5)} cy={-h * 0.15} r={Math.min(1.4, w / n / 3)} fill={METAL} />
          ))}
        </>
      );
      break;
    }
    case 'harting':
      // rectangular multi-pin housing with locking lever
      body = (
        <>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill="#6b7280" stroke="#111" strokeWidth={0.5} />
          <rect x={-w / 2 + 4} y={-h / 2 + 4} width={w - 8} height={h - 8} rx={1} fill="#111" />
          {Array.from({ length: 8 }, (_, i) => [0, 1].map((r) => (
            <circle key={`${i}-${r}`} cx={-w / 2 + 8 + i * ((w - 16) / 7)} cy={r ? 3 : -3} r={0.9} fill={METAL} />
          )))}
          <rect x={-w / 2 - 2} y={-3} width={3} height={6} rx={1} fill="#9ca3af" />
          <rect x={w / 2 - 1} y={-3} width={3} height={6} rx={1} fill="#9ca3af" />
        </>
      );
      break;
    case 'socapex':
      body = (
        <>
          <circle r={r} fill={METAL} stroke="#666" strokeWidth={0.5} />
          <circle r={r * 0.78} fill="#111" />
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i / 18) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r * 0.35;
            return <circle key={i} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr} r={0.8} fill={METAL} />;
          })}
          <circle r={0.9} fill={METAL} />
        </>
      );
      break;
    case 'din':
      body = (
        <>
          <circle r={r} fill={METAL} />
          <circle r={r * 0.78} fill={DARK} />
          {[-60, -30, 0, 30, 60].map((d) => {
            const a = ((d - 90) * Math.PI) / 180;
            return <circle key={d} cx={Math.cos(a) * r * 0.5} cy={Math.sin(a) * r * 0.5} r={0.8} fill={METAL} />;
          })}
          <rect x={-1} y={r * 0.55} width={2} height={1.6} fill={METAL} />
        </>
      );
      break;
    case 'dc':
      body = (<><circle r={r} fill={METAL} /><circle r={r * 0.55} fill={DARK} /><circle r={0.8} fill={METAL} /></>);
      break;
    default:
      body = (<rect x={-w / 2} y={-h / 2} width={w} height={h} rx={1.5} fill="#444" stroke="#777" strokeWidth={0.4} />);
  }

  const ringR = r + 1.6;
  const ringColor = state === 'highlight' ? '#22d3ee' : state === 'pending' ? '#f43f5e' : sig;
  const ringOpacity = state === 'highlight' || state === 'pending' ? 1 : state === 'connected' ? 0.95 : 0.55;
  return (
    <g transform={`translate(${x},${y})`} opacity={state === 'dim' ? 0.35 : 1}>
      {(ring && state === 'connected') || state === 'highlight' || state === 'pending' ? (
        // wide connectors (D-Sub, Harting, SFP …) get a rounded rectangle instead of a huge circle
        w > h * 1.6 ? (
          <rect x={-w / 2 - 1.6} y={-h / 2 - 1.6} width={w + 3.2} height={h + 3.2} rx={2.5} fill="none" stroke={ringColor} strokeWidth={state === 'highlight' || state === 'pending' ? 1.6 : 0.9} opacity={ringOpacity} />
        ) : (
          <circle r={ringR} fill="none" stroke={ringColor} strokeWidth={state === 'highlight' || state === 'pending' ? 1.6 : 0.9} opacity={ringOpacity} />
        )
      ) : null}
      {body}
    </g>
  );
}

function hexPoints(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}
