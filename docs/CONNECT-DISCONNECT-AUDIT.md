# Connect / Disconnect — Full Gap Analysis

## Date: 2026-03-23 (2:53 AM IST)

---

## CONNECTION TYPES & STATUS

### 1. Source (PR) → Shipment = PICKUP stop

**CONNECT:**
- Code: `addStopToShipment(targetShipment.id, 'PICKUP', prId)` ✅
- Duplicate check: yes (checks if PICKUP with same prId already exists) ✅
- Creates PICKUP stop with PR's materials as plannedItems ✅
- Inserts before DELIVER stop (bumps sequence) ✅

**DISCONNECT (click ✕ on arrow):**
- Code: `removeStopFromShipment(stop.id)` ✅
- Deletes the PICKUP stop ✅
- Re-sequences remaining stops ✅
- Updates shipment.stopIds ✅

**GAPS:**
- ❌ After disconnect, the arrow disappears but the source card still shows in the sources column (it's part of load.prIds). PR stays "planned" even with no pickup on any shipment. Should show warning "⚠ Unconnected" on the source card.
- ❌ Qty label on arrow: uses plannedItems from the stop. If PR materials change, the arrow label is stale. (Edge case, minor)

### 2. Shipment → Destination = DELIVER stop

**CONNECT:**
- Code: `addStopToShipment(sourceShipmentId, 'DELIVER')` ✅
- Duplicate check: yes (checks if DELIVER already exists) ✅
- Sets location from load.destination ✅
- Aggregates plannedItems from all PICKUP stops on this shipment ✅

**DISCONNECT (click ✕ on arrow):**
- Code: `removeStopFromShipment(stop.id)` ✅
- Edge only renders when deliverStop exists (fixed in latest commit) ✅

**GAPS:**
- ❌ After disconnect, shipment has no delivery destination. No visual indicator that "this truck has nowhere to go." Should show "⚠ No destination" on the shipment card.
- ❌ Can user reconnect after disconnect? Yes — click shipment output port → click destination. But the UX hint for this is unclear.

### 3. Shipment → Shipment = TRANSFER_OUT + TRANSFER_IN (Handover)

**CONNECT:**
- Code: `addStopToShipment(sourceShipmentId, 'TRANSFER_OUT', undefined, targetShipmentId)` ✅
- Creates TRANSFER_OUT on source + TRANSFER_IN on target ✅
- linkedStopId set on both (1:1 pair) ✅
- Aggregates material qty from source's PICKUP stops ✅
- Auto-removes source's DELIVER stop via `autoRemoveFeederDeliver()` ✅

**DISCONNECT (click ✕ on handover arrow):**
- Code: handles TRANSFER pairs — removes both TRANSFER_OUT and TRANSFER_IN ✅

**GAPS:**
- ❌ After disconnecting handover, the feeder's DELIVER is NOT auto-restored. Feeder has: PICKUP only (no deliver, no handover). User must manually reconnect to destination. This is BY DESIGN but confusing — no visual hint that "this truck has no destination now."
- ❌ If user connects Feeder → Line-Haul, then disconnects, then reconnects — creates new TRANSFER pair with new IDs. Old IDs orphaned? Should verify cleanup is complete.
- ❌ `autoRemoveFeederDeliver` only runs on FIRST handover. If user has 2 handovers and removes one, the DELIVER is still gone. Edge case but could confuse.

### 4. Source (Warehouse) → Shipment = PICKUP stop at warehouse

**CONNECT:**
- Same as PR→Shipment but pickup location is the warehouse ✅
- Uses `addStopToShipment(shipmentId, 'PICKUP', prId)` where prId references the warehouse PR ✅

**DISCONNECT:**
- Same as PR disconnect ✅

**GAPS:**
- ❌ Warehouse source cards don't show the 🏭 icon distinction — they look like PR cards

---

## VISUAL ISSUES

### 5. Arrow ✕ Button Click Area
**Problem:** The SVG ✕ button is small (10px radius circle). On touch devices / fast mouse movements, the hover can exit before the click registers.
**Impact:** User sees ✕ but clicking doesn't work reliably.
**Fix:** Increase ✕ button size to 14px radius. Add a larger invisible hit area around it.

### 6. Connection Ports Positioning
**Problem:** Ports are positioned at card edges using absolute positioning. When cards have different heights (more materials = taller card), ports may not align horizontally with the arrows.
**Fix:** Ports should always be vertically centered on the card, which they are. But arrow endpoints should target the port position, not card center. Currently FlowEdge uses card bounding rect center, which may differ from port position.

### 7. Arrow Label Overlap
**Problem:** When multiple arrows converge on one shipment card, labels ("6.2T", "4.0T") can overlap each other.
**Fix:** Offset labels vertically when multiple edges target the same node.

### 8. No Visual Feedback on Successful Connect
**Problem:** When user clicks source port → clicks shipment port, the arrow appears but there's no feedback (toast, flash, sound). User isn't sure if it worked.
**Fix:** Brief green flash on the newly created arrow. Or a subtle toast "Connected Daikin → SHP-001".

---

## STATE MANAGEMENT ISSUES

### 9. Re-render After Connect/Disconnect
**Problem:** After `addStopToShipment` or `removeStopFromShipment` mutates the Zustand store, the FlowDiagram should re-render with updated layout. This depends on the component subscribing to the right store slices.
**Status:** The workspace uses `useMemo` with dependencies on `allStops`, `shipments`, `allLoads`. Should trigger re-render. But `layoutVersion` (used for edge recalculation) may not increment.
**Fix:** Ensure `triggerRelayout()` is called after every connect/disconnect. Currently it's on a ResizeObserver — may need explicit call after store mutation.

### 10. Pattern Not Updating After Connect
**Problem:** `detectPattern()` is called in `addStopToShipment` and `removeStopFromShipment`. But if the user connects a TRANSFER stop, the pattern should change to `cross_dock`. Need to verify this actually happens.
**Status:** Code exists in the latest commit. Needs testing.

### 11. Shipment.stopIds Out of Sync
**Problem:** Some functions update `shipment.stopIds` and some don't. If stopIds is out of sync with actual stops in the store, the shipment detail page shows wrong stops.
**Fix:** Either always update stopIds, or derive it from `stops.filter(s => s.shipmentId === id)` instead of relying on the array.

---

## MISSING FEATURES

### 12. Can't Connect Destination → Shipment (input port on destination)
**Status:** Destination card has an input port. Shipment has an output port. Ship→Dest connection works. But can user click Dest input → Ship output? No — connection flow is always output→input (left→right). This is correct by design.

### 13. Can't Connect Shipment → Source (backwards)
**Status:** Correctly blocked. Sources only have output ports, shipments have both. Validation rejects backwards connections. ✅

### 14. Multi-Select Connect (connect multiple sources at once)
**Status:** Not supported. User must connect one at a time. This is fine for now.

### 15. Undo Connect / Undo Disconnect
**Status:** Not implemented. User can't undo. Would need state history (complex). Out of scope for prototype.

---

## PRIORITY FIXES

### Must Fix (P0)
| # | Issue | Impact | Effort |
|---|---|---|---|
| A | ✕ button click area too small | Can't disconnect reliably | Small |
| B | No "⚠ No destination" warning on shipments without DELIVER | User confusion | Small |
| C | Edge re-render after connect/disconnect (triggerRelayout) | Arrows may not update | Small |
| D | shipment.stopIds sync | Wrong stops on detail page | Medium |

### Should Fix (P1)
| # | Issue | Impact | Effort |
|---|---|---|---|
| E | "⚠ Unconnected" warning on source cards with no PICKUP | User confusion | Small |
| F | Arrow label overlap prevention | Visual clutter | Medium |
| G | Brief feedback on connect/disconnect | UX polish | Small |

### Nice to Have (P2)
| # | Issue | Impact | Effort |
|---|---|---|---|
| H | Larger connection port hit area | Touch devices | Small |
| I | Warehouse source card 🏭 icon | Visual distinction | Small |
| J | Arrow endpoint targets port position | Visual accuracy | Medium |
