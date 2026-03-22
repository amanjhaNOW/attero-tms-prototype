import { usePRStore } from './usePRStore';
import { useLoadStore } from './useLoadStore';
import { useShipmentStore } from './useShipmentStore';
import { useStopStore } from './useStopStore';
import type { StopItem, Stop } from '@/types';

/**
 * Cascade Engine — orchestrates state transitions across entities.
 * 
 * Direct Shipment cascade:
 *   Complete PICKUP → PR "picked_up"
 *   Complete DELIVER → Shipment "completed" → Load "completed" → PR "closed"
 * 
 * Milk Run cascade:
 *   Complete PICKUP N → that specific PR "picked_up"
 *   Complete DELIVER (after ALL pickups) → Shipment "completed" → Load "completed" → ALL PRs "closed"
 */

export function completeStop(
  stopId: string,
  actualItems?: StopItem[],
  weights?: { tareWeight: number; grossWeight: number; netWeight: number }
) {
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const loadStore = useLoadStore.getState();

  const stop = stopStore.getStopById(stopId);
  if (!stop) return;

  // 1. Update stop status to completed
  const stopUpdates: Partial<Stop> = {
    status: 'completed' as const,
    completedAt: new Date().toISOString(),
  };

  if (actualItems) {
    stopUpdates.actualItems = actualItems;
    stopUpdates.totalActualQty = actualItems.reduce((sum, item) => sum + item.qty, 0);
  }

  if (weights) {
    stopUpdates.tareWeight = weights.tareWeight;
    stopUpdates.grossWeight = weights.grossWeight;
    stopUpdates.netWeight = weights.netWeight;
  }

  stopStore.updateStop(stopId, stopUpdates);

  // 2. If PICKUP: update linked PR status to 'picked_up'
  if (stop.type === 'PICKUP' && stop.prId) {
    prStore.updatePR(stop.prId, { status: 'picked_up' });
  }

  // 3. If DELIVER (direct with single prId): update PR to 'delivered'
  if (stop.type === 'DELIVER' && stop.prId) {
    prStore.updatePR(stop.prId, { status: 'delivered' });
  }

  // 4. Check if ALL stops in shipment are completed
  const shipment = shipmentStore.getShipmentById(stop.shipmentId);
  if (shipment) {
    const allStops = useStopStore.getState().stops.filter(
      (s) => s.shipmentId === stop.shipmentId
    );
    const allCompleted = allStops.every(
      (s) => s.id === stopId ? true : s.status === 'completed'
    );

    if (allCompleted) {
      shipmentStore.updateShipment(stop.shipmentId, { status: 'completed' });

      // 5. Check if ALL shipments in load are completed
      const load = loadStore.getLoadById(shipment.loadId);
      if (load) {
        const allShipments = useShipmentStore.getState().shipments.filter(
          (s) => s.loadId === shipment.loadId
        );
        const allShipmentsCompleted = allShipments.every(
          (s) => s.id === shipment.id ? true : s.status === 'completed'
        );

        // Calculate total actual qty for the load from DELIVER stops
        const allLoadStops = useStopStore.getState().stops.filter((s) => {
          const sh = useShipmentStore.getState().getShipmentById(s.shipmentId);
          return sh && sh.loadId === shipment.loadId;
        });
        const deliverStops = allLoadStops.filter((s) => s.type === 'DELIVER');
        const totalActual = deliverStops.reduce((sum, s) => {
          if (s.id === stopId) {
            return sum + (actualItems ? actualItems.reduce((a, i) => a + i.qty, 0) : s.totalActualQty);
          }
          return sum + s.totalActualQty;
        }, 0);

        loadStore.updateLoad(shipment.loadId, { totalActualQty: totalActual });

        if (allShipmentsCompleted) {
          loadStore.updateLoad(shipment.loadId, { status: 'completed' });

          // 6. Close ALL PRs in this load
          load.prIds.forEach((prId) => {
            prStore.updatePR(prId, { status: 'closed' });
          });
        }
      }
    }
  }
}

export function dispatchShipment(shipmentId: string) {
  const shipmentStore = useShipmentStore.getState();
  const loadStore = useLoadStore.getState();

  const shipment = shipmentStore.getShipmentById(shipmentId);
  if (!shipment) return;

  shipmentStore.updateShipment(shipmentId, { status: 'in_transit' });

  // Update load to in_execution
  const load = loadStore.getLoadById(shipment.loadId);
  if (load && (load.status === 'fully_planned' || load.status === 'partially_planned')) {
    loadStore.updateLoad(shipment.loadId, { status: 'in_execution' });
  }
}

export function planShipment(shipmentId: string) {
  const shipmentStore = useShipmentStore.getState();
  const loadStore = useLoadStore.getState();

  const shipment = shipmentStore.getShipmentById(shipmentId);
  if (!shipment) return;

  shipmentStore.updateShipment(shipmentId, { status: 'planned' });

  // Check if all shipments in load are planned
  const load = loadStore.getLoadById(shipment.loadId);
  if (load) {
    const allShipments = useShipmentStore.getState().shipments.filter(
      (s) => s.loadId === shipment.loadId
    );
    const allPlanned = allShipments.every(
      (s) => s.id === shipmentId ? true : s.status === 'planned' || s.status === 'in_transit' || s.status === 'completed'
    );

    if (allPlanned) {
      loadStore.updateLoad(shipment.loadId, { status: 'fully_planned' });
    } else {
      loadStore.updateLoad(shipment.loadId, { status: 'partially_planned' });
    }
  }
}

export function cancelShipment(shipmentId: string) {
  const shipmentStore = useShipmentStore.getState();
  const shipment = shipmentStore.getShipmentById(shipmentId);
  if (!shipment) return;
  if (shipment.status === 'draft' || shipment.status === 'planned') {
    shipmentStore.updateShipment(shipmentId, { status: 'cancelled' });
  }
}
