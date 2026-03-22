/**
 * Utility: Map stop types to user-friendly UX labels.
 * Data model stays TRANSFER_IN / TRANSFER_OUT — only UI labels change.
 *
 * 1:1 pair model:
 *   TRANSFER_OUT.linkedStopId → the TRANSFER_IN it feeds
 *   TRANSFER_IN.linkedStopId  → the TRANSFER_OUT it receives from
 */
import type { Stop, Shipment } from '@/types';

export interface StopDisplayLabel {
  icon: string;
  label: string;
  detail: string;
}

export function getStopDisplayLabel(
  stop: Stop,
  allShipments: Shipment[],
  allStops?: Stop[],
): StopDisplayLabel {
  switch (stop.type) {
    case 'PICKUP':
      return { icon: '📦', label: 'Pickup', detail: stop.location.name };
    case 'DELIVER':
      return { icon: '📦', label: 'Deliver', detail: stop.location.name };
    case 'TRANSFER_OUT': {
      // 1:1: linkedStopId is the TRANSFER_IN on the target shipment
      let targetLabel = 'TBD';
      if (stop.linkedStopId) {
        if (allStops) {
          const linkedStop = allStops.find((s) => s.id === stop.linkedStopId);
          if (linkedStop) {
            const targetShip = allShipments.find((s) => s.id === linkedStop.shipmentId);
            if (targetShip) targetLabel = targetShip.id;
          }
        } else {
          const targetShip = allShipments.find((s) =>
            s.stopIds.includes(stop.linkedStopId || ''),
          );
          if (targetShip) targetLabel = targetShip.id;
        }
      }
      return {
        icon: '🤝',
        label: 'Handover',
        detail: `give to ${targetLabel}`,
      };
    }
    case 'TRANSFER_IN': {
      // 1:1: linkedStopId is the TRANSFER_OUT that feeds this stop
      let sourceLabel = 'feeders';
      if (stop.linkedStopId) {
        if (allStops) {
          const linkedOut = allStops.find((s) => s.id === stop.linkedStopId);
          if (linkedOut) {
            const sourceShip = allShipments.find((sh) => sh.id === linkedOut.shipmentId);
            if (sourceShip) sourceLabel = sourceShip.id;
          }
        } else {
          const sourceShip = allShipments.find((s) =>
            s.stopIds.includes(stop.linkedStopId || ''),
          );
          if (sourceShip) sourceLabel = sourceShip.id;
        }
      }
      return {
        icon: '📥',
        label: 'Receive',
        detail: `from ${sourceLabel}`,
      };
    }
    default:
      return { icon: '📍', label: stop.type, detail: stop.location.name };
  }
}

/**
 * Detect the role of a shipment based on its stops.
 */
export function getShipmentRole(
  stops: Stop[],
): 'Feeder' | 'Line-Haul' | 'Relay' | null {
  const hasTransferOut = stops.some((s) => s.type === 'TRANSFER_OUT');
  const hasTransferIn = stops.some((s) => s.type === 'TRANSFER_IN');
  if (hasTransferOut && hasTransferIn) return 'Relay';
  if (hasTransferOut) return 'Feeder';
  if (hasTransferIn) return 'Line-Haul';
  return null;
}
