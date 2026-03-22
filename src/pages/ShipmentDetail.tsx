import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Phone,
  User,
  Truck as TruckIcon,
  ChevronDown,
  ChevronUp,
  Send,
  SkipForward,
  Check,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  StatusBadge,
  WeighbridgeInput,
  MaterialLineItems,
} from '@/components';
import {
  useShipmentStore,
  useStopStore,
  useLoadStore,
  usePRStore,
  completeStop,
  dispatchShipment,
} from '@/stores';
import type { StopItem, Stop } from '@/types';

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const shipment = useShipmentStore((s) => s.shipments.find((sh) => sh.id === id));
  const stops = useStopStore((s) =>
    s.stops.filter((st) => st.shipmentId === id).sort((a, b) => a.sequence - b.sequence)
  );
  const loads = useLoadStore((s) => s.loads);
  const shipments = useShipmentStore((s) => s.shipments);
  const prs = usePRStore((s) => s.pickupRequests);

  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set());

  // ── Pickup form state ──────────────────
  const [actualItems, setActualItems] = useState<
    { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[]
  >([]);
  const [pickupInitialized, setPickupInitialized] = useState<string | null>(null);

  // ── Delivery form state ────────────────
  const [weights, setWeights] = useState<{
    tareWeight: number;
    grossWeight: number;
    netWeight: number;
  }>({ tareWeight: 0, grossWeight: 0, netWeight: 0 });

  if (!shipment) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Shipment"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Shipments', href: '/shipments' },
            { label: id ?? 'Unknown' },
          ]}
        />
        <EmptyState
          title="Shipment Not Found"
          description={`No shipment found with ID ${id}`}
          icon={FileText}
          action={
            <Link
              to="/shipments"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Back to Shipments
            </Link>
          }
        />
      </div>
    );
  }

  const load = loads.find((l) => l.id === shipment.loadId);

  // Find the active (next pending) stop
  const activeStop = stops.find((s) => s.status === 'pending');

  // Initialize pickup actual items from planned if not done yet
  if (activeStop && activeStop.type === 'PICKUP' && pickupInitialized !== activeStop.id) {
    const initial = activeStop.plannedItems.map((item) => ({
      material: item.material,
      qty: item.qty,
      unit: item.unit,
      invoiceNumber: '',
      remarks: '',
    }));
    setActualItems(initial);
    setPickupInitialized(activeStop.id);
  }

  const handleDispatch = useCallback(() => {
    if (shipment) {
      dispatchShipment(shipment.id);
    }
  }, [shipment]);

  const handleCompletePickup = useCallback(
    (stopId: string) => {
      const items: StopItem[] = actualItems
        .filter((i) => i.material && i.qty > 0)
        .map((i) => ({
          material: i.material,
          qty: i.qty,
          unit: i.unit,
          invoiceNumber: i.invoiceNumber || undefined,
          remarks: i.remarks || undefined,
        }));
      completeStop(stopId, items);
      setPickupInitialized(null);
    },
    [actualItems]
  );

  const handleCompleteDelivery = useCallback(
    (stopId: string) => {
      // Get actual items from the linked pickup stop
      const stop = stops.find((s) => s.id === stopId);
      const pickupStop = stop?.linkedStopId
        ? stops.find((s) => s.id === stop.linkedStopId)
        : undefined;

      // Use pickup actuals as delivery actuals (or from the current stop's planned)
      const deliveryActuals: StopItem[] = pickupStop
        ? pickupStop.actualItems.length > 0
          ? pickupStop.actualItems
          : pickupStop.plannedItems
        : stop?.plannedItems ?? [];

      completeStop(stopId, deliveryActuals, weights);
    },
    [weights, stops]
  );

  const handleSkipStop = useCallback(
    (stopId: string) => {
      useStopStore.getState().updateStop(stopId, {
        status: 'skipped',
        completedAt: new Date().toISOString(),
      });
    },
    []
  );

  const toggleCompleted = useCallback((stopId: string) => {
    setExpandedCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }
      return next;
    });
  }, []);

  // Sibling shipments in this load
  const siblingShipments = shipments.filter(
    (s) => s.loadId === shipment.loadId && s.id !== shipment.id
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.id}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Shipments', href: '/shipments' },
          { label: shipment.id },
        ]}
        status={shipment.status}
        actions={
          <div className="flex gap-2">
            {shipment.status === 'planned' && (
              <button
                onClick={handleDispatch}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
              >
                <Send className="h-4 w-4" />
                Dispatch
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Main Content (2 cols) ──────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Card — Transport Info */}
          <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Mode
                </p>
                <p className="text-sm capitalize text-text-primary">
                  {shipment.transportMode.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Transporter
                </p>
                <p className="text-sm font-medium text-text-primary">
                  {shipment.transporterName || <span className="text-text-muted italic">Not set</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                  Vehicle
                </p>
                <p className="text-sm font-mono text-text-primary">
                  {shipment.vehicleRegistration || <span className="text-text-muted italic">Not set</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    {shipment.driverName || <span className="text-text-muted italic">No driver</span>}
                  </p>
                  {shipment.driverPhone && (
                    <div className="flex items-center gap-1 text-sm text-text-muted">
                      <Phone className="h-3.5 w-3.5" />
                      {shipment.driverPhone}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Link
                  to={`/loads/${shipment.loadId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-100"
                >
                  <TruckIcon className="h-3.5 w-3.5" />
                  {shipment.loadId}
                </Link>
                {shipment.shipmentValue > 0 && (
                  <span className="text-sm font-semibold text-text-primary">
                    ₹{shipment.shipmentValue.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Stop Timeline ────────────── */}
          <div className="rounded-xl border border-gray-200 bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-text-primary">
              Stop Timeline
            </h3>

            <div className="space-y-0">
              {stops.map((stop, index) => (
                <StopTimelineNode
                  key={stop.id}
                  stop={stop}
                  isLast={index === stops.length - 1}
                  isActive={activeStop?.id === stop.id}
                  isExpanded={expandedCompleted.has(stop.id)}
                  onToggle={() => toggleCompleted(stop.id)}
                  // Pickup props
                  actualItems={actualItems}
                  onActualItemsChange={setActualItems}
                  onCompletePickup={() => handleCompletePickup(stop.id)}
                  // Delivery props
                  weights={weights}
                  onWeightsChange={setWeights}
                  onCompleteDelivery={() => handleCompleteDelivery(stop.id)}
                  // Skip
                  onSkip={() => handleSkipStop(stop.id)}
                  // PR context
                  linkedPR={prs.find((pr) => pr.id === stop.prId)}
                  linkedPickupStop={
                    stop.linkedStopId
                      ? stops.find((s) => s.id === stop.linkedStopId)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ─────────────── */}
        <div className="space-y-6">
          {/* Load Context */}
          <div className="rounded-xl border border-gray-200 bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Load Context
            </h3>
            {load && (
              <div className="space-y-3">
                <Link
                  to={`/loads/${load.id}`}
                  className="block rounded-lg bg-primary-50 p-3 hover:bg-primary-100 transition-colors"
                >
                  <p className="text-sm font-semibold text-primary">{load.id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={load.status} />
                    <span className="text-xs text-text-muted capitalize">
                      {load.patternLabel.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>

                {siblingShipments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-muted">
                      Other Shipments
                    </p>
                    {siblingShipments.map((sh) => (
                      <Link
                        key={sh.id}
                        to={`/shipments/${sh.id}`}
                        className="flex items-center justify-between rounded-lg border border-gray-100 p-2 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-primary">
                          {sh.id}
                        </span>
                        <StatusBadge status={sh.status} />
                      </Link>
                    ))}
                  </div>
                )}

                {siblingShipments.length === 0 && (
                  <p className="text-sm text-text-muted">
                    Only shipment in this load
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Linked PRs */}
          <div className="rounded-xl border border-gray-200 bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Pickup Requests
            </h3>
            <div className="space-y-2">
              {[...new Set(stops.map((s) => s.prId))]
                .map((prId) => prs.find((p) => p.id === prId))
                .filter(Boolean)
                .map((pr) => (
                  <Link
                    key={pr!.id}
                    to={`/pickup-requests/${pr!.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-2 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-primary">
                        {pr!.id}
                      </span>
                      <p className="text-xs text-text-muted">{pr!.clientName}</p>
                    </div>
                    <StatusBadge status={pr!.status} />
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stop Timeline Node Component ─────────────────────────────

interface StopTimelineNodeProps {
  stop: Stop;
  isLast: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  actualItems: { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[];
  onActualItemsChange: (items: { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[]) => void;
  onCompletePickup: () => void;
  weights: { tareWeight: number; grossWeight: number; netWeight: number };
  onWeightsChange: (w: { tareWeight: number; grossWeight: number; netWeight: number }) => void;
  onCompleteDelivery: () => void;
  onSkip: () => void;
  linkedPR?: { id: string; clientName: string; materials: { type: string; plannedQty: number; unit: string }[] };
  linkedPickupStop?: Stop;
}

function StopTimelineNode({
  stop,
  isLast,
  isActive,
  isExpanded,
  onToggle,
  actualItems,
  onActualItemsChange,
  onCompletePickup,
  weights,
  onWeightsChange,
  onCompleteDelivery,
  onSkip,
  linkedPickupStop,
}: StopTimelineNodeProps) {
  const isCompleted = stop.status === 'completed';
  const isSkipped = stop.status === 'skipped';
  const isPending = stop.status === 'pending' && !isActive;

  // Dot color
  const dotClass = isCompleted
    ? 'bg-success-100 border-success text-success'
    : isActive
    ? 'bg-primary-100 border-primary text-primary'
    : isSkipped
    ? 'bg-gray-100 border-gray-300 text-gray-400'
    : 'bg-gray-100 border-gray-200 text-gray-400';

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${dotClass}`}
        >
          {isCompleted ? (
            <Check className="h-5 w-5" />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] ${
              isCompleted ? 'bg-success-200' : 'bg-gray-200'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''} ${
          isPending ? 'opacity-50' : ''
        }`}
      >
        <div
          className={`rounded-lg border p-4 ${
            isActive
              ? 'border-primary-300 bg-primary-50/30 shadow-sm'
              : isCompleted
              ? 'border-gray-200 bg-white cursor-pointer hover:bg-gray-50'
              : 'border-gray-200 bg-gray-50/50'
          }`}
          onClick={isCompleted ? onToggle : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Stop {stop.sequence} — {stop.type}
              </span>
              <StatusBadge status={stop.status} />
            </div>
            <div className="flex items-center gap-2">
              {stop.completedAt && (
                <span className="text-xs text-text-muted">
                  {new Date(stop.completedAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {isCompleted && (
                isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-muted" />
                )
              )}
            </div>
          </div>

          <p className="font-medium text-text-primary">{stop.location.name}</p>
          <p className="text-sm text-text-muted">{stop.location.address}</p>

          {/* ── COMPLETED STOP ──────────── */}
          {isCompleted && !isExpanded && (
            <div className="mt-2 flex flex-wrap gap-2">
              {stop.actualItems.map((item, i) => (
                <span
                  key={i}
                  className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-600"
                >
                  {item.material}: {item.qty.toLocaleString()} {item.unit}
                </span>
              ))}
              {stop.netWeight != null && stop.netWeight > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
                  Net: {stop.netWeight.toLocaleString()} Kg
                </span>
              )}
            </div>
          )}

          {isCompleted && isExpanded && (
            <div className="mt-4 space-y-3">
              {stop.actualItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Actual Items
                  </p>
                  <MaterialLineItems
                    items={stop.actualItems.map((i) => ({
                      material: i.material,
                      qty: i.qty,
                      unit: i.unit,
                      invoiceNumber: i.invoiceNumber ?? '',
                      remarks: i.remarks ?? '',
                    }))}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              )}
              {stop.netWeight != null && stop.netWeight > 0 && (
                <WeighbridgeInput
                  tareWeight={stop.tareWeight ?? 0}
                  grossWeight={stop.grossWeight ?? 0}
                  onChange={() => {}}
                  readOnly
                />
              )}
            </div>
          )}

          {/* ── ACTIVE PICKUP STOP ─────── */}
          {isActive && stop.type === 'PICKUP' && (
            <div className="mt-4 space-y-4">
              {/* Planned items (read-only) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Planned Items
                </p>
                <div className="flex flex-wrap gap-2">
                  {stop.plannedItems.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary"
                    >
                      {item.material}: {item.qty.toLocaleString()} {item.unit}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actual items (editable) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Actual Items
                </p>
                <MaterialLineItems
                  items={actualItems}
                  onChange={onActualItemsChange}
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={onCompletePickup}
                  disabled={
                    actualItems.filter((i) => i.material && i.qty > 0).length === 0
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4" />
                  Complete Pickup
                </button>
                <button
                  onClick={onSkip}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  <SkipForward className="inline h-3.5 w-3.5 mr-1" />
                  Skip Stop
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVE DELIVER STOP ────── */}
          {isActive && stop.type === 'DELIVER' && (
            <div className="mt-4 space-y-4">
              {/* Material summary from pickup */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Material from Pickup
                </p>
                <div className="flex flex-wrap gap-2">
                  {(linkedPickupStop?.actualItems.length
                    ? linkedPickupStop.actualItems
                    : stop.plannedItems
                  ).map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600"
                    >
                      {item.material}: {item.qty.toLocaleString()} {item.unit}
                    </span>
                  ))}
                </div>
              </div>

              {/* Weighbridge Input */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Weighbridge
                </p>
                <WeighbridgeInput
                  tareWeight={weights.tareWeight}
                  grossWeight={weights.grossWeight}
                  onChange={onWeightsChange}
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={onCompleteDelivery}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-success/90 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Complete Delivery
                </button>
                <button
                  onClick={onSkip}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  <SkipForward className="inline h-3.5 w-3.5 mr-1" />
                  Skip Stop
                </button>
              </div>
            </div>
          )}

          {/* ── PENDING (inactive) ─────── */}
          {isPending && (
            <div className="mt-2 flex flex-wrap gap-2">
              {stop.plannedItems.map((item, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-text-muted"
                >
                  {item.material}: {item.qty.toLocaleString()} {item.unit}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
