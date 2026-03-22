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
  /** Whether this edge represents a transfer (ship→ship handover) */
  isTransfer?: boolean;
  /** Transfer location name (from TRANSFER_OUT stop), shown on handover arrows */
  transferLocation?: string;
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
  label: labelProp,
  layoutVersion,
  onDisconnect,
  isTransfer,
  transferLocation,
}: FlowEdgeProps) {
  // For transfer edges, show the handover icon + qty + location
  const label = isTransfer
    ? (() => {
        const parts = ['🤝'];
        if (labelProp) parts.push(labelProp);
        if (transferLocation) parts.push(transferLocation);
        return parts.length > 1 ? parts.join(' ') : '🤝 TBD';
      })()
    : labelProp;
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

    // Skip rendering if any rect has zero size (element not yet laid out)
    if (fromRect.width === 0 || toRect.width === 0 || containerRect.width === 0) {
      setCoords(null);
      return;
    }

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

  // Transfer edges use amber/dashed style
  const transferColor = '#D97706';
  const effectiveStroke = isTransfer ? transferColor : style.stroke;
  const effectiveDash = isTransfer ? '6 4' : (style.dashArray === 'none' ? undefined : style.dashArray);
  const effectiveWidth = isTransfer ? 2 : style.strokeWidth;

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

  // Measure label width for transfer labels (longer text)
  const labelWidth = label ? Math.max(40, label.length * 7 + 12) : 40;
  const isTransferDimmed = isTransfer && !transferLocation && !labelProp;

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
        stroke={isHovered ? (isTransfer ? '#B45309' : '#1976D2') : effectiveStroke}
        strokeWidth={isHovered ? Math.max(effectiveWidth, 2.5) : effectiveWidth}
        strokeDasharray={effectiveDash}
        strokeLinecap="round"
        className="transition-all duration-150"
      >
        {(style.animate || isTransfer) && (
          <animate
            attributeName="stroke-dashoffset"
            from="24"
            to="0"
            dur={isTransfer ? '1.5s' : '1s'}
            repeatCount="indefinite"
          />
        )}
      </path>
      <path
        d={arrowD}
        fill="none"
        stroke={isHovered ? (isTransfer ? '#B45309' : '#1976D2') : effectiveStroke}
        strokeWidth={isHovered ? Math.max(effectiveWidth, 2.5) : effectiveWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Label at midpoint */}
      {label && (
        <g>
          <rect
            x={labelX - labelWidth / 2}
            y={labelY - 8}
            width={labelWidth}
            height={16}
            rx={4}
            fill={isTransfer ? '#FFFBEB' : 'white'}
            stroke={isTransfer ? transferColor : style.stroke}
            strokeWidth={isTransfer ? 1 : 0.5}
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill={isTransfer ? (isTransferDimmed ? '#B4946E' : '#92400E') : '#424242'}
            opacity={isTransferDimmed ? 0.6 : 1}
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
