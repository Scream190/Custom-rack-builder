import { useState } from 'react';
import * as THREE from 'three';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Project, Rack } from '../model/types';
import { bayOf, deviceFrontX, deviceTopY, faceWidth, panelHeight, rackBays, U } from '../model/geometry';
import { buildOf, isFlightRack, rackDims } from '../model/rackBuild';
import { DeviceFace } from '../render/DeviceFace';
import { Builder, boxGeo, faceBasis, makeMats, v3 } from './caseParts';
import { Scene3D, type BuildResult } from './Scene3D';
import { panelTexture } from './Rack3D';

/** 3D view of a designed rack housing with its rails and (optionally) the installed devices. */
export function RackBuild3D({ project, rack, devices }: { project: Project; rack: Rack; devices: boolean }) {
  const [open, setOpen] = useState(true);
  const b = buildOf(rack.type);
  const hasFront = isFlightRack(rack.type.kind) ? b.frontLid > 0 : rack.type.kind === 'cabinet';
  return (
    <Scene3D build={(root) => buildRack(root, project, rack, open, devices)} deps={[rack.type, rack.devices, open, devices]}>
      {hasFront ? (
        <button className="btn sm view3d-btn" onClick={() => setOpen(!open)} title={open ? 'Frontdeckel bzw. Tür schließen' : 'Frontdeckel abnehmen bzw. Tür öffnen'}>
          {open ? (isFlightRack(rack.type.kind) ? 'Frontdeckel aufsetzen' : 'Tür schließen') : (isFlightRack(rack.type.kind) ? 'Frontdeckel abnehmen' : 'Tür öffnen')}
        </button>
      ) : null}
    </Scene3D>
  );
}

const HOLE_OFFSETS = [6.35, 22.225, 38.1];

export function buildRack(root: THREE.Group, project: Project, rack: Rack, open: boolean, showDevices: boolean): BuildResult {
  const t = rack.type;
  const b = buildOf(t);
  const d = rackDims(t);
  const mats = makeMats(t.color, '#3f3f46');
  const B = new Builder(mats);
  const flight = isFlightRack(t.kind);
  const y0 = d.castorH;
  const zFront = d.D / 2 - d.lidF;                 // front opening of the body (root z)
  const bodyZ = zFront - d.bodyD / 2;
  const yMid = y0 + d.caseH / 2;
  const railFrontZ = zFront - d.railZ;
  const railRearZ = railFrontZ - t.depth;
  const innerLeft = -d.innerW / 2, innerBottom = yMid - d.innerH / 2;
  const bayLeft = innerLeft + d.bayX, bayBottom = innerBottom + d.bayY;
  let zShift = 0;

  // ---------------------------------------------------------------- housing
  if (flight) {
    const closeH = 20;
    const body = new THREE.Group();
    body.position.set(0, yMid, bodyZ);
    root.add(body);
    const closing: ('pz' | 'nz')[] = [];
    if (b.frontLid) closing.push('pz');
    if (b.rearLid) closing.push('nz');
    B.shell(body, { size: [d.W, d.caseH, d.bodyD], open: ['pz', 'nz'], closing, panel: b.panel, profile: b.profile, balls: false });

    if (t.kind === 'shockmount') {
      // inner rack floating on dampers
      const fw = d.innerW - 2 * d.travel, fh = d.innerH - 2 * d.travel, fd = d.bodyD - 2 * d.travel;
      const inner = new THREE.Group();
      body.add(inner);
      B.shell(inner, { size: [fw, fh, fd], open: ['pz', 'nz'], panel: 9, profile: 'none', balls: false });
      const damper = b.shock?.damper === 'foam'
        ? new THREE.MeshStandardMaterial({ color: '#2f3136', roughness: 1 })
        : mats.rubber;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [-1, 1]) {
        const x = sx * (fw / 2 - 70), z = sz * (fd / 2 - 70), y = sy * (fh / 2 + d.travel / 2);
        if (b.shock?.damper === 'foam') B.add(inner, boxGeo(90, d.travel - 1, 90), damper, x, y, z);
        else {
          B.add(inner, new THREE.CylinderGeometry(19, 19, d.travel - 8, 20), damper, x, y, z);
          for (const s2 of [-1, 1]) B.add(inner, new THREE.CylinderGeometry(24, 24, 4, 20), mats.chrome, x, y + s2 * (d.travel / 2 - 2), z);
        }
      }
    }

    const lid = (depth: number, front: boolean) => {
      const g = new THREE.Group();
      B.shell(g, { size: [d.W, d.caseH, depth], open: [front ? 'nz' : 'pz'], closing: [front ? 'nz' : 'pz'], panel: b.panel, profile: b.profile, balls: b.cornerBalls });
      return g;
    };
    // latches around a split: top/bottom along x, left/right along y; v points from the body to the lid
    const latchesOn = (splitZBody: number, dir: 1 | -1, lidGroup: THREE.Group | null, lidSplitZ: number) => {
      const per = b.latches === 4 ? [1, 1, 1, 1] : b.latches === 6 ? [2, 2, 1, 1] : [2, 2, 2, 2];
      const faces: ['py' | 'ny' | 'px' | 'nx', number][] = [['py', per[0]], ['ny', per[1]], ['nx', per[2]], ['px', per[3]]];
      const v = v3(0, 0, dir);
      for (const [face, n] of faces) {
        const nrm = faceBasis(face).n;
        const u = v.clone().cross(nrm);
        for (let k = 0; k < n; k++) {
          const s = (k + 1) / (n + 1);
          const along = face === 'py' || face === 'ny' ? v3(-d.W / 2 + s * d.W, 0, 0) : v3(0, -d.caseH / 2 + s * d.caseH, 0);
          const out = nrm.clone().multiplyScalar(face === 'py' || face === 'ny' ? d.caseH / 2 : d.W / 2);
          B.butterflyLatch(B.frame(body, out.clone().add(along).add(v3(0, 0, splitZBody - dir * (closeH + 2))), u, v), 1);
          if (lidGroup) B.latchKeeper(B.frame(lidGroup, out.clone().add(along).add(v3(0, 0, lidSplitZ + dir * (closeH + 2))), u, v), 1);
        }
      }
    };
    if (b.rearLid) {
      const rl = lid(d.lidR, false);
      rl.position.set(0, yMid, -d.D / 2 + d.lidR / 2);
      root.add(rl);
      latchesOn(-d.bodyD / 2, -1, rl, d.lidR / 2);
    }
    if (b.frontLid) {
      const fl = lid(d.lidF, true);
      latchesOn(d.bodyD / 2, 1, fl, -d.lidF / 2);
      B.labelHolder(B.frame(fl, v3(0, d.caseH / 2 - 70, d.lidF / 2), v3(1, 0, 0), v3(0, 1, 0)));
      if (!open) { fl.position.set(0, yMid, d.D / 2 - d.lidF / 2); root.add(fl); }
      else {
        // taken off and laid down in front of the case, inside facing up
        fl.rotation.x = Math.PI / 2;
        fl.position.set(0, d.lidF / 2 + 2, d.D / 2 + 160 + d.caseH / 2);
        root.add(fl);
        zShift = 160 + d.caseH / 2;
      }
    }
    // handles on the sides, stacking cups on top
    for (const face of ['nx', 'px'] as const) {
      const fb = faceBasis(face);
      for (let k = 0; k < b.handles; k++) {
        const s = (k + 1) / (b.handles + 1);
        const z = d.bodyD / 2 - s * d.bodyD;
        B.recessedHandle(B.frame(body, fb.n.clone().multiplyScalar(d.W / 2).add(v3(0, d.caseH * 0.12, z)), fb.u, fb.v));
      }
    }
    if (b.stackCups) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.stackCup(B.frame(body, v3(sx * (d.W / 2 - 75), d.caseH / 2, sz * (d.bodyD / 2 - 75)), v3(1, 0, 0), v3(0, 0, -1)));
    }
  } else if (t.kind === 'open') {
    // four posts and frames
    const steel = mats.steel;
    const post = 30;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(root, boxGeo(post, d.caseH, post), steel, sx * (d.W / 2 - post / 2), y0 + d.caseH / 2, sz * (d.D / 2 - post / 2));
    for (const y of [y0 + 20, y0 + d.caseH - 20]) {
      for (const sz of [-1, 1]) B.add(root, boxGeo(d.W, 40, 25), steel, 0, y, sz * (d.D / 2 - 12.5));
      for (const sx of [-1, 1]) B.add(root, boxGeo(25, 40, d.D), steel, sx * (d.W / 2 - 12.5), y, 0);
    }
  } else {
    // steel cabinet with plinth, glass door and handle
    const steel = mats.steel;
    const sheet = d.wall;
    for (const sx of [-1, 1]) B.add(root, new RoundedBoxGeometry(sheet, d.caseH, d.D, 2, 3), steel, sx * (d.W / 2 - sheet / 2), y0 + d.caseH / 2, 0);
    B.add(root, new RoundedBoxGeometry(d.W, 50, d.D, 2, 3), steel, 0, y0 + d.caseH - 25, 0);
    B.add(root, boxGeo(d.W - 2 * sheet, 60, d.D - 40), mats.black, 0, y0 + 30, 0);
    B.add(root, boxGeo(d.W - 2 * sheet, d.caseH - 110, 2), steel, 0, y0 + 60 + (d.caseH - 110) / 2, -d.D / 2 + 1);
    if (!open) {
      const glass = new THREE.MeshStandardMaterial({ color: '#0d1013', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
      const door = new THREE.Group();
      door.position.set(0, y0 + 60 + (d.caseH - 110) / 2, d.D / 2 - 2);
      root.add(door);
      const dw = d.W - 2 * sheet + 10, dh = d.caseH - 110;
      for (const sx of [-1, 1]) B.add(door, boxGeo(30, dh, 4), steel, sx * (dw / 2 - 15), 0, 0);
      for (const sy of [-1, 1]) B.add(door, boxGeo(dw, 30, 4), steel, 0, sy * (dh / 2 - 15), 0);
      B.add(door, boxGeo(dw - 60, dh - 60, 3), glass, 0, 0, 0);
      B.add(door, new RoundedBoxGeometry(16, 140, 22, 2, 4), mats.chrome, dw / 2 - 40, 0, 12);
    }
  }

  // ---------------------------------------------------------------- rails with square holes
  const holeGeo = boxGeo(9.5, 9.5, 1);
  const holes: THREE.Matrix4[] = [];
  const railMat = mats.rail;
  for (const bay of rackBays(t)) {
    const fw = faceWidth(bay.rackStandard), h = bay.heightU * U;
    const x0 = bayLeft + bay.x, yb = bayBottom + bay.y;
    const earW = (fw - (bay.rackStandard === 19 ? 450 : 222.25)) / 2;
    const zs = [railFrontZ, ...(t.hasRearRails ? [railRearZ] : [])];
    for (const z of zs) {
      const back = z === railFrontZ ? -1 : 1;
      for (const sx of [0, 1]) {
        const xc = x0 + (sx ? fw - earW / 2 : earW / 2);
        B.add(root, boxGeo(earW + 2, h, 2.5), railMat, xc, yb + h / 2, z + back * 1.25);
        // flange going into the depth (rail profile)
        B.add(root, boxGeo(2.5, h, 28), railMat, xc + (sx ? 1 : -1) * (earW / 2 + 1), yb + h / 2, z + back * 14);
        for (let u = 0; u < bay.heightU; u++) for (const off of HOLE_OFFSETS) {
          holes.push(new THREE.Matrix4().makeTranslation(xc, yb + u * U + off, z + (z === railFrontZ ? 0.3 : -0.3)));
        }
      }
    }
  }
  if (holes.length) {
    const inst = new THREE.InstancedMesh(holeGeo, new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.9 }), holes.length);
    holes.forEach((m, i) => inst.setMatrixAt(i, m));
    root.add(inst);
  }

  // ---------------------------------------------------------------- devices
  if (showDevices) {
    for (const dev of rack.devices) {
      const tpl = project.templates[dev.templateId];
      if (!tpl) continue;
      const bay = bayOf(rack, dev);
      const w = faceWidth(bay.rackStandard) / tpl.slots;
      const h = panelHeight(tpl.heightU);
      const depth = Math.max(4, Math.min(tpl.depth, t.depth + 60));
      const x = bayLeft + deviceFrontX(rack, dev, tpl) + w / 2;
      const y = bayBottom + deviceTopY(dev, tpl, rack) - 0.4 - h / 2;
      const front = dev.mount === 'front';
      const bodyW = Math.min(w, tpl.bodyWidth ?? (tpl.slots === 1 ? w - 34 : w - 4));
      const side = new THREE.MeshStandardMaterial({ color: tpl.color, roughness: 0.6, metalness: 0.3 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      // front plate across the slot, chassis behind it
      const plateZ = front ? railFrontZ + 1.5 : railRearZ - 1.5;
      const plate = new THREE.Mesh(boxGeo(w - 0.6, h, 3), [side, side, side, side, front ? faceMat : side, front ? side : faceMat]);
      plate.position.set(x, y, plateZ);
      root.add(plate);
      B.add(root, boxGeo(bodyW, h - 2, depth - 3), side, x, y, front ? plateZ - 1.5 - (depth - 3) / 2 : plateZ + 1.5 + (depth - 3) / 2);
      panelTexture(renderToStaticMarkup(<DeviceFace tpl={tpl} panel="front" width={w} device={dev} showPortLabels={false} />), w, h).then((tex) => {
        faceMat.map = tex;
        faceMat.needsUpdate = true;
        faceMat.addEventListener('dispose', () => tex.dispose());
      });
    }
  }

  // castors under the body
  if (b.castors) {
    const zc = flight ? bodyZ : 0, dd = flight ? d.bodyD : d.D;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
      const g = new THREE.Group();
      g.position.set(sx * (d.W / 2 - 75), y0, zc + sz * (dd / 2 - 75));
      root.add(g);
      B.castor(g, b.castorSize, i < 2);
    });
  }
  B.finish();
  return { size: { x: d.W, y: d.H, z: d.D }, zShift };
}
