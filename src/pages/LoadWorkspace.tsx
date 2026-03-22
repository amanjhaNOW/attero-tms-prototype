import { useParams, Link } from 'react-router-dom';
import { FileText, Truck } from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge, ProgressBar, MetricCard } from '@/components';
import { useLoadStore, useShipmentStore } from '@/stores';

export function LoadWorkspace() {
  const { id } = useParams<{ id: string }>();
  const load = useLoadStore((s) => s.loads.find((l) => l.id === id));
  const shipments = useShipmentStore((s) =>
    s.shipments.filter((sh) => sh.loadId === id)
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
            <Link to="/loads" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Back to Loads
            </Link>
          }
        />
      </div>
    );
  }

  const fulfillment = load.totalPlannedQty > 0
    ? Math.round((load.totalActualQty / load.totalPlannedQty) * 100)
    : 0;

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
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50">
              Edit Load
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
              Add Shipment
            </button>
          </div>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Pattern"
          value={load.patternLabel.replace(/_/g, ' ')}
        />
        <MetricCard
          label="Planned Qty"
          value={`${load.totalPlannedQty.toLocaleString()} Kg`}
        />
        <MetricCard
          label="Actual Qty"
          value={`${load.totalActualQty.toLocaleString()} Kg`}
        />
        <MetricCard
          label="Fulfillment"
          value={`${fulfillment}%`}
        />
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Fulfillment Progress</h3>
        <ProgressBar
          segments={[
            { label: 'Fulfilled', value: load.totalActualQty, color: 'bg-success' },
            { label: 'Remaining', value: Math.max(0, load.totalPlannedQty - load.totalActualQty), color: 'bg-gray-200' },
          ]}
        />
      </div>

      {/* Destination */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Destination</h3>
        <div className="flex items-start gap-3">
          <StatusBadge status={load.destination.type} />
          <div>
            <p className="font-medium text-text-primary">{load.destination.name}</p>
            <p className="text-sm text-text-muted">{load.destination.address}</p>
          </div>
        </div>
      </div>

      {/* Shipments */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Shipments</h3>
        {shipments.length === 0 ? (
          <EmptyState
            title="No Shipments"
            description="No shipments created for this load yet"
            icon={Truck}
          />
        ) : (
          <div className="space-y-3">
            {shipments.map((sh) => (
              <Link
                key={sh.id}
                to={`/shipments/${sh.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <Truck className="h-5 w-5 text-text-muted" />
                  <div>
                    <p className="font-medium text-primary">{sh.id}</p>
                    <p className="text-sm text-text-muted">
                      {sh.vehicleRegistration} · {sh.transporterName}
                    </p>
                  </div>
                </div>
                <StatusBadge status={sh.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Linked PRs */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Linked Pickup Requests</h3>
        {load.prIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {load.prIds.map((prId) => (
              <Link
                key={prId}
                to={`/pickup-requests/${prId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-100"
              >
                {prId}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No pickup requests linked</p>
        )}
      </div>
    </div>
  );
}
