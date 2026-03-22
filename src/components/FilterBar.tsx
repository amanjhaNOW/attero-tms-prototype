import { Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterChip } from '@/types';

interface FilterBarProps {
  filters: FilterChip[];
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  onApplyFilters?: () => void;
  onMoreFilters?: () => void;
  className?: string;
}

export function FilterBar({
  filters,
  onRemoveFilter,
  onClearAll,
  onApplyFilters,
  onMoreFilters,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <button
        onClick={onApplyFilters}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
      >
        <Filter className="h-3.5 w-3.5" />
        Apply Filters
      </button>

      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      )}

      <button
        onClick={onMoreFilters}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-gray-50 transition-colors"
      >
        More Filters
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {filters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
        >
          {filter.label}: {filter.value}
          <button
            onClick={() => onRemoveFilter(filter.key)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary-100 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
