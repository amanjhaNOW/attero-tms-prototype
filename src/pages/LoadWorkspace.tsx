import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Truck,
  MapPin,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  Package,
  Save,
  GripVertical,
  ArrowUp as MoveUp,
  ArrowDown as MoveDown,
} from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge, MetricCard } from '@/components';
import {
  useLoadStore,
  useShipmentStore,
  useStopStore,
  usePRStore,
  useReferenceStore,
  planShipment,
} from '@/stores';
import type { Shipment, Stop } from '@/types';

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

  const load = useMemo(() => allLoads.find((l) => l.id === id), [allLoads, id]);
  const shipments = useMemo(() => allShipments.filter((sh) => sh.loadId === id), [allShipments, id]);

  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [showPRs, setShowPRs] = useState(true);

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
    [shipmentEdits]
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
    [shipments]
  );

  // Stop reordering for pickup stops
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

      // Swap sequences
      const seqA = pickupStops[idx].sequence;
      const seqB = pickupStops[swapIdx].sequence;
      updateStop(pickupStops[idx].id, { sequence: seqB });
      updateStop(pickupStops[swapIdx].id, { sequence: seqA });
    },
    [allStops, updateStop]
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

  const isMilkRun = load.patternLabel === 'milk_run';

  const linkedPRs = load.prIds
    .map((prId) => prs.find((pr) => pr.id === prId))
    .filter(Boolean);

  const totalPlannedQty = load.totalPlannedQty;

  const canPlanAll = shipments.every((sh) => {
    const edit = getShipmentEdit(sh);
    return (
      sh.status === 'draft' &&
      edit.vehicleRegistration &&
      edit.driverName &&
      edit.transporterName
    );
  });

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
    [shipmentEdits, updateShipment]
  );

  const handleMarkPlanned = useCallback(
    (shipId: string) => {
      handleSaveShipment(shipId);
      planShipment(shipId);
    },
    [handleSaveShipment]
  );

  const handlePlanAll = useCallback(() => {
    shipments.forEach((sh) => {
      if (sh.status === 'draft') {
        handleSaveShipment(sh.id);
        planShipment(sh.id);
      }
    });
  }, [shipments, handleSaveShipment]);

  const handleSaveAll = useCallback(() => {
    shipments.forEach((sh) => {
      if (shipmentEdits[sh.id]) {
        handleSaveShipment(sh.id);
      }
    });
  }, [shipments, shipmentEdits, handleSaveShipment]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={load.id}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Loads', href: '/loads' },
          { label: load.id },
        ]}
        status={load.status}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            {canPlanAll && load.status === 'draft' && (
              <button
                onClick={handlePlanAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-success/90 transition-colors"
              >
                <Check className="h-4 w-4" />
                Plan All
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Pattern"
          value={
            <span className="flex items-center gap-2">
              {load.patternLabel.replace(/_/g, ' ')}
              {isMilkRun && (
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary">
                  🥛 MILK RUN
                </span>
              )}
            </span>
          }
        />
        <MetricCard
          label="PRs"
          value={load.prIds.length}
          icon={Package}
        />
        <MetricCard
          label="Total Qty"
          value={`${totalPlannedQty.toLocaleString()} Kg`}
        />
        <MetricCard
          label="Shipments"
          value={shipments.length}
          icon={Truck}
        />
      </div>

      {/* ── Flow Diagram ────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Flow Diagram
        </h3>
        {shipments.map((sh) => {
          const shipStops = allStops
            .filter((s) => s.shipmentId === sh.id)
            .sort((a, b) => a.sequence - b.sequence);
          const pickupStops = shipStops.filter((s) => s.type === 'PICKUP');
          const deliverStop = shipStops.find((s) => s.type === 'DELIVER');
          const isExpanded = expandedShipment === sh.id;
          const edit = getShipmentEdit(sh);
          const isReady =
            edit.vehicleRegistration && edit.driverName && edit.transporterName;

          return (
            <div key={sh.id} className="mb-4 last:mb-0">
              {/* Flow line — Milk Run vs Direct */}
              {isMilkRun && pickupStops.length > 1 ? (
                <MilkRunFlowDiagram
                  pickupStops={pickupStops}
                  deliverStop={deliverStop}
                  shipment={sh}
                  edit={edit}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedShipment(isExpanded ? null : sh.id)}
                  load={load}
                  prs={prs}
                />
              ) : (
                <DirectFlowDiagram
                  pickupStop={pickupStops[0]}
                  deliverStop={deliverStop}
                  shipment={sh}
                  edit={edit}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedShipment(isExpanded ? null : sh.id)}
                  load={load}
                />
              )}

              {/* ── Expanded Shipment Panel ──────── */}
              {isExpanded && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white p-5 space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Transporter */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-sm font-medium text-text-secondary">
                        Transporter
                        {edit.transporterName ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        )}
                      </label>
                      <select
                        value={
                          transporters.find(
                            (t) => t.name === edit.transporterName
                          )?.id ?? ''
                        }
                        onChange={(e) => {
                          const t = transporters.find(
                            (tr) => tr.id === e.target.value
                          );
                          if (t) {
                            updateEditField(sh.id, 'transporterName', t.name);
                            updateEditField(sh.id, 'transporterGst', t.gstNumber);
                            updateEditField(
                              sh.id,
                              'transportMode',
                              t.type === 'in_house' ? 'fleet_own' : 'carrier_third_party'
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
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-sm font-medium text-text-secondary">
                        Vehicle
                        {edit.vehicleRegistration ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        )}
                      </label>
                      <VehicleSelector
                        vehicles={vehicles}
                        transporterName={edit.transporterName}
                        transporters={transporters}
                        value={edit.vehicleRegistration}
                        onChange={(reg, type) => {
                          updateEditField(sh.id, 'vehicleRegistration', reg);
                          updateEditField(sh.id, 'vehicleType', type);
                        }}
                      />
                    </div>

                    {/* Driver Name */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1 text-sm font-medium text-text-secondary">
                        Driver Name
                        {edit.driverName ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        )}
                      </label>
                      <input
                        type="text"
                        value={edit.driverName}
                        onChange={(e) =>
                          updateEditField(sh.id, 'driverName', e.target.value)
                        }
                        placeholder="Driver name..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {/* Driver Phone */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">
                        Driver Phone
                      </label>
                      <input
                        type="tel"
                        value={edit.driverPhone}
                        onChange={(e) =>
                          updateEditField(sh.id, 'driverPhone', e.target.value)
                        }
                        placeholder="+91 98..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* Stop list with reorder controls */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-text-secondary">
                      Stops ({shipStops.length})
                    </h4>
                    {shipStops.map((stop, _index) => {
                      const isPickup = stop.type === 'PICKUP';
                      const pickupIdx = isPickup
                        ? pickupStops.findIndex((s) => s.id === stop.id)
                        : -1;
                      const canMoveUp = isPickup && pickupIdx > 0;
                      const canMoveDown =
                        isPickup && pickupIdx < pickupStops.length - 1;

                      return (
                        <div
                          key={stop.id}
                          className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                        >
                          {/* Reorder controls for pickup stops */}
                          {isPickup && pickupStops.length > 1 ? (
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() =>
                                  handleMoveStop(sh.id, stop.id, 'up')
                                }
                                disabled={!canMoveUp}
                                className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <MoveUp className="h-3 w-3" />
                              </button>
                              <GripVertical className="h-3 w-3 text-gray-300 mx-auto" />
                              <button
                                onClick={() =>
                                  handleMoveStop(sh.id, stop.id, 'down')
                                }
                                disabled={!canMoveDown}
                                className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <MoveDown className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-4" />
                          )}

                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              stop.status === 'completed'
                                ? 'bg-success-100 text-success'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {stop.sequence}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase text-text-muted">
                                {stop.type}
                              </span>
                              <StatusBadge status={stop.status} />
                              {isPickup && stop.prId && (
                                <span className="text-xs text-primary font-medium">
                                  {prs.find((p) => p.id === stop.prId)?.clientName ?? stop.prId}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-primary truncate">
                              {stop.location.name}
                            </p>
                          </div>
                          <span className="text-xs text-text-muted">
                            {stop.plannedItems
                              .reduce((s, i) => s + i.qty, 0)
                              .toLocaleString()}{' '}
                            Kg
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleSaveShipment(sh.id)}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
                    >
                      Save Changes
                    </button>
                    {sh.status === 'draft' && (
                      <button
                        onClick={() => handleMarkPlanned(sh.id)}
                        disabled={!isReady}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Mark as Planned
                      </button>
                    )}
                    <Link
                      to={`/shipments/${sh.id}`}
                      className="ml-auto text-sm font-medium text-primary hover:underline"
                    >
                      View Shipment →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {shipments.length === 0 && (
          <EmptyState
            title="No Shipments"
            description="No shipments created for this load yet"
            icon={Truck}
          />
        )}
      </div>

      {/* ── Linked PRs (collapsible) ──── */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <button
          onClick={() => setShowPRs((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <h3 className="text-base font-semibold text-text-primary">
            Linked Pickup Requests ({load.prIds.length})
          </h3>
          {showPRs ? (
            <ChevronUp className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDown className="h-5 w-5 text-text-muted" />
          )}
        </button>
        {showPRs && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">
                    PR ID
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">
                    Client
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">
                    Materials
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {linkedPRs.map((pr) => {
                  if (!pr) return null;
                  return (
                    <tr
                      key={pr.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/pickup-requests/${pr.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {pr.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {pr.clientName}
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">
                        {pr.materials.map((m) => m.type).join(', ')}
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {pr.materials
                          .reduce((s, m) => s + m.plannedQty, 0)
                          .toLocaleString()}{' '}
                        Kg
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={pr.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Milk Run Flow Diagram ─────────────────────────────────
function MilkRunFlowDiagram({
  pickupStops,
  deliverStop,
  shipment,
  edit,
  isExpanded,
  onToggle,
  load,
  prs,
}: {
  pickupStops: Stop[];
  deliverStop: Stop | undefined;
  shipment: Shipment;
  edit: {
    transporterName: string;
    vehicleRegistration: string;
    driverName: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
  load: { destination: { type: string; name: string; city: string; state: string } };
  prs: { id: string; clientName: string; materials: { type: string; plannedQty: number; unit: string }[] }[];
}) {
  return (
    <div className="flex items-stretch gap-3">
      {/* Left: Multiple Client Cards stacked */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {pickupStops.map((stop, idx) => {
          const pr = prs.find((p) => p.id === stop.prId);
          return (
            <div
              key={stop.id}
              className={`rounded-lg border p-3 transition-colors ${
                stop.status === 'completed'
                  ? 'border-success-200 bg-success-50/50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
                <MapPin className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Pickup {idx + 1}
                </span>
                {stop.status === 'completed' && (
                  <Check className="h-3.5 w-3.5 text-success ml-auto" />
                )}
              </div>
              <p className="text-sm font-medium text-text-primary truncate">
                {pr?.clientName ?? stop.location.name}
              </p>
              <p className="text-xs text-text-muted truncate">
                {stop.location.city}, {stop.location.state}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {stop.plannedItems.map((item, i) => (
                  <span
                    key={i}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-text-muted"
                  >
                    {item.material} ({item.qty.toLocaleString()} {item.unit})
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Merge connector */}
      <div className="flex flex-col items-center justify-center px-1">
        <div className="flex-1 w-0.5 bg-gray-200" />
        <div className="flex items-center gap-0 my-1">
          <div className="w-4 h-0.5 bg-gray-300" />
          <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
        </div>
        <div className="flex-1 w-0.5 bg-gray-200" />
      </div>

      {/* Center: Shipment Card */}
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <button
          onClick={onToggle}
          className="rounded-lg border-2 border-primary-200 bg-primary-50/50 p-3 text-left transition-colors hover:bg-primary-50 w-full"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-primary">
                {shipment.id}
              </span>
            </div>
            <StatusBadge status={shipment.status} />
          </div>
          {edit.vehicleRegistration ? (
            <p className="text-xs text-text-secondary">
              🚛 {edit.vehicleRegistration}
            </p>
          ) : (
            <p className="text-xs text-text-muted italic">
              No vehicle assigned
            </p>
          )}
          {edit.driverName ? (
            <p className="text-xs text-text-secondary">
              👤 {edit.driverName}
            </p>
          ) : (
            <p className="text-xs text-text-muted italic">
              No driver assigned
            </p>
          )}
          <p className="mt-1 text-[10px] text-primary-400">
            Click to {isExpanded ? 'collapse' : 'expand'}
          </p>
        </button>
      </div>

      <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0 self-center" />

      {/* Right: Destination Card */}
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-success flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {load.destination.type === 'plant' ? 'Plant' : 'Warehouse'}
            </span>
          </div>
          <p className="text-sm font-medium text-text-primary truncate">
            {deliverStop?.location.name ?? load.destination.name}
          </p>
          <p className="text-xs text-text-muted truncate">
            {load.destination.city}, {load.destination.state}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Direct Flow Diagram (same as before) ──────────────────
function DirectFlowDiagram({
  pickupStop,
  deliverStop,
  shipment,
  edit,
  isExpanded,
  onToggle,
  load,
}: {
  pickupStop: Stop | undefined;
  deliverStop: Stop | undefined;
  shipment: Shipment;
  edit: {
    transporterName: string;
    vehicleRegistration: string;
    driverName: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
  load: { destination: { type: string; name: string; city: string; state: string } };
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Client Card */}
      <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-warning flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Pickup
          </span>
        </div>
        <p className="text-sm font-medium text-text-primary truncate">
          {pickupStop?.location.name ?? 'N/A'}
        </p>
        <p className="text-xs text-text-muted truncate">
          {pickupStop?.location.city}, {pickupStop?.location.state}
        </p>
        {pickupStop && (
          <div className="mt-1 flex flex-wrap gap-1">
            {pickupStop.plannedItems.map((item, i) => (
              <span
                key={i}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-text-muted"
              >
                {item.material}
              </span>
            ))}
          </div>
        )}
      </div>

      <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />

      {/* Shipment Card */}
      <button
        onClick={onToggle}
        className="flex-1 rounded-lg border-2 border-primary-200 bg-primary-50/50 p-3 text-left transition-colors hover:bg-primary-50 min-w-0"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold text-primary">
              {shipment.id}
            </span>
          </div>
          <StatusBadge status={shipment.status} />
        </div>
        {edit.vehicleRegistration ? (
          <p className="text-xs text-text-secondary">
            🚛 {edit.vehicleRegistration}
          </p>
        ) : (
          <p className="text-xs text-text-muted italic">
            No vehicle assigned
          </p>
        )}
        {edit.driverName ? (
          <p className="text-xs text-text-secondary">
            👤 {edit.driverName}
          </p>
        ) : (
          <p className="text-xs text-text-muted italic">
            No driver assigned
          </p>
        )}
        <p className="mt-1 text-[10px] text-primary-400">
          Click to {isExpanded ? 'collapse' : 'expand'}
        </p>
      </button>

      <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />

      {/* Destination Card */}
      <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-success flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {load.destination.type === 'plant' ? 'Plant' : 'Warehouse'}
          </span>
        </div>
        <p className="text-sm font-medium text-text-primary truncate">
          {deliverStop?.location.name ?? load.destination.name}
        </p>
        <p className="text-xs text-text-muted truncate">
          {load.destination.city}, {load.destination.state}
        </p>
      </div>
    </div>
  );
}

// ── Vehicle Selector sub-component ────────────────
function VehicleSelector({
  vehicles,
  transporterName,
  transporters,
  value,
  onChange,
}: {
  vehicles: { id: string; registration: string; type: string; capacityKg: number; transporterId: string }[];
  transporterName: string;
  transporters: { id: string; name: string }[];
  value: string;
  onChange: (registration: string, type: string) => void;
}) {
  const transporter = transporters.find((t) => t.name === transporterName);
  const filtered = transporter
    ? vehicles.filter((v) => v.transporterId === transporter.id)
    : vehicles;

  return (
    <select
      value={filtered.find((v) => v.registration === value)?.id ?? ''}
      onChange={(e) => {
        const v = filtered.find((veh) => veh.id === e.target.value);
        if (v) {
          onChange(v.registration, v.type);
        } else {
          onChange('', '');
        }
      }}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
    >
      <option value="">Select vehicle...</option>
      {filtered.map((v) => (
        <option key={v.id} value={v.id}>
          {v.registration} — {v.type} ({v.capacityKg.toLocaleString()} Kg)
        </option>
      ))}
    </select>
  );
}
