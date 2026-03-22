import { useState, useMemo, useCallback } from 'react';
import { X, Search, MapPin, ArrowRight } from 'lucide-react';
import { usePRStore } from '@/stores';
import { ModalOverlay } from './ModalOverlay';

interface PRPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** PR IDs already selected (excluded from available list) */
  excludeIds: Set<string>;
  /** Called with newly selected PR IDs */
  onSelect: (prIds: string[]) => void;
  /** Optional: show switch to warehouse picker */
  onSwitchToWarehouse?: () => void;
}

export function PRPickerModal({
  open,
  onClose,
  excludeIds,
  onSelect,
  onSwitchToWarehouse,
}: PRPickerModalProps) {
  const allPRs = usePRStore((s) => s.pickupRequests);
  const [search, setSearch] = useState('');
  const [tempIds, setTempIds] = useState<Set<string>>(new Set());

  const pendingPRs = useMemo(() => {
    return allPRs.filter((pr) => pr.status === 'pending' && !excludeIds.has(pr.id));
  }, [allPRs, excludeIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pendingPRs;
    const q = search.toLowerCase();
    return pendingPRs.filter(
      (pr) =>
        pr.id.toLowerCase().includes(q) ||
        pr.clientName.toLowerCase().includes(q) ||
        pr.pickupLocation.city.toLowerCase().includes(q) ||
        pr.pickupLocation.state.toLowerCase().includes(q) ||
        pr.materials.some((m) => m.type.toLowerCase().includes(q)),
    );
  }, [pendingPRs, search]);

  const toggle = useCallback((prId: string) => {
    setTempIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) next.delete(prId);
      else next.add(prId);
      return next;
    });
  }, []);

  const handleCommit = useCallback(() => {
    onSelect(Array.from(tempIds));
    setTempIds(new Set());
    setSearch('');
    onClose();
  }, [tempIds, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setTempIds(new Set());
    setSearch('');
    onClose();
  }, [onClose]);

  return (
    <ModalOverlay open={open} onClose={handleClose}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-bold text-text-primary">
          Select Pickup Requests
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
            placeholder="Search by PR ID, client, location..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
        {filtered.length > 0 ? (
          filtered.map((pr) => {
            const qty = pr.materials.reduce((s, m) => s + m.plannedQty, 0);
            const isChecked = tempIds.has(pr.id);
            return (
              <div
                key={pr.id}
                onClick={() => toggle(pr.id)}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  isChecked
                    ? 'border-primary bg-primary-50/50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary text-sm">
                        {pr.id}
                      </span>
                      <span className="text-sm text-text-primary">
                        {pr.clientName}
                      </span>
                      <span className="text-xs text-text-muted">
                        · {pr.materials.map((m) => m.type).join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
                      <MapPin className="h-3 w-3" />
                      {pr.pickupLocation.city}, {pr.pickupLocation.state}
                      <span className="ml-auto font-bold text-text-primary text-sm">
                        {qty.toLocaleString()} Kg
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">
            No pending pickup requests available
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-3">
        {onSwitchToWarehouse && (
          <button
            onClick={onSwitchToWarehouse}
            className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            Or add from warehouse
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
            disabled={tempIds.size === 0}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add Selected ({tempIds.size}) →
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
