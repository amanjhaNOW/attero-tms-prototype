import { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, MoreHorizontal } from 'lucide-react';
import {
  PageHeader,
  SearchBar,
  TabBar,
  DataTable,
  StatusBadge,
  ActionBar,
  SlideOver,
  MaterialLineItems,
} from '@/components';
import { usePRStore, useReferenceStore } from '@/stores';
import type { ColumnDef, TabItem, PickupRequest, MaterialItem } from '@/types';

// ── PR Creation Form State ───────────────────────────────────
interface PRFormState {
  clientId: string;
  destination: string;
  materials: { material: string; qty: number; unit: string; invoiceNumber: string; remarks: string }[];
  tentativePickupDate: string;
  notes: string;
}

const emptyForm: PRFormState = {
  clientId: '',
  destination: 'LOC-001', // Default: Haridwar Plant
  materials: [{ material: '', qty: 0, unit: 'Kg', invoiceNumber: '', remarks: '' }],
  tentativePickupDate: '',
  notes: '',
};

export function PickupRequestList() {
  const prs = usePRStore((s) => s.pickupRequests);
  const addPR = usePRStore((s) => s.addPR);
  const clients = useReferenceStore((s) => s.clients);
  const locations = useReferenceStore((s) => s.locations);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedPRs, setSelectedPRs] = useState<PickupRequest[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState<PRFormState>(emptyForm);

  // ── Tabs with counts ─────────────────────────
  const tabs: TabItem[] = useMemo(() => {
    const counts: Record<string, number> = { all: prs.length };
    prs.forEach((pr) => {
      counts[pr.status] = (counts[pr.status] || 0) + 1;
    });
    return [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'pending', label: 'Pending', count: counts.pending || 0 },
      { key: 'planned', label: 'Planned', count: counts.planned || 0 },
      { key: 'picked_up', label: 'Picked Up', count: counts.picked_up || 0 },
      { key: 'delivered', label: 'Delivered', count: counts.delivered || 0 },
      { key: 'closed', label: 'Closed', count: counts.closed || 0 },
      { key: 'cancelled', label: 'Cancelled', count: counts.cancelled || 0 },
    ];
  }, [prs]);

  // ── Filtered PRs ─────────────────────────────
  const filteredPRs = useMemo(() => {
    let result = prs;
    if (activeTab !== 'all') {
      result = result.filter((pr) => pr.status === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (pr) =>
          pr.id.toLowerCase().includes(q) ||
          pr.clientName.toLowerCase().includes(q) ||
          pr.sourceRequestId.toLowerCase().includes(q) ||
          pr.pickupLocation.city.toLowerCase().includes(q) ||
          pr.pickupLocation.state.toLowerCase().includes(q)
      );
    }
    return result;
  }, [prs, activeTab, search]);

  // ── Column Defs ──────────────────────────────
  const columns: ColumnDef<PickupRequest & Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'PR ID',
        sortable: true,
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          return (
            <Link
              to={`/pickup-requests/${pr.id}`}
              className="font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {pr.id}
            </Link>
          );
        },
      },
      { key: 'sourceRequestId', header: 'Source ID', sortable: true },
      { key: 'clientName', header: 'Client', sortable: true },
      {
        key: 'materials',
        header: 'Materials',
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          return (
            <div className="flex flex-wrap gap-1">
              {pr.materials.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                >
                  {m.type}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: 'totalPlannedQty',
        header: 'Planned Qty',
        sortable: true,
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          const total = pr.materials.reduce((sum, m) => sum + m.plannedQty, 0);
          return `${total.toLocaleString()} Kg`;
        },
      },
      {
        key: 'tentativePickupDate',
        header: 'Pickup Date',
        sortable: true,
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          const date = new Date(pr.tentativePickupDate);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const isOverdue = date < now && pr.status === 'pending';
          const diffDays = isOverdue
            ? Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return (
            <div>
              <span>
                {date.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {isOverdue && (
                <span className="ml-1.5 text-xs font-medium text-orange-500">
                  ⚠ OVERDUE ({diffDays}d)
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          return <StatusBadge status={pr.status} />;
        },
      },
      {
        key: 'loadIds',
        header: 'Load',
        render: (_val, row) => {
          const pr = row as unknown as PickupRequest;
          if (pr.loadIds.length === 0) return <span className="text-text-muted">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {pr.loadIds.map((lid) => (
                <Link
                  key={lid}
                  to={`/loads/${lid}`}
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lid}
                </Link>
              ))}
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: '',
        width: 'w-10',
        render: () => (
          <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        ),
      },
    ],
    []
  );

  // ── PR Creation ──────────────────────────────
  const selectedClient = clients.find((c) => c.id === form.clientId);
  const destinationLoc = locations.find((l) => l.id === form.destination);
  const plantAndWarehouseLocations = locations.filter(
    (l) => l.type === 'plant' || l.type === 'warehouse'
  );

  const handleCreatePR = useCallback(() => {
    if (!selectedClient || !destinationLoc) return;
    if (form.materials.length === 0 || !form.tentativePickupDate) return;

    const validMaterials = form.materials.filter((m) => m.material && m.qty > 0);
    if (validMaterials.length === 0) return;

    const nextId = `REQ-${String(prs.length + 1).padStart(5, '0')}`;
    const materials: MaterialItem[] = validMaterials.map((m) => ({
      type: m.material,
      plannedQty: m.qty,
      unit: m.unit,
    }));

    const newPR: PickupRequest = {
      id: nextId,
      sourceRequestId: `PR0${String(3234 + prs.length)}`,
      requestType: 'PR',
      serviceType: 'point_to_point',
      clientName: selectedClient.name,
      pickupLocation: {
        name: selectedClient.address.name,
        state: selectedClient.address.state,
        city: selectedClient.address.city,
        pin: selectedClient.address.pin,
        address: selectedClient.address.address,
      },
      deliveryLocation: {
        name: destinationLoc.name,
        state: destinationLoc.state,
        city: destinationLoc.city,
        pin: destinationLoc.pin,
        address: destinationLoc.address,
      },
      materials,
      tentativePickupDate: form.tentativePickupDate,
      status: 'pending',
      loadIds: [],
      createdAt: new Date().toISOString(),
    };

    addPR(newPR);
    setForm(emptyForm);
    setSlideOpen(false);
  }, [form, selectedClient, destinationLoc, prs.length, addPR]);

  // ── Selection Summary ────────────────────────
  const selectedTotalKg = selectedPRs.reduce(
    (sum, pr) => sum + pr.materials.reduce((s, m) => s + m.plannedQty, 0),
    0
  );

  const handleCreateLoad = useCallback(() => {
    if (selectedPRs.length === 0) return;
    const prIds = selectedPRs.map((pr) => pr.id);
    navigate(`/loads/create?prs=${prIds.join(',')}`);
  }, [selectedPRs, navigate]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pickup Requests"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Pickup Requests' }]}
        actions={
          <button
            onClick={() => setSlideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create PR
          </button>
        }
      />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by PR ID, Source ID, Client, State, City..."
        className="max-w-lg"
      />

      <DataTable
        columns={columns}
        data={filteredPRs as (PickupRequest & Record<string, unknown>)[]}
        selectable
        onSelectionChange={(selected) =>
          setSelectedPRs(selected as unknown as PickupRequest[])
        }
        onRowClick={(row) =>
          navigate(`/pickup-requests/${(row as unknown as PickupRequest).id}`)
        }
        pageSize={10}
      />

      <ActionBar
        selectedCount={selectedPRs.length}
        entityLabel="requests"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              {selectedTotalKg.toLocaleString()} Kg
            </span>
            <button
              onClick={handleCreateLoad}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
            >
              Create Load →
            </button>
          </div>
        }
      />

      {/* ── Create PR SlideOver ─────────────── */}
      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title="Create Pickup Request"
        width="max-w-lg"
      >
        <div className="space-y-5">
          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Client *</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Location (auto-fill) */}
          {selectedClient && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                Pickup Location
              </label>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-sm font-medium text-text-primary">
                  {selectedClient.address.name}
                </p>
                <p className="text-xs text-text-muted">
                  {selectedClient.address.address}
                </p>
              </div>
            </div>
          )}

          {/* Destination */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Destination *
            </label>
            <select
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {plantAndWarehouseLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </div>

          {/* Material Items */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Materials *
            </label>
            <MaterialLineItems
              items={form.materials}
              onChange={(items) => setForm((f) => ({ ...f, materials: items }))}
            />
          </div>

          {/* Pickup Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Tentative Pickup Date *
            </label>
            <input
              type="date"
              value={form.tentativePickupDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, tentativePickupDate: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCreatePR}
              disabled={
                !form.clientId ||
                !form.destination ||
                !form.tentativePickupDate ||
                form.materials.filter((m) => m.material && m.qty > 0).length === 0
              }
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Pickup Request
            </button>
            <button
              onClick={() => {
                setForm(emptyForm);
                setSlideOpen(false);
              }}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
