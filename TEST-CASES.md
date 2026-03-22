# Attero TMS — Test Cases

## Slice 1: Direct Shipment Full Journey

### TC-1.1: Dashboard Loads Correctly
**Steps:** Navigate to / (Dashboard)
**Expected:** 
- 4 metric cards showing real counts (Pending Requests, Active Loads, In Transit, Completed)
- Material Flow section with planned vs actual quantities
- Quick Actions links (View PRs, Create Load, Track Shipments, Warehouse)
- Recent Pickup Requests table with latest PRs
**Status:** ✅ PASS — Dashboard shows 5 pending, 2 active loads, 1 in transit, 2 completed

### TC-1.2: PR List — Tabs & Counts
**Steps:** Navigate to /pickup-requests
**Expected:** 
- Tab bar: All (10), Pending (5), Planned (1), Picked Up (1), Delivered (1), Closed (1), Cancelled (1)
- Counts update when tab is clicked (filter applied)
**Status:** ✅ PASS — All tabs with correct counts

### TC-1.3: PR List — Search
**Steps:** Type "Daikin" in search bar
**Expected:** Only Daikin PRs shown (REQ-00001, REQ-00006)
**Status:** 🔲 TO TEST

### TC-1.4: PR List — Table Columns
**Steps:** View PR list table
**Expected:** Columns: checkbox, PR ID (link), Source ID, Client, Materials (badges), Planned Qty, Pickup Date, Status (badge), Load ID (link if assigned)
**Status:** ✅ PASS — All columns present, material badges showing, load links working

### TC-1.5: PR List — Overdue Indicator
**Steps:** Check PRs past their tentative pickup date with status still "pending"
**Expected:** Orange "⚠ OVERDUE (X Days)" indicator below status
**Status:** 🔲 TO TEST

### TC-1.6: PR List — Select & Create Load Action Bar
**Steps:** Check checkbox on REQ-00001
**Expected:** 
- Bottom action bar appears: "1 requests selected · 6,200 Kg · Create Load →"
- Blue Create Load button
**Status:** ✅ PASS — Action bar shows with correct count and total qty

### TC-1.7: Create PR — Slide Over
**Steps:** Click "+ Create PR" button → Fill form → Submit
**Expected:**
- Slide-over opens from right
- Fields: Client dropdown (searchable), Pickup Location (auto-fill from client), Destination (dropdown, default Haridwar Plant), Material Items (add multiple), Pickup Date, Notes
- On submit: new PR appears in list with status "pending" and generated ID
**Status:** 🔲 TO TEST

### TC-1.8: Create Load — From PR Selection
**Steps:** Select REQ-00001 → Click "Create Load →"
**Expected:**
- Navigates to /loads/create with PR pre-selected
- Shows: 1 Selected PR, 6,200 Kg total, Pattern: "Direct"
- PR card: Daikin, E-waste (5000 kg) + Copper (1200 kg), Gujarat
- Destination picker (default: plant)
**Status:** ✅ PASS — All correct, pattern auto-detected as Direct

### TC-1.9: Create Load — Submit
**Steps:** Select destination → Click "Create Load"
**Expected:**
- Load created in store (LOAD-XXX)
- Shipment auto-created (SHIP-XXXXX, status: draft)
- 2 Stops auto-created: PICKUP at client, DELIVER at destination
- PR status updated to "planned", loadId linked
- Navigates to Load Workspace (/loads/:id)
**Status:** 🔲 TO TEST

### TC-1.10: Load Workspace — Flow Diagram
**Steps:** View Load Workspace after creating load
**Expected:**
- Header: Load ID + Draft badge + "Direct" pattern + 1 PR, 6200 kg, 1 Shipment
- Flow diagram: [Daikin Card] → 🚛 [Shipment Card] → [Plant Card]
- Shipment card shows status dot + ID
**Status:** 🔲 TO TEST

### TC-1.11: Load Workspace — Assign Vehicle & Driver
**Steps:** Click shipment card → fill transporter, vehicle, driver
**Expected:**
- Expanded panel shows: Transporter dropdown, Vehicle dropdown (filtered by transporter), Driver Name, Driver Phone
- Readiness indicators: ⚠ for missing, ✅ for filled
- "Mark as Planned" button enabled only when all fields filled
**Status:** 🔲 TO TEST

### TC-1.12: Load Workspace — Mark as Planned
**Steps:** Fill all fields → Click "Mark as Planned"
**Expected:**
- Shipment status → "planned"
- Load status → "fully_planned"
- Status badges update on screen
**Status:** 🔲 TO TEST

### TC-1.13: Shipment List — Shows Shipments
**Steps:** Navigate to /shipments
**Expected:**
- Tab bar with counts: All, Draft, Planned, In Transit, Completed, Cancelled
- Table: Shipment ID (link), Load ID (link), Status, Transporter, Vehicle, Driver, Origin, Destination, Qty, Stops (X/Y), Date
- "Dispatch" quick action visible for planned shipments
**Status:** 🔲 TO TEST

### TC-1.14: Shipment Detail — Dispatch
**Steps:** Click shipment → Click "Dispatch" button
**Expected:**
- Shipment status → "in_transit"
- Load status → "in_execution"
- First stop becomes "active" (highlighted blue)
**Status:** 🔲 TO TEST

### TC-1.15: Shipment Detail — Complete Pickup Stop
**Steps:** In active PICKUP stop → Edit actual materials (change E-waste to Iron 4500 + Cobalt 1700) → Click "Complete Pickup"
**Expected:**
- Stop status → "completed" (green)
- Actual items saved (different from planned)
- PR status → "picked_up"
- Next stop (DELIVER) becomes active
**Status:** 🔲 TO TEST

### TC-1.16: Shipment Detail — Complete Delivery Stop
**Steps:** In active DELIVER stop → Enter tare (8920), gross (15120) → Verify net auto-calculates (6200) → Click "Complete Delivery"
**Expected:**
- Stop status → "completed"
- Net weight auto-calculated: 15120 - 8920 = 6200 kg
- Shipment status → "completed" ✅
- Load status → "completed" ✅
- PR status → "closed" ✅
- ALL status badges update across all screens
**Status:** 🔲 TO TEST

### TC-1.17: Auto-Cascade — Full Chain Verification
**Steps:** After completing delivery, check all entities
**Expected:**
- Stop 1 (PICKUP): completed ✅
- Stop 2 (DELIVER): completed ✅
- Shipment: completed ✅
- Load: completed ✅
- PR: closed ✅
- PR List shows updated status
- Load List shows updated status
- Shipment List shows updated status
**Status:** 🔲 TO TEST

### TC-1.18: Load List — Shows Loads
**Steps:** Navigate to /loads
**Expected:**
- Tab bar with counts
- Table: Load ID (link), Status, Pattern, # PRs, # Shipments, Total Qty, Destination, Created
- Click Load ID → Load Workspace
**Status:** 🔲 TO TEST

### TC-1.19: Navigation — All Links Work
**Steps:** Click through all entity links
**Expected:**
- PR ID links → /pickup-requests/:id
- Load ID links → /loads/:id
- Shipment ID links → /shipments/:id
- Breadcrumbs navigate correctly
- Sidebar highlights active page
**Status:** ✅ PASS — PR links, Load links working. Sidebar active state correct.

### TC-1.20: Settings — CRUD
**Steps:** Navigate to Settings → Clients → Add new client
**Expected:**
- Table with existing clients
- "Add" button opens form
- Can create new client
- New client appears in dropdowns elsewhere
**Status:** 🔲 TO TEST

---

## Test Run Summary

| Test Case | Description | Status |
|---|---|---|
| TC-1.1 | Dashboard loads | ✅ PASS |
| TC-1.2 | PR List tabs & counts | ✅ PASS |
| TC-1.3 | PR List search | 🔲 TO TEST |
| TC-1.4 | PR List table columns | ✅ PASS |
| TC-1.5 | PR List overdue indicator | 🔲 TO TEST |
| TC-1.6 | PR List select & action bar | ✅ PASS |
| TC-1.7 | Create PR slide-over | 🔲 TO TEST |
| TC-1.8 | Create Load from PR | ✅ PASS |
| TC-1.9 | Create Load submit | 🔲 TO TEST |
| TC-1.10 | Load Workspace flow diagram | 🔲 TO TEST |
| TC-1.11 | Assign vehicle & driver | 🔲 TO TEST |
| TC-1.12 | Mark as Planned | 🔲 TO TEST |
| TC-1.13 | Shipment List | 🔲 TO TEST |
| TC-1.14 | Dispatch shipment | 🔲 TO TEST |
| TC-1.15 | Complete Pickup (diff materials) | 🔲 TO TEST |
| TC-1.16 | Complete Delivery (weighbridge) | 🔲 TO TEST |
| TC-1.17 | Auto-cascade full chain | 🔲 TO TEST |
| TC-1.18 | Load List | 🔲 TO TEST |
| TC-1.19 | Navigation links | ✅ PASS |
| TC-1.20 | Settings CRUD | 🔲 TO TEST |

**Verified so far:** 6/20 tests passing
**Remaining:** 14 tests need manual click-through (flow continues from Create Load → Workspace → Shipment → Cascade)
