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
 * Add a new shipment to an existing load.
 * Clones ALL stops from the first shipment (preserving the full route for milk runs).
 */
export function addShipmentToLoad(loadId: string) {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load || load.prIds.length === 0) return;

  // Find the first shipment in the load to clone its route
  const firstShipId = load.shipmentIds[0];
  const firstShipment = firstShipId ? shipmentStore.getShipmentById(firstShipId) : null;
  const firstShipStops = firstShipment
    ? stopStore.stops
        .filter((s) => s.shipmentId === firstShipment.id)
        .sort((a, b) => a.sequence - b.sequence)
    : [];

  // Generate IDs
  const allShipments = shipmentStore.shipments;
  const shipNum = allShipments.length + 1;
  const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

  const newStopIds: string[] = [];
  let stopCounter = stopStore.stops.length + 1;

  if (firstShipStops.length > 0) {
    // Clone ALL stops from the first shipment with new IDs
    firstShipStops.forEach((srcStop) => {
      const newStopId = `STOP-${String(stopCounter).padStart(3, '0')}`;
      stopCounter += 1;
      newStopIds.push(newStopId);

      stopStore.addStop({
        id: newStopId,
        shipmentId: shipId,
        sequence: srcStop.sequence,
        type: srcStop.type,
        location: { ...srcStop.location },
        prId: srcStop.prId,
        plannedItems: srcStop.plannedItems.map((item) => ({ ...item })),
        actualItems: [],
        totalActualQty: 0,
        status: 'pending',
        // Link DELIVER to its first pickup
        linkedStopId: srcStop.type === 'DELIVER' ? newStopIds[0] : undefined,
      });
    });
  } else {
    // Fallback: create stops from PRs if no existing shipment
    const selectedPRs = load.prIds
      .map((prId) => prStore.getPRById(prId))
      .filter((pr): pr is NonNullable<typeof pr> => pr !== undefined);
    let seq = 1;
    selectedPRs.forEach((pr) => {
      const pickupStopId = `STOP-${String(stopCounter).padStart(3, '0')}`;
      stopCounter += 1;
      newStopIds.push(pickupStopId);

      stopStore.addStop({
        id: pickupStopId,
        shipmentId: shipId,
        sequence: seq,
        type: 'PICKUP',
        location: { ...pr.pickupLocation },
        prId: pr.id,
        plannedItems: pr.materials.map((m) => ({
          material: m.type,
          qty: m.plannedQty,
          unit: m.unit,
        })),
        actualItems: [],
        totalActualQty: 0,
        status: 'pending',
      });
      seq += 1;
    });

    // DELIVER stop
    const deliverStopId = `STOP-${String(stopCounter).padStart(3, '0')}`;
    newStopIds.push(deliverStopId);
    const allPlannedItems = selectedPRs.flatMap((pr) =>
      pr.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      })),
    );
    stopStore.addStop({
      id: deliverStopId,
      shipmentId: shipId,
      sequence: seq,
      type: 'DELIVER',
      location: { ...load.destination },
      prId: load.prIds.length === 1 ? load.prIds[0] : '',
      plannedItems: allPlannedItems,
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: newStopIds[0],
      status: 'pending',
    });
  }

  // Create shipment
  const firstPR = prStore.getPRById(load.prIds[0]);
  shipmentStore.addShipment({
    id: shipId,
    loadId: loadId,
    scheduledPickupDate:
      firstPR?.tentativePickupDate ?? new Date().toISOString().split('T')[0],
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: newStopIds,
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

/**
 * Check if a shipment is "synced" (no TRANSFER_IN or TRANSFER_OUT stops).
 * Synced shipments should all get new PICKUP stops when a PR is added to the load.
 */
export function isShipmentSynced(shipmentId: string): boolean {
  const stops = useStopStore.getState().stops.filter((s) => s.shipmentId === shipmentId);
  return !stops.some((s) => s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT');
}

/**
 * Remove a single stop from a shipment (per-shipment stop management).
 * Re-sequences remaining stops and updates the shipment's stopIds.
 */
export function removeStopFromShipment(stopId: string) {
  const stopStore = useStopStore.getState();
  const shipmentStore = useShipmentStore.getState();

  const stop = stopStore.getStopById(stopId);
  if (!stop) return;

  // Delete the stop
  stopStore.deleteStop(stopId);

  // Re-sequence remaining stops
  const remainingStops = stopStore.stops
    .filter((s) => s.shipmentId === stop.shipmentId)
    .sort((a, b) => a.sequence - b.sequence);
  remainingStops.forEach((s, i) => {
    stopStore.updateStop(s.id, { sequence: i + 1 });
  });

  // Update shipment's stopIds
  const shipment = shipmentStore.getShipmentById(stop.shipmentId);
  if (shipment) {
    shipmentStore.updateShipment(stop.shipmentId, {
      stopIds: shipment.stopIds.filter((id) => id !== stopId),
    });
  }
}

/**
 * Add a stop to a specific shipment (per-shipment stop management).
 * For PICKUP: adds a pickup stop before the DELIVER stop.
 * For TRANSFER_OUT/IN: creates linked stops on both shipments.
 */
export function addStopToShipment(
  shipmentId: string,
  type: 'PICKUP' | 'DELIVER' | 'TRANSFER_IN' | 'TRANSFER_OUT',
  prId?: string,
  linkedShipmentId?: string,
) {
  const stopStore = useStopStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const prStore = usePRStore.getState();
  const loadStore = useLoadStore.getState();

  const shipment = shipmentStore.getShipmentById(shipmentId);
  if (!shipment) return;

  const shipStops = stopStore.stops
    .filter((s) => s.shipmentId === shipmentId)
    .sort((a, b) => a.sequence - b.sequence);

  const deliverStop = shipStops.find((s) => s.type === 'DELIVER');
  const insertSeq = deliverStop ? deliverStop.sequence : shipStops.length + 1;

  // Bump sequence for DELIVER and anything after
  shipStops.forEach((s) => {
    if (s.sequence >= insertSeq) {
      stopStore.updateStop(s.id, { sequence: s.sequence + 1 });
    }
  });

  const newStopId = `STOP-${String(stopStore.stops.length + 1).padStart(3, '0')}`;

  if (type === 'PICKUP' && prId) {
    const pr = prStore.getPRById(prId);
    if (!pr) return;

    stopStore.addStop({
      id: newStopId,
      shipmentId,
      sequence: insertSeq,
      type: 'PICKUP',
      location: { ...pr.pickupLocation },
      prId,
      plannedItems: pr.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      })),
      actualItems: [],
      totalActualQty: 0,
      status: 'pending',
    });

    shipmentStore.updateShipment(shipmentId, {
      stopIds: [...shipment.stopIds, newStopId],
    });
  } else if (type === 'DELIVER') {
    // Create a DELIVER stop at the load's destination
    const load = loadStore.getLoadById(shipment.loadId);
    const deliverLocation = load
      ? { ...load.destination }
      : { name: 'Destination', state: '', city: '', pin: '', address: '' };

    // Aggregate planned items from all PICKUP stops on this shipment
    const pickupStops = shipStops.filter((s) => s.type === 'PICKUP');
    const allPlannedItems = pickupStops.flatMap((s) =>
      s.plannedItems.map((item) => ({ ...item })),
    );

    const deliverSeq = shipStops.length + 1; // DELIVER goes at the end
    stopStore.addStop({
      id: newStopId,
      shipmentId,
      sequence: deliverSeq,
      type: 'DELIVER',
      location: deliverLocation,
      prId: prId ?? '',
      plannedItems: allPlannedItems,
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: pickupStops[0]?.id,
      status: 'pending',
    });

    shipmentStore.updateShipment(shipmentId, {
      stopIds: [...shipment.stopIds, newStopId],
    });
  } else if ((type === 'TRANSFER_OUT' || type === 'TRANSFER_IN') && linkedShipmentId) {
    const linkedShipment = shipmentStore.getShipmentById(linkedShipmentId);
    if (!linkedShipment) return;

    const load = loadStore.getLoadById(shipment.loadId);
    const transferLocation = load ? { ...load.destination } : { name: 'Transfer Point', state: '', city: '', pin: '', address: '' };

    // Create stop on this shipment
    stopStore.addStop({
      id: newStopId,
      shipmentId,
      sequence: insertSeq,
      type,
      location: transferLocation,
      prId: '',
      plannedItems: [],
      actualItems: [],
      totalActualQty: 0,
      status: 'pending',
    });

    shipmentStore.updateShipment(shipmentId, {
      stopIds: [...shipment.stopIds, newStopId],
    });

    // Create the paired stop on the linked shipment
    const linkedType = type === 'TRANSFER_OUT' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
    const linkedStopId = `STOP-${String(stopStore.stops.length + 1).padStart(3, '0')}`;
    const linkedShipStops = stopStore.stops
      .filter((s) => s.shipmentId === linkedShipmentId)
      .sort((a, b) => a.sequence - b.sequence);
    const linkedDeliverStop = linkedShipStops.find((s) => s.type === 'DELIVER');
    const linkedInsertSeq = linkedDeliverStop
      ? linkedDeliverStop.sequence
      : linkedShipStops.length + 1;

    // Bump sequences on the linked shipment
    linkedShipStops.forEach((s) => {
      if (s.sequence >= linkedInsertSeq) {
        stopStore.updateStop(s.id, { sequence: s.sequence + 1 });
      }
    });

    stopStore.addStop({
      id: linkedStopId,
      shipmentId: linkedShipmentId,
      sequence: linkedInsertSeq,
      type: linkedType,
      location: transferLocation,
      prId: '',
      plannedItems: [],
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: newStopId,
      status: 'pending',
    });

    // Set linkedStopId on the first stop
    stopStore.updateStop(newStopId, { linkedStopId });

    shipmentStore.updateShipment(linkedShipmentId, {
      stopIds: [...linkedShipment.stopIds, linkedStopId],
    });
  }
}
