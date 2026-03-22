import { Warehouse, Package, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { PageHeader, MetricCard, EmptyState, ProgressBar } from '@/components';
import { useLoadStore } from '@/stores';

export function WarehouseDashboard() {
  const loads = useLoadStore((s) => s.loads);
  const warehouseLoads = loads.filter((l) => l.destination.type === 'warehouse');
  const incoming = warehouseLoads.filter((l) => l.status === 'in_execution').length;
  const received = warehouseLoads.filter((l) => l.status === 'completed').length;
  const totalQty = warehouseLoads.reduce((sum, l) => sum + l.totalActualQty, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Warehouse' }]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Incoming Loads"
          value={incoming}
          subInfo="En route to warehouse"
          icon={ArrowDownRight}
        />
        <MetricCard
          label="Received"
          value={received}
          subInfo="Delivered at warehouse"
          icon={Package}
        />
        <MetricCard
          label="Total Stock"
          value={`${totalQty.toLocaleString()} Kg`}
          subInfo="Actual received quantity"
          icon={Warehouse}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-card p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Warehouse Capacity</h3>
        <ProgressBar
          segments={[
            { label: 'Occupied', value: totalQty, color: 'bg-primary' },
            { label: 'Available', value: Math.max(0, 50000 - totalQty), color: 'bg-gray-200' },
          ]}
        />
      </div>

      <EmptyState
        title="Warehouse Operations"
        description="Full warehouse management with inbound/outbound tracking coming in Slice 2."
        icon={Warehouse}
      />
    </div>
  );
}
