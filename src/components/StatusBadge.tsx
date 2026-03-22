import { cn } from '@/lib/utils';

// Exact color mapping from Attero's current TMS screenshots
const statusVariants: Record<string, { bg: string; text: string; border?: string }> = {
  // PR statuses
  pending: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },
  planned: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-300' },
  picked_up: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-300' },
  delivered: { bg: 'bg-success-50', text: 'text-success-800', border: 'border-success-400' },
  closed: { bg: 'bg-success-50', text: 'text-success-800', border: 'border-success-400' },
  cancelled: { bg: 'bg-danger-50', text: 'text-danger-800', border: 'border-danger-200' },

  // Load statuses
  draft: { bg: 'bg-gray-200', text: 'text-gray-700' },
  partially_planned: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },
  fully_planned: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-300' },
  in_execution: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-300' },
  completed: { bg: 'bg-success-50', text: 'text-success-800', border: 'border-success-400' },

  // Shipment statuses (matching her screenshot exactly)
  created: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
  vehicle_assignment_pending: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  driver_assignment_pending: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  shipment_plan_pending: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },
  dispatched: { bg: 'bg-coral-50', text: 'text-coral-700', border: 'border-coral-200' },
  in_transit: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-300' },

  // Stop statuses
  skipped: { bg: 'bg-gray-200', text: 'text-gray-600' },
  overdue: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200' },

  // Service type badges
  point_to_point: { bg: 'bg-warning-500', text: 'text-white' },
  milk_run: { bg: 'bg-amber-500', text: 'text-white' },
  
  // Pattern labels
  direct: { bg: 'bg-gray-200', text: 'text-gray-800' },
  multi_vehicle: { bg: 'bg-primary-50', text: 'text-primary-700' },
  cross_dock: { bg: 'bg-purple-50', text: 'text-purple-700' },
  cross_dock_milk_run: { bg: 'bg-purple-50', text: 'text-purple-700' },
  warehouse_consolidation: { bg: 'bg-teal-50', text: 'text-teal-700' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariants[status] ?? {
    bg: 'bg-gray-200',
    text: 'text-gray-700',
  };

  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        variant.bg,
        variant.text,
        variant.border ? `border ${variant.border}` : '',
        className
      )}
    >
      {label}
    </span>
  );
}
