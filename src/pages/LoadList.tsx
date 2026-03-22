import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, SearchBar, TabBar, DataTable, StatusBadge } from '@/components';
import { useLoadStore } from '@/stores';
import type { ColumnDef, TabItem, Load } from '@/types';

const columns: ColumnDef<Load & Record<string, unknown>>[] = [
  {
    key: 'id',
    header: 'Load ID',
    sortable: true,
    render: (val) => (
      <span className="font-medium text-primary">{String(val)}</span>
    ),
  },
  {
    key: 'patternLabel',
    header: 'Pattern',
    render: (val) => (
      <span className="capitalize">{String(val).replace(/_/g, ' ')}</span>
    ),
  },
  {
    key: 'destination',
    header: 'Destination',
    render: (_, row) => {
      const load = row as unknown as Load;
      return (
        <div>
          <p className="font-medium text-text-primary">{load.destination.name}</p>
          <p className="text-xs text-text-muted">{load.destination.city}</p>
        </div>
      );
    },
  },
  {
    key: 'totalPlannedQty',
    header: 'Planned Qty',
    sortable: true,
    render: (val) => `${Number(val).toLocaleString()} Kg`,
  },
  {
    key: 'totalActualQty',
    header: 'Actual Qty',
    sortable: true,
    render: (val) => `${Number(val).toLocaleString()} Kg`,
  },
  {
    key: 'prIds',
    header: 'PRs',
    render: (_, row) => {
      const load = row as unknown as Load;
      return <span className="text-text-muted">{load.prIds.length} linked</span>;
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (val) => <StatusBadge status={String(val)} />,
  },
];

export function LoadList() {
  const loads = useLoadStore((s) => s.loads);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = { all: loads.length };
    loads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'draft', label: 'Draft', count: counts.draft || 0 },
      { key: 'partially_planned', label: 'Partially Planned', count: counts.partially_planned || 0 },
      { key: 'fully_planned', label: 'Fully Planned', count: counts.fully_planned || 0 },
      { key: 'in_execution', label: 'In Execution', count: counts.in_execution || 0 },
      { key: 'completed', label: 'Completed', count: counts.completed || 0 },
    ];
  }, [loads]);

  const filteredLoads = useMemo(() => {
    let result = loads;
    if (activeTab !== 'all') {
      result = result.filter((l) => l.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          l.destination.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [loads, activeTab, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loads"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Loads' }]}
        actions={
          <button
            onClick={() => navigate('/loads/create')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Load
          </button>
        }
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search loads..."
        className="max-w-md"
      />

      <DataTable
        columns={columns}
        data={filteredLoads as (Load & Record<string, unknown>)[]}
        onRowClick={(row) => navigate(`/loads/${(row as unknown as Load).id}`)}
        pageSize={10}
      />
    </div>
  );
}
