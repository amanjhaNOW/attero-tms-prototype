import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, SearchBar, TabBar, DataTable, StatusBadge } from '@/components';
import { useShipmentStore } from '@/stores';
import type { ColumnDef, TabItem, Shipment } from '@/types';

const columns: ColumnDef<Shipment & Record<string, unknown>>[] = [
  {
    key: 'id',
    header: 'Shipment ID',
    sortable: true,
    render: (val) => <span className="font-medium text-primary">{String(val)}</span>,
  },
  { key: 'loadId', header: 'Load', sortable: true },
  { key: 'transporterName', header: 'Transporter', sortable: true },
  { key: 'vehicleRegistration', header: 'Vehicle' },
  {
    key: 'vehicleType',
    header: 'Type',
    render: (val) => <span className="text-text-muted">{String(val)}</span>,
  },
  { key: 'driverName', header: 'Driver' },
  {
    key: 'scheduledPickupDate',
    header: 'Scheduled',
    sortable: true,
    render: (val) =>
      new Date(String(val)).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      }),
  },
  {
    key: 'shipmentValue',
    header: 'Value',
    sortable: true,
    render: (val) => `₹${Number(val).toLocaleString()}`,
  },
  {
    key: 'status',
    header: 'Status',
    render: (val) => <StatusBadge status={String(val)} />,
  },
];

export function ShipmentList() {
  const shipments = useShipmentStore((s) => s.shipments);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = { all: shipments.length };
    shipments.forEach((s) => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'draft', label: 'Draft', count: counts.draft || 0 },
      { key: 'planned', label: 'Planned', count: counts.planned || 0 },
      { key: 'in_transit', label: 'In Transit', count: counts.in_transit || 0 },
      { key: 'completed', label: 'Completed', count: counts.completed || 0 },
      { key: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0 },
    ];
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    let result = shipments;
    if (activeTab !== 'all') {
      result = result.filter((s) => s.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.id.toLowerCase().includes(q) ||
          s.transporterName.toLowerCase().includes(q) ||
          s.vehicleRegistration.toLowerCase().includes(q) ||
          s.driverName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [shipments, activeTab, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shipments"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Shipments' }]}
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by ID, transporter, vehicle, driver..."
        className="max-w-md"
      />

      <DataTable
        columns={columns}
        data={filteredShipments as (Shipment & Record<string, unknown>)[]}
        onRowClick={(row) => navigate(`/shipments/${(row as unknown as Shipment).id}`)}
        pageSize={10}
      />
    </div>
  );
}
