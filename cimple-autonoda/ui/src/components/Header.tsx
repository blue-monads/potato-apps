import React from 'react';
import type { Workflow } from '../types/workflow';
import { Play, Loader2, Code, History, Plus, Trash2, GitBranch } from 'lucide-react';

interface HeaderProps {
  workflow: Workflow;
  allWorkflows: Workflow[];
  onSelectWorkflow: (id: string | number) => void;
  onUpdateTitle: (title: string) => void;
  onCreateWorkflow: () => void;
  onDeleteWorkflow: (id: string | number) => void;
  onOpenPayloadModal: () => void;
  onOpenHistoryModal: () => void;
  onRunWorkflow: () => void;
  isRunning: boolean;
  saveStatus: 'saved' | 'saving' | 'ready';
}

export const Header: React.FC<HeaderProps> = ({
  workflow,
  allWorkflows,
  onSelectWorkflow,
  onUpdateTitle,
  onCreateWorkflow,
  onDeleteWorkflow,
  onOpenPayloadModal,
  onOpenHistoryModal,
  onRunWorkflow,
  isRunning,
  saveStatus,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <GitBranch className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight hidden sm:inline">Autonoda</span>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

        {/* Workflow Selector & Switcher */}
        <div className="flex items-center gap-2">
          <select
            value={workflow.id}
            onChange={(e) => onSelectWorkflow(e.target.value)}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-slate-700 py-1 px-2.5 rounded-md outline-hidden cursor-pointer max-w-[200px] truncate"
          >
            {allWorkflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button
            onClick={onCreateWorkflow}
            title="Create New Workflow"
            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {allWorkflows.length > 1 && (
            <button
              onClick={() => {
                if (confirm(`Delete workflow "${workflow.name}"?`)) {
                  onDeleteWorkflow(workflow.id);
                }
              }}
              title="Delete Current Workflow"
              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Editable Current Workflow Name */}
        <input
          type="text"
          value={workflow.name}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="text-sm font-semibold text-slate-800 bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white px-2 py-0.5 rounded-md outline-hidden transition-all max-w-[280px]"
          title="Click to rename workflow"
        />

        {/* Status Indicator Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span>{isRunning ? 'Running flow...' : saveStatus === 'saving' ? 'Saving...' : 'Ready'}</span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        {/* Test Payload Button */}
        <button
          onClick={onOpenPayloadModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
          title="Inspect and edit incoming JSON test payload"
        >
          <Code className="w-3.5 h-3.5 text-slate-500" />
          <span>Test Payload</span>
        </button>

        {/* Execution History */}
        <button
          onClick={onOpenHistoryModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs"
          title="View past execution history and audit logs"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>History</span>
        </button>

        {/* Primary Run Test Button */}
        <button
          onClick={onRunWorkflow}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white shadow-xs transition-all ${
            isRunning
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-blue-600/20'
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Workflow</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
