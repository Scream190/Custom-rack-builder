import type { Project, Rack } from '../model/types';
import { bayOf, deviceViewX, deviceTopY, faceWidth, PANEL_GAP, rackBays, rackExtent, U } from '../model/geometry';
import { buildOf, isFlightRack, rackDims } from '../model/rackBuild';
import { DeviceFace, shade } from './DeviceFace';
import { CaseDefs } from './CaseDrawing';

/*
 * Technical drawing of a rack housing (1 unit = 1 mm): front view with the front lid taken off (rails, devices),
 * left side view closed (lids, latches, handles, castors) and a top section with the depth check of every device.
 */

const EDGE = '#3f444b';
const along = (a: number, b: number, step: number) => {
  const n = Math.max(1, Math.round((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
};
const Rivet = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="url(#cs-dome)" stroke="#5b6168" strokeWidth={0.4} />;

function Dim({ x1, y1, x2, y2, label, ink, fs }: { x1: number; y1: number; x2: number; y2: number; label: string; ink: string; fs: number }) {
  const horiz = Math.abs(y2 - y1) < 0.01, t = fs * 0.45;
  return (
    <g stroke={ink} strokeWidth={fs * 0.07} fill={ink}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {horiz ? <><line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} /><line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} /></>
        : <><line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} /><line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} /></>}
      {horiz ? <text x={(x1 + x2) / 2} y={y1 - fs * 0.35} fontSize={fs} textAnchor="middle" stroke="none">{label}</text>
        : <text x={x1 + fs * 0.5} y={(y1 + y2) / 2 + fs * 0.35} fontSize={fs} stroke="none">{label}</text>}
    </g>
  );
}

function Panel({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      <rect x={x} y={y} width={w} height={h} fill="url(#cs-lam)" />
      <rect x={x} y={y} width={w} height={h} fill="url(#cs-shade)" />
    </g>
  );
}

export function rackSheetLayout(rack: Rack) {
  const d = rackDims(rack.type);
  const u = Math.max(0.8, Math.min(2.2, Math.max(d.W, d.D, d.H) / 700));
  const GAP = 190 * u, LABEL = 60 * u;
  const front = { x: 0, y: LABEL, w: d.W, h: d.H };
  const side = { x: d.W + GAP, y: LABEL, w: d.D, h: d.H };
  const top = { x: 0, y: LABEL + d.H + GAP, w: d.W, h: d.D };
  return { d, u, front, side, top, w: side.x + d.D + 120 * u, h: top.y + d.D + 90 * u };
}

export function RackSheet({ project, rack, devices, light }: { project: Project; rack: Rack; devices: boolean; light?: boolean }) {
  const t = rack.type;
  const b = buildOf(t);
  const L = rackSheetLayout(rack);
  const { d, u } = L;
  const ink = light ? '#111' : '#cbd5e1';
  const fsT = 26 * u, fsD = 18 * u;
  const flight = isFlightRack(t.kind);
  const lam = t.color;
  const leg = b.profile === 'alu35' ? 35 : b.profile === 'alu30' ? 30 : 0;
  const closeH = 20;
  const ext = rackExtent(t);
  const title = (x: number, y: number, s: string) => <text x={x} y={y - 16 * u} fontSize={fsT} fontWeight={700} fill={ink}>{s}</text>;

  // ------------------------------------------------ front view (front lid off)
  const F = L.front;
  const innerX = F.x + (d.W - d.innerW) / 2, innerY = F.y + (d.caseH - d.innerH) / 2;
  const bayX0 = innerX + d.bayX, bayTop = innerY + d.innerH - d.bayY - ext.h; // svg y of the top of the bay extent
  const frontView = (
    <g>
      {title(F.x, F.y, flight ? 'Vorderansicht, Frontdeckel abgenommen' : t.kind === 'cabinet' ? 'Vorderansicht, Tür offen' : 'Vorderansicht')}
      {flight ? (
        <>
          <Panel x={F.x} y={F.y} w={d.W} h={d.caseH} color={lam} />
          {/* closing profile rim around the opening */}
          <rect x={F.x} y={F.y} width={d.W} height={d.caseH} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.8} />
          <rect x={innerX - 3} y={innerY - 3} width={d.innerW + 6} height={d.innerH + 6} fill="#0b0c0e" stroke="#000" strokeWidth={1} />
          {along(F.x + 60, F.x + d.W - 60, 150).map((x, i) => <g key={i}><Rivet x={x} y={F.y + d.wall / 2 + 1} /><Rivet x={x} y={F.y + d.caseH - d.wall / 2 - 1} /></g>)}
          {t.kind === 'shockmount' ? (
            <>
              <rect x={innerX + d.travel} y={innerY + d.travel} width={d.innerW - 2 * d.travel} height={d.innerH - 2 * d.travel} fill={shade(lam, -0.2)} stroke="#000" strokeWidth={1} />
              <rect x={innerX + d.travel + 9} y={innerY + d.travel + 9} width={d.innerW - 2 * d.travel - 18} height={d.innerH - 2 * d.travel - 18} fill="#0b0c0e" />
              {[0.2, 0.8].map((f) => [innerY + d.travel / 2, innerY + d.innerH - d.travel / 2].map((y, j) => (
                <rect key={`${f}-${j}`} x={innerX + d.innerW * f - 18} y={y - d.travel / 2 + 3} width={36} height={d.travel - 6} rx={4} fill={b.shock?.damper === 'foam' ? '#3a3d42' : '#26292e'} stroke="#000" strokeWidth={0.6} />
              )))}
            </>
          ) : null}
        </>
      ) : t.kind === 'cabinet' ? (
        <>
          <rect x={F.x} y={F.y} width={d.W} height={d.caseH} rx={3} fill="#1a1b1e" stroke="#4b5057" strokeWidth={1} />
          <rect x={F.x + d.wall} y={F.y + 50} width={d.W - 2 * d.wall} height={d.caseH - 110} fill="#0b0c0e" />
          <rect x={F.x + d.wall} y={F.y + d.caseH - 60} width={d.W - 2 * d.wall} height={60} fill="#111214" />
        </>
      ) : (
        <>
          {[F.x, F.x + d.W - 30].map((x, i) => <rect key={i} x={x} y={F.y} width={30} height={d.caseH} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
          {[F.y, F.y + d.caseH - 40].map((y, i) => <rect key={i} x={F.x} y={y} width={d.W} height={40} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
        </>
      )}
      {/* rails with holes */}
      {rackBays(t).map((bay, i) => {
        const fw = faceWidth(bay.rackStandard), h = bay.heightU * U;
        const x0 = bayX0 + bay.x, y0 = bayTop + ext.h - bay.y - h;
        const earW = (fw - (bay.rackStandard === 19 ? 450 : 222.25)) / 2;
        return (
          <g key={i}>
            {[x0, x0 + fw - earW].map((rx, k) => (
              <g key={k}>
                <rect x={rx} y={y0} width={earW} height={h} fill="#2a2c30" stroke="#45484e" strokeWidth={0.6} />
                {Array.from({ length: bay.heightU * 3 }, (_, j) => {
                  const uu = Math.floor(j / 3), off = [6.35, 22.225, 38.1][j % 3];
                  return <rect key={j} x={rx + earW / 2 - 4.75} y={y0 + h - uu * U - off - 4.75} width={9.5} height={9.5} fill="#050506" />;
                })}
              </g>
            ))}
            <text x={x0 + fw / 2} y={y0 + h + 14 * u} fontSize={fsD * 0.8} textAnchor="middle" fill="#8b939e">{bay.label ? `${bay.label}, ` : ''}{bay.heightU} HE</text>
          </g>
        );
      })}
      {devices ? rack.devices.filter((x) => x.mount === 'front').map((dev) => {
        const tpl = project.templates[dev.templateId];
        if (!tpl) return null;
        const w = faceWidth(bayOf(rack, dev).rackStandard) / tpl.slots;
        const x = bayX0 + deviceViewX(rack, dev, tpl, 'front');
        const y = bayTop + ext.h - deviceTopY(dev, tpl, rack) + PANEL_GAP / 2;
        return <g key={dev.id} transform={`translate(${x},${y})`}><DeviceFace tpl={tpl} panel="front" width={w} device={dev} showPortLabels={false} /></g>;
      }) : null}
      <Castors x={F.x} w={d.W} y={F.y + d.caseH} d={d} size={b.castorSize} n={b.castors} />
      <Dim x1={F.x} y1={F.y + d.H + 36 * u} x2={F.x + d.W} y2={F.y + d.H + 36 * u} label={`${Math.round(d.W)} mm`} ink={ink} fs={fsD} />
      <Dim x1={F.x + d.W + 28 * u} y1={F.y} x2={F.x + d.W + 28 * u} y2={F.y + d.H} label={`${Math.round(d.H)} mm`} ink={ink} fs={fsD} />
      {d.castorH ? <Dim x1={F.x - 26 * u} y1={F.y} x2={F.x - 26 * u} y2={F.y + d.caseH} label="" ink={ink} fs={fsD} /> : null}
      {d.castorH ? <text x={F.x - 32 * u} y={F.y + d.caseH / 2} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{Math.round(d.caseH)}</text> : null}
    </g>
  );

  // ------------------------------------------------ left side view, closed
  const Sd = L.side;
  const xF = Sd.x;                       // front edge (left in this view)
  const xBody = xF + d.lidF, xRear = xBody + d.bodyD;
  const per = b.latches === 4 ? 1 : b.latches === 6 ? 1 : 2;
  const sideView = (
    <g>
      {title(Sd.x, Sd.y, 'Seitenansicht links, geschlossen (vorne = links)')}
      {flight ? (
        <>
          {d.lidF ? <Panel x={xF} y={Sd.y} w={d.lidF} h={d.caseH} color={lam} /> : null}
          <Panel x={xBody} y={Sd.y} w={d.bodyD} h={d.caseH} color={lam} />
          {d.lidR ? <Panel x={xRear} y={Sd.y} w={d.lidR} h={d.caseH} color={lam} /> : null}
          {leg ? (
            <>
              {/* horizontal angles top and bottom over the full depth, vertical ones at the lid fronts */}
              {[Sd.y, Sd.y + d.caseH - leg].map((y, i) => <g key={i}><rect x={xF} y={y} width={d.D} height={leg} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.5} />{along(xF + 50, xF + d.D - 50, 120).map((x, j) => <Rivet key={j} x={x} y={y + leg / 2} />)}</g>)}
              {d.lidF ? <rect x={xF} y={Sd.y} width={leg} height={d.caseH} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} /> : null}
              {d.lidR ? <rect x={xF + d.D - leg} y={Sd.y} width={leg} height={d.caseH} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} /> : null}
            </>
          ) : null}
          {/* closing profiles at the splits */}
          {[d.lidF ? xBody : null, d.lidR ? xRear : null].map((x, i) => (x === null ? null : (
            <g key={i}>
              <rect x={x - closeH} y={Sd.y - 1} width={2 * closeH} height={d.caseH + 2} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
              <rect x={x - 1} y={Sd.y - 1} width={2} height={d.caseH + 2} fill="#0b0c0e" />
              {Array.from({ length: per }, (_, k) => {
                const y = Sd.y + ((k + 1) / (per + 1)) * d.caseH;
                const dir = i === 0 ? 1 : -1; // latch on the body, keeper on the lid
                return (
                  <g key={k}>
                    <rect x={x + dir * (closeH + 2) + (dir > 0 ? 0 : -54)} y={y - 34} width={54} height={68} rx={6} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
                    <rect x={x + dir * (closeH + 2) + (dir > 0 ? 7 : -47)} y={y - 27} width={40} height={54} rx={4.5} fill="url(#cs-recess)" />
                    <path transform={`translate(${x + dir * (closeH + 29)},${y}) rotate(90)`} d="M-22,0 C-22,-13 -6,-10 0,-4 C6,-10 22,-13 22,0 C22,13 6,10 0,4 C-6,10 -22,13 -22,0 Z" fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
                    <rect x={x - dir * (closeH + 2) + (dir > 0 ? -18 : 0)} y={y - 20} width={18} height={40} rx={2} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.6} />
                  </g>
                );
              })}
            </g>
          )))}
          {/* handles on the body side */}
          {Array.from({ length: b.handles }, (_, k) => {
            const x = xBody + ((k + 1) / (b.handles + 1)) * d.bodyD, y = Sd.y + d.caseH * 0.38;
            return (
              <g key={k} transform={`translate(${x},${y})`}>
                <rect x={-72} y={-44} width={150} height={96} rx={10} fill="#000" fillOpacity={0.35} />
                <rect x={-75} y={-48} width={150} height={96} rx={10} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
                <rect x={-63} y={-36} width={126} height={72} rx={9} fill="url(#cs-recess)" />
                <rect x={-52} y={10} width={104} height={13} rx={6.5} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
              </g>
            );
          })}
          {b.cornerBalls ? (
            <>
              {d.lidF ? [Sd.y, Sd.y + d.caseH].map((y, i) => <circle key={`f${i}`} cx={xF + 10} cy={y + (i ? -10 : 10)} r={17} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.8} />) : null}
              {d.lidR ? [Sd.y, Sd.y + d.caseH].map((y, i) => <circle key={`r${i}`} cx={xF + d.D - 10} cy={y + (i ? -10 : 10)} r={17} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.8} />) : null}
            </>
          ) : null}
        </>
      ) : t.kind === 'cabinet' ? (
        <rect x={xF} y={Sd.y} width={d.D} height={d.caseH} rx={3} fill="#1a1b1e" stroke="#4b5057" strokeWidth={1} />
      ) : (
        <>
          {[xF, xF + d.D - 30].map((x, i) => <rect key={i} x={x} y={Sd.y} width={30} height={d.caseH} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
          {[Sd.y, Sd.y + d.caseH - 40].map((y, i) => <rect key={i} x={xF} y={y} width={d.D} height={40} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
        </>
      )}
      <Castors x={flight ? xBody : xF} w={flight ? d.bodyD : d.D} y={Sd.y + d.caseH} d={d} size={b.castorSize} n={b.castors} />
      <Dim x1={xF} y1={Sd.y + d.H + 44 * u} x2={xF + d.D} y2={Sd.y + d.H + 36 * u} label={`${Math.round(d.D)} mm`} ink={ink} fs={fsD} />
      {d.lidF ? <Dim x1={xF} y1={Sd.y + d.H + 14 * u} x2={xBody} y2={Sd.y + d.H + 14 * u} label={`${Math.round(d.lidF)}`} ink={ink} fs={fsD * 0.8} /> : null}
      {d.lidR ? <Dim x1={xRear} y1={Sd.y + d.H + 14 * u} x2={xF + d.D} y2={Sd.y + d.H + 14 * u} label={`${Math.round(d.lidR)}`} ink={ink} fs={fsD * 0.8} /> : null}
    </g>
  );

  // ------------------------------------------------ top section: rails and device depths
  const T = L.top;
  const zToY = (zFromFront: number) => T.y + zFromFront; // front at the top of this view
  const railFront = d.lidF + d.railZ, railRear = railFront + t.depth;
  const topView = (
    <g>
      {title(T.x, T.y, 'Schnitt von oben: Einbautiefe und Gerätetiefen (vorne = oben)')}
      <rect x={T.x} y={T.y} width={d.W} height={d.D} fill={flight ? shade(lam, -0.1) : '#1a1b1e'} stroke={EDGE} strokeWidth={1} />
      <rect x={innerX} y={zToY(d.lidF ? d.wall : 0)} width={d.innerW} height={d.D - (d.lidF ? d.wall : 0) - (d.lidR ? d.wall : 0)} fill="#0e0f11" />
      {d.lidF ? <line x1={T.x} y1={zToY(d.lidF)} x2={T.x + d.W} y2={zToY(d.lidF)} stroke="#c3c8ce" strokeWidth={3} /> : null}
      {d.lidR ? <line x1={T.x} y1={zToY(d.D - d.lidR)} x2={T.x + d.W} y2={zToY(d.D - d.lidR)} stroke="#c3c8ce" strokeWidth={3} /> : null}
      {rackBays(t).map((bay, i) => {
        const fw = faceWidth(bay.rackStandard), x0 = bayX0 + bay.x;
        return (
          <g key={i}>
            <rect x={x0} y={zToY(railFront) - 2} width={fw} height={4} fill="#8b939e" />
            {t.hasRearRails ? <rect x={x0} y={zToY(railRear) - 2} width={fw} height={4} fill="#8b939e" /> : null}
          </g>
        );
      })}
      {devices ? rack.devices.map((dev) => {
        const tpl = project.templates[dev.templateId];
        if (!tpl) return null;
        const w = faceWidth(bayOf(rack, dev).rackStandard) / tpl.slots;
        const x = bayX0 + deviceViewX(rack, dev, tpl, 'front');
        const fromFront = dev.mount === 'front';
        const tooDeep = fromFront ? tpl.depth > t.depth + b.rearGap : tpl.depth > t.depth + d.railZ;
        const y0 = fromFront ? zToY(railFront) : zToY(railRear) - tpl.depth;
        return <rect key={dev.id} x={x + 4} y={y0} width={w - 8} height={tpl.depth} fill={tooDeep ? '#7f1d1d' : '#334155'} fillOpacity={0.55} stroke={tooDeep ? '#ef4444' : '#64748b'} strokeWidth={0.8} />;
      }) : null}
      <Dim x1={T.x + d.W + 28 * u} y1={zToY(railFront)} x2={T.x + d.W + 28 * u} y2={zToY(railRear)} label={`Einbautiefe ${t.depth}`} ink={ink} fs={fsD} />
      <Dim x1={T.x - 26 * u} y1={zToY(0)} x2={T.x - 26 * u} y2={zToY(d.D)} label="" ink={ink} fs={fsD} />
      <text x={T.x - 32 * u} y={zToY(d.D / 2)} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{Math.round(d.D)}</text>
    </g>
  );

  return <g><CaseDefs />{frontView}{sideView}{topView}</g>;
}

function Castors({ x, w, y, d, size, n }: { x: number; w: number; y: number; d: { castorH: number }; size: number; n: number }) {
  if (!n) return null;
  const r = size / 2;
  return (
    <g>
      {[0.12, 0.88].map((f, i) => {
        const cx = x + Math.max(60, Math.min(w - 60, w * f)), cy = y + d.castorH - r;
        return (
          <g key={i}>
            <rect x={cx - 50} y={y} width={100} height={6} rx={1.5} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.6} />
            <rect x={cx - 28} y={y + 6} width={56} height={10} rx={2} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
            <circle cx={cx} cy={cy} r={r} fill="#25282d" stroke="#0d0e10" strokeWidth={1} />
            <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke="#33373d" strokeWidth={1.2} />
            <circle cx={cx} cy={cy} r={r * 0.58} fill="url(#cs-hub)" stroke="#4b5057" strokeWidth={0.8} />
            <path d={`M${cx - 24},${y + 16} L${cx + 24},${y + 16} L${cx + 12},${cy + 4} L${cx - 12},${cy + 4} Z`} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
            <circle cx={cx} cy={cy} r={6} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.6} />
            {i === 0 ? <path d={`M${cx + 14},${y + 20} L${cx + 44},${y + 14} L${cx + 46},${y + 22} L${cx + 16},${y + 29} Z`} fill="#c62828" stroke="#7f1d1d" strokeWidth={0.6} /> : null}
          </g>
        );
      })}
    </g>
  );
}

/** standalone svg (exports) */
export function RackSheetSvg(props: { project: Project; rack: Rack; devices: boolean; light?: boolean }) {
  const L = rackSheetLayout(props.rack);
  const pad = 90 * L.u;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${-pad} 0 ${L.w + pad} ${L.h}`} width={L.w + pad} height={L.h} fontFamily="Inter, Arial, Helvetica, sans-serif">
      {props.light ? <rect x={-pad} y={0} width={L.w + pad} height={L.h} fill="#ffffff" /> : null}
      <RackSheet {...props} />
    </svg>
  );
}
