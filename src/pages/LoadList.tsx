import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader, SearchBar, TabBar, DataTable, StatusBadge } from '@/components';
import { useLoadStore, useShipmentStore } from '@/stores';
import type { ColumnDef, TabItem, Load } from '@/types';

export function LoadList() {
  const loads = useLoadStore((s) => s.loads);
  const shipments = useShipmentStore((s) => s.shipments);
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
          l.destination.name.toLowerCase().includes(q) ||
          l.patternLabel.toLowerCase().includes(q)
      );
    }
    return result;
  }, [loads, activeTab, search]);

  const columns: ColumnDef<Load & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'Load ID',
        sortable: true,
        render: (_val, row) => {
          const load = row as unknown as Load;
          return (
            <Link
              to={`/loads/${load.id}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {load.id}
            </Link>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (_val, row) => {
          const load = row as unknown as Load;
          return <StatusBadge status={load.status} />;
        },
      },
      {
        key: 'patternLabel',
        header: 'Pattern',
        render: (_val, row) => {
          const load = row as unknown as Load;
          return (
            <span className="capitalize text-text-secondary">
              {load.patternLabel.replace(/_/g, ' ')}
            </span>
          );
        },
      },
      {
        key: 'prIds',
        header: '# PRs',
        sortable: true,
        render: (_val, row) => {
          const load = row as unknown as Load;
          return <span>{load.prIds.length}</span>;
        },
      },
      {
        key: 'shipmentIds',
        header: '# Shipments',
        render: (_val, row) => {
          const load = row as unknown as Load;
          const count = shipments.filter((s) => s.loadId === load.id).length;
          return <span>{count}</span>;
        },
      },
      {
        key: 'totalPlannedQty',
        header: 'Total Qty',
        sortable: true,
        render: (_val, row) => {
          const load = row as unknown as Load;
          return `${load.totalPlannedQty.toLocaleString()} Kg`;
        },
      },
      {
        key: 'destination',
        header: 'Destination',
        render: (_val, row) => {
          const load = row as unknown as Load;
          return (
            <div>
              <p className="font-medium text-text-primary truncate">
                {load.destination.name}
              </p>
              <p className="text-xs text-text-muted">{load.destination.city}</p>
            </div>
          );
        },
      },
      {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        render: (_val, row) => {
          const load = row as unknown as Load;
          return new Date(load.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          });
        },
      },
    ],
    [shipments]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loads"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Loads' }]}
        actions={
          <button
            onClick={() => navigate('/pickup-requests')}
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
        placeholder="Search loads by ID, destination, pattern..."
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
