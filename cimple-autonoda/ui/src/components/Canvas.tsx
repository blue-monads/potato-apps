import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { FlowNode, Wire, NodeType } from '../types/workflow';
import { NodeCard } from './NodeCard';
import { ZoomIn, ZoomOut, RotateCcw, Wand2, Maximize2, Plus, Zap, GitFork, X } from 'lucide-react';

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
  onAddNodeAndConnect?: (
    fromNodeId: string,
    fromPort: 'out' | 'true' | 'false',
    type: NodeType,
    insertWireId?: string
  ) => void;
  onAddTrigger?: () => void;
  onAutoLayout?: () => void;
  fitViewTrigger?: number;
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
  onAddNodeAndConnect,
  onAddTrigger,
  onAutoLayout,
  fitViewTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // (+) Dropdown Menu state
  interface AddMenuState {
    fromNodeId: string;
    fromPort: 'out' | 'true' | 'false';
    screenX: number;
    screenY: number;
    insertWireId?: string;
  }
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAddMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddMenu(null);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addMenu]);

  // Wire creation state
  const [draggingWire, setDraggingWire] = useState<DraggingWireState | null>(null);

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fit View function
  const fitView = useCallback(() => {
    if (nodes.length === 0 || !containerRef.current) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + 260));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + 140));

    const rect = containerRef.current.getBoundingClientRect();
    const graphW = maxX - minX + 80;
    const graphH = maxY - minY + 80;

    const targetZoom = Math.min(Math.max(Math.min(rect.width / graphW, rect.height / graphH) * 0.9, 0.45), 1.2);
    const targetPanX = Math.round((rect.width - (maxX + minX) * targetZoom) / 2);
    const targetPanY = Math.round(Math.max((rect.height - (maxY + minY) * targetZoom) / 2, 40));

    setZoom(targetZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [nodes]);

  useEffect(() => {
    if (fitViewTrigger && fitViewTrigger > 0) {
      fitView();
    }
  }, [fitViewTrigger, fitView]);

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
      {/* Floating Canvas Controls Toolbar (cimple-eventmap style) */}
      <div className="absolute bottom-5 left-5 bg-white border border-slate-200/90 rounded-xl p-1 flex items-center gap-1 shadow-md z-30">
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.4))}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-semibold text-slate-600 px-1 min-w-[42px] text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.0))}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={fitView}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          title="Fit Workflow to View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 120, y: 40 });
          }}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          title="Reset View (100%)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {onAutoLayout && (
          <>
            <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
            <button
              onClick={onAutoLayout}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
              title="Organize layout automatically"
            >
              <Wand2 className="w-3 h-3 text-indigo-600" />
              <span>Auto Layout</span>
            </button>
          </>
        )}
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

                {/* Wire Midpoint Insert (+) Button */}
                {(() => {
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  return (
                    <g
                      className="cursor-pointer group pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const screenX = rect.left + pan.x + midX * zoom;
                        const screenY = rect.top + pan.y + midY * zoom;
                        setAddMenu({
                          fromNodeId: wire.fromNode,
                          fromPort: wire.fromPort,
                          screenX,
                          screenY,
                          insertWireId: wire.id,
                        });
                      }}
                    >
                      <circle
                        cx={midX}
                        cy={midY}
                        r="9"
                        className="fill-white stroke-slate-300 group-hover:stroke-indigo-600 group-hover:fill-indigo-50 shadow-2xs transition-all"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={midX - 3.5}
                        y1={midY}
                        x2={midX + 3.5}
                        y2={midY}
                        className="stroke-slate-500 group-hover:stroke-indigo-600 transition-colors"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1={midX}
                        y1={midY - 3.5}
                        x2={midX}
                        y2={midY + 3.5}
                        className="stroke-slate-500 group-hover:stroke-indigo-600 transition-colors"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <title>Insert block between these steps</title>
                    </g>
                  );
                })()}
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
              isDragging={draggingNodeId === node.id}
              execStatus={nodeExecStatuses[node.id]}
              onSelect={onSelectNode}
              onDelete={onDeleteNode}
              onStartWire={handleStartWire}
              onEndWire={handleEndWire}
              onDragStart={handleNodeDragStart}
              onOpenAddMenu={(nodeId, port, clientX, clientY) => {
                setAddMenu({
                  fromNodeId: nodeId,
                  fromPort: port,
                  screenX: clientX,
                  screenY: clientY,
                });
              }}
            />
          ))}
        </div>
      </div>

      {/* Empty Canvas Overlay State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center justify-center p-8 bg-white/95 backdrop-blur-xs rounded-2xl border border-dashed border-slate-300 shadow-xl max-w-sm text-center pointer-events-auto">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 shadow-inner">
              <GitFork className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">Canvas is empty</h3>
            <p className="text-xs text-slate-500 mb-4">
              Start your automation pipeline by adding a Trigger block.
            </p>
            {onAddTrigger && (
              <button
                onClick={onAddTrigger}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Event Trigger</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Add Block Dropdown Popover */}
      {addMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: `${Math.min(Math.max(addMenu.screenX - 120, 16), window.innerWidth - 270)}px`,
            top: `${Math.min(addMenu.screenY + 4, window.innerHeight - 200)}px`,
          }}
          className="z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 flex flex-col gap-1 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {addMenu.insertWireId ? 'Insert Block' : 'Add Next Block'}
            </span>
            <button
              onClick={() => setAddMenu(null)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Option 1: Action Block */}
          <button
            onClick={() => {
              if (onAddNodeAndConnect) {
                onAddNodeAndConnect(
                  addMenu.fromNodeId,
                  addMenu.fromPort,
                  'action',
                  addMenu.insertWireId
                );
              }
              setAddMenu(null);
            }}
            className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-teal-50/80 transition-colors text-left cursor-pointer group border border-transparent hover:border-teal-200"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-teal-900">
                  Action Block
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded">
                  ACTION
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                Webhook, send email, enrich data, or log
              </p>
            </div>
          </button>

          {/* Option 2: Logic Block */}
          <button
            onClick={() => {
              if (onAddNodeAndConnect) {
                onAddNodeAndConnect(
                  addMenu.fromNodeId,
                  addMenu.fromPort,
                  'logic',
                  addMenu.insertWireId
                );
              }
              setAddMenu(null);
            }}
            className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-purple-50/80 transition-colors text-left cursor-pointer group border border-transparent hover:border-purple-200"
          >
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <GitFork className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-purple-900">
                  Logic Block
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">
                  BRANCH
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                Condition evaluation with True &amp; False outputs
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
