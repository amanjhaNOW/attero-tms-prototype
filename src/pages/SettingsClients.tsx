import { useState } from 'react';
import { Users } from 'lucide-react';
import { PageHeader, SearchBar, DataTable } from '@/components';
import { useReferenceStore } from '@/stores';
import type { ColumnDef, Client } from '@/types';

const columns: ColumnDef<Client & Record<string, unknown>>[] = [
  { key: 'id', header: 'ID', sortable: true },
  {
    key: 'name',
    header: 'Client Name',
    sortable: true,
    render: (val) => <span className="font-medium text-text-primary">{String(val)}</span>,
  },
  {
    key: 'address',
    header: 'Location',
    render: (_, row) => {
      const c = row as unknown as Client;
      return `${c.address.city}, ${c.address.state}`;
    },
  },
  { key: 'contactPerson', header: 'Contact', sortable: true },
  { key: 'phone', header: 'Phone' },
  {
    key: 'materialTypes',
    header: 'Materials',
    render: (_, row) => {
      const c = row as unknown as Client;
      return (
        <div className="flex flex-wrap gap-1">
          {c.materialTypes.map((m) => (
            <span key={m} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary">
              {m}
            </span>
          ))}
        </div>
      );
    },
  },
];

export function SettingsClients() {
  const clients = useReferenceStore((s) => s.clients);
  const [search, setSearch] = useState('');

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.contactPerson.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Clients' },
        ]}
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600">
            <Users className="h-4 w-4" />
            Add Client
          </button>
        }
      />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search clients..."
        className="max-w-md"
      />
      <DataTable columns={columns} data={filtered as (Client & Record<string, unknown>)[]} pageSize={10} />
    </div>
  );
}
