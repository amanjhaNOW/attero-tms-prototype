import { cn } from '@/lib/utils';

const statusVariants: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-warning-50', text: 'text-warning-600', dot: 'bg-warning' },
  planned: { bg: 'bg-primary-50', text: 'text-primary-600', dot: 'bg-primary' },
  picked_up: { bg: 'bg-primary-100', text: 'text-primary-700', dot: 'bg-primary-600' },
  delivered: { bg: 'bg-success-50', text: 'text-success-600', dot: 'bg-success' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  cancelled: { bg: 'bg-danger-50', text: 'text-danger-600', dot: 'bg-danger' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  partially_planned: { bg: 'bg-warning-50', text: 'text-warning-600', dot: 'bg-warning' },
  fully_planned: { bg: 'bg-primary-50', text: 'text-primary-600', dot: 'bg-primary' },
  in_execution: { bg: 'bg-primary-100', text: 'text-primary-700', dot: 'bg-primary-600' },
  completed: { bg: 'bg-success-50', text: 'text-success-600', dot: 'bg-success' },
  in_transit: { bg: 'bg-primary-100', text: 'text-primary-700', dot: 'bg-primary-600' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  overdue: { bg: 'bg-danger-50', text: 'text-danger-600', dot: 'bg-danger' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariants[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  };

  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant.bg,
        variant.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', variant.dot)} />
      {label}
    </span>
  );
}
