import { useState, useCallback } from 'react';
import { Users, Plus } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, SlideOver } from '@/components';
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
    render: (_val, row) => {
      const c = row as unknown as Client;
      return `${c.address.city}, ${c.address.state}`;
    },
  },
  { key: 'contactPerson', header: 'Contact', sortable: true },
  { key: 'phone', header: 'Phone' },
  {
    key: 'materialTypes',
    header: 'Materials',
    render: (_val, row) => {
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

interface ClientForm {
  name: string;
  city: string;
  state: string;
  pin: string;
  address: string;
  contactPerson: string;
  phone: string;
  materialTypes: string;
}

const emptyForm: ClientForm = {
  name: '',
  city: '',
  state: '',
  pin: '',
  address: '',
  contactPerson: '',
  phone: '',
  materialTypes: '',
};

export function SettingsClients() {
  const clients = useReferenceStore((s) => s.clients);
  const addClient = useReferenceStore((s) => s.addClient);
  const [search, setSearch] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const filtered = search
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.contactPerson.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  const handleAdd = useCallback(() => {
    if (!form.name) return;
    const newClient: Client = {
      id: `CLT-${String(clients.length + 1).padStart(3, '0')}`,
      name: form.name,
      address: {
        name: form.name,
        city: form.city,
        state: form.state,
        pin: form.pin,
        address: form.address,
      },
      contactPerson: form.contactPerson,
      phone: form.phone,
      materialTypes: form.materialTypes
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    };
    addClient(newClient);
    setForm(emptyForm);
    setSlideOpen(false);
  }, [form, clients.length, addClient]);

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
          <button
            onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
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

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Add Client">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">State</label>
              <input type="text" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">PIN</label>
            <input type="text" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Address</label>
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Contact Person</label>
            <input type="text" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Material Types (comma-separated)</label>
            <input type="text" value={form.materialTypes} onChange={(e) => setForm((f) => ({ ...f, materialTypes: e.target.value }))} placeholder="E-waste, Copper, Iron" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={handleAdd} disabled={!form.name} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add Client
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
