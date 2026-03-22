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
    });
  }

  if (sh) {
    edges.push({
      id: `edge-ship-${sh.id}-dest`,
      fromNodeId: `shipment-${sh.id}`,
      toNodeId: 'destination',
      status: edgeStatus(sh),
    });
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
        });
      }
    });
  });

  // Each shipment → destination
  shipments.forEach((sh) => {
    edges.push({
      id: `edge-ship-${sh.id}-dest`,
      fromNodeId: `shipment-${sh.id}`,
      toNodeId: 'destination',
      status: edgeStatus(sh),
    });
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
      });
    }
    edges.push({
      id: `edge-ship-${sh.id}-dest`,
      fromNodeId: `shipment-${sh.id}`,
      toNodeId: 'destination',
      status: edgeStatus(sh),
    });
  });

  return { nodes, edges, columns: 3, maxRows: Math.max(shipCount, 1) };
}

/**
 * Cross-Dock: [sources] → [feeders] → [hub] → [line-haul] → [destination] (5 cols)
 */
function layoutCrossDock(
  load: Load,
  shipments: Shipment[],
  stops: Stop[],
  prs: PickupRequest[],
): FlowLayoutResult {
  const nodes: FlowNodeData[] = [];
  const edges: FlowEdgeData[] = [];

  // Separate feeders from line-haul
  const feeders = shipments.filter((sh) => sh.parentShipmentId);
  const lineHauls = shipments.filter((sh) => !sh.parentShipmentId);
  const lineHaul = lineHauls[0];

  const feederCount = feeders.length || 1;
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
  feeders.forEach((sh, idx) => {
    nodes.push({
      id: `shipment-${sh.id}`,
      type: 'shipment',
      col: 2,
      row: idx + 1,
      data: { shipment: sh, stops: stops.filter((s) => s.shipmentId === sh.id), role: 'feeder' },
    });
  });

  // Hub (col 3) — transfer point
  nodes.push({
    id: 'hub',
    type: 'hub',
    col: 3,
    row: midRow,
    data: { location: load.destination, label: 'Transfer Point' },
  });

  // Line-haul (col 4)
  if (lineHaul) {
    nodes.push({
      id: `shipment-${lineHaul.id}`,
      type: 'shipment',
      col: 4,
      row: midRow,
      data: {
        shipment: lineHaul,
        stops: stops.filter((s) => s.shipmentId === lineHaul.id),
        role: 'line-haul',
      },
    });
  }

  // Destination (col 5)
  nodes.push({
    id: 'destination',
    type: 'destination',
    col: 5,
    row: midRow,
    data: { destination: load.destination },
  });

  // Edges: source → feeder (match by PR)
  prs.forEach((pr) => {
    const feeder = feeders.find((f) => {
      const fStops = stops.filter((s) => s.shipmentId === f.id && s.type === 'PICKUP');
      return fStops.some((s) => s.prId === pr.id);
    });
    if (feeder) {
      edges.push({
        id: `edge-source-${pr.id}-ship-${feeder.id}`,
        fromNodeId: `source-${pr.id}`,
        toNodeId: `shipment-${feeder.id}`,
        status: edgeStatus(feeder),
      });
    }
  });

  // Edges: feeder → hub
  feeders.forEach((f) => {
    edges.push({
      id: `edge-ship-${f.id}-hub`,
      fromNodeId: `shipment-${f.id}`,
      toNodeId: 'hub',
      status: edgeStatus(f),
    });
  });

  // Edge: hub → line-haul
  if (lineHaul) {
    edges.push({
      id: `edge-hub-ship-${lineHaul.id}`,
      fromNodeId: 'hub',
      toNodeId: `shipment-${lineHaul.id}`,
      status: edgeStatus(lineHaul),
    });

    // Edge: line-haul → destination
    edges.push({
      id: `edge-ship-${lineHaul.id}-dest`,
      fromNodeId: `shipment-${lineHaul.id}`,
      toNodeId: 'destination',
      status: edgeStatus(lineHaul),
    });
  }

  return { nodes, edges, columns: 5, maxRows: maxLeftRows };
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
  switch (load.patternLabel) {
    case 'direct':
      return layoutDirect(load, shipments, stops, prs);

    case 'milk_run':
      return layoutMilkRun(load, shipments, stops, prs);

    case 'warehouse_consolidation':
      return layoutMilkRun(load, shipments, stops, prs);

    case 'multi_vehicle':
      return layoutMultiVehicle(load, shipments, stops, prs);

    case 'cross_dock':
    case 'cross_dock_milk_run':
      return layoutCrossDock(load, shipments, stops, prs);

    default:
      return layoutDirect(load, shipments, stops, prs);
  }
}
