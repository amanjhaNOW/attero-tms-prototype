/**
 * Utility: Map stop types to user-friendly UX labels.
 * Data model stays TRANSFER_IN / TRANSFER_OUT — only UI labels change.
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
      // Find the target shipment that has the linked TRANSFER_IN stop
      let targetLabel = 'TBD';
      if (stop.linkedStopId && allStops) {
        const linkedStop = allStops.find((s) => s.id === stop.linkedStopId);
        if (linkedStop) {
          const targetShip = allShipments.find((s) => s.id === linkedStop.shipmentId);
          if (targetShip) targetLabel = targetShip.id;
        }
      } else if (stop.linkedStopId) {
        const targetShip = allShipments.find((s) =>
          s.stopIds.includes(stop.linkedStopId || ''),
        );
        if (targetShip) targetLabel = targetShip.id;
      }
      return {
        icon: '🤝',
        label: 'Handover',
        detail: `give to ${targetLabel}`,
      };
    }
    case 'TRANSFER_IN': {
      // Find all TRANSFER_OUTs that link to this stop
      const feeders: string[] = [];
      if (allStops) {
        allStops
          .filter((s) => s.type === 'TRANSFER_OUT' && s.linkedStopId === stop.id)
          .forEach((s) => {
            const ship = allShipments.find((sh) => sh.id === s.shipmentId);
            if (ship) feeders.push(ship.id);
          });
      }
      const detail =
        feeders.length > 0
          ? `from ${feeders.join(', ')}`
          : 'from feeders';
      return { icon: '📥', label: 'Receive', detail };
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
