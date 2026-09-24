import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Editor } from './components/Editor';
import { IconPicker } from './components/IconPicker';
import { 
  documentsApi, 
  buildDocumentTree, 
  getBreadcrumbTrail 
} from './lib/api';
import { BASE_PATH } from './lib/base';
import type { DocumentMeta, DocumentDetail } from './types';

export const App: React.FC = () => {
  const { docId } = useParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all documents
  const loadDocuments = useCallback(async (selectIdAfterLoad?: number) => {
    try {
      const list = await documentsApi.list();
      setDocuments(list);

      // Determine which document to open
      let targetId: number | null = selectIdAfterLoad ?? null;
      if (!targetId && docId) {
        targetId = parseInt(docId, 10);
      }
      if (!targetId && list.length > 0) {
        targetId = list[0].id;
      }

      if (targetId) {
        await loadDocumentDetail(targetId);
      } else {
        setActiveDoc(null);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  // Load single document details
  const loadDocumentDetail = async (id: number) => {
    try {
      const doc = await documentsApi.get(id);
      setActiveDoc(doc);
      navigate(`${BASE_PATH}${id}`, { replace: true });
    } catch (err) {
      console.error(`Failed to load document ${id}:`, err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // When URL param docId changes from external navigation
  useEffect(() => {
    if (docId) {
      const parsed = parseInt(docId, 10);
      if (parsed && (!activeDoc || activeDoc.id !== parsed)) {
        loadDocumentDetail(parsed);
      }
    }
  }, [docId]);

  // Document tree structure
  const documentTree = useMemo(() => {
    return buildDocumentTree(documents);
  }, [documents]);

  // Breadcrumbs for active document
  const breadcrumbs = useMemo(() => {
    return getBreadcrumbTrail(documents, activeDoc?.id ?? null);
  }, [documents, activeDoc?.id]);

  // Immediate child documents for the active document
  const childDocuments = useMemo(() => {
    if (!activeDoc) return [];
    return documents.filter((doc) => doc.parent_id === activeDoc.id);
  }, [documents, activeDoc?.id]);

  // Debounced auto-save function
  const triggerAutoSave = (updatedFields: Partial<DocumentDetail>) => {
    if (!activeDoc) return;

    // Immediately update local state for snappy UI
    setActiveDoc((prev) => (prev ? { ...prev, ...updatedFields } : null));

    // Update in documents list if title or icon or starred changed
    if (updatedFields.title !== undefined || updatedFields.icon !== undefined) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id
            ? { ...d, ...updatedFields }
            : d
        )
      );
    }

    setSaveStatus('saving');
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await documentsApi.update(activeDoc.id, updatedFields);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save document:', err);
        setSaveStatus('error');
      }
    }, 450);
  };

  const handleUpdateTitle = (newTitle: string) => {
    triggerAutoSave({ title: newTitle });
  };

  const handleUpdateContent = (newContent: string) => {
    triggerAutoSave({ content: newContent });
  };

  const handleSelectIcon = (icon: string) => {
    triggerAutoSave({ icon });
  };

  const handleSelectDoc = (id: number) => {
    if (activeDoc?.id === id) return;
    loadDocumentDetail(id);
  };

  const handleCreateDoc = async (parentId: number | null = null) => {
    try {
      const created = await documentsApi.create({
        title: 'Untitled',
        parent_id: parentId,
        icon: '📄',
        content: '<h1>Untitled</h1><p></p>',
      });

      const updatedList = await documentsApi.list();
      setDocuments(updatedList);
      setActiveDoc(created);
      navigate(`${BASE_PATH}${created.id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
    }
  };

  const handleDeleteDoc = async (id: number) => {
    const docToDelete = documents.find((d) => d.id === id);
    const title = docToDelete?.title || 'this document';

    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}" and all its nested subpages? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await documentsApi.delete(id);
      const updatedList = await documentsApi.list();
      setDocuments(updatedList);

      if (activeDoc?.id === id) {
        if (updatedList.length > 0) {
          loadDocumentDetail(updatedList[0].id);
        } else {
          setActiveDoc(null);
          navigate(BASE_PATH);
        }
      }
    } catch (err) {
      console.error(`Failed to delete document ${id}:`, err);
    }
  };

  const handleToggleStar = async (id: number, currentStarred: boolean) => {
    const nextStarred = currentStarred ? 0 : 1;
    try {
      await documentsApi.update(id, { is_starred: nextStarred });
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, is_starred: nextStarred } : d))
      );
      if (activeDoc?.id === id) {
        setActiveDoc((prev) => (prev ? { ...prev, is_starred: nextStarred } : null));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f7f7f5]">
        <div className="flex items-center gap-2 text-sm text-[#77776f]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2f6fed] border-t-transparent" />
          <span>Loading Cimple Doks…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f7f7f5] text-[#20201d]">
      {/* Sidebar with Tree View */}
      <Sidebar
        documents={documents}
        tree={documentTree}
        activeDocId={activeDoc?.id ?? null}
        onSelectDoc={handleSelectDoc}
        onCreateDoc={handleCreateDoc}
        onDeleteDoc={handleDeleteDoc}
        onToggleStar={handleToggleStar}
      />

      {/* Main Document Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar
          breadcrumbs={breadcrumbs}
          activeDoc={activeDoc}
          saveStatus={saveStatus}
          onTitleChange={handleUpdateTitle}
          onSelectDoc={handleSelectDoc}
          onAddSubpage={() => handleCreateDoc(activeDoc?.id ?? null)}
          onDeleteDoc={() => activeDoc && handleDeleteDoc(activeDoc.id)}
          onToggleStar={() =>
            activeDoc && handleToggleStar(activeDoc.id, activeDoc.is_starred === 1)
          }
          onOpenIconPicker={() => setIsIconPickerOpen(true)}
        />

        {activeDoc ? (
          <Editor
            key={activeDoc.id}
            document={activeDoc}
            childDocuments={childDocuments}
            onUpdateContent={handleUpdateContent}
            onUpdateTitle={handleUpdateTitle}
            onSelectDoc={handleSelectDoc}
            onAddSubpage={() => handleCreateDoc(activeDoc.id)}
            onOpenIconPicker={() => setIsIconPickerOpen(true)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-[#8a8a81]">
            <p className="text-base font-medium">No document selected</p>
            <p className="mt-1 text-xs">Create a new page to begin writing</p>
            <button
              type="button"
              onClick={() => handleCreateDoc(null)}
              className="mt-4 rounded-lg bg-[#242421] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#343430]"
            >
              + Create document
            </button>
          </div>
        )}
      </div>

      {/* Icon Picker Modal */}
      <IconPicker
        isOpen={isIconPickerOpen}
        currentIcon={activeDoc?.icon || '📄'}
        onSelect={handleSelectIcon}
        onClose={() => setIsIconPickerOpen(false)}
      />
    </div>
  );
};
