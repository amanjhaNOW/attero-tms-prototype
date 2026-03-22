import {
  ClipboardList,
  Boxes,
  Truck,
  Warehouse,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, MetricCard, ProgressBar, StatusBadge } from '@/components';
import { usePRStore, useLoadStore, useShipmentStore } from '@/stores';

export function Dashboard() {
  const prs = usePRStore((s) => s.pickupRequests);
  const loads = useLoadStore((s) => s.loads);
  const shipments = useShipmentStore((s) => s.shipments);

  const pendingPRs = prs.filter((pr) => pr.status === 'pending').length;
  const activeLoads = loads.filter((l) => l.status !== 'completed' && l.status !== 'draft').length;
  const inTransit = shipments.filter((s) => s.status === 'in_transit').length;
  const completedThisMonth = shipments.filter((s) => s.status === 'completed').length;

  const totalPlannedQty = loads.reduce((sum, l) => sum + l.totalPlannedQty, 0);
  const totalActualQty = loads.reduce((sum, l) => sum + l.totalActualQty, 0);

  const plantDeliveries = loads.filter((l) => l.destination.type === 'plant' && l.status === 'completed').length;
  const warehouseDeliveries = loads.filter((l) => l.destination.type === 'warehouse' && l.status === 'completed').length;
  const transitCount = loads.filter((l) => l.status === 'in_execution').length;

  // Recent PRs
  const recentPRs = [...prs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pending Requests"
          value={pendingPRs}
          subInfo={`${prs.length} total requests`}
          icon={ClipboardList}
          trend={{ value: '+3 this week', positive: true }}
        />
        <MetricCard
          label="Active Loads"
          value={activeLoads}
          subInfo={`${loads.length} total loads`}
          icon={Boxes}
        />
        <MetricCard
          label="In Transit"
          value={inTransit}
          subInfo={`${shipments.length} total shipments`}
          icon={Truck}
          trend={{ value: '1 arriving today', positive: true }}
        />
        <MetricCard
          label="Completed"
          value={completedThisMonth}
          subInfo="This month"
          icon={Warehouse}
          trend={{ value: '+2 vs last month', positive: true }}
        />
      </div>

      {/* Mid Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quantity Tracker */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Material Flow</h3>
              <p className="text-sm text-text-muted">Planned vs Actual quantities</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-primary-50 p-4">
              <p className="text-sm font-medium text-primary-600">Total Planned</p>
              <p className="text-2xl font-bold text-primary">
                {totalPlannedQty.toLocaleString()} <span className="text-sm font-normal">Kg</span>
              </p>
            </div>
            <div className="rounded-lg bg-success-50 p-4">
              <p className="text-sm font-medium text-success-600">Total Actual</p>
              <p className="text-2xl font-bold text-success">
                {totalActualQty.toLocaleString()} <span className="text-sm font-normal">Kg</span>
              </p>
            </div>
          </div>
          <ProgressBar
            segments={[
              { label: 'Plant', value: plantDeliveries, color: 'bg-primary' },
              { label: 'Warehouse', value: warehouseDeliveries, color: 'bg-success' },
              { label: 'In Transit', value: transitCount, color: 'bg-warning' },
            ]}
          />
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <h3 className="mb-4 text-base font-semibold text-text-primary">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              to="/pickup-requests"
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-primary-50 hover:border-primary-200 group"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-text-muted group-hover:text-primary" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-primary">
                  View Pickup Requests
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
            </Link>
            <Link
              to="/loads/create"
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-primary-50 hover:border-primary-200 group"
            >
              <div className="flex items-center gap-3">
                <Boxes className="h-4 w-4 text-text-muted group-hover:text-primary" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-primary">
                  Create New Load
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
            </Link>
            <Link
              to="/shipments"
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-primary-50 hover:border-primary-200 group"
            >
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-text-muted group-hover:text-primary" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-primary">
                  Track Shipments
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
            </Link>
            <Link
              to="/warehouse"
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-primary-50 hover:border-primary-200 group"
            >
              <div className="flex items-center gap-3">
                <Warehouse className="h-4 w-4 text-text-muted group-hover:text-primary" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-primary">
                  Warehouse Dashboard
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Pickup Requests */}
      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Recent Pickup Requests</h3>
          <Link
            to="/pickup-requests"
            className="text-sm font-medium text-primary hover:text-primary-600 transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Client</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Pickup Date</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Materials</th>
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPRs.map((pr) => (
                <tr key={pr.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2.5">
                    <Link to={`/pickup-requests/${pr.id}`} className="font-medium text-primary hover:underline">
                      {pr.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-text-primary">{pr.clientName}</td>
                  <td className="px-3 py-2.5 text-text-muted">
                    {new Date(pr.tentativePickupDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">
                    {pr.materials.map((m) => m.type).join(', ')}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={pr.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
