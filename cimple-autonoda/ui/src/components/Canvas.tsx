import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { EditorNode, InferredWire } from '../types/workflow';
import { NodeCard } from './NodeCard';
import { ZoomIn, ZoomOut, RotateCcw, GitFork, Zap } from 'lucide-react';

interface CanvasProps {
  nodes: EditorNode[];
  wires: InferredWire[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDeleteNode: (id: string) => void;
  onDeleteWire: (wireId: string) => void;
  onAddNodeAndConnect?: (fromNodeId: string, branch: 'TRUE' | 'FALSE', type: 'rule_block' | 'target') => void;
  fitViewTrigger?: number;
}

interface BranchMenuState {
  fromNodeId: string;
  branch: 'TRUE' | 'FALSE';
  screenX: number;
  screenY: number;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  wires,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  onDeleteNode,
  onDeleteWire,
  onAddNodeAndConnect,
  fitViewTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 50 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Branch (+) dropdown menu state
  const [branchMenu, setBranchMenu] = useState<BranchMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!branchMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setBranchMenu(null);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [branchMenu]);

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Center / Fit view function
  const fitView = useCallback(() => {
    if (nodes.length === 0 || !containerRef.current) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + 260));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + 140));

    const rect = containerRef.current.getBoundingClientRect();
    const graphW = maxX - minX + 140;
    const graphH = maxY - minY + 140;

    const targetZoom = Math.min(Math.max(Math.min(rect.width / graphW, rect.height / graphH) * 0.9, 0.45), 1.15);
    const targetPanX = Math.round((rect.width - (maxX + minX) * targetZoom) / 2);
    const targetPanY = Math.round(Math.max((rect.height - (maxY + minY) * targetZoom) / 2, 50));

    setZoom(targetZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [nodes]);

  useEffect(() => {
    if (fitViewTrigger && fitViewTrigger > 0) {
      fitView();
    }
  }, [fitViewTrigger, fitView]);

  // Node port coordinate calculation
  const getPortCoord = useCallback(
    (nodeId: string, port: 'in' | 'out' | 'true' | 'false') => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };

      const el = document.getElementById(nodeId);
      const height = el ? el.offsetHeight : 130;
      const width = 256; // w-64

      if (port === 'in') {
        return { x: node.x + width / 2, y: node.y };
      }
      if (port === 'true') {
        // Bottom Left (25%)
        return { x: node.x + width * 0.25, y: node.y + height };
      }
      if (port === 'false') {
        // Bottom Right (75%)
        return { x: node.x + width * 0.75, y: node.y + height };
      }
      return { x: node.x + width / 2, y: node.y + height };
    },
    [nodes]
  );

  // Bezier curve generation
  const createBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dy = Math.max(Math.abs(y2 - y1) * 0.5, 40);
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
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(Math.max(zoom * factor, 0.4), 1.8);

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

  // Node drag start
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

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="flex-1 w-full h-full relative overflow-hidden bg-[#f8fafc] select-none cursor-default"
      style={{
        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Zoom / Viewport HUD Controls - Modern Style */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-sm rounded-lg p-1">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 1.8))}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono font-medium text-slate-600 w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 120, y: 50 });
          }}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset Zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Transformed Canvas Container */}
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
          className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none z-10"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrow-true"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
            </marker>
            <marker
              id="arrow-false"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#e11d48" />
            </marker>
          </defs>

          {/* Render Inferred Connections */}
          {wires.map((wire) => {
            const p1 = getPortCoord(wire.fromNodeId, wire.fromPort);
            const p2 = getPortCoord(wire.toNodeId, 'in');
            const pathD = createBezierPath(p1.x, p1.y, p2.x, p2.y);

            let strokeColor = '#94a3b8';
            let marker = 'url(#arrow-default)';
            if (wire.fromPort === 'true') {
              strokeColor = '#059669'; // Emerald
              marker = 'url(#arrow-true)';
            } else if (wire.fromPort === 'false') {
              strokeColor = '#e11d48'; // Rose
              marker = 'url(#arrow-false)';
            }

            return (
              <g key={wire.id} className="pointer-events-auto">
                <path
                  d={pathD}
                  stroke={strokeColor}
                  strokeWidth="2"
                  fill="none"
                  markerEnd={marker}
                  className="connection-wire hover:stroke-slate-900 transition-colors"
                />
                {/* Hitbox for Disconnect on Click */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth="16"
                  fill="none"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Disconnect this relation?')) {
                      onDeleteWire(wire.id);
                    }
                  }}
                >
                  <title>Click to disconnect relation</title>
                </path>
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-auto z-20">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isDragging={draggingNodeId === node.id}
              onSelect={onSelectNode}
              onDelete={onDeleteNode}
              onDragStart={handleNodeDragStart}
              onOpenBranchMenu={(nodeId, branch, screenX, screenY) => {
                setBranchMenu({ fromNodeId: nodeId, branch, screenX, screenY });
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating Branch (+) Dropdown Menu - Modern Minimalist Style */}
      {branchMenu && onAddNodeAndConnect && (
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${branchMenu.screenX}px`,
            top: `${branchMenu.screenY}px`,
          }}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-1 flex flex-col gap-0.5 w-44 animate-in fade-in duration-75"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-0.5">
            <span>Add Next Step</span>
            <span
              className={`px-1 rounded text-[9px] font-bold ${
                branchMenu.branch === 'TRUE'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {branchMenu.branch}
            </span>
          </div>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddNodeAndConnect(branchMenu.fromNodeId, branchMenu.branch, 'rule_block');
              setBranchMenu(null);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-left cursor-pointer"
          >
            <GitFork className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-medium">+ Rule Block</span>
          </button>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddNodeAndConnect(branchMenu.fromNodeId, branchMenu.branch, 'target');
              setBranchMenu(null);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-left cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium">+ Target Action</span>
          </button>
        </div>
      )}
    </div>
  );
};
