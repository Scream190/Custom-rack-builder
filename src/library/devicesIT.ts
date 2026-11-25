import type { ArtElement, DeviceTemplate } from '../model/types';
import { variants } from './devicesPro';
import { A, B, G, mk, SRC, type Blk, type Grp } from './proLayout';

/*
 * IT equipment: access/core/data-centre switches, routers and firewalls, servers, NAS, gateways (time server,
 * cellular bonding, console server, media converters), WLAN controllers, KVM, smart PDUs, fibre/patch accessories.
 * Accuracy per template in `source` (SRC.DS = port set from the data sheet, positions estimated; SRC.EST = also
 * partly estimated; generic templates are marked as such).
 */

const NET = 'Netzwerk', ROUTER = 'Router / Firewall', SRV = 'Server', NAS = 'Storage / NAS', GW = 'Gateways / Zeitserver', WLAN = 'WLAN-Controller';
const KVM = 'KVM / Konsole', PDU = 'Strom', PATCH = 'Patchfeld', GEN = 'Generische Vorlage';

const PSU = B.one('Power', 'IEC_C14', 'in');
const PSU2 = B.list(['PSU 1', 'PSU 2'], 'IEC_C14', 'in');

/** switch front: RJ45 in groups of 12 (odd top, even bottom), then SFP/QSFP uplinks and console */
function switchFront(o: { rj: number; sfp?: number; sfpC?: string; sfpPre?: string; qsfp?: number; group?: number; pitch?: number; console?: 'left' | 'right' | false; mgmt?: boolean; rjStart?: number; extraRj?: { n: number; pre: string } }): Grp[] {
  const group = o.group ?? 12, pitch = o.pitch ?? 15;
  const blocks: Blk[] = [];
  for (let i = 0; i < o.rj; i += group) blocks.push(B.rj(Math.min(group, o.rj - i), 'Port ', { start: (o.rjStart ?? 1) + i, rows: 2, order: 'col', pitch, gap: 4 }));
  if (o.extraRj) blocks.push(B.rj(o.extraRj.n, o.extraRj.pre, { rows: 2, order: 'col', gap: 6 }));
  const sfpStart = (o.rjStart ?? 1) + o.rj;
  if (o.sfp) blocks.push({ c: o.sfpC ?? 'SFP', n: o.sfp, pre: o.sfpPre ?? 'SFP+ ', start: sfpStart, dir: 'io', rows: o.sfp > 1 ? 2 : 1, order: 'col', gap: 7, pitch: o.sfpC === 'QSFP' ? 20.6 : 15.6 });
  if (o.qsfp) blocks.push({ c: 'QSFP', n: o.qsfp, pre: 'QSFP ', start: 1, dir: 'io', rows: o.qsfp > 1 ? 2 : 1, order: 'col', gap: 6, pitch: 20.6 });
  const consoleBlocks: Blk[] = [B.one('Console', 'RJ45', 'io', { ys: [11] }), ...(o.mgmt ? [B.one('MGMT', 'RJ45', 'io', { ys: [32.6], stack: true })] : [])];
  if (o.console === 'right') return [G([...blocks, ...consoleBlocks.map((b, i) => (i ? b : { ...b, gap: 6 }))], 'right')];
  if (o.console === false) return [G(blocks, 'right')];
  return [G(consoleBlocks, 'left', { x0: 92 }), G(blocks, 'right')];
}

/** server front: drive bays (sff = vertical 2.5", lff = horizontal 3.5"), control panel with power button and USB */
function serverFront(o: { u: number; bays: number; kind: 'sff' | 'lff'; x0?: number }) {
  return (H: number): ArtElement[] => {
    const out: ArtElement[] = [];
    const x0 = o.x0 ?? 60;
    if (o.kind === 'sff') {
      const w = 15, h = Math.min(38, H - 8);
      for (let i = 0; i < o.bays; i++) out.push(A.rect(x0 + i * (w + 1.5), (H - h) / 2, w, h, '#2b2e33', 0.8), A.leds(x0 + i * (w + 1.5) + w / 2, (H - h) / 2 + 3, 1, ['#22c55e'], 0, 0, 0.6));
    } else {
      const w = 100, h = 25, perRow = 3, rows = Math.ceil(o.bays / perRow);
      for (let i = 0; i < o.bays; i++) {
        const c = i % perRow, r = Math.floor(i / perRow);
        out.push(A.rect(x0 + c * (w + 3), (H - rows * (h + 2)) / 2 + r * (h + 2), w, h, '#2b2e33', 0.8));
      }
    }
    out.push({ t: 'button', x: 440, y: H / 2 - 5, w: 10, h: 10, round: true, label: '⏻' }, A.leds(430, H / 2 - 6, 3, ['#22c55e', '#3b82f6', '#3a3d42'], 0, 4, 0.9));
    return out;
  };
}

// ================================================================== Switches
const switches: DeviceTemplate[] = [
  ...variants({ id: '', name: '', man: 'Cisco', cat: NET, u: 1, depth: 445, color: '#3c4148', logo: 'CISCO', rear: [G([PSU2]), G([B.list(['Stack 1', 'Stack 2'], 'GENERIC', 'io')], 'right')], rearVents: true, src: SRC.DS }, [
    ['cisco-c9300-48p', 'Catalyst 9300-48P', { front: switchFront({ rj: 48, sfp: 8, console: 'right' }), notes: '48× PoE+, Netzwerkmodul 8× SFP+ (C9300-NM-8X).' }],
    ['cisco-c9300-24p', 'Catalyst 9300-24P', { front: switchFront({ rj: 24, sfp: 8 }), notes: '24× PoE+, Netzwerkmodul 8× SFP+.' }],
  ]),
  mk({ id: 'cisco-n93180yc-fx', name: 'Nexus 93180YC-FX', man: 'Cisco', cat: NET, u: 1, depth: 570, color: '#3c4148', logo: 'CISCO',
    front: [G([{ c: 'SFP', n: 48, pre: 'SFP28 ', dir: 'io', rows: 2, order: 'col', pitch: 15.2 }, { c: 'QSFP', n: 6, pre: 'QSFP28 ', dir: 'io', rows: 2, order: 'col', pitch: 20.6, gap: 6 }], 'right')],
    rear: [G([B.list(['Console', 'MGMT'], 'RJ45', 'io'), B.one('USB', 'USB', 'io', { gap: 5 })]), G([PSU2], 'right')], rearVents: true, src: SRC.DS, notes: 'Rechenzentrums-Switch: 48× 1/10/25 G SFP28, 6× 40/100 G QSFP28.' }),
  mk({ id: 'meraki-ms225-48fp', name: 'Meraki MS225-48FP', man: 'Cisco', cat: NET, u: 1, depth: 440, color: '#e5e7eb', ink: '#1f2328', logo: 'MERAKI', front: switchFront({ rj: 48, sfp: 4, console: false }), rear: [G([PSU])], src: SRC.DS, notes: 'Cloud-verwaltet, 48× PoE+, 4× SFP+.' }),
  mk({ id: 'meraki-ms120-8fp', name: 'Meraki MS120-8FP', man: 'Cisco', cat: NET, u: 1, bodyW: 250, depth: 210, color: '#e5e7eb', ink: '#1f2328', logo: 'MERAKI', front: [G([B.rj(8, 'Port ', { pitch: 15.4 }), B.sfp(2, 'SFP ', { start: 9, gap: 6 })], 'right')], rear: [G([PSU], 'center')], src: SRC.EST, notes: 'Kompakt, mit Rackkit.' }),
  ...variants({ id: '', name: '', man: 'Juniper', cat: NET, u: 1, depth: 310, color: '#2f3237', logo: 'JUNIPER', rear: [G([PSU])], src: SRC.DS }, [
    ['juniper-ex2300-48p', 'EX2300-48P', { front: switchFront({ rj: 48, sfp: 4, console: 'right' }), notes: '48× PoE+, 4× SFP+.' }],
    ['juniper-ex2300-24p', 'EX2300-24P', { front: switchFront({ rj: 24, sfp: 4 }), notes: '24× PoE+, 4× SFP+.' }],
  ]),
  mk({ id: 'juniper-ex4300-48p', name: 'EX4300-48P', man: 'Juniper', cat: NET, u: 1, depth: 520, color: '#2f3237', logo: 'JUNIPER', front: switchFront({ rj: 48, console: 'right' }),
    rear: [G([PSU2]), G([B.list(['QSFP+ 1', 'QSFP+ 2', 'QSFP+ 3', 'QSFP+ 4'], 'QSFP', 'io', { rows: 2, order: 'col' }), B.one('MGMT', 'RJ45', 'io', { gap: 8 })], 'right')], rearVents: true, src: SRC.EST, notes: '48× PoE+, 4× QSFP+ auf der Rückseite, Uplink-Modul optional.' }),
  ...variants({ id: '', name: '', man: 'HPE Aruba', cat: NET, u: 1, depth: 320, color: '#3a3d42', logo: 'ARUBA', rear: [G([PSU])], src: SRC.DS }, [
    ['aruba-2930f-48g-poe', '2930F 48G PoE+ 4SFP+', { front: switchFront({ rj: 48, sfp: 4, console: 'right' }) }],
    ['aruba-2930f-24g-poe', '2930F 24G PoE+ 4SFP+', { front: switchFront({ rj: 24, sfp: 4 }) }],
    ['aruba-cx6300m-48g', 'CX 6300M 48G', { front: switchFront({ rj: 48, sfp: 4, sfpPre: 'SFP56 ', console: 'right' }), rear: [G([PSU2])], notes: '48× Class-4-PoE, 4× SFP56.', src: SRC.EST }],
    ['aruba-io1930-24g', 'Instant On 1930 24G PoE', { front: switchFront({ rj: 24, sfp: 4, console: false }), notes: '24× PoE+, 4× SFP+.' }],
  ]),
  mk({ id: 'netgear-m4300-52g-poe', name: 'M4300-52G-PoE+', man: 'Netgear', cat: NET, u: 1, depth: 470, color: '#2a2f38', logo: 'NETGEAR',
    front: switchFront({ rj: 48, sfp: 2, console: 'right', extraRj: { n: 2, pre: '10G ' } }), rear: [G([PSU2])], rearVents: true, src: SRC.EST, notes: '48× PoE+, 2× 10GBASE-T, 2× SFP+.' }),
  ...variants({ id: '', name: '', man: 'Ubiquiti', cat: NET, u: 1, depth: 285, color: '#d9dcdf', ink: '#1f2328', logo: 'UBIQUITI', rear: [G([PSU])], src: SRC.DS }, [
    ['ubnt-usw-pro-48-poe', 'USW-Pro-48-PoE', { front: switchFront({ rj: 48, sfp: 4, console: false }), notes: '48× PoE (davon 8× PoE++), 4× SFP+.' }],
    ['ubnt-usw-pro-max-24-poe', 'USW-Pro-Max-24-PoE', { front: switchFront({ rj: 24, sfp: 2, console: false }), notes: '16× 1 G + 8× 2,5 G PoE, 2× SFP+.', src: SRC.EST }],
  ]),
  mk({ id: 'ubnt-usw-aggregation', name: 'USW-Aggregation', man: 'Ubiquiti', cat: NET, u: 1, depth: 200, color: '#d9dcdf', ink: '#1f2328', logo: 'UBIQUITI',
    front: [G([{ c: 'SFP', n: 8, pre: 'SFP+ ', dir: 'io', pitch: 17 }], 'right')], rear: [G([PSU], 'center')], src: SRC.DS, notes: '8× 10 G SFP+.' }),
  mk({ id: 'mikrotik-crs326-24g-2s', name: 'CRS326-24G-2S+RM', man: 'MikroTik', cat: NET, u: 1, depth: 200, color: '#2b2d31', logo: 'MIKROTIK', front: switchFront({ rj: 24, sfp: 2 }), rear: [G([PSU])], src: SRC.DS, notes: '24× 1 G, 2× SFP+.' }),
  mk({ id: 'mikrotik-crs317-16s', name: 'CRS317-1G-16S+RM', man: 'MikroTik', cat: NET, u: 1, depth: 230, color: '#2b2d31', logo: 'MIKROTIK',
    front: [G([B.one('MGMT', 'RJ45', 'io'), { c: 'SFP', n: 16, pre: 'SFP+ ', dir: 'io', rows: 2, order: 'col', gap: 10, pitch: 17 }], 'right')], rear: [G([PSU2])], src: SRC.DS, notes: '16× SFP+, redundante Netzteile.' }),
  mk({ id: 'mikrotik-crs354-48p', name: 'CRS354-48P-4S+2Q+RM', man: 'MikroTik', cat: NET, u: 1, depth: 300, color: '#2b2d31', logo: 'MIKROTIK', front: switchFront({ rj: 48, sfp: 4, qsfp: 2, console: false, pitch: 14.6 }), rear: [G([PSU2])], src: SRC.DS, notes: '48× PoE, 4× SFP+, 2× QSFP+.' }),
  mk({ id: 'tplink-sg3428xmp', name: 'Omada SG3428XMP', man: 'TP-Link', cat: NET, u: 1, depth: 330, color: '#2b2d31', logo: 'TP-LINK', front: switchFront({ rj: 24, sfp: 4 }), rear: [G([PSU])], src: SRC.DS, notes: '24× PoE+, 4× SFP+.' }),
  mk({ id: 'tplink-sg1024d', name: 'TL-SG1024D', man: 'TP-Link', cat: NET, u: 1, depth: 180, color: '#2b2d31', logo: 'TP-LINK', front: switchFront({ rj: 24, console: false }), rear: [G([PSU])], src: SRC.DS, notes: 'Unmanaged, 24× 1 G.' }),
];

// ================================================================== Router / Firewall
const routers: DeviceTemplate[] = [
  mk({ id: 'cisco-isr4331', name: 'ISR 4331', man: 'Cisco', cat: ROUTER, u: 1, depth: 440, color: '#3c4148', logo: 'CISCO',
    fa: (H) => [A.rect(200, 6, 110, H - 12, '#2b2e33', 0.8), A.rect(320, 6, 110, H - 12, '#2b2e33', 0.8)],
    rear: [G([PSU]), G([B.list(['GE 0/0/0', 'GE 0/0/1'], 'RJ45', 'io'), B.one('SFP 0/0/2', 'SFP', 'io', { gap: 4 }), B.list(['Console', 'Aux'], 'RJ45', 'io', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')], src: SRC.EST, notes: '3× GE (davon 1× SFP), 2 NIM-Slots.' }),
  mk({ id: 'cisco-c8200-1n-4t', name: 'Catalyst 8200-1N-4T', man: 'Cisco', cat: ROUTER, u: 1, depth: 440, color: '#3c4148', logo: 'CISCO',
    front: [G([B.rj(2, 'GE 0/0/'), B.sfp(2, 'SFP 0/0/', { start: 2, gap: 4 }), B.list(['Console', 'MGMT'], 'RJ45', 'io', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 4 })], 'right')],
    rear: [G([PSU])], src: SRC.EST, notes: '4× GE (2× RJ45, 2× SFP), 1 NIM-Slot.' }),
  mk({ id: 'juniper-srx345', name: 'SRX345', man: 'Juniper', cat: ROUTER, u: 1, depth: 300, color: '#2f3237', logo: 'JUNIPER',
    front: [G([B.list(['Console', 'MGMT'], 'RJ45', 'io', { rows: 2 }), B.rj(8, 'ge-0/0/', { start: 0, rows: 2, order: 'col', gap: 8 }), B.sfp(8, 'SFP ge-0/0/', { start: 8, rows: 2, order: 'col', gap: 6 }), B.one('USB', 'USB', 'io', { gap: 6 })], 'right')],
    rear: [G([PSU])], src: SRC.DS, notes: 'Firewall: 8× GE RJ45, 8× GE SFP.' }),
  mk({ id: 'fortinet-fg100f', name: 'FortiGate 100F', man: 'Fortinet', cat: ROUTER, u: 1, depth: 300, color: '#2b2d31', logo: 'FORTINET',
    front: [G([B.list(['Console', 'MGMT', 'HA 1', 'HA 2'], 'RJ45', 'io', { rows: 2, order: 'col' }), B.list(['WAN 1', 'WAN 2'], 'RJ45', 'io', { rows: 2, gap: 6 }), B.rj(16, 'Port ', { rows: 2, order: 'col', gap: 6, pitch: 15 }), B.sfp(8, 'SFP ', { rows: 2, order: 'col', gap: 6 }), B.sfp(2, 'SFP+ X', { rows: 2, gap: 6 })], 'right')],
    rear: [G([PSU2])], src: SRC.EST, notes: 'Firewall: 22× GE RJ45 (inkl. WAN/HA/MGMT), 8× GE SFP, 2× 10 G SFP+.' }),
  mk({ id: 'sophos-xgs4300', name: 'XGS 4300', man: 'Sophos', cat: ROUTER, u: 1, depth: 450, color: '#2a3446', logo: 'SOPHOS',
    front: [G([B.list(['Console', 'MGMT'], 'RJ45', 'io', { rows: 2 }), B.rj(8, 'Port ', { rows: 2, order: 'col', gap: 8 }), B.sfp(2, 'SFP ', { rows: 2, gap: 6 }), B.sfp(2, 'SFP+ ', { rows: 2, gap: 6 })], 'right')],
    fa: (H) => [A.rect(250, 6, 90, H - 12, '#1f2937', 0.8)], rear: [G([PSU2])], src: SRC.EST, notes: 'Firewall, Modulschacht für weitere Ports.' }),
  mk({ id: 'ubnt-udm-pro', name: 'UniFi Dream Machine Pro', man: 'Ubiquiti', cat: ROUTER, u: 1, depth: 285, color: '#d9dcdf', ink: '#1f2328', logo: 'UBIQUITI',
    fa: [A.lcd(70, 9, 26, 26, '#111827', false), A.rect(350, 8, 80, 28, '#c4c7cb', 1)],
    front: [G([B.rj(8, 'LAN ', { rows: 2, order: 'col', pitch: 15.4 }), B.one('WAN', 'RJ45', 'io', { gap: 8 }), B.one('SFP+ WAN', 'SFP', 'io', { gap: 5, ys: [11] }), B.one('SFP+ LAN', 'SFP', 'io', { ys: [32.6], stack: true })], 'left', { x0: 110 })],
    rear: [G([PSU], 'center')], src: SRC.DS, notes: 'Router/Firewall mit Controller, 8× LAN, 1× WAN, 2× SFP+, Festplattenschacht.' }),
  mk({ id: 'ubnt-udm-se', name: 'UniFi Dream Machine SE', man: 'Ubiquiti', cat: ROUTER, u: 1, depth: 285, color: '#d9dcdf', ink: '#1f2328', logo: 'UBIQUITI',
    fa: [A.lcd(70, 9, 26, 26, '#111827', false), A.rect(350, 8, 80, 28, '#c4c7cb', 1)],
    front: [G([B.rj(8, 'LAN ', { rows: 2, order: 'col', pitch: 15.4 }), B.one('WAN 2.5G', 'RJ45', 'io', { gap: 8 }), B.one('SFP+ WAN', 'SFP', 'io', { gap: 5, ys: [11] }), B.one('SFP+ LAN', 'SFP', 'io', { ys: [32.6], stack: true })], 'left', { x0: 110 })],
    rear: [G([PSU], 'center')], src: SRC.EST, notes: '8× LAN mit PoE, 2,5-G-WAN, 2× SFP+.' }),
  mk({ id: 'mikrotik-ccr2004-16g-2s', name: 'CCR2004-16G-2S+', man: 'MikroTik', cat: ROUTER, u: 1, depth: 280, color: '#2b2d31', logo: 'MIKROTIK', front: switchFront({ rj: 16, sfp: 2, console: 'left' }), rear: [G([PSU2])], src: SRC.DS, notes: 'Router: 16× 1 G, 2× SFP+, redundante Netzteile.' }),
  mk({ id: 'mikrotik-ccr2116-12g-4s', name: 'CCR2116-12G-4S+', man: 'MikroTik', cat: ROUTER, u: 1, depth: 300, color: '#2b2d31', logo: 'MIKROTIK', front: switchFront({ rj: 12, sfp: 4, console: 'left', mgmt: true }), rear: [G([PSU2])], src: SRC.DS, notes: 'Router: 12× 1 G + MGMT, 4× SFP+.' }),
  mk({ id: 'peplink-balance-310x', name: 'Balance 310X', man: 'Peplink', cat: ROUTER, u: 1, depth: 280, color: '#1f2937', logo: 'PEPLINK',
    front: [G([B.list(['WAN 1', 'WAN 2', 'WAN 3'], 'RJ45', 'io'), B.list(['LAN 1', 'LAN 2'], 'RJ45', 'io', { gap: 8 }), B.one('Console', 'RJ45', 'io', { gap: 8 }), B.one('USB', 'USB', 'io', { gap: 5 })], 'right')],
    rear: [G([PSU]), G([B.list(['Mobilfunk 1', 'Mobilfunk 2', 'WLAN 1', 'WLAN 2'], 'SMA', 'io', { gap: 8 })], 'right')], src: SRC.EST, notes: 'Bonding-/Multi-WAN-Router mit Mobilfunkmodem (SpeedFusion).' }),
  mk({ id: 'gen-lte-router-1u', name: '4G/5G-Router 1 HE (Antennen)', man: 'Generisch', cat: ROUTER, u: 1, depth: 250, color: '#26282c', model: 'Mobilfunk-Router',
    front: [G([B.list(['WAN', 'LAN 1', 'LAN 2', 'LAN 3', 'LAN 4'], 'RJ45', 'io'), B.list(['SIM 1', 'SIM 2'], 'GENERIC', 'io', { gap: 10 })], 'right')],
    rear: [G([PSU]), G([B.list(['Mobil 1', 'Mobil 2', 'Mobil 3', 'Mobil 4', 'GPS'], 'SMA', 'io', { gap: 6 })], 'right')], src: GEN }),
];

// ================================================================== Server
const serverRear = (o: { lom: number; sfp?: number; idrac: string; vga?: boolean; usb?: number; psuSplit?: boolean; slots?: number; H?: number }) => {
  const ports: Blk[] = [
    B.one(o.idrac, 'RJ45', 'io'), B.rj(o.lom, 'LOM ', { gap: 5 }),
    ...(o.sfp ? [B.sfp(o.sfp, 'OCP SFP28 ', { gap: 6 })] : []),
    ...(o.vga !== false ? [B.one('VGA', 'VGA', 'out', { gap: 6 })] : []),
    B.list(Array.from({ length: o.usb ?? 2 }, (_, i) => `USB ${i + 1}`), 'USB', 'io', { gap: 5, rows: (o.usb ?? 2) > 1 ? 2 : 1 }),
  ];
  return o.psuSplit ? [G([B.one('PSU 1', 'IEC_C14', 'in')]), G(ports, 'center', { x0: 70, x1: 400 }), G([B.one('PSU 2', 'IEC_C14', 'in')], 'right')] : [G(ports), G([PSU2], 'right')];
};
const servers: DeviceTemplate[] = [
  mk({ id: 'dell-r660', name: 'PowerEdge R660', man: 'Dell', cat: SRV, u: 1, depth: 790, color: '#26282c', logo: 'DELL', weight: 21, fa: serverFront({ u: 1, bays: 10, kind: 'sff', x0: 120 }),
    rear: serverRear({ lom: 2, sfp: 2, idrac: 'iDRAC', psuSplit: true }), rearVents: true, src: SRC.DS, notes: '1-HE-Server, 10× 2,5"-Schächte, OCP-NIC hier mit 2× SFP28.' }),
  mk({ id: 'dell-r760', name: 'PowerEdge R760', man: 'Dell', cat: SRV, u: 2, depth: 770, color: '#26282c', logo: 'DELL', weight: 29, fa: serverFront({ u: 2, bays: 12, kind: 'lff', x0: 90 }),
    rear: serverRear({ lom: 2, sfp: 2, idrac: 'iDRAC', psuSplit: true }), rearVents: true, src: SRC.DS, notes: '2-HE-Server, 12× 3,5"-Schächte.' }),
  mk({ id: 'hpe-dl360-g11', name: 'ProLiant DL360 Gen11', man: 'HPE', cat: SRV, u: 1, depth: 750, color: '#2f3237', logo: 'HPE', weight: 18, fa: serverFront({ u: 1, bays: 8, kind: 'sff', x0: 140 }),
    rear: serverRear({ lom: 4, idrac: 'iLO' }), rearVents: true, src: SRC.DS, notes: '1-HE-Server, 8× 2,5"-Schächte, 4× 1 G LOM (OCP).' }),
  mk({ id: 'hpe-dl380-g11', name: 'ProLiant DL380 Gen11', man: 'HPE', cat: SRV, u: 2, depth: 730, color: '#2f3237', logo: 'HPE', weight: 25, fa: serverFront({ u: 2, bays: 12, kind: 'lff', x0: 90 }),
    rear: serverRear({ lom: 4, sfp: 2, idrac: 'iLO' }), rearVents: true, src: SRC.DS, notes: '2-HE-Server, 12× 3,5"-Schächte.' }),
  mk({ id: 'lenovo-sr630v3', name: 'ThinkSystem SR630 V3', man: 'Lenovo', cat: SRV, u: 1, depth: 790, color: '#1d1e20', logo: 'LENOVO', fa: serverFront({ u: 1, bays: 10, kind: 'sff', x0: 120 }),
    rear: serverRear({ lom: 2, sfp: 2, idrac: 'XCC' }), rearVents: true, src: SRC.DS }),
  mk({ id: 'lenovo-sr650v3', name: 'ThinkSystem SR650 V3', man: 'Lenovo', cat: SRV, u: 2, depth: 760, color: '#1d1e20', logo: 'LENOVO', fa: serverFront({ u: 2, bays: 12, kind: 'lff', x0: 90 }),
    rear: serverRear({ lom: 2, sfp: 2, idrac: 'XCC' }), rearVents: true, src: SRC.DS }),
  mk({ id: 'apple-macpro-rack', name: 'Mac Pro (Rack)', man: 'Apple', cat: SRV, u: 5, depth: 550, color: '#b8bcc2', ink: '#1f2328', logo: 'APPLE', fa: (H) => [A.vents(40, 20, 400, H - 40, 60)],
    rear: [G([B.list(['Power A', 'Power B'], 'IEC_C14', 'in', { rows: 2 })]), G([B.list(['HDMI 1', 'HDMI 2'], 'HDMI', 'out', { rows: 2 }), B.list(['10GbE 1', '10GbE 2'], 'RJ45', 'io', { rows: 2, gap: 8 }), B.list(['TB 1', 'TB 2', 'TB 3', 'TB 4', 'TB 5', 'TB 6'], 'USB-C', 'io', { rows: 2, gap: 8 }), B.list(['USB-A 1', 'USB-A 2'], 'USB', 'io', { rows: 2, gap: 8 })], 'right', { x0: 80 })],
    src: SRC.EST, notes: 'Rackversion, 5 HE; PCIe-Karten nicht dargestellt.' }),
  mk({ id: 'gen-server-1u', name: 'Rackserver 1 HE', man: 'Generisch', cat: SRV, u: 1, depth: 650, color: '#26282c', fa: serverFront({ u: 1, bays: 8, kind: 'sff', x0: 120 }), rear: serverRear({ lom: 2, idrac: 'IPMI' }), rearVents: true, src: GEN }),
  mk({ id: 'gen-server-2u', name: 'Rackserver 2 HE', man: 'Generisch', cat: SRV, u: 2, depth: 650, color: '#26282c', fa: serverFront({ u: 2, bays: 12, kind: 'lff', x0: 90 }), rear: serverRear({ lom: 2, sfp: 2, idrac: 'IPMI' }), rearVents: true, src: GEN }),
];

// ================================================================== Storage
const nasRear = (lan: string[], o: { usb?: number; sfp?: number; psu2?: boolean } = {}) => [
  G([o.psu2 ? PSU2 : PSU]),
  G([B.list(lan, 'RJ45', 'io'), ...(o.sfp ? [B.sfp(o.sfp, 'SFP+ ', { gap: 6 })] : []), B.list(Array.from({ length: o.usb ?? 2 }, (_, i) => `USB ${i + 1}`), 'USB', 'io', { gap: 6 })], 'right'),
];
const storage: DeviceTemplate[] = [
  mk({ id: 'syn-rs822p', name: 'RackStation RS822+', man: 'Synology', cat: NAS, u: 1, depth: 480, color: '#26282c', logo: 'SYNOLOGY', fa: serverFront({ u: 1, bays: 4, kind: 'lff', x0: 60 }), rear: nasRear(['LAN 1', 'LAN 2', 'LAN 3', 'LAN 4']), rearVents: true, src: SRC.DS, notes: '4 Schächte, 4× 1 GbE.' }),
  mk({ id: 'syn-rs1221p', name: 'RackStation RS1221+', man: 'Synology', cat: NAS, u: 2, depth: 300, color: '#26282c', logo: 'SYNOLOGY', fa: serverFront({ u: 2, bays: 8, kind: 'lff', x0: 60 }), rear: nasRear(['LAN 1', 'LAN 2', 'LAN 3', 'LAN 4']), rearVents: true, src: SRC.DS, notes: '8 Schächte, kurze Bautiefe, 4× 1 GbE.' }),
  mk({ id: 'syn-rs2423p', name: 'RackStation RS2423+', man: 'Synology', cat: NAS, u: 2, depth: 580, color: '#26282c', logo: 'SYNOLOGY', fa: serverFront({ u: 2, bays: 12, kind: 'lff', x0: 90 }), rear: nasRear(['LAN 1', 'LAN 2', '10GbE'], { psu2: false }), rearVents: true, src: SRC.EST, notes: '12 Schächte, 2× 1 GbE + 1× 10 GbE.' }),
  mk({ id: 'qnap-ts873aeu', name: 'TS-873AeU', man: 'QNAP', cat: NAS, u: 2, depth: 300, color: '#26282c', logo: 'QNAP', fa: serverFront({ u: 2, bays: 8, kind: 'lff', x0: 60 }), rear: nasRear(['2.5GbE 1', '2.5GbE 2', '2.5GbE 3', '2.5GbE 4']), rearVents: true, src: SRC.EST, notes: '8 Schächte, kurze Bautiefe, 4× 2,5 GbE.' }),
  mk({ id: 'gen-nas-1u', name: 'NAS 1 HE (4 Schächte)', man: 'Generisch', cat: NAS, u: 1, depth: 450, color: '#26282c', fa: serverFront({ u: 1, bays: 4, kind: 'lff', x0: 60 }), rear: nasRear(['LAN 1', 'LAN 2']), rearVents: true, src: GEN }),
];

// ================================================================== Gateways, Zeitserver, WLAN, KVM, PDU, Patch
const misc: DeviceTemplate[] = [
  mk({ id: 'meinberg-m300', name: 'LANTIME M300', man: 'Meinberg', cat: GW, u: 1, depth: 300, color: '#e5e7eb', ink: '#1f2328', logo: 'MEINBERG', fa: [A.lcd(150, 9, 100, 26, '#dbeafe', false), A.btn(270, 12, 9, 7), A.btn(270, 24, 9, 7)],
    rear: [G([PSU]), G([B.one('GNSS-Antenne', 'BNC', 'in'), B.list(['PPS Out', '10 MHz Out'], 'BNC75', 'out', { gap: 6 }), B.one('Seriell', 'DSUB9', 'io', { gap: 6 }), B.rj(4, 'LAN ', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'NTP/PTP-Zeitserver (z. B. als PTP-Grandmaster für Dante/AES67) mit GNSS-Empfänger.' }),
  mk({ id: 'opengear-cm8148', name: 'CM8148 Konsolenserver', man: 'Opengear', cat: GW, u: 1, depth: 300, color: '#2b2d31', logo: 'OPENGEAR', model: 'CM8148',
    front: [G([B.rj(48, 'Serial ', { rows: 2, order: 'col', pitch: 15 })], 'right')],
    rear: [G([PSU2]), G([B.list(['NET 1', 'NET 2'], 'RJ45', 'io'), B.sfp(2, 'SFP ', { gap: 6 }), B.list(['USB 1', 'USB 2'], 'USB', 'io', { gap: 6 })], 'right')], src: SRC.EST, notes: '48 serielle Konsolenports (RJ45) für Out-of-Band-Zugriff.' }),
  mk({ id: 'gen-mediaconv-chassis', name: 'Medienkonverter-Chassis 14 Slots', man: 'Generisch', cat: GW, u: 2, depth: 250, color: '#26282c', model: 'Medienkonverter 14×',
    front: [G([B.rj(14, 'Kupfer ', { ys: [24], pitch: 28 }), { c: 'SFP', n: 14, pre: 'Faser ', dir: 'io', ys: [62], stack: true, pitch: 28 }], 'center')],
    rear: [G([PSU2], 'center')], src: GEN, notes: 'Je Slot RJ45 ↔ SFP.' }),
  mk({ id: 'cisco-c9800-l', name: 'Catalyst 9800-L WLC', man: 'Cisco', cat: WLAN, u: 1, depth: 410, color: '#3c4148', logo: 'CISCO',
    front: [G([B.list(['Console', 'Service'], 'RJ45', 'io', { rows: 2 }), B.rj(4, 'GE ', { rows: 2, order: 'col', gap: 8 }), B.sfp(2, 'SFP+ ', { rows: 2, gap: 6 }), B.one('USB', 'USB', 'io', { gap: 6 })], 'right')],
    rear: [G([PSU])], src: SRC.EST, notes: 'WLAN-Controller für bis zu 250 Access Points.' }),
  mk({ id: 'aten-cl5716', name: 'CL5716 LCD-KVM-Konsole', man: 'ATEN', cat: KVM, u: 1, depth: 640, color: '#2a2c30', logo: 'ATEN', model: 'CL5716 17" 16 Port',
    fa: (H) => [A.rect(110, H / 2 - 4, 270, 8, '#111214', 1)],
    rear: [G([PSU]), G([{ c: 'GENERIC', n: 16, pre: 'KVM ', dir: 'io', rows: 2, order: 'col', pitch: 16 }, B.one('LAN', 'RJ45', 'io', { gap: 8 }), B.one('Konsole extern', 'VGA', 'out', { gap: 6 })], 'right')],
    src: SRC.EST, notes: 'Auszug mit 17"-Display, Tastatur und 16 KVM-Ports (KVM-Kabel).' }),
  mk({ id: 'aten-cs1716a', name: 'CS1716A KVM-Switch', man: 'ATEN', cat: KVM, u: 1, depth: 240, color: '#2a2c30', logo: 'ATEN',
    fa: (H) => Array.from({ length: 16 }, (_, i) => A.btn(110 + i * 18, H / 2 - 4, 12, 8, String(i + 1))),
    rear: [G([PSU]), G([{ c: 'VGA', n: 16, pre: 'PC ', dir: 'io', rows: 2, order: 'col', pitch: 33 }, B.one('Konsole VGA', 'VGA', 'out', { gap: 6 })], 'right')], src: SRC.EST }),
  mk({ id: 'apc-ap7920b', name: 'Switched Rack PDU AP7920B', man: 'APC', cat: PDU, u: 1, depth: 230, color: '#1c1d20', logo: 'APC', model: 'AP7920B',
    front: [G([B.one('Netz In', 'IEC_C14', 'in'), { c: 'IEC_C13', n: 8, pre: 'Out ', dir: 'out', gap: 14, pitch: 30 }, B.one('Netzwerk', 'RJ45', 'io', { gap: 10 }), B.one('Seriell', 'RJ45', 'io', { gap: 4 })], 'right')],
    src: SRC.DS, notes: 'Schaltbare PDU, jede Steckdose per Netzwerk schalt- und messbar.' }),
  mk({ id: 'gen-pdu-c13c19-1u', name: 'PDU 1 HE 8× C13 + 2× C19 (Monitoring)', man: 'Generisch', cat: PDU, u: 1, depth: 200, color: '#1c1d20', model: 'PDU C13/C19',
    front: [G([B.one('Netz In', 'IEC_C20', 'in'), { c: 'IEC_C13', n: 8, pre: 'C13 ', dir: 'out', gap: 12, pitch: 29 }, B.list(['C19 1', 'C19 2'], 'IEC_C19', 'out', { gap: 6, pitch: 32 }), B.one('LAN', 'RJ45', 'io', { gap: 6 })], 'right')], src: GEN }),
  mk({ id: 'gen-fiber-lc24', name: 'LWL-Patchfeld 24× LC-Duplex', man: 'Generisch', cat: PATCH, u: 1, depth: 250, color: '#18191c', logo: false,
    front: [G([{ c: 'LC', n: 24, pre: 'LC ', dir: 'io', rows: 2, order: 'row', pitch: 17 }], 'center')], rear: [G([{ c: 'LC', n: 24, pre: 'R LC ', dir: 'io', rows: 2, order: 'row', pitch: 17 }], 'center')], src: GEN, notes: 'Mit Spleißkassette.' }),
  mk({ id: 'gen-patch-rj45-48', name: 'Patchfeld 48× RJ45 (1 HE, high density)', man: 'Generisch', cat: PATCH, u: 1, depth: 80, color: '#18191c', logo: false,
    front: [G([B.rj(48, '', { rows: 2, order: 'row', pitch: 16.4 })], 'center')], rear: [G([B.rj(48, 'R', { rows: 2, order: 'row', pitch: 16.4 })], 'center')], src: GEN }),
  mk({ id: 'gen-brush-1u', name: 'Bürstenleiste 1 HE', man: 'Generisch', cat: 'Zubehör', u: 1, depth: 30, color: '#141414', logo: false, fa: (H) => [A.rect(30, H / 2 - 4, 422, 8, '#050506', 2)], src: GEN }),
];

export const IT_DEVICES: DeviceTemplate[] = [...switches, ...routers, ...servers, ...storage, ...misc];
