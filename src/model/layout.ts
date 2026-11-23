import { useEffect, useState } from 'react';

/** Per-viewer UI layout (panel sizes / visibility). Kept in localStorage, falls back to defaults. */
export interface Layout {
  libraryW: number;
  inspectorW: number;
  cableListH: number;
  showLibrary: boolean;
  showInspector: boolean;
  showCableList: boolean;
  /** cable list collapsed to its header */
  cableListCollapsed: boolean;
}

export const DEFAULT_LAYOUT: Layout = {
  libraryW: 270,
  inspectorW: 310,
  cableListH: 230,
  showLibrary: true,
  showInspector: true,
  showCableList: true,
  cableListCollapsed: false,
};

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
