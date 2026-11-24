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
}
