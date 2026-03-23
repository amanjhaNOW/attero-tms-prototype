import { forwardRef, useCallback, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Truck, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { FlowNodeData } from './FlowLayout';
import type { PickupRequest, Shipment, Stop, Location, LocationMaster } from '@/types';

interface FlowNodeProps {
  nodeData: FlowNodeData;
  onClick?: () => void;
  selected?: boolean;
  onRemove?: () => void;
  /** Called to delete a shipment from the load */
  onDeleteShipment?: () => void;
  /** Called when user clicks the output port (right side) to start a connection */
  onStartConnect?: (nodeId: string) => void;
  /** Called when user clicks the input port (left side) to complete a connection */
  onCompleteConnect?: (nodeId: string) => void;
  /** Whether any connection is currently in progress */
  isConnecting?: boolean;
  /** Whether this node is the source of the active connection */
  isConnectSource?: boolean;
  /** Whether this node is a valid target for the active connection */
  isValidTarget?: boolean;
  /** Locations for destination change dropdown */
  locations?: LocationMaster[];
  /** Called when user selects a new destination */
  onChangeDestination?: (locationId: string) => void;
  /** Whether the load is in draft status */
  isDraft?: boolean;
  /** Called when user clicks Unplan on a planned shipment */
  onUnplanShipment?: () => void;
}

/* ─── Connection Port ────────────────────────── */
function ConnectionPort({
  side,
  onClick,
  isActive,
  isValidTarget,
  isConnecting,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  isActive?: boolean;
  isValidTarget?: boolean;
  isConnecting?: boolean;
}) {
  const isLeft = side === 'left';

  // Determine visual state
  let portClasses = 'border-gray-300 bg-white hover:border-primary hover:bg-primary-50';
  if (isActive) {
    portClasses = 'border-primary bg-primary animate-pulse';
  } else if (isValidTarget) {
    portClasses = 'border-primary bg-primary-100 shadow-[0_0_6px_rgba(25,118,210,0.4)]';
  } else if (isConnecting && !isValidTarget) {
    portClasses = 'border-gray-200 bg-gray-100 opacity-40';
  }

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 z-10 ${
        isLeft ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isConnecting && !isValidTarget && !isActive) return; // C1: block click on invalid targets
          onClick();
        }}
        className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
          isConnecting && !isValidTarget && !isActive ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${portClasses}`}
        title={
          isConnecting && !isValidTarget && !isActive
            ? 'Planned — route locked'
            : isLeft
              ? 'Connect here'
              : 'Connect from here'
        }
      />
    </div>
  );
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
  onDelete,
  onUnplan,
}: {
  shipment: Shipment;
  stops: Stop[];
  role?: string;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onUnplan?: () => void;
}) {
  // Auto-detect role from stops
  const hasTransferOut = stops.some((s) => s.type === 'TRANSFER_OUT');
  const hasTransferIn = stops.some((s) => s.type === 'TRANSFER_IN');
  const detectedRole =
    hasTransferOut && hasTransferIn
      ? 'Relay'
      : hasTransferOut
        ? 'Feeder'
        : hasTransferIn
          ? 'Line-Haul'
          : null;

  const displayRole = detectedRole ?? (role === 'feeder' ? 'Feeder' : role === 'line-haul' ? 'Line-Haul' : shipment.parentShipmentId ? 'Feeder' : 'Direct');

  const roleBadgeClass =
    displayRole === 'Feeder'
      ? 'bg-amber-100 text-amber-700'
      : displayRole === 'Line-Haul'
        ? 'bg-blue-100 text-blue-700'
        : displayRole === 'Relay'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-gray-100 text-text-secondary';

  // Build route summary from stops in sequence order with transfer icons
  const routeSummary = stops
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => {
      const loc = s.location.name || s.location.city || 'TBD';
      switch (s.type) {
        case 'TRANSFER_OUT':
          return `🤝 ${loc}`;
        case 'TRANSFER_IN':
          return `📥 ${loc}`;
        case 'PICKUP':
          return s.location.city || s.location.name;
        case 'DELIVER':
          return s.location.city || s.location.name;
        default:
          return s.location.city;
      }
    })
    .filter(Boolean)
    .join(' → ');

  // BUG 7: Detect empty/hint states (reuse hasTransferOut/hasTransferIn from above)
  const hasPickups = stops.some((s) => s.type === 'PICKUP');
  const hasDeliver = stops.some((s) => s.type === 'DELIVER');
  const isEmptyTruck = stops.length === 0;
  const isLineHaulOnlyDeliver = !hasPickups && !hasTransferIn && hasDeliver && stops.length === 1;

  return (
    <div
      onClick={onClick}
      className={`relative w-[200px] cursor-pointer rounded-lg border-2 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md group/shipcard ${
        selected
          ? 'border-primary bg-primary-50/30 shadow-primary-100'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      {/* Delete button for draft shipments — always visible */}
      {onDelete && shipment.status === 'draft' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-400 text-xs z-20 shadow-sm"
        >
          ✕
        </button>
      )}
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
        {/* B2: Unplan button for planned shipments */}
        {onUnplan && shipment.status === 'planned' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnplan();
            }}
            className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors"
            title="Revert to draft"
          >
            Unplan
          </button>
        )}
      </div>
      {/* Only show role badge for meaningful roles (Feeder/Line-Haul/Relay), not "Direct" which is a load-level pattern */}
      {displayRole !== 'Direct' && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass}`}>
            {displayRole}
          </span>
        </div>
      )}
      {routeSummary && (
        <p className="mt-1 text-[10px] text-text-muted truncate" title={routeSummary}>
          {routeSummary}
        </p>
      )}
      {/* BUG 7: Empty shipment hints */}
      {isLineHaulOnlyDeliver && (
        <p className="mt-1 text-[10px] text-blue-500 italic">
          Connect feeders to this truck
        </p>
      )}
      {isEmptyTruck && (
        <p className="mt-1 text-[10px] text-gray-400 italic">
          Use connections to build this truck's route
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
  locations,
  onChangeDestination,
  isDraft,
}: {
  destination: Location & { type: 'plant' | 'warehouse' };
  locations?: LocationMaster[];
  onChangeDestination?: (locationId: string) => void;
  isDraft?: boolean;
}) {
  const icon = destination.type === 'warehouse' ? '🏭' : '🏢';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Filter to plant + warehouse locations
  const availableLocations = (locations ?? []).filter(
    (l) => l.type === 'plant' || l.type === 'warehouse',
  );

  return (
    <div className="relative min-w-[180px] max-w-[240px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm" ref={dropdownRef}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-text-primary leading-tight truncate" title={destination.name}>
            {destination.name}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5 truncate">
            {destination.city}, {destination.state}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-text-muted shrink-0" />
            <span className="text-[10px] text-text-muted capitalize">
              {destination.type}
            </span>
          </div>
        </div>
      </div>
      {/* A1: Change destination dropdown — draft loads only */}
      {isDraft && onChangeDestination && availableLocations.length > 0 && (
        <div className="mt-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((v) => !v);
            }}
            className="text-[10px] font-medium text-primary hover:text-primary-600 hover:underline transition-colors"
          >
            Change ▾
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-30 w-56 animate-in slide-in-from-top-1">
              {availableLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeDestination(loc.id);
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-primary-50 transition-colors"
                >
                  <span className="text-sm">{loc.type === 'warehouse' ? '🏭' : '🏢'}</span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary truncate block">{loc.name}</span>
                    <span className="text-[10px] text-text-muted">{loc.city}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Composite FlowNode ─────────────────────── */
export const FlowNode = forwardRef<HTMLDivElement, FlowNodeProps>(
  (
    {
      nodeData,
      onClick,
      selected,
      onRemove,
      onDeleteShipment,
      onStartConnect,
      onCompleteConnect,
      isConnecting,
      isConnectSource,
      isValidTarget,
      locations,
      onChangeDestination,
      isDraft,
      onUnplanShipment,
    },
    ref,
  ) => {
    const nodeId = nodeData.id;
    const nodeType = nodeData.type;

    // Determine which ports to show
    const hasOutputPort = nodeType === 'source' || nodeType === 'shipment';
    const hasInputPort = nodeType === 'shipment' || nodeType === 'destination';

    const handleStartConnect = useCallback(() => {
      onStartConnect?.(nodeId);
    }, [onStartConnect, nodeId]);

    const handleCompleteConnect = useCallback(() => {
      onCompleteConnect?.(nodeId);
    }, [onCompleteConnect, nodeId]);

    const renderInner = () => {
      switch (nodeType) {
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
              onDelete={onDeleteShipment}
              onUnplan={onUnplanShipment}
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
          return (
            <DestinationCard
              destination={destination}
              locations={locations}
              onChangeDestination={onChangeDestination}
              isDraft={isDraft}
            />
          );
        }
        default:
          return null;
      }
    };

    return (
      <div ref={ref} className="relative flex items-center justify-center">
        {/* Input port (left side) */}
        {hasInputPort && onCompleteConnect && (
          <ConnectionPort
            side="left"
            onClick={handleCompleteConnect}
            isValidTarget={isValidTarget}
            isConnecting={isConnecting}
          />
        )}

        {renderInner()}

        {/* Output port (right side) */}
        {hasOutputPort && onStartConnect && (
          <ConnectionPort
            side="right"
            onClick={handleStartConnect}
            isActive={isConnectSource}
            isConnecting={isConnecting}
          />
        )}
      </div>
    );
  },
);

FlowNode.displayName = 'FlowNode';
