import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Truck,
  Check,
  AlertTriangle,
  Plus,
  X,
  ClipboardList,
  Warehouse,
  Pencil,
  GripVertical,
  ArrowUp as MoveUp,
  ArrowDown as MoveDown,
} from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge, PRPickerModal, WarehousePickerModal, ModalOverlay } from '@/components';
import {
  useLoadStore,
  useShipmentStore,
  useStopStore,
  usePRStore,
  useReferenceStore,
  planShipment,
  addShipmentToLoad,
} from '@/stores';
import { addPRsToLoad, removePRFromLoad, changeLoadDestination } from '@/lib/createLoadHelper';
import type { Shipment, Stop } from '@/types';

/* ────────────────────────────────────────────────────────────
 * Main LoadWorkspace
 * ──────────────────────────────────────────────────────────── */

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

  // Picker modals
  const [prPickerOpen, setPRPickerOpen] = useState(false);
  const [whPickerOpen, setWHPickerOpen] = useState(false);

  // Shipment edit modal
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);

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

  const plantAndWarehouseLocations = useMemo(
    () => locations.filter((l) => l.type === 'plant' || l.type === 'warehouse'),
    [locations],
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

  const linkedPRs = useMemo(
    () => load.prIds.map((prId) => prs.find((pr) => pr.id === prId)).filter(Boolean),
    [load.prIds, prs],
  );

  const totalPlannedQty = load.totalPlannedQty;
  const patternDisplay = load.patternLabel.replace(/_/g, ' ');

  const canPlanAll = shipments.length > 0 && shipments.every((sh) => {
    const edit = getShipmentEdit(sh);
    return (
      sh.status === 'draft' &&
      edit.vehicleRegistration &&
      edit.driverName &&
      edit.transporterName
    );
  });

  const canAddShipment = load.status !== 'completed' && load.status !== 'in_execution';
  const isDraft = load.status === 'draft';
  const excludePRIds = useMemo(() => new Set(load.prIds), [load.prIds]);

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

  const handleDestinationChange = useCallback(
    (destId: string) => {
      if (!id) return;
      changeLoadDestination(id, destId);
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
      setEditingShipmentId(null);
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

  // Current destination location ID
  const currentDestId = useMemo(() => {
    return plantAndWarehouseLocations.find(
      (l) => l.name === load.destination.name && l.type === load.destination.type,
    )?.id ?? '';
  }, [plantAndWarehouseLocations, load.destination]);

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
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-card px-5 py-3">
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
          {canPlanAll && isDraft && (
            <button
              onClick={handlePlanAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-success/90 transition-colors"
            >
              <Check className="h-4 w-4" />
              Plan All
            </button>
          )}
        </div>
      </div>

      {/* ── B. Sources + C. Destination Row ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sources */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Sources
            </h3>
            <span className="text-xs text-text-muted">
              {load.prIds.length} source{load.prIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {linkedPRs.map((pr) => {
              if (!pr) return null;
              const qty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
              const matSummary = pr.materials
                .map((m) => `${m.type} ${(m.plannedQty / 1000).toFixed(1)}T`)
                .join(', ');

              return (
                <div
                  key={pr.id}
                  className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors hover:border-gray-300"
                >
                  <span className="text-base shrink-0">📋</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/pickup-requests/${pr.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {pr.id}
                      </Link>
                      <span className="text-sm font-medium text-text-primary">
                        · {pr.clientName}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      {matSummary} — {qty.toLocaleString()} Kg
                    </p>
                  </div>
                  {isDraft && (
                    <button
                      onClick={() => handleRemovePR(pr.id)}
                      className="shrink-0 rounded p-1 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-50 transition-all"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Empty state for sources */}
            {load.prIds.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
                <ClipboardList className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm text-text-muted">No sources yet</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Add pickup requests or warehouse material
                </p>
              </div>
            )}

            {/* Add source buttons */}
            {isDraft && (
              <div className="flex gap-2 pt-1">
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
              </div>
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="rounded-xl border border-gray-200 bg-card p-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Destination
          </h3>
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">
              {load.destination.type === 'plant' ? '🏢' : '🏭'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {load.destination.name}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {load.destination.city}, {load.destination.state}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 truncate">
                {load.destination.address}
              </p>
            </div>
          </div>
          {isDraft && (
            <select
              value={currentDestId}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
            >
              {plantAndWarehouseLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.type === 'warehouse' ? '🏭' : '🏢'} {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── D. Shipments Section ─────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Shipments
          </h3>
          <span className="text-xs text-text-muted">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-2">
          {shipments.map((sh) => {
            const shipStops = allStops
              .filter((s) => s.shipmentId === sh.id)
              .sort((a, b) => a.sequence - b.sequence);
            const pickupStops = shipStops.filter((s) => s.type === 'PICKUP');
            const deliverStops = shipStops.filter((s) => s.type === 'DELIVER');
            const edit = getShipmentEdit(sh);
            const isReady = edit.vehicleRegistration && edit.driverName && edit.transporterName;

            return (
              <div
                key={sh.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300"
              >
                <Truck className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/shipments/${sh.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {sh.id}
                    </Link>
                    <StatusBadge status={sh.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                    <span>
                      {pickupStops.length} pickup{pickupStops.length !== 1 ? 's' : ''} → {deliverStops.length} delivery
                    </span>
                    <span>·</span>
                    <span>
                      Vehicle: {edit.vehicleRegistration || '—'}
                    </span>
                    <span>·</span>
                    <span>
                      Driver: {edit.driverName || '—'}
                    </span>
                    <span>·</span>
                    {isReady ? (
                      <span className="flex items-center gap-0.5 text-success font-medium">
                        <Check className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-warning font-medium">
                        <AlertTriangle className="h-3 w-3" /> Not ready
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setEditingShipmentId(sh.id)}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-50 hover:text-primary transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5 inline mr-1" />
                  Edit
                </button>
              </div>
            );
          })}

          {shipments.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-6 text-center">
              <Truck className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-text-muted">No shipments yet</p>
              <p className="text-xs text-text-muted mt-0.5">
                {load.prIds.length === 0
                  ? 'Add sources first to create shipments'
                  : 'Shipments will appear when sources are added'}
              </p>
            </div>
          )}

          {/* Add Shipment button */}
          {canAddShipment && (
            <button
              onClick={handleAddShipment}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 py-2.5 text-xs font-medium text-text-muted hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Shipment (Multi-Vehicle)
            </button>
          )}
        </div>
      </div>

      {/* ── Plan All (bottom) ────────────────────── */}
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
          // For warehouse items, we use addPRsToLoad for simplicity
          // (the warehouse items resolve to their PR IDs)
          const prIds = items.map((i) => i.prId);
          if (id) addPRsToLoad(id, prIds);
        }}
        onSwitchToPR={() => {
          setWHPickerOpen(false);
          setPRPickerOpen(true);
        }}
      />

      {/* ── E. Shipment Edit Modal ───────────────── */}
      {editingShipmentId && (
        <ShipmentEditModal
          shipmentId={editingShipmentId}
          onClose={() => setEditingShipmentId(null)}
          allStops={allStops}
          prs={prs}
          transporters={transporters}
          vehicles={vehicles}
          getShipmentEdit={getShipmentEdit}
          updateEditField={updateEditField}
          handleMoveStop={handleMoveStop}
          handleSaveShipment={handleSaveShipment}
          handleMarkPlanned={handleMarkPlanned}
          shipments={shipments}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Shipment Edit Modal
 * ──────────────────────────────────────────────────────────── */

function ShipmentEditModal({
  shipmentId,
  onClose,
  allStops,
  prs,
  transporters,
  vehicles,
  getShipmentEdit,
  updateEditField,
  handleMoveStop,
  handleSaveShipment,
  handleMarkPlanned,
  shipments,
}: {
  shipmentId: string;
  onClose: () => void;
  allStops: Stop[];
  prs: { id: string; clientName: string; materials: { type: string; plannedQty: number; unit: string }[] }[];
  transporters: { id: string; name: string; gstNumber: string; type: string }[];
  vehicles: { id: string; registration: string; type: string; capacityKg: number; transporterId: string }[];
  getShipmentEdit: (sh: Shipment) => {
    transporterName: string;
    transporterGst: string;
    vehicleRegistration: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    transportMode: 'carrier_third_party' | 'fleet_own';
  };
  updateEditField: (shipId: string, field: string, value: string) => void;
  handleMoveStop: (shipmentId: string, stopId: string, direction: 'up' | 'down') => void;
  handleSaveShipment: (shipId: string) => void;
  handleMarkPlanned: (shipId: string) => void;
  shipments: Shipment[];
}) {
  const sh = useMemo(() => shipments.find((s) => s.id === shipmentId), [shipments, shipmentId]);
  const edit = useMemo(() => (sh ? getShipmentEdit(sh) : null), [sh, getShipmentEdit]);

  const shipStops = useMemo(
    () =>
      allStops
        .filter((s) => s.shipmentId === shipmentId)
        .sort((a, b) => a.sequence - b.sequence),
    [allStops, shipmentId],
  );
  const pickupStops = useMemo(() => shipStops.filter((s) => s.type === 'PICKUP'), [shipStops]);
  const deliverStops = useMemo(() => shipStops.filter((s) => s.type === 'DELIVER'), [shipStops]);

  const isReady = edit
    ? edit.vehicleRegistration && edit.driverName && edit.transporterName
    : false;

  if (!sh || !edit) return null;

  // Filter vehicles by selected transporter
  const selectedTransporter = transporters.find((t) => t.name === edit.transporterName);
  const filteredVehicles = selectedTransporter
    ? vehicles.filter((v) => v.transporterId === selectedTransporter.id)
    : vehicles;

  return (
    <ModalOverlay open onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-bold text-text-primary">
          {sh.id} — Edit Shipment
        </h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Transportation */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Transportation
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {/* Transport Mode */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Mode</label>
              <select
                value={edit.transportMode}
                onChange={(e) => updateEditField(sh.id, 'transportMode', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="carrier_third_party">Carrier (Third-Party)</option>
                <option value="fleet_own">Fleet (Own)</option>
              </select>
            </div>

            {/* Transporter */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                Transporter
                {edit.transporterName ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-warning" />
                )}
              </label>
              <select
                value={
                  transporters.find((t) => t.name === edit.transporterName)?.id ?? ''
                }
                onChange={(e) => {
                  const t = transporters.find((tr) => tr.id === e.target.value);
                  if (t) {
                    updateEditField(sh.id, 'transporterName', t.name);
                    updateEditField(sh.id, 'transporterGst', t.gstNumber);
                    updateEditField(
                      sh.id,
                      'transportMode',
                      t.type === 'in_house' ? 'fleet_own' : 'carrier_third_party',
                    );
                    updateEditField(sh.id, 'vehicleRegistration', '');
                    updateEditField(sh.id, 'vehicleType', '');
                  }
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select transporter...</option>
                {transporters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                Vehicle
                {edit.vehicleRegistration ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-warning" />
                )}
              </label>
              <select
                value={filteredVehicles.find((v) => v.registration === edit.vehicleRegistration)?.id ?? ''}
                onChange={(e) => {
                  const v = filteredVehicles.find((veh) => veh.id === e.target.value);
                  if (v) {
                    updateEditField(sh.id, 'vehicleRegistration', v.registration);
                    updateEditField(sh.id, 'vehicleType', v.type);
                  } else {
                    updateEditField(sh.id, 'vehicleRegistration', '');
                    updateEditField(sh.id, 'vehicleType', '');
                  }
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select vehicle...</option>
                {filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration} — {v.type} ({v.capacityKg.toLocaleString()} Kg)
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Name */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs font-medium text-text-secondary">
                Driver
                {edit.driverName ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-warning" />
                )}
              </label>
              <input
                type="text"
                value={edit.driverName}
                onChange={(e) => updateEditField(sh.id, 'driverName', e.target.value)}
                placeholder="Driver name..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Driver Phone */}
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-text-secondary">Phone</label>
              <input
                type="tel"
                value={edit.driverPhone}
                onChange={(e) => updateEditField(sh.id, 'driverPhone', e.target.value)}
                placeholder="+91 98..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Stops */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Stops ({pickupStops.length} pickup{pickupStops.length !== 1 ? 's' : ''} → {deliverStops.length} delivery)
          </h4>
          <div className="space-y-1.5">
            {shipStops.map((stop) => {
              const isPickup = stop.type === 'PICKUP';
              const pickupIdx = isPickup ? pickupStops.findIndex((s) => s.id === stop.id) : -1;
              const canMoveUp = isPickup && pickupIdx > 0;
              const canMoveDown = isPickup && pickupIdx < pickupStops.length - 1;
              const pr = isPickup ? prs.find((p) => p.id === stop.prId) : null;
              const isDeliver = stop.type === 'DELIVER';

              return (
                <div
                  key={stop.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${
                    isDeliver
                      ? 'bg-success-50 border border-success-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Reorder controls */}
                  {isPickup && pickupStops.length > 1 ? (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMoveStop(sh.id, stop.id, 'up')}
                        disabled={!canMoveUp}
                        className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <MoveUp className="h-3 w-3" />
                      </button>
                      <GripVertical className="h-3 w-3 text-gray-300 mx-auto" />
                      <button
                        onClick={() => handleMoveStop(sh.id, stop.id, 'down')}
                        disabled={!canMoveDown}
                        className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <MoveDown className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-4 shrink-0" />
                  )}

                  <span className="text-xs font-bold text-text-muted uppercase w-16 shrink-0">
                    {isDeliver ? '── DELIVER' : `${stop.sequence}. PICKUP`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary">
                      {pr?.clientName ?? stop.location.name}
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      {stop.location.city}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {stop.plannedItems.reduce((s, i) => s + i.qty, 0).toLocaleString()} Kg
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Readiness */}
        <div className="rounded-lg bg-gray-50 p-3 flex items-center gap-2">
          {isReady ? (
            <>
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm text-success font-medium">
                Ready to plan
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm text-warning font-medium">
                {!edit.transporterName && 'Transporter not assigned · '}
                {!edit.vehicleRegistration && 'Vehicle not assigned · '}
                {!edit.driverName && 'Driver not assigned'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              handleSaveShipment(sh.id);
              onClose();
            }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
          >
            Save
          </button>
          {sh.status === 'draft' && (
            <button
              onClick={() => handleMarkPlanned(sh.id)}
              disabled={!isReady}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Mark Planned
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
