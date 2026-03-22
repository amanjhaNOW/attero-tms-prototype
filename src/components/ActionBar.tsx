import { cn } from '@/lib/utils';

interface ActionBarProps {
  selectedCount: number;
  entityLabel?: string;
  actions: React.ReactNode;
  className?: string;
}

export function ActionBar({
  selectedCount,
  entityLabel = 'items',
  actions,
  className,
}: ActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]',
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold mr-2">
            {selectedCount}
          </span>
          {entityLabel} selected
        </p>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
