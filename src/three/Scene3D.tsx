import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { S, disposeTree } from './caseParts';
import { useLayout } from '../model/layout';

/** What a build callback reports back for framing the camera (all mm). */
export interface BuildResult {
  /** bounding size of the model (x = width, y = height, z = depth) */
  size: { x: number; y: number; z: number };
  /** shift of the look-at point along z (e.g. a lid set down behind the case) */
  zShift?: number;
  /** look down more steeply (deep drawers: the front plate would hide the cut-outs at the front) */
  steep?: boolean;
}

/**
 * Studio-style 3D viewer for physical builds (cases, rack cases): image-based lighting, soft shadows, ambient
 * occlusion in recesses, dark floor fading into the background. `build` fills a group that is in mm.
 */
/** handle for editors: camera, canvas, model root (mm scaled by S) and the orbit controls */
export interface Scene3DApi {
  camera: THREE.PerspectiveCamera; dom: HTMLCanvasElement; content: THREE.Group; controls: OrbitControls;
  /** section planes on the model (floor and grid stay whole); null removes them. Kept across rebuilds. */
  clip: (planes: THREE.Plane[] | null) => void;
}

/**
 * `frameKey`: when given, the camera is framed again only when this key changes (editors keep the view while the
 * model grows under a push/pull drag); otherwise whenever the model size changes noticeably.
 */
export function Scene3D({ build, deps, children, interact, frameKey }: { build: (root: THREE.Group) => BuildResult; deps: unknown[]; children?: ReactNode; interact?: (api: Scene3DApi) => () => void; frameKey?: string }) {
  const interactRef = useRef(interact);
  interactRef.current = interact;
  const host = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<{ scene: THREE.Scene; content: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls; sun: THREE.DirectionalLight; ao: GTAOPass | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const lastSize = useRef<string>('');
  const clipRef = useRef<THREE.Plane[] | null>(null);
  const aoRef = useRef(true);
  const { ao: aoOn } = useLayout();
  aoRef.current = aoOn;

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#16181c');
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#16181c');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;
    scene.fog = new THREE.Fog('#16181c', 4, 14);
    scene.add(new THREE.HemisphereLight('#ffffff', '#202328', 0.25));
    const sun = new THREE.DirectionalLight('#fff8ee', 2.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#dbe4ff', 0.5);
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#111317', roughness: 0.95, envMapIntensity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(40, 160, '#2a2e35', '#23262c');
    grid.position.y = 0.0005;
    scene.add(grid);
    const content = new THREE.Group();
    scene.add(content);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    // ambient occlusion: darkens creases, recesses and contact areas
    let composer: EffectComposer | null = null, ao: GTAOPass | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      ao = new GTAOPass(scene, camera, 2, 2);
      ao.blendIntensity = 0.85;
      composer.addPass(ao);
      composer.addPass(new OutputPass());
    } catch { composer = null; ao = null; }
    ctxRef.current = { scene, content, camera, controls, sun, ao };
    renderer.localClippingEnabled = true;
    const clip = (planes: THREE.Plane[] | null) => {
      clipRef.current = planes;
      applyClip(content, planes);
      // the AO normal pass ignores clipping: it would shade the cut away parts
      if (ao) ao.enabled = !planes && aoRef.current;
    };
    const stopInteract = interactRef.current?.({ camera, dom: renderer.domElement, content, controls, clip });
    let raf = 0;
    const loop = () => {
      controls.update();
      if (composer) composer.render(); else renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      stopInteract?.();
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeTree(content);
      composer?.dispose();
      envTex.dispose();
      pmrem.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => { if (ctxRef.current?.ao) ctxRef.current.ao.enabled = aoOn && !clipRef.current; }, [aoOn]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { content, camera, controls, sun, scene, ao } = ctx;
    disposeTree(content);
    content.clear();
    const root = new THREE.Group();
    root.scale.setScalar(S);
    content.add(root);
    const res = build(root);
    content.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (clipRef.current) applyClip(content, clipRef.current);
    const span = Math.max(res.size.x, res.size.y, res.size.z + Math.abs(res.zShift ?? 0) * 2) * S;
    sun.position.set(span * 1.2, span * 2.6, span * 1.6);
    sun.target.position.set(0, 0, (res.zShift ?? 0) * S);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -span * 1.4;
    sc.right = sc.top = span * 1.4;
    sc.near = 0.01; sc.far = span * 8;
    sc.updateProjectionMatrix();
    const size = Math.max(res.size.x, res.size.y, res.size.z) * S;
    if (scene.fog instanceof THREE.Fog) { scene.fog.near = size * 4; scene.fog.far = size * 12; }
    ao?.updateGtaoMaterial({ radius: Math.max(0.02, size * 0.06), distanceExponent: 1.5, thickness: Math.max(0.02, size * 0.05), scale: 1, samples: 16 });
    // keep the user's camera unless the model changed size noticeably
    const key = frameKey ?? [res.size.x, res.size.y, res.size.z, res.zShift ?? 0].map((x) => Math.round(x / 10)).join('|') + (res.steep ? '|s' : '');
    if (key !== lastSize.current) {
      lastSize.current = key;
      const zShift = (res.zShift ?? 0) * S;
      controls.target.set(0, (res.size.y / 2) * S, zShift);
      if (res.steep) camera.position.set(size * 0.8, size * 2.2, size * 1.35 + zShift);
      else camera.position.set(size * 1.35, size * 1.25, size * 1.9 + zShift);
      camera.near = size / 100;
      camera.far = size * 60;
      camera.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <div className="view3d" ref={host}>
      {failed ? <div className="view3d-fail">3D-Ansicht nicht verfügbar (WebGL fehlt).</div> : null}
      {children}
    </div>
  );
}

/** sets section planes on every material of the model (materials are shared, so each is touched once) */
function applyClip(root: THREE.Object3D, planes: THREE.Plane[] | null) {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (seen.has(mat) || mat.userData.noClip) continue;
      seen.add(mat);
      mat.clippingPlanes = planes;
      mat.clipShadows = true;
      // cut panels show their inside instead of looking hollow
      if (mat.userData.side0 === undefined) mat.userData.side0 = mat.side;
      mat.side = planes ? THREE.DoubleSide : mat.userData.side0;
      mat.needsUpdate = true;
    }
  });
}
