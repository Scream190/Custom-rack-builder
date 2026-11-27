import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { libraryUpdate, useStore } from './model/store';
import { readEmbeddedProject } from './export/html';
import { sampleProject } from './library/sample';
import './styles.css';
import { startDomTranslation } from './i18n/dom';
import { tr } from './i18n';

// Viewer mode: the exported interactive HTML carries the project as embedded JSON.
const embedded = readEmbeddedProject();
if (embedded) {
  useStore.getState().setProject(embedded);
  useStore.setState({ readOnly: true });
} else {
  // first start: show the sample so there's something to play with
  let firstRun = true;
  try { firstRun = !localStorage.getItem('rackplanner.project.v1'); } catch { /* storage unavailable */ }
  if (firstRun) useStore.getState().setProject(sampleProject());
}

startDomTranslation();
// dev builds only: browser test scripts drive the store directly
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
createRoot(document.getElementById('root')!).render(<App />);

if (libraryUpdate.updated && !embedded) {
  setTimeout(() => useStore.getState().showToast(
    tr(`Gerätebibliothek aktualisiert (${libraryUpdate.updated} Vorlagen)`) +
    (libraryUpdate.droppedCables ? tr(` – ${libraryUpdate.droppedCables} Kabel an geänderten Anschlüssen bitte neu stecken`) : ''),
  ), 600);
}
