/*
 * Side views of cable connectors (as opposed to ConnectorSymbol, which shows panel-mount connectors from the front).
 * Drawn with the cable exit at (0,0) and the body extending to negative x (mating face on the left); `flip` mirrors
 * the icon for cable ends that point to the right. Units ≈ px of the assembly sheet.
 */

const METAL = '#c9ccd1', METAL_D = '#8a8f96', BODY = '#26282c', BLACK = '#111214', EDGE = '#000';

/** tapered strain relief from the body (at x = -len) down to the cable (x = 0) */
const boot = (len: number, h: number, fill = BLACK) => <path d={`M0,-2.2 L${-len},${-h / 2} L${-len},${h / 2} L0,2.2 Z`} fill={fill} stroke={EDGE} strokeWidth={0.4} />;
const box = (x0: number, x1: number, h: number, fill: string, rx = 1.2) => <rect x={x0} y={-h / 2} width={x1 - x0} height={h} rx={rx} fill={fill} stroke={EDGE} strokeWidth={0.4} />;
const pins = (x0: number, len: number, ys: number[], w = 1.4, fill = METAL) => ys.map((y, i) => <rect key={i} x={x0 - len} y={y - w / 2} width={len} height={w} rx={w / 2} fill={fill} stroke={EDGE} strokeWidth={0.25} />);
const grooves = (x0: number, x1: number, h: number, n: number) =>
  Array.from({ length: n }, (_, i) => { const x = x0 + ((x1 - x0) * (i + 0.5)) / n; return <line key={i} x1={x} y1={-h / 2 + 1} x2={x} y2={h / 2 - 1} stroke={EDGE} strokeOpacity={0.55} strokeWidth={0.5} />; });

/** XLR-style round cable connector (also etherCON / opticalCON) */
function barrel(male: boolean, accent?: string, h = 13) {
  return (
    <>
      {boot(9, 9)}
      {box(-27, -9, h, BODY, 2)}
      {accent ? box(-24, -21, h + 0.4, accent, 0.4) : null}
      {male
        ? <>{box(-34, -27, h - 2, METAL, 0.6)}<rect x={-34} y={-(h - 5) / 2} width={4} height={h - 5} fill={BLACK} />{pins(-30, 3, [-2.4, 0, 2.4], 1)}</>
        : <>{box(-31, -27, h - 0.6, METAL, 0.6)}<rect x={-20} y={-h / 2 - 1.6} width={5} height={1.8} rx={0.6} fill={METAL_D} stroke={EDGE} strokeWidth={0.3} /></>}
    </>
  );
}

/** speakON / powerCON style: twist-lock ring */
function twist(ring: string, h = 16) {
  return (
    <>
      {boot(9, 10)}
      {box(-20, -9, h - 2, BODY, 2)}
      {box(-29, -19, h, ring, 1.5)}
      {grooves(-29, -19, h, 4)}
      {box(-33, -29, h - 4, BLACK, 0.6)}
    </>
  );
}

/** angled/straight mains plug body; male shows pins */
function mains(male: boolean, h: number, len: number, fill = BLACK, pinYs = [-3.5, 3.5]) {
  return (
    <>
      {boot(7, 8, fill)}
      {box(-7 - len, -7, h, fill, 3)}
      {male ? pins(-7 - len, 6, pinYs, 1.6) : <rect x={-8.5 - len} y={-h / 2 + 2} width={2} height={h - 4} rx={0.6} fill="#333" stroke={EDGE} strokeWidth={0.3} />}
    </>
  );
}

function cee(male: boolean, color: string, h = 20) {
  return (
    <>
      {boot(8, 9, color)}
      {box(-22, -8, h - 2, color, 3)}
      {box(-30, -22, h, color, 2)}
      {grooves(-30, -22, h, 3)}
      {male ? pins(-30, 6, [-5, 0, 5], 1.8) : <rect x={-33} y={-h / 2 + 1} width={3} height={h - 2} rx={1} fill={color} stroke={EDGE} strokeWidth={0.4} />}
    </>
  );
}

export function CablePlugIcon({ kind, x, y, flip }: { kind: string; x: number; y: number; flip?: boolean }) {
  let g: JSX.Element;
  switch (kind) {
    case 'xlr-m': g = barrel(true); break;
    case 'xlr-f': g = barrel(false); break;
    case 'ethercon': g = barrel(true, '#22c55e'); break;
    case 'opticalcon': g = barrel(true, '#7dd3fc'); break;
    case 'speakon': g = twist('#3a3d42'); break;
    case 'speakon8': g = twist('#3a3d42', 18); break;
    case 'cacom': g = twist('#6b7280', 18); break;
    case 'powercon-blue': g = twist('#2563eb'); break;
    case 'powercon-grey': g = twist('#9ca3af'); break;
    case 'true1': g = twist('#facc15'); break;
    case 'jack': g = <>{boot(6, 8)}{box(-22, -6, 10, BODY, 2)}{box(-37, -22, 4.4, METAL, 1.5)}{[-27, -31.5].map((xx) => <line key={xx} x1={xx} y1={-2.2} x2={xx} y2={2.2} stroke={EDGE} strokeWidth={0.9} />)}</>; break;
    case 'minijack': g = <>{boot(5, 6)}{box(-16, -5, 7, BODY, 1.5)}{box(-27, -16, 3, METAL, 1)}<line x1={-21} y1={-1.5} x2={-21} y2={1.5} stroke={EDGE} strokeWidth={0.7} /></>; break;
    case 'tt': g = <>{boot(5, 5)}{box(-14, -5, 6, BODY, 1.2)}{box(-30, -14, 2.6, METAL, 1)}<line x1={-25} y1={-1.3} x2={-25} y2={1.3} stroke={EDGE} strokeWidth={0.6} /></>; break;
    case 'rca': g = <>{boot(5, 7)}{box(-18, -5, 9, '#b91c1c', 2)}{box(-25, -18, 7.5, METAL, 0.6)}{pins(-25, 3, [0], 1.6)}</>; break;
    case 'bnc': case 'sma': case 'n': {
      const h = kind === 'n' ? 12 : kind === 'sma' ? 7 : 10;
      g = <>{boot(8, 6)}{box(-14, -8, h - 4, METAL_D, 0.6)}{box(-24, -14, h, METAL, 0.8)}{grooves(-24, -14, h, 5)}{box(-30, -24, h - 1, METAL, 0.8)}</>;
      break;
    }
    case 'rj45': g = <>{boot(6, 6)}<rect x={-22} y={-4.5} width={16} height={9} rx={0.8} fill="#cfe7ee" fillOpacity={0.8} stroke={EDGE} strokeWidth={0.4} />{[-20, -18.5, -17, -15.5].map((xx) => <line key={xx} x1={xx} y1={-3.5} x2={xx} y2={3.5} stroke="#d4a017" strokeWidth={0.5} />)}<path d="M-8,-4.5 L-19,-8 L-20,-7" fill="none" stroke="#9fc6d2" strokeWidth={1.2} /></>; break;
    case 'iec-f': g = mains(false, 13, 18); break;
    case 'iec-m': g = mains(true, 13, 18, BLACK, [-3, 0, 3]); break;
    case 'iec16-f': g = mains(false, 15, 20); break;
    case 'iec16-m': g = mains(true, 15, 20, BLACK, [-3.5, 0, 3.5]); break;
    case 'schuko-m': g = mains(true, 18, 16, '#1f2937'); break;
    case 'schuko-f': g = <>{boot(7, 8, '#1f2937')}{box(-26, -7, 20, '#1f2937', 4)}<rect x={-29} y={-9} width={3} height={18} rx={1} fill="#374151" stroke={EDGE} strokeWidth={0.4} /></>; break;
    case 'cee-blue-m': g = cee(true, '#2563eb'); break;
    case 'cee-blue-f': g = cee(false, '#2563eb'); break;
    case 'cee-red-m': g = cee(true, '#dc2626'); break;
    case 'cee-red-f': g = cee(false, '#dc2626'); break;
    case 'cee-red-l-m': g = cee(true, '#dc2626', 24); break;
    case 'cee-red-l-f': g = cee(false, '#dc2626', 24); break;
    case 'harting': g = <>{boot(6, 8, METAL_D)}{box(-30, -6, 16, '#6b7280', 1.5)}<path d="M-26,-8 Q-18,-14 -10,-8" fill="none" stroke="#9ca3af" strokeWidth={1.6} />{box(-34, -30, 13, '#4b5563', 0.6)}</>; break;
    case 'socapex': g = <>{boot(7, 10)}{box(-20, -7, 16, METAL_D, 2)}{box(-32, -20, 20, METAL, 1.5)}{grooves(-32, -20, 20, 5)}</>; break;
    case 'dsub': g = <>{boot(5, 7, '#6b7280')}<path d="M-5,-6 L-20,-8 L-20,8 L-5,6 Z" fill="#9ca3af" stroke={EDGE} strokeWidth={0.4} />{box(-26, -20, 10, METAL, 0.5)}<line x1={-21} y1={-9} x2={-21} y2={-11.5} stroke={METAL_D} strokeWidth={1.4} /><line x1={-21} y1={9} x2={-21} y2={11.5} stroke={METAL_D} strokeWidth={1.4} /></>; break;
    case 'usb': g = <>{boot(5, 5)}{box(-17, -5, 8, BODY, 1)}{box(-26, -17, 5, METAL, 0.4)}</>; break;
    case 'usbc': g = <>{boot(5, 5)}{box(-16, -5, 7, BODY, 1.5)}{box(-23, -16, 3.2, METAL, 1.2)}</>; break;
    case 'hdmi': g = <>{boot(5, 6)}{box(-18, -5, 9, BODY, 1)}<path d="M-18,-3 L-27,-3 L-27,2 L-26,3 L-18,3 Z" fill={METAL} stroke={EDGE} strokeWidth={0.4} /></>; break;
    case 'lc': g = <>{boot(6, 5, '#e5e7eb')}{box(-17, -6, 8, '#60a5fa', 1)}{pins(-17, 5, [-2, 2], 1.6, '#f5f5f4')}</>; break;
    case 'toslink': g = <>{boot(5, 5)}{box(-16, -5, 8, BODY, 1)}{box(-22, -16, 6, '#3f3f46', 0.5)}</>; break;
    case 'din': g = <>{boot(6, 7)}{box(-20, -6, 11, BLACK, 2)}{box(-27, -20, 9, METAL, 0.6)}</>; break;
    case 'dc': g = <>{boot(5, 5)}{box(-15, -5, 7, BLACK, 1.5)}{box(-24, -15, 4.4, METAL, 0.6)}</>; break;
    case 'phoenix': g = <>{boot(4, 5)}{box(-18, -4, 10, '#2f6f3a', 0.6)}{[-15, -11, -7].map((xx) => <circle key={xx} cx={xx} cy={-2.5} r={1} fill={METAL} />)}</>; break;
    default: g = <>{boot(5, 6)}{box(-20, -5, 10, '#6b7280', 1.5)}</>;
  }
  return <g transform={`translate(${x},${y})${flip ? ' scale(-1,1)' : ''}`}>{g}</g>;
}
