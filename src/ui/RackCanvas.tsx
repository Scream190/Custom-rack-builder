import { useRef, useState } from 'react';
import type { DeviceTemplate, Face, Rack } from '../model/types';
import { useStore } from '../model/store';
import { checkPlacement, faceWidth, panelHeight, portViewPos, resolveEnd, U } from '../model/geometry';
import { RackSvg, type Ghost } from '../render/RackSvg';
import { toSvg } from '../render/cablePaths';

/** Template currently dragged from the library (dataTransfer can't be read during dragover). */
export const libraryDrag: { tpl: DeviceTemplate | null } = { tpl: null };

export const BASE_PX_PER_MM = 1.55;

interface Props {
  rack: Rack;
  view: Face;
}

interface DragState {
  deviceId: string;
  tpl: DeviceTemplate;
  mount: Face;
  grabDy: number; // svg y offset between pointer and device top
  grabDx: number;
  startX: number;
  startY: number;
  moved: boolean;
  target?: { u: number; slot: number; ok: boolean };
}

export function RackCanvas({ rack, view }: Props) {
  const project = useStore((s) => s.project);
  const zoom = useStore((s) => s.zoom);
  const selection = useStore((s) => s.selection);
  const hoverCableId = useStore((s) => s.hoverCableId);
  const pendingPort = useStore((s) => s.pendingPort);
  const readOnly = useStore((s) => s.readOnly);
  const st = useStore.getState;

  const svgWrap = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<DragState | null>(null);

  const fw = faceWidth(rack.type.rackStandard);
  const H = rack.type.heightU * U;

  const toSvgPt = (clientX: number, clientY: number) => {
    const svg = svgWrap.current?.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    const r = m ? pt.matrixTransform(m.inverse()) : pt;
    return { x: r.x, y: r.y };
  };

  /** Compute a target slot for a template whose top-left would be at (x, yTop) in svg coords. */
  const computeTarget = (tpl: DeviceTemplate, mount: Face, x: number, yTop: number, ignoreId?: string) => {
    const hU = tpl.heightU;
    const bottomFromBottom = H - (yTop + hU * U);
    let u = Math.round(bottomFromBottom / U) + 1;
    u = Math.max(1, Math.min(rack.type.heightU - hU + 1, u));
    const w = fw / tpl.slots;
    const cx = x + w / 2;
    const xm = mount === view ? cx : fw - cx;
    const slot = Math.max(0, Math.min(tpl.slots - 1, Math.floor(xm / w)));
    const chk = checkPlacement(project, rack, tpl, u, mount, slot, ignoreId);
    const gx = mount === view ? slot * w : fw - slot * w - w;
    const g: Ghost = {
      x: gx,
      yTop: H - (u - 1 + hU) * U + 0.4,
      w,
      h: panelHeight(hU),
      ok: chk.ok,
      label: chk.ok ? `HE ${u}${hU > 1 ? '–' + (u + hU - 1) : ''}` : chk.reason ?? '',
    };
    return { u, slot, ok: chk.ok, ghost: g };
  };

  // ------------------------------------------------------------ library DnD
  const onDragOver = (e: React.DragEvent) => {
    const tpl = libraryDrag.tpl;
    if (!tpl || readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (tpl.box) return; // boxes go below the rack, no placement ghost
    const p = toSvgPt(e.clientX, e.clientY);
    const w = fw / tpl.slots;
    const t = computeTarget(tpl, view, p.x - w / 2, p.y - (tpl.heightU * U) / 2);
    setGhost(t.ghost);
  };
  const onDrop = (e: React.DragEvent) => {
    const tpl = libraryDrag.tpl;
    setGhost(null);
    if (!tpl || readOnly) return;
    e.preventDefault();
    if (tpl.box) { st().setActiveRack(rack.id); st().addBox(rack.id, tpl); libraryDrag.tpl = null; return; }
    const p = toSvgPt(e.clientX, e.clientY);
    const w = fw / tpl.slots;
    const t = computeTarget(tpl, view, p.x - w / 2, p.y - (tpl.heightU * U) / 2);
    st().setActiveRack(rack.id);
    st().placeDevice(rack.id, tpl, t.u, view, t.slot);
    libraryDrag.tpl = null;
  };

  // ------------------------------------------------------------ pointer
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    const s = st();
    if (s.activeRackId !== rack.id) s.setActiveRack(rack.id);
    // ports win over cables drawn on top of them
    const portEl = target.closest('[data-port]')
      ?? (readOnly ? null : document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest('[data-port]')).find(Boolean) ?? null);
    const cableEl = target.closest('[data-cable]');
    const devEl = target.closest('[data-device]');
    const boxEl = target.closest('[data-box]');

    if (portEl && !readOnly) {
      const [deviceId, portId] = portEl.getAttribute('data-port')!.split(':');
      const pend = s.pendingPort;
      if (pend && pend.rackId === rack.id) {
        if (!(pend.deviceId === deviceId && pend.portId === portId)) s.connect(rack.id, { deviceId: pend.deviceId, portId: pend.portId }, { deviceId, portId });
        s.setPendingPort(null);
      } else {
        // clicking a connected port selects its cable, otherwise start a new cable
        const existing = rack.cables.find((c) => (c.a.deviceId === deviceId && c.a.portId === portId) || (c.b.deviceId === deviceId && c.b.portId === portId));
        if (existing && !e.altKey) s.select({ kind: 'cable', id: existing.id });
        else s.setPendingPort({ rackId: rack.id, deviceId, portId });
      }
      e.stopPropagation();
      return;
    }
    if (cableEl) {
      s.select({ kind: 'cable', id: cableEl.getAttribute('data-cable')! });
      s.setPendingPort(null);
      return;
    }
    if (boxEl) {
      s.select({ kind: 'box', id: boxEl.getAttribute('data-box')! });
      s.setPendingPort(null);
      return;
    }
    if (devEl) {
      const deviceId = devEl.getAttribute('data-device')!;
      s.select({ kind: 'device', id: deviceId });
      s.setPendingPort(null);
      if (readOnly) return;
      const d = rack.devices.find((x) => x.id === deviceId)!;
      const tpl = project.templates[d.templateId];
      const p = toSvgPt(e.clientX, e.clientY);
      const yTop = H - (d.u - 1 + tpl.heightU) * U;
      const w = fw / tpl.slots;
      const xm = d.slot * w;
      const gx = d.mount === view ? xm : fw - xm - w;
      drag.current = { deviceId, tpl, mount: d.mount, grabDy: p.y - yTop, grabDx: p.x - gx, startX: e.clientX, startY: e.clientY, moved: false };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    s.select(null);
    s.setPendingPort(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toSvgPt(e.clientX, e.clientY);
    if (pendingPort && pendingPort.rackId === rack.id) setMouse(p);
    const dr = drag.current;
    if (dr) {
      if (!dr.moved && Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 4) return;
      dr.moved = true;
      const t = computeTarget(dr.tpl, dr.mount, p.x - dr.grabDx, p.y - dr.grabDy, dr.deviceId);
      dr.target = t;
      setGhost(t.ghost);
      return;
    }
    // hover highlighting of cables
    const cableEl = (e.target as Element).closest('[data-cable]');
    const id = cableEl?.getAttribute('data-cable') ?? null;
    if (id !== st().hoverCableId) st().setHoverCable(id);
  };

  const onPointerUp = () => {
    const dr = drag.current;
    drag.current = null;
    setGhost(null);
    if (dr?.moved && dr.target) st().moveDevice(rack.id, dr.deviceId, dr.target.u, dr.mount, dr.target.slot);
  };

  // rubber band from pending port to mouse
  let rubberBand = null;
  if (pendingPort && pendingPort.rackId === rack.id && mouse) {
    const end = resolveEnd(project, rack, pendingPort);
    if (end && (end.box || end.pos.facing === view)) {
      const vp = end.box ? end.pos : portViewPos(rack, end.pos, view);
      const sp = toSvg(rack, vp.x, vp.y);
      rubberBand = { x1: sp.x, y1: sp.y, x2: mouse.x, y2: mouse.y };
    }
  }

  const scale = BASE_PX_PER_MM * zoom;
  return (
    <div
      ref={svgWrap}
      className={'rack-canvas' + (pendingPort ? ' cabling' : '')}
      onDragOver={onDragOver}
      onDragLeave={() => setGhost(null)}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { if (st().hoverCableId) st().setHoverCable(null); }}
    >
      <RackSvg
        project={project}
        rack={rack}
        view={view}
        scale={scale}
        selectedDeviceId={selection?.kind === 'device' ? selection.id : null}
        selectedCableId={selection?.kind === 'cable' ? selection.id : null}
        hoverCableId={hoverCableId}
        pendingPort={pendingPort?.rackId === rack.id ? pendingPort : null}
        ghost={ghost}
        rubberBand={rubberBand}
      />
    </div>
  );
}

