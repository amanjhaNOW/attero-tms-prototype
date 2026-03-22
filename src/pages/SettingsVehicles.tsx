import { useState } from 'react';
import { Car } from 'lucide-react';
import { PageHeader, SearchBar, DataTable } from '@/components';
import { useReferenceStore } from '@/stores';
import type { ColumnDef, Vehicle } from '@/types';

const columns: ColumnDef<Vehicle & Record<string, unknown>>[] = [
  { key: 'id', header: 'ID', sortable: true },
  {
    key: 'registration',
    header: 'Registration',
    sortable: true,
    render: (val) => <span className="font-mono font-medium text-text-primary">{String(val)}</span>,
  },
  { key: 'type', header: 'Type', sortable: true },
  {
    key: 'capacityKg',
    header: 'Capacity',
    sortable: true,
    render: (val) => `${Number(val).toLocaleString()} Kg`,
  },
  { key: 'transporterId', header: 'Transporter ID' },
];

export function SettingsVehicles() {
  const vehicles = useReferenceStore((s) => s.vehicles);
  const [search, setSearch] = useState('');

  const filtered = search
    ? vehicles.filter((v) =>
        v.registration.toLowerCase().includes(search.toLowerCase()) ||
        v.type.toLowerCase().includes(search.toLowerCase())
      )
    : vehicles;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vehicles"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Vehicles' },
        ]}
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
            <Car className="h-4 w-4" />
            Add Vehicle
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search vehicles..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (Vehicle & Record<string, unknown>)[]} pageSize={10} />
    </div>
  );
}
