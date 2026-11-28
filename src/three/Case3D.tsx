import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CaseFace, CaseItem, FlightCase, HardwareKind, Project } from '../model/types';
import { renderMarkup as renderToStaticMarkup } from '../i18n/render';
import { DeviceFace } from '../render/DeviceFace';
import { panelTexture } from './rackScene';
import { useStore } from '../model/store';
import { baseInner, caseBoxes, caseDims, hasCaseFoam, hingeFace, rackDevices, rackRails, type InnerBox, type RackDeviceBox, addDivider, dimChains, DIVIDER_T, dividerGaps, moveDivider, type DividerAxis, faceToOuter, footprint, hardwareInstances, hasDoors, isDrawer, moveHardware, outerToFace, placeHardware, pushPull, SEAM_LABELS, shellSize, snapHardware, splitAt, usableArea, wallOf, type CasePartId } from '../model/cases';
import { cutoutOutline, outlineBox } from '../model/inlay';
import { Builder, FOAM_MM, S, boxGeo, faceBasis, inlayGeo, makeMats, v3, type FaceKey } from './caseParts';
import { Scene3D, type BuildResult, type Scene3DApi } from './Scene3D';
import { drawerFree, hardwareClashes, mirrorHardware, removeSelection, setDrawerHeight, spreadDividers, spreadDrawers } from '../model/cases';

/** editor tools: select and drag, split the case (horizontal = lid seam, vertical = door), place a piece of hardware */
export type CaseTool = 'select' | 'seam-h' | 'seam-v' | 'measure' | `place:${HardwareKind}` | `div:${DividerAxis}`;
/** editor state owned by the workspace (shared with the component tree and the inspector) */
export interface CaseEdit {
  tool: CaseTool;
  setTool: (t: CaseTool) => void;
  selected: string | null;
  select: (s: string | null) => void;
  hidden: Set<string>;
  setHidden: (h: Set<string>) => void;
  readOnly?: boolean;
}

const TOOL_HINTS: Record<string, string> = {
  select: 'Klicken wählt aus. Beschläge mit der Maus verschieben, sie rasten auf der Mitte und symmetrisch zum Gegenstück ein (Alt: frei). An den Pfeilen einer Schale ziehen ändert die Maße (Strg: 1-mm-Schritte). Entf löscht, Esc hebt die Auswahl auf.',
  'seam-h': 'Auf eine Seitenwand klicken: Dort wird waagrecht geteilt (Deckelfuge). Esc beendet.',
  'seam-v': 'Auf eine Seitenwand oder den Deckel klicken: Am näheren Ende entsteht eine Tür, in der Deckelmitte wird der Deckel geteilt. Esc beendet.',
  place: 'Auf die Außenseite klicken, um den Beschlag zu setzen. Verschlüsse und Scharniere rasten an der nächsten Fuge ein. Esc beendet.',
  measure: 'Zwei Punkte anklicken: Abstand und Versatz in Länge, Höhe und Tiefe. Zwei parallele Flächen ergeben ihren senkrechten Abstand (z. B. Innenwand zu Innenwand). Ein dritter Klick beginnt neu, Esc beendet.',
  div: 'Auf eine Außenwand klicken: Ein Fachboden entsteht in der geklickten Höhe, eine Trennwand an der geklickten Stelle (längs: Seitenwand oder Deckel, quer: Vorder- oder Rückwand). Esc beendet.',
};

/** live readout next to the pointer while dragging */
interface Hud { x: number; y: number; text: string }
/** what the editor offers the toolbar overlay: standard views and the section plane */
interface EditorCtl { view: (v: ViewName) => void; clip: (planes: THREE.Plane[] | null) => void }
type ViewName = 'front' | 'top' | 'right' | 'iso';
const VIEWS: { id: ViewName; label: string; title: string }[] = [
  { id: 'front', label: 'Vorne', title: 'Ansicht von vorne' },
  { id: 'top', label: 'Oben', title: 'Ansicht von oben' },
  { id: 'right', label: 'Rechts', title: 'Ansicht von rechts' },
  { id: 'iso', label: 'Iso', title: 'Schräg von vorne oben' },
];

/** 3D preview of a flight case (lid open or closed) or of a foam inlay in its container; with `edit` a direct editor. */
export function Case3D({ c, edit }: { c: FlightCase; edit?: CaseEdit }) {
  const [open, setOpen] = useState(!edit);
  const [fit, setFit] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [section, setSection] = useState<{ axis: 'x' | 'y'; pos: number } | null>(null);
  const [dims, setDims] = useState(false);
  const [measure, setMeasure] = useState<{ a: MeasurePt; b?: MeasurePt } | null>(null);
  const [menu, setMenu] = useState<CtxMenu | null>(null);
  const [help, setHelp] = useState(false);
  const isMeasure = edit?.tool === 'measure';
  useEffect(() => { if (!isMeasure) setMeasure(null); }, [isMeasure]);
  const [openDrawers, setOpenDrawers] = useState<Set<number>>(() => new Set());
  const toggleDrawer = (i: number) => setOpenDrawers((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const ui = useRef<EditorUi>({ setHud: () => {}, setMenu: () => {}, onMeasure: () => {}, toggleDrawer: () => {} });
  ui.current = { setHud, setMenu, onMeasure: (pt) => setMeasure((m) => (!m || m.b ? { a: pt } : { ...m, b: pt })), toggleDrawer };
  // view shortcuts (tools are handled by the workspace)
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable))) return;
      const k = e.key.toLowerCase();
      if (k === 'f') setFit((n) => n + 1);
      else if (k === 'm') setDims((d) => !d);
      else if (k === 'x' && size) setSection((s) => (s ? null : { axis: 'x', pos: Math.round(size.L / 2) }));
      else if (k === '1') ctl.current?.view('front');
      else if (k === '2') ctl.current?.view('top');
      else if (k === '3') ctl.current?.view('right');
      else if (k === '0') ctl.current?.view('iso');
      else if (e.key === '?') setHelp((h) => !h);
      else if (e.key === 'Escape') { setMenu(null); setHelp(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // shelves and walls sit inside: open the case when their tool is picked
  const divTool = edit?.tool.startsWith('div:');
  useEffect(() => { if (divTool) setOpen(true); }, [divTool]);
  const cRef = useRef(c); cRef.current = c;
  const editRef = useRef(edit); editRef.current = edit;
  const openRef = useRef(open); openRef.current = open;
  const ctl = useRef<EditorCtl | null>(null);
  const doors = hasDoors(c);
  const lidToggle = !isDrawer(c) && c.kind !== 'inlay' && (c.lidKind !== 'none' || doors);
  const what = doors ? (c.lidKind !== 'none' ? 'Deckel und Türen' : 'Türen') : 'Deckel';
  const project = useStore((s) => s.project);
  const view: CaseView | undefined = edit ? { hidden: edit.hidden, selected: edit.selected, dims, measure: measure ?? undefined, openDrawers, project } : { project };
  const hint = edit && (!edit.readOnly || edit.tool === 'measure') ? TOOL_HINTS[edit.tool.startsWith('place:') ? 'place' : edit.tool.startsWith('div:') ? 'div' : edit.tool] : null;
  const size = edit && !isDrawer(c) && c.kind !== 'inlay' ? shellSize(c) : null;
  // section plane: keeps the part left of the cut (length) or behind it (width)
  useEffect(() => {
    if (!ctl.current || !size) return;
    if (!section) { ctl.current.clip(null); return; }
    const pos = Math.max(1, Math.min((section.axis === 'x' ? size.L : size.W) - 1, section.pos));
    ctl.current.clip([section.axis === 'x' ? new THREE.Plane(v3(-1, 0, 0), (pos - size.L / 2) * S) : new THREE.Plane(v3(0, 0, -1), (size.W / 2 - pos) * S)]);
  }, [section, size?.L, size?.W]);
  return (
    <Scene3D build={(root) => buildCase(root, c, open, view)} deps={[c, open, edit?.selected, edit?.hidden, dims, measure, openDrawers, project.racks, project.templates]}
      interact={edit ? (api) => caseEditor(api, cRef, editRef, openRef, ctl, ui) : undefined}
      frameKey={edit ? `${c.id}:${open}:${fit}` : undefined}>
      <div className="view3d-btns">
        {lidToggle ? (
          <button className="btn sm" onClick={() => setOpen(!open)} title={open ? `${what} aufsetzen und das Case geschlossen zeigen` : `${what} abnehmen bzw. aufklappen und das Innere zeigen`}>
            {open ? `${what} schließen` : `${what} öffnen`}
          </button>
        ) : null}
        {edit ? (
          <>
            <button className="btn sm" onClick={() => setFit(fit + 1)} title="Kamera auf das ganze Case ausrichten">Einpassen</button>
            <button className={'btn sm' + (dims ? ' active' : '')} onClick={() => setDims(!dims)} title="Maßketten außen: Länge, Breite und Höhe mit Unterteil, Deckel, Türen und Rollen">Maße</button>
            <span className="view3d-sep" />
            {VIEWS.map((v) => <button key={v.id} className="btn sm" onClick={() => ctl.current?.view(v.id)} title={v.title}>{v.label}</button>)}
            {size ? (
              <>
                <span className="view3d-sep" />
                <button className={'btn sm' + (section ? ' active' : '')} onClick={() => setSection(section ? null : { axis: 'x', pos: Math.round(size.L / 2) })} title="Schnitt durch das Case: zeigt Wände, Schaum und Einbauten von innen">Schnitt</button>
                {section ? (
                  <>
                    <select className="sm" value={section.axis} onChange={(e) => { const axis = e.target.value as 'x' | 'y'; setSection({ axis, pos: Math.round((axis === 'x' ? size.L : size.W) / 2) }); }} title="Richtung des Schnitts">
                      <option value="x">quer zur Länge</option>
                      <option value="y">quer zur Breite</option>
                    </select>
                    <input type="range" className="view3d-range" min={0} max={Math.round(section.axis === 'x' ? size.L : size.W)} value={section.pos} onChange={(e) => setSection({ ...section, pos: Number(e.target.value) })} title="Lage des Schnitts verschieben" />
                    <span className="view3d-val">{`${section.pos} mm`}</span>
                  </>
                ) : null}
              </>
            ) : null}
            <span className="view3d-sep" />
            <button className={'btn sm' + (help ? ' active' : '')} onClick={() => setHelp(!help)} title="Tastenkürzel anzeigen (?)" aria-label="Tastenkürzel">?</button>
          </>
        ) : null}
      </div>
      {help ? <ShortcutHelp onClose={() => setHelp(false)} /> : null}
      {measure ? <MeasureReadout m={measure} /> : null}
      {menu && edit ? <ContextMenu menu={menu} c={c} edit={edit} close={() => setMenu(null)} fit={() => setFit(fit + 1)} openDrawers={openDrawers} toggleDrawer={toggleDrawer} /> : null}
      {hud ? <div className="view3d-hud" style={{ left: hud.x + 16, top: hud.y + 12 }}>{hud.text.split('\n').map((l, i) => <div key={i}>{l}</div>)}</div> : null}
      {hint ? <div className="view3d-hint">{hint}</div> : null}
    </Scene3D>
  );
}

/** what the editor reports to the overlay */
interface EditorUi { setHud: (h: Hud | null) => void; setMenu: (m: CtxMenu | null) => void; onMeasure: (pt: MeasurePt) => void; toggleDrawer: (i: number) => void }
interface CtxMenu { x: number; y: number; tag: Tag | null }

const SHORTCUTS: [string, string][] = [
  ['V', 'Auswählen'], ['H', 'Fuge waagrecht'], ['T', 'Fuge senkrecht (Tür)'], ['E', 'Fachboden setzen'], ['I', 'Messen'],
  ['F', 'Einpassen'], ['M', 'Maße ein/aus'], ['X', 'Schnitt ein/aus'], ['1 / 2 / 3 / 0', 'Vorne / Oben / Rechts / Iso'],
  ['Entf', 'Auswahl löschen'], ['Esc', 'Werkzeug beenden, Auswahl aufheben'], ['Strg+Z / Strg+Y', 'Rückgängig / Wiederholen'],
  ['Strg beim Ziehen', '1-mm-Schritte'], ['Alt beim Ziehen', 'ohne Einrasten'], ['Rechtsklick', 'Menü am Teil'], ['Rechts ziehen', 'Ansicht schwenken'],
];
function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="view3d-help" role="dialog" aria-label="Tastenkürzel">
      <div className="view3d-help-head"><b>Tastenkürzel</b><button className="icon-btn" onClick={onClose} aria-label="Schließen" title="Schließen (Esc)">✕</button></div>
      <table><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
    </div>
  );
}

/** result of the measure tool: distance, offsets along the axes, distance of parallel faces */
function MeasureReadout({ m }: { m: { a: MeasurePt; b?: MeasurePt } }) {
  if (!m.b) return <div className="view3d-measure">Messen: zweiten Punkt anklicken</div>;
  const [ax, ay, az] = m.a.p, [bx, by, bz] = m.b.p;
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), dz = Math.abs(bz - az);
  const d = Math.hypot(dx, dy, dz);
  const par = m.a.ax === m.b.ax ? (m.a.ax === 'x' ? dx : m.a.ax === 'y' ? dy : dz) : null;
  const r = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  return (
    <div className="view3d-measure">
      <div><b>{`Abstand ${r(d)} mm`}</b></div>
      <div>{`Länge ${r(dx)} mm, Höhe ${r(dy)} mm, Tiefe ${r(dz)} mm`}</div>
      {par !== null && par > 0.5 ? <div>{`Parallele Flächen: ${r(par)} mm`}</div> : null}
    </div>
  );
}

/** keys of every component that can be hidden (for "isolate") */
function allKeys(c: FlightCase): string[] {
  return [...caseBoxes(c).map((b) => `part:${b.id}`), ...c.hardware.map((h, i) => (h.kind.startsWith('castor') ? '' : `hw:${i}`)).filter(Boolean), ...c.dividers.map((_, i) => `div:${i}`), ...(c.drawers ?? []).map((_, i) => `drw:${i}`), ...(c.racks ?? []).map((_, i) => `rack:${i}`), 'foam'];
}

/** right-click menu on a part, a piece of hardware, a shelf or the empty view */
function ContextMenu({ menu, c, edit, close, fit, openDrawers, toggleDrawer }: { menu: CtxMenu; c: FlightCase; edit: CaseEdit; close: () => void; fit: () => void; openDrawers: Set<number>; toggleDrawer: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [close]);
  const set = (patch: Partial<FlightCase> | null) => { if (patch) useStore.getState().updateCase(c.id, patch); };
  const tag = menu.tag;
  const items: ([string, () => void, string?] | null)[] = [];
  const ro = edit.readOnly;
  let key: string | null = null;
  if (tag?.hw) {
    const { i, k } = tag.hw;
    key = `hw:${i}`;
    if (!ro) {
      items.push(['Stück löschen', () => { set(removeSelection(c, `hw:${i}:${k}`)); edit.select(null); }]);
      items.push(['Ganze Zeile löschen', () => { set(removeSelection(c, `hw:${i}`)); edit.select(null); }]);
      const mir = mirrorHardware(c, i);
      if (mir) items.push(['Auf Gegenseite spiegeln', () => { set({ hardware: mir }); edit.select(`hw:${mir.length - 1}`); }]);
      if (c.hardware[i]?.at) items.push(['Gleichmäßig verteilen', () => set({ hardware: c.hardware.map((x, j) => (j === i ? { ...x, at: undefined, count: x.at!.length } : x)) })]);
    }
  } else if (tag?.drw !== undefined) {
    const i = tag.drw;
    key = `drw:${i}`;
    items.push([openDrawers.has(i) ? 'Schublade schließen' : 'Schublade öffnen', () => toggleDrawer(i), 'Auch per Doppelklick']);
    if (!ro) {
      items.push(['Schublade löschen', () => { set(removeSelection(c, key!)); edit.select(null); }]);
      if ((c.drawers?.length ?? 0) > 1) items.push(['Alle gleich hoch', () => set({ drawers: spreadDrawers(c) }), 'Alle Schubladen gleich hoch, sie füllen das Unterteil']);
    }
  } else if (tag?.rack !== undefined) {
    const i = tag.rack;
    key = `rack:${i}`;
    if (!ro) items.push(['Rack entfernen', () => { set({ racks: (c.racks ?? []).filter((_, j) => j !== i) }); edit.select(null); }]);
  } else if (tag?.div !== undefined) {
    const i = tag.div;
    key = `div:${i}`;
    if (!ro) {
      items.push(['Einbau löschen', () => { set(removeSelection(c, key!)); edit.select(null); }]);
      const ax = c.dividers[i]?.axis;
      if (ax && c.dividers.filter((d) => d.axis === ax).length > 1) items.push(['Gleichmäßig verteilen', () => set({ dividers: spreadDividers(c, ax) })]);
    }
  } else if (tag?.part) {
    key = `part:${tag.part}`;
    if (!ro && tag.part !== 'base') items.push([tag.part.startsWith('door') ? 'Tür entfernen' : c.lidSplit ? 'Teilung aufheben' : 'Deckel entfernen', () => { set(removeSelection(c, key!)); edit.select(null); }]);
  }
  if (key) {
    const k = key;
    if (items.length) items.push(null);
    items.push(['Ausblenden', () => { const h = new Set(edit.hidden); h.add(k); edit.setHidden(h); if (edit.selected?.startsWith(k)) edit.select(null); }]);
    items.push(['Isolieren', () => edit.setHidden(new Set(allKeys(c).filter((x) => x !== k))), 'Nur dieses Teil zeigen, alle anderen ausblenden']);
  }
  if (items.length) items.push(null);
  if (edit.hidden.size) items.push(['Alle einblenden', () => edit.setHidden(new Set())]);
  items.push(['Einpassen', fit]);
  return (
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: menu.x, top: menu.y }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, n) => (it ? <button key={n} role="menuitem" title={it[2]} onClick={() => { it[1](); close(); }}>{it[0]}</button> : <hr key={n} />))}
    </div>
  );
}

/** readout of a shelf or wall: its position and the clear space on both sides */
function dividerText(c: FlightCase, i: number): string {
  const dv = c.dividers[i];
  const [a, b] = dividerGaps(c, i);
  const p = Math.round(dv.pos);
  if (dv.axis === 'z') return `Fachboden: ${p} mm über dem Boden\nfrei darunter ${a} mm, darüber ${b} mm`;
  if (dv.axis === 'x') return `Trennwand längs: ${p} mm von vorne\nfrei davor ${a} mm, dahinter ${b} mm`;
  return `Trennwand quer: ${p} mm von links\nfrei links ${a} mm, rechts ${b} mm`;
}

/** readout of a push/pull step: which size changes to what */
function pushPullText(c0: FlightCase, p: Partial<FlightCase>): string {
  const d = (a: number, b: number) => { const x = Math.round(b - a); return x > 0 ? `+${x}` : `${x}`; };
  const lines: string[] = [];
  if (p.inner) {
    if (p.inner.l !== c0.inner.l) lines.push(`Länge innen ${p.inner.l} mm (${d(c0.inner.l, p.inner.l)})`);
    if (p.inner.w !== c0.inner.w) lines.push(`Breite innen ${p.inner.w} mm (${d(c0.inner.w, p.inner.w)})`);
    if (p.inner.h !== c0.inner.h) lines.push(`Höhe innen ${p.inner.h} mm (${d(c0.inner.h, p.inner.h)})`);
  }
  if (p.lidH !== undefined && p.lidH !== c0.lidH) lines.push(`Deckelhöhe ${p.lidH} mm (${d(c0.lidH, p.lidH)})`);
  if (p.doors) for (const s of ['front', 'back', 'left', 'right'] as const) {
    const a = c0.doors?.[s] ?? 0, b = p.doors[s] ?? 0;
    if (a !== b) lines.push(`Tiefe ${SEAM_LABELS[s]}: ${b} mm (${d(a, b)})`);
  }
  return lines.join('\n') || 'unverändert';
}

type Tag = { grip?: { part: CasePartId; face: CaseFace }; hw?: { i: number; k: number }; div?: number; drw?: number; rack?: number; part?: CasePartId; group?: THREE.Object3D };
function tagOf(o: THREE.Object3D | null): Tag | null {
  for (let x = o; x; x = x.parent) {
    if (x.userData.grip) return { grip: x.userData.grip };
    if (x.userData.hw) return { hw: x.userData.hw };
    if (x.userData.divider !== undefined) return { div: x.userData.divider };
    if (x.userData.drawer !== undefined) return { drw: x.userData.drawer };
    if (x.userData.rack !== undefined) return { rack: x.userData.rack };
    if (x.userData.partGroup) return { part: x.userData.partGroup, group: x };
  }
  return null;
}

/**
 * Pointer handling of the case editor: picking, dragging hardware over its face, push/pull grips, split and
 * placement tools. Works on refs so the scene keeps one set of listeners while the case changes under it.
 */
function caseEditor(api: Scene3DApi, cRef: { current: FlightCase }, editRef: { current: CaseEdit | undefined }, openRef: { current: boolean }, ctl: { current: EditorCtl | null }, ui: { current: EditorUi }) {
  const { dom, camera, content, controls } = api;
  const setHud = (h: Hud | null) => ui.current.setHud(h);
  let rdown: { x: number; y: number } | null = null;
  const hudAt = (e: PointerEvent, text: string) => { const r = dom.getBoundingClientRect(); setHud({ x: e.clientX - r.left, y: e.clientY - r.top, text }); };

  // standard views: the camera swings around the current target, keeping its distance
  let anim = 0;
  const DIRS: Record<ViewName, THREE.Vector3> = { front: v3(0, 0, 1), top: v3(0, 1, 0.0015), right: v3(1, 0, 0), iso: v3(1, 0.85, 1.35) };
  ctl.current = {
    clip: api.clip,
    view: (v) => {
      cancelAnimationFrame(anim);
      const target = controls.target.clone();
      const from = camera.position.clone().sub(target);
      const dist = from.length();
      const to = DIRS[v].clone().normalize().multiplyScalar(dist);
      const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 350), e = k * k * (3 - 2 * k);
        const q = q0.clone().slerp(q1, e);
        camera.position.copy(target).add(from.clone().applyQuaternion(q));
        camera.lookAt(target);
        if (k < 1) anim = requestAnimationFrame(step);
      };
      step();
    },
  };

  // hover: a light frame around what a click would select
  let hoverKey = '';
  let hoverBox: THREE.Box3Helper | null = null;
  const setHover = (tag: Tag | null) => {
    const key = tag?.hw ? `hw:${tag.hw.i}:${tag.hw.k}` : tag?.div !== undefined ? `div:${tag.div}` : tag?.drw !== undefined ? `drw:${tag.drw}` : tag?.rack !== undefined ? `rack:${tag.rack}` : tag?.part ? `part:${tag.part}` : tag?.grip ? 'grip' : '';
    if (key === hoverKey && (!hoverBox || hoverBox.parent)) return;
    hoverKey = key;
    if (hoverBox) { hoverBox.removeFromParent(); hoverBox.geometry.dispose(); (hoverBox.material as THREE.Material).dispose(); hoverBox = null; }
    if (!key || key === 'grip' || key === editRef.current?.selected) return;
    const box = new THREE.Box3();
    content.traverse((o) => {
      const hw = o.userData.hw as { i: number; k: number } | undefined;
      if ((hw && key === `hw:${hw.i}:${hw.k}`) || (o.userData.part && key === `part:${o.userData.part}`) || (o.userData.divider !== undefined && key === `div:${o.userData.divider}`) || (o.userData.drawer !== undefined && key === `drw:${o.userData.drawer}`) || (o.userData.rack !== undefined && key === `rack:${o.userData.rack}`)) box.expandByObject(o);
    });
    if (box.isEmpty()) return;
    box.expandByScalar(0.002);
    hoverBox = new THREE.Box3Helper(box, new THREE.Color('#67e8f9'));
    const m = hoverBox.material as THREE.LineBasicMaterial;
    m.transparent = true; m.opacity = 0.5; m.userData.noClip = true;
    content.add(hoverBox);
  };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const setRay = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const hitsOf = (e: PointerEvent) => { setRay(e); return ray.intersectObject(content, true).filter((h) => h.object instanceof THREE.Mesh && h.object.visible); };
  /** the nearest tagged object under the pointer; grips win because they are drawn on top */
  const pick = (e: PointerEvent, only?: (t: Tag) => boolean) => {
    const hits = hitsOf(e);
    const grip = hits.find((h) => h.object.userData.grip);
    if (grip && !only) return { hit: grip, tag: { grip: grip.object.userData.grip } as Tag };
    for (const h of hits) {
      const tag = tagOf(h.object);
      if (tag && !tag.grip && (!only || only(tag))) return { hit: h, tag };
    }
    return null;
  };
  /** a hit on a shell -> outer coordinates and the outside face it lies on (null for inner faces) */
  const faceHit = (h: THREE.Intersection, group: THREE.Object3D) => {
    const c = cRef.current;
    const inv = group.matrixWorld.clone().invert();
    const p = h.point.clone().applyMatrix4(inv);
    if (!h.face) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const face: CaseFace = ay >= ax && ay >= az ? (n.y > 0 ? 'top' : 'bottom') : ax >= az ? (n.x > 0 ? 'right' : 'left') : n.z > 0 ? 'front' : 'back';
    const { L, W, H } = shellSize(c);
    const x = p.x + L / 2, y = W / 2 - p.z, z = p.y;
    const off = face === 'front' ? y : face === 'back' ? W - y : face === 'left' ? x : face === 'right' ? L - x : face === 'top' ? H - z : z;
    if (Math.abs(off) > 12) return null;
    return { face, x, y, z };
  };
  const update = (patch: Partial<FlightCase>, key: string) => useStore.getState().updateCase(cRef.current.id, patch, key);

  let drag: null | { kind: 'hw'; i: number; k: number; face: CaseFace } | { kind: 'drw'; i: number; c0: FlightCase; origin: THREE.Vector3; scale: number } | { kind: 'div'; i: number; c0: FlightCase; origin: THREE.Vector3; axis: THREE.Vector3; scale: number } | { kind: 'grip'; part: CasePartId; face: CaseFace; c0: FlightCase; origin: THREE.Vector3; axis: THREE.Vector3; scale: number } = null;
  let down: { x: number; y: number; id: number } | null = null;
  let moved = false;
  let pending: PointerEvent | null = null;
  let raf = 0;
  let nDrag = 0, key = '';

  const onDown = (e: PointerEvent) => {
    const ed = editRef.current;
    if (e.button === 2) { rdown = { x: e.clientX, y: e.clientY }; return; }
    if (!ed || e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved = false;
    if (ed.readOnly || ed.tool !== 'select') return;
    const p = pick(e);
    if (!p) return;
    if (p.tag.grip && !openRef.current) {
      const obj = p.hit.object.parent!;
      const origin = obj.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const scale = new THREE.Vector3().setFromMatrixScale(obj.parent!.matrixWorld).x;
      drag = { kind: 'grip', ...p.tag.grip, c0: cRef.current, origin, axis, scale };
    } else if (p.tag.hw) {
      const inst = hardwareInstances(cRef.current).find((x) => x.i === p.tag.hw!.i && x.k === p.tag.hw!.k);
      if (!inst) return;
      ed.select(`hw:${inst.i}:${inst.k}`);
      drag = { kind: 'hw', i: inst.i, k: inst.k, face: inst.face };
    } else if (p.tag.drw !== undefined && cRef.current.drawers?.[p.tag.drw]) {
      // drawer: dragging changes its front height (the drawers above move up)
      const i = p.tag.drw;
      ed.select(`drw:${i}`);
      drag = { kind: 'drw', i, c0: cRef.current, origin: p.hit.point.clone(), scale: new THREE.Vector3().setFromMatrixScale(p.hit.object.matrixWorld).x };
    } else if (p.tag.div !== undefined && cRef.current.dividers[p.tag.div]) {
      // shelves move up and down, walls across: along the matching axis of the base
      const i = p.tag.div, ax = cRef.current.dividers[i].axis;
      const obj = p.hit.object;
      const local = ax === 'z' ? v3(0, 1, 0) : ax === 'x' ? v3(0, 0, -1) : v3(1, 0, 0);
      const axis = local.applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const scale = new THREE.Vector3().setFromMatrixScale(obj.matrixWorld).x;
      ed.select(`div:${i}`);
      drag = { kind: 'div', i, c0: cRef.current, origin: p.hit.point.clone(), axis, scale };
    } else return;
    key = `drag:case:${cRef.current.id}:${Date.now()}:${++nDrag}`;
    controls.enabled = false;
    dom.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation();
  };

  /** distance along an axis through `origin` that is closest to the pointer ray (world units) */
  const alongAxis = (e: PointerEvent, origin: THREE.Vector3, a: THREE.Vector3) => {
    setRay(e);
    const w0 = origin.clone().sub(ray.ray.origin);
    const b = ray.ray.direction;
    const ab = a.dot(b), denom = 1 - ab * ab;
    return denom < 1e-4 ? null : (ab * w0.dot(b) - w0.dot(a)) / denom;
  };

  const applyDrag = (e: PointerEvent) => {
    const c = cRef.current;
    if (!drag) return;
    if (drag.kind === 'drw') {
      const s = alongAxis(e, drag.origin, v3(0, 1, 0));
      if (s === null) return;
      const h0 = drag.c0.drawers![drag.i].h;
      const drawers = setDrawerHeight(drag.c0, drag.i, h0 + s / drag.scale, e.ctrlKey || e.metaKey ? 1 : 5);
      update({ drawers }, key);
      const nc = { ...drag.c0, drawers };
      hudAt(e, `Schublade ${drag.i + 1}: Front ${drawers![drag.i].h} mm\nim Unterteil frei ${drawerFree(nc)} mm`);
      return;
    }
    if (drag.kind === 'div') {
      const s = alongAxis(e, drag.origin, drag.axis);
      if (s === null) return;
      const dv0 = drag.c0.dividers[drag.i];
      const r = moveDivider(drag.c0, drag.i, dv0.pos + s / drag.scale, e.ctrlKey || e.metaKey ? 1 : 5);
      update({ dividers: r.dividers }, key);
      hudAt(e, dividerText({ ...drag.c0, dividers: r.dividers }, drag.i) + (r.guide ? '\nauf der Mitte' : ''));
      return;
    }
    if (drag.kind === 'grip') {
      setRay(e);
      // closest point on the grip axis to the pointer ray
      const w0 = drag.origin.clone().sub(ray.ray.origin);
      const a = drag.axis, b = ray.ray.direction;
      const ab = a.dot(b), denom = 1 - ab * ab;
      if (denom < 1e-4) return;
      const s = (ab * w0.dot(b) - w0.dot(a)) / denom;
      const mm = s / drag.scale;
      const patch = pushPull(drag.c0, drag.part, drag.face, mm, e.ctrlKey || e.metaKey ? 1 : 5);
      update(patch, key);
      hudAt(e, pushPullText(drag.c0, patch));
      return;
    }
    const p = pick(e, (t) => !!t.part);
    if (!p?.tag.group) return;
    const f = faceHit(p.hit, p.tag.group);
    if (!f || f.face !== drag.face) return;
    const uv = outerToFace(c, f.face, f.x, f.y, f.z);
    const sn = e.altKey ? { u: uv.u, z: uv.z } : snapHardware(c, drag.i, drag.k, uv.u, uv.z, e.ctrlKey || e.metaKey ? 1 : 5);
    const { i, k } = drag;
    const hw = moveHardware(c, i, k, sn.u, sn.z);
    update({ hardware: hw }, key);
    const at = hardwareInstances({ ...c, hardware: hw }).find((x) => x.i === i && x.k === k);
    if (at) {
      const pos = drag.face === 'top' ? `${Math.round(at.u)} mm von links, ${Math.round(at.z)} mm von vorne` : `${Math.round(at.u)} mm von links, ${Math.round(at.z)} mm hoch`;
      const guide = 'guide' in sn && sn.guide ? (sn.guide === 'mitte' ? '\nauf der Mitte' : '\nsymmetrisch zum Gegenstück') : '';
      hudAt(e, pos + guide);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) moved = true;
    if (drag) {
      pending = e;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending) applyDrag(pending); pending = null; });
      return;
    }
    // hover feedback (cursor only)
    const ed = editRef.current;
    if (!ed || down || ed.readOnly) return;
    if (ed.tool !== 'select') { dom.style.cursor = 'crosshair'; return; }
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = pick(e);
      dom.style.cursor = p?.tag.grip && !openRef.current ? 'ns-resize' : p?.tag.hw ? 'grab' : '';
      setHover(p?.tag ?? null);
    });
  };

  const onUp = (e: PointerEvent) => {
    const ed = editRef.current;
    if (e.button === 2) {
      // right click without dragging (dragging pans): menu on what is under the pointer
      const was = rdown;
      rdown = null;
      if (!ed || !was || Math.hypot(e.clientX - was.x, e.clientY - was.y) > 5) return;
      const p = pick(e);
      const tag = p && !p.tag.grip ? p.tag : null;
      if (tag?.hw) ed.select(`hw:${tag.hw.i}:${tag.hw.k}`);
      else if (tag?.div !== undefined) ed.select(`div:${tag.div}`);
      else if (tag?.drw !== undefined) ed.select(`drw:${tag.drw}`);
      else if (tag?.rack !== undefined) ed.select(`rack:${tag.rack}`);
      else if (tag?.part) ed.select(`part:${tag.part}`);
      const r = dom.getBoundingClientRect();
      ui.current.setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, tag });
      return;
    }
    const wasDrag = drag;
    drag = null;
    if (wasDrag) { controls.enabled = true; setHud(null); try { dom.releasePointerCapture(e.pointerId); } catch { /* already released */ } }
    const click = down && !moved && e.button === 0;
    down = null;
    if (!ed || !click || wasDrag) return;
    const c = cRef.current;
    if (ed.tool === 'select') {
      const p = pick(e);
      if (!p) { ed.select(null); return; }
      if (p.tag.hw) ed.select(`hw:${p.tag.hw.i}:${p.tag.hw.k}`);
      else if (p.tag.div !== undefined) ed.select(`div:${p.tag.div}`);
      else if (p.tag.drw !== undefined) ed.select(`drw:${p.tag.drw}`);
      else if (p.tag.rack !== undefined) ed.select(`rack:${p.tag.rack}`);
      else if (p.tag.part) ed.select(`part:${p.tag.part}`);
      return;
    }
    if (ed.tool === 'measure') {
      // any surface of the model; overlays (markers, grips) are skipped
      const hit = hitsOf(e).find((h) => !h.object.userData.overlay && !h.object.userData.grip && !((h.object as THREE.Mesh).material as THREE.Material).userData?.noClip);
      const root = content.children[0];
      if (!hit || !root || !hit.face) return;
      const lp = root.worldToLocal(hit.point.clone());
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const ax = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 'x' : Math.abs(n.y) >= Math.abs(n.z) ? 'y' : 'z';
      ui.current.onMeasure({ p: [lp.x, lp.y, lp.z], ax });
      return;
    }
    if (ed.readOnly) return;
    const p = pick(e, (t) => !!t.part);
    if (!p?.tag.group) return;
    const f = faceHit(p.hit, p.tag.group);
    if (!f) return;
    if (ed.tool.startsWith('div:')) {
      const axis = ed.tool.slice(4) as DividerAxis;
      const t = wallOf(c);
      const pos = axis === 'z' ? (f.face !== 'top' ? f.z - t : null)
        : axis === 'x' ? (f.face === 'left' || f.face === 'right' || f.face === 'top' ? f.y - t : null)
        : f.face === 'front' || f.face === 'back' || f.face === 'top' ? f.x - t : null;
      if (pos === null) return;
      const dividers = addDivider(c, axis, pos);
      update({ dividers }, '');
      ed.select(`div:${dividers.length - 1}`);
      return;
    }
    if (ed.tool === 'seam-h' || ed.tool === 'seam-v') {
      const patch = splitAt(c, f.face, f.x, f.y, f.z, ed.tool === 'seam-v');
      if (patch) update(patch, '');
      return;
    }
    const kind = ed.tool.slice(6) as HardwareKind;
    const uv = outerToFace(c, f.face, f.x, f.y, f.z);
    const hw = placeHardware(c, kind, f.face, uv.u, uv.z);
    if (hw) { update({ hardware: hw }, ''); ed.select(`hw:${hw.length - 1}:0`); }
  };

  dom.addEventListener('pointerdown', onDown, { capture: true });
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  const onLeave = () => { if (!drag) setHover(null); };
  const onDbl = (e: MouseEvent) => {
    const p = pick(e as PointerEvent);
    if (p?.tag.drw !== undefined) ui.current.toggleDrawer(p.tag.drw);
  };
  dom.addEventListener('dblclick', onDbl);
  dom.addEventListener('pointerleave', onLeave);
  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(anim);
    ctl.current = null;
    dom.removeEventListener('pointerleave', onLeave);
    dom.removeEventListener('dblclick', onDbl);
    dom.removeEventListener('pointerdown', onDown, { capture: true });
    dom.removeEventListener('pointermove', onMove);
    dom.removeEventListener('pointerup', onUp);
  };
}

const ITEM_TONES = ['#26292e', '#33373d', '#1f2125', '#3b4047', '#2c3036', '#41464d'];

/** builds the model into `root` (mm) */
/** what the editor shows: hidden components ('part:base', 'hw:3', 'foam') and the selection (outlined) */
/** a measured point: model coordinates (mm, scene axes) and the axis of the face it lies on */
export interface MeasurePt { p: [number, number, number]; ax: 'x' | 'y' | 'z' }
export interface CaseView { hidden?: Set<string>; selected?: string | null; /** outer chain dimensions */ dims?: boolean; measure?: { a: MeasurePt; b?: MeasurePt }; /** drawers pulled out (editor) */ openDrawers?: Set<number>; /** project whose racks fill the case racks (device fronts) */ project?: Project }

export function buildCase(root: THREE.Group, c: FlightCase, open: boolean, view?: CaseView): BuildResult {
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
    g.userData.partGroup = bx.id;
    if (view?.hidden?.has(`part:${bx.id}`)) continue;
    const sh = B.shell(g, { ...shellOpts, size: [bx.x1 - bx.x0, bx.z1 - bx.z0, bx.y1 - bx.y0], open: bx.open.map((f) => FK[f]), closing: bx.closing.map((f) => FK[f]) });
    sh.position.copy(P((bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, (bx.z0 + bx.z1) / 2));
    sh.userData.part = bx.id;
  }
  const base = groups.get('base')!;
  root.add(base);
  const baseBox = boxes[0];
  const drawers = c.drawers ?? [];
  const foamOn = !view?.hidden?.has('foam') && hasCaseFoam(c);
  if (drawers.length) buildDrawers(base, c, t, open, B, view);
  else if (foamOn) addFoam(base, c, 'body', t, d.bodyInner, B, false);
  // 19" racks: rails and the devices of the linked project rack
  (c.racks ?? []).forEach((r, ri) => {
    if (view?.hidden?.has(`rack:${ri}`)) return;
    const toScene = (b: InnerBox, geoMat: THREE.Material | THREE.Material[]) => {
      const m = new THREE.Mesh(boxGeo(b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0), geoMat);
      m.position.copy(P(t + (b.x0 + b.x1) / 2, t + (b.y0 + b.y1) / 2, t + (b.z0 + b.z1) / 2));
      m.userData.rack = ri;
      base.add(m);
      return m;
    };
    for (const b of rackRails(c, r)) toScene(b, mats.alu);
    for (const d of rackDevices(c, r, view?.project)) {
      const body = new THREE.MeshStandardMaterial({ color: d.tpl.color, roughness: 0.6, metalness: 0.3 });
      toScene(d.body, body);
      const plateMat = new THREE.MeshStandardMaterial({ color: d.tpl.frontColor ?? d.tpl.color, roughness: 0.55 });
      // material slots of a box: +x, -x, +y, -y, +z, -z; the front looks out of the rack
      const out = r.face === 'top' ? (d.facing === 'front' ? 2 : 3) : (r.face === 'front') === (d.facing === 'front') ? 4 : 5;
      const matsArr = [body, body, body, body, body, body] as THREE.Material[];
      matsArr[out] = plateMat;
      toScene(d.plate, matsArr);
      if (view?.project) deviceTexture(view.project, d, (tex) => { plateMat.map = tex; plateMat.color.set('#ffffff'); plateMat.needsUpdate = true; });
    }
  });
  // shelves and walls: own objects so the editor can pick and drag them
  {
    const bi = baseInner(c);
    const il = bi.x1 - bi.x0, iw = bi.y1 - bi.y0;
    const cx = P(t + (bi.x0 + bi.x1) / 2, 0, 0).x, cz = P(0, t + (bi.y0 + bi.y1) / 2, 0).z;
    c.dividers.forEach((dv, i) => {
      if (view?.hidden?.has(`div:${i}`)) return;
      const m = dv.axis === 'x' ? B.add(base, boxGeo(il, d.bodyInner, DIVIDER_T), mats.ply, cx, t + d.bodyInner / 2, P(0, t + dv.pos, 0).z)
        : dv.axis === 'y' ? B.add(base, boxGeo(DIVIDER_T, d.bodyInner, iw), mats.ply, P(t + dv.pos, 0, 0).x, t + d.bodyInner / 2, cz)
        : B.add(base, boxGeo(il, DIVIDER_T, iw), mats.ply, cx, t + dv.pos, cz);
      m.userData.divider = i;
    });
  }
  const lidBox = boxes.find((b) => b.id === 'lid');
  if (lidBox && foamOn) {
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
  const frameAt = (g: THREE.Object3D, face: CaseFace, pt: [number, number, number], vDir?: THREE.Vector3) => {
    const { n, u, v } = faceBasis(face);
    const vv = vDir ?? v;
    const uu = vDir ? vv.clone().cross(n) : u;
    return B.frame(g, P(...pt), uu, vv);
  };
  const Hc = d.H - y0;
  const zs = lidBox ? lidBox.z0 : Hc;
  for (const it of hardwareInstances(c)) {
    if (view?.hidden?.has(`hw:${it.i}`)) continue;
    const tag = <T extends THREE.Object3D>(g: T) => { g.userData.hw = { i: it.i, k: it.k }; return g; };
    const pt = faceToOuter(c, it.face, it.u, it.z);
    const s = it.kind === 'butterfly' ? 1 : it.kind === 'draw-latch' ? 0.6 : 0.7;
    if (it.kind === 'stack-cup') { B.stackCup(tag(B.frame(groupAt(...pt), P(...pt), v3(1, 0, 0), v3(0, 0, -1)))); continue; }
    const latch = it.kind === 'butterfly' || it.kind === 'butterfly-small' || it.kind === 'draw-latch';
    if (it.seam && it.seam !== 'lid') {
      const door = boxes.find((b) => b.role === 'door' && b.side === it.seam);
      if (!door) continue;
      const sm = it.seam;
      const toDoor = sm === 'front' ? v3(0, 0, 1) : sm === 'back' ? v3(0, 0, -1) : sm === 'left' ? v3(-1, 0, 0) : v3(1, 0, 0);
      if (it.kind === 'piano-hinge' && it.face !== 'top') {
        // piano hinge along the whole door seam
        const a = faceToOuter(c, it.face, it.u, door.z0 + 30), b = faceToOuter(c, it.face, it.u, door.z1 - 30);
        tag(B.rod(groupAt(...a), P(...a), P(...b), 4.5, mats.chrome, 14));
        continue;
      }
      if (latch) {
        const bodyPt: [number, number, number] = [pt[0] - toDoor.x * 30, pt[1] + toDoor.z * 30, pt[2] - (it.face === 'top' ? 1 : 0)];
        B.butterflyLatch(tag(frameAt(groupAt(...bodyPt), it.face, pt, toDoor)), s);
        B.latchKeeper(tag(frameAt(groups.get(door.id)!, it.face, pt, toDoor)), s);
      } else B.add(tag(frameAt(groups.get(door.id)!, it.face, pt, toDoor)), boxGeo(60, 44, 3), mats.chrome, 0, 0, 1.5);
      continue;
    }
    if (it.seam === 'lid') {
      const below = groupAt(pt[0], pt[1], zs - 30), above = groupAt(pt[0], pt[1], zs + 30);
      if (it.kind === 'piano-hinge') {
        const a = faceToOuter(c, it.face, it.u - 150, zs), b = faceToOuter(c, it.face, it.u + 150, zs);
        tag(B.rod(below, P(...a), P(...b), 4.5, mats.chrome, 14));
      } else if (it.kind === 'hinge') {
        const gb = tag(frameAt(below, it.face, pt)), ga = tag(frameAt(above, it.face, pt));
        B.add(gb, boxGeo(60, 22, 3), mats.chrome, 0, -11 - closeH, 1.5);
        B.add(gb, new THREE.CylinderGeometry(4.2, 4.2, 60, 14), mats.chrome, 0, 0, 6).rotation.z = Math.PI / 2;
        B.add(ga, boxGeo(60, 22, 3), mats.chrome, 0, 11 + closeH, 1.5);
      } else {
        B.butterflyLatch(tag(frameAt(below, it.face, [pt[0], pt[1], zs - closeH - 2])), s);
        B.latchKeeper(tag(frameAt(above, it.face, [pt[0], pt[1], zs + closeH + 2])), s);
      }
      continue;
    }
    // handles, labels, dishes: in the shell under the point
    const inside: [number, number, number] = it.face === 'top' ? [pt[0], pt[1], pt[2] - 1] : pt;
    const g = groupAt(...inside);
    const fr = tag(it.face === 'top' ? B.frame(g, P(...pt), v3(1, 0, 0), v3(0, 0, -1)) : frameAt(g, it.face, pt));
    if (it.kind === 'handle-recessed') B.recessedHandle(fr);
    else if (it.kind === 'handle-strap' || it.kind === 'handle-surface') B.strapHandle(fr);
    else if (it.kind === 'label') B.labelHolder(fr);
    else B.dish(fr, it.kind);
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
    addDoorShelves(g, c, bx, t, B, P);
    const hinge = bx.side && c.doorHinge?.[bx.side];
    if (open && hinge) {
      // swing door: turns about its hinge line at the seam to the body (piano hinge), outwards
      const seamY = bx.side === 'front' ? bx.y1 : bx.side === 'back' ? bx.y0 : 0;
      const seamX = bx.side === 'left' ? bx.x1 : bx.side === 'right' ? bx.x0 : 0;
      let px = 0, py = 0, pz = 0;
      let axis = v3(0, 1, 0);
      const front = bx.side === 'front' || bx.side === 'back';
      if (hinge === 'top' || hinge === 'bottom') {
        pz = hinge === 'top' ? bx.z1 : bx.z0;
        axis = front ? v3(1, 0, 0) : v3(0, 0, 1);
        if (front) { px = L / 2; py = seamY; } else { px = seamX; py = W / 2; }
      } else {
        const face = hingeFace(bx.side!, hinge);
        if (front) { px = face === 'left' ? 0 : L; py = seamY; } else { px = seamX; py = face === 'back' ? W : 0; }
      }
      const pivot = new THREE.Group();
      pivot.position.copy(P(px, py, pz)).setY(y0 + pz);
      g.position.set(-pivot.position.x, y0 - pivot.position.y, -pivot.position.z);
      pivot.add(g);
      // pick the turning direction that moves the door away from the body
      const centre = P((bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, (bx.z0 + bx.z1) / 2).setY(y0 + (bx.z0 + bx.z1) / 2);
      const rel = centre.clone().sub(pivot.position);
      const ang = hinge === 'bottom' ? 1.45 : 1.75;
      const away = (a: number) => rel.clone().applyAxisAngle(axis, a).add(pivot.position).sub(v3(0, y0 + (bx.z0 + bx.z1) / 2, 0)).length();
      pivot.quaternion.setFromAxisAngle(axis, away(ang) >= away(-ang) ? ang : -ang);
      root.add(pivot);
      continue;
    }
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
  // selection: outline of the selected shell or hardware piece, push/pull grips on a selected shell
  if (view?.selected) {
    root.updateMatrixWorld(true);
    const sel = view.selected;
    const hits: THREE.Object3D[] = [];
    root.traverse((o) => {
      const hw = o.userData.hw as { i: number; k: number } | undefined;
      if (hw && (sel === `hw:${hw.i}` || sel === `hw:${hw.i}:${hw.k}`)) hits.push(o);
      if (o.userData.part && sel === `part:${o.userData.part}`) hits.push(o);
      if (o.userData.divider !== undefined && sel === `div:${o.userData.divider}`) hits.push(o);
      if (o.userData.drawer !== undefined && sel === `drw:${o.userData.drawer}`) hits.push(o);
      if (o.userData.rack !== undefined && sel === `rack:${o.userData.rack}`) hits.push(o);
    });
    if (hits.length) {
      const box = new THREE.Box3();
      for (const o of hits) box.expandByObject(o);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      box.applyMatrix4(inv);
      box.expandByScalar(4);
      const helper = new THREE.Box3Helper(box, new THREE.Color('#22d3ee'));
      helper.userData.overlay = true;
      (helper.material as THREE.Material).userData.noClip = true;
      root.add(helper);
    }
    const part = sel.startsWith('part:') ? boxes.find((b) => `part:${b.id}` === sel) : null;
    if (part && !open) {
      const gripMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', depthTest: false, transparent: true, opacity: 0.95 });
      gripMat.userData.noClip = true;
      const faces: [CaseFace, THREE.Vector3, [number, number, number]][] = [
        ['top', v3(0, 1, 0), [(part.x0 + part.x1) / 2, (part.y0 + part.y1) / 2, part.z1]],
        ['front', v3(0, 0, 1), [(part.x0 + part.x1) / 2, part.y0, (part.z0 + part.z1) / 2]],
        ['back', v3(0, 0, -1), [(part.x0 + part.x1) / 2, part.y1, (part.z0 + part.z1) / 2]],
        ['left', v3(-1, 0, 0), [part.x0, (part.y0 + part.y1) / 2, (part.z0 + part.z1) / 2]],
        ['right', v3(1, 0, 0), [part.x1, (part.y0 + part.y1) / 2, (part.z0 + part.z1) / 2]],
      ];
      if (part.role === 'lid') faces.push(['bottom', v3(0, -1, 0), [(part.x0 + part.x1) / 2, (part.y0 + part.y1) / 2, part.z0]]);
      for (const [face, n, at] of faces) {
        const g = new THREE.Group();
        g.position.copy(P(...at)).add(n.clone().multiplyScalar(45)).setY(P(...at).y + y0 + n.y * 45);
        g.quaternion.setFromUnitVectors(v3(0, 1, 0), n);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(14, 34, 20), gripMat);
        cone.position.y = 17;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 10), gripMat);
        stem.position.y = -12;
        for (const m of [cone, stem]) { m.renderOrder = 10; m.userData.grip = { part: part.id, face }; g.add(m); }
        g.userData.overlay = true;
        root.add(g);
      }
    }
  }
  // interference check: red frames around pieces that overlap or reach over an edge or seam
  if (view) {
    const bad = new Set(hardwareClashes(c).flatMap((x) => x.keys));
    if (bad.size) {
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const boxes = new Map<string, THREE.Box3>();
      root.traverse((o) => {
        const hw = o.userData.hw as { i: number; k: number } | undefined;
        const key = hw && `hw:${hw.i}:${hw.k}`;
        if (!key || !bad.has(key)) return;
        if (!boxes.has(key)) boxes.set(key, new THREE.Box3());
        boxes.get(key)!.expandByObject(o);
      });
      for (const b of boxes.values()) {
        b.applyMatrix4(inv).expandByScalar(3);
        const hlp = new THREE.Box3Helper(b, new THREE.Color('#ef4444'));
        hlp.userData.overlay = true;
        (hlp.material as THREE.Material).userData.noClip = true;
        (hlp.material as THREE.Material).depthTest = false;
        hlp.renderOrder = 19;
        root.add(hlp);
      }
    }
  }
  if (view?.dims) addOuterDims(root, c, y0);
  if (view?.measure) addMeasure(root, view.measure);
  const selDiv = /^div:(\d+)$/.exec(view?.selected ?? '');
  if (selDiv && c.dividers[Number(selDiv[1])]) addDividerDims(base, c, Number(selDiv[1]), t, P);
  B.finish();
  // set-aside doors widen the scene
  const dd = boxes.filter((b) => b.role === 'door');
  const wide = open && dd.length ? { x: dd.some((b) => b.side === 'front' || b.side === 'back') ? 3 * L + 320 : L, z: dd.some((b) => b.side === 'left' || b.side === 'right') ? 3 * W + 320 : W } : { x: L, z: W };
  return { size: { x: wide.x, y: d.H, z: wide.z }, zShift };
}

/** drawers on slides inside the base, stacked from the inner bottom (pulled out a little when the case is open) */
function buildDrawers(parent: THREE.Object3D, c: FlightCase, t: number, open: boolean, B: Builder, view?: CaseView) {
  const mats = B.mats;
  const bi = baseInner(c);
  const X = (x: number) => -c.inner.l / 2 + x, Z = (y: number) => c.inner.w / 2 - y;
  const wIn = bi.x1 - bi.x0, depth = bi.y1 - bi.y0 - 15;
  let z = t;
  (c.drawers ?? []).forEach((dr, i) => {
    const g = new THREE.Group();
    g.position.set(X((bi.x0 + bi.x1) / 2), z, Z(bi.y0));
    // the editor opens drawers one by one; the plain viewer pulls out the top one when the case is open
    const pulled = view?.openDrawers ? view.openDrawers.has(i) : open && i === (c.drawers ?? []).length - 1;
    if (pulled) g.position.z += depth * 0.55;
    g.userData.drawer = i;
    if (view?.hidden?.has(`drw:${i}`)) { z += dr.h; return; }
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
export function addFoam(parent: THREE.Object3D, c: FlightCase, layer: CaseItem['layer'], floor: number, space: number, B: Builder, dividers = true) {
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
  if (!lidMode && dividers) for (const dv of c.dividers) {
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

// ------------------------------------------------------------------ dimension lines

const DIM_INK = '#e6e8eb';
/** a text label that always faces the camera (mm, `h` = text height) */
function dimLabel(text: string, h = 30): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  cv.width = w; cv.height = 64;
  ctx.font = font;
  ctx.fillStyle = 'rgba(13, 15, 18, 0.88)';
  ctx.beginPath(); ctx.roundRect(0, 4, w, 56, 8); ctx.fill();
  ctx.fillStyle = DIM_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 33);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  m.userData.ownMap = true; m.userData.noClip = true;
  const s = new THREE.Sprite(m);
  s.scale.set((h * w) / 64, h, 1);
  s.renderOrder = 21;
  s.userData.overlay = true;
  return s;
}

/**
 * One dimension chain: `pts` are positions along the chain (mm), `at(s)` the point on the body, `off` the offset of
 * the dimension line from the body. Draws extension lines, the line with slashes at the break points and the texts.
 */
function dimChain(parent: THREE.Object3D, pts: number[], at: (s: number) => THREE.Vector3, off: THREE.Vector3, gapExt = 10) {
  if (pts.length < 2) return;
  const v: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3) => v.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const n = off.lengthSq() > 0 ? off.clone().normalize() : new THREE.Vector3();
  const dir = at(pts[pts.length - 1]).sub(at(pts[0])).normalize();
  const slash = dir.clone().add(n.lengthSq() ? n : new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(9);
  for (const s of pts) {
    const p = at(s), q = p.clone().add(off);
    if (off.lengthSq() > 0) push(p.clone().addScaledVector(n, gapExt), q.clone().addScaledVector(n, 12));
    push(q.clone().sub(slash), q.clone().add(slash));
  }
  for (let k = 0; k < pts.length - 1; k++) {
    const a = at(pts[k]).add(off), b = at(pts[k + 1]).add(off);
    push(a, b);
    const len = pts[k + 1] - pts[k];
    if (len < 20) continue;
    const lab = dimLabel(String(Math.round(len)), Math.min(30, Math.max(16, len / 6)));
    if (lab) { lab.position.copy(a).add(b).multiplyScalar(0.5); parent.add(lab); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const m = new THREE.LineBasicMaterial({ color: DIM_INK, depthTest: false, transparent: true, opacity: 0.9 });
  m.userData.noClip = true;
  const lines = new THREE.LineSegments(g, m);
  lines.renderOrder = 20;
  lines.userData.overlay = true;
  parent.add(lines);
}

/** outer chain dimensions: length along the front bottom edge, width along the right bottom edge, height at the front right edge */
function addOuterDims(root: THREE.Object3D, c: FlightCase, y0: number) {
  const ch = dimChains(c);
  const L = ch.L[ch.L.length - 1], W = ch.W[ch.W.length - 1];
  const g = new THREE.Group();
  g.userData.overlay = true;
  const lenAt = (s: number) => v3(s - L / 2, y0, W / 2);
  const widAt = (s: number) => v3(L / 2, y0, W / 2 - s);
  const hgtAt = (s: number) => v3(L / 2, s, W / 2);
  dimChain(g, ch.L, lenAt, v3(0, 0, 90));
  if (ch.L.length > 2) dimChain(g, [0, L], lenAt, v3(0, 0, 160));
  dimChain(g, ch.W, widAt, v3(90, 0, 0));
  if (ch.W.length > 2) dimChain(g, [0, W], widAt, v3(160, 0, 0));
  const diag = v3(1, 0, 1).normalize();
  dimChain(g, ch.H, hgtAt, diag.clone().multiplyScalar(90));
  if (ch.H.length > 2) dimChain(g, [0, ch.H[ch.H.length - 1]], hgtAt, diag.clone().multiplyScalar(160));
  root.add(g);
}

/** clear spaces on both sides of the selected shelf or wall, drawn inside the base */
function addDividerDims(base: THREE.Object3D, c: FlightCase, i: number, t: number, P: (x: number, y: number, z: number) => THREE.Vector3) {
  const dv = c.dividers[i];
  const [g0, g1] = dividerGaps(c, i);
  const lo = dv.pos - DIVIDER_T / 2 - g0, hi = dv.pos + DIVIDER_T / 2 + g1;
  const bi = baseInner(c);
  const midX = t + (bi.x0 + bi.x1) / 2, midY = t + (bi.y0 + bi.y1) / 2, top = t + caseDims(c).bodyInner;
  const at = dv.axis === 'z' ? (s: number) => P(t + bi.x0 + 60, t + bi.y0 + 40, t + s)
    : dv.axis === 'x' ? (s: number) => P(midX, t + s, top - 15)
    : (s: number) => P(t + s, midY, top - 15);
  const g = new THREE.Group();
  g.userData.overlay = true;
  dimChain(g, [lo, dv.pos - DIVIDER_T / 2], at, v3(0, 0, 0));
  dimChain(g, [dv.pos + DIVIDER_T / 2, hi], at, v3(0, 0, 0));
  base.add(g);
}

/** measure tool: markers at the picked points and the line between them with its length */
function addMeasure(root: THREE.Object3D, m: { a: MeasurePt; b?: MeasurePt }) {
  const g = new THREE.Group();
  g.userData.overlay = true;
  const mat = new THREE.MeshBasicMaterial({ color: '#22d3ee', depthTest: false, transparent: true });
  mat.userData.noClip = true;
  const pts = [m.a, m.b].filter(Boolean) as MeasurePt[];
  for (const p of pts) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), mat);
    s.position.set(...p.p);
    s.renderOrder = 22;
    s.userData.overlay = true;
    g.add(s);
  }
  if (m.b) {
    const a = new THREE.Vector3(...m.a.p), b = new THREE.Vector3(...m.b.p);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const lm = new THREE.LineBasicMaterial({ color: '#22d3ee', depthTest: false, transparent: true });
    lm.userData.noClip = true;
    const line = new THREE.Line(geo, lm);
    line.renderOrder = 22;
    g.add(line);
    const lab = dimLabel(String(Math.round(a.distanceTo(b))), 28);
    if (lab) { lab.position.copy(a).add(b).multiplyScalar(0.5); g.add(lab); }
  }
  root.add(g);
}

// ------------------------------------------------------------------ doors with storage, device fronts

/** shelves with lips inside a door (storage in the door) */
function addDoorShelves(g: THREE.Object3D, c: FlightCase, bx: { side?: 'front' | 'back' | 'left' | 'right'; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, t: number, B: Builder, P: (x: number, y: number, z: number) => THREE.Vector3) {
  const list = bx.side ? c.doorShelves?.[bx.side] : undefined;
  if (!list?.length) return;
  const p = c.panel;
  const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    if (x1 - x0 < 1 || y1 - y0 < 1 || z1 - z0 < 1) return;
    B.add(g, boxGeo(x1 - x0, z1 - z0, y1 - y0), B.mats.ply, P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).x, (z0 + z1) / 2, P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).z);
  };
  const s = bx.side!;
  // inner space of the door box and the open side towards the body (where the lips stand)
  const ix0 = bx.x0 + (s === 'right' ? 0 : t), ix1 = bx.x1 - (s === 'left' ? 0 : t);
  const iy0 = bx.y0 + (s === 'back' ? 0 : t), iy1 = bx.y1 - (s === 'front' ? 0 : t);
  const iz0 = bx.z0 + t, iz1 = bx.z1 - t;
  for (const sh of list) {
    const z = iz0 + sh.pos;
    if (z >= iz1) continue;
    if (sh.pos > 0) add(s === 'right' ? bx.x0 : ix0, s === 'left' ? bx.x1 : ix1, s === 'back' ? bx.y0 : iy0, s === 'front' ? bx.y1 : iy1, z, z + p);
    const lz0 = sh.pos > 0 ? z + p : z, lz1 = Math.min(iz1, z + (sh.pos > 0 ? p : 0) + sh.lip);
    if (s === 'front') add(ix0, ix1, bx.y1 - p, bx.y1, lz0, lz1);
    else if (s === 'back') add(ix0, ix1, bx.y0, bx.y0 + p, lz0, lz1);
    else if (s === 'left') add(bx.x1 - p, bx.x1, iy0, iy1, lz0, lz1);
    else add(bx.x0, bx.x0 + p, iy0, iy1, lz0, lz1);
  }
}

/** device front textures, cached by drawing */
const DEVICE_TEX = new Map<string, Promise<THREE.Texture>>();
function deviceTexture(project: Project, d: RackDeviceBox, done: (t: THREE.Texture) => void) {
  const w = (d.plate.x1 - d.plate.x0) || (d.plate.y1 - d.plate.y0);
  const width = Math.max(w, 10);
  const h = d.tpl.heightU * 44.45 - 0.8;
  const panel = d.pd.reversed ? (d.facing === 'front' ? 'rear' : 'front') : d.facing === 'front' ? 'front' : 'rear';
  const markup = renderToStaticMarkup(<DeviceFace tpl={d.tpl} panel={panel} width={width} device={d.pd} showPortLabels={project.settings.showPortLabels} />);
  const key = `${width}x${h}|${markup}`;
  let p = DEVICE_TEX.get(key);
  if (!p) { p = panelTexture(markup, width, h); DEVICE_TEX.set(key, p); }
  p.then(done).catch(() => { /* drawing failed: the plate keeps its colour */ });
}
