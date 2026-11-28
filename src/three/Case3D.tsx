import { useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseFace, CaseItem, FlightCase } from '../model/types';
import { baseInner, caseBoxes, caseDims, footprint, hasDoors, isDrawer, usableArea, wallOf, type CaseBox, type CasePartId } from '../model/cases';
import { cutoutOutline, outlineBox } from '../model/inlay';
import { Builder, FOAM_MM, boxGeo, faceBasis, inlayGeo, makeMats, v3, type FaceKey } from './caseParts';
import { Scene3D, type BuildResult } from './Scene3D';

/** 3D preview of a flight case (lid open or closed) or of a foam inlay in its container. */
export function Case3D({ c }: { c: FlightCase }) {
  const [open, setOpen] = useState(true);
  const doors = hasDoors(c);
  const lidToggle = !isDrawer(c) && c.kind !== 'inlay' && (c.lidKind !== 'none' || doors);
  const what = doors ? (c.lidKind !== 'none' ? 'Deckel und Türen' : 'Türen') : 'Deckel';
  return (
    <Scene3D build={(root) => buildCase(root, c, open)} deps={[c, open]}>
      {lidToggle ? (
        <button className="btn sm view3d-btn" onClick={() => setOpen(!open)} title={open ? `${what} aufsetzen und das Case geschlossen zeigen` : `${what} abnehmen bzw. aufklappen und das Innere zeigen`}>
          {open ? `${what} schließen` : `${what} öffnen`}
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
    return { size: { x: c.inner.l + 80, y: c.inner.h + 20, z: c.inner.w + 60 }, steep: isDrawer(c) && c.inner.h > 0.2 * c.inner.w };
  }

  const L = d.L, W = d.W;
  const t = wallOf(c);
  const boxes = caseBoxes(c, t);
  const closeH = 20;
  const shellOpts = { panel: c.panel, profile: c.profile, balls: c.cornerBalls, closeH } as const;
  const y0 = d.castorH;
  /** outer case coordinates (x along, y front to back, z up) -> scene, relative to the case groups */
  const P = (x: number, y: number, z: number) => v3(x - L / 2, z, W / 2 - y);
  const FK: Record<CaseFace, FaceKey> = { front: 'pz', back: 'nz', left: 'nx', right: 'px', top: 'py', bottom: 'ny' };
  const groups = new Map<CasePartId, THREE.Group>();
  for (const bx of boxes) {
    const g = new THREE.Group();
    g.position.y = y0;
    groups.set(bx.id, g);
    const sh = B.shell(g, { ...shellOpts, size: [bx.x1 - bx.x0, bx.z1 - bx.z0, bx.y1 - bx.y0], open: bx.open.map((f) => FK[f]), closing: bx.closing.map((f) => FK[f]) });
    sh.position.copy(P((bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, (bx.z0 + bx.z1) / 2));
  }
  const base = groups.get('base')!;
  root.add(base);
  const baseBox = boxes[0];
  const drawers = c.drawers ?? [];
  if (drawers.length) buildDrawers(base, c, t, open, B);
  else addFoam(base, c, 'body', t, d.bodyInner, B);
  const lidBox = boxes.find((b) => b.id === 'lid');
  if (lidBox) {
    // lid foam hangs from the ceiling: lid groups get their origin at the split for addFoam
    const lg = new THREE.Group();
    lg.position.y = lidBox.z0;
    groups.get('lid')!.add(lg);
    addFoam(lg, c, 'lid', t, c.lidH, B);
  }

  /** the shell that contains a point on the outside (outer coordinates) */
  const partAt = (x: number, y: number, z: number) => {
    const e = 1;
    return boxes.find((b) => x >= b.x0 - e && x <= b.x1 + e && y >= b.y0 - e && y <= b.y1 + e && z >= b.z0 - e && z <= b.z1 + e) ?? baseBox;
  };
  const groupAt = (x: number, y: number, z: number) => groups.get(partAt(x, y, z).id)!;
  /** point on a face: u = position across the face (0..span), z = height; returns outer coordinates */
  const onFace = (face: CaseFace, u: number, z: number): [number, number, number] => {
    switch (face) {
      case 'front': return [u, 0, z];
      case 'back': return [L - u, W, z];
      case 'left': return [0, W - u, z];
      case 'right': return [L, u, z];
      default: return [u, W / 2, d.H - y0];
    }
  };
  /** span of a shell along a face (u range) */
  const uRange = (bx: CaseBox, face: CaseFace): [number, number] => {
    switch (face) {
      case 'front': case 'top': case 'bottom': return [bx.x0, bx.x1];
      case 'back': return [L - bx.x1, L - bx.x0];
      case 'left': return [W - bx.y1, W - bx.y0];
      default: return [bx.y0, bx.y1];
    }
  };
  const frameAt = (g: THREE.Object3D, face: CaseFace, pt: [number, number, number], vDir?: THREE.Vector3) => {
    const { n, u, v } = faceBasis(face);
    const vv = vDir ?? v;
    const uu = vDir ? vv.clone().cross(n) : u;
    return B.frame(g, P(...pt), uu, vv);
  };
  const Hc = d.H - y0;
  const zs = lidBox ? lidBox.z0 : Hc;
  // the shell whose face carries handles and labels on this face: the base where it reaches the face, else the door there
  const carrier = (face: CaseFace) => {
    const reaches = (b: CaseBox) => (face === 'front' ? b.y0 < 1 : face === 'back' ? b.y1 > W - 1 : face === 'left' ? b.x0 < 1 : face === 'right' ? b.x1 > L - 1 : b.z1 > Hc - 1);
    if (face === 'top') return boxes.filter((b) => !b.open.includes('top') && reaches(b));
    return [reaches(baseBox) ? baseBox : boxes.find((b) => b.role === 'door' && b.side === face) ?? baseBox];
  };

  for (const h of c.hardware) {
    if (h.kind.startsWith('castor') || h.kind === 'skid' || h.kind === 'lid-stay') continue;
    if (h.kind === 'foot') continue;
    if (h.kind === 'stack-cup') {
      const tops = carrier('top');
      if (!tops.length) continue;
      const pts: [number, number][] = [[75, 75], [L - 75, 75], [75, W - 75], [L - 75, W - 75]];
      for (const [x, y] of pts.slice(0, Math.max(1, h.count))) {
        const g = groupAt(x, y, Hc);
        B.stackCup(B.frame(g, P(x, y, Hc), v3(1, 0, 0), v3(0, 0, -1)));
      }
      continue;
    }
    const isLatch = h.kind === 'butterfly' || h.kind === 'butterfly-small' || h.kind === 'draw-latch';
    const s = h.kind === 'butterfly' ? 1 : h.kind === 'draw-latch' ? 0.6 : 0.7;
    const seam = h.seam ?? 'lid';
    if ((isLatch || h.kind === 'hinge' || h.kind === 'piano-hinge') && seam !== 'lid') {
      // vertical seam of a door: on the side faces the latches run up the seam, on the top they run across
      const door = boxes.find((b) => b.role === 'door' && b.side === seam);
      if (!door || h.face === seam) continue;
      const toDoor = seam === 'front' ? v3(0, 0, 1) : seam === 'back' ? v3(0, 0, -1) : seam === 'left' ? v3(-1, 0, 0) : v3(1, 0, 0);
      const seamPos = seam === 'front' ? door.y1 : seam === 'back' ? door.y0 : seam === 'left' ? door.x1 : door.x0;
      for (let k = 0; k < h.count; k++) {
        const f = (k + 1) / (h.count + 1);
        let pt: [number, number, number];
        if (h.face === 'top') {
          const along = seam === 'front' || seam === 'back' ? L * f : W * f;
          pt = seam === 'front' || seam === 'back' ? [along, seamPos, Hc] : [seamPos, along, Hc];
        } else {
          const z = door.z1 * f;
          pt = h.face === 'left' ? [0, seamPos, z] : h.face === 'right' ? [L, seamPos, z] : h.face === 'front' ? [seamPos, 0, z] : [seamPos, W, z];
        }
        if (isLatch) {
          const bodyPt: [number, number, number] = [pt[0] - toDoor.x * 30, pt[1] + toDoor.z * 30, pt[2]];
          B.butterflyLatch(frameAt(groupAt(...bodyPt), h.face, pt, toDoor), s);
          B.latchKeeper(frameAt(groups.get(door.id)!, h.face, pt, toDoor), s);
        } else {
          const g = frameAt(groups.get(door.id)!, h.face, pt, toDoor);
          B.add(g, boxGeo(60, 44, 3), mats.chrome, 0, 0, 1.5);
        }
      }
      continue;
    }
    if (isLatch || h.kind === 'hinge' || h.kind === 'piano-hinge') {
      if (!lidBox || h.face === 'top' || h.face === 'bottom') continue;
      // horizontal seam under the lid: spread over the part of the face the lid covers
      const lids = boxes.filter((b) => b.role === 'lid');
      const u0 = Math.min(...lids.map((b) => uRange(b, h.face)[0])), u1 = Math.max(...lids.map((b) => uRange(b, h.face)[1]));
      if (h.kind === 'piano-hinge') {
        const a = onFace(h.face, u0 + 20, zs), b = onFace(h.face, u1 - 20, zs);
        B.rod(groupAt(a[0], a[1], zs - 30), P(...a), P(...b), 4.5, mats.chrome, 14);
        continue;
      }
      for (let k = 0; k < h.count; k++) {
        const u = u0 + ((u1 - u0) * (k + 1)) / (h.count + 1);
        const pt = onFace(h.face, u, zs);
        const below = groupAt(pt[0], pt[1], zs - 30), above = groupAt(pt[0], pt[1], zs + 30);
        if (h.kind === 'hinge') {
          const gb = frameAt(below, h.face, pt), ga = frameAt(above, h.face, pt);
          B.add(gb, boxGeo(60, 22, 3), mats.chrome, 0, -11 - closeH, 1.5);
          B.add(gb, new THREE.CylinderGeometry(4.2, 4.2, 60, 14), mats.chrome, 0, 0, 6).rotation.z = Math.PI / 2;
          B.add(ga, boxGeo(60, 22, 3), mats.chrome, 0, 11 + closeH, 1.5);
        } else {
          B.butterflyLatch(frameAt(below, h.face, [pt[0], pt[1], zs - closeH - 2]), s);
          B.latchKeeper(frameAt(above, h.face, [pt[0], pt[1], zs + closeH + 2]), s);
        }
      }
      continue;
    }
    // handles, labels, dishes: spread over the carrying shell, at the height of its middle
    for (const bx of carrier(h.face)) {
      const [u0, u1] = h.face === 'top' ? [bx.x0, bx.x1] : uRange(bx, h.face);
      const lowTop = bx.z1 - (bx.closing.includes('top') ? closeH : 0);
      for (let k = 0; k < h.count; k++) {
        const u = u0 + ((u1 - u0) * (k + 1)) / (h.count + 1);
        if (h.face === 'top') {
          const g = groups.get(bx.id)!;
          const fr = B.frame(g, P(u, (bx.y0 + bx.y1) / 2, Hc), v3(1, 0, 0), v3(0, 0, -1));
          if (h.kind === 'handle-recessed') B.recessedHandle(fr);
          else if (h.kind === 'handle-strap' || h.kind === 'handle-surface') B.strapHandle(fr);
          else if (h.kind === 'label') B.labelHolder(fr);
          else B.dish(fr, h.kind);
          continue;
        }
        const zMid = h.kind === 'label' ? Math.min(lowTop - 60, 95) : bx.z0 + (lowTop - bx.z0) * 0.52;
        const fr = frameAt(groups.get(bx.id)!, h.face, onFace(h.face, u, zMid));
        if (h.kind === 'handle-recessed') B.recessedHandle(fr);
        else if (h.kind === 'handle-strap' || h.kind === 'handle-surface') B.strapHandle(fr);
        else if (h.kind === 'label') B.labelHolder(fr);
        else B.dish(fr, h.kind);
      }
    }
  }

  // castors / skids / feet
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
  } else if (c.hardware.some((h) => h.kind === 'foot')) {
    const n = c.hardware.filter((h) => h.kind === 'foot').reduce((s, h) => s + h.count, 0);
    const spots = n >= 6 ? [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [0, -1]] : [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (const [sx, sz] of spots) B.add(root, new THREE.CylinderGeometry(18, 20, d.castorH, 20), mats.rubber, sx * (L / 2 - 55), d.castorH / 2, sz * (W / 2 - 55));
  }

  // lid and doors: closed in place, or opened / set down next to the case
  let zShift = 0;
  const lidGroups = boxes.filter((b) => b.role === 'lid').map((b) => [b, groups.get(b.id)!] as const);
  for (const [bx, g] of lidGroups) {
    if (!open) { root.add(g); continue; }
    if (c.lidSplit) {
      // clamshell halves swing open sideways around their outer edges
      const pivot = new THREE.Group();
      const px = bx.id === 'lid' ? bx.x0 : bx.x1;
      pivot.position.copy(P(px, W / 2, zs)).setY(y0 + zs);
      g.position.set(-pivot.position.x, y0 - pivot.position.y, 0);
      pivot.add(g);
      pivot.rotation.z = bx.id === 'lid' ? 1.75 : -1.75;
      root.add(pivot);
    } else if (c.lidKind === 'hinged') {
      const pivot = new THREE.Group();
      pivot.position.set(0, y0 + zs, W / 2 - bx.y1);
      g.position.set(0, -zs, -(W / 2 - bx.y1));
      pivot.add(g);
      pivot.rotation.x = -1.9;
      root.add(pivot);
    } else {
      // removable / telescope lid: set down behind the case, upside down
      g.rotation.x = Math.PI;
      g.position.set(0, Hc + 3, -(W + 150));
      root.add(g);
      zShift = -(W / 2 + 75);
    }
  }
  for (const bx of boxes.filter((b) => b.role === 'door')) {
    const g = groups.get(bx.id)!;
    if (open) {
      // removed doors stand beside the case so the inside stays visible
      const depth = bx.side === 'front' || bx.side === 'back' ? bx.y1 - bx.y0 : bx.x1 - bx.x0;
      if (bx.side === 'front') { g.position.z += depth + 120; g.position.x -= L + 160; }
      else if (bx.side === 'back') { g.position.z -= depth + 120; g.position.x += L + 160; }
      else if (bx.side === 'left') { g.position.x -= depth + 120; g.position.z += W + 160; }
      else { g.position.x += depth + 120; g.position.z -= W + 160; }
    }
    root.add(g);
  }
  B.finish();
  // set-aside doors widen the scene
  const dd = boxes.filter((b) => b.role === 'door');
  const wide = open && dd.length ? { x: dd.some((b) => b.side === 'front' || b.side === 'back') ? 3 * L + 320 : L, z: dd.some((b) => b.side === 'left' || b.side === 'right') ? 3 * W + 320 : W } : { x: L, z: W };
  return { size: { x: wide.x, y: d.H, z: wide.z }, zShift };
}

/** drawers on slides inside the base, stacked from the inner bottom (pulled out a little when the case is open) */
function buildDrawers(parent: THREE.Object3D, c: FlightCase, t: number, open: boolean, B: Builder) {
  const mats = B.mats;
  const bi = baseInner(c);
  const X = (x: number) => -c.inner.l / 2 + x, Z = (y: number) => c.inner.w / 2 - y;
  const wIn = bi.x1 - bi.x0, depth = bi.y1 - bi.y0 - 15;
  let z = t;
  (c.drawers ?? []).forEach((dr, i) => {
    const g = new THREE.Group();
    g.position.set(X((bi.x0 + bi.x1) / 2), z, Z(bi.y0));
    if (open && i === (c.drawers ?? []).length - 1) g.position.z += depth * 0.55;
    parent.add(g);
    const bw = wIn - 27, bh = Math.max(20, dr.h - 15);
    B.add(g, boxGeo(wIn - 3, dr.h - 3, c.panel), mats.lam, 0, dr.h / 2, -c.panel / 2);
    B.add(g, boxGeo(bw, 6, depth - c.panel), mats.ply, 0, 3, -(depth + c.panel) / 2);
    for (const sx of [-1, 1]) B.add(g, boxGeo(6, bh, depth - c.panel), mats.ply, sx * (bw / 2 - 3), bh / 2, -(depth + c.panel) / 2);
    B.add(g, boxGeo(bw, bh, 6), mats.ply, 0, bh / 2, -depth + 3);
    B.add(g, new RoundedBoxGeometry(Math.min(160, wIn * 0.4), 14, 14, 2, 3), mats.chrome, 0, dr.h / 2, 8);
    z += dr.h;
  });
}

/**
 * Foam of one layer. Body: `floor` is the inner bottom, `space` the inner height (foam grows upwards).
 * Lid: lid coordinates (y = 0 at the split), `floor` is the panel thickness at the top, `space` the inner lid height
 * (foam hangs from the ceiling).
 */
export function addFoam(parent: THREE.Object3D, c: FlightCase, layer: CaseItem['layer'], floor: number, space: number, B: Builder) {
  const mats = B.mats;
  const X = (x: number) => -c.inner.l / 2 + x;
  const Z = (y: number) => c.inner.w / 2 - y;
  // foam fills the base (doors excluded); a lid over the whole case (doors under it) gets foam over the whole width
  const r = layer === 'lid' && c.doors?.span === 'body' ? { x0: 0, x1: c.inner.l, y0: 0, y1: c.inner.w } : isDrawer(c) || c.kind === 'inlay' ? { x0: 0, x1: c.inner.l, y0: 0, y1: c.inner.w } : baseInner(c);
  const il = r.x1 - r.x0, iw = r.y1 - r.y0, cx = X((r.x0 + r.x1) / 2), cz = Z((r.y0 + r.y1) / 2);
  const area = usableArea(c);
  const items = c.items.filter((i) => i.layer === layer);
  const lidMode = layer === 'lid';
  const base = lidMode ? c.foam.lid : c.foam.bottom;
  const ceil = lidMode ? caseDims(c).lidH - floor : floor;
  const dir = lidMode ? -1 : 1;
  if (base > 0) B.add(parent, boxGeo(il, base, iw, FOAM_MM), mats.foam, cx, ceil + dir * base / 2, cz);
  const surf = ceil + dir * base;
  const sides = c.foam.sides;
  const sideH = Math.max(0, space - base);
  if (sides > 0 && sideH > 0) {
    const yc = surf + dir * sideH / 2;
    for (const sz of [-1, 1]) B.add(parent, boxGeo(il, sideH, sides, FOAM_MM), mats.foam, cx, yc, cz + sz * (iw / 2 - sides / 2));
    for (const sx of [-1, 1]) B.add(parent, boxGeo(sides, sideH, iw - 2 * sides, FOAM_MM), mats.foam, cx + sx * (il / 2 - sides / 2), yc, cz);
  }
  if (!lidMode) for (const dv of c.dividers) {
    if (dv.axis === 'x') B.add(parent, boxGeo(il, space, 7), mats.ply, cx, floor + space / 2, Z(dv.pos));
    else if (dv.axis === 'y') B.add(parent, boxGeo(7, space, iw), mats.ply, X(dv.pos), floor + space / 2, cz);
    else B.add(parent, boxGeo(il, 7, iw), mats.ply, cx, floor + dv.pos, cz);
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
    const outside = it.x >= c.inner.l || it.y >= c.inner.w || it.x + f.l <= 0 || it.y + f.w <= 0;
    const m = new THREE.MeshStandardMaterial({ color: ITEM_TONES[i % ITEM_TONES.length], roughness: 0.5, metalness: 0.1 });
    let geo: THREE.BufferGeometry;
    const mn = Math.min(f.l, f.w);
    if (it.outline && it.outline.length >= 3) {
      // own contour: extruded upwards from 0 to h (lid items hang down, see the position below)
      const sh = new THREE.Shape();
      cutoutOutline(it).forEach(([x, y], k) => (k ? sh.lineTo(X(x) - X(it.x + f.l / 2), -(Z(y) - Z(it.y + f.w / 2))) : sh.moveTo(X(x) - X(it.x + f.l / 2), -(Z(y) - Z(it.y + f.w / 2)))));
      geo = new THREE.ExtrudeGeometry(sh, { depth: it.h - 1, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 }).scale(0.985, 0.985, 1).rotateX(-Math.PI / 2).translate(0, -it.h / 2 + 0.5, 0);
    } else if (it.shape === 'circle') geo = new THREE.CylinderGeometry(mn / 2 - 0.5, mn / 2 - 0.5, it.h, 32).scale(f.l / mn, 1, f.w / mn);
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
