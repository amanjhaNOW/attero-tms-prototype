import { useState, useMemo, useCallback } from 'react';
import { X, Search, Warehouse, ArrowRight } from 'lucide-react';
import { useLoadStore, useShipmentStore, useStopStore, usePRStore } from '@/stores';
import { ModalOverlay } from './ModalOverlay';
import type { Location } from '@/types';

export interface WarehouseSourceItem {
  prId: string;
  clientName: string;
  materials: { type: string; qty: number; unit: string }[];
  maxQty: number;
  daysWaiting: number;
  warehouseName: string;
  warehouseLocation: Location;
  inboundShipmentId: string;
}

interface WarehousePickerModalProps {
  open: boolean;
  onClose: () => void;
  /** PR IDs already selected as warehouse sources (excluded) */
  excludeIds: Set<string>;
  /** Called with selected warehouse items */
  onSelect: (items: { prId: string; qty: number }[]) => void;
  /** Optional: show switch to PR picker */
  onSwitchToPR?: () => void;
}

export function WarehousePickerModal({
  open,
  onClose,
  excludeIds,
  onSelect,
  onSwitchToPR,
}: WarehousePickerModalProps) {
  const allLoads = useLoadStore((s) => s.loads);
  const allShipments = useShipmentStore((s) => s.shipments);
  const allStops = useStopStore((s) => s.stops);
  const allPRs = usePRStore((s) => s.pickupRequests);

  const [search, setSearch] = useState('');
  const [tempItems, setTempItems] = useState<Record<string, number>>({});

  const warehouseSourceItems = useMemo(() => {
    const now = new Date();
    const prWarehouseData: Record<
      string,
      {
        qty: number;
        shipmentId: string;
        warehouseName: string;
        warehouseLocation: Location;
        arrivedAt: string;
        materials: { type: string; qty: number; unit: string }[];
      }
    > = {};
    const prPlantQty: Record<string, number> = {};

    allStops.forEach((stop) => {
      if (stop.type !== 'DELIVER' || stop.status !== 'completed' || !stop.prId) return;
      const shipment = allShipments.find((sh) => sh.id === stop.shipmentId);
      if (!shipment) return;
      const load = allLoads.find((l) => l.id === shipment.loadId);
      if (!load) return;

      if (load.destination.type === 'warehouse') {
        const materials =
          stop.actualItems.length > 0
            ? stop.actualItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }))
            : stop.plannedItems.map((i) => ({ type: i.material, qty: i.qty, unit: i.unit }));

        const existing = prWarehouseData[stop.prId];
        if (!existing) {
          prWarehouseData[stop.prId] = {
            qty: stop.totalActualQty,
            shipmentId: stop.shipmentId,
            warehouseName: load.destination.name,
            warehouseLocation: {
              name: load.destination.name,
              state: load.destination.state,
              city: load.destination.city,
              pin: load.destination.pin,
              address: load.destination.address,
            },
            arrivedAt: stop.completedAt ?? '',
            materials,
          };
        } else {
          prWarehouseData[stop.prId] = {
            ...existing,
            qty: existing.qty + stop.totalActualQty,
            materials: [...existing.materials, ...materials],
          };
        }
      } else if (load.destination.type === 'plant') {
        prPlantQty[stop.prId] = (prPlantQty[stop.prId] ?? 0) + stop.totalActualQty;
      }
    });

    const items: WarehouseSourceItem[] = [];
    Object.entries(prWarehouseData).forEach(([prId, whData]) => {
      const plantQty = prPlantQty[prId] ?? 0;
      const netAtWarehouse = whData.qty - plantQty;
      if (netAtWarehouse <= 0) return;

      const pr = allPRs.find((p) => p.id === prId);
      if (!pr) return;

      const arrivedDate = whData.arrivedAt ? new Date(whData.arrivedAt) : now;
      const daysWaiting = Math.max(
        0,
        Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

      const materialMap = new Map<string, { type: string; qty: number; unit: string }>();
      whData.materials.forEach((m) => {
        const existing = materialMap.get(m.type);
        if (existing) existing.qty += m.qty;
        else materialMap.set(m.type, { ...m });
      });

      items.push({
        prId,
        clientName: pr.clientName,
        materials: Array.from(materialMap.values()),
        maxQty: netAtWarehouse,
        daysWaiting,
        warehouseName: whData.warehouseName,
        warehouseLocation: whData.warehouseLocation,
        inboundShipmentId: whData.shipmentId,
      });
    });

    return items;
  }, [allStops, allShipments, allLoads, allPRs]);

  const filtered = useMemo(() => {
    const available = warehouseSourceItems.filter(
      (item) => !excludeIds.has(item.prId),
    );
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (item) =>
        item.prId.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        item.warehouseName.toLowerCase().includes(q) ||
        item.materials.some((m) => m.type.toLowerCase().includes(q)),
    );
  }, [warehouseSourceItems, excludeIds, search]);

  const toggleItem = useCallback((prId: string, maxQty: number) => {
    setTempItems((prev) => {
      const next = { ...prev };
      if (prId in next) delete next[prId];
      else next[prId] = maxQty;
      return next;
    });
  }, []);

  const updateQty = useCallback((prId: string, qty: number) => {
    setTempItems((prev) => ({ ...prev, [prId]: qty }));
  }, []);

  const handleCommit = useCallback(() => {
    const items = Object.entries(tempItems).map(([prId, qty]) => ({ prId, qty }));
    onSelect(items);
    setTempItems({});
    setSearch('');
    onClose();
  }, [tempItems, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setTempItems({});
    setSearch('');
    onClose();
  }, [onClose]);

  const selectedCount = Object.keys(tempItems).length;

  return (
    <ModalOverlay open={open} onClose={handleClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-bold text-text-primary">
          Select Warehouse Material
        </h2>
        <button
          onClick={handleClose}
          className="rounded-lg p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PR, client, warehouse..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
        {filtered.length > 0 ? (
          filtered.map((item) => {
            const isChecked = item.prId in tempItems;
            const selectedQty = tempItems[item.prId] ?? item.maxQty;
            return (
              <div
                key={item.prId}
                className={`rounded-lg border p-3 transition-colors ${
                  isChecked
                    ? 'border-amber-400 bg-amber-50/40'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(item.prId, item.maxQty)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleItem(item.prId, item.maxQty)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary text-sm">
                        {item.prId}
                      </span>
                      <span className="text-sm text-text-primary">
                        {item.clientName}
                      </span>
                      <span className="text-xs text-text-muted">
                        · {item.materials.map((m) => m.type).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                      <Warehouse className="h-3 w-3" />
                      {item.warehouseName}
                      <span>·</span>
                      <span className="font-bold text-text-primary text-sm">
                        {item.maxQty.toLocaleString()} Kg
                      </span>
                      <span>·</span>
                      <span className="text-amber-600">
                        {item.daysWaiting} day{item.daysWaiting !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  {isChecked && (
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={selectedQty}
                        min={1}
                        max={item.maxQty}
                        onChange={(e) =>
                          updateQty(
                            item.prId,
                            Math.min(item.maxQty, Math.max(1, Number(e.target.value) || 0)),
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-xs text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[10px] text-text-muted whitespace-nowrap">
                        / {item.maxQty.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">
            No warehouse material available
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-3">
        {onSwitchToPR && (
          <button
            onClick={onSwitchToPR}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            Or add from pickup requests
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={selectedCount === 0}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add Selected ({selectedCount}) →
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
