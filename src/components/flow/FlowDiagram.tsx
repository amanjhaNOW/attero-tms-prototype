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
import { addStopToShipment, removeStopFromShipment } from '@/stores';

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

interface ConnectingFrom {
  nodeId: string;
  /** The underlying entity ID (PR id for sources, Shipment id for shipments) */
  entityId: string;
  nodeType: 'source' | 'shipment';
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
  const [connectingFrom, setConnectingFrom] = useState<ConnectingFrom | null>(null);

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

  // Cancel connection on Escape key or click on empty space
  useEffect(() => {
    if (!connectingFrom) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom]);

  // Cancel connection on click outside nodes
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!connectingFrom) return;
      // Only cancel if click was directly on the container (not on a node)
      if (e.target === e.currentTarget) {
        setConnectingFrom(null);
      }
    },
    [connectingFrom],
  );

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

  // ── Connection Logic ────────────────────────────

  /** Determine the entity ID from a node */
  const getEntityId = useCallback(
    (nodeData: FlowNodeData): string => {
      if (nodeData.type === 'source') {
        return (nodeData.data.pr as PickupRequest).id;
      }
      if (nodeData.type === 'shipment') {
        return (nodeData.data.shipment as Shipment).id;
      }
      return nodeData.id; // destination / hub
    },
    [],
  );

  /** Start a connection from an output port */
  const handleStartConnect = useCallback(
    (nodeId: string) => {
      const node = layout.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.type !== 'source' && node.type !== 'shipment') return;

      setConnectingFrom({
        nodeId,
        entityId: getEntityId(node),
        nodeType: node.type,
      });
    },
    [layout.nodes, getEntityId],
  );

  /** Check if a target node is a valid connection target */
  const isValidTarget = useCallback(
    (target: FlowNodeData): boolean => {
      if (!connectingFrom) return false;

      // Can't connect to self
      if (target.id === connectingFrom.nodeId) return false;

      if (connectingFrom.nodeType === 'source') {
        // Source can only connect to shipments
        return target.type === 'shipment';
      }

      if (connectingFrom.nodeType === 'shipment') {
        // Shipment can connect to destination or another shipment
        if (target.type === 'destination') return true;
        if (target.type === 'shipment') {
          // Can't connect to self
          const targetShipId = (target.data.shipment as Shipment).id;
          return targetShipId !== connectingFrom.entityId;
        }
        return false;
      }

      return false;
    },
    [connectingFrom],
  );

  /** Complete a connection at an input port */
  const handleCompleteConnect = useCallback(
    (targetNodeId: string) => {
      if (!connectingFrom) return;

      const targetNode = layout.nodes.find((n) => n.id === targetNodeId);
      if (!targetNode || !isValidTarget(targetNode)) {
        setConnectingFrom(null);
        return;
      }

      if (connectingFrom.nodeType === 'source') {
        // Source → Shipment: create PICKUP stop
        if (targetNode.type === 'shipment') {
          const targetShipment = targetNode.data.shipment as Shipment;
          const sourceNode = layout.nodes.find((n) => n.id === connectingFrom.nodeId);
          const prId = sourceNode ? (sourceNode.data.pr as PickupRequest).id : '';

          // Check if this connection already exists
          const existingStop = stops.find(
            (s) =>
              s.shipmentId === targetShipment.id &&
              s.type === 'PICKUP' &&
              s.prId === prId,
          );

          if (existingStop) {
            // Already connected — just clear
            setConnectingFrom(null);
            return;
          }

          addStopToShipment(targetShipment.id, 'PICKUP', prId);
        }
      } else if (connectingFrom.nodeType === 'shipment') {
        if (targetNode.type === 'destination') {
          // Shipment → Destination: create DELIVER stop
          const sourceShipmentId = connectingFrom.entityId;

          // Check if DELIVER already exists
          const existingDeliver = stops.find(
            (s) => s.shipmentId === sourceShipmentId && s.type === 'DELIVER',
          );

          if (existingDeliver) {
            setConnectingFrom(null);
            return;
          }

          // For DELIVER, we use addStopToShipment which handles the location
          addStopToShipment(sourceShipmentId, 'DELIVER');
        } else if (targetNode.type === 'shipment') {
          // Shipment → Shipment: create TRANSFER_OUT + TRANSFER_IN pair
          const sourceShipmentId = connectingFrom.entityId;
          const targetShipmentId = (targetNode.data.shipment as Shipment).id;

          addStopToShipment(
            sourceShipmentId,
            'TRANSFER_OUT',
            undefined,
            targetShipmentId,
          );
        }
      }

      setConnectingFrom(null);
    },
    [connectingFrom, layout.nodes, stops, isValidTarget],
  );

  /** Disconnect an edge by removing its stop */
  const handleDisconnect = useCallback(
    (stopId: string | undefined) => {
      if (!stopId) return;
      removeStopFromShipment(stopId);
    },
    [],
  );

  // Get a source label for the connection hint text
  const connectingSourceLabel = useMemo(() => {
    if (!connectingFrom) return '';
    const node = layout.nodes.find((n) => n.id === connectingFrom.nodeId);
    if (!node) return '';
    if (node.type === 'source') {
      return (node.data.pr as PickupRequest).clientName;
    }
    if (node.type === 'shipment') {
      return (node.data.shipment as Shipment).id;
    }
    return '';
  }, [connectingFrom, layout.nodes]);

  const connectingHintText = useMemo(() => {
    if (!connectingFrom) return '';
    if (connectingFrom.nodeType === 'source') {
      return `🔗 Connecting from ${connectingSourceLabel}… Click a truck to connect, or press Escape to cancel.`;
    }
    return `🔗 Connecting from ${connectingSourceLabel}… Click a destination or another truck, or press Escape to cancel.`;
  }, [connectingFrom, connectingSourceLabel]);

  return (
    <div className="relative rounded-xl border border-gray-200 bg-card p-4 overflow-hidden">
      {/* Connection hint bar */}
      {connectingFrom && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary-50 border border-primary-200 px-3 py-2 text-xs text-primary-700">
          <span className="animate-pulse">●</span>
          <span>{connectingHintText}</span>
          <button
            onClick={() => setConnectingFrom(null)}
            className="ml-auto rounded px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

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
      <div
        ref={containerRef}
        className="relative min-h-[120px]"
        onClick={handleContainerClick}
      >
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
            const nodeIsValidTarget = connectingFrom ? isValidTarget(node) : false;
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
                  onStartConnect={isDraft ? handleStartConnect : undefined}
                  onCompleteConnect={isDraft && connectingFrom ? handleCompleteConnect : undefined}
                  isConnecting={!!connectingFrom}
                  isConnectSource={connectingFrom?.nodeId === node.id}
                  isValidTarget={nodeIsValidTarget}
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
                onDisconnect={
                  isDraft && edge.stopId
                    ? () => handleDisconnect(edge.stopId)
                    : undefined
                }
                isTransfer={edge.isTransfer}
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
