import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Check,
  AlertTriangle,
  GripVertical,
  ArrowUp as MoveUp,
  ArrowDown as MoveDown,
  ChevronDown,
} from 'lucide-react';
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

  const stopIcon = (type: string) => {
    switch (type) {
      case 'PICKUP':
        return '📦';
      case 'DELIVER':
        return '📦';
      case 'TRANSFER_IN':
        return '🔄';
      case 'TRANSFER_OUT':
        return '🔄';
      default:
        return '📍';
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-primary-200 bg-white shadow-lg overflow-hidden animate-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-text-primary">
            {shipment.id}
          </h3>
          {shipment.parentShipmentId && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Feeder
            </span>
          )}
          {childFeeders.length > 0 && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Line-Haul
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted hover:bg-gray-200 hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Cross-dock relationships */}
        {parentShipment && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Feeds into:</span>{' '}
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
          <div className="rounded-lg bg-primary-50 border border-primary-200 p-3">
            <p className="text-xs text-primary-700">
              <span className="font-semibold">Receives from:</span>{' '}
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

        {/* Transportation Section */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Transport Assignment
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                Driver
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
              <label className="text-[11px] font-medium text-text-secondary">Phone</label>
              <input
                type="tel"
                value={editState.driverPhone}
                onChange={(e) => onEditField('driverPhone', e.target.value)}
                placeholder="+91 98..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Stops & Route */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Stops & Route ({pickupStops.length} pickup
            {pickupStops.length !== 1 ? 's' : ''} → {deliverStops.length} deliver
            {deliverStops.length !== 1 ? 'ies' : 'y'}
            {transferStops.length > 0 ? ` · ${transferStops.length} transfer` : ''})
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

                  <span className="text-sm shrink-0">{stopIcon(stop.type)}</span>
                  <span className="text-[10px] font-bold text-text-muted uppercase w-20 shrink-0">
                    {stop.type.replace('_', ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary">
                      {pr?.clientName ?? stop.location.name}
                    </span>
                    <span className="text-xs text-text-muted ml-2">
                      {stop.location.city}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-text-primary shrink-0">
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
              <span className="text-sm text-success font-medium">Ready to plan</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm text-warning font-medium">
                {[
                  !editState.transporterName && 'Transporter',
                  !editState.vehicleRegistration && 'Vehicle',
                  !editState.driverName && 'Driver',
                ]
                  .filter(Boolean)
                  .join(', ')}{' '}
                not assigned
              </span>
            </>
          )}
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
