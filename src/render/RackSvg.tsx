import type { Face, Project, Rack } from '../model/types';
import { deviceTopY, deviceViewX, faceWidth, holeSpacing, PANEL_GAP, railOpening, U } from '../model/geometry';
import { connectorDef } from '../model/connectors';
import { DeviceFace, shade, type PortState } from './DeviceFace';
import { computeCableDrawings } from './cablePaths';

export interface Ghost {
  x: number;
  yTop: number;
  w: number;
  h: number;
  ok: boolean;
  label: string;
}

export interface RackSvgProps {
  project: Project;
  rack: Rack;
  view: Face;
  /** px per mm; if omitted the svg scales to its container */
  scale?: number;
  selectedDeviceId?: string | null;
  selectedCableId?: string | null;
  hoverCableId?: string | null;
  pendingPort?: { deviceId: string; portId: string } | null;
  ghost?: Ghost | null;
  /** rubber band while drawing a cable (svg coords) */
  rubberBand?: { x1: number; y1: number; x2: number; y2: number } | null;
  title?: boolean;
  /** export mode: no hover/hit helpers, white page background */
  forExport?: boolean;
  /** position when nested inside another svg */
  x?: number;
  y?: number;
}

export function rackLayout(rack: Rack) {
  const fw = faceWidth(rack.type.rackStandard);
  const H = rack.type.heightU * U;
  const kind = rack.type.kind;
  const wall = Math.max(18, Math.min(70, (rack.type.outer.w - fw) / 2));
  const topFrame = kind === 'cabinet' ? 60 : kind === 'open' ? 22 : 34;
  const bottomFrame = kind === 'cabinet' ? 70 : kind === 'open' ? 22 : 34;
  const margin = 135;
  const titleH = 24;
  const vb = {
    x: -(wall + margin),
    y: -(topFrame + titleH),
    w: fw + 2 * (wall + margin),
    h: H + topFrame + bottomFrame + titleH + 12,
  };
  return { fw, H, wall, topFrame, bottomFrame, margin, vb, sideGap: wall + 10 };
}

function textColorFor(bg: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}

export function RackSvg(props: RackSvgProps) {
  const { project, rack, view, scale, selectedDeviceId, selectedCableId, hoverCableId, pendingPort, ghost, rubberBand, title = true, forExport, x: posX, y: posY } = props;
  const L = rackLayout(rack);
  const { fw, H, wall, topFrame, bottomFrame, vb } = L;
  const rt = rack.type;
  const s = project.settings;

  // --- port states
  const connected = new Set<string>();
  for (const c of rack.cables) {
    connected.add(`${c.a.deviceId}:${c.a.portId}`);
    connected.add(`${c.b.deviceId}:${c.b.portId}`);
  }
  let pendingSignal: string | null = null;
  if (pendingPort) {
    const d = rack.devices.find((x) => x.id === pendingPort.deviceId);
    const p = d && project.templates[d.templateId]?.ports.find((x) => x.id === pendingPort.portId);
    if (p) pendingSignal = connectorDef(p.connector).signal;
  }
  const selCable = rack.cables.find((c) => c.id === selectedCableId);
  const portState = (deviceId: string, portId: string, connector: string): PortState => {
    const key = `${deviceId}:${portId}`;
    if (pendingPort && pendingPort.deviceId === deviceId && pendingPort.portId === portId) return 'pending';
    if (selCable && ((selCable.a.deviceId === deviceId && selCable.a.portId === portId) || (selCable.b.deviceId === deviceId && selCable.b.portId === portId))) return 'highlight';
    if (pendingSignal && !connected.has(key)) {
      const sig = connectorDef(connector).signal;
      const compatible = sig === pendingSignal || (['rf', 'clock'].includes(sig) && ['rf', 'clock'].includes(pendingSignal));
      return compatible ? 'highlight' : 'dim';
    }
    return connected.has(key) ? 'connected' : 'normal';
  };

  const devices = rack.devices
    .map((d) => ({ d, tpl: project.templates[d.templateId] }))
    .filter((x) => !!x.tpl)
    // devices seen from behind first, so devices mounted on this side cover them
    .sort((a, b) => (a.d.mount === view ? 1 : 0) - (b.d.mount === view ? 1 : 0));

  const cables = computeCableDrawings(project, rack, view, L.sideGap);
  const focusId = hoverCableId ?? selectedCableId ?? null;
  const caseColor = rt.color;
  const holeX = (fw - holeSpacing(rt.rackStandard)) / 2;
  const opening = railOpening(rt.rackStandard);
  const openX = (fw - opening) / 2;
  const railVisible = view === 'front' || rt.hasRearRails;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      x={posX}
      y={posY}
      width={scale ? vb.w * scale : '100%'}
      height={scale ? vb.h * scale : '100%'}
      data-view={view}
      data-rack={rack.id}
      fontFamily="Inter, Arial, Helvetica, sans-serif"
      style={{ display: 'block', userSelect: 'none' }}
    >
      {forExport ? <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#ffffff" /> : null}
      {title ? (
        <text x={fw / 2} y={-topFrame - 9} textAnchor="middle" fontSize={10} fontWeight={700} fill={forExport ? '#111' : 'currentColor'}>
          {rack.name} – {view === 'front' ? 'Vorderansicht' : 'Rückansicht'}
        </text>
      ) : null}

      {/* rack body */}
      <rect x={-wall} y={-topFrame} width={fw + 2 * wall} height={H + topFrame + bottomFrame} rx={rt.kind === 'cabinet' ? 3 : 8} fill={caseColor} stroke={shade(caseColor, 0.3)} strokeWidth={0.8} />
      {rt.kind === 'shockmount' || rt.kind === 'case' ? (
        // flight case corners
        [[-wall, -topFrame], [fw + wall, -topFrame], [-wall, H + bottomFrame], [fw + wall, H + bottomFrame]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={rt.kind === 'shockmount' ? 16 : 11} fill="#9ca3af" stroke="#4b5563" strokeWidth={1} />
        ))
      ) : null}
      {rt.kind === 'shockmount' ? (
        <rect x={-wall + 14} y={-topFrame + 14} width={fw + 2 * wall - 28} height={H + topFrame + bottomFrame - 28} rx={6} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="6 4" />
      ) : null}
      {/* opening */}
      <rect x={openX - 2} y={-2} width={opening + 4} height={H + 4} fill="#0c0d0f" />
      {/* rails */}
      {railVisible ? (
        <g>
          <rect x={0} y={0} width={openX} height={H} fill="#5b6068" />
          <rect x={fw - openX} y={0} width={openX} height={H} fill="#5b6068" />
          {Array.from({ length: rt.heightU }, (_, i) => {
            const uTop = i * U;
            return [6.35, 22.225, 38.1].map((o) => (
              <g key={`${i}-${o}`}>
                <rect x={holeX - 2.4} y={uTop + o - 2.4} width={4.8} height={4.8} fill="#111" />
                <rect x={fw - holeX - 2.4} y={uTop + o - 2.4} width={4.8} height={4.8} fill="#111" />
              </g>
            ));
          })}
        </g>
      ) : (
        <rect x={0} y={0} width={fw} height={H} fill="#111" />
      )}
      {/* U numbering on the case walls (U1 = bottom) */}
      {Array.from({ length: rt.heightU }, (_, i) => {
        const u = rt.heightU - i;
        const y = i * U + U / 2 + 1.8;
        return (
          <g key={u} fontSize={5} fill="#d1d5db" opacity={0.75}>
            <text x={-wall / 2} y={y} textAnchor="middle">{u}</text>
            <text x={fw + wall / 2} y={y} textAnchor="middle">{u}</text>
          </g>
        );
      })}

      {/* devices */}
      {devices.map(({ d, tpl }) => {
        const x = deviceViewX(rack, d, tpl, view);
        const yTop = H - deviceTopY(d, tpl) + PANEL_GAP / 2;
        const panel: Face = d.mount === view ? 'front' : 'rear';
        const w = fw / tpl.slots;
        const states: Record<string, PortState> = {};
        for (const p of tpl.ports) states[p.id] = portState(d.id, p.id, p.connector);
        return (
          <g key={d.id} transform={`translate(${x},${yTop})`} data-device={d.id} style={{ cursor: forExport ? undefined : 'grab' }}>
            <DeviceFace tpl={tpl} panel={panel} width={w} device={d} portStates={states} showPortLabels={s.showPortLabels} selected={d.id === selectedDeviceId} behind={d.mount !== view} />
          </g>
        );
      })}

      {ghost ? (
        <g pointerEvents="none">
          <rect x={ghost.x} y={ghost.yTop} width={ghost.w} height={ghost.h} fill={ghost.ok ? '#22d3ee' : '#ef4444'} fillOpacity={0.25} stroke={ghost.ok ? '#22d3ee' : '#ef4444'} strokeWidth={1.2} strokeDasharray="4 2" />
          <text x={ghost.x + ghost.w / 2} y={ghost.yTop + ghost.h / 2 + 2} textAnchor="middle" fontSize={5} fill="#fff">{ghost.label}</text>
        </g>
      ) : null}

      {/* cables */}
      <g>
        {cables.map((c) => {
          const dimmed = focusId && focusId !== c.cable.id;
          const focused = focusId === c.cable.id;
          const width = (c.type?.width ?? 2) * (focused ? 1.5 : 1);
          return (
            <g key={c.cable.id} opacity={dimmed ? 0.22 : 1} data-cable={c.cable.id} style={{ cursor: forExport ? undefined : 'pointer' }}>
              <title>{`${'W' + String(c.cable.number).padStart(3, '0')}, ${c.type?.name ?? ''}, ${c.labelText}\n${c.a.device.label || c.a.tpl.name} ${c.a.port.name} ↔ ${c.b.device.label || c.b.tpl.name} ${c.b.port.name}`}</title>
              <path d={c.d} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={width + 1.2} strokeLinecap="round" strokeLinejoin="miter" />
              <path d={c.d} fill="none" stroke={c.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="miter" strokeDasharray={c.type?.dash} />
              {focused ? <path d={c.d} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.6} strokeLinecap="round" /> : null}
              {!forExport ? <path d={c.d} fill="none" stroke="transparent" strokeWidth={9} /> : null}
              {c.stub ? (
                <g>
                  <circle cx={c.stub.end.x} cy={c.stub.end.y} r={2.2} fill={c.color} stroke="#000" strokeWidth={0.4} />
                  <text
                    x={c.stub.end.x + (c.stub.side === 'left' ? -4 : 4)}
                    y={c.stub.end.y + 1.3}
                    fontSize={3.6}
                    textAnchor={c.stub.side === 'left' ? 'end' : 'start'}
                    fill={forExport ? '#222' : 'currentColor'}
                  >
                    {c.stub.text}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {/* labels on top of all cables */}
        {s.showCableLabels && s.cableLabel !== 'none'
          ? cables.map((c) => {
              if (!c.labelText) return null;
              const dimmed = focusId && focusId !== c.cable.id;
              const tw = c.labelText.length * 2.05 + 4;
              return (
                <g key={'l' + c.cable.id} opacity={dimmed ? 0.22 : 1} data-cable={c.cable.id} style={{ cursor: forExport ? undefined : 'pointer' }}>
                  <rect x={c.label.x - tw / 2} y={c.label.y - 3} width={tw} height={6} rx={3} fill={c.color} stroke="#000" strokeOpacity={0.4} strokeWidth={0.3} />
                  <text x={c.label.x} y={c.label.y + 1.35} fontSize={3.7} textAnchor="middle" fontWeight={700} fill={textColorFor(c.color)}>
                    {c.labelText}
                  </text>
                </g>
              );
            })
          : null}
      </g>

      {rubberBand ? (
        <line x1={rubberBand.x1} y1={rubberBand.y1} x2={rubberBand.x2} y2={rubberBand.y2} stroke="#f43f5e" strokeWidth={1.2} strokeDasharray="3 2" pointerEvents="none" />
      ) : null}

      {/* footer: rack info */}
      <text x={-wall} y={H + bottomFrame + 9} fontSize={4.2} fill={forExport ? '#555' : 'currentColor'} opacity={0.7}>
        {`${rt.name}, ${rt.heightU} HE, Einbautiefe ${rt.depth} mm`}
      </text>
    </svg>
  );
}

