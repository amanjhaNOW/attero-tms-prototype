import { useState } from 'react';
import { Truck } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, StatusBadge } from '@/components';
import { useReferenceStore } from '@/stores';
import type { ColumnDef, Transporter } from '@/types';

const columns: ColumnDef<Transporter & Record<string, unknown>>[] = [
  { key: 'id', header: 'ID', sortable: true },
  {
    key: 'name',
    header: 'Transporter',
    sortable: true,
    render: (val) => <span className="font-medium text-text-primary">{String(val)}</span>,
  },
  {
    key: 'gstNumber',
    header: 'GST Number',
    render: (val) => <span className="font-mono text-sm">{String(val)}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (val) => (
      <StatusBadge status={String(val) === 'in_house' ? 'completed' : 'planned'} />
    ),
  },
  { key: 'contact', header: 'Contact' },
];

export function SettingsTransporters() {
  const transporters = useReferenceStore((s) => s.transporters);
  const [search, setSearch] = useState('');

  const filtered = search
    ? transporters.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : transporters;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transporters"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Transporters' },
        ]}
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
            <Truck className="h-4 w-4" />
            Add Transporter
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search transporters..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (Transporter & Record<string, unknown>)[]} pageSize={10} />
    </div>
  );
}
