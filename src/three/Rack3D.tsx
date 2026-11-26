import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project, Rack } from '../model/types';
import { bayDepth, bayOf, bayZ, rackDepth, deviceFrontX, deviceTopY, faceWidth, panelHeight, rackBays, rackExtent, railOpening, U } from '../model/geometry';
import { bodyWidth3D, route3D } from './route3d';
import { DeviceFace } from '../render/DeviceFace';
import { useStore, type NavMode } from '../model/store';

const S = 0.001; // mm -> m

/** Rasterise a device panel (same SVG as the 2D view) into a canvas texture. */
export async function panelTexture(svgInner: string, w: number, h: number): Promise<THREE.Texture> {
  const pxPerMm = 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * pxPerMm}" height="${h * pxPerMm}">${svgInner}</svg>`;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w * pxPerMm));
  canvas.height = Math.max(2, Math.round(h * pxPerMm));
  const ctx = canvas.getContext('2d')!;
  try { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); } catch { /* ignore */ }
  URL.revokeObjectURL(url);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

interface Ctx {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  grid: THREE.GridHelper;
  textures: THREE.Texture[];
  /** bounding sphere of the current rack */
  center: THREE.Vector3;
  radius: number;
  anim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null;
  navMode: NavMode;
}

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
 * Coordinate system: x = right (front view), y = up, z = towards the viewer at the front; front rails at z = 0.
 */
export function Rack3D({ project, rack, highlightCableId }: { project: Project; rack: Rack; highlightCableId?: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const navMode = useStore((s) => s.navMode);
  const fitTick = useStore((s) => s.fitTick);
  const homeTick = useStore((s) => s.homeTick);
  const [failed, setFailed] = useState<string | null>(null);

  // ------------------------------------------------------------------ mount: renderer, camera, controls
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
    const ctx: Ctx = { renderer, scene, camera, controls, content, grid, textures: [], center: new THREE.Vector3(), radius: 0.5, anim: null, navMode: 'select' };
    ctxRef.current = ctx;

    // Fusion mapping: middle = pan, Shift + middle = orbit (OrbitControls itself swaps PAN ↔ ROTATE while Shift
    // is held), double-click middle = fit. Capture phase on the host = before OrbitControls sees the event.
    let lastMiddle = 0;
    const onDownCapture = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastMiddle < 350) { fitView(ctx, true); lastMiddle = 0; e.stopPropagation(); return; }
      lastMiddle = now;
    };
    // a lost WebGL context (GPU reset, too many contexts) is reported instead of leaving a black area
    const onLost = (e: Event) => { e.preventDefault(); setFailed('Die 3D-Grafik wurde vom Browser zurückgesetzt. Ansicht wechseln oder neu laden.'); };
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    el.addEventListener('pointerdown', onDownCapture, true);
    const noAuto = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('mousedown', noAuto);

    let raf = 0;
    const m = new THREE.Matrix4();
    const flip = new THREE.Matrix4().makeScale(1, -1, 1);
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
      el.removeEventListener('pointerdown', onDownCapture, true);
      el.removeEventListener('mousedown', noAuto);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      controls.dispose();
      disposeGroup(content);
      ctx.textures.forEach((t) => t.dispose());
      grid.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctxRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------------ content: rack, devices, cables
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    let cancelled = false;
    disposeGroup(ctx.content);
    ctx.content.clear();
    ctx.textures.forEach((t) => t.dispose());
    ctx.textures = [];
    const root = ctx.content;
    const { w: fw, h: H } = rackExtent(rack.type);
    const D = rackDepth(rack.type);
    const wall = Math.max(18, Math.min(70, (rack.type.outer.w - fw) / 2));
    // semi-transparent case shell: cables and devices stay visible from every angle
    const caseMat = new THREE.MeshStandardMaterial({ color: rack.type.color, roughness: 0.7, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false });
    const outerD = Math.max(D + 40, rack.type.outer.d);
    const zMid = (-D / 2) * S;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, d * S), mat);
      mesh.position.set(x * S, y * S, z);
      root.add(mesh);
      return mesh;
    };
    const topH = rack.type.kind === 'open' ? 20 : 30;
    // side walls as thin outer shells: the space between rail and wall is the side cable channel
    const shell = Math.min(10, wall);
    box(shell, H + 2 * topH, outerD, -wall + shell / 2, H / 2, zMid, caseMat);
    box(shell, H + 2 * topH, outerD, fw + wall - shell / 2, H / 2, zMid, caseMat);
    if (rack.type.kind !== 'open') {
      box(fw + 2 * wall, topH, outerD, fw / 2, H + topH / 2, zMid, caseMat);
      box(fw + 2 * wall, topH, outerD, fw / 2, -topH / 2, zMid, caseMat);
    }
    const railMat = new THREE.MeshStandardMaterial({ color: '#8a9099', metalness: 0.6, roughness: 0.4 });
    for (const bay of rackBays(rack.type)) {
      const bfw = faceWidth(bay.rackStandard), bh = bay.heightU * U;
      const railW = (bfw - railOpening(bay.rackStandard)) / 2;
      const bz = bayZ(bay), bd = bayDepth(rack.type, bay);
      for (const z of rack.type.hasRearRails ? [-bz, -bz - bd] : [-bz]) {
        box(railW, bh, 2, bay.x + railW / 2, bay.y + bh / 2, (z - 1) * S, railMat);
        box(railW, bh, 2, bay.x + bfw - railW / 2, bay.y + bh / 2, (z - 1) * S, railMat);
      }
    }
    ctx.grid.position.y = (-topH - 1) * S;
    ctx.center.set((fw / 2) * S, (H / 2) * S, (-D / 2) * S);
    ctx.radius = 0.5 * Math.hypot(fw + 2 * wall, H + 2 * topH, outerD) * S;

    // devices (textures load asynchronously): front plate across the slot, chassis behind it as wide as the real body
    const PLATE = 3;
    (async () => {
      for (const d of rack.devices) {
        const tpl = project.templates[d.templateId];
        if (!tpl) continue;
        const w = faceWidth(bayOf(rack, d).rackStandard) / tpl.slots;
        const h = panelHeight(tpl.heightU);
        const depth = Math.max(PLATE + 1, Math.min(tpl.depth, bayDepth(rack.type, bayOf(rack, d))));
        const x0 = deviceFrontX(rack, d, tpl);
        const yTop = deviceTopY(d, tpl, rack) - 0.4;
        const bodyW = bodyWidth3D(rack, tpl, d);
        const front = await panelTexture(renderToStaticMarkup(<DeviceFace tpl={tpl} panel="front" width={w} device={d} showPortLabels={project.settings.showPortLabels} />), w, h);
        const rear = await panelTexture(renderToStaticMarkup(<DeviceFace tpl={tpl} panel="rear" width={w} device={d} showPortLabels={project.settings.showPortLabels} />), w, h);
        if (cancelled) { front.dispose(); rear.dispose(); return; }
        // the rear drawing spans the whole slot; show only the part where the chassis is
        rear.repeat.set(bodyW / w, 1);
        rear.offset.set((w - bodyW) / 2 / w, 0);
        ctx.textures.push(front, rear);
        const side = new THREE.MeshStandardMaterial({ color: tpl.color, roughness: 0.6, metalness: 0.3 });
        const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.55 });
        const rearMat = new THREE.MeshStandardMaterial({ map: rear, roughness: 0.6 });
        const facingFront = d.mount === 'front';
        const dirZ = facingFront ? -1 : 1;          // from the mounting plane into the rack
        const dbay = bayOf(rack, d);
        const z0 = facingFront ? -bayZ(dbay) : -bayZ(dbay) - bayDepth(rack.type, dbay);
        // box faces: +x, -x, +y, -y, +z, -z (rear textures are drawn as seen from behind = the -z face)
        const plate = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, PLATE * S), facingFront ? [side, side, side, side, frontMat, side] : [side, side, side, side, side, frontMat]);
        plate.position.set((x0 + w / 2) * S, (yTop - h / 2) * S, (z0 + (dirZ * PLATE) / 2) * S);
        const bodyLen = depth - PLATE;
        const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW * S, (h - 0.6) * S, bodyLen * S), facingFront ? [side, side, side, side, side, rearMat] : [side, side, side, side, rearMat, side]);
        body.position.set((x0 + w / 2) * S, (yTop - h / 2) * S, (z0 + dirZ * (PLATE + bodyLen / 2)) * S);
        root.add(plate, body);
      }
    })();

    // cables: collision-aware orthogonal routes (see route3d.ts), rounded corners
    const radiusOf = (typeId: string) => (project.cableTypes.find((t) => t.id === typeId)?.width ?? 2) * 1.1;
    const { routes } = route3D(project, rack, radiusOf);
    for (const rt of routes) {
      const path = roundedPath(rt.points.map(([x, y, z]) => new THREE.Vector3(x * S, y * S, z * S)), Math.max(rt.radius * 2, 5) * S);
      if (!path) continue;
      const len = path.getLength() / S;
      const mat = new THREE.MeshStandardMaterial({ color: rt.color, roughness: 0.5, transparent: true });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(800, Math.max(24, Math.round(len / 4))), rt.radius * S, 10, false), mat);
      mesh.userData.cableId = rt.cableId;
      root.add(mesh);
    }
    applyHighlight(ctx, useStore.getState().hoverCableId ?? highlightCableId ?? null);

    // camera: restore what the user had for this rack, otherwise home view
    const mem = cameraMemory.get(rack.id);
    if (mem) { ctx.camera.position.copy(mem.pos); ctx.controls.target.copy(mem.target); }
    else setView(ctx, 'home', false);
    return () => {
      cancelled = true;
      cameraMemory.set(rack.id, { pos: ctx.camera.position.clone(), target: ctx.controls.target.clone() });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, rack]);

  // highlight without rebuilding (keeps the camera where it is)
  useEffect(() => { if (ctxRef.current) applyHighlight(ctxRef.current, highlightCableId ?? null); }, [highlightCableId]);
  useEffect(() => { if (ctxRef.current) { ctxRef.current.navMode = navMode; applyLeft(ctxRef.current); } }, [navMode]);
  useEffect(() => { if (fitTick && ctxRef.current) fitView(ctxRef.current, true); }, [fitTick]);
  useEffect(() => { if (homeTick && ctxRef.current) setView(ctxRef.current, 'home', true); }, [homeTick]);

  const face = (key: string, label: string, cls: string) => (
    <div className={'vc-face ' + cls} onClick={() => ctxRef.current && setView(ctxRef.current, key, true)}>{label}</div>
  );

  return (
    <div className="view3d" ref={host}>
      {failed ? <div className="view3d-fail">{failed}</div> : null}
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

/** polyline with rounded corners (quadratic arcs) as one curve for TubeGeometry */
function roundedPath(pts: THREE.Vector3[], radius: number): THREE.CurvePath<THREE.Vector3> | null {
  if (pts.length < 2) return null;
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cur = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], prev = pts[i - 1], next = pts[i + 1];
    const inLen = p.distanceTo(prev), outLen = p.distanceTo(next);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 1e-6) continue;
    const a = p.clone().add(prev.clone().sub(p).setLength(r));
    const b = p.clone().add(next.clone().sub(p).setLength(r));
    if (cur.distanceTo(a) > 1e-7) path.add(new THREE.LineCurve3(cur, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    cur = b;
  }
  const last = pts[pts.length - 1];
  if (cur.distanceTo(last) > 1e-7) path.add(new THREE.LineCurve3(cur, last.clone()));
  return path.curves.length ? path : null;
}
