import {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  createRef,
} from 'react';
import type { Load, Shipment, Stop, PickupRequest } from '@/types';
import { computeFlowLayout } from './FlowLayout';
import type { FlowNodeData } from './FlowLayout';
import { FlowNode } from './FlowNode';
import { FlowEdge } from './FlowEdge';

interface FlowDiagramProps {
  load: Load;
  shipments: Shipment[];
  stops: Stop[];
  prs: PickupRequest[];
  onShipmentClick: (shipmentId: string) => void;
  selectedShipmentId?: string;
  onRemoveSource: (prId: string) => void;
  isDraft: boolean;
}

export function FlowDiagram({
  load,
  shipments,
  stops,
  prs,
  onShipmentClick,
  selectedShipmentId,
  onRemoveSource,
  isDraft,
}: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Compute layout
  const layout = useMemo(
    () => computeFlowLayout(load, shipments, stops, prs),
    [load, shipments, stops, prs],
  );

  // Stable node refs map: key = node.id
  const nodeRefs = useMemo(() => {
    const map: Record<string, React.RefObject<HTMLDivElement | null>> = {};
    layout.nodes.forEach((n) => {
      map[n.id] = createRef<HTMLDivElement>();
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.nodes.map((n) => n.id).join(',')]);

  // Recalculate edges when DOM changes
  const triggerRelayout = useCallback(() => {
    setLayoutVersion((v) => v + 1);
  }, []);

  // Observe container for size changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => triggerRelayout());
    ro.observe(el);

    window.addEventListener('resize', triggerRelayout);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', triggerRelayout);
    };
  }, [triggerRelayout]);

  // Re-trigger layout when layout changes (nodes/edges count)
  useEffect(() => {
    // Allow DOM to settle before recalculating arrows
    const id = requestAnimationFrame(() => triggerRelayout());
    return () => cancelAnimationFrame(id);
  }, [layout, triggerRelayout, selectedShipmentId]);

  // Grid template columns
  const gridTemplateColumns = useMemo(() => {
    if (layout.columns === 5) {
      return 'minmax(140px, 180px) 1fr 100px 1fr minmax(140px, 180px)';
    }
    return 'minmax(160px, 200px) 1fr minmax(160px, 200px)';
  }, [layout.columns]);

  // Group nodes by (col, row) for grid placement
  const gridNodes = useMemo(() => {
    return layout.nodes.map((node) => ({
      ...node,
      gridColumn: node.col,
      gridRow: node.row,
    }));
  }, [layout.nodes]);

  // Determine which nodes need vertical centering (single node in its column)
  const columnNodeCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    layout.nodes.forEach((n) => {
      counts[n.col] = (counts[n.col] || 0) + 1;
    });
    return counts;
  }, [layout.nodes]);

  const handleShipmentClick = useCallback(
    (nodeData: FlowNodeData) => {
      if (nodeData.type === 'shipment') {
        const sh = nodeData.data.shipment as Shipment;
        onShipmentClick(sh.id);
      }
    },
    [onShipmentClick],
  );

  return (
    <div className="relative rounded-xl border border-gray-200 bg-card p-4 overflow-hidden">
      {/* Column Headers */}
      <div
        className="grid gap-4 mb-3 px-2"
        style={{ gridTemplateColumns }}
      >
        {layout.columns === 5 ? (
          <>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Sources
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Feeders
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Hub
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Line-Haul
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Destination
            </div>
          </>
        ) : (
          <>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Sources
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Shipments
            </div>
            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Destination
            </div>
          </>
        )}
      </div>

      {/* Flow Container (relative for SVG overlay) */}
      <div ref={containerRef} className="relative min-h-[120px]">
        {/* CSS Grid with nodes */}
        <div
          className="grid gap-y-3 gap-x-4"
          style={{
            gridTemplateColumns,
            gridTemplateRows: `repeat(${layout.maxRows}, minmax(0, auto))`,
          }}
        >
          {gridNodes.map((node) => {
            const isSingle = columnNodeCounts[node.col] === 1 && layout.maxRows > 1;
            return (
              <div
                key={node.id}
                style={{
                  gridColumn: node.gridColumn,
                  gridRow: isSingle ? `1 / ${layout.maxRows + 1}` : node.gridRow,
                  alignSelf: isSingle ? 'center' : undefined,
                }}
                className="flex items-center justify-center"
              >
                <FlowNode
                  ref={nodeRefs[node.id]}
                  nodeData={node}
                  onClick={() => handleShipmentClick(node)}
                  selected={
                    node.type === 'shipment' &&
                    (node.data.shipment as Shipment).id === selectedShipmentId
                  }
                  onRemove={
                    node.type === 'source' && isDraft
                      ? () => onRemoveSource((node.data.pr as PickupRequest).id)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>

        {/* SVG Edge Overlay */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 10 }}
        >
          {layout.edges.map((edge) => {
            const fromRef = nodeRefs[edge.fromNodeId];
            const toRef = nodeRefs[edge.toNodeId];
            if (!fromRef || !toRef) return null;
            return (
              <FlowEdge
                key={edge.id}
                fromRef={fromRef}
                toRef={toRef}
                containerRef={containerRef}
                status={edge.status}
                label={edge.label}
                layoutVersion={layoutVersion}
              />
            );
          })}
        </svg>
      </div>

      {/* Empty state */}
      {layout.nodes.length <= 1 && prs.length === 0 && shipments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-3xl mb-2">🔀</div>
          <p className="text-sm text-text-muted">
            Add sources and shipments to see the flow diagram
          </p>
        </div>
      )}
    </div>
  );
}
