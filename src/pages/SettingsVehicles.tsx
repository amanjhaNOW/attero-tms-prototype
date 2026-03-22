import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, SlideOver } from '@/components';
import { useReferenceStore } from '@/stores';
import type { ColumnDef, Vehicle } from '@/types';

export function SettingsVehicles() {
  const vehicles = useReferenceStore((s) => s.vehicles);
  const transporters = useReferenceStore((s) => s.transporters);
  const addVehicle = useReferenceStore((s) => s.addVehicle);
  const [search, setSearch] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState({
    registration: '',
    type: '',
    capacityKg: 0,
    transporterId: '',
  });

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
      render: (_val, row) => {
        const v = row as unknown as Vehicle;
        return `${v.capacityKg.toLocaleString()} Kg`;
      },
    },
    {
      key: 'transporterId',
      header: 'Transporter',
      render: (_val, row) => {
        const v = row as unknown as Vehicle;
        const t = transporters.find((tr) => tr.id === v.transporterId);
        return <span className="text-text-secondary">{t?.name ?? v.transporterId}</span>;
      },
    },
  ];

  const filtered = search
    ? vehicles.filter((v) =>
        v.registration.toLowerCase().includes(search.toLowerCase()) ||
        v.type.toLowerCase().includes(search.toLowerCase())
      )
    : vehicles;

  const handleAdd = useCallback(() => {
    if (!form.registration || !form.type) return;
    addVehicle({
      id: `VEH-${String(vehicles.length + 1).padStart(3, '0')}`,
      registration: form.registration,
      type: form.type,
      capacityKg: form.capacityKg,
      transporterId: form.transporterId,
    });
    setForm({ registration: '', type: '', capacityKg: 0, transporterId: '' });
    setSlideOpen(false);
  }, [form, vehicles.length, addVehicle]);

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
          <button
            onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search vehicles..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (Vehicle & Record<string, unknown>)[]} pageSize={10} />

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Add Vehicle">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Registration *</label>
            <input type="text" value={form.registration} onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))} placeholder="HR58D4082" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Type *</label>
            <input type="text" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="32FT 7 TON" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Capacity (Kg)</label>
            <input type="number" value={form.capacityKg || ''} onChange={(e) => setForm((f) => ({ ...f, capacityKg: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" min={0} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Transporter</label>
            <select value={form.transporterId} onChange={(e) => setForm((f) => ({ ...f, transporterId: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="">Select transporter...</option>
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAdd} disabled={!form.registration || !form.type} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add Vehicle
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
