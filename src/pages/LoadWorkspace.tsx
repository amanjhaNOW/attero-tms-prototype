import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Truck,
  Check,
  AlertTriangle,
  Plus,
  Warehouse,
  ClipboardList,
  Save,
} from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge, PRPickerModal, WarehousePickerModal } from '@/components';
import { FlowDiagram, ShipmentExpandPanel } from '@/components/flow';
import {
  useLoadStore,
  useShipmentStore,
  useStopStore,
  usePRStore,
  useReferenceStore,
  planShipment,
  addShipmentToLoad,
  addLineHaulToLoad,
  addEmptyShipmentToLoad,
} from '@/stores';
import { addPRsToLoad, removePRFromLoad, changeLoadDestination } from '@/lib/createLoadHelper';
import type { Shipment } from '@/types';

export function LoadWorkspace() {
  const { id } = useParams<{ id: string }>();
  const allLoads = useLoadStore((s) => s.loads);
  const allShipments = useShipmentStore((s) => s.shipments);
  const updateShipment = useShipmentStore((s) => s.updateShipment);
  const allStops = useStopStore((s) => s.stops);
  const updateStop = useStopStore((s) => s.updateStop);
  const prs = usePRStore((s) => s.pickupRequests);
  const transporters = useReferenceStore((s) => s.transporters);
  const vehicles = useReferenceStore((s) => s.vehicles);
  const locations = useReferenceStore((s) => s.locations);

  const load = useMemo(() => allLoads.find((l) => l.id === id), [allLoads, id]);
  const shipments = useMemo(() => allShipments.filter((sh) => sh.loadId === id), [allShipments, id]);
  const loadStops = useMemo(
    () => allStops.filter((s) => shipments.some((sh) => sh.id === s.shipmentId)),
    [allStops, shipments],
  );
  const linkedPRs = useMemo(
    () => (load ? load.prIds.map((prId) => prs.find((pr) => pr.id === prId)).filter(Boolean) : []),
    [load?.prIds, prs],
  );

  // BUG 6: Detect PRs with no PICKUP stop on any shipment in this load
  const unconnectedPRs = useMemo(() => {
    if (!load) return [];
    return linkedPRs.filter((pr) => {
      if (!pr) return false;
      const hasPickup = allStops.some(
        (s) =>
          s.prId === pr.id &&
          s.type === 'PICKUP' &&
          shipments.some((sh) => sh.id === s.shipmentId),
      );
      return !hasPickup;
    });
  }, [linkedPRs, allStops, shipments, load]);

  // Picker modals
  const [prPickerOpen, setPRPickerOpen] = useState(false);
  const [whPickerOpen, setWHPickerOpen] = useState(false);

  // Add Truck dropdown menu
  const [showAddTruckMenu, setShowAddTruckMenu] = useState(false);
  const addTruckMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showAddTruckMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addTruckMenuRef.current && !addTruckMenuRef.current.contains(e.target as Node)) {
        setShowAddTruckMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddTruckMenu]);

  // Shipment expand panel (accordion — one at a time)
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);

  // Local form state for editing shipment details
  const [shipmentEdits, setShipmentEdits] = useState<
    Record<
      string,
      {
        transporterName: string;
        transporterGst: string;
        vehicleRegistration: string;
        vehicleType: string;
        driverName: string;
        driverPhone: string;
        transportMode: 'carrier_third_party' | 'fleet_own';
      }
    >
  >({});

  const getShipmentEdit = useCallback(
    (sh: Shipment) => {
      if (shipmentEdits[sh.id]) return shipmentEdits[sh.id];
      return {
        transporterName: sh.transporterName,
        transporterGst: sh.transporterGst,
        vehicleRegistration: sh.vehicleRegistration,
        vehicleType: sh.vehicleType,
        driverName: sh.driverName,
        driverPhone: sh.driverPhone,
        transportMode: sh.transportMode,
      };
    },
    [shipmentEdits],
  );

  const updateEditField = useCallback(
    (shipId: string, field: string, value: string) => {
      setShipmentEdits((prev) => {
        const sh = shipments.find((s) => s.id === shipId);
        const current = prev[shipId] ?? {
          transporterName: sh?.transporterName ?? '',
          transporterGst: sh?.transporterGst ?? '',
          vehicleRegistration: sh?.vehicleRegistration ?? '',
          vehicleType: sh?.vehicleType ?? '',
          driverName: sh?.driverName ?? '',
          driverPhone: sh?.driverPhone ?? '',
          transportMode: sh?.transportMode ?? 'carrier_third_party',
        };
        return { ...prev, [shipId]: { ...current, [field]: value } };
      });
    },
    [shipments],
  );

  if (!load) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Load Workspace"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Loads', href: '/loads' },
            { label: id ?? 'Unknown' },
          ]}
        />
        <EmptyState
          title="Load Not Found"
          description={`No load found with ID ${id}`}
          icon={FileText}
          action={
            <Link
              to="/loads"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Back to Loads
            </Link>
          }
        />
      </div>
    );
  }

  const totalPlannedQty = load.totalPlannedQty;
  const patternDisplay = load.patternLabel.replace(/_/g, ' ');
  const isDraft = load.status === 'draft';
  const canAddShipment = load.status !== 'completed' && load.status !== 'in_execution';
  const excludePRIds = new Set(load.prIds);

  const canPlanAll =
    shipments.length > 0 &&
    shipments.every((sh) => {
      const edit = getShipmentEdit(sh);
      return (
        sh.status === 'draft' &&
        edit.vehicleRegistration &&
        edit.driverName &&
        edit.transporterName
      );
    });

  // ── Handlers ─────────────────────────────────

  const handleAddPRs = useCallback(
    (prIds: string[]) => {
      if (!id) return;
      addPRsToLoad(id, prIds);
    },
    [id],
  );

  const handleRemovePR = useCallback(
    (prId: string) => {
      if (!id) return;
      removePRFromLoad(id, prId);
    },
    [id],
  );

  const handleAddShipment = useCallback(() => {
    if (!id) return;
    addShipmentToLoad(id);
  }, [id]);

  const handleSaveShipment = useCallback(
    (shipId: string) => {
      const edit = shipmentEdits[shipId];
      if (!edit) return;
      updateShipment(shipId, {
        transporterName: edit.transporterName,
        transporterGst: edit.transporterGst,
        vehicleRegistration: edit.vehicleRegistration,
        vehicleType: edit.vehicleType,
        driverName: edit.driverName,
        driverPhone: edit.driverPhone,
        transportMode: edit.transportMode,
      });
    },
    [shipmentEdits, updateShipment],
  );

  const handleMarkPlanned = useCallback(
    (shipId: string) => {
      handleSaveShipment(shipId);
      planShipment(shipId);
      setExpandedShipmentId(null);
    },
    [handleSaveShipment],
  );

  const handlePlanAll = useCallback(() => {
    shipments.forEach((sh) => {
      if (sh.status === 'draft') {
        handleSaveShipment(sh.id);
        planShipment(sh.id);
      }
    });
  }, [shipments, handleSaveShipment]);

  const handleMoveStop = useCallback(
    (shipmentId: string, stopId: string, direction: 'up' | 'down') => {
      const shipStops = allStops
        .filter((s) => s.shipmentId === shipmentId)
        .sort((a, b) => a.sequence - b.sequence);
      const pickupStops = shipStops.filter((s) => s.type === 'PICKUP');
      const idx = pickupStops.findIndex((s) => s.id === stopId);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= pickupStops.length) return;
      const seqA = pickupStops[idx].sequence;
      const seqB = pickupStops[swapIdx].sequence;
      updateStop(pickupStops[idx].id, { sequence: seqB });
      updateStop(pickupStops[swapIdx].id, { sequence: seqA });
    },
    [allStops, updateStop],
  );

  const handleShipmentClick = useCallback(
    (shipmentId: string) => {
      setExpandedShipmentId((prev) => (prev === shipmentId ? null : shipmentId));
    },
    [],
  );

  // Get expanded shipment data
  const expandedShipment = useMemo(
    () => (expandedShipmentId ? shipments.find((s) => s.id === expandedShipmentId) : null),
    [expandedShipmentId, shipments],
  );

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <PageHeader
        title=""
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Loads', href: '/loads' },
          { label: load.id },
        ]}
      />

      {/* ── A. Compact Info Bar ──────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-card px-5 py-3">
        <span className="text-lg font-bold text-text-primary">{load.id}</span>
        <StatusBadge status={load.status} />
        <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
          {patternDisplay}
        </span>
        <span className="text-sm text-text-muted">·</span>
        <span className="text-sm font-semibold text-text-primary">
          {totalPlannedQty.toLocaleString()} Kg
        </span>
        <span className="text-sm text-text-muted">·</span>
        <span className="text-sm text-text-muted">
          {load.prIds.length} PR{load.prIds.length !== 1 ? 's' : ''}
        </span>
        <span className="text-sm text-text-muted">·</span>
        <span className="text-sm text-text-muted">
          {shipments.length} Shipment{shipments.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isDraft && (
            <button
              onClick={() => {/* Save is implicit — Zustand state is always current. Show feedback. */
                const el = document.getElementById('save-feedback');
                if (el) { el.textContent = '✅ Saved'; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2000); }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-text-secondary shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          )}
          {canPlanAll && isDraft && (
            <button
              onClick={handlePlanAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-success/90 transition-colors"
            >
              <Check className="h-4 w-4" />
              Plan All
            </button>
          )}
          <span id="save-feedback" className="hidden text-sm text-success font-medium"></span>
        </div>
      </div>

      {/* ── B. Action Buttons ────────────────────── */}
      {isDraft && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPRPickerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-text-muted hover:text-primary hover:border-primary hover:bg-primary-50/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add PR
          </button>
          <button
            onClick={() => setWHPickerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 px-3 py-2 text-xs font-medium text-text-muted hover:text-amber-700 hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
          >
            <Warehouse className="h-3.5 w-3.5" />
            Add from Warehouse
          </button>
          {canAddShipment && load.prIds.length > 0 && (
            <div className="relative" ref={addTruckMenuRef}>
              <button
                onClick={() => setShowAddTruckMenu((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary-300 px-3 py-2 text-xs font-medium text-text-muted hover:text-primary hover:border-primary hover:bg-primary-50/50 transition-colors"
              >
                <Truck className="h-3.5 w-3.5" />
                Add Truck ▾
              </button>
              {showAddTruckMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-30 w-72 animate-in slide-in-from-top-1">
                  <button
                    onClick={() => {
                      handleAddShipment();
                      setShowAddTruckMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-primary-50 transition-colors group"
                  >
                    <span className="text-base">🚛</span>
                    <div>
                      <span className="font-semibold text-text-primary group-hover:text-primary">
                        Same Route
                      </span>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Clone current pickups — another truck, same route
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (id) addLineHaulToLoad(id);
                      setShowAddTruckMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-base">📥</span>
                    <div>
                      <span className="font-semibold text-text-primary group-hover:text-blue-700">
                        Line-Haul
                      </span>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Deliver only — for cross-dock, connect feeders to it
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (id) addEmptyShipmentToLoad(id);
                      setShowAddTruckMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-base">📦</span>
                    <div>
                      <span className="font-semibold text-text-primary group-hover:text-text-primary">
                        Empty Truck
                      </span>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        No stops — build route manually using connections
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── C. FLOW DIAGRAM — THE HERO ───────────── */}
      {(linkedPRs.length > 0 || shipments.length > 0) ? (
        <FlowDiagram
          load={load}
          shipments={shipments}
          stops={loadStops}
          prs={linkedPRs.filter((pr): pr is NonNullable<typeof pr> => pr != null)}
          onShipmentClick={handleShipmentClick}
          selectedShipmentId={expandedShipmentId ?? undefined}
          onRemoveSource={handleRemovePR}
          isDraft={isDraft}
        />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-card p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">🔀</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              No sources added yet
            </h3>
            <p className="text-xs text-text-muted max-w-xs">
              Add pickup requests or warehouse material to see the visual flow diagram.
              The diagram will show sources, shipments, and destination with connecting arrows.
            </p>
            {isDraft && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setPRPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-600 transition-colors"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Add Pickup Request
                </button>
                <button
                  onClick={() => setWHPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Warehouse className="h-3.5 w-3.5" />
                  Add from Warehouse
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── C2. Unconnected PR Warning ────────────── */}
      {unconnectedPRs.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong>{unconnectedPRs.length} PR{unconnectedPRs.length !== 1 ? 's have' : ' has'} no pickup assigned:</strong>{' '}
            {unconnectedPRs.map((pr) => pr?.id).filter(Boolean).join(', ')}.{' '}
            Connect them to a truck or remove from load.
          </span>
        </div>
      )}

      {/* ── D. Shipment Expand Panel (accordion) ─── */}
      {expandedShipment && (
        <ShipmentExpandPanel
          shipment={expandedShipment}
          allStops={allStops}
          prs={prs}
          transporters={transporters}
          vehicles={vehicles}
          allShipments={allShipments}
          editState={getShipmentEdit(expandedShipment)}
          onEditField={(field, value) => updateEditField(expandedShipment.id, field, value)}
          onMoveStop={(stopId, direction) => handleMoveStop(expandedShipment.id, stopId, direction)}
          onSave={() => handleSaveShipment(expandedShipment.id)}
          onMarkPlanned={() => handleMarkPlanned(expandedShipment.id)}
          onClose={() => setExpandedShipmentId(null)}
        />
      )}

      {/* ── Plan All (bottom, when applicable) ───── */}
      {canPlanAll && (isDraft || load.status === 'partially_planned') && (
        <div className="flex justify-center pt-1">
          <button
            onClick={handlePlanAll}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary-600 hover:shadow-lg transition-all"
          >
            <Check className="h-4 w-4" />
            Plan All Shipments
          </button>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}

      {/* PR Picker */}
      <PRPickerModal
        open={prPickerOpen}
        onClose={() => setPRPickerOpen(false)}
        excludeIds={excludePRIds}
        onSelect={handleAddPRs}
        onSwitchToWarehouse={() => {
          setPRPickerOpen(false);
          setWHPickerOpen(true);
        }}
      />

      {/* Warehouse Picker */}
      <WarehousePickerModal
        open={whPickerOpen}
        onClose={() => setWHPickerOpen(false)}
        excludeIds={excludePRIds}
        onSelect={(items) => {
          const prIds = items.map((i) => i.prId);
          if (id) addPRsToLoad(id, prIds);
        }}
        onSwitchToPR={() => {
          setWHPickerOpen(false);
          setPRPickerOpen(true);
        }}
      />
    </div>
  );
}
