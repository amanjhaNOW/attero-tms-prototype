import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, FileText, Truck, Package, ArrowRight } from 'lucide-react';
import { PageHeader, StatusBadge, EmptyState, ProgressBar } from '@/components';
import { usePRStore, useLoadStore, useShipmentStore, useStopStore } from '@/stores';

export function PickupRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const allPRs = usePRStore((s) => s.pickupRequests);
  const allLoads = useLoadStore((s) => s.loads);
  const allShipments = useShipmentStore((s) => s.shipments);
  const allStops = useStopStore((s) => s.stops);

  const pr = useMemo(() => allPRs.find((p) => p.id === id), [allPRs, id]);

  // Find all loads that reference this PR
  const linkedLoads = useMemo(() => {
    if (!pr) return [];
    return allLoads.filter((l) => l.prIds.includes(pr.id));
  }, [pr, allLoads]);

  // Find all stops that reference this PR
  const prStops = useMemo(() => {
    if (!pr) return [];
    return allStops.filter((s) => s.prId === pr.id);
  }, [pr, allStops]);

  // Find all shipments that have stops referencing this PR
  const shipmentTrail = useMemo(() => {
    if (!pr) return [];
    const shipmentIds = [...new Set(prStops.map((s) => s.shipmentId))];
    return shipmentIds
      .map((shId) => allShipments.find((sh) => sh.id === shId))
      .filter(Boolean)
      .map((sh) => sh!);
  }, [pr, prStops, allShipments]);

  // Calculate quantities
  const qtyData = useMemo(() => {
    if (!pr) return { totalPlanned: 0, qtyPicked: 0, qtyAtPlant: 0, qtyAtWarehouse: 0, qtyInTransit: 0 };

    const totalPlanned = pr.materials.reduce((sum, m) => sum + m.plannedQty, 0);

    // Qty picked = sum of actual_items qty from PICKUP stops (completed)
    const pickupStops = prStops.filter((s) => s.type === 'PICKUP' && s.status === 'completed');
    const qtyPicked = pickupStops.reduce((sum, s) => sum + s.totalActualQty, 0);

    // For DELIVER stops, determine if destination is plant or warehouse
    const deliverStops = prStops.filter((s) => s.type === 'DELIVER' && s.status === 'completed');

    let qtyAtPlant = 0;
    let qtyAtWarehouse = 0;

    deliverStops.forEach((stop) => {
      // Find the load this shipment belongs to
      const shipment = allShipments.find((sh) => sh.id === stop.shipmentId);
      if (shipment) {
        const load = allLoads.find((l) => l.id === shipment.loadId);
        if (load) {
          if (load.destination.type === 'plant') {
            qtyAtPlant += stop.totalActualQty;
          } else {
            qtyAtWarehouse += stop.totalActualQty;
          }
        }
      }
    });

    const qtyInTransit = Math.max(0, qtyPicked - qtyAtPlant - qtyAtWarehouse);

    return { totalPlanned, qtyPicked, qtyAtPlant, qtyAtWarehouse, qtyInTransit };
  }, [pr, prStops, allShipments, allLoads]);

  if (!pr) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Pickup Request"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Pickup Requests', href: '/pickup-requests' },
            { label: id ?? 'Unknown' },
          ]}
        />
        <EmptyState
          title="Request Not Found"
          description={`No pickup request found with ID ${id}`}
          icon={FileText}
          action={
            <Link
              to="/pickup-requests"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Back to List
            </Link>
          }
        />
      </div>
    );
  }

  const totalPlannedQty = pr.materials.reduce((sum, m) => sum + m.plannedQty, 0);

  // Build progress segments (only show segments with values > 0, plus remaining)
  const progressSegments = [];
  if (qtyData.qtyAtPlant > 0) {
    progressSegments.push({
      label: `At Plant (${formatQty(qtyData.qtyAtPlant)})`,
      value: qtyData.qtyAtPlant,
      color: 'bg-success',
    });
  }
  if (qtyData.qtyAtWarehouse > 0) {
    progressSegments.push({
      label: `At Warehouse (${formatQty(qtyData.qtyAtWarehouse)})`,
      value: qtyData.qtyAtWarehouse,
      color: 'bg-warning',
    });
  }
  if (qtyData.qtyInTransit > 0) {
    progressSegments.push({
      label: `In Transit (${formatQty(qtyData.qtyInTransit)})`,
      value: qtyData.qtyInTransit,
      color: 'bg-primary',
    });
  }
  const qtyAccountedFor = qtyData.qtyAtPlant + qtyData.qtyAtWarehouse + qtyData.qtyInTransit;
  const remaining = Math.max(0, totalPlannedQty - qtyAccountedFor);
  if (remaining > 0) {
    progressSegments.push({
      label: `Pending (${formatQty(remaining)})`,
      value: remaining,
      color: 'bg-gray-200',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pr.id}
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Pickup Requests', href: '/pickup-requests' },
          { label: pr.id },
        ]}
        status={pr.status}
        actions={
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors">
              Edit
            </button>
            {pr.status === 'pending' && (
              <button
                onClick={() => navigate(`/loads/create?prs=${pr.id}`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
              >
                Create Load
              </button>
            )}
          </div>
        }
      />

      {/* ── Qty Split Progress Bar ────────── */}
      {qtyAccountedFor > 0 && (
        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Quantity Tracker</h3>
            <span className="text-sm font-medium text-text-muted">
              Total: {formatQty(totalPlannedQty)}
            </span>
          </div>
          <ProgressBar segments={progressSegments} />
          <div className="flex flex-wrap gap-4 text-sm">
            {qtyData.qtyAtPlant > 0 && (
              <span className="text-success font-medium">
                {formatQty(qtyData.qtyAtPlant)} at Plant
              </span>
            )}
            {qtyData.qtyAtWarehouse > 0 && (
              <span className="text-warning font-medium">
                {formatQty(qtyData.qtyAtWarehouse)} at WH
              </span>
            )}
            {qtyData.qtyInTransit > 0 && (
              <span className="text-primary font-medium">
                {formatQty(qtyData.qtyInTransit)} in Transit
              </span>
            )}
            {remaining > 0 && (
              <span className="text-text-muted">
                {formatQty(remaining)} pending
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Shipment Trail Table ─────────── */}
      {shipmentTrail.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <h3 className="mb-4 text-base font-semibold text-text-primary">
            Shipment Trail ({shipmentTrail.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Shipment</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Load</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">From → To</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Qty Picked</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Qty Delivered</th>
                  <th className="px-3 py-2 text-left font-semibold text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipmentTrail.map((sh) => {
                  const load = allLoads.find((l) => l.id === sh.loadId);
                  const shStops = prStops.filter((s) => s.shipmentId === sh.id);
                  const pickupStop = shStops.find((s) => s.type === 'PICKUP');
                  const deliverStop = shStops.find((s) => s.type === 'DELIVER');
                  const qtyPickedForShipment = pickupStop?.status === 'completed'
                    ? pickupStop.totalActualQty
                    : 0;
                  const qtyDeliveredForShipment = deliverStop?.status === 'completed'
                    ? deliverStop.totalActualQty
                    : 0;

                  return (
                    <tr
                      key={sh.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/shipments/${sh.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {sh.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {load ? (
                          <Link
                            to={`/loads/${load.id}`}
                            className="text-primary hover:underline"
                          >
                            {load.id}
                          </Link>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="capitalize text-text-secondary">
                          {load?.patternLabel.replace(/_/g, ' ') ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <span className="truncate max-w-[120px]">
                            {pickupStop?.location.city ?? '—'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-text-muted flex-shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {deliverStop?.location.city ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {qtyPickedForShipment > 0
                          ? formatQty(qtyPickedForShipment)
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {qtyDeliveredForShipment > 0
                          ? formatQty(qtyDeliveredForShipment)
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={sh.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Request Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Source ID</p>
              <p className="text-sm font-medium text-text-primary">{pr.sourceRequestId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Request Type</p>
              <p className="text-sm font-medium text-text-primary">{pr.requestType}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Service Type</p>
              <p className="text-sm font-medium text-text-primary capitalize">{pr.serviceType.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Client</p>
              <p className="text-sm font-medium text-text-primary">{pr.clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="h-4 w-4" />
            Pickup Date: {new Date(pr.tentativePickupDate).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>
          <div className="text-xs text-text-muted">
            Created: {new Date(pr.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </div>
        </div>

        {/* Locations */}
        <div className="rounded-xl border border-gray-200 bg-card p-5 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Locations</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-50">
                <MapPin className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5">Pickup</p>
                <p className="text-sm font-medium text-text-primary">{pr.pickupLocation.name}</p>
                <p className="text-xs text-text-muted">{pr.pickupLocation.address}</p>
              </div>
            </div>
            <div className="ml-4 h-6 border-l-2 border-dashed border-gray-200" />
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-50">
                <MapPin className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-0.5">Delivery</p>
                <p className="text-sm font-medium text-text-primary">{pr.deliveryLocation.name}</p>
                <p className="text-xs text-text-muted">{pr.deliveryLocation.address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Materials</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Material Type</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Planned Qty</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Unit</th>
              </tr>
            </thead>
            <tbody>
              {pr.materials.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-2.5 font-medium text-text-primary">{m.type}</td>
                  <td className="px-3 py-2.5 text-text-primary">{m.plannedQty.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-text-muted">{m.unit}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50/50">
                <td className="px-3 py-2.5 font-semibold text-text-primary">Total</td>
                <td className="px-3 py-2.5 font-semibold text-text-primary">
                  {totalPlannedQty.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-text-muted">Kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Linked Loads */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-text-primary">
          Linked Loads ({linkedLoads.length})
        </h3>
        {linkedLoads.length > 0 ? (
          <div className="space-y-2">
            {linkedLoads.map((load) => (
              <Link
                key={load.id}
                to={`/loads/${load.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary">{load.id}</p>
                    <p className="text-xs text-text-muted capitalize">
                      {load.patternLabel.replace(/_/g, ' ')} · {load.destination.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {allShipments.filter((s) => s.loadId === load.id).length} shipment(s)
                  </span>
                  <StatusBadge status={load.status} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No loads linked yet</p>
        )}
      </div>
    </div>
  );
}

function formatQty(qty: number): string {
  if (qty >= 1000) {
    return `${(qty / 1000).toFixed(1)}T`;
  }
  return `${qty.toLocaleString()} Kg`;
}
