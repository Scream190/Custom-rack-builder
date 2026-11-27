import type { Project, Rack } from '../model/types';
import { bayOf, bayZ, deviceViewX, deviceTopY, faceWidth, PANEL_GAP, rackBays, U, outerPanel } from '../model/geometry';
import { bayPlace, bottomBlock, buildOf, isFlightRack, rackDims, type RackBlock } from '../model/rackBuild';
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
  const side = { x: Math.max(d.W + GAP, 26 * u * 0.56 * 32 + 60 * u), y: LABEL, w: d.D, h: d.H };
  const top = { x: 0, y: LABEL + d.H + GAP, w: d.W, h: d.D };
  return { d, u, front, side, top, w: Math.max(side.x + d.D + 120 * u, 26 * u * 0.56 * 52), h: top.y + d.D + 90 * u };
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
  const bays = rackBays(t);
  const base = bottomBlock(d);
  const title = (x: number, y: number, s: string) => <text x={x} y={y - 16 * u} fontSize={fsT} fontWeight={700} fill={ink}>{s}</text>;
  const devOf = (bi: number) => rack.devices.filter((x) => Math.min(x.bay ?? 0, bays.length - 1) === bi);

  // ------------------------------------------------ front view (front lids off), blocks from back to front
  const F = L.front;
  const fy = (hy: number) => F.y + d.caseH - hy;  // housing y -> svg y
  const frontBlock = (k: RackBlock, i: number) => {
    const x = F.x + k.x, y = fy(k.y + k.caseH);
    return (
      <g key={i}>
        {flight ? (
          <>
            <Panel x={x} y={y} w={k.W} h={k.caseH} color={lam} />
            <rect x={x} y={y} width={k.W} height={k.caseH} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.8} />
            <rect x={x + k.wall - 3} y={y + k.wall - 3} width={k.innerW + 6} height={k.innerH + 6} fill="#0b0c0e" stroke="#000" strokeWidth={1} />
            {along(x + 60, x + k.W - 60, 150).map((rx, j) => <g key={j}><Rivet x={rx} y={y + k.wall / 2 + 1} /><Rivet x={rx} y={y + k.caseH - k.wall / 2 - 1} /></g>)}
            {t.kind === 'shockmount' ? (
              <>
                <rect x={x + k.wall + k.travel} y={y + k.wall + k.travel} width={k.innerW - 2 * k.travel} height={k.innerH - 2 * k.travel} fill={shade(lam, -0.2)} stroke="#000" strokeWidth={1} />
                <rect x={x + k.wall + k.travel + 9} y={y + k.wall + k.travel + 9} width={k.innerW - 2 * k.travel - 18} height={k.innerH - 2 * k.travel - 18} fill="#0b0c0e" />
                {[0.2, 0.8].map((f) => [y + k.wall + k.travel / 2, y + k.wall + k.innerH - k.travel / 2].map((dy, j) => (
                  <rect key={`${f}-${j}`} x={x + k.wall + k.innerW * f - 18} y={dy - k.travel / 2 + 3} width={36} height={k.travel - 6} rx={4} fill={b.shock?.damper === 'foam' ? '#3a3d42' : '#26292e'} stroke="#000" strokeWidth={0.6} />
                )))}
              </>
            ) : null}
          </>
        ) : t.kind === 'cabinet' ? (
          <>
            <rect x={x} y={y} width={k.W} height={k.caseH} rx={3} fill="#1a1b1e" stroke="#4b5057" strokeWidth={1} />
            <rect x={x + k.wall} y={y + 50} width={k.W - 2 * k.wall} height={k.caseH - 110} fill="#0b0c0e" />
            <rect x={x + k.wall} y={y + k.caseH - 60} width={k.W - 2 * k.wall} height={60} fill="#111214" />
          </>
        ) : (
          <>
            {[x, x + k.W - 30].map((px, j) => <rect key={j} x={px} y={y} width={30} height={k.caseH} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
            {[y, y + k.caseH - 40].map((py, j) => <rect key={j} x={x} y={py} width={k.W} height={40} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
          </>
        )}
        {i === 0 ? d.shelves.map((sh, j) => (
          <g key={'sh' + j}>
            <rect x={F.x + sh.x} y={fy(sh.y)} width={sh.w} height={sh.t} fill={shade(lam, 0.1)} stroke="#000" strokeWidth={0.6} />
            <rect x={F.x + sh.x} y={fy(sh.y) - 2} width={sh.w} height={4} fill="url(#cs-alu-h)" />
            <text x={F.x + sh.x + sh.w / 2} y={fy(sh.y) - 6 * u} fontSize={fsD * 0.75} textAnchor="middle" fill="#8b939e">Arbeitsfläche</text>
          </g>
        )) : null}
        {k.bays.map((bi) => {
          const bay = bays[bi];
          const pl = bayPlace(t, d, bi);
          const fw = faceWidth(bay.rackStandard), h = bay.heightU * U;
          const x0 = F.x + pl.x, y0 = fy(pl.y + h);
          const earW = (fw - (bay.rackStandard === 19 ? 450 : 222.25)) / 2;
          return (
            <g key={bi}>
              {[x0, x0 + fw - earW].map((rx, j) => (
                <g key={j}>
                  <rect x={rx} y={y0} width={earW} height={h} fill="#2a2c30" stroke="#45484e" strokeWidth={0.6} />
                  {Array.from({ length: bay.heightU * 3 }, (_, q) => {
                    const uu = Math.floor(q / 3), off = [6.35, 22.225, 38.1][q % 3];
                    return <rect key={q} x={rx + earW / 2 - 4.75} y={y0 + h - uu * U - off - 4.75} width={9.5} height={9.5} fill="#050506" />;
                  })}
                </g>
              ))}
              {devices ? devOf(bi).filter((x) => x.mount === 'front').map((dev) => {
                const tpl = project.templates[dev.templateId];
                if (!tpl) return null;
                const w = faceWidth(bayOf(rack, dev).rackStandard) / tpl.slots;
                return <g key={dev.id} transform={`translate(${F.x + deviceViewX(rack, dev, tpl, 'front') - d.ox},${fy(deviceTopY(dev, tpl, rack) - d.oy) + PANEL_GAP / 2})`}><DeviceFace tpl={tpl} panel={outerPanel(dev)} width={w} device={dev} showPortLabels={false} /></g>;
              }) : null}
              <text x={x0 + fw / 2} y={y0 + h + 14 * u} fontSize={fsD * 0.8} textAnchor="middle" fill="#8b939e">{bay.label ? `${bay.label}, ` : ''}{bay.heightU} HE{bayZ(bay) ? `, ${bayZ(bay)} mm zurück` : ''}</text>
            </g>
          );
        })}
      </g>
    );
  };
  const frontOrder = d.blocks.map((k, i) => ({ k, i })).sort((p, q) => q.k.z - p.k.z);
  const frontView = (
    <g>
      {title(F.x, F.y, flight ? 'Vorderansicht ohne Frontdeckel' : t.kind === 'cabinet' ? 'Vorderansicht, Tür offen' : 'Vorderansicht')}
      {frontOrder.map(({ k, i }) => frontBlock(k, i))}
      <Castors x={F.x + base.x} w={base.W} y={F.y + d.caseH} d={d} size={b.castorSize} n={b.castors} />
      <Dim x1={F.x} y1={F.y + d.H + 36 * u} x2={F.x + d.W} y2={F.y + d.H + 36 * u} label={`${Math.round(d.W)} mm`} ink={ink} fs={fsD} />
      <Dim x1={F.x + d.W + 28 * u} y1={F.y} x2={F.x + d.W + 28 * u} y2={F.y + d.H} label={`${Math.round(d.H)} mm`} ink={ink} fs={fsD} />
      {d.castorH ? <Dim x1={F.x - 26 * u} y1={F.y} x2={F.x - 26 * u} y2={F.y + d.caseH} label="" ink={ink} fs={fsD} /> : null}
      {d.castorH ? <text x={F.x - 32 * u} y={F.y + d.caseH / 2} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{Math.round(d.caseH)}</text> : null}
    </g>
  );

  // ------------------------------------------------ left side view, closed (front = left), blocks from right to left
  const Sd = L.side;
  const per = b.latches === 8 ? 2 : 1;
  const sideBlock = (k: RackBlock, i: number) => {
    const top = Sd.y + d.caseH - (k.y + k.caseH), H = k.caseH;
    const xF = Sd.x + k.z, xBody = xF + k.lidF, xRear = xBody + k.bodyD;
    if (!flight) {
      return t.kind === 'cabinet'
        ? <rect key={i} x={xF} y={top} width={k.D} height={H} rx={3} fill="#1a1b1e" stroke="#4b5057" strokeWidth={1} />
        : (
          <g key={i}>
            {[xF, xF + k.D - 30].map((x, j) => <rect key={j} x={x} y={top} width={30} height={H} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
            {[top, top + H - 40].map((y, j) => <rect key={j} x={xF} y={y} width={k.D} height={40} fill="#26282c" stroke="#4b5057" strokeWidth={0.8} />)}
          </g>
        );
    }
    return (
      <g key={i}>
        {k.lidF ? <Panel x={xF} y={top} w={k.lidF} h={H} color={lam} /> : null}
        <Panel x={xBody} y={top} w={k.bodyD} h={H} color={lam} />
        {k.lidR ? <Panel x={xRear} y={top} w={k.lidR} h={H} color={lam} /> : null}
        {leg ? (
          <>
            {[top, top + H - leg].map((y, j) => <g key={j}><rect x={xF} y={y} width={k.D} height={leg} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.5} />{along(xF + 50, xF + k.D - 50, 120).map((x, q) => <Rivet key={q} x={x} y={y + leg / 2} />)}</g>)}
            {k.lidF ? <rect x={xF} y={top} width={leg} height={H} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} /> : null}
            {k.lidR ? <rect x={xF + k.D - leg} y={top} width={leg} height={H} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.5} /> : null}
          </>
        ) : null}
        {[k.lidF ? xBody : null, k.lidR ? xRear : null].map((x, j) => (x === null ? null : (
          <g key={j}>
            <rect x={x - closeH} y={top - 1} width={2 * closeH} height={H + 2} fill="url(#cs-alu-v)" stroke={EDGE} strokeWidth={0.6} />
            <rect x={x - 1} y={top - 1} width={2} height={H + 2} fill="#0b0c0e" />
            {Array.from({ length: per }, (_, q) => {
              const y = top + ((q + 1) / (per + 1)) * H;
              const dir = j === 0 ? 1 : -1;
              return (
                <g key={q}>
                  <rect x={x + dir * (closeH + 2) + (dir > 0 ? 0 : -54)} y={y - 34} width={54} height={68} rx={6} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
                  <rect x={x + dir * (closeH + 2) + (dir > 0 ? 7 : -47)} y={y - 27} width={40} height={54} rx={4.5} fill="url(#cs-recess)" />
                  <path transform={`translate(${x + dir * (closeH + 29)},${y}) rotate(90)`} d="M-22,0 C-22,-13 -6,-10 0,-4 C6,-10 22,-13 22,0 C22,13 6,10 0,4 C-6,10 -22,13 -22,0 Z" fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
                  <rect x={x - dir * (closeH + 2) + (dir > 0 ? -18 : 0)} y={y - 20} width={18} height={40} rx={2} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.6} />
                </g>
              );
            })}
          </g>
        )))}
        {H > 240 ? Array.from({ length: b.handles }, (_, q) => {
          const x = xBody + ((q + 1) / (b.handles + 1)) * k.bodyD, y = top + H * 0.38;
          return (
            <g key={'h' + q} transform={`translate(${x},${y})`}>
              <rect x={-72} y={-44} width={150} height={96} rx={10} fill="#000" fillOpacity={0.35} />
              <rect x={-75} y={-48} width={150} height={96} rx={10} fill="url(#cs-chrome)" stroke={EDGE} strokeWidth={0.8} />
              <rect x={-63} y={-36} width={126} height={72} rx={9} fill="url(#cs-recess)" />
              <rect x={-52} y={10} width={104} height={13} rx={6.5} fill="url(#cs-alu-h)" stroke={EDGE} strokeWidth={0.6} />
            </g>
          );
        }) : null}
        {b.cornerBalls ? (
          <>
            {k.lidF ? [top, top + H].map((y, j) => <circle key={`f${j}`} cx={xF + 10} cy={y + (j ? -10 : 10)} r={17} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.8} />) : null}
            {k.lidR ? [top, top + H].map((y, j) => <circle key={`r${j}`} cx={xF + k.D - 10} cy={y + (j ? -10 : 10)} r={17} fill="url(#cs-dome)" stroke={EDGE} strokeWidth={0.8} />) : null}
          </>
        ) : null}
      </g>
    );
  };
  const sideOrder = d.blocks.map((k, i) => ({ k, i })).sort((p, q) => q.k.x - p.k.x);
  const m = d.blocks[0];
  const sideView = (
    <g>
      {title(Sd.x, Sd.y, 'Seitenansicht links (vorne = links)')}
      {sideOrder.map(({ k, i }) => sideBlock(k, i))}
      {/* hidden edges: work surfaces and the rails of set-back bays */}
      {d.shelves.map((sh, j) => <rect key={'hs' + j} x={Sd.x + sh.z} y={Sd.y + d.caseH - sh.y} width={sh.d} height={sh.t} fill="none" stroke={ink} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="10 6" />)}
      {bays.map((bay, bi) => (bayZ(bay) > 0 ? (() => { const pl = bayPlace(t, d, bi); const h = bay.heightU * U; return <g key={'hr' + bi} stroke={ink} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="10 6" fill="none"><line x1={Sd.x + pl.z} y1={Sd.y + d.caseH - pl.y - h} x2={Sd.x + pl.z} y2={Sd.y + d.caseH - pl.y} />{t.hasRearRails ? <line x1={Sd.x + pl.z + pl.depth} y1={Sd.y + d.caseH - pl.y - h} x2={Sd.x + pl.z + pl.depth} y2={Sd.y + d.caseH - pl.y} /> : null}</g>; })() : null))}
      <Castors x={Sd.x + base.z + base.lidF} w={flight ? base.bodyD : base.D} y={Sd.y + d.caseH} d={d} size={b.castorSize} n={b.castors} />
      <Dim x1={Sd.x} y1={Sd.y + d.H + 44 * u} x2={Sd.x + d.D} y2={Sd.y + d.H + 44 * u} label={`${Math.round(d.D)} mm`} ink={ink} fs={fsD} />
      {m.lidF ? <Dim x1={Sd.x + m.z} y1={Sd.y + d.H + 14 * u} x2={Sd.x + m.z + m.lidF} y2={Sd.y + d.H + 14 * u} label={`${Math.round(m.lidF)}`} ink={ink} fs={fsD * 0.8} /> : null}
      {m.lidR ? <Dim x1={Sd.x + m.z + m.lidF + m.bodyD} y1={Sd.y + d.H + 14 * u} x2={Sd.x + m.z + m.D} y2={Sd.y + d.H + 14 * u} label={`${Math.round(m.lidR)}`} ink={ink} fs={fsD * 0.8} /> : null}
    </g>
  );

  // ------------------------------------------------ top section: blocks, rails and device depths (front = top)
  const T = L.top;
  const zy = (hz: number) => T.y + hz;
  const topView = (
    <g>
      {title(T.x, T.y, 'Schnitt von oben: Einbautiefen und Gerätetiefen (vorne = oben)')}
      {d.blocks.map((k, i) => ({ k, i })).sort((p, q) => p.k.y - q.k.y).map(({ k, i }) => (
        <g key={i}>
          <rect x={T.x + k.x} y={zy(k.z)} width={k.W} height={k.D} fill={flight ? shade(lam, -0.1) : '#1a1b1e'} fillOpacity={0.85} stroke={EDGE} strokeWidth={1} />
          <rect x={T.x + k.x + k.wall} y={zy(k.z + (k.lidF ? k.wall : 0))} width={k.innerW} height={k.D - (k.lidF ? k.wall : 0) - (k.lidR ? k.wall : 0)} fill="#0e0f11" fillOpacity={0.9} />
          {k.lidF ? <line x1={T.x + k.x} y1={zy(k.z + k.lidF)} x2={T.x + k.x + k.W} y2={zy(k.z + k.lidF)} stroke="#c3c8ce" strokeWidth={3} /> : null}
          {k.lidR ? <line x1={T.x + k.x} y1={zy(k.z + k.D - k.lidR)} x2={T.x + k.x + k.W} y2={zy(k.z + k.D - k.lidR)} stroke="#c3c8ce" strokeWidth={3} /> : null}
        </g>
      ))}
      {bays.map((bay, bi) => {
        const pl = bayPlace(t, d, bi), fw = faceWidth(bay.rackStandard);
        return (
          <g key={bi}>
            <rect x={T.x + pl.x} y={zy(pl.z) - 2} width={fw} height={4} fill="#8b939e" />
            {t.hasRearRails ? <rect x={T.x + pl.x} y={zy(pl.z + pl.depth) - 2} width={fw} height={4} fill="#8b939e" /> : null}
            {devices ? devOf(bi).map((dev) => {
              const tpl = project.templates[dev.templateId];
              if (!tpl) return null;
              const w = fw / tpl.slots;
              const x = T.x + deviceViewX(rack, dev, tpl, 'front') - d.ox;
              const fromFront = dev.mount === 'front';
              const tooDeep = fromFront ? tpl.depth > pl.depth + b.rearGap : tpl.depth > pl.depth + b.railInset;
              const y0 = fromFront ? zy(pl.z) : zy(pl.z + pl.depth) - tpl.depth;
              return <rect key={dev.id} x={x + 4} y={y0} width={w - 8} height={tpl.depth} fill={tooDeep ? '#7f1d1d' : '#334155'} fillOpacity={0.55} stroke={tooDeep ? '#ef4444' : '#64748b'} strokeWidth={0.8} />;
            }) : null}
          </g>
        );
      })}
      {(() => { const pl = bayPlace(t, d, 0); return <Dim x1={T.x + d.W + 28 * u} y1={zy(pl.z)} x2={T.x + d.W + 28 * u} y2={zy(pl.z + pl.depth)} label={`Einbautiefe ${pl.depth}`} ink={ink} fs={fsD} />; })()}
      <Dim x1={T.x - 26 * u} y1={zy(0)} x2={T.x - 26 * u} y2={zy(d.D)} label="" ink={ink} fs={fsD} />
      <text x={T.x - 32 * u} y={zy(d.D / 2)} fontSize={fsD * 0.85} fill={ink} textAnchor="end">{Math.round(d.D)}</text>
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
