import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, SearchBar, DataTable, StatusBadge, SlideOver } from '@/components';
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
    render: (_val, row) => {
      const t = row as unknown as Transporter;
      return (
        <StatusBadge status={t.type === 'in_house' ? 'completed' : 'planned'} />
      );
    },
  },
  { key: 'contact', header: 'Contact' },
];

interface TransporterForm {
  name: string;
  gstNumber: string;
  type: 'third_party' | 'in_house';
  contact: string;
}

const emptyForm: TransporterForm = {
  name: '',
  gstNumber: '',
  type: 'third_party',
  contact: '',
};

export function SettingsTransporters() {
  const transporters = useReferenceStore((s) => s.transporters);
  const addTransporter = useReferenceStore((s) => s.addTransporter);
  const [search, setSearch] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState<TransporterForm>(emptyForm);

  const filtered = search
    ? transporters.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : transporters;

  const handleAdd = useCallback(() => {
    if (!form.name) return;
    addTransporter({
      id: `TRN-${String(transporters.length + 1).padStart(3, '0')}`,
      name: form.name,
      gstNumber: form.gstNumber,
      type: form.type,
      contact: form.contact,
    });
    setForm(emptyForm);
    setSlideOpen(false);
  }, [form, transporters.length, addTransporter]);

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
          <button
            onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Transporter
          </button>
        }
      />
      <SearchBar value={search} onChange={setSearch} placeholder="Search transporters..." className="max-w-md" />
      <DataTable columns={columns} data={filtered as (Transporter & Record<string, unknown>)[]} pageSize={10} />

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Add Transporter">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">GST Number</label>
            <input type="text" value={form.gstNumber} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'third_party' | 'in_house' }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="third_party">Third Party</option>
              <option value="in_house">In-House</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Contact</label>
            <input type="tel" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={handleAdd} disabled={!form.name} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add Transporter
          </button>
        </div>
      </SlideOver>
    </div>
  );
}
