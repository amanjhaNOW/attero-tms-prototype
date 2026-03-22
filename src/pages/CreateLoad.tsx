import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Boxes,
  MapPin,
  Package,
  Warehouse,
  ClipboardList,
  X,
  Search,
  Plus,
  ArrowRight,
  ChevronRight,
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

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface WarehouseSourceItem {
  prId: string;
  clientName: string;
  materials: { type: string; qty: number; unit: string }[];
  maxQty: number;
  daysWaiting: number;
  warehouseName: string;
  warehouseLocation: Location;
  inboundShipmentId: string;
}

type PickerMode = null | 'pr' | 'warehouse';

/* ────────────────────────────────────────────────────────────
 * Modal Overlay
 * ──────────────────────────────────────────────────────────── */

function ModalOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="relative mx-4 flex max-h-[75vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * CreateLoad Page
 * ──────────────────────────────────────────────────────────── */

export function CreateLoad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prIdsParam = searchParams.get('prs');
  const warehouseItemsParam = searchParams.get('warehouseItems');

  /* ── Store hooks ──────────────────────────────── */
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
    [locations],
  );

  /* ── Determine source context from URL ────────── */
  const hasWarehouseParam = !!warehouseItemsParam;
  const hasPRParam = !!prIdsParam;

  /* ── Destination state ────────────────────────── */
  const [destinationId, setDestinationId] = useState('LOC-001');

  /* ── Picker modal ─────────────────────────────── */
  const defaultPickerMode: PickerMode = hasWarehouseParam && !hasPRParam ? 'warehouse' : 'pr';
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Temp selections inside picker (committed on "Add Selected")
  const [tempPRIds, setTempPRIds] = useState<Set<string>>(new Set());
  const [tempWarehouseItems, setTempWarehouseItems] = useState<Record<string, number>>({});

  /* ── PR State ─────────────────────────────────── */
  const selectedPRIdsFromUrl = useMemo(() => {
    if (!prIdsParam) return new Set<string>();
    return new Set(prIdsParam.split(',').filter(Boolean));
  }, [prIdsParam]);

  const [selectedPRIds, setSelectedPRIds] = useState<Set<string>>(selectedPRIdsFromUrl);

  const pendingPRs = useMemo(() => {
    return allPRs.filter((pr) => pr.status === 'pending');
  }, [allPRs]);

  const selectedPRs: PickupRequest[] = useMemo(() => {
    return Array.from(selectedPRIds)
      .map((id) => allPRs.find((pr) => pr.id === id))
      .filter((pr): pr is PickupRequest => pr !== undefined);
  }, [selectedPRIds, allPRs]);

  /* ── Warehouse State ──────────────────────────── */
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
        const materials =
          stop.actualItems.length > 0
            ? stop.actualItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }))
            : stop.plannedItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }));

        const existing = prWarehouseData[stop.prId];
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
        Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

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

  const [selectedWarehouseItems, setSelectedWarehouseItems] = useState<
    Record<string, number>
  >(() => {
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

  /* ── Filtered lists for picker ────────────────── */
  const filteredPendingPRs = useMemo(() => {
    const available = pendingPRs.filter((pr) => !selectedPRIds.has(pr.id));
    if (!pickerSearch.trim()) return available;
    const q = pickerSearch.toLowerCase();
    return available.filter(
      (pr) =>
        pr.id.toLowerCase().includes(q) ||
        pr.clientName.toLowerCase().includes(q) ||
        pr.pickupLocation.city.toLowerCase().includes(q) ||
        pr.pickupLocation.state.toLowerCase().includes(q) ||
        pr.materials.some((m) => m.type.toLowerCase().includes(q)),
    );
  }, [pendingPRs, selectedPRIds, pickerSearch]);

  const filteredWarehouseItems = useMemo(() => {
    const available = warehouseSourceItems.filter(
      (item) => !(item.prId in selectedWarehouseItems),
    );
    if (!pickerSearch.trim()) return available;
    const q = pickerSearch.toLowerCase();
    return available.filter(
      (item) =>
        item.prId.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        item.warehouseName.toLowerCase().includes(q) ||
        item.materials.some((m) => m.type.toLowerCase().includes(q)),
    );
  }, [warehouseSourceItems, selectedWarehouseItems, pickerSearch]);

  /* ── Combined summary ─────────────────────────── */
  const prQty = selectedPRs.reduce(
    (sum, pr) => sum + pr.materials.reduce((s, m) => s + m.plannedQty, 0),
    0,
  );
  const whQty = Object.values(selectedWarehouseItems).reduce(
    (sum, q) => sum + q,
    0,
  );
  const totalQty = prQty + whQty;
  const totalSources =
    selectedPRIds.size + Object.keys(selectedWarehouseItems).length;
  const hasAnySources = totalSources > 0;

  const hasWarehouseSources = Object.keys(selectedWarehouseItems).length > 0;
  const pattern: string = hasWarehouseSources
    ? 'Warehouse Consolidation'
    : totalSources === 1
      ? 'Direct'
      : totalSources > 1
        ? 'Milk Run'
        : '—';

  const destinationLoc = useMemo(
    () => locations.find((l) => l.id === destinationId),
    [locations, destinationId],
  );

  /* ── Picker actions ───────────────────────────── */
  const openPicker = useCallback(
    (mode: 'pr' | 'warehouse') => {
      setPickerMode(mode);
      setPickerSearch('');
      setTempPRIds(new Set());
      setTempWarehouseItems({});
    },
    [],
  );

  const openDefaultPicker = useCallback(() => {
    openPicker(defaultPickerMode);
  }, [defaultPickerMode, openPicker]);

  const closePicker = useCallback(() => {
    setPickerMode(null);
    setPickerSearch('');
    setTempPRIds(new Set());
    setTempWarehouseItems({});
  }, []);

  const toggleTempPR = useCallback((prId: string) => {
    setTempPRIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) next.delete(prId);
      else next.add(prId);
      return next;
    });
  }, []);

  const toggleTempWarehouseItem = useCallback(
    (prId: string, maxQty: number) => {
      setTempWarehouseItems((prev) => {
        const next = { ...prev };
        if (prId in next) delete next[prId];
        else next[prId] = maxQty;
        return next;
      });
    },
    [],
  );

  const updateTempWarehouseQty = useCallback(
    (prId: string, qty: number) => {
      setTempWarehouseItems((prev) => ({ ...prev, [prId]: qty }));
    },
    [],
  );

  const commitPickerSelection = useCallback(() => {
    if (pickerMode === 'pr') {
      setSelectedPRIds((prev) => {
        const next = new Set(prev);
        tempPRIds.forEach((id) => next.add(id));
        return next;
      });
    } else if (pickerMode === 'warehouse') {
      setSelectedWarehouseItems((prev) => ({
        ...prev,
        ...tempWarehouseItems,
      }));
    }
    closePicker();
  }, [pickerMode, tempPRIds, tempWarehouseItems, closePicker]);

  const tempCount =
    pickerMode === 'pr'
      ? tempPRIds.size
      : Object.keys(tempWarehouseItems).length;

  /* ── Remove source ────────────────────────────── */
  const removePR = useCallback((prId: string) => {
    setSelectedPRIds((prev) => {
      const next = new Set(prev);
      next.delete(prId);
      return next;
    });
  }, []);

  const removeWarehouseItem = useCallback((prId: string) => {
    setSelectedWarehouseItems((prev) => {
      const next = { ...prev };
      delete next[prId];
      return next;
    });
  }, []);

  /* ── Create Load (same logic, untouched) ──────── */
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

    // PICKUP stops for PR sources
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

    // PICKUP stops for warehouse sources
    Object.entries(selectedWarehouseItems).forEach(([prId, qty]) => {
      const whItem = warehouseSourceItems.find((i) => i.prId === prId);
      if (!whItem) return;

      const pickupStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
      stopIdsForShipment.push(pickupStopId);
      if (!allPrIds.includes(prId)) allPrIds.push(prId);

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

    // DELIVER stop at destination
    const deliverStopId = `STOP-${String(stops.length + seq).padStart(3, '0')}`;
    stopIdsForShipment.push(deliverStopId);

    const allPlannedItems = [
      ...selectedPRs.flatMap((pr) =>
        pr.materials.map((m) => ({
          material: m.type,
          qty: m.plannedQty,
          unit: m.unit,
        })),
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

    const firstWhItem =
      Object.keys(selectedWarehouseItems).length > 0
        ? warehouseSourceItems.find(
            (i) => i.prId === Object.keys(selectedWarehouseItems)[0],
          )
        : null;

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

    let patternLabel: 'direct' | 'milk_run' | 'warehouse_consolidation' =
      totalSources === 1 ? 'direct' : 'milk_run';
    if (hasWarehouseSources) patternLabel = 'warehouse_consolidation';

    addLoad({
      id: loadId,
      prIds: allPrIds,
      shipmentIds: [shipId],
      destination: dest,
      totalPlannedQty: totalQty,
      totalActualQty: 0,
      documents: [],
      patternLabel,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });

    allPrIds.forEach((prId) => {
      const pr = allPRs.find((p) => p.id === prId);
      if (!pr) return;
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
    hasWarehouseSources,
    allPRs,
    addLoad,
    addShipment,
    addStop,
    updatePR,
    navigate,
  ]);

  /* ──────────────────────────────────────────────── */
  /*  RENDER                                          */
  /* ──────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Header */}
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
              Create Load →
            </button>
          ) : undefined
        }
      />

      {/* ── Source Cards ──────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-card">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Sources
          </h3>
          {hasAnySources && (
            <span className="text-xs font-medium text-text-muted">
              {totalSources} source{totalSources > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="px-5 pb-4 space-y-2">
          {/* PR source cards */}
          {selectedPRs.map((pr) => {
            const qty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
            const matSummary = pr.materials
              .map((m) => `${m.type} (${m.plannedQty.toLocaleString()} ${m.unit})`)
              .join(' · ');

            return (
              <div
                key={pr.id}
                className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300"
              >
                <span className="mt-0.5 text-base shrink-0">📋</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/pickup-requests/${pr.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {pr.id}
                    </Link>
                    <span className="text-sm text-text-primary font-medium">
                      · {pr.clientName}
                    </span>
                    <span className="text-sm text-text-muted">
                      · {pr.pickupLocation.city}, {pr.pickupLocation.state}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted truncate">
                    {matSummary}{' '}
                    <span className="font-semibold text-text-secondary">
                      — {qty.toLocaleString()} Kg total
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => removePR(pr.id)}
                  className="shrink-0 rounded p-1 text-text-muted opacity-60 hover:opacity-100 hover:text-danger hover:bg-danger-50 transition-all"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {/* Warehouse source cards */}
          {Object.entries(selectedWarehouseItems).map(([prId, qty]) => {
            const whItem = warehouseSourceItems.find((i) => i.prId === prId);
            if (!whItem) return null;
            const matSummary = whItem.materials
              .map((m) => `${m.type} (${m.qty.toLocaleString()} ${m.unit})`)
              .join(' · ');

            return (
              <div
                key={`wh-${prId}`}
                className="group flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-3 transition-colors hover:border-amber-300"
              >
                <span className="mt-0.5 text-base shrink-0">🏭</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/pickup-requests/${prId}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {prId}
                    </Link>
                    <span className="text-sm text-text-primary font-medium">
                      · {whItem.clientName}
                    </span>
                    <span className="text-sm text-text-muted">
                      · from {whItem.warehouseName}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted truncate">
                    {matSummary}{' '}
                    <span className="font-semibold text-text-secondary">
                      — {qty.toLocaleString()} Kg
                    </span>
                    <span className="ml-1 text-amber-600">
                      ({whItem.daysWaiting} day{whItem.daysWaiting !== 1 ? 's' : ''} at WH)
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => removeWarehouseItem(prId)}
                  className="shrink-0 rounded p-1 text-text-muted opacity-60 hover:opacity-100 hover:text-danger hover:bg-danger-50 transition-all"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {/* Empty state */}
          {!hasAnySources && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
              <Boxes className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-text-secondary">
                No sources selected yet
              </p>
              <p className="text-xs text-text-muted mt-1 mb-4 max-w-xs">
                Add pickup requests or warehouse material to create a load
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => openPicker('pr')}
                  className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary-50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary-100 transition-colors"
                >
                  <ClipboardList className="h-4 w-4" />
                  Add from Pickup Requests
                </button>
                <button
                  onClick={() => openPicker('warehouse')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Warehouse className="h-4 w-4" />
                  Add from Warehouse
                </button>
              </div>
            </div>
          )}

          {/* Add more button */}
          {hasAnySources && (
            <button
              onClick={openDefaultPicker}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm font-medium text-text-muted hover:text-primary hover:border-primary hover:bg-primary-50/50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add more
            </button>
          )}
        </div>
      </div>

      {/* ── Destination + Summary row ─────────────── */}
      {hasAnySources && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Destination */}
          <div className="rounded-xl border border-gray-200 bg-card px-5 py-4">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
              Destination
            </label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
            >
              {plantAndWarehouseLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.type === 'warehouse' ? '🏭' : '🏢'} {l.name} — {l.city},{' '}
                  {l.state}
                </option>
              ))}
            </select>
            {destinationLoc && (
              <p className="mt-1.5 text-xs text-text-muted truncate">
                {destinationLoc.address}
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-gray-200 bg-card px-5 py-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Summary
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-muted">
                  Pattern:{' '}
                  <span className="font-semibold text-primary">{pattern}</span>
                </span>
                <span className="text-text-muted">|</span>
                <span className="text-text-muted">
                  Total:{' '}
                  <span className="font-bold text-text-primary text-base">
                    {totalQty.toLocaleString()} Kg
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create button (bottom) ────────────────── */}
      {hasAnySources && (
        <div className="flex justify-end pt-1">
          <button
            onClick={handleCreateLoad}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-primary-600 hover:shadow-lg transition-all"
          >
            Create Load & Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════
       *  PICKER MODALS
       * ════════════════════════════════════════════════ */}

      {/* ── PR Picker ─────────────────────────────── */}
      <ModalOverlay open={pickerMode === 'pr'} onClose={closePicker}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-bold text-text-primary">
            Select Pickup Requests
          </h2>
          <button
            onClick={closePicker}
            className="rounded-lg p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search by PR ID, client, location..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
          {filteredPendingPRs.length > 0 ? (
            filteredPendingPRs.map((pr) => {
              const qty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
              const isChecked = tempPRIds.has(pr.id);
              return (
                <div
                  key={pr.id}
                  onClick={() => toggleTempPR(pr.id)}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    isChecked
                      ? 'border-primary bg-primary-50/50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary text-sm">
                          {pr.id}
                        </span>
                        <span className="text-sm text-text-primary">
                          {pr.clientName}
                        </span>
                        <span className="text-xs text-text-muted">
                          · {pr.materials.map((m) => m.type).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
                        <MapPin className="h-3 w-3" />
                        {pr.pickupLocation.city}, {pr.pickupLocation.state}
                        <span className="ml-auto font-bold text-text-primary text-sm">
                          {qty.toLocaleString()} Kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm text-text-muted">
              No pending pickup requests available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3">
          <button
            onClick={() => {
              setPickerMode('warehouse');
              setPickerSearch('');
              setTempPRIds(new Set());
              setTempWarehouseItems({});
            }}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            Or add from warehouse
            <ArrowRight className="h-3 w-3" />
          </button>
          <div className="flex items-center justify-between">
            <button
              onClick={closePicker}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={commitPickerSelection}
              disabled={tempPRIds.size === 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Selected ({tempPRIds.size}) →
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* ── Warehouse Picker ──────────────────────── */}
      <ModalOverlay open={pickerMode === 'warehouse'} onClose={closePicker}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-bold text-text-primary">
            Select Warehouse Material
          </h2>
          <button
            onClick={closePicker}
            className="rounded-lg p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search by PR, client, warehouse..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
          {filteredWarehouseItems.length > 0 ? (
            filteredWarehouseItems.map((item) => {
              const isChecked = item.prId in tempWarehouseItems;
              const selectedQty = tempWarehouseItems[item.prId] ?? item.maxQty;
              return (
                <div
                  key={item.prId}
                  className={`rounded-lg border p-3 transition-colors ${
                    isChecked
                      ? 'border-amber-400 bg-amber-50/40'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        toggleTempWarehouseItem(item.prId, item.maxQty)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() =>
                        toggleTempWarehouseItem(item.prId, item.maxQty)
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary text-sm">
                          {item.prId}
                        </span>
                        <span className="text-sm text-text-primary">
                          {item.clientName}
                        </span>
                        <span className="text-xs text-text-muted">
                          · {item.materials.map((m) => m.type).join(', ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                        <Warehouse className="h-3 w-3" />
                        {item.warehouseName}
                        <span>·</span>
                        <span className="font-bold text-text-primary text-sm">
                          {item.maxQty.toLocaleString()} Kg
                        </span>
                        <span>·</span>
                        <span className="text-amber-600">
                          {item.daysWaiting} day{item.daysWaiting !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {/* Qty input — only when checked */}
                    {isChecked && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          value={selectedQty}
                          min={1}
                          max={item.maxQty}
                          onChange={(e) =>
                            updateTempWarehouseQty(
                              item.prId,
                              Math.min(
                                item.maxQty,
                                Math.max(1, Number(e.target.value) || 0),
                              ),
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 rounded border border-gray-200 px-2 py-1 text-xs text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-[10px] text-text-muted whitespace-nowrap">
                          / {item.maxQty.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm text-text-muted">
              No warehouse material available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3">
          <button
            onClick={() => {
              setPickerMode('pr');
              setPickerSearch('');
              setTempPRIds(new Set());
              setTempWarehouseItems({});
            }}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            Or add from pickup requests
            <ArrowRight className="h-3 w-3" />
          </button>
          <div className="flex items-center justify-between">
            <button
              onClick={closePicker}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={commitPickerSelection}
              disabled={Object.keys(tempWarehouseItems).length === 0}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add Selected ({Object.keys(tempWarehouseItems).length}) →
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
