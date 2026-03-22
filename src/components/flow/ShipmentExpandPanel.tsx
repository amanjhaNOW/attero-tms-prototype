import { useMemo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Check,
  AlertTriangle,
  GripVertical,
  ArrowUp as MoveUp,
  ArrowDown as MoveDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { removeStopFromShipment, addStopToShipment } from '@/stores';
import { useStopStore } from '@/stores';
import type { Shipment, Stop, PickupRequest, Transporter, Vehicle } from '@/types';

interface ShipmentExpandPanelProps {
  shipment: Shipment;
  allStops: Stop[];
  prs: PickupRequest[];
  transporters: Transporter[];
  vehicles: Vehicle[];
  allShipments: Shipment[];
  editState: {
    transporterName: string;
    transporterGst: string;
    vehicleRegistration: string;
    vehicleType: string;
    driverName: string;
    driverPhone: string;
    transportMode: 'carrier_third_party' | 'fleet_own';
  };
  onEditField: (field: string, value: string) => void;
  onMoveStop: (stopId: string, direction: 'up' | 'down') => void;
  onSave: () => void;
  onMarkPlanned: () => void;
  onClose: () => void;
}

export function ShipmentExpandPanel({
  shipment,
  allStops,
  prs,
  transporters,
  vehicles,
  allShipments,
  editState,
  onEditField,
  onMoveStop,
  onSave,
  onMarkPlanned,
  onClose,
}: ShipmentExpandPanelProps) {
  const [addStopPickerOpen, setAddStopPickerOpen] = useState(false);
  const [confirmRemoveStopId, setConfirmRemoveStopId] = useState<string | null>(null);

  const shipStops = useMemo(
    () =>
      allStops
        .filter((s) => s.shipmentId === shipment.id)
        .sort((a, b) => a.sequence - b.sequence),
    [allStops, shipment.id],
  );
  const pickupStops = useMemo(() => shipStops.filter((s) => s.type === 'PICKUP'), [shipStops]);
  const deliverStops = useMemo(() => shipStops.filter((s) => s.type === 'DELIVER'), [shipStops]);
  const transferStops = useMemo(
    () => shipStops.filter((s) => s.type === 'TRANSFER_IN' || s.type === 'TRANSFER_OUT'),
    [shipStops],
  );

  const isReady =
    editState.vehicleRegistration && editState.driverName && editState.transporterName;

  // Filter vehicles by selected transporter
  const selectedTransporter = useMemo(
    () => transporters.find((t) => t.name === editState.transporterName),
    [transporters, editState.transporterName],
  );
  const filteredVehicles = useMemo(
    () =>
      selectedTransporter
        ? vehicles.filter((v) => v.transporterId === selectedTransporter.id)
        : vehicles,
    [vehicles, selectedTransporter],
  );

  // Cross-dock relationships
  const parentShipment = useMemo(
    () =>
      shipment.parentShipmentId
        ? allShipments.find((s) => s.id === shipment.parentShipmentId)
        : null,
    [shipment.parentShipmentId, allShipments],
  );
  const childFeeders = useMemo(
    () => allShipments.filter((s) => s.parentShipmentId === shipment.id),
    [allShipments, shipment.id],
  );

  // PRs in this load that are NOT already connected to this shipment (for Add Stop picker)
  const unconnectedPRs = useMemo(() => {
    const connectedPrIds = new Set(
      pickupStops.map((s) => s.prId).filter(Boolean),
    );
    return prs.filter((pr) => !connectedPrIds.has(pr.id));
  }, [prs, pickupStops]);

  // Other shipments in the same load (for transfer stops)
  const otherShipments = useMemo(
    () => allShipments.filter((s) => s.loadId === shipment.loadId && s.id !== shipment.id),
    [allShipments, shipment.loadId, shipment.id],
  );

  const handleTransporterChange = useCallback(
    (transporterId: string) => {
      const t = transporters.find((tr) => tr.id === transporterId);
      if (t) {
        onEditField('transporterName', t.name);
        onEditField('transporterGst', t.gstNumber);
        onEditField(
          'transportMode',
          t.type === 'in_house' ? 'fleet_own' : 'carrier_third_party',
        );
        onEditField('vehicleRegistration', '');
        onEditField('vehicleType', '');
      }
    },
    [transporters, onEditField],
  );

  const handleVehicleChange = useCallback(
    (vehicleId: string) => {
      const v = filteredVehicles.find((veh) => veh.id === vehicleId);
      if (v) {
        onEditField('vehicleRegistration', v.registration);
        onEditField('vehicleType', v.type);
      } else {
        onEditField('vehicleRegistration', '');
        onEditField('vehicleType', '');
      }
    },
    [filteredVehicles, onEditField],
  );

  const handleRemoveStop = useCallback(
    (stopId: string) => {
      const stop = shipStops.find((s) => s.id === stopId);
      if (!stop) return;

      // Check if this is the last PICKUP for this PR across all shipments
      if (stop.type === 'PICKUP' && stop.prId) {
        const otherPickupsForPR = allStops.filter(
          (s) =>
            s.id !== stopId &&
            s.type === 'PICKUP' &&
            s.prId === stop.prId,
        );
        if (otherPickupsForPR.length === 0) {
          // Warn user — this is the last pickup for this PR
          setConfirmRemoveStopId(stopId);
          return;
        }
      }

      removeStopFromShipment(stopId);
    },
    [shipStops, allStops],
  );

  const handleConfirmRemove = useCallback(() => {
    if (confirmRemoveStopId) {
      removeStopFromShipment(confirmRemoveStopId);
      setConfirmRemoveStopId(null);
    }
  }, [confirmRemoveStopId]);

  const handleAddPickupStop = useCallback(
    (prId: string) => {
      addStopToShipment(shipment.id, 'PICKUP', prId);
      setAddStopPickerOpen(false);
    },
    [shipment.id],
  );

  const handleAddTransferStop = useCallback(
    (type: 'TRANSFER_OUT' | 'TRANSFER_IN', linkedShipmentId: string) => {
      addStopToShipment(shipment.id, type, undefined, linkedShipmentId);
      setAddStopPickerOpen(false);
    },
    [shipment.id],
  );

  const stopIcon = (type: string) => {
    switch (type) {
      case 'PICKUP':
        return '📦';
      case 'DELIVER':
        return '📦';
      case 'TRANSFER_OUT':
        return '🤝';
      case 'TRANSFER_IN':
        return '📥';
      default:
        return '📍';
    }
  };

  const stopLabel = (stop: Stop) => {
    switch (stop.type) {
      case 'PICKUP':
        return 'PICKUP';
      case 'DELIVER':
        return 'DELIVER';
      case 'TRANSFER_OUT': {
        // 1:1: linkedStopId → the TRANSFER_IN on the target shipment
        const linkedStop = allStops.find((s) => s.id === stop.linkedStopId);
        const targetShip = linkedStop
          ? allShipments.find((s) => s.id === linkedStop.shipmentId)
          : null;
        return `HANDOVER → ${targetShip?.id || 'TBD'}`;
      }
      case 'TRANSFER_IN': {
        // 1:1: linkedStopId → the TRANSFER_OUT that feeds this stop
        const linkedOut = allStops.find((s) => s.id === stop.linkedStopId);
        const sourceShip = linkedOut
          ? allShipments.find((sh) => sh.id === linkedOut.shipmentId)
          : null;
        return sourceShip ? `RECEIVE ← ${sourceShip.id}` : 'RECEIVE';
      }
      default:
        return stop.type;
    }
  };

  // Readiness checklist items
  const readinessItems = useMemo(
    () => [
      { label: 'Transporter', ok: !!editState.transporterName },
      { label: 'Vehicle', ok: !!editState.vehicleRegistration },
      { label: 'Driver', ok: !!editState.driverName },
      { label: 'Phone', ok: !!editState.driverPhone },
    ],
    [editState],
  );

  return (
    <div className="mt-3 rounded-xl border border-primary-200 bg-white shadow-lg overflow-hidden animate-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-text-primary">
            {shipment.id}
          </h3>
          {(() => {
            const hasTO = shipStops.some((s) => s.type === 'TRANSFER_OUT');
            const hasTI = shipStops.some((s) => s.type === 'TRANSFER_IN');
            const role = hasTO && hasTI ? 'Relay' : hasTO ? 'Feeder' : hasTI ? 'Line-Haul' : null;
            if (role === 'Feeder')
              return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Feeder</span>;
            if (role === 'Line-Haul')
              return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Line-Haul</span>;
            if (role === 'Relay')
              return <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">Relay</span>;
            return null;
          })()}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted hover:bg-gray-200 hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4">
        {/* Cross-dock relationships */}
        {parentShipment && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">🤝 Handover to:</span>{' '}
              <Link
                to={`/shipments/${parentShipment.id}`}
                className="font-bold text-primary hover:underline"
              >
                {parentShipment.id}
              </Link>{' '}
              (Line-Haul)
            </p>
          </div>
        )}
        {childFeeders.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">📥 Receives from:</span>{' '}
              {childFeeders.map((f, i) => {
                const fStops = allStops.filter(
                  (s) => s.shipmentId === f.id && s.type === 'PICKUP',
                );
                const fQty = fStops.reduce(
                  (sum, s) => sum + s.plannedItems.reduce((a, it) => a + it.qty, 0),
                  0,
                );
                return (
                  <span key={f.id}>
                    {i > 0 && ' + '}
                    <Link
                      to={`/shipments/${f.id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {f.id}
                    </Link>
                    <span className="text-text-muted">
                      {' '}
                      ({(fQty / 1000).toFixed(1)}T)
                    </span>
                  </span>
                );
              })}
            </p>
          </div>
        )}

        {/* ── Two-Column Layout ───────────────── */}
        <div className="flex gap-6">
          {/* ── LEFT COLUMN: Transport Assignment (~45%) ── */}
          <div className="w-[45%] shrink-0 space-y-4">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Transport Assignment
            </h4>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-secondary">Mode</label>
                <select
                  value={editState.transportMode}
                  onChange={(e) => onEditField('transportMode', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="carrier_third_party">Carrier (Third-Party)</option>
                  <option value="fleet_own">Fleet (Own)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-text-secondary">
                  Transporter
                  {editState.transporterName ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  )}
                </label>
                <select
                  value={selectedTransporter?.id ?? ''}
                  onChange={(e) => handleTransporterChange(e.target.value)}
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

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-text-secondary">
                  Vehicle
                  {editState.vehicleRegistration ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  )}
                </label>
                <select
                  value={
                    filteredVehicles.find((v) => v.registration === editState.vehicleRegistration)
                      ?.id ?? ''
                  }
                  onChange={(e) => handleVehicleChange(e.target.value)}
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

              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-medium text-text-secondary">
                  Driver Name
                  {editState.driverName ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  )}
                </label>
                <input
                  type="text"
                  value={editState.driverName}
                  onChange={(e) => onEditField('driverName', e.target.value)}
                  placeholder="Driver name..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-secondary">Driver Phone</label>
                <input
                  type="tel"
                  value={editState.driverPhone}
                  onChange={(e) => onEditField('driverPhone', e.target.value)}
                  placeholder="+91 98..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Readiness Checklist */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1.5">
              <h5 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Readiness
              </h5>
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  {item.ok ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  )}
                  <span
                    className={`text-xs ${item.ok ? 'text-success' : 'text-warning'}`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Stops & Route (~55%) ── */}
          <div className="flex-1 space-y-3">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Stops & Route ({pickupStops.length} pickup
              {pickupStops.length !== 1 ? 's' : ''} → {deliverStops.length} deliver
              {deliverStops.length !== 1 ? 'ies' : 'y'}
              {transferStops.filter((s) => s.type === 'TRANSFER_OUT').length > 0
                ? ` · ${transferStops.filter((s) => s.type === 'TRANSFER_OUT').length} handover`
                : ''}
              {transferStops.filter((s) => s.type === 'TRANSFER_IN').length > 0
                ? ` · ${transferStops.filter((s) => s.type === 'TRANSFER_IN').length} receive`
                : ''})
            </h4>

            <div className="space-y-1.5">
              {shipStops.map((stop) => {
                const isPickup = stop.type === 'PICKUP';
                const pickupIdx = isPickup ? pickupStops.findIndex((s) => s.id === stop.id) : -1;
                const canMoveUp = isPickup && pickupIdx > 0;
                const canMoveDown = isPickup && pickupIdx < pickupStops.length - 1;
                const pr = isPickup ? prs.find((p) => p.id === stop.prId) : null;
                const isDeliver = stop.type === 'DELIVER';
                const isTransfer = stop.type === 'TRANSFER_IN' || stop.type === 'TRANSFER_OUT';
                const canRemove = !isDeliver; // DELIVER not removable
                const materialSummary =
                  isPickup && stop.plannedItems.length > 0
                    ? stop.plannedItems.map((i) => i.material).join(', ')
                    : null;

                return (
                  <div
                    key={stop.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${
                      isDeliver
                        ? 'bg-success-50 border border-success-100'
                        : isTransfer
                          ? 'bg-amber-50 border border-amber-100'
                          : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {/* Reorder buttons (only PICKUP stops with multiple pickups) */}
                    {isPickup && pickupStops.length > 1 ? (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => onMoveStop(stop.id, 'up')}
                          disabled={!canMoveUp}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MoveUp className="h-3 w-3" />
                        </button>
                        <GripVertical className="h-3 w-3 text-gray-300 mx-auto" />
                        <button
                          onClick={() => onMoveStop(stop.id, 'down')}
                          disabled={!canMoveDown}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MoveDown className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Sequence number */}
                    <span className="text-[10px] font-bold text-text-muted w-5 text-center shrink-0">
                      {stop.sequence}
                    </span>

                    {/* Stop icon */}
                    <span className="text-sm shrink-0">{stopIcon(stop.type)}</span>

                    {/* Stop type label */}
                    <span className="text-[10px] font-bold text-text-muted uppercase shrink-0 max-w-[140px] truncate" title={stopLabel(stop)}>
                      {stopLabel(stop)}
                    </span>

                    {/* Stop details */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-text-primary">
                        {pr?.clientName ?? stop.location.name}
                      </span>
                      <span className="text-xs text-text-muted ml-2">
                        {stop.location.city}
                      </span>
                      {materialSummary && (
                        <p className="text-[10px] text-text-muted mt-0.5 truncate">
                          {materialSummary}
                        </p>
                      )}

                      {/* Tentative meeting point for TRANSFER_OUT */}
                      {stop.type === 'TRANSFER_OUT' && (
                        <div className="mt-1.5">
                          <label className="text-[10px] text-amber-700 font-medium">📍 Suggested meeting point:</label>
                          <input
                            type="text"
                            value={stop.location.name}
                            onChange={(e) => {
                              useStopStore.getState().updateStop(stop.id, {
                                location: { ...stop.location, name: e.target.value },
                              });
                            }}
                            placeholder="e.g. Near Ajmer Bypass"
                            className="mt-0.5 w-full rounded border border-amber-200 bg-amber-50/50 px-2 py-1 text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
                          />
                        </div>
                      )}

                      {/* Read-only meeting point for TRANSFER_IN (from linked TRANSFER_OUT) */}
                      {stop.type === 'TRANSFER_IN' && (() => {
                        const linkedOut = allStops.find((s) => s.id === stop.linkedStopId);
                        const meetingPoint = linkedOut?.location.name || stop.location.name;
                        return meetingPoint ? (
                          <p className="mt-1 text-[10px] text-blue-600">
                            📍 Meeting point: {meetingPoint} <span className="text-text-muted">(from handover)</span>
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] text-text-muted italic">
                            📍 Meeting point: TBD (set on handover stop)
                          </p>
                        );
                      })()}
                    </div>

                    {/* Quantity */}
                    <span className="text-xs font-semibold text-text-primary shrink-0">
                      {stop.plannedItems.reduce((s, i) => s + i.qty, 0).toLocaleString()} Kg
                    </span>

                    {/* Remove button */}
                    {canRemove && (
                      <button
                        onClick={() => handleRemoveStop(stop.id)}
                        className="rounded p-1 text-gray-400 hover:text-danger hover:bg-danger-50 transition-colors shrink-0"
                        title="Remove stop from this shipment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Confirm remove dialog (inline) */}
            {confirmRemoveStopId && (
              <div className="rounded-lg border border-warning bg-amber-50 p-3">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠ This PR will have no pickup in any shipment. Remove anyway?
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleConfirmRemove}
                    className="rounded-lg bg-danger px-3 py-1 text-xs font-medium text-white hover:bg-danger-600 transition-colors"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirmRemoveStopId(null)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-text-secondary hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Stop Button */}
            {!addStopPickerOpen ? (
              <button
                onClick={() => setAddStopPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-text-muted hover:text-primary hover:border-primary hover:bg-primary-50/50 transition-colors w-full justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Stop
              </button>
            ) : (
              <div className="rounded-lg border border-primary-200 bg-white p-3 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-text-primary">
                    Add Stop to {shipment.id}
                  </h5>
                  <button
                    onClick={() => setAddStopPickerOpen(false)}
                    className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* PICKUP section */}
                <div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-1.5">
                    📦 PICKUP — from unconnected PRs
                  </p>
                  {unconnectedPRs.length > 0 ? (
                    <div className="space-y-1">
                      {unconnectedPRs.map((pr) => (
                        <button
                          key={pr.id}
                          onClick={() => handleAddPickupStop(pr.id)}
                          className="flex items-center gap-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-primary-50 hover:border-primary-200 transition-colors"
                        >
                          <span className="font-bold text-primary">{pr.id}</span>
                          <span className="text-text-muted truncate">
                            {pr.clientName} — {pr.pickupLocation.city}
                          </span>
                          <span className="ml-auto font-semibold text-text-primary shrink-0">
                            {pr.materials
                              .reduce((s, m) => s + m.plannedQty, 0)
                              .toLocaleString()}{' '}
                            Kg
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted italic px-2">
                      All PRs already connected to this shipment
                    </p>
                  )}
                </div>

                {/* HANDOVER section — creates TRANSFER_OUT on this truck + TRANSFER_IN on target */}
                {otherShipments.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-text-secondary mb-1">
                      🤝 HANDOVER — This truck will meet another truck
                    </p>
                    <p className="text-[10px] text-text-muted mb-1.5">
                      Select which truck to meet. System auto-creates handover on this truck + receive on the target.
                    </p>
                    <div className="space-y-1">
                      {otherShipments.map((sh) => (
                        <button
                          key={sh.id}
                          onClick={() => handleAddTransferStop('TRANSFER_OUT', sh.id)}
                          className="flex items-center gap-2 w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-left text-xs hover:bg-amber-100 hover:border-amber-300 transition-colors"
                        >
                          <span className="text-sm">🤝</span>
                          <span className="font-bold text-amber-800">{sh.id}</span>
                          <span className="text-text-muted">
                            {sh.vehicleRegistration || 'Unassigned'}
                          </span>
                          <span className="ml-auto text-[10px] text-amber-600">
                            Handover →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setAddStopPickerOpen(false)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
        >
          Done
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
          >
            Save Changes
          </button>
          {shipment.status === 'draft' && (
            <button
              onClick={onMarkPlanned}
              disabled={!isReady}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark as Planned
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
