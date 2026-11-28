// Core data model. All physical dimensions are millimetres unless noted otherwise.
// Cable lengths are metres.

export type Face = 'front' | 'rear';

/** Signal families. Used to suggest cable types and warn about mismatched connections. */
export type SignalType = 'rf' | 'audio' | 'aes' | 'network' | 'power' | 'clock' | 'video' | 'data' | 'other';

export interface Port {
  id: string;
  name: string;
  /** Key into the connector registry (see connectors.ts). */
  connector: string;
  /** Which panel of the device the port is on. */
  side: Face;
  /**
   * Position of the port centre on its panel, in mm.
   * x is measured from the left edge *as you look at that panel*
   * (so rear-panel coordinates are as seen from behind the device, like in a manual).
   * y is measured from the top edge of the panel.
   */
  x: number;
  y: number;
  dir?: 'in' | 'out' | 'io';
}

export type PanelElementKind = 'dseries' | 'hole' | 'rect' | 'text' | 'engraveRect' | 'engraveLine';

/** One element on a custom rack panel (Blende). x/y = centre, mm from panel top-left. */
export interface PanelElement {
  id: string;
  kind: PanelElementKind;
  x: number;
  y: number;
  /** dseries: connector key placed into the D-cutout (XLR, etherCON, BNC-D …) */
  connector?: string;
  label?: string;
  /** hole: diameter */
  d?: number;
  /** rect / engraveRect / engraveLine: size */
  w?: number;
  h?: number;
  /** corner radius for rect cutouts */
  r?: number;
  /** text: content + cap height in mm */
  text?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  /** dseries: rotate the D-flange 90° */
  rotate?: boolean;
}

export interface PanelDesign {
  heightU: number;
  rackStandard: 19 | 10;
  /** material thickness */
  thickness: number;
  /** panel colour (finish) */
  color: string;
  /** engraving / print colour */
  engraveColor: string;
  material: string;
  /** mounting holes: 'slot' (10 x 6.5 oblong) or 'round' (Ø6.5) */
  mountHoles: 'slot' | 'round';
  cornerRadius: number;
  elements: PanelElement[];
}

/**
 * Decorative panel graphics (displays, knobs, buttons, LEDs, logos …) so devices are recognisable.
 * Coordinates in mm on the panel, x from the left edge of the slot as seen when looking at that panel.
 */
export type ArtElement =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'circle'; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string; sw?: number }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number }
  | { t: 'text'; x: number; y: number; text: string; size: number; fill?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; italic?: boolean; spacing?: number }
  /** backlit display; `info` = show device label/fields inside */
  | { t: 'lcd'; x: number; y: number; w: number; h: number; tint?: string; info?: boolean; channel?: number }
  | { t: 'knob'; x: number; y: number; r: number; fill?: string }
  | { t: 'button'; x: number; y: number; w: number; h: number; label?: string; round?: boolean; fill?: string; text?: string }
  | { t: 'leds'; x: number; y: number; n: number; dx?: number; dy?: number; r?: number; colors?: string[] }
  | { t: 'switch'; x: number; y: number; w: number; h: number }
  | { t: 'vents'; x: number; y: number; w: number; h: number; n: number; horizontal?: boolean }
  /** placed-device label strip (white tape) */
  | { t: 'labelArea'; x: number; y: number; w: number; h: number };

export interface DeviceArt {
  front?: ArtElement[];
  rear?: ArtElement[];
}

export interface DeviceTemplate {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  heightU: number;
  /** 19" or 10" device */
  rackStandard: 19 | 10;
  /** 1 = full width, 2 = half width, 3 = third width (mounted with a rack kit) */
  slots: 1 | 2 | 3;
  /** chassis depth behind the front rail */
  depth: number;
  color: string;
  textColor: string;
  ports: Port[];
  /** If the template was created in the panel designer, the design is kept here. */
  panel?: PanelDesign;
  /** panel graphics for front and rear */
  art?: DeviceArt;
  /** faceplate colour if it differs from the chassis colour */
  frontColor?: string;
  /** real chassis width for fractional devices; drawn centred in the slot (rest = rack kit) */
  bodyWidth?: number;
  /** width of the rack ears on full-width devices (default 16 mm) */
  earWidth?: number;
  /** where the data for this template comes from */
  source?: string;
  /** rack drawer: placed devices get a contents list that is printed on the front */
  drawer?: boolean;
  /** usable inner size of a drawer from the manufacturer (l = width, w = depth, h = height, mm); estimated otherwise */
  drawerInner?: { l: number; w: number; h: number; hEstimated?: boolean };
  /** product id in the RF Frequency Manager ("Shure|AD4D"); built-in templates are mapped in integration/rf.ts */
  rfProduct?: string;
  /** Free-form metadata fields this device type typically needs (e.g. "Frequenz"). */
  fields?: string[];
  notes?: string;
  /** true for user-defined templates */
  custom?: boolean;
  /** weight in kg (optional, used for totals) */
  weight?: number;
  /** power consumption in W (optional, used for totals) */
  power?: number;
  /** split or combi box: not rack-mounted, placed below the rack (rack.boxes) */
  box?: BoxSpec;
  /** front bays for exchangeable modules (e.g. one charging module per battery type); the choice of a placed device
   *  is stored in PlacedDevice.fields under the bay name ('' = empty) */
  modules?: ModuleBay[];
}

/** a bay on the front panel that takes one of several modules */
export interface ModuleBay {
  name: string;
  /** position on the front panel, mm */
  x: number; y: number; w: number; h: number;
  /** choices; a module may bring connectors (positions relative to the bay's top left corner) */
  options: { id: string; label: string; ports?: Port[]; look?: 'flat' | 'flat-small' | 'round' }[];
  /** short label used in port names, e.g. "RY1" (default: name) */
  short?: string;
  /** panel the bay sits on (default front) */
  side?: Face;
  /** module fitted when nothing was chosen yet (default: empty) */
  default?: string;
  /** drawing: charging bay with two battery pockets (default) or a plain plug-in card */
  style?: 'charger' | 'card';
}

/** Split box (one multi connector fans out to single connectors) or combi box (singles combined into a multi). */
export interface BoxSpec {
  kind: 'split' | 'combi';
  /** size of the drawn box face in mm (ports are positioned within it) */
  w: number;
  h: number;
  /** internal wiring: which single ports run through which multi port */
  links: { multi: string; singles: string[] }[];
  /** editor input the box was generated from (for re-editing) */
  design?: BoxDesign;
}

export interface BoxRow { connector: string; name: string; count: number }
export interface BoxDesign {
  multi: BoxRow[];
  /** `via` = index of the multi row these singles run through */
  singles: (BoxRow & { via: number })[];
}

/** A split/combi box used with a rack, drawn below it; cables to it get `distance` added to their length. */
export interface PlacedBox {
  id: string;
  templateId: string;
  label?: string;
  /** distance from the rack in m (used for automatic cable lengths) */
  distance: number;
  notes?: string;
}

export type RackKind = 'case' | 'shockmount' | 'cabinet' | 'open' | 'wall' | 'desk';

export interface RackType {
  id: string;
  name: string;
  kind: RackKind;
  rackStandard: 19 | 10;
  heightU: number;
  /** usable mounting depth (front rail to rear rail / back wall) */
  depth: number;
  hasRearRails: boolean;
  /** outer dimensions (w x h x d) for weight/truck planning and 3D view */
  outer: { w: number; h: number; d: number };
  color: string;
  /** Lids / doors – only used for 3D view and notes. */
  frontLid?: boolean;
  rearLid?: boolean;
  /** weight of empty rack in kg */
  weight?: number;
  notes?: string;
  custom?: boolean;
  /**
   * Mounting bays of double/triple/combination racks. Without bays the rack has one bay of `heightU` / `rackStandard`.
   * With bays, `heightU` and `rackStandard` describe the overall size / first bay (for lists only).
   */
  bays?: Bay[];
  /** construction from the rack designer (outer size and weight are computed from it) */
  build?: RackBuild;
}

/** How a rack housing is built (rack designer). All lengths in mm. */
export interface RackBuild {
  /** plywood thickness of a flight case rack */
  panel: number;
  profile: 'alu30' | 'alu35' | 'none';
  cornerBalls: boolean;
  /** inner depth of the front / rear lid, 0 = no lid */
  frontLid: number;
  rearLid: number;
  /** free space in front of the front rails (knobs, handles, cables) */
  railInset: number;
  /** free space behind the rear rails / the mounting depth */
  rearGap: number;
  /** space between rack rail and side wall, per side */
  sideGap: number;
  /** space above and below the mounting bays */
  topGap: number;
  /** butterfly latches per lid */
  latches: 4 | 6 | 8;
  /** recessed handles per side */
  handles: 0 | 1 | 2;
  stackCups: boolean;
  castors: 0 | 4;
  castorSize: 75 | 100 | 125;
  /** shockmount: the inner rack floats on dampers inside the outer case */
  shock?: { travel: number; damper: 'rubber' | 'foam' };
  /** bays in different planes get separate bodies (stacked cases) instead of one case with work surfaces */
  separate?: boolean;
}

/** One mounting bay: x = left edge of its 19"/10" face, y = its bottom edge, both in mm from the bottom-left of the arrangement. */
export interface Bay {
  heightU: number;
  rackStandard: 19 | 10;
  x: number;
  y: number;
  label?: string;
  /** setback of this bay's front rail behind the frontmost rail, mm (default 0) */
  z?: number;
  /** mounting depth of this bay (front to rear rail), mm (default: the rack type's depth) */
  depth?: number;
}

export interface PlacedDevice {
  id: string;
  templateId: string;
  /** Lowest occupied rack unit (1 = bottom unit). */
  u: number;
  /** Which rails the device is mounted on. */
  mount: Face;
  /** For fractional devices: 0..slots-1, counted from the left as seen from the mounting side. */
  slot: number;
  /** mounting bay of a double/triple rack (index into rack.type.bays, default 0) */
  bay?: number;
  /** turned around: the rear panel faces the mounting rails (e.g. a PDU whose outlets should point outwards) */
  reversed?: boolean;
  label?: string;
  /** e.g. { Frequenz: "606.500 MHz", Kanal: "Vox 1" } */
  fields?: Record<string, string>;
  notes?: string;
  /** drawers: what is inside (shown on the front label, in the PDF and the viewer) */
  contents?: DrawerItem[];
  /** wireless data, exchanged with the RF Frequency Manager */
  rf?: RfDeviceData;
}

export interface RfChannel {
  name?: string;
  /** frequency in MHz */
  f?: number;
}

export interface RfDeviceData {
  /** RF product id when the template maps to several (ANX4 in Axient Digital or ULX-D mode) */
  product?: string;
  /** band name of the series, e.g. "G50" – profile id in the RF program: "<manufacturer>|<series>|<band>" */
  band?: string;
  zone?: string;
  channels?: RfChannel[];
  /** backup frequencies (MHz) assigned to the device */
  backups?: number[];
}

export interface DrawerItem {
  qty?: number;
  text: string;
}

export interface CableEnd {
  deviceId: string;
  portId: string;
}

export interface Cable {
  id: string;
  /** Running number, used for printed labels (W001 …). */
  number: number;
  a: CableEnd;
  b: CableEnd;
  typeId: string;
  lengthMode: 'auto' | 'manual';
  manualLength?: number;
  label?: string;
  /** optional per-cable colour override */
  color?: string;
  /** legs of one Y cable share this id and their `a` end (the common connector) */
  yGroup?: string;
  /** leg index within the Y cable (1, 2, …), shown as W012a, W012b … */
  yLeg?: number;
  /** built after this custom cable (its name and pin assignment), see Project.customCables */
  customId?: string;
}

/** a cable end defined in the cable workshop: the panel connector it plugs into (dir only for mains: in = coupler) */
export interface PlugSpec { conn: string; dir?: 'in' | 'out' }

/** A cable designed in the cable workshop (not necessarily used in a rack). */
export interface CustomCable {
  id: string;
  name: string;
  typeId: string;
  /** common end */
  a: PlugSpec;
  /** one branch = plain cable, several = Y cable; length in m */
  branches: (PlugSpec & { length: number })[];
  qty: number;
  /** own pin assignment: pin of end A → pin of end B (applies to every branch); none = standard */
  wiring?: { a: string; b: string }[];
  notes?: string;
}

export interface CableType {
  id: string;
  name: string;
  signal: SignalType;
  color: string;
  /** stroke width in the drawing (mm) */
  width: number;
  dash?: string;
  /** available stock lengths in m, used when rounding auto lengths */
  stockLengths: number[];
  /** connectors this cable type is typically used with – used for auto-selection */
  connectors?: string[];
  custom?: boolean;
}

export interface Rack {
  id: string;
  name: string;
  type: RackType;
  devices: PlacedDevice[];
  cables: Cable[];
  /** split/combi boxes used with this rack */
  boxes?: PlacedBox[];
  notes?: string;
}

export interface ProjectSettings {
  /** extra length in percent added to the computed route */
  slackPercent: number;
  /** fixed extra length per cable (service loop), mm */
  serviceLoop: number;
  /** distance a cable leaves the panel before bending, mm */
  exitLength: number;
  /** round auto lengths up to the cable type's stock lengths */
  roundToStock: boolean;
  curveStyle: 'curved' | 'orthogonal' | 'straight';
  showPortLabels: boolean;
  showCableLabels: boolean;
  /** cable label content */
  cableLabel: 'length' | 'number' | 'both' | 'none';
}

// ---------------------------------------------------------------- flight cases (case designer)

export type CaseFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type HardwareKind =
  | 'butterfly' | 'butterfly-small' | 'handle-recessed' | 'handle-strap' | 'stack-cup' | 'hinge' | 'label'
  | 'castor' | 'castor-braked' | 'skid'
  | 'draw-latch' | 'lid-stay' | 'piano-hinge' | 'foot' | 'dish-vent' | 'dish-connector' | 'cable-gland' | 'handle-surface';
/** PE = polyethylene (closed cell, firm), PU = polyurethane (open cell, soft), EVA = ethylene vinyl acetate (dense, smooth) */
export type FoamMaterial = 'PE' | 'PU' | 'EVA';
export interface CaseHardware {
  kind: HardwareKind;
  face: CaseFace;
  count: number;
  /** manufacturer part (src/library/caseHardware.ts) */
  sku?: string;
  /** split the latch or hinge bridges: the lid (default) or the door on that side */
  seam?: CaseSeam;
  /**
   * placed by hand: one position per piece in face coordinates (mm, castors excluded). u = across the face from the left
   * as seen from outside (top face: from the left end), z = height from the bottom (top face: from the front edge).
   * Latches use only the coordinate along their seam. Without `at` the pieces are spread evenly (`count`).
   */
  at?: { u: number; z: number }[];
}
/** 'lid' = horizontal split under the top lid, the others = vertical split of the door on that side */
export type CaseSeam = 'lid' | 'front' | 'back' | 'left' | 'right';
/** doors: inner depth per side in mm (0 or missing = no door). Doors on front/back and on left/right do not mix. */
export interface CaseDoors {
  front?: number; back?: number; left?: number; right?: number;
  /** 'full' = doors run the whole height (the lid sits between them), 'body' = doors end under a lid over the whole case */
  span?: 'full' | 'body';
}

/** something packed into the case: a foam cut-out (x/y = left-front corner in the inner space, mm) */
export interface CaseItem {
  id: string;
  name: string;
  /** length (x), width (y, front to back) and height (z) in mm */
  l: number;
  w: number;
  h: number;
  x: number;
  y: number;
  /** turned by 90° in the top view */
  rot?: boolean;
  /** foam layer: in the body or in the lid */
  layer: 'body' | 'lid';
  weight?: number;
  /** linked device template (dimensions/weight taken from it) */
  templateId?: string;
  /** cut-out outline: rectangle with rounded corners (default) or circle/ellipse */
  shape?: 'rect' | 'circle';
  /** corner radius of a rectangular cut-out in mm (default 6) */
  radius?: number;
  /** cut depth in mm (default: item height) */
  depth?: number;
  /** finger grips (half-round notches) on these sides, to lift the item out */
  grips?: ('left' | 'right' | 'front' | 'back')[];
  /** engrave the name next to the cut-out */
  engrave?: boolean;
  /**
   * own contour drawn in the shape editor: closed polygon in item coordinates (x along l, y along w from the front edge,
   * mm), r = corner radius at that vertex. Takes precedence over shape/radius/grips; l and w are its bounding box.
   */
  outline?: OutlinePt[];
  /** photo or drawing of the product placed under the contour in the shape editor (item coordinates, mm) */
  trace?: { src: string; x: number; y: number; w: number; h: number; opacity: number };
}

export interface OutlinePt { x: number; y: number; r?: number }

export interface FlightCase {
  id: string;
  name: string;
  /**
   * 'case' = flight case (default), 'drawer' = foam inlay for a rack drawer (sizes follow the drawer),
   * 'inlay' = free foam inlay for any container (bought case, toolbox, transport box)
   */
  kind?: 'case' | 'drawer' | 'inlay';
  /** the rack drawer this inlay belongs to */
  drawer?: { rackId: string; deviceId: string };
  /** drawer inlay made from a drawer template without a placed drawer (template id) */
  drawerTemplate?: string;
  /** clear inside of the walls in mm (h = body + lid) */
  inner: { l: number; w: number; h: number };
  /** inner height of the lid part (0 = no lid) */
  lidH: number;
  lidKind: 'removable' | 'hinged' | 'telescope' | 'none';
  /** wall thickness (plywood incl. laminate) in mm */
  panel: number;
  profile: 'alu30' | 'alu35' | 'none';
  /** laminate colour */
  color: string;
  cornerBalls: boolean;
  hardware: CaseHardware[];
  castorSize: 75 | 100 | 125;
  foam: { bottom: number; lid: number; sides: number; color: string; material?: FoamMaterial };
  items: CaseItem[];
  /** compartment walls in the inner space: axis 'x' = wall parallel to the length at y = pos, 'z' = shelf at height pos */
  dividers: { axis: 'x' | 'y' | 'z'; pos: number }[];
  notes?: string;
  /** construction preset the case was started from (see CASE_TYPES) */
  caseType?: string;
  /** design history (timeline): construction fields are base + replayed steps up to the marker */
  timeline?: CaseTimeline;
  /** doors on the sides (vertical splits) */
  doors?: CaseDoors;
  /** the top lid is split in the middle into two halves (clamshell) */
  lidSplit?: boolean;
  /** drawers stacked from the inner bottom of the base, front heights in mm (pulled out to the front) */
  drawers?: { h: number }[];
  /** chosen parts: panel material id, edge profile, closing profile and ball corner part numbers */
  parts?: { panel?: string; edge?: string; closing?: string; corner?: string };
}

export interface Project {
  version: 1;
  id: string;
  name: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  racks: Rack[];
  /** All device templates used in or created for this project (self-contained). */
  templates: Record<string, DeviceTemplate>;
  cableTypes: CableType[];
  /** custom rack types created by the user */
  rackTypes: RackType[];
  settings: ProjectSettings;
  /** version of the built-in device library the template copies stem from */
  libraryVersion?: number;
  /** flight cases designed in the case designer */
  cases?: FlightCase[];
  /** cables designed in the cable workshop */
  customCables?: CustomCable[];
}

/**
 * One step of a case's design history. `d` holds, per construction field, what the step changed: plain fields their new
 * value (null = cleared), objects (inner, doors, parts) only the changed sub-keys, lists (hardware, dividers, drawers)
 * a diff ({ add, remove, change: [old, new] }) matched by value, so a step still applies after earlier steps change.
 */
export interface CaseStep { id: string; t: number; key?: string; off?: boolean; d: Record<string, unknown> }
export interface CaseTimeline { base: Partial<FlightCase>; steps: CaseStep[]; /** steps before this index are active; undefined = all */ marker?: number }
