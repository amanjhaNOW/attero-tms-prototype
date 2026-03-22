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
 *
 * Multi-Vehicle cascade:
 *   Complete PICKUP → PR "picked_up" (on first pickup)
 *   Complete DELIVER on one shipment → check ALL shipments for this PR
 *     - If ALL DELIVER stops for this PR (across all shipments in load) are completed → PR "closed"
 *     - Otherwise → PR stays in current state
 *
 * Warehouse Consolidation cascade:
 *   Complete DELIVER at WAREHOUSE → PR stays "picked_up" (NOT closed/delivered)
 *   Complete DELIVER at PLANT → PR can move to "delivered"/"closed"
 *   This is the KEY differentiator: warehouse is intermediate, plant is final.
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

  // 2. If PICKUP: update linked PR status to 'picked_up' (first pickup triggers this)
  if (stop.type === 'PICKUP' && stop.prId) {
    const pr = prStore.getPRById(stop.prId);
    // Only move to picked_up if still in pending/planned
    if (pr && (pr.status === 'pending' || pr.status === 'planned')) {
      prStore.updatePR(stop.prId, { status: 'picked_up' });
    }
  }

  // 3. If DELIVER: check load destination type before advancing PR
  if (stop.type === 'DELIVER' && stop.prId) {
    const shipment = shipmentStore.getShipmentById(stop.shipmentId);
    if (shipment) {
      const load = loadStore.getLoadById(shipment.loadId);
      if (load) {
        // WAREHOUSE RULE: delivery to warehouse does NOT advance PR beyond picked_up
        if (load.destination.type === 'warehouse') {
          // PR stays "picked_up" — warehouse is intermediate, not final
          const pr = prStore.getPRById(stop.prId);
          if (pr && (pr.status === 'pending' || pr.status === 'planned')) {
            prStore.updatePR(stop.prId, { status: 'picked_up' });
          }
        } else {
          // PLANT destination: PR can advance to delivered
          const pr = prStore.getPRById(stop.prId);
          if (pr && pr.status !== 'closed') {
            prStore.updatePR(stop.prId, { status: 'delivered' });
          }
        }
      }
    }
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

          // 6. Close PRs — but ONLY if destination is PLANT
          // Warehouse destination → PRs stay in picked_up
          if (load.destination.type === 'plant') {
            load.prIds.forEach((prId) => {
              // Find ALL DELIVER stops across ALL shipments in this load that reference this PR
              const deliverStopsForPR = allLoadStops.filter(
                (s) => s.type === 'DELIVER' && s.prId === prId
              );
              // Check if ALL DELIVER stops for this PR are completed
              const allDeliverCompleted = deliverStopsForPR.every(
                (s) => s.id === stopId ? true : s.status === 'completed'
              );
              if (allDeliverCompleted) {
                prStore.updatePR(prId, { status: 'closed' });
              }
            });
          }
          // If destination is warehouse, PRs intentionally stay as "picked_up"
        } else {
          // Even if not all shipments complete, check per-PR closure for multi-vehicle
          // But ONLY for plant destinations
          if (load.patternLabel === 'multi_vehicle' && load.destination.type === 'plant') {
            load.prIds.forEach((prId) => {
              const deliverStopsForPR = allLoadStops.filter(
                (s) => s.type === 'DELIVER' && s.prId === prId
              );
              const allDeliverCompleted = deliverStopsForPR.every(
                (s) => s.id === stopId ? true : s.status === 'completed'
              );
              if (allDeliverCompleted && deliverStopsForPR.length > 0) {
                prStore.updatePR(prId, { status: 'closed' });
              }
            });
          }
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

/**
 * Add a new shipment to an existing load (multi-vehicle pattern).
 * Creates a draft shipment + PICKUP stop at the PR's pickup location + DELIVER stop at destination.
 */
export function addShipmentToLoad(loadId: string) {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load || load.prIds.length === 0) return;

  // For multi-vehicle, we use the first (and typically only) PR
  const prId = load.prIds[0];
  const pr = prStore.getPRById(prId);
  if (!pr) return;

  // Generate IDs
  const allShipments = shipmentStore.shipments;
  const allStops = stopStore.stops;
  const shipNum = allShipments.length + 1;
  const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

  // Create PICKUP stop
  const pickupStopId = `STOP-${String(allStops.length + 1).padStart(3, '0')}`;
  stopStore.addStop({
    id: pickupStopId,
    shipmentId: shipId,
    sequence: 1,
    type: 'PICKUP',
    location: {
      name: pr.pickupLocation.name,
      state: pr.pickupLocation.state,
      city: pr.pickupLocation.city,
      pin: pr.pickupLocation.pin,
      address: pr.pickupLocation.address,
    },
    prId: prId,
    plannedItems: pr.materials.map((m) => ({
      material: m.type,
      qty: m.plannedQty,
      unit: m.unit,
    })),
    actualItems: [],
    totalActualQty: 0,
    status: 'pending',
  });

  // Create DELIVER stop at load destination
  const deliverStopId = `STOP-${String(allStops.length + 2).padStart(3, '0')}`;
  stopStore.addStop({
    id: deliverStopId,
    shipmentId: shipId,
    sequence: 2,
    type: 'DELIVER',
    location: {
      name: load.destination.name,
      state: load.destination.state,
      city: load.destination.city,
      pin: load.destination.pin,
      address: load.destination.address,
    },
    prId: prId,
    plannedItems: pr.materials.map((m) => ({
      material: m.type,
      qty: m.plannedQty,
      unit: m.unit,
    })),
    actualItems: [],
    totalActualQty: 0,
    linkedStopId: pickupStopId,
    status: 'pending',
  });

  // Create shipment
  shipmentStore.addShipment({
    id: shipId,
    loadId: loadId,
    scheduledPickupDate: pr.tentativePickupDate,
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: [pickupStopId, deliverStopId],
    shipmentValue: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Update load: add shipment ID and update pattern
  const loadShipments = allShipments.filter((s) => s.loadId === loadId);
  const newShipmentCount = loadShipments.length + 1; // +1 for the new one
  const newPattern =
    load.prIds.length === 1 && newShipmentCount >= 2
      ? ('multi_vehicle' as const)
      : load.patternLabel;

  loadStore.updateLoad(loadId, {
    shipmentIds: [...load.shipmentIds, shipId],
    patternLabel: newPattern,
    // If load was fully_planned, adding a draft shipment makes it partially_planned
    status: load.status === 'fully_planned' ? 'partially_planned' : load.status,
  });
}
