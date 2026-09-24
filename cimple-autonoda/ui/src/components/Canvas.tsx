import React, { useRef, useState, useCallback } from 'react';
import type { FlowNode, Wire } from '../types/workflow';
import { NodeCard } from './NodeCard';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CanvasProps {
  nodes: FlowNode[];
  wires: Wire[];
  selectedNodeId: string | null;
  activeWireId: string | null;
  activeNodeId: string | null;
  nodeExecStatuses: Record<string, 'pass' | 'fail' | 'done' | 'running'>;
  onSelectNode: (id: string | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onConnectWire: (fromNode: string, fromPort: 'out' | 'true' | 'false', toNode: string, toPort: 'in') => void;
  onDeleteWire: (wireId: string) => void;
  onDropNewNode: (type: any, subtype: string, name: string, x: number, y: number) => void;
}

interface DraggingWireState {
  fromNode: string;
  fromPort: 'out' | 'true' | 'false';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  wires,
  selectedNodeId,
  activeWireId,
  activeNodeId,
  nodeExecStatuses,
  onSelectNode,
  onUpdateNodePosition,
  onDeleteNode,
  onConnectWire,
  onDeleteWire,
  onDropNewNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Wire creation state
  const [draggingWire, setDraggingWire] = useState<DraggingWireState | null>(null);

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate coordinates for node ports in VERTICAL FLOW
  const getPortCoord = useCallback(
    (nodeId: string, port: 'in' | 'out' | 'true' | 'false') => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };

      const el = document.getElementById(nodeId);
      const height = el ? el.offsetHeight : 130;
      const width = 256; // 64 * 4

      if (port === 'in') {
        // Top Center
        return { x: node.x + width / 2, y: node.y };
      }
      if (port === 'out') {
        // Bottom Center
        return { x: node.x + width / 2, y: node.y + height };
      }
      if (port === 'true') {
        // Bottom Left (25%)
        return { x: node.x + width * 0.25, y: node.y + height };
      }
      // false: Bottom Right (75%)
      return { x: node.x + width * 0.75, y: node.y + height };
    },
    [nodes]
  );

  // Generate smooth vertical bezier SVG path
  const createBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dy = Math.max(Math.abs(y2 - y1) * 0.55, 45);
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
  };

  // Canvas Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectNode(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingNodeId) {
      const newX = Math.round((e.clientX - pan.x) / zoom - dragOffset.x);
      const newY = Math.round((e.clientY - pan.y) / zoom - dragOffset.y);
      onUpdateNodePosition(draggingNodeId, newX, newY);
      return;
    }

    if (draggingWire && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDraggingWire((prev) =>
        prev
          ? {
              ...prev,
              currentX: (e.clientX - rect.left - pan.x) / zoom,
              currentY: (e.clientY - rect.top - pan.y) / zoom,
            }
          : null
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggingWire(null);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(zoom * factor, 0.4), 2.0);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      setPan({
        x: cursorX - (cursorX - pan.x) * (newZoom / zoom),
        y: cursorY - (cursorY - pan.y) * (newZoom / zoom),
      });
      setZoom(newZoom);
    }
  };

  // Start dragging a wire
  const handleStartWire = (nodeId: string, port: 'out' | 'true' | 'false', e: React.MouseEvent) => {
    e.stopPropagation();
    const coord = getPortCoord(nodeId, port);
    setDraggingWire({
      fromNode: nodeId,
      fromPort: port,
      startX: coord.x,
      startY: coord.y,
      currentX: coord.x,
      currentY: coord.y,
    });
  };

  // Finish wire at input port
  const handleEndWire = (targetNodeId: string, targetPort: 'in') => {
    if (!draggingWire) return;
    if (draggingWire.fromNode === targetNodeId) {
      setDraggingWire(null);
      return;
    }
    onConnectWire(draggingWire.fromNode, draggingWire.fromPort, targetNodeId, targetPort);
    setDraggingWire(null);
  };

  // Start dragging node card
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - pan.x) / zoom - node.x,
      y: (e.clientY - pan.y) / zoom - node.y,
    });
  };

  // Palette drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dataRaw = e.dataTransfer.getData('application/json');
    if (!dataRaw || !containerRef.current) return;

    try {
      const data = JSON.parse(dataRaw);
      const rect = containerRef.current.getBoundingClientRect();
      const dropX = Math.round((e.clientX - rect.left - pan.x) / zoom - 100);
      const dropY = Math.round((e.clientY - rect.top - pan.y) / zoom - 30);
      onDropNewNode(data.type, data.subtype, data.name, dropX, dropY);
    } catch (err) {
      console.error('Failed to parse dropped node data:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
      className={`flex-1 relative overflow-hidden canvas-bg-grid select-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-default'
      }`}
    >
      {/* Zoom / Reset Toolbar */}
      <div className="absolute bottom-5 left-5 bg-white border border-slate-200 rounded-lg p-1 flex items-center gap-1 shadow-md z-30">
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.4))}
          className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-semibold text-slate-600 px-1 min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.0))}
          className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 80, y: 30 });
          }}
          className="p-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scalable & Pannable Canvas Layer */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {/* SVG Layer for Connections */}
        <svg
          className="absolute top-0 left-0 w-[8000px] h-[8000px] pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrowhead-default"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrowhead-true"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker
              id="arrowhead-false"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          {/* Render Connections */}
          {wires.map((wire) => {
            const p1 = getPortCoord(wire.fromNode, wire.fromPort);
            const p2 = getPortCoord(wire.toNode, wire.toPort);
            const pathD = createBezierPath(p1.x, p1.y, p2.x, p2.y);

            let strokeColor = '#94a3b8';
            let marker = 'url(#arrowhead-default)';
            if (wire.fromPort === 'true') {
              strokeColor = '#10b981';
              marker = 'url(#arrowhead-true)';
            } else if (wire.fromPort === 'false') {
              strokeColor = '#ef4444';
              marker = 'url(#arrowhead-false)';
            }

            const isActive = activeWireId === wire.id;

            return (
              <g key={wire.id} className="pointer-events-auto">
                <path
                  d={pathD}
                  stroke={strokeColor}
                  markerEnd={marker}
                  className={`connection-wire ${isActive ? 'connection-wire-active' : ''}`}
                />
                {/* Hitbox for easy deletion */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth="16"
                  fill="none"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Disconnect this wire?')) {
                      onDeleteWire(wire.id);
                    }
                  }}
                >
                  <title>Click to disconnect wire</title>
                </path>
              </g>
            );
          })}

          {/* Render Ghost Wire during dragging */}
          {draggingWire && (
            <path
              d={createBezierPath(
                draggingWire.startX,
                draggingWire.startY,
                draggingWire.currentX,
                draggingWire.currentY
              )}
              className="ghost-wire"
            />
          )}
        </svg>

        {/* Nodes Layer */}
        <div className="relative pointer-events-auto z-20">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isExecuting={activeNodeId === node.id}
              execStatus={nodeExecStatuses[node.id]}
              onSelect={onSelectNode}
              onDelete={onDeleteNode}
              onStartWire={handleStartWire}
              onEndWire={handleEndWire}
              onDragStart={handleNodeDragStart}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
