import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * Building blocks for realistic flight case and rack case models (all sizes in mm; the caller scales the root group to
 * metres). Shared by the case designer and the rack designer, so both look like they come from the same workshop.
 */

export const S = 0.001; // mm -> m
export const LAM_MM = 120, FOAM_MM = 60;
type V = THREE.Vector3;
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ procedural textures (shared, never disposed)

let texCache: { lam: THREE.Texture; foam: THREE.Texture; brushed: THREE.Texture } | null = null;

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
  return cv;
}

function toTexture(cv: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function textures() {
  if (!texCache) {
    // phenolic film laminate: hammer-tone dimples (texture covers LAM_MM)
    const lam = toTexture(bumpCanvas(256, 900, 3, 7, 0.45, 7));
    // PE foam: fine closed-cell pores (texture covers FOAM_MM)
    const foam = toTexture(bumpCanvas(256, 2600, 0.8, 2.2, 0.6, 11));
    // brushed aluminium: fine streaks along one direction
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, 256, 256);
    const r = rng(23);
    for (let i = 0; i < 900; i++) {
      const y = r() * 256, a = 0.04 + r() * 0.1;
      g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      g.fillRect(0, y, 256, 0.6 + r());
    }
    const brushed = toTexture(cv);
    texCache = { lam, foam, brushed };
  }
  return texCache;
}

/** box geometry (mm) whose uvs are scaled to `texMm`, so textures keep their size on every face */
export function boxGeo(w: number, h: number, d: number, texMm = 0) {
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

export interface Mats {
  lam: THREE.MeshStandardMaterial; alu: THREE.MeshStandardMaterial; chrome: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial; rubber: THREE.MeshStandardMaterial; hub: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial; red: THREE.MeshStandardMaterial; white: THREE.MeshStandardMaterial;
  foam: THREE.MeshStandardMaterial; ply: THREE.MeshStandardMaterial; steel: THREE.MeshStandardMaterial;
  rail: THREE.MeshStandardMaterial;
}

export function makeMats(color: string, foamColor: string): Mats {
  const tex = textures();
  return {
    lam: new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, bumpMap: tex.lam, bumpScale: 1.6, roughnessMap: tex.lam, envMapIntensity: 0.7 }),
    alu: new THREE.MeshStandardMaterial({ color: '#c2c6cb', metalness: 0.9, roughness: 0.34, roughnessMap: tex.brushed }),
    chrome: new THREE.MeshStandardMaterial({ color: '#dcdfe3', metalness: 1, roughness: 0.1 }),
    recess: new THREE.MeshStandardMaterial({ color: '#1b1c1f', metalness: 0.5, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#26292e', roughness: 0.86 }),
    hub: new THREE.MeshStandardMaterial({ color: '#8d949d', roughness: 0.45, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: '#151619', roughness: 0.5, metalness: 0.2 }),
    red: new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 }),
    foam: new THREE.MeshStandardMaterial({ color: foamColor, roughness: 1, bumpMap: tex.foam, bumpScale: 2.2, envMapIntensity: 0.35 }),
    ply: new THREE.MeshStandardMaterial({ color: '#c8a77a', roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: '#1a1b1e', roughness: 0.42, metalness: 0.55 }),
    rail: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.4, metalness: 0.7 }),
  };
}

export function disposeTree(o: THREE.Object3D) {
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    }
  });
}

// ------------------------------------------------------------------ cross-sections

/** aluminium angle (Kantenprofil): legs of `a` mm, wall `e` mm, rounded spine. (s, t): s along the face, t into the box */
function angleShape(a: number, e: number) {
  const r = 2.4, sh = new THREE.Shape();
  sh.moveTo(r, 0);
  sh.lineTo(a - 0.9, 0); sh.lineTo(a, 0.5); sh.lineTo(a, e);
  sh.lineTo(e + 0.8, e); sh.quadraticCurveTo(e, e, e, e + 0.8);
  sh.lineTo(e, a); sh.lineTo(0.5, a); sh.lineTo(0, a - 0.9);
  sh.lineTo(0, r); sh.quadraticCurveTo(0, 0, r, 0);
  return sh;
}

/** hybrid closing profile: (u, w): u from the split into the box half, w outwards from the face (negative = inside) */
function closingShape(closeH: number, pr: number, e: number, cover: number) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -cover);
  sh.lineTo(0, pr - 1.4); sh.lineTo(1.4, pr);            // V-groove at the split
  sh.lineTo(closeH - 2.2, pr); sh.quadraticCurveTo(closeH, pr, closeH, pr - 2.2);
  sh.lineTo(closeH, -e); sh.lineTo(3.2, -e); sh.lineTo(3.2, -cover); sh.lineTo(0, -cover);
  return sh;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** pressed dish with a soft raised rim (z from 0 to about depth + 1) */
export function dishGeo(w: number, h: number, r: number, depth = 2) {
  return new THREE.ExtrudeGeometry(roundedRect(w - 3, h - 3, r), { depth, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.5, bevelSegments: 3, curveSegments: 8 })
    .translate(0, 0, 1.1);
}

// ------------------------------------------------------------------ builder

export type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
const AX = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)];
const faceOf = (axis: number, sign: number) => ((sign > 0 ? 'p' : 'n') + 'xyz'[axis]) as FaceKey;

export interface ShellOpts {
  /** outer size along x, y, z (box centred on the origin) */
  size: [number, number, number];
  /** faces without a panel */
  open?: FaceKey[];
  /** open faces that get a hybrid closing profile (lid split) */
  closing?: FaceKey[];
  panel: number;
  profile: 'alu30' | 'alu35' | 'none';
  balls: boolean;
  closeH?: number;
}

/** basis of a face as seen from outside: u = to the right, v = up, n = outwards */
export function faceBasis(face: FaceKey | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom') {
  switch (face) {
    case 'pz': case 'front': return { n: v3(0, 0, 1), u: v3(1, 0, 0), v: v3(0, 1, 0) };
    case 'nz': case 'back': return { n: v3(0, 0, -1), u: v3(-1, 0, 0), v: v3(0, 1, 0) };
    case 'px': case 'right': return { n: v3(1, 0, 0), u: v3(0, 0, -1), v: v3(0, 1, 0) };
    case 'nx': case 'left': return { n: v3(-1, 0, 0), u: v3(0, 0, 1), v: v3(0, 1, 0) };
    case 'py': case 'top': return { n: v3(0, 1, 0), u: v3(1, 0, 0), v: v3(0, 0, -1) };
    default: return { n: v3(0, -1, 0), u: v3(1, 0, 0), v: v3(0, 0, 1) };
  }
}

export class Builder {
  rivets: { p: V; n: V; parent: THREE.Object3D }[] = [];
  private rivetGeo = new THREE.SphereGeometry(2.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  private smallRivetGeo = new THREE.SphereGeometry(2.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  constructor(public mats: Mats) {}

  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  rivet(parent: THREE.Object3D, p: V, n: V) { this.rivets.push({ p, n, parent }); }

  /** small chrome rivet head in a local hardware frame (z outwards) */
  hwRivet(g: THREE.Object3D, x: number, y: number, z: number) {
    const m = this.add(g, this.smallRivetGeo, this.mats.chrome, x, y, z);
    m.rotation.x = Math.PI / 2;
  }

  /** group oriented so that local x = u, y = v, z = u × v */
  frame(parent: THREE.Object3D, origin: V, u: V, v: V) {
    const g = new THREE.Group();
    const n = u.clone().cross(v);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    g.position.copy(origin);
    parent.add(g);
    return g;
  }

  /** a 2D cross-section extruded along `dir`: shape x -> axisA, shape y -> axisB (mirrored bases are fine) */
  extrude(parent: THREE.Object3D, shape: THREE.Shape, start: V, dir: V, len: number, axisA: V, axisB: V, mat: THREE.Material) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 4 });
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false;
    m.matrix.makeBasis(axisA, axisB, dir).setPosition(start);
    parent.add(m);
    return m;
  }

  /** cylinder between two points */
  rod(parent: THREE.Object3D, a: V, b: V, r: number, mat: THREE.Material, seg = 12) {
    const len = a.distanceTo(b);
    const m = this.add(parent, new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  }

  /**
   * Laminated plywood box with aluminium angles on the edges, closing profiles at the open faces and ball corners.
   * Returns a group centred on the origin.
   */
  shell(parent: THREE.Object3D, o: ShellOpts) {
    const g = new THREE.Group();
    parent.add(g);
    const { mats } = this;
    const size = o.size;
    const open = new Set(o.open ?? []), closing = new Set(o.closing ?? []);
    const prof = o.profile !== 'none';
    const e = o.profile === 'alu30' ? 2 : o.profile === 'alu35' ? 2.5 : 0;
    const leg = o.profile === 'alu35' ? 35 : 30;
    const p = o.panel;
    const closeH = o.closeH ?? 20;
    const closed = (axis: number, sign: number) => !open.has(faceOf(axis, sign));

    // panels: x faces full, y faces fit between x faces, z faces between x and y faces (simple box joint)
    for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
      if (!closed(i, s)) continue;
      const dims = [0, 0, 0], pos = [0, 0, 0];
      dims[i] = p;
      pos[i] = s * (size[i] / 2 - e - p / 2);
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        let lo = -size[j] / 2 + e, hi = size[j] / 2 - e;
        if (j < i) { if (closed(j, -1)) lo += p; if (closed(j, 1)) hi -= p; }
        dims[j] = hi - lo;
        pos[j] = (lo + hi) / 2;
      }
      this.add(g, boxGeo(dims[0], dims[1], dims[2], LAM_MM), mats.lam, pos[0], pos[1], pos[2]);
    }

    // edges
    if (prof) {
      const shape = angleShape(leg, e);
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const si of [1, -1]) for (const sj of [1, -1]) {
        const c1 = closed(i, si), c2 = closed(j, sj);
        if (!c1 && !c2) continue;
        if ((!c1 && closing.has(faceOf(i, si))) || (!c2 && closing.has(faceOf(j, sj)))) continue; // part of a closing ring
        const k = 3 - i - j;
        const n1 = AX[i].clone().multiplyScalar(si), n2 = AX[j].clone().multiplyScalar(sj);
        let a0 = -size[k] / 2, a1 = size[k] / 2;
        if (closing.has(faceOf(k, -1))) a0 += closeH;
        if (closing.has(faceOf(k, 1))) a1 -= closeH;
        const out = k === 1 ? 0 : 0.3; // horizontal angles lie on top of the vertical ones
        const start = n1.clone().multiplyScalar(size[i] / 2 + out).add(n2.clone().multiplyScalar(size[j] / 2 + out)).add(AX[k].clone().multiplyScalar(a0));
        this.extrude(g, shape, start, AX[k], a1 - a0, n2.clone().negate(), n1.clone().negate(), mats.alu);
        const len = a1 - a0, n = Math.max(1, Math.round((len - 90) / 115));
        for (let q = 0; q <= n; q++) {
          const along = a0 + 45 + ((len - 90) * q) / n;
          const base = n1.clone().multiplyScalar(size[i] / 2 + out).add(n2.clone().multiplyScalar(size[j] / 2 + out)).add(AX[k].clone().multiplyScalar(along));
          if (c1) this.rivet(g, base.clone().addScaledVector(n2, -leg / 2), n1);
          if (c2) this.rivet(g, base.clone().addScaledVector(n1, -leg / 2), n2);
        }
      }
    }

    // closing rings
    const pr = 2.6;
    for (const fk of closing) {
      const i = 'xyz'.indexOf(fk[1]), s = fk[0] === 'p' ? 1 : -1;
      const nF = AX[i].clone().multiplyScalar(s);
      const shape = closingShape(closeH, pr, e, p + e + 2);
      for (let j = 0; j < 3; j++) {
        if (j === i) continue;
        for (const sj of [1, -1]) {
          if (!closed(j, sj)) continue;
          const k = 3 - i - j;
          const nA = AX[j].clone().multiplyScalar(sj);
          const ext = pr - 0.4;
          const start = nF.clone().multiplyScalar(size[i] / 2).add(nA.clone().multiplyScalar(size[j] / 2)).add(AX[k].clone().multiplyScalar(-size[k] / 2 - ext));
          this.extrude(g, shape, start, AX[k], size[k] + 2 * ext, nF.clone().negate(), nA, mats.alu);
          const n = Math.max(1, Math.round((size[k] - 120) / 150));
          for (let q = 0; q <= n; q++) {
            const along = -size[k] / 2 + 60 + ((size[k] - 120) * q) / n;
            this.rivet(g, nF.clone().multiplyScalar(size[i] / 2 - closeH / 2).add(nA.clone().multiplyScalar(size[j] / 2 + pr)).add(AX[k].clone().multiplyScalar(along)), nA);
          }
        }
      }
    }

    // ball corners where three closed faces meet
    if (o.balls) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
        if (!closed(0, sx) || !closed(1, sy) || !closed(2, sz)) continue;
        this.ballCorner(g, v3(sx * size[0] / 2, sy * size[1] / 2, sz * size[2] / 2), v3(sx, sy, sz));
      }
    }
    return g;
  }

  /** three-way ball corner at `p`; `sgn` = outward direction per axis */
  ballCorner(parent: THREE.Object3D, p: V, sgn: V) {
    const { mats } = this;
    const R = 46;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(R, 0); sh.absarc(0, 0, R, 0, Math.PI / 2, false); sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.9, bevelSegments: 2, curveSegments: 12 });
    // flanges on the three faces: shape quadrant pointing into the box, thickness outwards
    const X = v3(sgn.x, 0, 0), Y = v3(0, sgn.y, 0), Z = v3(0, 0, sgn.z);
    const planes: [V, V, V][] = [[X, Y, Z], [Y, Z, X], [Z, X, Y]];
    for (const [a, b, n] of planes) {
      const m = new THREE.Mesh(geo, mats.chrome);
      m.matrixAutoUpdate = false;
      m.matrix.makeBasis(a.clone().negate(), b.clone().negate(), n).setPosition(p.clone().addScaledVector(n, 0.4));
      parent.add(m);
      for (const [da, db] of [[32, 9], [9, 32]]) this.rivet(parent, p.clone().addScaledVector(a, -da).addScaledVector(b, -db).addScaledVector(n, 2.6), n);
    }
    const dome = this.add(parent, new THREE.SphereGeometry(19, 28, 18), mats.chrome);
    dome.position.copy(p).add(v3(-11 * sgn.x, -11 * sgn.y, -11 * sgn.z));
  }

  // ---------------------------------------------------------------- hardware (local frame: x along, y up, z out)

  butterflyLatch(g: THREE.Object3D, s: number) {
    const { mats } = this;
    const cy = -28 * s;
    this.add(g, dishGeo(68 * s, 54 * s, 7), mats.chrome, 0, cy, -1.2);
    this.add(g, new THREE.ShapeGeometry(roundedRect(52 * s, 38 * s, 5)), mats.recess, 0, cy, 3.3);
    const p = new THREE.Shape();
    p.moveTo(-22 * s, 0);
    p.bezierCurveTo(-22 * s, -13 * s, -6 * s, -10 * s, 0, -4 * s);
    p.bezierCurveTo(6 * s, -10 * s, 22 * s, -13 * s, 22 * s, 0);
    p.bezierCurveTo(22 * s, 13 * s, 6 * s, 10 * s, 0, 4 * s);
    p.bezierCurveTo(-6 * s, 10 * s, -22 * s, 13 * s, -22 * s, 0);
    this.add(g, new THREE.ExtrudeGeometry(p, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.9, bevelSegments: 3, curveSegments: 14 }), mats.chrome, 0, cy, 4.2);
    this.add(g, new THREE.CylinderGeometry(4.5, 5, 4, 16), mats.chrome, 0, cy, 6.5).rotation.x = Math.PI / 2;
    this.add(g, new RoundedBoxGeometry(7 * s, 42 * s, 2.6, 2, 1), mats.chrome, 0, cy / 2 + 13 * s, 4.6);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) this.hwRivet(g, sx * 29 * s, cy + sy * 22.5 * s, 3);
  }

  latchKeeper(g: THREE.Object3D, s: number) {
    const { mats } = this;
    this.add(g, dishGeo(40 * s, 19 * s, 3, 1.4), mats.chrome, 0, 9.5 * s, -1.2);
    this.add(g, boxGeo(18 * s, 5 * s, 2.4), mats.recess, 0, 5.5 * s, 2.6);
    for (const sx of [-1, 1]) this.hwRivet(g, sx * 14 * s, 12 * s, 2.6);
  }

  recessedHandle(g: THREE.Object3D) {
    const { mats } = this;
    this.add(g, dishGeo(150, 96, 11), mats.chrome, 0, 0, -1.2);
    this.add(g, new THREE.ShapeGeometry(roundedRect(124, 70, 9)), mats.recess, 0, 0, 3.3);
    const bar = this.add(g, new THREE.CylinderGeometry(6.2, 6.2, 96, 18), mats.chrome, 0, -18, 9);
    bar.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) {
      this.rod(g, v3(sx * 50, 18, 5), v3(sx * 50, -18, 9), 3.6, mats.chrome);
      this.add(g, new THREE.CylinderGeometry(5.5, 5.5, 10, 14), mats.chrome, sx * 50, 18, 5).rotation.z = Math.PI / 2;
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) this.hwRivet(g, sx * 66, sy * 40, 3);
  }

  strapHandle(g: THREE.Object3D) {
    const { mats } = this;
    // flat strap: thin segments along a curve, standing off the face in the middle
    const curve = new THREE.QuadraticBezierCurve3(v3(-64, 0, 5), v3(0, 0, 22), v3(64, 0, 5));
    const pts = curve.getPoints(16);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const m = this.add(g, boxGeo(a.distanceTo(b) + 0.6, 24, 4), mats.black);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }
    for (const sx of [-1, 1]) { this.add(g, new RoundedBoxGeometry(20, 32, 7, 2, 2), mats.chrome, sx * 72, 0, 3); this.hwRivet(g, sx * 72, 0, 6.5); }
  }

  labelHolder(g: THREE.Object3D) {
    const { mats } = this;
    this.add(g, dishGeo(92, 58, 3, 1.2), mats.chrome, 0, 0, -1.2);
    this.add(g, boxGeo(78, 44, 0.6), mats.white, 0, 0, 3.2);
    for (const ly of [8, -4]) this.add(g, boxGeo(50, 2, 0.4), mats.recess, -8, ly, 3.6);
    for (const sx of [-1, 1]) this.hwRivet(g, sx * 42, 0, 3);
  }

  /** stacking cup on a top face (bowl goes into the panel) */
  stackCup(g: THREE.Object3D) {
    const pts = [v3(0, -6), v3(26, -6), v3(34, -3), v3(40, 0.6), v3(45, 1.4), v3(48, 0)].map((q) => new THREE.Vector2(q.x, q.y));
    const bowl = this.add(g, new THREE.LatheGeometry(pts, 40), this.mats.chrome);
    bowl.rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; this.hwRivet(g, Math.cos(a) * 43, Math.sin(a) * 43, 1.2); }
  }

  /** swivel castor; origin = underside of the case, wheel rolls along z */
  castor(g: THREE.Object3D, size: number, braked: boolean) {
    const { mats } = this;
    const r = size / 2, tw = size <= 75 ? 26 : 32, trail = -14;
    const heightTotal = size + 25;
    this.add(g, new RoundedBoxGeometry(100, 5, 86, 2, 1.5), mats.chrome, 0, -2.5, 0);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) { const m = this.add(g, new THREE.CylinderGeometry(4.5, 4.5, 2, 12), mats.chrome, ax * 40, -5.5, az * 33); m.rotation.x = 0; }
    this.add(g, new THREE.CylinderGeometry(31, 31, 6, 32), mats.chrome, 0, -8, 0);
    const race = this.add(g, new THREE.TorusGeometry(27, 2.6, 8, 32), mats.chrome, 0, -12, 0);
    race.rotation.x = Math.PI / 2;
    this.add(g, new THREE.CylinderGeometry(28, 30, 6, 32), mats.chrome, 0, -16, 0);
    const forkTop = -19, axleY = -(heightTotal - r);
    // fork side plates (shaped) and bridge
    const fs = new THREE.Shape();
    fs.moveTo(-22, 0); fs.lineTo(22, 0); fs.lineTo(trail + 12, axleY - forkTop + 2); fs.absarc(trail, axleY - forkTop, 12, 0, Math.PI, true); fs.lineTo(-22, 0);
    const forkGeo = new THREE.ExtrudeGeometry(fs, { depth: 3.5, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1 });
    for (const fx of [-1, 1]) {
      const m = new THREE.Mesh(forkGeo, mats.chrome);
      m.matrixAutoUpdate = false;
      // shape x -> z, shape y -> y, depth -> x
      m.matrix.makeBasis(v3(0, 0, 1), v3(0, 1, 0), v3(fx, 0, 0)).setPosition(v3(fx * (tw / 2 + 2), forkTop, 0));
      g.add(m);
    }
    this.add(g, new RoundedBoxGeometry(tw + 12, 4, 46, 2, 1.2), mats.chrome, 0, forkTop - 2, 0);
    // wheel: rubber tyre with rounded shoulders, hub, axle bolt
    const ri = r * 0.62, rc = Math.min(6, tw / 4);
    const prof: THREE.Vector2[] = [new THREE.Vector2(ri, -tw / 2)];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, -tw / 2 + rc + Math.sin(a) * rc)); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(r - rc + Math.cos(a) * rc, tw / 2 - rc + Math.sin(a) * rc)); }
    prof.push(new THREE.Vector2(ri, tw / 2));
    const tyre = this.add(g, new THREE.LatheGeometry(prof, 48), mats.rubber, 0, axleY, trail);
    tyre.rotation.z = Math.PI / 2;
    const hub = this.add(g, new THREE.CylinderGeometry(ri, ri, tw - 2, 32), mats.hub, 0, axleY, trail);
    hub.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const cap = this.add(g, new THREE.CylinderGeometry(ri * 0.72, ri * 0.72, 1, 28), mats.recess, sx * (tw / 2 - 0.6), axleY, trail);
      cap.rotation.z = Math.PI / 2;
      const nut = this.add(g, new THREE.CylinderGeometry(7, 7, 4, 6), mats.chrome, sx * (tw / 2 + 5.5), axleY, trail);
      nut.rotation.z = Math.PI / 2;
    }
    if (braked) {
      const ped = this.add(g, new RoundedBoxGeometry(36, 6, 30, 2, 2), mats.red, 0, forkTop - 7, 28);
      ped.rotation.x = -0.35;
      this.add(g, boxGeo(8, 14, 10), mats.chrome, 0, forkTop - 5, 14);
    }
  }

  /** instanced rivet heads, one mesh per parent */
  finish() {
    const byParent = new Map<THREE.Object3D, Builder['rivets']>();
    for (const rv of this.rivets) byParent.set(rv.parent, [...(byParent.get(rv.parent) ?? []), rv]);
    const up = v3(0, 1, 0);
    for (const [parent, list] of byParent) {
      const inst = new THREE.InstancedMesh(this.rivetGeo.clone(), this.mats.alu.clone(), list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = v3(1, 1, 1);
      list.forEach((rv, i) => { q.setFromUnitVectors(up, rv.n.clone().normalize()); m.compose(rv.p, q, one); inst.setMatrixAt(i, m); });
      inst.castShadow = true;
      parent.add(inst);
    }
    this.rivetGeo.dispose();
  }
}

/** foam inlay with cut-outs (polygons in world x/z), extruded upwards by `t` */
export function inlayGeo(x0: number, z0: number, x1: number, z1: number, holes: [number, number][][], t: number) {
  const shape = new THREE.Shape();
  // shape coordinates: (x, -z); rotated so that the extrusion points up
  shape.moveTo(x0, -z1); shape.lineTo(x1, -z1); shape.lineTo(x1, -z0); shape.lineTo(x0, -z0); shape.lineTo(x0, -z1);
  for (const poly of holes) {
    const path = new THREE.Path();
    poly.forEach(([x, z], i) => (i ? path.lineTo(x, -z) : path.moveTo(x, -z)));
    path.closePath();
    shape.holes.push(path);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / FOAM_MM, uv.getY(i) / FOAM_MM);
  return g;
}
