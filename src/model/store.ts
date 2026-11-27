import { create } from 'zustand';
import { devicePorts } from './modules';
import type { CustomCable, Cable, CableEnd, CableType, CaseItem, DeviceTemplate, Face, FlightCase, PlacedBox, PlacedDevice, Project, ProjectSettings, Rack, RackType } from './types';
import { deepClone, uid } from './util';
import { connectorDef } from './connectors';
import { DEFAULT_CABLE_TYPES } from '../library/cableTypes';
import { BUILTIN_DEVICES } from '../library/devices';
import { BUILTIN_RACK_TYPES } from '../library/rackTypes';
import { checkPlacement, findFreeSpot } from './geometry';
import type { RfImport } from '../integration/rf';

export type ViewMode = 'front' | 'rear' | 'both' | '3d';
/** workspaces: rack loading + cabling, rack case design, flight case design, foam inlays */
export type AppMode = 'racks' | 'cables' | 'rackbuild' | 'cases' | 'inlays';
export type NavMode = 'select' | 'orbit' | 'pan' | 'zoom';
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

export type Selection =
  | { kind: 'device'; id: string }
  | { kind: 'cable'; id: string }
  | { kind: 'box'; id: string }
  | { kind: 'caseItem'; id: string }
  | null;

export type Modal =
  | null
  | { kind: 'device'; templateId?: string }
  | { kind: 'rackTypes' }
  | { kind: 'cableTypes' }
  | { kind: 'panel'; templateId?: string }
  | { kind: 'box'; templateId?: string }
  /** global settings; tab = topic to open (see SettingsDialog) */
  | { kind: 'drawerPicker' }
  | { kind: 'settings'; tab?: 'view' | 'cables' | 'racks' | 'inlays' | 'library' | 'export' | 'project' }
  | { kind: 'export' }
  | { kind: 'rfImport'; data: RfImport };

export const DEFAULT_SETTINGS: ProjectSettings = {
  slackPercent: 15,
  serviceLoop: 150,
  exitLength: 40,
  roundToStock: true,
  curveStyle: 'orthogonal',
  showPortLabels: true,
  showCableLabels: true,
  cableLabel: 'length',
};

/** Bump when built-in templates change in a way that existing projects should pick up. */
export const LIBRARY_VERSION = 7;

/** Info about the last automatic library update (for a notice in the UI). */
export const libraryUpdate = { updated: 0, droppedCables: 0 };

export function emptyProject(name = 'Neues Projekt'): Project {
  const now = new Date().toISOString();
  const type = deepClone(BUILTIN_RACK_TYPES.find((t) => t.id === 'shock-8u-450')!);
  return {
    version: 1,
    id: uid('prj-'),
    name,
    createdAt: now,
    updatedAt: now,
    racks: [{ id: uid('rack-'), name: 'Rack 1', type, devices: [], cables: [] }],
    templates: {},
    cableTypes: deepClone(DEFAULT_CABLE_TYPES),
    rackTypes: [],
    settings: { ...DEFAULT_SETTINGS },
    libraryVersion: LIBRARY_VERSION,
  };
}

/** Bring older/foreign project files up to date and make sure all references resolve. */
export function normalizeProject(p: Project): Project {
  const proj = deepClone(p);
  proj.settings = { ...DEFAULT_SETTINGS, ...(proj.settings || {}) };
  proj.templates = proj.templates || {};
  proj.rackTypes = proj.rackTypes || [];
  proj.cases = proj.cases || [];
  proj.cableTypes = proj.cableTypes?.length ? proj.cableTypes : deepClone(DEFAULT_CABLE_TYPES);
  // refresh copies of built-in templates from an older library; cables are re-attached by port name
  if ((proj.libraryVersion ?? 1) < LIBRARY_VERSION) {
    for (const [id, t] of Object.entries(proj.templates)) {
      const b = BUILTIN_DEVICES.find((x) => x.id === id);
      if (!b || t.custom) continue;
      const newIdByName = new Map(b.ports.map((pt) => [pt.name, pt.id]));
      const oldNameById = new Map(t.ports.map((pt) => [pt.id, pt.name]));
      for (const r of proj.racks || []) {
        r.cables = (r.cables || []).filter((c) => {
          for (const e of [c.a, c.b]) {
            const d = (r.devices || []).find((x) => x.id === e.deviceId);
            if (!d || d.templateId !== id) continue;
            // ports of fitted modules are rebuilt from the module choice and keep their ids
            if (/^m\d+\./.test(e.portId)) continue;
            const nid = newIdByName.get(oldNameById.get(e.portId) ?? '');
            if (!nid) { libraryUpdate.droppedCables++; return false; }
            e.portId = nid;
          }
          return true;
        });
      }
      proj.templates[id] = deepClone(b);
      libraryUpdate.updated++;
    }
    // v3: schematic orthogonal cable routing became the default
    if ((p.libraryVersion ?? 1) < 3 && proj.settings.curveStyle === 'curved') proj.settings.curveStyle = 'orthogonal';
    proj.libraryVersion = LIBRARY_VERSION;
  }
  for (const r of proj.racks) {
    r.cables = r.cables || [];
    r.devices = r.devices || [];
    for (const d of r.devices) {
      if (!proj.templates[d.templateId]) {
        const b = BUILTIN_DEVICES.find((t) => t.id === d.templateId);
        if (b) proj.templates[b.id] = deepClone(b);
      }
    }
  }
  return proj;
}

export function allTemplates(project: Project): DeviceTemplate[] {
  const map = new Map<string, DeviceTemplate>();
  for (const t of BUILTIN_DEVICES) map.set(t.id, t);
  for (const t of Object.values(project.templates)) map.set(t.id, t);
  return [...map.values()];
}

export function allRackTypes(project: Project): RackType[] {
  return [...BUILTIN_RACK_TYPES, ...project.rackTypes];
}

export function suggestCableType(project: Project, connA: string, connB: string): CableType {
  const types = project.cableTypes;
  const byConn = types.find((t) => t.connectors?.includes(connA) && t.connectors?.includes(connB))
    ?? types.find((t) => t.connectors?.includes(connA) || t.connectors?.includes(connB));
  if (byConn) return byConn;
  const sig = connectorDef(connA).signal;
  return types.find((t) => t.signal === sig) ?? types[types.length - 1];
}

/** a Y cable with a single remaining leg becomes a normal cable again; legs are renumbered a, b, c … */
function tidyYGroups(r: Rack) {
  const groups = new Map<string, Cable[]>();
  for (const c of r.cables) if (c.yGroup) { if (!groups.has(c.yGroup)) groups.set(c.yGroup, []); groups.get(c.yGroup)!.push(c); }
  for (const legs of groups.values()) {
    if (legs.length === 1) { delete legs[0].yGroup; delete legs[0].yLeg; continue; }
    legs.sort((x, y) => (x.yLeg ?? 0) - (y.yLeg ?? 0)).forEach((c, i) => { c.yLeg = i + 1; });
  }
}

function nextCableNumber(project: Project): number {
  let max = 0;
  for (const r of project.racks) for (const c of r.cables) max = Math.max(max, c.number || 0);
  return max + 1;
}

// ---------------------------------------------------------------------------

const firstCase = (p: Project) => (p.cases ?? []).find((c) => !c.kind || c.kind === 'case')?.id ?? null;
const firstInlay = (p: Project) => { const all = p.cases ?? []; return (all.find((c) => c.kind === 'drawer' || c.kind === 'inlay') ?? all[0])?.id ?? null; };

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  readOnly: boolean;

  activeRackId: string;
  /** racks or the case designer */
  mode: AppMode;
  activeCaseId: string | null;
  /** inlay shown in the inlay designer (a drawer inlay, a free inlay or the foam of a flight case) */
  activeInlayId: string | null;
  /** cable shown in the cable workshop: an assembly key, "custom:<id>" or "num:<cable number>" from a rack */
  cableFocus: string | null;
  view: ViewMode;
  selection: Selection;
  hoverCableId: string | null;
  pendingPort: (CableEnd & { rackId: string }) | null;
  /** set while adding a leg to a Y cable: the next connect() from the common end adds a leg */
  pendingY: { cableId: string; end: 'a' | 'b' } | null;
  /** 'auto' picks a cable type matching the connectors */
  activeCableTypeId: string;
  zoom: number;
  /** 2D camera offset in px (content origin relative to the stage) */
  pan: { x: number; y: number };
  /** navigation tool like Fusion 360's navigation bar; 'select' = normal editing */
  navMode: NavMode;
  /** incremented to ask the active view to fit everything */
  fitTick: number;
  /** incremented to ask the 3D view to go to its home view */
  homeTick: number;
  modal: Modal;
  toast: { text: string; kind: 'info' | 'error' } | null;

  // project lifecycle
  setProject(p: Project, keepHistory?: boolean): void;
  newProject(): void;
  /** apply a change; changes with the same coalesce key within 1.5 s form one undo step */
  mutate(fn: (draft: Project) => void, coalesceKey?: string): void;
  undo(): void;
  redo(): void;

  // ui
  setView(v: ViewMode): void;
  setActiveRack(id: string): void;
  select(s: Selection): void;
  setHoverCable(id: string | null): void;
  setPendingPort(p: State['pendingPort']): void;
  setActiveCableType(id: string): void;
  setZoom(z: number): void;
  setPan(p: { x: number; y: number }): void;
  setNavMode(m: NavMode): void;
  requestFit(): void;
  requestHome(): void;
  openModal(m: Modal): void;
  showToast(text: string, kind?: 'info' | 'error'): void;

  // case designer
  setMode(m: AppMode): void;
  setActiveCase(id: string): void;
  setActiveInlay(id: string): void;
  addCase(c: FlightCase): void;
  updateCase(id: string, patch: Partial<FlightCase>, coalesce?: string): void;
  removeCase(id: string): void;
  duplicateCase(id: string): void;

  // cable workshop
  setCableFocus(key: string | null): void;
  addCustomCable(c: CustomCable): void;
  updateCustomCable(id: string, patch: Partial<CustomCable>): void;
  removeCustomCable(id: string): void;
  addCaseItems(caseId: string, items: CaseItem[]): void;
  updateCaseItem(caseId: string, itemId: string, patch: Partial<CaseItem>): void;
  removeCaseItem(caseId: string, itemId: string): void;

  // racks
  addRack(type: RackType, name?: string): void;
  duplicateRack(id: string): void;
  removeRack(id: string): void;
  updateRack(id: string, patch: Partial<Omit<Rack, 'id'>>): void;

  // devices
  placeDevice(rackId: string, tpl: DeviceTemplate, u: number, mount: Face, slot: number, bay?: number): string | null;
  addDeviceAuto(rackId: string, tpl: DeviceTemplate, mount: Face): void;
  moveDevice(rackId: string, deviceId: string, u: number, mount: Face, slot: number, bay?: number): boolean;
  updateDevice(rackId: string, deviceId: string, patch: Partial<PlacedDevice>): void;
  removeDevice(rackId: string, deviceId: string): void;
  duplicateDevice(rackId: string, deviceId: string): void;

  // split / combi boxes below the rack
  addBox(rackId: string, tpl: DeviceTemplate): void;
  updateBox(rackId: string, boxId: string, patch: Partial<PlacedBox>): void;
  removeBox(rackId: string, boxId: string): void;

  // cables
  connect(rackId: string, a: CableEnd, b: CableEnd): void;
  updateCable(rackId: string, cableId: string, patch: Partial<Cable>): void;
  removeCable(rackId: string, cableId: string): void;
  renumberCables(): void;
  /** start adding a leg to a Y cable from end `end` of the given cable (the user then clicks the target port) */
  startYLeg(rackId: string, cableId: string, end: 'a' | 'b'): void;

  // libraries
  upsertTemplate(t: DeviceTemplate): void;
  deleteTemplate(id: string): void;
  upsertCableType(t: CableType): void;
  deleteCableType(id: string): void;
  upsertRackType(t: RackType): void;
  deleteRackType(id: string): void;
  updateSettings(patch: Partial<ProjectSettings>): void;
}

const STORAGE_KEY = 'rackplanner.project.v1';
let lastEdit: { key?: string; t: number } = { t: 0 };

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeProject(JSON.parse(raw));
  } catch {
    /* ignore – storage may be unavailable */
  }
  return emptyProject();
}

export const useStore = create<State>((set, get) => {
  const initial = loadInitial();
  const findRack = (p: Project, id: string) => p.racks.find((r) => r.id === id);

  return {
    project: initial,
    past: [],
    future: [],
    readOnly: false,
    activeRackId: initial.racks[0]?.id ?? '',
    mode: 'racks',
    activeCaseId: firstCase(initial),
    activeInlayId: firstInlay(initial),
    cableFocus: null,
    view: 'both',
    selection: null,
    hoverCableId: null,
    pendingPort: null,
    pendingY: null,
    activeCableTypeId: 'auto',
    zoom: 1,
    pan: { x: 0, y: 0 },
    navMode: 'select',
    fitTick: 0,
    homeTick: 0,
    modal: null,
    toast: null,

    setProject(p, keepHistory = false) {
      const project = normalizeProject(p);
      set((s) => ({
        project,
        past: keepHistory ? [...s.past, s.project] : [],
        future: [],
        activeRackId: project.racks[0]?.id ?? '',
        activeCaseId: firstCase(project),
        activeInlayId: firstInlay(project),
        selection: null,
        pendingPort: null,
      }));
    },
    newProject() {
      get().setProject(emptyProject(), true);
    },
    mutate(fn, coalesceKey) {
      set((s) => {
        const next = deepClone(s.project);
        fn(next);
        next.updatedAt = new Date().toISOString();
        const now = Date.now();
        const merge = coalesceKey && lastEdit.key === coalesceKey && now - lastEdit.t < 1500 && s.past.length > 0;
        lastEdit = { key: coalesceKey, t: now };
        if (merge) return { project: next, future: [] };
        return { project: next, past: [...s.past.slice(-99), s.project], future: [] };
      });
    },
    undo() {
      set((s) => {
        if (!s.past.length) return {};
        const prev = s.past[s.past.length - 1];
        const activeRackId = prev.racks.some((r) => r.id === s.activeRackId) ? s.activeRackId : prev.racks[0]?.id ?? '';
        return { project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], activeRackId, selection: null };
      });
    },
    redo() {
      set((s) => {
        if (!s.future.length) return {};
        const next = s.future[0];
        const activeRackId = next.racks.some((r) => r.id === s.activeRackId) ? s.activeRackId : next.racks[0]?.id ?? '';
        return { project: next, past: [...s.past, s.project], future: s.future.slice(1), activeRackId, selection: null };
      });
    },

    setView: (view) => set({ view }),
    setActiveRack: (activeRackId) => set({ activeRackId, selection: null, pendingPort: null }),
    select: (selection) => set({ selection }),
    setHoverCable: (hoverCableId) => set({ hoverCableId }),
    setPendingPort: (pendingPort) => set(pendingPort ? { pendingPort } : { pendingPort, pendingY: null }),
    setActiveCableType: (activeCableTypeId) => set({ activeCableTypeId }),
    setZoom: (zoom) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),
    setPan: (pan) => set({ pan }),
    setNavMode: (navMode) => set({ navMode }),
    requestFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
    requestHome: () => set((s) => ({ homeTick: s.homeTick + 1 })),
    openModal: (modal) => set({ modal }),
    showToast(text, kind = 'info') {
      set({ toast: { text, kind } });
      const t = get().toast;
      setTimeout(() => { if (get().toast === t) set({ toast: null }); }, 3500);
    },

    setMode: (mode) => set({ mode, selection: null, pendingPort: null }),
    setActiveCase: (activeCaseId) => set({ activeCaseId, selection: null }),
    setActiveInlay: (activeInlayId) => set({ activeInlayId, selection: null }),
    addCase(c) {
      get().mutate((p) => { p.cases = [...(p.cases ?? []), deepClone(c)]; });
      if (!c.kind || c.kind === 'case') set({ activeCaseId: c.id, mode: 'cases', selection: null });
      else set({ activeInlayId: c.id, mode: 'inlays', selection: null });
    },
    updateCase(id, patch, coalesce) {
      get().mutate((p) => {
        const c = p.cases?.find((x) => x.id === id);
        if (c) Object.assign(c, deepClone(patch));
      }, coalesce ?? `case:${id}:${Object.keys(patch).join()}`);
    },
    removeCase(id) {
      get().mutate((p) => { p.cases = (p.cases ?? []).filter((c) => c.id !== id); });
      set((s) => ({ activeCaseId: firstCase(s.project), activeInlayId: firstInlay(s.project), selection: null }));
    },
    setCableFocus: (cableFocus) => set({ cableFocus }),
    addCustomCable(c) {
      get().mutate((p) => { p.customCables = [...(p.customCables ?? []), deepClone(c)]; });
      set({ cableFocus: `custom:${c.id}`, mode: 'cables' });
    },
    updateCustomCable(id, patch) {
      get().mutate((p) => {
        const c = p.customCables?.find((x) => x.id === id);
        if (c) Object.assign(c, deepClone(patch));
      }, `custom:${id}:${Object.keys(patch).join()}`);
    },
    removeCustomCable(id) {
      get().mutate((p) => {
        p.customCables = (p.customCables ?? []).filter((x) => x.id !== id);
        // rack cables built after it fall back to the standard assignment
        for (const r of p.racks) for (const c of r.cables) if (c.customId === id) delete c.customId;
      });
      set({ cableFocus: null });
    },
    duplicateCase(id) {
      const src = get().project.cases?.find((c) => c.id === id);
      if (!src) return;
      const copy: FlightCase = { ...deepClone(src), id: uid('case-'), name: src.name + ' (Kopie)', items: src.items.map((it) => ({ ...deepClone(it), id: uid('it-') })) };
      get().addCase(copy);
    },
    addCaseItems(caseId, items) {
      get().mutate((p) => {
        const c = p.cases?.find((x) => x.id === caseId);
        if (c) c.items.push(...deepClone(items));
      });
      if (items.length === 1) set({ selection: { kind: 'caseItem', id: items[0].id } });
    },
    updateCaseItem(caseId, itemId, patch) {
      get().mutate((p) => {
        const it = p.cases?.find((x) => x.id === caseId)?.items.find((x) => x.id === itemId);
        if (it) Object.assign(it, deepClone(patch));
      }, `caseItem:${itemId}:${Object.keys(patch).join()}`);
    },
    removeCaseItem(caseId, itemId) {
      get().mutate((p) => {
        const c = p.cases?.find((x) => x.id === caseId);
        if (c) c.items = c.items.filter((x) => x.id !== itemId);
      });
      set({ selection: null });
    },

    addRack(type, name) {
      const id = uid('rack-');
      get().mutate((p) => {
        p.racks.push({ id, name: name ?? `Rack ${p.racks.length + 1}`, type: deepClone(type), devices: [], cables: [] });
      });
      set({ activeRackId: id, selection: null });
    },
    duplicateRack(id) {
      const newId = uid('rack-');
      get().mutate((p) => {
        const r = findRack(p, id);
        if (!r) return;
        const copy = deepClone(r);
        copy.id = newId;
        copy.name = r.name + ' (Kopie)';
        const idMap = new Map<string, string>();
        for (const d of copy.devices) { const nid = uid('dev-'); idMap.set(d.id, nid); d.id = nid; }
        for (const b of copy.boxes ?? []) { const nid = uid('box-'); idMap.set(b.id, nid); b.id = nid; }
        let num = nextCableNumber(p);
        const numMap = new Map<number, number>(), groupMap = new Map<string, string>();
        for (const c of copy.cables) {
          c.id = uid('cab-');
          // legs of a Y cable keep one shared number and group
          if (!numMap.has(c.number)) numMap.set(c.number, num++);
          c.number = numMap.get(c.number)!;
          if (c.yGroup) { if (!groupMap.has(c.yGroup)) groupMap.set(c.yGroup, uid('y-')); c.yGroup = groupMap.get(c.yGroup); }
          c.a.deviceId = idMap.get(c.a.deviceId) ?? c.a.deviceId;
          c.b.deviceId = idMap.get(c.b.deviceId) ?? c.b.deviceId;
        }
        p.racks.push(copy);
      });
      set({ activeRackId: newId });
    },
    removeRack(id) {
      const { project } = get();
      if (project.racks.length <= 1) { get().showToast('Das letzte Rack kann nicht gelöscht werden', 'error'); return; }
      get().mutate((p) => { p.racks = p.racks.filter((r) => r.id !== id); });
      set((s) => ({ activeRackId: s.project.racks[0].id, selection: null }));
    },
    updateRack(id, patch) {
      get().mutate((p) => {
        const r = findRack(p, id);
        if (r) Object.assign(r, deepClone(patch));
      }, `rack:${id}:${Object.keys(patch).join()}`);
    },

    placeDevice(rackId, tpl, u, mount, slot, bay = 0) {
      const { project } = get();
      const rack = findRack(project, rackId);
      if (!rack) return null;
      const probe = { ...project, templates: { ...project.templates, [tpl.id]: tpl } };
      const chk = checkPlacement(probe, rack, tpl, u, mount, slot, undefined, bay);
      if (!chk.ok) { get().showToast(chk.reason ?? 'Platz belegt', 'error'); return null; }
      if (chk.warning) get().showToast(chk.warning);
      const id = uid('dev-');
      get().mutate((p) => {
        if (!p.templates[tpl.id]) p.templates[tpl.id] = deepClone(tpl);
        findRack(p, rackId)!.devices.push({ id, templateId: tpl.id, u, mount, slot, ...(bay ? { bay } : {}) });
      });
      set({ selection: { kind: 'device', id } });
      return id;
    },
    addDeviceAuto(rackId, tpl, mount) {
      const { project } = get();
      const rack = findRack(project, rackId);
      if (!rack) return;
      const probe = { ...project, templates: { ...project.templates, [tpl.id]: tpl } };
      let spot = findFreeSpot(probe, rack, tpl, mount);
      let m = mount;
      if (!spot && rack.type.hasRearRails) { m = mount === 'front' ? 'rear' : 'front'; spot = findFreeSpot(probe, rack, tpl, m); }
      if (!spot) { get().showToast('Kein freier Platz im Rack', 'error'); return; }
      get().placeDevice(rackId, tpl, spot.u, m, spot.slot, spot.bay);
    },
    moveDevice(rackId, deviceId, u, mount, slot, bay) {
      const { project } = get();
      const rack = findRack(project, rackId);
      const d = rack?.devices.find((x) => x.id === deviceId);
      if (!rack || !d) return false;
      const b = bay ?? d.bay ?? 0;
      if (d.u === u && d.mount === mount && d.slot === slot && (d.bay ?? 0) === b) return true;
      const tpl = project.templates[d.templateId];
      const chk = checkPlacement(project, rack, tpl, u, mount, slot, deviceId, b);
      if (!chk.ok) { get().showToast(chk.reason ?? 'Platz belegt', 'error'); return false; }
      get().mutate((p) => {
        const dd = findRack(p, rackId)!.devices.find((x) => x.id === deviceId)!;
        dd.u = u; dd.mount = mount; dd.slot = slot;
        if (b) dd.bay = b; else delete dd.bay;
      });
      return true;
    },
    updateDevice(rackId, deviceId, patch) {
      get().mutate((p) => {
        const r = findRack(p, rackId);
        const d = r?.devices.find((x) => x.id === deviceId);
        if (!r || !d) return;
        Object.assign(d, deepClone(patch));
        // a swapped module takes its connectors along: drop the cables that ended there
        const tpl = p.templates[d.templateId];
        if (patch.fields && tpl?.modules?.length) {
          const ids = new Set(devicePorts(tpl, d).map((x) => x.id));
          const gone = (e: CableEnd) => e.deviceId === deviceId && !ids.has(e.portId);
          const before = r.cables.length;
          r.cables = r.cables.filter((c) => !gone(c.a) && !gone(c.b));
          if (r.cables.length !== before) tidyYGroups(r);
        }
      }, `dev:${deviceId}:${Object.keys(patch).join()}`);
    },
    removeDevice(rackId, deviceId) {
      get().mutate((p) => {
        const r = findRack(p, rackId);
        if (!r) return;
        r.devices = r.devices.filter((d) => d.id !== deviceId);
        r.cables = r.cables.filter((c) => c.a.deviceId !== deviceId && c.b.deviceId !== deviceId);
        tidyYGroups(r);
      });
      set({ selection: null });
    },
    duplicateDevice(rackId, deviceId) {
      const { project } = get();
      const rack = findRack(project, rackId);
      const d = rack?.devices.find((x) => x.id === deviceId);
      if (!rack || !d) return;
      const tpl = project.templates[d.templateId];
      const spot = findFreeSpot(project, rack, tpl, d.mount);
      if (!spot) { get().showToast('Kein freier Platz im Rack', 'error'); return; }
      const id = uid('dev-');
      get().mutate((p) => {
        findRack(p, rackId)!.devices.push({ ...deepClone(d), id, u: spot.u, slot: spot.slot, bay: spot.bay || undefined, label: d.label ? d.label + ' (2)' : undefined });
      });
      set({ selection: { kind: 'device', id } });
    },

    connect(rackId, a, b) {
      const { project, activeCableTypeId } = get();
      const rack = findRack(project, rackId);
      if (!rack) return;
      if (a.deviceId === b.deviceId && a.portId === b.portId) return;
      const same = (x: CableEnd, y: CableEnd) => x.deviceId === y.deviceId && x.portId === y.portId;
      const busy = (e: CableEnd) => rack.cables.some((c) => same(c.a, e) || same(c.b, e));
      // adding a leg to a Y cable: the pending (common) end may already be used by that cable
      const py = get().pendingY;
      const yBase = py ? rack.cables.find((c) => c.id === py.cableId) : undefined;
      if (py && yBase && same(py.end === 'a' ? yBase.a : yBase.b, a)) {
        if (busy(b)) { get().showToast('Port ist bereits belegt', 'error'); return; }
        const id = uid('cab-');
        get().mutate((p) => {
          const r = findRack(p, rackId)!;
          const base = r.cables.find((c) => c.id === py.cableId)!;
          if (!base.yGroup) {
            if (py.end === 'b') [base.a, base.b] = [base.b, base.a]; // the common connector is always end a
            base.yGroup = uid('y-');
            base.yLeg = 1;
          }
          const legs = r.cables.filter((c) => c.yGroup === base.yGroup);
          const leg = Math.max(...legs.map((c) => c.yLeg ?? 1)) + 1;
          r.cables.push({ id, number: base.number, a: { ...base.a }, b, typeId: base.typeId, lengthMode: 'auto', yGroup: base.yGroup, yLeg: leg, color: base.color });
        });
        set({ selection: { kind: 'cable', id }, pendingY: null });
        return;
      }
      if (busy(a) || busy(b)) { get().showToast('Port ist bereits belegt', 'error'); return; }
      const portOf = (e: CableEnd) => {
        const d = rack.devices.find((x) => x.id === e.deviceId);
        const dt = d && project.templates[d.templateId];
        if (d) return dt ? devicePorts(dt, d).find((p) => p.id === e.portId) : undefined;
        const bx = rack.boxes?.find((x) => x.id === e.deviceId);
        return bx ? project.templates[bx.templateId]?.ports.find((p) => p.id === e.portId) : undefined;
      };
      const pa = portOf(a); const pb = portOf(b);
      if (!pa || !pb) return;
      const sa = connectorDef(pa.connector).signal; const sb = connectorDef(pb.connector).signal;
      const typeId = activeCableTypeId !== 'auto' && project.cableTypes.some((t) => t.id === activeCableTypeId)
        ? activeCableTypeId
        : suggestCableType(project, pa.connector, pb.connector).id;
      const id = uid('cab-');
      get().mutate((p) => {
        findRack(p, rackId)!.cables.push({ id, number: nextCableNumber(p), a, b, typeId, lengthMode: 'auto' });
      });
      set({ selection: { kind: 'cable', id } });
      if (sa !== sb && !(['rf', 'clock'].includes(sa) && ['rf', 'clock'].includes(sb))) {
        get().showToast(`Achtung: unterschiedliche Signalarten (${pa.connector} ↔ ${pb.connector})`);
      }
    },
    updateCable(rackId, cableId, patch) {
      get().mutate((p) => {
        const r = findRack(p, rackId);
        const c = r?.cables.find((x) => x.id === cableId);
        if (!c) return;
        Object.assign(c, deepClone(patch));
        // cable type and colour belong to the whole Y cable
        if (c.yGroup && ('typeId' in patch || 'color' in patch)) {
          for (const leg of r!.cables) if (leg.yGroup === c.yGroup) { leg.typeId = c.typeId; leg.color = c.color; }
        }
      }, `cab:${cableId}:${Object.keys(patch).join()}`);
    },
    removeCable(rackId, cableId) {
      get().mutate((p) => {
        const r = findRack(p, rackId);
        if (r) { r.cables = r.cables.filter((c) => c.id !== cableId); tidyYGroups(r); }
      });
      set({ selection: null });
    },
    renumberCables() {
      get().mutate((p) => {
        let n = 1;
        for (const r of p.racks) {
          const groupNum = new Map<string, number>();
          for (const c of r.cables) {
            if (c.yGroup && groupNum.has(c.yGroup)) { c.number = groupNum.get(c.yGroup)!; continue; }
            c.number = n++;
            if (c.yGroup) groupNum.set(c.yGroup, c.number);
          }
        }
      });
    },
    startYLeg(rackId, cableId, end) {
      const c = findRack(get().project, rackId)?.cables.find((x) => x.id === cableId);
      if (!c) return;
      const e = end === 'a' ? c.a : c.b;
      set({ pendingPort: { rackId, ...e }, pendingY: { cableId, end } });
      get().showToast('Y-Kabel: Zielanschluss für den neuen Ast anklicken');
    },

    addBox(rackId, tpl) {
      const id = uid('box-');
      get().mutate((p) => {
        if (!p.templates[tpl.id]) p.templates[tpl.id] = deepClone(tpl);
        const r = findRack(p, rackId);
        if (!r) return;
        r.boxes = [...(r.boxes ?? []), { id, templateId: tpl.id, distance: 10 }];
      });
      set({ selection: { kind: 'box', id } });
    },
    updateBox(rackId, boxId, patch) {
      get().mutate((p) => {
        const b = findRack(p, rackId)?.boxes?.find((x) => x.id === boxId);
        if (b) Object.assign(b, deepClone(patch));
      }, `box:${boxId}:${Object.keys(patch).join()}`);
    },
    removeBox(rackId, boxId) {
      get().mutate((p) => {
        const r = findRack(p, rackId);
        if (!r) return;
        r.boxes = (r.boxes ?? []).filter((b) => b.id !== boxId);
        r.cables = r.cables.filter((c) => c.a.deviceId !== boxId && c.b.deviceId !== boxId);
        tidyYGroups(r);
      });
      set({ selection: null });
    },

    upsertTemplate(t) {
      get().mutate((p) => { p.templates[t.id] = deepClone(t); });
    },
    deleteTemplate(id) {
      const used = get().project.racks.some((r) => r.devices.some((d) => d.templateId === id) || (r.boxes ?? []).some((b) => b.templateId === id));
      if (used) { get().showToast('Vorlage wird noch in einem Rack verwendet', 'error'); return; }
      get().mutate((p) => { delete p.templates[id]; });
    },
    upsertCableType(t) {
      get().mutate((p) => {
        const i = p.cableTypes.findIndex((x) => x.id === t.id);
        if (i >= 0) p.cableTypes[i] = deepClone(t); else p.cableTypes.push(deepClone(t));
      });
    },
    deleteCableType(id) {
      const used = get().project.racks.some((r) => r.cables.some((c) => c.typeId === id));
      if (used) { get().showToast('Kabeltyp wird noch verwendet', 'error'); return; }
      get().mutate((p) => { p.cableTypes = p.cableTypes.filter((t) => t.id !== id); });
    },
    upsertRackType(t) {
      get().mutate((p) => {
        const i = p.rackTypes.findIndex((x) => x.id === t.id);
        if (i >= 0) p.rackTypes[i] = deepClone(t); else p.rackTypes.push(deepClone(t));
      });
    },
    deleteRackType(id) {
      get().mutate((p) => { p.rackTypes = p.rackTypes.filter((t) => t.id !== id); });
    },
    updateSettings(patch) {
      get().mutate((p) => { Object.assign(p.settings, patch); }, `settings:${Object.keys(patch).join()}`);
    },
  };
});

// autosave (debounced); skipped in read-only viewer mode
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.readOnly || s.project === prev.project) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project)); } catch { /* storage full or unavailable */ }
  }, 400);
});

export const useActiveRack = () => useStore((s) => s.project.racks.find((r) => r.id === s.activeRackId) ?? s.project.racks[0]);
