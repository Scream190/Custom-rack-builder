import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseFace, CaseItem, FlightCase } from '../model/types';
import { caseDims, footprint, isDrawer, usableArea } from '../model/cases';

const S = 0.001; // mm -> m

// ------------------------------------------------------------------ procedural textures (shared, never disposed)

let texCache: { lam: THREE.Texture; foam: THREE.Texture } | null = null;

/** small deterministic PRNG so the textures look the same on every load */
function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function bumpCanvas(size: number, count: number, rMin: number, rMax: number, dark: number, seed: number) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = rMin + r() * (rMax - rMin);
    // draw wrapped so the texture tiles without seams
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const cx = x + ox, cy = y + oy;
      if (cx < -rad || cy < -rad || cx > size + rad || cy > size + rad) continue;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, `rgba(30,30,30,${dark})`);
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function textures() {
  if (!texCache) {
    // phenolic film laminate: hammer-tone dimples (texture covers 120 mm)
    const lam = bumpCanvas(256, 900, 3, 7, 0.45, 7);
    // PE foam: fine closed-cell pores (texture covers 60 mm)
    const foam = bumpCanvas(256, 2600, 0.8, 2.2, 0.6, 11);
    texCache = { lam, foam };
  }
  return texCache;
}
const LAM_MM = 120, FOAM_MM = 60;

/** box geometry (mm) whose uvs are scaled to `texMm`, so textures keep their size on every face */
function boxGeo(w: number, h: number, d: number, texMm = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (texMm) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / texMm, (uv.getY(i) * dims[f][1]) / texMm);
    }
  }
  return g;
}

/** foam inlay with rectangular cut-outs (shape in the x/z plane, extruded upwards by `t`) */
function inlayGeo(x0: number, z0: number, x1: number, z1: number, holes: { x: number; z: number; l: number; w: number }[], t: number) {
  const shape = new THREE.Shape();
  // shape coordinates: (x, -z); rotated so that the extrusion points up
  shape.moveTo(x0, -z1); shape.lineTo(x1, -z1); shape.lineTo(x1, -z0); shape.lineTo(x0, -z0); shape.lineTo(x0, -z1);
  for (const h of holes) {
    const r = Math.min(6, h.l / 4, h.w / 4);
    const a = h.x, b = h.x + h.l, c = -(h.z + h.w), d = -h.z;
    const p = new THREE.Path();
    p.moveTo(a + r, c); p.lineTo(b - r, c); p.quadraticCurveTo(b, c, b, c + r); p.lineTo(b, d - r); p.quadraticCurveTo(b, d, b - r, d);
    p.lineTo(a + r, d); p.quadraticCurveTo(a, d, a, d - r); p.lineTo(a, c + r); p.quadraticCurveTo(a, c, a + r, c);
    shape.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / FOAM_MM, uv.getY(i) / FOAM_MM);
  return g;
}

/** quarter-disc flange of a ball corner, in the x/y plane from the origin towards +x/+y, 2 mm thick along +z */
function flangeGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(46, 0); s.absarc(0, 0, 46, 0, Math.PI / 2, false); s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1, curveSegments: 10 });
}

/** butterfly wing of a latch (bow-tie shape) */
function wingGeo(s: number) {
  const p = new THREE.Shape();
  p.moveTo(-22 * s, 0);
  p.bezierCurveTo(-22 * s, -13 * s, -6 * s, -10 * s, 0, -4 * s);
  p.bezierCurveTo(6 * s, -10 * s, 22 * s, -13 * s, 22 * s, 0);
  p.bezierCurveTo(22 * s, 13 * s, 6 * s, 10 * s, 0, 4 * s);
  p.bezierCurveTo(-6 * s, 10 * s, -22 * s, 13 * s, -22 * s, 0);
  return new THREE.ExtrudeGeometry(p, { depth: 2.5, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2, curveSegments: 12 });
}

// ------------------------------------------------------------------ component

interface Ctx { scene: THREE.Scene; content: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls; sun: THREE.DirectionalLight }

/** 3D preview of a flight case: laminate shell, aluminium angles with rivets, ball corners, recessed hardware, castors,
 *  foam inlay with cut-outs and contents; lid open or closed. Drawer inlays are shown in a steel rack drawer. */
export function Case3D({ c }: { c: FlightCase }) {
  const host = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);

  // renderer, environment, lights, camera, controls (once)
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
    ctxRef.current = { scene, content, camera, controls, sun };
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      envTex.dispose();
      pmrem.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  // content
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { content, camera, controls, sun } = ctx;
    content.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    });
    content.clear();
    buildCase(content, c, open);
    content.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });

    const d = caseDims(c);
    const span = Math.max(d.L, d.W + (open && !isDrawer(c) && d.lidH && c.lidKind !== 'hinged' ? d.W + 150 : 0), d.H) * S;
    sun.position.set(span * 1.2, span * 2.6, span * 1.6);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -span * 1.4;
    sc.right = sc.top = span * 1.4;
    sc.near = 0.01; sc.far = span * 8;
    sc.updateProjectionMatrix();
    const size = Math.max(d.L, d.W, d.H) * S;
    if (ctx.scene.fog instanceof THREE.Fog) { ctx.scene.fog.near = size * 4; ctx.scene.fog.far = size * 12; }
    const zShift = open && d.lidH && !isDrawer(c) && c.lidKind !== 'hinged' ? -(d.W / 2 + 75) * S : 0;
    controls.target.set(0, (d.H / 2) * S, zShift);
    camera.position.set(size * 1.35, size * 1.25, size * 1.9 + zShift);
    camera.near = size / 100;
    camera.far = size * 60;
    camera.updateProjectionMatrix();
  }, [c, open]);

  return (
    <div className="view3d" ref={host}>
      {failed ? <div className="view3d-fail">3D-Ansicht nicht verfügbar (WebGL fehlt).</div> : null}
      {!isDrawer(c) && c.lidKind !== 'none' ? (
        <button className="btn sm" style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }} onClick={() => setOpen(!open)}>{open ? 'Deckel schließen' : 'Deckel öffnen'}</button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ scene building (all sizes in mm)

const ITEM_TONES = ['#26292e', '#33373d', '#1f2125', '#3b4047', '#2c3036', '#41464d'];

function buildCase(content: THREE.Group, c: FlightCase, open: boolean) {
  const tex = textures();
  const d = caseDims(c);
  const drawer = isDrawer(c);
  const mats = {
    lam: new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.55, metalness: 0.05, bumpMap: tex.lam, bumpScale: 1.6, envMapIntensity: 0.7 }),
    alu: new THREE.MeshStandardMaterial({ color: '#c2c6cb', metalness: 0.9, roughness: 0.36 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#dcdfe3', metalness: 1, roughness: 0.1, side: THREE.DoubleSide }),
    recess: new THREE.MeshStandardMaterial({ color: '#1b1c1f', metalness: 0.5, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#2b2e34', roughness: 0.88 }),
    hub: new THREE.MeshStandardMaterial({ color: '#8d949d', roughness: 0.45, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: '#151619', roughness: 0.5, metalness: 0.2 }),
    red: new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 }),
    foam: new THREE.MeshStandardMaterial({ color: c.foam.color, roughness: 1, bumpMap: tex.foam, bumpScale: 2.2, envMapIntensity: 0.35 }),
    ply: new THREE.MeshStandardMaterial({ color: '#c8a77a', roughness: 0.7 }),
  };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const rivetGeo = new THREE.SphereGeometry(2.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const rivets: { p: THREE.Vector3; n: THREE.Vector3; parent: THREE.Object3D }[] = [];
  const rivet = (parent: THREE.Object3D, x: number, y: number, z: number, nx: number, ny: number, nz: number) => rivets.push({ p: new THREE.Vector3(x, y, z), n: new THREE.Vector3(nx, ny, nz), parent });
  const steps = (a: number, b: number, step: number) => {
    const n = Math.max(1, Math.round((b - a) / step));
    return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  };

  // root group in mm, scaled to metres
  const root = new THREE.Group();
  root.scale.setScalar(S);
  content.add(root);

  if (drawer) {
    buildDrawer(root, c, mats, add);
    addFoam(root, c, 'body', 1.5, c.inner.h - 1.5, mats, add);
    return;
  }

  const L = d.L, W = d.W;
  const e = c.profile === 'alu30' ? 2 : c.profile === 'alu35' ? 2.5 : 0; // aluminium thickness on the outside
  const leg = c.profile === 'alu35' ? 35 : 30;
  const p = c.panel;
  const hasLid = d.lidH > 0;
  const closeH = hasLid ? 20 : 0; // closing profile height per half

  /** open-top shell (bottom + 4 walls) with angles, closing profile and ball corners; local y = 0 at the outer bottom */
  const tray = (H: number, withBalls: boolean) => {
    const g = new THREE.Group();
    add(g, boxGeo(L - 2 * e, p, W - 2 * e, LAM_MM), mats.lam, 0, e + p / 2, 0);
    add(g, boxGeo(L - 2 * e, H - e, p, LAM_MM), mats.lam, 0, e + (H - e) / 2, W / 2 - e - p / 2);
    add(g, boxGeo(L - 2 * e, H - e, p, LAM_MM), mats.lam, 0, e + (H - e) / 2, -W / 2 + e + p / 2);
    add(g, boxGeo(p, H - e, W - 2 * e - 2 * p, LAM_MM), mats.lam, L / 2 - e - p / 2, e + (H - e) / 2, 0);
    add(g, boxGeo(p, H - e, W - 2 * e - 2 * p, LAM_MM), mats.lam, -L / 2 + e + p / 2, e + (H - e) / 2, 0);
    if (c.profile !== 'none') {
      const t = 1.6, top = H - closeH;
      // vertical angles
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(g, boxGeo(leg, top, t), mats.alu, sx * (L / 2 - leg / 2), top / 2, sz * (W / 2 - t / 2));
        add(g, boxGeo(t, top, leg), mats.alu, sx * (L / 2 - t / 2), top / 2, sz * (W / 2 - leg / 2));
        for (const y of steps(60, top - 40, 110)) {
          rivet(g, sx * (L / 2 - leg / 2), y, sz * W / 2, 0, 0, sz);
          rivet(g, sx * L / 2, y, sz * (W / 2 - leg / 2), sx, 0, 0);
        }
      }
      // bottom angles
      for (const sz of [-1, 1]) {
        add(g, boxGeo(L, leg, t), mats.alu, 0, leg / 2, sz * (W / 2 - t / 2));
        add(g, boxGeo(L, t, leg), mats.alu, 0, t / 2, sz * (W / 2 - leg / 2));
        for (const x of steps(-L / 2 + 70, L / 2 - 70, 120)) rivet(g, x, leg / 2, sz * W / 2, 0, 0, sz);
      }
      for (const sx of [-1, 1]) {
        add(g, boxGeo(t, leg, W), mats.alu, sx * (L / 2 - t / 2), leg / 2, 0);
        add(g, boxGeo(leg, t, W), mats.alu, sx * (L / 2 - leg / 2), t / 2, 0);
        for (const z of steps(-W / 2 + 70, W / 2 - 70, 120)) rivet(g, sx * L / 2, leg / 2, z, sx, 0, 0);
      }
      if (!hasLid) {
        // open case: plain top angle instead of a closing profile
        for (const sz of [-1, 1]) add(g, boxGeo(L, leg, t), mats.alu, 0, H - leg / 2, sz * (W / 2 - t / 2));
        for (const sx of [-1, 1]) add(g, boxGeo(t, leg, W), mats.alu, sx * (L / 2 - t / 2), H - leg / 2, 0);
      }
    }
    if (closeH) {
      // hybrid closing profile: band on the outside and rim over the panel edges
      const bt = 4, rim = p + e + 2;
      for (const sz of [-1, 1]) add(g, boxGeo(L + 2, closeH, bt), mats.alu, 0, H - closeH / 2, sz * (W / 2 - bt / 2 + 1));
      for (const sx of [-1, 1]) add(g, boxGeo(bt, closeH, W + 2), mats.alu, sx * (L / 2 - bt / 2 + 1), H - closeH / 2, 0);
      for (const sz of [-1, 1]) add(g, boxGeo(L, 3, rim), mats.alu, 0, H - 1.5, sz * (W / 2 - rim / 2));
      for (const sx of [-1, 1]) add(g, boxGeo(rim, 3, W - 2 * rim), mats.alu, sx * (L / 2 - rim / 2), H - 1.5, 0);
      for (const sz of [-1, 1]) for (const x of steps(-L / 2 + 60, L / 2 - 60, 150)) rivet(g, x, H - closeH / 2, sz * (W / 2 + 1), 0, 0, sz);
      for (const sx of [-1, 1]) for (const z of steps(-W / 2 + 60, W / 2 - 60, 150)) rivet(g, sx * (L / 2 + 1), H - closeH / 2, z, sx, 0, 0);
    }
    if (withBalls) {
      const fg = flangeGeo();
      const dome = new THREE.SphereGeometry(17, 24, 16);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const a = new THREE.Mesh(fg, mats.chrome); // front/back face
        a.scale.set(-sx, 1, sz); a.position.set(sx * L / 2, 0, sz * W / 2); g.add(a);
        const b = new THREE.Mesh(fg, mats.chrome); // side face
        b.rotation.y = Math.PI / 2; b.scale.set(sz, 1, sx); b.position.set(sx * L / 2, 0, sz * W / 2); g.add(b);
        const cc = new THREE.Mesh(fg, mats.chrome); // bottom
        cc.rotation.x = Math.PI / 2; cc.scale.set(-sx, -sz, 1); cc.position.set(sx * L / 2, 0, sz * W / 2); g.add(cc);
        add(g, dome, mats.chrome, sx * (L / 2 - 12), 15, sz * (W / 2 - 12));
      }
    }
    return g;
  };

  const y0 = d.castorH;
  const body = tray(d.bodyH, true);
  body.position.y = y0;
  root.add(body);
  const t = d.bodyH - d.bodyInner; // panel + aluminium
  addFoam(body, c, 'body', t, d.bodyInner, mats, add);

  // lid: local y = 0 at the split line, y = lidH at the top
  let lid: THREE.Group | null = null;
  if (hasLid) {
    lid = new THREE.Group();
    const shell = tray(d.lidH, true);
    shell.rotation.x = Math.PI;
    shell.position.y = d.lidH;
    lid.add(shell);
    addFoam(lid, c, 'lid', t, c.lidH, mats, add);
  }

  // ---------------------------------------------------------------- hardware
  /** mount frame on a face: local x along the face (as seen from outside), y up, z outwards (z = 0 on the surface) */
  const mount = (parent: THREE.Object3D, face: CaseFace, s: number, y: number) => {
    const g = new THREE.Group();
    if (face === 'front') { g.position.set(-L / 2 + s * L, y, W / 2); }
    else if (face === 'back') { g.position.set(L / 2 - s * L, y, -W / 2); g.rotation.y = Math.PI; }
    else if (face === 'left') { g.position.set(-L / 2, y, -W / 2 + s * W); g.rotation.y = -Math.PI / 2; }
    else if (face === 'right') { g.position.set(L / 2, y, W / 2 - s * W); g.rotation.y = Math.PI / 2; }
    else if (face === 'top') { g.position.set(-L / 2 + s * L, y, 0); g.rotation.x = -Math.PI / 2; }
    parent.add(g);
    return g;
  };
  const smallRivet = new THREE.SphereGeometry(2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const hwRivet = (g: THREE.Group, x: number, y: number, z: number) => { const m = add(g, smallRivet, mats.chrome, x, y, z); m.rotation.x = Math.PI / 2; };
  const recessedHandle = (g: THREE.Group) => {
    add(g, new RoundedBoxGeometry(150, 96, 4, 3, 6), mats.chrome, 0, 0, 0);
    add(g, new RoundedBoxGeometry(126, 72, 1, 2, 8), mats.recess, 0, 0, 2.2);
    const bar = add(g, new THREE.CylinderGeometry(6, 6, 100, 16), mats.chrome, 0, -14, 7);
    bar.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) add(g, boxGeo(6, 30, 5), mats.chrome, sx * 50, 0, 5);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) hwRivet(g, sx * 66, sy * 40, 2);
  };
  const butterfly = (h: { face: CaseFace; count: number; kind: string }) => {
    const s = h.kind === 'butterfly' ? 1 : 0.7;
    const wg = wingGeo(s);
    for (let k = 0; k < h.count; k++) {
      const pos = (k + 1) / (h.count + 1);
      const g = mount(body, h.face, pos, d.bodyH - closeH - 2);
      const cy = -28 * s;
      add(g, new RoundedBoxGeometry(68 * s, 54 * s, 4, 3, 5), mats.chrome, 0, cy, 0);
      add(g, new RoundedBoxGeometry(54 * s, 40 * s, 1, 2, 4), mats.recess, 0, cy, 2.2);
      add(g, wg, mats.chrome, 0, cy, 2.6);
      add(g, new THREE.CylinderGeometry(4.5, 4.5, 5, 14), mats.chrome, 0, cy, 4).rotation.x = Math.PI / 2;
      add(g, boxGeo(7 * s, 40 * s, 2.5), mats.chrome, 0, cy / 2 + 12 * s, 3.5);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) hwRivet(g, sx * 29 * s, cy + sy * 22 * s, 2);
      if (lid) {
        const kg = mount(lid, h.face, pos, closeH + 2);
        add(kg, new RoundedBoxGeometry(40 * s, 18 * s, 4, 2, 2), mats.chrome, 0, 9 * s, 0);
        add(kg, boxGeo(18 * s, 6 * s, 3), mats.recess, 0, 6 * s, 2);
        for (const sx of [-1, 1]) hwRivet(kg, sx * 14 * s, 11 * s, 2);
      }
    }
  };
  for (const h of c.hardware) {
    const isTop = h.face === 'top';
    const parent = isTop ? lid ?? body : body;
    const topY = isTop ? (lid ? d.lidH : d.bodyH) : 0;
    if (h.kind === 'butterfly' || h.kind === 'butterfly-small') { butterfly(h); continue; }
    if (h.kind === 'stack-cup') {
      if (!lid) continue;
      for (let k = 0; k < h.count; k++) {
        const sx = k % 2 ? 1 : -1, sz = k < 2 ? 1 : -1;
        add(lid, new THREE.CylinderGeometry(42, 42, 2, 32), mats.chrome, sx * (L / 2 - 70), d.lidH + 1, sz * (W / 2 - 70));
        add(lid, new THREE.CylinderGeometry(33, 33, 2.4, 32), mats.recess, sx * (L / 2 - 70), d.lidH + 1.2, sz * (W / 2 - 70));
      }
      continue;
    }
    for (let k = 0; k < h.count; k++) {
      const pos = (k + 1) / (h.count + 1);
      if (h.kind === 'handle-recessed') recessedHandle(mount(parent, h.face, pos, isTop ? topY : d.bodyH * 0.5));
      else if (h.kind === 'handle-strap') {
        const g = mount(parent, h.face, pos, isTop ? topY : d.bodyH * 0.55);
        add(g, new RoundedBoxGeometry(130, 24, 7, 2, 3), mats.black, 0, 0, 6);
        for (const sx of [-1, 1]) { add(g, new RoundedBoxGeometry(20, 30, 6, 2, 2), mats.chrome, sx * 72, 0, 3); hwRivet(g, sx * 72, 0, 6); }
      } else if (h.kind === 'label') {
        const g = mount(parent, h.face, pos, isTop ? topY : 90);
        add(g, new RoundedBoxGeometry(92, 58, 3, 2, 3), mats.chrome, 0, 0, 0);
        add(g, boxGeo(78, 44, 0.6), mats.white, 0, 0, 1.6);
        for (const ly of [8, -4]) add(g, boxGeo(50, 2, 0.4), mats.recess, -8, ly, 2);
      } else if (h.kind === 'hinge') {
        const g = mount(body, h.face, pos, d.bodyH);
        add(g, boxGeo(60, 22, 3), mats.chrome, 0, -11 - closeH, 1.5);
        add(g, new THREE.CylinderGeometry(4, 4, 60, 12), mats.chrome, 0, 0, 5).rotation.z = Math.PI / 2;
        if (lid) { const kg = mount(lid, h.face, pos, 0); add(kg, boxGeo(60, 22, 3), mats.chrome, 0, 11 + closeH, 1.5); }
      }
    }
  }

  // castors / skids
  const castorList = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked');
  const nCastors = castorList.reduce((n, h) => n + h.count, 0);
  const nBraked = c.hardware.filter((h) => h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  if (nCastors) {
    const r = c.castorSize / 2;
    const pos = nCastors >= 4 ? [[-1, 1], [1, 1], [-1, -1], [1, -1]] : [[-1, 0], [1, 0]];
    const tire = new THREE.CylinderGeometry(r, r, 30, 32);
    const hub = new THREE.CylinderGeometry(r * 0.6, r * 0.6, 33, 24);
    const axle = new THREE.CylinderGeometry(7, 7, 46, 12);
    pos.forEach(([sx, sz], i) => {
      const cx = sx * (L / 2 - 75), cz = sz * (W / 2 - 75);
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      root.add(g);
      add(g, new RoundedBoxGeometry(100, 5, 86, 2, 1.5), mats.chrome, 0, y0 - 2.5, 0);
      for (const ax of [-1, 1]) for (const az of [-1, 1]) { const m = add(g, smallRivet, mats.chrome, ax * 40, y0 - 5, az * 33); m.rotation.x = Math.PI; }
      add(g, new THREE.CylinderGeometry(30, 30, 12, 28), mats.chrome, 0, y0 - 11, 0);
      const forkTop = y0 - 17;
      for (const fx of [-1, 1]) {
        const plate = add(g, boxGeo(4, forkTop - r, 44), mats.chrome, fx * 21, (forkTop + r) / 2, -8);
        plate.rotation.x = 0.12;
      }
      add(g, boxGeo(46, 4, 46), mats.chrome, 0, forkTop - 2, -6);
      const w1 = add(g, tire, mats.rubber, 0, r, -14); w1.rotation.z = Math.PI / 2;
      const w2 = add(g, hub, mats.hub, 0, r, -14); w2.rotation.z = Math.PI / 2;
      const w3 = add(g, axle, mats.chrome, 0, r, -14); w3.rotation.z = Math.PI / 2;
      if (i < nBraked) {
        const ped = add(g, new RoundedBoxGeometry(34, 6, 30, 2, 2), mats.red, 0, forkTop - 6, 26);
        ped.rotation.x = -0.35;
      }
    });
  } else if (c.hardware.some((h) => h.kind === 'skid')) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, new RoundedBoxGeometry(70, d.castorH, 40, 2, 3), mats.rubber, sx * (L / 2 - 80), d.castorH / 2, sz * (W / 2 - 60));
  }

  // lid placement
  if (lid) {
    const bodyTop = y0 + d.bodyH;
    if (!open) { lid.position.set(0, bodyTop, 0); root.add(lid); }
    else if (c.lidKind === 'hinged') {
      const pivot = new THREE.Group();
      pivot.position.set(0, bodyTop, -W / 2);
      lid.position.set(0, 0, W / 2);
      pivot.add(lid);
      pivot.rotation.x = -1.9;
      root.add(pivot);
    } else {
      // removable / telescope lid: set down behind the case, upside down
      lid.rotation.x = Math.PI;
      lid.position.set(0, d.lidH + 3, -(W + 150));
      root.add(lid);
    }
  }

  // rivets as one instanced mesh per parent
  const byParent = new Map<THREE.Object3D, typeof rivets>();
  for (const rv of rivets) byParent.set(rv.parent, [...(byParent.get(rv.parent) ?? []), rv]);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [parent, list] of byParent) {
    const inst = new THREE.InstancedMesh(rivetGeo.clone(), mats.alu.clone(), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    list.forEach((rv, i) => { q.setFromUnitVectors(up, rv.n); m.compose(rv.p, q, one); inst.setMatrixAt(i, m); });
    inst.castShadow = true;
    parent.add(inst);
  }
  rivetGeo.dispose();
}

type Mats = Record<'lam' | 'alu' | 'chrome' | 'recess' | 'rubber' | 'hub' | 'black' | 'red' | 'white' | 'foam' | 'ply', THREE.MeshStandardMaterial>;
type Add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => THREE.Mesh;

/**
 * Foam of one layer. Body: `floor` is the inner bottom, `space` the inner height of the body (foam grows upwards).
 * Lid: coordinates of the lid group (y = 0 at the split), `floor` is the panel thickness at the top, `space` the inner
 * lid height (foam hangs from the ceiling).
 */
function addFoam(parent: THREE.Object3D, c: FlightCase, layer: CaseItem['layer'], floor: number, space: number, mats: Mats, add: Add) {
  const il = c.inner.l, iw = c.inner.w;
  const X = (x: number) => -il / 2 + x;           // item x -> world x
  const Z = (y: number) => iw / 2 - y;            // item y (from the front) -> world z
  const area = usableArea(c);
  const items = c.items.filter((i) => i.layer === layer);
  const lidMode = layer === 'lid';
  const base = lidMode ? c.foam.lid : c.foam.bottom;
  // y of the foam surface the items rest on, and direction (+1 up for the body, -1 down for the lid)
  const ceil = lidMode ? (caseDimsLidTop(c) - floor) : floor;
  const dir = lidMode ? -1 : 1;
  if (base > 0) add(parent, boxGeo(il, base, iw, FOAM_MM), mats.foam, 0, ceil + dir * base / 2, 0);
  const surf = ceil + dir * base;
  // side foam strips
  const sides = c.foam.sides;
  const sideH = Math.max(0, space - base);
  if (sides > 0 && sideH > 0) {
    const yc = surf + dir * sideH / 2;
    for (const sz of [-1, 1]) add(parent, boxGeo(il, sideH, sides, FOAM_MM), mats.foam, 0, yc, sz * (iw / 2 - sides / 2));
    for (const sx of [-1, 1]) add(parent, boxGeo(sides, sideH, iw - 2 * sides, FOAM_MM), mats.foam, sx * (il / 2 - sides / 2), yc, 0);
  }
  // dividers (body only)
  if (!lidMode) for (const dv of c.dividers) {
    if (dv.axis === 'x') add(parent, boxGeo(il, space, 7), mats.ply, 0, floor + space / 2, Z(dv.pos));
    else add(parent, boxGeo(7, space, iw), mats.ply, X(dv.pos), floor + space / 2, 0);
  }
  if (!items.length) return;
  // inlay with cut-outs for items inside the usable area that do not overlap each other
  const inside = (it: CaseItem) => { const f = footprint(it); return it.x >= area.x0 - 0.5 && it.y >= area.y0 - 0.5 && it.x + f.l <= area.x1 + 0.5 && it.y + f.w <= area.y1 + 0.5; };
  const holes: { x: number; y: number; l: number; w: number }[] = [];
  for (const it of items) {
    if (!inside(it)) continue;
    const f = footprint(it);
    // keep at least 1 mm of foam to the outer contour so the triangulation stays clean
    const x = Math.max(it.x, area.x0 + 1), y = Math.max(it.y, area.y0 + 1);
    const r = { x, y, l: Math.min(it.x + f.l, area.x1 - 1) - x, w: Math.min(it.y + f.w, area.y1 - 1) - y };
    if (r.l < 4 || r.w < 4) continue;
    const hit = holes.some((h) => r.x < h.x + h.l + 2 && h.x < r.x + r.l + 2 && r.y < h.y + h.w + 2 && h.y < r.y + r.w + 2);
    if (!hit) holes.push(r);
  }
  const T = Math.max(10, Math.min(Math.max(...items.map((i) => i.h)), sideH || space));
  if (sideH > 0 && area.x1 > area.x0 && area.y1 > area.y0) {
    const g = inlayGeo(X(area.x0), Z(area.y1), X(area.x1), Z(area.y0), holes.map((h) => ({ x: X(h.x), z: Z(h.y + h.w), l: h.l, w: h.w })), T);
    add(parent, g, mats.foam, 0, lidMode ? surf - T : surf, 0);
  }
  items.forEach((it, i) => {
    const f = footprint(it);
    const outside = it.x >= il || it.y >= iw || it.x + f.l <= 0 || it.y + f.w <= 0;
    const r = Math.max(0.5, Math.min(4, f.l / 6, f.w / 6, it.h / 6));
    const m = new THREE.MeshStandardMaterial({ color: ITEM_TONES[i % ITEM_TONES.length], roughness: 0.5, metalness: 0.1 });
    const geo = new RoundedBoxGeometry(f.l, it.h, f.w, 2, r);
    if (outside) {
      // did not fit: shown on the floor next to the case (root coordinates are not reachable here, so offset by the floor height)
      add(parent, geo, m, X(it.x + f.l / 2), lidMode ? surf - it.h / 2 : it.h / 2 - parent.position.y, Z(it.y + f.w / 2));
    } else {
      add(parent, geo, m, X(it.x + f.l / 2), surf + dir * it.h / 2, Z(it.y + f.w / 2));
    }
  });
}

/** inner top of the lid group (lid height incl. panel), helper for addFoam */
function caseDimsLidTop(c: FlightCase) { return caseDims(c).lidH; }

/** steel 19" rack drawer around a drawer inlay */
function buildDrawer(root: THREE.Group, c: FlightCase, mats: Mats, add: Add) {
  const l = c.inner.l, w = c.inner.w, h = c.inner.h;
  const steel = mats.black;
  const t = 1.5;
  add(root, boxGeo(l + 2 * t, t, w + t), steel, 0, t / 2, -t / 2);
  for (const sx of [-1, 1]) add(root, boxGeo(t, h, w + t), steel, sx * (l / 2 + t / 2), h / 2, -t / 2);
  add(root, boxGeo(l + 2 * t, h, t), steel, 0, h / 2, -w / 2 - t / 2);
  // front panel with rack ears and handles
  const fw = l + 72, fh = h + 14;
  add(root, new RoundedBoxGeometry(fw, fh, 3, 2, 1), steel, 0, fh / 2 - 7, w / 2 + 1.5);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const hole = add(root, new THREE.CylinderGeometry(3.3, 3.3, 3.4, 12), mats.recess, sx * (fw / 2 - 8), fh / 2 - 7 + sy * Math.max(0, fh / 2 - 12), w / 2 + 1.6);
      hole.rotation.x = Math.PI / 2;
    }
    const hx = sx * (fw / 2 - 26);
    const bar = add(root, new THREE.CylinderGeometry(4, 4, Math.max(20, fh - 20), 14), mats.chrome, hx, fh / 2 - 7, w / 2 + 26);
    bar.castShadow = true;
    for (const sy of [-1, 1]) add(root, new THREE.CylinderGeometry(3.5, 3.5, 24, 12), mats.chrome, hx, fh / 2 - 7 + sy * (fh / 2 - 12), w / 2 + 14).rotation.x = Math.PI / 2;
  }
  root.position.y = 7 * S;
}
