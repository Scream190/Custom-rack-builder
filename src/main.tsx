import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { libraryUpdate, useStore } from './model/store';
import { readEmbeddedProject } from './export/html';
import { sampleProject } from './library/sample';
import './styles.css';

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

createRoot(document.getElementById('root')!).render(<App />);

if (libraryUpdate.updated && !embedded) {
  setTimeout(() => useStore.getState().showToast(
    `Gerätebibliothek aktualisiert (${libraryUpdate.updated} Vorlagen mit echten Steckerpositionen)` +
    (libraryUpdate.droppedCables ? ` – ${libraryUpdate.droppedCables} Kabel an geänderten Anschlüssen bitte neu stecken` : ''),
  ), 600);
}
