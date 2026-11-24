// Development-only page: renders every branded device (front + rear) for visual checks (?id=…, ?cat=…).
import { createRoot } from 'react-dom/client';
import { BRANDED_DEVICES } from '../library/devicesBranded';
import { RFSCAN_DEVICES } from '../library/devicesRfScan';
import { PRO_DEVICES } from '../library/devicesPro';
import { PRO2_DEVICES } from '../library/devicesPro2';
import { DeviceFace } from '../render/DeviceFace';
import { faceWidth, panelHeight } from '../model/geometry';

const params = new URLSearchParams(location.search);
const only = params.get('id');
const cat = params.get('cat');
const list = [...BRANDED_DEVICES, ...RFSCAN_DEVICES, ...PRO_DEVICES, ...PRO2_DEVICES].filter((t) => (!only || t.id === only) && (!cat || t.category === cat));
const S = 3; // px per mm

function Gallery() {
  return (
    <div>
      {list.map((t) => {
        const w = faceWidth(t.rackStandard) / t.slots;
        const h = panelHeight(t.heightU);
        return (
          <div key={t.id} className="d" id={t.id}>
            <h3>{t.manufacturer} {t.name}</h3>
            {(['front', 'rear'] as const).map((side) => (
              <svg key={side} width={(w + 4) * S} height={(h + 4) * S} viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ display: 'block', marginBottom: 4 }}>
                <DeviceFace tpl={t} panel={side} width={w} device={{ id: 'x', templateId: t.id, u: 1, mount: 'front', slot: 0, label: 'Vox 1-4', fields: { Frequenz: '606.500 MHz' } }} />
              </svg>
            ))}
          </div>
        );
      })}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Gallery />);
