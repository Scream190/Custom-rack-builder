import { useStore } from './store';

/**
 * Click on a connector (2D and 3D views): the first click starts a cable, a click on another connector connects it.
 * A connected connector selects its cable instead; with Alt a further cable starts there (e.g. for Y cables).
 */
export function clickPort(rackId: string, deviceId: string, portId: string, altKey = false): void {
  const s = useStore.getState();
  const rack = s.project.racks.find((r) => r.id === rackId);
  if (!rack) return;
  const pend = s.pendingPort;
  if (pend && pend.rackId === rackId) {
    if (!(pend.deviceId === deviceId && pend.portId === portId)) s.connect(rackId, { deviceId: pend.deviceId, portId: pend.portId }, { deviceId, portId });
    s.setPendingPort(null);
    return;
  }
  const existing = rack.cables.find((c) => (c.a.deviceId === deviceId && c.a.portId === portId) || (c.b.deviceId === deviceId && c.b.portId === portId));
  if (existing && !altKey) s.select({ kind: 'cable', id: existing.id });
  else s.setPendingPort({ rackId, deviceId, portId });
}
