import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { X, Truck, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { FlowNodeData } from './FlowLayout';
import type { PickupRequest, Shipment, Stop, Location } from '@/types';

interface FlowNodeProps {
  nodeData: FlowNodeData;
  onClick?: () => void;
  selected?: boolean;
  onRemove?: () => void;
}

/* ─── Source Node ─────────────────────────────── */
function SourceCard({
  pr,
  onRemove,
}: {
  pr: PickupRequest;
  onRemove?: () => void;
}) {
  const qty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
  return (
    <div className="group relative w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-danger-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-sm">📍</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-text-primary leading-tight truncate">
            {pr.clientName}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5 truncate">
            {pr.pickupLocation.city}, {pr.pickupLocation.state}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pr.materials.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                {m.type}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs font-bold text-text-primary">
            {qty.toLocaleString()} Kg
          </p>
        </div>
      </div>
      <Link
        to={`/pickup-requests/${pr.id}`}
        className="mt-1 block text-[10px] font-medium text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {pr.id}
      </Link>
    </div>
  );
}

/* ─── Shipment Node ──────────────────────────── */
function ShipmentCard({
  shipment,
  stops,
  role,
  selected,
  onClick,
}: {
  shipment: Shipment;
  stops: Stop[];
  role?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const typeLabel =
    role === 'feeder'
      ? 'Feeder'
      : role === 'line-haul'
        ? 'Line-Haul'
        : shipment.parentShipmentId
          ? 'Feeder'
          : 'Direct';

  // Build route summary from stop cities in sequence order
  const routeSummary = stops
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => s.location.city)
    .filter((city, idx, arr) => city && arr.indexOf(city) === idx) // deduplicate adjacent
    .join(' → ');

  return (
    <div
      onClick={onClick}
      className={`w-[200px] cursor-pointer rounded-lg border-2 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md ${
        selected
          ? 'border-primary bg-primary-50/30 shadow-primary-100'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary shrink-0" />
        <Link
          to={`/shipments/${shipment.id}`}
          className="text-xs font-bold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {shipment.id}
        </Link>
        <StatusBadge status={shipment.status} />
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
          {typeLabel}
        </span>
      </div>
      {routeSummary && (
        <p className="mt-1 text-[10px] text-text-muted truncate" title={routeSummary}>
          {routeSummary}
        </p>
      )}
      {shipment.vehicleRegistration && (
        <p className="mt-1 text-[11px] text-text-muted truncate">
          🚛 {shipment.vehicleRegistration}
        </p>
      )}
      {shipment.driverName && (
        <p className="text-[11px] text-text-muted truncate">
          👤 {shipment.driverName}
        </p>
      )}
      {!shipment.vehicleRegistration && !shipment.driverName && (
        <p className="mt-1 text-[11px] text-warning italic">
          ⚠ Needs assignment
        </p>
      )}
    </div>
  );
}

/* ─── Hub Node ───────────────────────────────── */
function HubCard({ label }: { label: string }) {
  return (
    <div className="flex w-[100px] flex-col items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-2 py-3 text-center">
      <span className="text-lg">🔄</span>
      <p className="mt-1 text-[10px] font-semibold text-text-secondary leading-tight">
        {label}
      </p>
    </div>
  );
}

/* ─── Destination Node ───────────────────────── */
function DestinationCard({
  destination,
}: {
  destination: Location & { type: 'plant' | 'warehouse' };
}) {
  const icon = destination.type === 'warehouse' ? '🏭' : '🏢';
  return (
    <div className="w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-text-primary leading-tight truncate">
            {destination.name}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {destination.city}, {destination.state}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-text-muted" />
            <span className="text-[10px] text-text-muted capitalize">
              {destination.type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Composite FlowNode ─────────────────────── */
export const FlowNode = forwardRef<HTMLDivElement, FlowNodeProps>(
  ({ nodeData, onClick, selected, onRemove }, ref) => {
    const renderInner = () => {
      switch (nodeData.type) {
        case 'source': {
          const pr = nodeData.data.pr as PickupRequest;
          return <SourceCard pr={pr} onRemove={onRemove} />;
        }
        case 'shipment': {
          const shipment = nodeData.data.shipment as Shipment;
          const stops = (nodeData.data.stops as Stop[]) ?? [];
          const role = nodeData.data.role as string | undefined;
          return (
            <ShipmentCard
              shipment={shipment}
              stops={stops}
              role={role}
              selected={selected}
              onClick={onClick}
            />
          );
        }
        case 'hub': {
          const label = (nodeData.data.label as string) ?? 'Transfer';
          return <HubCard label={label} />;
        }
        case 'destination': {
          const destination = nodeData.data.destination as Location & {
            type: 'plant' | 'warehouse';
          };
          return <DestinationCard destination={destination} />;
        }
        default:
          return null;
      }
    };

    return (
      <div ref={ref} className="flex items-center justify-center">
        {renderInner()}
      </div>
    );
  },
);

FlowNode.displayName = 'FlowNode';
