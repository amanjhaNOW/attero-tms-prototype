import { useLayoutEffect, useState, useCallback } from 'react';

interface FlowEdgeProps {
  fromRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: 'pending' | 'active' | 'completed';
  label?: string;
  /** Trigger re-layout on this value (e.g. a version counter) */
  layoutVersion?: number;
}

interface PathCoords {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const ARROW_SIZE = 6;

function getStatusStyle(status: 'pending' | 'active' | 'completed') {
  switch (status) {
    case 'completed':
      return { stroke: '#4CAF50', strokeWidth: 2, dashArray: 'none', animate: false };
    case 'active':
      return { stroke: '#42A5F5', strokeWidth: 2, dashArray: '8 4', animate: true };
    case 'pending':
    default:
      return { stroke: '#E0E0E0', strokeWidth: 1.5, dashArray: '6 4', animate: false };
  }
}

export function FlowEdge({
  fromRef,
  toRef,
  containerRef,
  status,
  label,
  layoutVersion,
}: FlowEdgeProps) {
  const [coords, setCoords] = useState<PathCoords | null>(null);

  const recalc = useCallback(() => {
    const fromEl = fromRef.current;
    const toEl = toRef.current;
    const containerEl = containerRef.current;
    if (!fromEl || !toEl || !containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    setCoords({
      fromX: fromRect.right - containerRect.left,
      fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
      toX: toRect.left - containerRect.left,
      toY: toRect.top + toRect.height / 2 - containerRect.top,
    });
  }, [fromRef, toRef, containerRef]);

  useLayoutEffect(() => {
    recalc();
  }, [recalc, layoutVersion]);

  if (!coords) return null;

  const { fromX, fromY, toX, toY } = coords;
  const style = getStatusStyle(status);
  const midX = (fromX + toX) / 2;

  // Bezier path
  const pathD = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

  // Arrow head at toX, toY pointing right
  const arrowD = `M ${toX - ARROW_SIZE} ${toY - ARROW_SIZE / 1.5} L ${toX} ${toY} L ${toX - ARROW_SIZE} ${toY + ARROW_SIZE / 1.5}`;

  // Label position at midpoint of bezier (approx)
  const labelX = midX;
  const labelY = (fromY + toY) / 2 - 10;

  return (
    <>
      <path
        d={pathD}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dashArray === 'none' ? undefined : style.dashArray}
        strokeLinecap="round"
      >
        {style.animate && (
          <animate
            attributeName="stroke-dashoffset"
            from="24"
            to="0"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <path
        d={arrowD}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {label && (
        <g>
          <rect
            x={labelX - 20}
            y={labelY - 8}
            width={40}
            height={16}
            rx={4}
            fill="white"
            stroke={style.stroke}
            strokeWidth={0.5}
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill="#424242"
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
}
