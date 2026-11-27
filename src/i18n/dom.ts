import { getLang, tr } from './index';

/*
 * Applies `tr` to everything React renders: text nodes and the title / placeholder / aria-label attributes, also later
 * changes. Form values (names the user typed) are never touched. Only active for languages other than German.
 */

const ATTRS = ['title', 'placeholder', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
/** last value written by us per node / attribute, so our own writes are not translated again */
const written = new WeakMap<Node, string>();
const writtenAttr = new WeakMap<Element, Record<string, string>>();

function doText(n: Text) {
  const p = n.parentNode as Element | null;
  if (!p || SKIP.has(p.nodeName) || (p as HTMLElement).isContentEditable || p.closest?.('[data-no-tr]')) return;
  const v = n.data;
  if (written.get(n) === v) return;
  const t = tr(v);
  if (t !== v) { written.set(n, t); n.data = t; }
}
function doAttrs(el: Element) {
  if (el.closest?.('[data-no-tr]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const mine = writtenAttr.get(el);
    if (mine?.[a] === v) continue;
    const t = tr(v);
    if (t !== v) { writtenAttr.set(el, { ...(mine ?? {}), [a]: t }); el.setAttribute(a, t); }
  }
}
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { doText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) doAttrs(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

export function startDomTranslation() {
  if (getLang() === 'de' || typeof MutationObserver === 'undefined') return;
  document.documentElement.lang = getLang();
  walk(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // dialogs of the browser
  const c = window.confirm.bind(window), a = window.alert.bind(window), pr = window.prompt.bind(window);
  window.confirm = (msg?: string) => c(msg ? tr(msg) : msg);
  window.alert = (msg?: unknown) => a(typeof msg === 'string' ? tr(msg) : msg);
  window.prompt = (msg?: string, def?: string) => pr(msg ? tr(msg) : msg, def);
}
