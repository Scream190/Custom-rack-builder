import type { DeviceTemplate, PlacedBox } from '../model/types';
import { connectorDef } from '../model/connectors';
import { ConnectorSymbol } from './ConnectorSymbol';
import { shade, type PortState } from './DeviceFace';

interface Props {
  tpl: DeviceTemplate;
  box?: PlacedBox;
  portStates?: Record<string, PortState>;
  selected?: boolean;
  showPortLabels?: boolean;
  /** export / preview: no hit areas */
  plain?: boolean;
}

/** Split/combi box as drawn below the rack (and in the box editor): housing, name, connectors, internal wiring hint. */
export function BoxFace({ tpl, box, portStates, selected, showPortLabels = true, plain }: Props) {
  const spec = tpl.box!;
  const { w, h } = spec;
  const name = box?.label || tpl.name;
  const multi = new Set(spec.links.map((l) => l.multi));
  const col = tpl.color || '#3a3d42';
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={4} fill={col} stroke={selected ? '#22d3ee' : shade(col, 0.35)} strokeWidth={selected ? 1.4 : 0.6} />
      {/* the multi side is shaded, so the direction of the box is visible at a glance */}
      {tpl.ports.filter((p) => multi.has(p.id)).map((p) => {
        const d = connectorDef(p.connector);
        return <rect key={'m' + p.id} x={p.x - d.w / 2 - 5} y={3} width={d.w + 10} height={h - 6} rx={2} fill={shade(col, -0.25)} />;
      })}
      <text x={4} y={-2.5} fontSize={4} fontWeight={700} fill="currentColor">{name}</text>
      <text x={w - 3} y={-2.5} fontSize={3} textAnchor="end" fill="currentColor" opacity={0.7}>
        {spec.kind === 'split' ? 'Splitdose' : 'Kombidose'}{box ? `, ${String(box.distance).replace('.', ',')} m` : ''}
      </text>
      {tpl.ports.map((p) => {
        const def = connectorDef(p.connector);
        const st = portStates?.[p.id] ?? 'normal';
        return (
          <g key={p.id} data-port={box && !plain ? `${box.id}:${p.id}` : undefined} className="port" style={{ cursor: box && !plain ? 'crosshair' : undefined }}>
            <title>{`${name}, ${p.name} (${def.label})`}</title>
            {!plain ? <circle cx={p.x} cy={p.y} r={Math.max(def.w, def.h) / 2 + 3} fill="transparent" /> : null}
            <ConnectorSymbol connector={p.connector} x={p.x} y={p.y} state={st} />
            {showPortLabels ? (
              <text x={p.x} y={p.y + Math.max(def.w, def.h) / 2 + 3.6} fontSize={2.6} textAnchor="middle" fill="#e5e7eb" opacity={0.9} pointerEvents="none">{p.name}</text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
