import React from 'react';
import { Star, Plus, Trash2, ChevronRight } from 'lucide-react';
import type { BreadcrumbItem, DocumentDetail } from '../types';

interface TopbarProps {
  breadcrumbs: BreadcrumbItem[];
  activeDoc: DocumentDetail | null;
  saveStatus: 'saved' | 'saving' | 'error';
  onTitleChange: (newTitle: string) => void;
  onSelectDoc: (id: number) => void;
  onAddSubpage: () => void;
  onDeleteDoc: () => void;
  onToggleStar: () => void;
  onOpenIconPicker: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  breadcrumbs,
  activeDoc,
  saveStatus,
  onTitleChange,
  onSelectDoc,
  onAddSubpage,
  onDeleteDoc,
  onToggleStar,
  onOpenIconPicker,
}) => {
  if (!activeDoc) {
    return (
      <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-[#e7e7e3] bg-[rgba(255,255,255,0.92)] px-4 backdrop-blur-md">
        <span className="text-xs text-[#8a8a81]">No document selected</span>
      </header>
    );
  }

  const isStarred = activeDoc.is_starred === 1;

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-[#e7e7e3] bg-[rgba(255,255,255,0.92)] px-4 backdrop-blur-md">
      {/* Left side: Breadcrumbs & Title Input */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {/* Breadcrumb path */}
        <div className="flex items-center text-xs text-[#8a8a81] truncate">
          <span className="cursor-default">Workspace</span>
          {breadcrumbs.slice(0, -1).map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="mx-1 h-3 w-3 flex-shrink-0 text-[#b5b5ad]" />
              <button
                type="button"
                onClick={() => onSelectDoc(crumb.id)}
                className="hover:text-[#20201d] hover:underline truncate max-w-[120px] flex items-center gap-1"
              >
                <span>{crumb.icon}</span>
                <span className="truncate">{crumb.title}</span>
              </button>
            </React.Fragment>
          ))}
          <ChevronRight className="mx-1 h-3 w-3 flex-shrink-0 text-[#b5b5ad]" />
        </div>

        {/* Current Document Icon button */}
        <button
          type="button"
          onClick={onOpenIconPicker}
          title="Change icon"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded hover:bg-[#f1f1ed] text-base"
        >
          {activeDoc.icon || '📄'}
        </button>

        {/* Inline editable document title in topbar */}
        <input
          type="text"
          value={activeDoc.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled document"
          className="w-full max-w-[320px] rounded-md px-2 py-1 text-sm font-semibold text-[#20201d] outline-none transition-colors hover:bg-[#f1f1ed] focus:bg-[#f1f1ed]"
        />

        {/* Save status indicator */}
        <span className="ml-2 flex-shrink-0 text-[11px] text-[#9a9a92]">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Failed to save'}
        </span>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Add subpage button */}
        <button
          type="button"
          onClick={onAddSubpage}
          title="Add subpage"
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#60605a] transition-colors hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add subpage</span>
        </button>

        {/* Favorite toggle button */}
        <button
          type="button"
          onClick={onToggleStar}
          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#f1f1ed] ${
            isStarred ? 'text-amber-500' : 'text-[#60605a]'
          }`}
        >
          <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400' : ''}`} />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDeleteDoc}
          title="Delete document"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#60605a] transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
