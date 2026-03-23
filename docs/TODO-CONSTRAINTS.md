# TODO: Constraints + Warehouse + Unplan

## Priority Order

### Batch A: Destination Change (enables warehouse flow)
- [x] A1: [Change ▼] dropdown on DestinationCard in FlowNode.tsx (draft loads only)
- [x] A2: Wire to changeLoadDestination() from FlowDiagram → LoadWorkspace
- [x] A3: Add detectPattern call after destination change
- [x] A4: Add draft-only guard on DELIVER stop updates in changeLoadDestination
- [x] A5: Warehouse info banner on workspace when dest=warehouse

### Batch B: Unplan Action (makes constraints actionable)
- [x] B1: unplanShipment() function in cascade engine (planned → draft)
- [x] B2: [Unplan] button on planned shipment cards
- [x] B3: [Unplan] option in shipment edit panel

### Batch C: Constraint Enforcement
- [x] C1: Connect port — disable (gray) for non-draft shipments + tooltip "Planned — route locked"
- [x] C2: Disconnect ✕ — hide on non-draft shipment arrows + tooltip "Route locked"
- [x] C3: Delete ✕ — only on draft shipments (verified existing behavior)
- [x] C4: Remove PR — block if completed stops, show dialog with reason
- [x] C5: Add PR — show "All ships planned, add truck first" when no draft ships
- [x] C6: Change dest partial — warn "only draft ships updated" with [Proceed][Cancel]
- [x] C7: Delete planned shipment — show "Unplan first" with [Unplan] button

### Batch D: Polish
- [ ] D1: Shipment-level toggle on Warehouse Dashboard
- [ ] D2: Toast/notification system for constraint messages
