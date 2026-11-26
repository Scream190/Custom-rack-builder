import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CaseFace, FlightCase } from '../model/types';
import { caseDims, footprint, isDrawer } from '../model/cases';

const S = 0.001; // mm -> m

/** 3D preview of a flight case: shell, aluminium edges, hardware, castors, foam and contents; lid open or closed. */
export function Case3D({ c }: { c: FlightCase }) {
  const host = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<{ scene: THREE.Scene; content: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls } | null>(null);
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);

  // renderer, camera, controls (once)
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor('#131518');
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#30343b', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const grid = new THREE.GridHelper(10, 40, '#3a404a', '#262a31');
    scene.add(grid);
    const content = new THREE.Group();
    scene.add(content);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.zoomToCursor = true;
    ctxRef.current = { scene, content, camera, controls };
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
      renderer.dispose();
      el.removeChild(renderer.domElement);
      ctxRef.current = null;
    };
  }, []);

  // content
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { content, camera, controls } = ctx;
    content.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    content.clear();
    const d = caseDims(c);
    const drawer = isDrawer(c);
    const lam = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.75 });
    const alu = new THREE.MeshStandardMaterial({ color: '#c3c7cc', metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.6 });
    const foam = new THREE.MeshStandardMaterial({ color: c.foam.color, roughness: 0.95 });
    const box = (g: THREE.Object3D, w: number, h: number, dd: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * S, h * S, dd * S), m);
      mesh.position.set(x * S, y * S, z * S);
      g.add(mesh);
      return mesh;
    };
    // origin: centre of the footprint on the floor; x = length, y = up, z = towards the viewer (front)
    const y0 = d.castorH;
    const body = new THREE.Group();
    content.add(body);
    const L = d.L, W = d.W;
    if (!drawer) {
      const p = c.panel;
      // body shell: bottom + four walls
      box(body, L, p, W, 0, y0 + p / 2, 0, lam);
      box(body, L, d.bodyH, p, 0, y0 + d.bodyH / 2, W / 2 - p / 2, lam);
      box(body, L, d.bodyH, p, 0, y0 + d.bodyH / 2, -W / 2 + p / 2, lam);
      box(body, p, d.bodyH, W, -L / 2 + p / 2, y0 + d.bodyH / 2, 0, lam);
      box(body, p, d.bodyH, W, L / 2 - p / 2, y0 + d.bodyH / 2, 0, lam);
      if (c.profile !== 'none') {
        const e = 10;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(body, e, d.bodyH, e, sx * (L / 2 - e / 2 + 1), y0 + d.bodyH / 2, sz * (W / 2 - e / 2 + 1), alu);
        box(body, L, 12, W + 2, 0, y0 + d.bodyH - 6, 0, alu).scale.set(1, 1, 1);
      }
      // ball corners at the bottom
      if (c.cornerBalls) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(16 * S, 16, 12), alu);
        m.position.set(sx * L / 2 * S, (y0 + 8) * S, sz * W / 2 * S);
        body.add(m);
      }
    } else {
      // drawer: just the outline of the inner space
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L * S, c.inner.h * S, W * S)), new THREE.LineBasicMaterial({ color: '#9ca3af' }));
      edges.position.set(0, (c.inner.h / 2) * S, 0);
      content.add(edges);
    }
    // foam bottom and cut-out block
    const innerX0 = -c.inner.l / 2, innerZfront = c.inner.w / 2;
    const fb = drawer ? c.foam.bottom : c.foam.bottom;
    const floor = y0 + (drawer ? 0 : c.panel);
    box(content, c.inner.l, fb, c.inner.w, 0, floor + fb / 2, 0, foam);
    // contents (body layer) as coloured boxes on the foam
    const palette = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d'];
    c.items.filter((it) => it.layer === 'body').forEach((it, i) => {
      const f = footprint(it);
      const m = new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.5 });
      box(content, f.l, it.h, f.w, innerX0 + it.x + f.l / 2, floor + fb + it.h / 2, innerZfront - it.y - f.w / 2, m);
    });
    // hardware on the outside faces
    const bodyTop = y0 + d.bodyH;
    const faceAt = (face: CaseFace, s: number, y: number, w: number, h: number, dd: number, m: THREE.Material) => {
      if (face === 'front') box(body, w, h, dd, -L / 2 + s * L, y, W / 2 + dd / 2, m);
      else if (face === 'back') box(body, w, h, dd, L / 2 - s * L, y, -W / 2 - dd / 2, m);
      else if (face === 'left') box(body, dd, h, w, -L / 2 - dd / 2, y, -W / 2 + s * W, m);
      else if (face === 'right') box(body, dd, h, w, L / 2 + dd / 2, y, W / 2 - s * W, m);
    };
    for (const h of c.hardware) {
      for (let k = 0; k < h.count; k++) {
        const s = (k + 1) / (h.count + 1);
        if (h.kind === 'butterfly' || h.kind === 'butterfly-small') faceAt(h.face, s, bodyTop, h.kind === 'butterfly' ? 68 : 48, h.kind === 'butterfly' ? 52 : 36, 8, alu);
        else if (h.kind === 'handle-recessed') faceAt(h.face, s, y0 + d.bodyH / 2, 150, 96, 6, alu);
        else if (h.kind === 'handle-strap') faceAt(h.face, s, y0 + d.bodyH / 2, 140, 20, 10, dark);
        else if (h.kind === 'label') faceAt(h.face, s, y0 + 80, 90, 56, 3, alu);
        else if (h.kind === 'hinge') faceAt(h.face, s, bodyTop, 60, 44, 6, alu);
      }
    }
    const castors = c.hardware.filter((h) => h.kind === 'castor' || h.kind === 'castor-braked').reduce((n, h) => n + h.count, 0);
    if (castors) {
      const r = c.castorSize / 2;
      const pos = castors >= 4 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0]];
      for (const [sx, sz] of pos) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, 32 * S, 24), dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * (L / 2 - 70) * S, r * S, sz * (W / 2 - 70) * S);
        content.add(wheel);
        box(content, 30, d.castorH - r, 30, sx * (L / 2 - 70), r + (d.castorH - r) / 2, sz * (W / 2 - 70), alu);
      }
    }
    // lid: closed on top, or opened (removable: set down behind, hinged: swung open at the back)
    if (!drawer && d.lidH > 0) {
      const lid = new THREE.Group();
      const p = c.panel;
      box(lid, L, p, W, 0, d.lidH - p / 2, 0, lam);
      box(lid, L, d.lidH, p, 0, d.lidH / 2, W / 2 - p / 2, lam);
      box(lid, L, d.lidH, p, 0, d.lidH / 2, -W / 2 + p / 2, lam);
      box(lid, p, d.lidH, W, -L / 2 + p / 2, d.lidH / 2, 0, lam);
      box(lid, p, d.lidH, W, L / 2 - p / 2, d.lidH / 2, 0, lam);
      box(lid, c.inner.l, c.foam.lid, c.inner.w, 0, d.lidH - p - c.foam.lid / 2, 0, foam);
      if (c.profile !== 'none') box(lid, L, 12, W + 2, 0, 6, 0, alu);
      for (const h of c.hardware.filter((x) => x.face === 'top' && x.kind === 'stack-cup')) {
        for (let k = 0; k < h.count; k++) {
          const sx = k % 2 ? 1 : -1, sz = k < 2 ? 1 : -1;
          box(lid, 70, 6, 70, sx * (L / 2 - 60), d.lidH + 3, sz * (W / 2 - 60), alu);
        }
      }
      if (!open) lid.position.set(0, bodyTop * S, 0);
      else if (c.lidKind === 'hinged') {
        const pivot = new THREE.Group();
        pivot.position.set(0, bodyTop * S, -W / 2 * S);
        lid.position.set(0, 0, W / 2 * S);
        pivot.add(lid);
        pivot.rotation.x = -1.9;
        content.add(pivot);
      } else {
        lid.rotation.x = Math.PI;
        lid.position.set(0, d.lidH * S, -(W + 120) * S);
      }
      if (lid.parent !== content && !lid.parent) content.add(lid);
    }
    const size = Math.max(L, W, d.H) * S;
    controls.target.set(0, (d.H / 2) * S, open && d.lidH ? -(W / 2) * S : 0);
    camera.position.set(size * 1.3, size * 1.2, size * 1.8);
    camera.near = size / 100;
    camera.far = size * 50;
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
