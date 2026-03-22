# Load Workspace — Complete Audit & Fix Plan

## Date: 2026-03-23 (2:30 AM IST)

## Files Audited (4,512 lines total)
- `src/stores/useCascadeEngine.ts` — 885 lines
- `src/lib/createLoadHelper.ts` — 731 lines
- `src/components/flow/FlowLayout.ts` — 522 lines
- `src/components/flow/FlowDiagram.tsx` — 489 lines
- `src/components/flow/FlowNode.tsx` — 405 lines
- `src/components/flow/FlowEdge.tsx` — 217 lines
- `src/components/flow/ShipmentExpandPanel.tsx` — 738 lines
- `src/pages/LoadWorkspace.tsx` — 525 lines

---

## BUG 1: ID Generation Collisions
**File:** `useCascadeEngine.ts` lines 321, 326, 688, 778
**Code:** `const shipNum = allShipments.length + 1` and `const stopCounter = stopStore.stops.length + 1`
**Problem:** Uses array length for ID generation. If items are deleted and re-added, IDs collide. Also, concurrent operations may use same counter value.
**Fix:** Use UUID or crypto.randomUUID() or timestamp-based IDs: `SHP-${Date.now()}-${Math.random().toString(36).slice(2,6)}`

## BUG 2: Pattern Detection Only Checks prIds.length === 1
**File:** `useCascadeEngine.ts` line 441
**Code:**
```javascript
const newPattern = load.prIds.length === 1 && newShipmentCount >= 2
  ? ('multi_vehicle' as const)
  : load.patternLabel;
```
**Problem:** 2 PRs + 2 trucks stays as `milk_run` because `prIds.length` is 2. Should be `multi_vehicle` or `milk_run_multi_vehicle`.
**Fix:** Full pattern detection matrix:
```javascript
function detectPattern(prCount, shipCount, hasTransfers) {
  if (hasTransfers) return 'cross_dock';
  if (prCount === 1 && shipCount === 1) return 'direct';
  if (prCount >= 2 && shipCount === 1) return 'milk_run';
  if (prCount === 1 && shipCount >= 2) return 'multi_vehicle';
  if (prCount >= 2 && shipCount >= 2) return 'multi_vehicle'; // or 'milk_run_multi_vehicle'
}
```

## BUG 3: Destination Card Clipped (CSS)
**File:** `FlowDiagram.tsx` — grid-template-columns
**Problem:** Right column `minmax(160px, 200px)` too narrow for "Attero Recycling Pvt Ltd Haridwar"
**Fix:** Increase to `minmax(180px, 250px)` or use `overflow-visible` on the grid container.

## BUG 4: Ship→Destination Arrow Missing
**File:** `FlowLayout.ts` — edge IS generated (line 109-120) but `FlowEdge.tsx` can't render because destination card's bounding rect returns zero due to clipping.
**Root cause:** Cascading from Bug 3. Fix the CSS → arrow renders.
**Secondary:** `FlowEdge.tsx` should handle zero-size rects gracefully (skip edge rendering instead of drawing to 0,0).

## BUG 5: Connection Ports Invisible
**File:** `FlowNode.tsx` — ConnectionPort component
**Problem:** Ports render as buttons with text "Connect from here" but are styled with very small size or opacity transitions that make them invisible on screenshots and mobile.
**Fix:** Always-visible small circles (8-10px) on card edges with color indicators. Not hover-dependent.

## BUG 6: No Delete Button on Shipment Cards
**File:** `FlowNode.tsx` — ShipmentCard component
**Problem:** `onDeleteShipment` prop exists but delete button may not render or is hover-only.
**Fix:** Visible ✕ button (top-right, small) on shipment cards. Only for draft status.

## BUG 7: Shipment Card Shows Stale Pattern Label
**File:** `FlowNode.tsx` — ShipmentCard
**Problem:** Card shows "Direct" even after load pattern changed to "Milk Run". The card reads from shipment data, not from load's current patternLabel.
**Fix:** Don't show pattern on individual shipment cards. OR pass load's patternLabel to all cards.

## BUG 8: Add PR Sync — createLoadHelper.ts
**File:** `createLoadHelper.ts` — `addPRsToLoad()` function
**Status:** Code was updated to sync to all synced shipments. Needs verification.
**Potential issue:** The function may not be called correctly from the workspace, or the synced shipment check may fail.

## BUG 9: Material Qty Through Handover
**File:** `useCascadeEngine.ts` — `addStopToShipment()` TRANSFER branch (line 609+)
**Status:** Aggregation code was added. Needs verification that it actually runs and produces correct values.
**Potential issue:** The aggregation happens at creation time but if pickups are modified later, the transfer qty doesn't update.

## BUG 10: FlowLayout Edge Rendering for Milk Run + Multi-Vehicle
**File:** `FlowLayout.ts` — `layoutMilkRun()` and `computeFlowLayout()`
**Problem:** When pattern is `milk_run` but there are 2 shipments, `layoutMilkRun` handles it but the edge generation only draws source→ship edges where `stops.find(s.prId === pr.id)` matches. If the cloned shipment's stops have the correct prIds, this should work.
**Root cause hypothesis:** The clone might work but the pattern stays `milk_run` → correct layout used → BUT the edge generation correctly filters by prId → should show all connections. Need to verify if the stops actually exist with correct prIds.

## BUG 11: Arrow Disconnect ✕ Not Working
**File:** `FlowEdge.tsx` — hover state + disconnect handler
**Status:** Code was added for hover ✕. But since Ship→Dest arrow doesn't render (Bug 4), can't test its disconnect.
**Fix:** Fix Bug 3/4 first, then verify disconnect works.

## BUG 12: No Warning for Unconnected PRs
**File:** `LoadWorkspace.tsx`
**Status:** Code was added to detect unconnected PRs. Needs verification.

---

## PRIORITY FIX ORDER

### P0: Critical (breaks core functionality)
1. **ID Generation** → UUID
2. **Pattern Detection** → full matrix
3. **Destination Card CSS** → increase width → fixes arrow rendering

### P1: Important (features don't work correctly)
4. **Connection Ports** → always visible
5. **Shipment Delete Button** → always visible on draft
6. **Shipment Card Pattern** → remove stale label or use load's

### P2: Verification (code exists but may not work)
7. **Add PR Sync** → test manually
8. **Material Qty Handover** → test manually
9. **Arrow Disconnect** → test after P0 fixes
10. **Unconnected PR Warning** → test after P0 fixes

---

## REBUILD SPEC — What to Rewrite

### 1. ID Generation Utility (`src/lib/idGenerator.ts`) — NEW FILE
```typescript
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
// Usage: generateId('SHP') → 'SHP-m1abc2-x7f3'
// Usage: generateId('STOP') → 'STOP-m1abc3-y8g4'
// Usage: generateId('LOAD') → 'LOAD-m1abc4-z9h5'
```
Replace ALL `store.length + 1` ID generation with this.

### 2. Pattern Detection Function — REWRITE
```typescript
export function detectPattern(load: Load, shipments: Shipment[], stops: Stop[]): Load['patternLabel'] {
  const hasTransfer = stops.some(s => 
    shipments.some(sh => sh.loadId === load.id && sh.id === s.shipmentId) &&
    (s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT')
  );
  if (hasTransfer) return 'cross_dock';
  
  const hasWarehouseDest = load.destination.type === 'warehouse';
  if (hasWarehouseDest) return 'warehouse_consolidation';
  
  const prCount = load.prIds.length;
  const shipCount = shipments.filter(s => s.loadId === load.id).length;
  
  if (prCount <= 1 && shipCount <= 1) return 'direct';
  if (prCount >= 2 && shipCount <= 1) return 'milk_run';
  return 'multi_vehicle'; // covers 1PR+2ships AND 2PRs+2ships
}
```
Call this EVERY time load/shipments/stops change. Not just in addShipmentToLoad.

### 3. FlowDiagram CSS Fix
```css
/* Increase destination column width */
grid-template-columns: minmax(180px, 1fr) minmax(200px, 1fr) minmax(180px, 250px);

/* Ensure overflow visible for arrow calculation */
.flow-grid { overflow: visible; }
```

### 4. FlowEdge Graceful Handling
```typescript
// In FlowEdge, skip rendering if bounding rects are zero
if (fromRect.width === 0 || toRect.width === 0) return null;
```

### 5. Connection Ports — Always Visible
```typescript
// In FlowNode, ports are small colored circles, always visible
<div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
  <button className="w-3 h-3 rounded-full bg-primary-100 border-2 border-primary-300 hover:bg-primary hover:border-primary transition-colors" />
</div>
```

### 6. Shipment Card — Remove Pattern Label, Add Delete
- Remove the "Direct" / "Milk Run" badge from individual shipment cards
- Show only on the info bar (which reads from load)
- Add always-visible ✕ for draft shipments (not hover-dependent)
