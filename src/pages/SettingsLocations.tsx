import { useState, useCallback } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, StatusBadge, SlideOver } from '@/components';
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
    render: (_val, row) => {
      const l = row as unknown as LocationMaster;
      const status = l.type === 'plant' ? 'in_execution' : l.type === 'warehouse' ? 'planned' : 'pending';
      return <StatusBadge status={status} />;
    },
  },
  { key: 'city', header: 'City', sortable: true },
  { key: 'state', header: 'State', sortable: true },
  { key: 'pin', header: 'PIN' },
];

interface LocationForm {
  name: string;
  type: 'plant' | 'warehouse' | 'client';
  city: string;
  state: string;
  pin: string;
  address: string;
}

const emptyForm: LocationForm = {
  name: '',
  type: 'warehouse',
  city: '',
  state: '',
  pin: '',
  address: '',
};

export function SettingsLocations() {
  const locations = useReferenceStore((s) => s.locations);
  const addLocation = useReferenceStore((s) => s.addLocation);
  const [search, setSearch] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);

  const filtered = search
    ? locations.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.city.toLowerCase().includes(search.toLowerCase())
      )
    : locations;

  const handleAdd = useCallback(() => {
    if (!form.name) return;
    addLocation({
      id: `LOC-${String(locations.length + 1).padStart(3, '0')}`,
      name: form.name,
      type: form.type,
      city: form.city,
      state: form.state,
      pin: form.pin,
      address: form.address,
    });
    setForm(emptyForm);
    setSlideOpen(false);
  }, [form, locations.length, addLocation]);

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
          <button
            onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search locations..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (LocationMaster & Record<string, unknown>)[]} pageSize={10} />

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Add Location">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LocationForm['type'] }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="plant">Plant</option>
              <option value="warehouse">Warehouse</option>
              <option value="client">Client</option>
            </select>
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
          <button onClick={handleAdd} disabled={!form.name} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add Location
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
