import React from 'react';
import type { EventTrigger } from '../types/workflow';
import {
  Wand2,
  Maximize2,
  ChevronLeft,
  Save,
  Check,
  Loader2,
} from 'lucide-react';

interface HeaderProps {
  activeTrigger: EventTrigger | null;
  onBackToList: () => void;
  onUpdateTitle: (title: string) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onSave: () => void;
  saveStatus: 'saved' | 'saving' | 'ready';
  hasUnsavedChanges: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTrigger,
  onBackToList,
  onUpdateTitle,
  onAutoLayout,
  onFitView,
  onSave,
  saveStatus,
  hasUnsavedChanges,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Back Button & Trigger Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToList}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors text-xs font-semibold cursor-pointer"
          title="Back to all event triggers"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>All Triggers</span>
        </button>

        <div className="h-5 w-px bg-slate-200" />

        {/* Trigger Title Input */}
        {activeTrigger && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100 font-bold">
              #{activeTrigger.id}
            </span>
            <input
              type="text"
              value={activeTrigger.name}
              onChange={(e) => onUpdateTitle(e.target.value)}
              className="text-xs font-bold text-slate-800 px-2 py-1 hover:bg-slate-50 focus:bg-white rounded-lg border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none transition-all w-64 md:w-80 truncate"
              placeholder="Trigger Name..."
              title="Click to rename trigger"
            />
          </div>
        )}
      </div>

      {/* Right: Only Autolayout, Focus Center (Fit View), and Save Button */}
      <div className="flex items-center gap-2">
        {/* Auto Layout Button */}
        <button
          onClick={onAutoLayout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          title="Auto-organize graph layout"
        >
          <Wand2 className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">Auto Layout</span>
        </button>

        {/* Focus Center / Fit View Button */}
        <button
          onClick={onFitView}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          title="Center and fit flow graph to canvas"
        >
          <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
          <span className="hidden sm:inline">Center Focus</span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* Top Right Save Button */}
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer ${
            hasUnsavedChanges
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-600/20 animate-pulse'
              : saveStatus === 'saved'
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
          title="Save all flow graph changes to database"
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-3" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" title="Unsaved changes" />
              )}
            </>
          )}
        </button>
      </div>
    </header>
  );
};
