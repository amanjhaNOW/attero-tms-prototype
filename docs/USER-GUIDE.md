# Attero TMS — User Guide
### Step-by-Step Interactions from the User's Perspective

**Live Demo:** [attero-tms.pages.dev](https://attero-tms.pages.dev)

---

## Getting Started

Open the app. You'll see the **Dashboard** with:
- 4 metric cards (Pending Requests, Active Loads, In Transit, Completed)
- Quick action links
- Recent pickup requests table

The **sidebar** (left) has all navigation: Dashboard, Pickup Requests, Loads, Shipments, Warehouse, Settings.

---

## Flow 1: Simple Pickup — One Client, One Truck

**Scenario:** Daikin in Ahmedabad has 6,200 kg of e-waste ready for pickup. Send one truck to collect and deliver to Haridwar Plant.

### Step 1: Create a Pickup Request
1. Click **"Pickup Requests"** in sidebar
2. Click **"Create PR"** button (top right)
3. Slide-over form opens from the right:
   - **Client:** Select "Daikin Airconditioning India Pvt Ltd" from dropdown
   - **Pickup Location:** Auto-fills with Daikin's address (Ahmedabad, Gujarat)
   - **Destination:** Default "Attero Recycling Pvt Ltd Haridwar (plant)" — leave as is
   - **Materials:** Click material dropdown → select "E-waste" → enter qty "5000" → unit "Kg"
   - Click **"Add Material"** → add "Copper" → qty "1200" → unit "Kg"
   - **Pickup Date:** Select a date
4. Click **"Create Pickup Request"**
5. Slide-over closes. New PR appears in the list with status **"Pending"**

### Step 2: Create a Load
1. In the PR list, **check the box** next to the Daikin PR you just created
2. Bottom action bar appears: **"1 requests selected · 6,200 Kg · Create Load →"**
3. Click **"Create Load →"**
4. You're taken directly to the **Load Workspace** — the visual planning screen

### Step 3: Plan the Shipment
1. You see the **flow diagram**:
   ```
   [📍 Daikin, Ahmedabad] ──6.2T──→ [🚛 SHP-xxx, Draft] ──→ [🏢 Haridwar Plant]
   ```
2. The shipment card shows **"⚠ Needs assignment"**
3. Click the **shipment card** (or click **[Edit]** button)
4. The **edit panel** expands below the diagram with two columns:

   **Left — Transport:**
   - Transportation Mode: select "Carrier (Third-Party)"
   - Transporter: select "India King Roadways"
   - Vehicle: select "HR58D4082 - 32FT 7 TON"
   - Driver Name: type "Ramesh Kumar"
   - Driver Phone: type "9876543210"

   **Right — Stops & Route:**
   - Stop 1: 📦 PICKUP — Daikin, Ahmedabad (E-waste 5T, Copper 1.2T)
   - Stop 2: 📦 DELIVER — Haridwar Plant

5. Readiness shows **"✅ Ready to plan"**
6. Click **"Save & Mark Planned"**
7. Shipment status changes to **"Planned"**

### Step 4: Dispatch
1. Go to **Shipments** (sidebar)
2. Find your shipment → click **"Dispatch"** button
3. Status changes to **"In Transit"**

### Step 5: Complete Pickup (At the Client)
1. Click the **shipment ID** to open Shipment Detail
2. The stop timeline shows:
   - **● PICKUP — Daikin, Ahmedabad** (highlighted blue — this is the active stop)
   - ○ DELIVER — Haridwar Plant (grayed out — not yet)
3. In the PICKUP section:
   - You see **Planned Items:** E-waste 5,000 Kg, Copper 1,200 Kg
   - Below is **Actual Items** — an editable table
   - **You can change materials!** Maybe the driver found Iron instead of Copper:
     - Change "Copper" to "Iron"
     - Change qty to "1,500"
     - Add a new row: "Cobalt" → 200 Kg
   - This is NORMAL — planned ≠ actual in e-waste
4. Click **"Complete Pickup"**
5. Stop turns green ✅. PR status changes to **"Picked Up"**
6. DELIVER stop becomes active (highlighted blue)

### Step 6: Complete Delivery (At the Plant)
1. The DELIVER stop is now active:
   - **Weighbridge section:**
     - Enter Tare Weight: 8920 (empty truck weight)
     - Enter Gross Weight: 15620 (truck + material)
     - **Net Weight auto-calculates:** 6,700 Kg
2. Click **"Complete Delivery"**
3. **AUTO-CASCADE:**
   - Stop ✅
   - Shipment → **"Completed"** ✅
   - Load → **"Completed"** ✅
   - PR → **"Closed"** ✅
4. Everything is done. Go to PR List — the PR now shows **"Closed"**

---

## Flow 2: Milk Run — Three Clients, One Truck

**Scenario:** Three clients in different cities need pickup. One truck visits all three, then delivers to plant.

### Step 1: Select Multiple PRs
1. Go to **Pickup Requests**
2. Check **3 PRs** (e.g., Daikin, Deloitte, Infosys)
3. Action bar: **"3 requests selected · 16,200 Kg · Create Load →"**
4. Click **"Create Load →"**

### Step 2: Workspace Shows Milk Run
1. Flow diagram:
   ```
   [📍 Daikin] ──6.2T──┐
   [📍 Deloitte] ──4.0T──┤→ [🚛 SHP-xxx] → [🏢 Plant]
   [📍 Infosys] ──6.0T──┘
   ```
2. Pattern auto-detected: **"Milk Run"**
3. Click shipment → edit panel shows **3 pickup stops + 1 delivery**
4. **Reorder pickups** using ↑↓ buttons (e.g., Infosys first since it's closest)
5. Assign vehicle + driver → **"Save & Mark Planned"**

### Step 3: Execute
1. Dispatch the shipment
2. Complete pickups in order:
   - PICKUP 1 (Infosys) → PR "Infosys" becomes "Picked Up"
   - PICKUP 2 (Daikin) → PR "Daikin" becomes "Picked Up"
   - PICKUP 3 (Deloitte) → PR "Deloitte" becomes "Picked Up"
3. DELIVER becomes active only after ALL pickups are done
4. Complete delivery → all 3 PRs close ✅

---

## Flow 3: Multi-Vehicle — Too Heavy for One Truck

**Scenario:** Reliance Industries has 20,000 kg. Too heavy for one truck. Send two.

### Step 1: Create Load (starts as Direct)
1. Select the Reliance PR → **"Create Load →"**
2. Workspace shows 1 truck (Direct pattern)

### Step 2: Add Second Truck
1. Click **"Add Truck ▾"** button
2. Select **"🚛 Same Route"** — clones the route
3. Now 2 trucks, both with the same pickup + delivery
4. Pattern changes to **"Multi-Vehicle"**
5. Assign different vehicles + drivers to each truck

### Step 3: Execute
1. Dispatch both trucks (independently)
2. At pickup: each driver records what they actually loaded:
   - Truck 1: 12,000 kg
   - Truck 2: 8,000 kg
3. At delivery: each truck delivers independently
4. PR closes only when **BOTH** trucks deliver ✅

**Key:** No qty split at planning. Each truck shows the full material list. The real split happens at pickup.

---

## Flow 4: Warehouse Collection → Warehouse Dispatch

**Scenario:** Collect material from 2 clients → store at warehouse → later dispatch to plant.

### Part A — Collection Leg

#### Step 1: Create Load with Warehouse Destination
1. Select 2 PRs → **"Create Load →"**
2. In workspace, click the **destination card** → change dropdown to **"🏭 Haridwar Warehouse"**
3. Assign vehicle → Plan → Dispatch

#### Step 2: Complete Delivery at Warehouse
1. Complete pickups → Complete delivery at warehouse
2. **Check:** PRs show **"Picked Up"** — NOT "Closed" or "Delivered"
3. Warehouse is intermediate — PR stays open until material reaches plant

### Part B — Check Warehouse Dashboard

#### Step 3: View Material at Warehouse
1. Go to **Warehouse** (sidebar)
2. See PR-level view of material sitting at warehouses:
   - Each PR shows: client, materials, qty, days waiting, % at plant
   - Color-coded: green (< 3 days), yellow (3-7 days), red (> 7 days)
3. Summary cards: total at warehouses, PRs pending plant delivery

### Part C — Dispatch to Plant

#### Step 4: Create Plant Load from Warehouse
1. **Check the boxes** next to warehouse items
2. Action bar: **"2 PRs selected · X kg · Create Load →"**
3. Click → workspace opens with pickup from WAREHOUSE (not client)
4. Destination defaults to Plant
5. Assign vehicle → Plan → Dispatch

#### Step 5: Deliver to Plant
1. Complete pickup at warehouse → Complete delivery at plant
2. **NOW PRs close** ✅ (material finally reached plant)
3. Warehouse Dashboard: those items disappear (material moved)

### Checking the Full Journey
1. Click any PR ID → **PR Qty Tracker**
2. Progress bar shows: green (at plant) / yellow (at warehouse) / blue (in transit)
3. Shipment trail table shows BOTH legs:
   - 🏭→Warehouse leg (collection)
   - 🏢→Plant leg (dispatch)

---

## Flow 5: Cross-Dock — Feeder Trucks Meet Big Truck

**Scenario:** Pick up from 2 cities in Rajasthan. Each city gets a small feeder truck. Both feeders meet a big line-haul truck on the highway. Line-haul delivers to plant.

### Step 1: Create Load
1. Select 2 PRs (Jaipur + Ajmer) → **"Create Load →"**
2. Workspace shows milk run (both on one truck)

### Step 2: Convert to Cross-Dock
1. Click **"Add Truck ▾"** → select **"📥 Line-Haul"**
2. A new truck appears with just a delivery stop
3. Shows hint: **"Connect feeders to this truck"**
4. Now: Ship 1 (has pickups + deliver), Ship 2 (line-haul, just deliver)

### Step 3: Connect Feeders to Line-Haul
1. Click the **output port ●** on Ship 1 (right side of the card)
2. Hint: **"🔗 Connecting from SHP-xxx... Click a truck to connect"**
3. Click the **input port ●** on Ship 2 (line-haul, left side)
4. **Arrow appears:** amber dashed line with **"🤝 Handover"**
5. Ship 1's deliver-to-plant arrow **auto-disappears** (it's now a feeder)
6. Ship 1 gets **"Feeder"** badge, Ship 2 gets **"Line-Haul"** badge

### Step 4: Set Up Second Feeder
1. You can either:
   - Remove one PR from Ship 1 (✕ on stop) → connect it directly to another truck
   - OR add a 3rd truck as another feeder

### Step 5: Set Meeting Points
1. Click Ship 1 → edit panel → the HANDOVER stop shows:
   **"📍 Suggested meeting point: [____________]"**
2. Type "Near Ajmer toll plaza" — this is a SUGGESTION for the drivers
3. Do the same for Ship 2 if applicable

### Step 6: Execute
1. Plan all → Dispatch all
2. **Feeder 1 driver:**
   - Completes pickups in Jaipur/Ajmer
   - Arrives at meeting point
   - Completes **"🤝 Handover"** — enters exact location + qty
3. **Line-Haul driver:**
   - **"📥 Receive from SHP-xxx"** — location auto-fills from handover
   - **Blocked** if feeder hasn't completed handover yet (shows "⏳ Waiting...")
   - Once feeder completes → **"Confirm Receipt ✅"**
4. Line-haul drives to plant → Completes delivery → All PRs close ✅

---

## Flow 6: Adding/Removing Sources & Trucks

### Add Another PR to an Existing Load
1. In workspace, click **"+ Add PR"**
2. Popup shows available pending PRs (not already in this load)
3. Select one → **"Add Selected →"**
4. New source card appears with arrow to all trucks

### Add Warehouse Material
1. Click **"+ Add from Warehouse"**
2. Popup shows material at warehouses
3. Select items (with qty input for partial pickup)
4. Material added as source with pickup at warehouse location

### Add Another Truck
1. Click **"+ Add Truck ▾"** → three options:
   - **🚛 Same Route:** Clone all pickups + deliver (for multi-vehicle)
   - **📥 Line-Haul:** Just deliver (for cross-dock, connect feeders)
   - **📦 Empty Truck:** No stops, build route with connections

### Remove a Source
1. Click **✕** on the source card → PR removed from load, goes back to "pending"

### Remove a Truck
1. Click **✕** on the shipment card → truck deleted, stops cleaned up

### Disconnect an Arrow
1. Hover over any arrow → **red ✕** appears at midpoint
2. Click ✕ → stop removed, arrow disappears
3. For handover arrows: both sides (handover + receive) are removed

---

## Flow 7: Settings — Managing Master Data

### Add a Client
1. Go to **Settings** (sidebar) → **Clients**
2. Click **"Add"** → fill form (name, address, contact, materials)
3. New client appears in dropdowns when creating PRs

### Add a Vehicle
1. Settings → **Vehicles** → **"Add"**
2. Enter registration, type, capacity, linked transporter
3. Available for assignment in shipment planning

### Add a Location (Plant/Warehouse)
1. Settings → **Locations** → **"Add"**
2. Set type: Plant, Warehouse, or Client
3. Warehouses appear as destination options + in warehouse dashboard

---

## Important Things to Know

### Material Can Change at Pickup
The PR says "E-waste 5,000 kg" but the driver might find "Iron 4,000 kg + Cobalt 1,000 kg." That's normal. Enter actual items at pickup — they don't have to match planned.

### Warehouse ≠ Final Destination
Delivering to a warehouse does NOT close the PR. Material must reach a **plant** for PRs to close. The Warehouse Dashboard shows what's waiting.

### Meeting Points are Flexible
For cross-dock handovers, the meeting point is just a suggestion at planning time. Drivers confirm the exact location during execution (via phone coordination).

### Each Truck Has Its Own Route
In multi-vehicle loads, each truck can have a different route. Add/remove stops per truck using the edit panel. By default, all trucks clone the same route.

### Data Persists
Everything saves to your browser's local storage. Refresh → data is still there. To reset to fresh demo data: clear browser localStorage.

---

## Quick Reference — Status Colors

| Status | Color | Meaning |
|---|---|---|
| Pending | Orange | PR waiting for pickup |
| Planned | Blue | Assigned to a load + shipment |
| Picked Up | Blue | Material collected from client |
| Delivered | Green | Material reached destination |
| Closed | Green | All material at plant — done |
| Draft | Gray | Load/shipment being planned |
| In Transit | Blue | Truck is on the road |
| Completed | Green | All stops done |
| Feeder | Amber badge | Truck that hands over (cross-dock) |
| Line-Haul | Blue badge | Truck that receives + delivers |

---

*Built for Attero. March 2026.*
