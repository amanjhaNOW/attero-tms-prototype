import { useState, useCallback, useMemo } from 'react';
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
import { getStopDisplayLabel, getShipmentRole } from '@/lib/stopDisplayLabel';

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const allShipments = useShipmentStore((s) => s.shipments);
  const allStopsRaw = useStopStore((s) => s.stops);
  const loads = useLoadStore((s) => s.loads);
  const prs = usePRStore((s) => s.pickupRequests);

  const shipment = useMemo(() => allShipments.find((sh) => sh.id === id), [allShipments, id]);
  const stops = useMemo(
    () => allStopsRaw.filter((st) => st.shipmentId === id).sort((a, b) => a.sequence - b.sequence),
    [allStopsRaw, id]
  );
  const shipments = allShipments;

  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set());

  // ── Per-stop actual items state (keyed by stop ID) ──────
  const [stopActualItems, setStopActualItems] = useState<
    Record<string, { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[]>
  >({});
  const [initializedStops, setInitializedStops] = useState<Set<string>>(new Set());

  // ── Delivery form state ────────────────
  const [weights, setWeights] = useState<{
    tareWeight: number;
    grossWeight: number;
    netWeight: number;
  }>({ tareWeight: 0, grossWeight: 0, netWeight: 0 });

  // ── Transfer / Handover form state ────────────────
  const [handoverLocation, setHandoverLocation] = useState<Record<string, string>>({});
  const [handoverQty, setHandoverQty] = useState<Record<string, number>>({});
  const [transferError, setTransferError] = useState<string | null>(null);

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
  const isMilkRun = load?.patternLabel === 'milk_run';
  const pickupStops = stops.filter((s) => s.type === 'PICKUP');
  const deliverStops = stops.filter((s) => s.type === 'DELIVER');
  const transferOutStops = useMemo(() => stops.filter((s) => s.type === 'TRANSFER_OUT'), [stops]);
  const transferInStops = useMemo(() => stops.filter((s) => s.type === 'TRANSFER_IN'), [stops]);
  const allPickupsCompleted = pickupStops.every((s) => s.status === 'completed');

  // Shipment role detection
  const shipmentRole = useMemo(() => getShipmentRole(stops), [stops]);

  // Find the active (next pending) stop — follows sequence order
  // For cross-dock: PICKUP → TRANSFER_OUT → TRANSFER_IN (each independent) → DELIVER
  const activeStop = useMemo(() => {
    // Sequence-ordered: find first pending stop
    const nextPending = stops.find((s) => s.status === 'pending');
    if (!nextPending) return undefined;

    // DELIVER is blocked until ALL pickups AND ALL TRANSFER_INs in this shipment are completed
    if (nextPending.type === 'DELIVER') {
      const allPrereqsDone = stops
        .filter((s) => s.type === 'PICKUP' || s.type === 'TRANSFER_IN')
        .every((s) => s.status === 'completed' || s.status === 'skipped');
      if (!allPrereqsDone) {
        return undefined;
      }
    }

    // TRANSFER_IN: check if its 1:1 linked TRANSFER_OUT is completed
    if (nextPending.type === 'TRANSFER_IN' && nextPending.linkedStopId) {
      const linkedOut = allStopsRaw.find((s) => s.id === nextPending.linkedStopId);
      if (linkedOut && linkedOut.status !== 'completed') {
        return nextPending; // Return it but we'll show it as "waiting"
      }
    }

    return nextPending;
  }, [stops, allStopsRaw]);

  // Initialize actual items for the active stop if not done yet
  if (activeStop && activeStop.type === 'PICKUP' && !initializedStops.has(activeStop.id)) {
    const initial = activeStop.plannedItems.map((item) => ({
      material: item.material,
      qty: item.qty,
      unit: item.unit,
      invoiceNumber: '',
      remarks: '',
    }));
    setStopActualItems((prev) => ({ ...prev, [activeStop.id]: initial }));
    setInitializedStops((prev) => new Set(prev).add(activeStop.id));
  }

  const handleDispatch = useCallback(() => {
    if (shipment) {
      dispatchShipment(shipment.id);
    }
  }, [shipment]);

  const handleCompletePickup = useCallback(
    (stopId: string) => {
      const items = stopActualItems[stopId] ?? [];
      const stopItems: StopItem[] = items
        .filter((i) => i.material && i.qty > 0)
        .map((i) => ({
          material: i.material,
          qty: i.qty,
          unit: i.unit,
          invoiceNumber: i.invoiceNumber || undefined,
          remarks: i.remarks || undefined,
        }));
      completeStop(stopId, stopItems);
      // Clear initialized so next pickup can initialize
      setInitializedStops((prev) => {
        const next = new Set(prev);
        next.delete(stopId);
        return next;
      });
    },
    [stopActualItems]
  );

  const handleCompleteDelivery = useCallback(
    (stopId: string) => {
      // For milk run: combine actual items from ALL completed pickup stops
      const completedPickups = pickupStops.filter((s) => s.status === 'completed' || s.id === stopId);
      
      // Re-read stops from store for latest data
      const freshStops = useStopStore.getState().stops;
      const allPickupActuals: StopItem[] = [];
      completedPickups.forEach((ps) => {
        const freshPickup = freshStops.find((s) => s.id === ps.id);
        if (freshPickup && freshPickup.actualItems.length > 0) {
          allPickupActuals.push(...freshPickup.actualItems);
        } else if (freshPickup) {
          allPickupActuals.push(...freshPickup.plannedItems);
        }
      });

      // If no pickup actuals found, fall back to the deliver stop's planned items
      const stop = freshStops.find((s) => s.id === stopId);
      const deliveryActuals = allPickupActuals.length > 0
        ? allPickupActuals
        : stop?.plannedItems ?? [];

      completeStop(stopId, deliveryActuals, weights);
    },
    [weights, pickupStops]
  );

  const handleCompleteHandover = useCallback(
    (stopId: string) => {
      const stop = stops.find((s) => s.id === stopId);
      if (!stop) return;

      // Update location if user specified a meeting point
      const meetingPoint = handoverLocation[stopId];
      if (meetingPoint) {
        useStopStore.getState().updateStop(stopId, {
          location: { ...stop.location, name: meetingPoint, address: meetingPoint },
        });
      }

      // Build actual items from the stop's planned items (or custom qty)
      const qty = handoverQty[stopId];
      const handoverItems: StopItem[] = stop.plannedItems.map((item) => ({
        material: item.material,
        qty: qty && qty > 0 ? qty : item.qty,
        unit: item.unit,
      }));

      const result = completeStop(stopId, handoverItems);
      if (!result.success) {
        setTransferError(result.message || 'Failed to complete handover');
      } else {
        setTransferError(null);
      }
    },
    [stops, handoverLocation, handoverQty],
  );

  const handleCompleteReceive = useCallback(
    (stopId: string) => {
      setTransferError(null);

      // 1:1 model: gather actual items from the single linked TRANSFER_OUT
      const stop = stops.find((s) => s.id === stopId);
      if (!stop) return;

      const freshStops = useStopStore.getState().stops;
      const linkedOut = stop.linkedStopId
        ? freshStops.find((s) => s.id === stop.linkedStopId)
        : undefined;

      const receiveItems: StopItem[] = linkedOut
        ? (linkedOut.actualItems.length > 0 ? linkedOut.actualItems : linkedOut.plannedItems)
        : stop.plannedItems;

      // Update location from linked TRANSFER_OUT
      if (linkedOut && linkedOut.status === 'completed' && linkedOut.location.name) {
        useStopStore.getState().updateStop(stopId, {
          location: { ...linkedOut.location },
        });
      }

      const result = completeStop(stopId, receiveItems);
      if (!result.success) {
        setTransferError(result.message || 'Cannot confirm receipt yet');
      } else {
        setTransferError(null);
      }
    },
    [stops],
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

      {/* Milk Run indicator banner */}
      {isMilkRun && (
        <div className="rounded-lg bg-primary-50 border border-primary-200 px-4 py-3 flex items-center gap-3">
          <span className="text-lg">🥛</span>
          <div>
            <p className="text-sm font-semibold text-primary">Milk Run Shipment</p>
            <p className="text-xs text-primary-600">
              {pickupStops.length} pickup stops → 1 delivery. 
              Completed: {pickupStops.filter((s) => s.status === 'completed').length}/{pickupStops.length} pickups
              {allPickupsCompleted && ' ✓ All pickups done — ready for delivery'}
            </p>
          </div>
        </div>
      )}

      {/* Cross-dock / Transfer indicator banner */}
      {shipmentRole && (
        <div className={`rounded-lg px-4 py-3 flex items-center gap-3 ${
          shipmentRole === 'Feeder'
            ? 'bg-amber-50 border border-amber-200'
            : shipmentRole === 'Line-Haul'
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-purple-50 border border-purple-200'
        }`}>
          <span className="text-lg">{shipmentRole === 'Feeder' ? '🤝' : shipmentRole === 'Line-Haul' ? '📥' : '🔄'}</span>
          <div>
            <p className={`text-sm font-semibold ${
              shipmentRole === 'Feeder' ? 'text-amber-800' : shipmentRole === 'Line-Haul' ? 'text-blue-800' : 'text-purple-800'
            }`}>
              {shipmentRole} Shipment
            </p>
            <p className={`text-xs ${
              shipmentRole === 'Feeder' ? 'text-amber-600' : shipmentRole === 'Line-Haul' ? 'text-blue-600' : 'text-purple-600'
            }`}>
              {shipmentRole === 'Feeder' && `${pickupStops.length} pickup → ${transferOutStops.length} handover`}
              {shipmentRole === 'Line-Haul' && `${transferInStops.length} receive → ${deliverStops.length} delivery`}
              {shipmentRole === 'Relay' && `${transferInStops.length} receive → ${transferOutStops.length} handover`}
            </p>
          </div>
        </div>
      )}

      {/* Transfer error message */}
      {transferError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <p className="text-sm text-red-700">{transferError}</p>
          <button
            onClick={() => setTransferError(null)}
            className="ml-auto text-xs text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

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
              {isMilkRun && (
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({pickupStops.length} pickups + {deliverStops.length} delivery)
                </span>
              )}
            </h3>

            <div className="space-y-0">
              {stops.map((stop, index) => {
                const isActiveStop = activeStop?.id === stop.id;
                // For milk run DELIVER: only active if ALL pickups completed
                // DELIVER is blocked until ALL PICKUP + TRANSFER_IN stops in shipment are completed
                const allPrereqsCompleted = stops
                  .filter((s) => s.type === 'PICKUP' || s.type === 'TRANSFER_IN')
                  .every((s) => s.status === 'completed' || s.status === 'skipped');
                const isDeliverBlocked =
                  stop.type === 'DELIVER' && !allPrereqsCompleted && stop.status === 'pending';

                // TRANSFER_IN blocked until its 1:1 linked TRANSFER_OUT is complete
                const linkedOut = stop.type === 'TRANSFER_IN' && stop.linkedStopId
                  ? allStopsRaw.find((s) => s.id === stop.linkedStopId)
                  : undefined;
                const linkedOuts = linkedOut ? [linkedOut] : [];
                const isTransferInBlocked =
                  stop.type === 'TRANSFER_IN' &&
                  stop.status === 'pending' &&
                  linkedOut != null &&
                  linkedOut.status !== 'completed';

                return (
                  <StopTimelineNode
                    key={stop.id}
                    stop={stop}
                    isLast={index === stops.length - 1}
                    isActive={isActiveStop && !isDeliverBlocked && !isTransferInBlocked}
                    isBlocked={isDeliverBlocked || isTransferInBlocked}
                    isExpanded={expandedCompleted.has(stop.id)}
                    onToggle={() => toggleCompleted(stop.id)}
                    // Pickup props
                    actualItems={stopActualItems[stop.id] ?? []}
                    onActualItemsChange={(items) =>
                      setStopActualItems((prev) => ({ ...prev, [stop.id]: items }))
                    }
                    onCompletePickup={() => handleCompletePickup(stop.id)}
                    // Delivery props
                    weights={weights}
                    onWeightsChange={setWeights}
                    onCompleteDelivery={() => handleCompleteDelivery(stop.id)}
                    // Transfer / Handover props
                    onCompleteHandover={() => handleCompleteHandover(stop.id)}
                    onCompleteReceive={() => handleCompleteReceive(stop.id)}
                    handoverLocation={handoverLocation[stop.id] ?? ''}
                    onHandoverLocationChange={(val) =>
                      setHandoverLocation((prev) => ({ ...prev, [stop.id]: val }))
                    }
                    handoverQty={handoverQty[stop.id] ?? 0}
                    onHandoverQtyChange={(val) =>
                      setHandoverQty((prev) => ({ ...prev, [stop.id]: val }))
                    }
                    linkedTransferOuts={linkedOuts}
                    allShipments={shipments}
                    allStops={allStopsRaw}
                    // Skip
                    onSkip={() => handleSkipStop(stop.id)}
                    // PR context
                    linkedPR={prs.find((pr) => pr.id === stop.prId)}
                    linkedPickupStop={
                      stop.linkedStopId
                        ? stops.find((s) => s.id === stop.linkedStopId)
                        : undefined
                    }
                    allPickupStops={pickupStops}
                    isMilkRun={isMilkRun}
                  />
                );
              })}
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
              {[...new Set(stops.filter((s) => s.prId).map((s) => s.prId))]
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
  isBlocked?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  actualItems: { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[];
  onActualItemsChange: (items: { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[]) => void;
  onCompletePickup: () => void;
  weights: { tareWeight: number; grossWeight: number; netWeight: number };
  onWeightsChange: (w: { tareWeight: number; grossWeight: number; netWeight: number }) => void;
  onCompleteDelivery: () => void;
  // Transfer / Handover props
  onCompleteHandover?: () => void;
  onCompleteReceive?: () => void;
  handoverLocation?: string;
  onHandoverLocationChange?: (val: string) => void;
  handoverQty?: number;
  onHandoverQtyChange?: (val: number) => void;
  linkedTransferOuts?: Stop[];
  allShipments?: import('@/types').Shipment[];
  allStops?: Stop[];
  // Common
  onSkip: () => void;
  linkedPR?: { id: string; clientName: string; materials: { type: string; plannedQty: number; unit: string }[] };
  linkedPickupStop?: Stop;
  allPickupStops?: Stop[];
  isMilkRun?: boolean;
}

function StopTimelineNode({
  stop,
  isLast,
  isActive,
  isBlocked = false,
  isExpanded,
  onToggle,
  actualItems,
  onActualItemsChange,
  onCompletePickup,
  weights,
  onWeightsChange,
  onCompleteDelivery,
  onCompleteHandover,
  onCompleteReceive,
  handoverLocation,
  onHandoverLocationChange,
  handoverQty,
  onHandoverQtyChange,
  linkedTransferOuts,
  allShipments,
  allStops,
  onSkip,
  linkedPR,
  linkedPickupStop,
  allPickupStops,
  isMilkRun,
}: StopTimelineNodeProps) {
  const isCompleted = stop.status === 'completed';
  const isSkipped = stop.status === 'skipped';
  const isPending = stop.status === 'pending' && !isActive && !isBlocked;

  // Dot color
  const dotClass = isCompleted
    ? 'bg-success-100 border-success text-success'
    : isActive
    ? 'bg-primary-100 border-primary text-primary'
    : isBlocked
    ? 'bg-orange-50 border-orange-300 text-orange-400'
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
          isPending || isBlocked ? 'opacity-50' : ''
        }`}
      >
        <div
          className={`rounded-lg border p-4 ${
            isActive
              ? 'border-primary-300 bg-primary-50/30 shadow-sm'
              : isBlocked
              ? 'border-orange-200 bg-orange-50/20'
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
                Stop {stop.sequence} — {
                  stop.type === 'TRANSFER_OUT'
                    ? '🤝 Handover'
                    : stop.type === 'TRANSFER_IN'
                      ? '📥 Receive'
                      : stop.type
                }
              </span>
              <StatusBadge status={stop.status} />
              {/* Show client name for PICKUP stops */}
              {stop.type === 'PICKUP' && linkedPR && (
                <span className="text-xs font-medium text-primary bg-primary-50 rounded-full px-2 py-0.5">
                  {linkedPR.clientName}
                </span>
              )}
              {/* Show target for TRANSFER_OUT */}
              {stop.type === 'TRANSFER_OUT' && allStops && allShipments && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                  {(() => {
                    const linked = allStops.find((s) => s.id === stop.linkedStopId);
                    const targetShip = linked ? allShipments.find((s) => s.id === linked.shipmentId) : null;
                    return targetShip ? `→ ${targetShip.id}` : '→ TBD';
                  })()}
                </span>
              )}
              {/* Show source for TRANSFER_IN (1:1 linked TRANSFER_OUT) */}
              {stop.type === 'TRANSFER_IN' && stop.linkedStopId && allStops && allShipments && (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                  {(() => {
                    const linked = allStops.find((s) => s.id === stop.linkedStopId);
                    const sourceShip = linked ? allShipments.find((s) => s.id === linked.shipmentId) : null;
                    return sourceShip ? `← ${sourceShip.id}` : '← feeder';
                  })()}
                </span>
              )}
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

          {/* Blocked message for DELIVER when prerequisites not done */}
          {isBlocked && stop.type === 'DELIVER' && (
            <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs font-medium text-orange-600">
                ⏳ Waiting for all pickups and receives to complete before delivery
              </p>
              {allPickupStops && (
                <p className="text-xs text-orange-500 mt-1">
                  {allPickupStops.filter((s) => s.status === 'completed').length}/{allPickupStops.length} pickups completed
                </p>
              )}
            </div>
          )}

          {/* Blocked message for TRANSFER_IN when linked handover not done */}
          {isBlocked && stop.type === 'TRANSFER_IN' && linkedTransferOuts && allShipments && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              {linkedTransferOuts.map((out) => {
                const ship = allShipments.find((s) => s.id === out.shipmentId);
                const isDone = out.status === 'completed';
                return (
                  <div key={out.id} className="flex items-center gap-2 text-xs">
                    {isDone ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-amber-500">⏳</span>
                    )}
                    <span className={isDone ? 'text-green-700' : 'text-amber-800 font-medium'}>
                      {isDone
                        ? `Received from ${ship?.id || out.shipmentId}`
                        : `Waiting for ${ship?.id || out.shipmentId} to complete handover`}
                    </span>
                    {isDone && (
                      <span className="text-green-600 text-[10px]">
                        ({out.actualItems.reduce((s, i) => s + i.qty, 0).toLocaleString()} Kg)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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

          {/* ── ACTIVE TRANSFER_OUT (Handover) STOP ────── */}
          {isActive && stop.type === 'TRANSFER_OUT' && (
            <div className="mt-4 space-y-4">
              {/* Planned material */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Material to Hand Over
                </p>
                <div className="flex flex-wrap gap-2">
                  {stop.plannedItems.map((item, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                    >
                      {item.material}: {item.qty.toLocaleString()} {item.unit}
                    </span>
                  ))}
                </div>
              </div>

              {/* Meeting point */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">
                  Meeting Point
                </label>
                <input
                  type="text"
                  value={handoverLocation ?? ''}
                  onChange={(e) => onHandoverLocationChange?.(e.target.value)}
                  placeholder="Enter meeting point location..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Free text — where will the trucks meet?
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={onCompleteHandover}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Complete Handover ✅
                </button>
                <button
                  onClick={onSkip}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  <SkipForward className="inline h-3.5 w-3.5 mr-1" />
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVE TRANSFER_IN (Receive) STOP — 1:1 model ────── */}
          {isActive && stop.type === 'TRANSFER_IN' && linkedTransferOuts && allShipments && (
            <div className="mt-4 space-y-4">
              {/* Show material from the single linked TRANSFER_OUT */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Material from Feeder
                </p>
                <div className="space-y-1.5">
                  {linkedTransferOuts.map((out) => {
                    const ship = allShipments.find((s) => s.id === out.shipmentId);
                    const items = out.status === 'completed' && out.actualItems.length > 0
                      ? out.actualItems
                      : out.plannedItems;
                    const totalQty = items.reduce((s, i) => s + i.qty, 0);
                    return (
                      <div
                        key={out.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                          out.status === 'completed'
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <span className="text-sm">
                          {out.status === 'completed' ? '✅' : '⏳'}
                        </span>
                        <span className="text-xs font-bold text-text-primary">
                          📥 Receive from {ship?.id || 'Unknown'}:
                        </span>
                        <span className="text-xs text-text-secondary">
                          {totalQty.toLocaleString()} Kg
                        </span>
                        {items.map((item, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-text-muted"
                          >
                            {item.material}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Location from linked TRANSFER_OUT */}
              {(() => {
                const out = linkedTransferOuts[0];
                const locName = out?.location.name || stop.location.name;
                if (locName) {
                  return (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                        Meeting Point
                      </p>
                      <p className="text-sm text-text-primary bg-gray-50 rounded-lg px-3 py-2">
                        📍 {locName} <span className="text-text-muted text-[10px]">(from handover)</span>
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                {(() => {
                  const outDone = linkedTransferOuts.length > 0 && linkedTransferOuts[0].status === 'completed';
                  return (
                    <button
                      onClick={onCompleteReceive}
                      disabled={!outDone}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-4 w-4" />
                      {outDone ? 'Confirm Receipt ✅' : '⏳ Waiting for handover...'}
                    </button>
                  );
                })()}
                <button
                  onClick={onSkip}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                  <SkipForward className="inline h-3.5 w-3.5 mr-1" />
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVE DELIVER STOP ────── */}
          {isActive && stop.type === 'DELIVER' && (
            <div className="mt-4 space-y-4">
              {/* Material summary from pickup(s) */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  {isMilkRun ? 'Combined Material from All Pickups' : 'Material from Pickup'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isMilkRun && allPickupStops ? (
                    // Show combined actuals from all pickup stops
                    allPickupStops.flatMap((ps) =>
                      (ps.actualItems.length > 0 ? ps.actualItems : ps.plannedItems).map(
                        (item, i) => (
                          <span
                            key={`${ps.id}-${i}`}
                            className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600"
                          >
                            {item.material}: {item.qty.toLocaleString()} {item.unit}
                          </span>
                        )
                      )
                    )
                  ) : (
                    // Direct: show from linked pickup stop
                    (linkedPickupStop?.actualItems.length
                      ? linkedPickupStop.actualItems
                      : stop.plannedItems
                    ).map((item, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600"
                      >
                        {item.material}: {item.qty.toLocaleString()} {item.unit}
                      </span>
                    ))
                  )}
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
          {isPending && !isBlocked && (
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
