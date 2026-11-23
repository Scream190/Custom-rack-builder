import type { Project } from '../model/types';

/**
 * Interactive export: the app is built as a single self-contained HTML file, so we clone the running
 * document, embed the project as JSON and the result opens in read-only viewer mode in any browser.
 */
export function buildInteractiveHtml(project: Project): string {
  const external = [...document.querySelectorAll('script[src]')].filter((s) => !(s as HTMLScriptElement).src.startsWith('data:'));
  if (external.length) {
    throw new Error('Interaktiver Export ist nur in der gebauten Version (npm run build → dist/index.html) verfügbar.');
  }
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  const root = clone.querySelector('#root');
  if (root) root.innerHTML = '';
  clone.querySelectorAll('#rp-embed, .export-scratch').forEach((n) => n.remove());
  // drop anything React portals may have added to <body> besides #root and scripts
  const body = clone.querySelector('body')!;
  [...body.children].forEach((ch) => {
    if (ch.id !== 'root' && ch.tagName !== 'SCRIPT') ch.remove();
  });
  const title = clone.querySelector('title');
  if (title) title.textContent = `${project.name} – RackPlanner Viewer`;
  const data = document.createElement('script');
  data.type = 'application/json';
  data.id = 'rp-embed';
  data.textContent = JSON.stringify(project).replace(/</g, '\\u003c');
  body.insertBefore(data, body.firstChild);
  return '<!doctype html>\n' + clone.outerHTML;
}

export function readEmbeddedProject(): Project | null {
  const el = document.getElementById('rp-embed');
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as Project;
  } catch {
    return null;
  }
}
