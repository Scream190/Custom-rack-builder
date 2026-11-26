import type { DeviceTemplate, Face, ModuleBay, PlacedDevice } from '../model/types';
import { panelHeight } from '../model/geometry';
import { connectorDef } from '../model/connectors';
import { ConnectorSymbol } from './ConnectorSymbol';
import { MountingHoles, PanelArt } from './PanelArt';
import { ArtLayer } from './DeviceArt';
import { DrawerFront } from './DrawerFront';

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

/** Draws one device panel at (0,0) with size width × panelHeight. All units mm. */
export function DeviceFace({ tpl, panel, width, device, portStates, showPortLabels = true, selected, behind }: Props) {
  const h = panelHeight(tpl.heightU);
  const isFront = panel === 'front';
  const full = tpl.slots === 1;
  const EAR = tpl.earWidth ?? DEFAULT_EAR;
  const ports = tpl.ports.filter((p) => p.side === panel);
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
      {isFront && full && !isPanel && !kit ? (
        <>
          <rect x={0} y={0} width={EAR} height={h} fill={shade(faceCol, luminance(faceCol) > 0.55 ? -0.08 : 0.1)} />
          <rect x={width - EAR} y={0} width={EAR} height={h} fill={shade(faceCol, luminance(faceCol) > 0.55 ? -0.08 : 0.1)} />
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
          {isFront ? (tpl.modules ?? []).map((m) => <ModuleSlot key={m.name} bay={m} value={moduleChoice(tpl, m, device)} />) : null}
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
/** module fitted in a bay of a placed device */
export function moduleChoice(_tpl: DeviceTemplate, m: ModuleBay, device?: Pick<PlacedDevice, "fields">): string {
  const v = device?.fields?.[m.name];
  return v === undefined ? m.default ?? '' : v;
}

/** charging bay: empty recess, or a module with two battery pockets and its name */
function ModuleSlot({ bay, value }: { bay: ModuleBay; value: string }) {
  const { x, y, w, h } = bay;
  if (!value) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={1} fill="#0c0d0f" stroke="#3a3d42" strokeWidth={0.4} />
        <text x={x + w / 2} y={y + h / 2 + 0.7} fontSize={2} textAnchor="middle" fill="#6b7280">leer</text>
      </g>
    );
  }
  if (bay.style === 'card') {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={0.8} fill="#2a2d32" stroke="#4b5057" strokeWidth={0.4} />
        <rect x={x + 2} y={y + 2} width={w - 4} height={Math.min(4, h / 4)} rx={0.5} fill="#121316" />
        <circle cx={x + w - 4} cy={y + h - 4} r={0.8} fill="#22c55e" />
        <text x={x + 3} y={y + h - 2.5} fontSize={Math.min(2.6, h / 6)} fill="#e5e7eb" fontWeight={700}>{value}</text>
      </g>
    );
  }
  const pw = (w - 9) / 2, ph = h - 9;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1} fill="#2a2d32" stroke="#4b5057" strokeWidth={0.4} />
      {[0, 1].map((i) => <rect key={i} x={x + 3 + i * (pw + 3)} y={y + 2} width={pw} height={ph} rx={1.2} fill="#121316" stroke="#55595f" strokeWidth={0.3} />)}
      {[0, 1].map((i) => <circle key={'l' + i} cx={x + 3 + i * (pw + 3) + pw / 2} cy={y + h - 4.5} r={0.7} fill="#22c55e" />)}
      <text x={x + w / 2} y={y + h - 1.2} fontSize={1.9} textAnchor="middle" fill="#e5e7eb" fontWeight={700}>{value}</text>
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
