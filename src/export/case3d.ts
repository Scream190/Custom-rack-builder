/*
 * 3D export of a flight case: the same model as the 3D view (closed, with hardware, castors and foam inside).
 *  - GLB (glTF 2.0, metres): Fusion, Blender, SketchUp, Windows 3D viewer, web viewers
 *  - STL (mm): geometry only, for CAD and 3D printing
 *  - USDZ: AR Quick Look on iPhone / iPad / Mac
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FlightCase } from '../model/types';
import { buildCase } from '../three/Case3D';
import { S, disposeTree } from '../three/caseParts';
import { bakeTransforms, prepare } from './rack3d';

/** the model in metres (like the 3D view), with instanced rivets turned into plain meshes */
function caseScene(c: FlightCase, open = false) {
  const root = new THREE.Group();
  root.name = c.name;
  const model = new THREE.Group();
  model.scale.setScalar(S);
  root.add(model);
  buildCase(model, c, open);
  // exporters do not all understand instancing: bake every instance into one merged geometry
  const inst: THREE.InstancedMesh[] = [];
  root.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) inst.push(o as THREE.InstancedMesh); });
  for (const im of inst) {
    const m = new THREE.Matrix4();
    const parts: THREE.BufferGeometry[] = [];
    const base = im.geometry.index ? im.geometry.toNonIndexed() : im.geometry.clone();
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); parts.push(base.clone().applyMatrix4(m)); }
    const merged = parts.length ? mergeGeometries(parts) : null;
    if (merged) {
      const mesh = new THREE.Mesh(merged, im.material);
      mesh.position.copy(im.position); mesh.quaternion.copy(im.quaternion); mesh.scale.copy(im.scale);
      im.parent!.add(mesh);
    }
    parts.forEach((g) => g.dispose()); base.dispose();
    im.parent!.remove(im);
    im.geometry.dispose();
  }
  root.updateMatrixWorld(true);
  return root;
}

export async function exportCaseGlb(c: FlightCase): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const root = caseScene(c);
  prepare(root);
  bakeTransforms(root);
  try {
    const out = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
    return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
  } finally { disposeTree(root); }
}

export async function exportCaseStl(c: FlightCase): Promise<Blob> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const root = caseScene(c);
  try {
    // STL has no units; CAD programs expect millimetres
    const g = new THREE.Group();
    g.scale.setScalar(1 / S);
    g.add(root);
    g.updateMatrixWorld(true);
    const out = new STLExporter().parse(g, { binary: true }) as DataView;
    return new Blob([out.buffer as ArrayBuffer], { type: 'model/stl' });
  } finally { disposeTree(root); }
}

export async function exportCaseUsdz(c: FlightCase): Promise<Blob> {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const root = caseScene(c);
  prepare(root);
  bakeTransforms(root);
  try {
    const out = await new USDZExporter().parseAsync(root);
    return new Blob([out], { type: 'model/vnd.usdz+zip' });
  } finally { disposeTree(root); }
}
