import { usePRStore } from './usePRStore';
import { useLoadStore } from './useLoadStore';
import { useShipmentStore } from './useShipmentStore';
import { useStopStore } from './useStopStore';
import type { StopItem, Stop, Load } from '@/types';
import { generateId } from '@/lib/idGenerator';

/**
 * Detect the correct pattern label for a load based on current state.
 * Called after every mutation that changes shipments, stops, or PRs on a load.
 */
export function detectPattern(loadId: string): Load['patternLabel'] {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return 'direct';

  const shipments = shipmentStore.shipments.filter((s) => s.loadId === loadId);
  const allStops = stopStore.stops.filter((s) =>
    shipments.some((sh) => sh.id === s.shipmentId),
  );

  const hasTransfer = allStops.some(
    (s) => s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT',
  );
  if (hasTransfer) return 'cross_dock';

  const hasWarehouseDest = load.destination.type === 'warehouse';
  if (hasWarehouseDest) return 'warehouse_consolidation';

  const prCount = load.prIds.length;
  const shipCount = shipments.length;

  if (prCount <= 1 && shipCount <= 1) return 'direct';
  if (prCount >= 2 && shipCount <= 1) return 'milk_run';
  return 'multi_vehicle';
}

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

/**
 * Result type for completeStop — indicates success/failure and reason.
 */
export interface CompleteStopResult {
  success: boolean;
  message?: string;
  /** When a TRANSFER_OUT completes, signals if all handovers for the linked TRANSFER_IN are done */
  allHandoversDone?: boolean;
}

export function completeStop(
  stopId: string,
  actualItems?: StopItem[],
  weights?: { tareWeight: number; grossWeight: number; netWeight: number }
): CompleteStopResult {
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const loadStore = useLoadStore.getState();

  const stop = stopStore.getStopById(stopId);
  if (!stop) return { success: false, message: 'Stop not found' };

  // ── TRANSFER_IN validation: linked TRANSFER_OUT must be completed (1:1 pair) ──
  if (stop.type === 'TRANSFER_IN') {
    if (stop.linkedStopId) {
      const linkedOut = stopStore.getStopById(stop.linkedStopId);
      if (linkedOut && linkedOut.type === 'TRANSFER_OUT' && linkedOut.status !== 'completed') {
        const sh = shipmentStore.getShipmentById(linkedOut.shipmentId);
        return {
          success: false,
          message: `Cannot confirm receipt. Waiting for handover from: ${sh?.id || linkedOut.shipmentId}`,
        };
      }
    }
  }

  // ── DELIVER validation: ALL TRANSFER_IN + PICKUP stops in this shipment must be completed ──
  if (stop.type === 'DELIVER') {
    const shipStops = stopStore.stops.filter((s) => s.shipmentId === stop.shipmentId);
    const pendingPrereqs = shipStops.filter(
      (s) =>
        s.id !== stopId &&
        (s.type === 'TRANSFER_IN' || s.type === 'PICKUP') &&
        s.status !== 'completed' &&
        s.status !== 'skipped',
    );
    if (pendingPrereqs.length > 0) {
      const labels = pendingPrereqs.map((s) => {
        if (s.type === 'TRANSFER_IN' && s.linkedStopId) {
          const linkedOut = stopStore.getStopById(s.linkedStopId);
          const srcShip = linkedOut ? shipmentStore.getShipmentById(linkedOut.shipmentId) : null;
          return `📥 Receive from ${srcShip?.id || 'feeder'}`;
        }
        return `📦 ${s.type} at ${s.location.name || s.location.city || 'TBD'}`;
      });
      return {
        success: false,
        message: `Cannot deliver yet. Pending: ${labels.join(', ')}`,
      };
    }
  }

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

  // 2b. If TRANSFER_OUT completes: in 1:1 model, this always means the paired handover is done
  let allHandoversDone = false;
  if (stop.type === 'TRANSFER_OUT' && stop.linkedStopId) {
    // 1:1 pair — completing this TRANSFER_OUT means its paired TRANSFER_IN can proceed
    allHandoversDone = true;

    // Auto-sync location to the paired TRANSFER_IN stop
    const linkedIn = useStopStore.getState().getStopById(stop.linkedStopId);
    if (linkedIn && linkedIn.type === 'TRANSFER_IN' && stop.location.name) {
      useStopStore.getState().updateStop(linkedIn.id, {
        location: { ...stop.location },
      });
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

  return { success: true, allHandoversDone };
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
 * Add a new shipment to an existing load ("Same Route").
 * Clones PICKUP + DELIVER stops from the first shipment.
 * TRANSFER_OUT / TRANSFER_IN stops are NOT cloned (they are cross-dock specific).
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
  const shipId = generateId('SHP');

  const newStopIds: string[] = [];

  // Filter: only clone PICKUP + DELIVER stops (not TRANSFER_OUT / TRANSFER_IN)
  const stopsToClone = firstShipStops.filter(
    (s) => s.type === 'PICKUP' || s.type === 'DELIVER',
  );

  if (stopsToClone.length > 0) {
    // Clone PICKUP + DELIVER stops with new IDs and re-sequence
    let seq = 1;
    stopsToClone.forEach((srcStop) => {
      const newStopId = generateId('STOP');
      newStopIds.push(newStopId);

      stopStore.addStop({
        id: newStopId,
        shipmentId: shipId,
        sequence: seq,
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
      seq += 1;
    });
  } else {
    // Fallback: create stops from PRs if no existing shipment
    const selectedPRs = load.prIds
      .map((prId) => prStore.getPRById(prId))
      .filter((pr): pr is NonNullable<typeof pr> => pr !== undefined);
    let seq = 1;
    selectedPRs.forEach((pr) => {
      const pickupStopId = generateId('STOP');
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
    const deliverStopId = generateId('STOP');
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

  // Update load: add shipment ID
  loadStore.updateLoad(loadId, {
    shipmentIds: [...load.shipmentIds, shipId],
    // If load was fully_planned, adding a draft shipment makes it partially_planned
    status: load.status === 'fully_planned' ? 'partially_planned' : load.status,
  });

  // Re-detect pattern after adding shipment
  const newPattern = detectPattern(loadId);
  loadStore.updateLoad(loadId, { patternLabel: newPattern });
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

    // Re-detect pattern after removing stop
    const loadStore = useLoadStore.getState();
    const newPattern = detectPattern(shipment.loadId);
    loadStore.updateLoad(shipment.loadId, { patternLabel: newPattern });
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

  const newStopId = generateId('STOP');

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

    // ALWAYS create a new 1:1 pair — never reuse an existing TRANSFER_IN
    const transferLocation = { name: '', state: '', city: '', pin: '', address: '' };

    // Create the paired stop on the linked shipment FIRST so we have its ID
    const linkedType = type === 'TRANSFER_OUT' ? 'TRANSFER_IN' : 'TRANSFER_OUT';
    const pairedStopId = generateId('STOP');

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

    // ── BUG 3 FIX: Aggregate material qty from PICKUP stops on source shipment ──
    const sourceShipmentId = type === 'TRANSFER_OUT' ? shipmentId : linkedShipmentId;
    const targetShipmentId = type === 'TRANSFER_OUT' ? linkedShipmentId : shipmentId;
    const allStops = stopStore.stops;
    const pickupStops = allStops.filter(
      (s) => s.shipmentId === sourceShipmentId && s.type === 'PICKUP',
    );
    const aggregatedItems: { material: string; qty: number; unit: string }[] = [];
    pickupStops.forEach((ps) => {
      ps.plannedItems.forEach((item) => {
        const existing = aggregatedItems.find(
          (a) => a.material === item.material && a.unit === item.unit,
        );
        if (existing) existing.qty += item.qty;
        else aggregatedItems.push({ material: item.material, qty: item.qty, unit: item.unit });
      });
    });

    // Create stop on this shipment (TRANSFER_OUT → linked to pairedStopId on target)
    stopStore.addStop({
      id: newStopId,
      shipmentId,
      sequence: insertSeq,
      type,
      location: { ...transferLocation },
      prId: '',
      plannedItems: aggregatedItems.map((i) => ({ ...i })),
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: pairedStopId,
      status: 'pending',
    });

    shipmentStore.updateShipment(shipmentId, {
      stopIds: [...shipment.stopIds, newStopId],
    });

    // Create paired stop on linked shipment (TRANSFER_IN → linked to newStopId on source)
    stopStore.addStop({
      id: pairedStopId,
      shipmentId: linkedShipmentId,
      sequence: linkedInsertSeq,
      type: linkedType,
      location: { ...transferLocation },
      prId: '',
      plannedItems: aggregatedItems.map((i) => ({ ...i })),
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: newStopId,
      status: 'pending',
    });

    shipmentStore.updateShipment(linkedShipmentId, {
      stopIds: [...linkedShipment.stopIds, pairedStopId],
    });

    // ── BUG 3 FIX: Update the target shipment's DELIVER stop with aggregated TRANSFER_IN items ──
    const refreshedStops = stopStore.stops;
    const targetDeliverStop = refreshedStops.find(
      (s) => s.shipmentId === targetShipmentId && s.type === 'DELIVER',
    );
    if (targetDeliverStop) {
      // Aggregate all TRANSFER_IN planned items already on the target shipment
      const allReceives = refreshedStops.filter(
        (s) => s.shipmentId === targetShipmentId && s.type === 'TRANSFER_IN',
      );
      const deliverItems: { material: string; qty: number; unit: string }[] = [];
      allReceives.forEach((r) => {
        r.plannedItems.forEach((item) => {
          const existing = deliverItems.find(
            (a) => a.material === item.material && a.unit === item.unit,
          );
          if (existing) existing.qty += item.qty;
          else deliverItems.push({ material: item.material, qty: item.qty, unit: item.unit });
        });
      });
      stopStore.updateStop(targetDeliverStop.id, { plannedItems: deliverItems });
    }
  }

  // Re-detect pattern after adding stop (especially transfer stops change pattern)
  const shipmentForPattern = shipmentStore.getShipmentById(shipmentId);
  if (shipmentForPattern) {
    const newPattern = detectPattern(shipmentForPattern.loadId);
    loadStore.updateLoad(shipmentForPattern.loadId, { patternLabel: newPattern });
  }
}

/**
 * Add a Line-Haul shipment to a load.
 * Creates a shipment with ONLY a DELIVER stop at the load's destination.
 * No pickups — user connects feeders to it via Ship→Ship connections.
 */
export function addLineHaulToLoad(loadId: string) {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return;

  // Generate IDs
  const shipId = generateId('SHP');
  const deliverStopId = generateId('STOP');

  // Aggregate planned items from all PRs in the load (for the DELIVER stop)
  const allPlannedItems = load.prIds
    .map((prId) => prStore.getPRById(prId))
    .filter((pr): pr is NonNullable<typeof pr> => pr !== undefined)
    .flatMap((pr) =>
      pr.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      })),
    );

  // Create DELIVER stop at load destination
  stopStore.addStop({
    id: deliverStopId,
    shipmentId: shipId,
    sequence: 1,
    type: 'DELIVER',
    location: { ...load.destination },
    prId: load.prIds.length === 1 ? load.prIds[0] : '',
    plannedItems: allPlannedItems,
    actualItems: [],
    totalActualQty: 0,
    status: 'pending',
  });

  // Create shipment
  const firstPR = prStore.getPRById(load.prIds[0]);
  shipmentStore.addShipment({
    id: shipId,
    loadId,
    scheduledPickupDate:
      firstPR?.tentativePickupDate ?? new Date().toISOString().split('T')[0],
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: [deliverStopId],
    shipmentValue: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Update load
  loadStore.updateLoad(loadId, {
    shipmentIds: [...load.shipmentIds, shipId],
    // If load was fully_planned, adding a draft shipment makes it partially_planned
    status: load.status === 'fully_planned' ? 'partially_planned' : load.status,
  });

  // Re-detect pattern
  const newPattern = detectPattern(loadId);
  loadStore.updateLoad(loadId, { patternLabel: newPattern });
}

/**
 * Add an Empty shipment to a load.
 * Creates a shipment with NO stops at all.
 * User builds the entire route via click-to-connect in the flow diagram.
 */
export function addEmptyShipmentToLoad(loadId: string) {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return;

  // Generate ID
  const shipId = generateId('SHP');

  const firstPR = prStore.getPRById(load.prIds[0]);
  shipmentStore.addShipment({
    id: shipId,
    loadId,
    scheduledPickupDate:
      firstPR?.tentativePickupDate ?? new Date().toISOString().split('T')[0],
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: [],
    shipmentValue: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Update load
  loadStore.updateLoad(loadId, {
    shipmentIds: [...load.shipmentIds, shipId],
    status: load.status === 'fully_planned' ? 'partially_planned' : load.status,
  });

  // Re-detect pattern
  const newPattern = detectPattern(loadId);
  loadStore.updateLoad(loadId, { patternLabel: newPattern });
}

/**
 * Remove a shipment from its load entirely.
 * Cleans up all stops (including paired TRANSFER stops on linked shipments).
 * Only works for draft shipments.
 */
export function removeShipmentFromLoad(shipmentId: string) {
  const stopStore = useStopStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const loadStore = useLoadStore.getState();

  const shipment = shipmentStore.getShipmentById(shipmentId);
  if (!shipment || shipment.status !== 'draft') return;

  const stops = stopStore.stops.filter((s) => s.shipmentId === shipmentId);

  // Delete paired TRANSFER stops on linked shipments
  stops.forEach((stop) => {
    if (stop.linkedStopId) {
      const linkedStop = stopStore.getStopById(stop.linkedStopId);
      if (linkedStop && linkedStop.shipmentId !== shipmentId) {
        // Remove linked stop from its shipment's stopIds
        const linkedShip = shipmentStore.getShipmentById(linkedStop.shipmentId);
        if (linkedShip) {
          shipmentStore.updateShipment(linkedShip.id, {
            stopIds: linkedShip.stopIds.filter((id) => id !== linkedStop.id),
          });
        }
        stopStore.deleteStop(linkedStop.id);
      }
    }
    stopStore.deleteStop(stop.id);
  });

  // Delete shipment
  shipmentStore.deleteShipment(shipmentId);

  // Update load
  const load = loadStore.getLoadById(shipment.loadId);
  if (load) {
    loadStore.updateLoad(load.id, {
      shipmentIds: load.shipmentIds.filter((id) => id !== shipmentId),
      // Don't auto-remove PRs from load — they stay for reassignment
    });

    // Re-detect pattern after removing shipment
    const newPattern = detectPattern(load.id);
    loadStore.updateLoad(load.id, { patternLabel: newPattern });
  }
}

/**
 * Auto-remove a feeder's DELIVER stop when a handover (TRANSFER_OUT) is created.
 *
 * Conditions for removal:
 * - Source shipment is in 'draft' status
 * - The DELIVER stop is the LAST stop on the shipment
 * - The feeder doesn't have other TRANSFER_OUT connections (first handover only)
 *
 * This transforms: PICKUP → DELIVER into: PICKUP → HANDOVER
 */
export function autoRemoveFeederDeliver(sourceShipmentId: string) {
  const stopStore = useStopStore.getState();
  const shipmentStore = useShipmentStore.getState();

  const shipment = shipmentStore.getShipmentById(sourceShipmentId);
  if (!shipment || shipment.status !== 'draft') return;

  const shipStops = stopStore.stops
    .filter((s) => s.shipmentId === sourceShipmentId)
    .sort((a, b) => a.sequence - b.sequence);

  const deliverStop = shipStops.find((s) => s.type === 'DELIVER');
  if (!deliverStop) return;

  // Only auto-remove if DELIVER is the last stop (ignoring the just-added TRANSFER_OUT)
  // After adding TRANSFER_OUT before DELIVER, DELIVER may have been bumped.
  // We check: is DELIVER still at the end? (highest sequence)
  const maxSeq = Math.max(...shipStops.map((s) => s.sequence));
  if (deliverStop.sequence !== maxSeq) return;

  // Count TRANSFER_OUT stops on this shipment (the one just created is already there)
  const transferOutCount = shipStops.filter((s) => s.type === 'TRANSFER_OUT').length;

  // Only auto-remove on the FIRST handover connection
  // (if there's more than 1 TRANSFER_OUT, the user is doing something complex — don't touch DELIVER)
  if (transferOutCount > 1) return;

  // Remove the DELIVER stop
  removeStopFromShipment(deliverStop.id);
}
