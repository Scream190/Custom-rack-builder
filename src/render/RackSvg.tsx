import type { Face, Project, Rack } from '../model/types';
import { devicePorts } from '../model/modules';
import { boxAreaHeight, boxLayout, deviceTopY, deviceViewX, faceWidth, frameBottom, holeSpacing, PANEL_GAP, rackBays, rackExtent, rackSizeLabel, railOpening, U, bayOf, panelInView, behindDx, coveredInView, hasBehind, rackWall } from '../model/geometry';
import { BoxFace } from './BoxFace';
import { connectorDef } from '../model/connectors';
import { DeviceFace, shade, type PortState } from './DeviceFace';
import { cableNumberText, computeCableDrawings } from './cablePaths';

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

export function rackLayout(rack: Rack, project?: Project) {
  // fw / H: the whole bay arrangement (one 19" face for a plain rack)
  const { w: fw, h: H } = rackExtent(rack.type);
  const kind = rack.type.kind;
  const wall = rackWall(rack.type);
  const behind = project ? hasBehind(project, rack) : false;
  const topFrame = kind === 'cabinet' ? 60 : kind === 'open' ? 22 : 34;
  const bottomFrame = frameBottom(kind);
  const boxH = project ? boxAreaHeight(project, rack) : 0;
  const margin = 135;
  const titleH = 24;
  const vb = {
    x: -(wall + margin),
    y: -(topFrame + titleH),
    w: fw + 2 * (wall + margin) + (behind ? behindDx(rack) : 0),
    h: H + topFrame + bottomFrame + titleH + 12 + boxH,
  };
  return { fw, H, wall, topFrame, bottomFrame, margin, vb, sideGap: wall + 10, behind };
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
  const L = rackLayout(rack, project);
  const { fw, H, wall, topFrame, bottomFrame, vb } = L;
  const boxes = boxLayout(project, rack);
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
    const pt = d && project.templates[d.templateId];
    const p = d && pt ? devicePorts(pt, d).find((x) => x.id === pendingPort.portId) : undefined;
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

  const covered = coveredInView(project, rack, view);
  const bdx = behindDx(rack);
  const devices = rack.devices
    .map((d) => ({ d, tpl: project.templates[d.templateId] }))
    .filter((x) => !!x.tpl)
    // devices seen from behind first, so devices mounted on this side cover them
    .sort((a, b) => (a.d.mount === view ? 1 : 0) - (b.d.mount === view ? 1 : 0));

  const cables = computeCableDrawings(project, rack, view, L.sideGap);
  const focusId = hoverCableId ?? selectedCableId ?? null;
  const caseColor = rt.color;
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
      {/* bays: opening, rails and U numbering per bay (mirrored in the rear view) */}
      {rackBays(rt).map((bay, bi) => {
        const bfw = faceWidth(bay.rackStandard);
        const bx = view === 'front' ? bay.x : fw - bay.x - bfw;
        const bTop = H - (bay.y + bay.heightU * U);
        const bH = bay.heightU * U;
        const hx = (bfw - holeSpacing(bay.rackStandard)) / 2;
        const op = railOpening(bay.rackStandard);
        const ox = (bfw - op) / 2;
        const multi = rackBays(rt).length > 1;
        return (
          <g key={bi} transform={`translate(${bx},${bTop})`}>
            {multi ? <rect x={-6} y={-6} width={bfw + 12} height={bH + 12} fill={shade(caseColor, -0.25)} /> : null}
            <rect x={ox - 2} y={-2} width={op + 4} height={bH + 4} fill="#0c0d0f" />
            {railVisible ? (
              <g>
                <rect x={0} y={0} width={ox} height={bH} fill="#5b6068" />
                <rect x={bfw - ox} y={0} width={ox} height={bH} fill="#5b6068" />
                {Array.from({ length: bay.heightU }, (_, i) => {
                  const uTop = i * U;
                  return [6.35, 22.225, 38.1].map((o) => (
                    <g key={`${i}-${o}`}>
                      <rect x={hx - 2.4} y={uTop + o - 2.4} width={4.8} height={4.8} fill="#111" />
                      <rect x={bfw - hx - 2.4} y={uTop + o - 2.4} width={4.8} height={4.8} fill="#111" />
                    </g>
                  ));
                })}
              </g>
            ) : (
              <rect x={0} y={0} width={bfw} height={bH} fill="#111" />
            )}
            {Array.from({ length: bay.heightU }, (_, i) => {
              const u = bay.heightU - i;
              const y = i * U + U / 2 + 1.8;
              return (
                <g key={u} fontSize={5} fill="#d1d5db" opacity={0.75}>
                  <text x={multi ? -3 : -wall / 2} y={y} textAnchor={multi ? 'end' : 'middle'}>{u}</text>
                  {!multi ? <text x={bfw + wall / 2} y={y} textAnchor="middle">{u}</text> : null}
                </g>
              );
            })}
            {multi && bay.label ? <text x={bfw / 2} y={-8} fontSize={4.5} textAnchor="middle" fill="#d1d5db">{bay.label}</text> : null}
          </g>
        );
      })}

      {/* column with the devices hidden behind those mounted on this side: same heights, all connectors reachable */}
      {L.behind ? (
        <g>
          <text x={bdx + fw / 2} y={-topFrame - 9} textAnchor="middle" fontSize={7} fontWeight={700} fill={forExport ? '#333' : 'currentColor'} opacity={0.85}>
            {view === 'front' ? 'Dahinter: hinten eingebaute Geräte' : 'Dahinter: vorne eingebaute Geräte'}
          </text>
          <text x={bdx + fw / 2} y={-topFrame - 2} textAnchor="middle" fontSize={4.2} fill={forExport ? '#555' : 'currentColor'} opacity={0.6}>
            verdeckt durch die Geräte dieser Seite, gleiche Höhe wie im Rack
          </text>
          {rackBays(rt).map((bay, bi) => {
            const bfw = faceWidth(bay.rackStandard);
            const bx = bdx + (view === 'front' ? bay.x : fw - bay.x - bfw);
            const bTop = H - (bay.y + bay.heightU * U);
            const bH = bay.heightU * U;
            return (
              <g key={bi}>
                <rect x={bx} y={bTop} width={bfw} height={bH} fill={forExport ? '#f3f4f6' : '#101114'} stroke={forExport ? '#9ca3af' : '#3b4048'} strokeWidth={0.6} strokeDasharray="4 3" />
                {Array.from({ length: bay.heightU }, (_, i) => (
                  <text key={i} x={bx + bfw + 6} y={bTop + i * U + U / 2 + 1.8} fontSize={5} fill={forExport ? '#555' : '#d1d5db'} opacity={0.6}>{bay.heightU - i}</text>
                ))}
              </g>
            );
          })}
          {covered.size === 0 ? (
            <text x={bdx + fw / 2} y={H / 2} textAnchor="middle" fontSize={5} fill={forExport ? '#777' : '#9ca3af'}>In dieser Ansicht ist nichts verdeckt.</text>
          ) : null}
        </g>
      ) : null}

      {/* devices */}
      {devices.map(({ d, tpl }) => {
        const x = deviceViewX(rack, d, tpl, view) + (covered.has(d.id) ? bdx : 0);
        const yTop = H - deviceTopY(d, tpl, rack) + PANEL_GAP / 2;
        const panel: Face = panelInView(d, view);
        const w = faceWidth(bayOf(rack, d).rackStandard) / tpl.slots;
        const states: Record<string, PortState> = {};
        for (const p of devicePorts(tpl, d)) states[p.id] = portState(d.id, p.id, p.connector);
        return (
          <g key={d.id} transform={`translate(${x},${yTop})`} data-device={d.id} data-behind={covered.has(d.id) ? '1' : undefined} style={{ cursor: forExport ? undefined : covered.has(d.id) ? 'pointer' : 'grab' }}>
            <DeviceFace tpl={tpl} panel={panel} width={w} device={d} portStates={states} showPortLabels={s.showPortLabels} selected={d.id === selectedDeviceId} behind={d.mount !== view} />
          </g>
        );
      })}

      {/* split/combi boxes below the rack (same position in both views) */}
      {boxes.length ? (
        <g>
          <text x={-wall} y={H + bottomFrame + 22} fontSize={4.4} fontWeight={700} fill={forExport ? '#333' : 'currentColor'} opacity={0.8}>Dosen</text>
          {boxes.map((b) => {
            const states: Record<string, PortState> = {};
            for (const p of b.tpl.ports) states[p.id] = portState(b.box.id, p.id, p.connector);
            return (
              <g key={b.box.id} transform={`translate(${b.x},${H - b.yTop})`} data-box={b.box.id} style={{ cursor: forExport ? undefined : 'pointer', color: forExport ? '#222' : undefined }}>
                <BoxFace tpl={b.tpl} box={b.box} portStates={states} selected={b.box.id === selectedDeviceId} showPortLabels={s.showPortLabels} plain={forExport} />
              </g>
            );
          })}
        </g>
      ) : null}

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
              <title>{`${cableNumberText(c.cable)}, ${c.type?.name ?? ''}, ${c.labelText}\n${c.a.device.label || c.a.tpl.name} ${c.a.port.name} ↔ ${c.b.device.label || c.b.tpl.name} ${c.b.port.name}`}</title>
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
      <text x={-wall} y={H + bottomFrame + 9 + (boxes.length ? 0 : 0)} fontSize={4.2} fill={forExport ? '#555' : 'currentColor'} opacity={0.7}>
        {`${rt.name}, ${rackSizeLabel(rt)}, Einbautiefe ${rt.depth} mm`}
      </text>
    </svg>
  );
}

