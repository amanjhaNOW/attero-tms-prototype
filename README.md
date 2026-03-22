# Attero TMS — Transport Management System Prototype

**Live Demo:** [attero-tms.pages.dev](https://attero-tms.pages.dev)

Built for Attero — India's largest e-waste & lithium-ion battery recycler. This prototype demonstrates a complete TMS architecture handling 7 logistics patterns with one unified data model.

---

## 🏗️ Architecture

```
PR (demand) → Load (operation) → Shipment (truck + route) → Stop (action)
```

| Entity | What It Is |
|---|---|
| **Pickup Request (PR)** | "Pick up 5T of e-waste from Daikin, Gujarat" — the demand signal |
| **Load** | The operation — groups PRs, sets destination, holds documents |
| **Shipment** | A truck assigned to run a route — vehicle, driver, ordered stops |
| **Stop** | An action at a location — PICKUP, DELIVER, HANDOVER, RECEIVE |

---

## 🚛 7 Logistics Patterns (All Supported)

### 1. Direct
One client, one truck, pickup → deliver.
```
[Daikin] → 🚛 → [Plant]
```

### 2. Milk Run
Multiple clients, one truck, sequential pickups → deliver.
```
[Daikin] ──┐
[Deloitte]─┤→ 🚛 → [Plant]
[Infosys] ─┘
```

### 3. Multi-Vehicle
One or more clients, multiple trucks on the same route.
```
[Daikin] ──┬→ 🚛₁ → [Plant]
           └→ 🚛₂ → [Plant]
```

### 4. Warehouse Collection
Pickup from clients → deliver to warehouse (intermediate, not final).
```
[Clients] → 🚛 → [Warehouse 🏭]
```
PR stays "picked up" — does NOT close until material reaches plant.

### 5. Warehouse Dispatch
Move material from warehouse → plant. Created from Warehouse Dashboard.
```
[Warehouse 🏭] → 🚛 → [Plant 🏢]
```

### 6. Cross-Dock
Small feeder trucks collect from clients → hand over to big line-haul truck → delivers to plant.
```
[Jaipur] → 🚛 Feeder 1 ──🤝──┐
                                ├→ 🚛 Line-Haul → [Plant]
[Ajmer] → 🚛 Feeder 2 ──🤝──┘
```
Meeting point decided at execution time (driver coordination).

### 7. Cross-Dock + Milk Run
Feeders do milk runs (multiple pickups), then hand over. Line-haul can also pick up directly.
```
[Client A] ──┐
[Client B] ──┤→ 🚛 Feeder 1 ──🤝──┐
                                     ├→ 🚛 Line-Haul → [Plant]
[Client C] ──┐                      │
[Client D] ──┤→ 🚛 Feeder 2 ──🤝──┘
```

---

## 📱 Screens

### 1. Dashboard
Landing page with metrics: pending PRs, active loads, shipments in transit, completed today. Quick actions + recent activity.

### 2. Pickup Requests
Full list with tabs (All / Pending / Planned / Picked Up / Delivered / Closed / Cancelled), search, filters, overdue indicators. Select PRs → "Create Load →" goes directly to workspace.

### 3. Create PR
Slide-over form: client dropdown (auto-fills location), materials (add multiple types), destination, date. 30-second creation.

### 4. Load List
All loads with pattern labels, status badges, PR count, shipment count, total qty, destination.

### 5. Load Workspace — THE HERO SCREEN
Visual route builder with flow diagram:
- **Source cards** (left): clients with materials + qty
- **Shipment cards** (middle): trucks with route summary + status
- **Destination card** (right): plant or warehouse
- **SVG arrows** connecting everything with qty labels
- **Click-to-connect**: click source port → click truck port → creates stop
- **Hover arrow → ✕** to disconnect
- **Shipment edit panel**: two-column layout (transport + stops & route)
- **+ Add PR / + Add from Warehouse / + Add Truck** (Same Route / Line-Haul / Empty)
- **Pattern auto-detects** from connections

### 6. Shipment List
All shipments with status tabs, origin → destination, vehicle, driver, stop progress.

### 7. Shipment Detail — Execution
Vertical stop timeline:
- **PICKUP**: enter actual materials (can differ from planned!) → Complete
- **DELIVER**: weighbridge (tare/gross/net auto-calc) → Complete
- **HANDOVER**: enter meeting point location + qty → Complete
- **RECEIVE**: auto-fills from linked handover → Confirm
- Auto-cascade: Stop ✅ → Shipment ✅ → Load ✅ → PR ✅

### 8. Warehouse Dashboard
PR-level view of material at warehouses (not shipment-level). Summary cards, days waiting, % at plant. Select material → Create Load to dispatch to plant.

### 9. PR Qty Tracker
Click any PR to see: progress bar (at plant / at warehouse / in transit), shipment trail with every leg.

### 10. Plant Gate
Standalone tablet-friendly screen (no sidebar). Vehicle search, weighbridge input, receive.

### 11. Settings
CRUD for: Clients, Transporters, Vehicles, Locations.

---

## ⚡ Key Features

### Auto-Cascade Engine
Ops only clicks "Complete Stop." Everything else cascades:
- Pickup done → PR "picked up"
- Deliver at warehouse → PR stays "picked up" (warehouse is intermediate!)
- Deliver at plant → PR "delivered" → "closed"
- All stops done → Shipment "completed" → Load "completed"
- Multi-vehicle: PR closes only when ALL trucks deliver

### Material Line Items
- PRs have multiple material types (E-waste, Iron, Cobalt, etc.)
- At pickup, actual materials can be COMPLETELY different from planned
- No validation — planned = estimate, actual = reality
- This is normal for e-waste recycling

### Click-to-Connect Route Building
- Every arrow = one stop
- Connect = create stop, Disconnect = remove stop
- Source → Truck = PICKUP
- Truck → Plant = DELIVER
- Truck → Truck = HANDOVER + RECEIVE (cross-dock)
- Routes belong to shipments — each truck can have different route

### Smart Defaults
- Add PR at load level → syncs to all trucks
- Add Truck (Same Route) → clones pickups + deliver
- Add Truck (Line-Haul) → just deliver, connect feeders to it
- Connect feeder → line-haul → auto-removes feeder's deliver

### Handover UX (Cross-Dock)
- Not "Transfer In/Out" — user sees "🤝 Handover" and "📥 Receive"
- Meeting point: text input (TBD at planning, filled at execution)
- Each handover = 1:1 pair (separate meeting points per feeder)
- Receive blocked until linked handover is complete

### Data Persistence
All state persists to localStorage — survives page refresh and tab close.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand with localStorage persistence |
| Routing | React Router v6 |
| Icons | Lucide React |
| Flow Diagram | Custom SVG + CSS Grid |

---

## 🚀 Getting Started

```bash
git clone https://github.com/amanjhaNOW/attero-tms-prototype.git
cd attero-tms-prototype
npm install
npm run dev
```

Open http://localhost:5173

---

## 📊 Demo Data

Pre-loaded with realistic data:
- **22 Pickup Requests** across 13 clients (Daikin, Deloitte, Tata Motors, Reliance, etc.)
- **11 Loads** — Direct, Milk Run, Multi-Vehicle, Warehouse, Cross-Dock patterns
- **14 Shipments** with various statuses (draft, planned, in-transit, completed)
- **27+ Stops** including pickups, deliveries, handovers, receives
- **9 Vehicles** (Tata 407, Eicher, Ashok Leyland, Mahindra Bolero, etc.)
- **3 Locations** (Haridwar Plant, Haridwar Warehouse, Delhi Collection Center)

### Demo Loads to Explore

| Load | Pattern | Status | What to See |
|---|---|---|---|
| LOAD-001 | Direct | Planned | Simple flow, assigned vehicle |
| LOAD-008 | Cross-Dock | Draft | 2 feeders + line-haul with handover arrows |
| LOAD-009 | Direct | Completed | Full execution trail with weighbridge |
| LOAD-010 | Milk Run | In Execution | 2/3 pickups done, 1 pending |
| LOAD-011 | Cross-Dock + Milk Run | Draft | 2 milk run feeders → 2 handover points → line-haul → plant |

---

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── flow/           # Flow diagram (FlowDiagram, FlowNode, FlowEdge, etc.)
│   ├── PRPickerModal   # PR selection popup
│   └── WarehousePickerModal  # Warehouse material picker
├── data/               # Mock data (clients, PRs, loads, shipments, stops)
├── lib/                # Utilities (createLoadHelper, idGenerator, stopDisplayLabel)
├── pages/              # All page components
├── stores/             # Zustand stores + cascade engine
├── types/              # TypeScript interfaces
└── layouts/            # App layout + plain layout (Plant Gate)
```

---

## 📋 Architecture Docs

- `docs/ARCHITECTURE.md` — Data model + design decisions
- `docs/Route-Architecture.pdf` — Route ownership model
- `docs/Load-Workspace-Final-UX.pdf` — Complete workspace UX spec
- `docs/CONNECT-DISCONNECT-AUDIT.md` — Connection system gap analysis
- `docs/WORKSPACE-AUDIT.md` — Full workspace audit with fixes

---

*Built in one day. March 22, 2026.*
