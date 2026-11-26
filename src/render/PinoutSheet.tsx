import type { PinoutCard } from '../model/assembly';
import { AES59 } from '../model/pinout';
import { CablePlugIcon } from './PlugIcon';

/*
 * Pin wiring diagrams for self-made cables: pins of end A on the left, end B on the right, conductors in between
 * (crossing where the pin order differs, e.g. XLR 1-2-3 vs. jack T-R-S), bridges and notes below.
 */

export const CARD_W = 372;
const ROW = 15, TOP = 60, XL = 92, XR = CARD_W - 92;

function wrap(text: string, max = 68): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

const rowsOf = (c: PinoutCard) => (c.wiring.a.family === 'dsub25' ? AES59.length : Math.max(c.wiring.a.pins.length, c.wiring.b.pins.length));
const noteLines = (c: PinoutCard) => [...c.wiring.notes, ...(c.y ? ['Y-Kabel: die Adern des gemeinsamen Steckers gehen parallel auf alle Äste.'] : [])].flatMap((n) => wrap(n));
const usesText = (c: PinoutCard) => `Für ${c.uses.length > 10 ? `${c.uses.slice(0, 10).join(', ')} …` : c.uses.join(', ')}`;
export const cardHeight = (c: PinoutCard) => TOP + rowsOf(c) * ROW + 10 + noteLines(c).length * 10.5 + 16;

function Card({ c, light }: { c: PinoutCard; light?: boolean }) {
  const ink = light ? '#111' : '#e5e7eb', muted = light ? '#555' : '#8b939e', line = light ? '#d1d5db' : '#3a404a';
  const { wiring: w } = c;
  const H = cardHeight(c);
  const yA = (pin: string) => TOP + w.a.pins.findIndex((p) => p.pin === pin) * ROW;
  const yB = (pin: string) => TOP + w.b.pins.findIndex((p) => p.pin === pin) * ROW;
  const pinDot = (x: number, y: number, label: string) => (
    <g>
      <circle cx={x} cy={y} r={6.2} fill={light ? '#f3f4f6' : '#2a2e35'} stroke={muted} strokeWidth={0.6} />
      <text x={x} y={y + 2.6} fontSize={label.length > 2 ? 5 : 7} textAnchor="middle" fontWeight={700} fill={ink}>{label}</text>
    </g>
  );
  const wire = (y1: number, y2: number, color: string, stripe?: string, key?: string) => {
    const d = `M${XL + 6},${y1} C${CARD_W / 2},${y1} ${CARD_W / 2},${y2} ${XR - 6},${y2}`;
    return (
      <g key={key}>
        <path d={d} fill="none" stroke={light ? '#374151' : '#000'} strokeWidth={4.2} strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {stripe ? <path d={d} fill="none" stroke={stripe} strokeWidth={3} strokeDasharray="4 4" /> : null}
      </g>
    );
  };
  const title = `${c.title ? `${c.title}: ` : ''}${c.a.plug.label} ↔ ${c.b.plug.label}`;
  const titleLines = wrap(title, 60);
  return (
    <g>
      <rect x={0} y={0} width={CARD_W} height={H} rx={3} fill="none" stroke={line} strokeWidth={0.8} />
      {titleLines.map((t, i) => <text key={i} x={10} y={13 + i * 11} fontSize={9.5} fontWeight={700} fill={ink}>{t}</text>)}
      <CablePlugIcon kind={c.a.plug.key} x={XL + 4} y={TOP - 22} flip={false} />
      <CablePlugIcon kind={c.b.plug.key} x={XR - 4} y={TOP - 22} flip />
      {w.a.family === 'dsub25' ? (
        AES59.map(([h, cold, g], i) => {
          const y = TOP + i * ROW;
          const t = `${h} / ${cold} / ${g}`;
          return (
            <g key={i}>
              {wire(y, y, '#9ca3af')}
              <text x={XL - 2} y={y + 3} fontSize={8} textAnchor="end" fill={ink}>{`K${i + 1}  ${t}`}</text>
              <text x={XR + 2} y={y + 3} fontSize={8} fill={ink}>{`${t}  K${i + 1}`}</text>
            </g>
          );
        })
      ) : (
        <>
          {w.wires.map((x, i) => wire(yA(x.a!), yB(x.b!), x.color, x.stripe, String(i)))}
          {w.bridges.map((b, i) => {
            const f = b.side === 'a' ? yA : yB, x = b.side === 'a' ? XL - 6 : XR + 6, dx = b.side === 'a' ? -12 : 12;
            const y1 = f(b.from), y2 = f(b.to);
            return <path key={'br' + i} d={`M${x},${y1} C${x + dx},${y1} ${x + dx},${y2} ${x},${y2}`} fill="none" stroke="#f59e0b" strokeWidth={1.8} />;
          })}
          {w.a.pins.map((p) => (
            <g key={'a' + p.pin}>
              {pinDot(XL, yA(p.pin), p.pin)}
              <text x={XL - (w.bridges.some((b) => b.side === 'a') ? 24 : 10)} y={yA(p.pin) + 3} fontSize={8} textAnchor="end" fill={muted}>{p.sig}</text>
            </g>
          ))}
          {w.b.pins.map((p) => (
            <g key={'b' + p.pin}>
              {pinDot(XR, yB(p.pin), p.pin)}
              <text x={XR + (w.bridges.some((b) => b.side === 'b') ? 24 : 10)} y={yB(p.pin) + 3} fontSize={8} fill={muted}>{p.sig}</text>
            </g>
          ))}
        </>
      )}
      {noteLines(c).map((t, i) => <text key={'n' + i} x={10} y={TOP + rowsOf(c) * ROW + 6 + i * 10.5} fontSize={8} fill={muted}>{t}</text>)}
      <text x={10} y={H - 6} fontSize={8} fill={ink}>{usesText(c)}</text>
    </g>
  );
}

/** Grid of pin diagrams (two per row). */
export function PinoutSheet({ cards, light, title = 'Pinbelegung (selbst konfektionierbare Kabel)', cols = 2 }: { cards: PinoutCard[]; light?: boolean; title?: string; cols?: 1 | 2 }) {
  const W = CARD_W * cols + 16 * (cols - 1);
  const pos: { c: PinoutCard; x: number; y: number }[] = [];
  let y = title ? 26 : 2;
  for (let i = 0; i < cards.length; i += cols) {
    const pair = cards.slice(i, i + cols);
    pair.forEach((c, k) => pos.push({ c, x: k * (CARD_W + 16), y }));
    y += Math.max(...pair.map(cardHeight)) + 14;
  }
  const H = y;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} fontFamily="Inter, Arial, Helvetica, sans-serif" style={{ display: 'block' }}>
      {light ? <rect x={0} y={0} width={W} height={H} fill="#ffffff" /> : null}
      {title ? <text x={2} y={15} fontSize={12} fontWeight={700} fill={light ? '#111' : '#e5e7eb'}>{title}</text> : null}
      {pos.map(({ c, x, y: cy }) => <g key={c.key} transform={`translate(${x},${cy})`}><Card c={c} light={light} /></g>)}
    </svg>
  );
}
