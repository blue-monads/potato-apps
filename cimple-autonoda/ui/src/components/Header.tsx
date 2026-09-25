import React from 'react';
import type { Workflow } from '../types/workflow';
import { 
  Play, 
  Loader2, 
  Code, 
  Clock, 
  Plus, 
  Trash2, 
  GitFork, 
  PanelLeft, 
  Wand2, 
  Maximize2 
} from 'lucide-react';

interface HeaderProps {
  workflow: Workflow;
  allWorkflows: Workflow[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSelectWorkflow: (id: string | number) => void;
  onUpdateTitle: (title: string) => void;
  onCreateWorkflow: () => void;
  onDeleteWorkflow: (id: string | number) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onOpenPayloadModal: () => void;
  onOpenHistoryModal: () => void;
  onRunWorkflow: () => void;
  isRunning: boolean;
  saveStatus: 'saved' | 'saving' | 'ready';
  autoAlignEnabled: boolean;
  onToggleAutoAlign: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workflow,
  allWorkflows,
  sidebarOpen,
  onToggleSidebar,
  onSelectWorkflow,
  onUpdateTitle,
  onCreateWorkflow,
  onDeleteWorkflow,
  onAutoLayout,
  onFitView,
  onOpenPayloadModal,
  onOpenHistoryModal,
  onRunWorkflow,
  isRunning,
  saveStatus,
  autoAlignEnabled,
  onToggleAutoAlign,
}) => {
  return (
    <header className="h-[58px] bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shadow-2xs select-none">
      {/* Left Brand & Workflow Selector (cimple-eventmap style) */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            sidebarOpen
              ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
              : 'bg-white text-slate-500 hover:text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
          title={sidebarOpen ? 'Collapse Blocks Palette' : 'Expand Blocks Palette'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Brand Mark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <GitFork className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm tracking-tight">Autonoda</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                v0.0.2
              </span>
            </div>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden md:block" />

        {/* Workflow Switcher Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={workflow.id}
            onChange={(e) => onSelectWorkflow(e.target.value)}
            className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg outline-hidden cursor-pointer max-w-[210px] truncate transition-colors shadow-2xs"
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
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer shadow-2xs bg-white"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {allWorkflows.length > 1 && (
            <button
              onClick={() => {
                if (confirm(`Delete workflow "${workflow.name}"?`)) {
                  onDeleteWorkflow(workflow.id);
                }
              }}
              title="Delete Current Workflow"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors cursor-pointer shadow-2xs bg-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Editable Title */}
          <input
            type="text"
            value={workflow.name}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="text-xs font-semibold text-slate-800 bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-200 focus:border-indigo-500 focus:bg-white px-2 py-1 rounded-lg outline-hidden transition-all max-w-[240px] truncate"
            title="Click to rename workflow"
          />
        </div>
      </div>

      {/* Right Controls & Actions */}
      <div className="flex items-center gap-2">
        {/* Status Pill (cimple-eventmap style save status) */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span>{isRunning ? 'Simulating flow...' : saveStatus === 'saving' ? 'Saving changes...' : 'Ready / Saved'}</span>
        </div>

        {/* Auto Layout Button */}
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs"
          title="Auto-organize workflow layout vertically (No manual adjustment needed)"
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Auto Layout</span>
        </button>

        {/* Auto-Align on Change Toggle */}
        <button
          onClick={onToggleAutoAlign}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
            autoAlignEnabled
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
          title="Toggle automatic layout alignment whenever blocks or wires change"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${autoAlignEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`} />
          <span>Auto-Align: {autoAlignEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {/* Fit to View */}
        <button
          onClick={onFitView}
          className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          title="Fit workflow to view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 mx-0.5" />

        {/* Test Payload Button */}
        <button
          onClick={onOpenPayloadModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
          title="Inspect and edit incoming JSON test payload"
        >
          <Code className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Payload</span>
        </button>

        {/* Execution History */}
        <button
          onClick={onOpenHistoryModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
          title="View past execution history"
        >
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">History</span>
        </button>

        {/* Primary Test Workflow Button */}
        <button
          onClick={onRunWorkflow}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-all cursor-pointer ${
            isRunning
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 shadow-indigo-600/20'
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
              <span>Test Flow</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
