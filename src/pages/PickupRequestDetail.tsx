import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, FileText } from 'lucide-react';
import { PageHeader, StatusBadge, EmptyState } from '@/components';
import { usePRStore } from '@/stores';

export function PickupRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pr = usePRStore((s) => s.pickupRequests.find((p) => p.id === id));

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
                  {pr.materials.reduce((sum, m) => sum + m.plannedQty, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-text-muted">Kg</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Linked Loads */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Linked Loads</h3>
        {pr.loadIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {pr.loadIds.map((loadId) => (
              <Link
                key={loadId}
                to={`/loads/${loadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-100 transition-colors"
              >
                {loadId}
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
