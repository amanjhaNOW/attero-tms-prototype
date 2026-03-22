import { useLayoutEffect, useState, useCallback } from 'react';

interface FlowEdgeProps {
  fromRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: 'pending' | 'active' | 'completed';
  label?: string;
  /** Trigger re-layout on this value (e.g. a version counter) */
  layoutVersion?: number;
  /** Called when user clicks the disconnect button */
  onDisconnect?: () => void;
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
  onDisconnect,
}: FlowEdgeProps) {
  const [coords, setCoords] = useState<PathCoords | null>(null);
  const [isHovered, setIsHovered] = useState(false);

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

  // Midpoint for disconnect button
  const disconnectX = midX;
  const disconnectY = (fromY + toY) / 2;

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="pointer-events-auto"
    >
      {/* Fat invisible hit area for easier hovering/clicking */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Visible path */}
      <path
        d={pathD}
        fill="none"
        stroke={isHovered ? '#1976D2' : style.stroke}
        strokeWidth={isHovered ? Math.max(style.strokeWidth, 2.5) : style.strokeWidth}
        strokeDasharray={style.dashArray === 'none' ? undefined : style.dashArray}
        strokeLinecap="round"
        className="transition-all duration-150"
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
        stroke={isHovered ? '#1976D2' : style.stroke}
        strokeWidth={isHovered ? Math.max(style.strokeWidth, 2.5) : style.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Label at midpoint */}
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

      {/* Disconnect button at midpoint (shown on hover) */}
      {isHovered && onDisconnect && (
        <g
          transform={`translate(${disconnectX}, ${disconnectY + (label ? 14 : 0)})`}
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="cursor-pointer"
        >
          <circle
            r={10}
            fill="white"
            stroke="#dc2626"
            strokeWidth={1.5}
            className="drop-shadow-sm"
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight="bold"
            fill="#dc2626"
          >
            ✕
          </text>
        </g>
      )}
    </g>
  );
}
