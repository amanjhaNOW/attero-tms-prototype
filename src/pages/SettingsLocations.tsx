import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, StatusBadge } from '@/components';
import { useReferenceStore } from '@/stores';
import type { ColumnDef, LocationMaster } from '@/types';

const columns: ColumnDef<LocationMaster & Record<string, unknown>>[] = [
  { key: 'id', header: 'ID', sortable: true },
  {
    key: 'name',
    header: 'Location Name',
    sortable: true,
    render: (val) => <span className="font-medium text-text-primary">{String(val)}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (val) => {
      const v = String(val);
      const status = v === 'plant' ? 'in_execution' : v === 'warehouse' ? 'planned' : 'pending';
      return <StatusBadge status={status} />;
    },
  },
  { key: 'city', header: 'City', sortable: true },
  { key: 'state', header: 'State', sortable: true },
  { key: 'pin', header: 'PIN' },
];

export function SettingsLocations() {
  const locations = useReferenceStore((s) => s.locations);
  const [search, setSearch] = useState('');

  const filtered = search
    ? locations.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.city.toLowerCase().includes(search.toLowerCase())
      )
    : locations;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Locations"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Locations' },
        ]}
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
            <MapPin className="h-4 w-4" />
            Add Location
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search locations..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (LocationMaster & Record<string, unknown>)[]} pageSize={10} />
    </div>
  );
}
