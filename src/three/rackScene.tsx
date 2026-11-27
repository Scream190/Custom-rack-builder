/*
 * The 3D scene of a rack (case shell, rails, devices with their panel drawings, routed cables), shared by the
 * 3D view and the 3D export. Units: metres, x = right (front view), y = up, z = towards the viewer, front rails at z = 0.
 */
import * as THREE from 'three';
import { renderMarkup as renderToStaticMarkup } from '../i18n/render';
import type { Project, Rack } from '../model/types';
import { bayDepth, bayOf, bayZ, outerPanel, rackDepth, deviceFrontX, deviceTopY, faceWidth, panelHeight, rackBays, rackExtent, railOpening, U } from '../model/geometry';
import { bodyWidth3D, route3D } from './route3d';
import { DeviceFace } from '../render/DeviceFace';

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

export interface RackScene {
  root: THREE.Group;
  /** centre and radius of the bounding sphere (for cameras) */
  center: THREE.Vector3;
  radius: number;
  /** y of the floor below the case */
  floorY: number;
  /** resolves when all device panels are textured and added */
  ready: Promise<void>;
}

/** Build the scene of a rack. `texture` returns the panel texture for a drawing (the view caches them). */
export function buildRackScene(project: Project, rack: Rack, texture: (key: string, make: () => Promise<THREE.Texture>) => Promise<THREE.Texture>): RackScene {
  const root = new THREE.Group();
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

  // devices: front plate across the slot, chassis behind it as wide as the real body
  const PLATE = 3;
  const jobs = rack.devices.map(async (d) => {
    const tpl = project.templates[d.templateId];
    if (!tpl) return;
    const w = faceWidth(bayOf(rack, d).rackStandard) / tpl.slots;
    const h = panelHeight(tpl.heightU);
    const depth = Math.max(PLATE + 1, Math.min(tpl.depth, bayDepth(rack.type, bayOf(rack, d))));
    const x0 = deviceFrontX(rack, d, tpl);
    const yTop = deviceTopY(d, tpl, rack) - 0.4;
    const bodyW = bodyWidth3D(rack, tpl, d);
    // plate = the panel at the rails (rear panel when the device is turned around), chassis end = the other one
    const outer = outerPanel(d);
    const fm = renderToStaticMarkup(<DeviceFace tpl={tpl} panel={outer} width={w} device={d} showPortLabels={project.settings.showPortLabels} />);
    const rm = renderToStaticMarkup(<DeviceFace tpl={tpl} panel={outer === 'front' ? 'rear' : 'front'} width={w} device={d} showPortLabels={project.settings.showPortLabels} />);
    const front = await texture(`${w}x${h}|${fm}`, () => panelTexture(fm, w, h));
    const rear = await texture(`${w}x${h}|${bodyW}|${rm}`, async () => {
      const t = await panelTexture(rm, w, h);
      // the rear drawing spans the whole slot; show only the part where the chassis is
      t.repeat.set(bodyW / w, 1);
      t.offset.set((w - bodyW) / 2 / w, 0);
      return t;
    });
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
    plate.userData.deviceId = body.userData.deviceId = d.id;
    plate.userData.mount = body.userData.mount = d.mount;
    root.add(plate, body);
  });

  const ready = Promise.all(jobs).then(() => undefined);
  return {
    root, ready, floorY: (-topH - 1) * S,
    center: new THREE.Vector3((fw / 2) * S, (H / 2) * S, (-D / 2) * S),
    radius: 0.5 * Math.hypot(fw + 2 * wall, H + 2 * topH, outerD) * S,
  };
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
