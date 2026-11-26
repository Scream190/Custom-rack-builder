import { useMemo, useState } from 'react';
import { useStore } from '../model/store';
import type { Cable, CustomCable, PlugSpec, Project, Rack } from '../model/types';
import { cableAssemblies, panelDemand, pinoutCards, plugDemand, type Assembly } from '../model/assembly';
import { buildSteps, cableWiring, customAssemblies, defaultMap, methodLabel, newCustomCable, parseSpec, partsOf, plugOf, plugOptions, specKey } from '../model/cableBuild';
import { cablePlug } from '../model/connectors';
import { pinsOf } from '../model/pinout';
import { formatLength, resolveEnd } from '../model/geometry';
import { cableNumberText } from '../render/cablePaths';
import { AssemblySheet } from '../render/CableAssemblies';
import { PinoutSheet } from '../render/PinoutSheet';
import { CablePlugIcon } from '../render/PlugIcon';
import { uid } from '../model/util';
import { DEFAULT_LAYOUT, setLayout, useLayout } from '../model/layout';
import { Splitter } from './Splitter';
import { Field, NumberInput } from './Modal';
import { Section } from './Section';
import { EmptyState, Seg, ShowMenu, ToolGroup, Toolbar } from './Shell';

const st = useStore.getState;
const fmt = (m: number) => formatLength(m);

// ------------------------------------------------------------------ links to the rack planner

/** rack cable(s) with this printed number (a Y cable number matches all its legs) */
export function cablesByNumber(project: Project, num: string): { rack: Rack; cable: Cable }[] {
  const out: { rack: Rack; cable: Cable }[] = [];
  for (const rack of project.racks) for (const c of rack.cables) {
    const t = cableNumberText(c);
    if (t === num || (c.yGroup && t.replace(/[a-z]$/, '') === num)) out.push({ rack, cable: c });
  }
  return out;
}

/** show a rack cable in the rack planner */
export function showInRack(project: Project, num: string) {
  const hit = cablesByNumber(project, num)[0];
  if (!hit) return;
  st().setActiveRack(hit.rack.id);
  st().setMode('racks');
  st().select({ kind: 'cable', id: hit.cable.id });
}

/** open the build instructions of a rack cable in the cable workshop */
export function openCableBuild(num: string) {
  st().setCableFocus(`num:${num}`);
  st().setMode('cables');
}

/** plugs of a plain rack cable, for matching it with a custom cable */
function rackCablePlugs(project: Project, rack: Rack, c: Cable) {
  const a = resolveEnd(project, rack, c.a), b = resolveEnd(project, rack, c.b);
  if (!a || !b) return null;
  return [cablePlug(a.port).label, cablePlug(b.port).label].sort().join('|');
}

// ------------------------------------------------------------------ small pieces

/** both cable ends side by side, as in the assembly drawing */
function PlugPair({ a, b, color, y }: { a: string; b: string; color: string; y?: boolean }) {
  return (
    <svg width={118} height={24} viewBox="0 0 118 24" aria-hidden className="plug-pair">
      <line x1={36} y1={12} x2={82} y2={12} stroke="#000" strokeOpacity={0.6} strokeWidth={4.6} strokeLinecap="round" />
      <line x1={36} y1={12} x2={82} y2={12} stroke={color} strokeWidth={3.4} strokeLinecap="round" />
      {y ? <circle cx={59} cy={12} r={3.4} fill={color} stroke="#000" strokeWidth={0.6} /> : null}
      <g transform="translate(36,12) scale(0.85)"><CablePlugIcon kind={a} x={0} y={0} /></g>
      <g transform="translate(82,12) scale(0.85)"><CablePlugIcon kind={b} x={0} y={0} flip /></g>
    </svg>
  );
}

function PlugSelect({ value, onChange, disabled, title }: { value: PlugSpec; onChange: (s: PlugSpec) => void; disabled?: boolean; title?: string }) {
  const opts = useMemo(() => plugOptions(), []);
  const groups = useMemo(() => Array.from(new Set(opts.map((o) => o.group))), [opts]);
  const cur = specKey(value);
  const known = opts.some((o) => o.key === cur);
  return (
    <select value={known ? cur : opts.find((o) => o.label === plugOf(value).label)?.key ?? cur} disabled={disabled} title={title} onChange={(e) => onChange(parseSpec(e.target.value))}>
      {!known && !opts.some((o) => o.label === plugOf(value).label) ? <option value={cur}>{plugOf(value).label}</option> : null}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {opts.filter((o) => o.group === g).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------ left: cables

function CableItems({ racksAsm, custom, focus, onPick }: { racksAsm: Assembly[]; custom: Assembly[]; focus: string | null; onPick: (key: string) => void }) {
  const row = (a: Assembly) => (
    <button key={a.key} className={'lib-item item-row cable-item' + (focus === a.key ? ' sel-item' : '')} onClick={() => onPick(a.key)} title={`${a.common.label} auf ${a.branches.map((b) => b.plug.label).join(' / ')}`}>
      <PlugPair a={a.common.key} b={a.branches[0].plug.key} color={a.color} y={a.branches.length > 1} />
      <span className="lib-text">
        <span className="lib-name">{a.count ? `${a.count}× ` : ''}{a.name ?? a.typeName}</span>
        <span className="muted small">{a.branches.map((b) => fmt(b.length)).join(' + ')}{a.branches.length > 1 ? `, Y-Kabel ${a.branches.length} Äste` : ''}{a.customId && a.numbers.length ? `, ${a.numbers.length} im Rack` : ''}{a.customId && !a.numbers.length && !a.count ? ', nur für Rack-Kabel' : ''}</span>
      </span>
    </button>
  );
  return (
    <aside className="panel library">
      <div className="panel-head"><strong>Kabel</strong><span className="muted small">{racksAsm.reduce((n, a) => n + a.count, 0) + custom.reduce((n, a) => n + a.count, 0)} Stück</span></div>
      <div className="lib-list">
        <div className="insp add-form">
          <Section id="cables.custom" title="Eigene Kabel" defaultOpen summary={`${custom.length} Arten`}>
            {custom.length ? custom.map(row) : <div className="hint">Noch keine. Oben rechts „+ Eigenes Kabel“.</div>}
          </Section>
          <Section id="cables.racks" title="Aus den Racks" defaultOpen summary={`${racksAsm.length} Arten`}>
            {racksAsm.length ? racksAsm.map(row) : <div className="hint">In den Racks gibt es noch keine Kabel.</div>}
          </Section>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ centre: build instructions

function BuildSheet({ project, asm }: { project: Project; asm: Assembly }) {
  const cc = asm.customId ? project.customCables?.find((x) => x.id === asm.customId) : undefined;
  const cards = pinoutCards([asm], project);
  const first = cableWiring(asm.commonConn, asm.branches[0].conn, cc?.wiring);
  const steps = buildSteps(asm, first.wiring);
  const parts = partsOf(asm);
  return (
    <div className="build-sheet">
      <div className="build-head">
        <h2>{asm.count}× {asm.name ?? asm.typeName}</h2>
        <div className="muted">{asm.common.label} auf {asm.branches.map((b) => b.plug.label).join(' / ')}, {asm.branches.map((b) => fmt(b.length)).join(' + ')}</div>
      </div>
      <div className="build-drawing"><AssemblySheet assemblies={[asm]} /></div>
      <div className="build-cols">
        <div className="build-col">
          <h3>Pinbelegung</h3>
          {cards.length ? <div className="build-pins"><PinoutSheet cards={cards} title="" cols={1} /></div>
            : first.wiring ? <div className="warn">{first.wiring.notes[0]}</div>
              : <div className="muted">Für diese Stecker ist keine Pinbelegung hinterlegt (z. B. USB, HDMI, Glasfaser, Multipin). Solche Kabel werden fertig gekauft.</div>}
        </div>
        <div className="build-col">
          <h3>Teile</h3>
          <table className="cable-table parts-table">
            <tbody>{parts.map((p) => <tr key={p.label}><td className="num">{String(p.count).replace('.', ',')}{/Reserve/.test(p.label) ? ' m' : '×'}</td><td>{p.label}</td><td className="muted">{p.note ?? ''}</td></tr>)}</tbody>
          </table>
          <h3 className="spaced">Arbeitsschritte</h3>
          <ol className="build-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      </div>
    </div>
  );
}

function BuildList({ project, asm }: { project: Project; asm: Assembly[] }) {
  const racks = project.racks;
  const cards = pinoutCards(asm, project);
  const meters = new Map<string, number>();
  for (const a of asm) meters.set(a.typeName, (meters.get(a.typeName) ?? 0) + a.branches.reduce((s, b) => s + b.length, 0) * a.count);
  return (
    <div className="build-sheet">
      <div className="build-head">
        <h2>Bauliste</h2>
        <div className="muted">{asm.reduce((n, a) => n + a.count, 0)} Kabel in {asm.length} Arten, aus allen Racks und den eigenen Kabeln</div>
      </div>
      <dl className="keyfigs build-meters">
        {[...meters].map(([t, m]) => <div key={t}><dt>{t}</dt><dd>{fmt(Math.round(m * 10) / 10)}</dd></div>)}
      </dl>
      <div className="build-drawing"><AssemblySheet assemblies={asm} demand={plugDemand(asm)} panels={panelDemand(project, racks)} /></div>
      {cards.length ? <div className="build-drawing"><PinoutSheet cards={cards} /></div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ right: properties

function CustomCableEditor({ project, cc }: { project: Project; cc: CustomCable }) {
  const ro = useStore((s) => s.readOnly);
  const up = (p: Partial<CustomCable>) => st().updateCustomCable(cc.id, p);
  const setBranch = (i: number, p: Partial<CustomCable['branches'][number]>) => up({ branches: cc.branches.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const res = cableWiring(cc.a.conn, cc.branches[0].conn, cc.wiring);
  const pa = pinsOf(cc.a.conn), pb = pinsOf(cc.branches[0].conn);
  const linked = project.racks.flatMap((r) => r.cables.filter((c) => c.customId === cc.id).map((c) => ({ rack: r, c })));
  const sig = [plugOf(cc.a).label, plugOf(cc.branches[0]).label].sort().join('|');
  const candidates = cc.branches.length === 1
    ? project.racks.flatMap((r) => r.cables.filter((c) => !c.yGroup && c.customId !== cc.id && rackCablePlugs(project, r, c) === sig).map((c) => ({ rack: r, c })))
    : [];
  const link = (list: { rack: Rack; c: Cable }[], id: string | undefined) => st().mutate((p) => {
    for (const { rack, c } of list) { const x = p.racks.find((r) => r.id === rack.id)?.cables.find((y) => y.id === c.id); if (x) { if (id) x.customId = id; else delete x.customId; } }
  });
  const mapFor = (aPin: string) => cc.wiring?.find((m) => m.a === aPin)?.b ?? '';
  const setMap = (aPin: string, bPin: string) => {
    const base = (cc.wiring ?? defaultMap(cc.a.conn, cc.branches[0].conn)).filter((m) => m.a !== aPin);
    up({ wiring: bPin ? [...base, { a: aPin, b: bPin }] : base });
  };
  const total = cc.branches.reduce((s, b) => s + b.length, 0);
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <input className="insp-title" disabled={ro} value={cc.name} onChange={(e) => up({ name: e.target.value })} title="Name des Kabels (steht auf der Beschriftung)" />
          <div className="muted small">Eigenes Kabel{cc.branches.length > 1 ? `, Y-Kabel mit ${cc.branches.length} Ästen` : ''}</div>
        </div>
        <dl className="keyfigs">
          <div><dt>Länge</dt><dd>{cc.branches.map((b) => fmt(b.length)).join(' + ')}</dd></div>
          <div><dt>Material gesamt</dt><dd>{fmt(Math.round(total * cc.qty * 10) / 10)}</dd></div>
          <div><dt>Belegung</dt><dd>{res.manual ? 'eigene' : res.wiring?.wires.length ? 'Standard' : res.wiring ? 'festlegen' : 'keine (fertig kaufen)'}</dd></div>
        </dl>

        <Section id="cc.plugs" title="Stecker und Länge" defaultOpen summary={`${plugOf(cc.a).label} auf ${cc.branches.map((b) => plugOf(b).label).join(' / ')}`}>
          <Field label="Ende A (gemeinsamer Stecker)"><PlugSelect value={cc.a} disabled={ro} onChange={(s) => up({ a: s, wiring: undefined })} /></Field>
          <div className="muted small">Montage: {methodLabel(cc.a.conn)}</div>
          {cc.branches.map((b, i) => (
            <div key={i} className="branch-row">
              <Field label={cc.branches.length > 1 ? `Ast ${String.fromCharCode(97 + i)}: Ende B` : 'Ende B'}><PlugSelect value={b} disabled={ro} onChange={(s) => setBranch(i, { conn: s.conn, dir: s.dir })} /></Field>
              <div className="row gap8 align-end">
                <Field label="Länge (m)"><NumberInput value={b.length} min={0.1} step={0.5} onChange={(v) => setBranch(i, { length: Math.max(0.1, v) })} /></Field>
                {cc.branches.length > 1 && !ro ? <button className="btn sm danger" onClick={() => up({ branches: cc.branches.filter((_, j) => j !== i) })} title="Diesen Ast entfernen">Ast entfernen</button> : null}
              </div>
            </div>
          ))}
          {!ro ? <div><button className="btn sm" onClick={() => up({ branches: [...cc.branches, { ...cc.branches[cc.branches.length - 1] }] })} title="Weiteren Ast am gemeinsamen Stecker anlegen (Y-Kabel)">+ Ast (Y-Kabel)</button></div> : null}
        </Section>

        <Section id="cc.type" title="Kabeltyp und Menge" defaultOpen summary={`${cc.qty}× zusätzlich, ${project.cableTypes.find((t) => t.id === cc.typeId)?.name ?? '?'}`}>
          <div className="row gap8">
            <Field label="Kabeltyp" grow={2}><select disabled={ro} value={cc.typeId} onChange={(e) => up({ typeId: e.target.value })}>{project.cableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field label="Anzahl zusätzlich" title="Kabel, die zusätzlich zu den zugeordneten Rack-Kabeln gebaut werden (0 = nur die Rack-Kabel)"><NumberInput value={cc.qty} min={0} max={500} onChange={(v) => up({ qty: Math.max(0, Math.round(v)) })} /></Field>
          </div>
        </Section>

        <Section id="cc.wiring" title="Verdrahtung" defaultOpen summary={res.manual ? 'eigene Belegung' : 'Standard'}>
          {!res.editable ? <div className="muted small">Für diese Stecker sind keine Pins hinterlegt. Das Kabel erscheint in der Bauliste, aber ohne Pinbelegung.</div> : (
            <>
              <div className="muted small">{cc.wiring ? 'Eigene Belegung: für jeden Pin an Ende A den Pin an Ende B wählen.' : res.wiring?.wires.length ? 'Standardbelegung. Zum Ändern eine eigene Belegung anlegen.' : 'Keine Standardbelegung für diese Kombination. Bitte eine eigene Belegung anlegen.'}</div>
              {cc.wiring && pa && pb ? (
                <table className="ct-table pin-map">
                  <thead><tr><th>Ende A</th><th>Ende B</th></tr></thead>
                  <tbody>
                    {pa.pins.map((p) => (
                      <tr key={p.pin}>
                        <td>Pin {p.pin} <span className="muted small">{p.sig !== p.pin ? p.sig : ''}</span></td>
                        <td><select disabled={ro} value={mapFor(p.pin)} onChange={(e) => setMap(p.pin, e.target.value)}>
                          <option value="">nicht belegt</option>
                          {pb.pins.map((q) => <option key={q.pin} value={q.pin}>Pin {q.pin}{q.sig !== q.pin ? ` (${q.sig})` : ''}</option>)}
                        </select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {!ro ? (
                <div className="btn-group">
                  {!cc.wiring ? <button className="btn sm" onClick={() => up({ wiring: defaultMap(cc.a.conn, cc.branches[0].conn) })} title="Belegung Pin für Pin selbst festlegen">Eigene Belegung</button>
                    : <button className="btn sm" onClick={() => up({ wiring: undefined })} title="Zur Standardbelegung zurück">Standard verwenden</button>}
                  {pa?.family === 'audio' && pb?.family === 'audio' && pa.pins.some((p) => p.sig === '−') && pb.pins.some((p) => p.sig === '−') ? (
                    <button className="btn sm" title="Plus und Minus an Ende B tauschen (Phase drehen)" onClick={() => {
                      const base = cc.wiring ?? defaultMap(cc.a.conn, cc.branches[0].conn);
                      const plus = pb.pins.find((p) => p.sig === '+')!.pin, minus = pb.pins.find((p) => p.sig === '−')!.pin;
                      up({ wiring: base.map((m) => ({ ...m, b: m.b === plus ? minus : m.b === minus ? plus : m.b })) });
                    }}>Phase drehen</button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Section>

        <Section id="cc.racks" title="In den Racks" defaultOpen={linked.length > 0} summary={linked.length ? `${linked.length} Kabel zugeordnet` : 'nicht zugeordnet'}>
          <div className="muted small">Rack-Kabel, die nach diesem Kabel gebaut werden (Name und Belegung gelten dann für sie).</div>
          {linked.map(({ rack, c }) => (
            <div key={c.id} className="settings-row">
              <button className="link-btn" onClick={() => showInRack(project, cableNumberText(c))} title="Im Rack zeigen">{cableNumberText(c)}</button>
              <span className="muted small">{rack.name}</span>
              {!ro ? <button className="icon-btn" onClick={() => link([{ rack, c }], undefined)} title="Zuordnung lösen" aria-label="Zuordnung lösen">✕</button> : null}
            </div>
          ))}
          {!ro && candidates.length ? (
            <div className="row gap8 wrap">
              <span className="muted small">{candidates.length} Rack-Kabel mit denselben Steckern.</span>
              <button className="btn sm" onClick={() => link(candidates, cc.id)} title="Alle passenden Rack-Kabel nach diesem Kabel bauen">Alle zuordnen</button>
            </div>
          ) : null}
        </Section>

        <Section id="cc.notes" title="Notizen" summary={cc.notes ? cc.notes.slice(0, 36) : 'keine'}>
          <textarea disabled={ro} rows={3} value={cc.notes ?? ''} onChange={(e) => up({ notes: e.target.value || undefined })} aria-label="Notizen" />
        </Section>

        {!ro ? (
          <div className="action-row">
            <button className="btn sm" onClick={() => st().addCustomCable({ ...cc, id: uid('cc-'), name: `${cc.name} (Kopie)` })} title="Kopie dieses Kabels anlegen">Duplizieren</button>
            <button className="btn sm danger" onClick={() => { if (confirm(`Kabel „${cc.name}“ löschen?`)) st().removeCustomCable(cc.id); }} title="Kabel löschen; zugeordnete Rack-Kabel bekommen wieder die Standardbelegung">Löschen</button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function RackAssemblyInfo({ project, asm }: { project: Project; asm: Assembly }) {
  const ro = useStore((s) => s.readOnly);
  const deriveCustom = () => {
    const first = cablesByNumber(project, asm.numbers[0])[0];
    const a: PlugSpec = { conn: asm.commonConn }, b = asm.branches.map((x) => ({ conn: x.conn, length: x.length }));
    const cc: CustomCable = { ...newCustomCable(project, `${asm.typeName} ${asm.branches.map((x) => fmt(x.length)).join(' + ')}, Variante`, a, b[0], b[0].length), branches: b, qty: 0, typeId: first?.cable.typeId ?? project.cableTypes[0].id };
    st().addCustomCable(cc);
    st().mutate((p) => {
      for (const num of asm.numbers) for (const { rack, cable } of cablesByNumber(p, num)) {
        const x = p.racks.find((r) => r.id === rack.id)?.cables.find((y) => y.id === cable.id);
        if (x) x.customId = cc.id;
      }
    });
  };
  return (
    <aside className="panel inspector">
      <div className="insp">
        <div className="insp-head">
          <h3>{asm.name ?? asm.typeName}</h3>
          <div className="muted small">Aus den Racks{asm.branches.length > 1 ? `, Y-Kabel mit ${asm.branches.length} Ästen` : ''}</div>
        </div>
        <dl className="keyfigs">
          <div><dt>Anzahl</dt><dd>{asm.count}</dd></div>
          <div><dt>Länge</dt><dd>{asm.branches.map((b) => fmt(b.length)).join(' + ')}</dd></div>
        </dl>
        <Section id="asm.plugs" title="Stecker" defaultOpen summary={asm.common.label}>
          <div className="stats">
            <div><span>Ende A</span><b>{asm.common.label}</b></div>
            {asm.branches.map((b, i) => <div key={i}><span>{asm.branches.length > 1 ? `Ast ${String.fromCharCode(97 + i)}` : 'Ende B'}</span><b>{b.plug.label}</b></div>)}
          </div>
        </Section>
        <Section id="asm.numbers" title="Kabelnummern" defaultOpen summary={`${asm.numbers.length} Kabel`}>
          <div className="muted small">Anklicken zeigt das Kabel im Rack.</div>
          <div className="num-list">{asm.numbers.map((n) => <button key={n} className="link-btn" onClick={() => showInRack(project, n)}>{n}</button>)}</div>
        </Section>
        <Section id="asm.variant" title="Verdrahtung" defaultOpen summary={asm.customId ? `nach „${asm.name}“` : 'Standard'}>
          {asm.customId ? (
            <>
              <div className="muted small">Diese Kabel werden nach dem eigenen Kabel „{asm.name}“ gebaut.</div>
              <button className="btn sm" onClick={() => st().setCableFocus(`custom:${asm.customId}`)}>„{asm.name}“ bearbeiten</button>
            </>
          ) : (
            <>
              <div className="muted small">Standardbelegung. Für eine abweichende Belegung (zum Beispiel Phase gedreht) eine eigene Variante anlegen; die {asm.count} Kabel werden ihr zugeordnet.</div>
              {!ro ? <button className="btn sm" onClick={deriveCustom}>Eigene Variante anlegen</button> : null}
            </>
          )}
        </Section>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ workspace

export function CableWorkspace() {
  const project = useStore((s) => s.project);
  const focus = useStore((s) => s.cableFocus);
  const ro = useStore((s) => s.readOnly);
  const layout = useLayout();
  const [view, setView] = useState<'build' | 'list'>('build');
  const racksAsm = useMemo(() => cableAssemblies(project, project.racks), [project]);
  const custom = useMemo(() => customAssemblies(project), [project]);
  const all = [...custom, ...racksAsm];
  // what gets built: rack cables plus custom cables with an extra quantity
  const buildable = [...custom.filter((a) => a.count > 0), ...racksAsm];
  // resolve the focus: assembly key, custom cable, or a rack cable number
  let cur: Assembly | undefined;
  if (focus?.startsWith('num:')) { const n = focus.slice(4); cur = racksAsm.find((a) => a.numbers.includes(n)); }
  else cur = all.find((a) => a.key === focus);
  if (!cur && view === 'build') cur = all[0];
  const cc = cur?.key.startsWith('custom:') ? project.customCables?.find((x) => x.id === cur!.customId) : undefined;
  // a custom cable without extra quantity shows the rack cables built after it
  const sheet = cc && cur && cur.count === 0 ? racksAsm.find((a) => a.customId === cc.id) ?? cur : cur;
  const add = () => st().addCustomCable(newCustomCable(project, `Kabel ${(project.customCables?.length ?? 0) + 1}`));
  if (!all.length) {
    return (
      <main className="workspace">
        <EmptyState title="Kabel bauen" text="Hier steht, wie die Kabel gebaut werden: Stecker, Länge, Pinbelegung, Teile und Arbeitsschritte. Die Kabel aus den Racks erscheinen automatisch, eigene Kabel legst du mit beliebigen Steckern an.">
          {!ro ? <button className="btn primary" onClick={add}>Eigenes Kabel anlegen</button> : null}
        </EmptyState>
      </main>
    );
  }
  return (
    <main className="workspace">
      {layout.showLibrary ? (
        <>
          <div className="col" style={{ width: layout.libraryW }}><CableItems racksAsm={racksAsm} custom={custom} focus={cur?.key ?? null} onPick={(k) => { st().setCableFocus(k); setView('build'); }} /></div>
          <Splitter dir="x" value={layout.libraryW} min={220} max={560} onChange={(v) => setLayout({ libraryW: v })} onReset={() => setLayout({ libraryW: DEFAULT_LAYOUT.libraryW })} />
        </>
      ) : null}
      <section className="center">
        <Toolbar>
          <ToolGroup>
            <Seg value={view} onChange={setView} options={[
              { id: 'build', label: 'Bauanleitung', title: 'Das gewählte Kabel: Zeichnung, Pinbelegung, Teile und Arbeitsschritte' },
              { id: 'list', label: 'Bauliste', title: 'Alle Kabel des Projekts mit Steckerbedarf und Pinbelegungen' },
            ]} />
          </ToolGroup>
          {sheet && sheet.numbers.length && view === 'build' ? (
            <ToolGroup>
              <button className="btn sm" onClick={() => showInRack(project, sheet!.numbers[0])} title="Das erste dieser Kabel im Rack zeigen">Im Rack zeigen</button>
            </ToolGroup>
          ) : null}
          <span className="spacer" />
          <ShowMenu library="Kabelliste" />
        </Toolbar>
        <div className="stage scroll-stage">
          {view === 'list' ? <BuildList project={project} asm={buildable} /> : sheet ? <BuildSheet project={project} asm={sheet} /> : null}
        </div>
      </section>
      {layout.showInspector && cur ? (
        <>
          <Splitter dir="x" sign={-1} value={layout.inspectorW} min={260} max={640} onChange={(v) => setLayout({ inspectorW: v })} onReset={() => setLayout({ inspectorW: DEFAULT_LAYOUT.inspectorW })} />
          <div className="col" style={{ width: layout.inspectorW }}>{cc ? <CustomCableEditor project={project} cc={cc} /> : <RackAssemblyInfo project={project} asm={cur} />}</div>
        </>
      ) : null}
    </main>
  );
}
