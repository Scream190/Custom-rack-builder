import { useState } from 'react';
import * as THREE from 'three';
import { renderMarkup as renderToStaticMarkup } from '../i18n/render';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Project, Rack } from '../model/types';
import { deviceFrontX, deviceTopY, faceWidth, outerPanel, panelHeight, rackBays, U } from '../model/geometry';
import { bayPlace, bottomBlock, buildOf, isFlightRack, rackDims } from '../model/rackBuild';
import { DeviceFace } from '../render/DeviceFace';
import { Builder, boxGeo, faceBasis, makeMats, v3 } from './caseParts';
import { Scene3D, type BuildResult } from './Scene3D';
import { panelTexture } from './rackScene';

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
  // housing coordinates (x from the left, y from the bottom, z from the front) -> scene (centred, front = +z)
  const X = (hx: number) => hx - d.W / 2;
  const Zs = (hz: number) => d.D / 2 - hz;
  let zShift = 0;

  // ---------------------------------------------------------------- housing
  if (flight) {
    const closeH = 20;
    let laid = 0;
    const topY = d.caseH;
    d.blocks.forEach((k, bi) => {
      const cx = X(k.x + k.W / 2), cy = y0 + k.y + k.caseH / 2;
      const body = new THREE.Group();
      body.position.set(cx, cy, Zs(k.z + k.lidF + k.bodyD / 2));
      root.add(body);
      const closing: ('pz' | 'nz')[] = [];
      if (b.frontLid) closing.push('pz');
      if (b.rearLid) closing.push('nz');
      B.shell(body, { size: [k.W, k.caseH, k.bodyD], open: ['pz', 'nz'], closing, panel: b.panel, profile: b.profile, balls: false });

      // work surfaces under set-back bays: laminated plate with an aluminium U profile on the front edge
      if (bi === 0) for (const sh of d.shelves) {
        const sy = y0 + sh.y - sh.t / 2 - cy;
        B.add(body, boxGeo(sh.w, sh.t, k.bodyD - 4, 120), mats.lam, X(sh.x + sh.w / 2) - cx, sy, 0);
        B.add(body, boxGeo(sh.w, sh.t + 4, 3), mats.alu, X(sh.x + sh.w / 2) - cx, sy, k.bodyD / 2 - 2);
      }
      if (t.kind === 'shockmount') {
        const fw = k.innerW - 2 * k.travel, fh = k.innerH - 2 * k.travel, fd = k.bodyD - 2 * k.travel;
        const inner = new THREE.Group();
        body.add(inner);
        B.shell(inner, { size: [fw, fh, fd], open: ['pz', 'nz'], panel: 9, profile: 'none', balls: false });
        const foam = b.shock?.damper === 'foam';
        const damper = foam ? new THREE.MeshStandardMaterial({ color: '#2f3136', roughness: 1 }) : mats.rubber;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [-1, 1]) {
          const x = sx * (fw / 2 - 70), z = sz * (fd / 2 - 70), y = sy * (fh / 2 + k.travel / 2);
          if (foam) B.add(inner, boxGeo(90, k.travel - 1, 90), damper, x, y, z);
          else {
            B.add(inner, new THREE.CylinderGeometry(19, 19, k.travel - 8, 20), damper, x, y, z);
            for (const s2 of [-1, 1]) B.add(inner, new THREE.CylinderGeometry(24, 24, 4, 20), mats.chrome, x, y + s2 * (k.travel / 2 - 2), z);
          }
        }
      }

      const lid = (depth: number, front: boolean) => {
        const g = new THREE.Group();
        B.shell(g, { size: [k.W, k.caseH, depth], open: [front ? 'nz' : 'pz'], closing: [front ? 'nz' : 'pz'], panel: b.panel, profile: b.profile, balls: b.cornerBalls });
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
          for (let q = 0; q < n; q++) {
            const s = (q + 1) / (n + 1);
            const along = face === 'py' || face === 'ny' ? v3(-k.W / 2 + s * k.W, 0, 0) : v3(0, -k.caseH / 2 + s * k.caseH, 0);
            const out = nrm.clone().multiplyScalar(face === 'py' || face === 'ny' ? k.caseH / 2 : k.W / 2);
            B.butterflyLatch(B.frame(body, out.clone().add(along).add(v3(0, 0, splitZBody - dir * (closeH + 2))), u, v), 1);
            if (lidGroup) B.latchKeeper(B.frame(lidGroup, out.clone().add(along).add(v3(0, 0, lidSplitZ + dir * (closeH + 2))), u, v), 1);
          }
        }
      };
      if (b.rearLid) {
        const rl = lid(k.lidR, false);
        rl.position.set(cx, cy, Zs(k.z + k.lidF + k.bodyD + k.lidR / 2));
        root.add(rl);
        latchesOn(-k.bodyD / 2, -1, rl, k.lidR / 2);
      }
      if (b.frontLid) {
        const fl = lid(k.lidF, true);
        latchesOn(k.bodyD / 2, 1, fl, -k.lidF / 2);
        if (bi === 0) B.labelHolder(B.frame(fl, v3(0, k.caseH / 2 - 70, k.lidF / 2), v3(1, 0, 0), v3(0, 1, 0)));
        if (!open) { fl.position.set(cx, cy, Zs(k.z + k.lidF / 2)); root.add(fl); }
        else {
          // taken off and laid down in front of the housing, inside facing up
          fl.rotation.x = Math.PI / 2;
          fl.position.set(cx, k.lidF / 2 + 2, d.D / 2 + 160 + laid + k.caseH / 2);
          root.add(fl);
          laid += k.caseH + 80;
        }
      }
      // handles on the sides of tall blocks, stacking cups on the topmost blocks
      if (k.caseH > 240) for (const face of ['nx', 'px'] as const) {
        const fb = faceBasis(face);
        for (let q = 0; q < b.handles; q++) {
          const s = (q + 1) / (b.handles + 1);
          B.recessedHandle(B.frame(body, fb.n.clone().multiplyScalar(k.W / 2).add(v3(0, k.caseH * 0.12, k.bodyD / 2 - s * k.bodyD)), fb.u, fb.v));
        }
      }
      if (b.stackCups && Math.abs(k.y + k.caseH - topY) < 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.stackCup(B.frame(body, v3(sx * (k.W / 2 - 75), k.caseH / 2, sz * (k.bodyD / 2 - 75)), v3(1, 0, 0), v3(0, 0, -1)));
      }
    });
    if (laid) zShift = 160 + laid / 2;
  } else if (t.kind === 'open') {
    const steel = mats.steel, post = 30;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(root, boxGeo(post, d.caseH, post), steel, sx * (d.W / 2 - post / 2), y0 + d.caseH / 2, sz * (d.D / 2 - post / 2));
    for (const y of [y0 + 20, y0 + d.caseH - 20]) {
      for (const sz of [-1, 1]) B.add(root, boxGeo(d.W, 40, 25), steel, 0, y, sz * (d.D / 2 - 12.5));
      for (const sx of [-1, 1]) B.add(root, boxGeo(25, 40, d.D), steel, sx * (d.W / 2 - 12.5), y, 0);
    }
  } else {
    // steel cabinet with plinth, glass door and handle
    const steel = mats.steel, sheet = d.wall;
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

  // ---------------------------------------------------------------- rails with square holes, per bay at its own depth
  const holeGeo = boxGeo(9.5, 9.5, 1);
  const holes: THREE.Matrix4[] = [];
  rackBays(t).forEach((bay, i) => {
    const pl = bayPlace(t, d, i);
    const fw = faceWidth(bay.rackStandard), h = bay.heightU * U;
    const x0 = X(pl.x), yb = y0 + pl.y;
    const earW = (fw - (bay.rackStandard === 19 ? 450 : 222.25)) / 2;
    const zf = Zs(pl.z), zr = Zs(pl.z + pl.depth);
    for (const z of t.hasRearRails ? [zf, zr] : [zf]) {
      const back = z === zf ? -1 : 1;
      for (const sx of [0, 1]) {
        const xc = x0 + (sx ? fw - earW / 2 : earW / 2);
        B.add(root, boxGeo(earW + 2, h, 2.5), mats.rail, xc, yb + h / 2, z + back * 1.25);
        B.add(root, boxGeo(2.5, h, 28), mats.rail, xc + (sx ? 1 : -1) * (earW / 2 + 1), yb + h / 2, z + back * 14);
        for (let u = 0; u < bay.heightU; u++) for (const off of HOLE_OFFSETS) holes.push(new THREE.Matrix4().makeTranslation(xc, yb + u * U + off, z + (z === zf ? 0.3 : -0.3)));
      }
    }
  });
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
      const bi = Math.min(dev.bay ?? 0, rackBays(t).length - 1);
      const pl = bayPlace(t, d, bi);
      const w = faceWidth(pl.bay.rackStandard) / tpl.slots;
      const h = panelHeight(tpl.heightU);
      const depth = Math.max(4, Math.min(tpl.depth, pl.depth + 60));
      const x = X(deviceFrontX(rack, dev, tpl) - d.ox) + w / 2;
      const y = y0 + deviceTopY(dev, tpl, rack) - d.oy - 0.4 - h / 2;
      const front = dev.mount === 'front';
      const bodyW = Math.min(w, tpl.bodyWidth ?? (tpl.slots === 1 ? w - 34 : w - 4));
      const side = new THREE.MeshStandardMaterial({ color: tpl.color, roughness: 0.6, metalness: 0.3 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
      const plateZ = front ? Zs(pl.z) + 1.5 : Zs(pl.z + pl.depth) - 1.5;
      const plate = new THREE.Mesh(boxGeo(w - 0.6, h, 3), [side, side, side, side, front ? faceMat : side, front ? side : faceMat]);
      plate.position.set(x, y, plateZ);
      root.add(plate);
      B.add(root, boxGeo(bodyW, h - 2, depth - 3), side, x, y, front ? plateZ - 1.5 - (depth - 3) / 2 : plateZ + 1.5 + (depth - 3) / 2);
      panelTexture(renderToStaticMarkup(<DeviceFace tpl={tpl} panel={outerPanel(dev)} width={w} device={dev} showPortLabels={false} />), w, h).then((tex) => {
        faceMat.map = tex;
        faceMat.needsUpdate = true;
        faceMat.addEventListener('dispose', () => tex.dispose());
      });
    }
  }

  // castors under the lowest block
  if (b.castors) {
    const base = flight ? bottomBlock(d) : d.blocks[0];
    const cx = X(base.x + base.W / 2), cz = Zs(base.z + base.lidF + base.bodyD / 2), dd = flight ? base.bodyD : d.D;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
      const g = new THREE.Group();
      g.position.set(cx + sx * (base.W / 2 - 75), y0, cz + sz * (dd / 2 - 75));
      root.add(g);
      B.castor(g, b.castorSize, i < 2);
    });
  }
  B.finish();
  return { size: { x: d.W, y: d.H, z: d.D }, zShift };
}
