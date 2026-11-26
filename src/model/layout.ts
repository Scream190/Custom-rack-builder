import { useEffect, useState } from 'react';

/**
 * Per-viewer UI layout and program preferences (panel sizes / visibility, drag grid, export defaults …).
 * Kept in localStorage, falls back to defaults. Project-wide settings live in project.settings instead.
 */
export interface Layout {
  libraryW: number;
  inspectorW: number;
  cableListH: number;
  showLibrary: boolean;
  showInspector: boolean;
  showCableList: boolean;
  /** cable list collapsed to its header */
  cableListCollapsed: boolean;
  /** drag grid for foam cut-outs (mm) */
  snap: number;
  /** minimum gap between cut-outs when arranging automatically (mm) */
  packGap: number;
  /** foam of new inlays */
  foamMaterial: 'PE' | 'PU' | 'EVA';
  foamColor: string;
  /** show the installed devices in the rack designer */
  buildDevices: boolean;
  /** ambient occlusion (contact shadows) in the 3D views of cases and rack housings */
  ao: boolean;
  /** export defaults */
  pdfFormat: 'a4' | 'a3';
  pdfCableList: boolean;
  pdfBom: boolean;
}

export const DEFAULT_LAYOUT: Layout = {
  libraryW: 270,
  inspectorW: 310,
  cableListH: 230,
  showLibrary: true,
  showInspector: true,
  showCableList: true,
  cableListCollapsed: false,
  snap: 5,
  packGap: 15,
  foamMaterial: 'PE',
  foamColor: '#3f3f46',
  buildDevices: true,
  ao: true,
  pdfFormat: 'a3',
  pdfCableList: true,
  pdfBom: true,
};

/** current value outside React (e.g. when creating new objects) */
export const getLayout = () => current;

const KEY = 'rackplanner.layout.v1';
let current: Layout = load();
const listeners = new Set<(l: Layout) => void>();

function load(): Layout {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULT_LAYOUT };
}

export function setLayout(patch: Partial<Layout>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn(current));
}

export function useLayout(): Layout {
  const [l, setL] = useState(current);
  useEffect(() => {
    listeners.add(setL);
    return () => { listeners.delete(setL); };
  }, []);
  return l;
}
