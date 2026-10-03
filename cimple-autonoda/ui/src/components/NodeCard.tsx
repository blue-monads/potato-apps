import React from 'react';
import type { EditorNode } from '../types/workflow';
import {
  Bell,
  GitFork,
  Globe,
  Mail,
  MessageSquare,
  Sparkles,
  Terminal,
  X,
  Plus,
  Clock,
  Zap,
} from 'lucide-react';

interface NodeCardProps {
  node: EditorNode;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  onOpenBranchMenu: (nodeId: string, branch: 'TRUE' | 'FALSE', clientX: number, clientY: number) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  isDragging = false,
  onSelect,
  onDelete,
  onDragStart,
  onOpenBranchMenu,
}) => {
  let Icon = Zap;
  let iconColor = 'text-slate-600 bg-slate-100';

  if (node.type === 'trigger') {
    Icon = Bell;
    iconColor = 'text-blue-600 bg-blue-50';
  } else if (node.type === 'rule_block') {
    Icon = GitFork;
    iconColor = 'text-slate-700 bg-slate-100';
  } else {
    const tgType = node.target?.targetType;
    if (tgType === 'EMAIL') Icon = Mail;
    else if (tgType === 'SMS') Icon = MessageSquare;
    else if (tgType === 'TRANSFORM') Icon = Sparkles;
    else if (tgType === 'CODE') Icon = Terminal;
    else Icon = Globe;
    iconColor = 'text-emerald-700 bg-emerald-50';
  }

  const opSymbols: Record<string, string> = {
    greater_than: '>',
    greater_or_equal: '>=',
    less_than: '<',
    less_or_equal: '<=',
    equals: '==',
    not_equals: '!=',
    contains: 'contains',
    not_contains: '!contains',
    starts_with: 'starts with',
    ends_with: 'ends with',
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
      className={`flow-node-card absolute w-64 bg-white rounded-lg border select-none transition-shadow ${
        isDragging ? 'shadow-md border-slate-300' : 'shadow-xs hover:shadow-sm'
      } ${
        isSelected
          ? 'ring-2 ring-slate-900 border-transparent'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Node Header (Draggable Handle) - Modern  Aesthetic */}
      <div
        onMouseDown={(e) => onDragStart(node.id, e)}
        className="flex items-center justify-between px-3 py-2 border-b border-slate-100 rounded-t-lg bg-slate-50/80 cursor-move"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${iconColor}`}>
            <Icon className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-slate-800 truncate" title={node.title}>
            {node.title}
          </span>
        </div>

        {node.type !== 'trigger' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Delete block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Node Body */}
      <div className="p-3 text-xs text-slate-600 flex flex-col gap-2 relative">
        {/* Trigger Node Body */}
        {node.type === 'trigger' && (
          <>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50/70 text-blue-800 font-medium text-[11px] truncate border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>{node.trigger?.name || 'Event Trigger'}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {node.trigger?.description || 'Starts execution when event occurs'}
            </div>
          </>
        )}

        {/* Rule Block Node Body */}
        {node.type === 'rule_block' && (
          <>
            <div className="flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {node.ruleBlock?.blockType || 'ALL_OF'}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                {node.ruleBlock && node.ruleBlock.delaySeconds > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-700 font-medium">
                    <Clock className="w-2.5 h-2.5" />
                    {node.ruleBlock.delaySeconds}s
                  </span>
                )}
                <span>{(node.ruleBlock?.rules || []).length} rule(s)</span>
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/80 rounded p-1.5 text-[10px] font-mono flex flex-col gap-1 max-h-24 overflow-y-auto">
              {(node.ruleBlock?.rules || []).length === 0 ? (
                <span className="text-slate-400 italic">No conditions added</span>
              ) : (
                node.ruleBlock?.rules?.map((r, i) => (
                  <div key={r.id || i} className="truncate text-slate-700">
                    <span className="text-slate-900 font-medium">{r.variable || 'field'}</span>{' '}
                    <span className="text-slate-500 font-bold">{opSymbols[r.operator] || r.operator}</span>{' '}
                    <span className="text-blue-700 font-medium">{r.value}</span>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Dual-Branch Bar for TRUE and FALSE Paths - Modern Split */}
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-center select-none">
              {/* TRUE Path Point */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenBranchMenu(node.id, 'TRUE', rect.left + rect.width / 2, rect.bottom + 6);
                }}
                className="group flex items-center justify-between px-2 py-1 rounded bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/80 cursor-pointer transition-colors"
                title="Add step on TRUE path"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                    TRUE
                  </span>
                </div>
                <Plus className="w-3 h-3 text-emerald-700 group-hover:scale-110 transition-transform" />
              </div>

              {/* FALSE Path Point */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenBranchMenu(node.id, 'FALSE', rect.left + rect.width / 2, rect.bottom + 6);
                }}
                className="group flex items-center justify-between px-2 py-1 rounded bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 cursor-pointer transition-colors"
                title="Add step on FALSE path"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">
                    FALSE
                  </span>
                </div>
                <Plus className="w-3 h-3 text-rose-700 group-hover:scale-110 transition-transform" />
              </div>
            </div>
          </>
        )}

        {/* Target Node Body */}
        {node.type === 'target' && (
          <>
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-800 font-medium text-[11px] truncate border border-slate-200">
              <span className="font-bold text-[10px] text-slate-600">{node.target?.targetType || 'TARGET'}</span>
              {node.target?.targetType === 'WEBHOOK' && (
                <span className="truncate text-slate-700 font-mono text-[10px]">
                  {node.target.targetMeta?.url ? String(node.target.targetMeta.url).replace(/^https?:\/\//, '') : 'Set URL'}
                </span>
              )}
              {node.target?.targetType === 'EMAIL' && (
                <span className="truncate text-slate-700 text-[10px]">
                  {node.target.targetMeta?.recipient ? node.target.targetMeta.recipient : 'Set recipient'}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {node.target?.linkedBlockId
                ? `Branch: ${node.target.branch || 'TRUE'} path`
                : (node.target?.linkedTargetId ? `Chained after #${node.target.linkedTargetId}` : 'Target Step')}
            </div>
          </>
        )}
      </div>

      {/* Bottom Point for Trigger & Target Nodes */}
      {node.type !== 'rule_block' && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenBranchMenu(node.id, 'TRUE', rect.left + rect.width / 2, rect.bottom + 6);
          }}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border border-slate-300 rounded-full shadow-2xs hover:border-slate-800 hover:text-slate-900 flex items-center justify-center text-slate-500 transition-colors z-20 cursor-pointer"
          title="Add step below"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
