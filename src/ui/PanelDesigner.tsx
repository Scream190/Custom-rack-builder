import { useEffect, useMemo, useRef, useState } from 'react';
import { allTemplates, useStore } from '../model/store';
import type { PanelDesign, PanelElement, PanelElementKind } from '../model/types';
import { DSIZE, mountHolePositions, MOUNT_SLOT, newPanel, panelSize, panelToTemplate } from '../model/panel';
import { CONNECTORS, connectorDef } from '../model/connectors';
import { ConnectorSymbol } from '../render/ConnectorSymbol';
import { elementBounds, PanelDrawing } from '../render/PanelArt';
import { deepClone, downloadBlob, safeFileName, uid } from '../model/util';
import { panelToDxf, panelToPdf, panelToSvg, elementDescription } from '../export/panelExport';
import { Field, Modal, NumberInput } from './Modal';

const D_CONNECTORS = Object.values(CONNECTORS).filter((c) => c.dSize);

const FINISHES = [
  { label: 'Alu eloxiert schwarz', color: '#1b1b1b', engrave: '#ffffff' },
  { label: 'Alu eloxiert natur', color: '#c9cbcf', engrave: '#111111' },
  { label: 'Stahl pulverbeschichtet RAL 9005', color: '#0e0e10', engrave: '#ffffff' },
  { label: 'Stahl pulverbeschichtet RAL 7016', color: '#383e42', engrave: '#ffffff' },
  { label: 'Alu eloxiert blau', color: '#1e3a8a', engrave: '#ffffff' },
  { label: 'Alu eloxiert rot', color: '#7f1d1d', engrave: '#ffffff' },
];

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function PanelDesigner({ templateId }: { templateId?: string }) {
  const project = useStore((s) => s.project);
  const source = useMemo(() => (templateId ? allTemplates(project).find((t) => t.id === templateId) : undefined), [project, templateId]);
  const [pd, setPd] = useState<PanelDesign>(() => (source?.panel ? deepClone(source.panel) : newPanel(1)));
  const [name, setName] = useState(source?.name ?? 'Custom Blende');
  const [depth, setDepth] = useState(source?.depth ?? 45);
  const [selId, setSelId] = useState<string | null>(null);
  const [snap, setSnap] = useState(0.5);
  const [dConn, setDConn] = useState('XLR3F');
  const [dist, setDist] = useState({ count: 8, x0: 60, x1: 422.6, y: 0, labels: true, prefix: '' });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const { w, h } = panelSize(pd);
  const sel = pd.elements.find((e) => e.id === selId);

  const setEl = (id: string, patch: Partial<PanelElement>) => setPd((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const q = (v: number) => Math.round(v / snap) * snap;

  const add = (kind: PanelElementKind, extra: Partial<PanelElement> = {}) => {
    const base: PanelElement = { id: uid('el'), kind, x: q(w / 2), y: q(h / 2) };
    const presets: Record<PanelElementKind, Partial<PanelElement>> = {
      dseries: { connector: dConn },
      hole: { d: 6.5 },
      rect: { w: 30, h: 15, r: 1 },
      text: { text: 'TEXT', fontSize: 3.5, align: 'center', y: q(h - 6) },
      engraveRect: { w: 120, h: h - 10, r: 2 },
      engraveLine: { w: 100 },
    };
    const el = { ...base, ...presets[kind], ...extra };
    setPd((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelId(el.id);
  };

  const distribute = () => {
    const n = Math.max(1, Math.round(dist.count));
    const y = dist.y || h / 2 - (dist.labels ? 3 : 0);
    const els: PanelElement[] = [];
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (dist.x0 + dist.x1) / 2 : dist.x0 + ((dist.x1 - dist.x0) * i) / (n - 1);
      const label = `${dist.prefix}${i + 1}`;
      els.push({ id: uid('el'), kind: 'dseries', x: Math.round(x * 100) / 100, y, connector: dConn, label });
      if (dist.labels) els.push({ id: uid('el'), kind: 'text', x: Math.round(x * 100) / 100, y: Math.min(h - 3, y + DSIZE.flangeH / 2 + 3), text: label, fontSize: 3, align: 'center' });
    }
    setPd((p) => ({ ...p, elements: [...p.elements, ...els] }));
  };

  // keyboard nudging / delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selId || (e.target as HTMLElement).closest('input,textarea,select')) return;
      const step = e.shiftKey ? 5 : snap;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        setPd((p) => ({ ...p, elements: p.elements.map((el) => (el.id === selId ? { ...el, x: Math.round((el.x + dx) * 100) / 100, y: Math.round((el.y + dy) * 100) / 100 } : el)) }));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setPd((p) => ({ ...p, elements: p.elements.filter((el) => el.id !== selId) }));
        setSelId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, snap]);

  const toLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };
  const onDown = (e: React.PointerEvent) => {
    const p = toLocal(e);
    // hit test from topmost
    const hit = [...pd.elements].reverse().find((el) => {
      const b = elementBounds(el);
      return p.x >= b.x - 1 && p.x <= b.x + b.w + 1 && p.y >= b.y - 1 && p.y <= b.y + b.h + 1;
    });
    if (hit) {
      setSelId(hit.id);
      dragRef.current = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else setSelId(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toLocal(e);
    setEl(d.id, { x: Math.max(0, Math.min(w, q(p.x - d.dx))), y: Math.max(0, Math.min(h, q(p.y - d.dy))) });
  };

  // collision warnings
  const warnings = useMemo(() => {
    const out: string[] = [];
    const cut = pd.elements.filter((e) => e.kind === 'dseries' || e.kind === 'hole' || e.kind === 'rect');
    const holes = mountHolePositions(pd).map((m) => ({ x: m.x - MOUNT_SLOT.w / 2 - 1, y: m.y - MOUNT_SLOT.h / 2 - 1, w: MOUNT_SLOT.w + 2, h: MOUNT_SLOT.h + 2 }));
    cut.forEach((a, i) => {
      const ba = elementBounds(a);
      if (ba.x < 1 || ba.y < 0.5 || ba.x + ba.w > w - 1 || ba.y + ba.h > h - 0.5) out.push(`Element ${pd.elements.indexOf(a) + 1} ragt über den Rand`);
      if (holes.some((hb) => overlaps(ba, hb))) out.push(`Element ${pd.elements.indexOf(a) + 1} überschneidet Befestigungsloch`);
      for (const b of cut.slice(i + 1)) if (overlaps(ba, elementBounds(b))) out.push(`Elemente ${pd.elements.indexOf(a) + 1} und ${pd.elements.indexOf(b) + 1} überlappen`);
    });
    if (pd.heightU === 1 && cut.some((e) => e.kind === 'dseries' && !e.rotate && (e.y - DSIZE.flangeH / 2 < 0 || e.y + DSIZE.flangeH / 2 > h))) out.push('D-Size Flansch (31 mm) passt in 1 HE nur mittig');
    return Array.from(new Set(out));
  }, [pd, w, h]);

  const saveToLibrary = () => {
    const id = source?.id ?? uid('panel-');
    const tpl = panelToTemplate(pd, { id, name, depth });
    useStore.getState().upsertTemplate(tpl);
    useStore.getState().showToast(`Blende „${name}“ in der Bibliothek gespeichert`);
    useStore.getState().openModal(null);
  };
  const fname = safeFileName(name);
  const scale = Math.min(2.2, 1000 / w);

  return (
    <Modal
      wide
      title={source ? `Blende bearbeiten: ${source.name}` : 'Blenden-Designer'}
      footer={
        <>
          <button className="btn" onClick={() => downloadBlob(new Blob([panelToDxf(pd)], { type: 'application/dxf' }), `${fname}.dxf`)}>DXF</button>
          <button className="btn" onClick={() => downloadBlob(new Blob([panelToSvg(pd)], { type: 'image/svg+xml' }), `${fname}.svg`)}>SVG</button>
          <button className="btn" onClick={async () => downloadBlob(await panelToPdf(pd, name), `${fname}_Zeichnung.pdf`)}>PDF-Zeichnung</button>
          <span className="spacer" />
          <button className="btn primary" onClick={saveToLibrary}>{source ? 'Speichern' : 'In Bibliothek speichern'}</button>
        </>
      }
    >
      <div className="panel-designer">
        <div className="row gap8 wrap align-end">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="HE"><NumberInput value={pd.heightU} min={1} max={8} onChange={(v) => setPd({ ...pd, heightU: Math.max(1, Math.round(v)) })} style={{ width: 56 }} /></Field>
          <Field label="Standard">
            <select value={pd.rackStandard} onChange={(e) => setPd({ ...pd, rackStandard: Number(e.target.value) as 19 | 10 })}>
              <option value={19}>19"</option><option value={10}>10"</option>
            </select>
          </Field>
          <Field label="Oberfläche">
            <select value={FINISHES.find((f) => f.color === pd.color)?.label ?? ''} onChange={(e) => {
              const f = FINISHES.find((x) => x.label === e.target.value);
              if (f) setPd({ ...pd, color: f.color, engraveColor: f.engrave, material: f.label });
            }}>
              {!FINISHES.some((f) => f.color === pd.color) ? <option value="">Eigene Farbe</option> : null}
              {FINISHES.map((f) => <option key={f.label}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Farbe"><input type="color" value={pd.color} onChange={(e) => setPd({ ...pd, color: e.target.value })} /></Field>
          <Field label="Gravur"><input type="color" value={pd.engraveColor} onChange={(e) => setPd({ ...pd, engraveColor: e.target.value })} /></Field>
          <Field label="Stärke (mm)">
            <select value={pd.thickness} onChange={(e) => setPd({ ...pd, thickness: Number(e.target.value) })}>
              {[1.5, 2, 2.5, 3, 4].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Befestigung">
            <select value={pd.mountHoles} onChange={(e) => setPd({ ...pd, mountHoles: e.target.value as 'slot' | 'round' })}>
              <option value="slot">Langloch 10×6,5</option><option value="round">Bohrung Ø6,5</option>
            </select>
          </Field>
          <Field label="Eckradius"><NumberInput value={pd.cornerRadius} min={0} max={10} step={0.5} onChange={(v) => setPd({ ...pd, cornerRadius: v })} style={{ width: 56 }} /></Field>
          <Field label="Einbautiefe"><NumberInput value={depth} min={1} onChange={setDepth} style={{ width: 64 }} /></Field>
        </div>

        <div className="row gap8 wrap align-end toolbar-row">
          <Field label="D-Size Einsatz">
            <select value={dConn} onChange={(e) => setDConn(e.target.value)}>
              {D_CONNECTORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <button className="btn" onClick={() => add('dseries')}>+ D-Size Buchse</button>
          <button className="btn" onClick={() => add('hole')}>+ Bohrung</button>
          <button className="btn" onClick={() => add('rect')}>+ Ausschnitt</button>
          <button className="btn" onClick={() => add('text')}>+ Text</button>
          <button className="btn" onClick={() => add('engraveRect')}>+ Rahmen</button>
          <button className="btn" onClick={() => add('engraveLine')}>+ Linie</button>
          <Field label="Raster">
            <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
              {[0.1, 0.5, 1, 2.5, 5].map((s) => <option key={s} value={s}>{String(s).replace('.', ',')} mm</option>)}
            </select>
          </Field>
        </div>

        <div className="row gap8 wrap align-end toolbar-row">
          <strong className="small">Reihe verteilen:</strong>
          <Field label="Anzahl"><NumberInput value={dist.count} min={1} max={48} onChange={(v) => setDist({ ...dist, count: v })} style={{ width: 56 }} /></Field>
          <Field label="X von"><NumberInput value={dist.x0} step={0.5} onChange={(v) => setDist({ ...dist, x0: v })} style={{ width: 70 }} /></Field>
          <Field label="X bis"><NumberInput value={dist.x1} step={0.5} onChange={(v) => setDist({ ...dist, x1: v })} style={{ width: 70 }} /></Field>
          <Field label="Y (0 = auto)"><NumberInput value={dist.y} step={0.5} onChange={(v) => setDist({ ...dist, y: v })} style={{ width: 70 }} /></Field>
          <Field label="Präfix"><input value={dist.prefix} onChange={(e) => setDist({ ...dist, prefix: e.target.value })} style={{ width: 60 }} /></Field>
          <label className="check"><input type="checkbox" checked={dist.labels} onChange={(e) => setDist({ ...dist, labels: e.target.checked })} /> Beschriftung</label>
          <button className="btn" onClick={distribute}>Einfügen</button>
          <button className="btn danger" onClick={() => { if (confirm('Alle Elemente entfernen?')) { setPd({ ...pd, elements: [] }); setSelId(null); } }}>Leeren</button>
        </div>

        <div className="panel-canvas">
          <svg ref={svgRef} viewBox={`-8 -14 ${w + 16} ${h + 22}`} width={(w + 16) * scale} height={(h + 22) * scale} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { dragRef.current = null; }}>
            {/* dimension line */}
            <line x1={0} y1={-7} x2={w} y2={-7} stroke="#9ca3af" strokeWidth={0.25} />
            <text x={w / 2} y={-9} fontSize={3.2} textAnchor="middle" fill="#9ca3af">{w} mm × {h.toFixed(2)} mm</text>
            <PanelDrawing pd={pd} selectedId={selId} />
            {/* connectors placed into D-cutouts (preview only, not exported as cut) */}
            {pd.elements.filter((e) => e.kind === 'dseries' && e.connector).map((e) => (
              <g key={e.id} opacity={0.9} pointerEvents="none"><ConnectorSymbol connector={e.connector!} x={e.x} y={e.y} ring={false} /></g>
            ))}
          </svg>
        </div>

        <div className="designer-bottom">
          <div className="sel-props">
            {sel ? (
              <>
                <strong>{elementDescription(sel)}</strong>
                <div className="row gap8 wrap align-end">
                  <Field label="X (mm)"><NumberInput value={sel.x} step={snap} onChange={(v) => setEl(sel.id, { x: v })} style={{ width: 80 }} /></Field>
                  <Field label="Y (mm)"><NumberInput value={sel.y} step={snap} onChange={(v) => setEl(sel.id, { y: v })} style={{ width: 80 }} /></Field>
                  {sel.kind === 'dseries' ? (
                    <>
                      <Field label="Einsatz">
                        <select value={sel.connector ?? ''} onChange={(e) => setEl(sel.id, { connector: e.target.value || undefined })}>
                          <option value="">– nur Ausschnitt –</option>
                          {D_CONNECTORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Bezeichnung (Port)"><input value={sel.label ?? ''} onChange={(e) => setEl(sel.id, { label: e.target.value })} /></Field>
                      <label className="check"><input type="checkbox" checked={!!sel.rotate} onChange={(e) => setEl(sel.id, { rotate: e.target.checked })} /> 90° gedreht</label>
                    </>
                  ) : null}
                  {sel.kind === 'hole' ? <Field label="Ø (mm)"><NumberInput value={sel.d ?? 6} step={0.1} onChange={(v) => setEl(sel.id, { d: v })} style={{ width: 70 }} /></Field> : null}
                  {sel.kind === 'rect' || sel.kind === 'engraveRect' || sel.kind === 'engraveLine' ? (
                    <Field label="Breite"><NumberInput value={sel.w ?? 20} step={0.5} onChange={(v) => setEl(sel.id, { w: v })} style={{ width: 70 }} /></Field>
                  ) : null}
                  {sel.kind === 'rect' || sel.kind === 'engraveRect' ? (
                    <>
                      <Field label="Höhe"><NumberInput value={sel.h ?? 10} step={0.5} onChange={(v) => setEl(sel.id, { h: v })} style={{ width: 70 }} /></Field>
                      <Field label="Radius"><NumberInput value={sel.r ?? 0} step={0.5} min={0} onChange={(v) => setEl(sel.id, { r: v })} style={{ width: 60 }} /></Field>
                    </>
                  ) : null}
                  {sel.kind === 'text' ? (
                    <>
                      <Field label="Text"><input value={sel.text ?? ''} onChange={(e) => setEl(sel.id, { text: e.target.value })} /></Field>
                      <Field label="Höhe (mm)"><NumberInput value={sel.fontSize ?? 3.5} step={0.5} min={1} onChange={(v) => setEl(sel.id, { fontSize: v })} style={{ width: 60 }} /></Field>
                      <Field label="Ausrichtung">
                        <select value={sel.align ?? 'center'} onChange={(e) => setEl(sel.id, { align: e.target.value as 'left' | 'center' | 'right' })}>
                          <option value="left">links</option><option value="center">mittig</option><option value="right">rechts</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                  <button className="btn sm" onClick={() => {
                    const copy = { ...sel, id: uid('el'), x: sel.x + (sel.kind === 'dseries' ? 30 : 10) };
                    setPd((p) => ({ ...p, elements: [...p.elements, copy] }));
                    setSelId(copy.id);
                  }}>Duplizieren</button>
                  <button className="btn sm danger" onClick={() => { setPd((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== sel.id) })); setSelId(null); }}>Löschen</button>
                </div>
                <div className="hint">Pfeiltasten verschieben (Shift = 5 mm), Entf löscht.</div>
              </>
            ) : (
              <div className="hint">
                Element anklicken zum Bearbeiten. D-Size Buchsen mit Einsatz werden beim Speichern zu Anschlüssen (vorne + hinten durchgeschleift) und sind im Rack verkabelbar.
                Export: DXF (mm, 1:1, Layer KONTUR / AUSSCHNITT / GRAVUR) für Frontplattenhersteller wie Rack247 oder Schaeffer. Texte liegen als DXF-TEXT vor – manche Hersteller wünschen Schrift in Pfade umgewandelt oder als separate Angabe.
              </div>
            )}
          </div>
          <div className="warn-box">
            <strong className="small">Prüfung</strong>
            {warnings.length ? warnings.map((w) => <div key={w} className="warn">⚠ {w}</div>) : <div className="ok small">✓ Keine Kollisionen erkannt</div>}
            <div className="muted small">{pd.elements.length} Elemente, davon {pd.elements.filter((e) => e.kind === 'dseries' && e.connector).length} Anschlüsse. Stecker: {connectorDef(dConn).label}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
