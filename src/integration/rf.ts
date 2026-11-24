/*
 * Exchange with the RF Frequency Manager (RF-Scan-Editor, same author).
 *
 *  RackPlanner → RF:  a frequency request (.rfreq, message `request`, format of src/js/84-requests.js there).
 *                     RF: Inventar → Anfragen … → Datei … creates one inventory entry per device (product, band,
 *                     device name, channel names, zone). No change on the RF side needed.
 *  RF → RackPlanner:  the RF project file (.rfse: coordPlan.requests + freqList) → devices with band, zone,
 *                     channel names and coordinated frequencies; the frequency list sent back by RF (.rfreq, `freqs`)
 *                     → frequencies into existing devices, matched by channel name; a `request` message works too.
 * Ids are the RF program's own: product "Shure|AD4D", profile/band "Shure|ULX-D|G50" (see rfData.ts).
 */
import type { DeviceTemplate, PlacedDevice, Project, Rack, RfChannel, RfDeviceData } from '../model/types';
import { RF_BANDS_RAW, RF_PRODUCTS_RAW, RF_SERIES_TYPE } from './rfData';

export interface RfProduct { id: string; man: string; model: string; series: string; seriesName: string; ch: number; free: number }
export interface RfBand { id: string; man: string; series: string; band: string; ranges: number[][] }

export const RF_PRODUCTS: RfProduct[] = RF_PRODUCTS_RAW.map(([man, model, series, ch, free]) => ({
  id: `${man}|${model}`, man, model, series: `${man}|${series}`, seriesName: series, ch: ch || 0, free: free || 0,
}));
export const RF_BANDS: RfBand[] = RF_BANDS_RAW.map(([man, series, band, ranges]) => ({ id: `${man}|${series}|${band}`, man, series: `${man}|${series}`, band, ranges }));
export const rfProductById = (id?: string) => (id ? RF_PRODUCTS.find((p) => p.id === id) : undefined);
export const rfBandsFor = (prod?: RfProduct) => (prod ? RF_BANDS.filter((b) => b.series === prod.series) : []);
export const rfSeriesType = (prod?: RfProduct) => (prod ? RF_SERIES_TYPE[prod.series] : undefined);
export const bandLabel = (b: RfBand) => `${b.band} (${b.ranges.map(([a, z]) => `${a}–${z}`).join(', ')} MHz)`;

/** built-in RackPlanner templates → RF products (first = default) */
const TEMPLATE_PRODUCTS: Record<string, string[]> = {
  'shure-ad4d': ['Shure|AD4D'], 'shure-ad4q': ['Shure|AD4Q'], 'shure-anx4': ['Shure|ANX4 (Axient Digital)', 'Shure|ANX4 (ULX-D)'],
  'shure-ulxd4': ['Shure|ULXD4'], 'shure-ulxd4d': ['Shure|ULXD4D'], 'shure-ulxd4q': ['Shure|ULXD4Q'], 'shure-qlxd4': ['Shure|QLXD4'],
  'shure-slxd4': ['Shure|SLXD4'], 'shure-slxd4d': ['Shure|SLXD4D'], 'shure-slxd4plus': ['Shure|SLXD4+'], 'shure-slxd4dplus': ['Shure|SLXD4D+'],
  'shure-slxd4qplus': ['Shure|SLXD4Q+'], 'shure-slxd4qdanplus': ['Shure|SLXD4QDAN+'], 'shure-slxd5plus': ['Shure|SLXD5+'],
  'shure-blx4': ['Shure|BLX4'], 'shure-blx88': ['Shure|BLX88'], 'shure-adtd': ['Shure|ADTD (Axient Digital PSM)'], 'shure-adtq': ['Shure|ADTQ (Axient Digital PSM)'],
  'shure-p10t': ['Shure|P10T (PSM 1000)'], 'shure-p9t': ['Shure|P9T (PSM 900)'], 'shure-p3t': ['Shure|P3T (PSM 300)'],
  'senn-em6000': ['Sennheiser|EM 6000'], 'senn-em6000dante': ['Sennheiser|EM 6000 Dante'],
  'senn-ewdxem2': ['Sennheiser|EW-DX EM 2'], 'senn-ewdxem2dante': ['Sennheiser|EW-DX EM 2 Dante'], 'senn-ewdxem4dante': ['Sennheiser|EW-DX EM 4 Dante'],
  'senn-ewd-em': ['Sennheiser|EW-D EM'], 'senn-spectera-bs': ['Sennheiser|Spectera (WMAS-Block)'],
  'senn-em100g4': ['Sennheiser|EM 100 G4'], 'senn-em300g4': ['Sennheiser|EM 300-500 G4'], 'senn-sriemg4': ['Sennheiser|SR IEM G4'],
  'senn-em2050': ['Sennheiser|EM 2050'], 'senn-sr2050': ['Sennheiser|SR 2050 IEM'], 'senn-em9046': ['Sennheiser|EM 9046 (Digital 9000)'],
  'senn-emxsw1': ['Sennheiser|EM XSW 1'], 'senn-emxsw2': ['Sennheiser|EM XSW 2'], 'senn-srxswiem': ['Sennheiser|SR XSW IEM'],
  'dpa-ndr1': ['DPA|N-DR1 (N-Series)'], 'at-atw-r3210': ['Audio-Technica|ATW-R3210'], 'at-atw-r3210n': ['Audio-Technica|ATW-R3210N'],
  'at-atw-r5220': ['Audio-Technica|ATW-R5220'], 'at-m3t': ['Audio-Technica|M3T (M3)'],
  'lect-dsqd': ['Lectrosonics|DSQD'], 'lect-dchr': ['Lectrosonics|DCHR'], 'lect-m2t': ['Lectrosonics|M2T (Duet)'],
  'wisy-mrk980': ['Wisycom|MRK980'], 'wisy-mpr52': ['Wisycom|MPR52'], 'akg-dsr800': ['AKG|DSR800 (DMS800)'], 'akg-sr470': ['AKG|SR470 (WMS470)'],
  'ev-re3rx': ['Electro-Voice|RE3-RX'], 'sd-a20nexus': ['Sound Devices|A20-Nexus (Astral)'], 'sd-a20rx': ['Sound Devices|A20-RX (Astral)'],
  'zax-zmt4': ['Zaxcom|ZMT4 (Sender)'], 'sony-urxp03d': ['Sony|URX-P03D (UWP-D)'], 'sony-urxs03d': ['Sony|URX-S03D (UWP-D)'],
};

const norm = (s: string) => s.toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9+]/g, '');

/** RF products a template can stand for (explicit field, mapping, or same manufacturer + model name) */
export function rfProductsFor(tpl?: DeviceTemplate): RfProduct[] {
  if (!tpl) return [];
  if (tpl.rfProduct) { const p = rfProductById(tpl.rfProduct); return p ? [p] : []; }
  const ids = TEMPLATE_PRODUCTS[tpl.id];
  if (ids) return ids.map((id) => rfProductById(id)).filter((p): p is RfProduct => !!p);
  const n = norm(tpl.name);
  const hit = RF_PRODUCTS.find((p) => p.man.toLowerCase() === tpl.manufacturer.toLowerCase() && n && norm(p.model) === n);
  return hit ? [hit] : [];
}

/** the RF product of a placed device */
export function rfProductOf(tpl: DeviceTemplate | undefined, d: PlacedDevice): RfProduct | undefined {
  const list = rfProductsFor(tpl);
  return (d.rf?.product && list.find((p) => p.id === d.rf!.product)) || list[0];
}

export function channelCount(prod: RfProduct | undefined, d: PlacedDevice): number {
  if (prod?.ch) return prod.ch;
  return Math.max(1, d.rf?.channels?.length || 1);
}

/** template for an RF product: mapped built-in, else a generic receiver / IEM transmitter */
export function templateIdForProduct(prodId: string, templates: DeviceTemplate[]): string {
  for (const [tid, ids] of Object.entries(TEMPLATE_PRODUCTS)) if (ids.includes(prodId) && templates.some((t) => t.id === tid)) return tid;
  const custom = templates.find((t) => t.rfProduct === prodId);
  if (custom) return custom.id;
  const prod = rfProductById(prodId);
  return rfSeriesType(prod) === 'iem' ? 'gen-iem-tx2' : 'gen-uhf-rx2';
}

const fmtMHz = (f: number) => f.toFixed(3);
export const channelLabel = (d: PlacedDevice, tpl: DeviceTemplate, i: number, n: number) =>
  d.rf?.channels?.[i]?.name || (n > 1 ? `${d.label || tpl.name} ${i + 1}` : d.label || tpl.name);

// ============================================================================================ export

export interface RfExportOptions {
  racks: Rack[];
  /** none: no zone · rack: rack name as zone (one file per rack) · device: zone from the device's RF data (one file per zone) */
  zoneMode: 'none' | 'rack' | 'device';
  from: string;
}

export interface RfExportFile { name: string; text: string; devices: number; zone: string }

export interface RfExportReport { files: RfExportFile[]; skipped: string[] }

/** `request` messages (format v1 of the RF Frequency Manager) for all wireless devices of the given racks */
export function buildRfRequests(project: Project, opt: RfExportOptions): RfExportReport {
  const groups = new Map<string, { zone: string; racks: Set<string>; devices: unknown[] }>();
  const skipped: string[] = [];
  for (const rack of opt.racks) {
    for (const d of [...rack.devices].sort((a, b) => b.u - a.u || a.slot - b.slot)) {
      const tpl = project.templates[d.templateId];
      const prod = rfProductOf(tpl, d);
      if (!tpl) continue;
      if (!prod) { if (/UHF|IEM|Funk|Empf|Sender/i.test(tpl.category)) skipped.push(`${rack.name}: ${d.label || tpl.name} (kein RF-Produkt zugeordnet)`); continue; }
      if (rfSeriesType(prod) === 'auto') { skipped.push(`${rack.name}: ${d.label || tpl.name} (selbstkoordinierend)`); continue; }
      const zone = opt.zoneMode === 'rack' ? rack.name : opt.zoneMode === 'device' ? d.rf?.zone || '' : '';
      if (!groups.has(zone)) groups.set(zone, { zone, racks: new Set(), devices: [] });
      const g = groups.get(zone)!;
      g.racks.add(rack.name);
      const n = channelCount(prod, d);
      const band = d.rf?.band && rfBandsFor(prod).find((b) => b.band === d.rf!.band);
      g.devices.push({
        model: prod.id,
        profileId: band ? band.id : undefined,
        units: prod.ch ? 1 : undefined,
        count: prod.ch || n,
        name: d.label || tpl.name,
        names: Array.from({ length: n }, (_, i) => channelLabel(d, tpl, i, n)),
        label: `${prod.man} ${prod.model}`,
      });
    }
  }
  // plain ASCII file names: browsers drop names with some special characters
  const safe = (s: string) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'RackPlanner';
  const files = [...groups.values()].map((g) => {
    const msg = {
      v: 1, t: 'request', id: uid(),
      from: { name: opt.from || 'RackPlanner', org: project.name, contact: '' },
      zone: g.zone, devices: g.devices,
      note: `Aus RackPlanner: ${[...g.racks].join(', ')}`,
    };
    return { name: `${safe(project.name)}${g.zone ? '_' + safe(g.zone) : ''}.rfreq`, text: JSON.stringify(msg, null, 1), devices: g.devices.length, zone: g.zone };
  });
  return { files, skipped };
}

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'rp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ============================================================================================ import

/** one device as it comes from the RF program */
export interface RfImportDevice {
  product: string;
  name: string;
  band?: string;
  zone: string;
  channels: RfChannel[];
  backups: number[];
}

export type RfImport =
  | { kind: 'devices'; source: string; devices: RfImportDevice[] }
  | { kind: 'freqs'; source: string; items: { name: string; f: number; backup: boolean; device: string; zone: string }[] };

const bandOfProfile = (profileId?: string) => {
  if (!profileId) return undefined;
  const parts = profileId.split('|');
  return parts.length >= 3 ? parts[2] : undefined;
};

/** Read an RF project (.rfse), a frequency list (.rfreq `freqs`) or a request (.rfreq `request`, also as link). */
export function parseRfFile(text: string): RfImport {
  let js: any;
  const t = text.trim();
  const i = t.indexOf('rfreq=');
  try {
    js = i >= 0 ? JSON.parse(decodeURIComponent(escape(atob(t.slice(i + 6).split(/[&\s]/)[0].replace(/-/g, '+').replace(/_/g, '/'))))) : JSON.parse(t);
  } catch {
    throw new Error('Datei konnte nicht gelesen werden (kein JSON / kein RF-Link).');
  }
  if (js && js.app === 'RF Scan Editor') {
    const reqs: any[] = js.coordPlan?.requests ?? [];
    const list: any[] = Array.isArray(js.freqList) ? js.freqList : [];
    const devices: RfImportDevice[] = [];
    for (const r of reqs) {
      const prod = rfProductById(r.model);
      const per = prod?.ch || 0;
      const units = per ? Math.max(1, r.units || Math.ceil((r.count || per) / per)) : 1;
      const total = per ? units * per : Math.max(1, r.count || 1);
      const prim = list.filter((e) => e.reqId === r.id && !e.backup && typeof e.f === 'number' && e.ch);
      const baks = list.filter((e) => e.reqId === r.id && e.backup && typeof e.f === 'number').map((e) => e.f);
      const names: string[] = r.names || [];
      for (let u = 0; u < units; u++) {
        const n = per || total;
        const channels: RfChannel[] = Array.from({ length: n }, (_, k) => {
          const ch = u * n + k + 1;
          const e = prim.find((x) => x.ch === ch);
          return { name: e?.name || names[ch - 1] || undefined, f: e?.f };
        });
        devices.push({
          product: r.model || '',
          name: units > 1 && r.prefix ? `${r.prefix} ${u + 1}` : r.prefix || (prod ? prod.model : r.model || 'Gerät'),
          band: bandOfProfile(r.profileId), zone: r.zone || '', channels, backups: u === 0 ? baks : [],
        });
      }
    }
    return { kind: 'devices', source: `RF-Projekt „${js.name || 'ohne Namen'}“`, devices };
  }
  if (js && js.v === 1 && js.t === 'freqs') {
    return { kind: 'freqs', source: `Frequenzliste ${js.project ? '„' + js.project + '“' : ''}`.trim(), items: (js.items || []).map((x: any) => ({ name: String(x.name || ''), f: Number(x.f), backup: !!x.backup, device: x.device || '', zone: x.zone || '' })) };
  }
  if (js && js.v === 1 && js.t === 'request') {
    const devices: RfImportDevice[] = [];
    for (const dv of js.devices || []) {
      const prod = rfProductById(dv.model);
      const units = prod?.ch ? Math.max(1, dv.units || 1) : 1;
      for (let u = 0; u < units; u++) {
        const n = prod?.ch || Math.max(1, dv.count || 1);
        devices.push({
          product: dv.model || '', name: units > 1 ? `${dv.name || prod?.model || 'Gerät'} ${u + 1}` : dv.name || prod?.model || 'Gerät',
          band: bandOfProfile(dv.profileId), zone: js.zone || '',
          channels: Array.from({ length: n }, (_, k) => ({ name: (dv.names || [])[u * n + k] || undefined })), backups: [],
        });
      }
    }
    return { kind: 'devices', source: `Anfrage von ${js.from?.name || 'unbekannt'}`, devices };
  }
  throw new Error('Keine Datei des RF Frequency Manager (.rfse oder .rfreq erwartet).');
}

export const rfDataFromImport = (d: RfImportDevice, prod?: RfProduct): RfDeviceData => ({
  product: prod && d.product ? d.product : undefined,
  band: d.band, zone: d.zone || undefined,
  channels: d.channels.map((c) => ({ name: c.name, f: c.f })),
  backups: d.backups.length ? d.backups : undefined,
});

/** frequency list → existing devices: channel names are matched (case-insensitive) across all racks */
export function applyFrequencyList(project: Project, items: { name: string; f: number; backup: boolean }[]) {
  const key = (s: string) => s.trim().toLowerCase();
  const index = new Map<string, { rack: Rack; dev: PlacedDevice; ch: number }>();
  const devByName = new Map<string, PlacedDevice>();
  for (const rack of project.racks) for (const d of rack.devices) {
    const tpl = project.templates[d.templateId];
    const prod = rfProductOf(tpl, d);
    if (!tpl || !prod) continue;
    const n = channelCount(prod, d);
    for (let i = 0; i < n; i++) index.set(key(channelLabel(d, tpl, i, n)), { rack, dev: d, ch: i });
    devByName.set(key(d.label || tpl.name), d);
  }
  let matched = 0;
  const unmatched: string[] = [];
  const touchedBackups = new Set<PlacedDevice>();
  for (const it of items) {
    if (!Number.isFinite(it.f)) continue;
    const hit = index.get(key(it.name));
    if (hit && !it.backup) {
      const tpl = project.templates[hit.dev.templateId];
      const n = channelCount(rfProductOf(tpl, hit.dev), hit.dev);
      const rf: RfDeviceData = { ...(hit.dev.rf || {}) };
      const chans = Array.from({ length: n }, (_, i) => ({ ...(rf.channels?.[i] || {}) }));
      chans[hit.ch] = { name: chans[hit.ch].name || it.name, f: it.f };
      rf.channels = chans;
      hit.dev.rf = rf;
      matched++;
    } else if (it.backup && (hit || devByName.get(key(it.name)))) {
      const dev = hit ? hit.dev : devByName.get(key(it.name))!;
      if (!touchedBackups.has(dev)) { dev.rf = { ...(dev.rf || {}), backups: [] }; touchedBackups.add(dev); }
      dev.rf!.backups = [...(dev.rf!.backups || []), it.f];
      matched++;
    } else unmatched.push(`${it.name || '(ohne Name)'} ${fmtMHz(it.f)} MHz`);
  }
  return { matched, unmatched };
}

/** short text for lists / PDF: "G50 · Zone A · Vox 1 470.250, Vox 2 472.125" */
export function rfSummary(project: Project, d: PlacedDevice): string {
  const tpl = project.templates[d.templateId];
  const prod = rfProductOf(tpl, d);
  if (!prod || !d.rf) return '';
  const n = channelCount(prod, d);
  const ch = Array.from({ length: n }, (_, i) => d.rf?.channels?.[i]).map((c, i) => (c?.f ? `${channelLabel(d, tpl, i, n)} ${fmtMHz(c.f)}` : '')).filter(Boolean);
  return [d.rf.band ? `Band ${d.rf.band}` : '', d.rf.zone ? `Zone ${d.rf.zone}` : '', ch.join(', '), d.rf.backups?.length ? `Backup ${d.rf.backups.map(fmtMHz).join(', ')}` : ''].filter(Boolean).join('; ');
}
