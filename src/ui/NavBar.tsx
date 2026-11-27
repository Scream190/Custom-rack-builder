import { useStore, type NavMode } from '../model/store';

const ICONS: Record<string, JSX.Element> = {
  select: <path d="M5 3l12 8-5 1 3 6-2 1-3-6-4 4z" />,
  orbit: <><ellipse cx="11" cy="11" rx="8" ry="3.5" fill="none" strokeWidth="1.6" /><ellipse cx="11" cy="11" rx="3.5" ry="8" fill="none" strokeWidth="1.6" /></>,
  pan: <path d="M11 2l3 3h-2v4h4V7l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H6v2l-3-3 3-3v2h4V5H8z" />,
  zoom: <><circle cx="9" cy="9" r="6" fill="none" strokeWidth="2" /><path d="M13.5 13.5L19 19" strokeWidth="2.4" /><path d="M6 9h6M9 6v6" strokeWidth="1.6" /></>,
  fit: <path d="M3 8V3h5M14 3h5v5M19 14v5h-5M8 19H3v-5" fill="none" strokeWidth="2" />,
  home: <path d="M3 11l8-7 8 7v8h-5v-5H8v5H3z" />,
};

/** Bottom navigation bar like in Fusion 360 (shared by 2D and 3D, designer and viewer). */
export function NavBar({ is3d }: { is3d: boolean }) {
  const navMode = useStore((s) => s.navMode);
  const zoom = useStore((s) => s.zoom);
  const st = useStore.getState;
  const tool = (m: NavMode, title: string) => (
    <button className={'nav-btn' + (navMode === m ? ' on' : '')} title={title} onClick={() => st().setNavMode(navMode === m && m !== 'select' ? 'select' : m)}>
      <svg viewBox="0 0 22 22" width="18" height="18" fill="currentColor" stroke="currentColor" strokeWidth="0">{ICONS[m]}</svg>
    </button>
  );
  return (
    <div className="navbar" onPointerDown={(e) => e.stopPropagation()}>
      {tool('select', is3d ? 'Auswählen und Bearbeiten: Anschlüsse anklicken verbindet, ausgewähltes Gerät ziehen verschiebt, sonst dreht die linke Maustaste' : 'Auswählen & Bearbeiten (Esc)')}
      {is3d ? tool('orbit', 'Orbit – linke Maustaste dreht (sonst Shift + Mittelklick)') : null}
      {tool('pan', 'Pan – linke Maustaste verschiebt (sonst Mittelklick ziehen)')}
      {tool('zoom', 'Zoom – linke Maustaste hoch/runter (sonst Mausrad)')}
      <span className="nav-sep" />
      <button className="nav-btn" title="Einpassen (F6 oder Doppelklick Mittelklick)" onClick={() => st().requestFit()}>
        <svg viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor">{ICONS.fit}</svg>
      </button>
      {is3d ? (
        <button className="nav-btn" title="Startansicht" onClick={() => st().requestHome()}>
          <svg viewBox="0 0 22 22" width="18" height="18" fill="currentColor">{ICONS.home}</svg>
        </button>
      ) : (
        <span className="nav-zoom">{Math.round(zoom * 100)}%</span>
      )}
      <span className="nav-help" title={'Mausrad: Zoom zum Cursor\nMittelklick ziehen: Pan\nShift + Mittelklick: Orbit (3D)\nDoppelklick Mitte / F6: Einpassen'}>?</span>
    </div>
  );
}
