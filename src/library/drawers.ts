import type { DeviceTemplate } from '../model/types';

/*
 * Rack drawers with the manufacturer's inner dimensions. They are normal device templates (category "Schubladen") and
 * the inlay designer offers them as templates for a new drawer inlay. Inner size: l = usable width (left to right),
 * w = usable depth (front to back), h = usable height, all mm. `source` names where the inner size comes from.
 */

interface DrawerSpec { id: string; name: string; man: string; u: number; inner: { l: number; w: number; h: number }; depth?: number; color?: string; src: string; note?: string; hEst?: boolean }

const D: DrawerSpec[] = [
  // Adam Hall 19" Parts
  { id: 'ah-87402', name: '87402 Rackschublade 2 HE', man: 'Adam Hall', u: 2, inner: { l: 401, w: 383, h: 74 }, src: 'Adam Hall technisches Datenblatt 87402: innen 401 × 383 × 74 mm (Thomann nennt 200 mm Tiefe)' },
  { id: 'ah-87403', name: '87403 Rackschublade 3 HE', man: 'Adam Hall', u: 3, inner: { l: 401, w: 373, h: 120 }, src: 'Händlerangabe (Thomann) 87403: innen 120 × 401 × 373 mm (H × B × T)' },
  { id: 'ah-87404', name: '87404 Rackschublade 4 HE', man: 'Adam Hall', u: 4, inner: { l: 401, w: 373, h: 175 }, src: 'Adam Hall Produktseite 87404: innen 401 × 175 × 373 mm (B × H × T)' },
  // Penn Elcom
  { id: 'pe-r1291k-2l', name: 'R1291K/2L Schublade 1 HE', man: 'Penn Elcom', u: 1, inner: { l: 415, w: 364, h: 41 }, src: 'Penn Elcom Produktseite R1291K/2L: innen 16,34" × 14,33" × 1,61"' },
  { id: 'pe-r2292-18-2uk', name: 'R2292-18-2UK Schublade 2 HE, 18"', man: 'Penn Elcom', u: 2, inner: { l: 409, w: 475, h: 74 }, src: 'Penn Elcom Produktseite R2292-18-2UK: innen 409 × 475 × 74 mm' },
  { id: 'pe-r2295-10-2uk', name: 'R2295-10-2UK Schublade 2 HE, 10" (Alu)', man: 'Penn Elcom', u: 2, inner: { l: 409, w: 275, h: 74 }, hEst: true, src: 'Penn Elcom Produktseite R2295-10-2UK: innen 409 mm breit, 275 mm tief; Höhe wie andere 2-HE-Schubladen angenommen' },
  { id: 'pe-r2293-3uk', name: 'R2293-3UK Schublade 3 HE', man: 'Penn Elcom', u: 3, inner: { l: 409, w: 375, h: 119 }, src: 'Händlerangabe (Markertek) R2293-3UK: innen 4,69" hoch, 14,76" tief, 409 mm breit' },
  { id: 'pe-r2295-10-4uk', name: 'R2295-10-4UK Schublade 4 HE, 10" (Alu)', man: 'Penn Elcom', u: 4, inner: { l: 409, w: 275, h: 163 }, src: 'Penn Elcom Produktseite R2295-10-4UK: innen 409 × 275 × 163 mm' },
  { id: 'pe-r1296k', name: 'R1296K Schublade 6 HE', man: 'Penn Elcom', u: 6, inner: { l: 409, w: 360, h: 250 }, src: 'Penn Elcom FAQ R1296K: innen T 360 × B 409 × H 250 mm' },
  { id: 'pe-r2293-8uk', name: 'R2293-8UK Schublade 8 HE', man: 'Penn Elcom', u: 8, inner: { l: 409, w: 375, h: 341 }, src: 'Penn Elcom Produktseite R2293-8UK: innen 409 × 375 × 341 mm' },
  // Middle Atlantic UD series
  { id: 'ma-ud1', name: 'UD1 Utility Drawer 1 HE', man: 'Middle Atlantic', u: 1, inner: { l: 403, w: 340, h: 30 }, hEst: true, src: 'Middle Atlantic UD-Serie Datenblatt: innen 15 7/8" breit, 13 3/8" tief; Höhe nicht angegeben, geschätzt' },
  { id: 'ma-ud2', name: 'UD2 Utility Drawer 2 HE', man: 'Middle Atlantic', u: 2, inner: { l: 405, w: 368, h: 74 }, hEst: true, src: 'Middle Atlantic UD-Serie Datenblatt: innen 15,94" breit, 14,5" tief; Höhe nicht angegeben, geschätzt' },
  { id: 'ma-ud3', name: 'UD3 Utility Drawer 3 HE', man: 'Middle Atlantic', u: 3, inner: { l: 405, w: 368, h: 119 }, hEst: true, src: 'Middle Atlantic UD-Serie Datenblatt: innen 15,94" breit, 14,5" tief; Höhe nicht angegeben, geschätzt' },
  { id: 'ma-ud4', name: 'UD4 Utility Drawer 4 HE', man: 'Middle Atlantic', u: 4, inner: { l: 405, w: 368, h: 163 }, hEst: true, src: 'Middle Atlantic UD-Serie Datenblatt: innen 15,94" breit, 14,5" tief; Höhe nicht angegeben, geschätzt' },
  // Thomann Thon
  { id: 'thon-drawer-2u-short', name: 'Rack Drawer 2 HE kurz', man: 'Thon', u: 2, inner: { l: 404, w: 210, h: 74 }, depth: 220, src: 'Thomann Produktseite (Art. 417809): innen 404 × 210 × 74 mm (B × T × H)' },
  { id: 'thon-drawer-4u', name: 'Rackschublade 4 HE', man: 'Thon', u: 4, inner: { l: 386, w: 374, h: 155 }, depth: 388, src: 'Thomann Produktseite (Art. 107353): innen 155 × 374 × 386 mm, Achsen nicht beschriftet (Breite/Tiefe angenommen)' },
];

export const DRAWER_DEVICES: DeviceTemplate[] = D.map((d) => ({
  id: d.id, name: d.name, manufacturer: d.man, category: 'Schubladen', heightU: d.u, rackStandard: 19, slots: 1,
  depth: d.depth ?? d.inner.w + 20, color: d.color ?? '#202022', textColor: '#e5e7eb', drawer: true, ports: [],
  drawerInner: d.hEst ? { ...d.inner, hEstimated: true } : d.inner, source: `Datenblatt – ${d.src}`,
  notes: `Innenmaß ${d.inner.l} × ${d.inner.w} × ${d.inner.h} mm (B × T × H)${d.hEst ? ', Höhe geschätzt' : ''}. Inhalt im Eigenschaften-Bereich eintragen.`,
}));
