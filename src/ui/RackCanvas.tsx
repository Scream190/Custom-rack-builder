import { useRef, useState } from 'react';
import type { DeviceTemplate, Face, Rack } from '../model/types';
import { useStore } from '../model/store';
import { checkPlacement, coveredInView, deviceTopY, deviceViewX, endInView, faceWidth, panelHeight, rackBays, rackExtent, resolveEnd, U } from '../model/geometry';
import { RackSvg, type Ghost } from '../render/RackSvg';
import { clickPort } from '../model/cabling';
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
  target?: { u: number; slot: number; bay: number; ok: boolean };
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

  const { w: fw, h: H } = rackExtent(rack.type);

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

  /** Compute a target (bay, U, slot) for a template whose top-left would be at (x, yTop) in svg coords. */
  const computeTarget = (tpl: DeviceTemplate, mount: Face, x: number, yTop: number, ignoreId?: string) => {
    const hU = tpl.heightU;
    const bays = rackBays(rack.type);
    // the bay under the device centre (or the nearest one)
    const rects = bays.map((b, i) => {
      const bfw = faceWidth(b.rackStandard);
      const x0 = view === 'front' ? b.x : fw - b.x - bfw;
      return { i, b, bfw, x0, top: H - (b.y + b.heightU * U), bottom: H - b.y };
    });
    const w0 = faceWidth(rects[0].b.rackStandard) / tpl.slots;
    const cxp = x + w0 / 2, cyp = yTop + (hU * U) / 2;
    const dist = (r: typeof rects[number]) => Math.max(r.x0 - cxp, 0, cxp - (r.x0 + r.bfw)) + Math.max(r.top - cyp, 0, cyp - r.bottom);
    const R = rects.reduce((best, r) => (dist(r) < dist(best) ? r : best), rects[0]);
    const bottomFromBottom = R.bottom - (yTop + hU * U);
    let u = Math.round(bottomFromBottom / U) + 1;
    u = Math.max(1, Math.min(R.b.heightU - hU + 1, u));
    const w = R.bfw / tpl.slots;
    const cx = x + w / 2 - R.x0;
    const xm = mount === view ? cx : R.bfw - cx;
    const slot = Math.max(0, Math.min(tpl.slots - 1, Math.floor(xm / w)));
    const chk = checkPlacement(project, rack, tpl, u, mount, slot, ignoreId, R.i);
    const gx = R.x0 + (mount === view ? slot * w : R.bfw - slot * w - w);
    const g: Ghost = {
      x: gx,
      yTop: R.bottom - (u - 1 + hU) * U + 0.4,
      w,
      h: panelHeight(hU),
      ok: chk.ok,
      label: chk.ok ? `${bays.length > 1 ? `Feld ${R.i + 1}, ` : ''}HE ${u}${hU > 1 ? '–' + (u + hU - 1) : ''}` : chk.reason ?? '',
    };
    return { u, slot, bay: R.i, ok: chk.ok, ghost: g };
  };

  // ------------------------------------------------------------ library DnD
  const onDragOver = (e: React.DragEvent) => {
    const tpl = libraryDrag.tpl;
    if (!tpl || readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (tpl.box) return; // boxes go below the rack, no placement ghost
    const p = toSvgPt(e.clientX, e.clientY);
    const w = faceWidth(tpl.rackStandard) / tpl.slots;
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
    const w = faceWidth(tpl.rackStandard) / tpl.slots;
    const t = computeTarget(tpl, view, p.x - w / 2, p.y - (tpl.heightU * U) / 2);
    st().setActiveRack(rack.id);
    st().placeDevice(rack.id, tpl, t.u, view, t.slot, t.bay);
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
      clickPort(rack.id, deviceId, portId, e.altKey);
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
      // the column of covered devices only shows them; they are moved in the other view or in the inspector
      if (readOnly || devEl.getAttribute('data-behind')) return;
      const d = rack.devices.find((x) => x.id === deviceId)!;
      const tpl = project.templates[d.templateId];
      const p = toSvgPt(e.clientX, e.clientY);
      const yTop = H - deviceTopY(d, tpl, rack);
      const gx = deviceViewX(rack, d, tpl, view);
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
    if (dr?.moved && dr.target) st().moveDevice(rack.id, dr.deviceId, dr.target.u, dr.mount, dr.target.slot, dr.target.bay);
  };

  // rubber band from pending port to mouse
  let rubberBand = null;
  if (pendingPort && pendingPort.rackId === rack.id && mouse) {
    const end = resolveEnd(project, rack, pendingPort);
    const vp = end ? endInView(rack, end, view, coveredInView(project, rack, view)) : null;
    if (vp) {
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

