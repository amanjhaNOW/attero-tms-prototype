/**
 * Instant Load creation helpers.
 * Used by PR List, Warehouse Dashboard, and LoadWorkspace add-source actions.
 */
import {
  useLoadStore,
  useShipmentStore,
  useStopStore,
  usePRStore,
  useReferenceStore,
} from '@/stores';
import type { PickupRequest, Location } from '@/types';

interface WarehouseSourceItem {
  prId: string;
  clientName: string;
  materials: { type: string; qty: number; unit: string }[];
  maxQty: number;
  warehouseLocation: Location;
  inboundShipmentId: string;
}

/**
 * Get the default destination (first plant in location master).
 */
export function getDefaultDestination() {
  const locations = useReferenceStore.getState().locations;
  const plant = locations.find((l) => l.type === 'plant');
  if (!plant) return null;
  return {
    id: plant.id,
    name: plant.name,
    state: plant.state,
    city: plant.city,
    pin: plant.pin,
    address: plant.address,
    type: 'plant' as const,
  };
}

/**
 * Instantly create a Load + Shipment + Stops from selected PR IDs.
 * Returns the new Load ID.
 */
export function createLoadFromPRs(prIds: string[], destinationId?: string): string {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();
  const refStore = useReferenceStore.getState();

  // Resolve destination
  const destLoc = destinationId
    ? refStore.locations.find((l) => l.id === destinationId)
    : refStore.locations.find((l) => l.type === 'plant');
  if (!destLoc) throw new Error('No destination found');

  const dest: Location & { type: 'plant' | 'warehouse' } = {
    name: destLoc.name,
    state: destLoc.state,
    city: destLoc.city,
    pin: destLoc.pin,
    address: destLoc.address,
    type: destLoc.type as 'plant' | 'warehouse',
  };

  // Generate IDs
  const loadNum = loadStore.loads.length + 1;
  const loadId = `LOAD-${String(loadNum).padStart(3, '0')}`;
  const shipNum = shipmentStore.shipments.length + 1;
  const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

  const selectedPRs = prIds
    .map((id) => prStore.pickupRequests.find((pr) => pr.id === id))
    .filter((pr): pr is PickupRequest => pr !== undefined);

  if (selectedPRs.length === 0) throw new Error('No valid PRs found');

  const stopIdsForShipment: string[] = [];
  let seq = 1;
  let totalQty = 0;

  // Create PICKUP stops
  selectedPRs.forEach((pr) => {
    const pickupStopId = `STOP-${String(stopStore.stops.length + seq).padStart(3, '0')}`;
    stopIdsForShipment.push(pickupStopId);

    const prQty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
    totalQty += prQty;

    stopStore.addStop({
      id: pickupStopId,
      shipmentId: shipId,
      sequence: seq,
      type: 'PICKUP',
      location: {
        name: pr.pickupLocation.name,
        state: pr.pickupLocation.state,
        city: pr.pickupLocation.city,
        pin: pr.pickupLocation.pin,
        address: pr.pickupLocation.address,
      },
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

  // Create DELIVER stop
  const deliverStopId = `STOP-${String(stopStore.stops.length + seq).padStart(3, '0')}`;
  stopIdsForShipment.push(deliverStopId);

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
    location: {
      name: dest.name,
      state: dest.state,
      city: dest.city,
      pin: dest.pin,
      address: dest.address,
    },
    prId: prIds.length === 1 ? prIds[0] : '',
    plannedItems: allPlannedItems,
    actualItems: [],
    totalActualQty: 0,
    linkedStopId: stopIdsForShipment[0],
    status: 'pending',
  });

  // Create shipment
  shipmentStore.addShipment({
    id: shipId,
    loadId: loadId,
    scheduledPickupDate:
      selectedPRs[0]?.tentativePickupDate ??
      new Date().toISOString().split('T')[0],
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: stopIdsForShipment,
    shipmentValue: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Determine pattern
  const patternLabel: 'direct' | 'milk_run' = prIds.length === 1 ? 'direct' : 'milk_run';

  // Create load
  loadStore.addLoad({
    id: loadId,
    prIds: [...prIds],
    shipmentIds: [shipId],
    destination: dest,
    totalPlannedQty: totalQty,
    totalActualQty: 0,
    documents: [],
    patternLabel,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Update PRs
  prIds.forEach((prId) => {
    const pr = prStore.pickupRequests.find((p) => p.id === prId);
    if (!pr) return;
    const updates: Partial<PickupRequest> = {
      loadIds: [...(pr.loadIds || []), loadId],
    };
    if (pr.status === 'pending') {
      updates.status = 'planned';
    }
    prStore.updatePR(prId, updates);
  });

  return loadId;
}

/**
 * Instantly create a Load from warehouse source items.
 * Returns the new Load ID.
 */
export function createLoadFromWarehouse(
  items: { prId: string; qty: number }[],
  warehouseSourceItems: WarehouseSourceItem[],
  destinationId?: string,
): string {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();
  const refStore = useReferenceStore.getState();

  const destLoc = destinationId
    ? refStore.locations.find((l) => l.id === destinationId)
    : refStore.locations.find((l) => l.type === 'plant');
  if (!destLoc) throw new Error('No destination found');

  const dest: Location & { type: 'plant' | 'warehouse' } = {
    name: destLoc.name,
    state: destLoc.state,
    city: destLoc.city,
    pin: destLoc.pin,
    address: destLoc.address,
    type: destLoc.type as 'plant' | 'warehouse',
  };

  const loadNum = loadStore.loads.length + 1;
  const loadId = `LOAD-${String(loadNum).padStart(3, '0')}`;
  const shipNum = shipmentStore.shipments.length + 1;
  const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

  const stopIdsForShipment: string[] = [];
  const allPrIds: string[] = [];
  let seq = 1;
  let totalQty = 0;
  let firstInboundShipmentId: string | undefined;

  items.forEach(({ prId, qty }) => {
    const whItem = warehouseSourceItems.find((i) => i.prId === prId);
    if (!whItem) return;

    if (!firstInboundShipmentId) firstInboundShipmentId = whItem.inboundShipmentId;

    const pickupStopId = `STOP-${String(stopStore.stops.length + seq).padStart(3, '0')}`;
    stopIdsForShipment.push(pickupStopId);
    if (!allPrIds.includes(prId)) allPrIds.push(prId);
    totalQty += qty;

    const totalItemQty = whItem.materials.reduce((s, m) => s + m.qty, 0);
    const ratio = totalItemQty > 0 ? qty / totalItemQty : 1;

    stopStore.addStop({
      id: pickupStopId,
      shipmentId: shipId,
      sequence: seq,
      type: 'PICKUP',
      location: {
        name: whItem.warehouseLocation.name,
        state: whItem.warehouseLocation.state,
        city: whItem.warehouseLocation.city,
        pin: whItem.warehouseLocation.pin,
        address: whItem.warehouseLocation.address,
      },
      prId,
      plannedItems: whItem.materials.map((m) => ({
        material: m.type,
        qty: Math.round(m.qty * ratio),
        unit: m.unit,
      })),
      actualItems: [],
      totalActualQty: 0,
      status: 'pending',
    });
    seq += 1;
  });

  // DELIVER stop
  const deliverStopId = `STOP-${String(stopStore.stops.length + seq).padStart(3, '0')}`;
  stopIdsForShipment.push(deliverStopId);

  const allPlannedItems = items.flatMap(({ prId, qty }) => {
    const whItem = warehouseSourceItems.find((i) => i.prId === prId);
    if (!whItem) return [];
    const totalItemQty = whItem.materials.reduce((s, m) => s + m.qty, 0);
    const ratio = totalItemQty > 0 ? qty / totalItemQty : 1;
    return whItem.materials.map((m) => ({
      material: m.type,
      qty: Math.round(m.qty * ratio),
      unit: m.unit,
    }));
  });

  stopStore.addStop({
    id: deliverStopId,
    shipmentId: shipId,
    sequence: seq,
    type: 'DELIVER',
    location: {
      name: dest.name,
      state: dest.state,
      city: dest.city,
      pin: dest.pin,
      address: dest.address,
    },
    prId: allPrIds.length === 1 ? allPrIds[0] : '',
    plannedItems: allPlannedItems,
    actualItems: [],
    totalActualQty: 0,
    linkedStopId: stopIdsForShipment[0],
    status: 'pending',
  });

  shipmentStore.addShipment({
    id: shipId,
    loadId: loadId,
    scheduledPickupDate: new Date().toISOString().split('T')[0],
    transportMode: 'carrier_third_party',
    transporterName: '',
    transporterGst: '',
    vehicleType: '',
    vehicleRegistration: '',
    driverName: '',
    driverPhone: '',
    stopIds: stopIdsForShipment,
    parentShipmentId: firstInboundShipmentId,
    shipmentValue: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  loadStore.addLoad({
    id: loadId,
    prIds: allPrIds,
    shipmentIds: [shipId],
    destination: dest,
    totalPlannedQty: totalQty,
    totalActualQty: 0,
    documents: [],
    patternLabel: 'warehouse_consolidation',
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  // Update PRs
  allPrIds.forEach((prId) => {
    const pr = prStore.pickupRequests.find((p) => p.id === prId);
    if (!pr) return;
    prStore.updatePR(prId, {
      loadIds: [...(pr.loadIds || []), loadId],
    });
  });

  return loadId;
}

/**
 * Create an empty draft load (no sources) and return the ID.
 */
export function createEmptyLoad(destinationId?: string): string {
  const loadStore = useLoadStore.getState();
  const refStore = useReferenceStore.getState();

  const destLoc = destinationId
    ? refStore.locations.find((l) => l.id === destinationId)
    : refStore.locations.find((l) => l.type === 'plant');
  if (!destLoc) throw new Error('No destination found');

  const dest: Location & { type: 'plant' | 'warehouse' } = {
    name: destLoc.name,
    state: destLoc.state,
    city: destLoc.city,
    pin: destLoc.pin,
    address: destLoc.address,
    type: destLoc.type as 'plant' | 'warehouse',
  };

  const loadNum = loadStore.loads.length + 1;
  const loadId = `LOAD-${String(loadNum).padStart(3, '0')}`;

  loadStore.addLoad({
    id: loadId,
    prIds: [],
    shipmentIds: [],
    destination: dest,
    totalPlannedQty: 0,
    totalActualQty: 0,
    documents: [],
    patternLabel: 'direct',
    status: 'draft',
    createdAt: new Date().toISOString(),
  });

  return loadId;
}

/**
 * Add PRs as sources to an existing load.
 * Creates new PICKUP stops in existing shipment + updates DELIVER stop.
 */
export function addPRsToLoad(loadId: string, prIds: string[]): void {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return;

  // Get or create the first shipment
  let shipId = load.shipmentIds[0];
  if (!shipId) {
    // Create a new shipment for this load
    const shipNum = shipmentStore.shipments.length + 1;
    shipId = `SHP-${String(shipNum).padStart(3, '0')}`;
    shipmentStore.addShipment({
      id: shipId,
      loadId: loadId,
      scheduledPickupDate: new Date().toISOString().split('T')[0],
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
    loadStore.updateLoad(loadId, {
      shipmentIds: [shipId],
    });
  }

  const shipStops = stopStore.stops
    .filter((s) => s.shipmentId === shipId)
    .sort((a, b) => a.sequence - b.sequence);

  const deliverStop = shipStops.find((s) => s.type === 'DELIVER');
  const pickupStops = shipStops.filter((s) => s.type === 'PICKUP');
  let nextSeq = pickupStops.length + 1;
  const newStopIds: string[] = [];
  const newPrIds: string[] = [];
  let addedQty = 0;

  prIds.forEach((prId) => {
    if (load.prIds.includes(prId)) return; // already in load
    const pr = prStore.pickupRequests.find((p) => p.id === prId);
    if (!pr) return;

    const pickupStopId = `STOP-${String(stopStore.stops.length + newStopIds.length + 1).padStart(3, '0')}`;
    newStopIds.push(pickupStopId);
    newPrIds.push(prId);

    const prQty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
    addedQty += prQty;

    stopStore.addStop({
      id: pickupStopId,
      shipmentId: shipId,
      sequence: nextSeq,
      type: 'PICKUP',
      location: {
        name: pr.pickupLocation.name,
        state: pr.pickupLocation.state,
        city: pr.pickupLocation.city,
        pin: pr.pickupLocation.pin,
        address: pr.pickupLocation.address,
      },
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
    nextSeq += 1;
  });

  if (newPrIds.length === 0) return;

  // If no deliver stop exists, create one
  if (!deliverStop) {
    const deliverStopId = `STOP-${String(stopStore.stops.length + newStopIds.length + 1).padStart(3, '0')}`;
    const allPrIdsNow = [...load.prIds, ...newPrIds];
    const allPRs = allPrIdsNow
      .map((id) => prStore.pickupRequests.find((p) => p.id === id))
      .filter(Boolean);
    const allPlannedItems = allPRs.flatMap((pr) =>
      pr!.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      })),
    );

    stopStore.addStop({
      id: deliverStopId,
      shipmentId: shipId,
      sequence: nextSeq,
      type: 'DELIVER',
      location: {
        name: load.destination.name,
        state: load.destination.state,
        city: load.destination.city,
        pin: load.destination.pin,
        address: load.destination.address,
      },
      prId: allPrIdsNow.length === 1 ? allPrIdsNow[0] : '',
      plannedItems: allPlannedItems,
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: newStopIds[0],
      status: 'pending',
    });
    newStopIds.push(deliverStopId);
  } else {
    // Update deliver stop sequence and planned items
    const allPrIdsNow = [...load.prIds, ...newPrIds];
    const allPRs = allPrIdsNow
      .map((id) => prStore.pickupRequests.find((p) => p.id === id))
      .filter(Boolean);
    const allPlannedItems = allPRs.flatMap((pr) =>
      pr!.materials.map((m) => ({
        material: m.type,
        qty: m.plannedQty,
        unit: m.unit,
      })),
    );
    stopStore.updateStop(deliverStop.id, {
      sequence: nextSeq,
      plannedItems: allPlannedItems,
      prId: allPrIdsNow.length === 1 ? allPrIdsNow[0] : '',
    });
  }

  // Update shipment stop IDs
  const shipment = shipmentStore.getShipmentById(shipId);
  if (shipment) {
    shipmentStore.updateShipment(shipId, {
      stopIds: [...shipment.stopIds, ...newStopIds],
    });
  }

  // Determine new pattern
  const allPrIdsNow = [...load.prIds, ...newPrIds];
  const patternLabel: 'direct' | 'milk_run' | 'warehouse_consolidation' =
    allPrIdsNow.length === 1 ? 'direct' : 'milk_run';

  // Update load
  loadStore.updateLoad(loadId, {
    prIds: allPrIdsNow,
    totalPlannedQty: load.totalPlannedQty + addedQty,
    patternLabel: load.patternLabel === 'warehouse_consolidation' ? 'warehouse_consolidation' : patternLabel,
  });

  // Update PRs
  newPrIds.forEach((prId) => {
    const pr = prStore.pickupRequests.find((p) => p.id === prId);
    if (!pr) return;
    const updates: Partial<PickupRequest> = {
      loadIds: [...(pr.loadIds || []), loadId],
    };
    if (pr.status === 'pending') {
      updates.status = 'planned';
    }
    prStore.updatePR(prId, updates);
  });
}

/**
 * Remove a PR source from a load.
 * Removes the corresponding PICKUP stop and updates PR back to pending.
 */
export function removePRFromLoad(loadId: string, prId: string): void {
  const loadStore = useLoadStore.getState();
  const shipmentStore = useShipmentStore.getState();
  const stopStore = useStopStore.getState();
  const prStore = usePRStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return;

  // Find and remove the PICKUP stop for this PR
  load.shipmentIds.forEach((shipId) => {
    const shipStops = stopStore.stops.filter((s) => s.shipmentId === shipId);
    const pickupStop = shipStops.find((s) => s.type === 'PICKUP' && s.prId === prId);
    if (pickupStop) {
      stopStore.deleteStop(pickupStop.id);

      // Update shipment stopIds
      const shipment = shipmentStore.getShipmentById(shipId);
      if (shipment) {
        shipmentStore.updateShipment(shipId, {
          stopIds: shipment.stopIds.filter((sid) => sid !== pickupStop.id),
        });
      }

      // Re-sequence remaining pickup stops
      const remainingStops = stopStore.stops
        .filter((s) => s.shipmentId === shipId && s.type === 'PICKUP')
        .sort((a, b) => a.sequence - b.sequence);
      remainingStops.forEach((s, idx) => {
        stopStore.updateStop(s.id, { sequence: idx + 1 });
      });

      // Update deliver stop sequence
      const deliverStop = stopStore.stops.find(
        (s) => s.shipmentId === shipId && s.type === 'DELIVER',
      );
      if (deliverStop) {
        const newPrIds = load.prIds.filter((id) => id !== prId);
        const allPRs = newPrIds
          .map((id) => prStore.pickupRequests.find((p) => p.id === id))
          .filter(Boolean);
        const allPlannedItems = allPRs.flatMap((pr) =>
          pr!.materials.map((m) => ({
            material: m.type,
            qty: m.plannedQty,
            unit: m.unit,
          })),
        );
        stopStore.updateStop(deliverStop.id, {
          sequence: remainingStops.length + 1,
          plannedItems: allPlannedItems,
          prId: newPrIds.length === 1 ? newPrIds[0] : '',
        });
      }
    }
  });

  // Update load
  const newPrIds = load.prIds.filter((id) => id !== prId);
  const removedPR = prStore.pickupRequests.find((p) => p.id === prId);
  const removedQty = removedPR
    ? removedPR.materials.reduce((s, m) => s + m.plannedQty, 0)
    : 0;

  const patternLabel: 'direct' | 'milk_run' | 'warehouse_consolidation' =
    newPrIds.length <= 1 ? 'direct' : 'milk_run';

  loadStore.updateLoad(loadId, {
    prIds: newPrIds,
    totalPlannedQty: Math.max(0, load.totalPlannedQty - removedQty),
    patternLabel: load.patternLabel === 'warehouse_consolidation' ? 'warehouse_consolidation' : patternLabel,
  });

  // Update PR back to pending
  if (removedPR) {
    const newLoadIds = (removedPR.loadIds || []).filter((id) => id !== loadId);
    prStore.updatePR(prId, {
      loadIds: newLoadIds,
      status: newLoadIds.length === 0 ? 'pending' : removedPR.status,
    });
  }
}

/**
 * Change load destination.
 */
export function changeLoadDestination(loadId: string, destinationId: string): void {
  const loadStore = useLoadStore.getState();
  const stopStore = useStopStore.getState();
  const refStore = useReferenceStore.getState();

  const load = loadStore.getLoadById(loadId);
  if (!load) return;

  const destLoc = refStore.locations.find((l) => l.id === destinationId);
  if (!destLoc) return;

  const dest: Location & { type: 'plant' | 'warehouse' } = {
    name: destLoc.name,
    state: destLoc.state,
    city: destLoc.city,
    pin: destLoc.pin,
    address: destLoc.address,
    type: destLoc.type as 'plant' | 'warehouse',
  };

  loadStore.updateLoad(loadId, { destination: dest });

  // Update all DELIVER stops
  load.shipmentIds.forEach((shipId) => {
    const deliverStop = stopStore.stops.find(
      (s) => s.shipmentId === shipId && s.type === 'DELIVER',
    );
    if (deliverStop) {
      stopStore.updateStop(deliverStop.id, {
        location: {
          name: dest.name,
          state: dest.state,
          city: dest.city,
          pin: dest.pin,
          address: dest.address,
        },
      });
    }
  });
}
