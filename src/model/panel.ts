import type { DeviceTemplate, PanelDesign, PanelElement, Port } from './types';
import { faceWidth, holeSpacing, panelHeight, U } from './geometry';
import { connectorDef } from './connectors';

/**
 * Neutrik D-size cutout: Ø24 mm main hole + 2 × Ø3.2 mm screw holes on a 19 × 24 mm diagonal.
 * Values per Neutrik panel cutout drawings – verify against the data sheet of the actual connector.
 */
export const DSIZE = { holeD: 24, screwD: 3.2, screwDx: 9.5, screwDy: 12, flangeW: 26, flangeH: 31 };

/** Oblong mounting slot 10 × 6.5 mm (or round Ø6.5) */
export const MOUNT_SLOT = { w: 10, h: 6.5 };

export const panelSize = (pd: PanelDesign) => ({ w: faceWidth(pd.rackStandard), h: panelHeight(pd.heightU) });

/** Centres of the rack mounting holes, in panel coordinates (from top-left). */
export function mountHolePositions(pd: PanelDesign): { x: number; y: number }[] {
  const { w, h } = panelSize(pd);
  const inset = (w - holeSpacing(pd.rackStandard)) / 2;
  const ys = [5.95];
  for (let k = 1; k < pd.heightU - 1; k++) ys.push(k * U + 5.95);
  ys.push(h - 5.95);
  const out: { x: number; y: number }[] = [];
  for (const y of ys) out.push({ x: inset, y }, { x: w - inset, y });
  return out;
}

export function dsizeScrews(el: PanelElement) {
  const { screwDx: dx, screwDy: dy } = DSIZE;
  return el.rotate
    ? [{ x: el.x - dy, y: el.y + dx }, { x: el.x + dy, y: el.y - dx }]
    : [{ x: el.x - dx, y: el.y - dy }, { x: el.x + dx, y: el.y + dy }];
}

export function newPanel(heightU = 1): PanelDesign {
  return {
    heightU,
    rackStandard: 19,
    thickness: 2,
    color: '#1b1b1b',
    engraveColor: '#ffffff',
    material: 'Aluminium eloxiert schwarz',
    mountHoles: 'slot',
    cornerRadius: 0,
    elements: [],
  };
}

/** Turn a panel design into a device template; every D-size element with a connector becomes a feed-through port. */
export function panelToTemplate(pd: PanelDesign, meta: { id: string; name: string; manufacturer?: string; depth?: number }): DeviceTemplate {
  const { w } = panelSize(pd);
  const ports: Port[] = [];
  let i = 0;
  for (const el of pd.elements) {
    if (el.kind !== 'dseries' || !el.connector) continue;
    i++;
    const name = el.label || `${connectorDef(el.connector).label.split(' ')[0]} ${i}`;
    ports.push({ id: `${el.id}-f`, name, connector: el.connector, side: 'front', x: el.x, y: el.y, dir: 'io' });
    ports.push({ id: `${el.id}-r`, name: name + ' (R)', connector: el.connector, side: 'rear', x: w - el.x, y: el.y, dir: 'io' });
  }
  return {
    id: meta.id,
    name: meta.name,
    manufacturer: meta.manufacturer || 'Custom',
    category: 'Custom Blende',
    heightU: pd.heightU,
    rackStandard: pd.rackStandard,
    slots: 1,
    depth: meta.depth ?? 45,
    color: pd.color,
    textColor: pd.engraveColor,
    ports,
    panel: pd,
    custom: true,
  };
}
