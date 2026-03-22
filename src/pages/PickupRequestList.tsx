import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, SearchBar, TabBar, FilterBar, DataTable, StatusBadge, ActionBar } from '@/components';
import { usePRStore } from '@/stores';
import type { ColumnDef, FilterChip, TabItem, PickupRequest } from '@/types';

const columns: ColumnDef<PickupRequest & Record<string, unknown>>[] = [
  {
    key: 'id',
    header: 'Request ID',
    sortable: true,
    render: (val) => (
      <span className="font-medium text-primary">{String(val)}</span>
    ),
  },
  { key: 'sourceRequestId', header: 'Source ID', sortable: true },
  { key: 'clientName', header: 'Client', sortable: true },
  {
    key: 'pickupLocation',
    header: 'Pickup City',
    render: (_, row) => {
      const pr = row as unknown as PickupRequest;
      return <span>{pr.pickupLocation.city}, {pr.pickupLocation.state}</span>;
    },
  },
  {
    key: 'materials',
    header: 'Materials',
    render: (_, row) => {
      const pr = row as unknown as PickupRequest;
      return (
        <span className="text-text-muted">
          {pr.materials.map((m) => `${m.type} (${m.plannedQty} ${m.unit})`).join(', ')}
        </span>
      );
    },
  },
  {
    key: 'tentativePickupDate',
    header: 'Pickup Date',
    sortable: true,
    render: (val) =>
      new Date(String(val)).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
  {
    key: 'status',
    header: 'Status',
    render: (val) => <StatusBadge status={String(val)} />,
  },
];

export function PickupRequestList() {
  const prs = usePRStore((s) => s.pickupRequests);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState<FilterChip[]>([]);
  const [selectedPRs, setSelectedPRs] = useState<PickupRequest[]>([]);

  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = { all: prs.length };
    prs.forEach((pr) => {
      counts[pr.status] = (counts[pr.status] || 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'pending', label: 'Pending', count: counts.pending || 0 },
      { key: 'planned', label: 'Planned', count: counts.planned || 0 },
      { key: 'picked_up', label: 'Picked Up', count: counts.picked_up || 0 },
      { key: 'delivered', label: 'Delivered', count: counts.delivered || 0 },
      { key: 'closed', label: 'Closed', count: counts.closed || 0 },
      { key: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0 },
    ];
  }, [prs]);

  const filteredPRs = useMemo(() => {
    let result = prs;
    if (activeTab !== 'all') {
      result = result.filter((pr) => pr.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (pr) =>
          pr.id.toLowerCase().includes(q) ||
          pr.clientName.toLowerCase().includes(q) ||
          pr.sourceRequestId.toLowerCase().includes(q) ||
          pr.pickupLocation.city.toLowerCase().includes(q)
      );
    }
    return result;
  }, [prs, activeTab, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pickup Requests"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Pickup Requests' }]}
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors">
            <Plus className="h-4 w-4" />
            New Request
          </button>
        }
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by ID, client, city..."
          className="max-w-md"
        />
        <FilterBar
          filters={filters}
          onRemoveFilter={(key) =>
            setFilters((f) => f.filter((fi) => fi.key !== key))
          }
          onClearAll={() => setFilters([])}
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredPRs as (PickupRequest & Record<string, unknown>)[]}
        selectable
        onSelectionChange={(selected) => setSelectedPRs(selected as unknown as PickupRequest[])}
        onRowClick={(row) => navigate(`/pickup-requests/${(row as unknown as PickupRequest).id}`)}
        pageSize={10}
      />

      <ActionBar
        selectedCount={selectedPRs.length}
        entityLabel="requests"
        actions={
          <>
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors">
              Export
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors">
              Create Load
            </button>
          </>
        }
      />
    </div>
  );
}
