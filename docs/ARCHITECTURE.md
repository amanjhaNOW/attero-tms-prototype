# Attero TMS — Architecture Decisions

## Core Architecture

### Two Layers

```
Load = WHAT (Business Layer)
  - Which PRs are we fulfilling
  - Documents, commercial value
  - The "operation" or "job"

Shipment = HOW (Execution Layer)
  - Which truck? (vehicle, driver)
  - Which route? (its OWN ordered stops)
  - The "trip"
```

### Data Model: PR → Load → Shipment → Stop

```
PR (demand signal)
  → Load (the operation — groups PRs, sets destination)
    → Shipment (a truck assigned to run a route)
      → Stop (an action at a location)
```

**Stops belong to Shipments.** Each shipment has its own ordered route.

---

## Route Architecture

### 4 Ways Routes Get Created

| # | Method | When | What Happens |
|---|---|---|---|
| 1 | **Auto-Generated** | Create Load | System creates: PICKUP per PR + DELIVER at destination |
| 2 | **Cloned** | + Add Shipment | New truck gets same route as first shipment |
| 3 | **Synced** | + Add PR (Load level) | PICKUP added to ALL synced shipments |
| 4 | **Manual** | Cross-Dock | User builds each shipment's route from scratch |

### The Sync Rule

**Auto-Sync (default):** When a shipment has ONLY standard stops (PICKUP + DELIVER), its route is auto-synced with other shipments.

**Independent (cross-dock):** When a shipment has ANY TRANSFER stop (TRANSFER_IN or TRANSFER_OUT), it exits auto-sync. Route is independently managed.

```typescript
function isShipmentSynced(shipment, stops) {
  const shipStops = stops.filter(s => s.shipmentId === shipment.id);
  const hasTransfer = shipStops.some(s => 
    s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT'
  );
  return !hasTransfer; // synced if NO transfer stops
}
```

### Two Entry Points for Adding Stops

| Entry Point | Scope | Behavior |
|---|---|---|
| `+ Add PR` (Load level) | ALL synced shipments | Adds pickup to every truck |
| `+ Add Stop` (Shipment edit panel) | THAT shipment only | Only that truck's route changes |

This allows routes to diverge without explicit "break sync" — user just adds a stop at the shipment level.

---

## Action Matrix

### Standard Loads (Auto-Sync)

| Action | What Happens |
|---|---|
| + Add PR | PICKUP added to ALL synced shipments |
| + Add Shipment | Route CLONED from first synced shipment |
| - Remove PR | PICKUP removed from ALL synced shipments |
| - Remove Shipment | Truck removed, other routes unchanged |
| Reorder Stops | Per-shipment (each truck can have different order) |
| Remove Stop from ONE ship | Only that shipment affected |
| Change Destination | DELIVER updated on ALL shipments |

### Cross-Dock (Independent)

| Action | What Happens |
|---|---|
| + Add PR | User CHOOSES which feeder gets the pickup |
| + Add Feeder | Empty route — user builds (PICKUP + TRANSFER_OUT) |
| + Add Line-Haul | Empty route — user builds (TRANSFER_IN + DELIVER) |
| Link Feeder → Line-Haul | TRANSFER_OUT ↔ TRANSFER_IN paired |
| Transfer Location | TBD at planning, filled at execution (driver coordination) |

---

## Pattern Auto-Detection

```typescript
function detectPattern(load, shipments, stops) {
  const hasTransfer = stops.some(s => 
    s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT'
  );
  
  if (hasTransfer) return 'cross_dock';
  
  if (load.destination.type === 'warehouse') return 'warehouse_consolidation';
  if (hasWarehouseSource(load)) return 'warehouse_consolidation';
  
  const prCount = load.prIds.length;
  const shipCount = shipments.length;
  
  if (prCount === 1 && shipCount === 1) return 'direct';
  if (prCount >= 2 && shipCount === 1) return 'milk_run';
  if (shipCount >= 2) return 'multi_vehicle';
}
```

---

## Stop Types

| Type | What Happens | Location Known At |
|---|---|---|
| PICKUP | Material goes INTO truck from client/warehouse | Planning ✅ |
| DELIVER | Material goes OUT at destination (plant/warehouse) | Planning ✅ |
| TRANSFER_OUT | Material handed to another truck | Execution (TBD at planning) |
| TRANSFER_IN | Material received from another truck | Auto-fills from linked TRANSFER_OUT |

---

## Key Design Decisions

### 1. Shipment = Trip (relabel)
Users think in "shipments." Internally it's a Trip. Zero retraining.

### 2. 8 Shipment States → 4
Draft (fill any order) → Planned → In Transit → Completed (+ Cancelled)

### 3. Material Line Items = Arrays
`planned_items[]` + `actual_items[]` on stops. Actual can differ completely from planned.

### 4. No Qty Split at Planning
Multi-vehicle: each truck shows full material list. Actual qty at pickup.

### 5. Warehouse Dashboard = PR-Level
Not shipment-level. A milk run to warehouse = 3 PR rows.

### 6. Deliver at Warehouse ≠ Close PR
PR stays "picked_up." Only plant delivery closes PRs.

### 7. Mixed Sources (Clients + Warehouse)
One load can have PICKUP stops at client locations AND warehouse locations.

### 8. Natural Evolution
Loads can evolve: Direct → Milk Run → Multi-Vehicle → Cross-Dock without mode switches. Just add/remove stops.

---

## Files Reference

| File | Purpose |
|---|---|
| `src/types/index.ts` | All TypeScript interfaces |
| `src/stores/useCascadeEngine.ts` | State machine + cascade logic |
| `src/lib/createLoadHelper.ts` | Load creation utilities |
| `src/components/flow/FlowLayout.ts` | Flow diagram layout engine |
| `src/components/flow/FlowDiagram.tsx` | Visual flow diagram |
| `src/components/flow/ShipmentExpandPanel.tsx` | Inline shipment edit |
| `src/components/PRPickerModal.tsx` | PR selection popup |
| `src/components/WarehousePickerModal.tsx` | Warehouse material picker |
| `docs/Route-Architecture.pdf` | Detailed route architecture document |
| `docs/Simplified-Load-Model.pdf` | Load = Route simplification analysis |
