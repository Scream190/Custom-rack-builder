/*
 * Case parts library: panels, aluminium profiles and hardware with manufacturer part numbers and dimensions.
 *
 * Source: parts database of the case design program AutoCase 3D Case Design (data version V.0.15, 2024), evaluated
 * read-only in 11/2026 (autocase-auswertung.md). Only facts are taken over: manufacturer, part number, type and the
 * dimensions the database lists. No prices, no drawings, no 3D models. Weights of profiles are calculated from the
 * cross-section (aluminium 2.7 g/cm³) and are estimates.
 */

export type PartMaker = 'Penn Elcom' | 'Adam Hall' | 'Autocase';

// ---------------------------------------------------------------- panels

export interface PanelMaterial {
  id: string;
  label: string;
  maker: PartMaker;
  /** available thicknesses in mm */
  thicknesses: number[];
  colors: string[];
  /** density estimate in kg/m³ (Schätzung) */
  density: number;
  /** sheet size in mm, where the database states it */
  sheet?: [number, number];
  /** example part numbers */
  skus: string[];
}

export const PANEL_MATERIALS: PanelMaterial[] = [
  { id: 'abs-birch', label: 'Birke-Multiplex mit ABS', maker: 'Penn Elcom', thicknesses: [10, 13], colors: ['Schwarz', 'Blau', 'Dunkelblau', 'Grün', 'Grau', 'Hellgrau', 'Neongrün', 'Orange', 'Pink', 'Lila', 'Rot', 'Silber', 'Weiß', 'Gelb'], density: 700, skus: ['M842113BIR', 'M842213BIR', 'M842313BIR'] },
  { id: 'abs-luan', label: 'Luan-Sperrholz mit ABS', maker: 'Penn Elcom', thicknesses: [6.2, 10, 13], colors: ['Schwarz', 'Blau', 'Dunkelblau', 'Grün', 'Grau', 'Hellgrau', 'Neongrün', 'Orange', 'Pink', 'Lila', 'Rot', 'Silber', 'Weiß', 'Gelb'], density: 560, skus: ['M842113', 'M842213', 'M842313'] },
  { id: 'corerigid', label: 'CoreRigid', maker: 'Penn Elcom', thicknesses: [7, 9, 12, 19], colors: ['Schwarz'], density: 650, skus: ['M868007', 'M868009', 'M868012'] },
  { id: 'flight-panel', label: 'Flight Panel (Birke, Phenolharz)', maker: 'Penn Elcom', thicknesses: [4.5, 7, 10], colors: ['Schwarz', 'Blau', 'Grau', 'Rot', 'Silber', 'Steingrau'], density: 680, sheet: [2300, 1580], skus: ['M865004', 'M865007', 'M865107'] },
  { id: 'hd-flight-panel', label: 'Heavy Duty Flight Panel', maker: 'Penn Elcom', thicknesses: [10, 11], colors: ['Schwarz'], density: 720, skus: ['X15110S', 'X300010S'] },
  { id: 'hexaboard', label: 'Hexaboard (Birke, Sechseckprägung)', maker: 'Penn Elcom', thicknesses: [6.5, 9, 12, 19], colors: ['Schwarz'], density: 690, sheet: [2440, 1220], skus: ['M847108', 'M847111', 'M847113'] },
  { id: 'honeycomb', label: 'Leichtbauplatte Wabenkern', maker: 'Penn Elcom', thicknesses: [7, 10, 13], colors: ['Schwarz'], density: 330, skus: ['M855108', 'M855111', 'M855113'] },
  { id: 'birch-raw', label: 'Birke-Multiplex roh', maker: 'Penn Elcom', thicknesses: [6, 6.5, 9, 12, 15, 18, 19], colors: ['Holz'], density: 680, sheet: [2440, 1220], skus: ['M870006', 'M870065', 'M870009'] },
  { id: 'luan-raw', label: 'Luan-Sperrholz roh', maker: 'Penn Elcom', thicknesses: [5.2, 9, 12], colors: ['Holz'], density: 540, skus: ['M840009', 'M840012', 'M840005'] },
  { id: 'pvc-birch', label: 'Birke-Multiplex mit PVC (strukturiert)', maker: 'Penn Elcom', thicknesses: [5, 7, 9.5, 12.5], colors: ['Schwarz', 'Blau', 'Grau', 'Rot', 'Gelb'], density: 700, sheet: [2440, 1220], skus: ['M876012', 'M876112', 'M876212'] },
  { id: 'pvc-luan', label: 'Luan-Sperrholz mit PVC (strukturiert)', maker: 'Penn Elcom', thicknesses: [4.5, 6, 9.5, 12.5], colors: ['Schwarz', 'Blau', 'Grau', 'Rot'], density: 570, skus: ['M866012', 'M866112', 'M866212'] },
  { id: 'pvc-smooth-birch', label: 'Birke-Multiplex mit PVC (glatt)', maker: 'Penn Elcom', thicknesses: [4.5, 7, 9.5], colors: ['Schwarz', 'Blau', 'Grau', 'Rot'], density: 700, skus: ['M1619', 'M1621', 'M1623'] },
  { id: 'ultraflite', label: 'UltraFlite (Kunststoff-Leichtbau)', maker: 'Penn Elcom', thicknesses: [9.7], colors: ['Schwarz'], density: 420, skus: ['X200010'] },
];

export const panelMaterial = (id?: string) => PANEL_MATERIALS.find((m) => m.id === id);
/** sheet size for the cutting estimate (2440 × 1220 mm when the material does not state one) */
export const sheetOf = (id?: string): [number, number] => panelMaterial(id)?.sheet ?? [2440, 1220];

// ---------------------------------------------------------------- profiles

/** 'hybrid' = hybrid closing profile (lid split), 'tongue'/'groove' = tongue and groove pair, 'double' = double angle
 * (panel in a slot), 'single' = single angle (riveted on) */
export type ProfileKind = 'hybrid' | 'tongue' | 'groove' | 'double' | 'single';

export interface Profile {
  sku: string;
  maker: PartMaker;
  kind: ProfileKind;
  /** panel thickness range in mm */
  panel?: [number, number];
  /** legs in mm */
  legs: [number, number];
  /** wall thickness in mm */
  wall?: number;
  /** slot depth (double angle) or tooth depth (hybrid) in mm */
  depth?: number;
  /** outer thickness (hybrid) in mm */
  outer?: number;
  /** matching profile (tongue and groove) */
  mate?: string;
  /** stock length in m */
  stock: number;
}

const P = (sku: string, maker: PartMaker, kind: ProfileKind, legs: [number, number], o: Partial<Profile> = {}): Profile => ({ sku, maker, kind, legs, stock: 4, ...o });

export const PROFILES: Profile[] = [
  // hybrid closing profiles: panel range, short and long side, outer thickness, tooth depth, wall
  P('E6202', 'Adam Hall', 'hybrid', [23, 27], { panel: [6, 8.5], outer: 10, depth: 4, wall: 1.5 }),
  P('E6304', 'Adam Hall', 'hybrid', [22.5, 27.5], { panel: [8.5, 11], outer: 12.5, depth: 5, wall: 1.5 }),
  P('E0450', 'Penn Elcom', 'hybrid', [15, 15], { panel: [4, 6.5], outer: 8, depth: 3, wall: 1.4 }),
  P('E0455', 'Penn Elcom', 'hybrid', [15, 15], { panel: [5, 7.5], outer: 9.5, depth: 3, wall: 1.4 }),
  P('E0825', 'Penn Elcom', 'hybrid', [27, 27], { panel: [8, 10.5], outer: 12.8, depth: 4, wall: 1.27 }),
  P('E082571', 'Penn Elcom', 'hybrid', [23, 27], { panel: [8, 10.5], outer: 12.8, depth: 4, wall: 1.67 }),
  P('E0826', 'Penn Elcom', 'hybrid', [26.7, 26.7], { panel: [11, 13.5], outer: 15.4, depth: 4, wall: 1.182 }),
  P('E0850', 'Penn Elcom', 'hybrid', [27.2, 26.6], { panel: [5, 7.5], outer: 10, depth: 4, wall: 1.4 }),
  P('E2290', 'Penn Elcom', 'hybrid', [12, 15], { panel: [2.2, 4.7], outer: 6.4, depth: 3, wall: 1.2 }),
  P('E2295', 'Penn Elcom', 'hybrid', [16.5, 20.5], { panel: [5, 7.5], outer: 10, depth: 4, wall: 1.5 }),
  P('E2300', 'Penn Elcom', 'hybrid', [16.5, 21.5], { panel: [8, 10.5], outer: 12.5, depth: 5, wall: 1.5 }),
  P('E2305', 'Penn Elcom', 'hybrid', [23, 27], { panel: [5, 7.5], outer: 10, depth: 4, wall: 1.5 }),
  P('E2310', 'Penn Elcom', 'hybrid', [22.5, 27.5], { panel: [8, 10.5], outer: 14, depth: 5, wall: 1.5 }),
  P('E2315', 'Penn Elcom', 'hybrid', [22.5, 27.5], { panel: [8, 10.5], outer: 13, depth: 4, wall: 1.5 }),
  P('E2317', 'Penn Elcom', 'hybrid', [27.5, 27.5], { panel: [8, 10.5], outer: 13.5, depth: 4.9, wall: 1.5 }),
  P('E2320', 'Penn Elcom', 'hybrid', [25, 30], { panel: [11, 13.5], outer: 16, depth: 5, wall: 1.5 }),
  P('E2375', 'Penn Elcom', 'hybrid', [22.551, 27.5], { panel: [8, 10.5], outer: 14, depth: 4, wall: 1.5 }),
  P('E2395', 'Penn Elcom', 'hybrid', [27, 27], { panel: [5, 7.5], outer: 10.2, depth: 2, wall: 1.35 }),
  P('E2507', 'Penn Elcom', 'hybrid', [23, 27], { panel: [5, 7.5], outer: 10, depth: 4, wall: 1.5 }),
  // double angles (panel in a slot): legs, panel range, slot depth, wall (0 = not stated)
  P('3023', 'Penn Elcom', 'double', [35, 35], { panel: [11.7, 14.2], depth: 18.7, wall: 1.5 }),
  P('3050', 'Penn Elcom', 'double', [32, 32], { panel: [5.6, 8.1], depth: 20, wall: 1.4 }),
  P('3051', 'Penn Elcom', 'double', [31.8, 31.8], { panel: [4.7, 7.2], depth: 21.6 }),
  P('3053', 'Penn Elcom', 'double', [28.6, 28.6], { panel: [4.86, 7.36], depth: 18.02, wall: 1.6 }),
  P('3070', 'Penn Elcom', 'double', [35, 35], { panel: [10.7, 13.2], depth: 19, wall: 1.6 }),
  P('3109', 'Penn Elcom', 'double', [31.75, 31.75], { panel: [8.54, 11.04], depth: 17.98, wall: 1.6 }),
  P('E0875', 'Penn Elcom', 'double', [29.75, 29.75], { panel: [8.3, 10.8], depth: 16.5, wall: 1.5 }),
  P('E0876', 'Penn Elcom', 'double', [29.75, 29.75], { panel: [11, 13.5], depth: 14, wall: 1.5 }),
  P('E0885', 'Penn Elcom', 'double', [30, 30], { panel: [4.8, 7.3], depth: 20.4 }),
  P('E2255', 'Penn Elcom', 'double', [35, 35], { panel: [9, 11.5], depth: 20, wall: 1.5 }),
  P('E2260', 'Penn Elcom', 'double', [17, 17], { panel: [2, 4.5], depth: 10, wall: 1.2 }),
  P('E2265', 'Penn Elcom', 'double', [30, 30], { panel: [7.6, 10.1], depth: 17, wall: 1.5 }),
  P('E2270', 'Penn Elcom', 'double', [30, 30], { panel: [5, 7.5], depth: 20 }),
  P('E2385', 'Penn Elcom', 'double', [17, 17], { panel: [3, 5.5], depth: 9, wall: 1.5 }),
  P('E2390', 'Penn Elcom', 'double', [30, 30], { panel: [5.7, 8.2], depth: 20, wall: 1.5 }),
  P('E6426', 'Penn Elcom', 'double', [30, 30], { panel: [8.3, 10.8], depth: 16.7, wall: 1.5 }),
  P('E6448', 'Penn Elcom', 'double', [30, 30], { panel: [5, 7.5], depth: 20, wall: 1.5 }),
  // single angles (riveted on the outside, any panel thickness)
  P('6105', 'Adam Hall', 'single', [30, 30], { wall: 1.5 }),
  P('6111', 'Adam Hall', 'single', [35, 35], { wall: 2 }),
  P('E0800', 'Penn Elcom', 'single', [34.5, 34.5], { wall: 3 }),
  P('E0801', 'Penn Elcom', 'single', [37, 37], { wall: 2 }),
  P('E0810', 'Penn Elcom', 'single', [29.7, 19], { wall: 1.5 }),
  P('E0815', 'Penn Elcom', 'single', [22, 22], { wall: 1.5 }),
  P('E2275', 'Penn Elcom', 'single', [22, 22], { wall: 1.5 }),
  P('E2280', 'Penn Elcom', 'single', [30, 30], { wall: 1.5 }),
  P('E2285', 'Penn Elcom', 'single', [30, 20.5], { wall: 1.5 }),
  // tongue and groove closing profiles (pairs)
  P('3016-FT', 'Penn Elcom', 'tongue', [22.22, 22.22], { panel: [5, 7.5], mate: '3017-FT' }),
  P('3017-FT', 'Penn Elcom', 'groove', [22.22, 22.22], { panel: [5, 7.5], mate: '3016-FT' }),
  P('3018', 'Penn Elcom', 'tongue', [22.22, 22.2], { panel: [5.62, 8.12], mate: '3019' }),
  P('3019', 'Penn Elcom', 'groove', [22.22, 22.22], { panel: [5.62, 8.12], mate: '3018' }),
  P('3020', 'Penn Elcom', 'tongue', [6.35, 22.35], { panel: [5.62, 8.12], mate: '3022' }),
  P('3022', 'Penn Elcom', 'groove', [22.35, 11.43], { panel: [5.62, 8.12], mate: '3020' }),
  P('3024', 'Penn Elcom', 'tongue', [24, 24], { panel: [11.69, 14.19], mate: '3025' }),
  P('3025', 'Penn Elcom', 'groove', [24, 24], { panel: [11.69, 14.19], mate: '3024' }),
  P('3030', 'Penn Elcom', 'tongue', [21.97, 13.97], { panel: [10.7, 13.2], mate: '3032' }),
  P('3032', 'Penn Elcom', 'groove', [18.8, 21.97], { panel: [10.7, 13.2], mate: '3030' }),
  P('3100', 'Penn Elcom', 'tongue', [8.64, 22.22], { panel: [8.67, 11.17], mate: '3103' }),
  P('3103', 'Penn Elcom', 'groove', [13.97, 22.22], { panel: [8.67, 11.17], mate: '3100' }),
  P('3104', 'Penn Elcom', 'tongue', [22.22, 22.22], { panel: [8.67, 11.17], mate: '3105' }),
  // the database states 8.67 to 8.67 for 3105, the range of its tongue 3104 is used
  P('3105', 'Penn Elcom', 'groove', [22.22, 22.22], { panel: [8.67, 11.17], mate: '3104' }),
  P('EG-0310/1', 'Penn Elcom', 'tongue', [17, 17], { panel: [5, 7.5], mate: 'EG-0310/2' }),
  P('EG-0310/2', 'Penn Elcom', 'groove', [20, 20], { panel: [5, 7.5], mate: 'EG-0310/1' }),
  P('EG-0315/1', 'Penn Elcom', 'tongue', [15.5, 15.5], { panel: [2, 4.5], mate: 'EG-0315/2' }),
  P('EG-0315/2', 'Penn Elcom', 'groove', [18.5, 18.5], { panel: [2, 4.5], mate: 'EG-0315/1' }),
  P('EG-0320/1', 'Penn Elcom', 'tongue', [19.8, 19.8], { panel: [4.4, 6.9], mate: 'EG-0320/2' }),
  P('EG-0320/2', 'Penn Elcom', 'groove', [19.8, 19.8], { panel: [4.4, 6.9], mate: 'EG-0320/1' }),
  P('EG-0500/1', 'Penn Elcom', 'tongue', [20, 20], { panel: [7.5, 10], mate: 'EG-0500/2' }),
  P('EG-0500/2', 'Penn Elcom', 'groove', [23, 23], { panel: [7.5, 10], mate: 'EG-0500/1' }),
  P('EG-0521/1', 'Penn Elcom', 'tongue', [20, 20], { panel: [8.2, 10.7], mate: 'EG-0521/2' }),
  P('EG-0521/2', 'Penn Elcom', 'groove', [23, 23], { panel: [8.2, 10.7], mate: 'EG-0521/1' }),
  P('EG-0521/1E', 'Penn Elcom', 'tongue', [20, 20], { panel: [8.2, 10.7], mate: 'EG-0521/2E' }),
  P('EG-0521/2E', 'Penn Elcom', 'groove', [23, 23], { panel: [8.2, 10.7], mate: 'EG-0521/1E' }),
  P('EG-0522/1', 'Penn Elcom', 'tongue', [20.6, 20.6], { panel: [8.2, 10.7], mate: 'EG-0522/2' }),
  P('EG-0522/2', 'Penn Elcom', 'groove', [24, 24], { panel: [8.2, 10.7], mate: 'EG-0522/1' }),
  P('EG-0522/1E', 'Penn Elcom', 'tongue', [20.6, 20.6], { panel: [8.2, 10.7], mate: 'EG-0522/2E' }),
  P('EG-0522/2E', 'Penn Elcom', 'groove', [24, 24], { panel: [8.2, 10.7], mate: 'EG-0522/1E' }),
  P('EG-0523/1', 'Penn Elcom', 'tongue', [20.5, 20.5], { panel: [8.2, 10.7], mate: 'EG-0523/2' }),
  P('EG-0523/2', 'Penn Elcom', 'groove', [24, 24], { panel: [8.2, 10.7], mate: 'EG-0523/1' }),
  P('EG-0524/1', 'Penn Elcom', 'tongue', [20.5, 20.5], { panel: [8.2, 10.7], mate: 'EG-0524/2' }),
  P('EG-0524/2', 'Penn Elcom', 'groove', [24, 24], { panel: [8.2, 10.7], mate: 'EG-0524/1' }),
];

export const PROFILE_KIND_LABELS: Record<ProfileKind, string> = {
  hybrid: 'Hybrid-Schließprofil', tongue: 'Nut-Feder-Profil (Feder)', groove: 'Nut-Feder-Profil (Nut)', double: 'Doppelwinkel', single: 'Einfachwinkel',
};

export const profileBySku = (sku?: string) => PROFILES.find((p) => p.sku === sku);

/** profiles of a kind that take a panel of this thickness (single angles fit every panel) */
export function profilesFor(kind: ProfileKind | ProfileKind[], panel: number): Profile[] {
  const kinds = Array.isArray(kind) ? kind : [kind];
  return PROFILES.filter((p) => kinds.includes(p.kind) && (!p.panel || (panel >= p.panel[0] - 0.01 && panel <= p.panel[1] + 0.01)));
}

/** weight per metre from the cross-section (estimate): legs × wall, slot walls of double angles counted twice */
export function profileKgPerM(p: Profile): number {
  const wall = p.wall || 1.5;
  const legs = p.legs[0] + p.legs[1];
  const extra = p.kind === 'double' ? 2 * (p.depth ?? 18) : p.kind === 'hybrid' ? 2 * (p.outer ?? 10) + 2 * (p.depth ?? 4) : p.kind === 'single' ? 0 : 12;
  return Math.round((legs + extra) * wall * 2.7) / 1000;
}

export const profileLabel = (p: Profile) => {
  const leg = p.legs[0] === p.legs[1] ? `${fmt(p.legs[0])} mm` : `${fmt(p.legs[0])} × ${fmt(p.legs[1])} mm`;
  const range = p.panel ? `, Platte ${fmt(p.panel[0])} bis ${fmt(p.panel[1])} mm` : '';
  return `${p.maker} ${p.sku}: ${PROFILE_KIND_LABELS[p.kind]} ${leg}${range}`;
};
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// ---------------------------------------------------------------- hardware

/** what a part is for (matches the hardware kinds of the case designer where one exists) */
export type PartGroup = 'corner' | 'brace' | 'handle' | 'latch' | 'hinge' | 'castor' | 'dish' | 'foot' | 'fixing';

export interface HardwarePart {
  sku: string;
  maker: PartMaker;
  group: PartGroup;
  /** type as the database lists it, in German */
  type: string;
  /** short description (German) */
  desc: string;
  /** offset of a cranked part in mm (fits over an angle) */
  crank?: number;
  /** hardware kind of the case designer this part can be used as */
  as?: string[];
}

const H = (sku: string, maker: PartMaker, group: PartGroup, type: string, desc: string, as?: string[], crank?: number): HardwarePart => ({ sku, maker, group, type, desc, as, crank });

export const HARDWARE_PARTS: HardwarePart[] = [
  // ball corners
  H('410429', 'Adam Hall', 'corner', 'Kugelecke groß, dreischenklig', 'gekröpft 35 mm, 9 Löcher', undefined, 35),
  H('41076', 'Adam Hall', 'corner', 'Kugelecke groß, dreischenklig', 'gekröpft 30 mm, 6 Löcher', undefined, 30),
  H('4124', 'Adam Hall', 'corner', 'Kugelecke mittel, dreischenklig', 'gekröpft 30 mm', undefined, 30),
  H('C1359Z', 'Penn Elcom', 'corner', 'Kugelecke mit Winkel', 'Brace Ball Corner'),
  H('C1373', 'Penn Elcom', 'corner', 'Kugelecke mit Winkel', 'Brace Ball Corner'),
  H('C1374/00/90', 'Penn Elcom', 'corner', 'Kugelecke mit Winkel', 'Brace Ball Corner'),
  H('C0650Z', 'Penn Elcom', 'corner', 'Kugelecke groß', 'Large Ball Corner'),
  H('C1340/30Z', 'Penn Elcom', 'corner', 'Kugelecke groß', 'Large Ball Corner, Kröpfung 30 mm', undefined, 30),
  H('C1351Z', 'Penn Elcom', 'corner', 'Kugelecke groß', 'Large Ball Corner, Kröpfung 30 mm', undefined, 30),
  H('C1377/30Z', 'Penn Elcom', 'corner', 'Kugelecke groß', 'Large Ball Corner, Kröpfung 30 mm', undefined, 30),
  H('C1081Z', 'Penn Elcom', 'corner', 'Flachecke groß', 'Kugelecke mittel verzinkt, 30 mm Versatz'),
  H('C1086/10/60', 'Penn Elcom', 'corner', 'Flachecke groß', 'Kugelecke mit Winkel, 30 mm Versatz, Radius 1 mm'),
  H('C1186', 'Penn Elcom', 'corner', 'Flachecke groß', 'Flachecke mittel verzinkt'),
  H('C1851/30', 'Penn Elcom', 'corner', 'Flachecke groß', 'Flachecke groß verzinkt, 30 mm Versatz'),
  H('C1182Z', 'Penn Elcom', 'corner', 'Flachecke mittel', 'Medium Flat Corner'),
  // braces
  H('40403', 'Adam Hall', 'brace', 'Eckwinkel', '40 × 34 mm für 35-mm-Kantenprofil'),
  H('40404', 'Adam Hall', 'brace', 'Eckwinkel', '60 × 50 mm gekröpft für Profil 6110'),
  H('4043', 'Adam Hall', 'brace', 'Eckwinkel', '40 × 28 mm mit Sicke'),
  H('4053', 'Adam Hall', 'brace', 'Eckwinkel', '42 × 52 mm gekröpft'),
  H('4054', 'Adam Hall', 'brace', 'Eckwinkel', '47 × 52 mm gekröpft'),
  H('B1121', 'Penn Elcom', 'brace', 'Eckwinkel 4 Loch', '4 Hole Brace'),
  H('B1130Z', 'Penn Elcom', 'brace', 'Eckwinkel 4 Loch', '4 Hole Brace'),
  H('B1930', 'Penn Elcom', 'brace', 'Eckwinkel 4 Loch', 'mit Verstärkungsrippen, 35,5 × 40 mm'),
  H('B1933/R1/1Z', 'Penn Elcom', 'brace', 'Eckwinkel 4 Loch', 'mit Nietschutz, 56 × 35 mm'),
  H('B1123', 'Penn Elcom', 'brace', 'Eckwinkel 6 Loch', 'groß, Kröpfung 30 mm', undefined, 30),
  H('B1128', 'Penn Elcom', 'brace', 'Eckwinkel 6 Loch', 'Kröpfung 30 mm', undefined, 30),
  // handles
  H('34082', 'Adam Hall', 'handle', 'Klappgriff versenkt, gefedert', 'mittel, in Schale 8 mm tief', ['handle-recessed']),
  H('34087', 'Adam Hall', 'handle', 'Klappgriff versenkt, gefedert', 'groß, in Schale 9,5 mm tief, mit Nietschutz', ['handle-recessed']),
  H('H1190', 'Penn Elcom', 'handle', 'Kofferhandgriff', 'Briefcase Handle', ['handle-surface']),
  H('H2026', 'Penn Elcom', 'handle', 'Eckgriff', 'schwarz', ['handle-surface']),
  H('H7165/10Z', 'Penn Elcom', 'handle', 'Klappgriff versenkt groß', 'Large Recessed Handle', ['handle-recessed']),
  H('H7165Z', 'Penn Elcom', 'handle', 'Klappgriff versenkt groß', 'Large Recessed Handle', ['handle-recessed']),
  H('H7148Z', 'Penn Elcom', 'handle', 'Klappgriff versenkt mittel', 'Medium Recessed Handle', ['handle-recessed']),
  H('H7151Z', 'Penn Elcom', 'handle', 'Klappgriff versenkt mittel', 'Medium Recessed Handle', ['handle-recessed']),
  H('H7154Z', 'Penn Elcom', 'handle', 'Klappgriff versenkt mittel', 'Medium Recessed Handle', ['handle-recessed']),
  H('4080', 'Penn Elcom', 'handle', 'Teleskopgriff (Trolley)', 'Pull Out Handle', ['handle-surface']),
  H('H2000', 'Penn Elcom', 'handle', 'Teleskopgriff (Trolley)', 'Pull Out Handle', ['handle-surface']),
  H('H1052Z', 'Penn Elcom', 'handle', 'Aufschraubgriff', 'Surface Handle', ['handle-surface', 'handle-strap']),
  // latches
  H('17251S', 'Adam Hall', 'latch', 'Butterflyverschluss groß', 'mit Feder, gekröpft, 14 mm tief', ['butterfly'], 27),
  H('172572', 'Adam Hall', 'latch', 'Butterflyverschluss groß V3', 'gekröpft, 9 mm tief, mit Nietschutz', ['butterfly'], 28),
  H('17291S', 'Adam Hall', 'latch', 'Butterflyverschluss mittel', 'mit Feder, nicht gekröpft, 12 mm tief', ['butterfly-small']),
  H('17294S', 'Adam Hall', 'latch', 'Butterflyverschluss mittel', 'mit Feder, gekröpft, 14 mm tief', ['butterfly-small'], 27),
  H('L0565Z', 'Penn Elcom', 'latch', 'Spannverschluss', 'groß, verzinkt, mit Vorhängeschlosslasche', ['draw-latch']),
  H('L905/928/10', 'Penn Elcom', 'latch', 'Butterflyverschluss MOL', 'mittel, in 10-mm-Schale', ['butterfly-small']),
  H('L907/928', 'Penn Elcom', 'latch', 'Butterflyverschluss MOL', 'mittel, in 13-mm-Schale, 27 mm Versatz', ['butterfly-small'], 27),
  H('L944/537/10MOL4', 'Penn Elcom', 'latch', 'Butterflyverschluss MOL4', 'groß, in 10-mm-Schale, 27 mm Versatz', ['butterfly'], 27),
  H('L905/928SMOL3', 'Penn Elcom', 'latch', 'Butterflyverschluss SMOL3', 'mittel, in 14-mm-Schale', ['butterfly-small']),
  H('L907/928/10SMOL3', 'Penn Elcom', 'latch', 'Butterflyverschluss SMOL3', 'mittel, in 10-mm-Schale, 27 mm Versatz', ['butterfly-small']),
  H('L9075/928/10SMOL3', 'Penn Elcom', 'latch', 'Butterflyverschluss SMOL3', 'mittel, 10-mm-Schale, Versatz nur unten', ['butterfly-small']),
  H('L944/537MOL', 'Penn Elcom', 'latch', 'Butterflyverschluss MOL', 'groß, in 16-mm-Schale, 27 mm Versatz', ['butterfly']),
  H('L0350', 'Penn Elcom', 'latch', 'Verschluss', 'Miscellaneous Latch', ['draw-latch']),
  H('L0737/57', 'Penn Elcom', 'latch', 'Überfallverschluss', 'Overlatch', ['draw-latch']),
  H('L2470', 'Penn Elcom', 'latch', 'Schnappverschluss', 'Slam Latch', ['draw-latch']),
  H('L903/7336Z', 'Penn Elcom', 'latch', 'Schnappverschluss', 'Rack-Deckelverschluss', ['draw-latch']),
  H('P2472', 'Penn Elcom', 'latch', 'Schnappverschluss', 'Slam Latch', ['draw-latch']),
  H('L925/530Z', 'Penn Elcom', 'latch', 'Butterflyverschluss groß', 'in 16-mm-Schale', ['butterfly']),
  H('L905/915/10', 'Penn Elcom', 'latch', 'Butterflyverschluss mittel', 'versenkt, in 10-mm-Schale', ['butterfly-small']),
  H('L905/915Z', 'Penn Elcom', 'latch', 'Butterflyverschluss mittel', 'versenkt, in 13-mm-Schale', ['butterfly-small']),
  // hinges and lid stays
  H('270736', 'Adam Hall', 'hinge', 'Deckelstütze', 'kurz, gekröpft, mit Scharnier', ['lid-stay'], 27),
  H('270837', 'Adam Hall', 'hinge', 'Deckelstütze', 'groß, gekröpft, mit Scharnier und Rastfunktion', ['lid-stay'], 26),
  H('P1327', 'Penn Elcom', 'hinge', 'Scharnier', 'Hinge', ['hinge']),
  H('P1995', 'Penn Elcom', 'hinge', 'Scharnier mit Stütze', 'Hinge with Stay', ['hinge', 'lid-stay']),
  H('D0553Z-SD', 'Penn Elcom', 'hinge', 'Deckelstütze', 'groß, gefedert, mit Zuschlagschutz, in 10-mm-Schale', ['lid-stay']),
  H('D0593Z', 'Penn Elcom', 'hinge', 'Deckelstütze', 'Lid Stay', ['lid-stay']),
  H('P2558Z', 'Penn Elcom', 'hinge', 'Deckelstütze', 'Lid Stay', ['lid-stay']),
  H('P2593Z', 'Penn Elcom', 'hinge', 'Deckelstütze', 'Lid Stay', ['lid-stay']),
  H('P1300P', 'Penn Elcom', 'hinge', 'Klavierband', 'Piano Hinge', ['piano-hinge']),
  // castors
  H('Castor Board', 'Autocase', 'castor', 'Rollenbrett', '18 mm Rollenbrett'),
  H('Castor Strip', 'Autocase', 'castor', 'Rollenleiste', 'Castor Strip'),
  H('W0985-V6', 'Penn Elcom', 'castor', 'Lenkrolle 100 mm', 'mit Bremse', ['castor-braked']),
  H('W0990-V6', 'Penn Elcom', 'castor', 'Lenkrolle 100 mm', 'ohne Bremse', ['castor']),
  H('W0985/80', 'Penn Elcom', 'castor', 'Lenkrolle 80 mm', 'mit Bremse, Gummirad blau', ['castor-braked']),
  H('W0990/80', 'Penn Elcom', 'castor', 'Lenkrolle 80 mm', 'verzinkt, Gummirad blau', ['castor']),
  H('W9980', 'Penn Elcom', 'castor', 'Rollenplatte', 'Castor Plate'),
  H('W8675', 'Penn Elcom', 'castor', 'Eckrolle', 'Corner Castor, Kröpfung 35 mm', undefined, 35),
  // dishes
  H('87971', 'Adam Hall', 'dish', 'Einbauschale', 'Kabeldurchführung in Schale', ['cable-gland']),
  H('D022Z', 'Penn Elcom', 'dish', 'Einbauschale', 'groß, gestanzt für 8 × D-Serie-Stecker', ['dish-connector']),
  H('D0511Z', 'Penn Elcom', 'dish', 'Einbauschale', 'klein, 13 mm tief, mit Lüftungsschlitzen', ['dish-vent']),
  H('D0516Z', 'Penn Elcom', 'dish', 'Einbauschale', 'mittel, mit senkrechten Lüftungsschlitzen', ['dish-vent']),
  H('D0536Z', 'Penn Elcom', 'dish', 'Einbauschale', 'groß, mit senkrechten Lüftungsschlitzen', ['dish-vent']),
  H('D0941Z-TR-D', 'Penn Elcom', 'dish', 'Einbauschale', 'mittel, gestanzt für 1 × powerCON TRUE1 Duplex', ['dish-connector']),
  H('D0947Z', 'Penn Elcom', 'dish', 'Einbauschale', 'klein, 13 mm tief, gestanzt für 2 × D-Serie-Stecker', ['dish-connector']),
  H('D2101Z-04', 'Penn Elcom', 'dish', 'Einbauschale', 'groß, sehr flach, gelocht', ['dish-vent']),
  H('D2116Z', 'Penn Elcom', 'dish', 'Etikettenschale', 'groß, für selbstklebende Tour-Etiketten', ['label']),
  H('W0968Z', 'Penn Elcom', 'dish', 'Stapelschale', 'Deckelschale für Rollen', ['stack-cup']),
  H('D2115K', 'Penn Elcom', 'dish', 'Etikettenschale', 'Label Dish', ['label']),
  H('D2115Z', 'Penn Elcom', 'dish', 'Etikettenschale', 'mittel, für selbstklebende Tour-Etiketten', ['label']),
  H('D0941/07Z', 'Penn Elcom', 'dish', 'Einbauschale', 'mittel', ['dish-connector']),
  // feet
  H('F1686/25', 'Penn Elcom', 'foot', 'Gummifuß', 'groß, 25 mm, mit Stahlscheibe', ['foot']),
  H('F1692', 'Penn Elcom', 'foot', 'Gummifuß', 'klein, 15 mm, mit Stahlscheibe', ['foot']),
  H('F1693', 'Penn Elcom', 'foot', 'Gummifuß', 'klein, 10 mm, mit Stahlscheibe', ['foot']),
  H('F1686', 'Penn Elcom', 'foot', 'Gummifuß (Lautsprecher)', 'groß, 40 × 16 mm, mit Stahlscheibe', ['foot']),
];

export const hardwarePart = (sku?: string) => HARDWARE_PARTS.find((h) => h.sku === sku);
/** parts that can be used as a hardware kind of the case designer */
export const partsForKind = (kind: string) => HARDWARE_PARTS.filter((h) => h.as?.includes(kind));
export const partsInGroup = (g: PartGroup) => HARDWARE_PARTS.filter((h) => h.group === g);
export const partLabel = (h: HardwarePart) => `${h.maker} ${h.sku}: ${h.type}${h.desc && h.desc !== h.type ? `, ${h.desc}` : ''}`;
/** height of a rubber foot from its description (mm), 15 mm when not stated */
export const footHeight = (sku?: string) => {
  const m = /(\d+)\s*mm/.exec(hardwarePart(sku)?.desc ?? '');
  return m ? Math.min(40, Number(m[1])) : 15;
};

// ---------------------------------------------------------------- drawer slides and rack strips

/** Penn Elcom drawer slides: length, height, thickness in mm */
export const DRAWER_SLIDES: { sku: string; length: number; height: number; thickness: number }[] = [
  { sku: 'R2410Z', length: 310, height: 42, thickness: 12.7 },
  { sku: 'R2412Z', length: 310, height: 42, thickness: 12.7 },
  { sku: 'R2414Z', length: 371.4, height: 42, thickness: 12.7 },
  { sku: 'R2416Z', length: 421.4, height: 42, thickness: 12.7 },
  { sku: 'R2418Z', length: 471.4, height: 42, thickness: 12.7 },
  { sku: 'R2420Z', length: 500, height: 42, thickness: 12.7 },
  { sku: 'R2422Z', length: 571.4, height: 42, thickness: 12.7 },
  { sku: 'R2424Z', length: 621.4, height: 42, thickness: 12.7 },
  { sku: 'R2426Z', length: 650, height: 42, thickness: 12.7 },
  { sku: 'R2428Z', length: 700, height: 42, thickness: 12.7 },
];

/** longest slide that fits a depth (null when even the shortest is too long) */
export function slideFor(depth: number) {
  const fit = DRAWER_SLIDES.filter((s) => s.length <= depth + 0.01);
  return fit.length ? fit[fit.length - 1] : null;
}

/** rack strip length for a number of rack units: 44.45 mm per unit plus 3.2 mm (Penn Elcom R0863 / R0883) */
export const rackStripLength = (u: number) => Math.round((44.45 * u + 3.2) * 100) / 100;
export const RACK_STRIP_UNITS = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30];
/** Penn Elcom rack strip part number for a height (the next stocked length up) */
export function rackStripSku(u: number, series: 'R0863' | 'R0883' = 'R0863') {
  const s = RACK_STRIP_UNITS.find((x) => x >= u);
  return s ? `${series}-${s}` : null;
}

// ---------------------------------------------------------------- foam sheets

/** foam materials and stocked thicknesses (sheet size in mm) */
export const FOAM_SHEETS: { label: string; maker: PartMaker; sheet: [number, number]; thicknesses: number[] }[] = [
  { label: 'EVA schwarz', maker: 'Autocase', sheet: [2000, 1000], thicknesses: [10, 20, 25, 30, 50, 60] },
  { label: 'EVA38', maker: 'Penn Elcom', sheet: [2500, 1200], thicknesses: [10, 20, 25, 30, 50] },
  { label: 'PE hohe Dichte', maker: 'Penn Elcom', sheet: [2000, 1000], thicknesses: [10, 12, 20, 30, 50] },
  { label: 'PE niedrige Dichte', maker: 'Penn Elcom', sheet: [2750, 1200], thicknesses: [6, 13, 19, 25, 38, 50, 75] },
  { label: 'Plastazote LD29', maker: 'Autocase', sheet: [2000, 1000], thicknesses: [3, 6, 10, 12, 13, 15, 17, 19, 20, 25, 30, 38, 40, 50, 51, 60, 80, 100, 140] },
  { label: 'Polyester-Schaum', maker: 'Penn Elcom', sheet: [2000, 1100], thicknesses: [13, 19, 25, 38, 51] },
  { label: 'PU-Schaum (Polyester)', maker: 'Autocase', sheet: [2000, 1000], thicknesses: [3, 6, 10, 12, 13, 15, 17, 19, 20, 25, 30, 38, 40, 50, 51, 60, 80, 100, 140] },
];
