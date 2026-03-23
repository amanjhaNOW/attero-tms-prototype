# TODO: Constraints + Warehouse + Unplan

## Priority Order

### Batch A: Destination Change (enables warehouse flow)
- [ ] A1: [Change ▼] dropdown on DestinationCard in FlowNode.tsx (draft loads only)
- [ ] A2: Wire to changeLoadDestination() from FlowDiagram → LoadWorkspace
- [ ] A3: Add detectPattern call after destination change
- [ ] A4: Add draft-only guard on DELIVER stop updates in changeLoadDestination
- [ ] A5: Warehouse info banner on workspace when dest=warehouse

### Batch B: Unplan Action (makes constraints actionable)
- [ ] B1: unplanShipment() function in cascade engine (planned → draft)
- [ ] B2: [Unplan] button on planned shipment cards
- [ ] B3: [Unplan] option in shipment edit panel

### Batch C: Constraint Enforcement
- [ ] C1: Connect port — disable (gray) for non-draft shipments + tooltip "Planned — route locked"
- [ ] C2: Disconnect ✕ — hide on non-draft shipment arrows + tooltip "Route locked"
- [ ] C3: Delete ✕ — only on draft shipments (verify existing behavior)
- [ ] C4: Remove PR — block if completed stops, show dialog with reason
- [ ] C5: Add PR — show "All ships planned, add truck first" when no draft ships
- [ ] C6: Change dest partial — warn "only draft ships updated" with [Proceed][Cancel]
- [ ] C7: Delete planned shipment — show "Unplan first" with [Unplan] button

### Batch D: Polish
- [ ] D1: Shipment-level toggle on Warehouse Dashboard
- [ ] D2: Toast/notification system for constraint messages
