// Development-only page: renders every branded device (front + rear) for visual checks.
import { createRoot } from 'react-dom/client';
import { BRANDED_DEVICES } from '../library/devicesBranded';
import { RFSCAN_DEVICES } from '../library/devicesRfScan';
import { DeviceFace } from '../render/DeviceFace';
import { faceWidth, panelHeight } from '../model/geometry';

const only = new URLSearchParams(location.search).get('id');
const list = [...BRANDED_DEVICES, ...RFSCAN_DEVICES].filter((t) => !only || t.id === only);
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
