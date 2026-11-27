import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DeviceTemplate, Face, Project, Rack } from '../model/types';
import { bayOf, deviceBottomY, deviceFrontX, faceWidth, U } from '../model/geometry';
import { deviceBoxes } from './route3d';
import { facingSide, hitMountPlane, pickPort, portTargets, targetAt, type PortTarget, type Target3D, type V3 } from './pick3d';
import { useStore, type NavMode } from '../model/store';
import { libraryDrag } from '../ui/RackCanvas';
import { buildRackScene } from './rackScene';
import { clickPort } from '../model/cabling';

const S = 0.001; // mm -> m


interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  /** hover ring, pending port, rubber band, placement ghost, selection frame (not rebuilt with the content) */
  overlay: Overlay;
  grid: THREE.GridHelper;
  /** panel textures by markup, shared between rebuilds so a new cable does not re-rasterise every device */
  texCache: Map<string, Promise<THREE.Texture>>;
  /** texture keys held by builds that are still loading */
  texInUse: Map<number, Set<string>>;
  buildId: number;
  ports: PortTarget[];
  /** devices mounted on this side are hidden, so the panels behind them can be reached */
  hide: Face | null;
  /** bounding sphere of the current rack */
  center: THREE.Vector3;
  radius: number;
  anim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null;
  navMode: NavMode;
}

interface Overlay {
  group: THREE.Group;
  hover: THREE.Mesh;
  pending: THREE.Mesh;
  band: THREE.Line;
  ghost: THREE.Mesh;
  ghostEdges: THREE.LineSegments;
  sel: THREE.Box3Helper;
}

interface DragState {
  deviceId: string;
  tpl: DeviceTemplate;
  mount: Face;
  /** grab point relative to the panel centre (front-view mm) */
  gx: number;
  gy: number;
  sx: number;
  sy: number;
  moved: boolean;
  target: Target3D | null;
}

interface Hit { port?: PortTarget; deviceId?: string; cableId?: string; point?: V3 }

// camera per rack survives re-renders and view switches
const cameraMemory = new Map<string, { pos: THREE.Vector3; target: THREE.Vector3 }>();

/** directions for the ViewCube faces and the home view (unit vectors from target to camera) */
const VIEW_DIRS: Record<string, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, 0.0001),
  bottom: new THREE.Vector3(0, -1, 0.0001),
  home: new THREE.Vector3(0.5, 0.32, 1).normalize(),
};

/**
 * 3D view with Fusion-360-style navigation:
 * mouse wheel = zoom to cursor, middle drag = pan, Shift + middle drag = orbit, double-click middle = fit,
 * left drag = orbit (or the tool chosen in the navigation bar), ViewCube for standard views.
 * Editing (select tool): click a connector to start a cable and another one to connect it, click a device or cable to
 * select it, drag a selected device to move it, drop templates from the library onto the rack.
 * Coordinate system: x = right (front view), y = up, z = towards the viewer at the front; front rails at z = 0.
 */
export function Rack3D({ project, rack, highlightCableId }: { project: Project; rack: Rack; highlightCableId?: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const data = useRef({ project, rack });
  data.current = { project, rack };
  const navMode = useStore((s) => s.navMode);
  const fitTick = useStore((s) => s.fitTick);
  const homeTick = useStore((s) => s.homeTick);
  const [failed, setFailed] = useState<string | null>(null);
  const [hide, setHide] = useState<Face | null>(null);

  // ------------------------------------------------------------------ mount: renderer, camera, controls, editing
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch (err) {
      console.error(err);
      setFailed('WebGL ist in diesem Browser bzw. dieser Vorschau nicht verfügbar. Öffne die Datei direkt in Chrome, Edge, Firefox oder Safari.');
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.insertBefore(renderer.domElement, el.firstChild);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#15171b');
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / Math.max(1, el.clientHeight), 0.005, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    scene.add(new THREE.HemisphereLight('#ffffff', '#30343b', 1.6));
    const d1 = new THREE.DirectionalLight('#ffffff', 1.4); d1.position.set(1, 2, 2); scene.add(d1);
    const d2 = new THREE.DirectionalLight('#ffffff', 0.6); d2.position.set(-1, 1, -2); scene.add(d2);
    const grid = new THREE.GridHelper(4, 40, '#3b4048', '#262a30');
    scene.add(grid);
    const content = new THREE.Group();
    scene.add(content);
    const overlay = makeOverlay();
    scene.add(overlay.group);
    const ctx: Ctx = {
      renderer, scene, camera, controls, content, overlay, grid, texCache: new Map(), texInUse: new Map(), buildId: 0, ports: [], hide: null,
      center: new THREE.Vector3(), radius: 0.5, anim: null, navMode: 'select',
    };
    ctxRef.current = ctx;

    // ---------------------------------------------------------------- picking
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ray = (clientX: number, clientY: number): { o: V3; d: V3 } => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      return { o: [o.x / S, o.y / S, o.z / S], d: [d.x, d.y, d.z] };
    };
    /** what is under the pointer: ports win over cables and devices, as in the 2D view */
    const pick = (clientX: number, clientY: number): Hit => {
      const { o, d } = ray(clientX, clientY);
      const hits = raycaster.intersectObjects(ctx.content.children, false).filter((h) => h.object.visible && (h.object.userData.deviceId || h.object.userData.cableId));
      const devHit = hits.find((h) => h.object.userData.deviceId);
      const pp = pickPort(ctx.hide ? ctx.ports.filter((q) => q.mount !== ctx.hide) : ctx.ports, o, d);
      const at = (t: number): V3 => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
      if (pp && (!devHit || pp.t <= devHit.distance / S + 3)) return { port: pp.port, point: at(pp.t) };
      const first = hits[0];
      if (first) return { deviceId: first.object.userData.deviceId, cableId: first.object.userData.cableId, point: at(first.distance / S) };
      return {};
    };

    const tip = (text: string | null, x = 0, y = 0, bad = false) => {
      const t = tipRef.current;
      if (!t) return;
      if (!text) { t.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      t.style.display = 'block';
      t.style.left = `${x - r.left + 14}px`;
      t.style.top = `${y - r.top + 16}px`;
      t.classList.toggle('bad', bad);
      if (t.textContent !== text) t.textContent = text;
    };
    const showGhost = (t: Target3D | null) => {
      const { ghost, ghostEdges } = ctx.overlay;
      ghost.visible = ghostEdges.visible = !!t;
      if (!t) return;
      const col = t.ok ? '#22c55e' : '#ef4444';
      (ghost.material as THREE.MeshBasicMaterial).color.set(col);
      (ghostEdges.material as THREE.LineBasicMaterial).color.set(col);
      for (const m of [ghost, ghostEdges]) {
        m.scale.set(t.w * S, t.h * S, t.depth * S);
        m.position.set((t.x0 + t.w / 2) * S, (t.yTop - t.h / 2) * S, (t.z0 + (t.dirZ * t.depth) / 2) * S);
      }
    };

    // ---------------------------------------------------------------- pointer: ports, selection, moving devices
    let lastMiddle = 0;
    let drag: DragState | null = null;
    let press: { x: number; y: number; hit: Hit; alt: boolean } | null = null;
    let mouse: { x: number; y: number } | null = null;
    let hoverDirty = false;

    const onDownCapture = (e: PointerEvent) => {
      // Fusion mapping: middle = pan, Shift + middle = orbit (OrbitControls itself swaps PAN ↔ ROTATE while Shift
      // is held), double-click middle = fit. Capture phase on the host = before OrbitControls sees the event.
      if (e.button === 1) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastMiddle < 350) { fitView(ctx, true); lastMiddle = 0; e.stopPropagation(); return; }
        lastMiddle = now;
        return;
      }
      if (e.button !== 0 || ctx.navMode !== 'select' || e.target !== renderer.domElement) return;
      const s = useStore.getState();
      const { project: pj, rack: rk } = data.current;
      const hit = pick(e.clientX, e.clientY);
      if (hit.port && !s.readOnly) {
        clickPort(rk.id, hit.port.deviceId, hit.port.portId, e.altKey);
        e.stopPropagation();
        e.preventDefault();
        hoverDirty = true;
        return;
      }
      // a selected device can be dragged to another height unit / slot / bay; elsewhere left drag orbits
      if (hit.deviceId && !s.readOnly && s.selection?.kind === 'device' && s.selection.id === hit.deviceId) {
        const dev = rk.devices.find((x) => x.id === hit.deviceId);
        const tpl = dev && pj.templates[dev.templateId];
        if (dev && tpl) {
          const { o, d } = ray(e.clientX, e.clientY);
          const h = hitMountPlane(rk, o, d, dev.mount);
          const cx = deviceFrontX(rk, dev, tpl) + faceWidth(bayOf(rk, dev).rackStandard) / tpl.slots / 2;
          const cy = deviceBottomY(dev, rk) + (tpl.heightU * U) / 2;
          drag = { deviceId: dev.id, tpl, mount: dev.mount, gx: h ? h.x - cx : 0, gy: h ? h.y - cy : 0, sx: e.clientX, sy: e.clientY, moved: false, target: null };
          el.setPointerCapture(e.pointerId);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      press = { x: e.clientX, y: e.clientY, hit, alt: e.altKey };
    };

    const onMove = (e: PointerEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
      if (drag) {
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
        drag.moved = true;
        const { project: pj, rack: rk } = data.current;
        const { o, d } = ray(e.clientX, e.clientY);
        const h = hitMountPlane(rk, o, d, drag.mount);
        drag.target = h ? targetAt(pj, rk, drag.tpl, drag.mount, h.bay, h.x - drag.gx, h.y - drag.gy, drag.deviceId) : null;
        showGhost(drag.target);
        tip(drag.target?.label ?? null, e.clientX, e.clientY, !drag.target?.ok);
        return;
      }
      if (e.buttons) { tip(null); return; }   // orbiting / panning
      hoverDirty = true;
    };

    const onUp = (e: PointerEvent) => {
      if (drag) {
        const dr = drag;
        drag = null;
        showGhost(null);
        tip(null);
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        if (dr.moved && dr.target) useStore.getState().moveDevice(data.current.rack.id, dr.deviceId, dr.target.u, dr.mount, dr.target.slot, dr.target.bay);
        return;
      }
      const p = press;
      press = null;
      if (!p || e.button !== 0 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
      const s = useStore.getState();
      if (p.hit.cableId) s.select({ kind: 'cable', id: p.hit.cableId });
      else if (p.hit.deviceId) s.select({ kind: 'device', id: p.hit.deviceId });
      else s.select(null);
      s.setPendingPort(null);
      hoverDirty = true;
    };

    const onLeave = () => {
      mouse = null;
      tip(null);
      ctx.overlay.hover.visible = false;
      ctx.overlay.band.visible = false;
      if (useStore.getState().hoverCableId) useStore.getState().setHoverCable(null);
    };

    /** hover feedback, done once per frame: port ring and name, cable highlight, rubber band of a pending cable */
    const hover = () => {
      hoverDirty = false;
      const ov = ctx.overlay;
      const s = useStore.getState();
      const { rack: rk } = data.current;
      if (!mouse || ctx.navMode !== 'select') { ov.hover.visible = false; ov.band.visible = false; return; }
      const hit = pick(mouse.x, mouse.y);
      const editable = !s.readOnly;
      if (hit.port && editable) {
        placeRing(ov.hover, hit.port);
        tip(`${hit.port.name}\n${hit.port.device}`, mouse.x, mouse.y);
      } else {
        ov.hover.visible = false;
        tip(null);
      }
      const cid = hit.port ? null : hit.cableId ?? null;
      if (cid !== s.hoverCableId) s.setHoverCable(cid);
      const pend = s.pendingPort && s.pendingPort.rackId === rk.id ? ctx.ports.find((p) => p.deviceId === s.pendingPort!.deviceId && p.portId === s.pendingPort!.portId) : undefined;
      if (pend) {
        let end = hit.port ? hit.port.pos : hit.point;
        if (!end) {
          // nothing under the pointer: follow it on the plane through the port, facing the camera
          const n = new THREE.Vector3(); camera.getWorldDirection(n);
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(pend.pos[0] * S, pend.pos[1] * S, pend.pos[2] * S));
          const q = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
          end = q ? [q.x / S, q.y / S, q.z / S] : undefined;
        }
        if (end) {
          const a = new THREE.Vector3(pend.pos[0] * S, pend.pos[1] * S, (pend.pos[2] + pend.n) * S);
          (ov.band.geometry as THREE.BufferGeometry).setFromPoints([a, new THREE.Vector3(end[0] * S, end[1] * S, end[2] * S)]);
          ov.band.visible = true;
        }
      } else ov.band.visible = false;
      const cur = hit.port && editable ? 'pointer' : pend ? 'crosshair'
        : hit.deviceId && editable && s.selection?.kind === 'device' && s.selection.id === hit.deviceId ? 'move' : '';
      if (renderer.domElement.style.cursor !== cur) renderer.domElement.style.cursor = cur;
    };

    // ---------------------------------------------------------------- library drag & drop
    let dropTarget: { t: Target3D; mount: Face } | null = null;
    const onDragOver = (e: DragEvent) => {
      const tpl = libraryDrag.tpl;
      if (!tpl || useStore.getState().readOnly) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (tpl.box) return;    // split boxes go below the rack
      const { project: pj, rack: rk } = data.current;
      const mount = facingSide(rk, camera.position.z / S);
      const { o, d } = ray(e.clientX, e.clientY);
      const h = hitMountPlane(rk, o, d, mount);
      dropTarget = h ? { t: targetAt(pj, rk, tpl, mount, h.bay, h.x, h.y), mount } : null;
      showGhost(dropTarget?.t ?? null);
      tip(dropTarget?.t.label ?? null, e.clientX, e.clientY, !dropTarget?.t.ok);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget && el.contains(e.relatedTarget as Node)) return;
      dropTarget = null;
      showGhost(null);
      tip(null);
    };
    const onDrop = (e: DragEvent) => {
      const tpl = libraryDrag.tpl;
      const dt = dropTarget;
      dropTarget = null;
      showGhost(null);
      tip(null);
      const s = useStore.getState();
      if (!tpl || s.readOnly) return;
      e.preventDefault();
      const rk = data.current.rack;
      s.setActiveRack(rk.id);
      if (tpl.box) s.addBox(rk.id, tpl);
      else if (dt) s.placeDevice(rk.id, tpl, dt.t.u, dt.mount, dt.t.slot, dt.t.bay);
      libraryDrag.tpl = null;
    };

    // a lost WebGL context (GPU reset, too many contexts) is reported instead of leaving a black area
    const onLost = (e: Event) => { e.preventDefault(); setFailed('Die 3D-Grafik wurde vom Browser zurückgesetzt. Ansicht wechseln oder neu laden.'); };
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    el.addEventListener('pointerdown', onDownCapture, true);
    el.addEventListener('pointermove', onMove, true);
    el.addEventListener('pointerup', onUp, true);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    const noAuto = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('mousedown', noAuto);
    // selection frame and pending port follow the store
    const unsub = useStore.subscribe((st, prev) => {
      if (st.selection !== prev.selection || st.pendingPort !== prev.pendingPort) { updateMarks(ctx, data.current.project, data.current.rack); hoverDirty = true; }
    });

    // dev builds only: lets browser tests find screen positions (scripts drive the editor like a user)
    if (import.meta.env.DEV) {
      (el as unknown as { __rack3d: unknown }).__rack3d = {
        ports: () => ctx.ports,
        rack: () => data.current.rack,
        store: () => { const st = useStore.getState(); return { selection: st.selection, pendingPort: st.pendingPort }; },
        pick: (x: number, y: number) => { const h = pick(x, y); return { port: h.port?.portId, deviceId: h.deviceId, cableId: h.cableId, point: h.point, ray: ray(x, y) }; },
        toScreen: (x: number, y: number, z: number) => {
          const v = new THREE.Vector3(x * S, y * S, z * S).project(camera);
          const r = renderer.domElement.getBoundingClientRect();
          return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
        },
      };
    }

    let raf = 0;
    const m = new THREE.Matrix4();
    const flip = new THREE.Matrix4().makeScale(1, -1, 1);
    let lastCam = new THREE.Vector3();
    const loop = () => {
      if (ctx.anim) {
        const a = ctx.anim;
        const t = Math.min(1, (performance.now() - a.t0) / a.dur);
        const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        camera.position.lerpVectors(a.from, a.to, k);
        controls.target.lerpVectors(a.tFrom, a.tTo, k);
        if (t >= 1) ctx.anim = null;
      }
      controls.update();
      // the rubber band and hover ring need a refresh when the camera moves under a resting pointer
      if (!camera.position.equals(lastCam)) { lastCam = camera.position.clone(); if (useStore.getState().pendingPort) hoverDirty = true; }
      if (hoverDirty && !drag) hover();
      renderer.render(scene, camera);
      // ViewCube follows the camera orientation (CSS has y pointing down → conjugate with a y flip)
      if (cubeRef.current) {
        m.copy(camera.matrixWorldInverse).setPosition(0, 0, 0);
        m.premultiply(flip).multiply(flip);
        cubeRef.current.style.transform = `translateZ(-40px) matrix3d(${m.elements.map((v) => v.toFixed(5)).join(',')})`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
      el.removeEventListener('pointerdown', onDownCapture, true);
      el.removeEventListener('pointermove', onMove, true);
      el.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('mousedown', noAuto);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      ctx.buildId++;
      disposeGroup(ctx.content);
      disposeGroup(overlay.group);
      ctx.texCache.forEach((p) => p.then((t) => t.dispose()));
      ctx.texCache.clear();
      grid.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctxRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------ content: rack, devices, cables
  // Built off-screen and swapped in once all panel textures are ready, so editing does not make the view flicker.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const id = ++ctx.buildId;
    const used = new Set<string>();
    ctx.texInUse.set(id, used);
    // panel textures: cached by their drawing, only changed panels are rasterised again
    const texture = (key: string, make: () => Promise<THREE.Texture>) => {
      used.add(key);
      let p = ctx.texCache.get(key);
      if (!p) { p = make(); ctx.texCache.set(key, p); }
      return p;
    };
    const sc = buildRackScene(project, rack, texture);
    const root = sc.root;
    ctx.grid.position.y = sc.floorY;
    ctx.center.copy(sc.center);
    ctx.radius = sc.radius;
    (async () => {
      await sc.ready;
      ctx.texInUse.delete(id);
      if (ctx.buildId !== id || ctxRef.current !== ctx) { disposeGroup(root); return; }
      // swap in the finished scene, then drop textures no build needs any more
      ctx.scene.remove(ctx.content);
      disposeGroup(ctx.content);
      ctx.content = root;
      ctx.scene.add(root);
      ctx.ports = portTargets(project, rack);
      for (const [key, p] of ctx.texCache) {
        if (used.has(key) || [...ctx.texInUse.values()].some((u) => u.has(key))) continue;
        ctx.texCache.delete(key);
        p.then((t) => t.dispose());
      }
      applyHighlight(ctx, useStore.getState().hoverCableId ?? highlightCableId ?? null);
      applyHide(ctx);
      updateMarks(ctx, project, rack);
    })();

    // camera: restore what the user had for this rack, otherwise home view
    const mem = cameraMemory.get(rack.id);
    if (mem) { ctx.camera.position.copy(mem.pos); ctx.controls.target.copy(mem.target); }
    else setView(ctx, 'home', false);
    return () => {
      cameraMemory.set(rack.id, { pos: ctx.camera.position.clone(), target: ctx.controls.target.clone() });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, rack]);

  // highlight without rebuilding (keeps the camera where it is)
  useEffect(() => { if (ctxRef.current) applyHighlight(ctxRef.current, highlightCableId ?? null); }, [highlightCableId]);
  useEffect(() => { if (ctxRef.current) { ctxRef.current.navMode = navMode; applyLeft(ctxRef.current); } }, [navMode]);
  useEffect(() => { if (fitTick && ctxRef.current) fitView(ctxRef.current, true); }, [fitTick]);
  useEffect(() => { if (homeTick && ctxRef.current) setView(ctxRef.current, 'home', true); }, [homeTick]);
  useEffect(() => { if (ctxRef.current) { ctxRef.current.hide = hide; applyHide(ctxRef.current); } }, [hide]);
  const bothSides = rack.devices.some((d) => d.mount === 'rear') && rack.devices.some((d) => d.mount === 'front');

  const face = (key: string, label: string, cls: string) => (
    <div className={'vc-face ' + cls} onClick={() => ctxRef.current && setView(ctxRef.current, key, true)}>{label}</div>
  );

  return (
    <div className="view3d" ref={host}>
      {failed ? <div className="view3d-fail">{failed}</div> : null}
      <div className="view3d-tip" ref={tipRef} />
      {bothSides ? (
        <div className="view3d-layers seg" title="Geräte einer Seite ausblenden, um an die Anschlüsse dahinter zu kommen">
          <button className={hide === null ? 'on' : ''} onClick={() => setHide(null)}>Alle Geräte</button>
          <button className={hide === 'rear' ? 'on' : ''} onClick={() => setHide('rear')}>Hintere ausblenden</button>
          <button className={hide === 'front' ? 'on' : ''} onClick={() => setHide('front')}>Vordere ausblenden</button>
        </div>
      ) : null}
      <div className="viewcube-wrap" title="ViewCube: Seite anklicken">
        <div className="viewcube" ref={cubeRef}>
          {face('front', 'VORNE', 'vc-front')}
          {face('back', 'HINTEN', 'vc-back')}
          {face('right', 'RECHTS', 'vc-right')}
          {face('left', 'LINKS', 'vc-left')}
          {face('top', 'OBEN', 'vc-top')}
          {face('bottom', 'UNTEN', 'vc-bottom')}
        </div>
        <button className="vc-home" title="Startansicht" onClick={() => ctxRef.current && setView(ctxRef.current, 'home', true)}>⌂</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- editing overlay

function makeOverlay(): Overlay {
  const group = new THREE.Group();
  group.renderOrder = 10;
  const ring = (color: string) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.32, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false, transparent: true }));
    m.renderOrder = 11;
    m.visible = false;
    group.add(m);
    return m;
  };
  const hover = ring('#ffffff');
  const pending = ring('#f43f5e');
  const band = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f43f5e', depthTest: false, transparent: true }));
  band.renderOrder = 11;
  band.visible = false;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const ghost = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.28, depthWrite: false }));
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(unit), new THREE.LineBasicMaterial({ color: '#22c55e', depthTest: false, transparent: true }));
  ghost.visible = ghostEdges.visible = false;
  ghostEdges.renderOrder = 11;
  const sel = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#22d3ee'));
  (sel.material as THREE.LineBasicMaterial).depthTest = false;
  (sel.material as THREE.LineBasicMaterial).transparent = true;
  sel.renderOrder = 11;
  sel.visible = false;
  group.add(band, ghost, ghostEdges, sel);
  return { group, hover, pending, band, ghost, ghostEdges, sel };
}

/** hide the devices of one mounting side (their cables stay visible) */
function applyHide(ctx: Ctx) {
  for (const o of ctx.content.children) if (o.userData.mount) o.visible = o.userData.mount !== ctx.hide;
  ctx.overlay.hover.visible = false;
}

/** a ring around a connector, slightly in front of its panel */
function placeRing(m: THREE.Mesh, p: PortTarget) {
  const r = Math.max(p.hw, p.hh) + 1.5;
  m.scale.set(r * S, r * S, 1);
  m.position.set(p.pos[0] * S, p.pos[1] * S, (p.pos[2] + p.n * 1.2) * S);
  m.visible = true;
}

/** selection frame around the selected device and the marker on the port a new cable starts at */
function updateMarks(ctx: Ctx, project: Project, rack: Rack) {
  const s = useStore.getState();
  const ov = ctx.overlay;
  const sel = s.selection?.kind === 'device' ? rack.devices.find((d) => d.id === s.selection!.id) : undefined;
  const tpl = sel && project.templates[sel.templateId];
  if (sel && tpl) {
    const b = ov.sel.box.makeEmpty();
    for (const part of deviceBoxes(rack, sel, tpl)) {
      b.expandByPoint(new THREE.Vector3(part.lo[0] * S, part.lo[1] * S, part.lo[2] * S));
      b.expandByPoint(new THREE.Vector3(part.hi[0] * S, part.hi[1] * S, part.hi[2] * S));
    }
    b.expandByScalar(1.5 * S);
    ov.sel.visible = true;
  } else ov.sel.visible = false;
  const pp = s.pendingPort;
  const port = pp && pp.rackId === rack.id ? ctx.ports.find((p) => p.deviceId === pp.deviceId && p.portId === pp.portId) : undefined;
  if (port) placeRing(ov.pending, port);
  else ov.pending.visible = false;
  if (!port) ov.band.visible = false;
}

// ---------------------------------------------------------------------------------------------- helpers

function applyLeft(ctx: Ctx) {
  const mode = ctx.navMode;
  ctx.controls.mouseButtons.LEFT = mode === 'pan' ? THREE.MOUSE.PAN : mode === 'zoom' ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE;
}

function applyHighlight(ctx: Ctx, id: string | null) {
  ctx.content.traverse((o) => {
    const cid = o.userData?.cableId;
    if (!cid) return;
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const on = id === cid;
    mat.opacity = id && !on ? 0.2 : 1;
    mat.emissive = on ? mat.color.clone() : new THREE.Color('#000');
    mat.emissiveIntensity = on ? 0.5 : 0;
  });
}

/** distance at which a sphere of radius r fills the view */
function fitDistance(ctx: Ctx, r: number) {
  const vfov = (ctx.camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * ctx.camera.aspect);
  return (r * 1.12) / Math.sin(Math.min(vfov, hfov) / 2);
}

function animateTo(ctx: Ctx, pos: THREE.Vector3, target: THREE.Vector3, animate: boolean) {
  if (!animate) { ctx.camera.position.copy(pos); ctx.controls.target.copy(target); ctx.controls.update(); return; }
  ctx.anim = { from: ctx.camera.position.clone(), to: pos, tFrom: ctx.controls.target.clone(), tTo: target.clone(), t0: performance.now(), dur: 420 };
}

function setView(ctx: Ctx, key: string, animate: boolean) {
  const dir = VIEW_DIRS[key] ?? VIEW_DIRS.home;
  const dist = fitDistance(ctx, ctx.radius);
  animateTo(ctx, ctx.center.clone().addScaledVector(dir, dist), ctx.center.clone(), animate);
}

/** keep the viewing direction, re-centre and adjust the distance so the rack fills the view */
function fitView(ctx: Ctx, animate: boolean) {
  const dir = ctx.camera.position.clone().sub(ctx.controls.target).normalize();
  animateTo(ctx, ctx.center.clone().addScaledVector(dir, fitDistance(ctx, ctx.radius)), ctx.center.clone(), animate);
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}
