# Attero TMS Prototype — Delivery Tracker

## Quick Links
- **Repo:** https://github.com/amanjhaNOW/attero-tms-prototype
- **Live:** https://attero-tms.pages.dev
- **Architecture:** `docs/ARCHITECTURE.md`
- **Route Architecture PDF:** `docs/Route-Architecture.pdf`
- **Dev Server:** localhost:5173

## Architecture Decisions (Mar 22)
- **Load = WHAT** (business layer: PRs, destination, documents)
- **Shipment = HOW** (execution layer: truck + its OWN route of stops)
- **Routes belong to Shipments** (not Load)
- **Auto-Sync** (default): Add PR → all trucks get it. Add truck → clone route.
- **Independent** (cross-dock): TRANSFER stops = break sync. Each route managed separately.
- **Two entry points**: Load-level (syncs all) vs Shipment-level (just that truck)
- **No data model changes needed** — just behavior

---

---

## SLICE 0: Foundation + Design System
**Status:** ✅ COMPLETE | **Commit:** `fdc0c92` | **Branch:** main

- [x] React 18 + Vite + TypeScript + Tailwind
- [x] 14 reusable components (StatusBadge, DataTable, SearchBar, FilterBar, TabBar, MetricCard, SlideOver, PageHeader, Sidebar, ActionBar, EmptyState, MaterialLineItems, WeighbridgeInput, ProgressBar)
- [x] 14 pages (all routes wired)
- [x] 5 Zustand stores (PRs, Loads, Shipments, Stops, Reference)
- [x] Mock data (10 PRs, 5 loads, 4 shipments, 8 stops, 5 clients)
- [x] TypeScript strict — zero errors
- [x] Git repo + pushed to GitHub

---

## SLICE 1: Direct Shipment (Full Journey)
**Status:** ✅ COMPLETE | **Branch:** merged to main

### Features
- [ ] PR List — functional with real data, tabs with counts, search, filters, overdue indicators
- [ ] PR Creation — slide-over form, 7 fields, creates PR in store
- [ ] Create Load — select PR → create load → auto-generate shipment + 2 stops
- [ ] Load Workspace — flow diagram showing [Client] → 🚛 Ship → [Plant]
- [ ] Load List — shows loads with status, pattern label, progress
- [ ] Shipment List — shows shipments with status, vehicle, driver
- [ ] Shipment Detail — vertical stop timeline:
  - [ ] Complete PICKUP stop (enter actual material items — can differ from planned)
  - [ ] Complete DELIVER stop (enter tare/gross/net weights)
- [ ] Auto-Cascade Engine:
  - [ ] Pickup stop done → PR "picked_up"
  - [ ] Deliver stop done → Shipment "completed" → Load "completed" → PR "closed"
- [ ] Settings — masters with real CRUD (clients, transporters, vehicles, locations)

### Acceptance Criteria
- [ ] Can create a PR for Daikin (3000 kg E-waste, Gujarat → Haridwar)
- [ ] Can create a Load from that PR
- [ ] Load Workspace shows the flow diagram
- [ ] Can assign vehicle (HR58D4082) and driver
- [ ] Can dispatch the shipment
- [ ] Can complete pickup stop with different actual materials
- [ ] Can complete delivery with weighbridge (tare/gross/net)
- [ ] After delivery: Stop ✅ → Shipment ✅ → Load ✅ → PR ✅ (auto-cascade)
- [ ] All status badges update correctly across all screens

---

## SLICE 2: Milk Run
**Status:** ✅ COMPLETE | **Branch:** merged to main

### Features
- [ ] PR List — multi-select checkboxes + "Create Load" action bar
- [ ] Create Load with 3 PRs → auto-generates 1 shipment + 4 stops (3 PICKUP + 1 DELIVER)
- [ ] Load Workspace — flow diagram: 3 clients merging → 🚛 → Plant
- [ ] Shipment Detail — 3 pickup stops in sequence, drag to reorder
- [ ] Auto-cascade: all 3 PRs close when delivery completes

### Acceptance Criteria
- [ ] Select 3 PRs from different clients
- [ ] Load auto-detects "Milk Run" pattern
- [ ] Can reorder pickup sequence via drag
- [ ] Complete pickups in order → each PR updates
- [ ] Final delivery → all 3 PRs close

---

## SLICE 3: Multi-Vehicle + Qty Tracker
**Status:** ✅ COMPLETE | **Branch:** merged to main

### Features
- [ ] Load Workspace — "+ Add Shipment" (no qty split, each shows full material list)
- [ ] Multiple shipments dispatch independently
- [ ] PR Qty Tracker screen — progress bar (at plant / at warehouse / in transit)
- [ ] PR closes only when all shipments complete at plant

### Acceptance Criteria
- [ ] Create Load with 1 large PR → add 2 shipments
- [ ] Each shipment shows full material list from PR
- [ ] Dispatch + complete independently
- [ ] PR Qty Tracker shows actual split from pickup data
- [ ] PR closes when both shipments delivered

---

## SLICE 4: Warehouse Consolidation (THE KEY)
**Status:** ✅ COMPLETE | **Branch:** merged to main

### Features
- [ ] Create Load with destination = Warehouse
- [ ] Deliver at warehouse → PR stays "picked_up" (NOT closed)
- [ ] Warehouse Dashboard — PR-level view (not shipment-level)
  - [ ] Summary cards (total at WH, PRs pending, avg days, oldest)
  - [ ] Table: PR ID, Client, Materials, Qty at WH, PR Total, % at Plant, Days Waiting
- [ ] Create Load from Warehouse Dashboard → Source picker with tabs (📋 PRs | 🏭 Warehouse)
- [ ] Partial warehouse pickup (qty input)
- [ ] Mixed sources (warehouse + fresh PRs in same load)
- [ ] Deliver at plant → PR finally closes
- [ ] PR Qty Tracker shows full journey

### Acceptance Criteria
- [ ] Complete flow: Client → Warehouse → Wait → Plant
- [ ] PR does NOT close at warehouse delivery
- [ ] Warehouse Dashboard shows PR-level material
- [ ] Can create plant load from warehouse material
- [ ] Can mix warehouse + new PRs in one load
- [ ] Partial qty pickup works
- [ ] PR closes only when all material at plant

---

## UX IMPROVEMENTS (Between Slices)
**Status:** ✅ COMPLETE

- [x] Colors matched to her exact screenshots (purple, teal, coral, amber badges)
- [x] Create Load page: redesigned as compact confirmation with popup pickers
- [x] Create Load merged INTO workspace — no in-between page
- [x] PR List → "Create Load" goes DIRECTLY to workspace (instant create)
- [x] Warehouse Dashboard → "Create Load" goes DIRECTLY to workspace
- [x] Visual flow diagram: SVG arrows, source→shipment→destination
- [x] Shipment edit: inline expand panel below diagram
- [x] Multi-vehicle: "+ Add Shipment" creates 2nd truck with cloned route
- [x] Flow diagram handles: Direct, Milk Run, Multi-Vehicle, Cross-Dock (5-col)
- [x] Blank page bug fixed (Zustand selector caching)
- [x] SPA routing fixed (Cloudflare _redirects)

### Pending UX Work
- [ ] Route sync behavior: Add PR at Load level → syncs to all shipments
- [ ] Route sync behavior: Add Stop at Shipment level → only that truck
- [ ] addShipmentToLoad() → properly clone full route (not just first PR)
- [ ] addPRsToLoad() → sync pickup to ALL synced shipments
- [ ] Shipment edit panel: "Add Stop" button for per-shipment stops
- [ ] Cross-dock: TRANSFER_IN/OUT stop creation in shipment edit
- [ ] Cross-dock: transfer location TBD at planning
- [ ] Mobile responsive (Slice 6)

---

## SLICE 5: Cross-Dock
**Status:** ⬜ NOT STARTED | **Branch:** feat/slice-5-cross-dock

### Features
- [ ] Create Load with 3 shipments (2 feeder + 1 line-haul)
- [ ] TRANSFER_OUT stops on feeders
- [ ] TRANSFER_IN stop on line-haul
- [ ] Parent-child shipment linking
- [ ] Flow diagram shows feeder → hub → line-haul → plant
- [ ] Confirm transfer → auto-unlocks line-haul
- [ ] Cross-Dock + Milk Run combo (line-haul with mixed stops)

### Acceptance Criteria
- [ ] Create cross-dock load with 2 feeders + 1 line-haul
- [ ] Transfer stops work (out → in linked)
- [ ] Line-haul blocked until feeders complete transfer
- [ ] Full flow completes end-to-end

---

## SLICE 6: Polish + Plant Gate
**Status:** ⬜ NOT STARTED | **Branch:** feat/slice-6-polish

### Features
- [ ] Dashboard — live metrics, alerts, today's schedule, activity feed
- [ ] Plant Gate — standalone tablet screen, vehicle search, weighbridge, receive
- [ ] Exception handling — skip stop, destination change, vehicle swap
- [ ] Full mock data (89 PRs, 20 loads, 30 shipments, 80 stops)
- [ ] UI polish, loading states, error handling, responsive

### Acceptance Criteria
- [ ] Dashboard shows real metrics from store data
- [ ] Plant Gate works without sidebar (standalone)
- [ ] Can skip a stop and replan PR
- [ ] All screens polished and production-ready feel
