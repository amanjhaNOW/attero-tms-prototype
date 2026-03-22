/**
 * FlowLayout — Pure computation engine for the visual flow diagram.
 * Takes load/shipment/stop/PR data and returns positioned nodes + edges.
 */
import type { Load, Shipment, Stop, PickupRequest } from '@/types';

export interface FlowNodeData {
  id: string;
  type: 'source' | 'shipment' | 'hub' | 'destination';
  col: number;
  row: number;
  data: Record<string, unknown>;
}

export interface FlowEdgeData {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  status: 'pending' | 'active' | 'completed';
  /** The stop ID that this edge represents (for disconnect) */
  stopId?: string;
  /** The PR ID linked to this edge (for source→shipment edges) */
  prId?: string;
  /** Shipment ID that owns the stop */
  shipmentId?: string;
  /** Type of stop this edge represents */
  stopType?: 'PICKUP' | 'DELIVER' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  /** Whether this edge represents a transfer (ship→ship handover) */
  isTransfer?: boolean;
  /** Transfer location name (from TRANSFER_OUT stop) for display on arrow */
  transferLocation?: string;
}

export interface FlowLayoutResult {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  columns: number;
  maxRows: number;
}

function edgeStatus(shipment: Shipment): 'pending' | 'active' | 'completed' {
  if (shipment.status === 'completed') return 'completed';
  if (shipment.status === 'in_transit') return 'active';
  return 'pending';
}

/**
 * Direct pattern: 1 source → 1 shipment → 1 destination (3 cols)
 */
function layoutDirect(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];
  const sh = shipments[0];
  const pr = prs[0];

  if (pr) {
    nodes.push({
      id: `source-${pr.id}`,
      type: 'source',
      col: 1,
      row: 1,
      data: { pr },
    });
  }

  if (sh) {
    nodes.push({
      id: `shipment-${sh.id}`,
      type: 'shipment',
      col: 2,
      row: 1,
      data: { shipment: sh, stops: stops.filter((s) => s.shipmentId === sh.id) },
    });
  }

  nodes.push({
    id: 'destination',
    type: 'destination',
    col: 3,
    row: 1,
    data: { destination: load.destination },
  });

  if (pr && sh) {
    const pickupStop = stops.find((s) => s.shipmentId === sh.id && s.type === 'PICKUP' && s.prId === pr.id);
    const qty = pickupStop
      ? pickupStop.plannedItems.reduce((s, i) => s + i.qty, 0)
      : pr.materials.reduce((s, m) => s + m.plannedQty, 0);
    edges.push({
      id: `edge-source-${pr.id}-ship-${sh.id}`,
      fromNodeId: `source-${pr.id}`,
      toNodeId: `shipment-${sh.id}`,
      label: `${(qty / 1000).toFixed(1)}T`,
      status: edgeStatus(sh),
      stopId: pickupStop?.id,
      prId: pr.id,
      shipmentId: sh.id,
      stopType: 'PICKUP',
    });
  }

  if (sh) {
    const deliverStop = stops.find((s) => s.shipmentId === sh.id && s.type === 'DELIVER');
    if (deliverStop) {
      edges.push({
        id: `edge-ship-${sh.id}-dest`,
        fromNodeId: `shipment-${sh.id}`,
        toNodeId: 'destination',
        status: edgeStatus(sh),
        stopId: deliverStop.id,
        shipmentId: sh.id,
        stopType: 'DELIVER',
      });
    }
  }

  return { nodes, edges, columns: 3, maxRows: 1 };
}

/**
 * Milk Run / Warehouse Consolidation: N sources stacked → M shipments stacked → 1 destination (3 cols)
 * When there's only 1 shipment, shipment is centered. With multiple shipments, they stack vertically.
 */
function layoutMilkRun(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];
  const sourceCount = prs.length || 1;
  const shipCount = shipments.length || 1;
  const maxRows = Math.max(sourceCount, shipCount);

  // Source nodes stacked vertically
  prs.forEach((pr, idx) => {
    nodes.push({
      id: `source-${pr.id}`,
      type: 'source',
      col: 1,
      row: idx + 1,
      data: { pr },
    });
  });

  // Shipment nodes — stacked if multiple, centered if single
  shipments.forEach((sh, idx) => {
    const shipRow = shipments.length === 1 ? Math.ceil(sourceCount / 2) : idx + 1;
    nodes.push({
      id: `shipment-${sh.id}`,
      type: 'shipment',
      col: 2,
      row: shipRow,
      data: { shipment: sh, stops: stops.filter((s) => s.shipmentId === sh.id) },
    });
  });

  // Destination node centered
  const destRow = Math.ceil(maxRows / 2);
  nodes.push({
    id: 'destination',
    type: 'destination',
    col: 3,
    row: destRow,
    data: { destination: load.destination },
  });

  // Edges: each source → each shipment that has a PICKUP for that PR
  prs.forEach((pr) => {
    shipments.forEach((sh) => {
      const pickupStop = stops.find(
        (s) => s.shipmentId === sh.id && s.type === 'PICKUP' && s.prId === pr.id,
      );
      if (pickupStop) {
        const qty = pickupStop.plannedItems.reduce((s, i) => s + i.qty, 0);
        edges.push({
          id: `edge-source-${pr.id}-ship-${sh.id}`,
          fromNodeId: `source-${pr.id}`,
          toNodeId: `shipment-${sh.id}`,
          label: `${(qty / 1000).toFixed(1)}T`,
          status: edgeStatus(sh),
          stopId: pickupStop.id,
          prId: pr.id,
          shipmentId: sh.id,
          stopType: 'PICKUP',
        });
      }
    });
  });

  // Each shipment → destination
  shipments.forEach((sh) => {
    const deliverStop = stops.find((s) => s.shipmentId === sh.id && s.type === 'DELIVER');
    if (deliverStop) {
      edges.push({
        id: `edge-ship-${sh.id}-dest`,
        fromNodeId: `shipment-${sh.id}`,
        toNodeId: 'destination',
        status: edgeStatus(sh),
        stopId: deliverStop.id,
        shipmentId: sh.id,
        stopType: 'DELIVER',
      });
    }
  });

  return { nodes, edges, columns: 3, maxRows: Math.max(maxRows, 1) };
}

/**
 * Multi-Vehicle: 1 source → N shipments stacked → 1 destination (3 cols)
 */
function layoutMultiVehicle(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];
  const pr = prs[0];
  const shipCount = shipments.length || 1;
  const sourceRow = Math.ceil(shipCount / 2);

  // Source node centered
  if (pr) {
    nodes.push({
      id: `source-${pr.id}`,
      type: 'source',
      col: 1,
      row: sourceRow,
      data: { pr },
    });
  }

  // Shipment nodes stacked
  shipments.forEach((sh, idx) => {
    nodes.push({
      id: `shipment-${sh.id}`,
      type: 'shipment',
      col: 2,
      row: idx + 1,
      data: { shipment: sh, stops: stops.filter((s) => s.shipmentId === sh.id) },
    });
  });

  // Destination centered
  nodes.push({
    id: 'destination',
    type: 'destination',
    col: 3,
    row: sourceRow,
    data: { destination: load.destination },
  });

  // Edges: source → each shipment, each shipment → destination
  shipments.forEach((sh) => {
    if (pr) {
      const pickupStop = stops.find((s) => s.shipmentId === sh.id && s.type === 'PICKUP');
      const qty = pickupStop
        ? pickupStop.plannedItems.reduce((s, i) => s + i.qty, 0)
        : 0;
      edges.push({
        id: `edge-source-${pr.id}-ship-${sh.id}`,
        fromNodeId: `source-${pr.id}`,
        toNodeId: `shipment-${sh.id}`,
        label: qty > 0 ? `${(qty / 1000).toFixed(1)}T` : undefined,
        status: edgeStatus(sh),
        stopId: pickupStop?.id,
        prId: pr.id,
        shipmentId: sh.id,
        stopType: 'PICKUP',
      });
    }
    const deliverStop = stops.find((s) => s.shipmentId === sh.id && s.type === 'DELIVER');
    if (deliverStop) {
      edges.push({
        id: `edge-ship-${sh.id}-dest`,
        fromNodeId: `shipment-${sh.id}`,
        toNodeId: 'destination',
        status: edgeStatus(sh),
        stopId: deliverStop.id,
        shipmentId: sh.id,
        stopType: 'DELIVER',
      });
    }
  });

  return { nodes, edges, columns: 3, maxRows: Math.max(shipCount, 1) };
}

/**
 * Cross-Dock: [sources] → [feeders] → [line-haul] → [destination] (4 cols)
 * Each feeder→line-haul connection = 1 TRANSFER_OUT + 1 TRANSFER_IN (1:1 pair).
 * Transfer edges go directly feeder→line-haul (no hub node needed).
 */
function layoutCrossDock(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];

  // Separate feeders from line-haul based on STOP TYPES (not parentShipmentId)
  // Feeder = has TRANSFER_OUT stops (hands material to another truck)
  // Line-Haul = has TRANSFER_IN stops (receives material from feeders)
  // If a ship has both, it's a relay — treat as line-haul
  const feeders = shipments.filter((sh) => {
    const shipStops = stops.filter((s) => s.shipmentId === sh.id);
    const hasTransferOut = shipStops.some((s) => s.type === 'TRANSFER_OUT');
    const hasTransferIn = shipStops.some((s) => s.type === 'TRANSFER_IN');
    return hasTransferOut && !hasTransferIn;
  });
  const lineHauls = shipments.filter((sh) => {
    const shipStops = stops.filter((s) => s.shipmentId === sh.id);
    const hasTransferIn = shipStops.some((s) => s.type === 'TRANSFER_IN');
    return hasTransferIn;
  });
  // Ships with neither transfer type — treat as feeders if they have pickups, else skip
  const unclassified = shipments.filter((sh) => !feeders.includes(sh) && !lineHauls.includes(sh));
  const allFeeders = [...feeders, ...unclassified.filter((sh) => {
    const shipStops = stops.filter((s) => s.shipmentId === sh.id);
    return shipStops.some((s) => s.type === 'PICKUP');
  })];
  const lineHaul = lineHauls[0];

  const feederCount = allFeeders.length || 1;
  const sourceCount = prs.length || 1;
  const maxLeftRows = Math.max(sourceCount, feederCount);
  const midRow = Math.ceil(maxLeftRows / 2);

  // Sources (col 1)
  prs.forEach((pr, idx) => {
    nodes.push({
      id: `source-${pr.id}`,
      type: 'source',
      col: 1,
      row: idx + 1,
      data: { pr },
    });
  });

  // Feeders (col 2)
  allFeeders.forEach((sh, idx) => {
    nodes.push({
      id: `shipment-${sh.id}`,
      type: 'shipment',
      col: 2,
      row: idx + 1,
      data: { shipment: sh, stops: stops.filter((s) => s.shipmentId === sh.id), role: 'feeder' },
    });
  });

  // Line-haul (col 3)
  if (lineHaul) {
    nodes.push({
      id: `shipment-${lineHaul.id}`,
      type: 'shipment',
      col: 3,
      row: midRow,
      data: {
        shipment: lineHaul,
        stops: stops.filter((s) => s.shipmentId === lineHaul.id),
        role: 'line-haul',
      },
    });
  }

  // Destination (col 4)
  nodes.push({
    id: 'destination',
    type: 'destination',
    col: 4,
    row: midRow,
    data: { destination: load.destination },
  });

  // Edges: source → any shipment that has a PICKUP for this PR (feeders AND line-haul)
  prs.forEach((pr) => {
    const allShips = [...allFeeders, ...(lineHaul ? [lineHaul] : [])];
    allShips.forEach((sh) => {
      const pickupStop = stops.find(
        (s) => s.shipmentId === sh.id && s.type === 'PICKUP' && s.prId === pr.id,
      );
      if (pickupStop) {
        const qty = pickupStop.plannedItems.reduce((sum, i) => sum + i.qty, 0);
        edges.push({
          id: `edge-source-${pr.id}-ship-${sh.id}`,
          fromNodeId: `source-${pr.id}`,
          toNodeId: `shipment-${sh.id}`,
          label: `${(qty / 1000).toFixed(1)}T`,
          status: edgeStatus(sh),
          stopId: pickupStop.id,
          prId: pr.id,
          shipmentId: sh.id,
          stopType: 'PICKUP',
        });
      }
    });
  });

  // Edges: each feeder → line-haul (1:1 TRANSFER_OUT → TRANSFER_IN pairs)
  allFeeders.forEach((f) => {
    // Find all TRANSFER_OUT stops on this feeder
    const transferOutStops = stops.filter(
      (s) => s.shipmentId === f.id && s.type === 'TRANSFER_OUT',
    );

    transferOutStops.forEach((outStop) => {
      if (lineHaul) {
        const transferLoc = outStop.location.name || '';
        const transferQty = outStop.plannedItems.reduce((sum, item) => sum + item.qty, 0);
        edges.push({
          id: `edge-ship-${f.id}-to-${lineHaul.id}-${outStop.id}`,
          fromNodeId: `shipment-${f.id}`,
          toNodeId: `shipment-${lineHaul.id}`,
          label: transferQty > 0 ? `${(transferQty / 1000).toFixed(1)}T` : undefined,
          status: edgeStatus(f),
          stopId: outStop.id,
          shipmentId: f.id,
          stopType: 'TRANSFER_OUT',
          isTransfer: true,
          transferLocation: transferLoc || undefined,
        });
      }
    });
  });

  // Edge: line-haul → destination
  if (lineHaul) {
    const deliverStop = stops.find(
      (s) => s.shipmentId === lineHaul.id && s.type === 'DELIVER',
    );
    edges.push({
      id: `edge-ship-${lineHaul.id}-dest`,
      fromNodeId: `shipment-${lineHaul.id}`,
      toNodeId: 'destination',
      status: edgeStatus(lineHaul),
      stopId: deliverStop?.id,
      shipmentId: lineHaul.id,
      stopType: 'DELIVER',
    });
  }

  return { nodes, edges, columns: 4, maxRows: maxLeftRows };
}

/**
 * Post-process: add transfer edges for any TRANSFER_OUT stops not already covered by layout.
 * This ensures ship→ship handover arrows appear even in non-cross-dock patterns.
 */
function addMissingTransferEdges(
  result: FlowLayoutResult,
  shipments: Shipment[],
  stops: Stop[],
): FlowLayoutResult {
  const existingTransferEdgeStopIds = new Set(
    result.edges.filter((e) => e.isTransfer).map((e) => e.stopId),
  );

  stops
    .filter((s) => s.type === 'TRANSFER_OUT' && !existingTransferEdgeStopIds.has(s.id))
    .forEach((outStop) => {
      if (!outStop.linkedStopId) return;
      const inStop = stops.find((s) => s.id === outStop.linkedStopId);
      if (!inStop) return;

      const sourceShipment = shipments.find((sh) => sh.id === outStop.shipmentId);
      const targetShipment = shipments.find((sh) => sh.id === inStop.shipmentId);
      if (!sourceShipment || !targetShipment) return;

      const fromNodeId = `shipment-${sourceShipment.id}`;
      const toNodeId = `shipment-${targetShipment.id}`;

      // Only add if both nodes exist in the layout
      if (!result.nodes.some((n) => n.id === fromNodeId) || !result.nodes.some((n) => n.id === toNodeId)) return;

      const transferLoc = outStop.location.name || '';
      const transferQty = outStop.plannedItems.reduce((sum, item) => sum + item.qty, 0);

      result.edges.push({
        id: `edge-ship-${sourceShipment.id}-to-${targetShipment.id}-${outStop.id}`,
        fromNodeId,
        toNodeId,
        label: transferQty > 0 ? `${(transferQty / 1000).toFixed(1)}T` : undefined,
        status: edgeStatus(sourceShipment),
        stopId: outStop.id,
        shipmentId: sourceShipment.id,
        stopType: 'TRANSFER_OUT',
        isTransfer: true,
        transferLocation: transferLoc || undefined,
      });
    });

  return result;
}

/**
 * Main entry point: compute the flow layout based on load pattern.
 */
export function computeFlowLayout(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  let result: FlowLayoutResult;

  switch (load.patternLabel) {
    case 'direct':
      result = layoutDirect(load, shipments, stops, prs);
      break;

    case 'milk_run':
      result = layoutMilkRun(load, shipments, stops, prs);
      break;

    case 'warehouse_consolidation':
      result = layoutMilkRun(load, shipments, stops, prs);
      break;

    case 'multi_vehicle':
      result = layoutMultiVehicle(load, shipments, stops, prs);
      break;

    case 'cross_dock':
    case 'cross_dock_milk_run':
      result = layoutCrossDock(load, shipments, stops, prs);
      break;

    default:
      result = layoutDirect(load, shipments, stops, prs);
      break;
  }

  // Add any transfer edges not already produced by the pattern-specific layout
  return addMissingTransferEdges(result, shipments, stops);
}
