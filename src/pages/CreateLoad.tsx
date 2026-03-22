import { useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Boxes,
  MapPin,
  Package,
  Warehouse,
  ClipboardList,
  X,
  Search,
} from 'lucide-react';
import { PageHeader, EmptyState } from '@/components';
import {
  usePRStore,
  useLoadStore,
  useShipmentStore,
  useStopStore,
  useReferenceStore,
} from '@/stores';
import type { PickupRequest, Location } from '@/types';

/** Warehouse source item — a PR with material sitting at a warehouse */
interface WarehouseSourceItem {
  prId: string;
  clientName: string;
  materials: { type: string; qty: number; unit: string }[];
  maxQty: number; // how much is available at warehouse
  daysWaiting: number;
  warehouseName: string;
  warehouseLocation: Location;
  inboundShipmentId: string;
}

export function CreateLoad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prIdsParam = searchParams.get('prs');
  const warehouseItemsParam = searchParams.get('warehouseItems');

  const allPRs = usePRStore((s) => s.pickupRequests);
  const updatePR = usePRStore((s) => s.updatePR);
  const addLoad = useLoadStore((s) => s.addLoad);
  const loads = useLoadStore((s) => s.loads);
  const addShipment = useShipmentStore((s) => s.addShipment);
  const shipments = useShipmentStore((s) => s.shipments);
  const addStop = useStopStore((s) => s.addStop);
  const stops = useStopStore((s) => s.stops);
  const allStops = useStopStore((s) => s.stops);
  const allShipments = useShipmentStore((s) => s.shipments);
  const locations = useReferenceStore((s) => s.locations);

  const plantAndWarehouseLocations = useMemo(
    () => locations.filter((l) => l.type === 'plant' || l.type === 'warehouse'),
    [locations]
  );

  // Determine initial tab from URL params
  const hasWarehouseParam = !!warehouseItemsParam;
  const hasPRParam = !!prIdsParam;
  const [activeTab, setActiveTab] = useState<'prs' | 'warehouse'>(
    hasWarehouseParam && !hasPRParam ? 'warehouse' : 'prs'
  );

  // Default destination: if coming from warehouse, default to plant; otherwise LOC-001
  const [destinationId, setDestinationId] = useState(
    hasWarehouseParam ? 'LOC-001' : 'LOC-001'
  );

  const [prSearch, setPrSearch] = useState('');
  const [whSearch, setWhSearch] = useState('');

  // ─── PR Tab State ───────────────────────────────
  const selectedPRIdsFromUrl = useMemo(() => {
    if (!prIdsParam) return new Set<string>();
    return new Set(prIdsParam.split(',').filter(Boolean));
  }, [prIdsParam]);

  const [selectedPRIds, setSelectedPRIds] = useState<Set<string>>(selectedPRIdsFromUrl);

  const pendingPRs = useMemo(() => {
    return allPRs.filter((pr) => pr.status === 'pending');
  }, [allPRs]);

  const filteredPendingPRs = useMemo(() => {
    if (!prSearch.trim()) return pendingPRs;
    const q = prSearch.toLowerCase();
    return pendingPRs.filter(
      (pr) =>
        pr.id.toLowerCase().includes(q) ||
        pr.clientName.toLowerCase().includes(q) ||
        pr.materials.some((m) => m.type.toLowerCase().includes(q))
    );
  }, [pendingPRs, prSearch]);

  const selectedPRs: PickupRequest[] = useMemo(() => {
    return Array.from(selectedPRIds)
      .map((id) => allPRs.find((pr) => pr.id === id))
      .filter((pr): pr is PickupRequest => pr !== undefined);
  }, [selectedPRIds, allPRs]);

  const togglePR = useCallback((prId: string) => {
    setSelectedPRIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) {
        next.delete(prId);
      } else {
        next.add(prId);
      }
      return next;
    });
  }, []);

  // ─── Warehouse Tab State ────────────────────────
  // Calculate all warehouse source items (same logic as WarehouseDashboard)
  const warehouseSourceItems = useMemo(() => {
    const now = new Date();
    const prWarehouseData: Record<
      string,
      {
        qty: number;
        shipmentId: string;
        warehouseName: string;
        warehouseLocation: Location;
        arrivedAt: string;
        materials: { type: string; qty: number; unit: string }[];
      }
    > = {};
    const prPlantQty: Record<string, number> = {};

    allStops.forEach((stop) => {
      if (stop.type !== 'DELIVER' || stop.status !== 'completed' || !stop.prId)
        return;
      const shipment = allShipments.find((sh) => sh.id === stop.shipmentId);
      if (!shipment) return;
      const load = loads.find((l) => l.id === shipment.loadId);
      if (!load) return;

      if (load.destination.type === 'warehouse') {
        const existing = prWarehouseData[stop.prId];
        const materials =
          stop.actualItems.length > 0
            ? stop.actualItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }))
            : stop.plannedItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }));

        if (!existing) {
          prWarehouseData[stop.prId] = {
            qty: stop.totalActualQty,
            shipmentId: stop.shipmentId,
            warehouseName: load.destination.name,
            warehouseLocation: {
              name: load.destination.name,
              state: load.destination.state,
              city: load.destination.city,
              pin: load.destination.pin,
              address: load.destination.address,
            },
            arrivedAt: stop.completedAt ?? '',
            materials,
          };
        } else {
          prWarehouseData[stop.prId] = {
            ...existing,
            qty: existing.qty + stop.totalActualQty,
            materials: [...existing.materials, ...materials],
          };
        }
      } else if (load.destination.type === 'plant') {
        prPlantQty[stop.prId] = (prPlantQty[stop.prId] ?? 0) + stop.totalActualQty;
      }
    });

    const items: WarehouseSourceItem[] = [];
    Object.entries(prWarehouseData).forEach(([prId, whData]) => {
      const plantQty = prPlantQty[prId] ?? 0;
      const netAtWarehouse = whData.qty - plantQty;
      if (netAtWarehouse <= 0) return;

      const pr = allPRs.find((p) => p.id === prId);
      if (!pr) return;

      const arrivedDate = whData.arrivedAt ? new Date(whData.arrivedAt) : now;
      const daysWaiting = Math.max(
        0,
        Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Deduplicate materials
      const materialMap = new Map<string, { type: string; qty: number; unit: string }>();
      whData.materials.forEach((m) => {
        const existing = materialMap.get(m.type);
        if (existing) {
          existing.qty += m.qty;
        } else {
          materialMap.set(m.type, { ...m });
        }
      });

      items.push({
        prId,
        clientName: pr.clientName,
        materials: Array.from(materialMap.values()),
        maxQty: netAtWarehouse,
        daysWaiting,
        warehouseName: whData.warehouseName,
        warehouseLocation: whData.warehouseLocation,
        inboundShipmentId: whData.shipmentId,
      });
    });

    return items;
  }, [allStops, allShipments, loads, allPRs]);

  const filteredWarehouseItems = useMemo(() => {
    if (!whSearch.trim()) return warehouseSourceItems;
    const q = whSearch.toLowerCase();
    return warehouseSourceItems.filter(
      (item) =>
        item.prId.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        item.warehouseName.toLowerCase().includes(q) ||
        item.materials.some((m) => m.type.toLowerCase().includes(q))
    );
  }, [warehouseSourceItems, whSearch]);

  // Selected warehouse items with qty override
  const [selectedWarehouseItems, setSelectedWarehouseItems] = useState<
    Record<string, number>
  >(() => {
    // Parse from URL: warehouseItems=PRid:qty,PRid:qty
    if (!warehouseItemsParam) return {};
    const result: Record<string, number> = {};
    warehouseItemsParam.split(',').forEach((part) => {
      const [prId, qtyStr] = part.split(':');
      if (prId && qtyStr) {
        result[prId] = parseFloat(qtyStr);
      }
    });
    return result;
  });

  const toggleWarehouseItem = useCallback(
    (prId: string, maxQty: number) => {
      setSelectedWarehouseItems((prev) => {
        const next = { ...prev };
        if (prId in next) {
          delete next[prId];
        } else {
          next[prId] = maxQty;
        }
        return next;
      });
    },
    []
  );

  const updateWarehouseQty = useCallback(
    (prId: string, qty: number) => {
      setSelectedWarehouseItems((prev) => ({ ...prev, [prId]: qty }));
    },
    []
  );

  // ─── Combined Summary ───────────────────────────
  const prQty = selectedPRs.reduce(
    (sum, pr) => sum + pr.materials.reduce((s, m) => s + m.plannedQty, 0),
    0
  );
  const whQty = Object.values(selectedWarehouseItems).reduce(
    (sum, q) => sum + q,
    0
  );
  const totalQty = prQty + whQty;
  const totalSources =
    selectedPRIds.size + Object.keys(selectedWarehouseItems).length;

  const destinationLoc = useMemo(
    () => locations.find((l) => l.id === destinationId),
    [locations, destinationId]
  );

  // ─── Create Load ────────────────────────────────
  const handleCreateLoad = useCallback(() => {
    if (totalSources === 0 || !destinationLoc) return;

    const loadNum = loads.length + 1;
    const loadId = `LOAD-${String(loadNum).padStart(3, '0')}`;
    const shipNum = shipments.length + 1;
    const shipId = `SHP-${String(shipNum).padStart(3, '0')}`;

    const dest: Location & { type: 'plant' | 'warehouse' } = {
      name: destinationLoc.name,
      state: destinationLoc.state,
      city: destinationLoc.city,
      pin: destinationLoc.pin,
      address: destinationLoc.address,
      type: destinationLoc.type as 'plant' | 'warehouse',
    };

    const stopIdsForShipment: string[] = [];
    const allPrIds: string[] = [];
    let seq = 1;

    // Create PICKUP stops for PR sources (client locations)
    selectedPRs.forEach((pr) => {
      const pickupStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
      stopIdsForShipment.push(pickupStopId);
      allPrIds.push(pr.id);

      addStop({
        id: pickupStopId,
        shipmentId: shipId,
        sequence: seq,
        type: 'PICKUP',
        location: {
          name: pr.pickupLocation.name,
          state: pr.pickupLocation.state,
          city: pr.pickupLocation.city,
          pin: pr.pickupLocation.pin,
          address: pr.pickupLocation.address,
        },
        prId: pr.id,
        plannedItems: pr.materials.map((m) => ({
          material: m.type,
          qty: m.plannedQty,
          unit: m.unit,
        })),
        actualItems: [],
        totalActualQty: 0,
        status: 'pending',
      });
      seq += 1;
    });

    // Create PICKUP stops for warehouse sources (warehouse locations)
    Object.entries(selectedWarehouseItems).forEach(([prId, qty]) => {
      const whItem = warehouseSourceItems.find((i) => i.prId === prId);
      if (!whItem) return;

      const pickupStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
      stopIdsForShipment.push(pickupStopId);
      if (!allPrIds.includes(prId)) {
        allPrIds.push(prId);
      }

      // Proportionally allocate qty across materials
      const totalItemQty = whItem.materials.reduce((s, m) => s + m.qty, 0);
      const ratio = totalItemQty > 0 ? qty / totalItemQty : 1;

      addStop({
        id: pickupStopId,
        shipmentId: shipId,
        sequence: seq,
        type: 'PICKUP',
        location: {
          name: whItem.warehouseLocation.name,
          state: whItem.warehouseLocation.state,
          city: whItem.warehouseLocation.city,
          pin: whItem.warehouseLocation.pin,
          address: whItem.warehouseLocation.address,
        },
        prId,
        plannedItems: whItem.materials.map((m) => ({
          material: m.type,
          qty: Math.round(m.qty * ratio),
          unit: m.unit,
        })),
        actualItems: [],
        totalActualQty: 0,
        status: 'pending',
      });
      seq += 1;
    });

    // Create DELIVER stop at destination with ALL materials combined
    const deliverStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
    stopIdsForShipment.push(deliverStopId);

    const allPlannedItems = [
      ...selectedPRs.flatMap((pr) =>
        pr.materials.map((m) => ({
          material: m.type,
          qty: m.plannedQty,
          unit: m.unit,
        }))
      ),
      ...Object.entries(selectedWarehouseItems).flatMap(([prId, qty]) => {
        const whItem = warehouseSourceItems.find((i) => i.prId === prId);
        if (!whItem) return [];
        const totalItemQty = whItem.materials.reduce((s, m) => s + m.qty, 0);
        const ratio = totalItemQty > 0 ? qty / totalItemQty : 1;
        return whItem.materials.map((m) => ({
          material: m.type,
          qty: Math.round(m.qty * ratio),
          unit: m.unit,
        }));
      }),
    ];

    addStop({
      id: deliverStopId,
      shipmentId: shipId,
      sequence: seq,
      type: 'DELIVER',
      location: {
        name: dest.name,
        state: dest.state,
        city: dest.city,
        pin: dest.pin,
        address: dest.address,
      },
      prId: allPrIds.length === 1 ? allPrIds[0] : '',
      plannedItems: allPlannedItems,
      actualItems: [],
      totalActualQty: 0,
      linkedStopId: stopIdsForShipment[0],
      status: 'pending',
    });

    // Determine if any warehouse source needs parentShipmentId
    const firstWhItem = Object.keys(selectedWarehouseItems).length > 0
      ? warehouseSourceItems.find((i) => i.prId === Object.keys(selectedWarehouseItems)[0])
      : null;

    // Create shipment
    addShipment({
      id: shipId,
      loadId: loadId,
      scheduledPickupDate:
        selectedPRs[0]?.tentativePickupDate ??
        new Date().toISOString().split('T')[0],
      transportMode: 'carrier_third_party',
      transporterName: '',
      transporterGst: '',
      vehicleType: '',
      vehicleRegistration: '',
      driverName: '',
      driverPhone: '',
      stopIds: stopIdsForShipment,
      parentShipmentId: firstWhItem?.inboundShipmentId,
      shipmentValue: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    // Determine pattern
    const hasWarehouseSources = Object.keys(selectedWarehouseItems).length > 0;
    let pattern: 'direct' | 'milk_run' | 'warehouse_consolidation' =
      totalSources === 1 ? 'direct' : 'milk_run';
    if (hasWarehouseSources) {
      pattern = 'warehouse_consolidation';
    }

    // Create load
    addLoad({
      id: loadId,
      prIds: allPrIds,
      shipmentIds: [shipId],
      destination: dest,
      totalPlannedQty: totalQty,
      totalActualQty: 0,
      documents: [],
      patternLabel: pattern,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    // Update PRs
    allPrIds.forEach((prId) => {
      const pr = allPRs.find((p) => p.id === prId);
      if (!pr) return;
      // Only change status for fresh PRs from tab 1
      const updates: Partial<PickupRequest> = {
        loadIds: [...(pr.loadIds || []), loadId],
      };
      if (selectedPRIds.has(prId) && pr.status === 'pending') {
        updates.status = 'planned';
      }
      updatePR(prId, updates);
    });

    navigate(`/loads/${loadId}`);
  }, [
    totalSources,
    destinationLoc,
    loads.length,
    shipments.length,
    stops.length,
    totalQty,
    selectedPRs,
    selectedWarehouseItems,
    warehouseSourceItems,
    selectedPRIds,
    allPRs,
    addLoad,
    addShipment,
    addStop,
    updatePR,
    navigate,
  ]);

  // ─── No sources state ──────────────────────────
  const hasAnySources = totalSources > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Load"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Loads', href: '/loads' },
          { label: 'Create Load' },
        ]}
        actions={
          hasAnySources ? (
            <button
              onClick={handleCreateLoad}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
            >
              Create Load & Continue →
            </button>
          ) : undefined
        }
      />

      {/* Summary (only if sources exist) */}
      {hasAnySources && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
            <p className="text-sm text-text-muted">Sources</p>
            <p className="text-2xl font-bold text-text-primary">{totalSources}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {selectedPRIds.size > 0 && `${selectedPRIds.size} PR`}
              {selectedPRIds.size > 0 && Object.keys(selectedWarehouseItems).length > 0 && ' + '}
              {Object.keys(selectedWarehouseItems).length > 0 &&
                `${Object.keys(selectedWarehouseItems).length} WH`}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
            <p className="text-sm text-text-muted">Total Qty</p>
            <p className="text-2xl font-bold text-text-primary">
              {totalQty.toLocaleString()} Kg
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-card p-4 text-center">
            <p className="text-sm text-text-muted">Pattern</p>
            <p className="text-2xl font-bold text-primary capitalize">
              {Object.keys(selectedWarehouseItems).length > 0
                ? 'WH Consolidation'
                : totalSources === 1
                ? 'Direct'
                : 'Milk Run'}
            </p>
          </div>
        </div>
      )}

      {/* Source Tabs */}
      <div className="rounded-xl border border-gray-200 bg-card">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('prs')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'prs'
                ? 'border-primary text-primary bg-primary-50/50'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Pickup Requests
            {selectedPRIds.size > 0 && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary">
                {selectedPRIds.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'warehouse'
                ? 'border-primary text-primary bg-primary-50/50'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <Warehouse className="h-4 w-4" />
            Warehouse Material
            {Object.keys(selectedWarehouseItems).length > 0 && (
              <span className="rounded-full bg-warning-100 px-2 py-0.5 text-xs font-bold text-warning">
                {Object.keys(selectedWarehouseItems).length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* ─── PR Tab ─────────────────────── */}
          {activeTab === 'prs' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={prSearch}
                  onChange={(e) => setPrSearch(e.target.value)}
                  placeholder="Search pending PRs..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {filteredPendingPRs.length > 0 ? (
                <div className="space-y-2">
                  {filteredPendingPRs.map((pr) => {
                    const prQtyVal = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
                    const isSelected = selectedPRIds.has(pr.id);
                    return (
                      <div
                        key={pr.id}
                        onClick={() => togglePR(pr.id)}
                        className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary-50/50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary">
                                  {pr.id}
                                </span>
                                <span className="text-sm text-text-muted">
                                  ({pr.sourceRequestId})
                                </span>
                              </div>
                              <p className="text-sm font-medium text-text-primary">
                                {pr.clientName}
                              </p>
                              <div className="flex items-center gap-1 text-sm text-text-muted">
                                <MapPin className="h-3.5 w-3.5" />
                                {pr.pickupLocation.city},{' '}
                                {pr.pickupLocation.state}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-text-primary">
                              {prQtyVal.toLocaleString()} Kg
                            </p>
                            <div className="flex flex-wrap justify-end gap-1 mt-1">
                              {pr.materials.map((m, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                                >
                                  <Package className="inline h-3 w-3 mr-0.5" />
                                  {m.type} ({m.plannedQty} {m.unit})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No Pending PRs"
                  description="All pickup requests have been planned or completed."
                  icon={ClipboardList}
                />
              )}
            </div>
          )}

          {/* ─── Warehouse Tab ──────────────── */}
          {activeTab === 'warehouse' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={whSearch}
                  onChange={(e) => setWhSearch(e.target.value)}
                  placeholder="Search warehouse material..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {filteredWarehouseItems.length > 0 ? (
                <div className="space-y-2">
                  {filteredWarehouseItems.map((item) => {
                    const isSelected = item.prId in selectedWarehouseItems;
                    const selectedQty = selectedWarehouseItems[item.prId] ?? item.maxQty;
                    return (
                      <div
                        key={item.prId}
                        className={`rounded-lg border p-4 transition-colors ${
                          isSelected
                            ? 'border-warning bg-warning-50/30'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleWarehouseItem(item.prId, item.maxQty)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary">
                                  {item.prId}
                                </span>
                                <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold text-warning">
                                  🏭 WAREHOUSE
                                </span>
                              </div>
                              <p className="text-sm font-medium text-text-primary">
                                {item.clientName}
                              </p>
                              <div className="flex items-center gap-1 text-sm text-text-muted">
                                <Warehouse className="h-3.5 w-3.5" />
                                {item.warehouseName}
                              </div>
                              <p className="text-xs text-text-muted">
                                {item.daysWaiting} days at warehouse
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="flex flex-wrap justify-end gap-1">
                              {item.materials.map((m, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                                >
                                  {m.type} ({m.qty.toLocaleString()} {m.unit})
                                </span>
                              ))}
                            </div>
                            {isSelected && (
                              <div className="flex items-center justify-end gap-2">
                                <label className="text-xs text-text-muted">
                                  Qty:
                                </label>
                                <input
                                  type="number"
                                  value={selectedQty}
                                  min={1}
                                  max={item.maxQty}
                                  onChange={(e) =>
                                    updateWarehouseQty(
                                      item.prId,
                                      Math.min(
                                        item.maxQty,
                                        Math.max(1, Number(e.target.value) || 0)
                                      )
                                    )
                                  }
                                  className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-xs text-text-muted">
                                  / {item.maxQty.toLocaleString()} Kg
                                </span>
                              </div>
                            )}
                            {!isSelected && (
                              <p className="text-lg font-bold text-text-primary">
                                {item.maxQty.toLocaleString()} Kg
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No Material at Warehouses"
                  description="No completed warehouse deliveries found. Material appears here after being delivered to a warehouse."
                  icon={Warehouse}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Sources Panel (shows all selections from both tabs) */}
      {hasAnySources && (
        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-3">
          <h3 className="text-base font-semibold text-text-primary">
            Selected Sources ({totalSources})
          </h3>
          <div className="space-y-2">
            {selectedPRs.map((pr) => {
              const prQtyVal = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
              return (
                <div
                  key={pr.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📋</span>
                    <div>
                      <Link
                        to={`/pickup-requests/${pr.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {pr.id}
                      </Link>
                      <span className="text-xs text-text-muted ml-2">
                        {pr.clientName} · {pr.pickupLocation.city}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">
                      {prQtyVal.toLocaleString()} Kg
                    </span>
                    <button
                      onClick={() => togglePR(pr.id)}
                      className="rounded p-1 text-text-muted hover:text-danger hover:bg-danger-50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {Object.entries(selectedWarehouseItems).map(([prId, qty]) => {
              const whItem = warehouseSourceItems.find((i) => i.prId === prId);
              return (
                <div
                  key={`wh-${prId}`}
                  className="flex items-center justify-between rounded-lg border border-warning-200 bg-warning-50/30 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏭</span>
                    <div>
                      <Link
                        to={`/pickup-requests/${prId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {prId}
                      </Link>
                      <span className="text-xs text-text-muted ml-2">
                        {whItem?.clientName} · {whItem?.warehouseName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">
                      {qty.toLocaleString()} Kg
                    </span>
                    <button
                      onClick={() => toggleWarehouseItem(prId, whItem?.maxQty ?? qty)}
                      className="rounded p-1 text-text-muted hover:text-danger hover:bg-danger-50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Destination Picker */}
      <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Destination</h3>
        <select
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {plantAndWarehouseLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.type === 'warehouse' ? '🏭 ' : '🏢 '}
              {l.name} ({l.type}) — {l.city}, {l.state}
            </option>
          ))}
        </select>
        {destinationLoc && (
          <p className="text-sm text-text-muted">{destinationLoc.address}</p>
        )}
      </div>

      {/* Create button (bottom) */}
      {hasAnySources && (
        <div className="flex justify-end">
          <button
            onClick={handleCreateLoad}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
          >
            Create Load & Continue →
          </button>
        </div>
      )}

      {/* Empty state when nothing selected */}
      {!hasAnySources && (
        <EmptyState
          title="Select Sources to Create a Load"
          description="Use the tabs above to select Pickup Requests or Warehouse Material, then choose a destination."
          icon={Boxes}
        />
      )}
    </div>
  );
}
