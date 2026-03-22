import { useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Warehouse,
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search,
} from 'lucide-react';
import { PageHeader, MetricCard, StatusBadge, EmptyState } from '@/components';
import { useLoadStore, useShipmentStore, useStopStore, usePRStore } from '@/stores';
import { createLoadFromWarehouse } from '@/lib/createLoadHelper';
import type { Location } from '@/types';

/** Represents a PR with material sitting at a warehouse */
interface WarehouseRow {
  prId: string;
  clientName: string;
  materials: { type: string; qty: number; unit: string }[];
  qtyAtWarehouse: number;
  prTotalQty: number;
  qtyAtPlant: number;
  pctAtPlant: number;
  inboundShipmentId: string;
  warehouseName: string;
  warehouseCity: string;
  warehouseState: string;
  warehousePin: string;
  warehouseAddress: string;
  arrivedAt: string;
  daysWaiting: number;
}

export function WarehouseDashboard() {
  const navigate = useNavigate();
  const allLoads = useLoadStore((s) => s.loads);
  const allShipments = useShipmentStore((s) => s.shipments);
  const allStops = useStopStore((s) => s.stops);
  const allPRs = usePRStore((s) => s.pickupRequests);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Compute PR-level warehouse rows
  const warehouseRows = useMemo(() => {
    const now = new Date();
    const rows: WarehouseRow[] = [];

    // Group DELIVER stops by prId and destination type
    const prWarehouseQty: Record<string, { qty: number; shipmentId: string; warehouseName: string; warehouseCity: string; warehouseState: string; warehousePin: string; warehouseAddress: string; arrivedAt: string; materials: { type: string; qty: number; unit: string }[] }> = {};
    const prPlantQty: Record<string, number> = {};

    allStops.forEach((stop) => {
      if (stop.type !== 'DELIVER' || stop.status !== 'completed' || !stop.prId) return;

      const shipment = allShipments.find((sh) => sh.id === stop.shipmentId);
      if (!shipment) return;
      const load = allLoads.find((l) => l.id === shipment.loadId);
      if (!load) return;

      if (load.destination.type === 'warehouse') {
        const existing = prWarehouseQty[stop.prId];
        const stopQty = stop.totalActualQty;
        const materials = stop.actualItems.length > 0
          ? stop.actualItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }))
          : stop.plannedItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }));

        if (!existing || stopQty > existing.qty) {
          prWarehouseQty[stop.prId] = {
            qty: (existing?.qty ?? 0) + stopQty,
            shipmentId: stop.shipmentId,
            warehouseName: load.destination.name,
            warehouseCity: load.destination.city,
            warehouseState: load.destination.state,
            warehousePin: load.destination.pin,
            warehouseAddress: load.destination.address,
            arrivedAt: stop.completedAt ?? '',
            materials,
          };
        } else {
          prWarehouseQty[stop.prId] = {
            ...existing,
            qty: existing.qty + stopQty,
            materials: [...existing.materials, ...materials],
          };
        }
      } else if (load.destination.type === 'plant') {
        prPlantQty[stop.prId] = (prPlantQty[stop.prId] ?? 0) + stop.totalActualQty;
      }
    });

    // Build rows for PRs that have material at warehouse and not fully at plant
    Object.entries(prWarehouseQty).forEach(([prId, whData]) => {
      const plantQty = prPlantQty[prId] ?? 0;
      const netAtWarehouse = whData.qty - plantQty;
      if (netAtWarehouse <= 0) return; // material already moved to plant

      const pr = allPRs.find((p) => p.id === prId);
      if (!pr) return;

      const prTotalQty = pr.materials.reduce((sum, m) => sum + m.plannedQty, 0);
      const arrivedDate = whData.arrivedAt ? new Date(whData.arrivedAt) : now;
      const daysWaiting = Math.max(0, Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Deduplicate materials by type
      const materialMap = new Map<string, { type: string; qty: number; unit: string }>();
      whData.materials.forEach((m) => {
        const existing = materialMap.get(m.type);
        if (existing) {
          existing.qty += m.qty;
        } else {
          materialMap.set(m.type, { ...m });
        }
      });

      rows.push({
        prId,
        clientName: pr.clientName,
        materials: Array.from(materialMap.values()),
        qtyAtWarehouse: netAtWarehouse,
        prTotalQty,
        qtyAtPlant: plantQty,
        pctAtPlant: prTotalQty > 0 ? Math.round((plantQty / prTotalQty) * 100) : 0,
        inboundShipmentId: whData.shipmentId,
        warehouseName: whData.warehouseName,
        warehouseCity: whData.warehouseCity,
        warehouseState: whData.warehouseState,
        warehousePin: whData.warehousePin,
        warehouseAddress: whData.warehouseAddress,
        arrivedAt: whData.arrivedAt,
        daysWaiting,
      });
    });

    return rows.sort((a, b) => b.daysWaiting - a.daysWaiting);
  }, [allLoads, allShipments, allStops, allPRs]);

  // Filtered rows by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return warehouseRows;
    const q = search.toLowerCase();
    return warehouseRows.filter(
      (r) =>
        r.prId.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q) ||
        r.materials.some((m) => m.type.toLowerCase().includes(q))
    );
  }, [warehouseRows, search]);

  // Summary metrics
  const metrics = useMemo(() => {
    const totalQty = warehouseRows.reduce((s, r) => s + r.qtyAtWarehouse, 0);
    const totalPRs = warehouseRows.length;
    const avgDays =
      totalPRs > 0
        ? warehouseRows.reduce((s, r) => s + r.daysWaiting, 0) / totalPRs
        : 0;
    const oldestDays = totalPRs > 0 ? Math.max(...warehouseRows.map((r) => r.daysWaiting)) : 0;
    return { totalQty, totalPRs, avgDays, oldestDays };
  }, [warehouseRows]);

  const toggleSelect = useCallback((prId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) {
        next.delete(prId);
      } else {
        next.add(prId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.prId)));
    }
  }, [selectedIds.size, filteredRows]);

  const selectedQty = useMemo(() => {
    return warehouseRows
      .filter((r) => selectedIds.has(r.prId))
      .reduce((s, r) => s + r.qtyAtWarehouse, 0);
  }, [warehouseRows, selectedIds]);

  const handleCreateLoad = useCallback(() => {
    const selected = warehouseRows.filter((r) => selectedIds.has(r.prId));
    if (selected.length === 0) return;

    // Build warehouse source items for the helper
    const warehouseSourceItems = selected.map((r) => ({
      prId: r.prId,
      clientName: r.clientName,
      materials: r.materials,
      maxQty: r.qtyAtWarehouse,
      warehouseLocation: {
        name: r.warehouseName,
        state: r.warehouseState ?? '',
        city: r.warehouseCity ?? '',
        pin: r.warehousePin ?? '',
        address: r.warehouseAddress ?? '',
      } as Location,
      inboundShipmentId: r.inboundShipmentId,
    }));

    const items = selected.map((r) => ({ prId: r.prId, qty: r.qtyAtWarehouse }));
    const loadId = createLoadFromWarehouse(items, warehouseSourceItems);
    navigate(`/loads/${loadId}`);
  }, [warehouseRows, selectedIds, navigate]);

  function getDaysColor(days: number): string {
    if (days > 7) return 'text-danger font-semibold';
    if (days >= 3) return 'text-warning font-semibold';
    return 'text-success';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Warehouse' }]}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total at Warehouses"
          value={`${metrics.totalQty.toLocaleString()} Kg`}
          subInfo={`across ${metrics.totalPRs} PRs`}
          icon={Warehouse}
        />
        <MetricCard
          label="PRs Pending Plant"
          value={metrics.totalPRs}
          subInfo="Awaiting dispatch"
          icon={Package}
        />
        <MetricCard
          label="Avg Days Waiting"
          value={metrics.avgDays.toFixed(1)}
          subInfo="days at warehouse"
          icon={Clock}
        />
        <MetricCard
          label="Oldest Waiting"
          value={
            <span className={metrics.oldestDays > 7 ? 'text-danger' : ''}>
              {metrics.oldestDays} days
            </span>
          }
          subInfo={metrics.oldestDays > 7 ? '⚠ Exceeds 7-day threshold' : 'Within threshold'}
          icon={AlertTriangle}
        />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PR, client, warehouse, material..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Main Table */}
      {filteredRows.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">PR ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Client</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Materials</th>
                  <th className="px-3 py-3 text-right font-semibold text-text-secondary">Qty at WH</th>
                  <th className="px-3 py-3 text-right font-semibold text-text-secondary">PR Total</th>
                  <th className="px-3 py-3 text-center font-semibold text-text-secondary">% at Plant</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Inbound</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Warehouse</th>
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Arrived</th>
                  <th className="px-3 py-3 text-center font-semibold text-text-secondary">Days</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.prId}
                    className={`border-b border-gray-100 transition-colors ${
                      selectedIds.has(row.prId)
                        ? 'bg-primary-50/50'
                        : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.prId)}
                        onChange={() => toggleSelect(row.prId)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/pickup-requests/${row.prId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.prId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-text-primary">{row.clientName}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.materials.map((m, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                          >
                            {m.type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-text-primary">
                      {row.qtyAtWarehouse.toLocaleString()} Kg
                    </td>
                    <td className="px-3 py-3 text-right text-text-muted">
                      {row.prTotalQty.toLocaleString()} Kg
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.pctAtPlant > 0 ? (
                        <div className="inline-flex items-center gap-1.5">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full bg-success rounded-full"
                              style={{ width: `${row.pctAtPlant}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">{row.pctAtPlant}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">0%</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to={`/shipments/${row.inboundShipmentId}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {row.inboundShipmentId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-text-secondary text-xs">
                      {row.warehouseName}
                    </td>
                    <td className="px-3 py-3 text-xs text-text-muted">
                      {row.arrivedAt
                        ? new Date(row.arrivedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                    <td className={`px-3 py-3 text-center text-sm ${getDaysColor(row.daysWaiting)}`}>
                      {row.daysWaiting}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Material at Warehouses"
          description="All warehouse material has been dispatched to plant, or no warehouse deliveries have been completed yet."
          icon={Warehouse}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto max-w-2xl rounded-xl border border-primary-200 bg-white px-5 py-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary">
                {selectedIds.size}
              </span>
              <span className="text-sm text-text-secondary">
                {selectedIds.size} PR{selectedIds.size > 1 ? 's' : ''} selected ·{' '}
                <span className="font-semibold">{selectedQty.toLocaleString()} Kg</span>
              </span>
            </div>
            <button
              onClick={handleCreateLoad}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-600 transition-colors"
            >
              Create Load
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
