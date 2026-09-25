import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Star, 
  Search, 
  MoreHorizontal,
  SidebarClose
} from 'lucide-react';
import type { DocumentMeta, DocumentTreeNode } from '../types';

interface SidebarProps {
  documents: DocumentMeta[];
  tree: DocumentTreeNode[];
  activeDocId: number | null;
  onSelectDoc: (id: number) => void;
  onCreateDoc: (parentId?: number | null) => void;
  onDeleteDoc: (id: number) => void;
  onToggleStar: (id: number, currentStarred: boolean) => void;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  tree,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onToggleStar,
  onToggle,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const toggleCollapse = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const starredDocs = documents.filter((doc) => doc.is_starred === 1);

  // Filtered docs when searching
  const isSearching = searchQuery.trim().length > 0;
  const filteredDocs = isSearching
    ? documents.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  const renderTreeNode = (node: DocumentTreeNode) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = !!collapsedNodes[node.id];
    const isActive = node.id === activeDocId;
    const isMenuOpen = menuOpenId === node.id;

    return (
      <div key={node.id} className="group/item relative">
        <div
          onClick={() => onSelectDoc(node.id)}
          style={{ paddingLeft: `${8 + node.level * 14}px` }}
          className={`flex h-8 w-full cursor-pointer items-center pr-2 text-xs transition-colors select-none ${
            isActive
              ? 'bg-[#efefeb] font-semibold text-[#20201d]'
              : 'text-[#67675f] hover:bg-[#f5f5f2] hover:text-[#20201d]'
          }`}
        >
          {/* Chevron expand/collapse */}
          <button
            type="button"
            onClick={(e) => hasChildren && toggleCollapse(node.id, e)}
            className={`mr-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[#9a9a92] hover:bg-[#e4e4df] hover:text-[#20201d] ${
              !hasChildren ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Document icon */}
          <span className="mr-1.5 flex-shrink-0 text-sm">{node.icon || '📄'}</span>

          {/* Document title */}
          <span className="truncate flex-1 text-left">
            {node.title || 'Untitled'}
          </span>

          {/* Star indicator if starred */}
          {node.is_starred === 1 && (
            <Star className="ml-1 h-3 w-3 flex-shrink-0 fill-amber-400 text-amber-400" />
          )}

          {/* Hover actions */}
          <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100">
            <button
              type="button"
              title="Add subpage"
              onClick={(e) => {
                e.stopPropagation();
                // Ensure parent node is expanded so new subpage is visible
                setCollapsedNodes((prev) => ({ ...prev, [node.id]: false }));
                onCreateDoc(node.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-[#8a8a81] hover:bg-[#e2e2dc] hover:text-[#20201d]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                title="Options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(isMenuOpen ? null : node.id);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-[#8a8a81] hover:bg-[#e2e2dc] hover:text-[#20201d]"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>

              {/* Action Dropdown Menu */}
              {isMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                    }} 
                  />
                  <div 
                    className="absolute right-0 top-6 z-50 w-44 rounded-lg border border-[#dfdfda] bg-white py-1 shadow-lg text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        setCollapsedNodes((prev) => ({ ...prev, [node.id]: false }));
                        onCreateDoc(node.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[#40403c] hover:bg-[#f5f5f2]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add subpage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        onToggleStar(node.id, node.is_starred === 1);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[#40403c] hover:bg-[#f5f5f2]"
                    >
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      <span>{node.is_starred === 1 ? 'Remove favorite' : 'Add to favorites'}</span>
                    </button>
                    <div className="my-1 border-t border-[#e7e7e3]" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        onDeleteDoc(node.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete page</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Subpages / Children */}
        {hasChildren && !isCollapsed && (
          <div className="relative">
            {node.children.map(renderTreeNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-[250px] flex-shrink-0 flex-col border-r border-[#e7e7e3] bg-[rgba(251,251,249,0.92)] select-none">
      {/* Workspace Brand / Header */}
      <div className="flex h-14 items-center justify-between border-b border-[#e7e7e3] px-3.5">
        <div className="flex items-center gap-2 font-semibold text-[#252521]">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d9d9d4] bg-white text-xs font-bold shadow-sm">
            P
          </div>
          <span className="text-sm tracking-tight font-medium">Cimple Doks</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          title="Collapse sidebar (Ctrl+\)"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#67675f] transition-colors hover:bg-[#f1f1ed] hover:text-[#20201d]"
        >
          <SidebarClose className="h-4 w-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5 rounded-lg border border-[#e7e7e3] bg-white px-2.5 py-1.5 text-xs text-[#77776f] focus-within:border-[#2f6fed]">
          <Search className="h-3.5 w-3.5 text-[#9a9a92]" />
          <input
            type="text"
            placeholder="Search documents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-[#9a9a92] text-[#20201d]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#9a9a92] hover:text-[#20201d]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Content Tree / Lists */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* If user is searching, display matching results directly */}
        {isSearching ? (
          <div className="px-2">
            <p className="px-2 py-1 text-[10px] font-bold tracking-wider text-[#9a9a92] uppercase">
              Search Results ({filteredDocs.length})
            </p>
            {filteredDocs.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[#9a9a92]">No documents found</p>
            ) : (
              <div className="space-y-0.5">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onSelectDoc(doc.id);
                      setSearchQuery('');
                    }}
                    className={`flex h-8 w-full items-center rounded-md px-2 text-xs text-left transition-colors ${
                      doc.id === activeDocId
                        ? 'bg-[#efefeb] font-semibold text-[#20201d]'
                        : 'text-[#67675f] hover:bg-[#f5f5f2] hover:text-[#20201d]'
                    }`}
                  >
                    <span className="mr-2 text-sm">{doc.icon || '📄'}</span>
                    <span className="truncate flex-1">{doc.title || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Favorites Section */}
            {starredDocs.length > 0 && (
              <div className="mb-3 px-1">
                <p className="px-3 py-1 text-[10px] font-bold tracking-wider text-[#9a9a92] uppercase">
                  Favorites
                </p>
                <div className="space-y-0.5">
                  {starredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => onSelectDoc(doc.id)}
                      className={`flex h-7 w-full items-center rounded-md px-3 text-xs text-left transition-colors ${
                        doc.id === activeDocId
                          ? 'bg-[#efefeb] font-semibold text-[#20201d]'
                          : 'text-[#67675f] hover:bg-[#f5f5f2] hover:text-[#20201d]'
                      }`}
                    >
                      <span className="mr-2 text-sm">{doc.icon || '📄'}</span>
                      <span className="truncate flex-1">{doc.title || 'Untitled'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hierarchical Document Tree */}
            <div className="px-1">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[10px] font-bold tracking-wider text-[#9a9a92] uppercase">
                  Workspace Documents
                </span>
                <button
                  type="button"
                  onClick={() => onCreateDoc(null)}
                  title="Add root page"
                  className="rounded p-0.5 text-[#9a9a92] hover:bg-[#e4e4df] hover:text-[#20201d]"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {tree.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[#9a9a92]">
                  No documents yet.<br />
                  <button
                    type="button"
                    onClick={() => onCreateDoc(null)}
                    className="mt-2 inline-flex items-center gap-1 rounded bg-[#efefeb] px-2 py-1 text-[#20201d] hover:bg-[#e2e2dc]"
                  >
                    <Plus className="h-3 w-3" /> Create page
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {tree.map(renderTreeNode)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-[#e7e7e3] px-3.5 py-2.5 text-[11px] text-[#8a8a81]">
        <span>{documents.length} {documents.length === 1 ? 'document' : 'documents'}</span>
      </div>
    </aside>
  );
};
