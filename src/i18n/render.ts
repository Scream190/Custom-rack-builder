import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { jsPDF } from 'jspdf';
import { tr, trMarkup } from './index';

/** static markup for exports and 3D textures, texts in the current language */
export const renderMarkup = (el: ReactElement): string => trMarkup(renderToStaticMarkup(el));

/** translate everything written with doc.text / splitTextToSize of a jsPDF document */
export function trPdf<T extends jsPDF>(doc: T): T {
  const text = doc.text.bind(doc) as (...a: unknown[]) => T;
  const split = doc.splitTextToSize.bind(doc);
  const t = (v: unknown) => (typeof v === 'string' ? tr(v) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? tr(x) : x)) : v);
  (doc as unknown as { text: (...a: unknown[]) => T }).text = (v: unknown, ...rest: unknown[]) => text(t(v), ...rest);
  (doc as unknown as { splitTextToSize: typeof split }).splitTextToSize = (v: string, w: number, o?: unknown) => split(tr(v), w, o as never);
  return doc;
}
