/*
 * 3D export of a rack: the same scene as the 3D view (case, rails, devices with their panel drawings, cables).
 *  - GLB (glTF 2.0, binary, textures embedded): Blender, Cinema 4D, Fusion, SketchUp, Windows 3D viewer, web viewers
 *  - USDZ: AR Quick Look on iPhone / iPad / Mac
 *  - STL (mm): geometry only, for CAD and 3D printing
 *  - PNG: rendered still from the start view
 */
import * as THREE from 'three';
import type { Project, Rack } from '../model/types';
import { buildRackScene } from '../three/rackScene';

/** build the scene off-screen and wait for all panel textures */
async function sceneOf(project: Project, rack: Rack) {
  const cache = new Map<string, Promise<THREE.Texture>>();
  const sc = buildRackScene(project, rack, (key, make) => {
    let p = cache.get(key);
    if (!p) { p = make(); cache.set(key, p); }
    return p;
  });
  await sc.ready;
  sc.root.name = rack.name;
  const dispose = async () => {
    sc.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      // maps too: baked rear textures are not in the cache (disposing a texture twice is harmless)
      for (const x of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); }
    });
    for (const p of cache.values()) (await p).dispose();
  };
  return { sc, dispose };
}

/**
 * Exporters handle one material per mesh best (the USDZ exporter skips meshes with several): split the device boxes
 * (one material per face group) into one mesh per group. Cables become opaque (the view only fades them for highlights).
 */
function prepare(root: THREE.Object3D) {
  const multi: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (Array.isArray(m.material)) multi.push(m);
    else if (m.userData.cableId) { (m.material as THREE.Material).transparent = false; (m.material as THREE.MeshStandardMaterial).opacity = 1; }
  });
  for (const m of multi) {
    const mats = m.material as THREE.Material[];
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    for (const g of m.geometry.groups) {
      const part = new THREE.BufferGeometry();
      // non-indexed copy: the group's index range becomes a vertex range
      for (const name of Object.keys(geo.attributes)) {
        const a = geo.attributes[name] as THREE.BufferAttribute;
        part.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize), a.itemSize));
      }
      const mesh = new THREE.Mesh(part, mats[g.materialIndex ?? 0]);
      mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale);
      mesh.userData = { ...m.userData };
      m.parent!.add(mesh);
    }
    if (geo !== m.geometry) geo.dispose();
    m.geometry.dispose();
    m.parent!.remove(m);
  }
}

/** textures with an offset/repeat (rear panels) are baked into their own canvas, so every format shows them right */
function bakeTransforms(root: THREE.Object3D) {
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (!map || (map.repeat.x === 1 && map.offset.x === 0)) continue;
      const img = map.image as HTMLCanvasElement;
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(img.width * map.repeat.x));
      c.height = img.height;
      c.getContext('2d')!.drawImage(img, img.width * map.offset.x, 0, img.width * map.repeat.x, img.height, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      (m as THREE.MeshStandardMaterial).map = t;
    }
  });
}

export async function exportRackGlb(project: Project, rack: Rack): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const { sc, dispose } = await sceneOf(project, rack);
  prepare(sc.root);
  bakeTransforms(sc.root);
  try {
    const out = await new GLTFExporter().parseAsync(sc.root, { binary: true, onlyVisible: true });
    return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
  } finally { await dispose(); }
}

export async function exportRackUsdz(project: Project, rack: Rack): Promise<Blob> {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const { sc, dispose } = await sceneOf(project, rack);
  prepare(sc.root);
  bakeTransforms(sc.root);
  try {
    // AR Quick Look places the model on the floor: lift it so the case stands on y = 0
    const g = new THREE.Group();
    sc.root.position.y = -sc.floorY;
    g.add(sc.root);
    const out = await new USDZExporter().parseAsync(g);
    return new Blob([out], { type: 'model/vnd.usdz+zip' });
  } finally { await dispose(); }
}

export async function exportRackStl(project: Project, rack: Rack): Promise<Blob> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const { sc, dispose } = await sceneOf(project, rack);
  try {
    // STL has no units; CAD programs expect millimetres
    const g = new THREE.Group();
    g.scale.setScalar(1000);
    g.add(sc.root);
    g.updateMatrixWorld(true);
    const out = new STLExporter().parse(g, { binary: true }) as DataView;
    return new Blob([out.buffer as ArrayBuffer], { type: 'model/stl' });
  } finally { await dispose(); }
}

/** rendered still from the start view (the same direction as the 3D view's home button) */
export async function renderRack3dPng(project: Project, rack: Rack, w = 2400, h = 1600, background = '#ffffff'): Promise<Blob> {
  const { sc, dispose } = await sceneOf(project, rack);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  try {
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    scene.add(new THREE.HemisphereLight('#ffffff', '#30343b', 1.6));
    const d1 = new THREE.DirectionalLight('#ffffff', 1.4); d1.position.set(1, 2, 2); scene.add(d1);
    const d2 = new THREE.DirectionalLight('#ffffff', 0.6); d2.position.set(-1, 1, -2); scene.add(d2);
    scene.add(sc.root);
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.005, 60);
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // the bounding sphere is generous (case corners); 0.8 fills the frame without cutting the rack
    const dist = (sc.radius * 0.8) / Math.sin(Math.min(vfov, hfov) / 2);
    camera.position.copy(sc.center).addScaledVector(new THREE.Vector3(0.5, 0.32, 1).normalize(), dist);
    camera.lookAt(sc.center);
    renderer.render(scene, camera);
    return await new Promise<Blob>((res, rej) => renderer.domElement.toBlob((b) => (b ? res(b) : rej(new Error('PNG konnte nicht erzeugt werden'))), 'image/png'));
  } finally {
    renderer.dispose();
    await dispose();
  }
}
