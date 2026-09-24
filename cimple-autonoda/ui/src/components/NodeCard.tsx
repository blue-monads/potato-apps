import React from 'react';
import type { FlowNode } from '../types/workflow';
import { Bell, GitFork, Globe, Mail, Sparkles, Terminal, X, Check, AlertCircle } from 'lucide-react';

interface NodeCardProps {
  node: FlowNode;
  isSelected: boolean;
  isExecuting: boolean;
  execStatus?: 'pass' | 'fail' | 'done' | 'running';
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartWire: (nodeId: string, port: 'out' | 'true' | 'false', e: React.MouseEvent) => void;
  onEndWire: (nodeId: string, port: 'in') => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  isExecuting,
  execStatus,
  onSelect,
  onDelete,
  onStartWire,
  onEndWire,
  onDragStart,
}) => {
  // Category styling
  let headerBg = 'bg-slate-50 border-slate-200';
  let iconBg = 'bg-slate-600 text-white';
  let Icon = Globe;

  if (node.type === 'trigger') {
    headerBg = 'bg-sky-50/90 border-sky-200';
    iconBg = 'bg-sky-600 text-white';
    Icon = Bell;
  } else if (node.type === 'logic') {
    headerBg = 'bg-purple-50/90 border-purple-200';
    iconBg = 'bg-purple-600 text-white';
    Icon = GitFork;
  } else {
    headerBg = 'bg-teal-50/90 border-teal-200';
    iconBg = 'bg-teal-600 text-white';
    if (node.subtype === 'email') Icon = Mail;
    else if (node.subtype === 'enrich') Icon = Sparkles;
    else if (node.subtype === 'log') Icon = Terminal;
  }

  // Operator symbols map
  const opSymbols: Record<string, string> = {
    greater_than: '>',
    greater_or_equal: '>=',
    less_than: '<',
    less_or_equal: '<=',
    equals: '==',
    not_equals: '!=',
    contains: 'contains',
    not_contains: '!contains',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
  };

  return (
    <div
      id={node.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
      }}
      className={`absolute w-64 bg-white rounded-xl border transition-all shadow-xs select-none ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-md border-transparent'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
      } ${
        isExecuting
          ? 'scale-102 ring-3 ring-blue-400 shadow-lg'
          : ''
      }`}
    >
      {/* Top Input Port Handle (In) - Vertical Flow */}
      {node.type !== 'trigger' && (
        <div
          onMouseUp={(e) => {
            e.stopPropagation();
            onEndWire(node.id, 'in');
          }}
          className="port-handle -top-[6px] left-1/2 -translate-x-1/2"
          title="Flow Input (from step above)"
        />
      )}

      {/* Node Header (Draggable Handle) */}
      <div
        onMouseDown={(e) => onDragStart(node.id, e)}
        className={`flex items-center justify-between px-3 py-2 border-b rounded-t-xl cursor-move ${headerBg}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold text-slate-800 truncate" title={node.title}>
            {node.title}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete block"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node Body */}
      <div className="p-3 text-xs text-slate-600 flex flex-col gap-1.5 relative">
        {node.type === 'trigger' && (
          <>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 text-sky-700 font-medium text-[11px] truncate border border-sky-100">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>{node.config.eventType || 'Event Dispatched'}</span>
            </div>
            <div className="text-[10px] text-slate-400">Emits payload downwards</div>
          </>
        )}

        {node.type === 'logic' && (
          <>
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                {node.config.conditionMode || 'AND'} MODE
              </span>
              <span className="text-[10px] text-slate-400">
                {(node.config.rules || []).length} rule(s)
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-md p-1.5 text-[10px] font-mono flex flex-col gap-1 max-h-20 overflow-y-auto">
              {(node.config.rules || []).length === 0 ? (
                <span className="text-slate-400 italic">No rules defined</span>
              ) : (
                node.config.rules?.map((r, i) => (
                  <div key={i} className="truncate text-slate-700">
                    <span className="text-purple-600">{r.field}</span>{' '}
                    <strong>{opSymbols[r.op] || r.op}</strong>{' '}
                    <span className="text-emerald-600">{r.value}</span>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Branch Bar for Vertical Logic Splitting */}
            <div className="grid grid-cols-2 gap-2 pt-2 mt-1 border-t border-slate-100 text-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">
                  TRUE
                </span>
                <span className="text-[9px] text-slate-400">If passed</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-extrabold uppercase text-rose-600 tracking-wider">
                  FALSE
                </span>
                <span className="text-[9px] text-slate-400">If failed</span>
              </div>
            </div>
          </>
        )}

        {node.type === 'action' && (
          <>
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-50 text-teal-800 font-medium text-[11px] truncate border border-teal-100">
              {node.subtype === 'webhook' && (
                <span>
                  <strong>{node.config.method || 'POST'}</strong>{' '}
                  {(node.config.url || '').replace(/^https?:\/\//, '') || 'URL'}
                </span>
              )}
              {node.subtype === 'email' && (
                <span>To: {node.config.recipient || 'Recipient'}</span>
              )}
              {node.subtype === 'enrich' && (
                <span>
                  {node.config.enrichField || 'key'} = {node.config.enrichValue || 'value'}
                </span>
              )}
              {node.subtype === 'log' && (
                <span>Log: {node.config.logLevel || 'INFO'}</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">Processes & passes payload down</div>
          </>
        )}

        {/* Dynamic Execution Badge */}
        {execStatus && (
          <div className="mt-1 flex items-center justify-center">
            {execStatus === 'running' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                Running...
              </span>
            )}
            {execStatus === 'pass' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3 text-emerald-600 stroke-3" /> TRUE
              </span>
            )}
            {execStatus === 'fail' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3 text-rose-600 stroke-3" /> FALSE
              </span>
            )}
            {execStatus === 'done' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3 text-blue-600 stroke-3" /> Executed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Output Port Handle (Out) - Trigger & Action */}
      {node.type !== 'logic' && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartWire(node.id, 'out', e);
          }}
          className="port-handle -bottom-[6px] left-1/2 -translate-x-1/2"
          title="Flow Output (connect to step below)"
        />
      )}

      {/* Dual Bottom Branch Ports (True & False) - Logic Block */}
      {node.type === 'logic' && (
        <>
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartWire(node.id, 'true', e);
            }}
            className="port-handle true-port -bottom-[6px] left-[25%] -translate-x-1/2"
            title="TRUE branch output (connect to step below)"
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartWire(node.id, 'false', e);
            }}
            className="port-handle false-port -bottom-[6px] left-[75%] -translate-x-1/2"
            title="FALSE branch output (connect to step below)"
          />
        </>
      )}
    </div>
  );
};
