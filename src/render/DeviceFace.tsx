import type { DeviceTemplate, Face, ModuleBay, PlacedDevice } from '../model/types';
import { panelHeight } from '../model/geometry';
import { connectorDef } from '../model/connectors';
import { ConnectorSymbol } from './ConnectorSymbol';
import { MountingHoles, PanelArt } from './PanelArt';
import { ArtLayer } from './DeviceArt';
import { DrawerFront } from './DrawerFront';
import { devicePorts, moduleChoice } from '../model/modules';

export { moduleChoice };

export type PortState = 'normal' | 'connected' | 'highlight' | 'pending' | 'dim';

interface Props {
  tpl: DeviceTemplate;
  panel: Face;
  width: number;
  device?: PlacedDevice;
  portStates?: Record<string, PortState>;
  showPortLabels?: boolean;
  selected?: boolean;
  /** device is behind (seen through the rack, mounted on the opposite rails) */
  behind?: boolean;
}

const DEFAULT_EAR = 16;

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** gradients shared by all panels (ids repeat per panel, identical content, so the first one wins) */
export function FaceDefs() {
  return (
    <defs>
      <linearGradient id="df-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
        <stop offset="0.08" stopColor="#fff" stopOpacity={0.05} />
        <stop offset="0.55" stopColor="#fff" stopOpacity={0} />
        <stop offset="0.94" stopColor="#000" stopOpacity={0.12} />
        <stop offset="1" stopColor="#000" stopOpacity={0.3} />
      </linearGradient>
      <linearGradient id="df-ear" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={0.18} />
        <stop offset="0.85" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.35} />
      </linearGradient>
      <linearGradient id="df-ear-r" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={0.18} />
        <stop offset="0.85" stopColor="#000" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.35} />
      </linearGradient>
      <radialGradient id="df-knob" cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor="#fff" stopOpacity={0.32} />
        <stop offset="0.45" stopColor="#fff" stopOpacity={0.06} />
        <stop offset="1" stopColor="#000" stopOpacity={0.35} />
      </radialGradient>
      <linearGradient id="df-btn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
        <stop offset="0.5" stopColor="#fff" stopOpacity={0.04} />
        <stop offset="1" stopColor="#000" stopOpacity={0.3} />
      </linearGradient>
      <linearGradient id="df-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.14} />
        <stop offset="0.35" stopColor="#fff" stopOpacity={0.03} />
        <stop offset="0.36" stopColor="#fff" stopOpacity={0} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="df-batt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.2} />
        <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
        <stop offset="1" stopColor="#000" stopOpacity={0.4} />
      </linearGradient>
    </defs>
  );
}

/** Draws one device panel at (0,0) with size width × panelHeight. All units mm. */
export function DeviceFace({ tpl, panel, width, device, portStates, showPortLabels = true, selected, behind }: Props) {
  const h = panelHeight(tpl.heightU);
  const isFront = panel === 'front';
  const full = tpl.slots === 1;
  const EAR = tpl.earWidth ?? DEFAULT_EAR;
  const ports = devicePorts(tpl, device).filter((p) => p.side === panel);
  const name = device?.label || tpl.name;
  const isPanel = !!tpl.panel;
  const art = isFront ? tpl.art?.front : tpl.art?.rear;
  // body: rear chassis is narrower than the front panel (no rack ears); fractional devices may be narrower than their slot
  const kit = !!tpl.bodyWidth && tpl.bodyWidth < width - 1;
  const bodyW = kit ? tpl.bodyWidth! : width;
  const bodyX = kit ? (width - bodyW) / 2 : 0;
  // the rear chassis width does not depend on the (decorative) front ear width
  const chassisX = kit ? bodyX : !isFront && full && !isPanel ? DEFAULT_EAR : !isFront ? 3 : 0;
  const chassisW = kit ? bodyW : width - 2 * chassisX;
  const faceCol = isFront ? tpl.frontColor ?? tpl.color : shade(tpl.color, -0.2);
  const ink = luminance(faceCol) > 0.55 ? '#1f2328' : luminance(tpl.textColor || '#000') > 0.5 ? tpl.textColor : '#e5e7eb';
  const moduleNames = new Set((tpl.modules ?? []).map((m) => m.name));
  const fieldText = device?.fields ? Object.entries(device.fields).filter(([k, v]) => v && !moduleNames.has(k)).map(([, v]) => v).join(', ') : '';
  const blank = tpl.ports.length === 0 && !isPanel;
  const vent = tpl.id === 'gen-vent1';
  const hasLabelArea = !!art?.some((a) => a.t === 'labelArea');

  return (
    <g opacity={behind ? 0.8 : 1}>
      <FaceDefs />
      {/* rack kit (tray / filler plate) for half- and third-width devices */}
      {kit && isFront ? (
        <g>
          <rect x={0} y={0} width={width} height={h} rx={1} fill="#1b1c1f" stroke="#2c2e33" strokeWidth={0.4} />
          {full
            ? [5.95, h - 5.95].flatMap((y) => [8.75, width - 8.75].map((x) => <rect key={`${x}-${y}`} x={x - 5} y={y - 3.25} width={10} height={6.5} rx={3.25} fill="#0a0a0a" />))
            : [3.2, width - 3.2].map((x) => <circle key={x} cx={x} cy={h / 2} r={1.3} fill="#5a5d63" />)}
        </g>
      ) : null}
      {/* chassis */}
      <rect x={chassisX} y={0} width={chassisW} height={h} rx={1.2} fill={faceCol} stroke={selected ? '#22d3ee' : shade(faceCol, luminance(faceCol) > 0.55 ? -0.3 : 0.35)} strokeWidth={selected ? 1.4 : 0.5} />
      {/* brushed sheet: light top edge, darker bottom edge */}
      <rect x={chassisX + 0.3} y={0.3} width={chassisW - 0.6} height={h - 0.6} rx={1} fill="url(#df-sheen)" pointerEvents="none" />
      {isFront && full && !isPanel && !kit ? (
        <>
          <rect x={0} y={0} width={EAR} height={h} fill={shade(faceCol, luminance(faceCol) > 0.55 ? -0.08 : 0.1)} />
          <rect x={width - EAR} y={0} width={EAR} height={h} fill={shade(faceCol, luminance(faceCol) > 0.55 ? -0.08 : 0.1)} />
          <rect x={0} y={0} width={EAR} height={h} fill="url(#df-ear)" pointerEvents="none" />
          <rect x={width - EAR} y={0} width={EAR} height={h} fill="url(#df-ear-r)" pointerEvents="none" />
          <line x1={EAR} y1={0.4} x2={EAR} y2={h - 0.4} stroke="#000" strokeOpacity={0.55} strokeWidth={0.35} />
          <line x1={width - EAR} y1={0.4} x2={width - EAR} y2={h - 0.4} stroke="#000" strokeOpacity={0.55} strokeWidth={0.35} />
          {[5.95, h - 5.95].map((y) => (
            <g key={y}>
              <rect x={8.75 - 5} y={y - 3.25} width={10} height={6.5} rx={3.25} fill="#0a0a0a" />
              <rect x={width - 8.75 - 5} y={y - 3.25} width={10} height={6.5} rx={3.25} fill="#0a0a0a" />
            </g>
          ))}
        </>
      ) : null}
      {isFront && isPanel && tpl.panel ? <PanelArt pd={tpl.panel} /> : null}
      {!isFront && isPanel && tpl.panel ? <MountingHoles pd={tpl.panel} /> : null}
      {vent && isFront ? (
        <g>
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={40 + i * 13.5} y={h * 0.25} width={6} height={h * 0.5} rx={3} fill="#050505" />
          ))}
        </g>
      ) : null}
      {tpl.category === 'Zubehör' && tpl.id.includes('shelf') && isFront ? (
        <line x1={EAR} y1={h - 3} x2={width - EAR} y2={h - 3} stroke="#555" strokeWidth={1.2} />
      ) : null}

      {tpl.drawer && isFront ? (
        <DrawerFront width={width} h={h} device={device} ear={full ? EAR : 0} />
      ) : art ? (
        <>
          <ArtLayer items={art} ink={ink} device={device} />
          {(tpl.modules ?? []).filter((m) => (m.side ?? 'front') === panel).map((m) => <ModuleSlot key={m.name} bay={m} value={moduleChoice(tpl, m, device)} />)}
          {/* placed-device label as tape strip when the template defines no label area */}
          {isFront && device?.label && !hasLabelArea ? (
            <g pointerEvents="none">
              <rect x={chassisX + (full ? EAR : 0) + 1.5} y={h - 7} width={Math.min(60, device.label.length * 2.1 + 4)} height={5.4} rx={0.4} fill="#f5f5f0" stroke="#bbb" strokeWidth={0.2} />
              <text x={chassisX + (full ? EAR : 0) + 3.5} y={h - 3.1} fontSize={3.4} fill="#111" fontWeight={700} fontFamily="Inter, Arial, Helvetica, sans-serif">{device.label}</text>
            </g>
          ) : null}
        </>
      ) : !isPanel || !isFront ? (
        /* generic name plate: big when the panel has no connectors, small top-left otherwise */
        <g pointerEvents="none">
          <text
            x={isFront ? (full ? EAR + 5 : chassisX + 5) : chassisX + 4}
            y={ports.length ? 5.6 : tpl.heightU === 1 ? h / 2 - (blank ? -1.5 : 1) : h / 2 - 3}
            fontSize={ports.length ? 3.6 : blank ? 4.2 : 5.6}
            fontWeight={700}
            fill={ink}
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            opacity={blank ? 0.5 : behind ? 0.7 : 1}
          >
            {(isFront ? name : `${name} (Rückseite)`) + (ports.length && isFront && fieldText ? ` – ${fieldText}` : '')}
          </text>
          {!blank && !ports.length ? (
            <text
              x={isFront ? (full ? EAR + 5 : chassisX + 5) : chassisX + 4}
              y={tpl.heightU === 1 ? h / 2 + 6 : h / 2 + 4}
              fontSize={3.2}
              fill={ink}
              opacity={0.65}
              fontFamily="Inter, Arial, Helvetica, sans-serif"
            >
              {isFront ? [tpl.manufacturer, device?.label ? tpl.name : '', fieldText].filter(Boolean).join(', ') : tpl.manufacturer}
            </text>
          ) : null}
        </g>
      ) : (
        device?.label ? (
          <text x={width - 22} y={h - 3} fontSize={2.8} fill={ink} opacity={0.6} textAnchor="end" fontFamily="Inter, Arial, sans-serif" pointerEvents="none">
            {device.label}
          </text>
        ) : null
      )}

      {/* ports */}
      {ports.map((p) => {
        const st = portStates?.[p.id] ?? 'normal';
        const def = connectorDef(p.connector);
        return (
          <g key={p.id} data-port={device ? `${device.id}:${p.id}` : p.id} className="port" style={{ cursor: device ? 'crosshair' : undefined }}>
            <title>{`${name}, ${p.name} (${def.label})`}</title>
            {/* generous invisible hit area */}
            <circle cx={p.x} cy={p.y} r={Math.max(def.w, def.h) / 2 + 3} fill="transparent" />
            <ConnectorSymbol connector={p.connector} x={p.x} y={p.y} state={st} />
            {showPortLabels ? (
              <text
                // below the connector, or to its right when there is no room below
                x={p.y + Math.max(def.w, def.h) / 2 + 3.4 > h ? p.x + Math.max(def.w, def.h) / 2 + 2 : p.x}
                y={p.y + Math.max(def.w, def.h) / 2 + 3.4 > h ? p.y + 1 : p.y + Math.max(def.w, def.h) / 2 + 3.4}
                fontSize={2.6}
                textAnchor={p.y + Math.max(def.w, def.h) / 2 + 3.4 > h ? 'start' : 'middle'}
                fill={ink}
                opacity={0.85}
                fontFamily="Inter, Arial, Helvetica, sans-serif"
                pointerEvents="none"
              >
                {p.name}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
/** screw head with slot */
const Screw = ({ x, y, r = 1.2 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#8d9197" stroke="#2a2c30" strokeWidth={0.25} />
    <line x1={x - r * 0.7} y1={y + r * 0.35} x2={x + r * 0.7} y2={y - r * 0.35} stroke="#3a3c40" strokeWidth={0.35} />
  </g>
);
const Led = ({ x, y, c = '#22c55e', r = 0.75 }: { x: number; y: number; c?: string; r?: number }) => (
  <g><circle cx={x} cy={y} r={r} fill={c} stroke="#000" strokeWidth={0.2} /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff" opacity={0.5} /></g>
);

/** flat bodypack battery lying in its pocket, ends chamfered (SB900, AXT910, BA 70 …) */
function FlatBattery({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const c = Math.min(4.5, h * 0.3);
  const d = `M${x + c},${y} H${x + w - c} L${x + w},${y + c} V${y + h - c} L${x + w - c},${y + h} H${x + c} L${x},${y + h - c} V${y + c} Z`;
  return (
    <g>
      <path d={d} fill="#2a2d32" stroke="#6b7078" strokeWidth={0.35} />
      <path d={d} fill="url(#df-batt)" />
      <line x1={x + c + 1} y1={y + h * 0.28} x2={x + w - c - 1} y2={y + h * 0.28} stroke="#000" strokeOpacity={0.35} strokeWidth={0.3} />
      <line x1={x + c} y1={y + 0.6} x2={x + c} y2={y + h - 0.6} stroke="#000" strokeOpacity={0.3} strokeWidth={0.3} />
      <line x1={x + w - c} y1={y + 0.6} x2={x + w - c} y2={y + h - 0.6} stroke="#000" strokeOpacity={0.3} strokeWidth={0.3} />
    </g>
  );
}

/** pocket for a handheld battery seen from the front (SB920, AXT920, BA 61): bezel, battery end, eject tab */
function RoundPocket({ cx, y0, h }: { cx: number; y0: number; h: number }) {
  const w = Math.min(30, h * 0.75), top = y0 + h * 0.14, bot = y0 + h * 0.8;
  return (
    <g>
      <path d={`M${cx - w / 2},${bot} V${top + w * 0.3} Q${cx - w / 2},${top} ${cx - w * 0.2},${top} H${cx + w * 0.2} Q${cx + w / 2},${top} ${cx + w / 2},${top + w * 0.3} V${bot} Z`} fill="#16171a" stroke="#6b7078" strokeWidth={0.4} />
      <rect x={cx - w * 0.34} y={top + 2.2} width={w * 0.68} height={(bot - top) * 0.72} rx={w * 0.1} fill="#2a2d32" stroke="#4b5057" strokeWidth={0.3} />
      <rect x={cx - w * 0.34} y={top + 2.2} width={w * 0.68} height={(bot - top) * 0.72} rx={w * 0.1} fill="url(#df-batt)" />
      <circle cx={cx} cy={top + 2.2 + (bot - top) * 0.28} r={0.8} fill="#0b0c0e" />
      <rect x={cx - w * 0.22} y={bot - 1.2} width={w * 0.44} height={h * 0.13} rx={0.6} fill="#3a3d42" stroke="#6b7078" strokeWidth={0.3} />
      <path d={`M${cx - 1.4},${bot + h * 0.08} L${cx + 1.4},${bot + h * 0.08} L${cx},${bot + h * 0.08 - 1.6} Z`} fill="#c9ccd1" />
    </g>
  );
}

/** exchangeable module in a bay: charger module with battery pockets, plug-in card, or blank plate */
function ModuleSlot({ bay, value }: { bay: ModuleBay; value: string }) {
  const { x, y, w, h } = bay;
  const opt = bay.options.find((o) => o.id === value);
  const card = bay.style === 'card';
  const plate = (fill: string) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={0.6} fill={fill} stroke="#0a0a0b" strokeWidth={0.5} />
      <rect x={x + 0.3} y={y + 0.3} width={w - 0.6} height={h - 0.6} rx={0.5} fill="url(#df-sheen)" />
    </>
  );
  const corners = card
    ? (w >= h ? [[x + 3, y + h / 2], [x + w - 3, y + h / 2]] : [[x + w / 2, y + 3], [x + w / 2, y + h - 3]])
    : [[x + 4.5, y + 4.5], [x + w - 4.5, y + 4.5], [x + 4.5, y + h - 4.5], [x + w - 4.5, y + h - 4.5]];
  if (!value) {
    // blank plate with the module opening outline
    return (
      <g>
        {plate('#1d1f22')}
        {!card ? <rect x={x + w * 0.16} y={y + h * 0.22} width={w * 0.68} height={h * 0.56} rx={1} fill="none" stroke="#000" strokeOpacity={0.6} strokeWidth={0.4} /> : null}
        {corners.map(([cx, cy], i) => <Screw key={i} x={cx} y={cy} />)}
        <text x={x + w / 2} y={y + h / 2 + 0.7} fontSize={1.9} textAnchor="middle" fill="#8b9097">leer</text>
      </g>
    );
  }
  if (card) {
    return (
      <g>
        {plate('#2a2d32')}
        {corners.map(([cx, cy], i) => <Screw key={i} x={cx} y={cy} r={1.1} />)}
        <text x={x + (w >= h ? 6.5 : 3)} y={y + (w >= h ? 4.2 : 9)} fontSize={Math.min(2.4, h / 7, w / 12)} fill="#e5e7eb" fontWeight={700}>{value}</text>
        <Led x={x + w - (w >= h ? 6.5 : 3.5)} y={y + (w >= h ? 3.5 : 9)} />
      </g>
    );
  }
  const look = opt?.look ?? 'flat';
  const pad = 7;
  return (
    <g>
      {plate('#232529')}
      {corners.map(([cx, cy], i) => <Screw key={i} x={cx} y={cy} />)}
      {look === 'round' ? (
        <>
          <RoundPocket cx={x + w * 0.29} y0={y} h={h} />
          <RoundPocket cx={x + w * 0.71} y0={y} h={h} />
          <Led x={x + 3} y={y + h * 0.36} /><Led x={x + 3} y={y + h * 0.36 + 2.6} c="#f59e0b" />
          <Led x={x + w - 3} y={y + h * 0.62} /><Led x={x + w - 3} y={y + h * 0.62 + 2.6} c="#f59e0b" />
        </>
      ) : (
        <>
          {(() => {
            const bw = look === 'flat-small' ? (w - 2 * pad) * 0.66 : w - 2 * pad - 1;
            const bx = x + (w - bw) / 2, bh = (h - 9) / 2;
            return (
              <>
                <FlatBattery x={bx} y={y + 3.2} w={bw} h={bh} />
                <FlatBattery x={bx + 0.6} y={y + 3.2 + bh + 2.4} w={bw - 1.2} h={bh} />
                <Led x={bx - 2.6} y={y + 3.2 + bh * 0.35} /><Led x={bx - 2.6} y={y + 3.2 + bh * 0.35 + 2.4} c="#f59e0b" />
                <Led x={bx + bw + 2.6} y={y + h - 3.2 - bh * 0.65} /><Led x={bx + bw + 2.6} y={y + h - 3.2 - bh * 0.65 + 2.4} c="#f59e0b" />
              </>
            );
          })()}
        </>
      )}
      <text x={x + w / 2} y={y + h - 0.9} fontSize={1.5} textAnchor="middle" fill="#9aa0a8" opacity={0.85}>{value}</text>
    </g>
  );
}

export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)),
  );
  return '#' + ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}
