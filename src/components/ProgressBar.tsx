import { cn } from '@/lib/utils';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface ProgressBarProps {
  segments: Segment[];
  className?: string;
  showLabels?: boolean;
}

export function ProgressBar({
  segments,
  className,
  showLabels = true,
}: ProgressBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map((segment, i) => {
          const width = total > 0 ? (segment.value / total) * 100 : 0;
          if (width === 0) return null;
          return (
            <div
              key={i}
              className={cn('h-full transition-all duration-500', segment.color)}
              style={{ width: `${width}%` }}
              title={`${segment.label}: ${segment.value}%`}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex flex-wrap items-center gap-4">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className={cn('h-2.5 w-2.5 rounded-full', segment.color)}
              />
              <span className="text-text-muted">{segment.label}</span>
              <span className="font-semibold text-text-secondary">
                {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
