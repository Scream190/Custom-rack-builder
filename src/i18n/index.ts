import { EN as EN_BASE, EN_TPL as EN_TPL_BASE } from './en';
import { EN_EXTRA, EN_EXTRA_TPL } from './enExtra';

const EN: Record<string, string> = { ...EN_BASE, ...EN_EXTRA };
const EN_TPL: [string, string][] = [...EN_TPL_BASE, ...EN_EXTRA_TPL];

/*
 * UI language. German is the source language of all texts in the code; `tr` translates a German text to the current
 * language (exact entry, then {0} templates, then word rules for generated device/cut-out names). The DOM layer in
 * dom.ts applies it to everything rendered, so components keep their German strings.
 */

export type Lang = 'de' | 'en';
const KEY = 'rackplanner.lang';

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch { /* storage unavailable */ }
  return typeof navigator !== 'undefined' && !/^de\b/i.test(navigator.language || 'de') ? 'en' : 'de';
}

let lang: Lang = initial();
export const getLang = (): Lang => lang;
/** for tests: change the language without reloading */
export function setLangForTests(l: Lang) { lang = l; cache.clear(); }
/** switch the language; the page reloads so every text (also canvases and textures) is rebuilt */
export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  lang = l;
  if (typeof location !== 'undefined') location.reload();
}

interface Tpl { re: RegExp; anchor: string; en: string; groups: number[][] }
const TPL: Tpl[] = EN_TPL.map(([de, en]) => {
  const parts = de.split(/\{\d+\}/);
  const anchor = parts.reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), '');
  // adjacent placeholders ({0}{1}) cannot be told apart: they share one capture group, the text goes to the first
  const groups: number[][] = [];
  let src = '';
  for (const tok of de.split(/(\{\d+\})/)) {
    const m = /^\{(\d+)\}$/.exec(tok);
    if (m) {
      if (src.endsWith('(.*?)')) groups[groups.length - 1].push(+m[1]);
      else { groups.push([+m[1]]); src += '(.*?)'; }
    } else src += tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return { re: new RegExp('^' + src + '$', 's'), anchor, en, groups };
}).sort((a, b) => b.anchor.length - a.anchor.length);

/** known German phrases inside longer texts (longest first, whole words only) */
let PHRASES: RegExp | null = null;
function phrases(): RegExp {
  if (!PHRASES) {
    const keys = Object.keys(EN).filter((k) => k.trim().length >= 4 && k === k.trim() && /[A-Za-zÄÖÜäöüß]/.test(k) && !k.includes('{')).sort((a, b) => b.length - a.length);
    PHRASES = new RegExp('(?<![\\p{L}\\d])(' + keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\d])', 'gu');
  }
  return PHRASES;
}

/** word rules for generated names (cut-out templates, drawers, rack types …), applied when nothing else matched */
const WORDS: [RegExp, string][] = [
  [/Micro-Taschensender/g, 'micro bodypack'], [/Mini-Taschensender/g, 'mini bodypack'], [/Taschen-Transceiver/g, 'bodypack transceiver'],
  [/Taschensender/g, 'bodypack'], [/Handsender/g, 'handheld'], [/Aufstecksender/g, 'plug-on transmitter'],
  [/IEM-Empfänger/g, 'IEM receiver'], [/Empfänger/g, 'receiver'], [/Rackschublade/g, 'rack drawer'], [/Schublade/g, 'drawer'],
  [/Ladestation/g, 'charging station'], [/Ladegerät/g, 'charger'], [/Akku/g, 'battery'], [/Richtantenne/g, 'directional antenna'], [/Stabantenne/g, 'whip antenna'],
  [/Kopfhörer/g, 'headphones'], [/\(aufgerollt\)/g, '(coiled)'], [/aufgerollt/g, 'coiled'], [/\(mit Klemme\)/g, '(with clamp)'], [/im Etui/g, 'in case'],
  [/2-fach/g, '2-bay'], [/Instrumentenmikrofon/g, 'instrument microphone'], [/Einbautiefe/g, 'mounting depth'], [/(\d) HE\b/g, '$1 U'], [/\bHE\b/g, 'U'],
  [/ tief\b/g, ' deep'], [/Kanäle/g, 'channels'], [/Kanal/g, 'channel'], [/Eingänge/g, 'inputs'], [/Ausgänge/g, 'outputs'],
];
const GERMANISH = /[äöüÄÖÜß]|Sender|Empfänger|Schublade|Lade|Akku|antenne|Kopfhörer|aufgerollt|Klemme|Etui|\d HE\b|tief\b|Kanal/;

const cache = new Map<string, string>();
/** translate a German UI text into the current language */
export function tr(s: string): string {
  if (lang === 'de' || !s) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const out = translate(s);
  if (cache.size > 20000) cache.clear();
  cache.set(s, out);
  return out;
}

function translate(s: string): string {
  const direct = EN[s];
  if (direct !== undefined) return direct;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const core = m[2];
  if (!core || !/[A-Za-zÄÖÜäöüß]/.test(core)) return s;
  const c = EN[core];
  if (c !== undefined) return m[1] + c + m[3];
  for (const t of TPL) {
    if (t.anchor && !core.includes(t.anchor)) continue;
    const r = t.re.exec(core);
    if (!r) continue;
    const args: Record<number, string> = {};
    t.groups.forEach((g, gi) => g.forEach((idx, k) => { args[idx] = k ? '' : translate(r[gi + 1] ?? ''); }));
    return m[1] + t.en.replace(/\{(\d+)\}/g, (_, i) => args[+i] ?? '') + m[3];
  }
  // phrases inside a longer text, then word rules for generated names
  const ph = core.replace(phrases(), (k) => EN[k] ?? k);
  const out = GERMANISH.test(ph) ? words(ph) : ph;
  return out === core ? s : m[1] + out + m[3];
}

function words(s: string): string {
  let o = s;
  for (const [re, en] of WORDS) o = o.replace(re, en);
  return o;
}

/** translate the text nodes and title attributes of an SVG/HTML markup string (exports, 3D textures) */
export function trMarkup(markup: string): string {
  if (lang === 'de') return markup;
  return markup
    .replace(/>([^<>]+)</g, (_, t: string) => '>' + escapeText(tr(unescapeText(t))) + '<')
    .replace(/\s(title|aria-label)="([^"]*)"/g, (_, a: string, v: string) => ` ${a}="${escapeText(tr(unescapeText(v)))}"`);
}
const unescapeText = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const escapeText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
