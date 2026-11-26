import { useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseFace, CaseItem, FlightCase } from '../model/types';
import { caseDims, footprint, isDrawer, usableArea } from '../model/cases';
import { cutoutOutline, outlineBox } from '../model/inlay';
import { Builder, FOAM_MM, boxGeo, faceBasis, inlayGeo, makeMats, v3 } from './caseParts';
import { Scene3D, type BuildResult } from './Scene3D';

/** 3D preview of a flight case (lid open or closed) or of a foam inlay in its container. */
export function Case3D({ c }: { c: FlightCase }) {
  const [open, setOpen] = useState(true);
  const lidToggle = !isDrawer(c) && c.kind !== 'inlay' && c.lidKind !== 'none';
  return (
    <Scene3D build={(root) => buildCase(root, c, open)} deps={[c, open]}>
      {lidToggle ? (
        <button className="btn sm view3d-btn" onClick={() => setOpen(!open)} title={open ? 'Deckel aufsetzen und das Case geschlossen zeigen' : 'Deckel abnehmen bzw. aufklappen und das Innere zeigen'}>
          {open ? 'Deckel schließen' : 'Deckel öffnen'}
        </button>
      ) : null}
    </Scene3D>
  );
}

const ITEM_TONES = ['#26292e', '#33373d', '#1f2125', '#3b4047', '#2c3036', '#41464d'];

/** builds the model into `root` (mm) */
export function buildCase(root: THREE.Group, c: FlightCase, open: boolean): BuildResult {
  const d = caseDims(c);
  const mats = makeMats(c.color, c.foam.color);
  const B = new Builder(mats);

  if (isDrawer(c) || c.kind === 'inlay') {
    const g = isDrawer(c) ? buildDrawer(root, c, B) : buildTray(root, c, B);
    const floor = isDrawer(c) ? 1.5 : 3;
    addFoam(g, c, 'body', floor, c.inner.h - floor, B);
    B.finish();
    return { size: { x: c.inner.l + 80, y: c.inner.h + 20, z: c.inner.w + 60 } };
  }

  const L = d.L, W = d.W;
  const hasLid = d.lidH > 0;
  const closeH = hasLid ? 20 : 0;
  const shellOpts = { panel: c.panel, profile: c.profile, balls: c.cornerBalls, closeH: 20 } as const;

  const y0 = d.castorH;
  const body = new THREE.Group();
  body.position.y = y0;
  root.add(body);
  B.shell(body, { ...shellOpts, size: [L, d.bodyH, W], open: ['py'], closing: hasLid ? ['py'] : [] }).position.y = d.bodyH / 2;
  const t = d.bodyH - d.bodyInner;
  addFoam(body, c, 'body', t, d.bodyInner, B);

  let lid: THREE.Group | null = null;
  if (hasLid) {
    lid = new THREE.Group();
    B.shell(lid, { ...shellOpts, size: [L, d.lidH, W], open: ['ny'], closing: ['ny'] }).position.y = d.lidH / 2;
    addFoam(lid, c, 'lid', t, c.lidH, B);
  }

  // hardware frames on the faces: s = position along the face (0..1), y = height in the part
  const mount = (parent: THREE.Object3D, face: CaseFace, s: number, y: number) => {
    const { n, u, v } = faceBasis(face);
    if (face === 'top') return B.frame(parent, v3(-L / 2 + s * L, y, 0), u, v);
    const span = Math.abs(u.x) > 0.5 ? L : W, half = Math.abs(n.x) > 0.5 ? L / 2 : W / 2;
    return B.frame(parent, n.clone().multiplyScalar(half).add(u.clone().multiplyScalar(-span / 2 + s * span)).add(v3(0, y, 0)), u, v);
  };
  for (const h of c.hardware) {
    const isTop = h.face === 'top';
    const parent = isTop ? lid ?? body : body;
    const topY = isTop ? (lid ? d.lidH : d.bodyH) : 0;
    if (h.kind === 'stack-cup') {
      if (!lid) continue;
      for (let k = 0; k < h.count; k++) {
        const sx = k % 2 ? 1 : -1, sz = k < 2 ? 1 : -1;
        B.stackCup(B.frame(lid, v3(sx * (L / 2 - 75), d.lidH, sz * (W / 2 - 75)), v3(1, 0, 0), v3(0, 0, -1)));
      }
      continue;
    }
    for (let k = 0; k < h.count; k++) {
      const pos = (k + 1) / (h.count + 1);
      if (h.kind === 'butterfly' || h.kind === 'butterfly-small') {
        const s = h.kind === 'butterfly' ? 1 : 0.7;
        B.butterflyLatch(mount(body, h.face, pos, d.bodyH - closeH - 2), s);
        if (lid) B.latchKeeper(mount(lid, h.face, pos, closeH + 2), s);
      } else if (h.kind === 'handle-recessed') B.recessedHandle(mount(parent, h.face, pos, isTop ? topY : (d.bodyH - closeH) * 0.52));
      else if (h.kind === 'handle-strap') B.strapHandle(mount(parent, h.face, pos, isTop ? topY : (d.bodyH - closeH) * 0.55));
      else if (h.kind === 'label') B.labelHolder(mount(parent, h.face, pos, isTop ? topY : 95));
      else if (h.kind === 'hinge') {
        const g = mount(body, h.face, pos, d.bodyH);
        B.add(g, boxGeo(60, 22, 3), mats.chrome, 0, -11 - closeH, 1.5);
        B.add(g, new THREE.CylinderGeometry(4.2, 4.2, 60, 14), mats.chrome, 0, 0, 6).rotation.z = Math.PI / 2;
        if (lid) B.add(mount(lid, h.face, pos, 0), boxGeo(60, 22, 3), mats.chrome, 0, 11 + closeH, 1.5);
      }
    }
  }

  // castors / skids
  const nCastors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  const nBraked = c.hardware.filter((h) => h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
  if (nCastors) {
    const pos = nCastors >= 4 ? [[-1, 1], [1, 1], [-1, -1], [1, -1]] : [[-1, 0], [1, 0]];
    pos.forEach(([sx, sz], i) => {
      const g = new THREE.Group();
      g.position.set(sx * (L / 2 - 75), y0, sz * (W / 2 - 75));
      root.add(g);
      B.castor(g, c.castorSize, i < nBraked);
    });
  } else if (c.hardware.some((h) => h.kind === 'skid')) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(root, new RoundedBoxGeometry(70, d.castorH, 40, 2, 3), mats.rubber, sx * (L / 2 - 80), d.castorH / 2, sz * (W / 2 - 60));
  }

  // lid placement
  let zShift = 0;
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
      zShift = -(W / 2 + 75);
    }
  }
  B.finish();
  return { size: { x: L, y: d.H, z: W }, zShift };
}

/**
 * Foam of one layer. Body: `floor` is the inner bottom, `space` the inner height (foam grows upwards).
 * Lid: lid coordinates (y = 0 at the split), `floor` is the panel thickness at the top, `space` the inner lid height
 * (foam hangs from the ceiling).
 */
export function addFoam(parent: THREE.Object3D, c: FlightCase, layer: CaseItem['layer'], floor: number, space: number, B: Builder) {
  const mats = B.mats;
  const il = c.inner.l, iw = c.inner.w;
  const X = (x: number) => -il / 2 + x;
  const Z = (y: number) => iw / 2 - y;
  const area = usableArea(c);
  const items = c.items.filter((i) => i.layer === layer);
  const lidMode = layer === 'lid';
  const base = lidMode ? c.foam.lid : c.foam.bottom;
  const ceil = lidMode ? caseDims(c).lidH - floor : floor;
  const dir = lidMode ? -1 : 1;
  if (base > 0) B.add(parent, boxGeo(il, base, iw, FOAM_MM), mats.foam, 0, ceil + dir * base / 2, 0);
  const surf = ceil + dir * base;
  const sides = c.foam.sides;
  const sideH = Math.max(0, space - base);
  if (sides > 0 && sideH > 0) {
    const yc = surf + dir * sideH / 2;
    for (const sz of [-1, 1]) B.add(parent, boxGeo(il, sideH, sides, FOAM_MM), mats.foam, 0, yc, sz * (iw / 2 - sides / 2));
    for (const sx of [-1, 1]) B.add(parent, boxGeo(sides, sideH, iw - 2 * sides, FOAM_MM), mats.foam, sx * (il / 2 - sides / 2), yc, 0);
  }
  if (!lidMode) for (const dv of c.dividers) {
    if (dv.axis === 'x') B.add(parent, boxGeo(il, space, 7), mats.ply, 0, floor + space / 2, Z(dv.pos));
    else B.add(parent, boxGeo(7, space, iw), mats.ply, X(dv.pos), floor + space / 2, 0);
  }
  if (!items.length) return;
  // cut-outs inside the usable area that keep at least 1 mm of foam to the contour and to each other
  const holes: [number, number][][] = [];
  const boxes: ReturnType<typeof outlineBox>[] = [];
  for (const it of items) {
    const pts = cutoutOutline(it);
    const bb = outlineBox(pts);
    if (bb.x0 < area.x0 - 0.5 || bb.y0 < area.y0 - 0.5 || bb.x1 > area.x1 + 0.5 || bb.y1 > area.y1 + 0.5) continue;
    if (boxes.some((h) => bb.x0 < h.x1 + 1 && h.x0 < bb.x1 + 1 && bb.y0 < h.y1 + 1 && h.y0 < bb.y1 + 1)) continue;
    boxes.push(bb);
    // cut-outs touching the contour are pulled in by a hair so the triangulation stays valid
    const cx = (x: number) => Math.max(area.x0 + 0.8, Math.min(area.x1 - 0.8, x));
    const cy = (y: number) => Math.max(area.y0 + 0.8, Math.min(area.y1 - 0.8, y));
    holes.push(pts.map(([x, y]) => [X(cx(x)), Z(cy(y))]));
  }
  const T = Math.max(10, Math.min(Math.max(...items.map((i) => i.depth ?? i.h)), sideH || space));
  if (sideH > 0 && area.x1 > area.x0 && area.y1 > area.y0) {
    const g = inlayGeo(X(area.x0), Z(area.y1), X(area.x1), Z(area.y0), holes, T);
    B.add(parent, g, mats.foam, 0, lidMode ? surf - T : surf, 0);
  }
  items.forEach((it, i) => {
    const f = footprint(it);
    const outside = it.x >= il || it.y >= iw || it.x + f.l <= 0 || it.y + f.w <= 0;
    const m = new THREE.MeshStandardMaterial({ color: ITEM_TONES[i % ITEM_TONES.length], roughness: 0.5, metalness: 0.1 });
    let geo: THREE.BufferGeometry;
    const mn = Math.min(f.l, f.w);
    if (it.shape === 'circle') geo = new THREE.CylinderGeometry(mn / 2 - 0.5, mn / 2 - 0.5, it.h, 32).scale(f.l / mn, 1, f.w / mn);
    else geo = new RoundedBoxGeometry(Math.max(1, f.l - 1), it.h, Math.max(1, f.w - 1), 2, Math.max(0.5, Math.min(it.radius ?? 4, f.l / 6, f.w / 6, it.h / 6)));
    const y = outside ? (lidMode ? surf - it.h / 2 : it.h / 2 - parent.position.y) : surf + dir * it.h / 2;
    B.add(parent, geo, m, X(it.x + f.l / 2), y, Z(it.y + f.w / 2));
  });
}

/** steel 19" rack drawer around a drawer inlay; returns the group the foam goes into */
function buildDrawer(root: THREE.Group, c: FlightCase, B: Builder) {
  const mats = B.mats;
  const l = c.inner.l, w = c.inner.w, h = c.inner.h;
  const steel = mats.steel, t = 1.5;
  const g = new THREE.Group();
  g.position.y = 7;
  root.add(g);
  B.add(g, boxGeo(l + 2 * t, t, w + t), steel, 0, t / 2, -t / 2);
  for (const sx of [-1, 1]) B.add(g, boxGeo(t, h, w + t), steel, sx * (l / 2 + t / 2), h / 2, -t / 2);
  B.add(g, boxGeo(l + 2 * t, h, t), steel, 0, h / 2, -w / 2 - t / 2);
  const fw = l + 72, fh = h + 14;
  B.add(g, new RoundedBoxGeometry(fw, fh, 3, 2, 1), steel, 0, fh / 2 - 7, w / 2 + 1.5);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) B.add(g, new THREE.CylinderGeometry(3.3, 3.3, 3.4, 12), mats.recess, sx * (fw / 2 - 8), fh / 2 - 7 + sy * Math.max(0, fh / 2 - 12), w / 2 + 1.6).rotation.x = Math.PI / 2;
    const hx = sx * (fw / 2 - 26);
    B.rod(g, v3(hx, 3, w / 2 + 26), v3(hx, fh - 17, w / 2 + 26), 4, mats.chrome, 16);
    for (const sy of [-1, 1]) B.rod(g, v3(hx, fh / 2 - 7 + sy * (fh / 2 - 12), w / 2 + 3), v3(hx, fh / 2 - 7 + sy * (fh / 2 - 12), w / 2 + 27), 3.5, mats.chrome);
  }
  return g;
}

/** generic container for a free inlay (e.g. a bought case): translucent shell so the foam stays visible */
function buildTray(root: THREE.Group, c: FlightCase, B: Builder) {
  const l = c.inner.l, w = c.inner.w, h = c.inner.h, t = 3;
  const m = new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.7, transparent: true, opacity: 0.35 });
  B.add(root, boxGeo(l + 2 * t, t, w + 2 * t), m, 0, t / 2, 0);
  for (const sz of [-1, 1]) B.add(root, boxGeo(l + 2 * t, h, t), m, 0, h / 2, sz * (w / 2 + t / 2));
  for (const sx of [-1, 1]) B.add(root, boxGeo(t, h, w), m, sx * (l / 2 + t / 2), h / 2, 0);
  return root;
}
