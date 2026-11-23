import type { ArtElement, PlacedDevice } from '../model/types';

const FONT = 'Inter, Arial, Helvetica, sans-serif';

/** Renders decorative panel graphics. `ink` = default line/text colour of the panel. */
export function ArtLayer({ items, ink, device }: { items: ArtElement[]; ink: string; device?: PlacedDevice }) {
  // first channel shown on each display (a display shows its channels up to where the next display starts)
  const starts = [...new Set(items.filter((a): a is Extract<ArtElement, { t: 'lcd' }> => a.t === 'lcd' && !!a.info).map((a) => Math.max(1, a.channel || 1)))].sort((x, y) => x - y);
  return <g pointerEvents="none">{items.map((a, i) => <Art key={i} a={a} ink={ink} device={device} starts={starts} />)}</g>;
}

function Art({ a, ink, device, starts }: { a: ArtElement; ink: string; device?: PlacedDevice; starts: number[] }) {
  switch (a.t) {
    case 'rect':
      return <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={a.rx ?? 0} fill={a.fill ?? 'none'} stroke={a.stroke ?? (a.fill ? 'none' : ink)} strokeWidth={a.sw ?? 0.35} />;
    case 'circle':
      return <circle cx={a.x} cy={a.y} r={a.r} fill={a.fill ?? 'none'} stroke={a.stroke ?? (a.fill ? 'none' : ink)} strokeWidth={a.sw ?? 0.35} />;
    case 'line':
      return <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.stroke ?? ink} strokeWidth={a.sw ?? 0.35} />;
    case 'path':
      return <path d={a.d} fill={a.fill ?? 'none'} stroke={a.stroke ?? (a.fill ? 'none' : ink)} strokeWidth={a.sw ?? 0.35} />;
    case 'text':
      return (
        <text x={a.x} y={a.y} fontSize={a.size} fill={a.fill ?? ink} fontWeight={a.weight ?? 400} textAnchor={a.anchor ?? 'start'}
          fontStyle={a.italic ? 'italic' : undefined} letterSpacing={a.spacing} fontFamily={FONT}>
          {a.text}
        </text>
      );
    case 'lcd': {
      const tint = a.tint ?? '#7dd3fc';
      // content: device label + fields (frequency …) when available
      const lines: string[] = [];
      const maxLines = Math.max(1, Math.min(4, Math.floor((a.h - 2) / 4.4)));
      const rfChannels = device?.rf?.channels?.some((c) => c.name || c.f) ? device.rf.channels : null;
      if (a.info && device && rfChannels) {
        // wireless channels: "name  606.500" per line
        const first = Math.max(1, a.channel || 1);
        const next = starts.find((s) => s > first) ?? rfChannels.length + 1;
        const own = rfChannels.slice(first - 1, next - 1);
        if (own.length < maxLines && first === 1 && device.label) lines.push(device.label);
        own.forEach((c, i) => lines.push(`${(c.name || `Ch ${first + i}`).slice(0, 10).padEnd(10)} ${c.f ? c.f.toFixed(3) : '---.---'}`));
      } else if (a.info && device) {
        const ch = a.channel;
        const vals = device.fields ? Object.entries(device.fields).filter(([, v]) => v) : [];
        if (ch === undefined || ch === 0) {
          if (device.label) lines.push(device.label);
          for (const [, v] of vals) lines.push(v);
        } else if (device.label) lines.push(`${device.label} · ${ch}`);
      }
      const shown = lines.slice(0, maxLines);
      const fs = Math.min(4.2, ((a.h - 2) / Math.max(2, shown.length || 2)) * 0.85, (a.w - 4) / (Math.max(10, ...shown.map((l) => l.length)) * 0.62));
      return (
        <g>
          <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={0.8} fill="#0a0c10" stroke="#000" strokeWidth={0.4} />
          <rect x={a.x + 1} y={a.y + 1} width={a.w - 2} height={a.h - 2} rx={0.5} fill={tint} opacity={0.16} />
          {shown.map((l, i) => (
            <text key={i} x={a.x + 2.2} y={a.y + 1.8 + fs * (i + 1)} fontSize={fs} fill={tint} fontFamily="'Courier New', monospace" fontWeight={700}>
              {l.length > a.w / (fs * 0.62) ? l.slice(0, Math.floor(a.w / (fs * 0.62))) : l}
            </text>
          ))}
        </g>
      );
    }
    case 'knob':
      return (
        <g>
          <circle cx={a.x} cy={a.y} r={a.r + 0.8} fill="#0b0b0c" />
          <circle cx={a.x} cy={a.y} r={a.r} fill={a.fill ?? '#2b2d31'} stroke="#555" strokeWidth={0.4} />
          <circle cx={a.x} cy={a.y} r={a.r * 0.72} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} />
          <line x1={a.x} y1={a.y - a.r * 0.9} x2={a.x} y2={a.y - a.r * 0.45} stroke="#ddd" strokeWidth={0.6} />
        </g>
      );
    case 'button': {
      const fill = a.fill ?? '#26282c';
      return (
        <g>
          {a.round
            ? <circle cx={a.x + a.w / 2} cy={a.y + a.h / 2} r={Math.min(a.w, a.h) / 2} fill={fill} stroke="#000" strokeWidth={0.4} />
            : <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={0.8} fill={fill} stroke="#000" strokeWidth={0.4} />}
          {a.label ? (
            <text x={a.x + a.w / 2} y={a.y + a.h / 2 + Math.min(a.h * 0.32, 1.3)} fontSize={Math.min(a.h * 0.5, 2.6)} textAnchor="middle" fill={a.text ?? '#e5e7eb'} fontFamily={FONT} fontWeight={600}>
              {a.label}
            </text>
          ) : null}
        </g>
      );
    }
    case 'leds': {
      const r = a.r ?? 0.9;
      return (
        <g>
          {Array.from({ length: a.n }, (_, i) => {
            const col = a.colors?.[i] ?? a.colors?.[a.colors.length - 1] ?? '#3a3d42';
            return <circle key={i} cx={a.x + (a.dx ?? 0) * i} cy={a.y + (a.dy ?? 0) * i} r={r} fill={col} stroke="#000" strokeWidth={0.25} />;
          })}
        </g>
      );
    }
    case 'switch':
      return (
        <g>
          <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={0.8} fill="#0b0b0c" />
          <rect x={a.x + a.w * 0.18} y={a.y + a.h * 0.1} width={a.w * 0.64} height={a.h * 0.8} rx={0.6} fill="#2a2c30" stroke="#555" strokeWidth={0.3} />
          <line x1={a.x + a.w / 2} y1={a.y + a.h * 0.22} x2={a.x + a.w / 2} y2={a.y + a.h * 0.38} stroke="#ddd" strokeWidth={0.5} />
          <circle cx={a.x + a.w / 2} cy={a.y + a.h * 0.68} r={a.w * 0.11} fill="none" stroke="#ddd" strokeWidth={0.4} />
        </g>
      );
    case 'vents': {
      const slots = Array.from({ length: a.n }, (_, i) => i);
      if (a.horizontal) {
        const sh = a.h / (a.n * 2 - 1);
        return <g>{slots.map((i) => <rect key={i} x={a.x} y={a.y + i * sh * 2} width={a.w} height={sh} rx={sh / 2} fill="#050506" />)}</g>;
      }
      const sw = a.w / (a.n * 2 - 1);
      return <g>{slots.map((i) => <rect key={i} x={a.x + i * sw * 2} y={a.y} width={sw} height={a.h} rx={sw / 2} fill="#050506" />)}</g>;
    }
    case 'labelArea':
      return device?.label ? (
        <g>
          <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={0.4} fill="#f5f5f0" stroke="#bbb" strokeWidth={0.2} />
          <text x={a.x + a.w / 2} y={a.y + a.h / 2 + Math.min(a.h * 0.3, 1.4)} fontSize={Math.min(a.h * 0.62, 3.6)} textAnchor="middle" fill="#111" fontWeight={700} fontFamily={FONT}>
            {device.label.length > a.w / 1.9 ? device.label.slice(0, Math.floor(a.w / 1.9)) : device.label}
          </text>
        </g>
      ) : null;
  }
}
